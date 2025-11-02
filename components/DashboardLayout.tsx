'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import Image from 'next/image';
import { hasPermission } from '@/lib/auth';

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
    },
    {
      name: 'Etkinlikler',
      href: '/dashboard/etkinlikler',
      resource: 'events',
      action: 'read',
    },
    {
      name: 'Görevlendirmeler',
      href: '/dashboard/gorevlendirmeler',
      resource: 'assignments',
      action: 'read',
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
    },
    {
      name: 'İşlem Kayıtları',
      href: '/dashboard/islem-kayitlari',
      resource: 'activityLogs',
      action: 'read',
    },
    {
      name: 'Yetkilendirme',
      href: '/dashboard/yetkilendirme',
      resource: 'roles',
      action: 'read',
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Menu Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-background-secondary border-r border-gray-700 flex flex-col z-50 transition-transform lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image 
                src="/lpbhlogo.png" 
                alt="LPBH Logo" 
                width={40} 
                height={40}
                className="flex-shrink-0"
              />
              <h1 className="text-xl font-bold text-white">LPBH FOP</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
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
                <p className="text-sm text-gray-300">
                  {[session.user.isim, session.user.soyisim].filter(Boolean).join(' ')}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  {session.user.username}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                  isActive
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-gray-400 hover:bg-background-tertiary hover:text-white'
                }`}
              >
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer - Bilgilerim ve Çıkış */}
        <div className="p-4 border-t border-gray-700 space-y-2 flex-shrink-0">
          <Link
            href="/dashboard/bilgilerim"
            onClick={() => setSidebarOpen(false)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
              pathname === '/dashboard/bilgilerim'
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-gray-400 hover:bg-background-tertiary hover:text-white'
            }`}
          >
            <span className="font-medium">Bilgilerim</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-gray-400 hover:bg-background-tertiary hover:text-white transition-all"
          >
            <span className="font-medium">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 overflow-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-background-secondary border-b border-gray-700 p-4 flex items-center gap-3 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
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
            <h1 className="text-lg font-bold text-white">LPBH FOP</h1>
          </div>
        </div>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

    </div>
  );
}
