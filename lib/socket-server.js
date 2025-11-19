const { Server: SocketIOServer } = require('socket.io');

let io = null;
const userSocketMap = new Map(); // userId -> socketId

const initSocketServer = (httpServer) => {
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
      const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
      
      if (!userId) {
        return next(new Error('Unauthorized: User ID required'));
      }

      // Attach user ID to socket
      socket.userId = userId;
      next();
    } catch (error) {
      console.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User ${userId} connected with socket ${socket.id}`);
    
    // Map user ID to socket ID
    userSocketMap.set(userId, socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle call initiation
    socket.on('call:initiate', async (data) => {
      const { receiverId, type, groupId, callId } = data;
      
      console.log(`Call initiated: ${userId} -> ${receiverId}, type: ${type}, callId: ${callId}`);
      
      // Emit to receiver with call ID
      socket.to(`user:${receiverId}`).emit('call:incoming', {
        callerId: userId,
        type,
        groupId,
        callId,
      });
    });

    // Handle call offer
    socket.on('call:offer', async (data) => {
      const { receiverId, offer } = data;
      
      console.log(`Call offer: ${userId} -> ${receiverId}`);
      
      // Forward offer to receiver
      socket.to(`user:${receiverId}`).emit('call:offer', {
        callerId: userId,
        offer,
      });
    });

    // Handle call answer
    socket.on('call:answer', async (data) => {
      const { callerId, answer } = data;
      
      console.log(`Call answer: ${userId} -> ${callerId}`);
      
      // Forward answer to caller
      socket.to(`user:${callerId}`).emit('call:answer', {
        receiverId: userId,
        answer,
      });
    });

    // Handle ICE candidate
    socket.on('call:ice-candidate', async (data) => {
      const { targetId, candidate } = data;
      
      // Forward ICE candidate to target
      socket.to(`user:${targetId}`).emit('call:ice-candidate', {
        senderId: userId,
        candidate,
      });
    });

    // Handle call rejection
    socket.on('call:reject', async (data) => {
      const { callerId } = data;
      
      console.log(`Call rejected: ${userId} rejected call from ${callerId}`);
      
      // Notify caller
      socket.to(`user:${callerId}`).emit('call:rejected', {
        receiverId: userId,
      });
    });

    // Handle call end
    socket.on('call:end', async (data) => {
      const { targetId } = data || {};
      
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

const getSocketServer = () => {
  return io;
};

const getSocketIdByUserId = (userId) => {
  return userSocketMap.get(userId);
};

module.exports = {
  initSocketServer,
  getSocketServer,
  getSocketIdByUserId,
};

