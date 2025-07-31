/**
 * Converts μ-law (8-bit) audio to PCM (16-bit signed little-endian).
 * This is needed to decode Twilio's 8kHz μ-law mono input into usable PCM.
 *
 * @param {Buffer} ulawBuffer - μ-law encoded buffer from Twilio (decoded from base64)
 * @returns {Buffer} LINEAR16 PCM buffer (signed 16-bit little-endian)
 */
function ulawToPcm(ulawBuffer) {
  const BIAS = 0x84;
  const pcmBuffer = Buffer.alloc(ulawBuffer.length * 2); // 2 bytes per sample

  for (let i = 0; i < ulawBuffer.length; i++) {
    let ulawByte = ~ulawBuffer[i]; // Invert bits

    const sign = (ulawByte & 0x80) ? -1 : 1;
    const exponent = (ulawByte >> 4) & 0x07;
    const mantissa = ulawByte & 0x0F;

    // Decode sample
    let sample = ((mantissa << 3) + BIAS) << exponent;
    sample = sign * sample;

    // Optional: clamp to 16-bit range (prevent overflow)
    sample = Math.max(-32768, Math.min(32767, sample));

    pcmBuffer.writeInt16LE(sample, i * 2);
  }

  return pcmBuffer;
}

module.exports = { ulawToPcm };
