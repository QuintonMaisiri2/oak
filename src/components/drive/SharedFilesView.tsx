'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  File,
  Download,
  Search,
  Grid,
  List,
  Eye,
  X,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Clock,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Upload,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckSquare,
  Square,
  Camera,
  Mail,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { DriveFile, DriveCategory, DriveFileTypeFilter } from '@/lib/drive/types';

interface SharedFilesViewProps {
  initialFiles: DriveFile[];
  initialCategories: DriveCategory[];
  configured: boolean;
  uploadFormUrl?: string;
  lastUpdated: string;
  errorMessage?: string;
  isSuperAdmin?: boolean;
  missingVars?: string[];
}

export function SharedFilesView({
  initialFiles,
  initialCategories,
  configured,
  uploadFormUrl,
  lastUpdated: initialLastUpdated,
  errorMessage: initialErrorMessage,
  isSuperAdmin = false,
  missingVars = [],
}: SharedFilesViewProps) {
  const [files, setFiles] = useState<DriveFile[]>(initialFiles);
  const [categories, setCategories] = useState<DriveCategory[]>(initialCategories);
  const [lastUpdated, setLastUpdated] = useState<string>(initialLastUpdated);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(initialErrorMessage);
  const [isLoading, setIsLoading] = useState(false);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<DriveFileTypeFilter>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'size'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-selection state for targeted downloads
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [iframeError, setIframeError] = useState(false);
  const [presentationMode, setPresentationMode] = useState<'slide' | 'interactive'>('slide');

  // Dedicated Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadModalTab, setUploadModalTab] = useState<'pictures' | 'presentations'>('pictures');

  // Focus traps
  const modalRef = useRef<HTMLDivElement>(null);
  const uploadModalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Check URL params for direct upload trigger (e.g., /drive?upload=pictures)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uploadParam = params.get('upload');
      if (uploadParam === 'pictures' || uploadParam === 'photos') {
        openUploadModal('pictures');
      } else if (uploadParam === 'presentations' || uploadParam === 'slides') {
        openUploadModal('presentations');
      } else if (uploadParam === 'true') {
        openUploadModal('pictures');
      }
    }
  }, []);

  const openUploadModal = (type: 'pictures' | 'presentations' = 'pictures') => {
    setUploadModalTab(type);
    setIsUploadModalOpen(true);
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      const res = await fetch('/api/drive/files?refresh=true');
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to refresh files');
      }
      setFiles(data.files || []);
      setCategories(data.categories || []);
      setLastUpdated(data.lastUpdated || new Date().toISOString());
    } catch (err: any) {
      setErrorMessage(err.message || 'Error refreshing shared files');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered & Sorted files calculation
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        // Category filter
        if (selectedCategory !== 'all') {
          const catMatch =
            file.category.toLowerCase() === selectedCategory.toLowerCase();
          if (!catMatch) return false;
        } else if (file.isEventPhoto) {
          // Keep the hundreds of event photos in their day tabs so documents stay easy to find.
          return false;
        }

        // File type filter
        if (fileTypeFilter !== 'all') {
          if (file.fileTypeCategory !== fileTypeFilter) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = file.name.toLowerCase().includes(q);
          const descMatch = file.description
            ? file.description.toLowerCase().includes(q)
            : false;
          if (!nameMatch && !descMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        if (sortBy === 'size') {
          return b.size - a.size;
        }
        return 0;
      });
  }, [files, selectedCategory, fileTypeFilter, searchQuery, sortBy]);

  // Current preview index within filteredFiles
  const currentPreviewIndex = useMemo(() => {
    if (!previewFile) return -1;
    return filteredFiles.findIndex((f) => f.id === previewFile.id);
  }, [previewFile, filteredFiles]);

  const handlePrevPreview = () => {
    if (currentPreviewIndex > 0) {
      setPreviewFile(filteredFiles[currentPreviewIndex - 1]);
      setIframeError(false);
    }
  };

  const handleNextPreview = () => {
    if (currentPreviewIndex >= 0 && currentPreviewIndex < filteredFiles.length - 1) {
      setPreviewFile(filteredFiles[currentPreviewIndex + 1]);
      setIframeError(false);
    }
  };

  // Keyboard navigation & Focus trap for Modal
  useEffect(() => {
    if (!previewFile && !isUploadModalOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewFile) setPreviewFile(null);
        if (isUploadModalOpen) setIsUploadModalOpen(false);
        return;
      }

      if (previewFile) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevPreview();
          return;
        }

        if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextPreview();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [previewFile, isUploadModalOpen, currentPreviewIndex, filteredFiles]);

  // Multi-selection handlers
  const toggleSelectFile = (fileId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleDownloadSelected = () => {
    if (selectedFileIds.size === 0) return;
    setIsDownloadingSelected(true);
    const toDownload = files.filter((f) => selectedFileIds.has(f.id));

    toDownload.forEach((file, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `/api/drive/download/${encodeURIComponent(file.id)}`;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (index === toDownload.length - 1) {
          setIsDownloadingSelected(false);
        }
      }, index * 400);
    });
  };

  // Formatted date helper
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Helper for file type icons
  const renderFileTypeIcon = (file: DriveFile, sizeClass = 'w-5 h-5') => {
    switch (file.fileTypeCategory) {
      case 'presentation':
        return <Presentation className={`${sizeClass} text-amber-600`} />;
      case 'document':
        return <FileText className={`${sizeClass} text-blue-600`} />;
      case 'spreadsheet':
        return <FileSpreadsheet className={`${sizeClass} text-emerald-600`} />;
      case 'image':
        return <ImageIcon className={`${sizeClass} text-purple-600`} />;
      case 'pdf':
        return <FileText className={`${sizeClass} text-rose-600`} />;
      default:
        return <File className={`${sizeClass} text-slate-500`} />;
    }
  };

  // Helper for crisp thumbnail URLs
  const getCardThumbnailUrl = (file: DriveFile): string | undefined => {
    if (file.thumbnailLink) {
      return file.thumbnailLink.replace(/=s\d+$/, '=s600');
    }
    if (file.fileTypeCategory === 'image') {
      return `/api/drive/download/${encodeURIComponent(file.id)}?inline=true`;
    }
    return undefined;
  };

  const getHighResPreviewUrl = (file: DriveFile): string => {
    if (file.thumbnailLink) {
      return file.thumbnailLink.replace(/=s\d+$/, '=s1600');
    }
    return `/api/drive/download/${encodeURIComponent(file.id)}?inline=true`;
  };

  // Check if file is visual media (images & presentations/slides)
  const isVisualMedia = (file: DriveFile) => {
    return (
      file.fileTypeCategory === 'image' ||
      file.fileTypeCategory === 'presentation' ||
      Boolean(file.thumbnailLink)
    );
  };

  // Unconfigured state
  if (!configured) {
    return (
      <div className="page-container">
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Shared Files Not Configured</h2>

          {/* Super Admin-only detailed diagnostics */}
          {isSuperAdmin && missingVars && missingVars.length > 0 ? (
            <div className="max-w-md mx-auto text-left bg-white p-5 rounded-2xl border border-amber-300 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Super Admin Diagnostics</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                The following required Google Drive environment variable(s) are missing, empty, or set to placeholder values on the server:
              </p>
              <ul className="space-y-1.5 pt-1">
                {missingVars.map((v) => (
                  <li key={v} className="flex items-center gap-2 text-xs font-mono font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                Set these variables in your local <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.env</code> (and ensure they are not overridden by <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">.env.local</code>) or in your production host&apos;s environment settings, then restart the server or redeploy.
              </p>
              <div className="pt-2 text-center">
                <Link
                  href="/admin/drive"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                >
                  <span>Open Admin Drive Settings</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Shared Files are not configured yet. The administrator will connect the Google Drive folder shortly.
            </p>
          )}

          {uploadFormUrl && (
            <div className="pt-2">
              <button
                onClick={() => openUploadModal('pictures')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C2C4F] text-white rounded-xl text-xs font-bold hover:bg-[#16233f] transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Pictures or Presentations</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 pb-24">
      {/* 1. Header & Intro */}
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0E1726] tracking-tight">
              Shared Files & Gallery
            </h1>
            <p className="text-sm text-[#69789b] mt-1">
              Browse convening photos, presentation slide decks, and resources. Anyone can view, download, or contribute!
            </p>
          </div>

          {/* Action buttons: Upload Pictures and Upload Presentation */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              onClick={() => openUploadModal('pictures')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Upload Pictures</span>
            </button>

            <button
              onClick={() => openUploadModal('presentations')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#16233f] text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Presentation className="w-4 h-4 text-amber-300" />
              <span>Upload Presentation</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh file list"
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              aria-label="Refresh file list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Contextual Upload & Guidance Banners */}
      {selectedCategory === 'images' ? (
        /* Images Tab Banner */
        <div className="bg-gradient-to-r from-purple-50 via-slate-50 to-blue-50 border border-purple-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Have Convening Pictures to Share?</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Attendees and speakers can upload photos from the workshops, keynotes, and dinners. Organisers will review and publish them to this gallery!
              </p>
            </div>
          </div>
          <button
            onClick={() => openUploadModal('pictures')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-center cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Pictures Now</span>
          </button>
        </div>
      ) : selectedCategory === 'presentations' ? (
        /* Presentations Tab Banner */
        <div className="bg-gradient-to-r from-amber-50 via-slate-50 to-orange-50 border border-amber-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Presenting at the Convening?</h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Presenters can submit slide decks (PowerPoint, Google Slides, or PDF). Once approved, your slides will be available for all attendees to view and download.
              </p>
            </div>
          </div>
          <button
            onClick={() => openUploadModal('presentations')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#16233f] text-white text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-center cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Presentation Slides</span>
          </button>
        </div>
      ) : (
        /* Default All Resources Banner */
        <div className="bg-gradient-to-r from-blue-50/90 to-slate-50 border border-blue-100/90 rounded-2xl p-5 text-xs text-slate-700 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-primary font-bold text-sm">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Contribute Pictures & Presentations</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openUploadModal('pictures')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-purple-300 text-purple-700 font-bold text-xs transition shadow-2xs cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Pictures</span>
              </button>
              <button
                onClick={() => openUploadModal('presentations')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 text-primary font-bold text-xs transition shadow-2xs cursor-pointer"
              >
                <Presentation className="w-3.5 h-3.5 text-amber-600" />
                <span>Upload Slides</span>
              </button>
            </div>
          </div>
          <p className="leading-relaxed text-slate-600">
            <strong>How it works:</strong> Anyone can submit pictures or slide decks. Submissions are reviewed by the organisers and published to the gallery. Click <strong>Upload Pictures</strong> or <strong>Upload Presentation</strong> above to submit yours!
          </p>
        </div>
      )}

      {/* Error State Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="font-bold underline ml-2 hover:text-red-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Category Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto [scrollbar-width:none]">
        <div className="flex items-center gap-1 sm:gap-2 pb-px min-w-max">
          {categories.map((cat) => {
            const isActive =
              selectedCategory.toLowerCase() === cat.id.toLowerCase() ||
              (selectedCategory === 'all' && cat.id === 'all');
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  clearSelection();
                }}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#1C2C4F] text-[#1C2C4F]'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    isActive
                      ? 'bg-[#1C2C4F] text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Search, Filter, Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search files by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-8 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* File Type Filter */}
          <div className="relative">
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value as DriveFileTypeFilter)}
              className="h-10 pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
              aria-label="Filter by file type"
            >
              <option value="all">All File Types</option>
              <option value="image">Images & Photos</option>
              <option value="presentation">Slide Presentations</option>
              <option value="pdf">PDF Documents</option>
              <option value="document">Word / Text</option>
              <option value="spreadsheet">Spreadsheets</option>
            </select>
            <Layers className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 pl-3 pr-8 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
              aria-label="Sort files"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="name">Sort: Name (A–Z)</option>
              <option value="size">Sort: File Size</option>
            </select>
            <Clock className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          </div>

          {/* Grid / List toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#1C2C4F] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Visual Cards & Gallery view"
              aria-label="Visual Cards & Gallery view"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#1C2C4F] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Compact list view"
              aria-label="Compact list view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Count, Select All & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 px-1 font-medium gap-2">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong>{filteredFiles.length}</strong> of {files.length} approved files
          </span>
          {filteredFiles.length > 0 && (
            <button
              onClick={selectedFileIds.size === filteredFiles.length ? clearSelection : selectAllVisible}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              {selectedFileIds.size === filteredFiles.length
                ? 'Deselect all'
                : 'Select all visible'}
            </button>
          )}
        </div>
        <span className="flex items-center gap-1 text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Last synced {formatDate(lastUpdated)}</span>
        </span>
      </div>

      {/* 5. Files List / Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            {selectedCategory === 'images' ? (
              <Camera className="w-7 h-7 text-purple-500" />
            ) : selectedCategory === 'presentations' ? (
              <Presentation className="w-7 h-7 text-amber-500" />
            ) : (
              <FileText className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-base">
              {selectedCategory === 'images'
                ? 'No pictures published yet'
                : selectedCategory === 'presentations'
                ? 'No presentations published yet'
                : 'No files found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {selectedCategory === 'images'
                ? 'Be the first to share your photos from the convening! Upload them and organisers will approve them for the gallery.'
                : selectedCategory === 'presentations'
                ? 'Presenters can upload their slide decks here for attendees to download.'
                : 'No files match your current filters. Try resetting search or category filters.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => openUploadModal('pictures')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Upload Pictures</span>
            </button>
            <button
              onClick={() => openUploadModal('presentations')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C2C4F] text-white text-xs font-bold hover:bg-[#16233f] transition cursor-pointer"
            >
              <Presentation className="w-3.5 h-3.5 text-amber-300" />
              <span>Upload Presentation</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* VISUAL CARDS & GALLERY VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredFiles.map((file) => {
            const hasVisualPreview = isVisualMedia(file);
            const cardThumb = getCardThumbnailUrl(file);
            const isSelected = selectedFileIds.has(file.id);

            return (
              <div
                key={file.id}
                className={`group bg-white border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 relative ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 shadow-md bg-blue-50/10'
                    : 'border-slate-200/90 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                {/* Visual Preview Header (for images, presentations, or files with thumbnails) */}
                {hasVisualPreview && cardThumb ? (
                  <div
                    onClick={() => setPreviewFile(file)}
                    className="relative w-full aspect-[16/10] bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer select-none group/thumb"
                  >
                    <img
                      src={cardThumb}
                      alt={file.name}
                      className={`w-full h-full transition-transform duration-300 group-hover/thumb:scale-105 ${
                        file.fileTypeCategory === 'presentation'
                          ? 'object-contain p-2 bg-slate-900/5'
                          : 'object-cover'
                      }`}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const fallbackUrl = `/api/drive/download/${encodeURIComponent(file.id)}?inline=true`;
                        if (target.src !== fallbackUrl) {
                          target.src = fallbackUrl;
                        } else {
                          target.style.display = 'none';
                        }
                      }}
                    />

                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleSelectFile(file.id, e)}
                      title={isSelected ? 'Deselect' : 'Select for batch download'}
                      className={`absolute top-2.5 left-2.5 z-10 w-7 h-7 rounded-lg flex items-center justify-center transition shadow-xs cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white ring-2 ring-white'
                          : 'bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs'
                      }`}
                      aria-label="Select file"
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    {/* Category Badge */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-xs text-white">
                        {file.category}
                      </span>
                    </div>

                    {/* Hover Overlay with Preview Pill */}
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-900 text-xs font-bold shadow-md transform -translate-y-1 group-hover/thumb:translate-y-0 transition-transform">
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>Click to Preview</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Standard Top row for files without preview */
                  <div className="p-4 pb-0 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleSelectFile(file.id, e)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'border border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                        aria-label="Select file"
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                        {renderFileTypeIcon(file, 'w-5 h-5')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {file.category}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {file.formattedSize}
                      </span>
                    </div>
                  </div>
                )}

                {/* Card Content & Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    {hasVisualPreview && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-600">{file.formattedSize}</span>
                        <span>{formatDate(file.modifiedTime)}</span>
                      </div>
                    )}

                    <h4
                      className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-primary transition"
                      title={file.name}
                    >
                      {file.name}
                    </h4>

                    {file.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {file.description}
                      </p>
                    )}
                  </div>

                  {/* Actions: Download Single File & Preview Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    <a
                      href={`/api/drive/download/${encodeURIComponent(file.id)}`}
                      download
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-[#1C2C4F] text-white hover:bg-[#16233f] text-xs font-bold transition shadow-2xs"
                      title={`Download ${file.name}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {file.fileTypeCategory === 'image'
                          ? 'Download Image'
                          : file.fileTypeCategory === 'presentation'
                          ? 'Download Slides'
                          : file.downloadLabel}
                      </span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="h-9 px-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      title="Preview without downloading"
                      aria-label={`Preview ${file.name}`}
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">Preview</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 shadow-2xs overflow-hidden">
          {filteredFiles.map((file) => {
            const isSelected = selectedFileIds.has(file.id);
            const cardThumb = getCardThumbnailUrl(file);

            return (
              <div
                key={file.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => toggleSelectFile(file.id, e)}
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'border border-slate-300 text-transparent hover:border-slate-400'
                    }`}
                    aria-label="Select file"
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div
                    onClick={() => setPreviewFile(file)}
                    className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
                  >
                    {cardThumb ? (
                      <img
                        src={cardThumb}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      renderFileTypeIcon(file, 'w-5 h-5')
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4
                      onClick={() => setPreviewFile(file)}
                      className="font-bold text-slate-900 text-xs sm:text-sm truncate cursor-pointer hover:text-primary transition"
                      title={file.name}
                    >
                      {file.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-semibold text-slate-700">{file.category}</span>
                      <span>•</span>
                      <span>{file.formattedSize}</span>
                      <span>•</span>
                      <span>{formatDate(file.modifiedTime)}</span>
                      {file.description && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[200px] text-slate-400">{file.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="h-8 px-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Preview</span>
                  </button>
                  <a
                    href={`/api/drive/download/${encodeURIComponent(file.id)}`}
                    download
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#1C2C4F] text-white hover:bg-[#16233f] text-xs font-bold transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer notice */}
      <footer className="pt-4 text-center text-xs text-slate-400 space-y-1">
        <p>Approved files from the convening appear here automatically once reviewed by the organisers.</p>
      </footer>

      {/* Floating Multi-Download Action Bar */}
      {selectedFileIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1C2C4F] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-blue-900/40 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center">
              {selectedFileIds.size}
            </span>
            <span className="text-xs font-bold whitespace-nowrap">
              {selectedFileIds.size === 1 ? 'file selected' : 'files selected'}
            </span>
          </div>

          <button
            onClick={handleDownloadSelected}
            disabled={isDownloadingSelected}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {isDownloadingSelected ? 'Downloading...' : `Download Selected (${selectedFileIds.size})`}
            </span>
          </button>

          <button
            onClick={clearSelection}
            className="text-xs text-slate-300 hover:text-white underline cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 6. UPLOAD PICTURES & PRESENTATIONS MODAL */}
      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsUploadModalOpen(false);
          }}
        >
          <div
            ref={uploadModalRef}
            className="w-full max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1C2C4F] text-white flex items-center justify-center shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="upload-modal-title" className="font-extrabold text-slate-900 text-base">
                    Upload Pictures & Presentations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Share your media and session materials with convening participants
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Close upload dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Tabs */}
            <div className="p-6 space-y-5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setUploadModalTab('pictures')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    uploadModalTab === 'pictures'
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Upload Pictures</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUploadModalTab('presentations')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    uploadModalTab === 'presentations'
                      ? 'bg-white text-[#1C2C4F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Presentation className="w-4 h-4 text-amber-600" />
                  <span>Upload Presentation</span>
                </button>
              </div>

              {/* Tab 1: Pictures */}
              {uploadModalTab === 'pictures' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-purple-900">
                      <Camera className="w-4 h-4 text-purple-600" />
                      <span>Pictures & Photos Guidelines</span>
                    </div>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      <li>Supported formats: <strong>JPG, PNG, HEIC, WebP</strong></li>
                      <li>File size: Up to <strong>100 MB</strong> per photo</li>
                      <li>Select <strong>&quot;Images&quot;</strong> in the category field on the form</li>
                      <li>Submissions are reviewed by the organisers and published to the gallery</li>
                    </ul>
                  </div>

                  {uploadFormUrl ? (
                    <a
                      href={uploadFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition shadow-sm"
                    >
                      <span>Open Upload Form for Pictures</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-xs border border-amber-200">
                      Upload form is being configured. Please use direct email below.
                    </div>
                  )}

                  {/* Alternative Email Option */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500 mb-2">
                      Prefer email or don&apos;t have a Google account? Send your photos directly:
                    </p>
                    <a
                      href="mailto:comms@uncommon.org?subject=Oak%20Convening%20Upload%20-%20Pictures&body=Hi%20Oak%20Convening%20Team%2C%0A%0APlease%20find%20attached%20convening%20pictures%20to%20share%20in%20the%20gallery.%0A%0AName%3A%0AOrganisation%3A%0ADescription%3A"
                      className="inline-flex items-center gap-2 text-xs font-bold text-purple-700 hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email photos to comms@uncommon.org</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Tab 2: Presentations */}
              {uploadModalTab === 'presentations' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <Presentation className="w-4 h-4 text-amber-600" />
                      <span>Presentation Slides Guidelines</span>
                    </div>
                    <ul className="space-y-1 text-slate-600 list-disc list-inside">
                      <li>Supported formats: <strong>PowerPoint (.pptx, .ppt), PDF (.pdf), Keynote (.key), Google Slides link</strong></li>
                      <li>File size: Up to <strong>100 MB</strong> per slide deck</li>
                      <li>Select <strong>&quot;Presentations&quot;</strong> in the category field on the form</li>
                      <li>Approved slide decks will appear on the Presentations tab for attendees to view and download</li>
                    </ul>
                  </div>

                  {uploadFormUrl ? (
                    <a
                      href={uploadFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1C2C4F] hover:bg-[#16233f] text-white font-bold text-xs transition shadow-sm"
                    >
                      <span>Open Upload Form for Presentations</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-xs border border-amber-200">
                      Upload form is being configured. Please use direct email below.
                    </div>
                  )}

                  {/* Alternative Email Option */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500 mb-2">
                      Prefer email or don&apos;t have a Google account? Send your presentation directly:
                    </p>
                    <a
                      href="mailto:comms@uncommon.org?subject=Oak%20Convening%20Upload%20-%20Presentation%20Slides&body=Hi%20Oak%20Convening%20Team%2C%0A%0APlease%20find%20attached%20my%20presentation%20slides%20for%20the%20convening.%0A%0APresenter%20Name%3A%0ASession%20Title%3A%0AOrganisation%3A"
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#1C2C4F] hover:underline"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Email presentation slides to comms@uncommon.org</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. INTERACTIVE LIGHTBOX & PREVIEW MODAL */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewFile(null);
          }}
        >
          <div
            ref={modalRef}
            className="w-full max-w-5xl h-[90vh] bg-slate-900 text-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-800"
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/90">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-white shrink-0">
                  {renderFileTypeIcon(previewFile, 'w-4 h-4')}
                </div>
                <div className="min-w-0">
                  <h3
                    id="preview-modal-title"
                    className="font-bold text-white text-sm truncate"
                    title={previewFile.name}
                  >
                    {previewFile.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{previewFile.category}</span>
                    <span>•</span>
                    <span>{previewFile.formattedSize}</span>
                    {currentPreviewIndex >= 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 font-semibold">
                          File {currentPreviewIndex + 1} of {filteredFiles.length}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Mode toggle for presentations */}
                {previewFile.fileTypeCategory === 'presentation' && (
                  <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
                    <button
                      onClick={() => setPresentationMode('slide')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        presentationMode === 'slide'
                          ? 'bg-primary text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Slide View
                    </button>
                    <button
                      onClick={() => setPresentationMode('interactive')}
                      className={`px-2.5 py-1 rounded-md transition ${
                        presentationMode === 'interactive'
                          ? 'bg-primary text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Drive Viewer
                    </button>
                  </div>
                )}

                {/* Primary Download Button for this file */}
                <a
                  href={`/api/drive/download/${encodeURIComponent(previewFile.id)}`}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-sm"
                  title={`Download ${previewFile.name}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {previewFile.fileTypeCategory === 'image'
                      ? 'Download Image'
                      : previewFile.fileTypeCategory === 'presentation'
                      ? 'Download Slides'
                      : previewFile.downloadLabel}
                  </span>
                </a>

                {previewFile.webViewLink && (
                  <a
                    href={previewFile.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                    title="Open original in Google Drive"
                    aria-label="Open original in Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Close preview (Esc)"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body with Previous / Next Arrows */}
            <div className="flex-1 bg-slate-950 relative min-h-0 flex items-center justify-between overflow-hidden">
              {/* Previous button */}
              <button
                type="button"
                onClick={handlePrevPreview}
                disabled={currentPreviewIndex <= 0}
                className="absolute left-3 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer backdrop-blur-xs shadow-lg"
                title="Previous file (Left Arrow)"
                aria-label="Previous file"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Main Content Area */}
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto">
                {/* 1. Image Preview */}
                {previewFile.fileTypeCategory === 'image' ? (
                  <div className="max-h-full max-w-full flex flex-col items-center justify-center">
                    <img
                      src={getHighResPreviewUrl(previewFile)}
                      alt={previewFile.name}
                      className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const fallbackUrl = `/api/drive/download/${encodeURIComponent(previewFile.id)}?inline=true`;
                        if (target.src !== fallbackUrl) {
                          target.src = fallbackUrl;
                        } else {
                          setIframeError(true);
                        }
                      }}
                    />
                  </div>
                ) : previewFile.fileTypeCategory === 'presentation' && presentationMode === 'slide' && previewFile.thumbnailLink ? (
                  /* 2. Slide Cover / High-Res Slide Preview */
                  <div className="max-h-full max-w-full flex flex-col items-center justify-center space-y-4">
                    <img
                      src={getHighResPreviewUrl(previewFile)}
                      alt={previewFile.name}
                      className="max-h-[68vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setPresentationMode('interactive')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-2"
                      >
                        <Presentation className="w-3.5 h-3.5 text-amber-400" />
                        <span>Open Interactive Slide Viewer</span>
                      </button>
                    </div>
                  </div>
                ) : !iframeError ? (
                  /* 3. Interactive Drive Iframe Preview (PDF, Slides, Docs) */
                  <iframe
                    src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                    title={`Preview of ${previewFile.name}`}
                    className="w-full h-full border-0 rounded-xl bg-white"
                    allow="autoplay"
                    onError={() => setIframeError(true)}
                  />
                ) : (
                  /* Fallback when iframe cannot load */
                  <div className="text-center p-8 space-y-4 max-w-md bg-slate-900 border border-slate-800 rounded-3xl">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-base">Preview Not Supported in Window</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        This file format cannot be rendered directly inside the preview frame. You can download the file directly or view it in Google Drive.
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center gap-3">
                      <a
                        href={`/api/drive/download/${encodeURIComponent(previewFile.id)}`}
                        download
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download File</span>
                      </a>
                      {previewFile.webViewLink && (
                        <a
                          href={previewFile.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
                        >
                          Open in Drive
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Next button */}
              <button
                type="button"
                onClick={handleNextPreview}
                disabled={currentPreviewIndex >= filteredFiles.length - 1}
                className="absolute right-3 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer backdrop-blur-xs shadow-lg"
                title="Next file (Right Arrow)"
                aria-label="Next file"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Bottom Bar / Navigation Hint */}
            <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="hidden sm:inline">
                Use <strong>←</strong> and <strong>→</strong> arrow keys to browse • <strong>Esc</strong> to close
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  onClick={() => toggleSelectFile(previewFile.id)}
                  className="hover:text-white transition flex items-center gap-1 cursor-pointer"
                >
                  {selectedFileIds.has(previewFile.id) ? (
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {selectedFileIds.has(previewFile.id) ? 'Selected for download' : 'Select this file'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
