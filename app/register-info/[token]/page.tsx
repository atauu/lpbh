'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function RegisterInfoPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
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
    plaka: '',
    ehliyetTuru: [] as string[],
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

  const ehliyetTuruOptions = [
    'A1',
    'A2',
    'A',
    'B1',
    'B',
    'BE',
    'C1',
    'C1E',
    'C',
    'CE',
    'D1',
    'D1E',
    'D',
    'DE',
    'F',
    'G',
    'H',
    'M',
  ];

  const handleEhliyetToggle = (turu: string) => {
    setFormData(prev => ({
      ...prev,
      ehliyetTuru: prev.ehliyetTuru.includes(turu)
        ? prev.ehliyetTuru.filter(t => t !== turu)
        : [...prev.ehliyetTuru, turu],
    }));
  };

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/register-info?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Token geçersiz');
      }
      const data = await res.json();
      setUsername(data.username);
    } catch (error: any) {
      setError(error.message || 'Token kontrolü başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/register-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          ...formData,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Bilgiler kaydedilemedi');
      }

      setSuccess(true);
      // 3 saniye sonra login sayfasına yönlendir
      setTimeout(() => {
        router.push('/login?message=Üyeliğiniz onay bekliyor');
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Bilgiler kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-background-secondary rounded-md border border-gray-700 p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-white mb-4">Hata</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-background-secondary rounded-md border border-gray-700 p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-white mb-4">Başarılı</h1>
          <p className="text-green-400 mb-4">
            Bilgileriniz başarıyla kaydedildi. Üyeliğiniz onay bekliyor.
          </p>
          <p className="text-gray-400 text-sm">
            Onaylandıktan sonra sisteme giriş yapabilirsiniz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-background-secondary rounded-md border border-gray-700 p-6 max-w-2xl w-full">
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
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Plaka
              </label>
              <input
                type="text"
                value={formData.plaka}
                onChange={(e) => setFormData({ ...formData, plaka: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all font-mono uppercase"
                placeholder="34ABC123"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ehliyet Türü
              </label>
              <div className="border border-gray-700 rounded-md p-3 bg-background max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ehliyetTuruOptions.map((turu) => (
                    <label
                      key={turu}
                      className="flex items-center gap-2 cursor-pointer hover:bg-background-tertiary p-2 rounded transition"
                    >
                      <input
                        type="checkbox"
                        checked={formData.ehliyetTuru.includes(turu)}
                        onChange={() => handleEhliyetToggle(turu)}
                        className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-white text-sm">{turu}</span>
                    </label>
                  ))}
                </div>
              </div>
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


