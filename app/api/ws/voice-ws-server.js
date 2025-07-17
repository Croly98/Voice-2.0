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
//   - Clients send 'offer', 'answer', 'ice-candidate' messages for WebRTC negotiation
//   - Server broadcasts signaling messages to other clients in same session
//
// This allows WebRTC peers to establish direct connections with signaling proxied by this WebSocket server.
//
// Summary:
// Real-time transcription + AI conversation from a Twilio call.
// Text-to-speech replies sent back over WebSocket (as μ-law chunks).
// Relays WebRTC signaling messages so clients can connect peer-to-peer.

require('dotenv').config();

// websocket and HTTP server + filesystem + path utils for audio chunks
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Google Cloud Speech client setup
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

// OpenAI API client setup
const { Configuration, OpenAIApi } = require('openai');
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);

// Import your custom TTS function that returns a raw LINEAR16 8kHz PCM buffer
const { synthesizeSpeechBuffer } = require('../../utils/tts');

// Create HTTP server and WebSocket server instance
const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log('✅ WebSocket server initialized...');

// Directory to save audio chunks (μ-law encoded)
const baseDir = path.join(__dirname, '..', '..', '..', 'recordings');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

// -----------------------------
// Utility: μ-law encode raw LINEAR16 PCM buffer (16-bit little-endian)
// Returns a buffer of 8-bit μ-law encoded audio, suitable for Twilio playback
// This encoding compresses 16-bit audio samples into 8 bits with a non-linear companding algorithm

// dont really understand what I have written here
function linear16ToMuLaw(buffer) {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;
  const muLawBuffer = Buffer.alloc(buffer.length / 2);

  for (let i = 0; i < buffer.length; i += 2) {
    const pcmVal = buffer.readInt16LE(i);
    let sign = (pcmVal >> 8) & 0x80;
    let val = sign ? -pcmVal : pcmVal;
    val = val + MULAW_BIAS;
    if (val > MULAW_MAX) val = MULAW_MAX;
    let exponent = 7;
    for (let expMask = 0x4000; (val & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }
    let mantissa = (val >> (exponent + 3)) & 0x0F;
    let muLawByte = ~(sign | (exponent << 4) | mantissa);
    muLawBuffer[i / 2] = muLawByte;
  }

  return muLawBuffer;
}

// Data structures for WebRTC signaling

// Map WebSocket client to metadata (e.g. sessionId)
const clients = new Map();

// Sessions map session IDs (like room names) to all clients in that session
const sessions = new Map();


// WebSocket connection handler
// Handles both Twilio audio sessions and WebRTC signaling messages
wss.on('connection', (ws, req) => {
  console.log('📞 Client connected');

  let sessionId = null;  // Store the session/room this client belongs to

  // Variables for Twilio + Google STT pipeline per client
  let streamSid = null;
  let sessionDir = null;
  let chunkCounter = 0;
  let recognizeStream = null;   // Google Speech streaming recognition
  let conversationHistory = []; // Chat history for OpenAI context

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
            const aiResponse = await getAIResponse(conversationHistory);
            console.log('🤖 AI Response:', aiResponse);

            // Add AI response to chat history
            conversationHistory.push({ role: 'assistant', content: aiResponse });

            // Generate TTS audio buffer (LINEAR16 8kHz PCM) from AI response
            try {
              const pcmAudioBuffer = await synthesizeSpeechBuffer(aiResponse);

              // μ-law encode for Twilio playback
              const mulawBuffer = linear16ToMuLaw(pcmAudioBuffer);

              // Send μ-law audio back in ~20ms chunks (320 bytes) as base64 over WebSocket
              const chunkSize = 320;
              for (let i = 0; i < mulawBuffer.length; i += chunkSize) {
                const chunk = mulawBuffer.slice(i, i + chunkSize);
                const base64Chunk = chunk.toString('base64');

                ws.send(JSON.stringify({
                  event: 'media',
                  media: {
                    payload: base64Chunk,
                  },
                }));

                // Delay to simulate real-time streaming pace
                await new Promise((r) => setTimeout(r, 20));
              }
              console.log('🔊 TTS audio sent back to caller');
            } catch (err) {
              console.error('❌ Error generating/sending TTS audio:', err);
            }
          }
        }
      });
  }

  // OpenAI chat completion helper function
  // Calls OpenAI Chat API (gpt-4o) using chat history as context
  async function getAIResponse(history) {
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4o', // Adjust model if OpenAI updates
        messages: history,
      });
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ OpenAI error:', error);
      return 'Sorry, I had trouble understanding that.';
    }
  }

  // Handle incoming WebSocket messages from client
  ws.on('message', async (message) => {
    try {
      const parsed = JSON.parse(message);

      // WEBRTC SIGNALING

      // Clients join a sessionId (a room).
      // Then send offers/answers/ICE candidates.
      // Server relays these messages to other clients in the same session.

      if (parsed.type === 'join') {
        // Client joins a signaling session (room)
        sessionId = parsed.sessionId || 'default-room';
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, []);
        }
        sessions.get(sessionId).push(ws);
        clients.set(ws, { sessionId });
        console.log(`🔗 Client joined session: ${sessionId}`);

      } else if (['offer', 'answer', 'ice-candidate'].includes(parsed.type)) {
        // Broadcast WebRTC signaling messages to other clients in the same session
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

      } else if (parsed.event === 'start') {
        // New Twilio stream started
        streamSid = parsed.streamSid || 'unknown';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        sessionDir = path.join(baseDir, `${timestamp}_${streamSid}`);
        fs.mkdirSync(sessionDir);
        console.log(`📁 Started stream: ${streamSid}`);
        console.log(`📂 Created session folder: ${sessionDir}`);

        // Start Google STT stream
        startRecognitionStream();

      } else if (parsed.event === 'media') {
        // Incoming audio chunk from Twilio (μ-law base64)
        if (!recognizeStream) {
          console.warn('Recognition stream not initialized yet');
          return;
        }

        const payload = parsed.media.payload;
        const audioBuffer = Buffer.from(payload, 'base64');

        // Save μ-law chunk to file for record-keeping
        const chunkFilename = path.join(sessionDir, `chunk_${chunkCounter++}.ulaw`);
        fs.writeFile(chunkFilename, audioBuffer, (err) => {
          if (err) console.error('Error saving chunk:', err);
        });

        // Pipe audio data to Google Speech-to-Text streaming recognize
        recognizeStream.write(audioBuffer);

      } else if (parsed.event === 'stop') {
        // Twilio stream ended
        console.log(`📴 Stream stopped: ${streamSid}`);

        // End Google STT stream
        if (recognizeStream) {
          recognizeStream.end();
          recognizeStream = null;
        }

        // Clean up session data
        streamSid = null;
        sessionDir = null;
        chunkCounter = 0;
        conversationHistory = [];

      } else {
        // Unknown or unhandled message
        console.log('Received unknown message:', parsed);
      }
    } catch (err) {
      console.error('❌ Error handling message:', err);
    }
  });

  ws.on('close', () => {
    console.log('📴 Client disconnected');
    // Remove from sessions
    if (sessionId && sessions.has(sessionId)) {
      const arr = sessions.get(sessionId).filter((client) => client !== ws);
      sessions.set(sessionId, arr);
    }
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

// Start HTTP + WS server on port 8080 (adjust as needed)
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});
