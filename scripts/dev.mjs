import { createServer as createHttpServer } from 'node:http';
import { realpath, readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname, relative, isAbsolute } from 'node:path';

const args = process.argv.slice(2);
const root = await realpath(resolve('.'));
const parsed = parseArgs(args);

if (parsed.mode === 'dist') {
  const distRoot = await realpath(resolve(root, 'dist'));
  if (!isWithin(root, distRoot)) throw new Error('dist must remain within the project root');
  await startStaticServer({ root: distRoot, port: parsed.port, host: parsed.host, strictPort: parsed.strictPort, spaFallback: false });
} else if (parsed.useVite) {
  try {
    const { createServer } = await import('vite');
    const server = await createServer({
      configFile: resolve(root, 'vite.config.js'),
      server: { host: parsed.host, port: parsed.port, strictPort: parsed.strictPort },
    });
    await server.listen();
    server.printUrls();
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    await startStaticServer({ root, port: parsed.port, host: parsed.host, strictPort: parsed.strictPort, spaFallback: true });
  }
} else {
  await startStaticServer({ root, port: parsed.port, host: parsed.host, strictPort: parsed.strictPort, spaFallback: true });
}

function parseArgs(argv) {
  let mode = 'source';
  let port = 5173;
  let strictPort = false;
  let host = '127.0.0.1';
  let useVite = true;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dist') mode = 'dist';
    else if (arg === '--strictPort') strictPort = true;
    else if (arg === '--no-vite') useVite = false;
    else if (arg === '--host') {
      const value = argv[++i];
      if (!value) throw new Error('--host requires a value');
      host = value;
    } else if (arg === '--port') {
      const value = argv[++i];
      port = Number(value);
      if (!value || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer from 0 to 65535');
    } else {
      throw new Error(`Unknown dev option: ${arg}`);
    }
  }
  return { mode, port, strictPort, host, useVite };
}

async function startStaticServer({ root: serveRoot, port, host, strictPort, spaFallback }) {
  const allowedRoots = spaFallback
    ? await Promise.all(['src', 'assets', 'content', 'games', 'tests', 'dist'].map(path => realpath(resolve(root, path)).catch(() => null))).then(paths => paths.filter(path => path && isWithin(root, path)))
    : [serveRoot];
  const publicEntryFiles = spaFallback
    ? await Promise.all(['index.html', 'play.html'].map(path => realpath(resolve(root, path)).catch(() => null))).then(paths => paths.filter(path => path && isWithin(root, path)))
    : [];
  const mime = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  };
  const server = createHttpServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); res.end(); return; }
      if (pathname.includes('\\') || pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
      const candidate = resolve(serveRoot, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
      if (!isWithin(serveRoot, candidate) || candidate.split(sep).some(part => part.startsWith('.'))) { res.writeHead(404); res.end('Not found'); return; }
      let file;
      try { file = await realpath(candidate); } catch { file = null; }
      const isPublicEntry = publicEntryFiles.includes(file) && (pathname === '/' || pathname === '/index.html' || pathname === '/play.html');
      if (file && (!allowedRoots.some(allowed => isWithin(allowed, file)) && !isPublicEntry || (spaFallback && !isPublicSourcePath(pathname)))) { res.writeHead(404); res.end('Not found'); return; }
      let fileStat;
      try { fileStat = file ? await stat(file) : null; } catch { fileStat = null; }
      if (!fileStat?.isFile()) {
        if (spaFallback && !extname(pathname) && !isRestrictedSourcePath(pathname) && pathname !== '/favicon.ico') {
          file = resolve(root, 'index.html');
          fileStat = await stat(file).catch(() => null);
        }
        if (!fileStat?.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      }
      const body = req.method === 'HEAD' ? null : await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end('Internal server error');
    }
  });
  let listenPort = port;
  for (;;) {
    try {
      await new Promise((resolveListen, rejectListen) => {
        const onError = error => { server.off('listening', onListening); rejectListen(error); };
        const onListening = () => { server.off('error', onError); resolveListen(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(listenPort, host);
      });
      break;
    } catch (error) {
      if (strictPort || error.code !== 'EADDRINUSE' || listenPort === 0 || listenPort === 65535) throw error;
      listenPort++;
    }
  }
  {
    const address = server.address();
    console.log(`Static ${spaFallback ? 'source' : 'dist'} preview at http://${host}:${address.port}/`);
  }
}

function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function isPublicSourcePath(pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/play.html') return true;
  if (/^\/(src|assets|content|games|dist)\//.test(pathname)) return true;
  return /^\/tests\/[^/]+\.html$/.test(pathname);
}

function isRestrictedSourcePath(pathname) {
  return /^\/(?:scripts|docs|\.git|\.codex|\.hallmark|\.openai)(?:\/|$)/.test(pathname);
}
