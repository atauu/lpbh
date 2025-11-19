'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useWebRTC } from '@/hooks/useWebRTC';

interface VideoCallProps {
  socket: Socket | null;
  callId: string;
  callerId: string;
  receiverId: string;
  isCaller: boolean;
  onEndCall: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}

export function VideoCall({
  socket,
  callId,
  callerId,
  receiverId,
  isCaller,
  onEndCall,
  onAccept,
  onReject,
}: VideoCallProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Get user media
  useEffect(() => {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia is not supported');
      alert('Tarayıcınız kamera ve mikrofon erişimini desteklemiyor!');
      return;
    }

    // Request camera and microphone access - try with constraints first, fallback to simple request
    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch((error) => {
        console.error('Error accessing media devices:', error);
        
        let errorMessage = 'Kamera ve mikrofon erişimi alınamadı';
        
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Kamera veya mikrofon cihazı bulunamadı. Lütfen cihazlarınızın bağlı olduğundan emin olun.';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Kamera veya mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından izinleri verin.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Kamera veya mikrofon kullanılamıyor. Başka bir uygulama tarafından kullanılıyor olabilir.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'Kamera veya mikrofon gereksinimleri karşılanamıyor.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Kamera veya mikrofon erişimi desteklenmiyor. HTTPS bağlantısı gerekiyor olabilir.';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    },
    onClose: () => {
      onEndCall();
    },
  });

  useEffect(() => {
    setIsConnecting(webrtcConnecting);
  }, [webrtcConnecting]);

  // Update remote video stream
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const handleEndCall = async () => {
    // Stop all media tracks first
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
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex flex-col">
      {/* Remote Video */}
      <div className="flex-1 relative">
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background-secondary to-background">
            {isConnecting ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-white text-lg">Bağlanıyor...</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-white text-lg">Bekleniyor...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Local Video (Picture-in-Picture) */}
      {localStream && (
        <div className="absolute top-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/30 shadow-2xl bg-background-secondary">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Call Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        {/* Video Toggle */}
        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isVideoEnabled
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isVideoEnabled ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            )}
          </svg>
        </button>

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

