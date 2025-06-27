'use client'; // tell Next.js that the component runs in the browser not on the server (websocket)

import { useEffect, useRef } from 'react';

export default function AudioStream({ sessionId }: { sessionId: string }) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3000/api/ws?sessionId=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🎧🚣‍♂️🖥️ WebSocket connected for audio stream');
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onmessage = (event) => {
        // Handle incoming audio (TTS) later
        console.log('Received message from server:', event.data);
      };
    };

    const startMicStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(event.data);
        }
      };

      mediaRecorder.start(250); // Send audio chunks every 250ms
    };

    connectWebSocket();
    startMicStream();

    return () => {
      wsRef.current?.close();
    };
  }, [sessionId]);

  return null; // No UI yet
}
