// defines a custom React hook that manages a WebSocket connection. 
// It's responsible for the following:

// Connecting to backend websocket (currently localhost)
// listens for messages from the server (audio buffers that the AI responds with)
// Playing Audio - by calling playAudioBuffer() from your useAudioPlayer hook

// useRef - Stores the WebSocket instance between re-renders.
// useEffect - Connects to WebSocket server when sessionId is set.

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

    // change link once deployed / finished testing (3000 or 3001)
    const socket = new WebSocket(`ws://localhost:3000?sessionId=${sessionId}`);
    socketRef.current = socket;

    socket.binaryType = 'arraybuffer';

    // socket.onmessage - Handles incoming audio buffers and plays them using playAudioBuffer
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        setAudioData(event.data);  // Save audio buffer to state
        playAudioBuffer(event.data);
      } else {
        console.log('Received non-audio message:', event.data);
      }
    };

    // error handling (updated with AI since next.js did not like original)
    socket.onerror = (event) => {
      console.error('WebSocket error event:', event);

      const target = event?.target as WebSocket | undefined;
      if (target) {
        const stateMap = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.error('WebSocket readyState:', stateMap[target.readyState] || target.readyState);
        console.error('WebSocket URL:', target.url);
      } else {
        console.warn('WebSocket error: unable to identify target socket');
      }
    };

    // Handles connection issues or closed socket.
    socket.onclose = (event) => {
      console.log('WebSocket closed', {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean,
      });
    };

    // Clean up the socket connection when component unmounts or sessionId changes
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
    } else {
      console.warn('WebSocket not open. Unable to send audio.');
    }
  };

  // Return the latest audio data received, and the sendAudio function
  return { audioData, sendAudio };
};

export default useWebSocket;
