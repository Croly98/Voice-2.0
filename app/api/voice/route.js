// app/api/voice/route.js

import { twiml } from 'twilio';

export async function POST(req) {
  const voiceResponse = new twiml.VoiceResponse();

  voiceResponse.say('Hello! This is your test Twilio call. Everything is working fine.');

  return new Response(voiceResponse.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}
