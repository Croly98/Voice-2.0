// conferenceCall.js

/**
 * SUMMARY:
 * This script initiates a Twilio conference call with an AI bot.
 * 
 * WORKFLOW:
 * 1. You manually call your Twilio number from your phone
 * 2. Twilio receives the call and hits the webhook URL configured in Twilio console
 * 3. The webhook should point to: https://[your-ngrok].ngrok-free.app/conference-join?ai=true
 * 4. This joins you into the conference with the AI bot
 * 
 * ALTERNATIVE: Use this script to programmatically start the conference
 * 
 * HOW TO USE:
 *   1. Make sure conference-server.js is running on port 8080
 *   2. Update your ngrok URL below if it has changed
 *   3. Configure Twilio webhook to point to your ngrok URL + /conference-join?ai=true
 *   4. Call your Twilio number OR run this script
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

// Twilio credentials from .env file
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// 📞 Numbers configuration
const YOUR_PHONE_NUMBER = '+353861790710';      // Your phone number
const TWILIO_NUMBER = '+16073094981';           // Your Twilio number

// Your server (port 8080) exposed via ngrok - UPDATE THIS WITH YOUR NGROK URL
const SERVER_URL = 'https://YOUR-NGROK-ID.ngrok-free.app/conference-join';

// Conference name (must match your TwiML)
const CONFERENCE_NAME = 'zeus_sales_demo';

/**
 * Initiates a call that joins the conference
 * 
 * @param {string} to - The phone number to call
 * @param {boolean} isAi - true if this is the AI leg
 * @param {boolean} isMuted - true = muted, false = unmuted
 * @param {string} beep - "true" or "false" (play beep on enter/exit)
 */
const makeConferenceCall = (to, isAi = false, isMuted = false, beep = 'true') => {
  const params = new URLSearchParams({
    muted: isMuted.toString(),
    beep: beep,
    ai: isAi.toString()
  });
  
  const url = `${SERVER_URL}?${params.toString()}`;
  
  console.log(`📞 Calling ${to} with URL: ${url}`);
  
  return client.calls.create({
    to,
    from: TWILIO_NUMBER,
    url
  });
};


// === START CALL FLOW ===

console.log('🚀 Starting conference call setup...');
console.log('📌 Make sure to update SERVER_URL with your ngrok URL!');

// OPTION 1: Programmatically start both legs
// Uncomment the code below to use this option

/*
// Step 1: Start the AI leg (with media stream)
makeConferenceCall(TWILIO_NUMBER, true, false, 'false')
  .then(call => {
    console.log('🤖 AI leg started:', call.sid);
    
    // Step 2: After a short delay, dial your phone
    setTimeout(() => {
      makeConferenceCall(YOUR_PHONE_NUMBER, false, false, 'true')
        .then(call => {
          console.log('📱 Your phone call started:', call.sid);
        })
        .catch(err => console.error('❌ Error calling your phone:', err.message));
    }, 2000);
    
    // Optional: Auto-end conference after 2 minutes
    setTimeout(() => {
      client.conferences(CONFERENCE_NAME)
        .update({ status: 'completed' })
        .then(() => console.log('⏱️ Conference ended'))
        .catch(err => console.error('❌ Error ending conference:', err.message));
    }, 120000); // 2 minutes
  })
  .catch(err => console.error('❌ Error starting AI leg:', err.message));
*/

// OPTION 2: Manual setup instructions
console.log(`
📋 MANUAL SETUP INSTRUCTIONS:
1. Make sure conference-server.js is running on port 8080
2. Start ngrok: ngrok http 8080
3. Copy your ngrok URL (e.g., https://abc123.ngrok-free.app)
4. Update SERVER_URL in this file with your ngrok URL
5. Go to Twilio Console > Phone Numbers > Your Number
6. Set the webhook URL to: https://[your-ngrok].ngrok-free.app/conference-join?ai=true
7. Call your Twilio number (${TWILIO_NUMBER}) from your phone
8. You'll be connected to the AI bot in the conference!

Alternative: Uncomment the code above to programmatically start the conference.
`);
