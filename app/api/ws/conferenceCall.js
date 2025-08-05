// conferenceCall.js

/**
 * ▌SUMMARY:
 * - This script uses Twilio's REST API to initiate TWO outbound calls:
 *     1. Customer → joins conference (can speak)
 *     2. Agent → joins same conference (muted listener)
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
const CUSTOMER_NUMBER = '+35386...';     // 🔔 Customer to call
const AGENT_NUMBER = '+353861790710';        // 👤 Agent (muted by default) (need another number)
const FROM_NUMBER = '+16073094981';          // 📞 Your Twilio phone number

// Your running TwiML server for conferencing
const SERVER_URL = 'https://1904bfa53d74.ngrok-free.app/conference-join';

/**
 * makeCall() triggers one outbound phone call.
 * The server-side TwiML logic will place the caller into the conference.
 * 
 * @param {string} to - phone number to call
 * @param {boolean} isMuted - should the participant join muted?
 */
const makeCall = (to, isMuted) => {
  return client.calls.create({
    to,
    from: FROM_NUMBER,
    url: `${SERVER_URL}?muted=${isMuted}` // Pass muted flag as query param
  });
};

// Start both calls at the same time: true = MUTED
Promise.all([
  makeCall(CUSTOMER_NUMBER, false), // Customer
  makeCall(AGENT_NUMBER, false)      // Agent
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

Unmute the customer (and AI) so they can talk.

Mute the agent, who can listen silently and jump in manually if needed.

Stream audio to your AI WebSocket if the participant is unmuted (AI side).

Let AI respond in real-time via your server.js

  */