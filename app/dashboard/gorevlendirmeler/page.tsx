'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/auth';
import PDFViewer from '@/components/PDFViewer';
import ReadStatusIndicator from '@/components/ReadStatusIndicator';

interface Assignment {
  id: string;
  assignerId: string;
  assigneeId: string;
  task: string;
  issueDate: string;
  expectedDelivery: string;
  actualDelivery: string | null;
  status: string; // 'pending' | 'completed' | 'cancelled'
  details: string | null;
  files: string[];
  createdAt: string;
  updatedAt: string;
  assigner: {
    id: string;
    username: string;
    rutbe: string | null;
    isim: string | null;
    soyisim: string | null;
  };
  assignee: {
    id: string;
    username: string;
    rutbe: string | null;
    isim: string | null;
    soyisim: string | null;
  };
}

interface User {
  id: string;
  username: string;
  isim: string | null;
  soyisim: string | null;
}

export default function GorevlendirmelerPage() {
  const { data: session, status } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('');
  const [viewingAssignment, setViewingAssignment] = useState<Assignment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; fileName: string; type: 'image' | 'video' | 'other' } | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfTitle, setViewingPdfTitle] = useState<string>('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [readStatuses, setReadStatuses] = useState<Record<string, boolean>>({}); // assignmentId -> isRead

  // Form state
  const [formData, setFormData] = useState({
    assigneeId: '',
    task: '',
    issueDate: '',
    expectedDelivery: '',
    visibility: 'herkes',
    files: [] as File[],
  });

  // View/Edit modal state
  const [viewFormData, setViewFormData] = useState({
    details: '',
    status: '',
    newFiles: [] as File[],
    filesToDelete: [] as string[],
  });

  // Tüm görevlendirmeleri okundu işaretle
  const markAllAsRead = async () => {
    if (!session?.user?.id) return;

    try {
      const res = await fetch('/api/read-status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventType: 'assignment' }),
        credentials: 'include',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('Mark all assignments as read failed:', errorData);
      }
    } catch (error) {
      console.error('Mark all assignments as read error:', error);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      // Sayfa yüklendiğinde tüm görevlendirmeleri okundu işaretle
      markAllAsRead();
      fetchAssignments();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchAssignments = async () => {
    try {
      const url = selectedAssigneeFilter
        ? `/api/assignments?assigneeId=${selectedAssigneeFilter}`
        : '/api/assignments';
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Görevlendirmeler yüklenemedi');
      }
      const data = await res.json();
      setAssignments(data);
      // Okuma durumlarını getir
      if (session?.user?.id) {
        await fetchReadStatuses(data);
      }
    } catch (error: any) {
      setError(error.message || 'Bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  // Okuma durumlarını getir
  const fetchReadStatuses = async (assignmentsList: Assignment[]) => {
    if (!session?.user?.id) return;

    try {
      const statusPromises = assignmentsList.map(async (assignment) => {
        const res = await fetch(`/api/read-status?eventType=assignment&eventId=${assignment.id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const isRead = data.readBy.some((user: any) => user.id === session.user.id);
          return { assignmentId: assignment.id, isRead };
        }
        return { assignmentId: assignment.id, isRead: false };
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, boolean> = {};
      statuses.forEach(({ assignmentId, isRead }) => {
        statusMap[assignmentId] = isRead;
      });
      setReadStatuses(statusMap);
    } catch (error) {
      console.error('Read statuses fetch error:', error);
    }
  };

  // Okundu işaretle
  const markAsRead = async (assignmentId: string) => {
    if (!session?.user?.id) return;

    try {
      await fetch('/api/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: 'assignment',
          eventId: assignmentId,
        }),
        credentials: 'include',
      });

      setReadStatuses((prev) => ({
        ...prev,
        [assignmentId]: true,
      }));
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Üyeler yüklenemedi');
      }
      const data = await res.json();
      setUsers(data);
    } catch (error: any) {
      console.error('Users fetch error:', error);
    }
  };

  useEffect(() => {
    if (selectedAssigneeFilter) {
      fetchAssignments();
    } else {
      fetchAssignments();
    }
  }, [selectedAssigneeFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData({ ...formData, files: [...formData.files, ...files] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('assigneeId', formData.assigneeId);
      formDataToSend.append('task', formData.task);
      formDataToSend.append('issueDate', formData.issueDate);
      formDataToSend.append('expectedDelivery', formData.expectedDelivery);
      formDataToSend.append('visibility', formData.visibility);
      formData.files.forEach((file) => {
        formDataToSend.append('files', file);
      });

      const res = await fetch('/api/assignments', {
        method: 'POST',
        body: formDataToSend,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Görevlendirme oluşturulamadı');
      }

      // Form'u sıfırla ve modal'ı kapat
      setFormData({
        assigneeId: '',
        task: '',
        issueDate: '',
        expectedDelivery: '',
        visibility: 'herkes',
        files: [],
      });
      setShowAddModal(false);
      
      // Görevlendirmeleri yeniden yükle
      await fetchAssignments();
    } catch (error: any) {
      setError(error.message || 'Görevlendirme oluşturulamadı');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewAssignment = async (assignment: Assignment) => {
    // Assignment açıldığında otomatik okundu işaretle
    markAsRead(assignment.id);
    setViewingAssignment(assignment);
    setViewFormData({
      details: assignment.details || '',
      status: assignment.status,
      newFiles: [],
      filesToDelete: [],
    });
    setShowViewModal(true);
  };

  const handleUpdateAssignment = async () => {
    if (!viewingAssignment) return;

    // Status değiştiyse önce onay iste
    if (viewFormData.status !== viewingAssignment.status && (viewFormData.status === 'completed' || viewFormData.status === 'cancelled')) {
      const confirmMessage = viewFormData.status === 'completed'
        ? 'Görevi tamamlandı olarak işaretlemek istediğinize emin misiniz?'
        : 'Görevi iptal edildi olarak işaretlemek istediğinize emin misiniz?';
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    setIsUpdating(true);
    setError('');

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('details', viewFormData.details);
      formDataToSend.append('status', viewFormData.status);
      viewFormData.newFiles.forEach((file) => {
        formDataToSend.append('newFiles', file);
      });
      formDataToSend.append('filesToDelete', JSON.stringify(viewFormData.filesToDelete));

      const res = await fetch(`/api/assignments/${viewingAssignment.id}`, {
        method: 'PUT',
        body: formDataToSend,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Görevlendirme güncellenemedi');
      }

      const updatedAssignment = await res.json();
      
      // Status completed veya cancelled olduysa modal'ı kapat ve dropdown'ı kaldır
      if (updatedAssignment.status === 'completed' || updatedAssignment.status === 'cancelled') {
        setShowViewModal(false);
        setViewingAssignment(null);
      } else {
        // Status değişmediyse modal açık kalabilir ama state'i güncelle
        setViewingAssignment(updatedAssignment);
        setViewFormData({
          ...viewFormData,
          status: updatedAssignment.status,
        });
      }
      
      await fetchAssignments();
    } catch (error: any) {
      setError(error.message || 'Görevlendirme güncellenemedi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Bu görevlendirmeyi silmek istediğinize emin misiniz?')) {
      return;
    }

    setDeletingAssignmentId(assignmentId);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Görevlendirme silinemedi');
      }

      await fetchAssignments();
    } catch (error: any) {
      setError(error.message || 'Görevlendirme silinemedi');
    } finally {
      setDeletingAssignmentId(null);
    }
  };

  // Görev durumunu belirle (otomatik kontrol ile)
  const getAssignmentStatus = (assignment: Assignment): string => {
    // Eğer status zaten completed veya cancelled ise onu döndür
    if (assignment.status === 'completed') {
      return 'completed';
    }
    if (assignment.status === 'cancelled') {
      return 'cancelled';
    }
    
    // Eğer bugün > beklenilen teslim tarihi ve status pending ise cancelled
    const today = new Date();
    const expectedDate = new Date(assignment.expectedDelivery);
    if (today > expectedDate && assignment.status === 'pending') {
      return 'cancelled';
    }
    
    return assignment.status;
  };

  // Görevlendirmeleri mevcut ve geçmiş olarak ayır
  const now = new Date();
  const currentAssignments = assignments.filter((assignment) => {
    const status = getAssignmentStatus(assignment);
    return status === 'pending' || status === 'completed';
  });
  
  const pastAssignments = assignments.filter((assignment) => {
    const status = getAssignmentStatus(assignment);
    return status === 'cancelled';
  });

  // Görev durumu görüntü metni
  const getStatusDisplay = (assignment: Assignment): string => {
    const status = getAssignmentStatus(assignment);
    if (status === 'completed') {
      return 'Tamamlandı';
    }
    if (status === 'cancelled') {
      return 'İptal edildi';
    }
    return 'Beklemede';
  };

  // Görev durumu rengi
  const getStatusColor = (assignment: Assignment): string => {
    const status = getAssignmentStatus(assignment);
    if (status === 'completed') {
      return 'text-primary';
    }
    if (status === 'cancelled') {
      return 'text-red-400';
    }
    return 'text-yellow-400';
  };

  // Tarih formatı
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      dateStyle: 'long',
    });
  };

  // Kullanıcı adını döndür
  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };

  // Görevlendiren bilgisini döndür (rütbe + isim)
  const getAssignerDisplay = (assigner: Assignment['assigner']) => {
    const parts: string[] = [];
    if (assigner.rutbe) {
      parts.push(assigner.rutbe);
    }
    if (assigner.isim || assigner.soyisim) {
      parts.push(`${assigner.isim || ''} ${assigner.soyisim || ''}`.trim());
    }
    return parts.length > 0 ? parts.join(' ') : assigner.username;
  };

  const getFileType = (fileName: string): 'image' | 'video' | 'other' => {
    const extension = fileName.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return 'image';
    }
    if (['mp4', 'webm', 'ogg', 'mov'].includes(extension || '')) {
      return 'video';
    }
    return 'other';
  };

  const handleViewFile = (assignmentId: string, fileIndex: number, fileName: string) => {
    const fileType = getFileType(fileName);
    
    // PDF dosyaları için PDFViewer kullan
    if (fileName.toLowerCase().endsWith('.pdf')) {
      setViewingPdfUrl(`/api/assignments/${assignmentId}/file?index=${fileIndex}`);
      setViewingPdfTitle(fileName);
      setPdfViewerOpen(true);
    } else {
      // Diğer dosyalar için mevcut viewer
      setViewingFile({
        url: `/api/assignments/${assignmentId}/file?index=${fileIndex}`,
        fileName,
        type: fileType,
      });
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
  const canCreate = hasPermission(userPermissions, 'assignments', 'create');
  const canDelete = hasPermission(userPermissions, 'assignments', 'delete');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-3xl font-bold text-white">Görevlendirmeler</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Üye Filtre Dropdown */}
          <div className="flex-shrink-0" style={{ minWidth: '200px' }}>
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
            >
              <option value="">Tüm Üyeler - Tüm Görevler</option>
              <option value={session?.user?.id}>Atanan Görevlerim</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserName(user)}
                </option>
              ))}
            </select>
          </div>
          {canCreate && (
            <Button
              onClick={() => setShowAddModal(true)}
              variant="primary"
              className="px-4 py-2 whitespace-nowrap"
            >
              Görev Ata
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {selectedAssigneeFilter && (
        <div className="bg-primary/20 border border-primary/50 rounded-md p-3 backdrop-blur-sm flex items-center justify-between">
          <p className="text-white text-sm">
            <span className="font-medium">Filtre:</span> {selectedAssigneeFilter === session?.user?.id 
              ? 'Atanan Görevlerim'
              : getUserName(users.find(u => u.id === selectedAssigneeFilter) || { id: '', username: '', isim: null, soyisim: null })
            }
          </p>
          <Button
            onClick={() => setSelectedAssigneeFilter('')}
            variant="primary"
            className="px-4 py-2"
          >
            Filtreyi Temizle
          </Button>
        </div>
      )}

      {/* Mevcut Görevlendirmeler */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Mevcut Görevlendirmeler</h2>
        </div>
        {currentAssignments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz mevcut görevlendirme eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {currentAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-6 hover:bg-background-tertiary transition-all cursor-pointer"
                onClick={() => handleViewAssignment(assignment)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Yeşil nokta - okunmamışsa göster, başlığın önünde */}
                      {!(readStatuses[assignment.id] || false) && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {assignment.task}
                      </h3>
                      <ReadStatusIndicator
                        eventType="assignment"
                        eventId={assignment.id}
                        isRead={readStatuses[assignment.id] || false}
                        onMarkAsRead={() => {
                          setReadStatuses((prev) => ({
                            ...prev,
                            [assignment.id]: true,
                          }));
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Görevlendirilen: {getUserName(assignment.assignee)}
                      </p>
                      <p>
                        Görevlendiren: {getAssignerDisplay(assignment.assigner)}
                      </p>
                      <p>
                        İbraz Tarihi: {formatDate(assignment.issueDate)}
                      </p>
                      <p>
                        Beklenilen Teslim: {formatDate(assignment.expectedDelivery)}
                      </p>
                      <p className={getStatusColor(assignment)}>
                        Durum: {getStatusDisplay(assignment)}
                      </p>
                    </div>
                  </div>
                  {canDelete && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAssignment(assignment.id);
                        }}
                        disabled={deletingAssignmentId === assignment.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingAssignmentId === assignment.id ? (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geçmiş Görevlendirmeler */}
      <div className="bg-background-secondary rounded-md border border-gray-700 overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Geçmiş Görevlendirmeler</h2>
        </div>
        {pastAssignments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Henüz geçmiş görevlendirme eklenmemiş
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {pastAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="p-6 hover:bg-background-tertiary transition-all cursor-pointer"
                onClick={() => handleViewAssignment(assignment)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Yeşil nokta - okunmamışsa göster, başlığın önünde */}
                      {!(readStatuses[assignment.id] || false) && (
                        <div className="w-5 h-5 bg-green-500 rounded-full flex-shrink-0" />
                      )}
                      <h3 className="text-lg font-semibold text-white">
                        {assignment.task}
                      </h3>
                      <ReadStatusIndicator
                        eventType="assignment"
                        eventId={assignment.id}
                        isRead={readStatuses[assignment.id] || false}
                        onMarkAsRead={() => {
                          setReadStatuses((prev) => ({
                            ...prev,
                            [assignment.id]: true,
                          }));
                        }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>
                        Görevlendirilen: {getUserName(assignment.assignee)}
                      </p>
                      <p>
                        Görevlendiren: {getAssignerDisplay(assignment.assigner)}
                      </p>
                      <p>
                        İbraz Tarihi: {formatDate(assignment.issueDate)}
                      </p>
                      <p>
                        Beklenilen Teslim: {formatDate(assignment.expectedDelivery)}
                      </p>
                      <p className={getStatusColor(assignment)}>
                        Durum: {getStatusDisplay(assignment)}
                      </p>
                    </div>
                  </div>
                  {canDelete && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAssignment(assignment.id);
                        }}
                        disabled={deletingAssignmentId === assignment.id}
                        className="p-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all disabled:opacity-50"
                        title="Sil"
                      >
                        {deletingAssignmentId === assignment.id ? (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Görev Ata Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setError('');
            setFormData({
              assigneeId: '',
              task: '',
              issueDate: '',
              expectedDelivery: '',
              visibility: 'herkes',
              files: [],
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
                  Yeni Görevlendirme
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setError('');
                    setFormData({
                      assigneeId: '',
                      task: '',
                      issueDate: '',
                      expectedDelivery: '',
                      visibility: 'herkes',
                      files: [],
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
                    Görevlendirilen <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={formData.assigneeId}
                    onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  >
                    <option value="">Seçiniz</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {getUserName(user)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Görev <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.task}
                    onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    placeholder="Görev açıklamasını girin..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Sorumlu Grup
                  </label>
                  <select
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                  >
                    <option value="herkes">Herkes</option>
                    <option value="member">Member</option>
                    <option value="yönetim">Yönetim</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Herkes seçiliyse tüm üyeler görebilir, Member seçiliyse Member ve Yönetim görebilir, Yönetim seçiliyse sadece Yönetim görebilir. Görevlendirilen kişi her durumda görebilir.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Görev İbraz Tarihi <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.issueDate}
                      onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Beklenilen Teslim Tarihi <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.expectedDelivery}
                      onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dosyalar (Opsiyonel)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                  {formData.files.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.files.map((file, index) => (
                        <p key={index} className="text-xs text-gray-400">
                          • {file.name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError('');
                      setFormData({
                        assigneeId: '',
                        task: '',
                        issueDate: '',
                        expectedDelivery: '',
                        visibility: 'herkes',
                        files: [],
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
                    {isSubmitting ? 'Atanıyor...' : 'Görev Ata'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Görev Detayları Modal */}
      {showViewModal && viewingAssignment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowViewModal(false);
            setViewingAssignment(null);
            setViewFormData({
              details: '',
              status: '',
              newFiles: [],
              filesToDelete: [],
            });
          }}
        >
          <div
            className="bg-background-secondary rounded-md border border-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Görev Detayları
                </h2>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingAssignment(null);
                    setViewFormData({
                      details: '',
                      status: '',
                      newFiles: [],
                      filesToDelete: [],
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

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Görev:</p>
                  <p className="text-white">{viewingAssignment.task}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Görevlendirilen:</p>
                  <p className="text-white">{getUserName(viewingAssignment.assignee)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Görevlendiren:</p>
                  <p className="text-white">{getAssignerDisplay(viewingAssignment.assigner)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1">İbraz Tarihi:</p>
                    <p className="text-white">{formatDate(viewingAssignment.issueDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1">Beklenilen Teslim:</p>
                    <p className="text-white">{formatDate(viewingAssignment.expectedDelivery)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-1">Durum:</p>
                  <p className={getStatusColor(viewingAssignment)}>
                    {getStatusDisplay(viewingAssignment)}
                  </p>
                </div>
              </div>

              {/* Sadece görevlendirilen kişi düzenleyebilir */}
              {viewingAssignment.assigneeId === session?.user?.id && (
                <form onSubmit={(e) => { e.preventDefault(); handleUpdateAssignment(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Görev Detayları
                    </label>
                    <textarea
                      value={viewFormData.details}
                      onChange={(e) => setViewFormData({ ...viewFormData, details: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                      placeholder="Görev hakkında detaylı bilgi ekleyin..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Yeni Dosyalar Ekle
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setViewFormData({ ...viewFormData, newFiles: [...viewFormData.newFiles, ...files] });
                      }}
                      className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                    />
                    {viewFormData.newFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {viewFormData.newFiles.map((file, index) => (
                          <p key={index} className="text-xs text-gray-400">
                            • {file.name}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {viewingAssignment.files.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Mevcut Dosyalar
                      </label>
                      <div className="space-y-2">
                        {viewingAssignment.files.map((filePath, index) => {
                          const fileName = filePath.split('/').pop() || 'Dosya';
                          const isMarkedForDelete = viewFormData.filesToDelete.includes(filePath);
                          const fileType = getFileType(fileName);
                          const canPreview = fileType === 'image' || fileType === 'video';
                          return (
                            <div key={index} className="flex items-center gap-2">
                              {canPreview ? (
                                <button
                                  onClick={() => handleViewFile(viewingAssignment.id, index, fileName)}
                                  className={`flex-1 px-3 py-2 border border-gray-700 text-white bg-background rounded-md hover:bg-background-tertiary transition-all text-sm text-left ${
                                    isMarkedForDelete ? 'line-through opacity-50' : ''
                                  }`}
                                >
                                  {fileName}
                                </button>
                              ) : (
                                <a
                                  href={`/api/assignments/${viewingAssignment.id}/file?index=${index}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex-1 px-3 py-2 border border-gray-700 text-white bg-background rounded-md hover:bg-background-tertiary transition-all text-sm ${
                                    isMarkedForDelete ? 'line-through opacity-50' : ''
                                  }`}
                                >
                                  {fileName}
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isMarkedForDelete) {
                                    setViewFormData({
                                      ...viewFormData,
                                      filesToDelete: viewFormData.filesToDelete.filter(f => f !== filePath),
                                    });
                                  } else {
                                    setViewFormData({
                                      ...viewFormData,
                                      filesToDelete: [...viewFormData.filesToDelete, filePath],
                                    });
                                  }
                                }}
                                className={`px-3 py-2 text-sm rounded-md transition-all ${
                                  isMarkedForDelete
                                    ? 'bg-background-tertiary text-white'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                              >
                                {isMarkedForDelete ? 'Geri Al' : 'Sil'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {getAssignmentStatus(viewingAssignment) === 'pending' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Durum
                      </label>
                      <select
                        value={viewFormData.status}
                        onChange={(e) => setViewFormData({ ...viewFormData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all"
                      >
                        <option value="pending">Beklemede</option>
                        <option value="completed">Tamamlandı</option>
                        <option value="cancelled">Tamamlanmadı</option>
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowViewModal(false);
                        setViewingAssignment(null);
                        setViewFormData({
                          details: '',
                          status: '',
                          newFiles: [],
                          filesToDelete: [],
                        });
                      }}
                      className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                    >
                      Kapat
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                    >
                      {isUpdating ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Görevlendiren kişi sadece görüntüleyebilir */}
              {viewingAssignment.assignerId === session?.user?.id && viewingAssignment.assigneeId !== session?.user?.id && (
                <div className="space-y-4">
                  {viewingAssignment.details && (
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-1">Görev Detayları:</p>
                      <p className="text-white whitespace-pre-wrap">{viewingAssignment.details}</p>
                    </div>
                  )}
                  {viewingAssignment.files.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-300 mb-2">Dosyalar:</p>
                      <div className="space-y-3">
                        {viewingAssignment.files.map((filePath, index) => {
                          const fileName = filePath.split('/').pop() || 'Dosya';
                          const fileType = getFileType(fileName);
                          const canPreview = fileType === 'image' || fileType === 'video';
                          const isImage = fileType === 'image';
                          return (
                            <div key={index} className="space-y-1">
                              {isImage ? (
                                <div className="border border-gray-700 rounded-md overflow-hidden bg-background">
                                  <button
                                    onClick={() => handleViewFile(viewingAssignment.id, index, fileName)}
                                    className="w-full hover:opacity-90 transition-opacity"
                                  >
                                    <img
                                      src={`/api/assignments/${viewingAssignment.id}/file?index=${index}`}
                                      alt={fileName}
                                      className="w-full h-auto max-h-64 object-contain"
                                    />
                                  </button>
                                  <div className="px-3 py-2 border-t border-gray-700">
                                    <p className="text-xs text-gray-400 truncate">{fileName}</p>
                                  </div>
                                </div>
                              ) : canPreview ? (
                                <button
                                  onClick={() => handleViewFile(viewingAssignment.id, index, fileName)}
                                  className="w-full px-3 py-2 border border-gray-700 text-white bg-background rounded-md hover:bg-background-tertiary transition-all text-sm text-left"
                                >
                                  {fileName}
                                </button>
                              ) : (
                                <a
                                  href={`/api/assignments/${viewingAssignment.id}/file?index=${index}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block px-3 py-2 border border-gray-700 text-white bg-background rounded-md hover:bg-background-tertiary transition-all text-sm"
                                >
                                  {fileName}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setViewingAssignment(null);
                        setViewFormData({
                          details: '',
                          status: '',
                          newFiles: [],
                          filesToDelete: [],
                        });
                      }}
                      className="px-4 py-2 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition-all"
                    >
                      Kapat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="bg-background-secondary rounded-md shadow-2xl max-w-7xl w-full max-h-[90vh] m-4 flex flex-col border border-gray-700 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">{viewingFile.fileName}</h2>
              <button
                onClick={() => setViewingFile(null)}
                className="text-gray-400 hover:text-white transition-all text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* Media Viewer */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {viewingFile.type === 'image' ? (
                <img
                  src={viewingFile.url}
                  alt={viewingFile.fileName}
                  className="max-w-full max-h-[calc(90vh-120px)] object-contain"
                />
              ) : viewingFile.type === 'video' ? (
                <video
                  src={viewingFile.url}
                  controls
                  className="max-w-full max-h-[calc(90vh-120px)]"
                >
                  Tarayıcınız video oynatmayı desteklemiyor.
                </video>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && viewingPdfUrl && (
        <PDFViewer
          url={viewingPdfUrl}
          title={viewingPdfTitle}
          onClose={() => {
            setPdfViewerOpen(false);
            setViewingPdfUrl(null);
            setViewingPdfTitle('');
          }}
        />
      )}
    </div>
  );
}

