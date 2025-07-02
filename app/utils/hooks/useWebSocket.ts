// defines a custom React hook that manages a WebSocket connection. 
// It's responsible for the following:

// Connecting to backend websocket (currently localhost)
// listens for messages from the server (audio buffers that the AI responds with)
// Playing Audio- by calling playAudioBuffer() from your useAudioPlayer hook

// useRef - Stores the WebSocket instance between re-renders.
// UseEffect - Connects to WebSocket server when sessionId is set.

import { useEffect, useRef, useState } from 'react';

// useAudioPlayer - Custom hook that plays audio buffers
import useAudioPlayer from './useAudioPlayer';

/**
 * Hook that manages the WebSocket connection to receive audio from the server
 * and play it using the audio player.
 */
const useWebSocket = (sessionId: string | null) => {
  const { playAudioBuffer } = useAudioPlayer();
  const socketRef = useRef<WebSocket | null>(null);

  // NEW: Store latest audio buffer received in state so it can be returned
  const [audioData, setAudioData] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // change link once deployed / finished testing
    const socket = new WebSocket(`ws://localhost:3001?sessionId=${sessionId}`);
    socketRef.current = socket;

    socket.binaryType = 'arraybuffer';

    // When audio buffer comes in, play it
    // socket.onmessage - Handles incoming audio buffers and plays them using playAudioBuffer
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        setAudioData(event.data);  // NEW: Save audio buffer to state
        playAudioBuffer(event.data);
      } else {
        console.log('Received non-audio message:', event.data);
      }
    };

    socket.onerror = (event) => {
  console.error('WebSocket error event:', event);
  // Sometimes event.target contains the WebSocket with readyState etc.
  if (event && event.target) {
    console.error('WebSocket readyState:', (event.target as WebSocket).readyState);
  }
};

    // Handles connection issues or closed socket.
    socket.onclose = () => {
      console.log('WebSocket closed');
    };

    return () => {
      socket.close();
    };
  }, [sessionId]);

  /**
   * Sends a chunk of audio (recorded from mic) to the backend.
   * Can be triggered later when you hook up the mic.
   */
  const sendAudio = (audioData: ArrayBuffer) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioData);
    }
  };

  // Return the latest audio data received, and the sendAudio function
  return { audioData, sendAudio };
};

export default useWebSocket;
