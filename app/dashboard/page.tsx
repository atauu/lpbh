'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Meeting {
  id: string;
  title: string;
  meetingDate: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

interface Poll {
  id: string;
  title: string;
  details?: string | null;
  type: 'yesno' | 'multiple';
  allowCustomOption: boolean;
  createdAt: string;
}

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
}

interface Assignment {
  id: string;
  assignerId: string;
  assigneeId: string;
  task: string;
  issueDate: string;
  expectedDelivery: string;
  actualDelivery: string | null;
  status: string;
  details: string | null;
  files: string[];
  createdAt: string;
  assigner: {
    id: string;
    username: string;
    rutbe: string | null;
    isim: string | null;
    soyisim: string | null;
  };
  assignee: {
    id: string;
    username: string;
    rutbe: string | null;
    isim: string | null;
    soyisim: string | null;
  };
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  visibility: 'yönetim' | 'member' | 'herkes';
  importance: 'düşük' | 'normal' | 'yüksek';
  createdBy: string;
  createdAt: string;
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

interface Research {
  id: string;
  title: string;
  content: string;
  fileName: string | null;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
    rutbe: string | null;
  };
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [recentResearches, setRecentResearches] = useState<Research[]>([]);
  const [recentPolls, setRecentPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdowns, setCountdowns] = useState<Record<string, number>>({}); // announcementId -> remaining seconds

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchDashboardData();
    }
  }, [session, status]);

  // Geri sayım güncellemesi
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns: Record<string, number> = {};
      let shouldRefresh = false;
      
      recentAnnouncements.forEach((announcement) => {
        if (announcement.status === 'scheduled' && announcement.scheduledAt) {
          const scheduledTime = new Date(announcement.scheduledAt).getTime();
          const remaining = Math.max(0, Math.floor((scheduledTime - now) / 1000));
          newCountdowns[announcement.id] = remaining;
          
          // Eğer süre dolduysa dashboard verilerini yeniden yükle
          if (remaining === 0 && countdowns[announcement.id] && countdowns[announcement.id] > 0) {
            shouldRefresh = true;
          }
        }
      });
      
      setCountdowns(newCountdowns);
      
      if (shouldRefresh) {
        fetchDashboardData();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentAnnouncements, countdowns]);

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
  
  // URL'den hata parametresi varsa göster
  useEffect(() => {
    if (searchParams) {
      const errorParam = searchParams.get('error');
      if (errorParam === 'insufficient_permissions') {
        setError('Bu sayfaya erişim izniniz bulunmuyor.');
      }
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Son 5 toplantı kaydını getir
      const meetingsRes = await fetch('/api/meetings?limit=5', {
        credentials: 'include',
      });
      if (meetingsRes.ok) {
        const meetingsData = await meetingsRes.json();
        setRecentMeetings(meetingsData);
      }

      // Gelecek etkinlikleri getir
      const eventsRes = await fetch('/api/events', {
        credentials: 'include',
      });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const now = new Date();
        const upcoming = eventsData
          .filter((event: Event) => new Date(event.eventDate) >= now)
          .sort((a: Event, b: Event) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      }

      // Bekleyen görevlendirmeleri getir (pending status)
      const assignmentsRes = await fetch('/api/assignments', {
        credentials: 'include',
      });
      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        const now = new Date();
        const pending = assignmentsData
          .filter((assignment: Assignment) => {
            // Status pending olanlar veya bugün > beklenilen teslim tarihi ama status hala pending olanlar
            const expectedDate = new Date(assignment.expectedDelivery);
            if (assignment.status === 'pending' || (now > expectedDate && assignment.status === 'pending')) {
              return true;
            }
            return false;
          })
          .sort((a: Assignment, b: Assignment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setPendingAssignments(pending);
      }

      // Son duyuruları getir (önem seviyesine göre sıralı, yüksek öncelik önce)
      const announcementsRes = await fetch('/api/announcements?limit=5', {
        credentials: 'include',
      });
      if (announcementsRes.ok) {
        const announcementsData = await announcementsRes.json();
        const sorted = announcementsData
          .sort((a: Announcement, b: Announcement) => {
            // Önem seviyesine göre sırala: yüksek > normal > düşük
            const importanceOrder = { yüksek: 3, normal: 2, düşük: 1 };
            const aImportance = importanceOrder[a.importance] || 0;
            const bImportance = importanceOrder[b.importance] || 0;
            if (aImportance !== bImportance) {
              return bImportance - aImportance;
            }
            // Aynı önem seviyesinde ise tarihe göre (yeniler önce)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
          .slice(0, 5);
        setRecentAnnouncements(sorted);
      }

      // Son oylamaları getir
      const pollsRes = await fetch('/api/polls', {
        credentials: 'include',
      });
      if (pollsRes.ok) {
        const pollsData = await pollsRes.json();
        const sorted = (pollsData || [])
          .sort((a: Poll, b: Poll) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentPolls(sorted);
      }

      // Son araştırmaları getir
      const researchesRes = await fetch('/api/researches?limit=5', {
        credentials: 'include',
      });
      if (researchesRes.ok) {
        const researchesData = await researchesRes.json();
        const sorted = researchesData
          .sort((a: Research, b: Research) => {
            // Tarihe göre sırala (yeniler önce)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
          .slice(0, 5);
        setRecentResearches(sorted);
      }
    } catch (error: any) {
      setError(error.message || 'Veriler yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  // Kullanıcı adını döndür
  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };

  // Görevlendiren bilgisini döndür (rütbe + isim)
  const getAssignerDisplay = (assigner: Assignment['assigner']) => {
    const parts: string[] = [];
    if (assigner.rutbe) {
      parts.push(assigner.rutbe);
    }
    if (assigner.isim || assigner.soyisim) {
      parts.push(`${assigner.isim || ''} ${assigner.soyisim || ''}`.trim());
    }
    return parts.length > 0 ? parts.join(' ') : assigner.username;
  };

  // Tarih formatı
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      dateStyle: 'long',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  };

  // Görev durumunu belirle (otomatik kontrol ile)
  const getAssignmentStatus = (assignment: Assignment): string => {
    if (assignment.status === 'completed') {
      return 'completed';
    }
    if (assignment.status === 'cancelled') {
      return 'cancelled';
    }
    
    const today = new Date();
    const expectedDate = new Date(assignment.expectedDelivery);
    if (today > expectedDate && assignment.status === 'pending') {
      return 'cancelled';
    }
    
    return assignment.status;
  };

  // Görev durumu görüntü metni
  const getStatusDisplay = (assignment: Assignment): string => {
    const status = getAssignmentStatus(assignment);
    if (status === 'completed') {
      return 'Tamamlandı';
    }
    if (status === 'cancelled') {
      return 'İptal edildi';
    }
    return 'Beklemede';
  };

  // Görev durumu rengi
  const getStatusColor = (assignment: Assignment): string => {
    const status = getAssignmentStatus(assignment);
    if (status === 'completed') {
      return 'text-primary';
    }
    if (status === 'cancelled') {
      return 'text-red-400';
    }
    return 'text-yellow-400';
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-text-tertiary">Yükleniyor...</div>
      </div>
    );
  }

  // Kullanıcı bilgilerini al
  const user = session?.user as any;
  const userRutbe = user?.rutbe || '';
  const userIsim = user?.isim || '';
  const userSoyisim = user?.soyisim || '';
  const fullName = userIsim && userSoyisim ? `${userIsim} ${userSoyisim}` : user?.username || '';

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Hoş Geldiniz */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-text-primary">
          Hoş Geldiniz {userRutbe && <span className="text-primary font-rye">{userRutbe}</span>} {fullName}
        </h1>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-6">
        {/* Son Toplantı Kayıtları */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Son Toplantı Kayıtları</h2>
            <Link
              href="/dashboard/toplanti-kayitlari"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {recentMeetings.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Henüz toplantı kaydı eklenmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href="/dashboard/toplanti-kayitlari"
                  className="block p-2 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <h3 className="text-text-primary font-medium mb-1 text-xs lg:text-base">{meeting.title}</h3>
                  <p className="text-xs lg:text-sm text-text-tertiary">
                    {formatDate(meeting.meetingDate)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Gelecek Etkinlikler */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Gelecek Etkinlikler</h2>
            <Link
              href="/dashboard/etkinlikler"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Henüz gelecek etkinlik eklenmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href="/dashboard/etkinlikler"
                  className="block p-2 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <h3 className="text-text-primary font-medium mb-1 text-xs lg:text-base">{event.title}</h3>
                  <p className="text-xs lg:text-sm text-text-tertiary">
                    {formatDateTime(event.eventDate)}
                  </p>
                  <p className="text-xs lg:text-sm text-text-tertiary">
                    {event.location}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-6">
        {/* Son Duyurular */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Son Duyurular</h2>
            <Link
              href="/dashboard/duyurular"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {recentAnnouncements.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Henüz duyuru eklenmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {recentAnnouncements
                .map((announcement) => {
                  const isScheduled = announcement.status === 'scheduled';
                  const isScheduledWithNotify = isScheduled && announcement.notifyBefore;
                  const remainingSeconds = countdowns[announcement.id] ?? (announcement.scheduledAt 
                    ? Math.max(0, Math.floor((new Date(announcement.scheduledAt).getTime() - Date.now()) / 1000))
                    : 0);

                  return (
                    <Link
                      key={announcement.id}
                      href="/dashboard/duyurular"
                      className={`block p-2 lg:p-4 hover:bg-background-tertiary transition-all ${isScheduledWithNotify ? 'bg-blue-900/10 border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <h3 className="text-text-primary font-medium flex-1 text-xs lg:text-base">{announcement.title}</h3>
                        <div className="flex flex-col gap-1 items-end flex-shrink-0">
                          <span className={`px-1.5 py-0.5 text-[10px] lg:text-xs rounded border whitespace-nowrap ${
                            announcement.importance === 'yüksek' 
                              ? 'bg-red-900/20 text-red-400 border-red-500/30' 
                              : announcement.importance === 'düşük'
                              ? 'bg-gray-700/20 text-gray-400 border-gray-600/30'
                              : 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30'
                          }`}>
                            {announcement.importance === 'yüksek' ? 'Yüksek' : announcement.importance === 'düşük' ? 'Düşük' : 'Normal'}
                          </span>
                          {isScheduled && (
                            <span className="px-1.5 py-0.5 text-[10px] lg:text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded whitespace-nowrap">
                              Planlı
                            </span>
                          )}
                        </div>
                      </div>
                      {isScheduledWithNotify && (
                        <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-md">
                          <div className="flex items-center gap-1 mb-1">
                            <svg className="w-3 h-3 lg:w-4 lg:h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-[10px] lg:text-xs font-medium text-blue-400">
                              Kalan Süre: <span className="font-bold">{formatCountdown(remainingSeconds)}</span>
                            </p>
                          </div>
                        </div>
                      )}
                      {!isScheduledWithNotify && (
                        <p className="text-[10px] lg:text-sm text-text-tertiary line-clamp-2 mb-1">
                          {announcement.content}
                        </p>
                      )}
                      <div className="text-[10px] lg:text-xs text-gray-500">
                        <p className="truncate">
                          {announcement.creator.rutbe || ''} {announcement.creator.isim || ''} {announcement.creator.soyisim || ''} - {isScheduled && announcement.scheduledAt ? formatDateTime(announcement.scheduledAt) : formatDateTime(announcement.createdAt)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>

        {/* Bekleyen Görevlendirmeler */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Bekleyen Görevlendirmeler</h2>
            <Link
              href="/dashboard/gorevlendirmeler"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {pendingAssignments.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Bekleyen görevlendirme yok</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {pendingAssignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href="/dashboard/gorevlendirmeler"
                  className="block p-2 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-text-primary font-medium mb-1 text-xs lg:text-base">{assignment.task}</h3>
                      <div className="text-xs lg:text-sm text-text-tertiary space-y-0.5">
                        <p>
                          Görevlendirilen: {getUserName(assignment.assignee)}
                        </p>
                        <p>
                          Görevlendiren: {getAssignerDisplay(assignment.assigner)}
                        </p>
                        <p>
                          Beklenilen Teslim: {formatDate(assignment.expectedDelivery)}
                        </p>
                        <p className={getStatusColor(assignment)}>
                          Durum: {getStatusDisplay(assignment)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-2 lg:gap-6">
        {/* Son Oylamalar */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Son Oylamalar</h2>
            <Link
              href="/dashboard/oylamalar"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {recentPolls.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Henüz oylama eklenmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {recentPolls.map((poll) => (
                <Link
                  key={poll.id}
                  href="/dashboard/oylamalar"
                  className="block p-2 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-text-primary font-medium mb-1 text-xs lg:text-base">
                        {poll.title}
                      </h3>
                      {poll.details ? (
                        <p className="text-[10px] lg:text-sm text-text-tertiary line-clamp-2 mb-1">
                          {poll.details}
                        </p>
                      ) : null}
                      <p className="text-[10px] lg:text-xs text-gray-500">
                        {formatDateTime(poll.createdAt)} • {poll.type === 'yesno' ? 'Evet/Hayır' : 'Çoklu Seçenek'}
                      </p>
                    </div>
                    <span className="text-[10px] lg:text-xs px-1.5 py-0.5 rounded border border-border text-text-tertiary">
                      {poll.allowCustomOption ? 'Özel seçenek açık' : 'Özel seçenek kapalı'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-2 lg:gap-6">
        {/* Son Araştırmalar */}
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-2 lg:p-4 border-b border-border flex justify-between items-center">
            <h2 className="text-xs lg:text-xl font-semibold text-text-primary">Son Araştırmalar</h2>
            <Link
              href="/dashboard/arastirmalar"
              className="text-primary text-xs lg:text-sm hover:text-primary/80 transition-all"
            >
              Tümünü Gör
            </Link>
          </div>
          {recentResearches.length === 0 ? (
            <div className="p-4 lg:p-8 text-center text-text-tertiary">
              <p className="text-xs">Henüz araştırma eklenmemiş</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {recentResearches.map((research) => (
                <Link
                  key={research.id}
                  href="/dashboard/arastirmalar"
                  className="block p-2 lg:p-4 hover:bg-background-tertiary transition-all"
                >
                  <h3 className="text-text-primary font-medium mb-1 text-xs lg:text-base">{research.title}</h3>
                  <p className="text-[10px] lg:text-sm text-text-tertiary line-clamp-2 mb-1">
                    {research.content}
                  </p>
                  <div className="flex items-center gap-2">
                    {research.fileName && (
                      <span className="text-[10px] lg:text-xs text-gray-500 px-1.5 py-0.5 bg-background rounded border border-gray-700">
                        📎 {research.fileName}
                      </span>
                    )}
                    <p className="text-[10px] lg:text-xs text-gray-500 truncate">
                      {research.creator.rutbe || ''} {research.creator.isim || ''} {research.creator.soyisim || ''} - {formatDate(research.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
