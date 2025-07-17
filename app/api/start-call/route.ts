// app/api/start-call/route.ts

import { NextResponse } from 'next/server';
// do I need v4 as uuidv4 for better session IDs?

/**
 * API Route: /api/start-call
 * 
 * Instead of dialing a phone number, this route creates a WebRTC session/room
 * and returns a session ID for signaling. (doesnt need a server, just a room)
 * The frontend will use this to start a WebRTC peer connection.
 */

export async function POST(req: Request) {
  try {
    // wait is this even being used for anyting???
    // Parse JSON body (parse=turning block of text into real data, i believe?)
    const body = await req.json(); //takes the text from the request body and parses it into a JavaScript object (so it can read it)

    // Generate a unique session ID or room ID
    const sessionId = generateSessionId();

    // Return session ID so frontend can use it for signaling (if successful)
    return NextResponse.json({ message: 'Session created', sessionId });


    // Return an error if no session ID was generated
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Utility function to create a random session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

// Summary for me to understand:

//Frontend sends a request to /api/start-call (sales rep initiates a call).

// the route:
// Parses the request.
// generates a session ID (or room ID).
// Returns that session ID to the frontend.

//Frontend will then use this sessionId to set up WebRTC signaling using websockets
