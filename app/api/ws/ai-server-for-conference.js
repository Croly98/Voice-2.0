// AI SERVER FOR CONFERENCE CALLS (the AI side of the conference)
// Run this on port 3001 alongside the conference server

/* 

-Accepting audio streams from Twilio (via <Stream> in TwiML).

-Relaying audio back and forth between Twilio and OpenAI’s Realtime API.

Making the AI behave in a conference-friendly way (polite, concise, not interrupting).

Handling interruptions, transcription logs, and playback synchronization

*/

// NEW AI PHONE NUMBER +35319079387

// IMPORTS & SET UP
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import Fastify from 'fastify'; //fast webframework, used with websockets
import WebSocket from 'ws'; // webSocket client/server
import dotenv from 'dotenv'; // load .env file
import fastifyFormBody from '@fastify/formbody'; // parse form POST bodies (i think)
import fastifyWs from '@fastify/websocket'; // WebSocket routes inside Fastify

// Load environment variables
dotenv.config();

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const SYSTEM_MESSAGE = fs.readFileSync(path.join(__dirname, 'instructions.txt'), 'utf-8');
const VOICE = 'sage'; // voice model (Shimmer or Verse might be better)
const PORT = 3001; // Different port from conference server
const NGROK_AI_URL = '8cbef3e3f118.ngrok-free.app'; // PORT 3001

console.log('[AI Server] System Instructions Loaded:\n', SYSTEM_MESSAGE);

// Conference-aware system message WILL MOST LIKELY GET RID OF THIS
const CONFERENCE_SYSTEM_MESSAGE = SYSTEM_MESSAGE + `

You are participating in a conference call with potentially multiple participants.
- Listen carefully to all speakers
- Respond when directly addressed or when you can add value
- Be concise and professional
- Allow others to speak - don't dominate the conversation
- If you hear multiple voices, acknowledge that you're speaking to a group`;

// Event types to log
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
'response.audio_transcript.done',

// The Realtime API has fully processed the incoming audio chunk you sent, and the final transcription text is now available
'conversation.item.input_audio_transcription.completed'
];

const SHOW_TIMING_MATH = false;

// Root route (Health check endpoint)
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'AI Conference Bot Server is running on port 3001!' });
});

