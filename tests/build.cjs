const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const approvedTemp = path.join(os.tmpdir(), 'opencode');
const fixture = fs.mkdtempSync(path.join(fs.existsSync(approvedTemp) ? approvedTemp : os.tmpdir(), 'xxsx-build-'));
const dist = path.join(fixture, 'dist');
const fromDist = file => path.join(dist, file);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = require('../scripts/published-assets.json');
const read = file => fs.readFileSync(path.join(fixture, file));
const write = (file, data) => fs.writeFileSync(path.join(fixture, file), data);

function files(directory, prefix = '') {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(item => {
    const relative = prefix + item.name;
    return item.isDirectory() ? files(path.join(directory, item.name), relative + '/') : [relative];
  }).sort();
}

function snapshot() {
  return Object.fromEntries(files(dist).map(file => [file, sha(fs.readFileSync(fromDist(file)))]));
}

function build(error) {
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], {cwd: fixture, encoding: 'utf8', timeout: 30000});
  assert.ifError(result.error);
  if (error) {
    assert.notEqual(result.status, 0, 'invalid fixture must fail');
    assert.match(result.stderr, error);
  } else {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Built V\d+;/);
  }
  return result;
}

function noDebris() {
  assert.equal(fs.readdirSync(fixture).some(name => /^\.dist-(?:build|backup)/.test(name)), false);
}

function failureLeavesDist(error) {
  const before = snapshot();
  build(error);
  assert.deepEqual(snapshot(), before, 'failed builds must not modify the existing release');
  noDebris();
}

try {
  for (const source of ['.openai/hosting.json', 'package.json', 'scripts/build.mjs', 'scripts/published-assets.json',
    'index.html', 'play.html', 'content', 'assets', 'src', 'games', 'dist']) {
    fs.cpSync(path.join(root, source), path.join(fixture, source), {recursive: true});
  }
  build();
  const stable = snapshot();
  build();
  assert.deepEqual(snapshot(), stable, 'identical inputs must generate byte-identical releases');
  assert(Object.keys(assets).length >= 75, 'V57 pinned inventory is required');
  for (const [file, digest] of Object.entries(assets)) assert.equal(stable[file], digest, file);

  // Make checkout newline differences explicit, including a pinned historical asset.
  const crlf = bytes => bytes.toString('utf8').replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n');
  const oldScript = 'static/game.a9c1d979b064.js';
  for (const file of ['index.html', 'games/shell-heist.html', 'src/hub.js', 'content/games.json', 'dist/' + oldScript]) {
    write(file, crlf(read(file)));
  }
  build();
  assert.deepEqual(snapshot(), stable, 'CRLF inputs must yield the LF release, including legacy URLs');

  // The generated manifest is not the source of truth for historical paths.
  fs.rmSync(fromDist('release-manifest.json'));
  build();
  assert.deepEqual(snapshot(), stable);
  const original = read('dist/' + oldScript);
  fs.rmSync(fromDist(oldScript));
  failureLeavesDist(/Missing published asset:/);
  write('dist/' + oldScript, 'corrupt resource\n');
  failureLeavesDist(/Corrupt retained resource:/);
  write('dist/' + oldScript, original);

  // Rewriting must preserve the document-relative prefix for classic nested-page
  // scripts, and the stylesheet-relative prefix for CSS url() references.
  const css = read('src/shell-heist.css');
  const js = read('src/shell-heist.js');
  const icon = 'assets/icons/shell-heist.svg';
  write('src/shell-heist.css', Buffer.concat([css, Buffer.from(`\n.build-fixture{background:url(../${icon})}\n`)]));
  write('src/shell-heist.js', Buffer.concat([js, Buffer.from(`\nvoid '../${icon}';\n`)]));
  build();
  const m = JSON.parse(read('dist/release-manifest.json'));
  assert.match(read('dist/' + m.files['src/shell-heist.css'].path).toString(), /url\(\.\.\/assets\/icons\/shell-heist\.[a-f0-9]{12}\.svg\)/);
  assert.ok(read('dist/' + m.files['src/shell-heist.js'].path).toString().includes("'../" + m.files[icon].path + "'"));

  // Same reference without ../ would point at /project/games/assets/, not assets/.
  write('src/shell-heist.js', Buffer.concat([js, Buffer.from(`\nvoid '${icon}';\n`)]));
  failureLeavesDist(/Missing published reference in games\/shell-heist\.html:/);
  write('src/shell-heist.js', js);
  write('src/shell-heist.css', css);

  const page = read('games/borrowed-seconds.html');
  fs.rmSync(path.join(fixture, 'games/borrowed-seconds.html'));
  failureLeavesDist(/borrowed-seconds\.html/);
  write('games/borrowed-seconds.html', Buffer.concat([page, Buffer.from('\n<link rel="stylesheet" href="missing.css">\n')]));
  failureLeavesDist(/Missing published reference in games\/borrowed-seconds\.html:/);
  write('games/borrowed-seconds.html', page);

  const lock = path.join(fixture, '.dist-build-lock');
  fs.mkdirSync(lock);
  const before = snapshot();
  build(/already holds/);
  assert.deepEqual(snapshot(), before, 'a concurrent writer must not swap the release');
  fs.rmdirSync(lock);
  build();
  assert.deepEqual(snapshot(), stable, 'a recovered build must return to the same release');
  noDebris();
  console.log('PASS builder: deterministic LF/CRLF output, pinned URLs, base-relative references and failed-build protection');
} finally {
  fs.rmSync(fixture, {recursive: true, force: true});
}
