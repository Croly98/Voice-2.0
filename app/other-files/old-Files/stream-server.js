// stream-server.js

// Accepts WebSocket connections from Twilio's <Stream>
// Handles real-time audio and responds with simulated TTS replies
// ✅ Now includes: Transcription (STT) + GPT reply + TTS response

//
// 1. IMPORT DEPENDENCIES
//
const WebSocket = require('ws'); // WebSocket server used by Twilio <Stream>
const http = require('http');    // HTTP server (required by Twilio for initial ping)
const { pcmToMulaw, synthesizeSpeechBuffer } = require('./tts'); // Google TTS helpers
const { ulawToPcm } = require('./utils/ulaw'); // Convert μ-law to PCM (for STT engines)
const { transcribeAudio } = require('./stt'); // Speech-to-text helper (Whisper, Deepgram, etc.)
const { generateGPTResponse } = require('./gpt'); // OpenAI ChatGPT helper

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

  // 🧠 Optional: store call state per connection here (e.g., conversation history)

  // Handle incoming messages (media or control)
  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (err) {
      console.error('❌ Invalid JSON from Twilio:', message.toString());
      return;
    }

    //
    // A. CONTROL EVENTS — Call started or ended
    //
    if (msg.event === 'start') {
      console.log(`📞 Call started — Call SID: ${msg.start.callSid}`);
      return;
    }

    if (msg.event === 'stop') {
      console.log(`📴 Call ended — Call SID: ${msg.stop.callSid}`);
      return;
    }

    //
    // B. MEDIA EVENT — Incoming audio from Twilio
    //
    if (msg.event === 'media') {
      console.log('🎤 Received audio packet from Twilio');

      try {
        //
        // STEP 1: Decode μ-law base64 audio → Buffer
        const ulawBuffer = Buffer.from(msg.media.payload, 'base64');

        // STEP 2: μ-law → PCM (required format for most STT engines)
        const pcmBuffer = ulawToPcm(ulawBuffer); // LINEAR16, 8000Hz

        // STEP 3: Transcribe audio to text using STT engine
        const transcript = await transcribeAudio(pcmBuffer);
        console.log('📝 Transcribed text:', transcript);

        // STEP 4: Generate AI response using ChatGPT (or other LLM)
        const replyText = await generateGPTResponse(transcript);
        console.log('🤖 GPT reply:', replyText);

        // STEP 5: Convert reply text → TTS (Google → PCM)
        const replyPcmBuffer = await synthesizeSpeechBuffer(replyText);

        
        // STEP 6: PCM → μ-law for Twilio playback
        const replyUlawBuffer = pcmToMulaw(replyPcmBuffer);
        const base64Audio = replyUlawBuffer.toString('base64');

        
        // STEP 7: Send μ-law audio back to Twilio stream
        ws.send(JSON.stringify({
          event: 'media',
          media: { payload: base64Audio }
        }));

        console.log('📤 Sent TTS reply back to Twilio');

      } catch (err) {
        console.error('❌ Error in TTS/STT pipeline:', err);
      }
    }
  });

  // C. HANDLE DISCONNECTION OR ERRORS
  ws.on('close', () => {
    console.log('❌ WebSocket connection with Twilio closed');
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
  });
});

// 5. START SERVER
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
