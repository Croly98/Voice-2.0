/**
 * CallStatus.tsx
 * 
 * React component that displays the current status of the call.
 * Shows messages like "Calling", "Connected", "Customer responded".
 * These will be variables updated in real-time.
 * Used to keep the sales rep informed about what's happening in real-time.
 */

import React, { useEffect, useState } from 'react';

// Allows this component to be reused with different phone numbers
interface CallStatusProps {
  phoneNumber: string;
  liveStatusUpdate?: string; // Real-time update (optional prop)
  simulate?: boolean;        // Toggle simulation mode for testing/demo
}

const CallStatus: React.FC<CallStatusProps> = ({ phoneNumber, liveStatusUpdate, simulate = false }) => {
  // State to store status updates for the current call session
  const [statuses, setStatuses] = useState<string[]>([]);

  /**
   * Simulation for demo purposes only.
   * This will be replaced with real-time updates passed from WebRTC or another logic source.
   */
  useEffect(() => {
    if (!simulate || !phoneNumber) return;

    const simulatedUpdates = [
      'Call initiated',
      'Dialing customer...',
      'Customer picked up',
      'AI is speaking...',
      'AI is listening...',
      'Call ended',
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < simulatedUpdates.length) {
        setStatuses(prev => [...prev, simulatedUpdates[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [simulate, phoneNumber]);

  /**
   * Accepts new status messages passed in via props
   * For use with real-time events (e.g., from WebRTC callbacks)
   */
  useEffect(() => {
    if (liveStatusUpdate) {
      setStatuses(prev => [...prev, liveStatusUpdate]);
    }
  }, [liveStatusUpdate]);

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Call Status</h2>
      {/* Show phone number being tracked */}
      <p>
        <strong>Tracking call for:</strong> {phoneNumber || 'No number entered yet'}
      </p>

      {/* Status updates list */}
      <ul style={{ paddingLeft: '20px' }}>
        {statuses.map((status, index) => (
          <li key={index} style={{ marginBottom: '4px' }}>
            ✅ {status}
          </li>
        ))}
      </ul>

      {/* If no statuses yet, show a placeholder */}
      {statuses.length === 0 && <p>📞 Waiting for call status updates...</p>}
    </div>
  );
};

export default CallStatus;

// Right now, we're faking the call status updates using hardcoded data and a timer.
// But later, we’ll replace this part with real-time updates,
// Either using WebSocket, polling, or passed directly from WebRTC logic.
// This will allow the sales rep to see live updates as the call progresses.
