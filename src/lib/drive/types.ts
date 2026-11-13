export type DriveFileCategory = 'Presentations' | 'Notes' | 'Images' | 'Other' | string;

export type DriveFileTypeFilter = 'all' | 'pdf' | 'presentation' | 'document' | 'spreadsheet' | 'image' | 'other';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  formattedSize: string;
  modifiedTime: string;
  description?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  category: DriveFileCategory;
  categoryFolderId?: string;
  fileTypeCategory: DriveFileTypeFilter;
  downloadLabel: string;
  canPreview: boolean;
  exportMimeType?: string;
  downloadExtension?: string;
  /** Event photo from the photographer's folder; shown only in its own day tab. */
  isEventPhoto?: boolean;
}

export interface DriveCategory {
  id: string;
  name: string;
  count: number;
}

export interface DriveListResult {
  configured: boolean;
  files: DriveFile[];
  categories: DriveCategory[];
  publishedFolderId?: string;
  incomingFolderId?: string;
  incomingFiles?: DriveFile[];
  uploadFormUrl?: string;
  lastUpdated: string;
  error?: string;
  missingVars?: string[];
}

export interface DriveDownloadMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  exportMimeType?: string;
  downloadFilename: string;
}

export interface ReviewDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  formattedSize: string;
  modifiedTime: string;
  createdTime?: string;
  description?: string;
  thumbnailLink?: string;
  fileTypeCategory: DriveFileTypeFilter;
  parentFolderId: string;
  parentFolderName?: string;
  uploaderName?: string;
  uploaderEmail?: string;
  canPreview: boolean;
  status: 'pending' | 'rejected' | 'approved';
  rejectionReason?: string;
}

export interface DriveHealthStatus {
  ok: boolean;
  isConfigured: boolean;
  serviceAccountEmail?: string;
  incomingFolder?: {
    id: string;
    name?: string;
    canAddChildren: boolean;
    canEdit: boolean;
    accessible: boolean;
    error?: string;
  };
  publishedFolder?: {
    id: string;
    name?: string;
    canAddChildren: boolean;
    canEdit: boolean;
    accessible: boolean;
    error?: string;
  };
  fixMessage?: string;
  missingVars?: string[];
}
