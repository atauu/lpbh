'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';

// Pencere kapandığında logout yapmak için ayrı bir component
function LogoutOnClose() {
  const { data: session } = useSession();
  
  useEffect(() => {
    // Pencere kapandığında logout - sadece beforeunload (gerçek kapanma)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Sadece gerçekten pencere kapanırken set et
      // Login flow başlatıldı mı kontrol et
      const isLoginFlow = sessionStorage.getItem('loginInProgress') === 'true';
      if (!isLoginFlow) {
        try {
          sessionStorage.setItem('logoutOnClose', Date.now().toString());
        } catch (err) {
          // sessionStorage erişilemiyorsa hata verme
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Sayfa yüklendiğinde kontrol et - AMA sadece dashboard sayfasında ve session varsa
  // VE login flow aktif değilse
  useEffect(() => {
    const isLoginFlow = sessionStorage.getItem('loginInProgress') === 'true';
    if (isLoginFlow) {
      // Login flow aktifse hiçbir şey yapma
      return;
    }

    // Sadece dashboard sayfasındaysak ve logoutOnClose flag'i set edilmişse logout yap
    const logoutFlag = sessionStorage.getItem('logoutOnClose');
    const isDashboard = window.location.pathname.startsWith('/dashboard');
    
    // Eğer logout flag'i varsa VE session varsa VE dashboard sayfasındaysak logout yap
    // Ama login flow'dan sonra gelen yönlendirmelerde değil
    if (logoutFlag && session?.user && isDashboard) {
      // Flag'in timestamp'ini kontrol et - eğer çok yeni ise (son 2 saniye) logout yapma
      // (bu login flow'dan sonraki yönlendirme olabilir)
      const flagTimestamp = parseInt(logoutFlag);
      const timeDiff = Date.now() - flagTimestamp;
      
      // Eğer flag çok yeni ise (2 saniye içinde), muhtemelen login flow'dan sonra set edilmiş
      if (timeDiff > 2000) {
        // Dashboard sayfasındayız ve flag var - logout yap
        setTimeout(() => {
          const stillFlag = sessionStorage.getItem('logoutOnClose');
          const stillIsDashboard = window.location.pathname.startsWith('/dashboard');
          if (stillFlag && stillIsDashboard && session?.user) {
            sessionStorage.removeItem('logoutOnClose');
            signOut({ redirect: false });
          }
        }, 500);
      } else {
        // Flag çok yeni, muhtemelen login flow - temizle
        sessionStorage.removeItem('logoutOnClose');
      }
    } else if (logoutFlag) {
      // Dashboard dışındaki sayfalardaysak sadece flag'i temizle
      sessionStorage.removeItem('logoutOnClose');
    }
  }, [session]);

  return null;
}

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider>
      <LogoutOnClose />
      {children}
    </NextAuthSessionProvider>
  );
}

