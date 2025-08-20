/**
 * API Route: /api/generate-response
 * 
 * Helper API that integrates OpenAI (GPT-4o if possible) to generate conversational responses,
 * Uses TTS service (google and then switch to ElevenLabs) to convert text to audio,
 * Returns audio URL or stream for Twilio to play back in the call.
 */

//ELEVEN LABS MIGHT BE NEEDED FOR FAST TTS

// app/api/generate-response/route.ts

import { NextResponse } from 'next/server';
import { getGptResponse } from '../../../utils/gpt';     // function that calls OpenAI GPT: It sends some input text (customer said) to GPT and gets back a generated text response (unclear where it exactly goes yet)
import { synthesizeSpeech } from '../../../utils/tts';   // function that uses TTS (text-to-speech)

export async function POST(req: Request) { // Handle POST (sends data to server) front end requests this, req  is the request object containing the data sent by the front end, 
  try {
    // Step 1: Parse the incoming JSON request (transcript of what the customer said)
    const body = await req.json();
    const { transcript } = body;

    // Step 2: Make sure there's a transcript (making sure we can hear the customer said)
    if (!transcript) { // If no transcript (remember "!" means not) is provided, return an error response
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 }); //
    }

    // Step 3: Generate an AI response using GPT4o (based on the transcript)
    const aiResponse = await getGptResponse(transcript); //creates variable, holds the ai response, assigns the value to aiResponse, waits for GPT to respond, getGPTResponse gets the reply from GPT, transcript is for passing the customer input to GPT so it knows how to respond

    // Step 4: Convert that AI response into audio (TTS)
    const audioUrl = await synthesizeSpeech(aiResponse); //holds the audio url, waits for the TTS service to convert the text response into an audio file, synthesizeSpeech is a function that takes the AI response and converts it to audio, returns the URL of the audio file

    // Step 5: Return the audio file location so Twilio can play it
    return NextResponse.json({ audioUrl }); //sends a resonse back and end the function, NextResponse.json creates a JSON response with the audioURL, whichh Twilio will use to play the audio in the call
  } catch (err: any) { // if an errror occurs
    console.error('Error in generate-response route:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

