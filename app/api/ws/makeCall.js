// standalone Node.js script that makes a call through the Twilio API
// Unlike API route version (initiateCall.ts), this one is not triggered by a user request—it (run node makeCall.js)

// to manually trigger: node makeCall.js

// import statements
import twilio from 'twilio'; //loads twilio node sdk to interact with Twilios rest API
import dotenv from 'dotenv'; //imports .env file (to find it)

dotenv.config(); //loads .env file

// Added for testing/debugging (confirms .env is loading)
console.log('SID:', process.env.TWILIO_ACCOUNT_SID); // Should log real SID
console.log('TOKEN:', process.env.TWILIO_AUTH_TOKEN ? 'Loaded' : 'Missing'); // Should log 'Loaded'

// Load from .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Creates authenticated Twilio client object used to interact with Twilio services
const client = twilio(accountSid, authToken);

// Making the Call

client.calls 
  .create({ //tells twilio to start a phone call
    url: 'https://fd2a9ccab397.ngrok-free.app/api/voice', // ✅ updated URL
    to: '+353861790710',  // ✅ Your phone number
    from: '+16073094981'  // ✅ Your Twilio number
  })

// result handing
  .then(call => console.log(`📞 Call initiated with SID: ${call.sid}`))
  .catch(error => console.error('❌ Error making call:', error));
