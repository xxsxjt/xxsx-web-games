const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const sandbox={};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'src/freefield.js'),'utf8'),sandbox);const F=sandbox.NeonFreeField;
const station={x:100,y:100,name:'测试站',charge:2,claimed:false},player={x:100,y:100};
assert.equal(F.beaconStatus(station,{x:185,y:100},[]).id,'out-of-range','exactly 85 units is outside capture range');
assert.equal(F.beaconStatus(station,{x:185.001,y:100},[]).id,'out-of-range','just outside 85 units is outside capture range');
assert.equal(F.beaconStatus(station,{x:184.999,y:100},[{x:225,y:100,dead:false}]).id,'charging','just inside 85 and exactly 125 from an enemy is uncontested');
assert.equal(F.beaconStatus(station,player,[{x:224.999,y:100,dead:false}]).id,'contested','just inside 125 is contested');
assert.equal(F.beaconStatus(station,player,[{x:225.001,y:100,dead:false}]).id,'charging','just outside 125 is uncontested');
assert.equal(F.beaconStatus(station,player,[{x:224.999,y:100,dead:true}]).id,'charging','dead enemies do not contest');
const before=JSON.stringify(station);for(let i=0;i<8;i++)F.beaconStatus(station,player,[{x:120,y:100,dead:false}]);assert.equal(JSON.stringify(station),before,'status derivation must not change charge or claimed');
const field=F.create(),beacon=field.beacons[0],capturer={x:beacon.x,y:beacon.y};
assert.equal(F.beacons(field,capturer,[],5).length,1,'a full charge captures exactly once');assert.equal(F.beacons(field,capturer,[],5).length,0);assert.equal(beacon.claimed,true);

const nodes=new Map(),frames=new Map(),events={},windowEvents={},historyCalls=[],storage=new Map();let frameId=0,seed=8128;const drawCalls=[];
const ctx=new Proxy({}, {get:(o,k)=>{if(k==='calls')return drawCalls;if(!Object.prototype.hasOwnProperty.call(o,k))o[k]=(...args)=>{drawCalls.push({method:String(k),args});if(String(k).indexOf('Gradient')>=0)return{addColorStop(){}};};return o[k];},set:(o,k,v)=>(o[k]=v,true)});
function node(id){if(nodes.has(id))return nodes.get(id);const classes=new Set();const n={style:{setProperty(){}},dataset:{},textContent:'',innerHTML:'',listeners:{},appendChild(){},remove(){},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},classList:{add(...keys){keys.forEach(k=>classes.add(k));},remove(...keys){keys.forEach(k=>classes.delete(k));},contains:k=>classes.has(k),toggle(k,v){if(v===undefined)v=!classes.has(k);v?classes.add(k):classes.delete(k);}},querySelectorAll:()=>[node({}),node({})],getContext:()=>ctx,getBoundingClientRect:()=>({width:360,height:540,left:0,top:0})};nodes.set(id,n);return n;}
const panels=['bridge','armory','routes','codex','archive','guides','workbench','protocols','challenges','signals','salvage','lab','blackbox','dispatch','chronicle'].map(name=>{const n=node('panel-'+name);n.dataset.hubPanel=name;return n;});
const document={hidden:false,getElementById:node,createElement:()=>node({}),querySelectorAll:selector=>selector==='[data-hub-panel]'?panels:[],addEventListener:(name,fn)=>{events[name]=fn;}};
const seededMath=Object.create(Math);seededMath.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const sandboxGame={document,window:{devicePixelRatio:1,location:{hash:''},history:{pushState(){historyCalls.push('push');},replaceState(){historyCalls.push('replace');}},addEventListener:(name,fn)=>{windowEvents[name]=fn;},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){}},navigator:{},localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},Image:class{},performance:{now:()=>0},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),console,Math:seededMath};
vm.createContext(sandboxGame);
for(const file of ['catalog','core','freefield'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),sandboxGame);
for(const file of ['runtime','blackbox','arcade'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),sandboxGame);
const gameSource=fs.readFileSync(path.join(root,'src/game.js'),'utf8').trimEnd(),close='})();';
assert.ok(gameSource.endsWith(close),'game.js must end with the expected IIFE close');
const instrumented=gameSource.slice(0,-close.length)+'globalThis.probe={run:function(code){return eval(code);}};'+close;
vm.runInContext(instrumented,sandboxGame);
const run=code=>sandboxGame.probe.run(code);run('soundOn=false;startGame();ship.crit=0');
run("resetRun();g.field.beacons[0].x=ship.x+85;g.field.beacons[0].y=ship.y;g.field.beacons[1].x=ship.x+20;g.field.beacons[1].y=ship.y;g.field.beacons[2].x=ship.x+30;g.field.beacons[2].y=ship.y;enemies=[{uid:'station-feedback',x:g.field.beacons[2].x+124.999,y:g.field.beacons[2].y,dead:false}];draw();");
function texts(){return drawCalls.filter(call=>call.method==='fillText').map(call=>String(call.args[0]));}
let rendered=texts();
for(const label of ['未进入范围','正在充能','敌人干扰'])assert.ok(rendered.some(text=>text.includes(label)),'world render must show '+label);
for(const label of ['未入范围','充能中','受干扰'])assert.ok(rendered.some(text=>text.includes(label)),'radar render must show '+label);
const gameStationsBefore=run('JSON.stringify(g.field.beacons)');for(let i=0;i<5;i++)run('draw()');assert.equal(run('JSON.stringify(g.field.beacons)'),gameStationsBefore,'repeated world and radar drawing must not change station charge or claim state');
run("g.field.beacons[2].claimed=true;draw();");rendered=texts();assert.ok(rendered.some(text=>text.includes('核心站 · 已占领')));assert.ok(rendered.some(text=>text.includes('3 核心 已占领')));
run('resetRun()');assert.equal(run('g.field.beacons.every(function(b){return !b.claimed&&b.charge===0;})'),true,'a restarted run creates three fresh stations');
console.log('PASS station status thresholds (85/125), read-only derivation, one-time capture, world/radar rendering and reset');
