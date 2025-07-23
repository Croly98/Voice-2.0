// stt.js
//
// 1. Whisper-based transcription using OpenAI API
// 2. Converts μ-law (Twilio) audio into text via Whisper API
// 3. Audio must be saved as WAV before sending to Whisper
// Requires: axios, fluent-ffmpeg (I think), tmp, fs 

// FFMPEG open source software to record, convert and stream audio

// Axios is a popular open-source JavaScript library used to make HTTP requests 
// from both web browsers and Node.js environments.
// interact with REST APIs by providing a user-friendly API for 
// sending http requests, handling responses, errors etc

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const tmp = require('tmp');
const ffmpeg = require('fluent-ffmpeg');

// Load OpenAI API key (set in .env or hardcoded for testing only)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-api-key-here';

/**
 * Converts raw PCM buffer to temporary WAV file (required by Whisper)
 * @param {Buffer} pcmBuffer - Raw LINEAR16 PCM audio at 8000Hz
 * @returns {Promise<string>} Path to temp WAV file
 */
function savePcmAsWav(pcmBuffer) {
  return new Promise((resolve, reject) => {
    const tmpPath = tmp.tmpNameSync({ postfix: '.wav' });
    const tmpRawPath = tmp.tmpNameSync({ postfix: '.raw' });

    // Write raw PCM to disk
    fs.writeFileSync(tmpRawPath, pcmBuffer);

    // Use ffmpeg to convert raw → WAV
    ffmpeg()
      .input(tmpRawPath)
      .inputFormat('s16le') // PCM signed 16-bit little-endian
      .audioFrequency(8000) // 8kHz — required by Twilio & your existing setup
      .audioChannels(1)
      .output(tmpPath)
      .on('end', () => {
        fs.unlinkSync(tmpRawPath); // Cleanup raw file
        resolve(tmpPath); // Return path to WAV
      })
      .on('error', (err) => {
        console.error('❌ ffmpeg WAV conversion failed:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * 🧠 Transcribe PCM buffer using OpenAI Whisper API
 *
 * @param {Buffer} pcmBuffer - Raw PCM buffer (e.g. from ulaw → pcm conversion)
 * @returns {Promise<string>} Transcribed text
 */
async function transcribeAudio(pcmBuffer) {
  try {
    // Step 1: Convert to temp WAV file
    const wavPath = await savePcmAsWav(pcmBuffer);

    // Step 2: Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', fs.createReadStream(wavPath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders?.(), // For `form-data` lib; if using `FormData` from `undici`, use `formData.headers`
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    // Clean up the WAV file
    fs.unlinkSync(wavPath);

    const text = response.data.text.trim();
    console.log('📝 Whisper Transcript:', text);
    return text;
  } catch (err) {
    console.error('❌ Whisper transcription error:', err.response?.data || err.message);
    return '[error in transcription]';
  }
}

module.exports = {
  transcribeAudio,
};
