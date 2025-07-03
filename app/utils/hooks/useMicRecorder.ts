// hooks/useMicRecorder.ts
// made with AI for testing

// when I got to http://localhost:3000(or3001)/voice-test "Client Connected" is shown

import { useState, useRef } from 'react';

const useMicRecorder = (sendAudio: (data: ArrayBuffer) => void) => {
  console.log('useMicRecorder function called');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    // Guard to check if we're in a browser and mediaDevices API is available
    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      console.error('MediaDevices API not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          event.data.arrayBuffer().then((buffer) => {
            sendAudio(buffer); // Send to backend WebSocket
          });
        }
      };

      mediaRecorder.start(200); // Send audio every 200ms
    } catch (err) {
      console.error('🎤 Mic access error:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  console.log('useMicRecorder module loaded');

  return { isRecording, startRecording, stopRecording };
};

export default useMicRecorder;
