const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');

// Additional coverage, not a replacement for border.cjs. All gameplay below
// enters through the exported rules or the page's real registered handlers.
// No source rewriting, server, browser, private closure access, or unbounded search.
const SOURCE=fs.readFileSync(path.join(__dirname,'..','src','border.js'),'utf8');
const KEY='neonBorderTacticsSaveV1';
const FIXED_TIME=Date.UTC(2026,10,20,7);
const IDS=['arcadeGamePages','borderTacticsPage','borderLobby','borderMission','borderResult','borderContractPicker','borderSaveStatus','borderStartBtn','borderContinueBtn','borderGrid','borderTurnLabel','borderSectorTag','borderSectorTitle','borderObjectiveText','borderAlertLabel','borderTargetHint','borderSquadSummary','borderSquadList','borderEnemySummary','borderEnemyList','borderCombatLog','borderCampaignScore','borderAttackBtn','borderWatchBtn','borderBraceBtn','borderShoveBtn','borderAbilityBtn','borderInteractBtn','borderEndTurnBtn','borderNextSectorBtn','borderUpgradeDraft','borderSaveNowBtn','borderAbandonBtn','borderResultTag','borderResultTitle','borderResultText','borderResultStats','borderNewAfterResultBtn'];

function makeStorage(){
  const values=new Map();
  let failNextKey=null;
  return{
    values,
    failOnce(key){failNextKey=key;},
    getItem(key){return values.has(key)?values.get(key):null;},
    setItem(key,value){if(key===failNextKey){failNextKey=null;throw new Error('injected single write failure: '+key);}values.set(key,String(value));},
    removeItem(key){values.delete(key);}
  };
}
function element(){
  const classes=new Set(),listeners=new Map();
  return{
    dataset:{},hidden:false,disabled:false,textContent:'',innerHTML:'',scrollTop:0,
    classList:{add(x){classes.add(x);},remove(x){classes.delete(x);},contains(x){return classes.has(x);},toggle(x,force){if(force===undefined)force=!classes.has(x);if(force)classes.add(x);else classes.delete(x);return force;}},
    addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},
    querySelectorAll(){return[];},
    emit(type,event){for(const fn of listeners.get(type)||[])fn(event||{});}
  };
}
function load(storage=makeStorage(),bridge=null){
  const elements=new Map(IDS.map(id=>[id,element()]));
  elements.get('borderTacticsPage').parentElement=elements.get('arcadeGamePages');
  const windowEvents=new Map(),documentEvents=new Map();
  class FixedDate extends Date{static now(){return FIXED_TIME;}}
  const fixedMath=Object.create(Math);fixedMath.random=()=>0.25;
  const document={hidden:false,getElementById(id){return elements.get(id)||null;},addEventListener(type,fn){documentEvents.set(type,fn);}};
  const window={Date:FixedDate,Math:fixedMath,JSON,localStorage:storage,NeonProfileBridge:bridge,location:{hash:''},confirm(){return true;},addEventListener(type,fn){windowEvents.set(type,fn);}};
  vm.runInNewContext(SOURCE,{window,document,Date:FixedDate,Math:fixedMath,JSON,Number,String,Array,Object,Set,Map,console},{filename:'src/border.js',timeout:1000});
  const api=window.NeonBorderTactics;
  function click(id){const node=elements.get(id);assert.ok(node,'missing mock element '+id);assert.equal(node.disabled,false,id+' is disabled');node.emit('click');}
  function delegated(id,key,value){const selector='[data-'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+']';const target={dataset:{[key]:String(value)},closest(query){return query===selector?this:null;}};elements.get(id).emit('click',{target});}
  return{api,d:api.debug,storage,elements,windowEvents,documentEvents,
    state(){return api.debug.getState();},click,
    start(contract='recon'){delegated('borderContractPicker','borderContract',contract);click('borderStartBtn');},
    cell(index){delegated('borderGrid','borderCell',index);},
    select(id){delegated('borderSquadList','borderUnit',id);},
    target(id){delegated('borderEnemyList','borderTarget',id);},
    upgrade(id){delegated('borderUpgradeDraft','borderUpgrade',id);}
  };
}
function same(actual,expected,message){assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)),message);}
function archived(page,label){
  const current=page.state();
  assert.equal(page.d.isStateValid(current),true,label+': current state must remain archive-valid');
  const decoded=page.d.decodeEnvelope(page.storage.getItem(KEY));
  assert.ok(decoded,label+': action must leave a decodable main checkpoint');
  same(decoded.state,current,label+': persisted state must equal the live state');
  return decoded;
}
let failures=0,tests=0;
function test(name,fn){tests++;try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}

