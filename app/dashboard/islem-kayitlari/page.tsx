'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: any;
  createdAt: string;
  user: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
    rutbe: string | null;
  };
}

interface ActivityLogsResponse {
  activityLogs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function IslemKayitlariPage() {
  const { data: session, status } = useSession();
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; username: string; isim: string | null; soyisim: string | null }>>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchActivityLogs();
      fetchUsers();
    }
  }, [status, session, page, selectedUserId, selectedAction]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }
      
      if (selectedAction) {
        params.append('action', selectedAction);
      }

      const response = await fetch(`/api/activity-logs?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'İşlem kayıtları yüklenemedi');
      }

      const data: ActivityLogsResponse = await response.json();
      setActivityLogs(data.activityLogs);
      setTotalPages(data.totalPages);
      setError('');
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setError(error instanceof Error ? error.message : 'İşlem kayıtları yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserName = (user: { username: string; isim: string | null; soyisim: string | null }) => {
    if (user.isim && user.soyisim) {
      return `${user.isim} ${user.soyisim} (${user.username})`;
    }
    return user.username;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    // UTC+3 timezone için
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    };
    return new Intl.DateTimeFormat('tr-TR', options).format(date);
  };

  const getActionLabel = (action: string) => {
    const labels: { [key: string]: string } = {
      'login_success': 'Başarılı Giriş',
      'login_failed': 'Başarısız Giriş',
      'logout': 'Çıkış',
      'profile_update': 'Profil Güncelleme',
      'password_change': 'Şifre Değişikliği',
      '2fa_setup': '2FA Etkinleştirme',
      '2fa_disable': '2FA Devre Dışı',
      'meeting_create': 'Toplantı Oluşturma',
      'meeting_update': 'Toplantı Güncelleme',
      'meeting_delete': 'Toplantı Silme',
      'event_create': 'Etkinlik Oluşturma',
      'event_update': 'Etkinlik Güncelleme',
      'event_delete': 'Etkinlik Silme',
      'event_rsvp': 'Etkinlik RSVP',
      'assignment_create': 'Görev Oluşturma',
      'assignment_update': 'Görev Güncelleme',
      'assignment_delete': 'Görev Silme',
      'route_create': 'Rota Oluşturma',
      'route_update': 'Rota Güncelleme',
      'route_delete': 'Rota Silme',
      'announcement_create': 'Duyuru Oluşturma',
      'announcement_update': 'Duyuru Güncelleme',
      'announcement_delete': 'Duyuru Silme',
      'user_registration_start': 'Üye Kaydı Başlatma',
      'user_info_submitted': 'Üye Bilgi Gönderme',
      'user_create': 'Üye Oluşturma',
      'user_update': 'Üye Güncelleme',
      'user_delete': 'Üye Silme',
      'user_approval_approve': 'Üye Onaylama',
      'user_approval_reject': 'Üye Reddetme',
      'role_create': 'Rütbe Oluşturma',
      'role_update': 'Rütbe Güncelleme',
      'role_delete': 'Rütbe Silme',
    };
    
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    if (action.includes('login_success') || action.includes('create') || action.includes('setup') || action.includes('approve') || action.includes('submitted') || action.includes('registration')) {
      return 'text-green-400';
    }
    if (action.includes('login_failed') || action.includes('delete') || action.includes('reject')) {
      return 'text-red-400';
    }
    if (action.includes('update') || action.includes('change') || action.includes('rsvp')) {
      return 'text-yellow-400';
    }
    return 'text-gray-400';
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const isLogExpanded = (logId: string) => expandedLogs.has(logId);

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">İşlem Kayıtları</h1>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Filtreler */}
      <div className="bg-background-secondary rounded-md p-4 border border-gray-700 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Üye Filtrele
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => {
                setSelectedUserId(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            >
              <option value="">Tüm Üyeler</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserName(user)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              İşlem Türü Filtrele
            </label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            >
              <option value="">Tüm İşlemler</option>
              <option value="login_success">Başarılı Giriş</option>
              <option value="login_failed">Başarısız Giriş</option>
              <option value="logout">Çıkış</option>
              <option value="profile_update">Profil Güncelleme</option>
              <option value="password_change">Şifre Değişikliği</option>
              <option value="2fa_setup">2FA Etkinleştirme</option>
              <option value="2fa_disable">2FA Devre Dışı</option>
              <option value="meeting_create">Toplantı Oluşturma</option>
              <option value="meeting_update">Toplantı Güncelleme</option>
              <option value="meeting_delete">Toplantı Silme</option>
              <option value="event_create">Etkinlik Oluşturma</option>
              <option value="event_update">Etkinlik Güncelleme</option>
              <option value="event_delete">Etkinlik Silme</option>
              <option value="event_rsvp">Etkinlik RSVP</option>
              <option value="assignment_create">Görev Oluşturma</option>
              <option value="assignment_update">Görev Güncelleme</option>
              <option value="assignment_delete">Görev Silme</option>
              <option value="route_create">Rota Oluşturma</option>
              <option value="route_update">Rota Güncelleme</option>
              <option value="route_delete">Rota Silme</option>
              <option value="announcement_create">Duyuru Oluşturma</option>
              <option value="announcement_update">Duyuru Güncelleme</option>
              <option value="announcement_delete">Duyuru Silme</option>
              <option value="user_registration_start">Üye Kaydı Başlatma</option>
              <option value="user_info_submitted">Üye Bilgi Gönderme</option>
              <option value="user_create">Üye Oluşturma</option>
              <option value="user_update">Üye Güncelleme</option>
              <option value="user_delete">Üye Silme</option>
              <option value="user_approval_approve">Üye Onaylama</option>
              <option value="user_approval_reject">Üye Reddetme</option>
              <option value="role_create">Rütbe Oluşturma</option>
              <option value="role_update">Rütbe Güncelleme</option>
              <option value="role_delete">Rütbe Silme</option>
            </select>
          </div>
        </div>
        {(selectedUserId || selectedAction) && (
          <button
            onClick={() => {
              setSelectedUserId('');
              setSelectedAction('');
              setPage(1);
            }}
            className="mt-4 px-4 py-2 text-gray-400 hover:text-white transition"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>

      {/* İşlem Kayıtları Listesi */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        {activityLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {selectedUserId || selectedAction ? 'Filtre sonucu bulunamadı' : 'Henüz işlem kaydı yok'}
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {activityLogs.map((log) => {
              const isExpanded = isLogExpanded(log.id);
              const hasDetails = log.ipAddress || log.userAgent;
              
              return (
                <div
                  key={log.id}
                  className="p-3 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs lg:text-sm font-medium ${getActionColor(log.action)} whitespace-nowrap`}>
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs lg:text-sm text-gray-400 truncate">
                          {getUserName(log.user)}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-400">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-white line-clamp-1">{log.description}</p>
                      
                      {/* Genişletilmiş detaylar */}
                      {isExpanded && hasDetails && (
                        <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                          {log.ipAddress && (
                            <p className="text-xs text-gray-400">
                              <span className="text-gray-500">IP Adresi:</span> {log.ipAddress}
                            </p>
                          )}
                          {log.userAgent && (
                            <p className="text-xs text-gray-400">
                              <span className="text-gray-500">Tarayıcı:</span> {log.userAgent}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {hasDetails && (
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-white transition-all p-1"
                        title={isExpanded ? 'Detayları gizle' : 'Detayları göster'}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Önceki
          </button>
          <span className="text-gray-400">
            Sayfa {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}

