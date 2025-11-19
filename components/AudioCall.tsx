'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useWebRTC } from '@/hooks/useWebRTC';

interface AudioCallProps {
  socket: Socket | null;
  callId: string;
  callerId: string;
  receiverId: string;
  isCaller: boolean;
  onEndCall: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

export function AudioCall({
  socket,
  callId,
  callerId,
  receiverId,
  isCaller,
  onEndCall,
  onAccept,
  onReject,
}: AudioCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Get user media (audio only)
  useEffect(() => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported');
      alert('Tarayıcınız mikrofon erişimini desteklemiyor!');
      return;
    }

    // Request microphone access - try with constraints first, fallback to simple request
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false,
      })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch((error) => {
        console.error('Error accessing microphone:', error);
        
        let errorMessage = 'Mikrofon erişimi alınamadı';
        
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Mikrofon cihazı bulunamadı. Lütfen mikrofonunuzun bağlı olduğundan emin olun.';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından mikrofon iznini verin.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Mikrofon kullanılamıyor. Başka bir uygulama tarafından kullanılıyor olabilir.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'Mikrofon gereksinimleri karşılanamıyor.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Mikrofon erişimi desteklenmiyor. HTTPS bağlantısı gerekiyor olabilir.';
        }
        
        alert(errorMessage);
        // Call ended due to media error
        onEndCall();
      });

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // WebRTC connection
  const { isConnected, isConnecting: webrtcConnecting } = useWebRTC({
    socket,
    localStream,
    remoteStream,
    isCaller,
    targetId: isCaller ? receiverId : callerId,
    onStream: (stream) => {
      setRemoteStream(stream);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    },
    onClose: () => {
      onEndCall();
    },
  });

  useEffect(() => {
    setIsConnecting(webrtcConnecting);
  }, [webrtcConnecting]);

  // Update remote audio stream
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const handleEndCall = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }

    // API'ye call bitirme isteği gönder (optional body)
    try {
      const response = await fetch(`/api/calls/${callId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error ending call:', errorData);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }

    onEndCall();
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background-secondary to-background z-[99999] flex flex-col items-center justify-center">
      {/* Remote Audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Avatar/Status */}
      <div className="text-center mb-12">
        <div className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
          {isConnecting ? (
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
          ) : (
            <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {isConnecting ? 'Bağlanıyor...' : isConnected ? 'Aktif' : 'Bekleniyor...'}
        </h2>
        <p className="text-gray-400">Sesli Arama</p>
      </div>

      {/* Call Controls */}
      <div className="flex items-center gap-4">
        {/* Audio Toggle */}
        <button
          onClick={toggleAudio}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isAudioEnabled
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isAudioEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            )}
          </svg>
        </button>

        {/* End Call */}
        <button
          onClick={handleEndCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl"
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Accept/Reject Buttons (for receiver) */}
      {!isCaller && !isConnected && onAccept && onReject && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <button
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center transition-all shadow-xl"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

