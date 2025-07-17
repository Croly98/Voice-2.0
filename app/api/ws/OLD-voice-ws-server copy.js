//OLD FILE 
/*
// ws/voice-ws-server.js
// Handles Twilio WebSocket audio stream
// Saves each base64 μ-law chunk to .mulaw file in a per-session folder
// Streams audio to Google Speech-to-Text for live transcription
// Sends transcription text to OpenAI API for response
// Sends Google TTS audio back to Twilio encoded as μ-law over WebSocket

// SET UP GOOGLE TTS!!! NEED TO MAKE ACCOUNT

require('dotenv').config();
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Google Cloud Speech client
const speech = require('@google-cloud/speech');
const speechClient = new speech.SpeechClient();

// OpenAI client setup
const { Configuration, OpenAIApi } = require('openai');
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);

// Import your updated TTS function (expects raw LINEAR16 8kHz PCM buffer)
const { synthesizeSpeechBuffer } = require('../../utils/tts');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log('✅ WebSocket server initialized...');

const baseDir = path.join(__dirname, '..', '..', '..', 'recordings');
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

// μ-law encode linear16 PCM buffer
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

wss.on('connection', (ws, req) => {
  console.log('📞 Twilio stream connected');

  let sessionDir = null;
  let streamSid = null;
  let chunkCounter = 0;

  // Google SST streaming recognize stream
  let recognizeStream = null;

  // Buffer for conversation context to send to OpenAI (optional)
  let conversationHistory = [];

  // Setup Google Speech streaming config
  const request = {
    config: {
      encoding: 'MULAW',
      sampleRateHertz: 8000,
      languageCode: 'en-US',
    },
    interimResults: true,
  };

  function startRecognitionStream() {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', (error) => {
        console.error('❌ Google STT Error:', error);
      })
      .on('data', async (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;

          console.log(`🗣️ Transcription${isFinal ? ' (final)' : ''}:`, transcript);

          if (isFinal) {
            // Add to conversation history
            conversationHistory.push({ role: 'user', content: transcript });

            // Call OpenAI to get AI response
            const aiResponse = await getAIResponse(conversationHistory);
            console.log('🤖 AI Response:', aiResponse);

            // Add AI response to conversation history
            conversationHistory.push({ role: 'assistant', content: aiResponse });

            // Generate TTS audio buffer from AI response
            try {
              const pcmAudioBuffer = await synthesizeSpeechBuffer(aiResponse);

              // μ-law encode
              const mulawBuffer = linear16ToMuLaw(pcmAudioBuffer);

              // Send μ-law audio chunks back to Twilio caller in real time (~20ms chunks)
              const chunkSize = 320; // 320 bytes = 20ms at 8kHz 8-bit μ-law
              for (let i = 0; i < mulawBuffer.length; i += chunkSize) {
                const chunk = mulawBuffer.slice(i, i + chunkSize);
                const base64Chunk = chunk.toString('base64');

                ws.send(JSON.stringify({
                  event: 'media',
                  media: {
                    payload: base64Chunk,
                  },
                }));

                // Wait ~20ms to simulate real-time streaming pace
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

  async function getAIResponse(history) {
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4o-mini', // or your preferred model
        messages: history,
      });
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ OpenAI error:', error);
      return 'Sorry, I had trouble understanding that.';
    }
  }

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);

      if (parsed.event === 'start') {
        streamSid = parsed.streamSid || 'unknown';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        sessionDir = path.join(baseDir, `${timestamp}_${streamSid}`);
        fs.mkdirSync(sessionDir);
        console.log(`📁 Started stream: ${streamSid}`);
        console.log(`📂 Created session folder: ${sessionDir}`);

        // Reset chunk counter and conversation history
        chunkCounter = 0;
        conversationHistory = [];

        // Start Google Speech recognition stream
        startRecognitionStream();

      } else if (parsed.event === 'media') {
        if (!sessionDir || !recognizeStream) return;

        const audio = Buffer.from(parsed.media.payload, 'base64');
        const chunkName = `chunk-${String(chunkCounter).padStart(3, '0')}.mulaw`;
        const chunkPath = path.join(sessionDir, chunkName);

        // Save chunk to disk
        fs.writeFileSync(chunkPath, audio);
        console.log(`🎧 Saved ${chunkName} (${audio.length} bytes)`);
        chunkCounter++;

        // Send audio chunk to Google SST streaming
        recognizeStream.write(audio);

      } else if (parsed.event === 'stop') {
        console.log(`🛑 Stream ended: ${streamSid}`);

        // Close Google SST stream
        if (recognizeStream) {
          recognizeStream.end();
          recognizeStream = null;
        }
      }

    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null;
    }
  });

  ws.on('error', (err) => {
    console.error('❗ WebSocket error:', err);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server listening on ws://localhost:${PORT}`);
});
