import {
  DriveFile,
  DriveCategory,
  DriveListResult,
  DriveDownloadMetadata,
  DriveFileCategory,
  DriveFileTypeFilter,
} from './types';
import { driveFetch, hasServiceAccountReadAccess } from './read-auth';

// In-memory 60-second cache
interface CachedDriveData {
  timestamp: number;
  result: DriveListResult;
  effectivePublishedFolderId: string;
  allowedFolderIds: Set<string>;
  fileMetadataMap: Map<string, DriveDownloadMetadata>;
}

let memoryCache: CachedDriveData | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Validates that a Google Drive file ID matches safe characters.
 */
export function isValidDriveId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,120}$/.test(id);
}

/**
 * Checks if an environment variable is empty or contains a template placeholder.
 */
export function isPlaceholderOrEmpty(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.startsWith('paste_') ||
    lower.startsWith('your-') ||
    lower.startsWith('your_') ||
    lower.includes('placeholder') ||
    lower.startsWith('xxx') ||
    lower === 'changeme'
  );
}

/**
 * Returns configuration settings safely without exposing secrets.
 */
export function getDriveConfig() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY?.trim() || '';
  const rootFolderId =
    process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID?.trim() ||
    '1g7OpDOroSaNcfSumoH0fy-oGeQo13Kbn';
  const uploadsFolderId =
    process.env.GOOGLE_DRIVE_INCOMING_FOLDER_ID?.trim() ||
    process.env.GOOGLE_DRIVE_UPLOADS_FOLDER_ID?.trim() ||
    '1tEB0aC4m5AXNapFlZKMstib75F-YE1Avj7Msjh97D6x9YWCy3Ov2I-D2R9TVaQTkxoDDHPak';
  const uploadFormUrl = process.env.NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL?.trim() || '';
  const maxDownloadMb = Math.max(
    1,
    parseInt(process.env.MAX_DOWNLOAD_MB || '100', 10) || 100
  );

  // Either a service account (private folder, recommended) or an API key (public folder) can read Drive.
  const usesServiceAccount = hasServiceAccountReadAccess();
  const missingVars: string[] = [];
  if (!usesServiceAccount && isPlaceholderOrEmpty(apiKey)) {
    missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_DRIVE_API_KEY)');
  }
  if (isPlaceholderOrEmpty(rootFolderId)) {
    missingVars.push('GOOGLE_DRIVE_PUBLISHED_FOLDER_ID');
  }

  const isConfigured = missingVars.length === 0;

  return {
    apiKey,
    usesServiceAccount,
    rootFolderId,
    uploadsFolderId,
    uploadFormUrl,
    maxDownloadMb,
    isConfigured,
    missingVars,
  };
}

/**
 * Formats byte size into human-readable format.
 */
export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return 'Document';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

/**
 * Sanitizes a filename for Content-Disposition header.
 */
export function sanitizeFilename(name: string, fallback = 'file'): string {
  const clean = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
}

/**
 * Resolves file type category for filtering.
 */
export function determineFileTypeCategory(
  mimeType: string,
  fileName: string
): DriveFileTypeFilter {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  if (
    lowerMime.includes('presentation') ||
    lowerMime === 'application/vnd.google-apps.presentation' ||
    /\.(pptx?|key)$/.test(lowerName)
  ) {
    return 'presentation';
  }
  if (
    lowerMime.includes('document') ||
    lowerMime === 'application/vnd.google-apps.document' ||
    /\.(docx?|odt|rtf|txt|md)$/.test(lowerName)
  ) {
    return 'document';
  }
  if (
    lowerMime.includes('spreadsheet') ||
    lowerMime === 'application/vnd.google-apps.spreadsheet' ||
    /\.(xlsx?|ods|csv)$/.test(lowerName)
  ) {
    return 'spreadsheet';
  }
  if (
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(lowerName)
  ) {
    return 'image';
  }
  return 'other';
}

/**
 * Resolves download export details for Google Docs / Sheets / Slides.
 */