test('each selectable contract starts an archive-valid, reloadable operation',()=>{
  const problems=[];
  for(const contract of ['recon','salvage','hunter']){
    const storage=makeStorage(),page=load(storage);page.start(contract);
    const state=page.state(),valid=page.d.isStateValid(state),raw=storage.getItem(KEY);
    if(!valid||!raw){
      const occupied=new Map();
      for(const enemy of state.enemies.filter(e=>e.hp>0)){const prior=occupied.get(enemy.cell);if(prior)problems.push(contract+': '+prior+' and '+enemy.id+' overlap at cell '+enemy.cell);occupied.set(enemy.cell,enemy.id);}
      problems.push(contract+': valid='+valid+', main checkpoint present='+(raw!==null));
      continue;
    }
    archived(page,contract+' start');
    const resumed=load(storage);resumed.click('borderContinueBtn');
    same(resumed.state(),state,contract+' start survives fresh VM load');
  }
  assert.deepEqual(problems,[],problems.join('; '));
});

// This is a natural ruleset-2 recon campaign, not a staged battle fixture.
// The only fixture is the clock/random seed. No stats, positions, AP, objectives,
// enemies, upgrades, or outcome are directly changed. The route is a fixed list;
// the test does not search for a win. Moves are zero-based board-cell indices.
const RECON_ROUTE=[
  ['move','assault',21],['attack','assault','s1e2'],['attack','medic','s1e2'],['move','medic',23],['move','engineer',33],['attack','engineer','s1e1'],['end'],
  ['ability','assault','s1e0'],['attack','assault','s1e0'],['move','medic',2],['attack','medic','s1e0'],['ability','engineer','s1e1'],['attack','engineer','s1e1'],['end'],
  ['move','assault',16],['attack','assault','s1e1'],['move','medic',3],['move','medic',18],['move','engineer',19],['end'],['interact','assault'],['upgrade','ambush'],
  ['move','assault',21],['attack','assault','s2e0'],['move','medic',31],['move','medic',40],['move','engineer',41],['ability','engineer','s2e2'],['end'],
  ['ability','assault','s2e0'],['attack','assault','s2e0'],['attack','medic','s2e2'],['attack','medic','s2e2'],['attack','engineer','s2e2'],['attack','engineer','s2e2'],['end'],
  ['move','assault',0],['move','assault',3],['attack','medic','s2e3'],['attack','medic','s2e3'],['ability','engineer','s2e3'],['attack','engineer','s2e3'],['end'],
  ['move','assault',6],['attack','assault','s2e1'],['move','medic',19],['attack','medic','s2e1'],['attack','engineer','s2e1'],['attack','engineer','s2e1'],['end'],
  ['move','assault',4],['move','assault',17],['interact','medic'],['move','engineer',20],['move','engineer',25],['end'],['interact','assault'],['upgrade','fieldkit'],
  ['move','assault',21],['attack','assault','s3e1'],['move','medic',39],['attack','medic','s3e3'],['attack','engineer','s3e3'],['attack','engineer','s3e3'],['end'],
  ['ability','assault','s3e1'],['attack','assault','s3e1'],['ability','medic'],['move','medic',18],['move','engineer',25],['attack','engineer','s3e3'],['end'],
  ['attack','assault','s3e1'],['move','assault',0],['attack','medic','s3e0'],['attack','medic','s3e0'],['move','engineer',32],['move','engineer',41],['end'],
  ['ability','assault','s3e0'],['attack','assault','s3e0'],['ability','medic'],['attack','medic','s3e0'],['ability','engineer','s3e2'],['attack','engineer','s3e2'],['end'],
  ['attack','assault','s3e0'],['attack','assault','s3e0'],['attack','medic','s3e0'],['attack','medic','s3e0'],['attack','engineer','s3e2'],['attack','engineer','s3e2'],['end'],
  ['ability','assault','s3e0'],['attack','assault','s3e0'],['ability','medic'],['attack','medic','s3e2'],['move','engineer',20],['move','engineer',11],['end'],
  ['move','assault',3],['move','assault',16],['interact','medic'],['move','medic',25],['move','engineer',2],['move','engineer',9],['end'],
  ['interact','assault'],['move','medic',4],['move','medic',3]
];

