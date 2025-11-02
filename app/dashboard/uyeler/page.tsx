'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

interface User {
  id: string;
  username: string;
  rutbe: string | null;
  membershipStatus?: string;
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

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export default function UyelerPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('tumu');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rutbe: '',
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

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    rutbe: '',
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

  // İzinlere göre arama alanlarını belirle
  const allSearchFieldOptions = [
    { value: 'tumu', label: 'Tümü' },
    { value: 'username', label: 'Kullanıcı Adı' },
    { value: 'rutbe', label: 'Rütbe' },
    { value: 'isim', label: 'İsim' },
    { value: 'soyisim', label: 'Soyisim' },
    { value: 'tckn', label: 'TCKN' },
    { value: 'telefon', label: 'Telefon' },
    { value: 'evAdresi', label: 'Ev Adresi' },
    { value: 'yakiniIsmi', label: 'Yakını İsmi' },
    { value: 'yakiniTelefon', label: 'Yakını Telefon' },
    { value: 'ruhsatSeriNo', label: 'Ruhsat Seri No' },
    { value: 'kanGrubu', label: 'Kan Grubu' },
  ];

  // Kullanıcının okuma izinlerini al (getReadableFields'dan önce)
  const userPermissions = session?.user?.permissions;
  const usersReadableFields = userPermissions?.users?.read?.readableFields || [];
  const hasUsersReadAccess = hasPermission(userPermissions, 'users', 'read');
  
  // İzinlere göre okunabilir alanları belirle
  const getReadableFields = () => {
    if (!hasUsersReadAccess) return [];
    if (typeof userPermissions?.users?.read === 'object' && usersReadableFields.length > 0) {
      return usersReadableFields;
    }
    // Tüm alanlar okunabilir
    return allSearchFieldOptions.filter(opt => opt.value !== 'tumu').map(opt => opt.value);
  };

  const readableFields = getReadableFields();
  
  // İşlem izinlerini kontrol et
  const canCreate = hasPermission(userPermissions, 'users', 'create');
  const canUpdate = hasPermission(userPermissions, 'users', 'update');
  const canDelete = hasPermission(userPermissions, 'users', 'delete');

