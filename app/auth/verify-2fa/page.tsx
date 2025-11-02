'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function Verify2FAPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pending login bilgilerini kontrol et - sadece mount olduğunda
  useEffect(() => {
    let mounted = true;
    let redirectTimeout: NodeJS.Timeout;

    const checkPendingLogin = () => {
      if (!mounted) return;
      
      const pendingUsername = sessionStorage.getItem('pendingLoginUsername');
      const pendingPassword = sessionStorage.getItem('pendingLoginPassword');
      
      // Pending login bilgileri varsa sayfada kal, yönlendirme yapma
      if (pendingUsername && pendingPassword) {
        return; // Sayfada kal - pending bilgiler var
      }
      
      // Pending bilgiler yoksa login'e git
      // Biraz bekle çünkü login sayfasından yönlendirme sırasında sessionStorage'a yazılıyor olabilir
      redirectTimeout = setTimeout(() => {
        if (!mounted) return;
        
        const finalPendingUsername = sessionStorage.getItem('pendingLoginUsername');
        const finalPendingPassword = sessionStorage.getItem('pendingLoginPassword');
        
        // Hala pending bilgiler yoksa login'e yönlendir
        if (!finalPendingUsername && !finalPendingPassword) {
          router.push('/login');
        }
      }, 1000); // 1 saniye bekle (login sayfasından yönlendirme için yeterli süre)
    };

    // Kısa bir gecikme ile kontrol et (sessionStorage yazımı için)
    const initialTimeout = setTimeout(() => {
      checkPendingLogin();
    }, 200);
    
    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Sadece mount olduğunda çalış

  // Session varsa 2FA durumunu kontrol et
  useEffect(() => {
    if (session && status === 'authenticated') {
      const check2FAStatus = async () => {
        try {
          const res = await fetch('/api/two-factor/status');
          if (res.ok) {
            const data = await res.json();
            
            if (!data.isSetup || !data.enabled) {
              // 2FA kurulmamış, setup sayfasına yönlendir
              router.push('/settings/two-factor?required=true');
            }
          }
        } catch (error) {
          console.error('2FA status check error:', error);
        }
      };
      
      check2FAStatus();
    }
  }, [session, status, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!twoFactorToken || twoFactorToken.length !== 6) {
      setError('Lütfen 6 haneli kodu girin');
      setIsLoading(false);
      return;
    }

    try {
      // Session varsa da pending username/password ile login yapmalıyız
      // çünkü authorize fonksiyonu hem username/password hem de token'ı kontrol ediyor

      // Pending username ve password'u kontrol et (session olsa da olmasa da)
      const pendingUsername = sessionStorage.getItem('pendingLoginUsername');
      const pendingPassword = sessionStorage.getItem('pendingLoginPassword');
      
      if (!pendingUsername || !pendingPassword) {
        throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
      }

      // Token'ı temizle
      const cleanToken = String(twoFactorToken).trim().replace(/\D/g, '').slice(0, 6);
      
      if (cleanToken.length !== 6) {
        throw new Error('Geçerli bir 6 haneli kod girin');
      }

      console.log('Attempting login with 2FA token:', {
        username: pendingUsername,
        tokenLength: cleanToken.length,
      });

      // Direkt olarak username, password ve 2FA token ile login yap
      // signIn içinde token doğrulaması yapılacak
      const loginResult = await signIn('credentials', {
        username: String(pendingUsername).trim(),
        password: String(pendingPassword).trim(),
        twoFactorToken: cleanToken,
        redirect: false,
      });

      console.log('Login result:', {
        error: loginResult?.error,
        ok: loginResult?.ok,
      });

      if (loginResult?.error) {
        if (loginResult.error === '2FA_TOKEN_INVALID') {
          throw new Error('Token geçersiz veya süresi dolmuş. Lütfen Microsoft Authenticator uygulamanızdan yeni bir kod alın ve tekrar deneyin.');
        } else if (loginResult.error === '2FA_TOKEN_REQUIRED') {
          // Bu durumda zaten 2FA sayfasındayız, bu hata olmamalı
          throw new Error('2FA token gerekli. Lütfen kodu girin.');
        } else {
          throw new Error(loginResult.error || 'Giriş başarısız. Lütfen tekrar deneyin.');
        }
      }

      // Login başarılı, pending bilgileri temizle ve dashboard'a yönlendir
      sessionStorage.removeItem('pendingLoginUsername');
      sessionStorage.removeItem('pendingLoginPassword');
      sessionStorage.removeItem('loginInProgress'); // Login flow tamamlandı
      sessionStorage.removeItem('logoutOnClose'); // Logout flag'ini de temizle
      
      // Session'ı güncelle (2FA enabled bilgisini yenile)
      await updateSession();
      
      // Kısa bir süre bekle ki session güncellensin
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Dashboard'a yönlendir
      try {
        await router.push('/dashboard');
        // Yönlendirme başarısız olursa window.location ile dene
        setTimeout(() => {
          if (window.location.pathname !== '/dashboard') {
            window.location.href = '/dashboard';
          }
        }, 500);
      } catch (error) {
        console.error('Navigation error:', error);
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      setError(error.message || 'Token geçersiz. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  // Pending login bilgilerini kontrol et (her render'da)
  const pendingUsername = sessionStorage.getItem('pendingLoginUsername');
  const pendingPassword = sessionStorage.getItem('pendingLoginPassword');
  
  // Session loading durumunda sayfayı göster
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Yükleniyor...</div>
      </div>
    );
  }

  // Eğer session yoksa ve pending login de yoksa, yönlendirme yapılacak
  // Ama burada sadece pending bilgiler varsa sayfayı göster
  // useEffect'te yönlendirme yapılacak, burada sadece güvenlik için kontrol

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            2FA Doğrulama Gerekli
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Microsoft Authenticator uygulamanızdan 6 haneli kodu girin
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleVerify}>
          <div>
            <label htmlFor="twoFactorToken" className="block text-sm font-medium text-gray-300 mb-2">
              2FA Doğrulama Kodu
            </label>
            <input
              id="twoFactorToken"
              name="twoFactorToken"
              type="text"
              required
              value={twoFactorToken}
              onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="appearance-none relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-background-secondary rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-center text-2xl tracking-widest backdrop-blur-sm"
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-400 text-center">
              Microsoft Authenticator uygulamanızdan kodu girin
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-500/50 p-3 backdrop-blur-sm">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading || twoFactorToken.length !== 6}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
            >
              {isLoading ? 'Doğrulanıyor...' : 'Doğrula ve Devam Et'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

