


 //This wraps the OpenAI streaming generator and collects the full reply
 //so we can work with complete messages (e.g. send full TTS audio)
 

const { streamChatResponse } = require('./openai');

/**
 * Get full GPT response by streaming and concatenating all chunks
 * @param {string} prompt - The user message to send to OpenAI
 * @returns {Promise<string>} - The full AI reply as a single string
 */
async function generateGPTResponse(prompt) {
  let fullReply = '';

  // 🧠 Collect all chunks from the OpenAI stream
  for await (const chunk of streamChatResponse(prompt)) {
    fullReply += chunk;
  }

  // 📝 Log final result
  console.log(`🤖 Full GPT reply: ${fullReply}`);

  return fullReply;
}

module.exports = {
  generateGPTResponse,
};
