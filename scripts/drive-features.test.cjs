const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nodePath = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
require('dotenv').config({ path: '.env' });

function loadModule(filePath, mocks = {}) {
  const absPath = nodePath.resolve(filePath);
  const code = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('./') || name.startsWith('../')) {
        const resolved = nodePath.resolve(nodePath.dirname(absPath), name);
        for (const ext of ['.ts', '.tsx', '.js', '.cjs', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolved + ext)) return loadModule(resolved + ext, mocks);
        }
      }
      if (name.startsWith('@/')) {
        const resolved = nodePath.resolve('src', name.slice(2));
        for (const ext of ['.ts', '.tsx', '.js', '.cjs', '/index.ts', '/index.js']) {
          if (fs.existsSync(resolved + ext)) return loadModule(resolved + ext, mocks);
        }
      }
      return require(name);
    },
    console,
    process,
    URL,
    Request,
    Response,
    Headers,
    AbortSignal,
    crypto,
    fetch,
    setTimeout,
    clearTimeout,
  }, { filename: absPath });
  return module.exports;
}

const driveClient = loadModule('src/lib/drive/client.ts');

test('1. Environment check: missing variables returns configured: false gracefully', () => {
  const origKey = process.env.GOOGLE_DRIVE_API_KEY;
  const origFolder = process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID;
  try {
    delete process.env.GOOGLE_DRIVE_API_KEY;
    delete process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID;

    const config = driveClient.getDriveConfig();
    assert.equal(config.isConfigured, false);
    assert.equal(config.maxDownloadMb, 100);
    assert.equal(JSON.stringify(config.missingVars), JSON.stringify(['GOOGLE_DRIVE_API_KEY', 'GOOGLE_DRIVE_PUBLISHED_FOLDER_ID']));

    // Placeholders are treated as unconfigured
    process.env.GOOGLE_DRIVE_API_KEY = 'PASTE_YOUR_API_KEY';
    process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID = 'your_folder_placeholder';
    const placeholderConfig = driveClient.getDriveConfig();
    assert.equal(placeholderConfig.isConfigured, false);
    assert.equal(JSON.stringify(placeholderConfig.missingVars), JSON.stringify(['GOOGLE_DRIVE_API_KEY', 'GOOGLE_DRIVE_PUBLISHED_FOLDER_ID']));
  } finally {
    if (origKey) process.env.GOOGLE_DRIVE_API_KEY = origKey;
    else delete process.env.GOOGLE_DRIVE_API_KEY;
    if (origFolder) process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID = origFolder;
    else delete process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID;
  }
});

test('2. ID Validation & Sanitization: rejects unsafe and malformed IDs', () => {
  assert.equal(driveClient.isValidDriveId('../../../etc/passwd'), false);
  assert.equal(driveClient.isValidDriveId('<script>'), false);
  assert.equal(driveClient.isValidDriveId('short'), false);
  assert.equal(driveClient.isValidDriveId('1CvsuVxtzWGcolqnSMkO3nUy2BVONnC19'), true);

  const clean = driveClient.sanitizeFilename('report: 2026/11 "final"?.pdf');
  assert.equal(clean.includes('/'), false);
  assert.equal(clean.includes('"'), false);
  assert.equal(clean.includes(':'), false);
  assert.equal(clean.includes('?'), false);
});

test('3. Google-native file export details and labels', () => {
  // Slides
  const slides = driveClient.resolveDownloadDetails(
    'application/vnd.google-apps.presentation',
    'Session Slides'
  );
  assert.equal(slides.downloadLabel, 'Download as PPTX');
  assert.equal(slides.downloadExtension, '.pptx');
  assert.equal(slides.finalName, 'Session Slides.pptx');

  // Sheets
  const sheets = driveClient.resolveDownloadDetails(
    'application/vnd.google-apps.spreadsheet',
    'Financials'
  );
  assert.equal(sheets.downloadLabel, 'Download as XLSX');
  assert.equal(sheets.downloadExtension, '.xlsx');
  assert.equal(sheets.finalName, 'Financials.xlsx');

  // Docs
  const docs = driveClient.resolveDownloadDetails(
    'application/vnd.google-apps.document',
    'Convening Agenda'
  );
  assert.equal(docs.downloadLabel, 'Download as PDF');
  assert.equal(docs.downloadExtension, '.pdf');
  assert.equal(docs.finalName, 'Convening Agenda.pdf');

  // Standard binary
  const binary = driveClient.resolveDownloadDetails('application/pdf', 'guide.pdf');
  assert.equal(binary.downloadLabel, 'Download');
  assert.equal(binary.exportMimeType, undefined);
  assert.equal(binary.finalName, 'guide.pdf');
});

