import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
if(manifest.static.directory!=='dist')throw new Error('Unexpected static directory');
const version='V62',retained={};
// Preserve published hash URLs, including the inherited compatibility set.
// Rebuilds of this version retain that set without accumulating unpublished edits.
try{
  const previous=JSON.parse(readFileSync(resolve(root,'dist/release-manifest.json'),'utf8'));
  const items=previous.version===version?Object.values(previous.previousFiles||previous.retained||{}):Object.values(previous.files||{}).filter(item=>/\.[0-9a-f]{12}\./.test(item.path)).concat(Object.values(previous.previousFiles||previous.retained||{}));
  for(const item of items)retained[item.path]={bytes:readFileSync(resolve(root,'dist',item.path)),sha256:item.sha256};
}catch(error){if(error.code!=='ENOENT')throw error;}
const files={},aliases={},sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function put(source,bytes,folder){
  const extension=extname(source),name=basename(source,extension),path=`${folder}/${name}.${sha(bytes).slice(0,12)}${extension}`;
  mkdirSync(resolve(root,'dist',dirname(path)),{recursive:true});writeFileSync(resolve(root,'dist',path),bytes);
  files[source]={path,sourceSha256:sha(readFileSync(resolve(root,source))),sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
}
function walk(directory){return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${directory}/${entry.name}`):[`${directory}/${entry.name}`]);}
function rewrite(text){for(const [source,item] of Object.entries(files))text=text.split(source).join(item.path);return text;}
const games=JSON.parse(readFileSync(resolve(root,'content/games.json'),'utf8'));
const shippedAssets=['enemy-atlas-v3.png','boss-atlas-v2.webp','gear-atlas-v3.webp','player-ship-v2.webp','hangar-backdrop-v1.webp','sector-rainline-v1.webp','sector-abyss-v1.webp','dimensional-market-hall.svg'].map(file=>'assets/'+file).concat(games.map(game=>game.cover));
// 生成美术（tools/art 产出的 200 张图）走目录扫描，不再逐个列举：
// 漏一张就是格子里一个破图，而且很难在测试里发现。
for(const dir of ['assets/items','assets/machines','assets/facilities','assets/portraits','assets/worlds']){
  try{ shippedAssets.push(...walk(dir).filter(file=>/\.(png|webp|jpg)$/i.test(file))); }catch(e){ /* 目录还没生成则跳过 */ }
}
// art-index.js 是运行时读取的索引，存的是源路径（assets/items/x.png）。
// 构建时图片会被改成带哈希的名字，所以索引必须走 rewrite() 同步替换，
// 否则线上索引指向一堆 404。
try{ shippedAssets.push('assets/art-index.js'); }catch(e){}
for(const source of shippedAssets){
  // art-index.js / 文本类资源需要做路径重写，图片保持原始字节
  const isText=/\.(js|css|json|svg|html)$/i.test(source);
  put(source,isText?Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8'))):readFileSync(resolve(root,source)),dirname(source));
}
for(const source of walk('content'))put(source,Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8'))),'content');
for(const source of walk('src').filter(file=>/\.(js|css)$/.test(file)))put(source,Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8'))),'static');
for(const source of ['index.html','play.html','wasteland.html']){
  const bytes=Buffer.from(rewrite(readFileSync(resolve(root,source),'utf8')));writeFileSync(resolve(root,'dist',source),bytes);
  files[source]={path:source,sourceSha256:sha(readFileSync(resolve(root,source))),sha256:sha(bytes),bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
}
const hubGzipBytes=['index.html','src/hub.css','src/hub.js','content/games.json'].reduce((sum,file)=>sum+files[file].gzipBytes,0);
// Keep previous public asset/script URLs during the first migration release.
// They are not requested by the new homepage or hashed game entry.
// 注意：这里不能再用 shippedAssets 展开——它现在包含 200 张生成美术，
// 展开会把每个文件额外复制一份非哈希副本，仓库体积直接翻倍。
const legacyAssets=['enemy-atlas-v3.png','boss-atlas-v2.webp','gear-atlas-v3.webp','player-ship-v2.webp','hangar-backdrop-v1.webp','sector-rainline-v1.webp','sector-abyss-v1.webp','dimensional-market-hall.svg'].map(file=>'assets/'+file);
for(const source of ['src/catalog.js','src/core.js','src/runtime.js','src/blackbox.js','src/arcade.js','src/border.js','src/game.js','src/styles.css',...legacyAssets,'assets/enemy-atlas-v2.webp']){
  const bytes=readFileSync(resolve(root,source));mkdirSync(resolve(root,'dist',dirname(source)),{recursive:true});writeFileSync(resolve(root,'dist',source),bytes);aliases[source]={sha256:sha(bytes),bytes:bytes.length};
}
const retainedManifest={},previousFiles={};
for(const [path,item] of Object.entries(retained)){
  previousFiles[path]={path,sha256:item.sha256,bytes:item.bytes.length};
  if(Object.values(files).some(file=>file.path===path))continue;
  if(sha(item.bytes)!==item.sha256)throw new Error('Corrupt retained resource: '+path);
  mkdirSync(resolve(root,'dist',dirname(path)),{recursive:true});writeFileSync(resolve(root,'dist',path),item.bytes);retainedManifest[path]={path,sha256:item.sha256,bytes:item.bytes.length};
}
writeFileSync(resolve(root,'dist/release-manifest.json'),JSON.stringify({version,files,aliases,retained:retainedManifest,previousFiles,hubGzipBytes},null,2)+'\n');
console.log(`Built ${version}; homepage HTML/CSS/JS/catalog gzip: ${hubGzipBytes} bytes (icons separate).`);
