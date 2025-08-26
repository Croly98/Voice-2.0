// SIMPLE OUTBOUND CALLING TEST SCRIPT
// This script tests the outbound calling functionality without needing a full conference setup

import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, TWILIO_AI_NUMBER } = process.env;

// Check for required credentials
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !TWILIO_AI_NUMBER) {
    console.error('Missing Twilio credentials. Please check your .env file.');
    process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Test phone numbers - modify these as needed
const TEST_NUMBERS = [
    { 
        number: '+35319079387',  // AI bot number
        name: 'AI Bot (Thalia)',
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say>Hello, this is a test call to the AI bot number.</Say>
                    <Pause length="2"/>
                    <Say>The outbound calling system is working correctly.</Say>
                </Response>`
    },
    { 
        number: '+353861790710',  // Second participant
        name: 'Second Participant',
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say>Hello, this is a test call to the second participant number.</Say>
                    <Pause length="2"/>
                    <Say>You would normally be connected to the Zeus conference.</Say>
                </Response>`
    }
];

// Function to make a test outbound call
async function makeTestCall(phoneNumber, participantName, twiml) {
    console.log(`\n🔄 Calling ${participantName} at ${phoneNumber}...`);
    
    try {
        const call = await client.calls.create({
            twiml: twiml,
            to: phoneNumber,
            from: TWILIO_PHONE_NUMBER,
            statusCallback: 'https://webhook.site/unique-url-here', // Optional: replace with your webhook URL
            statusCallbackEvent: ['initiated', 'answered', 'completed', 'failed']
        });
        
        console.log(`✅ ${participantName} call initiated successfully!`);
        console.log(`   Call SID: ${call.sid}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   From: ${call.from}`);
        console.log(`   To: ${call.to}`);
        
        return call;
        
    } catch (error) {
        console.error(`❌ Error calling ${participantName}:`, error.message);
        return null;
    }
}

// Main function to test all outbound calls
async function testOutboundCalls() {
    console.log('=====================================');
    console.log('🎯 TWILIO OUTBOUND CALLING TEST');
    console.log('=====================================');
    console.log(`Using Twilio number: ${TWILIO_PHONE_NUMBER}`);
    console.log(`Testing ${TEST_NUMBERS.length} outbound calls...\n`);
    
    const results = [];
    
    // Test each number
    for (const testNumber of TEST_NUMBERS) {
        const result = await makeTestCall(testNumber.number, testNumber.name, testNumber.twiml);
        results.push({
            name: testNumber.name,
            number: testNumber.number,
            success: result !== null,
            callSid: result ? result.sid : null
        });
        
        // Wait 2 seconds between calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Summary
    console.log('\n=====================================');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=====================================');
    
    results.forEach(result => {
        const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
        console.log(`${status} - ${result.name} (${result.number})`);
        if (result.callSid) {
            console.log(`          Call SID: ${result.callSid}`);
        }
    });
    
    const successCount = results.filter(r => r.success).length;
    console.log(`\n🎯 ${successCount}/${results.length} calls initiated successfully`);
    
    if (successCount === results.length) {
        console.log('\n🎉 All test calls successful! Your outbound calling setup is working.');
    } else {
        console.log('\n⚠️  Some calls failed. Check your phone numbers and Twilio configuration.');
    }
    
    console.log('\n💡 TIP: Check your phone(s) to verify the calls were received and the messages played correctly.');
}

// Run the test
testOutboundCalls().catch(error => {
    console.error('❌ Test script error:', error);
    process.exit(1);
});