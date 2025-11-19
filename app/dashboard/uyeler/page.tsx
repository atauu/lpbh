'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import { createPortal } from 'react-dom';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, Select, SelectItem } from '@/components/ui';

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
  plaka: string | null;
  ehliyetTuru: string[];
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  groupId: string | null;
  group?: {
    id: string;
    name: string;
    description: string | null;
    order: number;
  } | null;
}

interface RoleGroup {
  id: string;
  name: string;
  description: string | null;
  order: number;
  roles?: Role[];
}

export default function UyelerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  // Detail modal state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [citizenData, setCitizenData] = useState<any>(null);
  const [loadingCitizenData, setLoadingCitizenData] = useState(false);
  const [citizenDataError, setCitizenDataError] = useState('');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('tumu');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Search dropdown state (for rutbe, kanGrubu, ehliyetTuru)
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

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
    plaka: '',
    ehliyetTuru: [] as string[],
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

  const membershipStatusOptions = [
    { value: 'pending_approval', label: 'Onay Bekliyor' },
    { value: 'pending_info', label: 'Bilgi Bekliyor' },
    { value: 'approved', label: 'Onaylandı' },
    { value: 'rejected', label: 'Reddedildi' },
  ];

  const handleEhliyetToggle = (turu: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditFormData(prev => ({
        ...prev,
        ehliyetTuru: prev.ehliyetTuru.includes(turu)
          ? prev.ehliyetTuru.filter(t => t !== turu)
          : [...prev.ehliyetTuru, turu],
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        ehliyetTuru: prev.ehliyetTuru.includes(turu)
          ? prev.ehliyetTuru.filter(t => t !== turu)
          : [...prev.ehliyetTuru, turu],
      }));
    }
  };

  // İzinlere göre arama alanlarını belirle
  const allSearchFieldOptions = [
    { value: 'tumu', label: 'Tümü' },
    { value: 'membershipStatus', label: 'Üyelik Durumu' },
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
    { value: 'plaka', label: 'Plaka' },
    { value: 'ehliyetTuru', label: 'Ehliyet Türü' },
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
  const canReadCitizenDatabase = hasPermission(userPermissions, 'citizenDatabase', 'read');

  // İzinlere göre arama alanlarını filtrele
  const searchFieldOptions = hasUsersReadAccess 
    ? [
        { value: 'tumu', label: 'Tümü' },
        ...allSearchFieldOptions
          .filter(opt => opt.value !== 'tumu' && readableFields.includes(opt.value))
      ]
    : [];

  // Get all unique rutbeler from users
  const allRutbeler = useMemo(
    () => Array.from(new Set(users.map(u => u.rutbe).filter(Boolean))) as string[],
    [users]
  );

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    const term = debouncedSearchTerm.trim();
    return users.filter((user) => {
      // Membership status filter (from searchTerm when searchField is 'membershipStatus')
      if (searchField === 'membershipStatus' && term) {
        const selectedStatuses = term.split(',').map(s => s.trim()).filter(Boolean);
        if (selectedStatuses.length > 0) {
          const userStatus = user.membershipStatus || 'approved';
          if (!selectedStatuses.includes(userStatus)) {
            return false;
          }
        }
      }

      // Rutbe filter (from searchTerm when searchField is 'rutbe')
      if (searchField === 'rutbe' && term) {
        const selectedRutbeler = term.split(',').map(r => r.trim()).filter(Boolean);
        if (selectedRutbeler.length > 0) {
          if (!user.rutbe || !selectedRutbeler.includes(user.rutbe)) {
            return false;
          }
        }
      }

      // Kan grubu filter (from searchTerm when searchField is 'kanGrubu')
      if (searchField === 'kanGrubu' && term) {
        const selectedKanGruplari = term.split(',').map(k => k.trim()).filter(Boolean);
        if (selectedKanGruplari.length > 0) {
          if (!user.kanGrubu || !selectedKanGruplari.includes(user.kanGrubu)) {
            return false;
          }
        }
      }

      // Ehliyet türü filter (from searchTerm when searchField is 'ehliyetTuru')
      if (searchField === 'ehliyetTuru' && term) {
        const selectedEhliyetTurleri = term.split(',').map(t => t.trim()).filter(Boolean);
        if (selectedEhliyetTurleri.length > 0) {
          const userEhliyetTurleri = user.ehliyetTuru || [];
          const hasSelectedEhliyet = selectedEhliyetTurleri.some(tur => userEhliyetTurleri.includes(tur));
          if (!hasSelectedEhliyet) {
            return false;
          }
        }
      }

      // Text search filter
      if (!term) {
        return true;
      }

      const searchLower = term.toLowerCase();

      // If "Tümü" is selected, search in all readable fields only
      if (searchField === 'tumu') {
        const userAny = user as any;
        return readableFields.some((field: string) => {
          const fieldValue = userAny[field];
          if (Array.isArray(fieldValue)) {
            return fieldValue.some((item: any) => String(item).toLowerCase().includes(searchLower));
          }
          return fieldValue ? String(fieldValue).toLowerCase().includes(searchLower) : false;
        });
      } 
      // If a specific field is selected, search ONLY in that field (if readable)
      else if (readableFields.includes(searchField)) {
        const fieldValue = (user as any)[searchField];
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((item: any) => String(item).toLowerCase().includes(searchLower));
        }
        return fieldValue ? String(fieldValue).toLowerCase().includes(searchLower) : false;
      }
      
      return false;
    });
  }, [users, debouncedSearchTerm, searchField, readableFields]);

  // Close dropdowns when clicking outside and update position on scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-dropdown') && !target.closest('[data-dropdown-portal]')) {
        setIsSearchDropdownOpen(false);
      }
    };

    const updateDropdownPosition = () => {
      if (isSearchDropdownOpen && dropdownButtonRef.current) {
        const rect = dropdownButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isSearchDropdownOpen]);

  // Get selected values for dropdown filters
  const getSelectedValues = (): string[] => {
    if (!searchTerm.trim()) return [];
    return searchTerm.split(',').map(v => v.trim()).filter(Boolean);
  };

  const handleDropdownToggle = (value: string) => {
    const selected = getSelectedValues();
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    setSearchTerm(newSelected.join(', '));
  };

  // Debounce search term to reduce heavy filtering work while typing
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let isMounted = true;
    const usersController = new AbortController();
    const rolesController = new AbortController();
    const groupsController = new AbortController();

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (session) {
      fetchUsers(usersController.signal, () => isMounted);
      fetchRoles(rolesController.signal, () => isMounted);
      fetchRoleGroups(groupsController.signal, () => isMounted);
    }

    return () => {
      isMounted = false;
      usersController.abort();
      rolesController.abort();
      groupsController.abort();
    };
  }, [session, status, router]);

  const fetchUsers = async (signal?: AbortSignal, getIsMounted?: () => boolean) => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch('/api/users', {
        credentials: 'include',
        signal,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Üyeler yüklenemedi');
      }
      
      const data = await res.json();
      if (getIsMounted ? getIsMounted() : true) {
        setUsers(data || []);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Fetch users error:', error);
      if (getIsMounted ? getIsMounted() : true) {
        setError(error.message || 'Bir hata oluştu');
      }
    } finally {
      if (getIsMounted ? getIsMounted() : true) {
        setIsLoading(false);
      }
    }
  };

  const fetchRoles = async (signal?: AbortSignal, getIsMounted?: () => boolean) => {
    try {
      const res = await fetch('/api/roles', {
        credentials: 'include',
        signal,
      });
      if (!res.ok) {
        throw new Error('Rütbeler yüklenemedi');
      }
      const data = await res.json();
      if (getIsMounted ? getIsMounted() : true) {
        setRoles(data);
      }
    } catch (error: any) {
      console.error('Roles fetch error:', error);
    }
  };

  const fetchRoleGroups = async (signal?: AbortSignal, getIsMounted?: () => boolean) => {
    try {
      const res = await fetch('/api/role-groups', {
        credentials: 'include',
        signal,
      });
      if (!res.ok) {
        throw new Error('Rütbe grupları yüklenemedi');
      }
      const data = await res.json();
      if (getIsMounted ? getIsMounted() : true) {
        setRoleGroups(data);
      }
    } catch (error: any) {
      console.error('Role groups fetch error:', error);
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
        plaka: '',
        ehliyetTuru: [],
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

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    setShowDetailModal(true);
    setCitizenDataError('');
    
    // Vatandaş veritabanı izni varsa ve TCKN varsa otomatik sorgula
    if (canReadCitizenDatabase && user.tckn) {
      fetchCitizenData(user.tckn, true);
    } else {
      setCitizenData(null);
    }
  };

  const fetchCitizenData = async (tckn: string, setLoading = false) => {
    if (setLoading) {
      setLoadingCitizenData(true);
    }
    setCitizenDataError('');
    try {
      const res = await fetch(`/api/citizen-search?tckn=${tckn}`);
      const data = await res.json();
      
      if (res.ok && data.success) {
        setCitizenData(data.data);
        return data.data;
      } else {
        setCitizenDataError(data.error || 'Vatandaş bilgileri bulunamadı');
        return null;
      }
    } catch (error: any) {
      console.error('Citizen data fetch error:', error);
      setCitizenDataError('Vatandaş bilgileri yüklenirken bir hata oluştu');
      return null;
    } finally {
      if (setLoading) {
        setLoadingCitizenData(false);
      }
    }
  };

  const handleUpdateFromCitizenDatabase = async () => {
    if (!selectedUser || !selectedUser.tckn) {
      setCitizenDataError('TCKN bulunamadı');
      return;
    }

    if (!canReadCitizenDatabase) {
      setCitizenDataError('Vatandaş veritabanı okuma izniniz bulunmuyor');
      return;
    }

    // Sadece vatandaş veritabanından bilgileri çek ve göster, üye kaydını güncelleme
    await fetchCitizenData(selectedUser.tckn, true);
  };

  const handleEditClick = (user: User, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
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
      plaka: user.plaka || '',
      ehliyetTuru: user.ehliyetTuru || [],
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

      const data = await res.json();
      
      if (!res.ok) {
        console.error('Update failed:', data);
        throw new Error(data.details || data.error || 'Üye güncellenemedi');
      }

      setShowEditModal(false);
      setEditingUser(null);
      
      // Üyeleri yeniden yükle
      await fetchUsers();
      
      // Eğer detay modalı açıksa ve güncellenen kullanıcı seçiliyse, selectedUser'ı da güncelle
      if (selectedUser && selectedUser.id === editingUser?.id) {
        setSelectedUser(data);
      }
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

  // Üyeleri rütbelerine göre gruplandır
  const userGroups = (() => {
    const groups: Record<string, { group: RoleGroup | null; users: User[] }> = {};
    
    // Önce grupları oluştur
    roleGroups.forEach(group => {
      groups[group.id] = { group, users: [] };
    });
    
    // Grup atanmamış kullanıcılar için
    groups['ungrouped'] = { group: null, users: [] };
    
    // Üyeleri gruplarına göre dağıt
    filteredUsers.forEach(user => {
      if (!user.rutbe) {
        groups['ungrouped'].users.push(user);
        return;
      }
      
      // Rütbeyi bul
      const role = roles.find(r => r.name === user.rutbe);
      if (!role || !role.groupId) {
        groups['ungrouped'].users.push(user);
        return;
      }
      
      // Grubu bul
      if (groups[role.groupId]) {
        groups[role.groupId].users.push(user);
      } else {
        groups['ungrouped'].users.push(user);
      }
    });
    
    return groups;
  })();

  return (
    <div className="space-y-4 lg:space-y-6 overflow-visible">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-2xl lg:text-3xl font-bold text-text-primary">Üyeler</h1>
        {canCreate && (
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="primary"
            className="w-full sm:w-auto"
          >
            {showAddForm ? 'İptal' : 'Yeni Üye Ekle'}
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-background-secondary rounded-md p-3 lg:p-4 border border-border backdrop-blur-sm relative overflow-visible">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 relative">
          <div className="w-full sm:flex-shrink-0 sm:w-auto">
            <Select
              value={searchField}
              onValueChange={(value) => {
                setSearchField(value);
                setSearchTerm('');
                setIsSearchDropdownOpen(false);
              }}
              className="w-full sm:w-[160px]"
              placeholder="Alan seçin..."
            >
              {searchFieldOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="flex-1 flex gap-2 relative search-dropdown" style={{ zIndex: 50 }}>
            {/* Dropdown for membershipStatus, rutbe, kanGrubu, ehliyetTuru */}
            {(searchField === 'membershipStatus' || searchField === 'rutbe' || searchField === 'kanGrubu' || searchField === 'ehliyetTuru') ? (
              <>
                <Button
                  ref={dropdownButtonRef}
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (dropdownButtonRef.current) {
                      const rect = dropdownButtonRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }
                    setIsSearchDropdownOpen(!isSearchDropdownOpen);
                  }}
                  className="flex-1 flex items-center justify-between"
                >
                  <span className="text-left truncate">
                    {searchTerm.trim() 
                      ? `${getSelectedValues().length} seçili` 
                      : `${searchFieldOptions.find(opt => opt.value === searchField)?.label} seçin...`}
                  </span>
                  <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${isSearchDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
                {isSearchDropdownOpen && dropdownPosition && typeof window !== 'undefined' && createPortal(
                  <>
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={() => setIsSearchDropdownOpen(false)}
                    />
                    <div 
                      data-dropdown-portal
                      className="fixed bg-background border border-gray-700 rounded-md shadow-2xl z-[9999] max-h-64 overflow-y-auto"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${dropdownPosition.width}px`,
                        maxWidth: '90vw',
                      }}
                    >
                      <div className={`p-2 ${searchField === 'ehliyetTuru' ? 'grid grid-cols-2 gap-1' : 'space-y-1'}`}>
                        {searchField === 'membershipStatus' && membershipStatusOptions.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 p-2 hover:bg-background-tertiary rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getSelectedValues().includes(option.value)}
                              onChange={() => handleDropdownToggle(option.value)}
                            />
                            <span className="text-white text-sm">{option.label}</span>
                          </label>
                        ))}
                        {searchField === 'rutbe' && allRutbeler.map((rutbe) => (
                          <label key={rutbe} className="flex items-center gap-2 p-2 hover:bg-background-tertiary rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getSelectedValues().includes(rutbe)}
                              onChange={() => handleDropdownToggle(rutbe)}
                            />
                            <span className="text-white text-sm">{rutbe}</span>
                          </label>
                        ))}
                        {searchField === 'kanGrubu' && kanGrubuOptions.map((kanGrubu) => (
                          <label key={kanGrubu} className="flex items-center gap-2 p-2 hover:bg-background-tertiary rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getSelectedValues().includes(kanGrubu)}
                              onChange={() => handleDropdownToggle(kanGrubu)}
                            />
                            <span className="text-white text-sm">{kanGrubu}</span>
                          </label>
                        ))}
                        {searchField === 'ehliyetTuru' && ehliyetTuruOptions.map((turu) => (
                          <label key={turu} className="flex items-center gap-2 p-2 hover:bg-background-tertiary rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={getSelectedValues().includes(turu)}
                              onChange={() => handleDropdownToggle(turu)}
                            />
                            <span className="text-white text-sm">{turu}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>,
                  document.body
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`${searchField === 'tumu' ? 'Tüm alanlarda ara...' : `${searchFieldOptions.find(opt => opt.value === searchField)?.label} alanında ara...`}`}
                  className="flex-1 px-3 sm:px-4 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </>
            )}
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setIsSearchDropdownOpen(false);
                }}
                className="px-3 text-text-muted hover:text-text-primary transition"
                title="Temizle"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {searchTerm && (
          <div className="mt-2 text-sm text-text-muted">
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
        <div className="bg-background-secondary rounded-md p-6 border border-border">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Yeni Üye Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Kullanıcı Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Şifre <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Rütbe</label>
                <Select
                  value={formData.rutbe || ''}
                  onValueChange={(value) => setFormData({ ...formData, rutbe: value })}
                  className="w-full"
                  placeholder="Seçiniz"
                >
                  {roles.filter((r) => r.name && r.name.trim() !== '').map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">İsim</label>
                <input
                  type="text"
                  value={formData.isim}
                  onChange={(e) => setFormData({ ...formData, isim: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Soyisim</label>
                <input
                  type="text"
                  value={formData.soyisim}
                  onChange={(e) => setFormData({ ...formData, soyisim: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">TCKN</label>
                <input
                  type="text"
                  value={formData.tckn}
                  onChange={(e) => setFormData({ ...formData, tckn: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Telefon</label>
                <input
                  type="tel"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Ev Adresi</label>
                <input
                  type="text"
                  value={formData.evAdresi}
                  onChange={(e) => setFormData({ ...formData, evAdresi: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Yakını İsmi</label>
                <input
                  type="text"
                  value={formData.yakiniIsmi}
                  onChange={(e) => setFormData({ ...formData, yakiniIsmi: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Yakını Telefon</label>
                <input
                  type="tel"
                  value={formData.yakiniTelefon}
                  onChange={(e) => setFormData({ ...formData, yakiniTelefon: e.target.value })}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Ruhsat Seri No</label>
                <input
                  type="text"
                  value={formData.ruhsatSeriNo}
                  onChange={(e) => setFormData({ ...formData, ruhsatSeriNo: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Kan Grubu</label>
                <Select
                  value={formData.kanGrubu || ''}
                  onValueChange={(value) => setFormData({ ...formData, kanGrubu: value })}
                  className="w-full"
                  placeholder="Seçiniz"
                >
                  {kanGrubuOptions.filter(Boolean).map((kanGrubu) => (
                    <SelectItem key={kanGrubu} value={kanGrubu}>
                      {kanGrubu}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Plaka</label>
                <input
                  type="text"
                  value={formData.plaka}
                  onChange={(e) => setFormData({ ...formData, plaka: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all font-mono uppercase"
                  placeholder="34ABC123"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-secondary mb-2">Ehliyet Türü</label>
                <div className="border border-border rounded-md p-3 bg-background max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {ehliyetTuruOptions.map((turu) => (
                      <label
                        key={turu}
                        className="flex items-center gap-2 cursor-pointer hover:bg-background-tertiary p-2 rounded transition"
                      >
                          <input
                            type="checkbox"
                            checked={formData.ehliyetTuru.includes(turu)}
                            onChange={() => handleEhliyetToggle(turu, false)}
                          />
                        <span className="text-text-primary text-sm">{turu}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => setShowAddForm(false)}
                variant="secondary"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
              >
                {isSubmitting ? 'Ekleniyor...' : 'Üye Ekle'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Üyeler Gruplandırılmış Görünüm - Mobile */}
      <div className="lg:hidden">
        {!hasUsersReadAccess ? (
          <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm">
            <div className="text-gray-400">Bu bölümü görüntüleme yetkiniz bulunmuyor.</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm">
            <div className="text-gray-400">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye eklenmemiş'}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gruplara göre sırala (order'a göre) */}
            {roleGroups
              .sort((a, b) => b.order - a.order) // Yüksek order önce
              .map((group) => {
                const groupData = userGroups[group.id];
                if (!groupData || groupData.users.length === 0) return null;
                
                return (
                  <div key={group.id} className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
                    <div className="p-3 border-b border-border bg-background-tertiary">
                      <h2 className="text-lg font-semibold text-text-primary">{group.name}</h2>
                      {group.description && (
                        <p className="text-xs text-text-muted mt-1">{group.description}</p>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-1 gap-2">
                        {groupData.users.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleUserClick(user)}
                            className="bg-background-tertiary border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-background-secondary transition-all cursor-pointer"
                          >
                            {user.rutbe && (
                              <div className="mb-2">
                                <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded font-medium">
                                  {user.rutbe}
                                </span>
                              </div>
                            )}
                            <p className="text-text-primary font-medium">
                              {user.isim || '-'} {user.soyisim || ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            
            {/* Grup atanmamış üyeler */}
            {userGroups['ungrouped'] && userGroups['ungrouped'].users.length > 0 && (
              <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
                <div className="p-3 border-b border-border bg-background-tertiary">
                  <h2 className="text-lg font-semibold text-text-primary">Grup Atanmamış</h2>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 gap-2">
                    {userGroups['ungrouped'].users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        className="bg-background-tertiary border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-background-secondary transition-all cursor-pointer"
                      >
                        {user.rutbe && (
                          <div className="mb-2">
                            <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded font-medium">
                              {user.rutbe}
                            </span>
                          </div>
                        )}
                        <p className="text-text-primary font-medium">
                          {user.isim || '-'} {user.soyisim || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Üyeler Gruplandırılmış Görünüm - Desktop */}
      <div className="hidden lg:block">
        {!hasUsersReadAccess ? (
          <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm">
            <div className="text-gray-400">Bu bölümü görüntüleme yetkiniz bulunmuyor.</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm">
            <div className="text-gray-400">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye eklenmemiş'}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Gruplara göre sırala (order'a göre) */}
            {roleGroups
              .sort((a, b) => b.order - a.order) // Yüksek order önce
              .map((group) => {
                const groupData = userGroups[group.id];
                if (!groupData || groupData.users.length === 0) return null;
                
                return (
                  <div key={group.id} className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
                    <div className="p-4 border-b border-border bg-background-tertiary">
                      <h2 className="text-xl font-semibold text-white">{group.name}</h2>
                      {group.description && (
                        <p className="text-sm text-gray-400 mt-1">{group.description}</p>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {groupData.users.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => handleUserClick(user)}
                            className="bg-background-tertiary border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-background-secondary transition-all cursor-pointer"
                          >
                            {user.rutbe && (
                              <div className="mb-2">
                                <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded font-medium">
                                  {user.rutbe}
                                </span>
                              </div>
                            )}
                            <p className="text-white font-medium">
                              {user.isim || '-'} {user.soyisim || ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            
            {/* Grup atanmamış üyeler */}
            {userGroups['ungrouped'] && userGroups['ungrouped'].users.length > 0 && (
              <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
                <div className="p-4 border-b border-border bg-background-tertiary">
                  <h2 className="text-xl font-semibold text-white">Grup Atanmamış</h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {userGroups['ungrouped'].users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        className="bg-background-tertiary border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-background-secondary transition-all cursor-pointer"
                      >
                        {user.rutbe && (
                          <div className="mb-2">
                            <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded font-medium">
                              {user.rutbe}
                            </span>
                          </div>
                        )}
                        <p className="text-white font-medium">
                          {user.isim || '-'} {user.soyisim || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
                    <label className="block text-sm font-medium text-text-secondary mb-2">Rütbe</label>
                    <Select
                      value={editFormData.rutbe || ''}
                      onValueChange={(value) => setEditFormData({ ...editFormData, rutbe: value })}
                      className="w-full"
                      placeholder="Seçiniz"
                    >
                      {roles.filter((r) => r.name && r.name.trim() !== '').map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </Select>
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
                    <label className="block text-sm font-medium text-text-secondary mb-2">Kan Grubu</label>
                    <Select
                      value={editFormData.kanGrubu || ''}
                      onValueChange={(value) => setEditFormData({ ...editFormData, kanGrubu: value })}
                      className="w-full"
                      placeholder="Seçiniz"
                    >
                      {kanGrubuOptions.filter(Boolean).map((kanGrubu) => (
                        <SelectItem key={kanGrubu} value={kanGrubu}>
                          {kanGrubu}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Plaka</label>
                    <input
                      type="text"
                      value={editFormData.plaka}
                      onChange={(e) => setEditFormData({ ...editFormData, plaka: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all font-mono uppercase"
                      placeholder="34ABC123"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Ehliyet Türü</label>
                    <div className="border border-gray-700 rounded-md p-3 bg-background max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {ehliyetTuruOptions.map((turu) => (
                          <label
                            key={turu}
                            className="flex items-center gap-2 cursor-pointer hover:bg-background-tertiary p-2 rounded transition"
                          >
                              <input
                                type="checkbox"
                                checked={editFormData.ehliyetTuru.includes(turu)}
                                onChange={() => handleEhliyetToggle(turu, true)}
                              />
                            <span className="text-text-primary text-sm">{turu}</span>
                          </label>
                        ))}
                      </div>
                    </div>
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
                    <Button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingUser(null);
                        setError('');
                      }}
                      variant="secondary"
                      className="px-4 py-2"
                    >
                      İptal
                    </Button>
                    <Button
                      type="submit"
                      disabled={isUpdating || deletingUserId === editingUser?.id}
                      variant="primary"
                      className="px-4 py-2"
                    >
                      {isUpdating ? 'Güncelleniyor...' : 'Güncelle'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => {
          setShowDetailModal(false);
          setSelectedUser(null);
          setCitizenData(null);
          setCitizenDataError('');
        }}>
          <div 
            className="bg-background-secondary rounded-md border border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Üye Detayları
                </h2>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedUser(null);
                    setCitizenData(null);
                    setCitizenDataError('');
                  }}
                  className="text-gray-400 hover:text-white transition text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Üye Bilgileri */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-4 border-b border-gray-700 pb-2">Üye Bilgileri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {readableFields.includes('username') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Kullanıcı Adı</label>
                      <p className="text-white">{selectedUser.username || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('rutbe') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Rütbe</label>
                      <p className="text-white">
                        {selectedUser.rutbe ? (
                          <span className="inline-block px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded">
                            {selectedUser.rutbe}
                          </span>
                        ) : '-'}
                      </p>
                    </div>
                  )}
                  {readableFields.includes('isim') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">İsim</label>
                      <p className="text-white">{selectedUser.isim || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('soyisim') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Soyisim</label>
                      <p className="text-white">{selectedUser.soyisim || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('tckn') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">TCKN</label>
                      <p className="text-white">{selectedUser.tckn || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('telefon') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Telefon</label>
                      <p className="text-white">{selectedUser.telefon || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('evAdresi') && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Ev Adresi</label>
                      <p className="text-white">{selectedUser.evAdresi || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('yakiniIsmi') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Yakını İsmi</label>
                      <p className="text-white">{selectedUser.yakiniIsmi || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('yakiniTelefon') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Yakını Telefon</label>
                      <p className="text-white">{selectedUser.yakiniTelefon || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('ruhsatSeriNo') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Ruhsat Seri No</label>
                      <p className="text-white">{selectedUser.ruhsatSeriNo || '-'}</p>
                    </div>
                  )}
                  {readableFields.includes('kanGrubu') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Kan Grubu</label>
                      <p className="text-white">{selectedUser.kanGrubu || '-'}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Plaka</label>
                    <p className="text-white font-mono">{selectedUser.plaka || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Ehliyet Türü</label>
                    <p className="text-white">{selectedUser.ehliyetTuru && selectedUser.ehliyetTuru.length > 0 ? selectedUser.ehliyetTuru.join(', ') : '-'}</p>
                  </div>
                </div>
                {canUpdate && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleEditClick(selectedUser);
                      }}
                      variant="primary"
                      className="px-4 py-2"
                    >
                      Düzenle
                    </Button>
                  </div>
                )}
              </div>

              {/* Vatandaş Veritabanı Bilgileri */}
              {canReadCitizenDatabase && selectedUser.tckn && (
                <div className="mt-6 border-t border-gray-700 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2 flex-1">
                      Vatandaş Veritabanı Bilgileri
                    </h3>
                    <Button
                      onClick={handleUpdateFromCitizenDatabase}
                      disabled={loadingCitizenData}
                      variant="primary"
                      className="ml-4 px-4 py-2"
                    >
                      {loadingCitizenData ? 'Yükleniyor...' : 'Vatandaş Veritabanından Sorgula'}
                    </Button>
                  </div>
                  
                  {loadingCitizenData ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400">Vatandaş bilgileri yükleniyor...</div>
                    </div>
                  ) : citizenDataError ? (
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
                      {citizenDataError}
                    </div>
                  ) : citizenData ? (
                    <div className="space-y-4">
                      {/* Temel Bilgiler */}
                      <div className="bg-background-tertiary rounded-lg p-4">
                        <h4 className="text-md font-semibold text-white mb-3">Temel Bilgiler</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {citizenData.ad && (
                            <div>
                              <span className="text-gray-400">Ad:</span> <span className="text-white ml-2">{citizenData.ad}</span>
                            </div>
                          )}
                          {citizenData.soyad && (
                            <div>
                              <span className="text-gray-400">Soyad:</span> <span className="text-white ml-2">{citizenData.soyad}</span>
                            </div>
                          )}
                          {citizenData.dogumTarihi && (
                            <div>
                              <span className="text-gray-400">Doğum Tarihi:</span> <span className="text-white ml-2">{citizenData.dogumTarihi}</span>
                            </div>
                          )}
                          {citizenData.dogumYeri && (
                            <div>
                              <span className="text-gray-400">Doğum Yeri:</span> <span className="text-white ml-2">{citizenData.dogumYeri}</span>
                            </div>
                          )}
                          {citizenData.cinsiyet && (
                            <div>
                              <span className="text-gray-400">Cinsiyet:</span> <span className="text-white ml-2">{citizenData.cinsiyet}</span>
                            </div>
                          )}
                          {citizenData.medeniHal && (
                            <div>
                              <span className="text-gray-400">Medeni Hal:</span> <span className="text-white ml-2">{citizenData.medeniHal}</span>
                            </div>
                          )}
                          {citizenData.adresIl && (
                            <div>
                              <span className="text-gray-400">Adres İl:</span> <span className="text-white ml-2">{citizenData.adresIl}</span>
                            </div>
                          )}
                          {citizenData.adresIlce && (
                            <div>
                              <span className="text-gray-400">Adres İlçe:</span> <span className="text-white ml-2">{citizenData.adresIlce}</span>
                            </div>
                          )}
                          {citizenData.ikametgah && (
                            <div className="md:col-span-2">
                              <span className="text-gray-400">İkametgah:</span> <span className="text-white ml-2">{citizenData.ikametgah}</span>
                            </div>
                          )}
                          {citizenData.vergiNumarasi && (
                            <div>
                              <span className="text-gray-400">Vergi Numarası:</span> <span className="text-white ml-2">{citizenData.vergiNumarasi}</span>
                            </div>
                          )}
                          {citizenData.aileSiraNo && (
                            <div>
                              <span className="text-gray-400">Aile Sıra No:</span> <span className="text-white ml-2">{citizenData.aileSiraNo}</span>
                            </div>
                          )}
                          {citizenData.bireySiraNo && (
                            <div>
                              <span className="text-gray-400">Birey Sıra No:</span> <span className="text-white ml-2">{citizenData.bireySiraNo}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Aile Bilgileri */}
                      {(citizenData.anneAdi || citizenData.babaAdi || (citizenData.kardesler && citizenData.kardesler.length > 0)) && (
                        <div className="bg-background-tertiary rounded-lg p-4">
                          <h4 className="text-md font-semibold text-white mb-3">Aile Bilgileri</h4>
                          <div className="space-y-3 mb-4">
                            {/* Anne Bilgileri */}
                            {citizenData.anneAdi && (
                              <div className="border border-gray-700 rounded p-3 bg-background-secondary">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-gray-400 text-sm">Anne:</span>
                                    <span className="text-white ml-2 font-medium">{citizenData.anneAdi}</span>
                                  </div>
                                  {citizenData.anneTc && (
                                    <span className="text-gray-400 text-xs">TC: {citizenData.anneTc}</span>
                                  )}
                                </div>
                                {citizenData.anneGsmNumaralari && citizenData.anneGsmNumaralari.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {citizenData.anneGsmNumaralari.map((gsm: any, gsmIdx: number) => (
                                      <span key={gsmIdx} className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-xs">
                                        {gsm.gsm}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Baba Bilgileri */}
                            {citizenData.babaAdi && (
                              <div className="border border-gray-700 rounded p-3 bg-background-secondary">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-gray-400 text-sm">Baba:</span>
                                    <span className="text-white ml-2 font-medium">{citizenData.babaAdi}</span>
                                  </div>
                                  {citizenData.babaTc && (
                                    <span className="text-gray-400 text-xs">TC: {citizenData.babaTc}</span>
                                  )}
                                </div>
                                {citizenData.babaGsmNumaralari && citizenData.babaGsmNumaralari.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {citizenData.babaGsmNumaralari.map((gsm: any, gsmIdx: number) => (
                                      <span key={gsmIdx} className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-xs">
                                        {gsm.gsm}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Kardeşler */}
                          {citizenData.kardesler && citizenData.kardesler.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-300 mb-2">Kardeşler</h5>
                              <div className="space-y-2">
                                {citizenData.kardesler.map((kardes: any, idx: number) => (
                                  <div key={idx} className="border border-gray-700 rounded p-3 text-sm bg-background-secondary">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <span className="text-white font-medium">{kardes.ad} {kardes.soyad}</span>
                                        {kardes.iliski && <span className="text-gray-400 ml-2 text-xs">({kardes.iliski})</span>}
                                      </div>
                                      {kardes.tckn && <span className="text-gray-400 text-xs">TC: {kardes.tckn}</span>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                      {kardes.dogumTarihi && (
                                        <div>Doğum: {kardes.dogumTarihi}</div>
                                      )}
                                      {kardes.cinsiyet && (
                                        <div>Cinsiyet: {kardes.cinsiyet}</div>
                                      )}
                                    </div>
                                    {kardes.gsmNumaralari && kardes.gsmNumaralari.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {kardes.gsmNumaralari.map((gsm: any, gsmIdx: number) => (
                                          <span key={gsmIdx} className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-xs">
                                            {gsm.gsm}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* GSM Numaraları */}
                      {citizenData.gsmNumaralari && citizenData.gsmNumaralari.length > 0 && (
                        <div className="bg-background-tertiary rounded-lg p-4">
                          <h4 className="text-md font-semibold text-white mb-3">GSM Numaraları</h4>
                          <div className="flex flex-wrap gap-2">
                            {citizenData.gsmNumaralari.map((gsm: any, idx: number) => (
                              <span key={idx} className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-sm">
                                {gsm.gsm}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Güncel Adresler */}
                      {citizenData.guncelAdresler && (
                        <div className="bg-background-tertiary rounded-lg p-4">
                          <h4 className="text-md font-semibold text-white mb-3">Güncel Adresler</h4>
                          <div className="space-y-2 text-sm">
                            {citizenData.guncelAdresler.adres2024 && (
                              <div>
                                <span className="text-gray-400">2024:</span> <span className="text-white ml-2">{citizenData.guncelAdresler.adres2024}</span>
                              </div>
                            )}
                            {citizenData.guncelAdresler.adres2023 && (
                              <div>
                                <span className="text-gray-400">2023:</span> <span className="text-white ml-2">{citizenData.guncelAdresler.adres2023}</span>
                              </div>
                            )}
                            {citizenData.guncelAdresler.adres2017 && (
                              <div>
                                <span className="text-gray-400">2017:</span> <span className="text-white ml-2">{citizenData.guncelAdresler.adres2017}</span>
                              </div>
                            )}
                            {citizenData.guncelAdresler.adres2015 && (
                              <div>
                                <span className="text-gray-400">2015:</span> <span className="text-white ml-2">{citizenData.guncelAdresler.adres2015}</span>
                              </div>
                            )}
                            {citizenData.guncelAdresler.adres2009 && (
                              <div>
                                <span className="text-gray-400">2009:</span> <span className="text-white ml-2">{citizenData.guncelAdresler.adres2009}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Tapu Bilgileri */}
                      {citizenData.tapuBilgileri && citizenData.tapuBilgileri.length > 0 && (
                        <div className="bg-background-tertiary rounded-lg p-4">
                          <h4 className="text-md font-semibold text-white mb-3">Tapu Bilgileri</h4>
                          <div className="space-y-3">
                            {citizenData.tapuBilgileri.map((tapu: any, idx: number) => (
                              <div key={idx} className="border border-gray-700 rounded p-3 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  {tapu.il && <div><span className="text-gray-400">İl:</span> <span className="text-white ml-2">{tapu.il}</span></div>}
                                  {tapu.ilce && <div><span className="text-gray-400">İlçe:</span> <span className="text-white ml-2">{tapu.ilce}</span></div>}
                                  {tapu.mahalle && <div><span className="text-gray-400">Mahalle:</span> <span className="text-white ml-2">{tapu.mahalle}</span></div>}
                                  {tapu.ada && <div><span className="text-gray-400">Ada:</span> <span className="text-white ml-2">{tapu.ada}</span></div>}
                                  {tapu.parsel && <div><span className="text-gray-400">Parsel:</span> <span className="text-white ml-2">{tapu.parsel}</span></div>}
                                  {tapu.nitelik && <div><span className="text-gray-400">Nitelik:</span> <span className="text-white ml-2">{tapu.nitelik}</span></div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}


                      {/* Aynı Adreste Yaşayanlar */}
                      {citizenData.ayniAdrestekiler && citizenData.ayniAdrestekiler.length > 0 && (
                        <div className="bg-background-tertiary rounded-lg p-4">
                          <h4 className="text-md font-semibold text-white mb-3">Aynı Adreste Yaşayanlar</h4>
                          <div className="space-y-2">
                            {citizenData.ayniAdrestekiler.map((kisi: any, idx: number) => (
                              <div key={idx} className="border border-gray-700 rounded p-3 text-sm bg-background-secondary">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="text-white font-medium">{kisi.ad} {kisi.soyad}</span>
                                    {kisi.iliski && <span className="text-gray-400 ml-2 text-xs">({kisi.iliski})</span>}
                                  </div>
                                  {kisi.tckn && <span className="text-gray-400 text-xs">TC: {kisi.tckn}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                  {kisi.dogumTarihi && (
                                    <div>Doğum: {kisi.dogumTarihi}</div>
                                  )}
                                  {kisi.cinsiyet && (
                                    <div>Cinsiyet: {kisi.cinsiyet}</div>
                                  )}
                                </div>
                                {kisi.gsmNumaralari && kisi.gsmNumaralari.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {kisi.gsmNumaralari.map((gsm: any, gsmIdx: number) => (
                                      <span key={gsmIdx} className="px-2 py-1 bg-primary/20 text-primary border border-primary/30 rounded text-xs">
                                        {gsm.gsm}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      Vatandaş bilgileri bulunamadı veya TCKN eksik.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

