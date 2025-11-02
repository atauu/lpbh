'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

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
  membershipStatus: string;
  createdAt: string;
}

export default function PendingApprovalPage() {
  const { data: session, status } = useSession();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    // Kullanıcının membershipStatus'ünü kontrol et
    if (session?.user) {
      const membershipStatus = (session.user as any).membershipStatus;
      if (membershipStatus === 'pending_info') {
        // Henüz bilgileri girmemişse bilgi giriş sayfasına yönlendir
        redirect('/dashboard/complete-registration');
      } else if (membershipStatus === 'approved') {
        // Onaylanmışsa dashboard'a yönlendir
        redirect('/dashboard');
      } else if (membershipStatus !== 'pending_approval') {
        redirect('/login');
      }
    }
    if (session) {
      fetchUserInfo();
    }
  }, [session, status]);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users/me', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Kullanıcı bilgileri yüklenemedi');
      }
      const data = await res.json();
      setUserInfo(data);
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-background-secondary rounded-md border border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-white">Üyeliğiniz Onay Bekliyor</h1>
          <span className="px-3 py-1 text-sm bg-blue-900/20 text-blue-400 border border-blue-500/30 rounded">
            Onay Bekliyor
          </span>
        </div>
        
        <div className="bg-blue-900/10 border border-blue-500/30 rounded-md p-4 mb-6">
          <p className="text-blue-400 text-sm">
            Üyeliğiniz onay sürecindedir. Yöneticiler bilgilerinizi inceledikten sonra üyeliğiniz onaylanacaktır.
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Onaylandıktan sonra sisteme tam erişim sağlayabileceksiniz.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {userInfo && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-4">Gönderdiğiniz Bilgiler</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Kullanıcı Adı:</p>
                <p className="text-white">{userInfo.username}</p>
              </div>
              {userInfo.rutbe && (
                <div>
                  <p className="text-gray-400">Rütbe:</p>
                  <p className="text-white">{userInfo.rutbe}</p>
                </div>
              )}
              {userInfo.isim && (
                <div>
                  <p className="text-gray-400">İsim:</p>
                  <p className="text-white">{userInfo.isim}</p>
                </div>
              )}
              {userInfo.soyisim && (
                <div>
                  <p className="text-gray-400">Soyisim:</p>
                  <p className="text-white">{userInfo.soyisim}</p>
                </div>
              )}
              {userInfo.tckn && (
                <div>
                  <p className="text-gray-400">TC Kimlik No:</p>
                  <p className="text-white">{userInfo.tckn}</p>
                </div>
              )}
              {userInfo.telefon && (
                <div>
                  <p className="text-gray-400">Telefon:</p>
                  <p className="text-white">{userInfo.telefon}</p>
                </div>
              )}
              {userInfo.kanGrubu && (
                <div>
                  <p className="text-gray-400">Kan Grubu:</p>
                  <p className="text-white">{userInfo.kanGrubu}</p>
                </div>
              )}
              {userInfo.ruhsatSeriNo && (
                <div>
                  <p className="text-gray-400">Ruhsat Seri No:</p>
                  <p className="text-white">{userInfo.ruhsatSeriNo}</p>
                </div>
              )}
              {userInfo.evAdresi && (
                <div className="md:col-span-2">
                  <p className="text-gray-400">Ev Adresi:</p>
                  <p className="text-white">{userInfo.evAdresi}</p>
                </div>
              )}
              {userInfo.yakiniIsmi && (
                <div>
                  <p className="text-gray-400">Yakını İsmi:</p>
                  <p className="text-white">{userInfo.yakiniIsmi}</p>
                </div>
              )}
              {userInfo.yakiniTelefon && (
                <div>
                  <p className="text-gray-400">Yakını Telefon:</p>
                  <p className="text-white">{userInfo.yakiniTelefon}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Kayıt Tarihi: {new Date(userInfo.createdAt).toLocaleString('tr-TR')}
            </p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}


