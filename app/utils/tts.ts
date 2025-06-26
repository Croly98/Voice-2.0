/**
 * tts.ts (WebRTC-ready version)
 * Uses Google Cloud TTS to convert text into speech and returns raw audio bytes.
 * No file system used — ready to stream via WebRTC, WebSocket, etc.
 */

import textToSpeech from '@google-cloud/text-to-speech'; // Google TTS client

// Initialize Google Cloud TTS client
const client = new textToSpeech.TextToSpeechClient();

/**
 * Synthesizes speech from text and returns the raw audio buffer.
 * Ideal for real-time streaming over WebRTC.
 *
 * @param text - The text to convert into speech
 * @returns A Buffer of audio data (MP3 format)
 */
export async function synthesizeSpeechBuffer(text: string): Promise<Buffer> {
  // Google TTS request config
  const request = {
    input: { text },
    voice: {
      languageCode: 'en-IE', // Irish English
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'MP3', // might change to something else if mp3 is not good enough
    },
  };

  // Make the TTS API call
  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content received from Google TTS');
  }

  // Return raw audio content as Buffer
  return Buffer.from(response.audioContent as Uint8Array);
}