function applyRouteAction(page,action){
  const [kind,unit,target]=action,before=page.state();
  if(kind==='end'){
    page.click('borderEndTurnBtn');assert.equal(page.state().turn,before.turn+1,'enemy phase must advance the turn');return;
  }
  if(kind==='upgrade'){
    assert.equal(before.phase,'upgrade');assert.ok(before.offers.includes(unit));
    page.upgrade(unit);const after=page.state();
    assert.equal(after.sector,before.sector+1);assert.equal(after.phase,'player');assert.equal(after.turn,1);assert.equal(after.score,before.score+50);
    same(after.units.map(u=>u.hp),before.units.map(u=>unit==='fieldkit'&&u.alive?Math.min(u.maxHp,u.hp+18):u.hp),'transition keeps actual survivor HP and applies only the chosen recovery');
    same(after.units.map(u=>u.cell),[42,44,46]);
    assert.ok(after.units.filter(u=>u.alive).every(u=>u.ap===2&&!u.overwatch&&!u.braced));
    return;
  }
  const actorBefore=before.units.find(u=>u.id===unit);assert.ok(actorBefore.alive&&actorBefore.ap>0);
  page.select(unit);
  if(target!==undefined&&kind!=='move')page.target(target);
  if(kind==='move')page.cell(target);
  else page.click({attack:'borderAttackBtn',ability:'borderAbilityBtn',interact:'borderInteractBtn'}[kind]);
  const after=page.state(),actorAfter=after.units.find(u=>u.id===unit);
  assert.equal(actorAfter.ap,actorBefore.ap-1,action.join(' ')+': exactly one AP');
  if(kind==='move'){assert.equal(actorAfter.cell,target);assert.equal(after.score,before.score,'ruleset 2 movement cannot farm score');}
  if(kind==='attack'||(kind==='ability'&&unit!=='medic'))assert.ok(after.enemies.find(e=>e.id===target).hp<before.enemies.find(e=>e.id===target).hp,action.join(' ')+': selected enemy must take damage');
  if(kind==='ability')assert.ok(actorAfter.cooldown>0,'successful skill enters cooldown');
  if(kind==='ability'&&unit==='medic')assert.ok(after.units.reduce((n,u)=>n+u.hp,0)>before.units.reduce((n,u)=>n+u.hp,0),'medic must heal an actual injury');
  if(kind==='interact'){assert.equal(after.map.objectives.filter(o=>o.secured).length,before.map.objectives.filter(o=>o.secured).length+1);assert.equal(after.score,before.score+70);}
}