  // İzinlere göre arama alanlarını filtrele
  const searchFieldOptions = hasUsersReadAccess 
    ? [
        { value: 'tumu', label: 'Tümü' },
        ...allSearchFieldOptions
          .filter(opt => opt.value !== 'tumu' && readableFields.includes(opt.value))
      ]
    : [];

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    // If no search term, show all users
    if (!searchTerm.trim()) {
      return true;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    // If "Tümü" is selected, search in all readable fields only
    if (searchField === 'tumu') {
      const userAny = user as any;
      return readableFields.some((field: string) => {
        const fieldValue = userAny[field];
        return fieldValue ? String(fieldValue).toLowerCase().includes(searchLower) : false;
      });
    } 
    // If a specific field is selected, search ONLY in that field (if readable)
    else if (readableFields.includes(searchField)) {
      const fieldValue = (user as any)[searchField];
      return fieldValue ? String(fieldValue).toLowerCase().includes(searchLower) : false;
    }
    
    return false;
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchUsers();
      fetchRoles();
    }
  }, [session, status]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch('/api/users', {
        credentials: 'include',
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Üyeler yüklenemedi');
      }
      
      const data = await res.json();
      setUsers(data || []);
    } catch (error: any) {
      console.error('Fetch users error:', error);
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Rütbeler yüklenemedi');
      }
      const data = await res.json();
      setRoles(data);
    } catch (error: any) {
      console.error('Roles fetch error:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Üye eklenemedi');
      }

      // Form'u sıfırla ve kapat
      setFormData({
        username: '',
        password: '',
        rutbe: '',
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
      setShowAddForm(false);
      
      alert(`Üye başarıyla eklendi!\n\nÜye kullanıcı adı ve şifresi ile giriş yapabilir.`);
      
      // Üyeleri yeniden yükle
      await fetchUsers();
    } catch (error: any) {
      setError(error.message || 'Üye eklenemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username || '',
      password: '', // Şifreyi boş bırak (opsiyonel güncelleme)
      rutbe: user.rutbe || '',
      isim: user.isim || '',
      soyisim: user.soyisim || '',
      tckn: user.tckn || '',
      telefon: user.telefon || '',
      evAdresi: user.evAdresi || '',
      yakiniIsmi: user.yakiniIsmi || '',
      yakiniTelefon: user.yakiniTelefon || '',
      ruhsatSeriNo: user.ruhsatSeriNo || '',
      kanGrubu: user.kanGrubu || '',
    });
    setShowEditModal(true);
    setError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(true);
    setError('');

    try {
      const updateData: any = { ...editFormData };
      // Şifre boşsa güncelleme verisine dahil etme
      if (!updateData.password) {
        delete updateData.password;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Üye güncellenemedi');
      }

      setShowEditModal(false);
      setEditingUser(null);
      
      // Üyeleri yeniden yükle
      await fetchUsers();
    } catch (error: any) {
      setError(error.message || 'Üye güncellenemedi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bu üyeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve üyenin tüm verileri kalıcı olarak silinecektir.')) {
      return;
    }

    setDeletingUserId(userId);
    setError('');

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Üye silinemedi');
      }

      // Eğer silinen kullanıcı düzenlenen kullanıcıysa modal'ı kapat
      if (editingUser && editingUser.id === userId) {
        setShowEditModal(false);
        setEditingUser(null);
      }

      // Üyeleri yeniden yükle
      await fetchUsers();
    } catch (error: any) {
      setError(error.message || 'Üye silinemedi');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  // Görüntülenecek sütunları filtrele
  const visibleColumns = [
    { key: 'username', label: 'Kullanıcı Adı' },
    { key: 'rutbe', label: 'Rütbe' },
    { key: 'isim', label: 'İsim' },
    { key: 'soyisim', label: 'Soyisim' },
    { key: 'tckn', label: 'TCKN' },
    { key: 'telefon', label: 'Telefon' },
    { key: 'evAdresi', label: 'Ev Adresi' },
    { key: 'yakiniIsmi', label: 'Yakını İsmi' },
    { key: 'yakiniTelefon', label: 'Yakını Telefon' },
    { key: 'ruhsatSeriNo', label: 'Ruhsat Seri No' },
    { key: 'kanGrubu', label: 'Kan Grubu' },
  ].filter(col => readableFields.includes(col.key));

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Üyeler</h1>
        {canCreate && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full sm:w-auto px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            {showAddForm ? 'İptal' : 'Yeni Üye Ekle'}
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-background-secondary rounded-md p-3 lg:p-4 border border-gray-700 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="w-full sm:flex-shrink-0 sm:w-auto">
            <select
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
              className="w-full sm:w-[160px] px-3 sm:px-4 py-2 border border-gray-600 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
            >
              {searchFieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${searchField === 'tumu' ? 'Tüm alanlarda ara...' : `${searchFieldOptions.find(opt => opt.value === searchField)?.label} alanında ara...`}`}
              className="flex-1 px-3 sm:px-4 py-2 border border-gray-600 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3 text-gray-400 hover:text-white transition"
                title="Temizle"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-gray-400">
            {filteredUsers.length} üye bulundu
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="bg-background-secondary rounded-md p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Yeni Üye Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Kullanıcı Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Şifre <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Rütbe</label>
                <select
                  value={formData.rutbe}
                  onChange={(e) => setFormData({ ...formData, rutbe: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                >
                  <option value="">Seçiniz</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">İsim</label>
                <input
                  type="text"
                  value={formData.isim}
                  onChange={(e) => setFormData({ ...formData, isim: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Soyisim</label>
                <input
                  type="text"
                  value={formData.soyisim}
                  onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">TCKN</label>
                <input
                  type="text"
                  value={formData.tckn}
                  onChange={(e) => setFormData({ ...formData, tckn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Telefon</label>
                <input
                  type="tel"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ev Adresi</label>
                <input
                  type="text"
                  value={formData.evAdresi}
                  onChange={(e) => setFormData({ ...formData, evAdresi: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Yakını İsmi</label>
                <input
                  type="text"
                  value={formData.yakiniIsmi}
                  onChange={(e) => setFormData({ ...formData, yakiniIsmi: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Yakını Telefon</label>
                <input
                  type="tel"
                  value={formData.yakiniTelefon}
                  onChange={(e) => setFormData({ ...formData, yakiniTelefon: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ruhsat Seri No</label>
                <input
                  type="text"
                  value={formData.ruhsatSeriNo}
                  onChange={(e) => setFormData({ ...formData, ruhsatSeriNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Kan Grubu</label>
                <select
                  value={formData.kanGrubu}
                  onChange={(e) => setFormData({ ...formData, kanGrubu: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                >
                  <option value="">Seçiniz</option>
                  {kanGrubuOptions.map((kanGrubu) => (
                    <option key={kanGrubu} value={kanGrubu}>
                      {kanGrubu}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
              >
                {isSubmitting ? 'Ekleniyor...' : 'Üye Ekle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Üyeler Listesi - Mobile */}
      <div className="lg:hidden bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        {visibleColumns.length === 0 && !hasUsersReadAccess ? (
          <div className="p-8 text-center text-gray-400">
            Bu bölümü görüntüleme yetkiniz bulunmuyor.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye eklenmemiş'}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const displayUser = user as any;
                return (
                  <div key={user.id} className="p-4 hover:bg-background-tertiary transition">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        {readableFields.includes('username') && (
                          <h3 className="text-white font-medium">{displayUser.username || '-'}</h3>
                        )}
                        {readableFields.includes('rutbe') && displayUser.rutbe && (
                          <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded mt-1">
                            {displayUser.rutbe}
                          </span>
                        )}
                      </div>
                      {canUpdate && (
                        <button
                          onClick={() => handleEditClick(user)}
                          className="text-primary hover:text-primary/80 transition-all p-2 hover:bg-primary/10 rounded"
                          title="Düzenle"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      {readableFields.includes('isim') && (displayUser.isim || displayUser.soyisim) && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">İsim:</span> {displayUser.isim || '-'} {displayUser.soyisim || ''}
                        </p>
                      )}
                      {readableFields.includes('tckn') && displayUser.tckn && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">TCKN:</span> {displayUser.tckn}
                        </p>
                      )}
                      {readableFields.includes('telefon') && displayUser.telefon && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Telefon:</span> {displayUser.telefon}
                        </p>
                      )}
                      {readableFields.includes('evAdresi') && displayUser.evAdresi && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Adres:</span> {displayUser.evAdresi}
                        </p>
                      )}
                      {readableFields.includes('kanGrubu') && displayUser.kanGrubu && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Kan Grubu:</span> {displayUser.kanGrubu}
                        </p>
                      )}
                      {readableFields.includes('yakiniIsmi') && displayUser.yakiniIsmi && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Yakını İsmi:</span> {displayUser.yakiniIsmi}
                        </p>
                      )}
                      {readableFields.includes('yakiniTelefon') && displayUser.yakiniTelefon && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Yakını Telefon:</span> {displayUser.yakiniTelefon}
                        </p>
                      )}
                      {readableFields.includes('ruhsatSeriNo') && displayUser.ruhsatSeriNo && (
                        <p className="text-gray-300">
                          <span className="text-gray-500">Ruhsat Seri No:</span> {displayUser.ruhsatSeriNo}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Üyeler Tablosu - Desktop */}
      <div className="hidden lg:block bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        {visibleColumns.length === 0 && !hasUsersReadAccess ? (
          <div className="p-8 text-center text-gray-400">
            Bu bölümü görüntüleme yetkiniz bulunmuyor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background-tertiary border-b border-gray-700">
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                  {(canUpdate || canDelete) && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length + ((canUpdate || canDelete) ? 1 : 0)} className="px-6 py-8 text-center text-gray-400">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye eklenmemiş'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-background-tertiary transition">
                      {visibleColumns.map(col => (
                        <td key={col.key} className={`px-6 py-4 ${col.key === 'username' ? 'text-white font-medium' : 'text-gray-300'} ${col.key === 'evAdresi' ? 'max-w-xs truncate' : 'whitespace-nowrap'} text-sm`}>
                          {(user as any)[col.key] || '-'}
                        </td>
                      ))}
                      {(canUpdate || canDelete) && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {canUpdate && (
                            <button
                              onClick={() => handleEditClick(user)}
                              className="text-primary hover:text-primary/80 transition-all p-2 hover:bg-primary/10 rounded"
                              title="Düzenle"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background-secondary rounded-md border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Üye Düzenle: {editingUser.username}
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setError('');
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/50 p-3 rounded-md mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Kullanıcı Adı <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.username}
                      onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Şifre (Değiştirmek için yeni şifre girin)
                    </label>
                    <input
                      type="password"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                      placeholder="Boş bırakılırsa değişmez"
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Rütbe</label>
                    <select
                      value={editFormData.rutbe}
                      onChange={(e) => setEditFormData({ ...editFormData, rutbe: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    >
                      <option value="">Seçiniz</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">İsim</label>
                    <input
                      type="text"
                      value={editFormData.isim}
                      onChange={(e) => setEditFormData({ ...editFormData, isim: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Soyisim</label>
                    <input
                      type="text"
                      value={editFormData.soyisim}
                      onChange={(e) => setEditFormData({ ...editFormData, soyisim: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">TCKN</label>
                    <input
                      type="text"
                      value={editFormData.tckn}
                      onChange={(e) => setEditFormData({ ...editFormData, tckn: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Telefon</label>
                    <input
                      type="tel"
                      value={editFormData.telefon}
                      onChange={(e) => setEditFormData({ ...editFormData, telefon: e.target.value })}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ev Adresi</label>
                    <input
                      type="text"
                      value={editFormData.evAdresi}
                      onChange={(e) => setEditFormData({ ...editFormData, evAdresi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Yakını İsmi</label>
                    <input
                      type="text"
                      value={editFormData.yakiniIsmi}
                      onChange={(e) => setEditFormData({ ...editFormData, yakiniIsmi: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Yakını Telefon</label>
                    <input
                      type="tel"
                      value={editFormData.yakiniTelefon}
                      onChange={(e) => setEditFormData({ ...editFormData, yakiniTelefon: e.target.value })}
                      placeholder="05XX XXX XX XX"
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ruhsat Seri No</label>
                    <input
                      type="text"
                      value={editFormData.ruhsatSeriNo}
                      onChange={(e) => setEditFormData({ ...editFormData, ruhsatSeriNo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kan Grubu</label>
                    <select
                      value={editFormData.kanGrubu}
                      onChange={(e) => setEditFormData({ ...editFormData, kanGrubu: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    >
                      <option value="">Seçiniz</option>
                      {kanGrubuOptions.map((kanGrubu) => (
                        <option key={kanGrubu} value={kanGrubu}>
                          {kanGrubu}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-4">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editingUser) {
                          handleDeleteUser(editingUser.id);
                        }
                      }}
                      disabled={deletingUserId === editingUser?.id || isUpdating}
                      className="px-4 py-2 bg-red-900/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-900/30 transition-all disabled:opacity-50"
                    >
                      {deletingUserId === editingUser?.id ? 'Siliniyor...' : 'Üyeyi Sil'}
                    </button>
                  )}
                  <div className="flex gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingUser(null);
                        setError('');
                      }}
                      className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating || deletingUserId === editingUser?.id}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                    >
                      {isUpdating ? 'Güncelleniyor...' : 'Güncelle'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

