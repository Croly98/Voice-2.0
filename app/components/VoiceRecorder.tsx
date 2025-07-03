'use client';
import React from 'react';
import useMicRecorder from '../utils/hooks/useMicRecorder';
import useWebSocket from '../utils/hooks/useWebSocket';

interface VoiceRecorderProps {
  sessionId: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ sessionId }) => {
  const { sendAudio } = useWebSocket(sessionId);
  const { startRecording, stopRecording, isRecording } = useMicRecorder(sendAudio);

  return (
    <div className="flex flex-col items-start space-y-2">
      <button
        onClick={startRecording}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        disabled={isRecording}
      >
        Start Recording
      </button>
      <button
        onClick={stopRecording}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        disabled={!isRecording}
      >
        Stop Recording
      </button>
    </div>
  );
};

export default VoiceRecorder;
