/**
 * CallStatus.tsx
 * 
 * React component that displays the current status of the call.
 * Shows messages like "Calling..., "Connected", "Customer responded", will this be variables?
 * Used to keep the sales rep informed about what's happening in real-time. - not sure how to do this yet
 */

import React, { useEffect, useState } from 'react';

// Allows this component to be reused with different phone numbers
interface CallStatusProps {
  phoneNumber: string;
}

const CallStatus: React.FC<CallStatusProps> = ({ phoneNumber }) => {
  // State to store status updates for the current call session
  const [statuses, setStatuses] = useState<string[]>([]);

  /**
   * Simulated effect for receiving real-time call status updates.
   * THIS WILL BE CHANGED WITH WEB SOCKETS OR POLLING IN A REAL APP.
   * In a real-world implementation:
   * - This could be replaced with WebSocket logic to listen to events
   *   from the backend in real time.
   * - Alternatively, we could poll a `/status` endpoint every few seconds
   *   to get the latest call state.
   */
  useEffect(() => {
    if (!phoneNumber) return;

    // Simulated list of status updates for demonstration purposes (for testing, this will change)
    const simulatedUpdates = [
      'Call initiated',
      'Dialing customer...',
      'Customer picked up',
      'AI is speaking...',
      'AI is listening...',
      'Call ended',
    ];

    // Delay sending updates one at a time for a real-time feel
    let i = 0;
    const interval = setInterval(() => {
      if (i < simulatedUpdates.length) {
        // Append new status to the log
        setStatuses(prev => [...prev, simulatedUpdates[i]]);
        i++;
      } else {
        clearInterval(interval); // Stop after last update
      }
    }, 1500); // 1.5 seconds between status updates

    // Cleanup function to prevent memory leaks
    return () => clearInterval(interval);
  }, [phoneNumber]);

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
      {statuses.length === 0 && <p> 📞 Waiting for call status updates...</p>}
    </div>
  );
};

export default CallStatus;


//Right now, we're faking the call status updates using hardcoded data and a timer.

//But later, we’ll replace this part with real-time updates
//Either using WebSocket (ideal for real-time apps) or by polling an API route like /api/status for the latest call info."

