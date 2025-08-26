// outboundCall.js
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error("Missing Twilio credentials. Add them to your .env file.");
  process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function makeCall() {
  try {
    const call = await client.calls.create({
      // Where the call should go (your US conference number)
      to: "+16073094981",

      // Caller ID (must be a Twilio number you own, your Irish number here)
      from: "+35319079387",

      // A TwiML URL or a local server that tells Twilio what to do when the call connects
      url: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical",
    });

    console.log(`Call initiated! SID: ${call.sid}`);
  } catch (err) {
    console.error("Error making call:", err);
  }
}

makeCall();
