const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const pinned = require('../scripts/published-assets.json');
const cachedReleases = [
  {version: 'V58', catalog: '/content/games.0756d5004458.json', hub: '/static/hub.df59a9ef57b7.js', count: 8},
  {version: 'V59', catalog: '/content/games.7b005c44460f.json', hub: '/static/hub.c1ab18d37dc7.js', count: 9},
  {version: 'V60', catalog: '/content/games.5c6a19a2a503.json', hub: '/static/hub.bdbc90a5eeab.js', count: 10},
];
const independentGames = [['overprint', 'work-board'], ['borrowed-seconds', 'seconds-game'], ['ember-convoy', 'ember-convoy']];

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
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        resolve({status: res.statusCode, type: res.headers['content-type'], body: bytes.toString('utf8'),
          sha256: createHash('sha256').update(bytes).digest('hex')});
      });
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
    for (const [name, host] of independentGames) {
      const page = await request(server.port, `/games/${name}.html`);
      assert.equal(page.status, 200);
      assert.ok(page.body.includes(`id="${host}"`));
      for (const source of [`src/${name}.js`, `src/${name}.css`, `assets/icons/${name}.svg`]) {
        assert.equal((await request(server.port, '/' + source)).status, 200);
      }
    }
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
    for (const [name, host] of independentGames) {
      const page = await request(server.port, `/games/${name}.html`);
      assert.equal(page.status, 200);
      assert.ok(page.body.includes(`id="${host}"`));
      for (const [source, type] of [[`src/${name}.js`, /javascript/], [`src/${name}.css`, /text\/css/], [`assets/icons/${name}.svg`, /image\/svg\+xml/]]) {
        const {path: url, sha256} = files[source];
        assert.ok(page.body.includes(`"../${url}"`), `${url} must be referenced by the served entry`);
        const asset = await request(server.port, '/' + url);
        assert.equal(asset.status, 200, url);
        assert.match(asset.type, type);
        assert.equal(asset.sha256, sha256, 'preview must serve the built bytes: ' + url);
      }
    }
    for (const {version, catalog, hub, count} of cachedReleases) {
      const previousHub = await request(server.port, hub);
      const previousCatalog = await request(server.port, catalog);
      assert.equal(previousHub.status, 200, version + ' cached home pages can still load their script');
      assert.equal(previousCatalog.status, 200, version + ' script can still fetch its own catalogue');
      assert.equal(previousHub.sha256, pinned[hub.slice(1)], version + ' retained script bytes');
      assert.equal(previousCatalog.sha256, pinned[catalog.slice(1)], version + ' retained catalogue bytes');
      assert.ok(previousHub.body.includes(catalog.slice(1)));
      const entries = JSON.parse(previousCatalog.body);
      assert.equal(entries.length, count);
      for (const entry of entries) {
        assert.equal((await request(server.port, '/' + entry.cover)).status, 200, version + ' cover remains available: ' + entry.id);
        if (entry.entry) assert.equal((await request(server.port, '/' + entry.entry)).status, 200, version + ' standalone route remains available: ' + entry.id);
      }
    }
    // A previously cached standalone page still names its old JS and CSS.
    for (const url of ['static/overprint.b0ba45218c83.js', 'static/overprint.b6e6ef4bf0fa.css',
      'static/borrowed-seconds.64c63a6858ba.js', 'static/borrowed-seconds.c5fe44fe85d3.css']) {
      const asset = await request(server.port, '/' + url);
      assert.equal(asset.status, 200, url);
      assert.equal(asset.sha256, pinned[url], 'cached standalone resource bytes: ' + url);
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
