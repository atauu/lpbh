'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';


interface Event {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  locationUrl: string | null;
  description: string | null;
  plannedBy: string;
  createdAt: string;
  planner: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  };
  attendances?: EventAttendance[];
}

interface EventAttendance {
  id: string;
  eventId: string;
  userId: string;
  status: string | null; // 'attending' | 'not_attending' | null
  user: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  };
}

export default function EtkinliklerPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string | null>>({}); // eventId -> status
  const [isSavingRsvp, setIsSavingRsvp] = useState<string | null>(null); // eventId

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    eventDate: '',
    location: '',
    locationUrl: '',
    description: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchEvents();
    }
  }, [session, status]);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events', {
        credentials: 'include', // Cookie'leri gönder
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Etkinlikler yüklenemedi');
      }
      const data = await res.json();
      setEvents(data);
      
      // Kullanıcının mevcut RSVP durumlarını set et
      if (session?.user?.id) {
        const userRsvps: Record<string, string | null> = {};
        data.forEach((event: Event) => {
          const userAttendance = event.attendances?.find(
            (att) => att.userId === session.user.id
          );
          if (userAttendance) {
            userRsvps[event.id] = userAttendance.status;
          }
        });
        setRsvpStatuses(userRsvps);
      }
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
      console.error('Fetch events error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRsvpSubmit = async (eventId: string, status: string | null) => {
    setIsSavingRsvp(eventId);
    setError('');

    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Katılım durumu kaydedilemedi');
      }

      // RSVP durumunu güncelle
      setRsvpStatuses((prev) => ({
        ...prev,
        [eventId]: status,
      }));

      // Etkinlikleri yeniden yükle
      await fetchEvents();
    } catch (error: any) {
      setError(error.message || 'Katılım durumu kaydedilemedi');
    } finally {
      setIsSavingRsvp(null);
    }
  };

  // Helper: Kullanıcı adını döndür
  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };


  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    if (!confirm(`"${eventTitle}" başlıklı etkinliği silmek istediğinize emin misiniz?`)) {
      return;
    }

    setDeletingEventId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Etkinlik silinemedi');
      }

      // Etkinlikleri yeniden yükle
      await fetchEvents();
    } catch (error: any) {
      setError(error.message || 'Etkinlik silinemedi');
    } finally {
      setDeletingEventId(null);
    }
  };

  // Etkinlikleri geçmiş ve gelecek olarak ayır
  const now = new Date();
  const upcomingEvents = events.filter((event) => new Date(event.eventDate) >= now);
  const pastEvents = events.filter((event) => new Date(event.eventDate) < now);

  // Tarih ve saat formatı
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  };

  // Planlayan kişinin ismini döndür
  const getPlannerName = (planner: Event['planner']) => {
    if (planner.isim || planner.soyisim) {
      return `${planner.isim || ''} ${planner.soyisim || ''}`.trim();
    }
    return planner.username;
  };

  // Form submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          locationUrl: formData.locationUrl.trim() || null,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Etkinlik oluşturulamadı');
      }

      // Form'u sıfırla ve modal'ı kapat
      setFormData({
        title: '',
        eventDate: '',
        location: '',
        locationUrl: '',
        description: '',
      });
      setShowAddModal(false);
      
      // Etkinlikleri yeniden yükle
      await fetchEvents();
    } catch (error: any) {
      setError(error.message || 'Etkinlik oluşturulamadı');
    } finally {
      setIsSubmitting(false);
    }
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
  const canCreate = hasPermission(userPermissions, 'events', 'create');
  const canDelete = hasPermission(userPermissions, 'events', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Etkinlikler</h1>
        {canCreate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            Etkinlik Ekle
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Gelecek Etkinlikler */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Gelecek Etkinlikler</h2>
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz gelecek etkinlik eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="p-6 hover:bg-background-tertiary transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {event.title}
                      </h3>
                      {/* RSVP Dropdown - Sadece gelecek etkinlikler için */}
                      <div className="flex items-center gap-2 ml-4">
                        <select
                          value={rsvpStatuses[event.id] || ''}
                          onChange={(e) => {
                            const newStatus = e.target.value || null;
                            setRsvpStatuses((prev) => ({
                              ...prev,
                              [event.id]: newStatus,
                            }));
                          }}
                          className="px-3 py-1 text-sm border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                        >
                          <option value="">Seçiniz</option>
                          <option value="attending">Katılıyorum</option>
                          <option value="not_attending">Katılmıyorum</option>
                        </select>
                        <button
                          onClick={() => {
                            const status = rsvpStatuses[event.id];
                            if (status) {
                              handleRsvpSubmit(event.id, status);
                            }
                          }}
                          disabled={isSavingRsvp === event.id || !rsvpStatuses[event.id]}
                          className="px-3 py-1 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                        >
                          {isSavingRsvp === event.id ? 'Kaydediliyor...' : 'Kaydet'}
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Tarih: {formatDateTime(event.eventDate)}
                      </p>
                      <div className="flex items-center gap-2">
                        <p>
                          Lokasyon: {event.location}
                        </p>
                        {event.locationUrl && (
                          <a
                            href={event.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-all text-xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Google Maps ile aç
                          </a>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-gray-300 mt-2">
                          Detaylar: {event.description}
                        </p>
                      )}
                      <p>
                        Planlayan: {getPlannerName(event.planner)}
                      </p>
                      
                      {/* Katılım Durumları */}
                      {event.attendances && event.attendances.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {/* Katılanlar */}
                          {event.attendances.some(att => att.status === 'attending') && (
                            <div>
                              <p className="text-primary font-medium mb-1">Katılanlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === 'attending')
                                  .map(att => (
                                    <p key={att.id} className="text-gray-300 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Katılmayanlar */}
                          {event.attendances.some(att => att.status === 'not_attending') && (
                            <div>
                              <p className="text-red-400 font-medium mb-1">Katılmayanlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === 'not_attending')
                                  .map(att => (
                                    <p key={att.id} className="text-gray-300 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Cevapsızlar - Status null olanlar */}
                          {event.attendances.some(att => att.status === null) && (
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Cevapsızlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === null)
                                  .map(att => (
                                    <p key={att.id} className="text-gray-400 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {canDelete && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        disabled={deletingEventId === event.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingEventId === event.id ? (
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geçmiş Etkinlikler */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Geçmiş Etkinlikler</h2>
        </div>
        {pastEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz geçmiş etkinlik eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {pastEvents.map((event) => (
              <div
                key={event.id}
                className="p-6 hover:bg-background-tertiary transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {event.title}
                    </h3>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Tarih: {formatDateTime(event.eventDate)}
                      </p>
                      <div className="flex items-center gap-2">
                        <p>
                          Lokasyon: {event.location}
                        </p>
                        {event.locationUrl && (
                          <a
                            href={event.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-all text-xs"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            Google Maps ile aç
                          </a>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-gray-300 mt-2">
                          Detaylar: {event.description}
                        </p>
                      )}
                      <p>
                        Planlayan: {getPlannerName(event.planner)}
                      </p>
                      
                      {/* Katılım Durumları - Sadece liste, dropdown yok */}
                      {event.attendances && event.attendances.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {/* Katılanlar */}
                          {event.attendances.some(att => att.status === 'attending') && (
                            <div>
                              <p className="text-primary font-medium mb-1">Katılanlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === 'attending')
                                  .map(att => (
                                    <p key={att.id} className="text-gray-300 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Katılmayanlar */}
                          {event.attendances.some(att => att.status === 'not_attending') && (
                            <div>
                              <p className="text-red-400 font-medium mb-1">Katılmayanlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === 'not_attending')
                                  .map(att => (
                                    <p key={att.id} className="text-gray-300 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Cevapsızlar - Status null olanlar */}
                          {event.attendances.some(att => att.status === null) && (
                            <div>
                              <p className="text-gray-500 font-medium mb-1">Cevapsızlar:</p>
                              <div className="pl-2 space-y-1">
                                {event.attendances
                                  .filter(att => att.status === null)
                                  .map(att => (
                                    <p key={att.id} className="text-gray-400 text-xs">
                                      • {getUserName(att.user)}
                                    </p>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {canDelete && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.title)}
                        disabled={deletingEventId === event.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingEventId === event.id ? (
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Etkinlik Ekle Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setError('');
            setFormData({
              title: '',
              eventDate: '',
              location: '',
              locationUrl: '',
              description: '',
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
                  Yeni Etkinlik Ekle
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                    setFormData({
                      title: '',
                      eventDate: '',
                      location: '',
                      locationUrl: '',
                      description: '',
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

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Etkinlik Adı <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Örn: Yıllık Toplantı"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Etkinlik Tarihi <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lokasyon (Adres) <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Etkinlik adresini girin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Etkinlik Detayları (Opsiyonel)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Etkinlik hakkında detaylı bilgi girin..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Google Maps Link (Opsiyonel)
                  </label>
                  <input
                    type="url"
                    value={formData.locationUrl}
                    onChange={(e) => setFormData({ ...formData, locationUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="https://maps.app.goo.gl/... veya https://www.google.com/maps/..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Google Maps'ten "Paylaş" butonuna tıklayarak link'i kopyalayabilirsiniz.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError('');
                      setFormData({
                        title: '',
                        eventDate: '',
                        location: '',
                        locationUrl: '',
                        description: '',
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
                    {isSubmitting ? 'Ekleniyor...' : 'Etkinlik Ekle'}
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

