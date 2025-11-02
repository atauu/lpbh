'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function CompleteRegistrationPage() {
  const { data: session, status, update: updateSession } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    isim: '',
    soyisim: '',
    tckn: '',
    telefon: '',
    evAdresi: '',
    yakiniIsmi: '',
    yakiniTelefon: '',
    ruhsatSeriNo: '',
    kanGrubu: '',
  });

  const kanGrubuOptions = [
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    // Kullanıcının membershipStatus'ünü kontrol et
    if (session?.user && (session.user as any).membershipStatus !== 'pending_info') {
      // Eğer zaten bilgileri girmişse onay bekliyor sayfasına yönlendir
      if ((session.user as any).membershipStatus === 'pending_approval') {
        redirect('/dashboard/pending-approval');
      } else if ((session.user as any).membershipStatus === 'approved') {
        redirect('/dashboard');
      }
    }
  }, [session, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/users/complete-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Bilgiler kaydedilemedi');
      }

      // Başarılı - session'ı yenile ve yönlendir
      try {
        await updateSession();
        // Kısa bir süre bekle ki session güncellensin
        await new Promise(resolve => setTimeout(resolve, 500));
        // Dashboard'a yönlendir - middleware doğru sayfaya yönlendirecek
        window.location.href = '/dashboard';
      } catch (error: any) {
        console.error('Session update error:', error);
        // Hata olsa bile yönlendir
        window.location.href = '/dashboard';
      }
      setIsSubmitting(false);
    } catch (error: any) {
      setError(error.message || 'Bilgiler kaydedilemedi');
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }


  const user = session?.user as any;
  const username = user?.username || '';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-background-secondary rounded-md border border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Üyelik Bilgilerini Tamamla</h1>
        <p className="text-gray-400 mb-6">
          Hoş geldiniz <span className="text-primary font-medium">{username}</span>. 
          Lütfen aşağıdaki bilgileri doldurun.
        </p>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                İsim
              </label>
              <input
                type="text"
                value={formData.isim}
                onChange={(e) => setFormData({ ...formData, isim: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Soyisim
              </label>
              <input
                type="text"
                value={formData.soyisim}
                onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                TC Kimlik No
              </label>
              <input
                type="text"
                value={formData.tckn}
                onChange={(e) => setFormData({ ...formData, tckn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Telefon Numarası
              </label>
              <input
                type="tel"
                value={formData.telefon}
                onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Kan Grubu
              </label>
              <select
                value={formData.kanGrubu}
                onChange={(e) => setFormData({ ...formData, kanGrubu: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              >
                <option value="">Seçiniz</option>
                {kanGrubuOptions.map((kg) => (
                  <option key={kg} value={kg}>
                    {kg}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ruhsat Seri No
              </label>
              <input
                type="text"
                value={formData.ruhsatSeriNo}
                onChange={(e) => setFormData({ ...formData, ruhsatSeriNo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ev Adresi
            </label>
            <textarea
              value={formData.evAdresi}
              onChange={(e) => setFormData({ ...formData, evAdresi: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Yakını İsmi
              </label>
              <input
                type="text"
                value={formData.yakiniIsmi}
                onChange={(e) => setFormData({ ...formData, yakiniIsmi: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Yakını Telefon
              </label>
              <input
                type="tel"
                value={formData.yakiniTelefon}
                onChange={(e) => setFormData({ ...formData, yakiniTelefon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
            >
              {isSubmitting ? 'Kaydediliyor...' : 'Bilgileri Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

