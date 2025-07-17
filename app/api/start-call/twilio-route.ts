/**
 * API Route: /api/start-call
 * 
 * Receives a phone number from the frontend, (by sales rep)
 * Initiates a call using Twilio to that number, (i think, need to double check)
 * Starts the AI conversation by connecting Twilio webhook  callbacks (reasearch again).
 */

// app/api/start-call/route.ts
/*
import { NextResponse } from 'next/server';
import { initiateCall } from '../../utils/twilio'; /*fix link!!


/**
 * This route is triggered when the sales rep submits the phone number.
 * It starts a Twilio call using the utility function we built.
 *//*
export async function POST(req: Request) {
  try {
    // Parse JSON body (parse=turning block of text into real data, i believe?)
    const body = await req.json(); //takes the text from the request body and parses it into a JavaScript object (so it can read it)
    const { phoneNumber } = body; // get the phone number from the request body

    // Validate that a phone number was provided
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 });
    }

    // Regex (checks to if the phone number is legit) to validate E.164 format (+ sign, country code and then the rest of the phone number)
    const isValid = /^\+?[1-9]\d{1,14}$/.test(phoneNumber);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Attempt to initiate the call
    const result = await initiateCall(phoneNumber);


    // Check if the call was successfully initiated
    if (result.success) {
      return NextResponse.json({ message: 'Call started', sid: result.sid });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

