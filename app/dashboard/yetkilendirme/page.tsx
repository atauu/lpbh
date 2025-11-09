'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';

interface RoleGroup {
  id: string;
  name: string;
  description: string | null;
  order: number;
  roles?: any[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  groupId: string | null;
  group?: RoleGroup | null;
  permissions: {
    users?: { create: boolean; read: boolean | { enabled: boolean; readableFields: string[] }; update: boolean; delete: boolean };
    userApproval?: { approve: boolean; reject: boolean };
    meetings?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    events?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    assignments?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    routes?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    roles?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    announcements?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    activityLogs?: { read: boolean };
    researches?: { create: boolean; read: boolean; update: boolean; delete: boolean };
    messages?: { create: boolean; read: boolean; update: boolean; delete: boolean };
  };
  createdAt: string;
  updatedAt: string;
}

interface FormPermissions {
  users: { create: boolean; update: boolean; delete: boolean };
  userApproval: { approve: boolean; reject: boolean };
  meetings: { create: boolean; read: boolean; update: boolean; delete: boolean };
  events: { create: boolean; read: boolean; update: boolean; delete: boolean };
  assignments: { create: boolean; read: boolean; update: boolean; delete: boolean };
  routes: { create: boolean; read: boolean; update: boolean; delete: boolean };
  roles: { create: boolean; read: boolean; update: boolean; delete: boolean };
  announcements: { create: boolean; read: boolean; update: boolean; delete: boolean };
  activityLogs: { read: boolean };
  researches: { create: boolean; read: boolean; update: boolean; delete: boolean };
  messages: { create: boolean; read: boolean; update: boolean; delete: boolean };
}

interface User {
  id: string;
  username: string;
  isSystemAdmin: boolean;
  role?: {
    id: string;
    name: string;
  } | null;
}

export default function YetkilendirmePage() {
  const { data: session, status } = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  
  // Sistem görevlisi için state
  const [users, setUsers] = useState<User[]>([]);
  const [selectedSystemAdminId, setSelectedSystemAdminId] = useState<string>('');
  const [isSystemAdminActive, setIsSystemAdminActive] = useState<boolean>(false);
  const [isAssigningSystemAdmin, setIsAssigningSystemAdmin] = useState(false);
  const [showSystemAdminDropdown, setShowSystemAdminDropdown] = useState(false);

  // Üye alanları
  const userFields = [
    { key: 'username', label: 'Kullanıcı Adı' },
    { key: 'rutbe', label: 'Rütbe' },
    { key: 'isim', label: 'İsim' },
    { key: 'soyisim', label: 'Soyisim' },
    { key: 'tckn', label: 'TCKN' },
    { key: 'telefon', label: 'Telefon Numarası' },
    { key: 'evAdresi', label: 'Ev Adresi' },
    { key: 'yakiniIsmi', label: 'Yakını İsmi' },
    { key: 'yakiniTelefon', label: 'Yakını Telefon Numarası' },
    { key: 'ruhsatSeriNo', label: 'Ruhsat Seri No' },
    { key: 'kanGrubu', label: 'Kan Grubu' },
  ];

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    groupId: '' as string | '',
    permissions: {
      users: { create: false, update: false, delete: false }, // read kaldırıldı
      userApproval: { approve: false, reject: false },
      meetings: { create: false, read: false, update: false, delete: false },
      events: { create: false, read: false, update: false, delete: false },
      assignments: { create: false, read: false, update: false, delete: false },
      routes: { create: false, read: false, update: false, delete: false },
      roles: { create: false, read: false, update: false, delete: false },
      announcements: { create: false, read: false, update: false, delete: false },
      activityLogs: { read: false },
      researches: { create: false, read: false, update: false, delete: false },
      messages: { create: false, read: false, update: false, delete: false },
    },
    // Üyeler için okunabilir alanlar
    usersReadableFields: [] as string[],
  });

  const [showUsersFieldsDropdown, setShowUsersFieldsDropdown] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchRoles();
      fetchUsers();
    }
  }, [session, status]);

  // Dropdown'u dışarı tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-fields-dropdown-container')) {
        setShowUsersFieldsDropdown(false);
      }
    };

    if (showUsersFieldsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUsersFieldsDropdown]);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, groupsRes] = await Promise.all([
        fetch('/api/roles', { credentials: 'include' }),
        fetch('/api/role-groups', { credentials: 'include' }),
      ]);
      
      if (!rolesRes.ok) {
        throw new Error('Rütbeler yüklenemedi');
      }
      if (!groupsRes.ok) {
        throw new Error('Rütbe grupları yüklenemedi');
      }
      
      const rolesData = await rolesRes.json();
      const groupsData = await groupsRes.json();
      
      setRoles(rolesData);
      setRoleGroups(groupsData);
      
      // Eğer grup yoksa initialize et
      if (groupsData.length === 0) {
        const initRes = await fetch('/api/role-groups/initialize', {
          method: 'POST',
          credentials: 'include',
        });
        if (initRes.ok) {
          const initData = await initRes.json();
          setRoleGroups(initData.groups || groupsData);
          // Rütbeleri tekrar yükle
          const rolesRes2 = await fetch('/api/roles', { credentials: 'include' });
          if (rolesRes2.ok) {
            const rolesData2 = await rolesRes2.json();
            setRoles(rolesData2);
          }
        }
      }
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users/system-admin', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        
        // Aktif sistem görevlisi varsa seçili yap
        const activeSystemAdmin = data.find((u: User) => u.isSystemAdmin);
        if (activeSystemAdmin) {
          setSelectedSystemAdminId(activeSystemAdmin.id);
          setIsSystemAdminActive(true);
        }
      }
    } catch (error: any) {
      console.error('Users fetch error:', error);
    }
  };

  const handleAssignSystemAdmin = async () => {
    if (!selectedSystemAdminId) {
      setError('Lütfen bir kullanıcı seçin');
      return;
    }

    setIsAssigningSystemAdmin(true);
    setError('');

    try {
      const res = await fetch('/api/users/system-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedSystemAdminId,
          isSystemAdmin: isSystemAdminActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sistem görevlisi atanamadı');
      }

      const result = await res.json();
      
      // Kullanıcıları yeniden yükle
      await fetchUsers();
      
      // Başarı mesajı göster
      setError('');
      alert(result.message || 'İşlem başarılı');
      
      // Dropdown'u kapat
      setShowSystemAdminDropdown(false);
    } catch (error: any) {
      setError(error.message || 'Sistem görevlisi atanamadı');
    } finally {
      setIsAssigningSystemAdmin(false);
    }
  };

  const handleAddRole = () => {
    setFormData({
      name: '',
      description: '',
      groupId: '',
      permissions: {
        users: { create: false, update: false, delete: false },
        userApproval: { approve: false, reject: false },
        meetings: { create: false, read: false, update: false, delete: false },
        events: { create: false, read: false, update: false, delete: false },
        assignments: { create: false, read: false, update: false, delete: false },
        routes: { create: false, read: false, update: false, delete: false },
        roles: { create: false, read: false, update: false, delete: false },
        announcements: { create: false, read: false, update: false, delete: false },
        activityLogs: { read: false },
        researches: { create: false, read: false, update: false, delete: false },
        messages: { create: false, read: false, update: false, delete: false },
      },
      usersReadableFields: [],
    });
    setShowUsersFieldsDropdown(false);
    setShowAddModal(true);
    setError('');
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    // Eğer permissions.users.read bir obje ise (readableFields içeriyorsa)
    const usersPermissions = (role.permissions as any).users || {};
    let readableFields: string[] = [];
    
    if (typeof usersPermissions.read === 'object' && usersPermissions.read?.readableFields) {
      readableFields = usersPermissions.read.readableFields;
    } else if (usersPermissions.read === true) {
      // Eski format (boolean), tüm alanları seç
      readableFields = userFields.map(f => f.key);
    }
    
    // permissions objesini güncelle - users.read'ı kaldır (artık sadece readableFields kontrol edilecek)
    const updatedPermissions: FormPermissions = {
      users: {
        create: usersPermissions.create || false,
        update: usersPermissions.update || false,
        delete: usersPermissions.delete || false,
      },
      userApproval: (role.permissions as any).userApproval || { approve: false, reject: false },
      meetings: role.permissions.meetings || { create: false, read: false, update: false, delete: false },
      events: role.permissions.events || { create: false, read: false, update: false, delete: false },
      assignments: role.permissions.assignments || { create: false, read: false, update: false, delete: false },
      routes: role.permissions.routes || { create: false, read: false, update: false, delete: false },
      roles: role.permissions.roles || { create: false, read: false, update: false, delete: false },
      announcements: role.permissions.announcements || { create: false, read: false, update: false, delete: false },
      activityLogs: (role.permissions as any).activityLogs || { read: false },
      researches: (role.permissions as any).researches || { create: false, read: false, update: false, delete: false },
      messages: (role.permissions as any).messages || { create: false, read: false, update: false, delete: false },
    };
    
    setFormData({
      name: role.name,
      description: role.description || '',
      groupId: role.groupId || '',
      permissions: updatedPermissions,
      usersReadableFields: readableFields,
    });
    setShowUsersFieldsDropdown(false);
    setShowEditModal(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      // Permissions objesini hazırla - users.read'ı readableFields'e göre belirle
      const permissionsToSend = {
        ...formData.permissions,
        users: {
          ...formData.permissions.users,
          read: formData.usersReadableFields.length > 0
            ? {
                enabled: true,
                readableFields: formData.usersReadableFields,
              }
            : false,
        },
      };

      const payload = {
        name: formData.name,
        description: formData.description,
        groupId: formData.groupId || null,
        permissions: permissionsToSend,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rütbe kaydedilemedi');
      }

      // Form'u sıfırla ve modal'ı kapat
      setFormData({
        name: '',
        description: '',
        groupId: '',
        permissions: {
          users: { create: false, update: false, delete: false },
          userApproval: { approve: false, reject: false },
          meetings: { create: false, read: false, update: false, delete: false },
          events: { create: false, read: false, update: false, delete: false },
          assignments: { create: false, read: false, update: false, delete: false },
          routes: { create: false, read: false, update: false, delete: false },
          roles: { create: false, read: false, update: false, delete: false },
          announcements: { create: false, read: false, update: false, delete: false },
          activityLogs: { read: false },
          researches: { create: false, read: false, update: false, delete: false },
          messages: { create: false, read: false, update: false, delete: false },
        },
        usersReadableFields: [],
      });
      setShowUsersFieldsDropdown(false);
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingRole(null);
      
      // Rütbeleri yeniden yükle
      await fetchRoles();
    } catch (error: any) {
      setError(error.message || 'Rütbe kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`"${roleName}" rütbesini silmek istediğinize emin misiniz?`)) {
      return;
    }

    setDeletingRoleId(roleId);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Rütbe silinemedi');
      }

      await fetchRoles();
    } catch (error: any) {
      setError(error.message || 'Rütbe silinemedi');
    } finally {
      setDeletingRoleId(null);
    }
  };

  const handlePermissionChange = (
    resource: string,
    action: string,
    value: boolean
  ) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [resource]: {
          ...(formData.permissions as any)[resource],
          [action]: value,
        },
      },
    });
  };

  const handleUserFieldToggle = (fieldKey: string) => {
    setFormData({
      ...formData,
      usersReadableFields: formData.usersReadableFields.includes(fieldKey)
        ? formData.usersReadableFields.filter(f => f !== fieldKey)
        : [...formData.usersReadableFields, fieldKey],
    });
  };

  const handleSelectAllUserFields = () => {
    setFormData({
      ...formData,
      usersReadableFields: userFields.map(f => f.key),
    });
  };

  const handleDeselectAllUserFields = () => {
    setFormData({
      ...formData,
      usersReadableFields: [],
    });
  };

  const handleSelectAll = (resource: string) => {
    if (resource === 'users') {
      // Users için özel: tüm alanları seç
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          users: {
            create: true,
            update: true,
            delete: true,
          },
        },
        usersReadableFields: userFields.map(f => f.key),
      });
    } else if (resource === 'userApproval') {
      // userApproval için özel: approve ve reject
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          userApproval: {
            approve: true,
            reject: true,
          },
        },
      });
    } else if (resource === 'activityLogs') {
      // activityLogs için özel: sadece read
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          activityLogs: {
            read: true,
          },
        },
      });
    } else if (resource === 'researches') {
      // researches için normal CRUD
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          researches: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
        },
      });
    } else if (resource === 'messages') {
      // messages için normal CRUD
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          messages: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
        },
      });
    } else {
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [resource]: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
        },
      });
    }
  };

  const handleDeselectAll = (resource: string) => {
    if (resource === 'users') {
      // Users için özel: tüm alanları temizle
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          users: {
            create: false,
            update: false,
            delete: false,
          },
        },
        usersReadableFields: [],
      });
    } else if (resource === 'userApproval') {
      // userApproval için özel: approve ve reject
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          userApproval: {
            approve: false,
            reject: false,
          },
        },
      });
    } else if (resource === 'activityLogs') {
      // activityLogs için özel: sadece read
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          activityLogs: {
            read: false,
          },
        },
      });
    } else if (resource === 'researches') {
      // researches için normal CRUD
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          researches: {
            create: false,
            read: false,
            update: false,
            delete: false,
          },
        },
      });
    } else if (resource === 'messages') {
      // messages için normal CRUD
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          messages: {
            create: false,
            read: false,
            update: false,
            delete: false,
          },
        },
      });
    } else {
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [resource]: {
            create: false,
            read: false,
            update: false,
            delete: false,
          },
        },
      });
    }
  };

  const resourceLabels: Record<string, string> = {
    users: 'Üyeler',
    userApproval: 'Üye Onayı',
    meetings: 'Toplantı Kayıtları',
    events: 'Etkinlikler',
    assignments: 'Görevlendirmeler',
    routes: 'Rotalar',
    roles: 'Yetkilendirme',
    announcements: 'Duyurular',
    activityLogs: 'İşlem Kayıtları',
    researches: 'Araştırmalar',
    messages: 'Sohbet',
  };

  const actionLabels: Record<string, string> = {
    create: 'Oluştur',
    read: 'Görüntüle',
    update: 'Düzenle',
    delete: 'Sil',
    approve: 'Onayla',
    reject: 'Reddet',
  };

  // Bir rütbenin tüm yetkilere sahip olup olmadığını kontrol et
  const hasAllPermissions = (role: Role): boolean => {
    const permissions = role.permissions;
    const resources = Object.keys(permissions);
    
    for (const resource of resources) {
      const perms = (permissions as any)[resource];
      
      // users için özel kontrol (read obje olabilir)
      if (resource === 'users') {
        if (!perms || !perms.create || !perms.update || !perms.delete) {
          return false;
        }
        // read kontrolü: obje ise enabled kontrolü, boolean ise direkt kontrol
        const readValue = typeof perms.read === 'object' ? perms.read.enabled : perms.read;
        if (!readValue) {
          return false;
        }
      } else if (resource === 'userApproval') {
        // userApproval için özel kontrol (approve ve reject)
        if (!perms || !perms.approve || !perms.reject) {
          return false;
        }
      } else if (resource === 'activityLogs') {
        // activityLogs için özel kontrol (sadece read)
        if (!perms || !perms.read) {
          return false;
        }
      } else if (resource === 'researches') {
        // researches için normal kontrol
        if (!perms || !perms.create || !perms.read || !perms.update || !perms.delete) {
          return false;
        }
      } else if (resource === 'messages') {
        // messages için normal kontrol
        if (!perms || !perms.create || !perms.read || !perms.update || !perms.delete) {
          return false;
        }
      } else {
        // Diğer kaynaklar için normal kontrol
        if (!perms || !perms.create || !perms.read || !perms.update || !perms.delete) {
          return false;
        }
      }
    }
    
    return true;
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
  const canCreate = hasPermission(userPermissions, 'roles', 'create');
  const canUpdate = hasPermission(userPermissions, 'roles', 'update');
  const canDelete = hasPermission(userPermissions, 'roles', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Yetkilendirme</h1>
        {canCreate && (
          <button
            onClick={handleAddRole}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          >
            Rütbe Ekle
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Sistem Görevlisi Seçimi */}
      <div className="bg-background-secondary rounded-md border border-gray-700 p-6 backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white mb-4">Sistem Görevlisi Seç</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-300 min-w-[200px]">
              Üye Seç:
            </label>
            <div className="flex-1 relative system-admin-dropdown-container">
              <button
                type="button"
                onClick={() => setShowSystemAdminDropdown(!showSystemAdminDropdown)}
                disabled={users.length === 0}
                className="w-full text-left px-3 py-2 text-sm bg-background-tertiary border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 transition-all flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>
                  {selectedSystemAdminId
                    ? users.find(u => u.id === selectedSystemAdminId)?.username || 'Üye seçin...'
                    : 'Üye seçin...'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showSystemAdminDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSystemAdminDropdown && users.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-background border border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto backdrop-blur-sm">
                  <div className="p-2 space-y-1">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedSystemAdminId(user.id);
                          setIsSystemAdminActive(user.isSystemAdmin);
                          setShowSystemAdminDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-background-tertiary transition-all ${
                          selectedSystemAdminId === user.id
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{user.username}</span>
                          {user.isSystemAdmin && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded font-medium">
                              ✓ Aktif
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedSystemAdminId && (
            <div className="flex items-center gap-4 p-4 bg-background-tertiary rounded-md border border-gray-700">
              <label className="text-sm font-medium text-gray-300 min-w-[200px]">
                Sistem Görevlisi:
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isSystemAdminActive}
                    onChange={(e) => setIsSystemAdminActive(e.target.checked)}
                    className="w-6 h-6 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2 cursor-pointer transition-all"
                  />
                  {isSystemAdminActive && (
                    <svg
                      className="absolute top-1 left-1 w-4 h-4 text-primary pointer-events-none"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-medium transition-all ${
                  isSystemAdminActive ? 'text-primary' : 'text-gray-400'
                }`}>
                  {isSystemAdminActive ? '✓ Aktif (Sistem Görevlisi)' : 'Pasif'}
                </span>
              </label>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleAssignSystemAdmin}
              disabled={isAssigningSystemAdmin || !selectedSystemAdminId}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 font-medium"
            >
              {isAssigningSystemAdmin ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Atanıyor...
                </span>
              ) : (
                'Sistem Yetkilisini Ata'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Rütbeler Listesi - Gruplara göre */}
      {roleGroups.length === 0 && roles.length === 0 ? (
        <div className="bg-background-secondary rounded-md border border-gray-700 p-8 text-center backdrop-blur-sm">
          <div className="text-gray-400">Henüz rütbe eklenmemiş</div>
        </div>
      ) : (
        <div className="space-y-6">
          {roleGroups
            .sort((a, b) => b.order - a.order) // Yüksek order önce (Yönetim -> Member -> Aday)
            .map((group) => {
              const groupRoles = roles.filter((role) => role.groupId === group.id);
              if (groupRoles.length === 0) return null;
              
              return (
                <div key={group.id} className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
                  <div className="p-4 border-b border-gray-700 bg-background-tertiary">
                    <h2 className="text-xl font-semibold text-white">{group.name}</h2>
                    {group.description && (
                      <p className="text-sm text-gray-400 mt-1">{group.description}</p>
                    )}
                  </div>
                  <div className="divide-y divide-gray-700">
                    {groupRoles.map((role) => (
                      <div
                        key={role.id}
                        className="p-6 hover:bg-background-tertiary transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-2">
                              {role.name}
                            </h3>
                            {role.description && (
                              <p className="text-sm text-gray-400 mb-4">
                                {role.description}
                              </p>
                            )}
                            <div className="text-sm text-gray-400">
                              <p className="mb-2">Yetkiler:</p>
                              {hasAllPermissions(role) ? (
                                <div className="bg-primary/20 border border-primary/50 rounded-md p-4">
                                  <p className="text-primary font-semibold text-base">
                                    Tam Yetkilendirme
                                  </p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {Object.entries(role.permissions).map(([resource, perms]: [string, any]) => {
                                    let resourceHasAll: boolean;
                                    if (resource === 'users') {
                                      const readValue = typeof perms.read === 'object' ? perms.read.enabled : perms.read;
                                      resourceHasAll = perms.create && readValue && perms.update && perms.delete;
                                    } else if (resource === 'userApproval') {
                                      resourceHasAll = perms.approve && perms.reject;
                                    } else {
                                      resourceHasAll = perms.create && perms.read && perms.update && perms.delete;
                                    }
                                    return (
                                      <div key={resource} className="bg-background rounded-md p-3 border border-gray-700">
                                        <p className="text-white font-medium mb-2">
                                          {resourceLabels[resource] || resource}
                                        </p>
                                        {resourceHasAll ? (
                                          <div className="bg-primary/20 border border-primary/30 rounded-md p-2">
                                            <p className="text-primary text-xs font-medium">Tam Yetki</p>
                                          </div>
                                        ) : (
                                          <div className="space-y-1">
                                            {Object.entries(perms).map(([action, value]: [string, any]) => {
                                              if (resource === 'users' && action === 'read') {
                                                const readValue = typeof value === 'object' ? value.enabled : value;
                                                const fieldCount = typeof value === 'object' && value.readableFields ? value.readableFields.length : 0;
                                                return (
                                                  <div key={action} className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${readValue ? 'bg-primary' : 'bg-gray-600'}`}></span>
                                                    <span className="text-xs text-gray-400">
                                                      {actionLabels[action] || action}: {readValue ? (fieldCount > 0 ? `${fieldCount} alan` : 'Var') : 'Yok'}
                                                    </span>
                                                  </div>
                                                );
                                              }
                                              return (
                                                <div key={action} className="flex items-center gap-2">
                                                  <span className={`w-2 h-2 rounded-full ${value ? 'bg-primary' : 'bg-gray-600'}`}></span>
                                                  <span className="text-xs text-gray-400">
                                                    {actionLabels[action] || action}: {value ? 'Var' : 'Yok'}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            {canUpdate && (
                              <button
                                onClick={() => handleEditRole(role)}
                                className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                                title="Düzenle"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteRole(role.id, role.name)}
                                disabled={deletingRoleId === role.id}
                                className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                                title="Sil"
                              >
                                {deletingRoleId === role.id ? (
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
                </div>
              );
            })}
          
          {/* Grupsuz rütbeler */}
          {roles.filter(r => !r.groupId).length > 0 && (
            <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-gray-700 bg-background-tertiary">
                <h2 className="text-xl font-semibold text-white">Grup Atanmamış</h2>
              </div>
              <div className="divide-y divide-gray-700">
                {roles.filter(r => !r.groupId).map((role) => (
                  <div
                    key={role.id}
                    className="p-6 hover:bg-background-tertiary transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {role.name}
                        </h3>
                        {role.description && (
                          <p className="text-sm text-gray-400 mb-4">
                            {role.description}
                          </p>
                        )}
                        <div className="text-sm text-gray-400">
                          <p className="mb-2">Yetkiler:</p>
                          {hasAllPermissions(role) ? (
                            <div className="bg-primary/20 border border-primary/50 rounded-md p-4">
                              <p className="text-primary font-semibold text-base">
                                Tam Yetkilendirme
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {Object.entries(role.permissions).map(([resource, perms]: [string, any]) => {
                                const resourceHasAll = perms.create && perms.read && perms.update && perms.delete;
                                return (
                                  <div key={resource} className="bg-background rounded-md p-3 border border-gray-700">
                                    <p className="text-white font-medium mb-2">
                                      {resourceLabels[resource] || resource}
                                    </p>
                                    {resourceHasAll ? (
                                      <div className="bg-primary/20 border border-primary/30 rounded-md p-2">
                                        <p className="text-primary text-xs font-medium">Tam Yetki</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        {Object.entries(perms).map(([action, value]: [string, any]) => (
                                          <div key={action} className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${value ? 'bg-primary' : 'bg-gray-600'}`}></span>
                                            <span className="text-xs text-gray-400">
                                              {actionLabels[action] || action}: {value ? 'Var' : 'Yok'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEditRole(role)}
                          className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                          title="Düzenle"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteRole(role.id, role.name)}
                          disabled={deletingRoleId === role.id}
                          className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                          title="Sil"
                        >
                          {deletingRoleId === role.id ? (
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rütbe Ekle/Düzenle Modal */}
      {(showAddModal || showEditModal) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingRole(null);
            setError('');
            setFormData({
              name: '',
              description: '',
              groupId: '',
              permissions: {
                users: { create: false, update: false, delete: false },
                userApproval: { approve: false, reject: false },
                meetings: { create: false, read: false, update: false, delete: false },
                events: { create: false, read: false, update: false, delete: false },
                assignments: { create: false, read: false, update: false, delete: false },
                routes: { create: false, read: false, update: false, delete: false },
                roles: { create: false, read: false, update: false, delete: false },
                announcements: { create: false, read: false, update: false, delete: false },
                activityLogs: { read: false },
                researches: { create: false, read: false, update: false, delete: false },
                messages: { create: false, read: false, update: false, delete: false },
              },
              usersReadableFields: [],
            });
            setShowUsersFieldsDropdown(false);
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {editingRole ? 'Rütbe Düzenle' : 'Yeni Rütbe Ekle'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingRole(null);
                    setError('');
                    setFormData({
                      name: '',
                      description: '',
                      groupId: '',
                      permissions: {
                        users: { create: false, update: false, delete: false },
                        userApproval: { approve: false, reject: false },
                        meetings: { create: false, read: false, update: false, delete: false },
                        events: { create: false, read: false, update: false, delete: false },
                        assignments: { create: false, read: false, update: false, delete: false },
                        routes: { create: false, read: false, update: false, delete: false },
                        roles: { create: false, read: false, update: false, delete: false },
                        announcements: { create: false, read: false, update: false, delete: false },
                        activityLogs: { read: false },
                        researches: { create: false, read: false, update: false, delete: false },
                        messages: { create: false, read: false, update: false, delete: false },
                      },
                      usersReadableFields: [],
                    });
                    setShowUsersFieldsDropdown(false);
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

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Rütbe Adı <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Örn: PRESIDENT, MEMBER"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Rütbe hakkında açıklama..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Grup
                  </label>
                  <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  >
                    <option value="">Grup seçin...</option>
                    {roleGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-4">
                    Yetkiler
                  </label>
                  <div className="space-y-4">
                    {Object.entries(formData.permissions).map(([resource, perms]: [string, any]) => {
                      const allSelected = Object.values(perms).every(v => v === true);
                      const noneSelected = Object.values(perms).every(v => v === false);
                      
                      return (
                        <div key={resource} className="bg-background rounded-md p-4 border border-gray-700">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-white font-medium">
                              {resourceLabels[resource] || resource}
                            </h3>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectAll(resource)}
                                className="px-3 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded-md hover:bg-primary/30 transition-all"
                              >
                                Tümünü Seç
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeselectAll(resource)}
                                className="px-3 py-1 text-xs bg-background-tertiary text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700 transition-all"
                              >
                                Tümünü Kaldır
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* Üyeler için özel işleme: read checkbox'ı yok, sadece dropdown */}
                            {resource === 'users' ? (
                              <>
                                {Object.entries(perms).map(([action, value]: [string, any]) => (
                                  <label
                                    key={action}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={value}
                                      onChange={(e) =>
                                        handlePermissionChange(resource, action, e.target.checked)
                                      }
                                      className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                                    />
                                    <span className="text-sm text-gray-300">
                                      {actionLabels[action] || action}
                                    </span>
                                  </label>
                                ))}
                                {/* Görüntüle dropdown'u */}
                                <div className="col-span-2 md:col-span-4 space-y-2">
                                  <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Görüntüle
                                  </label>
                                  <div className="relative z-50 user-fields-dropdown-container">
                                    <button
                                      type="button"
                                      onClick={() => setShowUsersFieldsDropdown(!showUsersFieldsDropdown)}
                                      className="w-full text-left px-3 py-2 text-sm bg-background-tertiary border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 transition-all flex items-center justify-between"
                                    >
                                      <span>
                                        {formData.usersReadableFields.length > 0
                                          ? `${formData.usersReadableFields.length} alan seçildi`
                                          : 'Görüntülenebilir alan seçin...'}
                                      </span>
                                      <svg
                                        className={`w-4 h-4 transition-transform ${showUsersFieldsDropdown ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    {showUsersFieldsDropdown && (
                                      <div className="absolute z-[100] mt-1 w-full bg-background border border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto backdrop-blur-sm">
                                        <div className="p-2 border-b border-gray-700 flex gap-2">
                                          <button
                                            type="button"
                                            onClick={handleSelectAllUserFields}
                                            className="px-2 py-1 text-xs bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30 transition-all"
                                          >
                                            Tümünü Seç
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleDeselectAllUserFields}
                                            className="px-2 py-1 text-xs bg-background-tertiary text-gray-300 border border-gray-600 rounded hover:bg-gray-700 transition-all"
                                          >
                                            Tümünü Kaldır
                                          </button>
                                        </div>
                                        <div className="p-2 space-y-1">
                                          {userFields.map((field) => (
                                            <label
                                              key={field.key}
                                              className="flex items-center gap-2 p-2 hover:bg-background-tertiary rounded cursor-pointer"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={formData.usersReadableFields.includes(field.key)}
                                                onChange={() => handleUserFieldToggle(field.key)}
                                                className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                                              />
                                              <span className="text-sm text-gray-300">{field.label}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            ) : (
                              // Diğer kaynaklar için normal checkbox'lar
                              Object.entries(perms).map(([action, value]: [string, any]) => (
                                <label
                                  key={action}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={value}
                                    onChange={(e) =>
                                      handlePermissionChange(resource, action, e.target.checked)
                                    }
                                    className="w-4 h-4 text-primary bg-background border-gray-600 rounded focus:ring-primary focus:ring-2"
                                  />
                                  <span className="text-sm text-gray-300">
                                    {actionLabels[action] || action}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingRole(null);
                      setError('');
                      setFormData({
                        name: '',
                        description: '',
                        groupId: '',
                        permissions: {
                          users: { create: false, update: false, delete: false },
                          userApproval: { approve: false, reject: false },
                          meetings: { create: false, read: false, update: false, delete: false },
                          events: { create: false, read: false, update: false, delete: false },
                          assignments: { create: false, read: false, update: false, delete: false },
                          routes: { create: false, read: false, update: false, delete: false },
                          roles: { create: false, read: false, update: false, delete: false },
                          announcements: { create: false, read: false, update: false, delete: false },
                          activityLogs: { read: false },
                          researches: { create: false, read: false, update: false, delete: false },
                          messages: { create: false, read: false, update: false, delete: false },
                        },
                        usersReadableFields: [],
                      });
                      setShowUsersFieldsDropdown(false);
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
                    {isSubmitting ? 'Kaydediliyor...' : editingRole ? 'Güncelle' : 'Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

