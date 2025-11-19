'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import PDFViewer from '@/components/PDFViewer';
import ReadStatusIndicator from '@/components/ReadStatusIndicator';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  fileName: string;
  fileSize: number;
  content: string | null;
  visibility: 'yönetim' | 'member' | 'herkes';
  uploadedBy: string;
  createdAt: string;
  attendances?: MeetingAttendance[];
}

interface MeetingAttendance {
  id: string;
  userId: string;
  attended: boolean;
  user?: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  };
}

interface User {
  id: string;
  username: string;
  isim: string | null;
  soyisim: string | null;
}

export default function ToplantiKayitlariPage() {
  const { data: session, status } = useSession();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedUserFilters, setSelectedUserFilters] = useState<string[]>([]);
  const [showUserFilterDropdown, setShowUserFilterDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfTitle, setViewingPdfTitle] = useState<string>('');
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement | null>(null);
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({}); // meetingId -> isRead

  // Upload form state
  const [uploadFormData, setUploadFormData] = useState({
    title: '',
    meetingDate: '',
    file: null as File | null,
    attendees: [] as string[], // User IDs
    visibility: 'herkes' as 'yönetim' | 'member' | 'herkes',
  });

  // Tüm toplantıları okundu işaretle
  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/read-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType: 'meeting' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Mark all meetings as read failed:', errorData);
      }
    } catch (error) {
      console.error('Mark all meetings as read error:', error);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      // Sayfa yüklendiğinde tüm toplantıları okundu işaretle
      markAllAsRead();
      fetchMeetings();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserFilterDropdown && !target.closest('.user-filter-dropdown') && !target.closest('.fixed.z-\\[9999\\]')) {
        setShowUserFilterDropdown(false);
      }
    };

    if (showUserFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserFilterDropdown]);

  const fetchMeetings = async () => {
    try {
      const res = await fetch('/api/meetings');
      if (!res.ok) {
        throw new Error('Toplantı kayıtları yüklenemedi');
      }
      const data = await res.json();
      setMeetings(data);
      // Okuma durumlarını getir
      if (session?.user?.id) {
        await fetchReadStatuses(data);
      }
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  // Okuma durumlarını getir
  const fetchReadStatuses = async (meetingsList: Meeting[]) => {
    if (!session?.user?.id) return;

    try {
      const statusPromises = meetingsList.map(async (meeting) => {
        const res = await fetch(`/api/read-status?eventType=meeting&eventId=${meeting.id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // Kullanıcının okuduğunu kontrol et
          const isRead = data.readBy.some((user: any) => user.id === session.user.id);
          return { meetingId: meeting.id, isRead };
        }
        return { meetingId: meeting.id, isRead: false };
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, boolean> = {};
      statuses.forEach(({ meetingId, isRead }) => {
        statusMap[meetingId] = isRead;
      });
      setReadStatuses(statusMap);
    } catch (error) {
      console.error('Read statuses fetch error:', error);
    }
  };

  // Okundu işaretle
  const markAsRead = async (meetingId: string) => {
    if (!session?.user?.id) return;

    try {
      await fetch('/api/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'meeting',
          eventId: meetingId,
        }),
        credentials: 'include',
      });

      // Local state'i güncelle
      setReadStatuses((prev) => ({
        ...prev,
        [meetingId]: true,
      }));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        throw new Error('Üyeler yüklenemedi');
      }
      const data = await res.json();
      setUsers(data);
    } catch (error: any) {
      console.error('Users fetch error:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Sadece PDF dosyaları yüklenebilir');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        setError('Dosya boyutu 10MB\'dan küçük olmalıdır');
        return;
      }
      setUploadFormData({ ...uploadFormData, file });
      setError('');
    }
  };

  const handleDeleteMeeting = async (meetingId: string, meetingTitle: string) => {
    if (!confirm(`"${meetingTitle}" başlıklı toplantı kaydını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setDeletingMeetingId(meetingId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Toplantı kaydı silinemedi');
      }

      // Toplantıları yeniden yükle
      await fetchMeetings();
    } catch (error: any) {
      setError(error.message || 'Toplantı kaydı silinemedi');
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFormData.file) {
      setError('Lütfen bir PDF dosyası seçin');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', uploadFormData.title);
      formData.append('meetingDate', uploadFormData.meetingDate);
      formData.append('file', uploadFormData.file);
      formData.append('visibility', uploadFormData.visibility);
      uploadFormData.attendees.forEach((userId) => {
        formData.append('attendees', userId);
      });

      const res = await fetch('/api/meetings', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Cookie'leri gönder
      });

      if (!res.ok) {
        // Content-Type kontrolü
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          console.error('Non-JSON response:', text.substring(0, 500));
          throw new Error(`Sunucu hatası (${res.status}): ${text.substring(0, 200)}`);
        }
        
        const data = await res.json();
        const errorMessage = data.details || data.error || 'Toplantı kaydı yüklenemedi';
        throw new Error(errorMessage);
      }

      // Form'u sıfırla
      setUploadFormData({
        title: '',
        meetingDate: '',
        file: null,
        attendees: [],
        visibility: 'herkes',
      });
      setShowUploadForm(false);
      
      // Toplantıları yeniden yükle
      await fetchMeetings();
    } catch (error: any) {
      setError(error.message || 'Toplantı kaydı yüklenemedi');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to highlight search terms in text
  const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim() || !text) return <span>{text}</span>;
    
    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <span>
        {parts.map((part, index) => {
          // Check if this part matches the search term (case-insensitive)
          const matches = new RegExp(`^${escapedSearch}$`, 'i').test(part);
          return matches ? (
            <mark key={index} className="bg-primary text-white px-1 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </span>
    );
  };

  // Helper function to extract sentences containing search term
  const extractMatchingSentences = (text: string, searchTerm: string, maxSentences: number = 3): string[] => {
    if (!searchTerm.trim() || !text) return [];
    
    const searchLower = searchTerm.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Önce genel olarak içerip içermediğini kontrol et
    if (!textLower.includes(searchLower)) return [];
    
    // Cümlelere ayır (nokta, ünlem, soru işareti ve yeni satırlar)
    const sentences = text.split(/[.!?]\s+|\n+/).filter(s => s.trim().length > 10); // En az 10 karakter olanları al
    const matchingSentences: string[] = [];
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(searchLower) && matchingSentences.length < maxSentences) {
        // Cümlenin çok uzun olmaması için max 200 karakter al
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length > 200) {
          // Arama teriminin pozisyonunu bul
          const searchIndex = trimmedSentence.toLowerCase().indexOf(searchLower);
          const startIndex = Math.max(0, searchIndex - 50);
          const endIndex = Math.min(trimmedSentence.length, searchIndex + searchTerm.length + 50);
          matchingSentences.push('...' + trimmedSentence.substring(startIndex, endIndex) + '...');
        } else {
          matchingSentences.push(trimmedSentence);
        }
      }
    }
    
    return matchingSentences;
  };

  // Kullanıcı adını döndür
  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };

  // Filter meetings based on search and user filter
  const filteredMeetings = meetings.filter((meeting) => {
    // User filter - seçilen TÜM üyelerin birlikte katıldığı toplantıları göster
    if (selectedUserFilters.length > 0) {
      const meetingUserIds = meeting.attendances?.filter(a => a.attended).map(a => a.userId) || [];
      // Seçilen tüm üyelerin bu toplantıda olup olmadığını kontrol et
      const allSelectedUsersAttended = selectedUserFilters.every(userId => 
        meetingUserIds.includes(userId)
      );
      if (!allSelectedUsersAttended) {
        return false;
      }
    }

    // Search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return (
        meeting.title.toLowerCase().includes(searchLower) ||
        meeting.fileName.toLowerCase().includes(searchLower) ||
        (meeting.content && meeting.content.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  // İzin kontrolleri
  const userPermissions = session?.user?.permissions;
  const canCreate = hasPermission(userPermissions, 'meetings', 'create');
  const canDelete = hasPermission(userPermissions, 'meetings', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Toplantı Kayıtları</h1>
        {canCreate && (
          <Button
            onClick={() => setShowUploadForm(!showUploadForm)}
            variant="primary"
            className="px-4 py-2"
          >
            {showUploadForm ? 'İptal' : 'Yeni Toplantı Kaydı Ekle'}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
          <div className="bg-background-secondary rounded-md p-6 border border-gray-700 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white mb-4">Yeni Toplantı Kaydı Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Toplantı Başlığı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadFormData.title}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Toplantı Tarihi <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={uploadFormData.meetingDate}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, meetingDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Görüntülenecekler <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={uploadFormData.visibility}
                onChange={(e) => setUploadFormData({ ...uploadFormData, visibility: e.target.value as 'yönetim' | 'member' | 'herkes' })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              >
                <option value="yönetim">Yönetim</option>
                <option value="member">Member</option>
                <option value="herkes">Herkes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                PDF Dosyası <span className="text-red-400">*</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                required
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
              />
              <p className="text-xs text-gray-400 mt-1">Maksimum dosya boyutu: 10MB</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Katılan Üyeler (Opsiyonel)
              </label>
              <select
                multiple
                value={uploadFormData.attendees}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setUploadFormData({ ...uploadFormData, attendees: selected });
                }}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all min-h-[120px]"
                size={5}
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.isim || user.soyisim
                      ? `${user.isim || ''} ${user.soyisim || ''}`.trim()
                      : user.username}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Birden fazla üye seçmek için Ctrl (Windows) veya Cmd (Mac) tuşuna basılı tutun
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                {isUploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-background-secondary rounded-md p-4 border border-gray-700 backdrop-blur-sm relative z-50">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Toplantı başlığı, dosya adı veya içerikte ara..."
              className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            />
          </div>
          <div className="relative user-filter-dropdown z-50" style={{ minWidth: '250px' }}>
            <button
              ref={dropdownButtonRef}
              type="button"
              onClick={() => setShowUserFilterDropdown(!showUserFilterDropdown)}
              className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-left flex items-center justify-between"
            >
              <span>
                {selectedUserFilters.length === 0
                  ? 'Üye Seçin'
                  : `${selectedUserFilters.length} Üye Seçildi`}
              </span>
              <svg
                className={`w-5 h-5 transition-transform flex-shrink-0 ${showUserFilterDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showUserFilterDropdown && (
              <>
                {/* Portal overlay for dropdown */}
                <div 
                  className="fixed inset-0 z-[9998]" 
                  onClick={() => setShowUserFilterDropdown(false)}
                  style={{ background: 'transparent' }}
                />
                <div 
                  className="absolute top-full left-0 mt-1 w-full bg-background border border-gray-700 rounded-md shadow-xl max-h-64 overflow-y-auto backdrop-blur-sm z-[9999]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    {users.map((user) => {
                      const isSelected = selectedUserFilters.includes(user.id);
                      return (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-background-tertiary rounded-md cursor-pointer transition-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedUserFilters([...selectedUserFilters, user.id]);
                              } else {
                                setSelectedUserFilters(selectedUserFilters.filter(id => id !== user.id));
                              }
                            }}
                            className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-white text-sm">{getUserName(user)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          {(searchTerm || selectedUserFilters.length > 0) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedUserFilters([]);
              }}
              className="px-4 py-2 text-gray-400 hover:text-white transition whitespace-nowrap"
              title="Filtreleri Temizle"
            >
              ✕ Temizle
            </button>
          )}
        </div>
        {selectedUserFilters.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-2">
              Seçilen Üyeler ({selectedUserFilters.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedUserFilters.map((userId) => {
                const user = users.find(u => u.id === userId);
                if (!user) return null;
                return (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary rounded-md text-sm border border-primary/30"
                  >
                    {getUserName(user)}
                    <button
                      onClick={() => {
                        setSelectedUserFilters(selectedUserFilters.filter(id => id !== userId));
                      }}
                      className="hover:text-white transition-all"
                      title="Kaldır"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Meetings List */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm relative z-0">
        {filteredMeetings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchTerm || selectedUserFilters.length > 0
              ? 'Filtre kriterlerine uygun toplantı kaydı bulunamadı'
              : 'Henüz toplantı kaydı eklenmemiş'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="p-6 hover:bg-background-tertiary transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Yeşil nokta - okunmamışsa göster, başlığın önünde */}
                      {!(readStatuses[meeting.id] || false) && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {searchTerm.trim() ? (
                          highlightText(meeting.title, searchTerm)
                        ) : (
                          meeting.title
                        )}
                      </h3>
                      <ReadStatusIndicator
                        eventType="meeting"
                        eventId={meeting.id}
                        isRead={readStatuses[meeting.id] || false}
                        onMarkAsRead={() => {
                          setReadStatuses((prev) => ({
                            ...prev,
                            [meeting.id]: true,
                          }));
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Tarih:{' '}
                        {new Date(meeting.meetingDate).toLocaleString('tr-TR', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })}
                      </p>
                      <p>
                        Dosya:{' '}
                        {searchTerm.trim() ? (
                          highlightText(meeting.fileName, searchTerm)
                        ) : (
                          meeting.fileName
                        )}
                      </p>
                      <p>
                        Boyut:{' '}
                        {(meeting.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {meeting.attendances && meeting.attendances.length > 0 && (
                        <p>
                          Katılanlar:{' '}
                          {meeting.attendances
                            .filter((a) => a.attended)
                            .map((a) =>
                              a.user
                                ? `${a.user.isim || ''} ${a.user.soyisim || ''}`.trim() || a.user.username
                                : 'Bilinmeyen'
                            )
                            .join(', ')}
                        </p>
                      )}
                      {/* PDF içeriğinden eşleşen cümleleri göster */}
                      {searchTerm.trim() && meeting.content && (() => {
                        const hasContentMatch = meeting.content.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchingSentences = hasContentMatch ? extractMatchingSentences(meeting.content, searchTerm, 3) : [];
                        
                        // Debug: content var mı kontrol et
                        if (hasContentMatch && matchingSentences.length === 0) {
                          console.log('Content match but no sentences found:', {
                            meetingId: meeting.id,
                            contentLength: meeting.content.length,
                            searchTerm,
                            firstMatch: meeting.content.toLowerCase().indexOf(searchTerm.toLowerCase()),
                          });
                        }
                        
                        return matchingSentences.length > 0 ? (
                          <div className="mt-3 p-3 bg-background-tertiary rounded-md border border-gray-600 backdrop-blur-sm">
                            <p className="text-xs text-gray-500 mb-2">İçerikten Eşleşmeler:</p>
                            <div className="space-y-1 text-xs text-gray-300">
                              {matchingSentences.map((sentence, idx) => (
                                <p key={idx} className="italic">
                                  "{highlightText(sentence, searchTerm)}"
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setViewingPdfUrl(`/api/meetings/${meeting.id}/file`);
                        setViewingPdfTitle(meeting.title);
                        setPdfViewerOpen(true);
                        // PDF açıldığında otomatik okundu işaretle
                        markAsRead(meeting.id);
                      }}
                      className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition"
                      title="Görüntüle"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <a
                      href={`/api/meetings/${meeting.id}/file`}
                      download={meeting.fileName}
                      className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all inline-block"
                      title="İndir"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id, meeting.title)}
                        disabled={deletingMeetingId === meeting.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingMeetingId === meeting.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && viewingPdfUrl && (
        <PDFViewer
          url={viewingPdfUrl}
          title={viewingPdfTitle}
          onClose={() => {
            setPdfViewerOpen(false);
            setViewingPdfUrl(null);
            setViewingPdfTitle('');
          }}
        />
      )}
    </div>
  );
}

