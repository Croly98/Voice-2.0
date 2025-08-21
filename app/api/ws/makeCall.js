// makeCall.js - Simple script to test conference calls
// This script can be used to quickly test calling into the conference

// To use: node makeCall.js

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Load Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Phone numbers
const YOUR_PHONE = '+353861790710';  // Your phone number
const TWILIO_NUMBER = '+16073094981'; // Your Twilio number

// IMPORTANT: Update this with your ngrok URL!
const NGROK_URL = 'https://YOUR-NGROK-ID.ngrok-free.app'; // UPDATE THIS!

// Choose which mode to test
const USE_DIRECT_MODE = true; // Set to false to test conference mode

console.log('🚀 Starting test call...');
console.log('📌 Make sure to update NGROK_URL with your actual ngrok URL!');
console.log('📌 Make sure conference-server.js is running on port 8080!');
console.log(`🔧 Mode: ${USE_DIRECT_MODE ? 'Direct Connect' : 'Conference'}`);

if (USE_DIRECT_MODE) {
  // RECOMMENDED: Direct connection mode (simpler, more reliable)
  client.calls
    .create({
      url: `${NGROK_URL}/incoming-call`,
      to: YOUR_PHONE,
      from: TWILIO_NUMBER
    })
    .then(call => {
      console.log(`✅ Direct call started: ${call.sid}`);
      console.log('📞 You should receive a call and be connected directly to the AI.');
      console.log('🎯 This uses the simpler <Connect> approach.');
    })
    .catch(error => console.error('❌ Error making call:', error));
} else {
  // Conference mode (more complex, can have audio issues)
  client.calls
    .create({
      url: `${NGROK_URL}/conference-join?muted=false&beep=true&ai=false`,
      to: YOUR_PHONE,
      from: TWILIO_NUMBER
    })
    .then(call => {
      console.log(`✅ Conference call started: ${call.sid}`);
      console.log('📞 You should receive a call and join the conference.');
      console.log('🤖 AI bot will automatically join after 2 seconds.');
    })
    .catch(error => console.error('❌ Error making call:', error));
}
