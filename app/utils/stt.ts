// speech-to-text
// converting custmer audio input into text to send to GPT-4o

/**
 * stt.ts
 *
 * Utility for Speech-to-Text (STT) processing.
 * This uses Google Cloud's Speech-to-Text API to transcribe audio recordings into text. But I can change this later
 
// utils/stt.ts

// Packages */

// utils/stt.ts

import fs from 'fs/promises';
import speech from '@google-cloud/speech';

// Types from Google Speech library
type RecognizeResponse = speech.protos.google.cloud.speech.v1.IRecognizeResponse;
type SpeechRecognitionResult = speech.protos.google.cloud.speech.v1.ISpeechRecognitionResult;

const client = new speech.SpeechClient();

/**
 * Transcribes an MP3 audio buffer using Google Cloud Speech-to-Text.
 * @param audioBuffer The audio data as a Buffer (binary)
 * @returns Transcribed text or null if no transcription
 */
export async function transcribeMP3(audioBuffer: Buffer): Promise<string | null> {
  // --- Step 2.2: Log incoming audio buffer size ---
  console.log(`🗣️ Transcribing audio buffer (${audioBuffer.length} bytes)`);

  // Convert audio buffer to base64 string (Google API expects base64)
  const audioBytes = audioBuffer.toString('base64');

  const audio = {
    content: audioBytes,
  };

  const config = {
    encoding: 'MP3',
    sampleRateHertz: 16000,
    languageCode: 'en-IE',
  };

  const request = {
    audio,
    config,
  };

  try {
    // Send audio to Google STT
    const [response] = await client.recognize(request) as [RecognizeResponse];

    // Extract transcription text
    const transcription = (response.results ?? [])
      .map((result: SpeechRecognitionResult) => result.alternatives?.[0].transcript || '')
      .join(' ')
      .trim();

    if (!transcription) {
      console.warn('⚠️ No transcription found.');
      return null;
    }

    // --- Log the transcription result ---
    console.log(`✅ Transcript: "${transcription}"`);

    return transcription;
  } catch (error) {
    console.error('❌ Error during transcription:', error);
    return null;
  }
}
