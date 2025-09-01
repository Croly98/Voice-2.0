/**
 * 
 * TESTING IS BEING USED
 * 
 * Used useWebSocket()
 * To connect with the backend WebSocket using a sessionId
 * To call sendAudio() when mic input is ready
 * Automatically plays audio when server replies
 * 
 * 
 * 
 /**
 * CallInterface.tsx
 *
 * Main UI for handling a live call session.
 * Sales agent sees real-time updates and hears AI responses.
 * Supports microphone input and audio playback via hooks.
 */

import React, { useEffect, useState } from 'react';
import CallStatus from './CallStatus';
import useWebSocket from 'app/api/ws/hooks/useWebSocket';
import useAudioPlayer from 'app/api/ws/hooks/useAudioPlayer';

interface CallInterfaceProps {
  sessionId: string;
  phoneNumbers: { sales: string; ai: string; customer: string };
}

const CallInterface: React.FC<CallInterfaceProps> = ({ sessionId, phoneNumbers }) => {
  const [status, setStatus] = useState<string>('Call started...');
  const { audioData } = useWebSocket(sessionId);
  const { playAudioBuffer } = useAudioPlayer();

  // Play AI response when audio is received
  useEffect(() => {
    if (audioData) {
      setStatus('AI is speaking...');
      playAudioBuffer(audioData);
    }
  }, [audioData, playAudioBuffer]);

  return (
    <div>
      <h1>Live Call Interface</h1>

      <div style={{ marginTop: '1rem' }}>
        <p><strong>Sales:</strong> {phoneNumbers.sales}</p>
        <p><strong>AI Bot:</strong> {phoneNumbers.ai}</p>
        <p><strong>Customer:</strong> {phoneNumbers.customer}</p>
      </div>

      <CallStatus 
        phoneNumber={phoneNumbers.customer} 
        liveStatusUpdate={status} 
      />
    </div>
  );
};

export default CallInterface;
