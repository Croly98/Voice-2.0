// twiml-con-server.js

/**
 *SUMMARY:
 * - This TwiML server handles Twilio's POST webhook to /conference-join.
 * - It joins the caller (AI, customer, or agent) to a shared conference room.
 * - If the caller sends stream=true, we also start media streaming to the AI WebSocket.
 * 
 *Run with:
 *   node twiml-con-server.js
 *   ensure ngrok running, 3000 port
 */

const express = require('express');
const app = express();
const port = 3000; // change if needed

// Parse URL-encoded bodies sent by Twilio
app.use(express.urlencoded({ extended: false }));

// POST endpoint for joining a conference
app.post('/conference-join', (req, res) => {
  console.log('📞 Incoming call for conference join');

  // for beep
  const beep = req.query.beep === 'true' ? 'true' : 'false';

  // (don't change, helps with muting issues, not sure how)
  const muted = req.query.muted === 'true' ? 'true' : 'false';

  // Check if we should stream audio to the AI
  const stream = req.query.stream === 'true';

  const CONFERENCE_NAME = 'zeus_sales_demo';

  // console warnings
  if (req.query.beep === undefined) console.warn('⚠️ No beep param provided!');
  if (req.query.muted === undefined) console.warn('⚠️ No muted param provided!');
  if (req.query.stream === undefined) console.warn('⚠️ No stream param provided!');

  // Update ngrok / deployed WebSocket server URL (8080 usually)
  const mediaStreamURL = 'wss://a4e75ba236b6.ngrok-free.app/media';

  // Logs for debugging request and config
  console.log('🔍 Twilio Request Params:', req.query);
  console.log(`🧩 mediaStreamURL used: ${mediaStreamURL}`);
  console.log(`🧩 muted param: ${muted}`);
  console.log(`🧩 stream param: ${stream}`);

  // Build TwiML
  let responseXml = `
    <Response>
      <Say>Connecting you now.</Say>`;

  // Only include <Start><Stream> if stream=true
  if (stream) {
    console.log('✅ Adding <Stream> block to response XML for streaming participant');
    responseXml += `
      <Start>
        <Stream url="${mediaStreamURL}" />
      </Start>`;
  }

  // ADDING TIME LIMIT FOR TESTING (advised) timeLimit can be deleted later
  responseXml += `
      <Dial timeLimit="90">
        <Conference 
          muted="${muted}" 
          startConferenceOnEnter="true" 
          endConferenceOnExit="false"
        >
          ${CONFERENCE_NAME}
        </Conference>
      </Dial>
    </Response>`;

  // Send XML
  res.set('Content-Type', 'text/xml');
  res.send(responseXml);
});

/**
 *TwiML Behavior
 * - <Say>: Optional message
 * - <Start><Stream>: Only added if stream=true (for AI)
 * - <Conference>:
 *    - muted=true: Listener only (e.g., agent)
 *    - muted=false: Talker + listener (e.g., AI or customer)
 */

app.listen(port, () => {
  console.log(`🎧 TwiML Conference server running at http://localhost:${port}`);
});
