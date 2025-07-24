// file will handle the streaming API 
// will emit text chunks as they're received.

// openai.js

// summary of this file
//This file acts as a real-time bridge to OpenAI’s streaming chat API.
//It streams the AI’s text reply piece by piece using an async generator.
//You can use this to send partial text results back to clients as soon as they arrive
//enabling fluid conversational experiences.



//Imports the official OpenAI client library
// allows interaction with OpenAI API + realtime streaming features
const { OpenAI } = require('openai');

// TODO: Use dotenv for this
// creates a new OpenAI client instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Instead of waiting for the full response
 * processes the AI’s reply in pieces as OpenAI sends them, enabling real-time interaction.
 
 * Stream a response from OpenAI's ChatCompletion API
 * @param {string} prompt - User message to send
 * @returns {AsyncGenerator<string>} - Yields chunks of reply text
 */
async function* streamChatResponse(prompt) {

// Sends a request to OpenAI’s chat completion API to generate a reply with streaming enabled  
// CAN REMOVE THESE COMMENTS LATER
  // Uses getAIResponse helper to stream OpenAI response in real time
await getAIResponse(prompt, (chunk) => {
  // model: 'gpt-3.5-turbo', // or whatever is best (3.5 for now)
  // stream: true, // tells OpenAI to send back response in stages
  // messages: [ //conversation context
  //   { role: 'system', content: 'You are a bubbly helpful voice assistant.' },
  //   { role: 'user', content: prompt },
  // ]
  
  // 🧠 chunk contains a piece of the assistant's reply
  console.log('🧠 AI chunk:', chunk);

  // You can now send each chunk to TTS or back to the caller if needed
  // e.g. buffer it or stream to client
});


// what this does:
// Loops asynchronously over the streamed data from OpenAI.
//Each chunk is a partial update containing new text.
//The text is nested under choices[0].delta.content.
//When there’s new text, it yields it back to whoever called streamChatResponse()

// lets your server handle each small piece of text immediately as it arrives, instead of waiting for the entire response

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) yield content;
  }
}

// export for stream-server.js (and others)
module.exports = { streamChatResponse };
