// displays a form for initiating a call (PhoneInputForm)
// shows the current call status (CallStatus) once a session is created
// contains a centered layout with a logo and footer
// uses Tailwind CSS for styling
// uses React hooks for state management

'use client';

import CallInterface from './components/CallInterface';
import PhoneInputForm from './components/PhoneInputForm';
import CallStatus from './components/CallStatus';
import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <>
      {/* Background image div */}
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center filter blur-sm"
        style={{ backgroundImage: "url('/zeus-background.jpg')" }}
      />

      {/* Main content with translucent background and blur */}
      <main className="flex min-h-screen flex-col bg-white/40 backdrop-blur-sm p-8 relative z-0">
        {/* Content container - grows and centers content */}
        <div className="flex flex-col items-center justify-center flex-grow">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="Company Logo"
            width={100}
            height={100}
            className="mb-4"
          />

          <h1 className="text-3xl font-bold mb-6"> 🤖 AI Sales Call Assistant</h1>

          {!sessionId && <PhoneInputForm onSessionCreated={setSessionId} />}

          {sessionId && <CallStatus sessionId={sessionId} />}
        </div>

        {/* Footer stays at bottom */}
        <footer className="text-black-600 text-sm text-center pt-8">
          © 2025 Zeus Packaging Group
        </footer>
      </main>
    </>
  );
}
