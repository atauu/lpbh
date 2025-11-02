'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

interface Announcement {
  id: string;
  title: string;
  content: string;
  visibility: 'yönetim' | 'member' | 'herkes';
  importance: 'düşük' | 'normal' | 'yüksek';
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

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    visibility: 'herkes' as 'yönetim' | 'member' | 'herkes',
    importance: 'normal' as 'düşük' | 'normal' | 'yüksek',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchAnnouncements();
    }
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
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnnouncement = () => {
    setFormData({
      title: '',
      content: '',
      visibility: 'herkes',
      importance: 'normal',
    });
    setShowAddModal(true);
    setError('');
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      visibility: announcement.visibility,
      importance: announcement.importance,
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
          <button
            onClick={handleAddAnnouncement}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            Duyuru Ekle
          </button>
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
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="p-6 hover:bg-background-tertiary transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {announcement.title}
                      </h3>
                      <span className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded">
                        {visibilityLabels[announcement.visibility]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3 whitespace-pre-wrap">
                      {announcement.content}
                    </p>
                    <div className="text-xs text-gray-500">
                      <p>
                        Oluşturan: {announcement.creator.rutbe || ''} {announcement.creator.isim || ''} {announcement.creator.soyisim || ''} ({announcement.creator.username})
                      </p>
                      <p>
                        Tarih: {new Date(announcement.createdAt).toLocaleString('tr-TR')}
                      </p>
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
            ))}
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

