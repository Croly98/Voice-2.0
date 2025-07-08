// ws/voice-ws-server.js
// for testing
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Create basic HTTP server to attach WebSocket to
const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log('✅ WebSocket server initialized...');

wss.on('connection', (ws, req) => {
  console.log('📞 Twilio stream connected');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.event === 'start') {
        console.log(`📡 Start stream from: ${parsed.streamSid}`);
      } else if (parsed.event === 'media') {
        // The audio is base64-encoded mulaw (8000hz, mono)
        const audio = Buffer.from(parsed.media.payload, 'base64');
        console.log(`🎧 Received audio chunk (${audio.length} bytes)`);
        // You could write to a file or buffer here if needed
      } else if (parsed.event === 'stop') {
        console.log(`🛑 Stream ended: ${parsed.streamSid}`);
      }
    } catch (err) {
      console.error('❌ Error parsing message:', err);
    }
  });

  // Optional: play a test audio file back (must be base64 mulaw .wav)
  // Just for testing - Twilio only accepts raw audio via <Play>, not WebSocket back
  // So this part is commented for now

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
});

// Start on port 3001 (or whatever you want)
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server listening on ws://localhost:${PORT}`);
});
