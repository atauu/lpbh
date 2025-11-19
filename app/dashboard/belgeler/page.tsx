'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button, Select, SelectItem } from '@/components/ui';
import { hasPermission } from '@/lib/auth';
import PDFViewer from '@/components/PDFViewer';
import DateRangePicker from '@/components/DateRangePicker';
import * as Popover from '@radix-ui/react-popover';

interface User {
  id: string;
  username: string;
  isim: string | null;
  soyisim: string | null;
}

interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  visibility: 'yönetim' | 'member' | 'herkes';
  uploadedBy: string;
  createdAt: string;
  filePath: string;
  content?: string | null;
  uploader: User;
}

export default function BelgelerPage() {
  const { data: session, status } = useSession();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [uploaderId, setUploaderId] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'__all__' | 'yönetim' | 'member' | 'herkes'>('__all__');

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    visibility: 'herkes' as 'yönetim' | 'member' | 'herkes',
  });

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);
  const [viewingTitle, setViewingTitle] = useState<string>('');


  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchUsers();
    }
  }, [session, status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (session) fetchDocuments();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, uploaderId, dateStart, dateEnd, visibilityFilter, session]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users?limit=1000', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data || []);
    } catch {
      // sessiz geç
    }
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (uploaderId) params.set('uploaderId', uploaderId);
      // Tek kontrol üzerinden aralık desteği: API 'date' paramını destekleyecek
      if (dateStart && dateEnd) {
        params.set('date', `${dateStart},${dateEnd}`);
      } else if (dateStart) {
        params.set('date', dateStart);
      }
      if (visibilityFilter !== '__all__') {
        params.set('visibility', visibilityFilter);
      }

      const res = await fetch(`/api/documents?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Belgeler yüklenemedi');
      }
      const data = await res.json();
      setDocuments(data || []);
    } catch (err: any) {
      setError(err.message || 'Belgeler yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDisplayName = (u: User) => {
    if (u.isim || u.soyisim) {
      return `${u.isim || ''} ${u.soyisim || ''}`.trim();
    }
    return u.username;
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      if (!file) {
        setError('Lütfen PDF dosyası seçin.');
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('visibility', uploadForm.visibility);
      formData.append('file', file);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Belge eklenemedi');
      }

      setShowUploadForm(false);
      setUploadForm({
        title: '',
        description: '',
        visibility: 'herkes',
      });
      setFile(null);
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Belge eklenemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" başlıklı belgeyi silmek istediğinize emin misiniz?`)) return;
    try {
      setError('');
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Belge silinemedi');
      }
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Belge silinemedi');
    }
  };

  // İzin kontrolleri
  const userPermissions = session?.user?.permissions;
  const canCreate = useMemo(() => hasPermission(userPermissions, 'documents', 'create'), [userPermissions]);
  const canDelete = useMemo(() => hasPermission(userPermissions, 'documents', 'delete'), [userPermissions]);
  const canRead = useMemo(() => hasPermission(userPermissions, 'documents', 'read'), [userPermissions]);

  // Highlight helpers (meetings sayfasındakiyle uyumlu)
  const highlightText = (text: string, term: string): React.ReactNode => {
    if (!term.trim() || !text) return <span>{text}</span>;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, idx) =>
          new RegExp(`^${escaped}$`, 'i').test(part) ? (
            <mark key={idx} className="bg-primary text-white px-1 rounded">{part}</mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </span>
    );
  };

  const extractMatchingSentences = (text: string, term: string, maxSentences: number = 3): string[] => {
    if (!term.trim() || !text) return [];
    const searchLower = term.toLowerCase();
    const textLower = text.toLowerCase();
    if (!textLower.includes(searchLower)) return [];
    const sentences = text.split(/[.!?]\s+|\n+/).filter(s => s.trim().length > 10);
    const matches: string[] = [];
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(searchLower) && matches.length < maxSentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 200) {
          const idx = trimmed.toLowerCase().indexOf(searchLower);
          const start = Math.max(0, idx - 50);
          const end = Math.min(trimmed.length, idx + term.length + 50);
          matches.push('...' + trimmed.substring(start, end) + '...');
        } else {
          matches.push(trimmed);
        }
      }
    }
    return matches;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-text-primary">Belgeler</h1>
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setShowUploadForm((prev) => !prev)}
            className="px-4 py-2"
          >
            {showUploadForm ? 'İptal' : 'Belge Ekle'}
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-background-secondary rounded-md p-6 border border-border backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Yeni Belge Ekle</h2>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Belge Başlığı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Görüntülenecekler
                </label>
                <Select
                  value={uploadForm.visibility}
                  onValueChange={(val) =>
                    setUploadForm((prev) => ({ ...prev, visibility: val as 'yönetim' | 'member' | 'herkes' }))
                  }
                  className="w-full"
                >
                  <SelectItem value="yönetim">Yönetim</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="herkes">Herkes</SelectItem>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Açıklama</label>
              <textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                PDF Dosyası <span className="text-red-400">*</span>
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-text-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowUploadForm(false);
                  setUploadForm({
                    title: '',
                    description: '',
                    visibility: 'herkes',
                  });
                  setFile(null);
                }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting} variant="primary">
                {isSubmitting ? 'Yükleniyor...' : 'Belgeyi Yükle'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filters - otomatik arama, tek tarih kontrolü (aralık destekli) ve görünürlük */}
      <div className="bg-background-secondary rounded-md p-3 border border-border backdrop-blur-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col flex-1 min-w-[220px]">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Ara</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="Başlık, açıklama, PDF içeriği"
            />
          </div>

          <div className="flex flex-col">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Ekleyen</label>
            <div className="min-w-[160px]">
              <Select
                value={uploaderId || '__all__'}
                onValueChange={(val) => setUploaderId(val === '__all__' ? '' : val)}
                className="w-[160px]"
                placeholder="Tümü"
              >
                <SelectItem value="__all__">Tümü</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {getUserDisplayName(u)}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Gösterilecekler</label>
            <div className="min-w-[160px]">
              <Select
                value={visibilityFilter}
                onValueChange={(val) => setVisibilityFilter(val as any)}
                className="w-[160px]"
                placeholder="Tümü"
              >
                <SelectItem value="__all__">Tümü</SelectItem>
                <SelectItem value="yönetim">yönetim</SelectItem>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="herkes">herkes</SelectItem>
              </Select>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="block text-[12px] font-medium text-text-secondary mb-1">Eklenme Tarihi</label>
            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="px-2 py-1.5 border border-border bg-background rounded-md text-sm text-text-primary hover:bg-background-tertiary min-w-[220px] text-left"
                  title="Tarih aralığı seçin"
                >
                  {dateStart
                    ? `${new Date(dateStart).toLocaleDateString('tr-TR')}${dateEnd ? ' → ' + new Date(dateEnd).toLocaleDateString('tr-TR') : ''}`
                    : 'Tarih seçin'}
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="z-[1000] mt-2 bg-background-secondary border border-border rounded-md shadow-xl p-2 data-[state=open]:animate-in data-[state=closed]:animate-out"
                  sideOffset={4}
                  align="start"
                >
                  <DateRangePicker
                    startDate={dateStart}
                    endDate={dateEnd}
                    onChange={(s, e) => {
                      setDateStart(s);
                      setDateEnd(e);
                    }}
                    className="bg-background-secondary"
                  />
                  <div className="flex justify-between mt-2 gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-xs border border-border rounded-md text-text-secondary hover:bg-background-tertiary transition"
                      onClick={() => {
                        setDateStart('');
                        setDateEnd('');
                      }}
                    >
                      Temizle
                    </button>
                    <Popover.Close asChild>
                      <button
                        type="button"
                        className="px-2 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary/90 transition"
                      >
                        Uygula
                      </button>
                    </Popover.Close>
                  </div>
                  <Popover.Arrow className="fill-background-secondary" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="text-text-muted">Belgeler yükleniyor...</div>
      ) : !canRead ? (
        <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm text-text-muted">
          Bu sayfayı görüntüleme izniniz yok.
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm text-text-muted">
          Henüz belge eklenmemiş.
        </div>
      ) : (
        <div className="bg-background-secondary rounded-md border border-border overflow-hidden backdrop-blur-sm">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-semibold text-text-primary">Tüm Belgeler</h2>
          </div>
          <div className="divide-y divide-border">
            {documents.map((doc) => {
              const contentMatches = searchTerm.trim() && doc.content
                ? extractMatchingSentences(doc.content, searchTerm, 3)
                : [];
              return (
                <div key={doc.id} className="p-4 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row gap-3 md:items-start">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-text-primary">
                        {searchTerm.trim() ? highlightText(doc.title, searchTerm) : doc.title}
                      </h3>
                      {doc.description && (
                        <p className="text-sm text-text-tertiary line-clamp-2">
                          {searchTerm.trim() ? highlightText(doc.description, searchTerm) : doc.description}
                        </p>
                      )}
                      <p className="text-xs text-text-muted">
                        Ekleyen: {getUserDisplayName(doc.uploader)} •{' '}
                        {new Date(doc.createdAt).toLocaleString('tr-TR')}
                      </p>
                      <p className="text-xs text-text-muted">
                        Dosya: {searchTerm.trim() ? highlightText(doc.fileName, searchTerm) : doc.fileName} ({(doc.fileSize / 1024).toFixed(1)} KB)
                      </p>
                      {contentMatches.length > 0 && (
                        <div className="mt-2 p-3 bg-background-tertiary rounded-md border border-border backdrop-blur-sm">
                          <p className="text-xs text-text-muted mb-1">İçerikten Eşleşmeler:</p>
                          <div className="space-y-1 text-xs text-text-secondary">
                            {contentMatches.map((sentence, idx) => (
                              <p key={idx} className="italic">"{highlightText(sentence, searchTerm)}"</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 justify-end md:justify-start">
                      {canRead && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setViewingUrl(`/${doc.filePath}`);
                            setViewingTitle(doc.title);
                            setPdfViewerOpen(true);
                          }}
                          title="Görüntüle"
                        >
                          Görüntüle
                        </Button>
                      )}
                      <a
                        href={`/${doc.filePath}`}
                        download={doc.fileName}
                        className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-background-tertiary text-text-primary border border-border hover:bg-background transition-all"
                        title="İndir"
                      >
                        İndir
                      </a>
                      {canDelete && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDelete(doc.id, doc.title)}
                          title="Sil"
                        >
                          Sil
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {pdfViewerOpen && viewingUrl && (
        <PDFViewer
          url={viewingUrl}
          title={viewingTitle}
          onClose={() => {
            setPdfViewerOpen(false);
            setViewingUrl(null);
            setViewingTitle('');
          }}
        />
      )}
    </div>
  );
}

