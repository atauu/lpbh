'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Login sayfasında logoutOnClose flag'ini temizle (login flow başlangıcı)
  useEffect(() => {
    // Login sayfasına geldiğimizde logoutOnClose flag'ini temizle
    // Bu sayede login flow sırasında logout tetiklenmez
    sessionStorage.removeItem('logoutOnClose');
    
    // Mobilde sayfanın kaydırılmasını engelle
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Component unmount olduğunda overflow'u geri yükle
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Login flow başladığını işaretle
    sessionStorage.setItem('loginInProgress', 'true');

    try {
      // Önce sadece username ve password ile login dene (2FA token olmadan)
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === '2FA_REQUIRED_BUT_NOT_SETUP') {
          setError('Sistem genelinde 2FA aktif. Lütfen önce 2FA\'nızı kurun.');
          setIsLoading(false);
          return;
        }
        if (result.error === '2FA_TOKEN_REQUIRED') {
          // Username/password doğru ama 2FA token gerekiyor
          // Username ve password'u geçici olarak sakla (sadece 2FA verification için)
          sessionStorage.setItem('pendingLoginUsername', username);
          sessionStorage.setItem('pendingLoginPassword', password);
          // Verification sayfasına yönlendir
          router.push('/auth/verify-2fa');
          return;
        } else if (result.error === 'MEMBERSHIP_REJECTED') {
          setError('Üyeliğiniz reddedilmiş. Lütfen yönetici ile iletişime geçin.');
        } else {
          setError('Kullanıcı adı veya şifre hatalı!');
        }
      } else {
        // Login başarılı - logoutOnClose flag'ini hemen temizle (login başarılı, logout yapma)
        // Bu flag'i hemen temizle ki dashboard'a yönlendirildiğinde logout tetiklenmesin
        sessionStorage.removeItem('logoutOnClose');
        // Login flow devam ediyor - bu işareti koru (dashboard'a gidince temizlenecek)
        
        // Cookie'lerin set edilmesi için biraz bekle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Cookie'lerin set edildiğinden emin olmak için session'ı kontrol et
        let sessionReady = false;
        let attempts = 0;
        const maxAttempts = 15;
        
        while (!sessionReady && attempts < maxAttempts) {
          try {
            // credentials: 'include' ile cookie'leri gönder
            const sessionRes = await fetch('/api/auth/session', {
              credentials: 'include',
              cache: 'no-store',
            });
            
            if (sessionRes.ok) {
              const session = await sessionRes.json();
              if (session?.user?.id) {
                sessionReady = true;
                
                // Session hazır, üyelik durumunu kontrol et
                const membershipStatus = session?.user ? (session.user as any).membershipStatus : null;
                
                if (membershipStatus === 'pending_info') {
                  // Bilgilerini tamamlaması gerekiyor
                  window.location.href = '/dashboard/complete-registration';
                  return;
                }
                
                if (membershipStatus === 'pending_approval') {
                  // Onay bekliyor
                  window.location.href = '/dashboard/pending-approval';
                  return;
                }
                
                if (membershipStatus !== 'approved') {
                  // Onaylanmamış
                  setError('Üyeliğiniz henüz onaylanmamış.');
                  sessionStorage.removeItem('loginInProgress');
                  return;
                }
                
                // Global 2FA durumunu kontrol et - sadece global 2FA açıksa 2FA kontrolü yap
                try {
                  const globalStatusRes = await fetch('/api/settings/2fa/global-status', {
                    credentials: 'include',
                  });
                  const globalStatus = globalStatusRes.ok ? await globalStatusRes.json() : { enabled: false };
                  
                  // Global 2FA açıksa kullanıcının 2FA durumunu kontrol et
                  if (globalStatus.enabled) {
                    const statusRes = await fetch('/api/two-factor/status', {
                      credentials: 'include',
                    });
                    if (statusRes.ok) {
                      const status = await statusRes.json();
                      if (!status.isSetup || !status.enabled) {
                        // Global 2FA açık ama kullanıcının 2FA'sı yok, setup sayfasına yönlendir
                        window.location.href = '/settings/two-factor?required=true';
                        return;
                      } else {
                        // Global 2FA açık ve kullanıcının 2FA'sı var ama token verilmemiş, verification sayfasına yönlendir
                        sessionStorage.setItem('pendingLoginUsername', username);
                        sessionStorage.setItem('pendingLoginPassword', password);
                        window.location.href = '/auth/verify-2fa';
                        return;
                      }
                    }
                  }
                  // Global 2FA kapalıysa hiçbir 2FA kontrolü yapma, direkt dashboard'a git
                } catch (error) {
                  console.error('2FA status check error:', error);
                }
                
                // 2FA kontrolü başarısız oldu veya 2FA yok, dashboard'a git
                // Login flow'u temizle ve dashboard'a yönlendir
                sessionStorage.removeItem('loginInProgress');
                // Sayfa reload ile cookie'leri garantile
                window.location.href = '/dashboard';
                return;
              }
            }
          } catch (error) {
            console.error('Session check error:', error);
          }
          
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Session hazır olmadı ama yine de dashboard'a git (middleware kontrol edecek)
        // Login flow'u temizle
        sessionStorage.removeItem('loginInProgress');
        // Sayfa reload ile cookie'leri garantile
        window.location.href = '/dashboard';
      }
    } catch (error) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      // Hata durumunda login flow'u temizle
      sessionStorage.removeItem('loginInProgress');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen overflow-hidden flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-4">
            <Image 
              src="/lpbhlogo.png" 
              alt="LPBH Logo" 
              width={80} 
              height={80}
              className="flex-shrink-0"
            />
          </div>
          <h2 className="mt-6 text-center text-2xl font-extrabold text-white">
            Fonksiyonel Organizasyon Paneli
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Lütfen hesabınıza giriş yapın
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Kullanıcı Adı
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-background-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                placeholder="Kullanıcı adınızı girin"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-background-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                placeholder="Şifrenizi girin"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-500/50 p-3 backdrop-blur-sm">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <Button type="submit" disabled={isLoading} variant="primary" className="w-full justify-center py-3">
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

