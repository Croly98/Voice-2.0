/**
 * tts.ts
 * 
 * Contains functions to interact with Text-to-Speech API (e.g., ElevenLabs or Google).
 * Converts GPT-generated text responses into audio URLs or streams.
 * Designed to allow easy swapping of TTS providers later.
 */

// utils/tts.ts

// add keys later + install google-cloud text to speech later!
// might add ElevenLabs TTS later, 

import fs from 'fs/promises'; // Use promises-based fs for async file operations (will have to look into this)
import path from 'path'; // imports the path module from Node.js (make sure I have that set up)
import { v4 as uuidv4 } from 'uuid'; // a v4 method from the uuid package to generate unique identifiers (UUIDs) for audio files
import textToSpeech from '@google-cloud/text-to-speech'; //Imports the Google Cloud Text-to-Speech client library. (havent installed yet)

// Create a client instance for Google Cloud Text-to-Speech
const client = new textToSpeech.TextToSpeechClient();

/**
 * Converts text into speech audio and saves it as an mp3 file.
 * @param text The text to synthesize. (text that the AI wants to say out loud)
 * @returns The relative URL or path to the saved audio file. (the url path to the audio file to relay to the customer?)*/

//  This function will be used to convert the AI's text response into an audio file that can be played back to the customer during the call.
export async function synthesizeSpeech(text: string): Promise<string> { // made avaible to other files, async works on a promise-based system,
  
    // Build the request for Google TTS
  const request = {
    input: { text },
    voice: { languageCode: 'en-IRE', ssmlGender: 'NEUTRAL' }, // might change accent later
    audioConfig: { audioEncoding: 'MP3' },
  };

  // Call the Text-to-Speech API
  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content received from Google TTS');
  }

  // Generate a unique filename
  const filename = `${uuidv4()}.mp3`;

  // Define the folder where to save audio files — adjust this path to your public directory or wherever you serve static assets
  const outputDir = path.resolve('./public/audio'); // THIS SHOULD BE MADE AUTOMATICALLY (if not make it)
  await fs.mkdir(outputDir, { recursive: true }); // ensure directory exists (outputDir path where audio files are saved, goes to directory, creates it if it doesn't exist, recursive: true means it will create any missing parent directories as well)

  const filePath = path.join(outputDir, filename);

  // Write the binary audio content to a file
  await fs.writeFile(filePath, response.audioContent, 'binary');

  // Return the relative URL that frontend can access
  return `/audio/${filename}`;
}