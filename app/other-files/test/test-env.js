/* import dotenv from 'dotenv';
import path from 'path';
import WebSocket from 'ws';

// Explicitly load .env from two levels up: C:\josh\Voice-2.0\.env
dotenv.config({ path: path.resolve('../../.env') });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

if (!OPENAI_API_KEY) {
  console.error('No OPENAI_API_KEY found in .env file');
  process.exit(1);
}

console.log('Loaded API Key:', OPENAI_API_KEY ? 'YES' : 'NO');

const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
  headers: {
    Authorization: `Bearer ${OPENAI_API_KEY}`,
    "OpenAI-Beta": "realtime=v1"
  }
});

openAiWs.on('open', () => {
  console.log('✅ Connected successfully to OpenAI realtime API!');
  openAiWs.close();
});

openAiWs.on('error', (error) => {
  console.error('❌ OpenAI WebSocket error:', error.message || error);
});

openAiWs.on('close', (code, reason) => {
  console.log(`WebSocket closed with code ${code} and reason: ${reason.toString()}`);
});

*/

// twilio test

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import twilio from 'twilio';

// Resolve __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('TWILIO_ACCOUNT_SID:', JSON.stringify(process.env.TWILIO_ACCOUNT_SID));
console.log('TWILIO_AUTH_TOKEN:', JSON.stringify(process.env.TWILIO_AUTH_TOKEN));

// Create Twilio client
try {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  // Attempt to fetch something to test authentication
  client.api.accounts(process.env.TWILIO_ACCOUNT_SID)
    .fetch()
    .then(account => {
      console.log('✅ Twilio authentication successful');
      console.log(`Account name: ${account.friendlyName}`);
    })
    .catch(error => {
      console.error('❌ Twilio authentication failed:', error.message || error);
    });
} catch (error) {
  console.error('❌ Error initializing Twilio client:', error.message || error);
}
