'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { hasPermission } from '@/lib/auth';
import { useSocket } from '@/hooks/useSocket';
import { VideoCall } from '@/components/VideoCall';
import { AudioCall } from '@/components/AudioCall';

// WhatsApp-style Voice Message Player Component
interface VoiceMessagePlayerProps {
  messageId: string;
  audioUrl: string;
  isOwn: boolean;
  playingAudioId: string | null;
  currentTime: number;
  duration: number;
  progress: number;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (time: number) => void;
  onDurationUpdate: (duration: number) => void;
  onProgressChange: (progress: number) => void;
  audioRef: (el: HTMLAudioElement | null) => void;
}

function VoiceMessagePlayer({
  messageId,
  audioUrl,
  isOwn,
  playingAudioId,
  currentTime,
  duration,
  progress,
  onPlay,
  onPause,
  onTimeUpdate,
  onDurationUpdate,
  onProgressChange,
  audioRef,
}: VoiceMessagePlayerProps) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Audio element setup
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    audioRef(audio);

    const handleTimeUpdate = () => {
      onTimeUpdate(audio.currentTime);
    };

    const handleDurationChange = () => {
      if (audio.duration) {
        onDurationUpdate(audio.duration);
      }
    };

    const handleEnded = () => {
      onPause();
      onTimeUpdate(0);
      onProgressChange(0);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration) {
        onDurationUpdate(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioUrl, onTimeUpdate, onDurationUpdate, onPause, onProgressChange, audioRef]);

  // Play/pause control
  const isPlaying = playingAudioId === messageId;

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Waveform bars generation - use useMemo to prevent regeneration
  const waveformBars = useMemo(() => {
    const bars = 40;
    // Generate consistent heights for each bar (based on messageId for consistency)
    let seed = 0;
    for (let i = 0; i < messageId.length; i++) {
      seed += messageId.charCodeAt(i);
    }
    
    return Array.from({ length: bars }, (_, i) => {
      // Consistent height based on seed and index
      const randomValue = Math.sin(seed + i) * 1000;
      const height = 30 + (Math.abs(randomValue) % 50);
      // Active bars: those before the scrubber position
      const isActive = (i / bars) * 100 < progress;
      return { height, isActive };
    });
  }, [messageId, progress]);

  // Handle scrubber click/drag
  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    onProgressChange(newProgress);
  };

  const handleWaveformMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    handleWaveformClick(e);
  };

  const handleWaveformTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = touch.clientX - rect.left;
    const newProgress = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    onProgressChange(newProgress);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (!waveformRef.current) return;
      const rect = waveformRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const newProgress = Math.max(0, Math.min(100, (x / rect.width) * 100));
      onProgressChange(newProgress);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onProgressChange]);

  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      {/* Hidden audio element */}
      <audio
        ref={audioElementRef}
        src={audioUrl}
        preload="metadata"
      />

      {/* Waveform and Play Button Container */}
      <div className="flex items-center gap-3">
        {/* Play Button - Left side */}
        <button
          onClick={handlePlayPause}
          className="flex-shrink-0 flex items-center justify-center hover:opacity-80 transition"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Waveform Container */}
        <div className="flex-1 flex flex-col gap-1">
          {/* Waveform */}
          <div
            ref={waveformRef}
            className="flex items-end gap-0.5 h-8 cursor-pointer relative px-1 select-none min-w-[120px]"
            style={{ 
              overflow: 'visible', 
              zIndex: 10,
              position: 'relative',
            }}
            onMouseDown={handleWaveformMouseDown}
            onTouchStart={handleWaveformTouchStart}
          >
            {waveformBars.map((bar, index) => (
              <div
                key={index}
                className={`flex-1 ${bar.isActive ? 'bg-white/80' : 'bg-white/40'} rounded-sm transition-colors duration-75`}
                style={{ 
                  height: `${bar.height}%`,
                  minHeight: '2px',
                }}
              />
            ))}
            
            {/* Scrubber (White Circle) - WhatsApp style */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing"
              style={{ 
                left: progress > 0 
                  ? `max(0px, min(calc(${progress}% - 6px), calc(100% - 12px)))`
                  : '0px',
                zIndex: 9999,
              }}
            />
          </div>

          {/* Time Info - WhatsApp style */}
          <div className={`flex items-center gap-1 text-xs ${isOwn ? 'text-white/90' : 'text-gray-300'}`}>
            <span>{formatTime(currentTime)}</span>
            <span className="opacity-60">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RoleGroup {
  id: string;
  name: string;
  order: number;
}

interface Message {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'location' | 'live_location' | 'document' | 'file';
  content: string | null;
  mediaPath: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  liveLocationExpiresAt: string | null;
  repliedToId: string | null;
  forwardedFromId: string | null;
  senderId: string;
  groupId: string | null;
  recipientId: string | null;
  pinned: boolean;
  pinnedAt: string | null;
  pinnedBy: string | null;
  editedAt: string | null;
  expiresAt: string | null;
  selfDestruct: boolean;
  selfDestructSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  sender: {
    id: string;
    username: string;
    rutbe: string | null;
    isim: string | null;
    soyisim: string | null;
  };
  group: {
    id: string;
    name: string;
    order: number;
  } | null;
  repliedTo: {
    id: string;
    type: string;
    content: string | null;
    sender: {
      rutbe: string | null;
      isim: string | null;
      soyisim: string | null;
      username: string;
    };
  } | null;
  forwardedFrom: {
    id: string;
    type: string;
    content: string | null;
    sender: {
      rutbe: string | null;
      isim: string | null;
      soyisim: string | null;
      username: string;
    };
  } | null;
  reactions?: Array<{
    id: string;
    emoji: string;
    userId: string;
    user: {
      id: string;
      username: string;
      isim: string | null;
      soyisim: string | null;
      rutbe: string | null;
    };
  }>;
  readReceipts?: Array<{
    id: string;
    userId: string;
    readAt: string;
    user: {
      id: string;
      username: string;
      isim: string | null;
      soyisim: string | null;
      rutbe: string | null;
    };
  }>;
  starredBy?: Array<{
    id: string;
    userId: string;
  }>;
  isStarred?: boolean; // Kullanıcının yıldızladı mı?
}

interface User {
  id: string;
  username: string;
  rutbe: string | null;
  isim: string | null;
  soyisim: string | null;
}

export default function SohbetPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [userGroupOrder, setUserGroupOrder] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<string | null>(null); // null = LPBH
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showLiveLocationOptions, setShowLiveLocationOptions] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [recordingCanceled, setRecordingCanceled] = useState(false);
  const [recordingStartY, setRecordingStartY] = useState(0);
  const [recordingCurrentY, setRecordingCurrentY] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  
  // Yeni özellikler için state'ler
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Yeni özellikler için state'ler
  const [selfDestructEnabled, setSelfDestructEnabled] = useState(false);
  const [selfDestructSeconds, setSelfDestructSeconds] = useState<number | null>(null);
  const [showPrivateMessageDialog, setShowPrivateMessageDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string; fileName?: string } | null>(null);
  const [mediaGallery, setMediaGallery] = useState<Array<{ id: string; url: string; type: string; thumbnail?: string }>>([]);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    id: string;
    callerId: string;
    receiverId: string;
    type: 'audio' | 'video';
    isCaller: boolean;
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    type: 'audio' | 'video';
    groupId?: string;
    callId?: string;
  } | null>(null);

  // Socket.IO connection
  const { socket, isConnected: isSocketConnected } = useSocket();
  
  // Mention states
  const [users, setUsers] = useState<User[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  
  // Audio playback states
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioCurrentTimes, setAudioCurrentTimes] = useState<Record<string, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const locationPickerRef = useRef<HTMLDivElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Kullanıcının erişebileceği sekmeleri hesapla
  const getAccessibleTabs = () => {
    const tabs: Array<{ id: string | null; name: string; order: number }> = [
      { id: null, name: 'LPBH', order: -1 }, // Her zaman erişilebilir - (HERKES) kaldırıldı
    ];

    if (userGroupOrder !== null) {
      roleGroups.forEach(group => {
        // Yönetim (order 2) sohbetine: sadece order 2 kullanıcılar
        // Member (order 1) sohbetine: order >= 1 kullanıcılar (yani order 1 ve 2)
        // Aday (order 0) sohbetine: order >= 0 kullanıcılar (yani order 0, 1, 2 - yani herkes)
        // LPBH: herkes (zaten eklendi)
        
        if (group.order === 2) {
          // Yönetim sohbetine sadece order 2 kullanıcılar erişebilir
          if (userGroupOrder === 2) {
            tabs.push({ id: group.id, name: group.name, order: group.order });
          }
        } else if (group.order === 1) {
          // Member sohbetine order >= 1 kullanıcılar erişebilir (yani order 1 ve 2)
          if (userGroupOrder >= 1) {
            tabs.push({ id: group.id, name: group.name, order: group.order });
          }
        } else if (group.order === 0) {
          // Aday sohbetine order >= 0 kullanıcılar erişebilir (yani herkes)
          if (userGroupOrder >= 0) {
            tabs.push({ id: group.id, name: group.name, order: group.order });
          }
        }
      });
    }

    return tabs.sort((a, b) => b.order - a.order); // Yüksek order önce (Yönetim, Member, Aday, LPBH)
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchRoleGroups();
      fetchUsers();
      fetchMessages();
      // Polling for new messages every 2 seconds
      const interval = setInterval(() => {
        fetchMessages();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [session, status, selectedTab]);

  const fetchRoleGroups = async () => {
    try {
      const res = await fetch('/api/role-groups', {
        credentials: 'include',
      });
      if (res.ok) {
        const groups: RoleGroup[] = await res.json();
        setRoleGroups(groups);

        // Kullanıcının grubunu bul
        if (session?.user?.rutbe) {
          const userRoleRes = await fetch('/api/roles', {
            credentials: 'include',
          });
          if (userRoleRes.ok) {
            const roles = await userRoleRes.json();
            const userRole = roles.find((r: any) => r.name === session.user.rutbe);
            if (userRole?.group) {
              const userGroup = groups.find(g => g.id === userRole.group.id);
              if (userGroup) {
                setUserGroupOrder(userGroup.order);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Role groups fetch error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        credentials: 'include',
      });
      if (res.ok) {
        const usersData: User[] = await res.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

      // Click outside to close emoji picker and menus
      useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
            setShowEmojiPicker(false);
          }
          if (locationPickerRef.current && !locationPickerRef.current.contains(event.target as Node)) {
            setShowLocationPicker(false);
            setShowLiveLocationOptions(false);
            setShowAttachmentMenu(false);
          }
          // Close message menu
          if (!(event.target as HTMLElement).closest('.message-menu-container')) {
            setShowMessageMenu(null);
          }
          // Close mention list
          if (!(event.target as HTMLElement).closest('[data-mention-list]')) {
            setShowMentionList(false);
          }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }, []);

      // Mention kontrolü için inputText değişikliklerini izle
      useEffect(() => {
        if (!textareaRef.current) return;
        
        const cursorPos = textareaRef.current.selectionStart || inputText.length;
        const textBeforeCursor = inputText.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
          const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
          const isInMentionFormat = textBeforeCursor.substring(lastAtIndex).match(/@\[[^\]]+\]/);
          
          if (!isInMentionFormat) {
            if (textAfterAt && !textAfterAt.match(/[\s\n@]/)) {
              setMentionStartIndex(lastAtIndex);
              setMentionQuery(textAfterAt.toLowerCase());
              setShowMentionList(true);
              
              // Kullanıcıları filtrele - Rütbe, İsim, Soyisim'e göre (WhatsApp gibi)
              const query = textAfterAt.toLowerCase();
              const filtered = users.filter(user => {
                const rutbe = (user.rutbe || '').toLowerCase();
                const isim = (user.isim || '').toLowerCase();
                const soyisim = (user.soyisim || '').toLowerCase();
                const fullName = `${rutbe} ${isim} ${soyisim}`.trim().toLowerCase();
                
                return rutbe.includes(query) || 
                       isim.includes(query) || 
                       soyisim.includes(query) ||
                       fullName.includes(query);
              }).slice(0, 10);
              
              setFilteredUsers(filtered);
            } else if (textAfterAt === '' || textAfterAt.length === 0) {
              setMentionStartIndex(lastAtIndex);
              setMentionQuery('');
              setShowMentionList(true);
              setFilteredUsers(users.slice(0, 10));
            }
          }
        }
      }, [inputText, users]);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (selectedTab) {
        params.append('groupId', selectedTab);
      }
      
      const res = await fetch(`/api/messages?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Messages fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    // WhatsApp tarzı - container flex-col-reverse olduğu için scroll top'a yapılır
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = 0; // Flex-col-reverse'de en alta scroll = top = 0
    }
  };

  // Kullanıcı alt tarafta mı? (scroll davranışı için ref ile takip)
  const shouldAutoScrollRef = useRef(true);
  // Kullanıcı yukarıdaysa yeni mesaj sayacı ve ok butonu görünürlüğü
  const [unreadWhileScrolledUp, setUnreadWhileScrolledUp] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const prevMessagesLengthRef = useRef(0);

  // Kullanıcının en altta olup olmadığını kontrol et (flex-col-reverse için)
  const isUserAtBottom = () => {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return true;
    
    const threshold = 5; // küçük tolerans: en ufak yukarı kaydırmada bile altta değil say
    // Flex-col-reverse'de en alta = scrollTop = 0
    return messagesContainer.scrollTop <= threshold;
  };

  useEffect(() => {
    // Sadece kullanıcı en alttayken otomatik scroll yap
    if (shouldAutoScrollRef.current && isUserAtBottom()) {
      scrollToBottom();
    }

    // Yeni mesajlar geldiğinde ve kullanıcı altta değilse sayaç artır
    const prevLen = prevMessagesLengthRef.current;
    const currLen = messages.length;
    if (currLen > prevLen) {
      if (!isUserAtBottom()) {
        setUnreadWhileScrolledUp((prev) => prev + (currLen - prevLen));
        setShowScrollToBottom(true);
      } else {
        // Alttaysak sayacı sıfırla ve butonu gizle
        setUnreadWhileScrolledUp(0);
        setShowScrollToBottom(false);
      }
    }
    prevMessagesLengthRef.current = currLen;
  }, [messages]);

  // İlk yükleme veya sekme değişiminde sadece kullanıcı alttaysa otomatik scroll yap
  useEffect(() => {
    if (!isLoading && messages.length > 0 && shouldAutoScrollRef.current) {
      // İlk yükleme için kısa bir gecikme ile scroll yap (DOM'un render olması için)
      const t = setTimeout(() => {
        if (shouldAutoScrollRef.current && isUserAtBottom()) {
          scrollToBottom();
        }
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isLoading, selectedTab, messages]);

  // Mount/sekme değişiminde mevcut scroll konumuna göre ok görünürlüğünü ayarla
  useEffect(() => {
    const container = document.getElementById('messages-container');
    if (!container) return;
    const threshold = 5;
    const atBottom = container.scrollTop <= threshold;
    setShowScrollToBottom(!atBottom);
    if (atBottom) setUnreadWhileScrolledUp(0);
  }, [selectedTab]);

  // Socket.IO event listeners for calls
  useEffect(() => {
    if (!socket) return;

    // Handle incoming call
    socket.on('call:incoming', (data: { callerId: string; type: 'audio' | 'video'; groupId?: string; callId?: string }) => {
      console.log('Incoming call received:', data);
      // Eğer zaten bir active call varsa, yeni call'u reddet
      if (activeCall || isInCall) {
        console.log('Already in a call, rejecting incoming call');
        socket.emit('call:reject', { callerId: data.callerId });
        return;
      }
      setIncomingCall(data);
    });

    // Handle call accepted (caller receives this when receiver accepts)
    socket.on('call:accepted', (data: { callId: string; receiverId: string }) => {
      console.log('Call accepted:', data);
      if (activeCall && activeCall.id === data.callId) {
        // Call is now active, update UI if needed
        // The call is already set as active, so just ensure it's in the right state
        setIsInCall(true);
      }
    });

    // Handle call rejected
    socket.on('call:rejected', () => {
      console.log('Call rejected');
      if (activeCall) {
        setActiveCall(null);
        setIsInCall(false);
        alert('Çağrı reddedildi');
      }
    });

    // Handle call ended
    socket.on('call:ended', () => {
      console.log('Call ended');
      if (activeCall) {
        setActiveCall(null);
        setIsInCall(false);
      }
      setIncomingCall(null);
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:ended');
    };
  }, [socket, activeCall]);

  // Start call function
  const startCall = async (receiverId: string, type: 'audio' | 'video') => {
    if (!socket || !session?.user?.id) return;

    try {
      // Create call in database
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId,
          type,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to create call');
      }

      const call = await res.json();

      // Initiate call via socket with call ID
      socket.emit('call:initiate', {
        receiverId,
        type,
        callId: call.id,
      });

      // Set active call (caller side - connecting state)
      setActiveCall({
        id: call.id,
        callerId: session.user.id,
        receiverId,
        type,
        isCaller: true,
      });

      setIsInCall(true);
      setShowCallDialog(false);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Çağrı başlatılamadı');
    }
  };

  // Accept call function
  const acceptCall = async () => {
    if (!incomingCall || !socket || !session?.user?.id) return;

    try {
      let callId = incomingCall.callId;

      // Eğer callId yoksa, veritabanından bul
      if (!callId) {
        const callsRes = await fetch('/api/calls?status=pending', {
          credentials: 'include',
        });
        const calls = await callsRes.json();
        const call = calls.find((c: any) => c.callerId === incomingCall.callerId && c.status === 'pending');
        if (!call) {
          throw new Error('Call not found');
        }
        callId = call.id;
      }

      // Accept call
      const acceptRes = await fetch(`/api/calls/${callId}/accept`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!acceptRes.ok) {
        throw new Error('Failed to accept call');
      }

      // Set active call
      if (callId) {
        setActiveCall({
          id: callId,
          callerId: incomingCall.callerId,
          receiverId: session.user.id,
          type: incomingCall.type,
          isCaller: false,
        });
      }

      setIsInCall(true);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      alert('Çağrı kabul edilemedi');
      setIncomingCall(null);
    }
  };

  // Reject call function
  const rejectCall = async () => {
    if (!incomingCall || !socket || !session?.user?.id) return;

    try {
      let callId = incomingCall.callId;

      // Eğer callId yoksa, veritabanından bul
      if (!callId) {
        const callsRes = await fetch('/api/calls?status=pending', {
          credentials: 'include',
        });
        const calls = await callsRes.json();
        const call = calls.find((c: any) => c.callerId === incomingCall.callerId && c.status === 'pending');
        if (call) {
          callId = call.id;
        }
      }

      if (callId) {
        // Reject call
        await fetch(`/api/calls/${callId}/reject`, {
          method: 'POST',
          credentials: 'include',
        }).catch(err => console.error('Reject call API error:', err));
      }

      // Notify caller via socket
      socket.emit('call:reject', {
        callerId: incomingCall.callerId,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
      setIncomingCall(null);
    }
  };

  // End call function
  const endCall = async () => {
    if (!activeCall || !socket) return;

    try {
      // End call in database
      await fetch(`/api/calls/${activeCall.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      // Notify other party via socket
      socket.emit('call:end', {
        targetId: activeCall.isCaller ? activeCall.receiverId : activeCall.callerId,
      });

      setActiveCall(null);
      setIsInCall(false);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  const sendMessage = async (type: Message['type'] = 'text', file?: File, locationData?: { lat: number; lng: number; name: string }, liveLocationDuration?: number) => {
    if (isSending) return;
    
    // İletme modunda
    if (forwardingMessage) {
      try {
        setIsSending(true);
        const res = await fetch(`/api/messages/${(forwardingMessage as Message).id}/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: selectedTab }),
          credentials: 'include',
        });
        if (res.ok) {
        const newMessage = await res.json();
        setMessages(prev => [...prev, newMessage]);
          setForwardingMessage(null);
        if (shouldAutoScrollRef.current) {
          scrollToBottom();
        }
        } else {
          const error = await res.json();
          alert(error.error || 'Mesaj iletilenemedi');
        }
      } catch (error) {
        console.error('Forward message error:', error);
        alert('Mesaj iletilenemedi');
      } finally {
        setIsSending(false);
      }
      return;
    }
    
    if (type === 'text' && !inputText.trim() && !file) return;
    if ((type === 'image' || type === 'video' || type === 'document' || type === 'file') && !file) return;
    if (type === 'audio' && !file) return;
    if (type === 'location' && !locationData) return;
    if (type === 'live_location' && (!locationData || !liveLocationDuration)) return;

    setIsSending(true);
    try {
      // Mention'ları @[userId:displayName] formatına çevir
      // Zero Width Space ile işaretlenmiş mention'ları bul ve çevir
      let processedContent = inputText;
      if (inputText) {
        // Zero Width Space (U+200B) ile işaretlenmiş mention'ları bul
        // Format: \u200B@MENTION:userId:\u200BdisplayName\u200B (boşlukla bitiyor)
        // Regex: marker'dan başlayıp end marker'a kadar olan kısmı al
        const mentionRegex = /\u200B@MENTION:([^:]+):\u200B([^\u200B]+)\u200B(\s+|$)/g;
        processedContent = processedContent.replace(mentionRegex, (match, userId, displayName, trailingSpace) => {
          // Display name'den başındaki ve sonundaki boşlukları temizle
          const cleanDisplayName = displayName.trim();
          // Mention formatına çevir ve trailing space'i koru
          return `@[${userId}:${cleanDisplayName}]${trailingSpace}`;
        });
      }

      const formData = new FormData();
      formData.append('type', type);
      if (selectedTab) {
        formData.append('groupId', selectedTab); // Seçili grup ID'si
      }
      // selectedTab null ise groupId göndermiyoruz (LPBH/HERKES için)
      
      if (forwardingMessage) {
        formData.append('forwardedFromId', (forwardingMessage as Message).id);
      }
      
      if (type === 'text') {
        formData.append('content', processedContent);
      } else if (file) {
        formData.append('file', file);
        if (processedContent.trim()) {
          formData.append('content', processedContent);
        }
      }

      if (replyingTo) {
        formData.append('repliedToId', replyingTo.id);
      }

      if (locationData) {
        formData.append('latitude', locationData.lat.toString());
        formData.append('longitude', locationData.lng.toString());
        if (locationData.name) {
          formData.append('locationName', locationData.name);
        }
      }

      if (liveLocationDuration) {
        formData.append('liveLocationDuration', liveLocationDuration.toString());
      }

      const res = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        setReplyingTo(null);
        setShowEmojiPicker(false);
        setAudioBlob(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (shouldAutoScrollRef.current) {
          scrollToBottom();
        }
      } else {
        const error = await res.json();
        alert(error.error || 'Mesaj gönderilemedi');
      }
    } catch (error) {
      console.error('Send message error:', error);
      alert('Mesaj gönderilemedi');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isDocument = file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text') || 
                       file.type.includes('msword') || file.type.includes('spreadsheet') || file.type.includes('presentation');

    if (isImage) {
      sendMessage('image', file);
    } else if (isVideo) {
      sendMessage('video', file);
    } else if (isDocument) {
      sendMessage('document', file);
    } else {
      sendMessage('file', file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      const startTime = Date.now();
      setRecordingStartTime(startTime);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (!recordingCanceled && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        setMediaRecorder(null);
        setRecordingCanceled(false);
        setRecordingStartTime(0);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
      setRecordingCanceled(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Mikrofon erişimi reddedildi');
    }
  };

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recording && recordingStartTime > 0) {
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - recordingStartTime) / 1000));
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recording, recordingStartTime]);

  const stopRecording = (canceled: boolean = false) => {
    if (mediaRecorder && recording) {
      setRecordingCanceled(canceled);
      mediaRecorder.stop();
    }
  };

  // Textarea auto-resize - Mobilde sabit 1 satır, desktop'ta otomatik
  useEffect(() => {
    if (textareaRef.current) {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // Mobilde her zaman 1 satır (40px) - vertical center için
        textareaRef.current.style.height = '40px';
        textareaRef.current.style.overflow = 'hidden';
        textareaRef.current.style.lineHeight = '24px'; // Dikey hizalama için
        textareaRef.current.style.paddingTop = '8px';
        textareaRef.current.style.paddingBottom = '8px';
      } else {
        // Desktop'ta otomatik yükseklik
        textareaRef.current.style.height = 'auto';
        const scrollHeight = textareaRef.current.scrollHeight;
        const maxHeight = 128; // ~8 satır
        textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
      }
    }
    
    // Window resize listener
    const handleResize = () => {
      if (textareaRef.current) {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          textareaRef.current.style.height = '40px';
          textareaRef.current.style.overflow = 'hidden';
          textareaRef.current.style.lineHeight = '24px';
          textareaRef.current.style.paddingTop = '8px';
          textareaRef.current.style.paddingBottom = '8px';
        } else {
          textareaRef.current.style.height = 'auto';
          const scrollHeight = textareaRef.current.scrollHeight;
          const maxHeight = 128;
          textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
          textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [inputText]);

  const sendAudio = async () => {
    if (!audioBlob) return;
    
    const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
    await sendMessage('audio', audioFile);
  };

  const handleLocationSelect = async (liveLocation: boolean, duration?: number) => {
    if (!navigator.geolocation) {
      alert('Konum servisi desteklenmiyor');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Reverse geocoding için (opsiyonel - şimdilik sadece koordinatlar)
        const locationName = `Konum (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
        
        if (liveLocation) {
          await sendMessage('live_location', undefined, { lat, lng, name: locationName }, duration);
        } else {
          await sendMessage('location', undefined, { lat, lng, name: locationName });
        }
        setShowLocationPicker(false);
        setShowLiveLocationOptions(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Konum alınamadı');
      }
    );
  };

  const getUserDisplayName = (sender: Message['sender'] | { rutbe: string | null; isim: string | null; soyisim: string | null; username: string }) => {
    if (sender.isim || sender.soyisim) {
      return `${sender.isim || ''} ${sender.soyisim || ''}`.trim();
    }
    return sender.username;
  };

  const getUserFullDisplayName = (user: User) => {
    const parts = [];
    if (user.rutbe) parts.push(user.rutbe);
    if (user.isim) parts.push(user.isim);
    if (user.soyisim) parts.push(user.soyisim);
    return parts.length > 0 ? parts.join(' ') : user.username;
  };

  const handleMentionSelect = (user: User) => {
    if (textareaRef.current && mentionStartIndex !== -1) {
      const currentValue = inputText;
      const cursorPos = textareaRef.current.selectionStart || currentValue.length;
      const textBefore = currentValue.substring(0, mentionStartIndex);
      // @ ile cursor arasındaki kısmı bul ve sil
      const textBetween = currentValue.substring(mentionStartIndex, cursorPos);
      const textAfter = currentValue.substring(cursorPos);
      
      // Kullanıcıya görünen format: sadece display name (WhatsApp gibi)
      // Arka planda görünmez bir işaretçi ekle (Zero Width Space + özel karakter)
      // Bu sayede mesaj gönderilirken mention olarak tanınabilir
      const displayName = getUserFullDisplayName(user);
      // Zero Width Space (U+200B) ile mention'ı işaretle
      // Format: \u200B@MENTION:userId:\u200BdisplayName\u200B (sonunda da \u200B var, böylece display name'in sonunu işaretler)
      const mentionMarker = '\u200B@MENTION:' + user.id + ':\u200B';
      const mentionEndMarker = '\u200B';
      const mentionText = `${mentionMarker}${displayName}${mentionEndMarker} `;
      const newText = textBefore + mentionText + textAfter;
      setInputText(newText);
      setShowMentionList(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      
      // Focus'u geri al ve cursor'u mention'tan sonra konumlandır
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = textBefore.length + mentionText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Bugün';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Dün';
    } else {
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    }
  };

  const isOwnMessage = (message: Message) => {
    return message.senderId === session?.user?.id;
  };

  const canEditMessage = (message: Message) => {
    if (message.type !== 'text') return false;
    const permissions = (session as any)?.user?.permissions;
    return isOwnMessage(message) || hasPermission(permissions, 'messages', 'update');
  };

  const canDeleteMessage = (message: Message) => {
    const permissions = (session as any)?.user?.permissions;
    return isOwnMessage(message) || hasPermission(permissions, 'messages', 'delete');
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
        credentials: 'include',
      });

      if (res.ok) {
        const updatedMessage = await res.json();
        setMessages(prev => prev.map(m => m.id === messageId ? updatedMessage : m));
        setEditingMessageId(null);
        setEditText('');
      } else {
        const error = await res.json();
        alert(error.error || 'Mesaj güncellenemedi');
      }
    } catch (error) {
      console.error('Edit message error:', error);
      alert('Mesaj güncellenemedi');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Bu mesajı silmek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } else {
        const error = await res.json();
        alert(error.error || 'Mesaj silinemedi');
      }
    } catch (error) {
      console.error('Delete message error:', error);
      alert('Mesaj silinemedi');
    }
  };

  const accessibleTabs = getAccessibleTabs();

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-none md:rounded-lg border-0 md:border border-gray-700/50 shadow-2xl w-full relative bg-gradient-to-b from-background via-background-secondary/30 to-background overflow-hidden" style={{ zIndex: 1, overflowX: 'hidden' }}>
      {/* Header - Telegram/WhatsApp Style */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent backdrop-blur-lg border-b border-primary/20 flex-shrink-0 w-full sticky top-0 z-30 shadow-lg">
        <div className="px-3 py-2.5 md:px-4 md:py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Sohbet
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Private Message Button */}
              <button
                onClick={() => setShowPrivateMessageDialog(true)}
                className="p-2 text-gray-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                title="Özel mesaj gönder"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {/* Voice Call Button */}
              <button
                onClick={() => {
                  if (selectedRecipient) {
                    startCall(selectedRecipient.id, 'audio');
                  } else {
                    setCallType('audio');
                    setShowCallDialog(true);
                  }
                }}
                className="p-2 text-gray-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                title="Sesli arama"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              {/* Video Call Button */}
              <button
                onClick={() => {
                  if (selectedRecipient) {
                    startCall(selectedRecipient.id, 'video');
                  } else {
                    setCallType('video');
                    setShowCallDialog(true);
                  }
                }}
                className="p-2 text-gray-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                title="Görüntülü arama"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              {/* Search Button */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95"
                title="Ara"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              {/* Pinned Messages Button */}
              <button
                onClick={async () => {
                  setShowPinnedMessages(!showPinnedMessages);
                  if (!showPinnedMessages) {
                    try {
                      const params = new URLSearchParams();
                      if (selectedTab) {
                        params.append('groupId', selectedTab);
                      }
                      const res = await fetch(`/api/messages/pinned?${params.toString()}`, {
                        credentials: 'include',
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setPinnedMessages(data);
                      }
                    } catch (error) {
                      console.error('Pinned messages fetch error:', error);
                    }
                  }
                }}
                className="p-2 text-gray-300 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95 relative"
                title="Sabitli mesajlar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {pinnedMessages.length > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Search Bar - Telegram Style */}
          {showSearch && (
            <div className="mb-3 animate-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      try {
                        const params = new URLSearchParams();
                        params.append('q', searchQuery);
                        params.append('limit', '50');
                        if (selectedTab) {
                          params.append('groupId', selectedTab);
                        }
                        const res = await fetch(`/api/messages/search?${params.toString()}`, {
                          credentials: 'include',
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setMessages(data.reverse());
                        }
                      } catch (error) {
                        console.error('Search error:', error);
                      }
                    }
                  }}
                  placeholder="Mesajlarda ara..."
                  className="w-full px-4 py-2.5 pl-10 bg-background/50 backdrop-blur-sm border border-primary/20 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-gray-500"
                  autoFocus
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={async () => {
                      setSearchQuery('');
                      setShowSearch(false);
                      await fetchMessages();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Pinned Messages - Telegram Style */}
          {showPinnedMessages && pinnedMessages.length > 0 && (
            <div className="mb-3 p-3 bg-background/60 backdrop-blur-sm rounded-xl border border-primary/20 max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <div className="text-xs text-gray-300 font-semibold">Sabitli Mesajlar ({pinnedMessages.length})</div>
              </div>
              {pinnedMessages.map((pinnedMsg) => (
                <button
                  key={pinnedMsg.id}
                  onClick={() => {
                    const messageElement = document.getElementById(`message-${pinnedMsg.id}`);
                    if (messageElement) {
                      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      messageElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
                      setTimeout(() => {
                        messageElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
                      }, 2000);
                    }
                    setShowPinnedMessages(false);
                  }}
                  className="w-full text-left p-2.5 hover:bg-primary/10 rounded-lg transition-all text-sm mb-1.5 border border-transparent hover:border-primary/20 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-rye text-xs text-primary font-bold">{pinnedMsg.sender.rutbe || ''}</span>
                    <span className="text-xs font-semibold text-white">{getUserDisplayName(pinnedMsg.sender)}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {pinnedMsg.content || `${pinnedMsg.type} mesajı`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tabs - Telegram Style */}
          <div className="flex overflow-x-auto scrollbar-hide gap-2 -mx-3 md:-mx-4 px-3 md:px-4 pb-1">
            {accessibleTabs.map((tab) => (
              <button
                key={tab.id || 'all'}
                onClick={() => {
                  // Sekme değişiminde yeni sekmeye geçerken auto-scroll izni ver
                  shouldAutoScrollRef.current = true;
                  setSelectedTab(tab.id);
                }}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-xl relative ${
                  selectedTab === tab.id
                    ? 'text-white bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/30'
                    : 'text-gray-400 hover:text-white hover:bg-background-tertiary/50 active:scale-95'
                }`}
              >
                {tab.name}
                {selectedTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages - Telegram/WhatsApp Style */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {/* Aşağı in butonu - sol altta, yeni mesaj sayacıyla (scroll'dan bağımsız görünür) */}
        {showScrollToBottom && (
          <button
            onClick={() => {
              scrollToBottom();
              setUnreadWhileScrolledUp(0);
              setShowScrollToBottom(false);
            }}
            className="absolute right-4 bottom-28 z-[200] bg-primary text-white rounded-full shadow-lg hover:bg-primary/90 active:scale-95 transition flex items-center gap-2 px-3 py-2 pointer-events-auto"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 13l-7 7-7-7M12 20V4" />
            </svg>
            {unreadWhileScrolledUp > 0 && (
              <span className="ml-1 text-xs font-semibold bg-white text-primary rounded-full px-2 py-0.5">
                {unreadWhileScrolledUp}
              </span>
            )}
          </button>
        )}
        <div 
          id="messages-container"
          className="h-full overflow-y-auto overflow-x-hidden px-2 md:px-4 py-3 md:py-4 pb-56 space-y-2 md:space-y-3 w-full relative flex flex-col-reverse bg-gradient-to-b from-transparent via-background/20 to-background custom-scrollbar" 
          style={{ zIndex: 0 }}
          onScroll={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            const threshold = 5;
            // flex-col-reverse: en altta olmak = scrollTop <= threshold
            // track whether we should auto-scroll on new messages
            const atBottom = el.scrollTop <= threshold;
            shouldAutoScrollRef.current = atBottom;
            setShowScrollToBottom(!atBottom);
            if (atBottom) {
              setUnreadWhileScrolledUp(0);
            }
          }}
        >
          <div ref={messagesEndRef} />
          {messages.slice().reverse().map((message, reversedIndex) => {
          const own = isOwnMessage(message);
          // Reversed array'de prevMessage = reversed array'deki bir önceki mesaj
          const reversedMessages = messages.slice().reverse();
          const prevMessage = reversedIndex > 0 ? reversedMessages[reversedIndex - 1] : null;
          const showDateSeparator = !prevMessage || 
            new Date(message.createdAt).toDateString() !== new Date(prevMessage.createdAt).toDateString();
          const showSenderInfo = !prevMessage || 
            prevMessage.senderId !== message.senderId || 
            new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000; // 5 dakika

          return (
            <div key={message.id} id={`message-${message.id}`}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-2 md:my-4">
                  <div className="bg-background-tertiary px-3 py-1 rounded-full text-xs text-gray-400">
                    {formatDate(message.createdAt)}
                  </div>
                </div>
              )}

              <div
                className={`flex ${own ? 'justify-end' : 'justify-start'} group relative message-menu-container min-w-0 ${
                  selectedMessages.has(message.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  if (selectionMode) {
                    const newSelection = new Set(selectedMessages);
                    if (newSelection.has(message.id)) {
                      newSelection.delete(message.id);
                    } else {
                      newSelection.add(message.id);
                    }
                    setSelectedMessages(newSelection);
                    if (newSelection.size === 0) {
                      setSelectionMode(false);
                    }
                  }
                }}
              >
                {/* Message Menu Button */}
                <div className={`absolute ${own ? 'left-0 -translate-x-full mr-2' : 'right-0 translate-x-full ml-2'} top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 message-menu-container`}>
                  <button
                    onClick={() => setShowMessageMenu(showMessageMenu === message.id ? null : message.id)}
                    className="p-1.5 bg-background-tertiary hover:bg-background rounded-lg text-gray-400 hover:text-white transition shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  
                  {/* Message Menu */}
                  {showMessageMenu === message.id && (
                    <div className={`absolute ${own ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-background-secondary border border-gray-700 rounded-lg shadow-xl min-w-[180px] z-20 max-h-[400px] overflow-y-auto`}>
                      {!own && (
                        <button
                          onClick={() => {
                            setReplyingTo(message);
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-t-lg transition text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Yanıtla
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (forwardingMessage?.id === message.id) {
                            setForwardingMessage(null);
                          } else {
                            setForwardingMessage(message);
                          }
                          setShowMessageMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        İlet
                      </button>
                      <button
                        onClick={() => {
                          if (message.content) {
                            navigator.clipboard.writeText(message.content);
                            setShowMessageMenu(null);
                          }
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Kopyala
                      </button>
                      <button
                        onClick={() => {
                          const newSelection = new Set(selectedMessages);
                          if (newSelection.has(message.id)) {
                            newSelection.delete(message.id);
                          } else {
                            newSelection.add(message.id);
                          }
                          setSelectedMessages(newSelection);
                          if (newSelection.size === 0) {
                            setSelectionMode(false);
                          } else {
                            setSelectionMode(true);
                          }
                          setShowMessageMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Seç
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/messages/${message.id}/star`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ star: !message.isStarred }),
                              credentials: 'include',
                            });
                            if (res.ok) {
                              const updatedMessage = await res.json();
                              setMessages(prev => prev.map(m => m.id === message.id ? updatedMessage : m));
                            }
                          } catch (error) {
                            console.error('Star message error:', error);
                          }
                          setShowMessageMenu(null);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                      >
                        <svg className={`w-4 h-4 ${message.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        {message.isStarred ? 'Yıldızdan Çıkar' : 'Yıldızla'}
                      </button>
                      {message.senderId === session?.user?.id && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/messages/${message.id}/pin`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pin: !message.pinned }),
                                credentials: 'include',
                              });
                              if (res.ok) {
                                const updatedMessage = await res.json();
                                setMessages(prev => prev.map(m => m.id === message.id ? updatedMessage : m));
                                await fetchMessages();
                              }
                            } catch (error) {
                              console.error('Pin message error:', error);
                            }
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          {message.pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle'}
                        </button>
                      )}
                      {canEditMessage(message) && (
                        <button
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditText(message.content || '');
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Düzenle
                        </button>
                      )}
                      {canDeleteMessage(message) && (
                        <button
                          onClick={() => {
                            handleDeleteMessage(message.id);
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary text-red-400 hover:text-red-300 rounded-b-lg transition text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {editingMessageId === message.id ? (
                  <div className={`max-w-[75%] lg:max-w-[60%] rounded-2xl p-3 shadow-lg bg-background-tertiary border border-gray-700`}>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEditMessage(message.id, editText)}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditText('');
                        }}
                        className="px-3 py-1.5 bg-background-tertiary text-white rounded-lg hover:bg-gray-700 transition text-sm"
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[75%] lg:max-w-[60%] rounded-2xl p-3.5 shadow-xl min-w-0 transition-all ${
                      own
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-sm ml-auto'
                        : 'bg-background-secondary/80 backdrop-blur-sm text-white rounded-bl-sm border border-gray-700/50 mr-auto'
                    } ${replyingTo?.id === message.id ? 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : ''} ${
                      selectedMessages.has(message.id) ? 'ring-2 ring-primary' : ''
                    } hover:shadow-2xl`}
                    style={{ 
                      wordBreak: 'normal',
                      overflowWrap: 'break-word',
                      wordWrap: 'break-word',
                      hyphens: 'none',
                      overflow: message.type === 'audio' ? 'visible' : 'hidden',
                      minWidth: 0,
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!selectionMode) {
                        if (!own) {
                          setReplyingTo(message);
                        } else {
                          setShowMessageMenu(message.id);
                        }
                      }
                    }}
                  >
                  {/* Sender Info */}
                  {!own && showSenderInfo && (
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className={`text-xs font-rye ${message.sender.rutbe ? 'text-primary font-bold' : 'text-gray-400'}`}>
                        {message.sender.rutbe || ''}
                      </span>
                      <span className="text-xs font-semibold opacity-90">
                        {getUserDisplayName(message.sender)}
                      </span>
                    </div>
                  )}

                  {/* Forwarded Preview */}
                  {message.forwardedFrom && (
                    <div className={`mb-2 pb-2 border-l-2 ${own ? 'border-white/30' : 'border-primary/50'} pl-2 text-xs opacity-75 flex items-center gap-1`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                      <span className="font-semibold flex items-center gap-1">
                        <span className="font-rye">{message.forwardedFrom.sender.rutbe || ''}</span>
                        {getUserDisplayName(message.forwardedFrom.sender)} tarafından iletildi
                      </span>
                    </div>
                  )}

                  {/* Reply Preview */}
                  {message.repliedTo && (
                    <div className={`mb-2 pb-2 border-l-2 ${own ? 'border-white/30' : 'border-primary/50'} pl-2 text-xs opacity-75`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span className="font-rye">{message.repliedTo.sender.rutbe || ''}</span>
                        {getUserDisplayName(message.repliedTo.sender)}
                      </div>
                      <div className="truncate mt-0.5">
                        {message.repliedTo.type === 'text' && message.repliedTo.content}
                        {message.repliedTo.type === 'image' && '📷 Fotoğraf'}
                        {message.repliedTo.type === 'video' && '🎥 Video'}
                        {message.repliedTo.type === 'audio' && '🎤 Ses'}
                        {message.repliedTo.type === 'location' && '📍 Konum'}
                        {message.repliedTo.type === 'document' && '📄 ' + ((message.repliedTo as any).fileName || 'Dosya')}
                        {message.repliedTo.type === 'file' && '📎 ' + ((message.repliedTo as any).fileName || 'Dosya')}
                      </div>
                    </div>
                  )}

                  {/* Pinned Indicator */}
                  {message.pinned && (
                    <div className="mb-2 flex items-center gap-1 text-xs opacity-75">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      <span>Sabitli</span>
                    </div>
                  )}

                  {/* Message Content */}
                  {message.deletedAt ? (
                    <div className="italic text-gray-400 text-sm">
                      Bu mesaj silindi
                    </div>
                  ) : message.type === 'text' && (
                    <div 
                      className="whitespace-pre-wrap leading-relaxed"
                      style={{ 
                        wordBreak: 'normal',
                        overflowWrap: 'break-word',
                        wordWrap: 'break-word',
                        hyphens: 'none',
                      }}
                    >
                      {message.content?.split(/(@\[[^\]]+\])/g).map((part, index) => {
                        if (part.startsWith('@[') && part.endsWith(']')) {
                          // @[userId:displayName] formatını parse et
                          const mentionMatch = part.match(/@\[([^:]+):([^\]]+)\]/);
                          if (mentionMatch) {
                            const [, userId, displayName] = mentionMatch;
                            const isMentioned = userId === session?.user?.id;
                            // Mention edilen kullanıcı için highlight
                            return (
                              <span 
                                key={index} 
                                className={`font-semibold ${isMentioned ? 'bg-yellow-500/30 text-yellow-300 px-1 rounded' : own ? 'text-white' : 'text-gray-300'}`}
                              >
                                @{displayName}
                              </span>
                            );
                          }
                        }
                        return <span key={index}>{part}</span>;
                      })}
                    </div>
                  )}

                  {message.type === 'image' && message.mediaUrl && (
                    <div className="relative group">
                      <img
                        src={message.mediaUrl}
                        alt="Gönderilen resim"
                        onClick={() => {
                          // Tüm resimleri topla
                          const allImages = messages
                            .filter(m => m.type === 'image' && m.mediaUrl)
                            .map(m => ({ id: m.id, url: m.mediaUrl!, type: 'image' }));
                          setMediaGallery(allImages);
                          const currentIndex = allImages.findIndex(m => m.id === message.id);
                          setSelectedMedia({ url: message.mediaUrl!, type: 'image' });
                          setShowMediaViewer(true);
                        }}
                        className="max-w-full rounded-xl mb-2 shadow-lg cursor-pointer hover:opacity-90 transition-all hover:scale-[1.02]"
                        loading="lazy"
                      />
                      {message.content && (
                        <div className="mt-2 text-sm leading-relaxed">{message.content}</div>
                      )}
                      {/* Self-destruct timer */}
                      {message.selfDestruct && message.expiresAt && (
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {Math.max(0, Math.ceil((new Date(message.expiresAt).getTime() - Date.now()) / 1000))}s
                        </div>
                      )}
                    </div>
                  )}

                  {message.type === 'video' && message.mediaUrl && (
                    <div className="relative group">
                      <video
                        src={message.mediaUrl}
                        controls
                        onClick={(e) => {
                          e.preventDefault();
                          // Tüm videoları topla
                          const allVideos = messages
                            .filter(m => m.type === 'video' && m.mediaUrl)
                            .map(m => ({ id: m.id, url: m.mediaUrl!, type: 'video' }));
                          setMediaGallery(allVideos);
                          setSelectedMedia({ url: message.mediaUrl!, type: 'video' });
                          setShowMediaViewer(true);
                        }}
                        className="max-w-full rounded-xl mb-2 shadow-lg cursor-pointer hover:opacity-90 transition-all"
                        preload="metadata"
                      />
                      {message.content && (
                        <div className="mt-2 text-sm leading-relaxed">{message.content}</div>
                      )}
                      {/* Self-destruct timer */}
                      {message.selfDestruct && message.expiresAt && (
                        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {Math.max(0, Math.ceil((new Date(message.expiresAt).getTime() - Date.now()) / 1000))}s
                        </div>
                      )}
                    </div>
                  )}

                  {(message.type === 'document' || message.type === 'file') && message.mediaUrl && (
                    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-gray-700">
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        {message.type === 'document' ? (
                          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{message.fileName || 'Dosya'}</p>
                        {message.fileSize && (
                          <p className="text-xs text-gray-400">
                            {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                      <a
                        href={message.mediaUrl}
                        download={message.fileName}
                        className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm flex-shrink-0"
                      >
                        İndir
                      </a>
                    </div>
                  )}

                  {message.content && (message.type === 'document' || message.type === 'file') && (
                    <div className="mt-2">{message.content}</div>
                  )}

                  {message.type === 'audio' && message.mediaUrl && (
                    <VoiceMessagePlayer
                      messageId={message.id}
                      audioUrl={message.mediaUrl}
                      isOwn={own}
                      playingAudioId={playingAudioId}
                      currentTime={audioCurrentTimes[message.id] || 0}
                      duration={audioDurations[message.id] || 0}
                      progress={audioProgress[message.id] || 0}
                      onPlay={() => {
                        // Diğer oynatılan ses kayıtlarını durdur
                        Object.values(audioRefs.current).forEach(audio => {
                          if (audio && !audio.paused) {
                            audio.pause();
                            audio.currentTime = 0;
                          }
                        });
                        setPlayingAudioId(message.id);
                        const audio = audioRefs.current[message.id];
                        if (audio) {
                          audio.play();
                        }
                      }}
                      onPause={() => {
                        setPlayingAudioId(null);
                        const audio = audioRefs.current[message.id];
                        if (audio) {
                          audio.pause();
                        }
                      }}
                      onTimeUpdate={(time) => {
                        setAudioCurrentTimes(prev => ({ ...prev, [message.id]: time }));
                        const duration = audioDurations[message.id] || 0;
                        if (duration > 0) {
                          setAudioProgress(prev => ({ ...prev, [message.id]: (time / duration) * 100 }));
                        }
                      }}
                      onDurationUpdate={(duration) => {
                        setAudioDurations(prev => ({ ...prev, [message.id]: duration }));
                      }}
                      onProgressChange={(progress) => {
                        const audio = audioRefs.current[message.id];
                        if (audio && audioDurations[message.id]) {
                          const newTime = (progress / 100) * audioDurations[message.id];
                          audio.currentTime = newTime;
                          setAudioCurrentTimes(prev => ({ ...prev, [message.id]: newTime }));
                          setAudioProgress(prev => ({ ...prev, [message.id]: progress }));
                        }
                      }}
                      audioRef={(el) => {
                        if (el) {
                          audioRefs.current[message.id] = el;
                        } else {
                          delete audioRefs.current[message.id];
                        }
                      }}
                    />
                  )}

                  {(message.type === 'location' || message.type === 'live_location') && message.latitude && message.longitude && (
                    <div className="space-y-2">
                      {/* Location Name */}
                      {message.locationName && (
                        <div className="text-sm font-semibold">{message.locationName}</div>
                      )}
                      
                      {/* Google Maps Embed - WhatsApp Style */}
                      <div className="relative w-full rounded-xl overflow-hidden border border-gray-600/30" style={{ aspectRatio: '16/9', minHeight: '200px' }}>
                        <iframe
                          src={`https://www.google.com/maps?q=${message.latitude},${message.longitude}&hl=tr&z=15&output=embed`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                      
                      {/* Live Location Indicator */}
                      {message.type === 'live_location' && (
                        <div className="text-xs opacity-75 flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          Canlı konum
                          {message.liveLocationExpiresAt && (
                            <span> • {new Date(message.liveLocationExpiresAt).toLocaleString('tr-TR')} tarihine kadar</span>
                          )}
                        </div>
                      )}
                      
                      {/* Open in Maps Link */}
                      <a
                        href={`https://www.google.com/maps?q=${message.latitude},${message.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline opacity-75 hover:opacity-100 transition inline-flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Haritada aç
                      </a>
                    </div>
                  )}

                  {/* Reactions */}
                  {message.reactions && message.reactions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Array.from(new Set(message.reactions.map(r => r.emoji))).map((emoji) => {
                        const emojiReactions = message.reactions!.filter(r => r.emoji === emoji);
                        const hasReacted = emojiReactions.some(r => r.userId === session?.user?.id);
                        return (
                          <button
                            key={emoji}
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/messages/${message.id}/reaction`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ emoji, remove: hasReacted }),
                                  credentials: 'include',
                                });
                                if (res.ok) {
                                  const updatedMessage = await res.json();
                                  setMessages(prev => prev.map(m => m.id === message.id ? updatedMessage : m));
                                }
                              } catch (error) {
                                console.error('Reaction error:', error);
                              }
                            }}
                            className={`px-2 py-1 rounded-full text-xs border transition ${hasReacted 
                              ? 'bg-primary/20 border-primary/50' 
                              : own 
                                ? 'bg-white/10 border-white/20 hover:bg-white/20' 
                                : 'bg-background-tertiary border-gray-700 hover:bg-gray-700'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="ml-1">{emojiReactions.length}</span>
                          </button>
                        );
                      })}
                      <button
                        onClick={async () => {
                          // Emoji picker aç (basit versiyon - direkt 👍 ekle)
                          try {
                            const res = await fetch(`/api/messages/${message.id}/reaction`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ emoji: '👍', remove: false }),
                              credentials: 'include',
                            });
                            if (res.ok) {
                              const updatedMessage = await res.json();
                              setMessages(prev => prev.map(m => m.id === message.id ? updatedMessage : m));
                            }
                          } catch (error) {
                            console.error('Reaction error:', error);
                          }
                        }}
                        className={`px-2 py-1 rounded-full text-xs border transition ${own 
                          ? 'bg-white/10 border-white/20 hover:bg-white/20' 
                          : 'bg-background-tertiary border-gray-700 hover:bg-gray-700'
                        }`}
                        title="Reaksiyon ekle"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Reactions (if no reactions yet) */}
                  {(!message.reactions || message.reactions.length === 0) && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/messages/${message.id}/reaction`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ emoji: '👍', remove: false }),
                            credentials: 'include',
                          });
                          if (res.ok) {
                            const updatedMessage = await res.json();
                            setMessages(prev => prev.map(m => m.id === message.id ? updatedMessage : m));
                          }
                        } catch (error) {
                          console.error('Reaction error:', error);
                        }
                      }}
                      className={`mt-2 px-2 py-1 rounded-full text-xs border transition opacity-0 group-hover:opacity-100 ${own 
                        ? 'bg-white/10 border-white/20 hover:bg-white/20' 
                        : 'bg-background-tertiary border-gray-700 hover:bg-gray-700'
                      }`}
                      title="Reaksiyon ekle"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  )}

                  {/* Time and Read Receipts */}
                  <div className={`flex items-center gap-1 mt-0.5 ${own ? 'justify-end' : 'justify-start'}`}>
                    {message.editedAt && (
                      <span className={`text-xs ${own ? 'text-white/50' : 'text-gray-500'}`}>(düzenlendi)</span>
                    )}
                    <div className={`text-xs ${own ? 'text-white/70' : 'text-gray-400'}`}>
                      {formatTime(message.createdAt)}
                    </div>
                    {own && message.readReceipts && message.readReceipts.length > 0 && (
                      <div className="flex items-center gap-1">
                        {message.readReceipts.length >= 2 ? (
                          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Selection Mode Bar */}
      {selectionMode && selectedMessages.size > 0 && (
        <div className="px-4 py-3 bg-background-secondary border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-white">
            {selectedMessages.size} mesaj seçildi
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                // Toplu yıldızla
                for (const msgId of Array.from(selectedMessages)) {
                  try {
                    await fetch(`/api/messages/${msgId}/star`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ star: true }),
                      credentials: 'include',
                    });
                  } catch (error) {
                    console.error('Star error:', error);
                  }
                }
                setSelectedMessages(new Set());
                setSelectionMode(false);
                await fetchMessages();
              }}
              className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm"
            >
              Yıldızla
            </button>
            <button
              onClick={async () => {
                // Toplu sil
                if (confirm(`${selectedMessages.size} mesajı silmek istediğinizden emin misiniz?`)) {
                  for (const msgId of Array.from(selectedMessages)) {
                    try {
                      await fetch(`/api/messages/${msgId}`, {
                        method: 'DELETE',
                        credentials: 'include',
                      });
                    } catch (error) {
                      console.error('Delete error:', error);
                    }
                  }
                  setSelectedMessages(new Set());
                  setSelectionMode(false);
                  await fetchMessages();
                }
              }}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
            >
              Sil
            </button>
            <button
              onClick={() => {
                setSelectedMessages(new Set());
                setSelectionMode(false);
              }}
              className="px-3 py-1.5 bg-background-tertiary text-white rounded-lg hover:bg-gray-700 transition text-sm"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Forward Preview */}
      {forwardingMessage && (
        <div className="px-4 py-3 bg-background-secondary border-t border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            <div className="text-sm text-gray-300 truncate">
              {forwardingMessage.content || forwardingMessage.type} iletiliyor...
            </div>
          </div>
          <button
            onClick={() => setForwardingMessage(null)}
            className="text-gray-400 hover:text-white ml-3 transition flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Input Area - Telegram/WhatsApp Style */}
      <div className="px-3 py-2.5 md:px-4 md:py-3 overflow-visible w-full absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background-secondary/50 to-transparent backdrop-blur-lg border-t border-gray-700/30" style={{ zIndex: 100, position: 'absolute', transform: 'translateZ(0)' }}>
        {/* Reply Preview - Telegram Style */}
        {replyingTo && (
          <div className="mb-2.5 p-3 bg-background-secondary/80 backdrop-blur-sm rounded-xl border-l-4 border-primary shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-primary mb-1 font-semibold flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="font-rye">{replyingTo.sender.rutbe || ''}</span> {getUserDisplayName(replyingTo.sender)}
              </div>
              <div className="text-sm text-gray-300 truncate">
                {replyingTo.type === 'text' && replyingTo.content}
                {replyingTo.type === 'image' && '📷 Fotoğraf'}
                {replyingTo.type === 'video' && '🎥 Video'}
                {replyingTo.type === 'audio' && '🎤 Ses'}
                {replyingTo.type === 'location' && '📍 Konum'}
                {replyingTo.type === 'document' && '📄 ' + (replyingTo.fileName || 'Dosya')}
                {replyingTo.type === 'file' && '📎 ' + (replyingTo.fileName || 'Dosya')}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-primary ml-3 transition p-1 hover:bg-primary/10 rounded-lg active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Forward Preview - Telegram Style */}
        {forwardingMessage && (
          <div className="mb-2.5 p-3 bg-background-secondary/80 backdrop-blur-sm rounded-xl border-l-4 border-primary/50 shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              <div className="text-sm text-gray-300 truncate">
                {forwardingMessage.content || `${forwardingMessage.type} mesajı`} iletiliyor...
              </div>
            </div>
            <button
              onClick={() => setForwardingMessage(null)}
              className="text-gray-400 hover:text-primary ml-3 transition p-1 hover:bg-primary/10 rounded-lg active:scale-95 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Self-Destruct Timer Preview */}
        {selfDestructEnabled && selfDestructSeconds && (
          <div className="mb-2.5 p-2.5 bg-orange-500/20 backdrop-blur-sm rounded-lg border border-orange-500/30 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
            <svg className="w-4 h-4 text-orange-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-orange-300 font-semibold">
              Süreli mesaj: {selfDestructSeconds < 60 
                ? `${selfDestructSeconds}s` 
                : selfDestructSeconds < 3600 
                ? `${Math.floor(selfDestructSeconds / 60)}d`
                : selfDestructSeconds < 86400
                ? `${Math.floor(selfDestructSeconds / 3600)}s`
                : `${Math.floor(selfDestructSeconds / 86400)}g`
              } sonra silinecek
            </span>
            <button
              onClick={() => {
                setSelfDestructEnabled(false);
                setSelfDestructSeconds(null);
              }}
              className="ml-auto text-orange-400 hover:text-orange-300 transition p-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Audio Preview */}
        {audioBlob && !recording && (
          <div className="mb-2 md:mb-3 p-2 md:p-3 bg-background rounded-xl border border-gray-700 flex items-center gap-3 shadow-md">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              🎤
            </div>
            <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1" />
            <button
              onClick={() => setAudioBlob(null)}
              className="text-gray-400 hover:text-white transition p-1"
            >
              ×
            </button>
            <button
              onClick={sendAudio}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition shadow-lg"
            >
              Gönder
            </button>
          </div>
        )}

        {/* Recording UI - Full Width */}
        {recording && (
          <div 
            className="flex-1 flex items-center gap-2 bg-red-600/20 rounded-2xl px-4 py-3 border-2 border-red-600/50"
            onMouseUp={(e) => {
              const shouldCancel = Math.abs(recordingCurrentY - recordingStartY) > 50;
              stopRecording(shouldCancel);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              const shouldCancel = Math.abs(recordingCurrentY - recordingStartY) > 50;
              stopRecording(shouldCancel);
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center animate-pulse shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-red-600/30 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                  </div>
                  <span className="text-sm font-semibold text-white whitespace-nowrap flex-shrink-0">
                    {recordingDuration}s
                  </span>
                </div>
                {Math.abs(recordingCurrentY - recordingStartY) > 50 ? (
                  <p className="text-xs text-red-300 font-medium truncate">↑ Yukarı kaydırıp bırakınca iptal edilir</p>
                ) : (
                  <p className="text-xs text-white/70 truncate">↑ Yukarı kaydırarak iptal edebilirsiniz</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!recording && (
        <div className="flex items-end gap-2 min-w-0 bg-background-secondary/60 backdrop-blur-sm rounded-2xl p-2 border border-gray-700/30 shadow-lg" style={{ overflow: 'visible' }}>
          {/* Attachment Menu Button - Telegram Style */}
          <div className="relative" ref={locationPickerRef} style={{ zIndex: 10000, position: 'relative' }}>
            <button
              ref={attachmentButtonRef}
              onClick={() => {
                setShowAttachmentMenu(!showAttachmentMenu);
                setShowLocationPicker(false);
                setShowLiveLocationOptions(false);
              }}
              className="p-2.5 text-primary hover:text-primary/90 hover:bg-primary/10 rounded-xl transition-all active:scale-95 flex-shrink-0"
              title="Eklentiler"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            
            {showAttachmentMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-background-secondary/95 backdrop-blur-xl border border-primary/20 rounded-2xl p-2 shadow-2xl min-w-[220px] animate-in slide-in-from-bottom-2 duration-200" style={{ 
                zIndex: 99999,
                position: 'absolute',
                transform: 'translateZ(0)',
                isolation: 'isolate'
              }}>
                {/* File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,*/*"
                  onChange={(e) => {
                    handleFileSelect(e);
                    setShowAttachmentMenu(false);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*,video/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 text-white active:scale-[0.98] group"
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Fotoğraf/Video</div>
                    <div className="text-xs text-gray-400">Resim veya video seç</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = '*/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 text-white active:scale-[0.98] group mt-1"
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Dosya Gönder</div>
                    <div className="text-xs text-gray-400">Herhangi bir dosya seç</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowLocationPicker(true);
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 text-white active:scale-[0.98] group mt-1"
                >
                  <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Konum</div>
                    <div className="text-xs text-gray-400">Konum paylaş</div>
                  </div>
                </button>
              </div>
            )}

            {/* Location Picker (nested in menu) */}
            {showLocationPicker && (
              <div className="absolute bottom-full mb-2 left-0 bg-background-secondary border border-gray-700 rounded-xl p-2 shadow-xl min-w-[200px]" style={{ zIndex: 99999, position: 'absolute', transform: 'translateZ(0)', isolation: 'isolate' }}>
                <button
                  onClick={() => handleLocationSelect(false)}
                  className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-lg transition text-white"
                >
                  📍 Konum gönder
                </button>
                <button
                  onClick={() => {
                    setShowLiveLocationOptions(true);
                    setShowLocationPicker(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-lg transition text-white"
                >
                  🔴 Canlı konum gönder
                </button>
                <button
                  onClick={() => {
                    setShowLocationPicker(false);
                    setShowAttachmentMenu(true);
                  }}
                  className="w-full text-left px-3 py-2 text-gray-400 hover:bg-background-tertiary rounded-lg transition text-xs mt-1"
                >
                  ← Geri
                </button>
              </div>
            )}
            
            {showLiveLocationOptions && (
              <div className="absolute bottom-full mb-2 left-0 bg-background-secondary border border-gray-700 rounded-xl p-2 shadow-xl min-w-[200px]" style={{ zIndex: 99999, position: 'absolute', transform: 'translateZ(0)', isolation: 'isolate' }}>
                <div className="text-xs text-gray-400 mb-2 px-2">Süre seçin:</div>
                {[15, 30, 60, 120].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => handleLocationSelect(true, duration)}
                    className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-lg transition"
                  >
                    {duration} dakika
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowLiveLocationOptions(false);
                    setShowLocationPicker(true);
                  }}
                  className="w-full text-left px-3 py-2 text-gray-400 hover:bg-background-tertiary rounded-lg transition text-xs mt-1"
                >
                  ← Geri
                </button>
              </div>
            )}
          </div>

          {/* Self-Destruct Button */}
          <button
            onClick={() => {
              if (selfDestructEnabled) {
                setSelfDestructEnabled(false);
                setSelfDestructSeconds(null);
              } else {
                // Süreli mesaj seçenekleri göster
                const seconds = prompt('Mesajın kaç saniye sonra silinmesini istersiniz?\nÖrnek: 5, 10, 30, 60 (1 dakika), 3600 (1 saat), 86400 (1 gün)');
                if (seconds) {
                  const secs = parseInt(seconds);
                  if (!isNaN(secs) && secs > 0) {
                    setSelfDestructEnabled(true);
                    setSelfDestructSeconds(secs);
                  }
                }
              }
            }}
            className={`p-2.5 rounded-xl transition-all active:scale-95 flex-shrink-0 ${selfDestructEnabled 
              ? 'text-orange-400 bg-orange-500/20 hover:bg-orange-500/30' 
              : 'text-gray-400 hover:text-primary hover:bg-primary/10'
            }`}
            title="Süreli mesaj"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Text Input - Telegram Style */}
          <div className="flex-1 relative min-w-0" style={{ zIndex: 10000, position: 'relative', overflow: 'visible' }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                const value = e.target.value;
                setInputText(value);
                
                // Yazıyor... durumunu güncelle
                if (value.trim() && typingTimeout) {
                  clearTimeout(typingTimeout);
                }
                
                // Typing indicator gönder (debounce)
                const timeout = setTimeout(() => {
                  fetch('/api/messages/typing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupId: selectedTab, typing: true }),
                    credentials: 'include',
                  }).catch(console.error);
                }, 500);
                
                setTypingTimeout(timeout);
                
                // @mention kontrolü - cursor position'ı al
                const cursorPos = e.target.selectionStart || value.length;
                const textBeforeCursor = value.substring(0, cursorPos);
                const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                
                if (lastAtIndex !== -1) {
                  const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                  // Eğer zaten mention formatında değilse (@[userId:name] formatı kontrolü)
                  const isInMentionFormat = textBeforeCursor.substring(lastAtIndex).match(/@\[[^\]]+\]/);
                  
                  if (!isInMentionFormat) {
                    // Eğer @'den sonra boşluk, yeni satır veya başka bir @ yoksa mention modu aktif
                    if (textAfterAt && !textAfterAt.match(/[\s\n@]/)) {
                      setMentionStartIndex(lastAtIndex);
                      setMentionQuery(textAfterAt.toLowerCase());
                      setShowMentionList(true);
                      
                      // Kullanıcıları filtrele - Rütbe, İsim, Soyisim'e göre (WhatsApp gibi)
                      const query = textAfterAt.toLowerCase();
                      const filtered = users.filter(user => {
                        const rutbe = (user.rutbe || '').toLowerCase();
                        const isim = (user.isim || '').toLowerCase();
                        const soyisim = (user.soyisim || '').toLowerCase();
                        const fullName = `${rutbe} ${isim} ${soyisim}`.trim().toLowerCase();
                        
                        return rutbe.includes(query) || 
                               isim.includes(query) || 
                               soyisim.includes(query) ||
                               fullName.includes(query);
                      }).slice(0, 10); // Maksimum 10 kullanıcı göster
                      
                      setFilteredUsers(filtered);
                    } else if (textAfterAt === '' || textAfterAt.length === 0) {
                      // @ yazıldığında hemen listeyi göster
                      setMentionStartIndex(lastAtIndex);
                      setMentionQuery('');
                      setShowMentionList(true);
                      setFilteredUsers(users.slice(0, 10));
                    } else {
                      setShowMentionList(false);
                    }
                  } else {
                    // Zaten mention formatında, listeyi kapat
                    setShowMentionList(false);
                  }
                } else {
                  setShowMentionList(false);
                }
              }}
              onSelect={(e) => {
                // Cursor pozisyonu değiştiğinde mention kontrolü yap
                const target = e.target as HTMLTextAreaElement;
                const cursorPos = target.selectionStart || inputText.length;
                const textBeforeCursor = inputText.substring(0, cursorPos);
                const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                
                if (lastAtIndex !== -1) {
                  const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                  const isInMentionFormat = textBeforeCursor.substring(lastAtIndex).match(/@\[[^\]]+\]/);
                  
                  if (!isInMentionFormat) {
                    if (textAfterAt && !textAfterAt.match(/[\s\n@]/)) {
                      setMentionStartIndex(lastAtIndex);
                      setMentionQuery(textAfterAt.toLowerCase());
                      setShowMentionList(true);
                      
                      // Kullanıcıları filtrele - Rütbe, İsim, Soyisim'e göre (WhatsApp gibi)
                      const query = textAfterAt.toLowerCase();
                      const filtered = users.filter(user => {
                        const rutbe = (user.rutbe || '').toLowerCase();
                        const isim = (user.isim || '').toLowerCase();
                        const soyisim = (user.soyisim || '').toLowerCase();
                        const fullName = `${rutbe} ${isim} ${soyisim}`.trim().toLowerCase();
                        
                        return rutbe.includes(query) || 
                               isim.includes(query) || 
                               soyisim.includes(query) ||
                               fullName.includes(query);
                      }).slice(0, 10);
                      
                      setFilteredUsers(filtered);
                    } else if (textAfterAt === '') {
                      setMentionStartIndex(lastAtIndex);
                      setMentionQuery('');
                      setShowMentionList(true);
                      setFilteredUsers(users.slice(0, 10));
                    } else {
                      setShowMentionList(false);
                    }
                  } else {
                    setShowMentionList(false);
                  }
                } else {
                  setShowMentionList(false);
                }
              }}
              onFocus={(e) => {
                // Sadece mobilde (klavye açılınca) textarea'yı görünür yap
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 300);
                }
              }}
              onKeyDown={(e) => {
                // Mention listesi açıksa
                if (showMentionList && filteredUsers.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    // TODO: Implement keyboard navigation
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    // TODO: Implement keyboard navigation
                  } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    // İlk kullanıcıyı seç
                    handleMentionSelect(filteredUsers[0]);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowMentionList(false);
                  }
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={selectedRecipient ? `${getUserFullDisplayName(selectedRecipient)}'e özel mesaj yazın...` : "Mesaj yazın..."}
              rows={1}
              className="w-full px-4 py-3 pr-12 border-0 text-white bg-background-secondary/80 backdrop-blur-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none overflow-hidden shadow-inner text-sm leading-relaxed placeholder:text-gray-500"
              style={{ 
                wordBreak: 'normal',
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                hyphens: 'none',
                minWidth: 0,
                boxSizing: 'border-box',
                maxHeight: '120px',
              }}
            />
            
            {/* Emoji Picker - Telegram Style */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10" ref={emojiPickerRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all active:scale-95 pointer-events-auto"
                title="Emoji"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 right-0 shadow-2xl rounded-2xl overflow-hidden" style={{ zIndex: 99999, position: 'absolute', transform: 'translateZ(0)', isolation: 'isolate' }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setInputText(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                    theme={Theme.DARK}
                    width={350}
                    height={400}
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled
                  />
                </div>
              )}
            </div>

            {/* Mention List - WhatsApp Style */}
            {showMentionList && filteredUsers.length > 0 && (
              <div 
                data-mention-list
                className="absolute bottom-full mb-2 left-0 w-full max-w-[320px] bg-background-secondary border border-gray-700 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-[99999]" 
                style={{ position: 'absolute' }}
              >
                {filteredUsers.map((user, index) => (
                  <button
                    key={user.id}
                    onClick={() => handleMentionSelect(user)}
                    className={`w-full text-left px-4 py-3 hover:bg-background-tertiary transition flex items-center gap-3 ${
                      index === 0 ? 'bg-background-tertiary/50' : ''
                    } ${index === 0 ? 'rounded-t-xl' : ''} ${index === filteredUsers.length - 1 ? 'rounded-b-xl' : ''}`}
                  >
                    {/* Profile Picture - WhatsApp Style */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-white font-semibold text-sm">
                      {user.isim || user.soyisim 
                        ? `${(user.isim || '').charAt(0).toUpperCase()}${(user.soyisim || '').charAt(0).toUpperCase()}`
                        : user.username.charAt(0).toUpperCase()
                      }
                    </div>
                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {getUserFullDisplayName(user)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Record/Send Button - WhatsApp Style */}
          {!recording && !audioBlob && (
            <>
              {/* Mikrofon Butonu - Sadece yazı yokken göster */}
              {!inputText.trim() && !replyingTo && (
                <button
                  ref={recordButtonRef}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setRecordingStartY(e.clientY);
                    setRecordingCurrentY(e.clientY);
                    startRecording();
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    if (recording) {
                      const shouldCancel = Math.abs(recordingCurrentY - recordingStartY) > 50;
                      stopRecording(shouldCancel);
                    }
                  }}
                  onMouseMove={(e) => {
                    if (recording) {
                      setRecordingCurrentY(e.clientY);
                    }
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    setRecordingStartY(touch.clientY);
                    setRecordingCurrentY(touch.clientY);
                    startRecording();
                  }}
                  onTouchMove={(e) => {
                    if (recording && e.touches[0]) {
                      const touch = e.touches[0];
                      setRecordingCurrentY(touch.clientY);
                    }
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (recording) {
                      const shouldCancel = Math.abs(recordingCurrentY - recordingStartY) > 50;
                      stopRecording(shouldCancel);
                    }
                  }}
                  className="p-2 md:p-2.5 text-gray-400 hover:text-gray-300 hover:bg-background rounded-lg transition active:scale-95"
                  title="Ses kaydı için basılı tutun"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}

              {/* Gönder Butonu - Telegram/WhatsApp Style */}
              {(inputText.trim() || replyingTo || forwardingMessage) && (
                <button
                  onClick={() => sendMessage()}
                  disabled={isSending}
                  className="p-3 bg-gradient-to-br from-primary to-primary/90 text-white rounded-xl hover:from-primary/90 hover:to-primary/80 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                  title="Gönder"
                >
                  {isSending ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              )}
            </>
          )}
          </div>
        )}
      </div>

      {/* Media Viewer Modal - Telegram Style */}
      {showMediaViewer && selectedMedia && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowMediaViewer(false)}
        >
          <button
            onClick={() => setShowMediaViewer(false)}
            className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {selectedMedia.type === 'image' && (
            <img
              src={selectedMedia.url}
              alt="Görüntüle"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {selectedMedia.type === 'video' && (
            <video
              src={selectedMedia.url}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          {/* Navigation Arrows */}
          {mediaGallery.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = mediaGallery.findIndex(m => m.url === selectedMedia.url);
                  const prevIndex = currentIndex > 0 ? currentIndex - 1 : mediaGallery.length - 1;
                  setSelectedMedia({ url: mediaGallery[prevIndex].url, type: mediaGallery[prevIndex].type });
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const currentIndex = mediaGallery.findIndex(m => m.url === selectedMedia.url);
                  const nextIndex = currentIndex < mediaGallery.length - 1 ? currentIndex + 1 : 0;
                  setSelectedMedia({ url: mediaGallery[nextIndex].url, type: mediaGallery[nextIndex].type });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Private Message Dialog - Telegram Style */}
      {showPrivateMessageDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background-secondary rounded-2xl border border-primary/20 shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Özel Mesaj Gönder</h2>
              <button
                onClick={() => {
                  setShowPrivateMessageDialog(false);
                  setSelectedRecipient(null);
                }}
                className="p-2 text-gray-400 hover:text-white hover:bg-background-tertiary rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <input
                type="text"
                placeholder="Kullanıcı ara..."
                onChange={(e) => {
                  const query = e.target.value.toLowerCase();
                  setFilteredUsers(users.filter(user => {
                    const rutbe = (user.rutbe || '').toLowerCase();
                    const isim = (user.isim || '').toLowerCase();
                    const soyisim = (user.soyisim || '').toLowerCase();
                    const fullName = `${rutbe} ${isim} ${soyisim}`.trim().toLowerCase();
                    return rutbe.includes(query) || isim.includes(query) || soyisim.includes(query) || fullName.includes(query);
                  }).slice(0, 20));
                }}
                className="w-full px-4 py-2.5 bg-background border border-gray-700 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-gray-500"
              />
              
              <div className="space-y-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedRecipient(user);
                      setShowPrivateMessageDialog(false);
                    }}
                    className="w-full p-3 hover:bg-primary/10 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {user.isim || user.soyisim 
                        ? `${(user.isim || '').charAt(0).toUpperCase()}${(user.soyisim || '').charAt(0).toUpperCase()}`
                        : user.username.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {getUserFullDisplayName(user)}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        @{user.username}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Dialog - Telegram Style */}
      {showCallDialog && !selectedRecipient && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background-secondary rounded-2xl border border-primary/20 shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${callType === 'audio' ? 'bg-primary/20' : 'bg-primary/20'}`}>
                {callType === 'audio' ? (
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {callType === 'audio' ? 'Sesli Arama' : 'Görüntülü Arama'}
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Önce bir alıcı seçmeniz gerekiyor
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCallDialog(false);
                  setCallType(null);
                }}
                className="flex-1 px-4 py-3 bg-background-tertiary text-white rounded-xl hover:bg-gray-700 transition font-semibold"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  setShowCallDialog(false);
                  setCallType(null);
                  setShowPrivateMessageDialog(true);
                }}
                className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition font-semibold"
              >
                Alıcı Seç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call Dialog */}
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background-secondary rounded-2xl border border-primary/20 shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/20 animate-pulse`}>
                {incomingCall.type === 'audio' ? (
                  <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {incomingCall.type === 'audio' ? 'Sesli Arama' : 'Görüntülü Arama'}
              </h2>
              <p className="text-gray-400">
                Gelen çağrı...
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={rejectCall}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition font-semibold"
              >
                Reddet
              </button>
              <button
                onClick={acceptCall}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl transition font-semibold"
              >
                Kabul Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call - Video */}
      {activeCall && activeCall.type === 'video' && (
        <VideoCall
          socket={socket}
          callId={activeCall.id}
          callerId={activeCall.callerId}
          receiverId={activeCall.receiverId}
          isCaller={activeCall.isCaller}
          onEndCall={endCall}
          onAccept={activeCall.isCaller ? undefined : acceptCall}
          onReject={activeCall.isCaller ? undefined : rejectCall}
        />
      )}

      {/* Active Call - Audio */}
      {activeCall && activeCall.type === 'audio' && (
        <AudioCall
          socket={socket}
          callId={activeCall.id}
          callerId={activeCall.callerId}
          receiverId={activeCall.receiverId}
          isCaller={activeCall.isCaller}
          onEndCall={endCall}
          onAccept={activeCall.isCaller ? undefined : acceptCall}
          onReject={activeCall.isCaller ? undefined : rejectCall}
        />
      )}
    </div>
  );
}
