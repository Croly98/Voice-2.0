// ws/voice-ws-server.js
// Handles:
// - Twilio WebSocket audio streams for speech recognition + AI chat + TTS reply
// - WebRTC signaling messages (offer/answer/ICE) for peer connections
//
// Current features:
// - Saves μ-law encoded audio chunks per session
// - Streams audio to Google Speech-to-Text for live transcription
// - Sends transcript text to OpenAI API for conversational response
// - Synthesizes speech from AI reply (using Google TTS or fallback)
// - Sends μ-law audio back over WebSocket to caller (Twilio)
//
// New features:
// - WebRTC signaling handling via JSON messages:
//   - Clients send 'join' with a sessionId (room) to join
//   - Clients send 'offer', 'answer', 'ice‑candidate' messages for WebRTC negotiation
//   - Server broadcasts signaling messages to other clients in same session
//
// This allows WebRTC peers to establish direct connections with signaling proxied by this WebSocket server.
//
// Summary:
// Real-time transcription + AI conversation from a Twilio call.
// Text-to-speech replies sent back over WebSocket (as μ‑law chunks).
// Relays WebRTC signaling messages so clients can connect peer-to-peer.


// IMPORTS
require('dotenv').config();

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient({
  keyFilename: 'C:/josh/Voice-2.0/google-service-key.json',
});

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { streamChatResponse } = require('../../utils/openai');

const { synthesizeSpeechBuffer, pcmToMulaw } = require('../../utils/notneeded-tts');

// CREATES MY WEBSOCKET SERVER AND HTTP SERVER

const server = http.createServer();

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { url } = request;
  if (url === '/media') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

//CREATES FOLDERS FOR AUDIO LOGS AND HELPS WITH WEBSOCKET CLIENTS
//CREATES ROOM

console.log('✅ WebSocket server initialized...');

const baseDir = path.join(__dirname, '..', '..', '..', 'recordings');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

// Map WebSocket client to metadata (e.g. sessionId)
const clients = new Map();

// Map sessionId to array of clients in that session
const sessions = new Map();

//WHEN TWILIO OR CLIENTS CONNECT TO /MEDIA, NOTIFIED

