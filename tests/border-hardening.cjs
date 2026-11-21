const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');

// Real exported rules and registered page handlers, not source instrumentation.
// Fixtures below isolate deterministic feedback defects; the unchanged journey
// suite remains the natural, unmodified-stat three-sector completion proof.
const SOURCE=fs.readFileSync(path.join(__dirname,'..','src','border.js'),'utf8');
const KEY='neonBorderTacticsSaveV1';
const IDS=['arcadeGamePages','borderTacticsPage','borderLobby','borderMission','borderResult','borderContractPicker','borderSaveStatus','borderStartBtn','borderContinueBtn','borderGrid','borderTurnLabel','borderSectorTag','borderSectorTitle','borderObjectiveText','borderAlertLabel','borderTargetHint','borderSquadSummary','borderSquadList','borderEnemySummary','borderEnemyList','borderCombatLog','borderCampaignScore','borderAttackBtn','borderWatchBtn','borderBraceBtn','borderShoveBtn','borderAbilityBtn','borderInteractBtn','borderEndTurnBtn','borderNextSectorBtn','borderUpgradeDraft','borderSaveNowBtn','borderAbandonBtn','borderResultTag','borderResultTitle','borderResultText','borderResultStats','borderNewAfterResultBtn'];
function element(){
  const classes=new Set(),listeners=new Map(),attributes=new Map();
  return{dataset:{},hidden:false,disabled:false,textContent:'',innerHTML:'',scrollTop:0,
    classList:{add(x){classes.add(x);},remove(x){classes.delete(x);},contains(x){return classes.has(x);},toggle(x,on){if(on===undefined)on=!classes.has(x);if(on)classes.add(x);else classes.delete(x);return on;}},
    addEventListener(type,fn){listeners.set(type,fn);},querySelectorAll(){return[];},
    setAttribute(key,value){attributes.set(key,String(value));},getAttribute(key){return attributes.get(key)||null;},
    emit(type,event){const fn=listeners.get(type);if(fn)fn(event||{});}};
}
function load(){
  const values=new Map(),elements=new Map(IDS.map(id=>[id,element()]));
  const storage={getItem(key){return values.get(key)||null;},setItem(key,value){values.set(key,String(value));},removeItem(key){values.delete(key);}};
  const document={hidden:false,getElementById(id){return elements.get(id)||null;},addEventListener(){}};
  class FixedDate extends Date{static now(){return Date.UTC(2026,10,21,7);}}
  const math=Object.create(Math);math.random=()=>0.25;
  const window={localStorage:storage,Date:FixedDate,Math:math,JSON,location:{hash:''},confirm(){return true;},addEventListener(){}};
  elements.get('borderTacticsPage').parentElement=elements.get('arcadeGamePages');
  vm.runInNewContext(SOURCE,{window,document,Date:FixedDate,Math:math,JSON,Number,String,Array,Object,Set,Map,console},{filename:'src/border.js',timeout:1000});
  const d=window.NeonBorderTactics.debug;
  function delegated(id,key,value){const selector='[data-'+key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+']';const target={dataset:{[key]:String(value)},closest(query){return query===selector?this:null;}};elements.get(id).emit('click',{target});}
  return{d,window,storage,values,elements,state(){return d.getState();},
    hint(){return elements.get('borderTargetHint').textContent;},
    click(id,force=false){const node=elements.get(id);if(!force)assert.equal(node.disabled,false,id+' unexpectedly disabled');node.emit('click');},
    cell(cell){delegated('borderGrid','borderCell',cell);},target(id){delegated('borderEnemyList','borderTarget',id);},select(id){delegated('borderSquadList','borderUnit',id);},
    open(s){assert.equal(d.isStateValid(s),true,'valid staged fixture');d.setState(s);assert.equal(d.saveCheckpoint(),true);assert.equal(d.continueOperation(),true);}};
}
function arena(d){const s=d.createCampaign('recon');s.map.walls=[];s.map.cover=[];s.units[0].cell=0;s.units[1].cell=6;s.units[2].cell=42;s.enemies=[s.enemies[0]];s.enemies[0].cell=3;return s;}
function plain(value){return JSON.parse(JSON.stringify(value));}
function same(a,b,message){assert.deepEqual(plain(a),plain(b),message);}
function bytes(page){return JSON.stringify([...page.values]);}
function tileClass(page,cell){const match=page.elements.get('borderGrid').innerHTML.match(new RegExp('<button class="([^"]*)"[^>]*data-border-cell="'+cell+'"'));assert.ok(match);return match[1];}
let tests=0,failures=0;
function test(name,fn){tests++;try{fn();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}

test('zero-AP movement explains AP, not an unreachable destination, and is read-only',()=>{
  const p=load(),s=arena(p.d);s.units[0].ap=0;p.open(s);const before=p.state(),saved=bytes(p);
  p.cell(7);same(p.state(),before);assert.equal(bytes(p),saved);assert.match(p.hint(),/行动点不足/);assert.match(p.hint(),/未消耗/);assert.doesNotMatch(p.hint(),/该格不可达/);
});
test('a cooling-down medic is not falsely told that no injured ally exists',()=>{
  const p=load(),s=arena(p.d);s.units[1].hp-=20;s.units[1].cooldown=2;s.selectedId='medic';p.open(s);const before=p.state(),saved=bytes(p);
  p.click('borderAbilityBtn',true);same(p.state(),before);assert.equal(bytes(p),saved);assert.match(p.hint(),/冷却 2/);assert.doesNotMatch(p.hint(),/没有需要治疗/);
});
test('the extraction instruction is visible before anyone reaches the exit',()=>{
  const p=load(),s=p.d.createCampaign('recon');p.d.beginSector(s,3);s.enemies.forEach(e=>e.hp=0);s.map.objectives.forEach(o=>o.secured=true);s.units[0].cell=4;p.open(s);
  assert.equal(p.d.sectorClear(p.state()),false);assert.match(p.hint(),/任意存活干员.*撤离/);
  const preview=p.d.inspectAction(p.state(),'assault','move',3);assert.equal(preview.ok,true);assert.match(preview.summary,/完成撤离/);
  p.cell(3);assert.equal(p.state().status,'complete');assert.equal(p.state().outcome,'clear');
});
test('a staggered enemy immediately loses its obsolete red warning and attack label',()=>{
  const p=load(),s=arena(p.d);s.enemies[0].intent={kind:'shot',targetId:'assault',targetCell:0,cells:[0]};p.open(s);assert.match(tileClass(p,0),/hasIntent/);
  p.target(s.enemies[0].id);p.click('borderAbilityBtn');assert.equal(p.state().enemies[0].staggered,1);
  assert.doesNotMatch(tileClass(p,0),/hasIntent/);assert.match(p.elements.get('borderEnemyList').innerHTML,/暂被打断/);assert.doesNotMatch(p.elements.get('borderEnemyList').innerHTML,/射击预警/);
});
test('selecting the same enemy again cancels the lock without AP or archive writes',()=>{
  const p=load(),s=arena(p.d),far=plain(s.enemies[0]);far.id='far';far.cell=48;s.enemies.push(far);p.open(s);const saved=bytes(p),ap=p.state().units[0].ap;
  p.target('far');assert.equal(p.state().focusEnemy,'far');assert.equal(p.elements.get('borderAbilityBtn').disabled,true);assert.match(p.hint(),/再次点击/);
  p.target('far');assert.equal(p.state().focusEnemy,null);assert.equal(p.state().units[0].ap,ap);assert.equal(bytes(p),saved);assert.equal(p.elements.get('borderAbilityBtn').disabled,false);
  p.cell(3);assert.equal(p.state().focusEnemy,s.enemies[0].id);p.cell(3);assert.equal(p.state().focusEnemy,null);
  const preview=p.d.getActionView(p.state(),'assault').ability;assert.equal(preview.targetId,s.enemies[0].id);p.click('borderAbilityBtn');
  assert.equal(p.state().enemies[0].hp,s.enemies[0].hp-preview.damage);assert.equal(p.state().enemies[1].hp,far.hp);assert.match(p.hint(),/已执行.*震荡弹/);
});
test('all preview entry points are repeatedly read-only, including RNG and storage',()=>{
  const p=load(),s=arena(p.d),before=JSON.stringify(s),saved=bytes(p);assert.equal(typeof p.d.inspectAction,'function');assert.equal(typeof p.d.getActionView,'function');
  for(let repeat=0;repeat<3;repeat++){for(const kind of ['attack','watch','brace','shove','ability','interact'])p.d.inspectAction(s,'assault',kind,s.enemies[0].id);for(let cell=0;cell<49;cell++)p.d.inspectAction(s,'assault','move',cell);p.d.getActionView(s,'assault');}
  assert.equal(JSON.stringify(s),before);assert.equal(bytes(p),saved);
});
test('a deterministic board matrix agrees with real actions without prediction-side mutation',()=>{
  const p=load(),d=p.d;let comparisons=0;
  for(const legacy of [false,true])for(const unitId of ['assault','medic','engineer'])for(const cover of [false,true])for(const ap of [0,1,2])for(const enemyCell of [1,3,5,8,48]){
    const s=arena(d);s.units[0].cell=42;s.units[1].cell=44;s.units[2].cell=46;const actor=s.units.find(u=>u.id===unitId);actor.cell=0;actor.ap=ap;actor.hp-=5;s.enemies[0].cell=enemyCell;s.focusEnemy=s.enemies[0].id;if(cover)s.map.cover=[enemyCell];if(legacy)delete s.ruleset;
    assert.equal(d.isStateValid(s),true);const frozen=JSON.stringify(s);
    for(const kind of ['attack','ability','shove','watch','brace','interact','move']){
      const target=kind==='move'?7:s.focusEnemy,view=d.inspectAction(s,unitId,kind,kind==='ability'?undefined:target),actual=plain(s);
      assert.equal(JSON.stringify(s),frozen,'matrix preview must be pure');const u=actual.units.find(x=>x.id===unitId),enemy=actual.enemies[0];
      const ok=kind==='attack'?d.performAttack(actual,unitId,target,false):kind==='ability'?d.useAbility(actual,unitId):kind==='shove'?d.shove(actual,unitId,target):kind==='watch'?d.setOverwatch(actual,unitId):kind==='brace'?d.brace(actual,unitId):kind==='interact'?d.interactObjective(actual,unitId):d.moveUnit(actual,unitId,target);
      assert.equal(ok,view.ok,kind);if(!ok){assert.equal(JSON.stringify(actual),frozen,kind+' refusal');continue;}
      comparisons++;assert.equal(u.ap,view.apAfter,kind);assert.equal(d.isStateValid(actual),true,kind);
      if(kind==='attack'||kind==='shove'||kind==='ability'&&unitId!=='medic')assert.equal(enemy.hp,view.remainingHp,kind);
      if(kind==='ability'){assert.equal(u.cooldown,view.cooldown);if(unitId==='medic')assert.equal(u.hp,view.remainingHp);}
      if(kind==='move'||kind==='shove')assert.equal(kind==='move'?u.cell:enemy.cell,view.destination);
    }
  }
  assert.equal(comparisons,552);console.log('  action matrix: 180 archive-valid fixtures, 1260 comparisons, '+comparisons+' valid effects');
});
test('weapon and skill previews match the real damage, target, cost and cooldown',()=>{
  const p=load(),d=p.d;
  for(const ability of [false,true]){const s=arena(d),u=s.units[0],e=s.enemies[0];s.map.cover=[3];const view=d.inspectAction(s,u.id,ability?'ability':'attack',e.id),hp=e.hp;assert.equal(view.ok,true);assert.equal(view.damage,ability?10:14);assert.equal(view.remainingHp,hp-view.damage);assert.equal(ability?d.useAbility(s,u.id):d.performAttack(s,u.id,e.id,false),true);assert.equal(e.hp,view.remainingHp);assert.equal(u.ap,view.apAfter);if(ability)assert.equal(u.cooldown,view.cooldown);}
  const s=arena(d);s.units[2].cell=0;s.units[0].cell=42;s.enemies[0].cell=5;
  assert.equal(d.inspectAction(s,'engineer','attack',s.enemies[0].id).ok,false);const skill=d.inspectAction(s,'engineer','ability');assert.equal(skill.ok,true);assert.equal(skill.targetId,s.enemies[0].id);assert.equal(d.useAbility(s,'engineer'),true);assert.equal(s.enemies[0].hp,skill.remainingHp);
});
test('medic preview identifies the exact ratio-selected ally and capped recovery',()=>{
  const p=load(),d=p.d,s=arena(d);s.units[0].cell=5;s.units[0].hp=70;s.units[1].hp=69;s.selectedId='medic';const view=d.getActionView(s,'medic').ability;assert.equal(view.ok,true);assert.equal(view.targetId,'assault');assert.equal(view.healing,6);assert.equal(view.remainingHp,76);assert.match(view.summary,/突击手.*6/);
  assert.equal(d.useAbility(s,'medic'),true);assert.equal(s.units[0].hp,view.remainingHp);assert.equal(s.units[1].hp,69);assert.equal(s.units[1].ap,view.apAfter);
});
test('movement previews use the actual path, mobility limit and objective blockage',()=>{
  const p=load(),d=p.d,s=arena(d);s.enemies[0].cell=34;let view=d.inspectAction(s,'assault','move',4);assert.equal(view.ok,false);assert.match(view.reason,/3 格/);
  s.upgrades.mobility=true;view=d.inspectAction(s,'assault','move',4);same(view.path,[1,2,3,4]);assert.equal(view.ok,true);assert.equal(d.moveUnit(s,'assault',4),true);assert.equal(s.units[0].cell,view.destination);assert.equal(s.units[0].ap,view.apAfter);assert.equal(s.score,0);
  const before=JSON.stringify(s),blocked=d.inspectAction(s,'assault','move',17);assert.equal(blocked.ok,false);assert.match(blocked.reason,/终端/);assert.equal(d.moveUnit(s,'assault',17),false);assert.equal(JSON.stringify(s),before);
});
test('push preview includes blocked impact, boundaries and actual overwatch consequences',()=>{
  const p=load(),d=p.d;
  for(const blocked of ['wall','edge','open','overwatch','lethal-overwatch']){
    const s=arena(d),u=s.units[0],e=s.enemies[0];e.cell=1;
    if(blocked==='wall')s.map.walls=[2];if(blocked==='edge'){u.cell=1;e.cell=0;}
    if(blocked.includes('overwatch')){s.units[2].cell=4;s.units[2].overwatch=true;if(blocked==='lethal-overwatch')e.hp=10;}
    const view=d.inspectAction(s,u.id,'shove',e.id);assert.equal(view.ok,true);assert.equal(view.damage,blocked==='wall'||blocked==='edge'?12:blocked.includes('overwatch')?13:0);
    assert.equal(d.shove(s,u.id,e.id),true);assert.equal(e.hp,view.remainingHp,blocked);assert.equal(e.cell,view.destination,blocked);assert.equal(u.ap,view.apAfter,blocked);assert.equal(e.hp>0?e.staggered:0,view.staggered,blocked);
    if(blocked.includes('overwatch'))assert.equal(s.units[2].overwatch,false);
  }
});
test('push reactions preserve squad order, cover reduction and stop on a lethal shot',()=>{
  const p=load(),d=p.d;
  for(const ambush of [false,true])for(const hp of [10,40]){
    const s=arena(d),e=s.enemies[0];e.cell=1;e.hp=hp;s.units[1].cell=3;s.units[2].cell=4;s.units[1].overwatch=true;s.units[2].overwatch=true;s.map.cover=[2];s.upgrades.ambush=ambush;
    const view=d.inspectAction(s,'assault','shove',e.id);assert.equal(view.ok,true);assert.equal(view.reactions[0].unitId,'medic');assert.equal(view.reactions[0].damage,ambush?15:11);
    assert.equal(view.reactions.length,hp===10?1:2);if(hp===40)assert.equal(view.reactions[1].damage,ambush?12:9);
    assert.equal(d.shove(s,'assault',e.id),true);assert.equal(e.hp,view.remainingHp);assert.equal(s.units[1].overwatch,false);assert.equal(s.units[2].overwatch,hp===10);assert.equal(s.kills,hp===10?1:0);assert.equal(d.isStateValid(s),true);
  }
});
test('posture and objective previews match the actual one-AP effects',()=>{
  const p=load(),d=p.d;
  for(const [kind,action,flag] of [['watch',d.setOverwatch,'overwatch'],['brace',d.brace,'braced']]){const s=arena(d),view=d.inspectAction(s,'assault',kind);assert.equal(view.ok,true);assert.equal(action(s,'assault'),true);assert.equal(s.units[0][flag],true);assert.equal(s.units[0].ap,view.apAfter);const before=JSON.stringify(s);assert.equal(d.inspectAction(s,'assault',kind).ok,false);assert.equal(action(s,'assault'),false);assert.equal(JSON.stringify(s),before);}
  const s=arena(d);s.units[0].cell=16;const view=d.inspectAction(s,'assault','interact');assert.equal(view.ok,true);assert.equal(view.objectiveIndex,0);assert.equal(d.interactObjective(s,'assault'),true);assert.equal(s.map.objectives[view.objectiveIndex].secured,true);assert.equal(s.score,70);assert.equal(s.units[0].ap,view.apAfter);
});
test('every refused real action leaves AP, HP, RNG, score, log and selection unchanged',()=>{
  const p=load(),d=p.d;
  const cases=[
    ['move',s=>s.units[0].ap=0,7,(s,t)=>d.moveUnit(s,'assault',t),/行动点不足/],
    ['move',s=>s.map.walls=[7],7,(s,t)=>d.moveUnit(s,'assault',t),/墙体/],
    ['move',()=>{},6,(s,t)=>d.moveUnit(s,'assault',t),/占据/],
    ['move',()=>{},0,(s,t)=>d.moveUnit(s,'assault',t),/当前位置/],
    ['attack',()=>{},null,(s,t)=>d.performAttack(s,'assault',t,false),/选择/],
    ['attack',s=>s.enemies[0].cell=48,'s1e0',(s,t)=>d.performAttack(s,'assault',t,false),/射程/],
    ['attack',s=>s.map.walls=[1],'s1e0',(s,t)=>d.performAttack(s,'assault',t,false),/墙体遮挡/],
    ['ability',s=>s.units[0].cooldown=2,undefined,s=>d.useAbility(s,'assault'),/冷却 2/],
    ['ability',s=>{s.focusEnemy='missing';},undefined,s=>d.useAbility(s,'assault'),/所选目标/],
    ['ability',s=>{s.focusEnemy='s1e0';s.enemies[0].cell=48;},undefined,s=>d.useAbility(s,'assault'),/技能 4 格射程/],
    ['ability',s=>{s.focusEnemy='s1e0';s.map.walls=[1];},undefined,s=>d.useAbility(s,'assault'),/墙体遮挡/],
    ['ability',s=>s.enemies[0].cell=48,undefined,s=>d.useAbility(s,'assault'),/没有视线畅通/],
    ['shove',()=>{},'s1e0',(s,t)=>d.shove(s,'assault',t),/相邻/],
    ['shove',s=>{s.enemies[0].cell=1;s.enemies[0].kind='boss';},'s1e0',(s,t)=>d.shove(s,'assault',t),/指挥机/],
    ['interact',()=>{},undefined,s=>d.interactObjective(s,'assault'),/未启动终端/],
    ['watch',s=>s.units[0].overwatch=true,undefined,s=>d.setOverwatch(s,'assault'),/已在警戒/],
    ['brace',s=>s.units[0].braced=true,undefined,s=>d.brace(s,'assault'),/已在掩护/],
    ['attack',s=>{s.phase='upgrade';},'s1e0',(s,t)=>d.performAttack(s,'assault',t,false),/整备/],
    ['attack',s=>{s.status='complete';s.phase='result';},'s1e0',(s,t)=>d.performAttack(s,'assault',t,false),/结束/]
  ];
  for(const [kind,setup,target,action,reason] of cases){const s=arena(d);setup(s);const before=JSON.stringify(s),view=d.inspectAction(s,'assault',kind,target);assert.equal(view.ok,false,kind);assert.equal(view.cost,0);assert.match(view.reason,reason);assert.equal(action(s,target),false,kind);assert.equal(JSON.stringify(s),before,kind);}
  const s=arena(d),before=JSON.stringify(s),view=d.inspectAction(s,'medic','ability');assert.equal(view.ok,false);assert.match(view.reason,/没有需要治疗/);assert.equal(d.useAbility(s,'medic'),false);assert.equal(JSON.stringify(s),before);
});
test('unavailable page actions report the same reason without state or archive writes',()=>{
  for(const kind of ['attack','watch','brace','shove','ability','interact']){
    const p=load(),s=arena(p.d);s.focusEnemy=s.enemies[0].id;
    if(kind==='watch')s.units[0].overwatch=true;else if(kind==='brace')s.units[0].braced=true;else if(kind==='ability')s.units[0].cooldown=2;else if(kind==='attack')s.map.walls=[1];
    p.open(s);const before=p.state(),saved=bytes(p),view=p.d.getActionView(before,'assault')[kind];assert.equal(view.ok,false,kind);
    p.click({attack:'borderAttackBtn',watch:'borderWatchBtn',brace:'borderBraceBtn',shove:'borderShoveBtn',ability:'borderAbilityBtn',interact:'borderInteractBtn'}[kind],true);
    assert.equal(p.hint(),view.summary,kind);same(p.state(),before,kind);assert.equal(bytes(p),saved,kind);
  }
});
test('page control availability and accessible descriptions use the exported action view',()=>{
  const p=load(),s=arena(p.d);s.focusEnemy=s.enemies[0].id;s.units[0].cooldown=2;p.open(s);
  const view=p.d.getActionView(p.state(),'assault');
  for(const [kind,id] of Object.entries({attack:'borderAttackBtn',watch:'borderWatchBtn',brace:'borderBraceBtn',shove:'borderShoveBtn',ability:'borderAbilityBtn',interact:'borderInteractBtn'})){
    const node=p.elements.get(id);assert.equal(node.disabled,!view[kind].ok,kind);assert.equal(node.title,view[kind].summary,kind);assert.equal(node.getAttribute('aria-label'),view[kind].summary,kind);
  }
  assert.match(p.hint(),/预计 20 伤害/);assert.match(p.hint(),/消耗 1 AP/);assert.match(p.hint(),/冷却 2/);assert.match(p.elements.get('borderGrid').innerHTML,/移动至.*消耗 1 AP/);
  s.phase='upgrade';s.offers=['fieldkit'];p.open(s);for(const id of ['borderAttackBtn','borderWatchBtn','borderBraceBtn','borderShoveBtn','borderAbilityBtn','borderInteractBtn'])assert.equal(p.elements.get(id).disabled,true,id);assert.match(p.hint(),/选择一项补给/);
});
test('defeating a locked target releases the obsolete lock for the next skill',()=>{
  const p=load(),s=arena(p.d);s.enemies[0].hp=10;const other=plain(s.enemies[0]);other.id='other';other.cell=4;other.hp=40;other.maxHp=40;s.enemies.push(other);p.open(s);p.target(s.enemies[0].id);p.click('borderAttackBtn');
  assert.equal(p.state().focusEnemy,null);const view=p.d.getActionView(p.state(),'assault').ability;assert.equal(view.ok,true);assert.equal(view.targetId,'other');p.click('borderAbilityBtn');assert.equal(p.state().enemies[1].hp,30);
});
test('reselecting a unit then reaffirming a shared target remains an idempotent input sequence',()=>{
  const p=load(),s=arena(p.d);p.open(s);p.target(s.enemies[0].id);p.select('assault');p.target(s.enemies[0].id);
  assert.equal(p.state().focusEnemy,s.enemies[0].id);assert.equal(p.elements.get('borderAttackBtn').disabled,false);p.target(s.enemies[0].id);assert.equal(p.state().focusEnemy,null);
});
test('cancelled restart/abandon is read-only and confirmed restart clears selection and receipt',()=>{
  const p=load();p.d.newOperation('recon');p.cell(21);p.target('s1e2');const before=p.state(),saved=bytes(p);p.window.confirm=()=>false;
  p.click('borderStartBtn');same(p.state(),before);assert.equal(bytes(p),saved);p.click('borderAbandonBtn');same(p.state(),before);assert.equal(bytes(p),saved);
  p.window.confirm=()=>true;p.click('borderStartBtn');const next=p.state();assert.equal(next.ruleset,2);assert.equal(next.focusEnemy,null);same(next.units.map(u=>[u.cell,u.ap]),[[42,2],[44,2],[46,2]]);assert.doesNotMatch(p.hint(),/已执行/);
});
test('legacy in-progress archives keep legacy damage, movement score and hazard rules',()=>{
  const p=load(),d=p.d,s=arena(d);delete s.ruleset;s.units.forEach(u=>{delete u.overwatch;delete u.braced;});s.map.cover=[3];p.open(s);const loaded=p.state();assert.equal(loaded.ruleset,undefined);
  const shot=d.inspectAction(loaded,'assault','attack',loaded.enemies[0].id);assert.equal(shot.damage,20);assert.equal(d.performAttack(loaded,'assault',loaded.enemies[0].id,false),true);assert.equal(loaded.enemies[0].hp,shot.remainingHp);
  const move=d.inspectAction(loaded,'assault','move',7);assert.equal(d.moveUnit(loaded,'assault',7),true);assert.equal(loaded.units[0].ap,move.apAfter);assert.equal(loaded.score,2);d.beginSector(loaded,2);assert.equal(d.reactorHazard(loaded).length,0);assert.equal(loaded.ruleset,undefined);assert.equal(d.isStateValid(loaded),true);
  const modern=arena(d);modern.map.cover=[3];assert.equal(d.inspectAction(modern,'assault','attack',modern.enemies[0].id).damage,14);d.newOperation('recon');assert.equal(p.state().ruleset,2);
});
test('a conflicting archive warning survives a selected-target refresh',()=>{
  const p=load(),s=arena(p.d);s.focusEnemy=s.enemies[0].id;p.open(s);const main=p.storage.getItem(KEY),foreign=JSON.parse(main);foreign.revision++;foreign.state.units[1].ap=1;p.storage.setItem(KEY,JSON.stringify(foreign));
  const state=JSON.stringify(p.state()),saved=bytes(p);p.click('borderAttackBtn');assert.equal(JSON.stringify(p.state()),state);assert.equal(bytes(p),saved);assert.match(p.hint(),/重新载入最新进度/);
  p.window.NeonBorderTactics.refresh();assert.match(p.hint(),/重新载入最新进度/);assert.equal(bytes(p),saved);
});

if(failures){console.error('Border hardening: '+failures+' of '+tests+' cases failed');process.exitCode=1;}
else console.log('Border hardening: '+tests+' cases passed');
