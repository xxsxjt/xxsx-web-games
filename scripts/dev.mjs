import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
// Prefer the declared Vite installation. Static projects remain previewable
// in environments where package downloads are unavailable.
try {
  const {createServer: createViteServer}=await import('vite');
  const args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1])||5173;
  const server=await createViteServer({server:{host:'0.0.0.0',port,strictPort:args.includes('--strictPort'),allowedHosts:['terminal.local']}});
  await server.listen();server.printUrls();
} catch(error) {
  if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;
  const root=resolve('.'),args=process.argv.slice(2),port=Number(args[args.indexOf('--port')+1])||5173;
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
  createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
      const rel=file.slice(root.length+1);
      if(!file.startsWith(root+sep)||rel.split(sep).some(part=>part.startsWith('.'))){res.writeHead(403);res.end();return;}
      if(!(await stat(file)).isFile())throw new Error('not a file');
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
    }catch(e){res.writeHead(404);res.end('Not found');}
  }).listen(port,'0.0.0.0',()=>console.log('Static preview available; Vite package is unavailable.'));
}
