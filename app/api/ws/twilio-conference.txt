import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import twilio from 'twilio';

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
const VOICE = 'sage';
const PORT = 3000;
const MODERATOR = '+353861790710';

console.log('[System Instructions Loaded]:\n', SYSTEM_MESSAGE);

// Conference state tracking
const conferenceState = {
    isActive: false,
    aiStreamSid: null,
    participants: new Set()
};

// Event types to log
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created',
    'response.audio_transcript.done'
];

const SHOW_TIMING_MATH = false;

// Root route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Conference Server with AI Bot is running!' });
});

// Main conference webhook endpoint
fastify.post('/voice', async (request, reply) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    
    const dial = twiml.dial();
    
    if (request.body.From === MODERATOR) {
        // Moderator joins - start conference and add AI bot
        const conference = dial.conference('My conference', {
            startConferenceOnEnter: true,
            endConferenceOnExit: true,
            waitUrl: '',
            statusCallback: `https://${request.headers.host}/conference-status`,
            statusCallbackEvent: ['start', 'end', 'join', 'leave']
        });
        
        conferenceState.isActive = true;
        
        // Add stream for AI bot to join the conference
        conference.stream({
            url: `wss://${request.headers.host}/conference-stream`
        });
        
    } else {
        // Regular participant
        dial.conference('My conference', {
            startConferenceOnEnter: false
        });
    }
    
    reply.type('text/xml').send(twiml.toString());
});

// Conference status callback
fastify.post('/conference-status', async (request, reply) => {
    const { StatusCallbackEvent, CallSid, ConferenceSid } = request.body;
    
    console.log(`Conference event: ${StatusCallbackEvent} for conference ${ConferenceSid}`);
    
    if (StatusCallbackEvent === 'conference-start') {
        console.log('Conference started, AI bot should be joining...');
    } else if (StatusCallbackEvent === 'conference-end') {
        console.log('Conference ended');
        conferenceState.isActive = false;
        conferenceState.participants.clear();
    } else if (StatusCallbackEvent === 'participant-join') {
        conferenceState.participants.add(CallSid);
        console.log(`Participant joined: ${CallSid}`);
    } else if (StatusCallbackEvent === 'participant-leave') {
        conferenceState.participants.delete(CallSid);
        console.log(`Participant left: ${CallSid}`);
    }
    
    reply.send({ received: true });
});

// WebSocket endpoint for conference media stream
fastify.register(async (fastify) => {
    fastify.get('/conference-stream', { websocket: true }, (connection, req) => {
        console.log('Conference stream connected - AI Bot joining');
        
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;
        
        // Connect to OpenAI
        const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1"
            }
        });
        
        // Initialize OpenAI session for conference
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    turn_detection: { type: 'server_vad' },
                    input_audio_format: 'g711_ulaw',
                    output_audio_format: 'g711_ulaw',
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE + "\n\nYou are joining a conference call. Multiple people may be on the call. Be helpful and respond when addressed or when you can add value to the conversation.",
                    modalities: ["text", "audio"],
                    temperature: 0.7,
                }
            };
            
            console.log('Initializing OpenAI session for conference');
            openAiWs.send(JSON.stringify(sessionUpdate));
            
            // Have AI introduce itself when joining
            sendInitialGreeting();
        };
        
        // AI introduces itself to the conference
        const sendInitialGreeting = () => {
            setTimeout(() => {
                const initialConversationItem = {
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: 'Introduce yourself briefly to the conference call. Say: "Hello everyone, this is Thalia from Zeus Packaging joining the call. I\'m here to help with any packaging questions you might have."'
                            }
                        ]
                    }
                };
                
                openAiWs.send(JSON.stringify(initialConversationItem));
                openAiWs.send(JSON.stringify({ type: 'response.create' }));
            }, 2000); // Wait 2 seconds before greeting
        };
        
        // Handle interruptions in conference
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                
                if (SHOW_TIMING_MATH) {
                    console.log(`Conference interruption - elapsed time: ${elapsedTime}ms`);
                }
                
                if (lastAssistantItem) {
                    const truncateEvent = {
                        type: 'conversation.item.truncate',
                        item_id: lastAssistantItem,
                        content_index: 0,
                        audio_end_ms: elapsedTime
                    };
                    
                    if (SHOW_TIMING_MATH) {
                        console.log('Truncating AI response due to interruption');
                    }
                    
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
        
        // Send mark messages
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
            console.log('Connected to OpenAI Realtime API for conference');
            setTimeout(initializeSession, 100);
        });
        
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                
                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`OpenAI event: ${response.type}`);
                }
                
                // Handle audio from OpenAI
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
                    console.log('Speech detected in conference');
                    handleSpeechStartedEvent();
                }
                
                // Log transcripts for debugging
                if (response.type === 'response.audio_transcript.done') {
                    console.log('AI said:', response.transcript);
                }
                
            } catch (error) {
                console.error('Error processing OpenAI message:', error);
            }
        });
        
        // Handle messages from Twilio conference
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                
                switch (data.event) {
                    case 'media':
                        // Conference audio to OpenAI
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
                        conferenceState.aiStreamSid = streamSid;
                        console.log('Conference stream started:', streamSid);
                        
                        responseStartTimestampTwilio = null;
                        latestMediaTimestamp = 0;
                        break;
                        
                    case 'stop':
                        console.log('Conference stream stopped');
                        break;
                        
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                        
                    default:
                        console.log('Conference event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing conference message:', error);
            }
        });
        
        // Clean up on disconnect
        connection.on('close', () => {
            if (openAiWs.readyState === WebSocket.OPEN) {
                openAiWs.close();
            }
            console.log('Conference stream disconnected - AI Bot left');
            conferenceState.aiStreamSid = null;
        });
        
        openAiWs.on('close', () => {
            console.log('Disconnected from OpenAI');
        });
        
        openAiWs.on('error', (error) => {
            console.error('OpenAI WebSocket error:', error);
        });
    });
});

// Start server
fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Conference server with AI bot running on port ${PORT}`);
    console.log(`Webhook URL: https://YOUR_NGROK_URL.ngrok-free.app/voice`);
});