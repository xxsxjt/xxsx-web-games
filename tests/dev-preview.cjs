const assert = require('node:assert/strict');
const { readdirSync } = require('node:fs');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

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