export function resolveDownloadDetails(mimeType: string, originalName: string) {
  let exportMimeType: string | undefined;
  let downloadExtension: string | undefined;
  let downloadLabel = 'Download';

  if (mimeType === 'application/vnd.google-apps.presentation') {
    exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    downloadExtension = '.pptx';
    downloadLabel = 'Download as PPTX';
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    downloadExtension = '.xlsx';
    downloadLabel = 'Download as XLSX';
  } else if (mimeType === 'application/vnd.google-apps.document') {
    exportMimeType = 'application/pdf';
    downloadExtension = '.pdf';
    downloadLabel = 'Download as PDF';
  }

  let finalName = originalName;
  if (downloadExtension && !originalName.toLowerCase().endsWith(downloadExtension)) {
    finalName = `${originalName}${downloadExtension}`;
  }

  return { exportMimeType, downloadExtension, downloadLabel, finalName };
}

/**
 * Determines whether a file can be embedded and previewed.
 */
export function canPreviewFile(mimeType: string, fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  return (
    lowerMime === 'application/pdf' ||
    lowerName.endsWith('.pdf') ||
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName) ||
    lowerMime.startsWith('application/vnd.google-apps.') ||
    lowerMime.includes('presentation') ||
    /\.(pptx?|key)$/.test(lowerName)
  );
}

/**
 * Returns a higher-resolution thumbnail URL for images, slides, and docs.
 * Google Drive thumbnail URLs end with `=s220` by default; replacing with `=s800` or `=s1200`
 * returns crisp, high-resolution previews for cards and lightboxes.
 */
export function getHighResThumbnailUrl(thumbnailLink?: string, size = 800): string | undefined {
  if (!thumbnailLink) return undefined;
  if (/=s\d+$/.test(thumbnailLink)) {
    return thumbnailLink.replace(/=s\d+$/, `=s${size}`);
  }
  return thumbnailLink;
}

/**
 * Low-level query to Google Drive API v3 files.list.
 */
