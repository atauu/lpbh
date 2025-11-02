'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signIn } from 'next-auth/react';

export default function TwoFactorSetupPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();
  const [twoFactorStatus, setTwoFactorStatus] = useState<{
    enabled: boolean;
    isSetup: boolean;
  } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (session) {
      fetchStatus();
    }
  }, [status, router, session]);

  // Ayrı bir useEffect ile otomatik setup kontrolü (sadece bir kez çalışsın)
  useEffect(() => {
    if (session && status === 'authenticated' && !isLoading && !isSettingUp) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('required') === 'true' && twoFactorStatus && !twoFactorStatus.enabled) {
        // Sadece bir kez setup başlat
        const hasStarted = sessionStorage.getItem('setupStarted');
        if (!hasStarted) {
          sessionStorage.setItem('setupStarted', 'true');
          handleSetup();
        }
      }
    }
  }, [session, status, twoFactorStatus, isLoading, isSettingUp]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/two-factor/status');
      const data = await res.json();
      setTwoFactorStatus(data);
      if (data.isSetup && !data.enabled) {
        setIsSettingUp(true);
      }
    } catch (error) {
      console.error('Status fetch error:', error);
    }
  };

  const handleSetup = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/two-factor/setup', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Setup başarısız');
      }

      const data = await res.json();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setManualEntryKey(data.manualEntryKey);
      setIsSettingUp(true);
      // Setup başladı, flag'i temizle (eğer varsa)
      sessionStorage.removeItem('setupStarted');
    } catch (error: any) {
      setError(error.message || '2FA setup başarısız oldu');
      // Hata durumunda da flag'i temizle
      sessionStorage.removeItem('setupStarted');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    if (!verificationToken || verificationToken.length !== 6) {
      setError('Lütfen 6 haneli kodu girin');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/two-factor/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Doğrulama başarısız');
      }

      setSuccess('2FA başarıyla aktif edildi! Dashboard\'a yönlendiriliyorsunuz...');
      setVerificationToken('');
      setIsSettingUp(false);
      
      // Session'ı güncelle (2FA enabled bilgisini yenile)
      // JWT callback'inde veritabanından 2FA durumu kontrol edilecek
      await updateSession({ twoFactorEnabled: true });
      
      // Session güncellenene kadar kısa bir süre bekle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Dashboard'a yönlendir
              sessionStorage.removeItem('loginInProgress'); // Login flow tamamlandı
              sessionStorage.removeItem('logoutOnClose'); // Logout flag'ini de temizle
              window.location.href = '/dashboard';
    } catch (error: any) {
      setError(error.message || 'Doğrulama başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('2FA\'yı kapatmak istediğinize emin misiniz?')) {
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/two-factor/disable', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Kapatma başarısız');
      }

      setSuccess('2FA başarıyla kapatıldı');
      setQrCodeDataUrl(null);
      setManualEntryKey('');
      setIsSettingUp(false);
      fetchStatus();
    } catch (error: any) {
      setError(error.message || '2FA kapatılamadı');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-white">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">İki Faktörlü Kimlik Doğrulama (2FA)</h1>

        <div className="bg-background-secondary rounded-md p-6 border border-gray-700 space-y-6 backdrop-blur-sm">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-500/50 p-3 backdrop-blur-sm">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-900/20 border border-green-500/50 p-3">
              <p className="text-sm text-green-400">{success}</p>
            </div>
          )}

          {!isSettingUp && !twoFactorStatus?.enabled && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">2FA Kurulumu Zorunlu</h2>
              <div className="bg-yellow-900/20 border border-yellow-500/50 p-4 rounded-md mb-4">
                <p className="text-yellow-400 text-sm">
                  Güvenlik politikası gereği tüm kullanıcılar için 2FA zorunludur. 
                  Devam etmek için Microsoft Authenticator kurulumu yapmalısınız.
                </p>
              </div>
              
              <div className="mb-6 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Microsoft Authenticator Kurulumu</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-background-tertiary p-4 rounded-md border border-gray-700">
                      <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                        <span>📱 iOS (iPhone/iPad)</span>
                      </h4>
                      <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1 ml-2">
                        <li>App Store'u açın</li>
                        <li>Arama çubuğuna "Microsoft Authenticator" yazın</li>
                        <li>Microsoft Corporation tarafından geliştirilen uygulamayı seçin</li>
                        <li>"Al" veya "Get" butonuna tıklayarak indirin</li>
                        <li>Uygulama yüklendikten sonra açın</li>
                        <li>&quot;Hesap ekle&quot; &gt; &quot;İş veya okul hesabı&quot; seçin</li>
                      </ol>
                    </div>

                    <div className="bg-background-tertiary p-4 rounded-md border border-gray-700">
                      <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                        <span>🤖 Android</span>
                      </h4>
                      <ol className="list-decimal list-inside text-gray-400 text-sm space-y-1 ml-2">
                        <li>Google Play Store'u açın</li>
                        <li>Arama çubuğuna "Microsoft Authenticator" yazın</li>
                        <li>Microsoft Corporation tarafından geliştirilen uygulamayı seçin</li>
                        <li>"Yükle" veya "Install" butonuna tıklayarak indirin</li>
                        <li>Uygulama yüklendikten sonra açın</li>
                        <li>&quot;+ Hesap ekle&quot; &gt; &quot;İş veya okul hesabı&quot; seçin</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-gray-400 mb-4">
                Microsoft Authenticator uygulamasını kurduktan sonra aşağıdaki butona tıklayarak QR kodunu görebilirsiniz.
              </p>
              <button
                onClick={handleSetup}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                {isLoading ? 'Yükleniyor...' : 'QR Kod Göster ve Devam Et'}
              </button>
            </div>
          )}

          {isSettingUp && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">2FA Kurulumu - Son Adımlar</h2>
              <div className="bg-blue-900/20 border border-blue-500/50 p-4 rounded-md">
                <p className="text-blue-400 text-sm font-semibold mb-2">📋 Kurulum Adımları:</p>
                <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1 ml-2">
                  <li>Microsoft Authenticator uygulamanızı açın</li>
                  <li>"+ Hesap ekle" veya "+ Add account" seçin</li>
                  <li>"İş veya okul hesabı" veya "Work or school account" seçin</li>
                  <li>Kamerayı açın ve aşağıdaki QR kodu tarayın</li>
                  <li>Veya "Manuel olarak anahtar gir" seçeneğini kullanın</li>
                  <li>Uygulamada görünen 6 haneli kodu aşağıya girin</li>
                </ol>
              </div>

              {qrCodeDataUrl && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-md">
                    <Image
                      src={qrCodeDataUrl}
                      alt="2FA QR Code"
                      width={256}
                      height={256}
                      unoptimized
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-400 mb-2">Manuel Giriş Anahtarı:</p>
                    <code className="bg-background-tertiary px-4 py-2 rounded text-primary text-sm font-mono break-all">
                      {manualEntryKey}
                    </code>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="verificationToken" className="block text-sm font-medium text-gray-300 mb-2">
                  6 Haneli Doğrulama Kodu
                </label>
                <input
                  id="verificationToken"
                  type="text"
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-full px-3 py-3 border border-gray-600 placeholder-gray-500 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>

              <button
                onClick={handleVerifySetup}
                disabled={isLoading || verificationToken.length !== 6}
                className="w-full px-4 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                {isLoading ? 'Doğrulanıyor...' : 'Doğrula ve Aktif Et'}
              </button>
            </div>
          )}

          {twoFactorStatus?.enabled && (
            <div className="space-y-4">
              <div className="rounded-md bg-green-900/20 border border-green-500/50 p-4">
                <p className="text-green-400 font-semibold">✓ 2FA Aktif</p>
                <p className="text-sm text-gray-400 mt-2">
                  Hesabınız Microsoft Authenticator ile korunuyor.
                </p>
              </div>

              <button
                onClick={handleDisable}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Kapatılıyor...' : '2FA\'yı Kapat'}
              </button>
            </div>
          )}

          {(twoFactorStatus?.enabled || isSettingUp) && (
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={async () => {
                  try {
                    // Session'ı güncelle
                    await updateSession();
                    // Login flow ve logout flag'lerini temizle
                    sessionStorage.removeItem('loginInProgress');
                    sessionStorage.removeItem('logoutOnClose');
                    // Kısa bir süre bekle
                    await new Promise(resolve => setTimeout(resolve, 300));
                    // Dashboard'a yönlendir
                    await router.push('/dashboard');
                    // Yönlendirme başarısız olursa window.location ile dene
                    setTimeout(() => {
                      if (window.location.pathname !== '/dashboard') {
                        window.location.href = '/dashboard';
                      }
                    }, 500);
                  } catch (error) {
                    console.error('Navigation error:', error);
                    sessionStorage.removeItem('loginInProgress');
                    sessionStorage.removeItem('logoutOnClose');
                    window.location.href = '/dashboard';
                  }
                }}
                className="text-gray-400 hover:text-white transition-all underline cursor-pointer"
              >
                ← Dashboard'a Dön
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

