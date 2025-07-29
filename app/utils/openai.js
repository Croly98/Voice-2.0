// openai.js

// This file acts as a real-time bridge to OpenAI’s streaming chat API.
// It streams the AI’s text reply piece by piece using an async generator.
// You can use this to send partial text results back to clients as soon as they arrive,
// enabling fluid conversational experiences.

// Imports the official OpenAI client library
const { OpenAI } = require('openai');

// TODO: Use dotenv for this
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Streams a response from OpenAI's ChatCompletion API in real time.
 * @param {Array<{role: string, content: string}>} messages - Conversation history array with roles and content
 * @returns {AsyncGenerator<string>} Yields chunks of reply text as they arrive
 */
async function* streamChatResponse(messages) {
  // Send request to OpenAI API with streaming enabled
  const stream = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // FOR NOW, RECOMMENDED FOR TESTING
    messages,
    stream: true,
  });

  // Iterate over each chunk received from the stream
  for await (const chunk of stream) {
    // Extract the new content text from the delta
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      // Log chunk (optional)
      console.log('🧠 AI chunk:', content);
      // Yield the chunk back to the caller
      yield content;
    }
  }
}

// Export for usage in your server or other files
module.exports = { streamChatResponse };
