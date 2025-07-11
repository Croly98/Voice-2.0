// VoiceRecorder.tsx
// Test UI component for voice streaming
// Provides a simple UI to start/stop mic capture and send audio to WebSocket
// Depends on useWebSocket hook for all backend communication

'use client';

import React, { useState } from 'react';
import useWebSocket from '../utils/hooks/useWebSocket';

interface VoiceRecorderProps {
  sessionId: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ sessionId }) => {
  const { audioData, startRecording, stopRecording } = useWebSocket(sessionId);
  const [isRecording, setIsRecording] = useState(false);

  const handleStart = () => {
    startRecording();
    setIsRecording(true);
  };

  const handleStop = () => {
    stopRecording();
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col items-start space-y-2">
      <button
        onClick={handleStart}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        disabled={isRecording}
      >
        Start Recording
      </button>

      <button
        onClick={handleStop}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        disabled={!isRecording}
      >
        Stop Recording
      </button>

      <p className="text-sm mt-2 text-gray-600">
        Latest audio buffer: {audioData ? `${audioData.byteLength} bytes` : 'None yet'}
      </p>
    </div>
  );
};

export default VoiceRecorder;