test('4. File size human formatting', () => {
  assert.equal(driveClient.formatFileSize(1477), '1.4 KB');
  assert.equal(driveClient.formatFileSize(2500000), '2.4 MB');
  assert.equal(driveClient.formatFileSize(0), 'Document');
  assert.equal(driveClient.formatFileSize(undefined), 'Document');
});

test('5. Download endpoint rejects invalid ID with 400', async () => {
  const downloadRoute = loadModule('src/app/api/drive/download/[fileId]/route.ts');
  const req = new NextRequest('https://oak.test/api/drive/download/bad--id--<script>');
  const res = await downloadRoute.GET(req, { params: Promise.resolve({ fileId: 'bad--id--<script>' }) });
  assert.equal(res.status, 400);
});

test('6. Download endpoint rejects ID outside Published folder with 404', async () => {
  const downloadRoute = loadModule('src/app/api/drive/download/[fileId]/route.ts');
  // 1oQ2WrV9B6zOQg-2kWPe-HcA51G47qTSgG3YTpduqIkQ is the form file sitting in parent folder, outside Published
  const outsideFileId = '1oQ2WrV9B6zOQg-2kWPe-HcA51G47qTSgG3YTpduqIkQ';
  const req = new NextRequest(`https://oak.test/api/drive/download/${outsideFileId}`);
  const res = await downloadRoute.GET(req, { params: Promise.resolve({ fileId: outsideFileId }) });
  assert.equal(res.status, 404, 'Files outside Published must return 404');
});

test('7. Admin refresh route: non-admin gets 403, admin clears cache and writes audit log', async () => {
  const audit = loadModule('src/lib/audit.ts');
  
  // Non-admin call -> 403
  const refreshRouteNonAdmin = loadModule('src/app/api/admin/drive/refresh/route.ts', {
    '@/lib/auth/server': {
      requireAdmin: async () => ({
        response: NextResponse.json({ error: 'Administrative access denied.' }, { status: 403 }),
      }),
    },
    '@/lib/audit': audit,
  });

  const res403 = await refreshRouteNonAdmin.POST(new NextRequest('https://oak.test/api/admin/drive/refresh', { method: 'POST' }));
  assert.equal(res403.status, 403);

  // Admin call -> 200 & audit log
  const refreshRouteAdmin = loadModule('src/app/api/admin/drive/refresh/route.ts', {
    '@/lib/auth/server': {
      requireAdmin: async () => ({
        user: { email: 'vincent@uncommon.org' },
        adminUser: { email: 'vincent@uncommon.org', role: 'super_admin' },
      }),
    },
    '@/lib/audit': audit,
  });

  const res200 = await refreshRouteAdmin.POST(new NextRequest('https://oak.test/api/admin/drive/refresh', { method: 'POST' }));
  assert.equal(res200.status, 200);

  const logs = await audit.listAuditLogs(10);
  const foundLog = logs.find((l) => l.action === 'drive_cache_refreshed');
  assert.ok(foundLog, 'Audit log must contain drive_cache_refreshed event');
  assert.equal(foundLog.actor_email, 'vincent@uncommon.org');
});

test('8. Live Drive API test: loads Published files, confirms test_presentation.pdf', async () => {
  if (!process.env.GOOGLE_DRIVE_API_KEY || !process.env.GOOGLE_DRIVE_PUBLISHED_FOLDER_ID) {
    console.log('Skipping live test: credentials not set');
    return;
  }

  const result = await driveClient.getPublishedDriveFiles(true);
  assert.equal(result.configured, true);
  assert.ok(result.files.length >= 1, 'Should find at least 1 published file');

  const presFile = result.files.find((f) => f.name.includes('test_presentation.pdf'));
  assert.ok(presFile, 'test_presentation.pdf must be present in Published');
  assert.equal(presFile.category, 'Presentations');

  // Verify categories include Presentations, Notes, Images, Other
  const catNames = result.categories.map((c) => c.name);
  assert.ok(catNames.includes('All'));
  assert.ok(catNames.includes('Presentations'));
  assert.ok(catNames.includes('Notes'));
  assert.ok(catNames.includes('Images'));
  assert.ok(catNames.includes('Other'));

  // Test downloading test_presentation.pdf via route
  const downloadRoute = loadModule('src/app/api/drive/download/[fileId]/route.ts');
  const req = new NextRequest(`https://oak.test/api/drive/download/${presFile.id}`);
  const res = await downloadRoute.GET(req, { params: Promise.resolve({ fileId: presFile.id }) });
  assert.equal(res.status, 200, 'Download of test_presentation.pdf should succeed with 200');
  assert.ok(res.headers.get('content-disposition')?.includes('attachment'), 'Content-Disposition should be attachment');
});
