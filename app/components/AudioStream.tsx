




'use client'; // tell Next.js that the component runs in the browser not on the server (websocket)

import { useEffect, useRef } from 'react'; // Effect: run code after the component loads, Ref: stores the websocket

export default function AudioStream({ sessionId }: { sessionId: string }) { 
  // React component that takes session Id, used to identify room/session
  const wsRef = useRef<WebSocket | null>(null); 
  // sets up persistent reference to the WebSocket connection, so it doesn't get recreated on every render

  // connect to websocket @ws, include sessionId as a query parameter, so the server knows which session/room this user belongs to
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3000/api/ws?sessionId=${sessionId}`);
      wsRef.current = ws; // stores the WebSocket instance in the ref, so it can be accessed later

      // log when connection opens
      ws.onopen = () => {
        console.log('🎧🚣‍♂️🖥️ WebSocket connected for audio stream');
      };

      // log when connection closes
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onmessage = (event) => {
        // Handle incoming audio (TTS) later
        console.log('Received message from server:', event.data);
      };
    };

    // Start microphone stream and send audio data to the WebSocket server
    const startMicStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream); // record mic in small chunks

        // when chunk is ready sends chunk to the WebSocket, this is HOW we stream audio
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(event.data);
          }
        };

        mediaRecorder.start(250); // Send audio chunks every 250ms
      } catch (err) {
        console.error('Error accessing microphone:', err);
      }
    };

    // after component renders...
    connectWebSocket(); // opens the WebSocket connection // assign connection to a ref (wsRef.current) so you can use it later to send audio
    startMicStream(); // Asks the browser for microphone access using navigator.mediaDevices.getUserMedia

    // closes the WebSocket connection when the component unmounts (if it's still open)
    return () => {
      wsRef.current?.close();
    };
  }, [sessionId]);

  return null;
}
