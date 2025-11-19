import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import Peer, { Instance as PeerInstance } from 'simple-peer';

interface UseWebRTCOptions {
  socket: Socket | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCaller: boolean;
  targetId: string;
  onStream?: (stream: MediaStream) => void;
  onClose?: () => void;
}

export function useWebRTC({
  socket,
  localStream,
  remoteStream,
  isCaller,
  targetId,
  onStream,
  onClose,
}: UseWebRTCOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const peerRef = useRef<PeerInstance | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const onCloseRef = useRef(onClose);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingAnswerRef = useRef<RTCSessionDescriptionInit | null>(null);

  // Keep onClose ref up to date without causing re-renders
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // STUN/TURN configuration
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN server için environment variable'dan alınabilir
    // { urls: process.env.NEXT_PUBLIC_TURN_URL, username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL },
  ];

  // Cleanup function - stable reference
  const cleanup = useCallback(() => {
    if (peerRef.current) {
      try {
        // Remove all event listeners first to prevent 'close' event from firing
        peerRef.current.removeAllListeners();
        // Destroy peer connection
        if (peerRef.current.destroyed === false) {
          peerRef.current.destroy();
        }
      } catch (error) {
        // Ignore cleanup errors
        console.debug('Peer cleanup error (ignored):', error);
      }
      peerRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Initialize peer connection
  const initPeer = useCallback(() => {
    if (!socket || !localStream) return;

    // Clean up any existing peer before creating a new one
    if (peerRef.current) {
      try {
        peerRef.current.removeAllListeners();
        peerRef.current.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      peerRef.current = null;
    }

    setIsConnecting(true);

    const peer = new Peer({
      initiator: isCaller,
      trickle: false,
      stream: localStream,
      config: {
        iceServers,
      },
    });

    peerRef.current = peer;

    // If there's a pending offer/answer, handle it now
    if (!isCaller && pendingOfferRef.current && peerRef.current) {
      console.log('Handling pending offer');
      peerRef.current.signal(pendingOfferRef.current);
      pendingOfferRef.current = null;
    } else if (isCaller && pendingAnswerRef.current && peerRef.current) {
      console.log('Handling pending answer');
      peerRef.current.signal(pendingAnswerRef.current);
      pendingAnswerRef.current = null;
    }

    let isClosed = false;
    const handleClose = () => {
      if (isClosed) return;
      isClosed = true;
      
      setIsConnected(false);
      setIsConnecting(false);
      
      // Only log if peer was actually connected
      if (peerRef.current === peer) {
        console.debug('Peer connection closed');
      }
      
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach(track => track.stop());
        remoteStreamRef.current = null;
      }
      
      // Only call onClose if peer is still current
      if (peerRef.current === peer) {
        peerRef.current = null;
        onCloseRef.current?.();
      }
    };

    // Handle signal data (offer/answer)
    peer.on('signal', (data) => {
      if (isClosed || peerRef.current !== peer) return;
      
      if (isCaller) {
        // Caller sends offer
        socket.emit('call:offer', {
          receiverId: targetId,
          offer: data as RTCSessionDescriptionInit,
        });
      } else {
        // Receiver sends answer
        socket.emit('call:answer', {
          callerId: targetId,
          answer: data as RTCSessionDescriptionInit,
        });
      }
    });

    // Handle incoming stream
    peer.on('stream', (stream: MediaStream) => {
      if (isClosed || peerRef.current !== peer) return;
      
      remoteStreamRef.current = stream;
      onStream?.(stream);
      setIsConnected(true);
      setIsConnecting(false);
    });

    // Handle connection
    peer.on('connect', () => {
      if (isClosed || peerRef.current !== peer) return;
      
      console.log('Peer connected');
      setIsConnected(true);
      setIsConnecting(false);
    });

    // Handle errors
    peer.on('error', (error) => {
      if (isClosed) return;
      
      console.error('Peer error:', error);
      handleClose();
    });

    // Handle close
    peer.on('close', () => {
      handleClose();
    });
  }, [socket, localStream, isCaller, targetId, onStream]);

  // Handle incoming offer (receiver side)
  const handleOffer = useCallback((offer: RTCSessionDescriptionInit) => {
    if (isCaller) return; // Only receiver handles offers

    console.log('Received offer, peer ready:', !!peerRef.current, 'localStream ready:', !!localStream);
    
    // If peer is ready, handle offer immediately
    if (peerRef.current) {
      console.log('Handling offer immediately');
      peerRef.current.signal(offer);
      pendingOfferRef.current = null;
    } else {
      // Otherwise, store offer for when peer is ready
      console.log('Storing offer for later (peer not ready yet)');
      pendingOfferRef.current = offer;
    }
  }, [isCaller, localStream]);

  // Handle incoming answer (caller side)
  const handleAnswer = useCallback((answer: RTCSessionDescriptionInit) => {
    if (!isCaller) return; // Only caller handles answers

    console.log('Received answer, peer ready:', !!peerRef.current, 'localStream ready:', !!localStream);
    
    // If peer is ready, handle answer immediately
    if (peerRef.current) {
      console.log('Handling answer immediately');
      peerRef.current.signal(answer);
      pendingAnswerRef.current = null;
    } else {
      // Otherwise, store answer for when peer is ready
      console.log('Storing answer for later (peer not ready yet)');
      pendingAnswerRef.current = answer;
    }
  }, [isCaller, localStream]);

  // Handle ICE candidate
  const handleIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    if (!peerRef.current) return;

    const peer = peerRef.current;
    peer.signal(candidate);
  }, []);

  // Setup socket listeners - set up BEFORE peer initialization
  useEffect(() => {
    if (!socket) return;

    const offerHandler = ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      console.log('Socket: received offer');
      handleOffer(offer);
    };

    const answerHandler = ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      console.log('Socket: received answer');
      handleAnswer(answer);
    };

    const iceCandidateHandler = ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      handleIceCandidate(candidate);
    };

    socket.on('call:offer', offerHandler);
    socket.on('call:answer', answerHandler);
    socket.on('call:ice-candidate', iceCandidateHandler);

    return () => {
      socket.off('call:offer', offerHandler);
      socket.off('call:answer', answerHandler);
      socket.off('call:ice-candidate', iceCandidateHandler);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // Initialize peer when ready
  useEffect(() => {
    if (!socket || !localStream) return;

    initPeer();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, localStream, isCaller, targetId]);

  return {
    isConnected,
    isConnecting,
    remoteStream: remoteStreamRef.current,
    cleanup,
  };
}

