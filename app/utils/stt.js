// stt.js

// ✅ Google Cloud STT module for converting live PCM audio into text
// 🔁 Accepts 8000Hz LINEAR16 audio (from Twilio's real-time Stream)
// 💡 Replaces earlier MP3-based STT that doesn't match Twilio pipeline

const speech = require('@google-cloud/speech');

// 🔐 Initialize Google Speech-to-Text client
//     - Auth uses service key file or GOOGLE_APPLICATION_CREDENTIALS env var
const client = new speech.SpeechClient({
  keyFilename: '../../../google-service-key.json', // 
});

/**
 * 🧠 transcribeAudio()
 *
 * Converts 8000Hz LINEAR16 PCM buffer (from Twilio stream) into text using Google STT.
 *
 * @param {Buffer} pcmBuffer - Audio buffer (8000Hz, LINEAR16, little-endian)
 * @returns {Promise<string>} Transcript text or empty string on failure
 */
async function transcribeAudio(pcmBuffer) {
  console.log(`🎙️ STT Input: PCM buffer received (${pcmBuffer.length} bytes)`);

  // 🔄 Convert raw binary to base64 string for API
  const audioBytes = pcmBuffer.toString('base64');

  const request = {
    audio: {
      content: audioBytes,
    },
    config: {
      encoding: 'LINEAR16',        // ✅ Matches Twilio's decoded audio format
      sampleRateHertz: 8000,       // ✅ Must match sample rate from Twilio <Stream>
      languageCode: 'en-IE',       // 🇮🇪 Set voice region; use 'en-US' or others if needed
      enableAutomaticPunctuation: true, // ✨ Optional: adds punctuation
    },
  };

  try {
    // 📤 Send audio to Google Cloud STT API
    const [response] = await client.recognize(request);

    // 📝 Extract transcription from nested response structure
    const transcription = (response.results ?? [])
      .map(result => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim();

    if (!transcription) {
      console.warn('⚠️ No text was transcribed from audio');
      return '';
    }

    console.log(`✅ STT Transcript: "${transcription}"`);
    return transcription;
  } catch (err) {
    console.error('❌ STT Error:', err.message);
    return '';
  }
}

module.exports = { transcribeAudio };
