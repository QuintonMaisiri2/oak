'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  Download,
  Check,
  X,
  Trash2,
  Undo2,
  FileText,
  Presentation,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  Layers,
  Shield,
} from 'lucide-react';
import { ReviewDriveFile, DriveFileTypeFilter, DriveHealthStatus } from '@/lib/drive/types';
import { AuditLogEntry } from '@/lib/audit';

interface DriveReviewViewProps {
  initialFiles: ReviewDriveFile[];
  initialRejectedFiles?: ReviewDriveFile[];
  healthStatus: DriveHealthStatus;
  initialAuditLogs: AuditLogEntry[];
  isSuperAdmin: boolean;
  currentUserEmail: string;
}

export function DriveReviewView({
  initialFiles,
  initialRejectedFiles = [],
  healthStatus,
  initialAuditLogs,
  isSuperAdmin,
  currentUserEmail,
}: DriveReviewViewProps) {
  // Tabs: 'pending' | 'rejected'
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending');

  // Files state
  const [files, setFiles] = useState<ReviewDriveFile[]>(initialFiles);
  const [rejectedFiles, setRejectedFiles] = useState<ReviewDriveFile[]>(initialRejectedFiles);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialAuditLogs);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<DriveFileTypeFilter>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals & Dialogs
  const [previewFile, setPreviewFile] = useState<ReviewDriveFile | null>(null);
  const [approveModalFile, setApproveModalFile] = useState<ReviewDriveFile | null>(null);
  const [rejectModalFile, setRejectModalFile] = useState<ReviewDriveFile | null>(null);
  const [bulkApproveModalOpen, setBulkApproveModalOpen] = useState(false);
  const [bulkRejectModalOpen, setBulkRejectModalOpen] = useState(false);
  const [restoreModalFile, setRestoreModalFile] = useState<ReviewDriveFile | null>(null);
  const [deleteModalFile, setDeleteModalFile] = useState<ReviewDriveFile | null>(null);

  // Approve form state
  const [approveCategory, setApproveCategory] = useState<'Presentations' | 'Notes' | 'Images' | 'Other'>('Presentations');
  const [customFileName, setCustomFileName] = useState('');
  const [fileDescription, setFileDescription] = useState('');

  // Reject form state
  const [rejectionReason, setRejectionReason] = useState('');

  // Audit stream accordion
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const missingDriveSetupVars = healthStatus?.missingVars?.length ? healthStatus.missingVars : [];

  // Refresh data from server
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setNotification(null);
    try {
      const res = await fetch('/api/admin/drive/review');
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to refresh queue');
      }

      setFiles(data.files || []);
      if (data.recentAuditLogs) {
        setAuditLogs(data.recentAuditLogs);
      }

      if (isSuperAdmin) {
        const rejRes = await fetch('/api/admin/drive/review/rejected');
        const rejData = await rejRes.json();
        if (rejRes.ok && Array.isArray(rejData.files)) {
          setRejectedFiles(rejData.files);
        }
      }

      setSelectedIds(new Set());
      setNotification({
        type: 'success',
        message: 'Review queue refreshed successfully.',
      });
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to refresh review queue.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open single approve modal
  const handleOpenApproveModal = (file: ReviewDriveFile) => {
    setApproveModalFile(file);
    setCustomFileName(file.name);
    setFileDescription(file.description || '');

    // Default category based on file type
    if (file.fileTypeCategory === 'presentation') {
      setApproveCategory('Presentations');
    } else if (file.fileTypeCategory === 'image') {
      setApproveCategory('Images');
    } else if (file.fileTypeCategory === 'document' || file.fileTypeCategory === 'pdf') {
      setApproveCategory('Notes');
    } else {
      setApproveCategory('Other');
    }
  };

  // Submit single approve
  const handleConfirmApprove = async () => {
    if (!approveModalFile) return;
    setIsSubmitting(true);
    const targetFile = approveModalFile;

    try {
      const res = await fetch('/api/admin/drive/review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: targetFile.id,
          category: approveCategory,
          newName: customFileName.trim() || undefined,
          description: fileDescription.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve file');
      }

      // Optimistic state update: remove approved file from pending
      setFiles((prev) => prev.filter((f) => f.id !== targetFile.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetFile.id);
        return next;
      });

      setNotification({
        type: 'success',
        message: `Approved '${customFileName.trim() || targetFile.name}' into ${approveCategory}.`,
      });
      setApproveModalFile(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to approve file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit bulk approve
  const handleConfirmBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    const idsToApprove = Array.from(selectedIds);

    try {
      const res = await fetch('/api/admin/drive/review/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: idsToApprove,
          category: approveCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bulk approve failed');
      }

      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      setNotification({
        type: 'success',
        message: data.message || `Successfully approved ${idsToApprove.length} files into ${approveCategory}.`,
      });
      setBulkApproveModalOpen(false);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to execute bulk approval.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open single reject modal
  const handleOpenRejectModal = (file: ReviewDriveFile) => {
    setRejectModalFile(file);
    setRejectionReason('');
  };

  // Submit single reject
  const handleConfirmReject = async () => {
    if (!rejectModalFile) return;
    setIsSubmitting(true);
    const targetFile = rejectModalFile;

    try {
      const res = await fetch('/api/admin/drive/review/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: targetFile.id,
          reason: rejectionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject file');
      }

      // Move from pending to rejected
      setFiles((prev) => prev.filter((f) => f.id !== targetFile.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetFile.id);
        return next;
      });

      if (isSuperAdmin) {
        setRejectedFiles((prev) => [
          {
            ...targetFile,
            status: 'rejected',
            rejectionReason: rejectionReason.trim() || undefined,
          },
          ...prev,
        ]);
      }

      setNotification({
        type: 'info',
        message: `Moved '${targetFile.name}' to private Rejected folder.`,
      });
      setRejectModalFile(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to reject file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit bulk reject
  const handleConfirmBulkReject = async () => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    const idsToReject = Array.from(selectedIds);

    try {
      const res = await fetch('/api/admin/drive/review/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: idsToReject,
          reason: rejectionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bulk reject failed');
      }

      const movedFiles = files.filter((f) => selectedIds.has(f.id));
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());

      if (isSuperAdmin) {
        setRejectedFiles((prev) => [
          ...movedFiles.map((f) => ({
            ...f,
            status: 'rejected' as const,
            rejectionReason: rejectionReason.trim() || undefined,
          })),
          ...prev,
        ]);
      }

      setNotification({
        type: 'info',
        message: data.message || `Moved ${idsToReject.length} files to Rejected folder.`,
      });
      setBulkRejectModalOpen(false);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to bulk reject files.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit restore (Super Admin only)
  const handleConfirmRestore = async () => {
    if (!restoreModalFile) return;
    setIsSubmitting(true);
    const target = restoreModalFile;

    try {
      const res = await fetch('/api/admin/drive/review/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: target.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to restore file');
      }

      setRejectedFiles((prev) => prev.filter((f) => f.id !== target.id));
      setFiles((prev) => [{ ...target, status: 'pending' }, ...prev]);

      setNotification({
        type: 'success',
        message: `Restored '${target.name}' back to incoming review queue.`,
      });
      setRestoreModalFile(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to restore file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit permanent delete (Super Admin only)
  const handleConfirmDelete = async () => {
    if (!deleteModalFile) return;
    setIsSubmitting(true);
    const target = deleteModalFile;

    try {
      const res = await fetch('/api/admin/drive/review/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: target.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to permanently delete file');
      }

      setRejectedFiles((prev) => prev.filter((f) => f.id !== target.id));
      setNotification({
        type: 'info',
        message: `Permanently deleted '${target.name}' from Google Drive.`,
      });
      setDeleteModalFile(null);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete file.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/Deselect all visible
  const handleToggleSelectAll = (visibleIds: string[]) => {
    if (visibleIds.every((id) => selectedIds.has(id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Filtered & Sorted files
  const activeDataset = activeTab === 'pending' ? files : rejectedFiles;

  const filteredFiles = useMemo(() => {
    return activeDataset
      .filter((file) => {
        // Search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = file.name.toLowerCase().includes(q);
          const matchUploader = (file.uploaderName || '').toLowerCase().includes(q);
          const matchFolder = (file.parentFolderName || '').toLowerCase().includes(q);
          if (!matchName && !matchUploader && !matchFolder) return false;
        }

        // File type filter
        if (fileTypeFilter !== 'all') {
          if (file.fileTypeCategory !== fileTypeFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'size') {
          return b.size - a.size;
        }
        return 0;
      });
  }, [activeDataset, searchQuery, fileTypeFilter, sortBy]);

  const allVisibleSelected =
    filteredFiles.length > 0 && filteredFiles.every((f) => selectedIds.has(f.id));

  // Render icon
  const renderFileIcon = (category: DriveFileTypeFilter) => {
    switch (category) {
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

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Unknown';
    try {
      return new Date(isoString).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="page-container space-y-6">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] border border-amber-500/25 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-24 bottom-0 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/drive"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Drive Overview</span>
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
                <Clock className="w-3 h-3 text-blue-300" />
                MODERATION QUEUE
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-blue-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <FolderOpen className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Review & Approve Uploads
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Moderate attendee files, preview documents, publish to gallery categories, or archive rejected uploads.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Queue'}</span>
            </button>
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition shadow-sm"
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Trail</span>
            </Link>
            <Link
              href="/admin/drive"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition shadow-md"
            >
              <span>Published Files</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Health Status & Write Access Card */}
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
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Recent Activity Accordion (10 most recent review actions) */}
      {auditLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => setShowAuditLogs(!showAuditLogs)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-slate-900">
                Recent Review History ({auditLogs.length} actions)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>{showAuditLogs ? 'Hide history' : 'Show history'}</span>
              {showAuditLogs ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {showAuditLogs && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-64 overflow-y-auto">
              {auditLogs.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="p-3 px-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        log.action === 'drive_file_approved'
                          ? 'bg-emerald-500'
                          : log.action === 'drive_file_rejected'
                          ? 'bg-amber-500'
                          : log.action === 'drive_file_deleted'
                          ? 'bg-red-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <span className="font-bold text-slate-900">
                      {log.details?.file_name || 'File'}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {log.action === 'drive_file_approved' && (
                        <span>
                          published to <strong>{log.details?.destination_category || 'Published'}</strong>
                        </span>
                      )}
                      {log.action === 'drive_file_rejected' && (
                        <span>
                          moved to Rejected ({log.details?.reason || 'no reason'})
                        </span>
                      )}
                      {log.action === 'drive_file_restored' && <span>restored to queue</span>}
                      {log.action === 'drive_file_deleted' && <span>permanently deleted</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>{log.actor_email}</span>
                    <span>•</span>
                    <span>{formatDate(log.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Review Section Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('pending');
              setSelectedIds(new Set());
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Review</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                activeTab === 'pending'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {files.length}
            </span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => {
                setActiveTab('rejected');
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'rejected'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Rejected Archives</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                  activeTab === 'rejected'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {rejectedFiles.length}
              </span>
            </button>
          )}
        </div>

        <Link
          href="/drive"
          target="_blank"
          className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
        >
          <span>View Public Gallery</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Search, Filters, and Bulk Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by file name or uploader..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <select
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value as DriveFileTypeFilter)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All File Types</option>
              <option value="presentation">Presentations</option>
              <option value="image">Images</option>
              <option value="pdf">PDF Documents</option>
              <option value="document">Word/Docs</option>
              <option value="spreadsheet">Spreadsheets</option>
              <option value="other">Other Files</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Largest)</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (if activeTab is pending and items selected) */}
        {activeTab === 'pending' && selectedIds.size > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">
                {selectedIds.size}
              </span>
              <span className="text-xs font-bold text-slate-900">
                files selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 underline ml-2 cursor-pointer"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkApproveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected</span>
              </button>

              <button
                onClick={() => setBulkRejectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject Selected</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {missingDriveSetupVars.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-extrabold">Drive approval setup is incomplete.</p>
              <p className="text-xs mt-1 leading-relaxed">
                Missing required variable names: {missingDriveSetupVars.join(', ')}. Add them in the app environment for this deployment, then redeploy or refresh the page.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Header with Select All */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-3">
            {activeTab === 'pending' && (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  handleToggleSelectAll(filteredFiles.map((f) => f.id))
                }
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            )}
            <span>File Details</span>
          </div>
          <span>Actions</span>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FolderOpen className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {activeTab === 'pending'
                ? 'No pending files in the review queue'
                : 'No rejected files archived'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'pending'
                ? 'When attendees upload presentations, photos, or documents through the Google Form, they will appear here.'
                : 'Rejected files are kept here privately and can be restored or permanently removed by a Super Admin.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredFiles.map((file) => {
              const isSelected = selectedIds.has(file.id);

              return (
                <div
                  key={file.id}
                  className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSelected ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {activeTab === 'pending' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(file.id)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer mt-1"
                      />
                    )}

                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                      {renderFileIcon(file.fileTypeCategory)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {file.name}
                        </span>
                        {file.description && (
                          <span className="text-[10px] text-slate-400 italic truncate max-w-xs">
                            — {file.description}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider px-2 py-0.5 bg-slate-100 rounded-md">
                          {file.fileTypeCategory}
                        </span>
                        <span>•</span>
                        <span>{file.formattedSize}</span>
                        <span>•</span>
                        <span>{formatDate(file.modifiedTime)}</span>
                        {file.parentFolderName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-600 font-medium">
                              {file.parentFolderName}
                            </span>
                          </>
                        )}
                        {file.uploaderName && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-semibold">
                              by {file.uploaderName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Preview Button (streams via /api/admin/drive/stream/[fileId]) */}
                    {file.canPreview && (
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs cursor-pointer"
                        title="Preview file"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Preview</span>
                      </button>
                    )}

                    {/* Download Button */}
                    <a
                      href={`/api/admin/drive/stream/${file.id}?download=true`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Download</span>
                    </a>

                    {activeTab === 'pending' ? (
                      <>
                        {/* Approve Button */}
                        <button
                          onClick={() => handleOpenApproveModal(file)}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          onClick={() => handleOpenRejectModal(file)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-bold transition shadow-2xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      isSuperAdmin && (
                        <>
                          {/* Restore Button (Super Admin Only) */}
                          <button
                            onClick={() => setRestoreModalFile(file)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>

                          {/* Delete Button (Super Admin Only) */}
                          <button
                            onClick={() => setDeleteModalFile(file)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* IN-APP PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                {renderFileIcon(previewFile.fileTypeCategory)}
                <span className="text-sm font-bold text-slate-900 truncate">
                  {previewFile.name}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({previewFile.formattedSize})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/admin/drive/stream/${previewFile.id}?download=true`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] bg-slate-950/5">
              {previewFile.fileTypeCategory === 'image' ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/admin/drive/stream/${previewFile.id}`}
                  alt={previewFile.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : previewFile.fileTypeCategory === 'pdf' ? (
                <iframe
                  src={`/api/admin/drive/stream/${previewFile.id}#view=FitH`}
                  title={previewFile.name}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 bg-white"
                />
              ) : (
                <div className="text-center space-y-3 py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
                    {renderFileIcon(previewFile.fileTypeCategory)}
                  </div>
                  <p className="text-sm font-bold text-slate-800">{previewFile.name}</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    In-browser preview is available for images and PDFs. Download this file to inspect it in full.
                  </p>
                  <a
                    href={`/api/admin/drive/stream/${previewFile.id}?download=true`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download to Inspect</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE APPROVE MODAL */}
      {/* ========================================================================= */}
      {approveModalFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setApproveModalFile(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Approve & Publish File
              </h3>
              <button
                onClick={() => setApproveModalFile(null)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Published Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Presentations', 'Notes', 'Images', 'Other'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setApproveCategory(cat)}
                      className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                        approveCategory === cat
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  File Name
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Caption (Optional)
                </label>
                <textarea
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  rows={2}
                  placeholder="e.g. Closing keynote slides by Jane Doe..."
                  className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveModalFile(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK APPROVE MODAL */}
      {/* ========================================================================= */}
      {bulkApproveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setBulkApproveModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Bulk Approve {selectedIds.size} Files
              </h3>
              <button
                onClick={() => setBulkApproveModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Select the destination category for all {selectedIds.size} selected files. They will be moved to Published immediately.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Destination Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['Presentations', 'Notes', 'Images', 'Other'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setApproveCategory(cat)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      approveCategory === cat
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkApproveModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBulkApprove}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve All {selectedIds.size} Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE REJECT MODAL */}
      {/* ========================================================================= */}
      {rejectModalFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setRejectModalFile(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Reject File
              </h3>
              <button
                onClick={() => setRejectModalFile(null)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Moving &apos;{rejectModalFile.name}&apos; to the private Rejected folder. The file will not appear in the public gallery.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="e.g. Duplicate slide, blurry photo, test submission..."
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalFile(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Moving...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Move to Rejected</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BULK REJECT MODAL */}
      {/* ========================================================================= */}
      {bulkRejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setBulkRejectModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                Reject {selectedIds.size} Files
              </h3>
              <button
                onClick={() => setBulkRejectModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to move {selectedIds.size} files to the private Rejected folder?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="e.g. Bulk cleanup of test submissions..."
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkRejectModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmBulkReject}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Moving...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Reject {selectedIds.size} Files</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESTORE MODAL (Super Admin Only) */}
      {/* ========================================================================= */}
      {restoreModalFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setRestoreModalFile(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-900">
              Restore File to Review Queue?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              &apos;{restoreModalFile.name}&apos; will be moved back from the Rejected archives into the active incoming review queue.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreModalFile(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Restore to Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PERMANENT DELETE MODAL (Super Admin Only) */}
      {/* ========================================================================= */}
      {deleteModalFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setDeleteModalFile(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-red-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-extrabold text-slate-900">
                Permanently Delete File?
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action cannot be undone. &apos;{deleteModalFile.name}&apos; will be deleted permanently from Google Drive.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalFile(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
