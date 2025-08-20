// app/api/twilio/initiateCall.ts
// This file is the server-side API endpoint
// that frontend or other services can call to make Twilio place a phone call.
// uses credentials from .env and leverages the Twilio Node.js SDK to trigger the call
// CONSIDER REPLACING TWILIO LINK HANDLER 
// from Next.js to type the API handler’s request and response objects
import type { NextApiRequest, NextApiResponse } from 'next'
import twilio from 'twilio'

// .env
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioNumber = process.env.TWILIO_PHONE_NUMBER

// client is created using SID and auth token, allowing to call Twilio REST API
const client = twilio(accountSid, authToken)

//API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { //checks if the request method is POST
    return res.status(405).json({ error: 'Method not allowed' })
  }
// extracts the to number from the JSON body of the POST request.
  const { to } = req.body
// error message if none
  if (!to) {
    return res.status(400).json({ error: 'Missing destination number' })
  }
// when connected call client.call.create
  try {
    const call = await client.calls.create({
      to, // phone number
      from: twilioNumber, // twilio phone number
      url: 'https://handler.twilio.com/twiml/EHXXXXXXX', // replace with TwiML Bin or public endpoint
    })

// If the call is successfully created, it returns a 200 response with the call SID
    console.log('Call initiated:', call.sid)
    res.status(200).json({ message: 'Call started', sid: call.sid })
  } catch (err: any) {
    console.error('Twilio call error:', err)
    res.status(500).json({ error: 'Failed to start call' })
  }
}
