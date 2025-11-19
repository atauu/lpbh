'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function AyarlarPage() {
  const { data: session, status } = useSession();
  const [twoFactorGlobalEnabled, setTwoFactorGlobalEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchSettings();
    }
  }, [session, status]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings/2fa', {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError('Bu sayfaya erişim yetkiniz yok.');
        } else {
          setError('Ayarlar yüklenemedi');
        }
        return;
      }

      const data = await res.json();
      setTwoFactorGlobalEnabled(data.enabled || false);
    } catch (error) {
      console.error('Fetch settings error:', error);
      setError('Ayarlar yüklenirken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    try {
      setIsUpdating(true);
      setError('');
      setSuccess('');

      const newValue = !twoFactorGlobalEnabled;
      const res = await fetch('/api/settings/2fa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: newValue }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Ayar güncellenemedi');
      }

      const data = await res.json();
      setTwoFactorGlobalEnabled(data.enabled);
      setSuccess(`2FA ${newValue ? 'aktif' : 'pasif'} edildi`);
      
      // Success mesajını 3 saniye sonra temizle
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Update settings error:', error);
      setError(error.message || 'Ayar güncellenirken bir hata oluştu');
    } finally {
      setIsUpdating(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  if (error && error.includes('erişim yetkiniz yok')) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Sistem Ayarları</h1>
        <p className="text-gray-400">Sistem genelinde 2FA durumunu yönetin</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-500/10 border border-green-500/50 rounded-lg p-4">
          <p className="text-green-400">{success}</p>
        </div>
      )}

      <div className="bg-background-secondary rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">İki Faktörlü Doğrulama (2FA)</h2>
            <p className="text-sm text-gray-400">
              Sistem genelinde 2FA'yı aktif veya pasif edin. 
              {twoFactorGlobalEnabled ? (
                <span className="text-yellow-400"> 2FA şu anda aktif - tüm kullanıcılar için zorunludur.</span>
              ) : (
                <span className="text-gray-500"> 2FA şu anda pasif - kullanıcılar isteğe bağlı olarak aktif edebilir.</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div>
            <p className="text-sm font-medium text-white mb-1">Global 2FA Durumu</p>
            <p className="text-xs text-gray-400">
              {twoFactorGlobalEnabled
                ? '2FA tüm sistemde aktif - Kullanıcılar 2FA olmadan giriş yapamaz'
                : '2FA tüm sistemde pasif - Kullanıcılar 2FA olmadan giriş yapabilir'}
            </p>
          </div>
          <button
            onClick={handleToggle2FA}
            disabled={isUpdating}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
              twoFactorGlobalEnabled ? 'bg-primary' : 'bg-gray-600'
            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                twoFactorGlobalEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
          <p className="text-sm text-yellow-400">
            <strong>⚠️ Dikkat:</strong> Bu ayar tüm sistem genelinde 2FA'yı kontrol eder. 
            Eğer 2FA aktif edilirse, 2FA kurmamış olan kullanıcılar giriş yapamaz.
          </p>
        </div>
      </div>
    </div>
  );
}



