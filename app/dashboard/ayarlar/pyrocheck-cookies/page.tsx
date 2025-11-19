'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function PyroCheckCookiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cookies, setCookies] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasCookies, setHasCookies] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !session?.user?.isSystemAdmin) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    loadCookiesStatus();
  }, []);

  const loadCookiesStatus = async () => {
    try {
      const res = await fetch('/api/pyrocheck-cookies');
      if (res.ok) {
        const data = await res.json();
        setHasCookies(data.hasCookies);
      }
    } catch (error) {
      console.error('Cookie durumu yüklenemedi:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/pyrocheck-cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cookies }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Cookie\'ler başarıyla güncellendi!' });
        setHasCookies(true);
        setCookies('');
        // Sunucuyu yeniden başlatmak için kullanıcıya bilgi ver
        setTimeout(() => {
          setMessage({ 
            type: 'success', 
            text: 'Cookie\'ler güncellendi. Değişikliklerin etkili olması için sunucuyu yeniden başlatmanız gerekebilir.' 
          });
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Cookie\'ler güncellenemedi' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Bir hata oluştu' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyFromBrowser = () => {
    // Kullanıcıya talimat göster
    setMessage({
      type: 'success',
      text: 'Tarayıcınızda PyroCheck sitesine gidin, F12 > Application > Cookies > pyrocheck.xrent.store > Cookie\'leri kopyalayın ve buraya yapıştırın. Format: "session=...; cf_clearance=..."',
    });
  };

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-gray-900 rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-6">PyroCheck Cookie Yönetimi</h1>

        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-400 mb-2">📋 Nasıl Cookie Alınır?</h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-300 text-sm">
            <li>Chrome'u remote debugging ile başlatın:
              <code className="block bg-gray-800 p-2 rounded mt-1 text-xs">
                "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"
              </code>
            </li>
            <li>Network logger script'ini çalıştırın:
              <code className="block bg-gray-800 p-2 rounded mt-1 text-xs">
                node scripts/network-logger-existing-browser.js
              </code>
            </li>
            <li>Tarayıcınızda PyroCheck sitesine gidin ve login olun</li>
            <li>Terminal'de görünen cookie string'ini kopyalayın</li>
            <li>Buraya yapıştırın ve kaydedin</li>
          </ol>
        </div>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/20 border border-green-700 text-green-300'
                : 'bg-red-900/20 border border-red-700 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cookies" className="block text-sm font-medium text-gray-300 mb-2">
              Cookie String
            </label>
            <textarea
              id="cookies"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
              placeholder='session=...; cf_clearance=...'
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              required
            />
            <p className="mt-2 text-xs text-gray-400">
              Cookie formatı: <code className="bg-gray-800 px-1 rounded">session=...; cf_clearance=...</code>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isLoading || !cookies.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Kaydediliyor...' : 'Cookie\'leri Kaydet'}
            </button>
            <button
              type="button"
              onClick={handleCopyFromBrowser}
              className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Nasıl Alınır?
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Cookie Durumu</h3>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                hasCookies ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-400">
              {hasCookies ? 'Cookie\'ler tanımlı' : 'Cookie\'ler tanımlı değil'}
            </span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">⚠️ Önemli Notlar</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300">
            <li>Cookie'ler süreli (özellikle cf_clearance) - süresi dolduğunda yenilemeniz gerekir</li>
            <li>Cookie'leri güncelledikten sonra sunucuyu yeniden başlatmanız önerilir</li>
            <li>Cookie'ler .env dosyasında saklanır</li>
            <li>Sadece sistem görevlileri cookie'leri güncelleyebilir</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