async function fetchDriveFolderFiles(
  folderId: string,
  apiKey: string
): Promise<{ files: any[]; folders: any[] }> {
  const fields =
    'nextPageToken,files(id,name,mimeType,size,modifiedTime,description,thumbnailLink,webViewLink,parents)';
  let pageToken: string | undefined = undefined;
  const allRawFiles: any[] = [];

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('orderBy', 'folder,name');
    url.searchParams.set('pageSize', '100');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const res = await driveFetch(url, apiKey, {
      // 60-second Next.js revalidation cache (ignored for service-account requests)
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      const status = res.status;
      const message = errorJson.error?.message || res.statusText;
      console.error(`[Google Drive API error ${status}]`, message);

      if (status === 403) {
        throw new Error(
          'Google Drive API access forbidden. Please verify API key permissions and quota.'
        );
      }
      if (status === 404) {
        throw new Error('Configured Google Drive folder was not found.');
      }
      throw new Error(`Drive API query failed: ${message}`);
    }

    const data = await res.json();
    if (Array.isArray(data.files)) {
      allRawFiles.push(...data.files);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  const folders = allRawFiles.filter(
    (f) => f.mimeType === 'application/vnd.google-apps.folder'
  );
  const files = allRawFiles.filter(
    (f) => f.mimeType !== 'application/vnd.google-apps.folder'
  );

  return { files, folders };
}

/**
 * Retrieves the full tree of Published files with categories and metadata.
 */
export async function getPublishedDriveFiles(forceRefresh = false): Promise<DriveListResult> {
  const config = getDriveConfig();

  if (!config.isConfigured) {
    return {
      configured: false,
      files: [],
      categories: [],
      lastUpdated: new Date().toISOString(),
      missingVars: config.missingVars,
      error: `Shared Files are not configured yet. Missing Google Drive environment variable(s): ${config.missingVars.join(', ')}`,
    };
  }

  const now = Date.now();
  if (!forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.result;
  }

  try {
    // 1. Resolve effective Published folder
    // Check if the configured root folder contains a subfolder named 'Published'
    const rootListing = await fetchDriveFolderFiles(config.rootFolderId, config.apiKey);
    const publishedSubfolder = rootListing.folders.find(
      (f) => f.name.toLowerCase().trim() === 'published'
    );

    const effectivePublishedFolderId = publishedSubfolder
      ? publishedSubfolder.id
      : config.rootFolderId;

    const allowedFolderIds = new Set<string>([effectivePublishedFolderId]);
    const fileMetadataMap = new Map<string, DriveDownloadMetadata>();

    // 2. Query direct contents of Published
    const publishedListing = publishedSubfolder
      ? await fetchDriveFolderFiles(effectivePublishedFolderId, config.apiKey)
      : rootListing;

    const directSubfolders = publishedListing.folders;
    const directFiles = publishedListing.files;

    const mapDriveFile = (f: any, category: string, categoryFolderId: string): DriveFile => {
      const sizeNum = f.size ? parseInt(f.size, 10) : 0;
      const fileTypeCategory = determineFileTypeCategory(f.mimeType, f.name);
      const downloadDetails = resolveDownloadDetails(f.mimeType, f.name);
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: sizeNum,
        formattedSize: formatFileSize(sizeNum),
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        description: f.description || undefined,
        // Private Drive thumbnails need auth, so serve them through the gated proxy.
        thumbnailLink: f.thumbnailLink
          ? (config.usesServiceAccount ? `/api/drive/thumbnail/${encodeURIComponent(f.id)}` : f.thumbnailLink)
          : undefined,
        webViewLink: f.webViewLink || undefined,
        category,
        categoryFolderId,
        fileTypeCategory,
        downloadLabel: downloadDetails.downloadLabel,
        canPreview: canPreviewFile(f.mimeType, f.name),
        exportMimeType: downloadDetails.exportMimeType,
        downloadExtension: downloadDetails.downloadExtension,
      };
    };

    const allDriveFiles: DriveFile[] = [];

    // Map direct files sitting directly in Published as category 'Other'
    for (const f of directFiles) {
      const driveFile = mapDriveFile(f, 'Other', effectivePublishedFolderId);
      const downloadDetails = resolveDownloadDetails(f.mimeType, f.name);

      allDriveFiles.push(driveFile);
      fileMetadataMap.set(f.id, {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: driveFile.size,
        webViewLink: f.webViewLink,
        exportMimeType: downloadDetails.exportMimeType,
        downloadFilename: sanitizeFilename(downloadDetails.finalName),
      });
    }

    // 3. Process direct subfolders (e.g. Presentations, Notes, Images)
    const categoryCounts: Record<string, number> = {
      Presentations: 0,
      Notes: 0,
      Images: 0,
      Other: directFiles.length,
    };

    // Day photo tabs ("Day 1 Photos", ...), read only from the private published folder.
    const photoCategories: string[] = [];

    for (const subfolder of directSubfolders) {
      allowedFolderIds.add(subfolder.id);
      const subListing = await fetchDriveFolderFiles(subfolder.id, config.apiKey);

      const categoryName = subfolder.name.trim();
      categoryCounts[categoryName] = subListing.files.length;
      // A "Day N Photos" folder in the (private) published folder is a day photo tab, not documents.
      const isDayPhotos = /^day\s*\d+\s+photos?$/i.test(categoryName);
      if (isDayPhotos) photoCategories.push(categoryName);

      for (const f of subListing.files) {
        const driveFile = isDayPhotos
          ? { ...mapDriveFile(f, categoryName, subfolder.id), isEventPhoto: true }
          : mapDriveFile(f, categoryName, subfolder.id);
        const downloadDetails = resolveDownloadDetails(f.mimeType, f.name);

        allDriveFiles.push(driveFile);
        fileMetadataMap.set(f.id, {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: driveFile.size,
          webViewLink: f.webViewLink,
          exportMimeType: downloadDetails.exportMimeType,
          downloadFilename: sanitizeFilename(downloadDetails.finalName),
        });
      }
    }

    // Build standard Category Tabs: All, Presentations, Notes, Images, Other, plus any additional subfolders
    const standardCategories = ['Presentations', 'Notes', 'Images', 'Other'];
    const otherFound = Object.keys(categoryCounts).filter(
      (c) => !standardCategories.includes(c) && !photoCategories.includes(c)
    );
    const documentCount = allDriveFiles.filter((f) => !f.isEventPhoto).length;

    const categoriesList: DriveCategory[] = [
      // "All" covers documents only; event photos live in their own day tabs.
      { id: 'all', name: 'All', count: documentCount },
      ...standardCategories.map((cat) => ({
        id: cat.toLowerCase(),
        name: cat,
        count: categoryCounts[cat] || 0,
      })),
      ...otherFound.map((cat) => ({
        id: cat.toLowerCase(),
        name: cat,
        count: categoryCounts[cat] || 0,
      })),
      ...photoCategories.map((cat) => ({
        id: cat.toLowerCase(),
        name: cat,
        count: categoryCounts[cat] || 0,
      })),
    ];

    const result: DriveListResult = {
      configured: true,
      files: allDriveFiles,
      categories: categoriesList,
      publishedFolderId: effectivePublishedFolderId,
      incomingFolderId: undefined,
      incomingFiles: [],
      uploadFormUrl: config.uploadFormUrl,
      lastUpdated: new Date().toISOString(),
    };

    // Update in-memory cache
    memoryCache = {
      timestamp: Date.now(),
      result,
      effectivePublishedFolderId,
      allowedFolderIds,
      fileMetadataMap,
    };

    return result;
  } catch (err: any) {
    console.error('[Google Drive Fetch Failed]:', err.message);
    return {
      configured: true,
      files: [],
      categories: [],
      lastUpdated: new Date().toISOString(),
      error: err.message || 'Failed to communicate with Google Drive API.',
    };
  }
}

/**
 * Clears the in-memory cache to force a re-fetch on next access.
 */
export function clearDriveCache(): void {
  memoryCache = null;
}

/**
 * Returns cache diagnostic status for admin dashboard.
 */
export function getDriveCacheDiagnostics() {
  return {
    cached: Boolean(memoryCache),
    lastRefreshTime: memoryCache ? new Date(memoryCache.timestamp).toISOString() : null,
    totalFiles: memoryCache ? memoryCache.result.files.length : 0,
    effectivePublishedFolderId: memoryCache?.effectivePublishedFolderId || null,
  };
}

/**
 * Verifies that a target fileId resides strictly inside the Published folder or its subfolders.
 * If verified, returns the download metadata; otherwise returns null (indicating 404).
 */
export async function verifyAndGetDownloadMetadata(
  fileId: string
): Promise<DriveDownloadMetadata | null> {
  if (!isValidDriveId(fileId)) {
    return null;
  }

  // Ensure cache is loaded
  let cache = memoryCache;
  if (!cache || Date.now() - cache.timestamp >= CACHE_TTL_MS) {
    await getPublishedDriveFiles(false);
    cache = memoryCache;
  }

  if (cache && cache.fileMetadataMap.has(fileId)) {
    return cache.fileMetadataMap.get(fileId)!;
  }

  // If not found in memory cache, make an authoritative check against Drive API
  const config = getDriveConfig();
  if (!config.isConfigured) return null;

  try {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
    url.searchParams.set('fields', 'id,name,mimeType,size,parents,webViewLink,trashed');

    const res = await driveFetch(url, config.apiKey);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.trashed || !Array.isArray(data.parents) || data.parents.length === 0) {
      return null;
    }

    // Check if any parent is an allowed folder ID
    const allowed = cache?.allowedFolderIds;
    const isInsidePublished = allowed
      ? data.parents.some((p: string) => allowed.has(p))
      : false;

    if (!isInsidePublished) {
      return null;
    }

    const sizeNum = data.size ? parseInt(data.size, 10) : 0;
    const downloadDetails = resolveDownloadDetails(data.mimeType, data.name);

    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      size: sizeNum,
      webViewLink: data.webViewLink,
      exportMimeType: downloadDetails.exportMimeType,
      downloadFilename: sanitizeFilename(downloadDetails.finalName),
    };
  } catch {
    return null;
  }
}
