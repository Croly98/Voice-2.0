/**
 * CallStatus.tsx
 * 
 * React component that displays the current status of the call.
 * Shows messages like "Calling", "Connected", "Customer responded".
 * These will be variables updated in real-time.
 * Used to keep the sales rep informed about what's happening in real-time.
 */

import React, { useEffect, useState } from 'react';
import useAudioPlayer from '..//hooks/useAudioPlayer'; // 🎧 Import the audio hook

// Allows this component to be reused with different phone numbers
interface CallStatusProps {
  phoneNumbers: { sales: string; ai: string; customer: string };
  liveStatusUpdate?: string; // Real-time update (optional prop)
  simulate?: boolean;        // Toggle simulation mode for testing/demo
  onEndCall: () => void;     // Callback to end the call
}

const CallStatus: React.FC<CallStatusProps> = ({ phoneNumbers, liveStatusUpdate, simulate = false, onEndCall }) => {
  // State to store status updates for each call session
  const [statuses, setStatuses] = useState<Record<string, string[]>>({
    sales: [],
    ai: [],
    customer: [],
  });

  // 🎧 Setup audio player
  const { playAudioBuffer } = useAudioPlayer();

  // 🎧 Create WebSocket connection and listen for audio (Customer only for now)
  useEffect(() => {
    if (!phoneNumbers.customer || simulate) return;

    const sessionId = phoneNumbers.customer; // You can customize how sessionId is derived
    const socket = new WebSocket(`ws://localhost:3001?sessionId=${sessionId}`);

    socket.onmessage = async (event) => {
      if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
        const arrayBuffer = event.data instanceof Blob
          ? await event.data.arrayBuffer()
          : event.data;

        await playAudioBuffer(arrayBuffer); // 🎧 Play the audio reply
        setStatuses(prev => ({
          ...prev,
          customer: [...prev.customer, 'AI responded with audio'],
        }));
      } else {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            console.warn('AI response error:', msg.error);
            setStatuses(prev => ({
              ...prev,
              customer: [...prev.customer, `⚠️ AI Error: ${msg.error}`],
            }));
          }
        } catch {
          console.log('Received unknown message:', event.data);
        }
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setStatuses(prev => ({
        ...prev,
        customer: [...prev.customer, '⚠️ WebSocket error occurred'],
      }));
    };

    return () => {
      socket.close();
    };
  }, [phoneNumbers.customer, simulate, playAudioBuffer]);

  /**
   * Simulation for demo purposes only.
   */
  useEffect(() => {
    if (!simulate) return;

    const simulatedUpdates = [
      'Call initiated',
      'Dialing...',
      'Connected',
      'AI is speaking...',
      'AI is listening...',
      'Call ended',
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < simulatedUpdates.length) {
        setStatuses(prev => ({
          sales: [...prev.sales, simulatedUpdates[i]],
          ai: [...prev.ai, simulatedUpdates[i]],
          customer: [...prev.customer, simulatedUpdates[i]],
        }));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [simulate, phoneNumbers]);

  /**
   * Accepts new status messages passed in via props
   */
  useEffect(() => {
    if (liveStatusUpdate) {
      setStatuses(prev => ({
        ...prev,
        customer: [...prev.customer, liveStatusUpdate],
      }));
    }
  }, [liveStatusUpdate]);

  /**
   * Handles ending the call
   */
  const handleEndCall = () => {
    setStatuses({ sales: [], ai: [], customer: [] }); // clear all statuses
    onEndCall(); // notify parent to reset session & phone numbers
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Call Status</h2>

      {/* Show phone numbers being tracked */}
      <p><strong>Sales:</strong> {phoneNumbers.sales || 'Not set'}</p>
      <p><strong>AI Bot:</strong> {phoneNumbers.ai || 'Not set'}</p>
      <p><strong>Customer:</strong> {phoneNumbers.customer || 'Not set'}</p>

      {/* Status updates for each party */}
      <div style={{ marginTop: '1rem' }}>
        <h3>Sales Updates</h3>
        <ul style={{ paddingLeft: '20px' }}>
          {statuses.sales.map((status, index) => (
            <li key={`sales-${index}`} style={{ marginBottom: '4px' }}>✅ {status}</li>
          ))}
        </ul>
        {statuses.sales.length === 0 && <p>📞 Waiting for sales call status...</p>}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3>AI Bot Updates</h3>
        <ul style={{ paddingLeft: '20px' }}>
          {statuses.ai.map((status, index) => (
            <li key={`ai-${index}`} style={{ marginBottom: '4px' }}>🤖 {status}</li>
          ))}
        </ul>
        {statuses.ai.length === 0 && <p>📞 Waiting for AI call status...</p>}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3>Customer Updates</h3>
        <ul style={{ paddingLeft: '20px' }}>
          {statuses.customer.map((status, index) => (
            <li key={`cust-${index}`} style={{ marginBottom: '4px' }}>📱 {status}</li>
          ))}
        </ul>
        {statuses.customer.length === 0 && <p>📞 Waiting for customer call status...</p>}
      </div>

      {/* End Call button */}
      <button
        onClick={handleEndCall}
        style={{
          marginTop: '20px',
          padding: '10px 16px',
          backgroundColor: '#dc3545',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        🛑 End Call
      </button>
    </div>
  );
};

export default CallStatus;
