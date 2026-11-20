import {mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmdirSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {basename, dirname, extname, join, posix, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const text = /\.(?:css|html|js|json|svg)$/i;
const hashName = /\.([a-f0-9]{12})\.[a-z0-9]+$/i;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sorted = values => values.sort();
const cssUrls = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi;
const jsUrls = /(?<=["'(`])((?:(?:\.\.\/)+|\.\/)?(?:assets|content)\/[\w./-]+)(?=["'`\)])/g;

function localPath(path) {
  if (typeof path !== 'string' || !/^[\w-]+(?:\.[\w-]+)*(?:\/[\w-]+(?:\.[\w-]+)*)*$/.test(path)) {
    throw new Error(`Invalid release path: ${path}`);
  }
  return path;
}

function canonical(path, bytes) {
  return text.test(path) ? Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n')) : bytes;
}

function readSource(path) {
  return canonical(path, readFileSync(join(root, localPath(path))));
}

function walk(directory, prefix) {
  return sorted(readdirSync(directory, {withFileTypes: true})).flatMap(kind => {
    const name = kind.name;
    const path = prefix ? `${prefix}/${name}` : name;
    const entry = join(directory, name);
    // Enumerate regular files/directories only; do not traverse symlinks or junctions.
    if (kind.isDirectory()) return walk(entry, path);
    if (kind.isFile()) return [localPath(path)];
    throw new Error(`Unexpected release input: ${path}`);
  });
}

function historicalFiles() {
  // This inventory records only published URLs. A missing/generated manifest
  // cannot erase history; preview builds do not append their transient hashes.
  const pinned = JSON.parse(readSource('scripts/published-assets.json'));
  if (!pinned || typeof pinned !== 'object' || Array.isArray(pinned) || !Object.keys(pinned).length) {
    throw new Error('Expected a non-empty published asset inventory');
  }
  const retained = new Map();
  for (const [path, expected] of Object.entries(pinned)) {
    localPath(path);
    const name = path.match(hashName);
    if (!name || !/^[a-f0-9]{64}$/.test(expected) || !expected.startsWith(name[1])) {
      throw new Error(`Invalid historical hash URL or digest: ${path}`);
    }
    let bytes;
    try { bytes = readFileSync(join(dist, path)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Missing published asset: ${path}; recover its exact bytes from a Git release before rebuilding`);
      throw error;
    }
    if (sha(bytes) !== expected) {
      bytes = canonical(path, bytes);
      if (sha(bytes) !== expected) throw new Error(`Corrupt retained resource: ${path}`);
    }
    retained.set(path, {path, sha256: expected, bytes});
  }
  return retained;
}

function validateLinks(output, pages, destinations, catalogPath) {
  const base = new URL('https://release.invalid/preview/');
  const read = path => readFileSync(join(output, path), 'utf8');
  function requireLocal(ref, owner) {
    const url = new URL(ref, new URL(owner, base));
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`Expected a relative release URL in ${owner}: ${ref}`);
    const path = url.pathname.slice(base.pathname.length) + (url.pathname.endsWith('/') ? 'index.html' : '');
    if (!destinations.has(path)) throw new Error(`Missing published reference in ${owner}: ${ref} -> ${path}`);
    return path;
  }

  for (const owner of pages) {
    const body = read(owner), scripts = new Set(), styles = new Set();
    for (const [, attr, , ref] of body.matchAll(/\s(src|href)\s*=\s*(["'])(.*?)\2/gi)) {
      if (/^(?:data:|https?:\/\/)/i.test(ref)) continue;
      const path = requireLocal(ref, owner);
      if (attr === 'src' && path.endsWith('.js')) scripts.add(path);
      if (attr === 'href' && path.endsWith('.css')) styles.add(path);
    }
    const config = body.match(/<script type="application\/json" id="gameFiles">([^<]+)<\/script>/);
    if (config) for (const ref of Object.values(JSON.parse(config[1]))) {
      const path = requireLocal(ref, owner);
      if (!path.endsWith('.js')) throw new Error(`Expected script in ${owner} gameFiles: ${ref}`);
      scripts.add(path);
    }
    // Classic scripts resolve these literal asset and fetch URLs against their
    // page; linked CSS resolves url() against the emitted stylesheet itself.
    for (const path of scripts) for (const [, ref] of read(path).matchAll(jsUrls)) requireLocal(ref, owner);
    for (const path of styles) for (const match of read(path).matchAll(cssUrls)) {
      const ref = match[1] ?? match[2] ?? match[3];
      if (!/^(?:data:|https?:\/\/|#)/i.test(ref)) requireLocal(ref, path);
    }
  }
  for (const game of JSON.parse(read(catalogPath))) {
    // Covers and entry URLs are consumed by the root hub, not by the JSON file.
    requireLocal(game.cover, 'index.html');
    if (game.entry) requireLocal(game.entry, 'index.html');
  }
}

function write(directory, path, bytes) {
  const target = join(directory, localPath(path));
  mkdirSync(dirname(target), {recursive: true});
  writeFileSync(target, bytes);
}

function build(output, version, retained) {
  const files = {}, aliases = {}, destinations = new Set();

  function emit(source, bytes, directory) {
    const extension = extname(source);
    const sha256 = sha(bytes);
    const path = directory === undefined ? source : `${directory}/${basename(source, extension)}.${sha256.slice(0, 12)}${extension}`;
    if (destinations.has(path)) throw new Error(`Duplicate release output: ${path}`);
    destinations.add(path);
    files[source] = {path, sourceSha256: sha(readSource(source)), sha256, bytes: bytes.length, gzipBytes: gzipSync(bytes).length};
    write(output, path, bytes);
  }

  const catalogPath = 'content/games.json';
  const games = JSON.parse(readSource(catalogPath));
  if (!Array.isArray(games) || !games.length) throw new Error('Expected a non-empty game catalogue');
  const legacyAssets = [
    'enemy-atlas-v3.png', 'boss-atlas-v2.webp', 'gear-atlas-v3.webp', 'player-ship-v2.webp',
    'hangar-backdrop-v1.webp', 'sector-rainline-v1.webp', 'sector-abyss-v1.webp'
  ].map(name => `assets/${name}`);
  const pages = new Set(['index.html', 'play.html']);
  const ids = new Set();
  for (const game of games) {
    if (!game || typeof game.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(game.id) || ids.has(game.id)) throw new Error(`Invalid game ID: ${game?.id}`);
    ids.add(game.id);
    if (!localPath(game.cover).startsWith('assets/')) throw new Error(`Cover must be in assets/: ${game.id}`);
    if (game.entry !== undefined) {
      if (!/^games\/[a-z0-9-]+\.html$/.test(localPath(game.entry)) || pages.has(game.entry)) throw new Error(`Invalid game entry: ${game.id}`);
      pages.add(game.entry);
    }
  }

  for (const source of sorted([...new Set(legacyAssets.concat(games.map(game => game.cover)))])) {
    emit(source, readSource(source), posix.dirname(source));
  }
  // Preserve catalogue formatting to avoid gratuitous hash changes, replacing
  // only complete JSON string values that refer to published resources.
  for (const source of walk(join(root, 'content'), 'content').filter(path => path.endsWith('.json'))) {
    const body = readSource(source).toString('utf8').replace(/"(assets\/[\w./-]+)"/g, (match, path) => files[path] ? `"${files[path].path}"` : match);
    emit(source, Buffer.from(body), posix.dirname(source));
  }

  // Classic JS resource strings (fetch, image sources and inline styles) resolve
  // against their document. CSS url() resolves against the stylesheet instead.
  for (const source of walk(join(root, 'src'), 'src').filter(path => /\.(?:js|css)$/.test(path))) {
    const directory = posix.dirname(source).replace(/^src\b/, 'static');
    const original = readSource(source).toString('utf8');
    const body = source.endsWith('.css') ? original.replace(cssUrls, (match, double, single, bare) => {
      const ref = double ?? single ?? bare;
      if (!/^(?:(?:\.\.\/)+|\.\/)?assets\//.test(ref)) return match;
      const path = posix.normalize(posix.join(posix.dirname(source), ref));
      if (!files[path]) throw new Error(`Unpublished CSS resource in ${source}: ${ref}`);
      const quote = double !== undefined ? '"' : single !== undefined ? "'" : '';
      return `url(${quote}${posix.relative(directory, files[path].path)}${quote})`;
    }) : original.replace(jsUrls, (match, ref) => {
      const prefix = ref.match(/^(?:\.\.\/)+|^\.\//)?.[0] ?? '';
      const path = ref.slice(prefix.length);
      if (!files[path]) throw new Error(`Unpublished JS resource in ${source}: ${path}`);
      return prefix + files[path].path;
    });
    emit(source, Buffer.from(body), directory);
  }

  for (const source of pages) {
    // Also handles the existing application/json gameFiles values and CSS/image
    // references in attributes. Relative entry links themselves stay stable.
    const body = readSource(source).toString('utf8').replace(/(["'])((?:\.\.\/|\.\/)?(?:src|assets|content)\/[\w./-]+)\1/g, (match, quote, ref) => {
      const path = posix.normalize(posix.join(posix.dirname(source), ref));
      if (!files[path]) throw new Error(`Unpublished page resource in ${source}: ${ref}`);
      return `${quote}${posix.relative(posix.dirname(source), files[path].path)}${quote}`;
    });
    emit(source, Buffer.from(body));
  }

  // V50 aliases remain byte-compatible in shape, served under their old paths.
  for (const path of [
    'src/catalog.js', 'src/core.js', 'src/runtime.js', 'src/blackbox.js', 'src/arcade.js',
    'src/border.js', 'src/game.js', 'src/styles.css', ...legacyAssets, 'assets/enemy-atlas-v2.webp'
  ]) {
    const bytes = readSource(path);
    write(output, path, bytes);
    aliases[path] = {sha256: sha(bytes), bytes: bytes.length};
  }

  const previousFiles = {}, retainedManifest = {};
  for (const path of sorted([...retained.keys()])) {
    const item = retained.get(path);
    const entry = {path, sha256: item.sha256, bytes: item.bytes.length};
    previousFiles[path] = entry;
    if (!destinations.has(path)) {
      write(output, path, item.bytes);
      retainedManifest[path] = entry;
    }
  }
  const hubGzipBytes = ['index.html', 'src/hub.css', 'src/hub.js', catalogPath].reduce((sum, path) => sum + files[path].gzipBytes, 0);
  const manifest = {version, files, aliases, retained: retainedManifest, previousFiles, hubGzipBytes};
  write(output, 'release-manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  function verify(path, item) {
    const bytes = readFileSync(join(output, path));
    if (bytes.length !== item.bytes || sha(bytes) !== item.sha256) throw new Error(`Staged verification failed: ${path}`);
  }
  for (const item of Object.values(files)) verify(item.path, item);
  for (const item of Object.values(previousFiles)) verify(item.path, item);
  for (const [path, item] of Object.entries(aliases)) verify(path, item);
  validateLinks(output, pages, destinations, files[catalogPath].path);
  return hubGzipBytes;
}

function publish(output) {
  const backup = join(root, basename(output).replace('.dist-build-', '.dist-backup-'));
  let moved = false;
  try {
    try { renameSync(dist, backup); moved = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    renameSync(output, dist);
  } catch (error) {
    if (moved) {
      try { renameSync(backup, dist); }
      catch (rollback) { throw new AggregateError([error, rollback], `Could not restore the previous release; backup at ${backup}`); }
    }
    throw error;
  }
  if (moved) {
    try { rmSync(backup, {recursive: true}); }
    catch (error) { console.warn(`Release built; could not remove old output at ${backup}: ${error.code}`); }
  }
}

const hosting = JSON.parse(readFileSync(resolve(root, '.openai/hosting.json'), 'utf8'));
const {releaseVersion: version} = JSON.parse(readSource('package.json'));
if (hosting.static.directory !== 'dist' || !/^V[1-9]\d*$/.test(version)) throw new Error('Invalid static build configuration');

const lock = join(root, '.dist-build-lock');
try { mkdirSync(lock); }
catch (error) {
  if (error.code === 'EEXIST') throw new Error('A build already holds .dist-build-lock; remove the empty lock only if the previous builder has stopped');
  throw error;
}

let output;
try {
  const retained = historicalFiles();
  output = mkdtempSync(join(root, '.dist-build-'));
  const hubGzipBytes = build(output, version, retained);
  publish(output);
  console.log(`Built ${version}; homepage HTML/CSS/JS/catalog gzip: ${hubGzipBytes} bytes (icons separate).`);
} finally {
  try { if (output) rmSync(output, {recursive: true, force: true}); }
  finally { rmdirSync(lock); }
}
