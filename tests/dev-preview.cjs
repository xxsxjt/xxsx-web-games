const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const cachedReleases = [
  {version: 'V58', catalog: '/content/games.0756d5004458.json', hub: '/static/hub.df59a9ef57b7.js', count: 8},
  {version: 'V59', catalog: '/content/games.7b005c44460f.json', hub: '/static/hub.c1ab18d37dc7.js', count: 9},
];

async function start(modeArgs) {
  const child = spawn(process.execPath, ['scripts/dev.mjs', '--no-vite', '--port', '0', ...modeArgs], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
    if (match) return { child, port: Number(match[1]), getOutput: () => stdout + stderr };
    if (child.exitCode !== null) throw new Error(`Preview server exited early (${child.exitCode}): ${stdout}${stderr}`);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  child.kill();
  throw new Error(`Preview server did not become ready: ${stdout}${stderr}`);
}

function request(port, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function stop(server) {
  if (!server.child.killed) {
    server.child.kill();
    await Promise.race([once(server.child, 'exit'), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
}

async function sourcePreviewChecks() {
  const server = await start([]);
  try {
    assert.equal((await request(server.port, '/')).status, 200);
    assert.equal((await request(server.port, '/src/hub.js')).status, 200);
    assert.equal((await request(server.port, '/tests/game-viewports.html')).status, 200);
    assert.equal((await request(server.port, '/dist/index.html')).status, 200);
    assert.equal((await request(server.port, '/play.html')).status, 200);
    assert.equal((await request(server.port, '/missing-preview-route')).status, 200, 'source preview should support SPA routes');
    for (const pathname of ['/scripts/dev.mjs', '/README.md', '/package.json', '/.git/config', '/docs/active-development.md']) {
      assert.equal((await request(server.port, pathname)).status, 404, `${pathname} should not be exposed`);
    }
    assert.equal((await request(server.port, '/missing-file.js')).status, 404);
    assert.equal((await request(server.port, '/missing-file.js', 'HEAD')).status, 404);
    assert.match(server.getOutput(), /127\.0\.0\.1:/, 'source preview should bind loopback by default');
  } finally {
    await stop(server);
  }
}

async function distPreviewChecks() {
  const server = await start(['--dist']);
  try {
    const publishedAsset = readdirSync(path.join(projectRoot, 'dist', 'static')).find(name => name.endsWith('.js'));
    assert.ok(publishedAsset, 'dist should contain a built JavaScript asset');
    assert.equal((await request(server.port, '/')).status, 200);
    assert.equal((await request(server.port, '/index.html')).status, 200);
    assert.equal((await request(server.port, `/static/${publishedAsset}`)).status, 200);
    const release = await request(server.port, '/release-manifest.json');
    assert.equal(release.status, 200);
    const {files} = JSON.parse(release.body);
    const page = await request(server.port, '/games/overprint.html');
    assert.equal(page.status, 200);
    assert.match(page.body, /id="work-board"/);
    for (const [source, type] of [['src/overprint.js', /javascript/], ['src/overprint.css', /text\/css/], ['assets/icons/overprint.svg', /image\/svg\+xml/]]) {
      const {path: url} = files[source];
      assert.ok(page.body.includes(`"../${url}"`), `${url} must be referenced by the served entry`);
      const asset = await request(server.port, '/' + url);
      assert.equal(asset.status, 200, url);
      assert.match(asset.type, type);
    }
    for (const {version, catalog, hub, count} of cachedReleases) {
      const previousHub = await request(server.port, hub);
      const previousCatalog = await request(server.port, catalog);
      assert.equal(previousHub.status, 200, version + ' cached home pages can still load their script');
      assert.equal(previousCatalog.status, 200, version + ' script can still fetch its own catalogue');
      assert.ok(previousHub.body.includes(catalog.slice(1)));
      const entries = JSON.parse(previousCatalog.body);
      assert.equal(entries.length, count);
      for (const entry of entries) {
        assert.equal((await request(server.port, '/' + entry.cover)).status, 200, version + ' cover remains available: ' + entry.id);
        if (entry.entry) assert.equal((await request(server.port, '/' + entry.entry)).status, 200, version + ' standalone route remains available: ' + entry.id);
      }
    }
    assert.equal((await request(server.port, '/tests/game-viewports.html')).status, 404);
    assert.equal((await request(server.port, '/package.json')).status, 404);
    assert.equal((await request(server.port, '/not-a-published-page')).status, 404, 'dist preview must not use SPA fallback');
    assert.match(server.getOutput(), /Static dist preview at http:\/\/127\.0\.0\.1:/);
  } finally {
    await stop(server);
  }
}

(async () => {
  await sourcePreviewChecks();
  await distPreviewChecks();
  console.log('dev preview checks passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
