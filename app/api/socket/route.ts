import { NextRequest } from 'next/server';

// This is a placeholder route for Socket.IO
// The actual Socket.IO server is initialized in lib/socket-server.ts
// and connected to the HTTP server in server.ts

export async function GET(request: NextRequest) {
  return new Response('Socket.IO server is running', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}



