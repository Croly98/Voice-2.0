/* steps of how it works

Incoming calls - puts them into a Twilio conference.

Moderator’s arrival triggers AI bot to be dialed in.

AI bot joins both the conference and a WebSocket media stream to your AI server.

AI can speak/listen in real-time inside the conference.

*/



import express from 'express'; // web server
import twilio from 'twilio'; // twilio API + TwiML generator
import dotenv from 'dotenv'; // .env file
import { fileURLToPath } from 'url'; // for ES modules
import { dirname } from 'path'; // for ES modules (__dirname)

// Load environment variables
dotenv.config();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
// error if missing credentials
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('Missing Twilio credentials. Please set them in the .env file.');
    process.exit(1);
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN); // to creat/update calls via twilio REST API
const VoiceResponse = twilio.twiml.VoiceResponse; // used to build XML instruction (TwiML)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// needed to parse Twilio webhook form data
const app = express();
app.use(express.urlencoded({ extended: false }));

// Update with your own phone number in E.164 format
const MODERATOR = '+353861790710';
const PORT = 3000; // conference server
const AI_SERVER_PORT = 3001; // AI Media Server - Port where OLD-server.js will run (currently not OLD-server)
const NGROK_CONFERENCE_URL = 'ff3c1c367f6a.ngrok-free.app'; // Port 3000- Public URL for conference server
const NGROK_AI_URL = '8cbef3e3f118.ngrok-free.app'; // Port 3001- public URL for AI media server

// Conference state
const conferenceState = {
    isActive: false, // is the conference running
    aiCallSid: null, // AI bot's call SID
    conferenceName: 'Zeus_Conference' // conference name (fixed)
};

// Root route (health check)
app.get('/', (req, res) => {
    res.send({ message: 'Twilio Conference Server with AI Bot Bridge is running!' });
});