test('110 real UI actions naturally clear all three sectors and resume after every action',()=>{
  const storage=makeStorage(),recorded=[],bridge={recordBorderRun(run){recorded.push(JSON.parse(JSON.stringify(run)));return true;}};
  let page=load(storage,bridge);page.start('recon');archived(page,'natural start');
  assert.equal(RECON_ROUTE.length,110,'fixed replay budget');
  let enemyPhases=0,completedSectors=0,sawExtractionGate=false;
  for(let index=0;index<RECON_ROUTE.length;index++){
    const action=RECON_ROUTE[index],before=page.state();
    if(before.sector===3&&before.enemies.every(e=>e.hp===0)&&before.map.objectives.every(o=>o.secured)&&!before.units.some(u=>u.alive&&u.cell===before.map.exit)){
      assert.equal(before.status,'active','terminal capture cannot skip extraction');
      assert.equal(page.d.sectorClear(before),false);sawExtractionGate=true;
    }
    applyRouteAction(page,action);
    if(action[0]==='end')enemyPhases++;
    if(action[0]==='upgrade')completedSectors++;
    const expected=page.state();archived(page,'route action '+(index+1)+' '+action.join(' '));
    if(action[0]==='interact'&&expected.sector<3&&expected.map.objectives.every(o=>o.secured)){
      assert.equal(expected.phase,'upgrade');assert.equal(expected.offers.length,3);
      const copy=page.d.getState();assert.equal(page.d.chooseUpgrade(copy,'not-an-upgrade'),false);same(copy,expected,'unoffered upgrade is a no-op');
    }
    const writesBeforeReload=[...storage.values.entries()];
    page=load(storage,bridge);page.click('borderContinueBtn');
    same(page.state(),expected,'fresh-load replay equality after action '+(index+1));
    same([...storage.values.entries()],writesBeforeReload,'ordinary continue does not rewrite archives');
  }
  const final=page.state();
  assert.equal(completedSectors,2);assert.equal(enemyPhases,15);assert.equal(sawExtractionGate,true);
  same({status:final.status,phase:final.phase,outcome:final.outcome,sector:final.sector,kills:final.kills,score:final.score},{status:'complete',phase:'result',outcome:'clear',sector:3,kills:11,score:940});
  assert.ok(final.units.some(u=>u.alive&&u.cell===final.map.exit));
  same(final.units.map(u=>u.hp),[34,34,68]);same(final.reward,{shards:15,intel:4,modules:2});
  assert.equal(recorded.length,1,'victory reward bridge called once across all 110 reloads');
  same({outcome:recorded[0].outcome,score:recorded[0].score,kills:recorded[0].kills,reward:recorded[0].reward},{outcome:'clear',score:940,kills:11,reward:final.reward});
  assert.equal(page.elements.get('borderMission').classList.contains('hidden'),true);assert.equal(page.elements.get('borderResult').classList.contains('hidden'),false);
  console.log('  natural recon: 110 actions, 15 enemy phases, 110 reloads, no staged gameplay state');
});

test('a natural hunter wipe settles and persists through the actual end-turn handler',()=>{
  const recorded=[],bridge={recordBorderRun(run){recorded.push(JSON.parse(JSON.stringify(run)));return true;}},storage=makeStorage();
  let page=load(storage,bridge);page.start('hunter');
  let turns=0;
  // Deliberately wait in the original deployment; no HP/intent/death fixture.
  for(;turns<12&&page.state().status==='active';turns++){
    page.click('borderEndTurnBtn');const expected=page.state();archived(page,'natural hunter wait '+(turns+1));
    page=load(storage,bridge);page.click('borderContinueBtn');same(page.state(),expected);
  }
  assert.equal(turns,8,'fixed seed wipe must occur within the bounded natural sequence');
  const final=page.state();same({status:final.status,phase:final.phase,outcome:final.outcome,turn:final.turn},{status:'complete',phase:'result',outcome:'lost',turn:9});
  assert.ok(final.units.every(u=>!u.alive&&u.hp===0));same(final.reward,{shards:1,intel:1,modules:0});
  assert.equal(recorded.length,1);assert.equal(recorded[0].outcome,'lost');
  const frozen=JSON.stringify(final);assert.equal(page.d.endTurn(final),false);assert.equal(JSON.stringify(final),frozen,'terminal rule action is a no-op');
});

