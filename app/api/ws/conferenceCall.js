// conferenceCall.js

/**
 * ▌SUMMARY:
 * - This script uses Twilio's REST API to initiate TWO outbound calls:
 *     1. Customer → joins conference (can speak, hears beep on enter/exit)
 *     2. Agent → joins same conference (can speak, no beep)
 * - Both parties are routed through the same TwiML endpoint (/conference-join),
 *   which defines the <Conference> behavior.
 * 
 * ▌HOW TO USE:
 *   1. Update the ngrok URL to point to your live TwiML server (/conference-join).
 *   2. Run this script with: node conferenceCall.js
 *   3. Both users will receive a call and be joined into the "zeus_sales_demo" room.
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

// Auth credentials from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Define the call participants 
// (will try and set this up so you can enter this on website)
const CUSTOMER_NUMBER = '+35386...';         // 🔔 Customer to call
const AGENT_NUMBER = '+353861790710';        // 👤 Agent (now UNMUTED)
const FROM_NUMBER = '+16073094981';          // 📞 Your Twilio phone number

// Your running TwiML server for conferencing
const SERVER_URL = 'https://1904bfa53d74.ngrok-free.app/conference-join';

/**
 * makeCall() triggers one outbound phone call.
 * The server-side TwiML logic will place the caller into the conference.
 * 
 * @param {string} to - phone number to call
 * @param {boolean} isMuted - should the participant join muted?
 * @param {string} beep - "true" or "false" to enable join/leave beep
 */
const makeCall = (to, isMuted, beep) => {
  return client.calls.create({
    to,
    from: FROM_NUMBER,
    url: `${SERVER_URL}?muted=${isMuted}&beep=${beep}` // Pass muted and beep flags
  });
};

// Start both calls at the same time
// true = MUTED, false = UNMUTED
Promise.all([
  makeCall(CUSTOMER_NUMBER, false, 'true'),  // Customer: unmuted, beep on enter/exit
  makeCall(AGENT_NUMBER, false, 'false')     // Agent: unmuted, NO beep
])
  .then(responses => {
    console.log('✅ Conference calls started successfully.');
    responses.forEach(call => console.log(`SID: ${call.sid}`));
  })
  .catch(err => {
    console.error('❌ Error starting conference calls:', err.message);
  });


/* summary of how it works

Call both the agent and the customer.

Join them into the same Twilio conference room.

Unmute the customer and agent so both can talk.

Beep only plays when customer joins or leaves, not agent.

Stream audio to your AI WebSocket if the participant is unmuted (AI side).

Let AI respond in real-time via your server.js

*/

/* things added

BEEP if customer joins/leaves (only customer)

*/