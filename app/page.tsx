'use client';

import PhoneInputForm from './components/PhoneInputForm';
import CallStatus from './components/CallStatus';
import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-100">
      {/* Logo */}
      <Image 
        src="/logo.png" 
        alt="Company Logo" 
        width={100} 
        height={100} 
        className="mb-4"
      />

      <h1 className="text-3xl font-bold mb-6">AI Sales Call Assistant</h1>

      {!sessionId && (
        <PhoneInputForm onSessionCreated={setSessionId} />
      )}

      {sessionId && (
        <CallStatus sessionId={sessionId} />
      )}
    </main>
  );
}
