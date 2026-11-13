import { google, drive_v3 } from 'googleapis';
import {
  DriveFileTypeFilter,
  ReviewDriveFile,
  DriveHealthStatus,
} from './types';
import {
  isValidDriveId,
  isPlaceholderOrEmpty,
  formatFileSize,
  determineFileTypeCategory,
  canPreviewFile,
  sanitizeFilename,
  clearDriveCache,
} from './client';
import { logAuditEvent } from '@/lib/audit';

export interface ServiceAccountCredentials {
  isConfigured: boolean;
  clientEmail: string;
  privateKey: string;
  incomingFolderId: string;
  publishedFolderId: string;
  missingVars: string[];
}

/**
 * Normalizes PEM private key strings, supporting escaped \n, quotes, and carriage returns.
 */
function normalizePrivateKey(rawKey: string): string {
  let cleaned = rawKey.trim();
  // Tolerate a line copied straight from the JSON key file: "-----BEGIN ...-----\n",
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  // Strip surrounding quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }
  // Replace escaped literal \n sequences with actual newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return cleaned.trim();
}

/**
 * Parses and extracts service account credentials from environment variables.
 * Supports:
 * 1. Standard GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * 2. Base64-encoded Service Account JSON key
 * 3. Raw JSON Service Account key string
 * Never logs or prints the private key.
 */
export function getServiceAccountCredentials(): ServiceAccountCredentials {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '';
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() || '';
  let privateKey = '';

  const incomingFolderId =
    process.env.GOOGLE_DRIVE_INCOMING_FOLDER_ID?.trim() ||
    process.env.GOOGLE_DRIVE_UPLOADS_FOLDER_ID?.trim() ||
    '1tEB0aC4m5AXNapFlZKMstib75F-YE1Avj7Msjh97D6x9YWCy3Ov2I-D2R9TVaQTkxoDDHPak';

  const publishedFolderId =
    process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID?.trim() ||
    '1g7OpDOroSaNcfSumoH0fy-oGeQo13Kbn';

  if (rawKey && !isPlaceholderOrEmpty(rawKey)) {
    // 1. Try decoding if base64 encoded JSON
    try {
      const decoded = Buffer.from(rawKey, 'base64').toString('utf-8');
      if (decoded.includes('{') && decoded.includes('private_key')) {
        const parsed = JSON.parse(decoded);
        if (parsed.private_key) {
          privateKey = normalizePrivateKey(parsed.private_key);
          if (parsed.client_email && !clientEmail) {
            clientEmail = parsed.client_email;
          }
        }
      }
    } catch {
      // not base64 JSON
    }

    // 2. Try parsing as raw JSON
    if (!privateKey && rawKey.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawKey);
        if (parsed.private_key) {
          privateKey = normalizePrivateKey(parsed.private_key);
          if (parsed.client_email && !clientEmail) {
            clientEmail = parsed.client_email;
          }
        }
      } catch {
        // not JSON
      }
    }

    // 3. Fallback to standard PEM format
    if (!privateKey) {
      privateKey = normalizePrivateKey(rawKey);
    }
  }

  const missingVars: string[] = [];
  if (isPlaceholderOrEmpty(clientEmail)) {
    missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  }
  if (isPlaceholderOrEmpty(privateKey)) {
    missingVars.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  }
  if (isPlaceholderOrEmpty(incomingFolderId)) {
    missingVars.push('GOOGLE_DRIVE_INCOMING_FOLDER_ID');
  }
  if (isPlaceholderOrEmpty(publishedFolderId)) {
    missingVars.push('GOOGLE_DRIVE_PUBLISHED_FOLDER_ID');
  }

  const isConfigured = missingVars.length === 0;

  return {
    isConfigured,
    clientEmail,
    privateKey,
    incomingFolderId,
    publishedFolderId,
    missingVars,
  };
}

/**
 * Creates and returns an authenticated Google Drive API v3 client using Service Account JWT.
 */
