/**
 * // TEMPORARY / TESTING COMPONENT
// This file/component is currently used for testing and development purposes only.
// It will be removed once the call interface and flow are fully implemented and stable.
// Remember to delete this file and all its references when done.

 * 
 * PhoneInputForm.tsx
 *
 * React component with a form that allows a sales rep to input phone numbers easily.
 * On submit, it triggers the backend API to start phone calls to those numbers.
 * Handles form validation and UI for phone input.
 */

// TEMPORARY / TESTING COMPONENT
// This component handles phone input and call initiation for testing.
// It should be deleted or replaced when integrating the final production components.

import React, { useState, useRef, useEffect } from 'react';

interface PhoneInputFormProps {
  onSessionCreated: (sessionId: string) => void;
  onPhoneNumbersEntered: (numbers: { sales: string; ai: string; customer: string }) => void;
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

const PhoneInputForm: React.FC<PhoneInputFormProps> = ({ onSessionCreated, onPhoneNumbersEntered }) => {
  const [sales, setSales] = useState('');
  const [ai, setAi] = useState('');
  const [customer, setCustomer] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the first input when the component mounts (improves UX)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handles form submission from the sales rep
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedSales = sales.trim();
    const trimmedAi = ai.trim();
    const trimmedCustomer = customer.trim();

    // Validate all phone numbers
    if (!phoneRegex.test(trimmedSales) || !phoneRegex.test(trimmedAi) || !phoneRegex.test(trimmedCustomer)) {
      setMessage('Enter valid international phone numbers (e.g. +353...)');
      return;
    }

    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          salesNumber: trimmedSales, 
          aiNumber: trimmedAi, 
          customerNumber: trimmedCustomer 
        }),
      });

      const data = await res.json();

      if (res.ok && data.sessionId) {
        setMessage('✅ Calls initiated successfully!');
        onPhoneNumbersEntered({ sales: trimmedSales, ai: trimmedAi, customer: trimmedCustomer }); // Pass all numbers to parent
        onSessionCreated(data.sessionId); // Pass session ID to parent
      } else {
        setMessage(data.error || '❌ Failed to start calls. Check the numbers or connection.');
      }
    } catch (error: any) {
      setMessage('⚠️ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      {/* Sales number input */}
      <label htmlFor="sales">Sales Phone Number</label>
      <input
        id="sales"
        type="tel"
        ref={inputRef}
        value={sales}
        onChange={e => setSales(e.target.value)}
        placeholder="+353861234567"
        required
        aria-describedby="salesHelp"
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '4px',
          marginBottom: '8px',
          border: '1px solid black',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      />
      <small id="salesHelp" style={{ display: 'block', marginBottom: '12px', color: 'black' }}>
        Enter sales phone number in international format (e.g. +353...)
      </small>

      {/* AI number input */}
      <label htmlFor="ai">AI Bot Phone Number</label>
      <input
        id="ai"
        type="tel"
        value={ai}
        onChange={e => setAi(e.target.value)}
        placeholder="+353861234567"
        required
        aria-describedby="aiHelp"
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '4px',
          marginBottom: '8px',
          border: '1px solid black',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      />
      <small id="aiHelp" style={{ display: 'block', marginBottom: '12px', color: 'black' }}>
        Enter AI bot phone number in international format (e.g. +353...)
      </small>

      {/* Customer number input */}
      <label htmlFor="customer">Customer Phone Number</label>
      <input
        id="customer"
        type="tel"
        value={customer}
        onChange={e => setCustomer(e.target.value)}
        placeholder="+353861234567"
        required
        aria-describedby="customerHelp"
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '4px',
          marginBottom: '8px',
          border: '1px solid black',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}
      />
      <small id="customerHelp" style={{ display: 'block', marginBottom: '12px', color: 'black' }}>
        Enter customer phone number in international format (e.g. +353...)
      </small>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: '12px',
          padding: '10px 12px',
          width: '40%',
          backgroundColor: loading ? '#ccc' : '#28a745',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Calling...' : 'Start Calls'}
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
