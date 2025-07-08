// app/api/twilio/initiateCall.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!
const twilioNumber = process.env.TWILIO_PHONE_NUMBER!

const client = twilio(accountSid, authToken)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to } = req.body

  if (!to) {
    return res.status(400).json({ error: 'Missing destination number' })
  }

  try {
    const call = await client.calls.create({
      to,
      from: twilioNumber,
      url: 'https://handler.twilio.com/twiml/EHXXXXXXX', // replace with your TwiML Bin or public endpoint
    })

    console.log('Call initiated:', call.sid)
    res.status(200).json({ message: 'Call started', sid: call.sid })
  } catch (err: any) {
    console.error('Twilio call error:', err)
    res.status(500).json({ error: 'Failed to start call' })
  }
}
