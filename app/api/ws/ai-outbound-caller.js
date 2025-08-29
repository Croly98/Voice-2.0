/**
 * AI OUTBOUND CALLER
 * This script calls a specific number and connects them directly to the AI (Thalia)
 * The AI runs on OLD-server.js
 * 
 * Usage: node ai-outbound-caller.js
 */

import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ============================================
// CONFIGURATION - CHANGE THESE
// ============================================

// Phone number to call (CHANGE THIS!)
const TARGET_PHONE = '+353861790710'; // Replace with the number you want the AI to call

// Your AI server ngrok URL (must match OLD-server.js)
const AI_NGROK_URL = 'https://1617b95fffee.ngrok-free.app'; // Port 3001 - Update if changed

// Optional: Add multiple numbers to call
const ADDITIONAL_NUMBERS = [
    // '+35319079387',  // Uncomment and add more numbers as needed
    // '+353123456789',
];

// ============================================
// MAKE AI CALL
// ============================================

async function makeAICall(phoneNumber, label = 'Customer') {
    console.log(`🤖 AI calling ${label}: ${phoneNumber}...`);
    console.log(`   Connecting to Thalia (Zeus Packaging AI assistant)`);
    
    try {
        const call = await client.calls.create({
            url: `${AI_NGROK_URL}/incoming-call`,
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `${AI_NGROK_URL}/call-status`, // Optional status tracking
            statusCallbackEvent: ['initiated', 'answered', 'completed', 'failed']
        });
        
        console.log(`✅ AI call to ${label} started!`);
        console.log(`   Call SID: ${call.sid}`);
        console.log(`   From: ${call.from}`);
        console.log(`   To: ${call.to}`);
        console.log(`   AI Assistant: Thalia from Zeus Packaging\n`);
        
        return { success: true, callSid: call.sid, label, number: phoneNumber };
        
    } catch (error) {
        console.error(`❌ Failed to call ${label}:`, error.message);
        return { success: false, label, number: phoneNumber, error: error.message };
    }
}

async function makeAllAICalls() {
    console.log('=====================================');
    console.log('🚀 ZEUS PACKAGING AI OUTBOUND CALLER');
    console.log('=====================================');
    console.log(`AI Server: ${AI_NGROK_URL}`);
    console.log(`Calling from: ${process.env.TWILIO_PHONE_NUMBER}\n`);
    
    // Check if AI server is running
    console.log('⚠️  IMPORTANT: Make sure OLD-server.js is running on port 3001!');
    console.log('   Run: node OLD-server.js\n');
    
    const allNumbers = [TARGET_PHONE, ...ADDITIONAL_NUMBERS];
    const results = [];
    
    console.log(`📞 Preparing to call ${allNumbers.length} number(s)...\n`);
    
    // Make calls with 3-second delay between each
    for (let i = 0; i < allNumbers.length; i++) {
        const number = allNumbers[i];
        const label = i === 0 ? 'Primary Customer' : `Customer ${i + 1}`;
        
        const result = await makeAICall(number, label);
        results.push(result);
        
        // Wait between calls to avoid overwhelming the system
        if (i < allNumbers.length - 1) {
            console.log('⏰ Waiting 3 seconds before next call...\n');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    // Summary
    console.log('\n=====================================');
    console.log('📊 CALL SUMMARY');
    console.log('=====================================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    if (successful.length > 0) {
        console.log(`\n✅ Successful calls (${successful.length}):`);
        successful.forEach(r => {
            console.log(`   - ${r.label}: ${r.number}`);
            console.log(`     SID: ${r.callSid}`);
        });
    }
    
    if (failed.length > 0) {
        console.log(`\n❌ Failed calls (${failed.length}):`);
        failed.forEach(r => {
            console.log(`   - ${r.label}: ${r.number}`);
            console.log(`     Error: ${r.error}`);
        });
    }
    
    console.log(`\n🎯 Total: ${successful.length}/${results.length} calls initiated successfully`);
    
    if (successful.length > 0) {
        console.log('\n💡 The AI (Thalia) will now handle the conversation(s).');
        console.log('   Check OLD-server.js console for real-time conversation logs.');
    }
}

// ============================================
// RUN THE SCRIPT
// ============================================

console.log('🤖 Zeus Packaging AI Outbound Calling System\n');
console.log('This will connect customers directly to Thalia,');
console.log('your AI sales assistant from Zeus Packaging.\n');
console.log(`Target number: ${TARGET_PHONE}`);
console.log(`Additional numbers: ${ADDITIONAL_NUMBERS.length}\n`);

// Give user time to cancel if needed
console.log('⏰ Starting AI calls in 3 seconds...');
console.log('   Press Ctrl+C to cancel\n');

setTimeout(() => {
    makeAllAICalls().catch(error => {
        console.error('❌ Script error:', error);
        process.exit(1);
    });
}, 3000);