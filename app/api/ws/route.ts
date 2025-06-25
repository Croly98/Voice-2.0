// app/api/ws/route.ts

// WebSocket server setup for handling real-time communication in a WebRTC session

//Keeps the connection open

//Allows both the client and server to send messages at any time

//Is ideal for real-time apps (chat, games, live updates, etc.)

import { WebSocketServer } from 'ws'; //fix
import { NextApiRequest } from 'next'; //fix
import { Server } from 'http';

const sessions: Record<string, WebSocket[]> = {}; // creates a object called sessions, this will be used to store WebSocket connections for each session ID

export function setupWebSocketServer(server: Server) { // takes an HTTP server instance as an argument, this is the server that will handle WebSocket connections
  const wss = new WebSocketServer({ server }); // uses a websocket server (the plans), passing the HTTP server instance (instance= the build and turn it on) to it, this allows the WebSocket server to listen for incoming connections on the same port as the HTTP server

  wss.on('connection', (ws, req) => { // listens for new WebSocket connections, when a new client connects, it triggers this callback function
    // Extract sessionId from query string 
    const url = new URL(req.url || '', 'http://localhost'); // is the path (tell the server which endpoint the client wants to connect to) and query string part of the incoming request (tell what session the client wants to join), req.url is the URL of the incoming request, we use a default base URL (http://localhost) to create a full URL object, this allows us to easily access query parameters
    // If the URL is not provided, we use a default base URL to avoid errors
    const sessionId = url.searchParams.get('sessionId'); // Pulls out the sessionId from the query string

    // If session cannot be found, close the connection
    if (!sessionId) {
      ws.close(1008, 'Missing sessionId');
      return;
    }

    // Add client to session
    sessions[sessionId] = sessions[sessionId] || []; // checks if the session already exists in the sessions object, if it does not exist, it initializes it as an empty array, this allows us to store multiple WebSocket connections for the same session ID
    sessions[sessionId].push(ws); // This line adds that connection to the array of connections for this sessionId

    console.log(`Client joined session!: ${sessionId}`); // Log the session ID when a client connects

    // Relay messages between clients in same session
    ws.on('message', (message) => { // listens for incoming messages
      const peers = sessions[sessionId] || [];
      for (const peer of peers) { // get all connected clients in the same session
        if (peer !== ws && peer.readyState === WebSocket.OPEN) { // makes sure each message is only sent to other peers in the same session, and that the peer is still connected (readyState === WebSocket.OPEN)
          peer.send(message); // send the received message to each peer 
        }
      }
    });

    // Remove client on disconnect
    ws.on('close', () => { //listens for the close event, which is triggered when a client disconnects
      sessions[sessionId] = (sessions[sessionId] || []).filter((client) => client !== ws);
    // if not clients remain in the session, kill the session  
      if (sessions[sessionId].length === 0) { 
        delete sessions[sessionId];
      }
    });
  });
}
