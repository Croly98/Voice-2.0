/**
 * SIMPLE OUTBOUND CALLER
 * Usage: node con-outbound-caller.js
 * Just change the phone numbers below and run!
 */

/*

 Just make sure:
  1. Run twilio-conference-with-ai.js first
  2. Update NGROK_URL if it changes
  3. Run con-outbound-caller.js to call people into the conference

  */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ============================================
// CHANGE THESE NUMBERS
// ============================================
const PHONE_1 = '+353861790710';  // First number to call
//const PHONE_2 = '+35319079387';   // Second number (comment out if not needed)

// Conference settings
const CONFERENCE_NAME = 'Zeus_Conference';
const NGROK_URL = 'https://7330f011bb18.ngrok-free.app'; // Update with your current ngrok URL

// ============================================
// MAKE THE CALLS
// ============================================

async function callNumber(phoneNumber, label) {
    console.log(`📞 Calling ${label}: ${phoneNumber}...`);
    console.log(`   Connecting to ${CONFERENCE_NAME} conference`);
    
    try {
        const call = await client.calls.create({
            url: `${NGROK_URL}/participant-join-conference`,
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        
        console.log(`✅ ${label} call started: ${call.sid}`);
        return call;
        
    } catch (error) {
        console.error(`❌ ${label} failed:`, error.message);
        return null;
    }
}

async function makeAllCalls() {
    console.log('🚀 Starting outbound calls...\n');
    
    // Call first number
    await callNumber(PHONE_1, 'Phone 1');
    
    // Wait 2 seconds between calls
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Call second number (if provided)
    if (PHONE_2) {
        await callNumber(PHONE_2, 'Phone 2');
    }
    
    console.log('\n✅ All calls initiated!');
}

makeAllCalls();