wss.on('connection', (ws, req) => {
  console.log('📞 Client connected');

  let sessionId = null;  // Store the session/room this client belongs to

  // Variables for Twilio + Google STT pipeline per client
  let streamSid = null;
  let sessionDir = null;
  let chunkCounter = 0;
  let recognizeStream = null;   // Google Speech streaming recognition

  // TELLS GOOGLE STT HOW TO INTERPRET TWILIOS INCOMING AUDIO (which is 8kHz μ-law) 

  // Google Speech-to-Text streaming config (expects μ-law 8kHz audio from Twilio)
  const speechRequest = {
    config: {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: 'en-US',
    },
    interimResults: true,
  };

  // Start a streaming recognize request to Google STT
  // On final transcript:
  // 1. Adds it to conversation history.
  // 2. Gets a GPT reply.
  // 3. Converts the reply to audio via TTS.
  // 4. μ-law encodes the audio.
  // 5. Sends audio chunks back over WebSocket (to be played by Twilio).
  function startRecognitionStream() {
    recognizeStream = speechClient
      .streamingRecognize(speechRequest)
      .on('error', (error) => {
        console.error('❌ Google STT Error:', error);
         recognizeStream.end();
         startRecognitionStream(); // restart stream
      })
      .on('data', async (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;

          console.log(`🗣️ Transcription${isFinal ? ' (final)' : ''}:`, transcript);

          if (isFinal) {
            // Add user transcript to chat history for context
            conversationHistory.push({ role: 'user', content: transcript });

            // Get AI response from OpenAI API
            let aiResponse = '';

            for await (const chunk of streamChatResponse(conversationHistory)) {
              aiResponse += chunk;
            }
            console.log('🤖 AI Response:', aiResponse);

            // Add AI response to chat history
            conversationHistory.push({ role: 'assistant', content: aiResponse });


            // Generate TTS audio buffer (LINEAR16 8kHz PCM) from AI response
            try {
              const pcmAudioBuffer = await synthesizeSpeechBuffer(aiResponse);

              // μ-law encode for Twilio playback
              const mulawBuffer = pcmToMulaw(pcmAudioBuffer);

              // Debug logs — do this ONCE per audio response
              console.log('🔎 PCM preview:', pcmAudioBuffer.slice(0, 10));
              console.log('🔎 PCM buffer length:', pcmAudioBuffer.length);
              console.log('🔎 μ-law buffer length:', mulawBuffer.length);

              // Send audio back to Twilio
              await sendAudioInChunks(ws, mulawBuffer);

            } catch (err) {
              console.error('❌ Error generating/sending TTS audio:', err);
            }
          }
        }
      });
  }

  ws.on('message', async (message, isBinary) => {
    try {
      if (isBinary) {
        // 🔊 This is raw audio data from Twilio (μ-law)
        if (recognizeStream) {
          recognizeStream.write(message); // send audio to Google STT
        }
        return; // don't try to parse binary as JSON
      }

      // This is a JSON message (event or signaling)
      const parsed = JSON.parse(message.toString());

      // WEBRTC SIGNALING 

      if (parsed.type === 'join') {
        sessionId = parsed.sessionId || 'default-room';
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, []);
        }
        sessions.get(sessionId).push(ws);
        clients.set(ws, { sessionId });
        console.log(`🔗 Client joined session: ${sessionId}`);

      } else if (['offer', 'answer', 'ice-candidate'].includes(parsed.type)) {
        if (!sessionId) {
          return console.warn('Client has not joined a session yet');
        }
        const otherClients = sessions.get(sessionId) || [];
        for (const client of otherClients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(parsed));
          }
        }

      // TWILIO AUDIO STREAM & GOOGLE STT

      // STARTS SPEECH TO TEXT STREAM

      } else if (parsed.event === 'start') {
        // Twilio starts sending audio stream, with StreamSid info
        streamSid = parsed.streamSid || `session_${Date.now()}`;
        sessionDir = path.join(baseDir, streamSid);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

        chunkCounter = 0;
        conversationHistory = [{ role: 'system', content: 'You are a helpful assistant.' }];

        console.log(`▶️ Starting stream for ${streamSid}`);

        // Start Google STT stream
        startRecognitionStream();

        //CONVERTS THE BASE64 U-LAW AUDIO TO A BUFFER
        //FOR GOOGLE SPEECH TO TEXT TO STREAM

        //THIS IS FOR INCOMING AUDIO
        //WE RECEIVE AUDIO FROM TWILIO VIA WEBSOCKET MESSAGES

      } else if (parsed.event === 'media') {
        const payload = Buffer.from(parsed.media.payload, 'base64');
        if (recognizeStream && !recognizeStream.destroyed) {
          recognizeStream.write(payload); // FEEDS INTO GOOGLE STT
        } else {
          console.warn('⚠️ Tried to write to a destroyed or missing recognizeStream');
        }

      } else if (parsed.event === 'stop') {
  console.log(`⏹️ Stopping stream for ${streamSid}`);

  if (recognizeStream && !recognizeStream.destroyed) {
    recognizeStream.end();
  }
  recognizeStream = null;

  // Remove this client from the sessions map if sessionId exists
  if (sessionId && sessions.has(sessionId)) {
    const clientList = sessions.get(sessionId);
    sessions.set(sessionId, clientList.filter((client) => client !== ws));
  }

  // Remove client from clients map as well
  clients.delete(ws);

  // Reset sessionId and streamSid
  sessionId = null;
  streamSid = null;

      } else {
        console.log('❓ Unknown message received:', parsed);
      }
    } catch (err) {
      console.error('❌ Error handling message:', err);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Client disconnected');

    // Remove client from session map
    if (sessionId && sessions.has(sessionId)) {
      const clientList = sessions.get(sessionId);
      sessions.set(sessionId, clientList.filter((c) => c !== ws));
      clients.delete(ws);
    }

    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null;
    }
  });
});

// ADDED BY AI- Helper function: send μ-law audio back to Twilio in small chunks

// OUTGOING AUDIO TO TWILIO
// Takes μ-law encoded audio from Google TTS output
// Sends each chunk as a raw binary buffer over the WebSocket
// Twilio hears this audio and plays it back to the caller

// SUMMARY: μ-law audio → Binary chunks → WebSocket → Twilio plays to caller

async function sendAudioInChunks(ws, mulawBuffer) {
  const chunkSize = 320; // 20ms @ 8kHz

  for (let i = 0; i < mulawBuffer.length; i += chunkSize) {
    let chunk = mulawBuffer.slice(i, i + chunkSize);

    // 🧼 Pad final chunk with μ-law silence (0xFF)
    if (chunk.length < chunkSize) {
      const padding = Buffer.alloc(chunkSize - chunk.length, 0xFF);
      chunk = Buffer.concat([chunk, padding]);
      console.log(`🧩 Final chunk padded to ${chunk.length} bytes`);
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: chunk.toString('base64'),
          track: 'outbound',
        },
      }));
    }

    // Simulate real-time 20ms spacing
    await new Promise((r) => setTimeout(r, 20));
  }

  // 🕓 Give Twilio time to finish playing before connection closes
  await new Promise((r) => setTimeout(r, 500));

  console.log('✅ All μ-law chunks sent to Twilio');
}


// -- OpenAI chat completion helper function -- REMOVED AS ALREADY DEFINED
// Calls OpenAI Chat API (gpt-3.5-turbo) using chat history as context


// Start HTTP server (can be replaced with your own express app)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
