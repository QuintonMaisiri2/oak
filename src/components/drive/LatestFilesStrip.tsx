'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FolderOpen, Download, ArrowRight, FileText, Presentation, Image as ImageIcon } from 'lucide-react';
import { DriveFile } from '@/lib/drive/types';

export function LatestFilesStrip() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/drive/files')
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          setIsUnauthorized(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.files)) {
          // Sort newest and take top 3
          const sorted = (data.files as DriveFile[])
            .filter((f) => !f.isEventPhoto)
            .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
            .slice(0, 3);
          setFiles(sorted);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (isUnauthorized) {
    return null;
  }

  const renderIcon = (f: DriveFile) => {
    if (f.fileTypeCategory === 'presentation') return <Presentation className="w-4 h-4 text-amber-600" />;
    if (f.fileTypeCategory === 'image') return <ImageIcon className="w-4 h-4 text-purple-600" />;
    return <FileText className="w-4 h-4 text-blue-600" />;
  };

  return (
    <div className="w-full max-w-[608px] bg-white border border-slate-200/90 rounded-[24px] p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Shared Files & Resources</h3>
            <p className="text-[11px] text-slate-500">Access approved presentations and notes</p>
          </div>
        </div>

        <Link
          href="/drive"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          <span>View all</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 py-1">
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
          <p>No files published yet. Check back during convening sessions.</p>
          <Link href="/drive" className="inline-block mt-2 font-bold text-primary hover:underline">
            Go to Shared Files page
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
          {files.map((file) => (
            <div
              key={file.id}
              className="p-3 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-white border border-slate-200/80 shrink-0">
                  {renderIcon(file)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {file.category} • {file.formattedSize}
                  </p>
                </div>
              </div>

              <a
                href={`/api/drive/download/${encodeURIComponent(file.id)}`}
                download
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1C2C4F] text-white hover:bg-[#16233f] text-[11px] font-bold transition shrink-0 shadow-2xs"
                title={`Download ${file.name}`}
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Upload callout for attendees */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Have convening photos or slides?</span>
        <Link
          href="/drive?upload=pictures"
          className="font-bold text-primary hover:underline flex items-center gap-1"
        >
          <span>Upload pictures & slides</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
