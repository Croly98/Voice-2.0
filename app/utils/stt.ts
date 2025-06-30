// speech-to-text
// converting custmer audio input into text to send to GPT-4o

/**
 * stt.ts
 *
 * Utility for Speech-to-Text (STT) processing.
 * This uses Google Cloud's Speech-to-Text API to transcribe audio recordings into text. But I can change this later
 
// utils/stt.ts

// Packages */

import fs from 'fs/promises'; // for reading audio files (load mp3 file and pass its binary to STT)
// import path from 'path'; // to help manage file paths (for manager folders and finidng a particular file) dont think i need it for now
import speech from '@google-cloud/speech'; // Google Cloud STT client (INSTALL LATER!)

// note sure what these are for but when reviewing my code gpt said to add these (review later)
type RecognizeResponse = speech.protos.google.cloud.speech.v1.IRecognizeResponse;
type SpeechRecognitionResult = speech.protos.google.cloud.speech.v1.ISpeechRecognitionResult;

// Create an instance of the Google STT client
const client = new speech.SpeechClient();

/**
 * Transcribes a given audio file using Google STT.
 * @param audioPath The local file path to the audio file 
 * @returns The transcribed text of what the user said
 */
export async function transcribeAudio(audioPath: string): Promise<string> {
    // Read the audio file into a buffer (binary data)
    const file = await fs.readFile(audioPath);
  
    // Encode it as base64 to send to Google API (the binary)
    const audioBytes = file.toString('base64');
  
    // Set up config for Google STT request (will double check this to make sure its correct)
    const audio = {
      content: audioBytes,
    };
  
    const config = {
      encoding: 'MP3', // encoded for MP3
      sampleRateHertz: 16000, // Standard sample rate (not sure if this is the correct one, I found some say 16k vs 44100)
      languageCode: 'en-IE', // English w/ Irish accent
    };
  
    const request = {
      audio,
      config,
    };
  
    // Send request to Google Speech-to-Text
    const [response] = await client.recognize(request) as [RecognizeResponse];

  
    // Pull out the transcription
    const transcription = (response.results ?? [])
  .map((result: SpeechRecognitionResult) => result.alternatives?.[0].transcript || '')
  .join(' ')
  .trim();


  
    // error message if no transcription found
    if (!transcription) {
      throw new Error('No transcription found.');
    }
  
    return transcription;
  }

// setting this u for .mp3 files, but can change to .wav or other formats
// might add Error UI styling later