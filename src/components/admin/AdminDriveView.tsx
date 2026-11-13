'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HardDrive,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileText,
  Presentation,
  Image as ImageIcon,
  Clock,
  Download,
  Upload,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  File,
  Info,
  ShieldCheck,
  ShieldAlert,
  Shield,
  ArrowLeft,
  ChevronDown,
  LayoutGrid,
  List,
} from 'lucide-react';
import { DriveFile, DriveCategory, DriveHealthStatus } from '@/lib/drive/types';

interface AdminDriveViewProps {
  initialFiles: DriveFile[];
  initialCategories: DriveCategory[];
  configured: boolean;
  publishedFolderId?: string;
  incomingFolderId?: string;
  incomingFiles?: DriveFile[];
  uploadFormUrl?: string;
  lastUpdated: string;
  initialError?: string;
  missingVars?: string[];
  isSuperAdmin?: boolean;
  healthStatus?: DriveHealthStatus;
  pendingCount?: number;
}

export function AdminDriveView({
  initialFiles,
  initialCategories,
  configured,
  publishedFolderId,
  incomingFolderId,
  incomingFiles: initialIncomingFiles = [],
  uploadFormUrl,
  lastUpdated: initialLastUpdated,
  initialError,
  missingVars = [],
  isSuperAdmin = false,
  healthStatus,
  pendingCount = 0,
}: AdminDriveViewProps) {
  const [files, setFiles] = useState<DriveFile[]>(initialFiles);
  const [incomingFiles, setIncomingFiles] = useState<DriveFile[]>(initialIncomingFiles);
  const [categories, setCategories] = useState<DriveCategory[]>(initialCategories);
  const [lastUpdated, setLastUpdated] = useState<string>(initialLastUpdated);
  const [error, setError] = useState<string | undefined>(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  // Published files layout and which sections are folded. Day photo sections start folded (they are large).
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const INCOMING = "__incoming__";
  const isCollapsed = (name: string) => collapsed[name] ?? /photos?$/i.test(name);
  const toggleSection = (name: string) => setCollapsed((prev) => ({ ...prev, [name]: !isCollapsed(name) }));

  // Group published files by their folder (category), following the category order, empty ones hidden.
  const publishedSections = (() => {
    const order = categories.filter((c) => c.id !== "all").map((c) => c.name);
    for (const f of files) if (!order.includes(f.category)) order.push(f.category);
    return order
      .map((name) => ({ name, files: files.filter((f) => f.category === name) }))
      .filter((section) => section.files.length > 0);
  })();

  const thumbFor = (file: DriveFile, size: number) =>
    file.thumbnailLink
      ? file.thumbnailLink.replace(/=s\d+$/, `=s${size}`)
      : file.fileTypeCategory === "image"
      ? `/api/drive/download/${encodeURIComponent(file.id)}?inline=true`
      : undefined;

  const sectionIcon = (name: string) => {
    if (/present/i.test(name)) return <Presentation className="w-4 h-4 text-amber-600" />;
    if (/note/i.test(name)) return <FileText className="w-4 h-4 text-blue-600" />;
    if (/image|photo/i.test(name)) return <ImageIcon className="w-4 h-4 text-purple-600" />;
    return <FolderOpen className="w-4 h-4 text-slate-500" />;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/drive/refresh', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to refresh Drive cache');
      }

      setFiles(data.data?.files || []);
      setIncomingFiles(data.data?.incomingFiles || []);
      setCategories(data.data?.categories || []);
      setLastUpdated(data.data?.lastUpdated || new Date().toISOString());
      setError(data.data?.error);
      setNotification({
        type: 'success',
        message: 'Google Drive cache was refreshed and synced successfully.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to refresh Drive cache',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      return new Date(isoString).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const renderFileIcon = (file: DriveFile) => {
    switch (file.fileTypeCategory) {
      case 'presentation':
        return <Presentation className="w-4 h-4 text-amber-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-purple-600" />;
      case 'document':
      case 'pdf':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'spreadsheet':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      default:
        return <File className="w-4 h-4 text-slate-500" />;
    }
  };

  const driveFolderUrl = publishedFolderId
    ? `https://drive.google.com/drive/folders/${publishedFolderId}`
    : 'https://drive.google.com/drive/folders/1g7OpDOroSaNcfSumoH0fy-oGeQo13Kbn';

  const incomingFolderUrl = incomingFolderId
    ? `https://drive.google.com/drive/folders/${incomingFolderId}`
    : 'https://drive.google.com/drive/folders/1tEB0aC4m5AXNapFlZKMstib75F-YE1Avj7Msjh97D6x9YWCy3Ov2I-D2R9TVaQTkxoDDHPak';

  const allPreviewable = [...files, ...incomingFiles];
  const currentPreviewIndex = previewFile ? allPreviewable.findIndex((f) => f.id === previewFile.id) : -1;

  const handlePrev = () => {
    if (currentPreviewIndex > 0) {
      setPreviewFile(allPreviewable[currentPreviewIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentPreviewIndex >= 0 && currentPreviewIndex < allPreviewable.length - 1) {
      setPreviewFile(allPreviewable[currentPreviewIndex + 1]);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] border border-amber-500/25 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-24 bottom-0 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
              {isSuperAdmin && (
                <>
                  <span className="text-slate-500">•</span>
                  <Link
                    href="/admin?view=super"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 transition"
                  >
                    <Shield className="w-3 h-3 text-amber-300" />
                    SUPER ADMIN ACCESS
                  </Link>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/30">
                <HardDrive className="w-3 h-3 text-blue-300" />
                SHARED FILES STORAGE
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-blue-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <HardDrive className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Google Drive Integration & Sync
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Manage published Convening assets, sync cache, monitor service account write health, and review uploads.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/admin/drive/review"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition shadow-md"
            >
              <Clock className="w-4 h-4 text-slate-950" />
              <span>Review Uploads</span>
              {(pendingCount > 0 || incomingFiles.length > 0) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-950 text-amber-300">
                  {pendingCount || incomingFiles.length}
                </span>
              )}
            </Link>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Refresh Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drive Write Access card: only shown when setup needs attention */}
      {healthStatus && !healthStatus.ok && (
        <div
          className={`p-4 rounded-2xl border transition ${
            healthStatus.ok
              ? 'bg-emerald-50/70 border-emerald-200/90'
              : 'bg-amber-50/80 border-amber-200/90'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  healthStatus.ok
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {healthStatus.ok ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Drive Write Access
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      healthStatus.ok
                        ? 'bg-emerald-200/60 text-emerald-800'
                        : 'bg-amber-200/60 text-amber-800'
                    }`}
                  >
                    {healthStatus.ok ? 'Verified & Active' : 'Setup Required'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {healthStatus.ok
                    ? `Authenticated as ${healthStatus.serviceAccountEmail || 'Service Account'} with Editor permissions on Incoming and Published folders.`
                    : healthStatus.fixMessage ||
                      `Service account needs Editor access to move files. Service Account: ${healthStatus.serviceAccountEmail || 'not set'}.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              {healthStatus.serviceAccountEmail && (
                <span className="text-[11px] font-mono text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  {healthStatus.serviceAccountEmail}
                </span>
              )}
              <Link
                href="/admin/drive/review"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C2C4F] text-white hover:bg-[#16233f] text-xs font-bold transition shadow-xs"
              >
                <span>Review Uploads</span>
                <ExternalLink className="w-3 h-3 text-slate-300" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Status Grid - Super Admin Only */}
      {isSuperAdmin && (!configured || error || missingVars.length > 0) && (
        <div role="alert" className="p-4 rounded-2xl border border-amber-200 bg-amber-50/80 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{configured ? "Shared files could not be loaded from Google Drive." : "Shared files are not configured."}</p>
            {missingVars.length > 0 && <p className="font-mono">Missing {missingVars.join(" or ")}.</p>}
            {error && <p>{error}</p>}
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 2: Cache & Sync Status */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cache & Sync
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-900">
                {formatDate(lastUpdated)}
              </div>
              <p className="text-[11px] text-slate-500">
                Next.js 60-second caching active to minimize Google API quota usage.
              </p>
            </div>
          </div>

          {/* Card 3: Quick Links */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Quick Actions
            </span>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-200/80 transition"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  <span>Open Published Folder in Drive</span>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              <a
                href={incomingFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/70 text-xs font-semibold text-amber-900 border border-amber-200 transition"
              >
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Open Incoming Uploads Folder</span>
                </div>
                {incomingFiles.length > 0 ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-200 text-amber-800">
                    {incomingFiles.length} pending
                  </span>
                ) : (
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                )}
              </a>

              {uploadFormUrl && (
                <a
                  href={uploadFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-200/80 transition"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Open Upload Google Form</span>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uploads & Review Workflow Banner */}
      <div className="bg-gradient-to-r from-blue-50/90 to-slate-50 border border-blue-100 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
            <Upload className="w-4 h-4 text-primary" />
            <span>Attendee Uploads & Approvals Workflow</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
            Attendees and speakers submit pictures and presentation slides via the public Google Form. Submissions land in the form responses folder. To publish files to the public attendee gallery, move them into <strong>Published/Images</strong> or <strong>Published/Presentations</strong> in Google Drive, then click <strong>Refresh Now</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <a
            href={incomingFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-100" />
            <span>Open Incoming Uploads</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-200" />
          </a>

          {uploadFormUrl && (
            <a
              href={uploadFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-xs font-bold transition shadow-2xs whitespace-nowrap"
            >
              <span>Upload Form</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}
        </div>
      </div>

      {/* Incoming Submissions (Awaiting Approval) Section */}
      <div className="bg-white rounded-2xl border border-amber-200/90 shadow-2xs overflow-hidden">
        <div className={`p-5 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isCollapsed(INCOMING) ? "" : "border-b border-amber-100"}`}>
          <button type="button" onClick={() => toggleSection(INCOMING)} aria-expanded={!isCollapsed(INCOMING)} className="flex items-center gap-3 text-left cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Incoming Submissions (Awaiting Approval)
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  {incomingFiles.length} {incomingFiles.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Files uploaded by attendees via Google Form land here for moderation before going live.
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isCollapsed(INCOMING) ? "" : "rotate-180"}`} />
          </button>

          <a
            href={incomingFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs whitespace-nowrap self-start sm:self-center"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-300" />
            <span>Open Folder in Drive</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>

        {!isCollapsed(INCOMING) && (<>
        {incomingFiles.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">All submissions have been reviewed!</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              There are no pending submissions in the form upload folder. When an attendee uploads a presentation or photo, it will appear here for review.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomingFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 hover:bg-amber-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200/60">
                    {renderFileIcon(file)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {file.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider px-2 py-0.5 bg-slate-100 rounded-md">
                        {file.fileTypeCategory}
                      </span>
                      <span>•</span>
                      <span>{file.formattedSize}</span>
                      <span>•</span>
                      <span>Submitted {formatDate(file.modifiedTime)}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                        <Clock className="w-3 h-3" />
                        Pending approval
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {file.canPreview && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Preview</span>
                    </button>
                  )}

                  <a
                    href={
                      file.categoryFolderId
                        ? `https://drive.google.com/drive/folders/${file.categoryFolderId}`
                        : `https://drive.google.com/drive/folders/${incomingFolderId || file.id}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1C2C4F] hover:bg-[#16233f] text-white text-xs font-bold transition shadow-xs"
                  >
                    <span>Open Folder in Drive</span>
                    <ExternalLink className="w-3 h-3 text-slate-300" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-3.5 bg-amber-50/60 border-t border-amber-100 text-[11px] text-amber-950 flex items-start sm:items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-amber-700 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            <strong>Approval Workflow:</strong> Use <strong>Review Uploads</strong> to approve files automatically, or click <strong>Open Folder in Drive</strong> to inspect the upload in Google Drive before moving it manually. After approval or manual placement, click <strong>Refresh Now</strong> above to publish it to the public gallery.
          </span>
        </div>
        </>)}
      </div>

      {/* Published files, one collapsible section per category (Presentations, Notes, Images, Day N Photos, ...) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-900">
            Published Files ({files.length})
          </h3>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs" role="group" aria-label="File layout">
              {(['grid', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                    viewMode === mode ? 'bg-[#1C2C4F] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  <span>{mode === 'grid' ? 'Grid' : 'List'}</span>
                </button>
              ))}
            </div>
            <Link
              href="/drive"
              target="_blank"
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>View Public /drive Page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-xs text-slate-500">
            No published files found. Move files into the Published folder or its subfolders in Google Drive to approve them.
          </div>
        ) : (
          publishedSections.map(({ name, files: sectionFiles }) => {
            const open = !isCollapsed(name);
            return (
              <section key={name} className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(name)}
                  aria-expanded={open}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                      {sectionIcon(name)}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {sectionFiles.length}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  viewMode === 'grid' ? (
                    <div className="border-t border-slate-100 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {sectionFiles.map((file) => {
                        const thumb = thumbFor(file, 400);
                        return (
                          <div key={file.id} className="group flex flex-col rounded-xl border border-slate-200/80 bg-white overflow-hidden hover:shadow-sm transition">
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                              title="Click to preview"
                            >
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={file.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="scale-150">{renderFileIcon(file)}</span>
                              )}
                            </button>
                            <div className="p-2.5 flex flex-col gap-1.5 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>{file.name}</p>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>{file.formattedSize}</span>
                                <span className="flex items-center gap-1">
                                  <a
                                    href={`/api/drive/download/${encodeURIComponent(file.id)}`}
                                    download
                                    aria-label={`Download ${file.name}`}
                                    className="p-1 rounded-md text-slate-500 hover:text-primary hover:bg-slate-100"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  {file.webViewLink && (
                                    <a
                                      href={file.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`Open ${file.name} in Drive`}
                                      className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full min-w-[720px] table-fixed text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4 w-20">Preview</th>
                            <th className="py-3 px-4">File Name</th>
                            <th className="py-3 px-4 w-24">Size</th>
                            <th className="py-3 px-4 w-44">Modified</th>
                            <th className="py-3 px-4 w-64 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sectionFiles.map((file) => {
                            const thumb = thumbFor(file, 300);
                            return (
                              <tr key={file.id} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-4 whitespace-nowrap">
                                  <div
                                    onClick={() => setPreviewFile(file)}
                                    className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition"
                                    title="Click to preview"
                                  >
                                    {thumb ? (
                                      <img
                                        src={thumb}
                                        alt={file.name}
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      renderFileIcon(file)
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900 max-w-xs truncate" title={file.name}>
                                  <button
                                    onClick={() => setPreviewFile(file)}
                                    className="hover:text-primary transition text-left cursor-pointer truncate block max-w-full"
                                  >
                                    {file.name}
                                  </button>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-slate-600">{file.formattedSize}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-slate-500">{formatDate(file.modifiedTime)}</td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-primary mr-3 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Preview</span>
                                  </button>
                                  <a
                                    href={`/api/drive/download/${encodeURIComponent(file.id)}`}
                                    download
                                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mr-3"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>
                                  {file.webViewLink && (
                                    <a
                                      href={file.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                                    >
                                      <span>Drive</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Admin Preview Modal */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewFile(null);
          }}
        >
          <div className="w-full max-w-5xl h-[88vh] bg-slate-900 text-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-800">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-white shrink-0">
                  {renderFileIcon(previewFile)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{previewFile.category}</span>
                    <span>•</span>
                    <span>{previewFile.formattedSize}</span>
                    {currentPreviewIndex >= 0 && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400">
                          {currentPreviewIndex + 1} of {files.length}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/drive/download/${encodeURIComponent(previewFile.id)}`}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>

                {previewFile.webViewLink && (
                  <a
                    href={previewFile.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition"
                    title="Open in Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-950 relative min-h-0 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentPreviewIndex <= 0}
                className="absolute left-3 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="w-full h-full flex items-center justify-center p-4 sm:p-8 overflow-auto">
                {previewFile.fileTypeCategory === 'image' ? (
                  <img
                    src={
                      previewFile.thumbnailLink
                        ? previewFile.thumbnailLink.replace(/=s\d+$/, '=s1600')
                        : `/api/drive/download/${encodeURIComponent(previewFile.id)}?inline=true`
                    }
                    alt={previewFile.name}
                    className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <iframe
                    src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                    title={`Preview of ${previewFile.name}`}
                    className="w-full h-full border-0 rounded-xl bg-white"
                    allow="autoplay"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentPreviewIndex >= files.length - 1}
                className="absolute right-3 z-30 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-lg"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
