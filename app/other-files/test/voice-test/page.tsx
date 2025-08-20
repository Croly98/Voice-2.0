'use client';

import VoiceRecorder from '../../TTS-STT-Project/components/VoiceRecorder';

export default function VoiceTest() {
  const sessionId = 'test-session-123'; // simple const

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">🎙️ Realtime AI Caller Test</h1>
      <VoiceRecorder sessionId={sessionId} />
    </main>
  );
}
