/**
 * Converts μ-law (8-bit) audio to PCM (16-bit signed little-endian).
 * This is NEEDED to feed Twilio's incoming audio into Whisper / Deepgram / STT engines.
 *
 * Twilio sends 8000Hz mono μ-law audio over the WebSocket stream.
 *
 * @param {Buffer} ulawBuffer - μ-law encoded buffer from Twilio (decoded from base64)
 * @returns {Buffer} LINEAR16 PCM buffer (signed 16-bit little-endian)
 */
function ulawToPcm(ulawBuffer) {
  const pcmBuffer = Buffer.alloc(ulawBuffer.length * 2); // 2 bytes per sample (16-bit PCM)

  for (let i = 0; i < ulawBuffer.length; i++) {
    let ulawByte = ~ulawBuffer[i]; // Invert bits

    const sign = (ulawByte & 0x80) ? -1 : 1;
    let exponent = (ulawByte >> 4) & 0x07;
    let mantissa = ulawByte & 0x0F;
    let sample = ((mantissa << 3) + 0x84) << exponent;

    sample = sign * sample;

    pcmBuffer.writeInt16LE(sample, i * 2); // 16-bit signed little-endian
  }

  return pcmBuffer;
}

//logging

console.log('🧪 μ-law Buffer length:', replyUlawBuffer.length);

module.exports = { ulawToPcm };
