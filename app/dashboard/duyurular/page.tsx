'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import ReadStatusIndicator from '@/components/ReadStatusIndicator';

interface Announcement {
  id: string;
  title: string;
  content: string;
  visibility: 'yönetim' | 'member' | 'herkes';
  importance: 'düşük' | 'normal' | 'yüksek';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string | null;
  notifyBefore: boolean;
  status: 'published' | 'scheduled';
  creator: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
    rutbe: string | null;
  };
}

export default function DuyurularPage() {
  const { data: session, status } = useSession();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({}); // announcementId -> isRead
  const [countdowns, setCountdowns] = useState<Record<string, number>>({}); // announcementId -> remaining seconds

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    visibility: 'herkes' as 'yönetim' | 'member' | 'herkes',
    importance: 'normal' as 'düşük' | 'normal' | 'yüksek',
    isScheduled: false,
    scheduledAt: '',
    notifyBefore: false,
  });

  // Tüm duyuruları okundu işaretle
  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/read-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType: 'announcement' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Mark all announcements as read failed:', errorData);
      }
    } catch (error) {
      console.error('Mark all announcements as read error:', error);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      // Sayfa yüklendiğinde tüm duyuruları okundu işaretle
      markAllAsRead();
      fetchAnnouncements();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchAnnouncements = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/announcements', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Duyurular yüklenemedi');
      }
      const data = await res.json();
      setAnnouncements(data);
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
  const fetchReadStatuses = async (announcementsList: Announcement[]) => {
    if (!session?.user?.id) return;

    try {
      const statusPromises = announcementsList.map(async (announcement) => {
        const res = await fetch(`/api/read-status?eventType=announcement&eventId=${announcement.id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const isRead = data.readBy.some((user: any) => user.id === session.user.id);
          return { announcementId: announcement.id, isRead };
        }
        return { announcementId: announcement.id, isRead: false };
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, boolean> = {};
      statuses.forEach(({ announcementId, isRead }) => {
        statusMap[announcementId] = isRead;
      });
      setReadStatuses(statusMap);
    } catch (error) {
      console.error('Read statuses fetch error:', error);
    }
  };

  // Okundu işaretle
  const markAsRead = async (announcementId: string) => {
    if (!session?.user?.id) return;

    try {
      await fetch('/api/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'announcement',
          eventId: announcementId,
        }),
        credentials: 'include',
      });

      setReadStatuses((prev) => ({
        ...prev,
        [announcementId]: true,
      }));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleAddAnnouncement = () => {
    setFormData({
      title: '',
      content: '',
      visibility: 'herkes',
      importance: 'normal',
      isScheduled: false,
      scheduledAt: '',
      notifyBefore: false,
    });
    setShowAddModal(true);
    setError('');
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    const scheduledAtLocal = announcement.scheduledAt 
      ? new Date(announcement.scheduledAt).toISOString().slice(0, 16)
      : '';
    setFormData({
      title: announcement.title,
      content: announcement.content,
      visibility: announcement.visibility,
      importance: announcement.importance,
      isScheduled: announcement.status === 'scheduled' && !!announcement.scheduledAt,
      scheduledAt: scheduledAtLocal,
      notifyBefore: announcement.notifyBefore,
    });
    setShowEditModal(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = editingAnnouncement ? `/api/announcements/${editingAnnouncement.id}` : '/api/announcements';
      const method = editingAnnouncement ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Duyuru kaydedilemedi');
      }

      // Form'u sıfırla ve modal'ı kapat
      setFormData({
        title: '',
        content: '',
        visibility: 'herkes',
        importance: 'normal',
        isScheduled: false,
        scheduledAt: '',
        notifyBefore: false,
      });
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingAnnouncement(null);
      
      // Duyuruları yeniden yükle
      await fetchAnnouncements();
    } catch (error: any) {
      setError(error.message || 'Duyuru kaydedilemedi');
    } finally {
      setIsSubmitting(false);
      setIsUpdating(false);
    }
  };

  // Geri sayım güncellemesi
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns: Record<string, number> = {};
      let shouldRefresh = false;
      
      announcements.forEach((announcement) => {
        if (announcement.status === 'scheduled' && announcement.scheduledAt) {
          const scheduledTime = new Date(announcement.scheduledAt).getTime();
          const remaining = Math.max(0, Math.floor((scheduledTime - now) / 1000));
          newCountdowns[announcement.id] = remaining;
          
          // Eğer süre dolduysa duyuruları yeniden yükle
          if (remaining === 0 && countdowns[announcement.id] && countdowns[announcement.id] > 0) {
            shouldRefresh = true;
          }
        }
      });
      
      setCountdowns(newCountdowns);
      
      if (shouldRefresh) {
        fetchAnnouncements();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcements, countdowns]);

  // Geri sayım formatla
  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return 'Yayınlandı';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}g ${hours}s ${minutes}dk`;
    } else if (hours > 0) {
      return `${hours}s ${minutes}dk ${secs}sn`;
    } else if (minutes > 0) {
      return `${minutes}dk ${secs}sn`;
    } else {
      return `${secs}sn`;
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) {
      return;
    }

    setDeletingAnnouncementId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Duyuru silinemedi');
      }

      await fetchAnnouncements();
    } catch (error: any) {
      setError(error.message || 'Duyuru silinemedi');
    } finally {
      setDeletingAnnouncementId(null);
    }
  };

  const visibilityLabels: Record<string, string> = {
    yönetim: 'Yönetim',
    member: 'Member',
    herkes: 'Herkes',
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  // İzin kontrolleri
  const userPermissions = session?.user?.permissions;
  const canCreate = hasPermission(userPermissions, 'announcements', 'create');
  const canUpdate = hasPermission(userPermissions, 'announcements', 'update');
  const canDelete = hasPermission(userPermissions, 'announcements', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Duyurular</h1>
        {canCreate && (
          <Button
            onClick={handleAddAnnouncement}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            Duyuru Ekle
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Duyurular Listesi */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz duyuru eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {announcements
              .map((announcement) => {
                const isScheduled = announcement.status === 'scheduled';
                const isScheduledWithNotify = isScheduled && announcement.notifyBefore;
                const remainingSeconds = countdowns[announcement.id] ?? (announcement.scheduledAt 
                  ? Math.max(0, Math.floor((new Date(announcement.scheduledAt).getTime() - Date.now()) / 1000))
                  : 0);
                
                return (
                  <div
                    key={announcement.id}
                    className={`p-6 hover:bg-background-tertiary transition-all ${isScheduledWithNotify ? 'bg-blue-900/10 border-l-4 border-l-blue-500' : ''}`}
                  >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Yeşil nokta - okunmamışsa göster, başlığın önünde (planlı duyurularda gösterme) */}
                        {!(readStatuses[announcement.id] || false) && !isScheduledWithNotify && (
                          <div className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0" />
                        )}
                        <h3 className="text-lg font-semibold text-white">
                          {announcement.title}
                        </h3>
                        {!isScheduledWithNotify && (
                          <ReadStatusIndicator
                            eventType="announcement"
                            eventId={announcement.id}
                            isRead={readStatuses[announcement.id] || false}
                            onMarkAsRead={() => {
                              setReadStatuses((prev) => ({
                                ...prev,
                                [announcement.id]: true,
                              }));
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isScheduled && (
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                            Planlı Duyuru
                          </span>
                        )}
                        {!isScheduledWithNotify && (
                          <span className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded">
                            {visibilityLabels[announcement.visibility]}
                          </span>
                        )}
                      </div>
                    </div>
                    {isScheduledWithNotify && (
                      <div className="mb-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-medium text-blue-400">
                            Yayınlanma: {announcement.scheduledAt ? new Date(announcement.scheduledAt).toLocaleString('tr-TR') : ''}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-blue-300">
                          Kalan Süre: {formatCountdown(remainingSeconds)}
                        </p>
                        <p className="text-xs text-blue-400/80 mt-1">
                          Planlı duyuru saati gelene kadar sadece yayınlayan görüntüleyebilir.
                        </p>
                      </div>
                    )}
                    {/* İçerik gösterimi: notifyBefore aktifse sadece oluşturan içerik görebilir */}
                    {!isScheduledWithNotify ? (
                      <p 
                        className="text-sm text-gray-400 mb-3 whitespace-pre-wrap"
                        onClick={() => markAsRead(announcement.id)}
                      >
                        {announcement.content}
                      </p>
                    ) : (
                      <div className="mb-3 p-3 bg-background-tertiary rounded-md border border-gray-700">
                        {announcement.createdBy === session?.user?.id ? (
                          <p className="text-sm text-gray-400 whitespace-pre-wrap">
                            {announcement.content}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">
                            Bu planlı duyuru yayın saatine kadar gizlidir. Geri sayım tamamlandığında içerik görüntülenecektir.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      <p>
                        Oluşturan: {announcement.creator.rutbe || ''} {announcement.creator.isim || ''} {announcement.creator.soyisim || ''} ({announcement.creator.username})
                      </p>
                      {isScheduled ? (
                        <p>
                          Planlı Yayın: {announcement.scheduledAt ? new Date(announcement.scheduledAt).toLocaleString('tr-TR') : ''}
                        </p>
                      ) : (
                        <p>
                          Tarih: {new Date(announcement.createdAt).toLocaleString('tr-TR')}
                        </p>
                      )}
                    </div>
                  </div>
                  {announcement.createdBy === session?.user?.id && (canUpdate || canDelete) && (
                    <div className="flex gap-2 ml-4">
                      {canUpdate && (
                        <button
                          onClick={() => handleEditAnnouncement(announcement)}
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
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          disabled={deletingAnnouncementId === announcement.id}
                          className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                          title="Sil"
                        >
                          {deletingAnnouncementId === announcement.id ? (
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
                  )}
                </div>
              </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Duyuru Ekle/Düzenle Modal */}
      {(showAddModal || showEditModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingAnnouncement(null);
            setError('');
            setFormData({
              title: '',
              content: '',
              visibility: 'herkes',
              importance: 'normal',
              isScheduled: false,
              scheduledAt: '',
              notifyBefore: false,
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {editingAnnouncement ? 'Duyuru Düzenle' : 'Yeni Duyuru Ekle'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingAnnouncement(null);
                    setError('');
                    setFormData({
                      title: '',
                      content: '',
                      visibility: 'herkes',
                      importance: 'normal',
                      isScheduled: false,
                      scheduledAt: '',
                      notifyBefore: false,
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

              <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="Duyuru başlığı"
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
                    placeholder="Duyuru içeriği"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Görüntüleyecekler <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value as 'yönetim' | 'member' | 'herkes' })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  >
                    <option value="yönetim">Yönetim</option>
                    <option value="member">Member</option>
                    <option value="herkes">Herkes</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.visibility === 'yönetim' && 'Sadece yönetim grubu görebilir'}
                    {formData.visibility === 'member' && 'Member grubu ve üst gruplar (yönetim) görebilir'}
                    {formData.visibility === 'herkes' && 'Aday grubu ve üst gruplar (member + yönetim) görebilir'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Önem Seviyesi <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.importance}
                    onChange={(e) => setFormData({ ...formData, importance: e.target.value as 'düşük' | 'normal' | 'yüksek' })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  >
                    <option value="düşük">Düşük</option>
                    <option value="normal">Normal</option>
                    <option value="yüksek">Yüksek</option>
                  </select>
                </div>

                {/* Planlı Duyuru Seçenekleri */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="isScheduled"
                      checked={formData.isScheduled}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        isScheduled: e.target.checked,
                        scheduledAt: e.target.checked ? formData.scheduledAt : '',
                        notifyBefore: e.target.checked ? formData.notifyBefore : false,
                      })}
                      className="w-4 h-4 text-primary bg-background border-gray-700 rounded focus:ring-primary focus:ring-2"
                    />
                    <label htmlFor="isScheduled" className="text-sm font-medium text-gray-300 cursor-pointer">
                      Planlı Duyuru
                    </label>
                  </div>

                  {formData.isScheduled && (
                    <div className="space-y-4 pl-7">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Planlı Yayın Tarihi ve Saati <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required={formData.isScheduled}
                          value={formData.scheduledAt}
                          onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                          min={new Date().toISOString().slice(0, 16)}
                          className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Haber Ver
                        </label>
                        <select
                          value={formData.notifyBefore ? 'yes' : 'no'}
                          onChange={(e) => setFormData({ ...formData, notifyBefore: e.target.value === 'yes' })}
                          className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                        >
                          <option value="no">Hayır</option>
                          <option value="yes">Evet</option>
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                          {formData.notifyBefore 
                            ? 'Haber ver seçildiğinde, planlı duyuru saati gelene kadar sadece yayınlayan görür ve geri sayım gösterilir.'
                            : 'Haber verme seçildiğinde, planlı duyuru saati geldiğinde normal bir duyuru gibi paylaşılır.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingAnnouncement(null);
                      setError('');
                      setFormData({
                        title: '',
                        content: '',
                        visibility: 'herkes',
                        importance: 'normal',
                        isScheduled: false,
                        scheduledAt: '',
                        notifyBefore: false,
                      });
                    }}
                    className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isUpdating}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isSubmitting || isUpdating ? 'Kaydediliyor...' : (editingAnnouncement ? 'Güncelle' : 'Oluştur')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