test('a verified pending checkpoint recovers the latest real action after interrupted main write',()=>{
  const storage=makeStorage(),page=load(storage);page.start();const oldMain=storage.getItem(KEY);
  storage.failOnce(KEY);page.cell(21);const acted=page.state(),pending=storage.getItem(KEY+'.pending');
  assert.equal(acted.units[0].cell,21);assert.equal(storage.getItem(KEY),oldMain,'failure preserves the previous main bytes');
  assert.ok(page.d.decodeEnvelope(pending),'verified pending retains the completed real move');
  assert.equal(page.d.decodeEnvelope(pending).revision,2);
  const resumed=load(storage);resumed.click('borderContinueBtn');same(resumed.state(),acted,'newer pending wins over older valid main');
  assert.equal(storage.getItem(KEY+'.pending'),pending,'loading recovery point itself is read-only');
  resumed.select('medic');resumed.cell(37);const committed=archived(resumed,'first action after pending recovery');
  assert.equal(committed.revision,3);assert.equal(storage.getItem(KEY+'.pending'),null);assert.equal(committed.state.units[0].cell,21);
});

test('a stale loaded page cannot silently overwrite another page’s newer tactical action',()=>{
  const storage=makeStorage(),first=load(storage);first.start();
  const stale=load(storage);stale.click('borderContinueBtn');
  first.cell(21);const latest=storage.getItem(KEY);assert.equal(first.d.decodeEnvelope(latest).revision,2);
  stale.select('medic');stale.cell(37);
  const actual=stale.d.decodeEnvelope(storage.getItem(KEY)),expected=first.d.decodeEnvelope(latest);
  same({revision:actual.revision,cells:actual.state.units.map(u=>u.cell)},{revision:expected.revision,cells:expected.state.units.map(u=>u.cell)},'expected fail-closed stale save; newer assault move to 21 must not be replaced by old assault position 42');
  assert.equal(storage.getItem(KEY)===latest,true,'conflicting writer must leave newer main bytes untouched');
  assert.match(stale.elements.get('borderSaveStatus').textContent,/另一页面已更新行动档案/,'the lobby status must explain that this action was not saved');
  assert.match(stale.elements.get('borderTargetHint').textContent,/重新载入最新进度/,'the active battle must visibly explain how to recover');
  const stalePageState=JSON.stringify(stale.state());stale.cell(35);assert.equal(JSON.stringify(stale.state()),stalePageState,'the stale page must stop accepting more tactical actions until it reloads');
  stale.click('borderAbandonBtn');assert.equal(storage.getItem(KEY),latest,'the stale page must not clear the newer archive');
});

test('a stale page cannot replace a newer pending recovery checkpoint',()=>{
  const storage=makeStorage(),first=load(storage);first.start();const stale=load(storage);stale.click('borderContinueBtn');
  const oldMain=storage.getItem(KEY);
  storage.failOnce(KEY);first.cell(21);const pending=storage.getItem(KEY+'.pending');
  assert.ok(first.d.decodeEnvelope(pending));assert.equal(first.d.decodeEnvelope(pending).revision,2);
  stale.select('medic');stale.cell(37);
  assert.equal(storage.getItem(KEY+'.pending'),pending,'a stale action cannot erase the recoverable newer move');
  assert.equal(storage.getItem(KEY),oldMain,'a stale action cannot rewrite the existing main checkpoint');
  assert.equal(storage.getItem(KEY+'.backup'),oldMain,'a stale action cannot rotate the recovery backup');
  assert.match(stale.elements.get('borderTargetHint').textContent,/重新载入最新进度/);
});

test('a subsequent fresh page can resume and save after another page is rejected',()=>{
  const storage=makeStorage(),first=load(storage);first.start();const stale=load(storage);stale.click('borderContinueBtn');
  first.cell(21);stale.select('medic');stale.cell(37);
  const fresh=load(storage);fresh.click('borderContinueBtn');
  assert.equal(fresh.state().units.find(u=>u.id==='assault').cell,21);
  assert.equal(fresh.state().units.find(u=>u.id==='medic').cell,44);
  fresh.select('medic');fresh.cell(37);const saved=archived(fresh,'fresh page action after conflict');
  assert.equal(saved.revision,3);assert.deepEqual(saved.state.units.map(u=>u.cell),[21,37,46]);
});

if(failures){console.error('Border journey: '+failures+' of '+tests+' cases failed');process.exitCode=1;}
else console.log('Border journey: '+tests+' cases passed');
