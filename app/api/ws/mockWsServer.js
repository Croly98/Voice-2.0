// ai made this for testing
// TESTING PROGRESS: Completed and successful
// frontend can connect to WebSocket, send audio, and receive audio.
// This mock server now:
// - saves incoming binary audio chunks from the client microphone

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Start WebSocket server on port 3001
const wss = new WebSocket.Server({ port: 3001 });
console.log('🖥️ Mock WebSocket server running on ws://localhost:3001');

// Directory to save incoming recordings
const saveDir = path.resolve(__dirname, 'saved_audio');
if (!fs.existsSync(saveDir)) {
  fs.mkdirSync(saveDir);
}

// Handle client connections
wss.on('connection', (ws) => {
  console.log('🔗 Client connected');

  // Generate unique filename for this session
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(saveDir, `recording-${timestamp}.webm`);
  console.log(`📁 Saving incoming audio to: ${filePath}`);

  ws.on('message', (message) => {
    console.log(`📥 Received message of length: ${message.length}`);
    console.log('📦 Message type:', typeof message);

    if (Buffer.isBuffer(message)) {
      console.log('✅ Binary audio chunk received');

      // Save incoming audio to file incrementally
      fs.appendFile(filePath, message, (err) => {
        if (err) {
          console.error('❌ Error saving audio chunk:', err);
        } else {
          console.log('💾 Audio chunk saved');
        }
      });

    } else {
      console.log('⚠️ Received non-binary message:', message.toString());
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
  });
});
