'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { hasPermission } from '@/lib/auth';

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
  type: 'text' | 'image' | 'video' | 'audio' | 'location' | 'live_location';
  content: string | null;
  mediaPath: string | null;
  mediaUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  liveLocationExpiresAt: string | null;
  repliedToId: string | null;
  senderId: string;
  groupId: string | null;
  createdAt: string;
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

  // Kullanıcının en altta olup olmadığını kontrol et (flex-col-reverse için)
  const isUserAtBottom = () => {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return true;
    
    const threshold = 150; // 150px tolerans
    // Flex-col-reverse'de en alta = scrollTop = 0
    return messagesContainer.scrollTop <= threshold;
  };

  useEffect(() => {
    // Sadece kullanıcı en alttayken otomatik scroll yap
    if (isUserAtBottom()) {
      scrollToBottom();
    }
  }, [messages]);

  // İlk yüklemede veya tab değiştiğinde en alta scroll yap
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // İlk yükleme için kısa bir gecikme ile scroll yap (DOM'un render olması için)
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [isLoading, selectedTab]);

  const sendMessage = async (type: Message['type'] = 'text', file?: File, locationData?: { lat: number; lng: number; name: string }, liveLocationDuration?: number) => {
    if (isSending) return;
    
    if (type === 'text' && !inputText.trim() && !file) return;
    if ((type === 'image' || type === 'video') && !file) return;
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
        scrollToBottom();
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

    if (isImage) {
      sendMessage('image', file);
    } else if (isVideo) {
      sendMessage('video', file);
    } else {
      alert('Sadece resim ve video dosyaları yüklenebilir');
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
    <div className="flex flex-col h-full md:h-full rounded-none md:rounded-lg border-0 md:border border-gray-700 shadow-xl w-full relative" style={{ zIndex: 1, overflowX: 'hidden', overflowY: 'visible' }}>
      {/* Header with Tabs - Modern Design */}
      <div className="bg-background-secondary/80 backdrop-blur-md border-b border-gray-700/50 flex-shrink-0 w-full sticky top-0 z-20">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-4">Sohbet</h1>
          
          {/* Tabs - Modern Design */}
          <div className="flex overflow-x-auto scrollbar-hide gap-1 -mx-4 md:-mx-6 px-4 md:px-6">
            {accessibleTabs.map((tab) => (
              <button
                key={tab.id || 'all'}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2 md:px-5 md:py-2.5 text-sm font-medium whitespace-nowrap transition-all rounded-lg ${
                  selectedTab === tab.id
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-background-tertiary/50'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        id="messages-container"
        className="flex-1 overflow-y-auto overflow-x-hidden px-1 md:px-4 py-2 md:py-4 space-y-3 md:space-y-4 w-full relative flex flex-col-reverse" 
        style={{ zIndex: 0 }}
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
            <div key={message.id}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-2 md:my-4">
                  <div className="bg-background-tertiary px-3 py-1 rounded-full text-xs text-gray-400">
                    {formatDate(message.createdAt)}
                  </div>
                </div>
              )}

              <div
                className={`flex ${own ? 'justify-end' : 'justify-start'} group relative message-menu-container min-w-0`}
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
                    <div className={`absolute ${own ? 'left-full ml-2' : 'right-full mr-2'} top-0 bg-background-secondary border border-gray-700 rounded-lg shadow-xl min-w-[150px] z-20`}>
                      {!own && (
                        <button
                          onClick={() => {
                            setReplyingTo(message);
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-t-lg transition text-sm"
                        >
                          Yanıtla
                        </button>
                      )}
                      {canEditMessage(message) && (
                        <button
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditText(message.content || '');
                            setShowMessageMenu(null);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-background-tertiary transition text-sm ${!own ? 'rounded-t-lg' : ''}`}
                        >
                          Düzenle
                        </button>
                      )}
                      {canDeleteMessage(message) && (
                        <button
                          onClick={() => {
                            handleDeleteMessage(message.id);
                            setShowMessageMenu(null);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-background-tertiary text-red-400 hover:text-red-300 rounded-b-lg transition text-sm"
                        >
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
                    className={`max-w-[75%] lg:max-w-[60%] rounded-2xl p-3 shadow-lg min-w-0 ${
                      own
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-background-tertiary text-white rounded-bl-md border border-gray-700'
                    } ${replyingTo?.id === message.id ? 'ring-2 ring-primary/50' : ''}`}
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
                      if (!own) {
                        setReplyingTo(message);
                      } else {
                        setShowMessageMenu(message.id);
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
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  {message.type === 'text' && (
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
                                className={`font-semibold ${isMentioned ? 'bg-yellow-500/30 text-yellow-300 px-1 rounded' : 'text-black'}`}
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
                    <div>
                      <img
                        src={message.mediaUrl}
                        alt="Gönderilen resim"
                        className="max-w-full rounded-xl mb-2 shadow-md"
                      />
                      {message.content && <div className="mt-2">{message.content}</div>}
                    </div>
                  )}

                  {message.type === 'video' && message.mediaUrl && (
                    <div>
                      <video
                        src={message.mediaUrl}
                        controls
                        className="max-w-full rounded-xl mb-2 shadow-md"
                      />
                      {message.content && <div className="mt-2">{message.content}</div>}
                    </div>
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

                  {/* Time */}
                  <div className={`text-xs mt-0.5 ${own ? 'text-right text-white/70' : 'text-left text-gray-400'}`}>
                    {formatTime(message.createdAt)}
                  </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area - Modern Design */}
      <div className="px-2 py-2 md:px-4 md:py-4 flex-shrink-0 overflow-visible w-full relative" style={{ zIndex: 100, position: 'relative', transform: 'translateZ(0)' }}>
        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 md:mb-3 p-2 md:p-3 bg-background rounded-xl border border-primary/30 flex items-center justify-between shadow-md">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-1">
                <span className="font-rye">{replyingTo.sender.rutbe || ''}</span> {getUserDisplayName(replyingTo.sender)} yanıtlıyorsunuz:
              </div>
              <div className="text-sm text-gray-300 truncate">
                {replyingTo.type === 'text' && replyingTo.content}
                {replyingTo.type === 'image' && '📷 Fotoğraf'}
                {replyingTo.type === 'video' && '🎥 Video'}
                {replyingTo.type === 'audio' && '🎤 Ses'}
                {replyingTo.type === 'location' && '📍 Konum'}
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-white ml-3 transition"
            >
              ×
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
        <div className="flex items-center gap-1.5 md:gap-2 min-w-0" style={{ overflow: 'visible' }}>
          {/* Attachment Menu Button */}
          <div className="relative" ref={locationPickerRef} style={{ zIndex: 10000, position: 'relative' }}>
            <button
              ref={attachmentButtonRef}
              onClick={() => {
                setShowAttachmentMenu(!showAttachmentMenu);
                setShowLocationPicker(false);
                setShowLiveLocationOptions(false);
              }}
              className="p-1 md:p-2.5 text-primary hover:text-primary/80 hover:bg-background rounded-lg transition flex-shrink-0"
              title="Eklentiler"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            
            {showAttachmentMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-background-secondary border border-gray-700 rounded-xl p-2 shadow-xl min-w-[200px]" style={{ 
                zIndex: 99999,
                position: 'absolute',
                transform: 'translateZ(0)',
                isolation: 'isolate'
              }}>
                {/* File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    handleFileSelect(e);
                    setShowAttachmentMenu(false);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-lg transition flex items-center gap-2 text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Fotoğraf/Video
                </button>
                <button
                  onClick={() => {
                    setShowLocationPicker(true);
                    setShowAttachmentMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-background-tertiary rounded-lg transition flex items-center gap-2 text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Konum
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

          {/* Text Input */}
          <div className="flex-1 relative min-w-0" style={{ zIndex: 10000, position: 'relative', overflow: 'visible' }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                const value = e.target.value;
                setInputText(value);
                
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
                // Klavye açıldığında textarea'yı görünür yap
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
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
              placeholder="Mesaj yazın..."
              rows={1}
              className="w-full px-2 md:px-4 py-2 md:py-3 pr-8 md:pr-11 border border-primary text-white bg-background rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 resize-none overflow-hidden shadow-inner text-sm leading-6"
              style={{ 
                wordBreak: 'normal',
                overflowWrap: 'break-word',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                hyphens: 'none',
                minWidth: 0,
                boxSizing: 'border-box',
              }}
            />
            
            {/* Emoji Picker - Textarea içinde absolute positioned */}
            <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-10" ref={emojiPickerRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEmojiPicker(!showEmojiPicker);
                }}
                className="p-1 text-gray-400 hover:text-primary hover:bg-background/50 rounded-lg transition pointer-events-auto"
                title="Emoji"
                type="button"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 right-0" style={{ zIndex: 99999, position: 'absolute', transform: 'translateZ(0)', isolation: 'isolate' }}>
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setInputText(prev => prev + emojiData.emoji);
                      setShowEmojiPicker(false);
                    }}
                    theme={Theme.DARK}
                    width={350}
                    height={400}
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

              {/* Gönder Butonu - Yazı varken göster */}
              {(inputText.trim() || replyingTo) && (
                <button
                  onClick={() => sendMessage()}
                  disabled={isSending}
                  className="p-2.5 md:p-3 bg-primary text-white rounded-full hover:bg-primary/90 transition shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                  title="Gönder"
                >
                  {isSending ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              )}
            </>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
