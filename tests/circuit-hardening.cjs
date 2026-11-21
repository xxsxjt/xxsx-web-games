const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const N=1,E=2,S=4,W=8,KEY='xxsxCircuitCampaignV1';
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function test(name,fn){fn();console.log('✓ '+name);}
function loadCampaign(seed={}){
  const values=new Map(Object.entries(seed)),writes=[];let click,html='',details=null;
  const host={get innerHTML(){return html;},set innerHTML(value){html=value;details=/data-circuit-diagnostics/.test(value)?{open:/data-circuit-diagnostics open/.test(value)}:null;},addEventListener(name,fn){click=fn;},querySelector(selector){return selector==='[data-circuit-diagnostics]'?details:{disabled:false,focus(){}};}};
  const window={document:{getElementById(){return host;}},localStorage:{getItem(k){return values.has(k)?values.get(k):null;},setItem(k,v){writes.push(k);values.set(k,v);}}};
  vm.runInNewContext(source('circuit-campaign'),{window});
  return{api:window.NeonCircuitCampaign,values,writes,host,act(dataset){click({target:{closest(){return{dataset};}}});},save(){return JSON.parse(values.get(KEY));}};
}
function loadRandom(){
  const window={};vm.runInNewContext(source('catalog'),{window});vm.runInNewContext(source('core'),{window});vm.runInNewContext(source('blackbox'),{window});return window.NeonBlackbox;
}
function board(size=5){return{size,start:Math.floor(size/2)*size,end:Math.floor(size/2)*size+size-1,startPort:W,endPort:E,cells:Array.from({length:size*size},()=>({mask:0,rotatable:true})),relays:[],hazards:[]};}
function solve(b){b.cells.forEach(c=>{c.mask=c.solutionMask;});return b;}
function reference(b){
  const size=b.size,startPort=b.startPort||W,endPort=b.endPort||E,on=[],openPorts=[];
  if(b.cells[b.start].mask&startPort)on.push(b.start);
  const steps=[[-1,0,N,S],[0,1,E,W],[1,0,S,N],[0,-1,W,E]];
  for(let cursor=0;cursor<on.length;cursor++){
    const index=on[cursor],row=Math.floor(index/size),col=index%size;
    for(const [dy,dx,p,back] of steps){
      if(!(b.cells[index].mask&p))continue;
      const y=row+dy,x=col+dx;
      if(y<0||y>=size||x<0||x>=size){
        if(index!==b.start||p!==startPort)if(index!==b.end||p!==endPort)openPorts.push({index,port:p,next:null,reason:'edge'});
        continue;
      }
      const next=y*size+x,mask=b.cells[next].mask;
      if(!mask)openPorts.push({index,port:p,next,reason:'blank'});
      else if(!(mask&back))openPorts.push({index,port:p,next,reason:'unmatched'});
      else if(!on.includes(next))on.push(next);
    }
  }
  return{powered:on,inputConnected:!!(b.cells[b.start].mask&startPort),outputReached:on.includes(b.end),outputConnected:on.includes(b.end)&&!!(b.cells[b.end].mask&endPort),openPorts};
}
function assertWiring(actual,b){
  const expected=reference(b);
  for(const key of Object.keys(expected))assert.deepEqual(plain(actual[key]),expected[key],key);
}
function forbidSolutions(b){
  for(const c of b.cells)Object.defineProperty(c,'solutionMask',{get(){throw new Error('read hidden solutionMask');}});
  for(const key of ['path','paths','solutionPath','scrambled'])Object.defineProperty(b,key,{get(){throw new Error('read hidden '+key);}});
  return b;
}

