
// AudioStream.tsx

// captures audio from the user's microphone
// sends the audio to the backend via websocket (using the correct sessionId)
// Does NOT display anything visually

// steps:
// 1. waits until a sessionId is provided (knows what "room" to stream to)
// 2. Opens a WebSocket connection to the backend server with the sessionId as a query parameter
// 3. Requests microphone access from the user
// 4. Captures audio from the microphone in small chunks (250ms)
// 5. Sends each audio chunk to the WebSocket server
// 6. Cleans up (disconnects WebSocket) when the component unmounts or session changes




'use client'; // tell Next.js that the component runs in the browser not on the server (websocket)

import { useEffect, useRef } from 'react'; // Effect: run code after the component loads, Ref: stores the websocket

  // React component that takes session Id, used to identify room/session
export default function AudioStream({ sessionId }: { sessionId: string }) { 
  // sets up persistent reference to the WebSocket connection, so it doesn't get recreated on every render
  const wsRef = useRef<WebSocket | null>(null); 


  // connect to websocket @ws, include sessionId as a query parameter, so the server knows which session/room this user belongs to
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3001/api/ws?sessionId=${sessionId}`); //will have to change to server when deployed
      wsRef.current = ws; // stores the WebSocket instance in the ref, so it can be accessed later

      // log when connection opens
      ws.onopen = () => {
        console.log('🎧🚣‍♂️🖥️ WebSocket connected for audio stream');
      };

      // log when connection closes
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event);
      };
      // log any errors that occur
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