// Handle incoming call webhook from Twilio (when AI bot is called)
// Announces AI is joining
// Opens a <Stream to /media
fastify.all('/incoming-call', async (request, reply) => {
    console.log('[AI Server] Handling incoming call for conference bot');
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>Thalia from Zeus Packaging is connecting to the conference</Say>
                              <Pause length="1"/>
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media" />
                              </Connect>
                          </Response>`;
    
    reply.type('text/xml').send(twimlResponse);
});

// summary: Told twilio to connect to the media-stream endpoint

// WebSocket endpoint for media stream
// IMPORTANT: Every conference call leg creates a websocket connection here
fastify.register(async (fastify) => {
    fastify.get('/media', { websocket: true }, (connection, req) => {
        console.log('[AI Server] Client connected to media stream');
        
        // Connection-specific state
        // keeps track of current audio stream, playback, interruptions and if the AI bot greets
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;
        let hasGreeted = false;
        
        // Connect to OpenAI Realtime
        // opens a WebSocket to openAI's Realtime API
        // configures g711_ulaw (for twilio) + voice = sage
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });
        
        // Initialize session with OpenAI
        // configures voice settings, conference rules and speech detection
        // sends this to OpenAI once the connection opens
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' }, //determines that you have stopped talking
                    input_audio_format: 'g711_ulaw', //required for twilio voice (e.g pcm not supported)
                    output_audio_format: 'g711_ulaw', //required for twilio voice
                    voice: VOICE,
                    instructions: CONFERENCE_SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    //temp: 1 = wacky, 0 = straight forward 
                    temperature: 0.7,
                }
            };
            
            console.log('[AI Server] Initializing OpenAI session for conference');
            openAiWs.send(JSON.stringify(sessionUpdate));
            
            // Greet the conference after a delay
            if (!hasGreeted) {
                setTimeout(() => sendInitialGreeting(), 3000);
            }
        };
        // TODO: GET RID OF GREETING
        // AI introduces itself to the conference 
        const sendInitialGreeting = () => {
            if (hasGreeted) return;
            hasGreeted = true;
            
            const initialConversationItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'You just joined a conference call. Briefly introduce yourself by saying: "Hello everyone, this is Thalia from Zeus Packaging. I am here if you have any questions about our packaging solutions."'
                        }
                    ]
                }
            };
            
            console.log('[AI Server] Sending greeting to conference');
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };
        
        // Handle interruption when someone starts speaking
        // the ai cuts itself of mid-setence if interupted
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                
                if (SHOW_TIMING_MATH) {
                    console.log(`[AI Server] Interruption detected - elapsed time: ${elapsedTime}ms`);
                }
                
                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    
                    console.log('[AI Server] Truncating response due to interruption');
                    openAiWs.send(JSON.stringify(truncateEvent));
                }
                
                connection.send(JSON.stringify({
                    event: 'clear',
                    streamSid: streamSid
                }));
                
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };
        
        // Send mark messages to track playback
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
        
        // OpenAI WebSocket events
        openAiWs.on('open', () => {
            console.log('[AI Server] Connected to OpenAI Realtime API');
            setTimeout(initializeSession, 100);
        });
        
        // Listen for messages from OpenAI
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`[AI Server] OpenAI event: ${response.type}`);
                    
                    // Log transcripts for monitoring
                    if (response.type === 'response.audio_transcript.done') /*what bot said */ { 
                        console.log('[AI Server] Thalia said:', response.transcript);
                    }
                    if (response.type === 'conversation.item.input_audio_transcription.completed') /*what human said */ {
                        console.log('[AI Server] User said:', response.transcript);
                    }
                }
                
                // Handle audio delta from OpenAI
                // sends audio chunks from OpenAI to Twilio in real time
                // This is how the AI bot's speech reaches the conference
                if (response.type === 'response.audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    
                    connection.send(JSON.stringify(audioDelta));
                    
                    if (!responseStartTimestampTwilio) {
                        responseStartTimestampTwilio = latestMediaTimestamp;
                    }
                    
                    if (response.item_id) {
                        lastAssistantItem = response.item_id;
                    }
                    
                    sendMark(connection, streamSid);
                }
                
                // Handle speech detection
                if (response.type === 'input_audio_buffer.speech_started') {
                    console.log('[AI Server] Speech detected from conference');
                    handleSpeechStartedEvent();
                }
                
            } catch (error) {
                console.error('[AI Server] Error processing OpenAI message:', error);
            }
        });
        
        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                // takes audio from twilio partipants and stream it into OpenAI's
                // input_audio_buffer
                switch (data.event) {
                    case 'media':
                        // Audio from conference participants
                        latestMediaTimestamp = data.media.timestamp;
                        
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: 'input_audio_buffer.append',
                                audio: data.media.payload
                            };
                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                        
                    case 'start':
                        streamSid = data.start.streamSid;
                        console.log('[AI Server] Media stream started:', streamSid);
                        console.log('[AI Server] Call SID:', data.start.callSid);
                        
                        responseStartTimestampTwilio = null;
                        latestMediaTimestamp = 0;
                        break;
                        
                    case 'stop':
                        console.log('[AI Server] Media stream stopped');
                        break;
                        
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                        
                    default:
                        console.log('[AI Server] Received event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('[AI Server] Error parsing message:', error);
            }
        });
        
        // Handle connection close
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            console.log('[AI Server] Client disconnected from media stream');
        });
        
        // Handle WebSocket errors
        openAiWs.on('close', () => {
            console.log('[AI Server] Disconnected from OpenAI Realtime API');
        });
        
        openAiWs.on('error', (error) => {
            console.error('[AI Server] OpenAI WebSocket error:', error);
        });
    });
});

// Start server
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`[AI Server] Running on port ${PORT}`);
    console.log(`[AI Server] WebSocket endpoint: wss://${NGROK_AI_URL}/media`);
    console.log(`[AI Server] Ready to join conference calls`);
});