// defines a custom React hook that manages a WebSocket connection. 
// It's responsible for the following:

// Connecting to backend websocket (currently localhost)
// listens for messages from the server (audio buffers that the AI responds with)
// Playing Audio - by calling playAudioBuffer() from your useAudioPlayer hook

// useRef - Stores the WebSocket instance between re-renders.
// useEffect - Connects to WebSocket server when sessionId is set.

// Integrated microphone streaming:
// starts mic recording on socket connection
// streams audio to backend (every 250ms)
// Plays audio from backend as before


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

  // Store latest audio buffer received in state so it can be returned
  const [audioData, setAudioData] = useState<ArrayBuffer | null>(null);

  // Store mic recorder so we can stop it when needed
  const recorderRef = useRef<MediaRecorder | null>(null);
  // Store mic MediaStream to properly stop tracks when cleaning up
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // change link once deployed / finished testing (3000 or 3001)
    // const socket = new WebSocket(`ws://localhost:3001?sessionId=${sessionId}`); TESTING OUTSIDE VIRTUAL
    const socket = new WebSocket(`ws://zp-unn01.ad.zeuspackaging.com:3001?sessionId=${sessionId}`);

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

      // Stop recording when socket closes
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      // Stop all tracks in the media stream to release mic
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      recorderRef.current = null;
    };

    // When socket opens, start microphone streaming
    socket.onopen = async () => {
      try {
        // *** FIX: Check if getUserMedia exists before calling ***
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia is not supported in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // connects to webcam / mic audio
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        recorder.ondataavailable = (event) => {
          if (
            event.data.size > 0 &&
            socketRef.current &&
            socketRef.current.readyState === WebSocket.OPEN
          ) {
            socketRef.current.send(event.data);
          }
        };

        recorder.start(250); // send every 250ms
        recorderRef.current = recorder;
        console.log('Microphone recording started');
      } catch (err) {
        console.error('Failed to access microphone:', err);
      }
    };

    // Closing
    // Clean up socket and mic recorder when unmounted or sessionId changes
    return () => {
      socket.close();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      recorderRef.current = null;
      socketRef.current = null;
    };
  }, [sessionId, playAudioBuffer]);

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
