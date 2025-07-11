// useWebSocket.ts
// Custom React hook to handle WebSocket connection and audio streaming
// Manages:
// 1. Connection to WebSocket backend (e.g. ws://localhost:3001)
// 2. Sending/receiving audio buffers
// 3. Playing audio via useAudioPlayer hook

import { useEffect, useRef, useState } from 'react';
import useAudioPlayer from './useAudioPlayer';

const useWebSocket = (sessionId: string | null) => {
  const { playAudioBuffer } = useAudioPlayer();

  const socketRef = useRef<WebSocket | null>(null);       // Store persistent socket reference
  const recorderRef = useRef<MediaRecorder | null>(null); // Native browser audio recorder
  const streamRef = useRef<MediaStream | null>(null);     // Audio stream from mic

  const [audioData, setAudioData] = useState<ArrayBuffer | null>(null); // For UI display/debug

  // Connect to WebSocket when session ID changes
  useEffect(() => {
    if (!sessionId) return;

    const socket = new WebSocket(`ws://localhost:3001?sessionId=${sessionId}`);
    socketRef.current = socket;
    socket.binaryType = 'arraybuffer'; // Expect binary audio data

    // Handle incoming messages (audio)
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        setAudioData(event.data);        // Save for debugging/UI
        playAudioBuffer(event.data);     // Play received audio
      } else {
        console.log('⚠️ Received non-audio message:', event.data);
      }
    };

    socket.onerror = (event) => {
      console.error('WebSocket error:', event);
    };

    socket.onclose = () => {
      console.log('❌ WebSocket closed');
      // stopRecording(); // Optional: leave commented out if you want manual control
    };

    // Cleanup when component unmounts or sessionId changes
    return () => {
      socket.close();
      stopRecording(); // Safely shut down mic and recording
      socketRef.current = null;
    };
  }, [sessionId, playAudioBuffer]);

  // Start capturing and sending audio using MediaRecorder
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      // Every 250ms, send a chunk of audio to server
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(event.data);
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      console.log('🎙️ Recording started');
    } catch (err) {
      console.error('❌ Failed to start mic:', err);
    }
  };

  // Stop recording and release resources
  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    recorderRef.current = null;
    console.log('🛑 Recording stopped');
  };

  // Send raw audio data (e.g., from useMicRecorder)
  const sendAudio = (audioData: ArrayBuffer) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioData);
    }
  };

  return {
    audioData,
    sendAudio,
    startRecording,
    stopRecording,
  };
};

export default useWebSocket;
