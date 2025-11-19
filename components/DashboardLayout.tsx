'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import { hasPermission } from '@/lib/auth';
import { useTheme } from '@/contexts/ThemeContext';
import * as Accordion from '@radix-ui/react-accordion';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface UserInfo {
  id: string;
  username: string;
  rutbe: string | null;
  isim: string | null;
  soyisim: string | null;
  tckn: string | null;
  telefon: string | null;
  evAdresi: string | null;
  yakiniIsmi: string | null;
  yakiniTelefon: string | null;
  ruhsatSeriNo: string | null;
  kanGrubu: string | null;
  createdAt: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isDev = process.env.NODE_ENV !== 'production';
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const allMenuItems = [
    {
      name: 'Ana Ekran',
      href: '/dashboard',
      resource: null, // Herkes görebilmeli
      action: null,
    },
    {
      name: 'Üyeler',
      href: '/dashboard/uyeler',
      resource: 'users',
      action: 'read',
    },
    {
      name: 'Üye Onayı',
      href: '/dashboard/uyeler/onay',
      resource: 'userApproval',
      action: null, // approve veya reject yetkisi varsa göster
    },
    {
      name: 'Toplantı Kayıtları',
      href: '/dashboard/toplanti-kayitlari',
      resource: 'meetings',
      action: 'read',
      eventType: 'meeting' as const,
    },
    {
      name: 'Oylamalar',
      href: '/dashboard/oylamalar',
      resource: 'polls',
      action: 'read',
      eventType: 'poll' as const,
    },
    {
      name: 'Belgeler',
      href: '/dashboard/belgeler',
      resource: 'documents',
      action: 'read',
      eventType: 'document' as const,
    },
    {
      name: 'Etkinlikler',
      href: '/dashboard/etkinlikler',
      resource: 'events',
      action: 'read',
      eventType: 'event' as const,
    },
    {
      name: 'Görevlendirmeler',
      href: '/dashboard/gorevlendirmeler',
      resource: 'assignments',
      action: 'read',
      eventType: 'assignment' as const,
    },
    {
      name: 'Rotalar',
      href: '/dashboard/rotalar',
      resource: 'routes',
      action: 'read',
    },
    {
      name: 'Duyurular',
      href: '/dashboard/duyurular',
      resource: 'announcements',
      action: 'read',
      eventType: 'announcement' as const,
    },
    {
      name: 'İşlem Kayıtları',
      href: '/dashboard/islem-kayitlari',
      resource: 'activityLogs',
      action: 'read',
    },
    {
      name: 'Araştırmalar',
      href: '/dashboard/arastirmalar',
      resource: 'researches',
      action: 'read',
      eventType: 'research' as const,
    },
    {
      name: 'Vatandaş Veritabanı',
      href: '/dashboard/vatandas-veritabani',
      resource: 'citizenDatabase',
      action: 'read',
    },
    {
      name: 'Sohbet',
      href: '/dashboard/sohbet',
      resource: null, // Herkes görebilmeli
      action: null,
    },
    {
      name: 'Yetkilendirme',
      href: '/dashboard/yetkilendirme',
      resource: 'roles',
      action: 'read',
    },
    {
      name: 'Ayarlar',
      href: '/dashboard/ayarlar',
      resource: null, // Sistem admin kontrolü sayfada yapılacak
      action: null,
    },
  ];

  // Kullanıcının izinlerine göre menü öğelerini filtrele
  const menuItems = allMenuItems.filter((item) => {
    if (!item.resource) {
      // resource yoksa her zaman göster (Ana Ekran gibi)
      return true;
    }
    
    const permissions = session?.user?.permissions;
    
    // İzinler yoksa gizle
    if (!permissions) {
      return false;
    }
    
    if (item.resource === 'userApproval') {
      // userApproval için action belirtilmemişse herhangi bir yetki olup olmadığını kontrol et
      return hasPermission(permissions, 'userApproval');
    }
    
    // Diğer kaynaklar için action'a göre kontrol
    return hasPermission(permissions, item.resource, item.action as string);
  });

  // Sidebar kategorileri - Radix UI Accordion kullanıyor, state gerekmiyor

  // Menu item bulucu
  const findItem = (href: string) => menuItems.find((m) => m.href === href);

  // Kategorize edilmiş menü
  const categorizedMenu: Array<{ name: string; items: Array<NonNullable<ReturnType<typeof findItem>>> }> = [
    {
      name: 'Üyeler',
      items: [findItem('/dashboard/uyeler'), findItem('/dashboard/uyeler/onay')].filter(Boolean) as any,
    },
    {
      name: 'Olaylar',
      items: [
        findItem('/dashboard/etkinlikler'),
        findItem('/dashboard/duyurular'),
        findItem('/dashboard/gorevlendirmeler'),
        findItem('/dashboard/oylamalar'),
      ].filter(Boolean) as any,
    },
    {
      name: 'Kasa',
      items: [
        findItem('/dashboard/rotalar'),
        findItem('/dashboard/toplanti-kayitlari'),
        findItem('/dashboard/belgeler'),
        findItem('/dashboard/arastirmalar'),
      ].filter(Boolean) as any,
    },
    {
      name: 'Yönetim',
      items: [
        findItem('/dashboard/yetkilendirme'),
        findItem('/dashboard/ayarlar'),
        findItem('/dashboard/vatandas-veritabani'),
      ].filter(Boolean) as any,
    },
  ];

  // Okunmamış event sayılarını getir
  const fetchUnreadCounts = async () => {
    if (!session?.user?.id) {
      if (isDev) console.log('fetchUnreadCounts: No session user id');
      return;
    }

    try {
      if (isDev) console.log('fetchUnreadCounts: Fetching unread counts...');
      const res = await fetch('/api/read-status?unreadCounts=true', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const counts = data.unreadCounts || {};
        if (isDev) {
          console.log('Unread counts fetched:', counts);
          console.log('Setting unreadCounts state:', counts);
        }
        setUnreadCounts(counts);
        
        // Debug: Her event type için kontrol
        if (isDev) {
          Object.entries(counts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} unread`);
          });
        }
      } else {
        if (isDev) console.error('Failed to fetch unread counts:', res.status);
        const errorText = await res.text();
        if (isDev) console.error('Error response:', errorText);
      }
    } catch (error) {
      if (isDev) console.error('Error fetching unread counts:', error);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    // Pathname değiştiğinde hemen fetch et, ama bir event type sayfasıysa kısa bir gecikmeyle de tekrar fetch et
    // (sayfa yüklenip markAllAsRead çağrıldıktan sonra güncel veriyi almak için)
    fetchUnreadCounts();
    
    // Event type sayfasına gidildiyse, sayfanın markAllAsRead'i tamamlanması için kısa bir gecikmeyle tekrar fetch et
    const eventTypePaths = ['/dashboard/toplanti-kayitlari', '/dashboard/etkinlikler', '/dashboard/gorevlendirmeler', '/dashboard/duyurular', '/dashboard/arastirmalar', '/dashboard/oylamalar', '/dashboard/belgeler'];
    const isEventTypePage = eventTypePaths.includes(pathname);
    let timeout: NodeJS.Timeout | null = null;
    
    if (isEventTypePage) {
      timeout = setTimeout(() => {
        fetchUnreadCounts();
      }, 1000); // 1 saniye gecikme - sayfanın markAllAsRead'i tamamlanması için
    }
    
    // Her 30 saniyede bir güncelle
    const interval = setInterval(fetchUnreadCounts, 30000);
    
    return () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, pathname]); // pathname değiştiğinde de güncelle

  // Tüm eventleri okundu işaretle
  const markAllAsRead = async (eventType: string) => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/read-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType }),
        credentials: 'include',
      });

      if (res.ok) {
        // Local state'i güncelle
        setUnreadCounts((prev) => ({
          ...prev,
          [eventType]: 0,
        }));
        // Unread counts'u yeniden getir (güncel veri için)
        await fetchUnreadCounts();
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Mark all as read failed:', errorData);
      }
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'transparent' }}>
      {/* Mobile Menu Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 border-r border-border flex flex-col z-50 transition-transform lg:translate-x-0 backdrop-blur-md ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ backgroundColor: 'var(--background-secondary)' }}>
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/lpbhlogo.png" 
                alt="LPBH Logo" 
                width={40} 
                height={40}
                className="flex-shrink-0"
              />
              <h1 className="text-xl font-bold text-text-primary">LPBH FOP</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-text-tertiary hover:text-text-primary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {session?.user && (
            <div className="space-y-1">
              {session.user.rutbe && (
                <p className="text-sm text-primary font-medium font-rye">
                  {session.user.rutbe}
                </p>
              )}
              {(session.user.isim || session.user.soyisim) ? (
                <p className="text-sm text-text-secondary">
                  {[session.user.isim, session.user.soyisim].filter(Boolean).join(' ')}
                </p>
              ) : (
                <p className="text-sm text-text-tertiary">
                  {session.user.username}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto sidebar-scrollbar">
          {/* Ana Ekran */}
          {findItem('/dashboard') && (
            <Link
              href="/dashboard"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                pathname === '/dashboard'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-text-tertiary hover:bg-background-tertiary hover:text-text-primary'
              }`}
            >
              <span className="font-medium">Ana Ekran</span>
            </Link>
          )}

          {/* Sohbet - direkt link */}
          {findItem('/dashboard/sohbet') && (
            <Link
              href="/dashboard/sohbet"
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                pathname === '/dashboard/sohbet'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-text-tertiary hover:bg-background-tertiary hover:text-text-primary'
              }`}
            >
              <span className="font-medium">Sohbet</span>
            </Link>
          )}

          {/* Kategoriler - Radix UI Accordion */}
          <Accordion.Root type="multiple" className="space-y-2">
            {categorizedMenu.map((section) => {
              if (!section.items.length) return null;
              return (
                <Accordion.Item key={section.name} value={section.name} className="overflow-hidden">
                  <Accordion.Header>
                    <Accordion.Trigger className="w-full flex items-center justify-between px-4 py-3 text-text-secondary hover:text-text-primary hover:bg-background-tertiary transition rounded-md data-[state=open]:text-text-primary">
                      <span className="font-semibold">{section.name}</span>
                      <svg
                        className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="pl-2 pr-2 pb-1 pt-1 space-y-1">
                      {section.items.map((item) => {
                        const isActive = pathname === item.href;
                        const unreadCount = item.eventType ? (unreadCounts[item.eventType] || 0) : 0;
                        const hasUnread = item.eventType && unreadCount > 0;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={async (e) => {
                              setSidebarOpen(false);
                              if (item.eventType) {
                                e.preventDefault();
                                await markAllAsRead(item.eventType);
                                router.push(item.href);
                              }
                            }}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                              isActive
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'text-text-tertiary hover:bg-background-tertiary hover:text-text-primary'
                            }`}
                          >
                            {hasUnread && <div className="w-3.5 h-3.5 bg-green-500 rounded-full flex-shrink-0" />}
                            <span className="text-sm">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>
        </nav>

        {/* Footer - Tema, Bilgilerim ve Çıkış */}
        <div className="p-4 border-t border-border space-y-2 flex-shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md text-text-tertiary hover:bg-background-tertiary hover:text-text-primary transition-all"
            title={theme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
          >
            <div className="flex items-center gap-3">
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              <span className="font-medium">{theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}</span>
            </div>
            <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-background-tertiary' : 'bg-primary'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${theme === 'dark' ? 'translate-x-0' : 'translate-x-6'}`} />
            </div>
          </button>
          
          <Link
            href="/dashboard/bilgilerim"
            onClick={() => setSidebarOpen(false)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
              pathname === '/dashboard/bilgilerim'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-text-tertiary hover:bg-background-tertiary hover:text-text-primary'
            }`}
          >
            <span className="font-medium">Bilgilerim</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-text-tertiary hover:bg-background-tertiary hover:text-text-primary transition-all"
          >
            <span className="font-medium">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 lg:ml-64 relative z-10 ${pathname === '/dashboard/sohbet' ? 'overflow-hidden flex flex-col h-screen lg:h-screen' : 'overflow-auto'}`}>
        {/* Mobile Header */}
        <div className={`lg:hidden border-b border-border p-4 flex items-center gap-3 backdrop-blur-md ${pathname === '/dashboard/sohbet' ? 'flex-shrink-0' : 'sticky top-0'} z-30`} style={{ backgroundColor: 'var(--background-secondary)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-tertiary hover:text-text-primary"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <Image 
              src="/lpbhlogo.png" 
              alt="LPBH Logo" 
              width={32} 
              height={32}
              className="flex-shrink-0"
            />
            <h1 className="text-lg font-bold text-text-primary">LPBH FOP</h1>
          </div>
        </div>
        <div className={pathname === '/dashboard/sohbet' ? 'p-0 flex-1 min-h-0' : 'p-4 lg:p-6'}>
          {children}
        </div>
      </main>

    </div>
  );
}
