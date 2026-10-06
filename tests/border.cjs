const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','src','border.js'),'utf8');

function makeStorage(seed){
  const values=new Map(Object.entries(seed||{}));
  return{
    values,
    getItem(key){return values.has(key)?values.get(key):null;},
    setItem(key,value){values.set(key,String(value));},
    removeItem(key){values.delete(key);}
  };
}
function makeElement(){
  const tokens=new Set();
  return{
    classList:{add(name){tokens.add(name);},remove(name){tokens.delete(name);},contains(name){return tokens.has(name);},toggle(name,force){if(force===undefined)force=!tokens.has(name);if(force)tokens.add(name);else tokens.delete(name);return force;}},
    dataset:{},hidden:false,textContent:'',innerHTML:'',disabled:false,children:[],scrollTop:0,
    addEventListener(){},querySelectorAll(){return[];},appendChild(node){this.children.push(node);},
    setAttribute(){},getAttribute(){return null;}
  };
}
const ids=['arcadeGamePages','borderTacticsPage','borderLobby','borderMission','borderResult','borderContractPicker','borderSaveStatus','borderStartBtn','borderContinueBtn','borderGrid','borderTurnLabel','borderSectorTag','borderSectorTitle','borderObjectiveText','borderAlertLabel','borderTargetHint','borderSquadSummary','borderSquadList','borderEnemySummary','borderEnemyList','borderCombatLog','borderCampaignScore','borderAbilityBtn','borderInteractBtn','borderEndTurnBtn','borderNextSectorBtn','borderUpgradeDraft','borderSaveNowBtn','borderAbandonBtn','borderResultTag','borderResultTitle','borderResultText','borderResultStats','borderNewAfterResultBtn'];
function load(storage,bridge){
  const elements=new Map(ids.map(id=>[id,makeElement()]));
  elements.get('borderTacticsPage').parentElement=elements.get('arcadeGamePages');
  const document={hidden:false,getElementById(id){return elements.get(id)||null;},addEventListener(){}};
  const window={Date,Math,JSON,localStorage:storage,location:{hash:''},confirm(){return true;},addEventListener(){},NeonProfileBridge:bridge||null};
  vm.runInNewContext(source,{window,document,Date,Math,JSON,Number,String,Array,Object,Set,Map,console});
  return{api:window.NeonBorderTactics,elements,window,document};
}
const KEY='neonBorderTacticsSaveV1';

function test(name,fn){try{fn();console.log('✓ '+name);}catch(error){console.error('✗ '+name);throw error;}}

test('every tactical action can be saved and resumed after a fresh page load',()=>{
  const storage=makeStorage(),first=load(storage),d=first.api.debug;
  const state=d.createCampaign('recon');
  assert.equal(d.isStateValid(state),true);
  d.setState(state);assert.equal(d.saveCheckpoint(),true);
  const saved=d.getState();
  assert.equal(d.moveUnit(saved,'assault',35),true);
  d.setState(saved);assert.equal(d.saveCheckpoint(),true);
  const afterReload=load(storage);
  assert.equal(afterReload.api.debug.continueOperation(),true);
  const resumed=afterReload.api.debug.getState();
  assert.equal(resumed.units.find(unit=>unit.id==='assault').cell,35);
  assert.equal(resumed.units.find(unit=>unit.id==='assault').ap,1);
  assert.equal(resumed.status,'active');
});

test('starting and resuming an operation scrolls to the playable board',()=>{
  const storage=makeStorage(),first=load(storage),pages=first.elements.get('arcadeGamePages');
  pages.scrollTop=651;assert.equal(first.api.debug.newOperation('recon'),true);assert.equal(pages.scrollTop,0);
  const resumed=load(storage),resumedPages=resumed.elements.get('arcadeGamePages');resumedPages.scrollTop=651;
  assert.equal(resumed.api.debug.continueOperation(),true);assert.equal(resumedPages.scrollTop,0);
});

