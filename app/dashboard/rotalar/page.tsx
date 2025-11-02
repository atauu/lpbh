'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

interface Waypoint {
  name: string;
  googleMapsLink: string | null;
}

interface Route {
  id: string;
  name: string;
  startPoint: string;
  endPoint: string;
  url: string;
  waypoints: Waypoint[];
  createdAt: string;
  updatedAt: string;
}

export default function RotalarPage() {
  const { data: session, status } = useSession();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [viewingRoute, setViewingRoute] = useState<Route | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    startPoint: '',
    endPoint: '',
    url: '',
    waypoints: [] as Waypoint[],
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchRoutes();
    }
  }, [session, status]);

  const fetchRoutes = async () => {
    try {
      const res = await fetch('/api/routes', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Rotalar yüklenemedi');
      }
      const data = await res.json();
      setRoutes(data);
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const addWaypoint = () => {
    setFormData({
      ...formData,
      waypoints: [...formData.waypoints, { name: '', googleMapsLink: '' }],
    });
  };

  const removeWaypoint = (index: number) => {
    setFormData({
      ...formData,
      waypoints: formData.waypoints.filter((_, i) => i !== index),
    });
  };

  const updateWaypoint = (index: number, field: 'name' | 'googleMapsLink', value: string) => {
    const updatedWaypoints = [...formData.waypoints];
    updatedWaypoints[index] = {
      ...updatedWaypoints[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      waypoints: updatedWaypoints,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          waypoints: formData.waypoints.map(wp => ({
            name: wp.name.trim(),
            googleMapsLink: wp.googleMapsLink?.trim() || null,
          })).filter(wp => wp.name.length > 0), // Boş durak isimlerini filtrele
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rota oluşturulamadı');
      }

      // Form'u sıfırla ve modal'ı kapat
      setFormData({
        name: '',
        startPoint: '',
        endPoint: '',
        url: '',
        waypoints: [],
      });
      setShowAddModal(false);
      
      // Rotaları yeniden yükle
      await fetchRoutes();
    } catch (error: any) {
      setError(error.message || 'Rota oluşturulamadı');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    if (!confirm(`"${routeName}" başlıklı rotayı silmek istediğinize emin misiniz?`)) {
      return;
    }

    setDeletingRouteId(routeId);
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rota silinemedi');
      }

      await fetchRoutes();
    } catch (error: any) {
      setError(error.message || 'Rota silinemedi');
    } finally {
      setDeletingRouteId(null);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  // İzin kontrolleri
  const userPermissions = session?.user?.permissions;
  const canCreate = hasPermission(userPermissions, 'routes', 'create');
  const canDelete = hasPermission(userPermissions, 'routes', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Rotalar</h1>
        {canCreate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            Rota Ekle
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Rotalar Listesi */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Tüm Rotalar</h2>
        </div>
        {routes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz rota eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {routes.map((route) => (
              <div
                key={route.id}
                className="p-6 hover:bg-background-tertiary transition-all cursor-pointer"
                onClick={() => {
                  setViewingRoute(route);
                  setShowViewModal(true);
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {route.name}
                    </h3>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Kalkış: {route.startPoint}
                      </p>
                      {route.waypoints && route.waypoints.length > 0 && (
                        <div className="mt-2">
                          <p className="text-gray-300 font-medium mb-1">Duraklar:</p>
                          <div className="pl-2 space-y-1">
                            {route.waypoints.map((waypoint, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <p className="text-gray-400 text-xs">
                                  • {waypoint.name}
                                </p>
                                {waypoint.googleMapsLink && (
                                  <a
                                    href={waypoint.googleMapsLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-all text-xs"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                    Haritada Aç
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <p>
                        Varış: {route.endPoint}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <a
                      href={route.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-all text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      Google Maps'te Aç
                    </a>
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRoute(route.id, route.name);
                        }}
                        disabled={deletingRouteId === route.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingRouteId === route.id ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rota Ekle Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setError('');
            setFormData({
              name: '',
              startPoint: '',
              endPoint: '',
              url: '',
              waypoints: [],
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Yeni Rota Ekle
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                    setFormData({
                      name: '',
                      startPoint: '',
                      endPoint: '',
                      url: '',
                      waypoints: [],
                    });
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rota İsmi <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Örn: İstanbul - Ankara Rotası"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Kalkış Noktası <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.startPoint}
                    onChange={(e) => setFormData({ ...formData, startPoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Örn: İstanbul, Türkiye"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duraklar (Opsiyonel)
                  </label>
                  <div className="space-y-2">
                    {formData.waypoints.map((waypoint, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={waypoint.name}
                            onChange={(e) => updateWaypoint(index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                            placeholder="Durak adı"
                          />
                          <input
                            type="url"
                            value={waypoint.googleMapsLink || ''}
                            onChange={(e) => updateWaypoint(index, 'googleMapsLink', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                            placeholder="Google Maps linki (opsiyonel)"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeWaypoint(index)}
                          className="p-2 text-red-400 hover:text-red-300 transition-all"
                          title="Durağı Kaldır"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addWaypoint}
                      className="w-full px-3 py-2 border border-gray-700 border-dashed text-gray-400 hover:text-white hover:border-gray-600 rounded-md transition-all text-sm"
                    >
                      + Durak Ekle
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Varış Noktası <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.endPoint}
                    onChange={(e) => setFormData({ ...formData, endPoint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Örn: Ankara, Türkiye"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Google Maps Rota URL'si <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="https://www.google.com/maps/dir/..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Google Maps'te rotayı oluşturduktan sonra "Paylaş" butonundan link'i kopyalayın.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError('');
                      setFormData({
                        name: '',
                        startPoint: '',
                        endPoint: '',
                        url: '',
                        waypoints: [],
                      });
                    }}
                    className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isSubmitting ? 'Ekleniyor...' : 'Rota Ekle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Rota Detayları Modal */}
      {showViewModal && viewingRoute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowViewModal(false);
            setViewingRoute(null);
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {viewingRoute.name}
                </h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingRoute(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Kalkış Noktası:</p>
                  <p className="text-white">{viewingRoute.startPoint}</p>
                </div>

                {viewingRoute.waypoints && viewingRoute.waypoints.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">Duraklar:</p>
                    <div className="space-y-2">
                      {viewingRoute.waypoints.map((waypoint, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-background rounded-md border border-gray-700">
                          <p className="text-white">{waypoint.name}</p>
                          {waypoint.googleMapsLink && (
                            <a
                              href={waypoint.googleMapsLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-all text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                              </svg>
                              Google Maps'te Aç
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Varış Noktası:</p>
                  <p className="text-white">{viewingRoute.endPoint}</p>
                </div>

                <div className="flex justify-end pt-4">
                  <a
                    href={viewingRoute.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Rota'yı Google Maps'te Aç
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
