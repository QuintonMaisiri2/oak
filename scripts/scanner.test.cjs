const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function scannerPage({ secure = true, cameraError = null } = {}) {
  let decoded, starts = 0, stops = 0;
  const requests = [], updates = [];
  const hooks = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in hooks)) hooks[slot] = typeof initial === 'function' ? initial() : initial;
      return [hooks[slot], value => { hooks[slot] = value; updates.push(value); }];
    },
    useRef(initial) { const slot = cursor++; return hooks[slot] ||= { current: initial }; },
    useCallback: fn => fn,
    useEffect() {},
  };
  class Html5Qrcode {
    isScanning = false;
    async start(config, options, callback) {
      starts++;
      if (cameraError) throw cameraError;
      this.isScanning = true;
      decoded = callback;
    }
    async stop() { stops++; this.isScanning = false; }
    clear() {}
  }
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/app/admin/scan/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mocks = {
    react,
    'lucide-react': {},
    '@/components/admin/ScanSuccessView': { ScanSuccessView() {} },
    'html5-qrcode': { Html5Qrcode },
  };
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    window: { isSecureContext: secure, scrollTo() {}, dispatchEvent() {} },
    navigator: { mediaDevices: { getUserMedia() {} } },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ status: 'checked_in', attendee: { eventCode: 'OAK-2026-1234-TEST' } }) };
    },
    console: { warn() {}, error() {} }, Event, setTimeout, clearTimeout,
  });
  function render() { cursor = 0; return module.exports.default(); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = find(child, predicate);
      if (match) return match;
    }
  }
  return {
    activate: () => find(render(), n => n.type === 'button' && n.props.children?.includes('Activate Camera Scanner')).props.onClick(),
    scan: code => decoded(code),
    requests, updates,
    starts: () => starts,
    stops: () => stops,
  };
}

test('camera QR detection submits exactly one check-in and displays success', async () => {
  const page = scannerPage();
  await page.activate();
  await Promise.all([page.scan('OAK-2026-1234-TEST'), page.scan('OAK-2026-1234-TEST')]);
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].url, '/api/check-in');
  assert.equal(page.requests[0].body.code, 'OAK-2026-1234-TEST');
  assert.equal(page.stops(), 1);
  assert.ok(page.updates.includes('success'));
});

test('HTTP phone connections get an HTTPS explanation before camera startup', async () => {
  const page = scannerPage({ secure: false });
  await page.activate();
  assert.equal(page.starts(), 0);
  assert.ok(page.updates.some(value => typeof value === 'string' && value.includes('needs HTTPS')));
});

test('camera permission failure allows the user to retry startup', async () => {
  const error = new Error('Permission denied');
  error.name = 'NotAllowedError';
  const page = scannerPage({ cameraError: error });
  await page.activate();
  await page.activate();
  assert.equal(page.starts(), 2);
  assert.ok(page.updates.some(value => typeof value === 'string' && value.includes('permission was denied')));
});
