import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { parse } from 'cookies';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;
const userSocketMap = new Map<string, string>(); // userId -> socketId

export const initSocketServer = (httpServer: HTTPServer) => {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      // Get userId from handshake auth or query
      const userId = (socket.handshake.auth?.userId || socket.handshake.query?.userId) as string;
      
      if (!userId) {
        return next(new Error('Unauthorized: User ID required'));
      }

      // Attach user ID to socket
      (socket as any).userId = userId;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    console.log(`User ${userId} connected with socket ${socket.id}`);
    
    // Map user ID to socket ID
    userSocketMap.set(userId, socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle call initiation
    socket.on('call:initiate', async (data: { receiverId: string; type: 'audio' | 'video'; groupId?: string }) => {
      const { receiverId, type, groupId } = data;
      
      console.log(`Call initiated: ${userId} -> ${receiverId}, type: ${type}`);
      
      // Emit to receiver
      socket.to(`user:${receiverId}`).emit('call:incoming', {
        callerId: userId,
        type,
        groupId,
      });
    });

    // Handle call offer
    socket.on('call:offer', async (data: { receiverId: string; offer: RTCSessionDescriptionInit }) => {
      const { receiverId, offer } = data;
      
      console.log(`Call offer: ${userId} -> ${receiverId}`);
      
      // Forward offer to receiver
      socket.to(`user:${receiverId}`).emit('call:offer', {
        callerId: userId,
        offer,
      });
    });

    // Handle call answer
    socket.on('call:answer', async (data: { callerId: string; answer: RTCSessionDescriptionInit }) => {
      const { callerId, answer } = data;
      
      console.log(`Call answer: ${userId} -> ${callerId}`);
      
      // Forward answer to caller
      socket.to(`user:${callerId}`).emit('call:answer', {
        receiverId: userId,
        answer,
      });
    });

    // Handle ICE candidate
    socket.on('call:ice-candidate', async (data: { targetId: string; candidate: RTCIceCandidateInit }) => {
      const { targetId, candidate } = data;
      
      // Forward ICE candidate to target
      socket.to(`user:${targetId}`).emit('call:ice-candidate', {
        senderId: userId,
        candidate,
      });
    });

    // Handle call rejection
    socket.on('call:reject', async (data: { callerId: string }) => {
      const { callerId } = data;
      
      console.log(`Call rejected: ${userId} rejected call from ${callerId}`);
      
      // Notify caller
      socket.to(`user:${callerId}`).emit('call:rejected', {
        receiverId: userId,
      });
    });

    // Handle call end
    socket.on('call:end', async (data: { targetId?: string }) => {
      const { targetId } = data;
      
      console.log(`Call ended: ${userId} ended call with ${targetId || 'all'}`);
      
      if (targetId) {
        // Notify specific user
        socket.to(`user:${targetId}`).emit('call:ended', {
          userId,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`);
      userSocketMap.delete(userId);
    });
  });

  return io;
};

export const getSocketServer = () => {
  return io;
};

export const getSocketIdByUserId = (userId: string): string | undefined => {
  return userSocketMap.get(userId);
};
