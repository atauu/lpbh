'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Button, Dialog, DialogContent, DialogTitle, DialogClose, Select, SelectItem } from '@/components/ui';
import { hasPermission } from '@/lib/auth';

interface PollOption {
  id: string;
  text: string;
  createdBy: string | null;
}

interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  user: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  };
  option: PollOption;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  type: 'yes_no' | 'multiple';
  allowCustomOption: boolean;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  };
  options: PollOption[];
  votes: PollVote[];
}

export default function OylamalarPage() {
  const { data: session, status } = useSession();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createType, setCreateType] = useState<'yes_no' | 'multiple'>('yes_no');
  const [allowCustomOption, setAllowCustomOption] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [multiOptions, setMultiOptions] = useState<string[]>(['']);

  const [viewPoll, setViewPoll] = useState<Poll | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/login');
    }
    if (session) {
      fetchPolls();
    }
  }, [session, status]);

  const fetchPolls = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await fetch(`/api/polls${search ? `?search=${encodeURIComponent(search)}` : ''}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Oylamalar yüklenemedi');
      }
      const data = await res.json();
      setPolls(data || []);
    } catch (err: any) {
      setError(err.message || 'Oylamalar yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setCreateType('yes_no');
    setAllowCustomOption(false);
    setMultiOptions(['']);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');

      let options: string[] | undefined = undefined;
      if (createType === 'multiple') {
        options = multiOptions.map((o) => o.trim()).filter(Boolean);
        if (!allowCustomOption && (options.length < 2)) {
          setError('Çoklu seçenekli oylamada en az 2 seçenek olmalıdır.');
          setIsSubmitting(false);
          return;
        }
      }

      const editingId = (window as any).__editingPollId as string | undefined;
      const url = editingId ? `/api/polls/${editingId}` : '/api/polls';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? {
                title,
                description,
                allowCustomOption,
              }
            : {
                title,
                description,
                type: createType,
                allowCustomOption,
                options,
              }
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Oylama oluşturulamadı');
      }

      setShowCreateModal(false);
      (window as any).__editingPollId = undefined;
      resetCreateForm();
      await fetchPolls();
    } catch (err: any) {
      setError(err.message || 'Oylama oluşturulamadı');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (poll: Poll, optionId?: string, newOptionText?: string) => {
    try {
      setError('');
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, newOptionText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Oy kullanılamadı');
      }
      await fetchPolls();
    } catch (err: any) {
      setError(err.message || 'Oy kullanılamadı');
    }
  };

  const getUserDisplayName = (u: { username: string; isim: string | null; soyisim: string | null }) => {
    if (u.isim || u.soyisim) {
      return `${u.isim || ''} ${u.soyisim || ''}`.trim();
    }
    return u.username;
  };

  const myUserId = session?.user?.id;

  const filteredPolls = polls;

  const userPermissions = (session as any)?.user?.permissions;
  const canCreate = hasPermission(userPermissions, 'polls', 'create');
  const canUpdate = hasPermission(userPermissions, 'polls', 'update');
  const canDelete = hasPermission(userPermissions, 'polls', 'delete');
  const canRead = hasPermission(userPermissions, 'polls', 'read');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-3xl font-bold text-text-primary">Oylamalar</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Yeni Oylama Oluştur
          </Button>
        )}
      </div>

      <div className="bg-background-secondary rounded-md p-4 border border-border backdrop-blur-sm flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Başlık veya detaylarda ara..."
          className="flex-1 px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button variant="secondary" onClick={fetchPolls} className="whitespace-nowrap">
          Ara
        </Button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-md backdrop-blur-sm">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-text-muted">Oylamalar yükleniyor...</div>
      ) : !canRead ? (
        <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm text-text-muted">
          Bu sayfayı görüntüleme izniniz yok.
        </div>
      ) : filteredPolls.length === 0 ? (
        <div className="bg-background-secondary rounded-md border border-border p-8 text-center backdrop-blur-sm text-text-muted">
          Henüz oylama oluşturulmamış.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolls.map((poll) => {
            const myVote = poll.votes.find((v) => v.userId === myUserId);
            const voteCounts: Record<string, number> = {};
            poll.votes.forEach((v) => {
              voteCounts[v.optionId] = (voteCounts[v.optionId] || 0) + 1;
            });

            return (
              <div
                key={poll.id}
                className="bg-background-secondary rounded-md border border-border p-4 backdrop-blur-sm flex flex-col gap-3"
              >
                <div className="flex justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-text-primary">{poll.title}</h2>
                    {poll.description && (
                      <p className="text-sm text-text-tertiary whitespace-pre-line">{poll.description}</p>
                    )}
                    <p className="text-xs text-text-muted">
                      Oluşturan: {getUserDisplayName(poll.creator)} •{' '}
                      {new Date(poll.createdAt).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="flex gap-2 self-start">
                    <Button variant="secondary" size="sm" onClick={() => setViewPoll(poll)}>
                      Sonuçları Gör
                    </Button>
                    {(canUpdate || poll.creator.id === myUserId) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setTitle(poll.title);
                          setDescription(poll.description || '');
                          setCreateType(poll.type);
                          setAllowCustomOption(poll.allowCustomOption);
                          setMultiOptions([]);
                          setShowCreateModal(true);
                          (window as any).__editingPollId = poll.id;
                        }}
                      >
                        Düzenle
                      </Button>
                    )}
                    {(canDelete || poll.creator.id === myUserId) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (!confirm('Bu oylamayı silmek istediğinize emin misiniz?')) return;
                          try {
                            const res = await fetch(`/api/polls/${poll.id}`, { method: 'DELETE' });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              throw new Error(data.error || 'Silinemedi');
                            }
                            await fetchPolls();
                          } catch (e: any) {
                            setError(e.message || 'Silinemedi');
                          }
                        }}
                      >
                        Sil
                      </Button>
                    )}
                  </div>
                </div>

                {/* Voting area */}
                <div className="space-y-3">
                  {poll.type === 'yes_no' ? (
                    <div className="flex flex-wrap gap-2">
                      {poll.options.map((opt) => {
                        const isSelected = myVote?.optionId === opt.id;
                        return (
                          <Button
                            key={opt.id}
                            variant={isSelected ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handleVote(poll, opt.id)}
                          >
                            {opt.text} ({voteCounts[opt.id] || 0})
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <MultipleChoicePoll
                      poll={poll}
                      myVote={myVote}
                      voteCounts={voteCounts}
                      onVote={handleVote}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Poll Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <DialogTitle>Yeni Oylama Oluştur</DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-text-muted text-xl">
                ×
              </Button>
            </DialogClose>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Oylama Başlığı <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Oylama Detayı</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Oylama Tipi</label>
                <Select
                  value={createType}
                  onValueChange={(val: 'yes_no' | 'multiple') => setCreateType(val)}
                  className="w-full"
                >
                  <SelectItem value="yes_no">Evet / Hayır</SelectItem>
                  <SelectItem value="multiple">Çoklu Seçenek</SelectItem>
                </Select>
              </div>

              {createType === 'multiple' && (
                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Diğerlerinin seçenek eklemesine izin ver
                  </label>
                  <Button
                    type="button"
                    variant={allowCustomOption ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setAllowCustomOption((prev) => !prev)}
                    className="w-fit"
                  >
                    {allowCustomOption ? 'Evet' : 'Hayır'}
                  </Button>
                  {!allowCustomOption && (
                    <p className="text-xs text-text-muted">
                      Bu seçenek kapalıysa en az 2 seçenek eklemeniz gerekir.
                    </p>
                  )}
                </div>
              )}
            </div>

            {createType === 'multiple' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-text-secondary">Seçenekler</label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setMultiOptions((prev) => [...prev, ''])}
                  >
                    Seçenek Ekle
                  </Button>
                </div>
                <div className="space-y-2">
                  {multiOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMultiOptions((prev) =>
                            prev.map((p, i) => (i === idx ? val : p))
                          );
                        }}
                        className="flex-1 px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder={`Seçenek ${idx + 1}`}
                      />
                      {multiOptions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setMultiOptions((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting} variant="primary">
                {isSubmitting ? 'Oluşturuluyor...' : 'Oylamayı Oluştur'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Result Modal */}
      <Dialog open={!!viewPoll} onOpenChange={(open) => !open && setViewPoll(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewPoll && (
            <>
              <div className="flex justify-between items-center mb-4">
                <DialogTitle>Oylama Sonuçları</DialogTitle>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="text-text-muted text-xl">
                    ×
                  </Button>
                </DialogClose>
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">{viewPoll.title}</h2>
              {viewPoll.description && (
                <p className="text-sm text-text-tertiary mb-4 whitespace-pre-line">
                  {viewPoll.description}
                </p>
              )}

              <div className="space-y-4">
                {viewPoll.options.map((opt) => {
                  const votesForOption = viewPoll.votes.filter((v) => v.optionId === opt.id);
                  return (
                    <div
                      key={opt.id}
                      className="border border-border rounded-md p-3 bg-background-tertiary"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <p className="font-medium text-text-primary">{opt.text}</p>
                        <span className="text-sm text-text-muted">
                          Oy: {votesForOption.length}
                        </span>
                      </div>
                      {votesForOption.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs text-text-muted">
                          {votesForOption.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-1 rounded-full bg-background text-text-secondary border border-border"
                            >
                              {getUserDisplayName(v.user)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MultipleChoiceProps {
  poll: Poll;
  myVote?: PollVote;
  voteCounts: Record<string, number>;
  onVote: (poll: Poll, optionId?: string, newOptionText?: string) => Promise<void> | void;
}

function MultipleChoicePoll({ poll, myVote, voteCounts, onVote }: MultipleChoiceProps) {
  const [newOption, setNewOption] = useState('');

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {poll.options.map((opt) => {
          const isSelected = myVote?.optionId === opt.id;
          return (
            <Button
              key={opt.id}
              variant={isSelected ? 'primary' : 'secondary'}
              size="sm"
              className="w-full justify-between"
              onClick={() => onVote(poll, opt.id)}
            >
              <span>{opt.text}</span>
              <span className="text-xs text-text-muted">
                Oy: {voteCounts[opt.id] || 0}
              </span>
            </Button>
          );
        })}
      </div>

      {poll.allowCustomOption && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-secondary">
            Yeni Seçenek Ekle (her üye en fazla 1 seçenek ekleyebilir)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              className="flex-1 px-3 py-2 border border-border text-text-primary bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Yeni seçenek..."
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!newOption.trim()}
              onClick={() => {
                const trimmed = newOption.trim();
                if (!trimmed) return;
                onVote(poll, undefined, trimmed);
                setNewOption('');
              }}
            >
              Ekle ve Seç
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


