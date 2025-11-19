'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import PDFViewer from '@/components/PDFViewer';
import ReadStatusIndicator from '@/components/ReadStatusIndicator';

interface Research {
  id: string;
  title: string;
  content: string;
  filePath: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileContent: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
    rutbe: string | null;
  };
}

interface User {
  id: string;
  username: string;
  isim: string | null;
  soyisim: string | null;
}

export default function ArastirmalarPage() {
  const { data: session, status } = useSession();
  const [researches, setResearches] = useState<Research[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingResearch, setViewingResearch] = useState<Research | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingResearchId, setDeletingResearchId] = useState<string | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfTitle, setViewingPdfTitle] = useState<string>('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({}); // researchId -> isRead
  const [modalImageExpanded, setModalImageExpanded] = useState(false);

  // Dosya türü yardımcıları
  const getFileExt = (name?: string | null) => (name || '').toLowerCase().split('.').pop() || '';
  const isImageExt = (ext: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'].includes(ext);
  const isVideoExt = (ext: string) => ['mp4', 'webm', 'ogg', 'mov', 'mkv'].includes(ext);
  const isAudioExt = (ext: string) => ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);

  // Arama ve filtreleme state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'title' | 'all'>('all');
  const [selectedAuthorId, setSelectedAuthorId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    file: null as File | null,
    removeFile: false,
  });

  // Tüm araştırmaları okundu işaretle
  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/read-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType: 'research' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Mark all researches as read failed:', errorData);
      }
    } catch (error) {
      console.error('Mark all researches as read error:', error);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      // Sayfa yüklendiğinde tüm araştırmaları okundu işaretle
      markAllAsRead();
      fetchResearches();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  useEffect(() => {
    // Filtreler değiştiğinde araştırmaları yeniden yükle
    if (session) {
      fetchResearches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, searchType, selectedAuthorId, startDate, endDate]);

  const fetchResearches = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm);
        params.append('searchType', searchType);
      }
      if (selectedAuthorId) {
        params.append('authorId', selectedAuthorId);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const url = `/api/researches${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Araştırmalar yüklenemedi');
      }

      const data = await res.json();
      setResearches(data);
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
  const fetchReadStatuses = async (researchesList: Research[]) => {
    if (!session?.user?.id) return;

    try {
      const statusPromises = researchesList.map(async (research) => {
        const res = await fetch(`/api/read-status?eventType=research&eventId=${research.id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const isRead = data.readBy.some((user: any) => user.id === session.user.id);
          return { researchId: research.id, isRead };
        }
        return { researchId: research.id, isRead: false };
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, boolean> = {};
      statuses.forEach(({ researchId, isRead }) => {
        statusMap[researchId] = isRead;
      });
      setReadStatuses(statusMap);
    } catch (error) {
      console.error('Read statuses fetch error:', error);
    }
  };

  // Okundu işaretle
  const markAsRead = async (researchId: string) => {
    if (!session?.user?.id) return;

    try {
      await fetch('/api/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'research',
          eventId: researchId,
        }),
        credentials: 'include',
      });

      setReadStatuses((prev) => ({
        ...prev,
        [researchId]: true,
      }));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      const res = await fetch('/api/researches', {
        method: 'POST',
        body: formDataToSend,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Araştırma oluşturulamadı');
      }

      setFormData({
        title: '',
        content: '',
        file: null,
        removeFile: false,
      });
      setShowAddModal(false);
      await fetchResearches();
    } catch (error: any) {
      setError(error.message || 'Araştırma oluşturulamadı');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingResearch) return;

    setIsSubmitting(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('content', formData.content);
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }
      if (formData.removeFile) {
        formDataToSend.append('removeFile', 'true');
      }

      const res = await fetch(`/api/researches/${viewingResearch.id}`, {
        method: 'PUT',
        body: formDataToSend,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Araştırma güncellenemedi');
      }

      setShowEditModal(false);
      setViewingResearch(null);
      setFormData({
        title: '',
        content: '',
        file: null,
        removeFile: false,
      });
      await fetchResearches();
    } catch (error: any) {
      setError(error.message || 'Araştırma güncellenemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (researchId: string) => {
    if (!confirm('Bu araştırmayı silmek istediğinize emin misiniz?')) {
      return;
    }

    setDeletingResearchId(researchId);
    try {
      const res = await fetch(`/api/researches/${researchId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Araştırma silinemedi');
      }

      await fetchResearches();
    } catch (error: any) {
      setError(error.message || 'Araştırma silinemedi');
    } finally {
      setDeletingResearchId(null);
    }
  };

  const handleEdit = (research: Research) => {
    setViewingResearch(research);
    setFormData({
      title: research.title,
      content: research.content,
      file: null,
      removeFile: false,
    });
    setShowEditModal(true);
  };

  const handleView = async (researchId: string) => {
    // Research açıldığında otomatik okundu işaretle
    markAsRead(researchId);
    try {
      const res = await fetch(`/api/researches/${researchId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setViewingResearch(data);
        setModalImageExpanded(false);
        setShowViewModal(true);
      }
    } catch (error) {
      console.error('Research fetch error:', error);
    }
  };

  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    }).format(date);
  };

  // Highlight search terms in text
  const highlightText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm.trim() || !text) return <span>{text}</span>;

    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, index) => {
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

  // Extract matching sentences from file content
  const extractMatchingSentences = (text: string, searchTerm: string, maxSentences: number = 3): string[] => {
    if (!searchTerm.trim() || !text) return [];

    const searchLower = searchTerm.toLowerCase();
    const textLower = text.toLowerCase();

    if (!textLower.includes(searchLower)) return [];

    const sentences = text.split(/[.!?]\s+|\n+/).filter(s => s.trim().length > 10);
    const matchingSentences: string[] = [];

    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(searchLower) && matchingSentences.length < maxSentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length > 200) {
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const userPermissions = session?.user?.permissions;
  const canCreate = hasPermission(userPermissions, 'researches', 'create');
  const canUpdate = hasPermission(userPermissions, 'researches', 'update');
  const canDelete = hasPermission(userPermissions, 'researches', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Araştırmalar</h1>
        {canCreate && (
          <Button
            onClick={() => {
              setFormData({
                title: '',
                content: '',
                file: null,
                removeFile: false,
              });
              setShowAddModal(true);
            }}
            variant="primary"
            className="px-4 py-2 whitespace-nowrap"
          >
            Araştırma Ekle
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-background-secondary rounded-md p-4 border border-gray-700 backdrop-blur-sm">
        <div className="space-y-4">
          {/* Arama */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ara..."
                className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'title' | 'all')}
              className="px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            >
              <option value="all">Tümü</option>
              <option value="title">Konu</option>
            </select>
          </div>

          {/* Filtreler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Yazan Kişi
              </label>
              <select
                value={selectedAuthorId}
                onChange={(e) => setSelectedAuthorId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              >
                <option value="">Tümü</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserName(user)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {/* Filtreleri temizle */}
          {(searchTerm || selectedAuthorId || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSearchType('all');
                setSelectedAuthorId('');
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 text-gray-400 hover:text-white transition"
            >
              ✕ Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Araştırmalar Listesi */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        {researches.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchTerm || selectedAuthorId || startDate || endDate
              ? 'Filtre kriterlerine uygun araştırma bulunamadı'
              : 'Henüz araştırma eklenmemiş'}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {researches.map((research) => (
              <div
                key={research.id}
                className="p-6 hover:bg-background-tertiary transition-all cursor-pointer"
                onClick={() => handleView(research.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Yeşil nokta - okunmamışsa göster, başlığın önünde */}
                      {!(readStatuses[research.id] || false) && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {searchTerm.trim() ? (
                          highlightText(research.title, searchTerm)
                        ) : (
                          research.title
                        )}
                      </h3>
                      <ReadStatusIndicator
                        eventType="research"
                        eventId={research.id}
                        isRead={readStatuses[research.id] || false}
                        onMarkAsRead={() => {
                          setReadStatuses((prev) => ({
                            ...prev,
                            [research.id]: true,
                          }));
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Yazan: {getUserName(research.creator)}
                      </p>
                      <p>
                        Tarih: {formatDateTime(research.createdAt)}
                      </p>
                      {research.content && (
                        <p className="text-gray-300 line-clamp-2 mt-2">
                          {research.content.substring(0, 150)}{research.content.length > 150 ? '...' : ''}
                        </p>
                      )}

                      {/* Dosya özeti - kartta sadece tür etiketi (thumbnail yok) */}
                      {research.fileName && (() => {
                        const ext = getFileExt(research.fileName);
                        const label = isImageExt(ext)
                          ? '1 fotoğraf'
                          : isVideoExt(ext)
                          ? '1 video'
                          : isAudioExt(ext)
                          ? '1 ses dosyası'
                          : ext === 'pdf'
                          ? '1 PDF'
                          : '1 belge';
                        return <div className="mt-2 text-xs text-gray-400">📎 {label}</div>;
                      })()}
                      {/* PDF içeriğinden eşleşen cümleleri göster (sadece "all" seçiliyse) */}
                      {searchTerm.trim() && searchType === 'all' && research.fileContent && (() => {
                        const hasContentMatch = research.fileContent.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchingSentences = hasContentMatch ? extractMatchingSentences(research.fileContent, searchTerm, 3) : [];
                        
                        return matchingSentences.length > 0 ? (
                          <div className="mt-3 p-3 bg-background-tertiary rounded-md border border-gray-600 backdrop-blur-sm">
                            <p className="text-xs text-gray-500 mb-2">Dosya İçeriğinden Eşleşmeler:</p>
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
                  <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    {canUpdate && (
                      <button
                        onClick={() => handleEdit(research)}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                        title="Düzenle"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(research.id)}
                        disabled={deletingResearchId === research.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingResearchId === research.id ? (
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

      {/* Add Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setError('');
            setFormData({
              title: '',
              content: '',
              file: null,
              removeFile: false,
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Yeni Araştırma Ekle</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                    setFormData({
                      title: '',
                      content: '',
                      file: null,
                      removeFile: false,
                    });
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Başlık <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    İçerik <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Araştırma içeriğini girin..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dosya (Opsiyonel)
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maksimum dosya boyutu: 10MB</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError('');
                      setFormData({
                        title: '',
                        content: '',
                        file: null,
                        removeFile: false,
                      });
                    }}
                    className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isSubmitting ? 'Ekleniyor...' : 'Ekle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && viewingResearch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowEditModal(false);
            setViewingResearch(null);
            setError('');
            setFormData({
              title: '',
              content: '',
              file: null,
              removeFile: false,
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Araştırma Düzenle</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setViewingResearch(null);
                    setError('');
                    setFormData({
                      title: '',
                      content: '',
                      file: null,
                      removeFile: false,
                    });
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Başlık <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    İçerik <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  />
                </div>

                {viewingResearch.fileName && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Mevcut Dosya
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 border border-gray-700 text-white bg-background rounded-md text-sm">
                        {viewingResearch.fileName}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.removeFile}
                          onChange={(e) => setFormData({ ...formData, removeFile: e.target.checked })}
                          className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                        />
                        <span className="text-sm text-gray-300">Dosyayı Kaldır</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {viewingResearch.fileName ? 'Yeni Dosya (Opsiyonel)' : 'Dosya (Opsiyonel)'}
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maksimum dosya boyutu: 10MB</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setViewingResearch(null);
                      setError('');
                      setFormData({
                        title: '',
                        content: '',
                        file: null,
                        removeFile: false,
                      });
                    }}
                    className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isSubmitting ? 'Güncelleniyor...' : 'Güncelle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingResearch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowViewModal(false);
            setViewingResearch(null);
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">{viewingResearch.title}</h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingResearch(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Yazan:</p>
                  <p className="text-white">{getUserName(viewingResearch.creator)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Tarih:</p>
                  <p className="text-white">{formatDateTime(viewingResearch.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-2">İçerik:</p>
                  <div className="text-white whitespace-pre-wrap bg-background rounded-md p-4 border border-gray-700">
                    {viewingResearch.content}
                  </div>
                </div>
                {viewingResearch.fileName && (() => {
                  const ext = getFileExt(viewingResearch.fileName);
                  const url = `/api/researches/${viewingResearch.id}/file`;
                  return (
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">Dosya:</p>
                      {ext === 'pdf' ? (
                        <object data={url} type="application/pdf" className="w-full h-[70vh] rounded-md border border-gray-700 bg-black">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                            PDF'i açmak için tıklayın
                          </a>
                        </object>
                      ) : isImageExt(ext) ? (
                        !modalImageExpanded ? (
                          <div className="w-full max-w-sm mx-auto aspect-square rounded-md border border-gray-700 bg-black flex items-center justify-center cursor-zoom-in" onClick={() => setModalImageExpanded(true)}>
                            <img src={url} alt={viewingResearch.fileName || 'Dosya'} className="w-[70%] h-[70%] object-contain" />
                          </div>
                        ) : (
                          <div className="w-full max-h-[70vh] rounded-md border border-gray-700 bg-black flex items-center justify-center cursor-zoom-out" onClick={() => setModalImageExpanded(false)}>
                            <img src={url} alt={viewingResearch.fileName || 'Dosya'} className="max-h-[70vh] w-full object-contain" />
                          </div>
                        )
                      ) : isVideoExt(ext) ? (
                        <video src={url} controls className="w-full max-h-[70vh] rounded-md border border-gray-700 bg-black" />
                      ) : isAudioExt(ext) ? (
                        <audio src={url} controls className="w-full" />
                      ) : (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block px-3 py-2 border border-gray-700 text-white bg-background rounded-md hover:bg-background-tertiary transition-all text-sm"
                        >
                          {viewingResearch.fileName}
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingResearch(null);
                  }}
                  className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

