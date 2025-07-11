// app/api/ws/route.ts

// ... existing imports and setup ...

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost:3001');
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.close(1008, 'Missing sessionId');
      return;
    }

    sessions[sessionId] = sessions[sessionId] || [];
    sessions[sessionId].push(ws);

    console.log(`Client joined session: ${sessionId}`);

    // Receiving audio message from client
    ws.on('message', async (message: Buffer) => {
      // --- Step 2.1: Log received audio message details ---
      console.log(`🟢 Received audio message (${message.length} bytes)`);
      const preview = message.subarray(0, 10).toString('hex');
      console.log(`🔍 Audio preview (first 10 bytes in hex): ${preview}`);

      try {
        const transcript = await transcribeMP3(message); // transcribe audio buffer to text
        if (!transcript) return;

        const aiReply = await getAIResponse(transcript); // get AI response from OpenAI
        const audioBuffer = await synthesizeSpeech(aiReply); // convert AI text response to audio

        // Send audio back only to the sender if connection is still open
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(audioBuffer);
        }
      } catch (err) {
        console.error('Error processing audio message:', err);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: 'Processing failed' }));
        }
      }
    });

    // Closing and error handlers
    ws.on('close', () => {
      sessions[sessionId] = (sessions[sessionId] || []).filter((client) => client !== ws);
      if (sessions[sessionId].length === 0) {
        delete sessions[sessionId];
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error in session ${sessionId}:`, err);
    });
  });
}
