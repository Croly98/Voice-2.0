// conferenceCall.js

/**
 * ▌SUMMARY:
 * This script initiates 2–3 outbound calls into a shared Twilio conference:
 *    1. 🤖 AI (your Twilio number) — joins unmuted, starts WebSocket stream
 *    2. 👤 Customer — joins unmuted, hears beep on enter/exit
 *    3. 🎧 Agent — joins muted (optional), no beep
 * 
 * The AI joins first to activate streaming.
 * You can test even if Agent doesn't pick up — AI and Customer alone still works.
 * 
 * ▌HOW TO USE:
 *   1. Update the `SERVER_URL` to your ngrok HTTPS URL (port 3000).
 *   2. Confirm your TwiML server is running on that ngrok URL (/conference-join).
 *   3. Run this file: `node conferenceCall.js`
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

// Twilio credentials from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// 📞 Numbers to call (TODO: Be pulled from frontend)
const CUSTOMER_NUMBER = '+353861790710';         // 👤 Customer to call (UNMUTED)
 // const AGENT_NUMBER = '+353000';                 // 🎧 Agent to call (MUTED, optional)
const FROM_NUMBER = '+16073094981';             // 🤖 Your Twilio number (used for AI)

// Your TwiML server (port 3000 or 8080) exposed via ngrok (added stream for a fix)
const SERVER_URL = 'https://6325c76a6a57.ngrok-free.app/conference-join?stream=true&muted=false&beep=false';

/**
 * Initiates one outbound call into the conference.
 * 
 * @param {string} to - The phone number to call
 * @param {boolean} isMuted - true = muted, false = unmuted
 * @param {string} beep - "true" or "false" (play beep on enter/exit)
 * @param {boolean} stream - true = add <Start><Stream>, false = no stream
 */
const makeCall = (to, isMuted, beep, stream = false) => {
  const url = `${SERVER_URL}?muted=${isMuted}&beep=${beep}&stream=${stream}`;
  return client.calls.create({
    to,
    from: FROM_NUMBER,
    url
  });
};

// Initiate calls in sequence: AI → Customer → Agent
makeCall(FROM_NUMBER, false, 'false', true) // AI joins unmuted, triggers audio stream
  .then(() => {
    console.log('✅ AI call started (Twilio number)');
    return makeCall(CUSTOMER_NUMBER, false, 'true', false); // Customer joins unmuted, beep ON
  })
  .then(() => {
    console.log('✅ Customer call started');

    /*
    // Agent call skipped for now
    return makeCall(AGENT_NUMBER, true, 'false') // Agent joins muted (optional)
      .then(() => {
        console.log('✅ Agent call started (muted)');
      });
    */

  })
  .catch(err => {
    console.error('❌ Error during call setup:', err.message);
  });


/**
 * ▌SUMMARY OF BEHAVIOR
 * 
 * - AI joins first (muted=false): this starts the WebSocket stream.
 * - Customer joins second (muted=false, beep=true): they can talk and hear others.
 * - Agent joins last (muted=true, beep=false): they can listen silently.
 * 
 * Only the AI and unmuted participants trigger the <Stream> in your TwiML.
 * The AI responds via your WebSocket server in real time.
 * 
 * You can safely skip the agent step and still have a working AI + Customer call.
 */

  /* beep added */