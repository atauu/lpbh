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
  createdAt: string;
}

export default function BilgilerimPage() {
  const { data: session, status } = useSession();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 2FA state
  const [twoFactorStatus, setTwoFactorStatus] = useState<{ enabled: boolean; isSetup: boolean } | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [setupError, setSetupError] = useState('');
  const [disableError, setDisableError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchUserInfo();
      fetch2FAStatus();
    }
  }, [session, status]);

  const fetchUserInfo = async () => {
    setIsLoadingInfo(true);
    try {
      const res = await fetch('/api/users/me', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUserInfo(data);
      }
    } catch (error) {
      console.error('User info fetch error:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const fetch2FAStatus = async () => {
    try {
      const res = await fetch('/api/two-factor/status', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTwoFactorStatus(data);
      }
    } catch (error) {
      console.error('2FA status fetch error:', error);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/users/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordForm),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Şifre değiştirilemedi');
      }

      // Başarılı - modal'ı kapat ve form'u sıfırla
      setShowPasswordModal(false);
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      alert('Şifre başarıyla değiştirildi');
    } catch (error: any) {
      setPasswordError(error.message || 'Şifre değiştirilemedi');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handle2FASetup = async () => {
    setIsSettingUp(true);
    setSetupError('');
    setTwoFactorSecret(null);
    setQrCodeDataUrl(null);

    try {
      const res = await fetch('/api/two-factor/setup', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '2FA kurulumu başlatılamadı');
      }

      const data = await res.json();
      setTwoFactorSecret(data.manualEntryKey || data.secret);
      setQrCodeDataUrl(data.qrCodeDataUrl || data.qrCode);
    } catch (error: any) {
      setSetupError(error.message || 'Bir hata oluştu');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handle2FAVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!verificationCode || verificationCode.length !== 6) {
      setSetupError('Lütfen 6 haneli kodu girin');
      return;
    }

    setIsSettingUp(true);
    try {
      const res = await fetch('/api/two-factor/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationCode }),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Doğrulama başarısız');
      }

      // Başarılı - modal'ı kapat ve durumu güncelle
      setShow2FAModal(false);
      setVerificationCode('');
      setTwoFactorSecret(null);
      setQrCodeDataUrl(null);
      await fetch2FAStatus();
      alert('2FA başarıyla aktif edildi');
    } catch (error: any) {
      setSetupError(error.message || 'Doğrulama başarısız');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handle2FADisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');

    if (!verificationCode || verificationCode.length !== 6) {
      setDisableError('Lütfen 6 haneli kodu girin');
      return;
    }

    setIsDisabling(true);
    try {
      // Önce kodu doğrula
      const verifyRes = await fetch('/api/two-factor/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationCode }),
        credentials: 'include',
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || 'Doğrulama kodu yanlış');
      }

      // Doğrulama başarılı, şimdi 2FA'yı devre dışı bırak
      const res = await fetch('/api/two-factor/disable', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '2FA devre dışı bırakılamadı');
      }

      // Başarılı - modal'ı kapat ve durumu güncelle
      setShow2FAModal(false);
      setVerificationCode('');
      await fetch2FAStatus();
      alert('2FA başarıyla devre dışı bırakıldı');
    } catch (error: any) {
      setDisableError(error.message || 'Bir hata oluştu');
    } finally {
      setIsDisabling(false);
    }
  };

  if (status === 'loading' || isLoadingInfo) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-background-secondary rounded-md border border-gray-700 p-6 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-white mb-6">Bilgilerim</h1>

        {userInfo ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Kullanıcı Adı</p>
                <p className="text-white">{userInfo.username}</p>
              </div>

              {userInfo.rutbe && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Rütbe</p>
                  <p className="text-white">{userInfo.rutbe}</p>
                </div>
              )}

              {(userInfo.isim || userInfo.soyisim) && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">İsim</p>
                  <p className="text-white">{userInfo.isim || ''} {userInfo.soyisim || ''}</p>
                </div>
              )}

              {userInfo.tckn && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">TCKN</p>
                  <p className="text-white">{userInfo.tckn}</p>
                </div>
              )}

              {userInfo.telefon && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Telefon Numarası</p>
                  <p className="text-white">{userInfo.telefon}</p>
                </div>
              )}

              {userInfo.evAdresi && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-300 mb-1">Ev Adresi</p>
                  <p className="text-white">{userInfo.evAdresi}</p>
                </div>
              )}

              {userInfo.yakiniIsmi && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Yakını İsmi</p>
                  <p className="text-white">{userInfo.yakiniIsmi}</p>
                </div>
              )}

              {userInfo.yakiniTelefon && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Yakını Telefon Numarası</p>
                  <p className="text-white">{userInfo.yakiniTelefon}</p>
                </div>
              )}

              {userInfo.ruhsatSeriNo && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Ruhsat Seri No</p>
                  <p className="text-white">{userInfo.ruhsatSeriNo}</p>
                </div>
              )}

              {userInfo.kanGrubu && (
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Kan Grubu</p>
                  <p className="text-white">{userInfo.kanGrubu}</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-700 flex flex-wrap gap-4">
              <button
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError('');
                  setPasswordForm({
                    oldPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }}
                className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                Şifre Değiştir
              </button>

              <button
                onClick={() => {
                  setShow2FAModal(true);
                  setSetupError('');
                  setDisableError('');
                  setVerificationCode('');
                  setTwoFactorSecret(null);
                  setQrCodeDataUrl(null);
                  fetch2FAStatus();
                }}
                className="px-6 py-3 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all border border-gray-700"
              >
                2FA Ayarları
              </button>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">Bilgiler yüklenemedi</div>
        )}
      </div>

      {/* Şifre Değiştirme Modal */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowPasswordModal(false);
            setPasswordError('');
            setPasswordForm({
              oldPassword: '',
              newPassword: '',
              confirmPassword: '',
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-md w-full backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Şifre Değiştir
                </h2>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError('');
                    setPasswordForm({
                      oldPassword: '',
                      newPassword: '',
                      confirmPassword: '',
                    });
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {passwordError && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{passwordError}</p>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Eski Şifre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Mevcut şifrenizi girin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Yeni Şifre <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Yeni şifrenizi girin"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Şifre en az 8 karakter olmalı, büyük harf, küçük harf, rakam ve özel karakter içermelidir.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Yeni Şifre (Tekrar) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Yeni şifrenizi tekrar girin"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordError('');
                      setPasswordForm({
                        oldPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isChangingPassword ? 'Değiştiriliyor...' : 'Şifre Değiştir'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Ayarları Modal */}
      {show2FAModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShow2FAModal(false);
            setSetupError('');
            setDisableError('');
            setVerificationCode('');
            setTwoFactorSecret(null);
            setQrCodeDataUrl(null);
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-lg w-full backdrop-blur-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  İki Faktörlü Kimlik Doğrulama (2FA)
                </h2>
                <button
                  onClick={() => {
                    setShow2FAModal(false);
                    setSetupError('');
                    setDisableError('');
                    setVerificationCode('');
                    setTwoFactorSecret(null);
                    setQrCodeDataUrl(null);
                  }}
                  className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {twoFactorStatus && (
                <div className="mb-6">
                  <div className="flex items-center justify-between p-4 bg-background rounded-md border border-gray-700">
                    <div>
                      <p className="text-white font-medium">2FA Durumu</p>
                      <p className="text-sm text-gray-400">
                        {twoFactorStatus.enabled ? 'Aktif' : 'Devre Dışı'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      twoFactorStatus.enabled
                        ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}>
                      {twoFactorStatus.enabled ? 'Aktif' : 'Devre Dışı'}
                    </div>
                  </div>
                </div>
              )}

              {setupError && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{setupError}</p>
                </div>
              )}

              {disableError && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4 backdrop-blur-sm">
                  <p className="text-red-400 text-sm">{disableError}</p>
                </div>
              )}

              {!twoFactorStatus?.enabled ? (
                // 2FA Kurulumu
                <div className="space-y-4">
                  {!qrCodeDataUrl ? (
                    <div>
                      <p className="text-gray-300 mb-4">
                        Microsoft Authenticator uygulamasını kullanarak 2FA'yı aktif edebilirsiniz.
                      </p>
                      <button
                        onClick={handle2FASetup}
                        disabled={isSettingUp}
                        className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                      >
                        {isSettingUp ? 'Kurulum başlatılıyor...' : '2FA Kurulumunu Başlat'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-gray-300 mb-4">
                          Aşağıdaki QR kodu Microsoft Authenticator uygulaması ile tarayın:
                        </p>
                        <div className="flex justify-center mb-4">
                          <img
                            src={qrCodeDataUrl}
                            alt="QR Code"
                            className="w-64 h-64 border border-gray-700 rounded-md bg-white p-2"
                          />
                        </div>
                        <p className="text-sm text-gray-400 mb-4">
                          Microsoft Authenticator uygulamasını yüklemediyseniz:
                        </p>
                        <div className="text-sm text-gray-400 space-y-2 mb-6">
                          <p><strong>Apple Cihazlar:</strong> App Store'dan "Microsoft Authenticator" uygulamasını indirin.</p>
                          <p><strong>Android Cihazlar:</strong> Google Play Store'dan "Microsoft Authenticator" uygulamasını indirin.</p>
                        </div>
                      </div>

                      <form onSubmit={handle2FAVerify}>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            6 Haneli Doğrulama Kodu
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={verificationCode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setVerificationCode(value);
                            }}
                            className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-center text-2xl tracking-widest"
                            placeholder="000000"
                            required
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setTwoFactorSecret(null);
                              setQrCodeDataUrl(null);
                              setVerificationCode('');
                              setSetupError('');
                            }}
                            className="flex-1 px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                          >
                            İptal
                          </button>
                          <button
                            type="submit"
                            disabled={isSettingUp || verificationCode.length !== 6}
                            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                          >
                            {isSettingUp ? 'Doğrulanıyor...' : 'Doğrula ve Aktif Et'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ) : (
                // 2FA Devre Dışı Bırakma
                <div className="space-y-4">
                  <p className="text-gray-300">
                    2FA'yı devre dışı bırakmak için Microsoft Authenticator uygulamanızdan aldığınız 6 haneli kodu girin.
                  </p>
                  <form onSubmit={handle2FADisable}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        6 Haneli Doğrulama Kodu
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setVerificationCode(value);
                        }}
                        className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-center text-2xl tracking-widest"
                        placeholder="000000"
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShow2FAModal(false);
                          setDisableError('');
                          setVerificationCode('');
                        }}
                        className="flex-1 px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        disabled={isDisabling || verificationCode.length !== 6}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all disabled:opacity-50"
                      >
                        {isDisabling ? 'Devre Dışı Bırakılıyor...' : '2FA\'yı Devre Dışı Bırak'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