test('corrupt main archive recovers the last verified backup without writing over it on load',()=>{
  const storage=makeStorage(),first=load(storage),d=first.api.debug;
  const state=d.createCampaign('recon');d.setState(state);assert.equal(d.saveCheckpoint(),true);
  const next=d.getState();assert.equal(d.moveUnit(next,'assault',35),true);d.setState(next);assert.equal(d.saveCheckpoint(),true);
  const backup=storage.getItem(KEY+'.backup');
  storage.setItem(KEY,'{"schema":1,"revision":99,"state":{}}');
  const afterReload=load(storage);
  assert.match(afterReload.elements.get('borderSaveStatus').textContent,/备用档案/);
  assert.equal(storage.getItem(KEY),'{"schema":1,"revision":99,"state":{}}');
  assert.equal(afterReload.api.debug.continueOperation(),true);
  assert.equal(afterReload.api.debug.getState().units.find(unit=>unit.id==='assault').cell,42);
  assert.equal(storage.getItem(KEY+'.backup'),backup);
});

test('a new archive preserves malformed legacy bytes and the verified recovery copy',()=>{
  const storage=makeStorage(),first=load(storage),d=first.api.debug;
  const state=d.createCampaign('recon');d.setState(state);assert.equal(d.saveCheckpoint(),true);
  const moved=d.getState();assert.equal(d.moveUnit(moved,'assault',35),true);d.setState(moved);assert.equal(d.saveCheckpoint(),true);
  const backup=storage.getItem(KEY+'.backup'),bad='{"state":{}}';storage.setItem(KEY,bad);
  const afterReload=load(storage);assert.equal(afterReload.api.debug.newOperation('hunter'),true);
  assert.equal(storage.getItem(KEY+'.backup'),backup);
  const rejected=JSON.parse(storage.getItem(KEY+'.rejected'));
  assert.equal(rejected.entries[0].raw,bad);
  assert.equal(afterReload.api.debug.decodeEnvelope(storage.getItem(KEY))!==null,true);
});

test('hostile units advance toward reachable attack positions',()=>{
  const d=load(makeStorage()).api.debug,state=d.createCampaign('recon'),raider=state.enemies.find(enemy=>enemy.kind==='raider');
  const before=raider.cell,target=state.units.find(unit=>unit.id===raider.intent.targetId);
  assert.equal(raider.intent.kind,'advance');
  assert.equal(d.endTurn(state),true);
  assert.notEqual(raider.cell,before);
  assert.ok(Math.abs(raider.cell%7-target.cell%7)+Math.abs(Math.floor(raider.cell/7)-Math.floor(target.cell/7))<Math.abs(before%7-target.cell%7)+Math.abs(Math.floor(before/7)-Math.floor(target.cell/7)));
});

test('an objective clear drafts an upgrade and preserves the squad into the next sector',()=>{
  const d=load(makeStorage()).api.debug,state=d.createCampaign('recon');
  state.enemies.forEach(enemy=>{enemy.hp=0;});
  const assault=state.units.find(unit=>unit.id==='assault');assault.cell=16;
  assert.equal(d.interactObjective(state,'assault'),true);
  assert.equal(state.map.objectives[0].secured,true);
  assert.equal(state.phase,'upgrade');
  assert.equal(d.chooseUpgrade(state,state.offers[0]),true);
  assert.equal(state.sector,2);
  assert.equal(state.phase,'player');
  assert.equal(state.units[0].hp,76);
});

test('the final sector requires a surviving operator to reach the extraction tile',()=>{
  const d=load(makeStorage()).api.debug,state=d.createCampaign('recon');
  d.beginSector(state,3);state.enemies.forEach(enemy=>{enemy.hp=0;});state.map.objectives.forEach(objective=>{objective.secured=true;});
  const assault=state.units.find(unit=>unit.id==='assault');assault.cell=4;assault.ap=2;
  assert.equal(d.sectorClear(state),false);
  assert.equal(d.moveUnit(state,'assault',3),true);
  assert.equal(state.status,'settling');
  assert.equal(state.outcome,'clear');
});

test('a settling action settles and rewards exactly once across reloads',()=>{
  const storage=makeStorage();let recorded=0;
  const bridge={recordBorderRun(run){recorded++;assert.equal(run.outcome,'lost');return true;}};
  const first=load(storage,bridge),state=first.api.debug.createCampaign('recon');
  first.api.debug.settle(state,'lost');first.api.debug.setState(state);assert.equal(first.api.debug.saveCheckpoint(),true);
  const restored=load(storage,bridge);assert.equal(restored.api.debug.continueOperation(),true);
  assert.equal(restored.api.debug.getState().status,'complete');assert.equal(recorded,1);
  const again=load(storage,bridge);assert.equal(again.api.debug.continueOperation(),true);
  assert.equal(again.api.debug.getState().status,'complete');assert.equal(recorded,1);
});

console.log('Border Tactics archive and combat tests passed');
