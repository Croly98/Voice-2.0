/**
 * // TEMPORARY / TESTING COMPONENT
// This file/component is currently used for testing and development purposes only.
// It will be removed once the call interface and flow are fully implemented and stable.
// Remember to delete this file and all its references when done.

 * 
 * PhoneInputForm.tsx
 *
 * React component with a form that allows a sales rep to input a customer's phone number easily.
 * On submit, it triggers the backend API to start a phone call to that number.
 * Handles form validation and UI for phone input.
 */

// TEMPORARY / TESTING COMPONENT
// This component handles phone input and call initiation for testing.
// It should be deleted or replaced when integrating the final production components.


import React, { useState, useRef, useEffect } from 'react';

interface PhoneInputFormProps {
  onSessionCreated: (sessionId: string) => void;
  onPhoneNumberEntered: (phoneNumber: string) => void; // new prop
}

// Regex to validate international phone numbers.
//
// Explanation:
// /^          : start of string
// \+?         : optional '+' character at the start (has to be + later on)
// [1-9]       : first digit must be 1-9 (no leading zeros)
// \d{1,14}    : followed by 1 to 14 digits (0-9)
// $/          : end of string
//
const phoneRegex = /^\+[1-9]\d{1,14}$/;

const PhoneInputForm: React.FC<PhoneInputFormProps> = ({ onSessionCreated, onPhoneNumberEntered }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input when the component mounts (improves UX)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handles form submission from the sales rep
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPhone = phone.trim();

    // Validate phone number format using regex
    if (!phoneRegex.test(trimmedPhone)) {
      setMessage('Enter a valid international phone number, e.g. +353...');
      return;
    }

    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: trimmedPhone }),
      });

      const data = await res.json();

      if (res.ok && data.sessionId) {
        setMessage('✅ Call initiated successfully!');
        onPhoneNumberEntered(trimmedPhone);  // Pass phone number to parent
        onSessionCreated(data.sessionId);     // Pass session ID to parent
      } else {
        setMessage(data.error || '❌ Failed to start call. Check the number or connection.');
      }
    } catch (error: any) {
      setMessage('⚠️ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <label htmlFor="phone">Customer Phone Number</label>
      <input
        id="phone"
        type="tel"
        ref={inputRef}
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="+353861234567"
        required
        aria-describedby="phoneHelp"
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '4px',
          border: '1px solid black',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      />
      <small id="phoneHelp" style={{ display: 'block', marginBottom: '8px', color: 'black' }}>
        Enter phone number in international format (e.g. +353861790710)
      </small>
      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: '12px',
          padding: '10px 12px',
          width: '30%',
          backgroundColor: loading ? '#ccc' : '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Calling...' : 'Start Call'}
      </button>
      {message && (
        <p role="alert" style={{ marginTop: '10px', color: message.startsWith('✅') ? 'green' : 'red' }}>
          {message}
        </p>
      )}
    </form>
  );
};

export default PhoneInputForm;
