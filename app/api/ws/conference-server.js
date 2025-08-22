/* Conference-server.js

SUMMARY OF HOW IT WORKS:

Step 1: SERVER IS RUNNING
    - our Fastify server is up on port 8080
    - conference-join and /media endpoints are ready
    - it’s connected to Twilio (via webhooks) and can connect to OpenAI (via WebSocket)


Step 2: HUMAN DIALS MY TWILIO NUMBER
    - twilio receives the call and checks your webhook
    - it makes an HTTP request to /conference-join (without ai=true)

    
Step 3: SERVER RESPONDS WITH TWIML
    - "put this caller in a conference room called zeus_sales_demo”
    - no <Start><Stream> because this is a human leg

    - Caller is now sitting in the conference room, waiting


Step 4: SERVER CREATES AI LEG
    - the server sees this is a human leg (not AI)
    - it uses the Twilio REST API to place another call:
        - to = your Twilio number
        - from = your Twilio number
        - url = /conference-join?ai=true


Step 5: AI LEG JOINS CONFERENCE
    - twilio dials itself back into /conference-join?ai=true
    - server replies with TwiML:
        - join zeus_sales_demo conference
        - also <Start><Stream> to /media

    - now AI leg is in the same room as the person      


Step 6: TWILIO STARTS MEDIA STREAM
    - twilio opens a WebSocket connection to /media
    - it sends an initial start event with a streamSid
    - after that, it starts sending media events with chunks of caller audio


Step 7: SERVER CONNECT TO OPENAI
    - when /media opens, server creates a WebSocket connection to OpenAI Realtime API
    - it sends a session update telling OpenAI:
        - expect audio in g711_ulaw.
        - reply with audio in g711_ulaw
        - use the "sage" voice. (for now)
        - use instructions.txt as system prompt
        - detect when caller stops speaking (server_vad)


Step 8: CALLER SPEAKS
    - caller says: “Hello, I need some packaging”
    - twilio sends chunks of μ-law audio → /media
    - server forwards them to OpenAI as input_audio_buffer.append
    - when silence is detected, OpenAI is prompted to generate a response

Step 9: AI RESPONDS 
    - openAI replies with response.audio.delta events (audio chunks).
    - server forwards these immediately to Twilio as media events.
    - twilio plays them into the conference → caller hears the AI voice.
    - server also sends mark events so Twilio knows when playback aligns.


Step 10: CALLER INTERUPTS (need to make sure its not too sensitive)
    - If caller starts talking mid-response:
        - twilio sends input_audio_buffer.speech_started
        - server tells OpenAI to truncate the current audio (conversation.item.truncate)
        - AI audio is cut short
        - conversation continues naturally

Step 11: CONVERSATION CONTINUES
    - each turn follows the same cycle:
        - caller audio → /media → OpenAI
        - openAI reply audio → /media → Twilio → conference
        - marks track timing
        - truncation if caller interrupts


Step 12: CALL ENDS
    - when either hangs up:
        - twilio closes the conference leg
        - /media WebSocket closes
        - server closes the OpenAI Websocket
    - everything is cleaned up 

TIP:
    - MAKE SURE TWILIO CONSOLE AND NGROK IS UPDATED
--------------------------------------------------------------------------
*/

/*
---IMPORTS AND ENVIORMENTAL SET-UP
*/


// imports

//this is here for instructions.txt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';


import Fastify from 'fastify'; //fast webframework, used with websockets
import WebSocket from 'ws'; // webSocket client/server
import dotenv from 'dotenv'; // loads my .env file
import fastifyFormBody from '@fastify/formbody'; // parse form POST bodies (i think)
import fastifyWs from '@fastify/websocket'; // WebSocket routes inside Fastify
import twilio from 'twilio'; // Twilio REST client

// envitomental set-up

// Load environment variables from .env file
dotenv.config();

// Retrieve API keys from environment variables.
const { OPENAI_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

// .env error message, if api key cant be find
if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. double check .env file.');
    process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials. Check .env file.');
    process.exit(1);
}

// REST client which triggers twilio calls programmaticlaly (AI leg)
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/*
--- FASTIFY SERVER SET-UP & DIRECTORY CONSTANTS ---
*/

// Initialize Fastify
const fastify = Fastify(); //start server
fastify.register(fastifyFormBody); // enable form POSTs
fastify.register(fastifyWs); // Enable WebSockets routes

//adding this for instructions.txt (prompt for ai)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/*
--- LOAD INSTRUCTIONS, DEFINE CONSTANTS AND CALL INSTRUCTIONS---
*/

// Loads instructions.txt
const SYSTEM_MESSAGE = fs.readFileSync(path.join(__dirname, 'instructions.txt'), 'utf-8');
// OpenAI voice model
const VOICE = 'sage'; //find the best voice

