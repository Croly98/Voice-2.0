/**
 * API Route: /api/generate-response
 * 
 * Receives the customer's transcript (text from speech-to-text),
 * Sends it to GPT-4o (OpenAI) for generating a conversational response,
 * Converts the AI's text response to audio (TTS),
 * Returns the audio URL (or audio data) for the frontend to play over WebRTC.
 */
//BASE64 MOST LIKELY NEEDED FOR WEBRTC!!!

import { NextResponse } from 'next/server';
import { getGptResponse } from '../../other-files/TTS-STT-Project/utils/gpt';     // Calls OpenAI GPT, sends transcript, gets AI reply text
import { synthesizeSpeech } from '../../other-files/TTS-STT-Project/utils/notneeded-tts';   // Converts AI reply text to speech/audio file or stream
// IS THIS THE ^  CORRECT FUNCTION NAME
export async function POST(req: Request) {
  try {
    // Step 1: Parse the incoming JSON request containing the transcript text (the one the customer gave)
    const body = await req.json();
    const { transcript } = body;

    // Step 2: Validate transcript (make sure it exists, if not, return an error)
    if (!transcript) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    // Step 3: Generate AI response text using GPT-4o based on the transcript
    const aiResponse = await getGptResponse(transcript);

    // Step 4: Convert AI response text to audio via TTS service
    const audioUrl = await synthesizeSpeech(aiResponse);

    // Step 5: Return the audio file URL (or base64/audio stream in the future) for frontend playback
    // Note to remember for myself: frontend will fetch this and play audio locally or send it over WebRTC.
    return NextResponse.json({ audioUrl });

    // error handling
  } catch (err: any) {
    console.error('Error in generate-response route:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


// when I sent this to be reveiew by chatGPT, it said:
// "For WebRTC, consider returning audio in a more streamable or raw format."
// it recommends something called base64
