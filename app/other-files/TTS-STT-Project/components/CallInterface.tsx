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
 * CallInterface.tsx
 *
 * Main UI for handling a live call session.
 * Sales agent sees real-time updates and hears AI responses.
 * Will support microphone input and audio playback.
 */

import React, { useEffect, useState } from 'react';
import CallStatus from './CallStatus'; // 
import useWebSocket  from '../utils/hooks/useWebSocket'; // 
import useAudioPlayer from '../utils/hooks/useAudioPlayer'; // 

const CallInterface: React.FC<{ sessionId: string; phoneNumber: string }> = ({ sessionId, phoneNumber }) => {
  const [status, setStatus] = useState<string | undefined>('Call started...');
  const { audioData, sendAudio } = useWebSocket(sessionId);
  const { playAudioBuffer } = useAudioPlayer();

  // Play AI response when audio is received
  useEffect(() => {
    if (audioData) {
      setStatus('AI is speaking...');
      playAudioBuffer(audioData);
    }
  }, [audioData]);

  // Dummy test button to simulate sending audio later
  const handleTestSend = async () => {
    const testAudio = await fetch('/test/test.mp3'); // place test.mp3 in public/test/
    const buffer = await testAudio.arrayBuffer();
    sendAudio(buffer);
    setStatus('Sending test audio...');
  };
// button not working, tested .mp3 another way
  return (
    <div>
      <h1>Live Call Interface</h1>

      <button onClick={handleTestSend}>📧 Send Test Audio to Server</button>

      <CallStatus phoneNumber={phoneNumber} liveStatusUpdate={status} />
    </div>
  );
};

export default CallInterface;
