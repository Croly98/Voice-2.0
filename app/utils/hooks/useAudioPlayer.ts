// file defines custom react hook "useAudioPlayer.ts"
// this provides a way to play raw audio data (ArrayBuffer)
// In the browser using the Web Audio API

// useRef is used to store and persist the AudioContext across re-renders without recreating it
// meaning: it stores it
import { useRef } from 'react'; 

// defines and exports the custom hook useAudioPlayer
export default function useAudioPlayer() {

  // AudioContext is the core object of Web Audio API
  // context is created ONLY ONCE even if the component using this hook re-renders
  // AudioContext handles decoding, playback and routing audio data
  const audioContextRef = useRef<AudioContext | null>(null);

  // Create AudioContext only in browser environment
  if (typeof window !== 'undefined' && !audioContextRef.current) {
    audioContextRef.current = new AudioContext();
  }

  // data is expected to be a binary audio file (MP3) in the form of an ArrayBuffer
  const playAudioBuffer = async (data: ArrayBuffer) => {
    const context = audioContextRef.current;

    if (!context) {
      console.warn('AudioContext is not available');
      return;
    }

    // decodes the binary audio into an audio buffer the browser can understand
    try { 
      const buffer = await context.decodeAudioData(data);

      // creates a source node from the buffer
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination); //(connects to speaker)
      source.start(); // starts playback
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  };

  // Returns object containing the playAudioBuffer
  // Takes audio data (as an ArrayBuffer) and plays it in the browser using the Web Audio API
  return { playAudioBuffer };
}
