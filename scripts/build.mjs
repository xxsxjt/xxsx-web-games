import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
if(manifest.static.directory!=='dist')throw new Error('Unexpected static directory');
rmSync(resolve(root,'dist'),{recursive:true,force:true});
const files={},aliases={},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function put(source,bytes,folder){
  const extension=extname(source),name=basename(source,extension),path=`${folder}/${name}.${sha(bytes).slice(0,12)}${extension}`;
  mkdirSync(resolve(root,'dist',dirname(path)),{recursive:true});writeFileSync(resolve(root,'dist',path),bytes);
  files[source]={path,sourceSha256:sha(readFileSync(resolve(root,source))),sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
}
function walk(directory){return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);}
function rewrite(text){for(const [source,item] of Object.entries(files))text=text.split(source).join(item.path);return text;}
const shippedAssets=['enemy-atlas-v3.png','boss-atlas-v2.webp','gear-atlas-v3.webp','player-ship-v2.webp','hangar-backdrop-v1.webp','sector-rainline-v1.webp','sector-abyss-v1.webp'].map(file=>'assets/'+file).concat(walk('assets/covers'));
for(const source of shippedAssets)put(source,readFileSync(resolve(root,source)),dirname(source));
for(const source of walk('content'))put(source,Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8'))),'content');
for(const source of walk('src').filter(file=>/\.(js|css)$/.test(file)))put(source,Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8'))),'static');
for(const source of ['index.html','play.html']){
  const bytes=Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8')));writeFileSync(resolve(root,'dist',source),bytes);
  files[source]={path:source,sourceSha256:sha(readFileSync(resolve(root,source))),sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
}
const hubGzipBytes=['index.html','src/hub.css','src/hub.js','content/games.json'].reduce((sum,file)=>sum+files[file].gzipBytes,0);
// Keep previous public asset/script URLs during the first migration release.
// They are not requested by the new homepage or hashed game entry.
for(const source of ['src/catalog.js','src/core.js','src/runtime.js','src/blackbox.js','src/arcade.js','src/border.js','src/game.js','src/styles.css',...shippedAssets.filter(file=>!file.includes('/covers/')),'assets/enemy-atlas-v2.webp']){
  const bytes=readFileSync(resolve(root,source));mkdirSync(resolve(root,'dist',dirname(source)),{recursive:true});writeFileSync(resolve(root,'dist',source),bytes);aliases[source]={sha256:sha(bytes),bytes:bytes.length};
}
writeFileSync(resolve(root,'dist/release-manifest.json'),JSON.stringify({version:'V51',files,aliases,hubGzipBytes},null,2)+'\n');
console.log(`Built V51 static hub + legacy games; homepage HTML/CSS/JS/catalog gzip: ${hubGzipBytes} bytes (covers separate).`);
