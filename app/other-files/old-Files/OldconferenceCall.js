// conferenceCall.js

/**
 * SUMMARY:
 * This script initiates outbound calls into a shared Twilio conference:
 *    1. AI (your Twilio number) — joins automatically via TwiML webhook
 *    2. Customer — joins unmuted, hears beep on enter/exit
 *    3. Agent — joins muted (optional), no beep
 * 
 * IMPORTANT: Per Twilio Support, DO NOT dial your own Twilio number.
 * The AI leg is created when Twilio receives an inbound call on your Twilio number
 * and hits your /conference-join webhook (which returns <Start><Stream>).
 * 
 * just test with AI + Customer (me).
 * 
 * HOW TO USE:
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
// const AGENT_NUMBER = '+353000';               // 🎧 Agent to call (MUTED, optional)
const FROM_NUMBER = '+16073094981';              // 🤖 Your Twilio number (used for AI webhook)

// Your TwiML server (port 3000 or 8080) exposed via ngrok
// ⚠️ Do NOT pass "to=FROM_NUMBER" anymore — AI leg is handled by webhook
const SERVER_URL = 'https://8e26264aa693.ngrok-free.app/conference-join';

/**
 * Initiates one outbound call into the conference.
 * 
 * @param {string} to - The phone number to call
 * @param {boolean} isMuted - true = muted, false = unmuted
 * @param {string} beep - "true" or "false" (play beep on enter/exit)
 * @param {boolean} stream - true = add <Start><Stream>, false = no stream
 */

/* forget what this does exactly */
const makeCall = (to, isMuted, beep, stream = false) => {
  const url = `${SERVER_URL}?muted=${isMuted}&beep=${beep}&stream=${stream}`;
  return client.calls.create({
    to,
    from: FROM_NUMBER,
    url
  });
};

// Initiate calls: Customer → Agent (optional)
// AI leg is handled automatically by TwiML webhook
makeCall(CUSTOMER_NUMBER, false, 'true', true) // Customer joins unmuted, beep ON
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
 *   SUMMARY OF BEHAVIOR:
 * 
 * - AI leg: triggered when Twilio receives an inbound call on your Twilio number.
 *   Twilio hits /conference-join, which returns <Start><Stream> + <Conference>.
 * - Customer leg: dialed out via API, joins unmuted with beep ON.
 * - Agent leg: can be added later, muted, no beep.
 * 
 * This avoids the Twilio loop issue (From == To) and follows Twilio Support guidance.
 */
