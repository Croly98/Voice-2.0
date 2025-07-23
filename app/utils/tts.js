const textToSpeech = require('@google-cloud/text-to-speech');

// ✅ Initialize Google Cloud TTS client with explicit key file (if not using env var)
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: '../../../google-service-key.json', // 🔁 Update this path if your key is in a different folder
});

/**
 * 🔁 Convert 16-bit PCM samples to 8-bit μ-law (used in telephony like Twilio).
 * This implementation follows the standard μ-law encoding.
 *
 * @param {Buffer} pcmBuffer - LINEAR16 PCM audio buffer (16-bit, signed little-endian)
 * @returns {Buffer} μ-law encoded buffer (8-bit)
 */
function pcmToMulaw(pcmBuffer) {
  const MULAW_MAX = 0x1FFF; // Maximum sample value for μ-law compression
  const MULAW_BIAS = 0x84;  // Correct bias value (132 decimal), used in μ-law standard
  const output = Buffer.alloc(pcmBuffer.length / 2); // 16-bit PCM to 8-bit μ-law

  for (let i = 0, j = 0; i < pcmBuffer.length; i += 2, j++) {
    let sample = pcmBuffer.readInt16LE(i);

    // Get the sign and the magnitude of the sample
    let sign = (sample < 0) ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;

    // Add bias for μ-law companding
    sample += MULAW_BIAS;
    if (sample > MULAW_MAX) sample = MULAW_MAX;

    // Find exponent (position of highest set bit)
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }

    // Calculate mantissa
    const mantissa = (sample >> (exponent + 3)) & 0x0F;

    // Compose μ-law byte and invert bits
    const mulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;

    output[j] = mulawByte;
  }
  return output;
}

/**
 * 🔁 Synthesizes speech from text and returns LINEAR16 PCM buffer at 8kHz.
 * This output can be directly μ-law encoded with pcmToMulaw().
 *
 * @param {string} text - The text you want to synthesize into speech
 * @returns {Promise<Buffer>} PCM audio buffer at 8000Hz, 16-bit signed little-endian
 */
async function synthesizeSpeechBuffer(text) {
  const request = {
    input: { text },
    voice: {
      languageCode: 'en-IE', // 🇮🇪 Irish English voice; change to 'en-US' etc. if needed
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 8000, // ✅ Required for Twilio compatibility
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('❌ No audio content received from Google TTS');
  }

  // logging
  console.log('🔊 TTS PCM length:', response.audioContent.length);

  return response.audioContent; // Already a Buffer
}

module.exports = {
  pcmToMulaw,
  synthesizeSpeechBuffer,
};
