// made with AI for testing tts

const fs = require('fs');
const path = require('path');
const { synthesizeSpeechBuffer, pcmToMulaw } = require('../utils/tts');

// 📌 Customize this input text
const inputText = 'Hello! This is your Irish voice test from Google TTS.';

(async () => {
  try {
    console.log('🔈 Synthesizing text to LINEAR16 PCM...');
    const pcmBuffer = await synthesizeSpeechBuffer(inputText);

    const pcmPath = path.join(__dirname, 'output.pcm');
    fs.writeFileSync(pcmPath, pcmBuffer);
    console.log(`✅ PCM audio saved: ${pcmPath}`);

    console.log('🎛️ Converting PCM to μ-law...');
    const mulawBuffer = pcmToMulaw(pcmBuffer);

    const ulawPath = path.join(__dirname, 'output.ulaw');
    fs.writeFileSync(ulawPath, mulawBuffer);
    console.log(`✅ μ-law audio saved: ${ulawPath}`);

    console.log('🎉 Test complete! You can now upload or use these files in Twilio.');
  } catch (err) {
    console.error('❌ Error during test:', err.message);
  }
})();
