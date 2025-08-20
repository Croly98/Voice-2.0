// app/api/voice/route.js

// Twilio TwiML response route
// crucial for telling Twilio what to do during the call


// import Twilio’s built-in twiml helper, generates XML responses in the correct format for Twilio
import { twiml } from 'twilio';

// This is the POST handler for this route
// Twilio will send a POST request to this route when it calls your number
export async function POST(req) {

// VoiceResponse object which will build your TwiML instructions  
  const voiceResponse = new twiml.VoiceResponse();

// Have it say the following:
  voiceResponse.say('Hello! This is your test Twilio call. Everything is working fine.');
//voiceResponse.play('https://INSERTAUDIO.com/audio.mp3'); (IF I WANT AUDIO)

// Returing the TwiML Response
  return new Response(voiceResponse.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}


// flow summary:

// Your makeCall.js or initiateCall.ts triggers a call via Twilio.

// Twilio calls the user and hits the url you provided (/api/voice).

// This route.js file runs and sends TwiML instructions.

// Twilio reads it and speaks the message to the person who picked up.