// const port for server (had to use const as had issues getting correct port)
const PORT = 8080;

// Twilio phone number for AI leg (update this with your actual Twilio number)
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+16073094981'; // change if needed


//log for instructions.txt file
console.log('[System Instructions Loaded]:\n', SYSTEM_MESSAGE);

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime-server-events/response/content_part/done
const LOG_EVENT_TYPES = [

// Something went wrong — check the error message for details.
'error',

// Assistant finished speaking or generating output.
'response.content.done',

// Updated info about usage limits or quotas.
'rate_limits.updated',

// Full response is complete — nothing more will be sent.
'response.done',

// Audio chunk sent and accepted for processing.
'input_audio_buffer.committed',

// User stopped speaking — end of speech detected.
'input_audio_buffer.speech_stopped',

// User started speaking — speech detected in audio.
'input_audio_buffer.speech_started',

// New session has started — ready to send/receive.
'session.created',

// DEFAULT EVENTS COMPLETED, ADDING MORE BELOW IF NEEDED

// Final transcript of the user's speech is ready (not necessarily includes interruptions)
'response.audio_transcript.done'

];

// Show AI response elapsed timing calculations (FOR TESTING)
const SHOW_TIMING_MATH = false;

/*
--- HTTP ROUTES ---
*/

// basic http routes

// quick health-check endpoint (confirms if server is running)
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// CHANGE THIS AS IT NEED TO BE SET UP FOR CONFERENCE
// /incoming-call
// Direct connection route (been told its simpler and more reliable than conference)
fastify.all('/incoming-call', async (request, reply) => {
    console.log('📞 Incoming call - using direct Connect mode');
    
    // Get the host from request headers for dynamic WebSocket URL
    const wsHost = request.headers.host || 'localhost:8080';
    const wsProtocol = wsHost.includes('ngrok') ? 'wss' : 'ws';
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>Connecting to Zeus Packaging AI assistant</Say>
        <Pause length="0.5"/>
        <Connect>
            <Stream url="${wsProtocol}://${wsHost}/media" />
        </Connect>
    </Response>`;
    
    console.log('TwiML response for direct connection:', twimlResponse);
    reply.type('text/xml').send(twimlResponse);
});

// conference join route (my Twiml response)

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
// we hit the incoming-call hook, twilio hits this, it passed twiml back

// FOR conferenceCall.JS

// conference join route
fastify.all('/conference-join', async (request, reply) => {
  const { beep = 'true', muted = 'false', ai = 'false', from } = request.query;

  // Detect AI leg from query param
  const isAiLeg = ai === 'true';
  
  // Get the host from request headers for dynamic WebSocket URL
  const wsHost = request.headers.host || 'localhost:8080';
  const wsProtocol = wsHost.includes('ngrok') ? 'wss' : 'ws';

  // Only AI leg gets <Start><Stream>
  // twilio streams to media
  const streamBlock = isAiLeg ? `
  <Start>
    <Stream url="${wsProtocol}://${wsHost}/media" />
  </Start>` : '';

  // If this is a user joining (not AI), automatically create AI leg
  // When a human joins, server automatically dials the AI leg into the same conference
  if (!isAiLeg && from !== TWILIO_PHONE_NUMBER) {
    console.log('👤 User joining conference, creating AI leg...');
    // Create AI leg after a short delay
    setTimeout(() => {
      createAiLeg(wsHost, wsProtocol);
    }, 1500);
  }

  // Twilio XML response to actually join the conference
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${streamBlock}
  <Dial>
    <Conference beep="${beep}" startConferenceOnEnter="true" endConferenceOnExit="true" muted="${muted}" waitUrl="">
      zeus_sales_demo
    </Conference>
  </Dial>
</Response>`;

  console.log(`${isAiLeg ? '🤖 AI' : '👤 User'} joining conference`);
  console.log('TwiML response:', twimlResponse);

  reply.type('text/xml').send(twimlResponse);
});

// Function to create AI leg
// Makes Twilio dial its own number back in with ai=true - AI joins
const createAiLeg = async (wsHost, wsProtocol) => {
  try {
    const aiUrl = `${wsProtocol === 'wss' ? 'https' : 'http'}://${wsHost}/conference-join?ai=true&from=${TWILIO_PHONE_NUMBER}`;
    
    const call = await twilioClient.calls.create({
      to: TWILIO_PHONE_NUMBER,
      from: TWILIO_PHONE_NUMBER,
      url: aiUrl
    });
    
    console.log('🤖 AI leg created with SID:', call.sid);
  } catch (error) {
    console.error('❌ Error creating AI leg:', error.message);
  }
};


// summary: Conference setup with automatic AI leg creation


// WEBSOCKE SECTION (bit confusing but it makes sense)

// WebSocket route for media-stream (CHANGED TO JUST MEDIA)
// In this we DEFINE that media-stream endpoint

