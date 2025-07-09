import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config(); // This must run at the very top!

// Added for testing/debugging
console.log('SID:', process.env.TWILIO_ACCOUNT_SID); // Should log real SID
console.log('TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Loaded' : 'Missing'); // Should log 'Loaded'

// Load from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = twilio(accountSid, authToken);

client.calls
  .create({
    url: 'https://80cf7146dd55.ngrok-free.app/api/voice', // ✅ updated URL
    to: '+353861790710',  // ✅ Your phone number
    from: '+16073094981'  // ✅ Your Twilio number
  })
  .then(call => console.log(`📞 Call initiated with SID: ${call.sid}`))
  .catch(error => console.error('❌ Error making call:', error));
