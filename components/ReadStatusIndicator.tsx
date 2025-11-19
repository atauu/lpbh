'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';

type EventType = 'meeting' | 'event' | 'assignment' | 'announcement' | 'research';

interface ReadStatusIndicatorProps {
  eventType: EventType;
  eventId: string;
  isRead?: boolean; // Kullanıcının bu event'i okuduğu bilgisi
  onMarkAsRead?: () => void; // Okundu işaretlendiğinde çağrılacak callback
  className?: string;
}

interface ReadStatusData {
  readCount: number;
  unreadCount: number;
  totalEligible: number;
  readBy: Array<{
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
    readAt: string;
  }>;
  unreadBy: Array<{
    id: string;
    username: string;
    isim: string | null;
    soyisim: string | null;
  }>;
}

export default function ReadStatusIndicator({
  eventType,
  eventId,
  isRead = false,
  onMarkAsRead,
  className = '',
}: ReadStatusIndicatorProps) {
  const { data: session } = useSession();
  const [readStatus, setReadStatus] = useState<ReadStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  // Okuma durumunu getir
  const fetchReadStatus = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/read-status?eventType=${eventType}&eventId=${eventId}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setReadStatus(data);
      }
    } catch (error) {
      console.error('Read status fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Okundu işaretle
  const markAsRead = async () => {
    if (!session?.user?.id || isRead || isMarkingAsRead) return;

    try {
      setIsMarkingAsRead(true);
      const res = await fetch('/api/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          eventId,
        }),
        credentials: 'include',
      });

      if (res.ok) {
        // Okuma durumunu yeniden getir
        await fetchReadStatus();
        if (onMarkAsRead) {
          onMarkAsRead();
        }
      }
    } catch (error) {
      console.error('Mark as read error:', error);
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  // Tooltip gösterildiğinde okuma durumunu getir ve pozisyonu ayarla
  useEffect(() => {
    if (showTooltip && !readStatus && !isLoading) {
      fetchReadStatus();
    }
    
    // Tooltip pozisyonunu ayarla (yukarıdan taşacaksa altta göster)
    const updateTooltipPosition = () => {
      if (showTooltip && iconRef.current) {
        const rect = iconRef.current.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        // Tooltip'in yaklaşık yüksekliği (maksimum 80vh)
        const estimatedHeight = Math.min(400, window.innerHeight * 0.8);
        
        const isBottom = spaceAbove < estimatedHeight && spaceBelow > spaceAbove;
        setTooltipPosition(isBottom ? 'bottom' : 'top');
        
        // Tooltip'in merkez noktasını hesapla (viewport'a göre)
        const left = rect.left + rect.width / 2;
        // top koordinatını viewport'a göre hesapla
        const top = isBottom ? rect.bottom + 8 : rect.top - 8;
        
        setTooltipCoords({ top, left });
      }
    };
    
    if (showTooltip) {
      updateTooltipPosition();
      window.addEventListener('scroll', updateTooltipPosition, true);
      window.addEventListener('resize', updateTooltipPosition);
    }
    
    return () => {
      window.removeEventListener('scroll', updateTooltipPosition, true);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [showTooltip, readStatus]);

  // Tooltip dışına tıklandığında kapat (mobil için)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        // Eğer tıklanan element göz ikonu veya sayı ise kapatma
        if (!target.closest('.read-status-icon')) {
          setShowTooltip(false);
        }
      }
    };

    if (showTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showTooltip]);

  // Kullanıcı adını formatla
  const getUserName = (user: { isim: string | null; soyisim: string | null; username: string }) => {
    if (user.isim || user.soyisim) {
      return `${user.isim || ''} ${user.soyisim || ''}`.trim();
    }
    return user.username;
  };

  const readCount = readStatus?.readCount ?? 0;

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Göz ikonu ve sayı */}
      <div
        ref={iconRef}
        className="read-status-icon relative flex items-center gap-1 cursor-pointer group"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => {
          e.stopPropagation();
          // Mobilde tooltip'i aç/kapat, desktop'ta okundu işaretle
          if (window.innerWidth < 768) {
            setShowTooltip(!showTooltip);
          } else {
            markAsRead();
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          // Mobilde tooltip'i aç/kapat
          setShowTooltip(!showTooltip);
        }}
      >
        <svg
          className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
          {isLoading ? '...' : readCount}
        </span>
      </div>

      {/* Tooltip - Portal ile body'ye render et */}
      {showTooltip && readStatus && typeof window !== 'undefined' && createPortal(
        <div 
          ref={tooltipRef}
          className={`fixed w-[280px] sm:w-80 max-w-[calc(100vw-2rem)] bg-background-secondary border border-gray-700 rounded-md shadow-xl z-[99999] p-3 max-h-[80vh] overflow-y-auto`}
          style={{
            left: `${Math.max(16, Math.min(tooltipCoords.left, window.innerWidth - (window.innerWidth > 640 ? 320 : 280) - 16))}px`,
            transform: 'translateX(-50%)',
            ...(tooltipPosition === 'top' 
              ? { bottom: `${window.innerHeight - tooltipCoords.top}px` }
              : { top: `${tooltipCoords.top}px` }
            ),
          } as React.CSSProperties}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            {/* Okuyanlar */}
            {readStatus.readBy.length > 0 && (
              <div>
                <div className="text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                  Okuyanlar ({readStatus.readBy.length})
                </div>
                <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {readStatus.readBy.map((user) => (
                    <div key={user.id} className="text-xs sm:text-sm text-gray-400 flex items-center justify-between gap-2">
                      <span className="truncate flex-1 min-w-0">{getUserName(user)}</span>
                      <span className="text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                        {new Date(user.readAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Okumayanlar */}
            {readStatus.unreadBy.length > 0 && (
              <div>
                <div className="text-xs sm:text-sm font-semibold text-gray-300 mb-2">
                  Okumayanlar ({readStatus.unreadBy.length})
                </div>
                <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {readStatus.unreadBy.map((user) => (
                    <div key={user.id} className="text-xs sm:text-sm text-gray-400 truncate">
                      {getUserName(user)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tüm kullanıcılar okumuşsa */}
            {readStatus.readBy.length > 0 && readStatus.unreadBy.length === 0 && (
              <div className="text-xs sm:text-sm text-green-400 text-center font-medium py-2">
                Tüm kullanıcılar okudu
              </div>
            )}
          </div>

          {/* Okundu işaretle butonu - eğer kullanıcı okumamışsa */}
          {!isRead && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <button
                onClick={markAsRead}
                disabled={isMarkingAsRead}
                className="w-full text-xs sm:text-sm px-3 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isMarkingAsRead ? 'İşaretleniyor...' : 'Okundu İşaretle'}
              </button>
            </div>
          )}
        </div>
      , document.body)}
    </div>
  );
}

