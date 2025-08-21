// conferenceCall.js

/**
 * SUMMARY:
 * This script initiates outbound calls into a shared Twilio conference:
 *    1. Customer — joins unmuted, hears beep on enter/exit
 *    2. Agent — joins muted (optional), no beep
 *    3. AI — joins automatically when your Twilio number is called
 * 
 * IMPORTANT: Per Twilio Support, DO NOT dial your own Twilio number here.
 * The AI leg is created when Twilio receives an inbound call on your Twilio number
 * and hits your /conference-join webhook (which returns <Start><Stream> + <Conference>).
 * 
 * For now: just test with AI + Customer (you).
 * 
 * HOW TO USE:
 *   1. Update the `SERVER_URL` to your ngrok HTTPS URL (port 3000/8080).
 *   2. Confirm your TwiML server is running on that ngrok URL (/conference-join).
 *   3. Call your Twilio number (AI leg will auto-join).
 *   4. Run this file: `node conferenceCall.js` to dial the customer leg.
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

// Twilio credentials from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// 📞 Numbers to call
const CUSTOMER_NUMBER = '+353861790710';         // 👤 Customer to call (UNMUTED)
// const AGENT_NUMBER = '+353000';               // 🎧 Agent to call (MUTED, optional)
const FROM_NUMBER = '+16073094981';             // 🤖 Your Twilio number (used for AI webhook)

// Your TwiML server (8080) exposed via ngrok
// ⚠️ Do NOT pass "to=FROM_NUMBER" anymore — AI leg is handled by inbound webhook
const SERVER_URL = 'https://6eb2813db8c0.ngrok-free.app/conference-join';

// Conference name (must match your TwiML)
const CONFERENCE_NAME = 'zeus_sales_demo';

/**
 * Initiates one outbound call into the conference.
 * 
 * @param {string} to - The phone number to call
 * @param {boolean} isMuted - true = muted, false = unmuted
 * @param {string} beep - "true" or "false" (play beep on enter/exit)
 * @param {boolean} stream - true = add <Start><Stream>, false = no stream
 * 
 * NOTE: Only *customer/agent* legs use this. 
 * The AI leg is *inbound* via Twilio number → /conference-join.
 */
const makeCall = (to, isMuted, beep, stream = false) => {
  const url = `${SERVER_URL}?muted=${isMuted}&beep=${beep}&stream=${stream}`;
  return client.calls.create({
    to,
    from: FROM_NUMBER,
    url
  });
};

/**
 * Triggers the AI leg by calling your Twilio number.
 * Twilio will then hit /conference-join which returns <Start><Stream> + <Conference>.
 */
const triggerAiLeg = () => {
  const aiUrl = `${SERVER_URL}?ai=true`;
  return client.calls.create({
    to: FROM_NUMBER,
    from: FROM_NUMBER,
    url: aiUrl
  });
};



// === START CALL FLOW ===

// Step 1: Dial customer into conference
makeCall(CUSTOMER_NUMBER, false, 'true', false) // Customer joins unmuted, beep ON
  .then(() => {
    console.log('✅ Customer call started');

    /*
    // Agent call skipped for now
    return makeCall(AGENT_NUMBER, true, 'false') // Agent joins muted (optional)
      .then(() => {
        console.log('✅ Agent call started (muted)');
      });
    */

    // Step 2: After short delay, dial AI leg
    setTimeout(() => {
      triggerAiLeg()
        .then(() => console.log('🤖 AI leg triggered'))
        .catch(err => console.error('❌ Error starting AI leg:', err.message));
    }, 3000);

    // Step 3: Schedule conference to end automatically after 90 seconds (recommened by Abhishek)
    setTimeout(() => {
      client.conferences(CONFERENCE_NAME)
        .update({ status: 'completed' })
        .then(c => console.log('⏱️ Conference ended automatically after 90s'))
        .catch(err => console.error('❌ Error ending conference:', err.message));
    }, 90_000); // 90 seconds

  })
  .catch(err => {
    console.error('❌ Error during call setup:', err.message);
  });

/**
 *   SUMMARY OF BEHAVIOR:
 * 
 * - AI leg: triggered when Twilio receives an inbound call on your Twilio number.
 *   Twilio hits /conference-join, which returns <Start><Stream> + <Conference> (AI talks to all participants).
 * - Customer leg: dialed out via API, joins unmuted with beep ON.
 * - Agent leg: can be added later, muted, no beep.
 * - Conference ends automatically after 90 seconds for all participants.
 * 
 * This avoids the Twilio loop issue (From == To) and follows Twilio Support guidance.
 */
