// app/api/ws/route.ts

// WebSocket server setup for handling real-time communication in a WebRTC session

// Keeps the connection open

// Allows both the client and server to send messages at any time

// Is ideal for real-time apps (chat, games, live updates, etc.)

// breakdown
// accepts audio data from the client (microphone input),
// transcribes it to text using speech-to-text,
// sends the text to OpenAI's GPT-4o for a response,
// converts ais reply to audio using text-to-speech,
// sends the audio back to the client

// imports
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { SpeechClient } from '@google-cloud/speech';
import { OpenAI } from 'openai';
import { transcribeMP3 } from '@/utils/stt';
import { synthesizeSpeechBuffer as synthesizeSpeech } from '@/utils/tts';

// keeps of connected clients using dictionary where: key sessionId, value is an array of WebSocket connections
const sessions: Record<string, WebSocket[]> = {};

// these initalize the openAI, tts and sst
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ttsClient = new TextToSpeechClient();
const sttClient = new SpeechClient();

// this function attaches the websocket server to an existing HTTP server
export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  // when client connects, it will be assigned a sessionId using the URL query parameter (/ws)
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost'); //might have to update to exact host
    const sessionId = url.searchParams.get('sessionId');

    // Validate sessionId. error if not provided
    if (!sessionId) {
      ws.close(1008, 'Missing sessionId');
      return;
    }

    // adds the cust to the list of connected sockets under the sessionId
    sessions[sessionId] = sessions[sessionId] || [];
    sessions[sessionId].push(ws);

    console.log(`Client joined session: ${sessionId}`);

    // receiving audio message

    // this triggers when the clients sends a message (binary- audio data)
    ws.on('message', async (message: Buffer) => {
      try {
        const transcript = await transcribeMP3(message); // the message (audio buffer) is transcribed to text using transscribeMP3 function
        if (!transcript) return;

        const aiReply = await getAIResponse(transcript); // sends the transcript to OpenAI's GPT-4o to get a response
        const audioBuffer = await synthesizeSpeech(aiReply); // converts OpenAI's response back to audio

        // Send audio back only to the sender
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audioBuffer);
        }
      } catch (err) {
        console.error('Error processing audio message:', err);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: 'Processing failed' }));
        }
      }
    });

    // closing

    // removes the websocket from the session when disconnected
    // when everyone has left, session is deleted
    ws.on('close', () => {
      sessions[sessionId] = (sessions[sessionId] || []).filter((client) => client !== ws);
      if (sessions[sessionId].length === 0) {
        delete sessions[sessionId];
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error in session ${sessionId}:`, err);
    });
  });
}