// WebSocket /media Route Setup

// This is where Twilio Media Stream connects
// Every call leg streams here
fastify.register(async (fastify) => {
    fastify.get('/media', { websocket: true }, (connection, req) => { //here is where we defind it
        console.log('Client connected'); //first connection

        // Connection-specific state (state variables)
        // Track audio timestamps, AI messages, mark events, etc
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

        // then we connect to the OpenAI websocket (OpenAI Realtime API)
        // OpenAI WebSocket Connection

        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`, //openAI key (in .env)
                "OpenAI-Beta": "realtime=v1"
            }
        });

        // Control initial session with OpenAI
        // basically tells openAI all the different info we want

        /*
        --- INITIALISE OPENAI SESSION --
        */

        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' }, //determines that you have stopped talking
                    input_audio_format: 'g711_ulaw', //required for twilio voice (e.g pcm not supported)
                    output_audio_format: 'g711_ulaw', //required for twilio voice
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    //temp: 1 = wacky, 0 = straight forward 
                    temperature: 0.6,
                }
            };
            // once the session is defined ^ (we tell it everything we want)
            // we then log in and send it to OpenAI
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));

            // COMMENTED OUT CODE ⬇️: Uncomment the following line to have AI speak first: ( also breaks instructions.txt for some reason)
            // sendInitialConversationItem();
        };

        // Send initial conversation item if AI talks first (NOT CURRENTLY USED)
        const sendInitialConversationItem = () => {
            const initialConversationItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'Hello!"' // change intro if needed
                        }
                    ]
                }
            };

            if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        /*
        --- HANDLE SPEECH STARTED EVENT ---
        */


        // Handle interruption when the caller's speech starts (got this from twilio Doc)
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
                    openAiWs.send(JSON.stringify(truncateEvent));
                }

                connection.send(JSON.stringify({
                    event: 'clear',
                    streamSid: streamSid
                }));

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        /*
        --- SENDING MARKS TO TWILIO---
        */

        // Send mark messages to Media Streams so we know if and when AI response playback is finished (got this from twilio Doc)

        // Marks tell Twilio when a chunk of AI speech has been sent
        // Used to sync playback timing
        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'responsePart' }
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push('responsePart');
            }
        };

        /*
        OPENAI WEBSOCKET EVENT HANDLERS
        */


        // Open event for OpenAI WebSocket
        // When openAI says these things to us, we are going to do something with it
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API!');
            setTimeout(initializeSession, 100);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        // the response from OpenAI
        // On AI audio chunk → forward to Twilio + On user speech detected → truncate AI
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    // sending the audio from OpenAI to twilio media streams (the audio)
                    connection.send(JSON.stringify(audioDelta));

                    // First delta from a new response starts the elapsed time counter
                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                        if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
                    }

                    if (response.item_id) {
                        lastAssistantItem = response.item_id;
                    }
                    
                    sendMark(connection, streamSid);
                }

                if (response.type === 'input_audio_buffer.speech_started') {
                    handleSpeechStartedEvent();
                }
            } catch (error) {
                console.error('Error processing OpenAI message:', error, 'Raw message:', data);
            }
        });

        /*
        --- HANDLE INCOMING MESSAGES FROM TWILIO---
        */

        // Handle incoming messages from Twilio (we receive it) (got from twilio doc)
        // On media → send caller audio to OpenAI
        // On start → save stream ID
        // On mark → consume queued marks
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
        // we either get a Media or Start event
                switch (data.event) {
                    case 'media': // receive audio from the caller
                        latestMediaTimestamp = data.media.timestamp;
                        if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            // sends audio in chunks / append this to the existing convo, heres the media
                            const audioAppend = { 
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case 'start': // we start our stream
                        streamSid = data.start.streamSid;
                        console.log('Incoming stream has started', streamSid);

                        // Reset start and media timestamp on a new stream
                        responseStartTimestampTwilio = null; 
                        latestMediaTimestamp = 0;
                        break;
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close(); // when we close twilio we also close OpenAI
            console.log('Client disconnected.');
        });

        // Handle WebSocket close and errors
        openAiWs.on('close', () => {
            console.log('Disconnected from the OpenAI Realtime API');
        });

        openAiWs.on('error', (error) => {
            console.error('Error in the OpenAI WebSocket:', error);
        });
    });
});

/*
--- START FASTIFY SERVER ---
*/


// prepares the server
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});

/* Final Flow Recap (like a chain)

Human Caller 📞 → Twilio Call → /conference-join → Conference Room
→ Server dials AI leg → Twilio AI Call → /conference-join?ai=true
→ AI leg streams audio to /media WebSocket
→ Server bridges Twilio ↔ OpenAI Realtime
→ Caller’s voice → AI brain → AI voice back → Caller

*/