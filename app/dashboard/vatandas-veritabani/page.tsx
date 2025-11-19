'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

interface TapuBilgisi {
  il?: string;
  ilce?: string;
  mahalle?: string;
  zeminTip?: string;
  ada?: string;
  parsel?: string;
  yuzolcum?: string;
  nitelik?: string;
  blok?: string;
  bagimsizBolumNo?: string;
  arsaPay?: string;
  arsaPayda?: string;
  bolumNitelik?: string;
}

interface HaneMember {
  tckn: string;
  ad?: string;
  soyad?: string;
  dogumTarihi?: string;
  cinsiyet?: string;
  iliski?: string;
}

interface CitizenData {
  tckn: string;
  ad?: string;
  soyad?: string;
  dogumTarihi?: string;
  dogumYeri?: string;
  adresIl?: string;
  adresIlce?: string;
  cinsiyet?: string;
  medeniHal?: string;
  ikametgah?: string;
  vergiNumarasi?: string;
  anneAdi?: string;
  anneTc?: string;
  babaAdi?: string;
  babaTc?: string;
  aileSiraNo?: string;
  bireySiraNo?: string;
  gsmNumaralari?: Array<{ gsm: string }>;
  tapuBilgileri?: TapuBilgisi[];
  kardesler?: HaneMember[];
  ayniAdrestekiler?: HaneMember[];
}

