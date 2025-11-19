import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

export function useSocket() {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Socket.IO bağlantısı oluştur
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    
    const newSocket = io(socketUrl, {
      path: '/api/socket/io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: {
        userId: session.user.id,
      },
      query: {
        userId: session.user.id,
      },
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      // Cleanup: disconnect socket gracefully
      if (socketRef.current) {
        try {
          // Remove all event listeners first to prevent warnings
          socketRef.current.removeAllListeners();
          // Disconnect gracefully
          if (socketRef.current.connected) {
            socketRef.current.disconnect();
          } else {
            // If not connected, just close the connection
            socketRef.current.close();
          }
        } catch (error) {
          // Ignore errors during cleanup
          console.debug('Socket cleanup error (ignored):', error);
        }
        socketRef.current = null;
      }
    };
  }, [session?.user?.id]);

  return { socket, isConnected };
}

