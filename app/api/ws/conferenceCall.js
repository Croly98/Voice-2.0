// conferenceCall.js

/**
 * TwiML Server for Conference Calling with Twilio
 * 
 * This server handles incoming voice calls and puts the caller (AI, customer, agent)
 * into a named Twilio conference room.
 * 
 * ▌SUMMARY:
 * 1. A call comes in (AI or customer).
 * 2. Twilio hits this server at /voice (set this URL in your Twilio number or API call).
 * 3. The server responds with TwiML:
 *    - Adds the caller to a named <Conference> room
 *    - Optionally configures the caller as muted/unmuted
 *    - Twilio hosts the conference automatically (up to 250 participants)
 */

const express = require('express');
const app = express();
const port = 3000; // CHANGE PORT IF NEEDED

// Middleware to parse URL-encoded bodies (as sent by Twilio)
app.use(express.urlencoded({ extended: false }));

// 📞 POST endpoint hit when a voice call connects
app.post('/voice', (req, res) => {
  console.log('📞 Incoming call received by Twilio – connecting to conference.');

  const conferenceName = 'zeus_sales_demo'; // You can generate this dynamically if needed
  const isMuted = false; // Set true for sales agent listeners, false for AI or customer


//conferece muted "true" = can hear everything but cant be heard

  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Say>Connecting you to our sales line. Please hold.</Say>
      <Dial>
        <Conference muted="false" startConferenceOnEnter="true" endConferenceOnExit="false">
          ${conferenceName}
        </Conference>
      </Dial>
    </Response>
  `);
});

/**
 * EXPLANATION OF TwiML ELEMENTS:
 *
 * - <Say>: Plays audio to the caller
 * - <Dial><Conference>: Joins the caller to a shared conference room
 *    - muted="true": caller is silent but hears others (e.g. sales agent)
 *    - startConferenceOnEnter="true": starts the conference when this caller joins
 *    - endConferenceOnExit="false": prevents ending the room when they hang up
 */

app.listen(port, () => {
  console.log(`🎙️  Twilio Conference Call server running at http://localhost:${port}`);
});
