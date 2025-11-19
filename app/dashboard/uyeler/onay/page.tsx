'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
import { redirect } from 'next/navigation';

interface PendingUser {
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
  plaka: string | null;
  ehliyetTuru: string[];
  membershipStatus: string;
  createdAt: string;
  updatedAt: string;
}

export default function OnayPage() {
  const { data: session, status } = useSession();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchPendingUsers();
    }
  }, [session, status]);

  const fetchPendingUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users/approval', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Onay bekleyen üyeler yüklenemedi');
      }
      const data = await res.json();
      setPendingUsers(data);
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproval = async (userId: string, action: 'approve' | 'reject') => {
    if (!confirm(action === 'approve' 
      ? 'Bu üyeliği onaylamak istediğinize emin misiniz?'
      : 'Bu üyeliği reddetmek istediğinize emin misiniz?'
    )) {
      return;
    }

    setProcessingId(userId);
    try {
      const res = await fetch('/api/users/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, action }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'İşlem başarısız');
      }

      // Listeyi yenile
      await fetchPendingUsers();
    } catch (error: any) {
      setError(error.message || 'İşlem başarısız');
    } finally {
      setProcessingId(null);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Onay Bekleyen Üyeler</h1>
        <button
          onClick={fetchPendingUsers}
          className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
        >
          Yenile
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {pendingUsers.length === 0 ? (
        <div className="bg-background-secondary rounded-md border border-gray-700 p-8 text-center backdrop-blur-sm">
          <p className="text-gray-400">Onay bekleyen üye bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
          <div className="divide-y divide-gray-700">
            {pendingUsers.map((user) => (
              <div key={user.id} className="p-6 hover:bg-background-tertiary transition-all">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        {user.isim && user.soyisim 
                          ? `${user.isim} ${user.soyisim}` 
                          : user.username}
                      </h3>
                      {user.rutbe && (
                        <span className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded">
                          {user.rutbe}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded border ${
                        user.membershipStatus === 'pending_info'
                          ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-blue-900/20 text-blue-400 border-blue-500/30'
                      }`}>
                        {user.membershipStatus === 'pending_info' ? 'Giriş Yapmadı' : 'Onay Bekliyor'}
                      </span>
                    </div>
                    {user.membershipStatus === 'pending_info' ? (
                      <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-md p-4">
                        <p className="text-yellow-400 text-sm mb-2">
                          Bu üye henüz bilgilerini girmemiş.
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          Üye kullanıcı adı ve şifresi ile giriş yaptığında bilgilerini girmesi için yönlendirilecektir.
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          Üye bilgilerini girdikten sonra bu ekranda görünecektir.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Kullanıcı Adı:</p>
                          <p className="text-white">{user.username}</p>
                        </div>
                        {user.tckn && (
                          <div>
                            <p className="text-gray-400">TC Kimlik No:</p>
                            <p className="text-white">{user.tckn}</p>
                          </div>
                        )}
                        {user.telefon && (
                          <div>
                            <p className="text-gray-400">Telefon:</p>
                            <p className="text-white">{user.telefon}</p>
                          </div>
                        )}
                        {user.kanGrubu && (
                          <div>
                            <p className="text-gray-400">Kan Grubu:</p>
                            <p className="text-white">{user.kanGrubu}</p>
                          </div>
                        )}
                        {user.plaka && (
                          <div>
                            <p className="text-gray-400">Plaka:</p>
                            <p className="text-white font-mono">{user.plaka}</p>
                          </div>
                        )}
                        {user.ehliyetTuru && user.ehliyetTuru.length > 0 && (
                          <div>
                            <p className="text-gray-400">Ehliyet Türü:</p>
                            <p className="text-white">{user.ehliyetTuru.join(', ')}</p>
                          </div>
                        )}
                        {user.ruhsatSeriNo && (
                          <div>
                            <p className="text-gray-400">Ruhsat Seri No:</p>
                            <p className="text-white">{user.ruhsatSeriNo}</p>
                          </div>
                        )}
                        {user.evAdresi && (
                          <div className="md:col-span-2">
                            <p className="text-gray-400">Ev Adresi:</p>
                            <p className="text-white">{user.evAdresi}</p>
                          </div>
                        )}
                        {user.yakiniIsmi && (
                          <div>
                            <p className="text-gray-400">Yakını İsmi:</p>
                            <p className="text-white">{user.yakiniIsmi}</p>
                          </div>
                        )}
                        {user.yakiniTelefon && (
                          <div>
                            <p className="text-gray-400">Yakını Telefon:</p>
                            <p className="text-white">{user.yakiniTelefon}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">
                      Kayıt Tarihi: {new Date(user.createdAt).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {user.membershipStatus === 'pending_info' ? (
                      <span className="px-4 py-2 text-gray-500 text-sm">
                        Bilgiler girilene kadar bekleyin
                      </span>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleApproval(user.id, 'approve')}
                          disabled={processingId === user.id}
                          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                          {processingId === user.id ? 'İşleniyor...' : 'Onayla'}
                        </Button>
                        <button
                          onClick={() => handleApproval(user.id, 'reject')}
                          disabled={processingId === user.id}
                          className="px-4 py-2 bg-red-900/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-900/30 transition-all disabled:opacity-50"
                        >
                          {processingId === user.id ? 'İşleniyor...' : 'Reddet'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

