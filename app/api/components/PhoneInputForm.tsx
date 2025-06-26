/**
 * PhoneInputForm.tsx
 *
 * React component with a form that allows a sales rep to input a customer's phone number easily.
 * On submit, it triggers the backend API to start a phone call to that number.
 * Handles form validation and UI for phone input.
 */

import React, { useState, useRef, useEffect } from 'react'; // Import React and hooks

// Regex to validate international phone numbers.
//
// Explanation:
// /^          : start of string
// \+?         : optional '+' character at the start (i am guessing this we will call mobile numbers as well)
// [1-9]       : first digit must be 1-9 (no leading zeros)
// \d{1,14}    : followed by 1 to 14 digits (0-9)
// $/          : end of string
//
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const PhoneInputForm: React.FC = () => {
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
      setMessage('Please enter a valid international phone number, e.g. +353...');
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

      if (res.ok) {
        setMessage('✅ Call initiated successfully!');
      } else {
        const data = await res.json();
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
          border: '1px solid #ccc',
          borderRadius: '4px',
        }}
      />
      <small id="phoneHelp" style={{ display: 'block', marginBottom: '8px', color: '#666' }}>
        Enter phone number in international format (e.g. +1234567890)
      </small>
      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: loading ? '#ccc' : '#007bff',
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
