const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('src/freefield.js','utf8'),sandbox);const F=sandbox.NeonFreeField;
const f=F.create(),p={x:28,y:28};F.camera(f,p,360,540);assert.equal(f.camera.x,0);assert.equal(f.camera.y,0);
F.move(f,p,-1,-1,10,250);assert.equal(p.x,28);assert.equal(p.y,28);
p.x=1600;p.y=1200;F.camera(f,p,360,540);assert.equal(f.camera.x,1420);assert.equal(f.camera.y,930);
for(const a of [.01,.24,.51,.75]){const e=F.spawn(f,p,360,540,()=>a);assert.ok(Math.abs(e.x-p.x)>180||Math.abs(e.y-p.y)>270);}
for(const point of [{x:28,y:28},{x:3172,y:2372}]){const e=F.spawn(f,point,360,540,()=>0);assert.ok(Math.hypot(e.x-point.x,e.y-point.y)>160);}F.camera(f,p,360,540);
const list=[{uid:'a',x:1650,y:1200},{uid:'b',x:2400,y:1200}];assert.equal(F.target(f,p,list,360,540).uid,'a');list[0].dead=true;assert.equal(F.target(f,p,list,360,540),null);
p.dashX=1;p.dashY=0;assert.equal(F.dash(f,p).x,1710);p.x=3190;assert.equal(F.dash(f,p).x,3172);
const b=f.beacons[0];p.x=b.x;p.y=b.y;assert.equal(F.beacons(f,p,[{x:b.x,y:b.y}],6).length,0);assert.equal(F.beacons(f,p,[],5).length,1);assert.equal(F.beacons(f,p,[],5).length,0);
console.log('PASS free field camera, bounds, four-sided spawning, automatic targets, dash and one-time contested capture');
