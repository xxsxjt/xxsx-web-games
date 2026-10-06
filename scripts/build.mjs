import {copyFileSync, cpSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8'));
if(manifest.static.directory!=='dist')throw new Error('Unexpected static directory');
rmSync(resolve(root,'dist'),{recursive:true,force:true});
mkdirSync(resolve(root,'dist/assets'),{recursive:true});
copyFileSync(resolve(root,'index.html'),resolve(root,'dist/index.html'));
cpSync(resolve(root,'src'),resolve(root,'dist/src'),{recursive:true});
for(const file of ['enemy-atlas-v2.webp','enemy-atlas-v3.png','boss-atlas-v2.webp','gear-atlas-v3.webp','player-ship-v2.webp','hangar-backdrop-v1.webp','sector-rainline-v1.webp','sector-abyss-v1.webp']){
  copyFileSync(resolve(root,'assets',file),resolve(root,'dist/assets',file));
}
console.log('Built static game from index.html + src + assets');