export default function CitizenDatabasePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Erişim kontrolü
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    
    if (status === 'authenticated' && session?.user) {
      const permissions = (session.user as any).permissions;
      if (!hasPermission(permissions, 'citizenDatabase', 'read')) {
        router.push('/dashboard?error=insufficient_permissions');
        return;
      }
    }
  }, [session, status, router]);
  
  const [filters, setFilters] = useState({
    tckn: '',
    ad: '',
    soyad: '',
    il: '',
    ilce: '',
    anneAdi: '',
    anneTc: '',
    babaAdi: '',
    babaTc: '',
    dogumTarihi: '',
    gsm: '',
  });
  const [nameFilterActive, setNameFilterActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CitizenData[]>([]);
  const [singleResult, setSingleResult] = useState<CitizenData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, CitizenData>>({});
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const hasAnyFilter = Object.values(filters).some(v => v.trim());
    if (!hasAnyFilter) {
      setError('En az bir arama kriteri girin');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSingleResult(null);
    setExpandedId(null);

    try {
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value.trim()) {
          params.set(key, value.trim());
        }
      });
      
      if (nameFilterActive) {
        params.set('nameFilterActive', 'true');
      }

      const res = await fetch(`/api/citizen-search?${params}`);
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.multiple) {
          setResults(data.data);
        } else {
          setSingleResult(data.data);
          setExpandedId(data.data.tckn);
        }
      } else {
        setError(data.error || 'Kayıt bulunamadı');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Arama sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (tckn: string) => {
    if (expandedId === tckn) {
      setExpandedId(null);
      return;
    }

    setExpandedId(tckn);

    // Eğer bu TCKN için detaylı veri yoksa, API'den çek
    if (!expandedData[tckn]) {
      try {
        const res = await fetch(`/api/citizen-search?tckn=${tckn}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setExpandedData({ ...expandedData, [tckn]: data.data });
        }
      } catch (err) {
        console.error('Error fetching details:', err);
      }
    }
  };

  const renderSummaryRow = (citizen: CitizenData) => {
    const isExpanded = expandedId === citizen.tckn;
    const detailData = expandedData[citizen.tckn] || citizen;
    
    return (
      <div key={citizen.tckn} className="mb-2">
        {/* Özet Satır */}
        <div
          onClick={() => handleExpand(citizen.tckn)}
          className="bg-background-secondary border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
        >
          <div className="grid grid-cols-2 md:grid-cols-8 gap-3 text-sm">
            <div>
              <div className="text-gray-400 text-xs mb-1">TCKN</div>
              <div className="text-white font-mono text-xs">{citizen.tckn}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Ad</div>
              <div className="text-white font-semibold">{citizen.ad || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Soyad</div>
              <div className="text-white font-semibold">{citizen.soyad || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Anne Adı</div>
              <div className="text-white">{citizen.anneAdi || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Baba Adı</div>
              <div className="text-white">{citizen.babaAdi || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Doğum</div>
              <div className="text-white text-xs">{citizen.dogumTarihi || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">İl</div>
              <div className="text-white">{citizen.adresIl || '-'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">İlçe</div>
              <div className="text-white">{citizen.adresIlce || '-'}</div>
            </div>
          </div>
          
          {/* Expand ikonu */}
          <div className="text-center mt-2 text-gray-500 text-xs">
            {isExpanded ? '▲ Detayları Gizle' : '▼ Detayları Göster'}
          </div>
        </div>

        {/* Detay Panel (Genişletildiğinde) */}
        {isExpanded && (
          <div className="bg-background border border-gray-700 rounded-lg p-6 mt-2">
            <h2 className="text-2xl font-bold text-primary mb-6">Vatandaş Bilgileri</h2>
            
            {!expandedData[citizen.tckn] && (
              <div className="text-gray-400 text-center py-4">Detaylar yükleniyor...</div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Temel Bilgiler */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">Temel Bilgiler</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">TCKN:</span>
                    <span className="text-white font-mono">{detailData.tckn}</span>
                  </div>
                  {detailData.ad && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ad:</span>
                      <span className="text-white">{detailData.ad}</span>
                    </div>
                  )}
                  {detailData.soyad && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Soyad:</span>
                      <span className="text-white">{detailData.soyad}</span>
                    </div>
                  )}
                  {detailData.dogumTarihi && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Doğum Tarihi:</span>
                      <span className="text-white">{detailData.dogumTarihi}</span>
                    </div>
                  )}
                  {detailData.dogumYeri && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Doğum Yeri:</span>
                      <span className="text-white">{detailData.dogumYeri}</span>
                    </div>
                  )}
                  {detailData.cinsiyet && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cinsiyet:</span>
                      <span className="text-white">{detailData.cinsiyet}</span>
                    </div>
                  )}
                  {detailData.medeniHal && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Medeni Hal:</span>
                      <span className="text-white">{detailData.medeniHal}</span>
                    </div>
                  )}
                  {detailData.anneAdi && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Anne Adı:</span>
                      <span className="text-white">{detailData.anneAdi}</span>
                    </div>
                  )}
                  {detailData.anneTc && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Anne TC:</span>
                      <span className="text-white font-mono">{detailData.anneTc}</span>
                    </div>
                  )}
                  {detailData.babaAdi && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Baba Adı:</span>
                      <span className="text-white">{detailData.babaAdi}</span>
                    </div>
                  )}
                  {detailData.babaTc && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Baba TC:</span>
                      <span className="text-white font-mono">{detailData.babaTc}</span>
                    </div>
                  )}
                  {detailData.aileSiraNo && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Aile Sıra No:</span>
                      <span className="text-white">{detailData.aileSiraNo}</span>
                    </div>
                  )}
                  {detailData.bireySiraNo && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Birey Sıra No:</span>
                      <span className="text-white">{detailData.bireySiraNo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* İletişim Bilgileri */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 border-b border-gray-700 pb-2">İletişim Bilgileri</h3>
                
                {detailData.gsmNumaralari && detailData.gsmNumaralari.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">GSM Numaraları ({detailData.gsmNumaralari.length}):</div>
                    <div className="space-y-2">
                      {detailData.gsmNumaralari.map((gsm, i) => (
                        <div key={i} className="bg-background border border-gray-600 rounded p-2">
                          <div className="text-white font-mono">{gsm.gsm}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {detailData.vergiNumarasi && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">Vergi Numarası:</div>
                    <div className="text-white font-mono">{detailData.vergiNumarasi}</div>
                  </div>
                )}

                {detailData.adresIl && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">İl:</div>
                    <div className="text-white">{detailData.adresIl}</div>
                  </div>
                )}

                {detailData.adresIlce && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">İlçe:</div>
                    <div className="text-white">{detailData.adresIlce}</div>
                  </div>
                )}

                {detailData.ikametgah && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-1">İkametgah:</div>
                    <div className="text-white text-sm">{detailData.ikametgah}</div>
                  </div>
                )}

                {/* Güncel Adresler (2009-2024) */}
                {detailData.guncelAdresler && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="text-sm text-gray-400 mb-3 font-semibold">Güncel Adresler (2009-2024):</div>
                    <div className="space-y-3">
                      {detailData.guncelAdresler.adres2024 && (
                        <div className="bg-green-900/20 border border-green-700 rounded p-3">
                          <div className="text-xs text-green-400 mb-1 font-semibold">2024 (En Güncel)</div>
                          <div className="text-white text-sm">{detailData.guncelAdresler.adres2024}</div>
                        </div>
                      )}
                      {detailData.guncelAdresler.adres2023 && (
                        <div className="bg-background-secondary border border-gray-600 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">2023</div>
                          <div className="text-white text-sm">{detailData.guncelAdresler.adres2023}</div>
                        </div>
                      )}
                      {detailData.guncelAdresler.adres2017 && (
                        <div className="bg-background-secondary border border-gray-600 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">2017</div>
                          <div className="text-white text-sm">{detailData.guncelAdresler.adres2017}</div>
                        </div>
                      )}
                      {detailData.guncelAdresler.adres2015 && (
                        <div className="bg-background-secondary border border-gray-600 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">2015</div>
                          <div className="text-white text-sm">{detailData.guncelAdresler.adres2015}</div>
                        </div>
                      )}
                      {detailData.guncelAdresler.adres2009 && (
                        <div className="bg-background-secondary border border-gray-600 rounded p-3">
                          <div className="text-xs text-gray-400 mb-1">2009</div>
                          <div className="text-white text-sm">{detailData.guncelAdresler.adres2009}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tapu Bilgileri */}
            {detailData.tapuBilgileri && detailData.tapuBilgileri.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Tapu/Mülkiyet Bilgileri ({detailData.tapuBilgileri.length})</h3>
                <div className="space-y-4">
                  {detailData.tapuBilgileri.map((tapu, i) => (
                    <div key={i} className="bg-background-secondary border border-gray-600 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        {tapu.il && (
                          <div>
                            <span className="text-gray-400">İl:</span>
                            <span className="text-white ml-2">{tapu.il}</span>
                          </div>
                        )}
                        {tapu.ilce && (
                          <div>
                            <span className="text-gray-400">İlçe:</span>
                            <span className="text-white ml-2">{tapu.ilce}</span>
                          </div>
                        )}
                        {tapu.mahalle && (
                          <div>
                            <span className="text-gray-400">Mahalle:</span>
                            <span className="text-white ml-2">{tapu.mahalle}</span>
                          </div>
                        )}
                        {tapu.ada && (
                          <div>
                            <span className="text-gray-400">Ada:</span>
                            <span className="text-white ml-2">{tapu.ada}</span>
                          </div>
                        )}
                        {tapu.parsel && (
                          <div>
                            <span className="text-gray-400">Parsel:</span>
                            <span className="text-white ml-2">{tapu.parsel}</span>
                          </div>
                        )}
                        {tapu.yuzolcum && (
                          <div>
                            <span className="text-gray-400">Yüzölçüm:</span>
                            <span className="text-white ml-2">{tapu.yuzolcum} m²</span>
                          </div>
                        )}
                        {tapu.nitelik && (
                          <div className="md:col-span-3">
                            <span className="text-gray-400">Nitelik:</span>
                            <span className="text-white ml-2">{tapu.nitelik}</span>
                          </div>
                        )}
                        {tapu.blok && (
                          <div>
                            <span className="text-gray-400">Blok:</span>
                            <span className="text-white ml-2">{tapu.blok}</span>
                          </div>
                        )}
                        {tapu.bagimsizBolumNo && (
                          <div>
                            <span className="text-gray-400">Bağımsız Bölüm:</span>
                            <span className="text-white ml-2">{tapu.bagimsizBolumNo}</span>
                          </div>
                        )}
                        {tapu.arsaPay && tapu.arsaPayda && (
                          <div>
                            <span className="text-gray-400">Arsa Payı:</span>
                            <span className="text-white ml-2">{tapu.arsaPay}/{tapu.arsaPayda}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kardeşler */}
            {detailData.kardesler && detailData.kardesler.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Kardeşler ({detailData.kardesler.length})</h3>
                <div className="space-y-2">
                  {detailData.kardesler.map((member, i) => (
                    <div key={i} className="bg-background-secondary border border-gray-600 rounded p-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400 text-xs">TCKN:</span>
                          <div className="text-white font-mono text-xs">{member.tckn}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Ad Soyad:</span>
                          <div className="text-white">{member.ad} {member.soyad}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Doğum:</span>
                          <div className="text-white">{member.dogumTarihi}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Cinsiyet:</span>
                          <div className="text-white">{member.cinsiyet}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">İlişki:</span>
                          <div className="text-primary">{member.iliski}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aynı Adrestekiler */}
            {detailData.ayniAdrestekiler && detailData.ayniAdrestekiler.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Aynı Adreste Yaşayanlar ({detailData.ayniAdrestekiler.length})</h3>
                <div className="space-y-2">
                  {detailData.ayniAdrestekiler.map((member, i) => (
                    <div key={i} className="bg-background-secondary border border-gray-600 rounded p-3">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400 text-xs">TCKN:</span>
                          <div className="text-white font-mono text-xs">{member.tckn}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Ad Soyad:</span>
                          <div className="text-white">{member.ad} {member.soyad}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Doğum:</span>
                          <div className="text-white">{member.dogumTarihi}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">Cinsiyet:</span>
                          <div className="text-white">{member.cinsiyet}</div>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs">İlişki:</span>
                          <div className="text-primary">{member.iliski}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kaynak Bilgisi */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <div className="text-xs text-gray-500">
                Veriler 195mgsm, 109mtcpro, 83madres, 97mtapu kaynaklarından birleştirilmiştir.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Erişim kontrolü - yükleniyor veya yetkisiz
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }
  
  if (status === 'authenticated' && session?.user) {
    const permissions = (session.user as any).permissions;
    if (!hasPermission(permissions, 'citizenDatabase', 'read')) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-2">Erişim Reddedildi</h2>
            <p className="text-gray-300">Bu sayfaya erişim izniniz bulunmuyor.</p>
            <p className="text-sm text-gray-400 mt-2">Lütfen sistem yöneticinizle iletişime geçin.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Vatandaş Veritabanı</h1>
          <p className="text-gray-400">Tüm alanlarla filtreleme yapabilirsiniz</p>
        </div>

        {/* Filtre Formu */}
        <form onSubmit={handleSearch} className="bg-background-secondary border border-gray-700 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">TC Kimlik No</label>
              <input
                type="text"
                value={filters.tckn}
                onChange={(e) => setFilters({...filters, tckn: e.target.value.replace(/\D/g, '')})}
                maxLength={11}
                placeholder="11 rakam"
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Adı</label>
              <input
                type="text"
                value={filters.ad}
                onChange={(e) => setFilters({...filters, ad: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Soyadı</label>
              <input
                type="text"
                value={filters.soyad}
                onChange={(e) => setFilters({...filters, soyad: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">İl</label>
              <input
                type="text"
                value={filters.il}
                onChange={(e) => setFilters({...filters, il: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">İlçe</label>
              <input
                type="text"
                value={filters.ilce}
                onChange={(e) => setFilters({...filters, ilce: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Anne Adı</label>
              <input
                type="text"
                value={filters.anneAdi}
                onChange={(e) => setFilters({...filters, anneAdi: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Anne TC</label>
              <input
                type="text"
                value={filters.anneTc}
                onChange={(e) => setFilters({...filters, anneTc: e.target.value.replace(/\D/g, '')})}
                maxLength={11}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Baba Adı</label>
              <input
                type="text"
                value={filters.babaAdi}
                onChange={(e) => setFilters({...filters, babaAdi: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Baba TC</label>
              <input
                type="text"
                value={filters.babaTc}
                onChange={(e) => setFilters({...filters, babaTc: e.target.value.replace(/\D/g, '')})}
                maxLength={11}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Doğum Tarihi</label>
              <input
                type="date"
                value={filters.dogumTarihi}
                onChange={(e) => setFilters({...filters, dogumTarihi: e.target.value})}
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">GSM</label>
              <input
                type="text"
                value={filters.gsm}
                onChange={(e) => setFilters({...filters, gsm: e.target.value.replace(/\D/g, '')})}
                maxLength={10}
                placeholder="5XXXXXXXXX"
                className="w-full px-3 py-2 bg-background border border-gray-700 rounded text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={nameFilterActive}
                onChange={(e) => setNameFilterActive(e.target.checked)}
                className="mr-2 w-4 h-4"
              />
              <span className="text-white">Ad Filtreleme Aktif Et</span>
            </label>
            <p className="text-sm text-gray-400 mt-1 ml-6">
              Bu seçenek aktif edildiğinde, "Adı" alanına yazdığınız değer ile başlayan tüm isimler getirilir. 
              Örneğin "Ömer" yazarsanız "Ömer Faruk", "Ömer Baki" gibi isimler de listelenir.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Aranıyor...' : 'Sorgula'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400">
              {error}
            </div>
          )}
        </form>

        {/* Sonuçlar */}
        {singleResult && renderSummaryRow(singleResult)}
        
        {results.length > 0 && (
          <div>
            <div className="mb-4 text-white font-semibold">
              {results.length} kayıt bulundu
            </div>
            {results.map((r) => renderSummaryRow(r))}
          </div>
        )}
      </div>
    </div>
  );
}
