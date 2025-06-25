/**
 * PhoneInputForm.tsx
 * 
 * React component with a form that allows a sales rep to input a customer's phone number easily.
 * mabye we can see about adding multiple numbers if the customer disconnects the call?
 * On submit, it triggers the backend API to start a call to that number.
 * Handles form validation and UI for phone input.
 */

import React, { useState } from 'react'; // Import React and useState hook for managing component state

const PhoneInputForm: React.FC = () => {
  // State to store the phone number input by the user
  const [phone, setPhone] = useState('');

  // Loading state to disable the button and show progress
  const [loading, setLoading] = useState(false);

  // Message state for showing feedback (success, error, validation messages)
  const [message, setMessage] = useState('');

  /**
   * Regex to validate international phone numbers.
   * 
   * Explanation:
   * /^          : start of string
   * \+?         : optional '+' character at the start (i am guessing this we will call mobile numbers as well)
   * [1-9]       : first digit must be 1-9 (no leading zeros)
   * \d{1,14}    : followed by 1 to 14 digits (0-9)
   * $/          : end of string
   */
   /* might change this so you can enter in the country code and then the number, possibly need a plug in*/

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  // Handles form submission from the sales rep
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate phone number format using regex
    if (!phoneRegex.test(phone)) {
      setMessage('Please enter a valid international phone number, e.g. +353...');
      return; // Do not proceed if invalid phone number
    }

    // Reset messages and set loading to true to disable button
    setMessage('');
    setLoading(true);

    try {
      // Call backend API to start the call
      const res = await fetch('/api/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }), // send phone number in request body
      });

      // Check if response is OK (status code 200-299 which means success)
      if (res.ok) {
        setMessage('Call initiated successfully!'); 
      } else {
        setMessage('Failed to start call. Please try again.'); // code 400-599
      }
    } catch (error: any) {
      // Catch network or unexpected errors
      setMessage('Error: ' + error.message);
    } finally {
      // Always reset loading state after request completes
      setLoading(false);
    }
  };

  // Render the form with input for phone number and submit button
  // Includes basic styling for easy use and readability
  // if i want I can add better css styling later

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <label htmlFor="phone">Customer Phone Number</label>
      <input
        id="phone"
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="+353861234567" // Example placeholder in international format
        required
        aria-describedby="phoneHelp"
        style={{ width: '100%', padding: '8px', marginTop: '4px' }}
      />
      <small id="phoneHelp" style={{ display: 'block', marginBottom: '8px', color: '#666' }}>
        Enter phone number in international format (e.g. +1234567890)
      </small>
      <button type="submit" disabled={loading} style={{ marginTop: '12px' }}>
        {loading ? 'Calling...' : 'Start Call'}
      </button>
      {message && <p role="alert" style={{ marginTop: '10px' }}>{message}</p>}
    </form>
  );
};

export default PhoneInputForm;
