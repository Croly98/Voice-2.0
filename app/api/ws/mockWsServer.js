// ai made this for testing
// can leave for now but will delete later
// TESTING PROGRESS: Completed and succesful-
// frontend can connect to a WebSocket server.
// It can send a message (like audio or command).
// It can receive audio data back (test.mp3).
// play or handle this audio response in the frontend.

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Create a WebSocket server on port 3001
const wss = new WebSocket.Server({ port: 3001 });

console.log('Mock WebSocket server running on ws://localhost:3001');

// Adjust this path based on your mockWsServer.js location
const testAudioPath = path.resolve(__dirname, '..', '..', '..', 'public', 'test', 'test.mp3');

console.log('Looking for test.mp3 at:', testAudioPath);

let testAudioBuffer = null;

// Load test audio into memory
fs.readFile(testAudioPath, (err, data) => {
  if (err) {
    console.error('❌ Failed to load test.mp3:', err);
  } else {
    testAudioBuffer = data;
    console.log('✅ Loaded test.mp3 into buffer');
  }
});

// Handle incoming client connections
wss.on('connection', (ws) => {
  console.log('🔗 Client connected');

  // When client sends a message (e.g. mic audio)
  ws.on('message', (message) => {
    console.log(`📥 Received message of length: ${message.length}`);
    
    // DEBUG: Is it a Buffer? (binary audio)
    console.log('📦 Message type:', typeof message);
    if (Buffer.isBuffer(message)) {
      console.log('✅ Confirmed binary audio chunk');

      // Optional: Save incoming audio chunk for testing
      const tempPath = path.resolve(__dirname, 'last_audio_chunk.webm');
      fs.writeFile(tempPath, message, (err) => {
        if (err) console.error('❌ Error writing incoming audio to file:', err);
        else console.log(`📝 Saved incoming audio to: ${tempPath}`);
      });
    } else {
      console.log('⚠️ Received non-binary message:', message.toString());
    }

    // Respond to client with test.mp3 buffer
    if (testAudioBuffer) {
      ws.send(testAudioBuffer);
      console.log('📤 Sent test audio buffer back to client');
    } else {
      ws.send('No test audio loaded');
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});
