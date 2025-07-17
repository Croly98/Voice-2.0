// twiml-server.js

// creates a basic TwiML server using Node.js and Express.js
// this handles incoming Twilio voice webhooks

/* SUMMARY:

1.A call comes in.
2. Twilio sends a POST request to /voice (we configure this URL in the Twilio phone number settings).
3. This server responds with TwiML telling Twilio:
    
    Begin streaming the call to your WebSocket server (running at wss://.ngrok.io)
    Say a message
    Pause the call to keep it open for 60 seconds
*/





// express.js
// Creates an instance of the Express application
// Sets the server to run on port 3000
const express = require('express');
const app = express();
const port = 3000;

// POST Route for voice call + ngrok server
// POST endpoint at /voice. Twilio will call this URL (e.g., http://your-server.com/voice) when a call is received

// XML because Twilio expects TwiML
// Start streaming audio to the WebSocket URL for real-time audio analysis.
// Say: The Twilio voice will say "Connecting you now..."
// Pause for 60 seconds (keeps the call open while the stream is active)

app.post('/voice', (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss:///bf1ca7085ac6.ngrok-free.app" />
      </Start>
      <Say>Connecting you now...</Say>
      <Pause length="60" />
    </Response>
  `);
});

app.listen(port, () => {
  console.log(`Twilio TwiML server running on http://localhost:${port}`);
});
