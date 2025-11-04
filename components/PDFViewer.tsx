'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// PDF.js worker'ı yapılandır - Next.js için
if (typeof window !== 'undefined') {
  // CDN'den worker yükle
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
}

interface PDFViewerProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function PDFViewer({ url, title, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [goToPageInput, setGoToPageInput] = useState('');
  const [showGoToPage, setShowGoToPage] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    setError('PDF yüklenirken bir hata oluştu');
    setLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages || 1, prev + 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(3, prev + 0.2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.2));
  };

  const resetZoom = () => {
    setScale(1.2);
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (numPages || 1)) {
      setPageNumber(page);
      setGoToPageInput('');
      setShowGoToPage(false);
    }
  };

  // Klavye kısayolları
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input alanında değilse
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  // Arama fonksiyonu
  const handleSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    setIsSearching(true);
    try {
      // PDF.js ile arama yapmak için document'i al
      const loadingTask = pdfjs.getDocument(url).promise;
      const pdf = await loadingTask;
      const results: number[] = [];

      // Her sayfada ara
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => (item.str || ''))
          .join(' ')
          .toLowerCase();
        
        if (text.includes(term.toLowerCase())) {
          results.push(pageNum);
        }
      }

      setSearchResults(results);
      if (results.length > 0) {
        setCurrentSearchIndex(0);
        setPageNumber(results[0]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [url]);

  // Arama terimi değiştiğinde ara
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm) {
        handleSearch(searchTerm);
      } else {
        setSearchResults([]);
        setCurrentSearchIndex(0);
      }
    }, 500); // Debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, handleSearch]);

  // Sonraki/bir önceki eşleşmeye git
  const goToNextMatch = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentSearchIndex + 1) % searchResults.length;
      setCurrentSearchIndex(nextIndex);
      setPageNumber(searchResults[nextIndex]);
    }
  };

  const goToPrevMatch = () => {
    if (searchResults.length > 0) {
      const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentSearchIndex(prevIndex);
      setPageNumber(searchResults[prevIndex]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background-secondary rounded-md shadow-2xl w-full h-full max-w-7xl max-h-[90vh] m-4 flex flex-col border border-gray-700 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-semibold text-white truncate flex-1 mr-4">{title}</h2>
          
          {/* Arama Çubuğu */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="PDF içinde ara..."
                className="w-full px-3 py-1.5 pr-8 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-300 whitespace-nowrap">
                <span>{currentSearchIndex + 1} / {searchResults.length}</span>
                <button
                  onClick={goToPrevMatch}
                  className="p-1 hover:bg-background-tertiary rounded transition"
                  title="Önceki eşleşme"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToNextMatch}
                  className="p-1 hover:bg-background-tertiary rounded transition"
                  title="Sonraki eşleşme"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            {isSearching && (
              <div className="text-xs text-gray-400">Aranıyor...</div>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-all text-2xl font-bold ml-4 flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-background-tertiary flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="px-3 py-1.5 bg-background text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Önceki
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300 px-3">
                Sayfa {pageNumber} / {numPages || '...'}
              </span>
              {showGoToPage ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const page = parseInt(goToPageInput);
                        if (!isNaN(page)) {
                          goToPage(page);
                        }
                      } else if (e.key === 'Escape') {
                        setShowGoToPage(false);
                        setGoToPageInput('');
                      }
                    }}
                    placeholder="Sayfa #"
                    min={1}
                    max={numPages || 1}
                    className="w-20 px-2 py-1 border border-gray-700 text-white bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const page = parseInt(goToPageInput);
                      if (!isNaN(page)) {
                        goToPage(page);
                      }
                    }}
                    className="px-2 py-1 bg-primary text-white rounded-md hover:bg-primary/90 transition text-sm"
                  >
                    Git
                  </button>
                  <button
                    onClick={() => {
                      setShowGoToPage(false);
                      setGoToPageInput('');
                    }}
                    className="px-2 py-1 bg-background-tertiary text-white rounded-md hover:bg-gray-700 transition text-sm"
                  >
                    İptal
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGoToPage(true)}
                  className="px-2 py-1 text-xs bg-background-tertiary text-gray-300 rounded-md hover:bg-gray-700 transition"
                  title="Sayfaya Git (Ctrl+G)"
                >
                  Git
                </button>
              )}
            </div>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= (numPages || 1)}
              className="px-3 py-1.5 bg-background text-white rounded-md hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Sonraki
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-3 py-1.5 bg-background text-white rounded-md hover:bg-gray-700 transition text-sm"
              title="Uzaklaştır"
            >
              −
            </button>
            <span className="text-sm text-gray-300 px-2 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="px-3 py-1.5 bg-background text-white rounded-md hover:bg-gray-700 transition text-sm"
              title="Yakınlaştır"
            >
              +
            </button>
            <button
              onClick={resetZoom}
              className="px-3 py-1.5 bg-background text-white rounded-md hover:bg-gray-700 transition text-sm"
              title="Sıfırla"
            >
              Reset
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-900 p-4 pt-4 md:pt-12 flex items-start justify-center">
          {error ? (
            <div className="text-red-400 text-center">
              <p className="mb-2">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition"
              >
                Tekrar Dene
              </button>
            </div>
          ) : (
            <div className="relative pt-0 md:pt-6">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                  <div className="text-white">Yükleniyor...</div>
                </div>
              )}
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="text-white">PDF yükleniyor...</div>
                }
                error={
                  <div className="text-red-400">PDF yüklenemedi</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="border border-gray-700 shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

