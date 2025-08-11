/* Conference-server.js

SUMMARY OF HOW IT WORKS:

Step 1:
    - The Fastify server starts and listens on a port
    - It supports HTTP routes and WebSocket connections.

Step 2: 
    -Twilio calls /conference-join endpoint when someone joins the conference.

 respond with twiml xml telling twilio to
    - dial into the conference room
    - start media stream to /media WebSocket URL
    
Step 3:
    -Twilio connects a websocket to /media route to send live audio from the call
    -server accepts this websocket connection and gets ready to handle audio streams

Step 4:
    -server opens another WebSocket connection to OpenAI’s realtime API
    -It sends session settings (audio formats, voice, system instructions)

Step 5:
    - Twilio sends encoded audio chunks (g711_ulaw) from the caller’s voice over the /media WebSocket
    - server forwards this audio data to OpenAI in realtime

Step 6:
    - OpenAI transcribes, understands, and generates a spoken response
    - It sends back audio chunks (also g711_ulaw) over the WebSocket

Step 7: 
    - server immediately forwards OpenAI’s audio chunks back to Twilio via /media WebSocket
    - Twilio plays audio to the caller

Step 8: 
    - server listens for start/stop events

Step 9:
    - The server sends “mark” events to Twilio to track where AI audio starts and ends
    - This helps in managing timing and truncation smoothly (I think)

Step 10: 
    - When the call or WebSocket closes, the server cleans up by closing the OpenAI connection

--------------------------------------------------------------------------


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
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// envitomental set-up

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY } = process.env;

// .env error message, if api key cant be find
if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

/*
--- FASTIFY SERVER SET-UP & DIRECTORY CONSTANTS
*/

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

//adding this for instructions.txt (prompt for ai)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants- Propmpts as well as deciding which voice model we go with
// system message connected with instructions

/*
--- LOAD INSTRUCTIONS, DEFINE CONSTANTS AND CALL INSTRUCTIONS---
*/


const SYSTEM_MESSAGE = fs.readFileSync(path.join(__dirname, 'instructions.txt'), 'utf-8');
const VOICE = 'sage'; //find the best voice
/* port kept going to 3000 for some reason
const PORT = process.env.PORT || 8080; // Allow dynamic port assignment
*/

// const port for server
const PORT = 8080;


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

// we defineRoot Route and a route to handle incoming calls (/incoming-call)
// will return TwiML, Twilio’s Markup Language, to direct Twilio how to handle the call
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// conference join route (my Twiml response)

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
// we hit the incoming-call hook, twilio hits this, it passed twiml back

// FOR conferenceCall.JS

// conference join route

fastify.all('/conference-join', async (request, reply) => {
  const { muted = 'false', beep = 'true' } = request.query;

// Build optional Stream block only for AI leg 
// this should fix the issue with the call not starting
 const { stream = 'false' } = request.query;


// KEEP ON MEDIA NOT MEDIA-STREAM!!!!

 /*
const streamBlock = stream === 'true' ? `
  <Start>
    <Stream url="wss://${request.hostname}/media-stream" />
  </Start>` : '';
*/

// DONT CHANGE THIS PART, IT WORKS FOR 101 PROTOCOLS AND TRANSCRIPT

const streamBlock = `
  <Start>
    <Stream url="wss://${request.headers.host}/media" />
  </Start>`;

// Can use Twiml bin possible
//this creates our twiml says the following: 
//stream = tells twilio to connect to a stream at a different end point
//twiml used to start the conversation "hey we are doing a media stream, here is where to talk" 
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
    ${streamBlock}
      <Dial>
        <Conference
          beep="true"
          startConferenceOnEnter="true"
          endConferenceOnExit="true"
          muted="false">
          zeus_sales_demo
        </Conference>
      </Dial>
    </Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// summary: Told twilio to connect to the media-stream endpoint

// WEBSOCKE SECTION (bit confusing but it makes sense)

// WebSocket route for media-stream (CHANGED TO JUST MEDIA)
// In this we DEFINE that media-stream endpoint

// WebSocket /media Route Setup

fastify.register(async (fastify) => {
    fastify.get('/media', { websocket: true }, (connection, req) => { //here is where we defind it
        console.log('Client connected'); //first connection

        // Connection-specific state
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

        // then we connect to the OpenAI websocket

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
                    temperature: 0.7,
                }
            };
            // once the session is defined ^ (we tell it everything we want)
            //we then log in and send it to OpenAI
            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));

            // COMMENTED OUT CODE ⬇️: Uncomment the following line to have AI speak first:
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
                            text: 'Greet the user with "Hello there! I am an AI voice assistant powered by Twilio and the OpenAI Realtime API. You can ask me for facts, jokes, or anything you can imagine. How can I help you?"'
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


        // Handle interruption when the caller's speech starts
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

        // Send mark messages to Media Streams so we know if and when AI response playback is finished
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
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(initializeSession, 100);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        // the response from OpenAI
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

        // Handle incoming messages from Twilio (we receive it)
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