test('live frontier distinguishes a one-sided port, a blank and an out-of-board port',()=>{
  const a=loadCampaign().api,b=board();b.cells[10].mask=W|E|N|S;b.cells[11].mask=N|S;
  const d=a.diagnose(b);assertWiring(d,b);
  assert.deepEqual(plain(d.openPorts),[{index:10,port:N,next:5,reason:'blank'},{index:10,port:E,next:11,reason:'unmatched'},{index:10,port:S,next:15,reason:'blank'}]);
  b.start=0;b.cells[0].mask=W|N|E;b.cells[1].mask=N|S;
  assert.deepEqual(plain(a.diagnose(b).openPorts),[{index:0,port:N,next:null,reason:'edge'},{index:0,port:E,next:1,reason:'unmatched'}]);
});
test('row edges never wrap and designated input/output external ports are exempt',()=>{
  const a=loadCampaign().api,b=board();b.start=4;b.end=5;b.cells[4].mask=W|E;b.cells[5].mask=W|E;
  const d=a.diagnose(b);assertWiring(d,b);assert.equal(d.outputConnected,false);
  assert.ok(d.openPorts.some(p=>p.index===4&&p.port===E&&p.reason==='edge'));
  const solved=solve(a.makeBoard(0)),ready=a.diagnose(solved);assert.equal(ready.outputConnected,true);assert.equal(ready.openPorts.length,0);
});
test('an unpowered island contributes no live frontier and a missing input powers nothing',()=>{
  const a=loadCampaign().api,b=board();b.cells[10].mask=W|E;b.cells[1].mask=15;
  assert.deepEqual(plain(a.diagnose(b).openPorts),[{index:10,port:E,next:11,reason:'blank'}]);
  b.cells[10].mask=N|S;const d=a.diagnose(b);assert.equal(d.inputConnected,false);assert.equal(d.powered.length,0);assert.equal(d.openPorts.length,0);
});
test('diagnosis separates output power, mandatory relays and hazardous sinks without redefining success',()=>{
  const a=loadCampaign().api,b=solve(a.makeBoard(3));b.cells[17].mask=a.rotateMask(b.cells[17].mask,1);
  const missing=a.diagnose(b);assert.equal(missing.outputConnected,true);assert.deepEqual(plain(missing.missingRelays),[22]);assert.equal(missing.solved,false);
  const h=solve(a.makeBoard(6));h.cells[12].mask=11;
  const danger=a.diagnose(h);assert.equal(danger.outputConnected,true);assert.deepEqual(plain(danger.danger),[7]);assert.equal(danger.solved,false);
  const extra=solve(a.makeBoard(0));extra.cells[12].mask|=N;
  assert.equal(a.inspect(extra).solved,true);assert.ok(a.diagnose(extra).openPorts.length>0);assert.equal(a.diagnose(extra).solved,true,'unused live stubs are not a new failure rule');
});
test('all eighteen campaign boards match an independent current-port traversal',()=>{
  const a=loadCampaign().api;assert.equal(a.levels.length,18);
  for(let id=0;id<18;id++){
    const b=a.makeBoard(id);
    for(let phase=0;phase<4;phase++){
      assertWiring(a.diagnose(b),b);assert.equal(a.diagnose(b).solved,a.inspect(b).solved);
      b.cells.forEach((c,index)=>{if(c.rotatable)a.turn(b,index,1);});
    }
    solve(b);assert.equal(a.diagnose(b).solved,true,'level '+(id+1));assert.ok(a.validBoard(b));
  }
});
test('both model diagnostics ignore hidden solutions and mutate neither board nor returned aliases',()=>{
  const campaign=loadCampaign().api,random=loadRandom();
  for(const [api,b] of [[campaign,campaign.makeBoard(16)],[random,random.generate(7,'HARDENING-NO-SOLUTION')]]){
    const before=JSON.stringify(b),first=plain(api.diagnose(b));assert.equal(JSON.stringify(b),before);
    const visible=forbidSolutions(plain(b));assert.deepEqual(plain(api.diagnose(visible)),first);
    const report=api.diagnose(b);report.powered.push(999);report.openPorts.push({index:999});
    if(report.missingRelays)report.missingRelays.push(999);if(report.danger)report.danger.push(999);
    assert.equal(JSON.stringify(b),before);assert.deepEqual(plain(api.diagnose(b)),first);
    assert.ok(!Object.keys(first).some(k=>/solution|path|turn|hint|rotation/i.test(k)));
  }
});
test('old random stages retain all four terminal edges, move budgets, hints and legacy port defaults',()=>{
  const a=loadRandom(),sides=new Set();assert.equal(a.diagnose(null),null);
  for(let stage=1;stage<=7;stage++)for(let seed=0;seed<32;seed++){
    const b=a.generate(stage,'CIRCUIT-HARDENING-'+seed),before=JSON.stringify(b);
    sides.add(b.startPort);assertWiring(a.diagnose(b),b);assert.equal(JSON.stringify(b),before);assert.equal(a.isSolved(b),false);
    const clue=a.hint(b),moves=b.movesLeft;assert.ok(clue);assert.ok(a.rotate(b,clue.index));assert.equal(b.movesLeft,moves-1);assert.equal(b.movesUsed,1);
    b.path.forEach(index=>{b.cells[index].mask=b.cells[index].solutionMask;});assert.equal(a.isSolved(b),true);assert.equal(a.diagnose(b).outputConnected,true);assertWiring(a.diagnose(b),b);
  }
  assert.deepEqual([...sides].sort((a,b)=>a-b),[N,E,S,W]);
  const legacy=board();for(let i=10;i<=14;i++)legacy.cells[i].mask=W|E;delete legacy.startPort;delete legacy.endPort;
  assert.equal(a.isSolved(legacy),true);assertWiring(a.diagnose(legacy),legacy);
  legacy.cells[14].mask=W;const reached=a.diagnose(legacy);assert.equal(reached.outputReached,true);assert.equal(reached.outputConnected,false);assert.equal(a.isSolved(legacy),false);
});
test('player-facing diagnosis names current coordinates without a solution hint or save write',()=>{
  const s=loadCampaign({unrelated:'unchanged'});assert.equal(s.writes.length,0);
  assert.match(s.host.innerHTML,/<details class="circuitSave" data-circuit-diagnostics><summary>端口诊断 · 免费只读<\/summary>/);
  assert.match(s.host.innerHTML,/第3行第1列向右与第3行第2列接口不吻合/);
  const diagnosis=s.host.innerHTML.match(/<details[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(diagnosis,/顺时针|逆时针|旋转\d+次|参考线路|推荐|正确方向/);assert.match(diagnosis,/不必全部消除/);
  s.host.querySelector('[data-circuit-diagnostics]').open=true;s.act({circuitAction:'direction'});assert.equal(s.writes.length,0);assert.match(s.host.innerHTML,/data-circuit-diagnostics open/);
  s.act({circuitCell:'11'});const saved=s.save(),bytes=s.values.get(KEY);assert.equal(saved.board.moves,1);assert.equal(saved.board.hints,0);assert.equal(saved.board.history.length,1);
  assert.match(s.host.innerHTML,/data-circuit-diagnostics open/);assert.match(s.host.innerHTML,/第3行第2列向右与第3行第3列接口不吻合/);
  assert.deepEqual(Object.keys(saved).sort(),['board','progress','version']);assert.equal(saved.version,1);assert.equal(saved.progress.length,18);assert.equal(s.values.get('unrelated'),'unchanged');assert.deepEqual(s.writes,[KEY]);
  const resumed=loadCampaign(Object.fromEntries(s.values));assert.equal(resumed.writes.length,0);assert.equal(resumed.values.get(KEY),bytes);assert.match(resumed.host.innerHTML,/端口诊断/);
  const restored=plain(resumed.api.validBoard(saved.board)),persisted=plain(saved.board);delete persisted.hinted;
  assert.deepEqual(restored,persisted,'existing restore intentionally drops the transient hint highlight');
  resumed.act({circuitCell:'12'});resumed.act({circuitCell:'13'});resumed.act({circuitAction:'check'});
  assert.equal(resumed.save().progress[0].stars,3);resumed.act({circuitAction:'next'});assert.equal(resumed.save().board.id,1);
});
test('malformed-save preservation and save-failure warnings are not hidden by diagnostics',()=>{
  const bad='{broken',s=loadCampaign({[KEY]:bad});assert.equal(s.writes.length,0);assert.match(s.host.innerHTML,/旧内容会保留/);assert.match(s.host.innerHTML,/端口诊断/);
  s.act({circuitCell:'11'});assert.equal(s.values.get(KEY+'.rejected'),bad);assert.deepEqual(s.writes,[KEY+'.rejected',KEY]);
  const host={innerHTML:'',addEventListener(n,fn){this.click=fn;},querySelector(){return{disabled:false,focus(){}};}};
  const window={document:{getElementById(){return host;}},localStorage:{getItem(){return null;},setItem(){throw new Error('storage unavailable');}}};
  vm.runInNewContext(source('circuit-campaign'),{window});host.click({target:{closest(){return{dataset:{circuitCell:'11'}};}}});
  assert.match(host.innerHTML,/本次进度未能保存/);assert.match(host.innerHTML,/端口诊断/);
});
console.log('Circuit hardening: 9 groups passed (18 authored levels, 224 random boards; no browser or real storage)');
