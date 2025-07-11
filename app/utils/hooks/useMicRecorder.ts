// hooks/useMicRecorder.ts
// Streams raw PCM 16kHz mono audio via WebSocket for real-time processing (e.g., OpenAI Whisper)
// Designed for precise control of raw audio data using AudioContext, suitable for low-latency applications

import { useState, useRef } from 'react';

const useMicRecorder = (sendAudio: (data: ArrayBuffer) => void) => {
  const [isRecording, setIsRecording] = useState(false);

  // Store references to Web Audio API objects between renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start microphone recording and begin audio processing
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error('🎤 MediaDevices.getUserMedia not supported');
      return;
    }

    // Get audio stream from microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Create audio context (default sample rate is 44100 Hz)
    const audioContext = new AudioContext({ sampleRate: 44100 });
    audioContextRef.current = audioContext;

    // Create audio source node from stream
    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    // Create processor node to manipulate audio samples
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    // Main audio processing callback
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0); // Mono channel only

      // Downsample from 44100 to 16000 Hz to reduce bandwidth/load
      const downsampled = downsampleBuffer(input, audioContext.sampleRate, 16000);
      if (downsampled) {
        const pcmEncoded = convertFloat32ToInt16(downsampled); // Convert to 16-bit PCM
        sendAudio(pcmEncoded.buffer); // Send to server
      }
    };

    // Connect audio nodes together
    source.connect(processor);
    processor.connect(audioContext.destination); // Must connect to destination to start processing

    setIsRecording(true);
  };

  // Stop all audio processing and recording
  const stopRecording = () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();

    // Stop all media tracks
    streamRef.current?.getTracks().forEach((track) => track.stop());

    setIsRecording(false);
  };

  // Reduces sample rate of raw Float32 audio buffer
  function downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number): Float32Array | null {
    if (targetRate === inputRate) return buffer;

    const ratio = inputRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    let offset = 0;
    for (let i = 0; i < newLength; i++) {
      const nextOffset = Math.round((i + 1) * ratio);
      let sum = 0, count = 0;
      for (let j = offset; j < nextOffset && j < buffer.length; j++) {
        sum += buffer[j];
        count++;
      }
      result[i] = sum / count; // Average values for smoother downsampling
      offset = nextOffset;
    }

    return result;
  }

  // Convert Float32 samples to 16-bit PCM for transmission
  function convertFloat32ToInt16(buffer: Float32Array): Int16Array {
    const result = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return result;
  }

  return { isRecording, startRecording, stopRecording };
};

export default useMicRecorder;
