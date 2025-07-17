// stream-server.js

// Accepts WebSocket connections from Twilio's <Stream>
// Handles real-time audio and responds with simulated TTS replies
// TODO: Integrate OpenAI Whisper (or Deepgram) for transcription
// TODO: Integrate OpenAI GPT to generate responses dynamically

// 
// 1. IMPORT DEPENDENCIES
// 
const WebSocket = require('ws'); // WebSocket server used by Twilio <Stream>
const http = require('http');    // HTTP server (required by Twilio for initial ping)
const { pcmToMulaw, synthesizeSpeechBuffer } = require('./tts'); // Google TTS helpers

// 
// 2. SET UP BASIC HTTP SERVER (Twilio requires an HTTP "handshake")
// 
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('✅ Twilio TTS server is running');
});

// 
// 3. CREATE WebSocket SERVER + ATTACH TO HTTP
// 
const wss = new WebSocket.Server({ server });

// 
// 4. HANDLE INCOMING CONNECTION FROM TWILIO
// 
wss.on('connection', (ws) => {
  console.log('🔗 New Twilio WebSocket connection established');

  // Handle incoming messages (media or control)
  ws.on('message', async (message) => {
    const msg = JSON.parse(message);

    // 
    // A. MEDIA EVENT — Incoming audio from Twilio
    // 
    if (msg.event === 'media') {
      console.log('🎤 Received audio packet from Twilio');

      // 🧠 STEP 1: TODO - Transcribe audio (future)
      // In future: use Whisper (OpenAI) or Deepgram to transcribe PCM → text
      // Example:
      // const transcript = await transcribe(msg.media.payload);

      // 💬 STEP 2: TODO - Generate reply using OpenAI (future)
      // In future: feed transcript to GPT to generate a response
      // Example:
      // const responseText = await chatGPT(transcript);

      // For now: hardcoded test response
      const responseText = 'Hello! This is a test from Google Text to Speech.';

      // 🗣️ STEP 3: Convert text → TTS (raw PCM LINEAR16, 8000Hz)
      const pcmBuffer = await synthesizeSpeechBuffer(responseText);

      // 🔄 STEP 4: Convert PCM → μ-law (required format for Twilio)
      const mulawBuffer = pcmToMulaw(pcmBuffer);

      // 🎧 STEP 5: Send μ-law audio back to Twilio (base64 encoded)
      const payload = mulawBuffer.toString('base64');
      const twilioResponse = JSON.stringify({
        event: 'media',
        media: { payload },
      });

      ws.send(twilioResponse);
      console.log('📤 Sent synthesized TTS reply to Twilio');
    }

    // 
    // B. CONTROL EVENTS — Call started or ended
    // 

    if (msg.event === 'start') {
      console.log(`📞 Call started — Call SID: ${msg.start.callSid}`);
    }

    if (msg.event === 'stop') {
      console.log(`📴 Call ended — Call SID: ${msg.stop.callSid}`);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log('❌ WebSocket connection with Twilio closed');
  });
});

// 
// 5. START SERVER
// 
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