// Main conference webhook endpoint - handles incoming calls
// If caller is moderator: starts conference, ends when moderator leaves
app.post('/voice', async (req, res) => {
    const twiml = new VoiceResponse();
    const dial = twiml.dial();
    
    console.log(`Incoming call from: ${req.body.From}`);
    
    if (req.body.From === MODERATOR) {
        // Moderator joins - start conference
        dial.conference(conferenceState.conferenceName, {
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            statusCallback: `https://${NGROK_CONFERENCE_URL}/conference-status`,
            statusCallbackEvent: ['start', 'end', 'join', 'leave'],
            waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical'
        });
        
    } else {
        // Regular participant
        dial.conference(conferenceState.conferenceName, {
            startConferenceOnEnter: false,
            waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical'
        });
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Conference status callback - handles conference events (trys to call itself for AI bot)
app.post('/conference-status', async (req, res) => {
    const { StatusCallbackEvent, CallSid, ConferenceSid, FriendlyName } = req.body;
    
    console.log(`Conference event: ${StatusCallbackEvent} for ${FriendlyName || ConferenceSid}`);
    
    // conference started- call AI bot
    if (StatusCallbackEvent === 'conference-start') {
        console.log('Conference started - Adding AI bot...');
        conferenceState.isActive = true;
        
        // Make an outbound call to add AI bot to conference
        try {
            const aiCall = await client.calls.create({
                url: `https://${NGROK_CONFERENCE_URL}/ai-join-conference`,
                to: TWILIO_PHONE_NUMBER, // Call to your Twilio number
                from: TWILIO_PHONE_NUMBER,
                statusCallback: `https://${NGROK_CONFERENCE_URL}/ai-call-status`,
                statusCallbackEvent: ['initiated', 'answered', 'completed']
            });
            
            conferenceState.aiCallSid = aiCall.sid;
            console.log(`AI bot call initiated with SID: ${aiCall.sid}`);
            
        } catch (error) {
            console.error('Error adding AI bot to conference:', error);
        }
      // end AI call if still running  
    } else if (StatusCallbackEvent === 'conference-end') {
        console.log('Conference ended');
        conferenceState.isActive = false;
        
        // End AI bot call if it's still active
        if (conferenceState.aiCallSid) {
            try {
                await client.calls(conferenceState.aiCallSid).update({ status: 'completed' });
                console.log('AI bot call terminated');
            } catch (error) {
                console.error('Error ending AI bot call:', error);
            }
            conferenceState.aiCallSid = null;
        }
     // log particpant joined or left   
    } else if (StatusCallbackEvent === 'participant-join') {
        console.log(`Participant joined: ${CallSid}`);
    } else if (StatusCallbackEvent === 'participant-leave') {
        console.log(`Participant left: ${CallSid}`);
    }
    
    res.send({ received: true });
});


// TwiML for AI bot to join conference, it should do the following:
// Plays a greeting message
// Joins the conference silently (no beep, doesn’t end it if AI leaves)
// Also starts a <Stream> to WebSocket AI server (ai-server-for-conference.js)

app.post('/ai-join-conference', (req, res) => {
    console.log('AI bot answering call to join conference');
    
    const twiml = new VoiceResponse();
    
    // First, announce the AI is joining
    twiml.say('Thalia from Zeus Packaging is joining the conference');
    
    // Connect AI to the media stream server
    twiml.dial().conference(conferenceState.conferenceName, {
        startConferenceOnEnter: false,
        endConferenceOnExit: false,
        beep: false
    });
    
    // Add stream to connect to the AI server
    const connect = twiml.connect();
    connect.stream({
        url: `wss://${NGROK_AI_URL}/media`
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Status callback for AI bot call (Logs call lifecycle events for the AI bot’s leg)
app.post('/ai-call-status', (req, res) => {
    const { CallStatus, CallSid } = req.body;
    console.log(`AI bot call status: ${CallStatus} (SID: ${CallSid})`);
    res.send({ received: true });
});

// Alternative approach: Bridge AI bot through a separate call (might remove this, for testing)
app.post('/ai-bridge', (req, res) => {
    console.log('Creating bridge for AI bot');
    
    const twiml = new VoiceResponse();
    
    // Say greeting
    twiml.say('Connecting Thalia from Zeus Packaging');
    twiml.pause({ length: 1 });
    
    // Connect to the AI WebSocket server (OLD-server.js)
    const connect = twiml.connect();
    connect.stream({
        url: `wss://${NGROK_AI_URL}/media`
    });
    
    res.type('text/xml');
    res.send(twiml.toString());
});

// Manual trigger to add AI bot (useful for testing)
app.post('/add-ai-to-conference', async (req, res) => {
    if (!conferenceState.isActive) {
        return res.status(400).json({ error: 'No active conference' });
    }
    
    try {
        // Create call that will bridge to OLD-server.js
        const aiCall = await client.calls.create({
            url: `https://${NGROK_CONFERENCE_URL}/ai-bridge`,
            to: TWILIO_PHONE_NUMBER,
            from: TWILIO_PHONE_NUMBER,
            statusCallback: `https://${NGROK_CONFERENCE_URL}/ai-call-status`
        });
        
        // After connecting to AI server, add to conference
        setTimeout(async () => {
            await client.calls(aiCall.sid).update({
                twiml: `<Response>
                    <Dial>
                        <Conference>${conferenceState.conferenceName}</Conference>
                    </Dial>
                </Response>`
            });
        }, 3000);
        
        res.json({ 
            success: true, 
            aiCallSid: aiCall.sid,
            message: 'AI bot is being added to conference'
        });
        
    } catch (error) {
        console.error('Error adding AI to conference:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Conference server running on port ${PORT}`);
    console.log(`Webhook URL: https://${NGROK_CONFERENCE_URL}/voice`);
    console.log('');
    console.log('IMPORTANT: Also run ai-server-for-conference.js on port 3001 for AI functionality');
    console.log(`Update your Twilio phone number webhook to point to: https://${NGROK_CONFERENCE_URL}/voice`);
});