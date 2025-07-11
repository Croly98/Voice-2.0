import textToSpeech from '@google-cloud/text-to-speech';

// Initialize Google Cloud TTS client
const client = new textToSpeech.TextToSpeechClient();

/**
 * Convert 16-bit PCM samples to 8-bit μ-law (telephony audio format).
 * (Exported but not used internally now)
 */
export function pcmToMulaw(pcmBuffer: Buffer): Buffer {
  const MULAW_MAX = 0x1FFF;
  const MULAW_BIAS = 33;
  const output = Buffer.alloc(pcmBuffer.length / 2);

  for (let i = 0, j = 0; i < pcmBuffer.length; i += 2, j++) {
    let sample = pcmBuffer.readInt16LE(i);
    const sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    sample += MULAW_BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
      exponent--;
    }
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const mulawByte = ~(sign | (exponent << 4) | mantissa);
    output[j] = mulawByte;
  }
  return output;
}

/**
 * Synthesizes speech from text and returns raw 16-bit LINEAR16 PCM buffer at 8kHz.
 *
 * @param text - Text to convert to speech
 * @returns Buffer with LINEAR16 PCM audio data at 8kHz
 */
export async function synthesizeSpeechBuffer(text: string): Promise<Buffer> {
  const request = {
    input: { text },
    voice: {
      languageCode: 'en-IE',
      ssmlGender: 'NEUTRAL',
    },
    audioConfig: {
      audioEncoding: 'LINEAR16',
      sampleRateHertz: 8000,
    },
  };

  const [response] = await client.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content received from Google TTS');
  }

  return Buffer.from(response.audioContent as Uint8Array);
}
