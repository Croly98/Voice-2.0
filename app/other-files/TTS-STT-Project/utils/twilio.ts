/**
 * WAS USED FOR TESTING, NO LONGER IN USE
 * twilio.ts
 * 
 * Contains functions to interact with Twilio API.
 * Handles starting calls, sending audio, and managing call state.
 * Abstracts Twilio content from API routes for better code organisation.
 */

// utils/twilio.ts

/* import twilio from 'twilio';

// These values will also go in the .env.local file for security
// will add tokens last
const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;
const callWebhookUrl = process.env.TWILIO_CALL_WEBHOOK_URL!; // e.g. "https://yourdomain.com/api/handle-response"

const client = twilio(accountSid, authToken);

/**
 * Initiates a phone call using Twilio Voice API
 *
 * @param toPhoneNumber - The customer's phone number in E.164 format (e.g. +353...)
 * @returns Twilio call object or error
 */

/*
export async function initiateCall(toPhoneNumber: string) {
  try {
    const call = await client.calls.create({
      to: toPhoneNumber,
      from: twilioPhoneNumber,
      url: callWebhookUrl, // Twilio will send a webhook request here to get TwiML
    });

    console.log('✅ Call initiated:', call.sid);
    return { success: true, sid: call.sid };
  } catch (error: any) {
    console.error('❌ Failed to start call:', error.message);
    return { success: false, error: error.message };
  }
}
/**
 * Sends audio to the Twilio call
 *
 * @param callSid - The unique identifier for the call
 * @param audioUrl - URL of the audio file to play
 * @returns Twilio call object or error
 */

/** we'll upgrade to Media Streams after basic flow is working */

/*When a sales rep enters a number, your frontend POSTs it to /api/start-call/route.ts.

That route calls initiateCall(...).

Twilio places the call and then requests TwiML instructions from the webhook URL (e.g. /api/handle-response/route.ts).

That’s where we serve XML or begin media streaming later.*/