export function getDriveAdminClient(): drive_v3.Drive {
  const creds = getServiceAccountCredentials();
  if (!creds.isConfigured) {
    throw new Error(
      `Service Account Drive access is not configured. Missing variables: ${creds.missingVars.join(', ')}`
    );
  }

  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Checks write capabilities and permissions on Incoming and Published folders.
 * Tests if the service account can read and has Editor (canAddChildren and canEdit) permissions.
 */
export async function checkDriveWriteHealth(): Promise<DriveHealthStatus> {
  const creds = getServiceAccountCredentials();

  if (!creds.isConfigured) {
    return {
      ok: false,
      isConfigured: false,
      serviceAccountEmail: creds.clientEmail || undefined,
      missingVars: creds.missingVars,
      fixMessage: `Service account credentials not fully configured. Missing: ${creds.missingVars.join(', ')}.`,
    };
  }

  try {
    const drive = getDriveAdminClient();

    // 1. Check Incoming Folder
    let incomingHealth = {
      id: creds.incomingFolderId,
      name: 'Incoming Uploads',
      canAddChildren: false,
      canEdit: false,
      accessible: false,
      error: undefined as string | undefined,
    };

    try {
      const res = await drive.files.get({
        fileId: creds.incomingFolderId,
        fields: 'id, name, capabilities, trashed',
        supportsAllDrives: true,
      });

      const f = res.data;
      incomingHealth = {
        id: f.id || creds.incomingFolderId,
        name: f.name || 'Incoming Uploads',
        canAddChildren: Boolean(f.capabilities?.canAddChildren),
        canEdit: Boolean(f.capabilities?.canEdit),
        accessible: true,
        error: undefined,
      };
    } catch (err: any) {
      incomingHealth.accessible = false;
      incomingHealth.error = err.message || 'Cannot access incoming folder';
    }

    // 2. Resolve and Check Published Folder
    let effectivePublishedId = creds.publishedFolderId;
    let publishedName = 'Published';
    let publishedHealth = {
      id: creds.publishedFolderId,
      name: 'Published',
      canAddChildren: false,
      canEdit: false,
      accessible: false,
      error: undefined as string | undefined,
    };

    try {
      // Check if root has a 'Published' subfolder
      const rootRes = await drive.files.get({
        fileId: creds.publishedFolderId,
        fields: 'id, name, capabilities, trashed',
        supportsAllDrives: true,
      });

      if (rootRes.data.name?.toLowerCase() === 'published') {
        effectivePublishedId = rootRes.data.id!;
        publishedName = rootRes.data.name;
        publishedHealth = {
          id: rootRes.data.id!,
          name: rootRes.data.name,
          canAddChildren: Boolean(rootRes.data.capabilities?.canAddChildren),
          canEdit: Boolean(rootRes.data.capabilities?.canEdit),
          accessible: true,
          error: undefined,
        };
      } else {
        // Look for Published subfolder
        const subfoldersRes = await drive.files.list({
          q: `'${creds.publishedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Published' and trashed = false`,
          fields: 'files(id, name, capabilities)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const sub = subfoldersRes.data.files?.[0];
        if (sub && sub.id) {
          effectivePublishedId = sub.id;
          publishedName = sub.name || 'Published';
          publishedHealth = {
            id: sub.id,
            name: sub.name || 'Published',
            canAddChildren: Boolean(sub.capabilities?.canAddChildren),
            canEdit: Boolean(sub.capabilities?.canEdit),
            accessible: true,
            error: undefined,
          };
        } else {
          // Use the root folder directly
          publishedHealth = {
            id: rootRes.data.id!,
            name: rootRes.data.name || 'Published Root',
            canAddChildren: Boolean(rootRes.data.capabilities?.canAddChildren),
            canEdit: Boolean(rootRes.data.capabilities?.canEdit),
            accessible: true,
            error: undefined,
          };
        }
      }
    } catch (err: any) {
      publishedHealth.accessible = false;
      publishedHealth.error = err.message || 'Cannot access published folder';
    }

    // Determine fix message if issues exist
    let fixMessage: string | undefined = undefined;
    if (!incomingHealth.accessible) {
      fixMessage = `Share the Incoming folder with ${creds.clientEmail} as Editor.`;
    } else if (!incomingHealth.canAddChildren || !incomingHealth.canEdit) {
      fixMessage = `The service account has read-only access to the Incoming folder. Grant Editor permission to ${creds.clientEmail}.`;
    } else if (!publishedHealth.accessible) {
      fixMessage = `Share the Published folder with ${creds.clientEmail} as Editor.`;
    } else if (!publishedHealth.canAddChildren || !publishedHealth.canEdit) {
      fixMessage = `The service account has read-only access to the Published folder. Grant Editor permission to ${creds.clientEmail}.`;
    }

    const ok =
      incomingHealth.accessible &&
      incomingHealth.canAddChildren &&
      incomingHealth.canEdit &&
      publishedHealth.accessible &&
      publishedHealth.canAddChildren &&
      publishedHealth.canEdit;

    return {
      ok,
      isConfigured: true,
      serviceAccountEmail: creds.clientEmail,
      incomingFolder: incomingHealth,
      publishedFolder: publishedHealth,
      fixMessage,
    };
  } catch (err: any) {
    return {
      ok: false,
      isConfigured: true,
      serviceAccountEmail: creds.clientEmail,
      fixMessage: `Failed to connect with Google Drive Service Account: ${err.message}`,
    };
  }
}

/**
 * Recursively maps all subfolder IDs and names under a root folder.
 */
async function getAllSubfolderTree(
  drive: drive_v3.Drive,
  rootFolderId: string
): Promise<Map<string, string>> {
  const folderMap = new Map<string, string>();
  const queue = [rootFolderId];
  const visited = new Set<string>([rootFolderId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    let pageToken: string | undefined = undefined;

    do {
      try {
        const res: any = await drive.files.list({
          q: `'${currentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'nextPageToken, files(id, name)',
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const folders = res.data.files || [];
        for (const folder of folders) {
          if (folder.id && !visited.has(folder.id)) {
            visited.add(folder.id);
            folderMap.set(folder.id, folder.name || 'Subfolder');
            queue.push(folder.id);
          }
        }
        pageToken = res.data.nextPageToken || undefined;
      } catch (e) {
        break;
      }
    } while (pageToken);
  }

  return folderMap;
}

/**
 * Checks whether a specific fileId exists inside a given folder tree.
 */
export async function isFileInFolderTree(
  drive: drive_v3.Drive,
  fileId: string,
  rootFolderId: string
): Promise<boolean> {
  if (!isValidDriveId(fileId) || !isValidDriveId(rootFolderId)) {
    return false;
  }

  try {
    const fileRes = await drive.files.get({
      fileId,
      fields: 'id, parents, trashed',
      supportsAllDrives: true,
    });

    const parents = fileRes.data.parents || [];
    if (parents.includes(rootFolderId)) {
      return true;
    }

    const subfolders = await getAllSubfolderTree(drive, rootFolderId);
    return parents.some((p) => subfolders.has(p));
  } catch {
    return false;
  }
}

/**
 * Lists all pending files inside the Incoming folder and all its subfolders, newest first.
 */
export async function getIncomingFilesForReview(): Promise<{
  files: ReviewDriveFile[];
  count: number;
  subfoldersCount: number;
}> {
  const creds = getServiceAccountCredentials();
  if (!creds.isConfigured) {
    return { files: [], count: 0, subfoldersCount: 0 };
  }

  const drive = getDriveAdminClient();
  const rootId = creds.incomingFolderId;

  // 1. Discover all subfolders recursively (e.g. Google Form file response folders)
  const folderMap = await getAllSubfolderTree(drive, rootId);
  const allFolderIds = [rootId, ...Array.from(folderMap.keys())];

  const allReviewFiles: ReviewDriveFile[] = [];

  // 2. Fetch files from each folder in the tree
  for (const folderId of allFolderIds) {
    let pageToken: string | undefined = undefined;
    const parentFolderName = folderId === rootId ? 'Incoming Root' : folderMap.get(folderId) || 'Uploads';

    do {
      try {
        const res: any = await drive.files.list({
          q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
          fields:
            'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, description, thumbnailLink, webViewLink, owners(displayName, emailAddress), parents)',
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          orderBy: 'modifiedTime desc',
        });

        const rawFiles = res.data.files || [];
        for (const f of rawFiles) {
          if (!f.id || !f.name) continue;
          const sizeNum = f.size ? parseInt(f.size, 10) : 0;
          const fileTypeCategory = determineFileTypeCategory(f.mimeType || '', f.name);

          allReviewFiles.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType || 'application/octet-stream',
            size: sizeNum,
            formattedSize: formatFileSize(sizeNum),
            modifiedTime: f.modifiedTime || new Date().toISOString(),
            createdTime: f.createdTime || f.modifiedTime || new Date().toISOString(),
            description: f.description || undefined,
            thumbnailLink: f.thumbnailLink || undefined,
            fileTypeCategory,
            parentFolderId: folderId,
            parentFolderName,
            uploaderName: f.owners?.[0]?.displayName || undefined,
            uploaderEmail: f.owners?.[0]?.emailAddress || undefined,
            canPreview: canPreviewFile(f.mimeType || '', f.name),
            status: 'pending',
          });
        }

        pageToken = res.data.nextPageToken || undefined;
      } catch (err: any) {
        console.warn(`[getIncomingFilesForReview] Error reading folder ${folderId}:`, err.message);
        break;
      }
    } while (pageToken);
  }

  // 3. Sort all files newest first
  allReviewFiles.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());

  return {
    files: allReviewFiles,
    count: allReviewFiles.length,
    subfoldersCount: folderMap.size,
  };
}

/**
 * Resolves the effective Published folder ID.
 */
async function resolveEffectivePublishedFolder(drive: drive_v3.Drive, configuredRootId: string): Promise<string> {
  try {
    const rootRes = await drive.files.get({
      fileId: configuredRootId,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });

    if (rootRes.data.name?.toLowerCase().trim() === 'published') {
      return configuredRootId;
    }

    const subRes = await drive.files.list({
      q: `'${configuredRootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Published' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const publishedSub = subRes.data.files?.[0];
    if (publishedSub && publishedSub.id) {
      return publishedSub.id;
    }
  } catch (err) {
    // fallback to configuredRootId
  }
  return configuredRootId;
}

/**
 * Resolves or creates a Published subfolder (Presentations, Notes, Images, Other).
 * Never accepts a folder ID from the client.
 */
export async function resolveOrCreatePublishedSubfolder(
  drive: drive_v3.Drive,
  category: 'Presentations' | 'Notes' | 'Images' | 'Other'
): Promise<{ folderId: string; folderName: string }> {
  const creds = getServiceAccountCredentials();
  const effectivePublishedId = await resolveEffectivePublishedFolder(drive, creds.publishedFolderId);

  // If category is Other, it sits directly in Published
  if (category === 'Other') {
    return { folderId: effectivePublishedId, folderName: 'Published' };
  }

  // Search for existing subfolder by name inside Published
  const subRes = await drive.files.list({
    q: `'${effectivePublishedId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const targetCategory = category.toLowerCase().trim();
  const existing = (subRes.data.files || []).find((f) => {
    const fn = (f.name || '').toLowerCase().trim();
    if (fn === targetCategory) return true;
    if (targetCategory === 'presentations' && (fn === 'presentation' || fn === 'slides')) return true;
    if (targetCategory === 'presentation' && (fn === 'presentations' || fn === 'slides')) return true;
    if (targetCategory === 'notes' && fn === 'note') return true;
    if (targetCategory === 'note' && fn === 'notes') return true;
    if (targetCategory === 'images' && (fn === 'image' || fn === 'pictures' || fn === 'photos')) return true;
    return false;
  });

  if (existing && existing.id) {
    return { folderId: existing.id, folderName: existing.name || category };
  }

  // Create missing subfolder
  const createRes = await drive.files.create({
    requestBody: {
      name: category,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [effectivePublishedId],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  if (!createRes.data.id) {
    throw new Error(`Failed to create missing Published subfolder '${category}'`);
  }

  return { folderId: createRes.data.id, folderName: category };
}

/**
 * Resolves or creates a private "Rejected" folder outside Published.
 */
export async function resolveOrCreateRejectedFolder(drive: drive_v3.Drive): Promise<string> {
  const creds = getServiceAccountCredentials();

  // Find parent folder of Published, or parent of Incoming, or root
  let parentForRejected = creds.publishedFolderId;
  try {
    const pubMeta = await drive.files.get({
      fileId: creds.publishedFolderId,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });
    if (pubMeta.data.name?.toLowerCase().trim() === 'published' && pubMeta.data.parents?.[0]) {
      parentForRejected = pubMeta.data.parents[0];
    }
  } catch {
    // fallback to creds.publishedFolderId
  }

  // Check if Rejected folder already exists
  const listRes = await drive.files.list({
    q: `'${parentForRejected}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Rejected' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = listRes.data.files?.[0];
  if (existing && existing.id) {
    return existing.id;
  }

  // Create Rejected folder
  const createRes = await drive.files.create({
    requestBody: {
      name: 'Rejected',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentForRejected],
    },
    fields: 'id, name',
    supportsAllDrives: true,
  });

  if (!createRes.data.id) {
    throw new Error('Failed to create private Rejected folder in Google Drive.');
  }

  return createRes.data.id;
}

/**
 * Approves an incoming file: moves it into the chosen Published subfolder,
 * optionally updates name and description, clears cache, and logs audit event.
 */
export async function approveIncomingFile(params: {
  fileId: string;
  category: 'Presentations' | 'Notes' | 'Images' | 'Other';
  newName?: string;
  description?: string;
  actorEmail: string;
}): Promise<{ success: boolean; file: ReviewDriveFile }> {
  const { fileId, category, newName, description, actorEmail } = params;
  const creds = getServiceAccountCredentials();
  const drive = getDriveAdminClient();

  // 1. Verify file is in Incoming tree
  const inIncoming = await isFileInFolderTree(drive, fileId, creds.incomingFolderId);
  if (!inIncoming) {
    throw new Error('File not found in the incoming uploads tree.');
  }

  // 2. Fetch current file details and parents
  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, modifiedTime, parents, description',
    supportsAllDrives: true,
  });

  const currentParents = fileMeta.data.parents || [];
  const originalName = fileMeta.data.name || 'Untitled';
  const cleanName = newName ? sanitizeFilename(newName, originalName) : originalName;

  // 3. Resolve destination Published subfolder
  const destination = await resolveOrCreatePublishedSubfolder(drive, category);

  // 4. Move file via files.update (addParents & removeParents)
  const updateRes = await drive.files.update({
    fileId,
    addParents: destination.folderId,
    removeParents: currentParents.join(','),
    requestBody: {
      name: cleanName,
      ...(description !== undefined ? { description: description.trim() } : {}),
    },
    fields: 'id, name, mimeType, size, modifiedTime, description',
    supportsAllDrives: true,
  });

  // 5. Invalidate listing cache so the public page updates immediately
  clearDriveCache();

  // 6. Record audit log
  await logAuditEvent({
    action: 'drive_file_approved',
    actor_email: actorEmail,
    details: {
      file_id: fileId,
      file_name: cleanName,
      original_name: originalName,
      destination_category: category,
      destination_folder: destination.folderName,
      description: description || null,
      timestamp: new Date().toISOString(),
    },
  });

  const sizeNum = updateRes.data.size ? parseInt(updateRes.data.size, 10) : 0;
  return {
    success: true,
    file: {
      id: fileId,
      name: updateRes.data.name || cleanName,
      mimeType: updateRes.data.mimeType || fileMeta.data.mimeType || '',
      size: sizeNum,
      formattedSize: formatFileSize(sizeNum),
      modifiedTime: updateRes.data.modifiedTime || new Date().toISOString(),
      description: updateRes.data.description || undefined,
      fileTypeCategory: determineFileTypeCategory(updateRes.data.mimeType || '', cleanName),
      parentFolderId: destination.folderId,
      parentFolderName: destination.folderName,
      canPreview: canPreviewFile(updateRes.data.mimeType || '', cleanName),
      status: 'approved',
    },
  };
}

/**
 * Rejects an incoming file: moves it to private Rejected folder,
 * records reason, clears cache, and logs audit event.
 */
export async function rejectIncomingFile(params: {
  fileId: string;
  reason?: string;
  actorEmail: string;
}): Promise<{ success: boolean }> {
  const { fileId, reason, actorEmail } = params;
  const creds = getServiceAccountCredentials();
  const drive = getDriveAdminClient();

  // 1. Verify file is in Incoming tree
  const inIncoming = await isFileInFolderTree(drive, fileId, creds.incomingFolderId);
  if (!inIncoming) {
    throw new Error('File not found in the incoming uploads tree.');
  }

  // 2. Fetch current file details
  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id, name, parents, description',
    supportsAllDrives: true,
  });

  const currentParents = fileMeta.data.parents || [];
  const fileName = fileMeta.data.name || 'Untitled';

  // 3. Resolve Rejected folder
  const rejectedFolderId = await resolveOrCreateRejectedFolder(drive);

  // 4. Move file to Rejected
  const rejectionNote = reason ? `[Rejected by ${actorEmail} on ${new Date().toLocaleDateString('en-GB')}]: ${reason}` : `[Rejected by ${actorEmail}]`;
  await drive.files.update({
    fileId,
    addParents: rejectedFolderId,
    removeParents: currentParents.join(','),
    requestBody: {
      description: rejectionNote,
    },
    supportsAllDrives: true,
  });

  // 5. Invalidate listing cache
  clearDriveCache();

  // 6. Record audit log
  await logAuditEvent({
    action: 'drive_file_rejected',
    actor_email: actorEmail,
    details: {
      file_id: fileId,
      file_name: fileName,
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}

/**
 * Lists all files inside the private Rejected folder (Super Admin only).
 */
export async function getRejectedFilesForReview(): Promise<ReviewDriveFile[]> {
  const creds = getServiceAccountCredentials();
  if (!creds.isConfigured) return [];

  const drive = getDriveAdminClient();
  const rejectedFolderId = await resolveOrCreateRejectedFolder(drive);

  const res = await drive.files.list({
    q: `'${rejectedFolderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields:
      'files(id, name, mimeType, size, modifiedTime, createdTime, description, thumbnailLink, owners(displayName, emailAddress), parents)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'modifiedTime desc',
  });

  const files: ReviewDriveFile[] = [];
  for (const f of res.data.files || []) {
    if (!f.id || !f.name) continue;
    const sizeNum = f.size ? parseInt(f.size, 10) : 0;
    files.push({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType || 'application/octet-stream',
      size: sizeNum,
      formattedSize: formatFileSize(sizeNum),
      modifiedTime: f.modifiedTime || new Date().toISOString(),
      createdTime: f.createdTime ? String(f.createdTime) : (f.modifiedTime ? String(f.modifiedTime) : undefined),
      description: f.description || undefined,
      thumbnailLink: f.thumbnailLink || undefined,
      fileTypeCategory: determineFileTypeCategory(f.mimeType || '', f.name),
      parentFolderId: rejectedFolderId,
      parentFolderName: 'Rejected',
      uploaderName: f.owners?.[0]?.displayName || undefined,
      uploaderEmail: f.owners?.[0]?.emailAddress || undefined,
      canPreview: canPreviewFile(f.mimeType || '', f.name),
      status: 'rejected',
      rejectionReason: f.description || undefined,
    });
  }

  return files;
}

/**
 * Restores a rejected file back to Incoming (Super Admin only).
 */
export async function restoreRejectedFile(params: {
  fileId: string;
  actorEmail: string;
}): Promise<{ success: boolean }> {
  const { fileId, actorEmail } = params;
  const creds = getServiceAccountCredentials();
  const drive = getDriveAdminClient();

  // Verify file is currently in Rejected folder
  const rejectedFolderId = await resolveOrCreateRejectedFolder(drive);
  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id, name, parents',
    supportsAllDrives: true,
  });

  const parents = fileMeta.data.parents || [];
  if (!parents.includes(rejectedFolderId)) {
    throw new Error('File is not in the Rejected folder.');
  }

  // Move back to Incoming
  await drive.files.update({
    fileId,
    addParents: creds.incomingFolderId,
    removeParents: parents.join(','),
    requestBody: {
      description: `[Restored by ${actorEmail} on ${new Date().toLocaleDateString('en-GB')}]`,
    },
    supportsAllDrives: true,
  });

  clearDriveCache();

  await logAuditEvent({
    action: 'drive_file_restored',
    actor_email: actorEmail,
    details: {
      file_id: fileId,
      file_name: fileMeta.data.name || 'Untitled',
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}

/**
 * Permanently deletes a file from the Rejected folder (Super Admin only).
 */
export async function permanentlyDeleteRejectedFile(params: {
  fileId: string;
  actorEmail: string;
}): Promise<{ success: boolean }> {
  const { fileId, actorEmail } = params;
  const drive = getDriveAdminClient();

  const rejectedFolderId = await resolveOrCreateRejectedFolder(drive);
  const fileMeta = await drive.files.get({
    fileId,
    fields: 'id, name, parents',
    supportsAllDrives: true,
  });

  const parents = fileMeta.data.parents || [];
  if (!parents.includes(rejectedFolderId)) {
    throw new Error('Only files residing in the Rejected folder may be permanently deleted.');
  }

  const fileName = fileMeta.data.name || 'Untitled';
  await drive.files.delete({
    fileId,
    supportsAllDrives: true,
  });

  clearDriveCache();

  await logAuditEvent({
    action: 'drive_file_deleted',
    actor_email: actorEmail,
    details: {
      file_id: fileId,
      file_name: fileName,
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}

/**
 * Streams binary media bytes for in-app preview or download.
 * Validates that fileId resides in Incoming, Rejected, or Published trees.
 */
export async function getFileStream(fileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  name: string;
  mimeType: string;
  size?: number;
}> {
  if (!isValidDriveId(fileId)) {
    throw new Error('Invalid Google Drive file ID format.');
  }

  const creds = getServiceAccountCredentials();
  const drive = getDriveAdminClient();

  // Validate that the file is in one of the managed folders (Incoming, Published, Rejected)
  const isIncoming = await isFileInFolderTree(drive, fileId, creds.incomingFolderId);
  const isPublished = await isFileInFolderTree(drive, fileId, creds.publishedFolderId);
  let isRejected = false;
  try {
    const rejId = await resolveOrCreateRejectedFolder(drive);
    isRejected = await isFileInFolderTree(drive, fileId, rejId);
  } catch {}

  if (!isIncoming && !isPublished && !isRejected) {
    throw new Error('File not found in any managed Drive directory.');
  }

  // Fetch metadata
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size',
    supportsAllDrives: true,
  });

  const name = meta.data.name || 'file';
  const mimeType = meta.data.mimeType || 'application/octet-stream';
  const size = meta.data.size ? parseInt(meta.data.size, 10) : undefined;

  // Fetch binary media stream
  const driveRes = await drive.files.get(
    {
      fileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    { responseType: 'stream' }
  );

  return {
    stream: driveRes.data,
    name,
    mimeType,
    size,
  };
}
