(function(root){
'use strict';

var KEY='neonBorderTacticsSaveV1';
var KEYS={main:KEY,pending:KEY+'.pending',backup:KEY+'.backup',rejected:KEY+'.rejected'};
var SIZE=7,CELLS=SIZE*SIZE;
var CONTRACTS={
  recon:{label:'静默勘察',damage:.78,reward:1,enemies:0,boss:0},
  salvage:{label:'高价值回收',damage:1,reward:1.5,enemies:1,boss:0},
  hunter:{label:'猎杀指挥官',damage:1.08,reward:1.3,enemies:0,boss:1}
};
var UNIT_DEFS={
  assault:{id:'assault',name:'突击手',role:'步枪压制',glyph:'A',range:4,damage:20,ability:'震荡弹',abilityText:'对 4 格内最近敌人造成 10 伤害并打断预警。',color:'#72f4ff'},
  medic:{id:'medic',name:'医护兵',role:'战地急救',glyph:'M',range:3,damage:15,ability:'急救注射',abilityText:'治疗 2 格内生命最低的队友 22 点。',color:'#75ffb2'},
  engineer:{id:'engineer',name:'工程师',role:'脉冲干扰',glyph:'E',range:4,damage:17,ability:'干扰脉冲',abilityText:'打断 5 格内最近敌人的下一次行动。',color:'#c29aff'}
};
var UPGRADE_DEFS={
  fieldkit:{name:'现场医疗包',tag:'RECOVERY',desc:'全队恢复 18 点生命。',apply:function(s){s.units.forEach(function(u){if(u.alive)u.hp=Math.min(u.maxHp,u.hp+18);});}},
  ballistics:{name:'校准弹道',tag:'BALLISTICS',desc:'全队武器伤害永久 +4。',apply:function(s){s.upgrades.damage+=4;}},
  plating:{name:'陶瓷复合装甲',tag:'PLATING',desc:'全队每次受击额外减伤 2 点。',apply:function(s){s.upgrades.armor+=2;}},
  recharge:{name:'冷却回路',tag:'COOLDOWN',desc:'所有战术技能立即就绪，之后冷却缩短 1 回合。',apply:function(s){s.upgrades.cooldown=Math.max(0,s.upgrades.cooldown-1);s.units.forEach(function(u){u.cooldown=0;});}}
};
var state=null,revision=0,selectedId='assault',active=false,contract='recon',recoveryNote='',storageAvailable=true,storageWarningShown=false;
var ids={page:'borderTacticsPage',lobby:'borderLobby',mission:'borderMission',result:'borderResult',contractPicker:'borderContractPicker',saveStatus:'borderSaveStatus',start:'borderStartBtn',continue:'borderContinueBtn',grid:'borderGrid',turn:'borderTurnLabel',sectorTag:'borderSectorTag',sectorTitle:'borderSectorTitle',objectiveText:'borderObjectiveText',alert:'borderAlertLabel',targetHint:'borderTargetHint',squadSummary:'borderSquadSummary',squad:'borderSquadList',enemySummary:'borderEnemySummary',enemy:'borderEnemyList',log:'borderCombatLog',score:'borderCampaignScore',ability:'borderAbilityBtn',interact:'borderInteractBtn',endTurn:'borderEndTurnBtn',next:'borderNextSectorBtn',upgrade:'borderUpgradeDraft',saveNow:'borderSaveNowBtn',abandon:'borderAbandonBtn',resultTag:'borderResultTag',resultTitle:'borderResultTitle',resultText:'borderResultText',resultStats:'borderResultStats',newAfterResult:'borderNewAfterResultBtn'};
function el(id){return document.getElementById(ids[id]||id);}
function html(value){return String(value).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function int(value,min,max){return Number.isInteger(value)&&value>=min&&value<=max;}
function inBounds(index){return int(index,0,CELLS-1);}
function xy(index){return{x:index%SIZE,y:Math.floor(index/SIZE)};}
function indexOf(x,y){return y*SIZE+x;}
function distance(a,b){var p=xy(a),q=xy(b);return Math.abs(p.x-q.x)+Math.abs(p.y-q.y);}
function hashSeed(seed){var h=2166136261;String(seed).split('').forEach(function(c){h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function roll(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function clone(value){return JSON.parse(JSON.stringify(value));}
function aliveUnits(s){return s.units.filter(function(u){return u.alive&&u.hp>0;});}
function livingEnemies(s){return s.enemies.filter(function(e){return e.hp>0;});}
function unitAt(s,cell){return s.units.find(function(u){return u.alive&&u.cell===cell;})||null;}
function enemyAt(s,cell){return s.enemies.find(function(e){return e.hp>0&&e.cell===cell;})||null;}
function wallAt(s,cell){return s.map.walls.indexOf(cell)>=0;}
function blocked(s,cell,movingId){return !inBounds(cell)||wallAt(s,cell)||s.map.objectives.some(function(o){return o.cell===cell;})||s.units.some(function(u){return u.alive&&u.id!==movingId&&u.cell===cell;})||s.enemies.some(function(e){return e.hp>0&&e.cell===cell;});}
function neighbors(cell){var p=xy(cell),out=[];if(p.y>0)out.push(indexOf(p.x,p.y-1));if(p.x<SIZE-1)out.push(indexOf(p.x+1,p.y));if(p.y<SIZE-1)out.push(indexOf(p.x,p.y+1));if(p.x>0)out.push(indexOf(p.x-1,p.y));return out;}
function findPath(s,from,to,movingId,maxDepth){if(!inBounds(to)||blocked(s,to,movingId))return null;var queue=[from],parent=Object.create(null),depth=Object.create(null);parent[from]=-1;depth[from]=0;for(var i=0;i<queue.length;i++){var at=queue[i];if(at===to)break;if(depth[at]>=maxDepth)continue;neighbors(at).forEach(function(next){if(parent[next]!==undefined||blocked(s,next,movingId))return;parent[next]=at;depth[next]=depth[at]+1;queue.push(next);});}if(parent[to]===undefined)return null;var path=[],cursor=to;while(cursor!==from){path.push(cursor);cursor=parent[cursor];}return path.reverse();}
function clearLine(s,from,to){var a=xy(from),b=xy(to),dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y),sx=a.x<b.x?1:-1,sy=a.y<b.y?1:-1,err=dx-dy,x=a.x,y=a.y;while(x!==b.x||y!==b.y){var e2=2*err;if(e2>-dy){err-=dy;x+=sx;}if(e2<dx){err+=dx;y+=sy;}if(x===b.x&&y===b.y)break;if(wallAt(s,indexOf(x,y)))return false;}return true;}
function envelopeValid(raw){return decodeEnvelope(raw);}
function readRaw(key){try{return root.localStorage&&root.localStorage.getItem(key);}catch(e){storageAvailable=false;return null;}}
function readCheckpoint(){
  var candidates=[],invalid=[];
  ['main','pending','backup'].forEach(function(name,rank){var raw=readRaw(KEYS[name]);if(!raw)return;var envelope=envelopeValid(raw);if(envelope)candidates.push({name:name,rank:rank,raw:raw,envelope:envelope});else invalid.push({name:name,raw:raw});});
  candidates.sort(function(a,b){return b.envelope.revision-a.envelope.revision||a.rank-b.rank;});
  var best=candidates[0]||null;
  if(invalid.length&&best)recoveryNote='主档案校验失败，已从有效的'+(best.name==='backup'?'备用档案':'恢复点')+'恢复。';
  else if(invalid.length)recoveryNote='发现无法读取的旧行动档案；原始内容会保留，开始新行动前不会覆盖它。';
  else recoveryNote='';
  return{best:best,invalid:invalid};
}
function preserveInvalid(entries){
  if(!entries||!entries.length)return true;
  try{
    var packed=JSON.stringify({savedAt:Date.now(),entries:entries.map(function(e){return{name:e.name,raw:String(e.raw)};})});
    root.localStorage.setItem(KEYS.rejected,packed);
    return root.localStorage.getItem(KEYS.rejected)===packed;
  }catch(e){storageAvailable=false;return false;}
}
function setSaveStatus(text,kind){var node=el('saveStatus');if(node){node.textContent=text;node.dataset.state=kind||'info';}if(active&&el('targetHint')){el('targetHint').textContent=text;el('targetHint').dataset.state=kind||'info';}}
function loadSavedState(){var found=readCheckpoint();state=found.best?clone(found.best.envelope.state):null;revision=found.best?found.best.envelope.revision:0;return found;}
function saveCheckpoint(){
  if(!state||!isStateValid(state)||state.status==='idle')return false;
  if(!root.localStorage){storageAvailable=false;setSaveStatus('浏览器未开放本地存储；当前行动不能在刷新后续玩。','warn');return false;}
  var next={schema:1,revision:revision+1,savedAt:Date.now(),state:state},payload;
  try{payload=JSON.stringify(next);if(!decodeEnvelope(payload))return false;}catch(e){return false;}
  try{
    root.localStorage.setItem(KEYS.pending,payload);
    if(root.localStorage.getItem(KEYS.pending)!==payload)throw new Error('pending write mismatch');
    var oldMain=root.localStorage.getItem(KEYS.main),oldEnvelope=decodeEnvelope(oldMain);
    if(oldEnvelope){root.localStorage.setItem(KEYS.backup,oldMain);if(root.localStorage.getItem(KEYS.backup)!==oldMain)throw new Error('backup write mismatch');}
    else if(oldMain&&!preserveInvalid([{name:'main',raw:oldMain}]))throw new Error('invalid archive not preserved');
    root.localStorage.setItem(KEYS.main,payload);
    if(root.localStorage.getItem(KEYS.main)!==payload)throw new Error('main write mismatch');
    root.localStorage.removeItem(KEYS.pending);
    revision=next.revision;storageAvailable=true;return true;
  }catch(e){storageAvailable=false;setSaveStatus('存档写入失败；旧档已保留。本次操作仍可继续，但刷新可能无法恢复。','warn');return false;}
}
function clearCheckpoint(){try{Object.keys(KEYS).filter(function(k){return k!=='rejected';}).forEach(function(k){root.localStorage.removeItem(KEYS[k]);});return true;}catch(e){storageAvailable=false;return false;}}
function createCampaign(selectedContract){
  var seed='LS07-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*0xffffff).toString(36),seedValue=hashSeed(seed);
  var s={schema:1,id:'op-'+seedValue.toString(36)+'-'+Date.now().toString(36),seed:seed,rng:seedValue,contract:CONTRACTS[selectedContract]?selectedContract:'recon',status:'active',phase:'player',outcome:null,sector:1,turn:1,score:0,kills:0,alert:0,selectedId:'assault',units:[
    {id:'assault',name:UNIT_DEFS.assault.name,role:UNIT_DEFS.assault.role,cell:42,hp:76,maxHp:76,ap:2,alive:true,cooldown:0},
    {id:'medic',name:UNIT_DEFS.medic.name,role:UNIT_DEFS.medic.role,cell:44,hp:70,maxHp:70,ap:2,alive:true,cooldown:0},
    {id:'engineer',name:UNIT_DEFS.engineer.name,role:UNIT_DEFS.engineer.role,cell:46,hp:68,maxHp:68,ap:2,alive:true,cooldown:0}
  ],enemies:[],map:{size:SIZE,walls:[],cover:[],exit:3,objectives:[]},upgrades:{damage:0,armor:0,cooldown:2},offers:[],log:[],contractReward:CONTRACTS[selectedContract].reward};
  s.selectedId='assault';beginSector(s,1);return s;
}
function baseDamage(s,kind){return Math.max(4,Math.round(({guard:13,raider:17,sentry:19,boss:22})[kind]*CONTRACTS[s.contract].damage));}
function beginSector(s,sector){
  s.sector=sector;s.turn=1;s.alert=0;s.phase='player';s.status='active';s.selectedId=aliveUnits(s)[0]?.id||'assault';
  var deployments=[42,44,46];s.units.forEach(function(u,index){u.cell=deployments[index];if(u.alive)u.ap=2;u.cooldown=Math.max(0,u.cooldown);});
  var walls=[[],[8,10,24,32],[9,11,22,24,30,32],[8,10,24,26,31,33]][sector];
  var cover=[[],[15,19,26,36],[14,20,28,38],[15,19,29,37]][sector];
  var objectives=[[],[{cell:17,name:'航行档案终端',secured:false}],[{cell:16,name:'冷却阀 A',secured:false},{cell:18,name:'冷却阀 B',secured:false}],[{cell:17,name:'核心控制端',secured:false},{cell:23,name:'防火墙继电器',secured:false}]][sector];
  s.map={size:SIZE,walls:walls.slice(),cover:cover.slice(),exit:3,objectives:objectives};
  var defs={
    1:[['guard',1],['sentry',5],['raider',23]],
    2:[['guard',0],['raider',6],['sentry',19],['guard',27]],
    3:[['boss',3],['guard',0],['sentry',6],['raider',25]]
  }[sector].slice();
  if(s.contract==='salvage'&&sector<3)defs.push(['raider',sector===1?5:41]);
  var config={guard:{name:'巡逻兵',glyph:'G',hp:40,range:4},raider:{name:'突击机',glyph:'R',hp:34,range:1},sentry:{name:'火力哨戒',glyph:'S',hp:48,range:5},boss:{name:'站务指挥机',glyph:'B',hp:148,range:5}};
  s.enemies=defs.map(function(pair,n){var kind=pair[0],c=config[kind],health=c.hp+(sector-1)*8+(kind==='boss'&&s.contract==='hunter'?40:0);return{id:'s'+sector+'e'+n,kind:kind,name:c.name,glyph:c.glyph,cell:pair[1],hp:health,maxHp:health,damage:baseDamage(s,kind)+(sector-1)*2,range:c.range,staggered:0,intent:{kind:'none',targetId:null,targetCell:null,cells:[]}};});
  s.offers=[];if(sector>1){var choices=Object.keys(UPGRADE_DEFS).slice();while(choices.length>3){choices.splice(Math.floor(roll(s)*choices.length),1);}s.offers=choices;}
  assignIntents(s);appendLog(s,'第 '+String(sector).padStart(2,'0')+' 舱段：'+(['','外环泊位','冷却反应堆','中央控制室'][sector])+'。先清除敌人，再启动终端。');
}
function closestUnit(s,e){return aliveUnits(s).slice().sort(function(a,b){return distance(a.cell,e.cell)-distance(b.cell,e.cell)||a.id.localeCompare(b.id);})[0]||null;}
function areaCells(center){return[center].concat(neighbors(center));}
function assignIntents(s){
  s.enemies.forEach(function(e){if(e.hp<=0)return;if(e.staggered>0){e.intent={kind:'none',targetId:null,targetCell:null,cells:[]};return;}var target=closestUnit(s,e);if(!target){e.intent={kind:'none',targetId:null,targetCell:null,cells:[]};return;}var d=distance(e.cell,target.cell);
    if(e.kind==='boss'){e.intent={kind:'blast',targetId:target.id,targetCell:target.cell,cells:areaCells(target.cell)};return;}
    if(e.kind==='raider'){e.intent={kind:d<=1?'strike':'advance',targetId:target.id,targetCell:target.cell,cells:d<=1?[target.cell]:[]};return;}
    if(d<=e.range&&clearLine(s,e.cell,target.cell)){e.intent={kind:'shot',targetId:target.id,targetCell:target.cell,cells:[target.cell]};}
    else e.intent={kind:'advance',targetId:target.id,targetCell:target.cell,cells:[]};
  });
}
function appendLog(s,message){s.log.unshift(message);s.log=s.log.slice(0,12);}
function currentUnit(){return state&&state.units.find(function(u){return u.id===state.selectedId&&u.alive;})||null;}
function currentTarget(){return state&&state.enemies.find(function(e){return e.id===state.focusEnemy&&e.hp>0;})||null;}
function spend(u){if(!u||u.ap<1)return false;u.ap--;return true;}
function runDamage(s,u){return UNIT_DEFS[u.id].damage+s.upgrades.damage;}
function targetOptions(s,from,range){return livingEnemies(s).filter(function(e){return distance(e.cell,from)<=range&&clearLine(s,from,e.cell);}).sort(function(a,b){return a.hp-b.hp||distance(a.cell,from)-distance(b.cell,from);});}
function hitEnemy(s,e,amount,label){if(!e||e.hp<=0)return false;e.hp=Math.max(0,e.hp-amount);appendLog(s,label+' 命中 '+e.name+' · '+amount+' 伤害。');if(e.hp<=0){s.kills++;s.score+=30+(e.kind==='boss'?160:0);appendLog(s,e.name+' 已瘫痪。');}return true;}
function performAttack(s,unitId,enemyId,ability){if(!s||s.status!=='active'||s.phase!=='player')return false;var u=s.units.find(function(x){return x.id===unitId&&x.alive;}),e=s.enemies.find(function(x){return x.id===enemyId&&x.hp>0;});if(!u||!e||u.ap<1)return false;var def=UNIT_DEFS[u.id];if(distance(u.cell,e.cell)>def.range||!clearLine(s,u.cell,e.cell)||(ability&&u.cooldown>0))return false;if(!spend(u))return false;var damage=runDamage(s,u);if(ability){u.cooldown=Math.max(1,s.upgrades.cooldown);damage=u.id==='assault'?10+s.upgrades.damage:8+s.upgrades.damage;hitEnemy(s,e,damage,def.ability);if(e.hp>0)e.staggered=1;}else hitEnemy(s,e,damage,def.name);afterAction(s);return true;}
function moveUnit(s,unitId,destination){if(!s||s.status!=='active'||s.phase!=='player')return false;var u=s.units.find(function(x){return x.id===unitId&&x.alive;});if(!u||u.ap<1)return false;var path=findPath(s,u.cell,destination,u.id,3);if(!path||!path.length||path.length>3)return false;if(!spend(u))return false;u.cell=destination;s.score+=2;appendLog(s,u.name+' 移至格位 '+(xy(destination).x+1)+','+(xy(destination).y+1)+'。');afterAction(s);return true;}
function useAbility(s,unitId){if(!s||s.phase!=='player'||s.status!=='active')return false;var u=s.units.find(function(x){return x.id===unitId&&x.alive;});if(!u||u.ap<1||u.cooldown>0)return false;var def=UNIT_DEFS[u.id];
  if(u.id==='medic'){
    var ally=s.units.filter(function(x){return x.alive&&x.hp<x.maxHp&&distance(x.cell,u.cell)<=2;}).sort(function(a,b){return a.hp/a.maxHp-b.hp/b.maxHp;})[0];if(!ally)return false;if(!spend(u))return false;var before=ally.hp;ally.hp=Math.min(ally.maxHp,ally.hp+22);u.cooldown=Math.max(1,s.upgrades.cooldown);appendLog(s,'急救注射：'+ally.name+' 恢复 '+(ally.hp-before)+' 点生命。');
  }else{
    var candidates=targetOptions(s,u.cell,u.id==='assault'?4:5);var target=candidates[0];if(!target)return false;if(!spend(u))return false;u.cooldown=Math.max(1,s.upgrades.cooldown);hitEnemy(s,target,u.id==='assault'?10+s.upgrades.damage:8+s.upgrades.damage,def.ability);if(target.hp>0)target.staggered=1;
  }
  afterAction(s);return true;
}
function interactObjective(s,unitId){if(!s||s.phase!=='player'||s.status!=='active')return false;var u=s.units.find(function(x){return x.id===unitId&&x.alive;});if(!u||u.ap<1)return false;var objective=s.map.objectives.find(function(o){return !o.secured&&distance(o.cell,u.cell)<=1;});if(!objective||!spend(u))return false;objective.secured=true;s.score+=70;appendLog(s,u.name+' 启动 '+objective.name+'。');afterAction(s);return true;}
function allObjectives(s){return s.map.objectives.every(function(o){return o.secured;});}
function sectorClear(s){return livingEnemies(s).length===0&&allObjectives(s)&&(s.sector<3||aliveUnits(s).some(function(u){return u.cell===s.map.exit;}));}
function afterAction(s){if(!aliveUnits(s).length){settle(s,'lost');return;}if(sectorClear(s)){if(s.sector>=3)settle(s,'clear');else{s.phase='upgrade';s.offers=s.offers.length?s.offers:Object.keys(UPGRADE_DEFS).slice(0,3);appendLog(s,'舱段安全。选一项补给整备，然后继续深入。');}}}
function chooseUpgrade(s,id){if(!s||s.phase!=='upgrade'||!UPGRADE_DEFS[id]||s.offers.indexOf(id)<0)return false;UPGRADE_DEFS[id].apply(s);s.score+=50;appendLog(s,'整备完成：'+UPGRADE_DEFS[id].name+'。');beginSector(s,s.sector+1);return true;}
function pathToAdjacent(s,from,targetCell,movingId){var queue=[from],parent=Object.create(null);parent[from]=-1;for(var i=0;i<queue.length;i++){var at=queue[i];if(at!==from&&distance(at,targetCell)===1){var path=[],cursor=at;while(cursor!==from){path.push(cursor);cursor=parent[cursor];}return path.reverse();}neighbors(at).forEach(function(next){if(parent[next]!==undefined||blocked(s,next,movingId))return;parent[next]=at;queue.push(next);});}return null;}
function moveEnemy(s,e,targetCell){var path=pathToAdjacent(s,e.cell,targetCell,e.id);if(path&&path.length)e.cell=path[0];}
function damageUnit(s,u,amount,label){var cover=s.map.cover.indexOf(u.cell)>=0,damage=Math.max(1,Math.round((amount-(s.upgrades.armor||0))*(cover?0.55:1)));u.hp=Math.max(0,u.hp-damage);if(!u.hp)u.alive=false;appendLog(s,label+' 命中 '+u.name+' · '+damage+' 伤害'+(cover?'（掩体减伤）':'')+(u.alive?'。':'；干员倒地。'));}
function resolveEnemyPhase(s){
  s.enemies.slice().forEach(function(e){if(e.hp<=0)return;if(e.staggered>0){e.staggered--;appendLog(s,e.name+' 被打断，失去这次行动。');return;}var intent=e.intent||{kind:'none'};
    if(intent.kind==='shot'){var u=s.units.find(function(x){return x.alive&&x.cell===intent.targetCell;});if(u&&clearLine(s,e.cell,u.cell))damageUnit(s,u,e.damage,e.name);else appendLog(s,e.name+' 的预警射击落空。');}
    else if(intent.kind==='strike'){var v=s.units.find(function(x){return x.alive&&x.cell===intent.targetCell;});if(v&&distance(e.cell,v.cell)<=1)damageUnit(s,v,e.damage,e.name);else appendLog(s,e.name+' 冲击落空。');}
    else if(intent.kind==='blast'){var hit=false;(intent.cells||[]).forEach(function(cell){var v=s.units.find(function(x){return x.alive&&x.cell===cell;});if(v){damageUnit(s,v,e.damage,e.name+' 的扇形爆破');hit=true;}});if(!hit)appendLog(s,'指挥机的爆破区内没有干员。');}
    else if(intent.kind==='advance'){var target=s.units.find(function(x){return x.alive&&x.id===intent.targetId;})||closestUnit(s,e);if(target){moveEnemy(s,e,target.cell);appendLog(s,e.name+' 推进至掩体附近。');}}
  });
  s.alert++;s.turn++;if(!aliveUnits(s).length){settle(s,'lost');return false;}
  s.units.forEach(function(u){if(u.alive){u.ap=2;u.cooldown=Math.max(0,u.cooldown-1);}});
  assignIntents(s);return true;
}
function endTurn(s){if(!s||s.status!=='active'||s.phase!=='player')return false;if(!resolveEnemyPhase(s))return false;appendLog(s,'我方行动开始。红色标记显示敌方下一次攻击预计落点。');return true;}
function settle(s,outcome){if(!s||s.status==='complete'||!['clear','lost'].includes(outcome))return false;s.status='settling';s.phase='settling';s.outcome=outcome;appendLog(s,outcome==='clear'?'核心守卫已清除，档案已回收。':'全队失去行动能力，远征结束。');return true;}
function isStateValid(s){
  if(!s||typeof s!=='object'||s.schema!==1||typeof s.id!=='string'||!s.id||s.id.length>80||typeof s.seed!=='string'||s.seed.length>80||!CONTRACTS[s.contract]||!['assault','medic','engineer'].includes(s.selectedId))return false;
  if(!['active','settling','complete'].includes(s.status)||!['player','upgrade','settling','result'].includes(s.phase)||!int(s.sector,1,3)||!int(s.turn,1,999)||!Number.isFinite(s.score)||s.score<0||!int(s.kills,0,10000)||!int(s.rng,0,4294967295))return false;
  if((s.status==='settling'&&s.phase!=='settling')||(s.status==='complete'&&s.phase!=='result')||(s.status==='active'&&!['player','upgrade'].includes(s.phase)))return false;
  if((s.status==='active'&&s.outcome!==null)||(s.status==='settling'&&!['clear','lost'].includes(s.outcome))||(s.status==='complete'&&!['clear','lost'].includes(s.outcome)))return false;
  if(!s.map||s.map.size!==SIZE||!Array.isArray(s.map.walls)||!Array.isArray(s.map.cover)||!Array.isArray(s.map.objectives)||!inBounds(s.map.exit))return false;
  if(!s.map.walls.every(inBounds)||!s.map.cover.every(inBounds)||s.map.walls.some(function(i){return s.map.cover.indexOf(i)>=0||i===s.map.exit||s.map.objectives.some(function(o){return o.cell===i;});})||new Set(s.map.walls).size!==s.map.walls.length||new Set(s.map.cover).size!==s.map.cover.length)return false;
  if(!Array.isArray(s.units)||s.units.length!==3||!Array.isArray(s.enemies)||s.enemies.length>10)return false;
  if(!s.units.every(function(u){return u&&UNIT_DEFS[u.id]&&u.role===UNIT_DEFS[u.id].role&&u.name===UNIT_DEFS[u.id].name&&inBounds(u.cell)&&Number.isFinite(u.hp)&&Number.isFinite(u.maxHp)&&u.hp>=0&&u.hp<=u.maxHp&&u.maxHp>0&&u.maxHp<=200&&int(u.ap,0,2)&&typeof u.alive==='boolean'&&int(u.cooldown,0,6)&&u.alive===(u.hp>0);}))return false;
  if(new Set(s.units.map(function(u){return u.id;})).size!==3||new Set(s.units.filter(function(u){return u.alive;}).map(function(u){return u.cell;})).size!==s.units.filter(function(u){return u.alive;}).length)return false;
  if(!s.enemies.every(function(e){return e&&typeof e.id==='string'&&e.id.length<=24&&['guard','raider','sentry','boss'].includes(e.kind)&&typeof e.name==='string'&&e.name.length<=40&&typeof e.glyph==='string'&&e.glyph.length<=2&&inBounds(e.cell)&&Number.isFinite(e.hp)&&Number.isFinite(e.maxHp)&&e.hp>=0&&e.hp<=e.maxHp&&e.maxHp>0&&e.maxHp<=400&&Number.isFinite(e.damage)&&e.damage>=0&&e.damage<=100&&int(e.range,1,7)&&int(e.staggered,0,4)&&e.intent&&['shot','strike','advance','blast','none'].includes(e.intent.kind)&&Array.isArray(e.intent.cells)&&e.intent.cells.length<=5&&e.intent.cells.every(inBounds)&&(e.intent.targetCell===null||inBounds(e.intent.targetCell))&&(e.intent.targetId===null||typeof e.intent.targetId==='string');}))return false;
  if(new Set(s.enemies.filter(function(e){return e.hp>0;}).map(function(e){return e.cell;})).size!==s.enemies.filter(function(e){return e.hp>0;}).length)return false;
  var occupied=new Set(s.units.filter(function(u){return u.alive;}).map(function(u){return u.cell;}));
  if(s.units.some(function(u){return u.alive&&(s.map.walls.indexOf(u.cell)>=0||s.map.objectives.some(function(o){return o.cell===u.cell;})||s.enemies.some(function(e){return e.hp>0&&e.cell===u.cell;}));}))return false;
  if(s.enemies.some(function(e){return e.hp>0&&(s.map.walls.indexOf(e.cell)>=0||s.map.objectives.some(function(o){return o.cell===e.cell;})||occupied.has(e.cell));}))return false;
  if(!s.map.objectives.every(function(o){return o&&inBounds(o.cell)&&typeof o.name==='string'&&o.name.length<=40&&typeof o.secured==='boolean'&&s.map.walls.indexOf(o.cell)<0&&o.cell!==s.map.exit;}))return false;
  if(new Set(s.map.objectives.map(function(o){return o.cell;})).size!==s.map.objectives.length||s.map.objectives.length>3)return false;
  if(!s.upgrades||!Number.isFinite(s.upgrades.damage)||s.upgrades.damage<0||s.upgrades.damage>100||!Number.isFinite(s.upgrades.armor)||s.upgrades.armor<0||s.upgrades.armor>100||!Number.isFinite(s.upgrades.cooldown)||s.upgrades.cooldown<0||s.upgrades.cooldown>6||!Array.isArray(s.log)||s.log.length>16||!s.log.every(function(line){return typeof line==='string'&&line.length<=200;}))return false;
  if(!Array.isArray(s.offers)||s.offers.length>3||!s.offers.every(function(id){return !!UPGRADE_DEFS[id];}))return false;
  if(s.status==='complete'&&(!['clear','lost'].includes(s.outcome)||!s.reward||!['shards','intel','modules'].every(function(k){return int(s.reward[k],0,100000); })))return false;
  return true;
}
function decodeEnvelope(raw){if(typeof raw!=='string'||!raw)return null;try{var parsed=JSON.parse(raw);if(!parsed||parsed.schema!==1||!int(parsed.revision,1,100000000)||!Number.isFinite(parsed.savedAt)||!isStateValid(parsed.state))return null;return parsed;}catch(e){return null;}}
function markStorageWarning(){if(!storageWarningShown&&!storageAvailable){storageWarningShown=true;setSaveStatus('本地存储不可用；行动仍可玩，但刷新后无法续玩。','warn');}}
function persist(){var saved=saveCheckpoint();markStorageWarning();return saved;}
function selectContract(id){if(CONTRACTS[id])contract=id;renderContractPicker();}
function renderContractPicker(){var host=el('contractPicker');if(!host)return;host.querySelectorAll('[data-border-contract]').forEach(function(btn){btn.classList.toggle('active',btn.dataset.borderContract===contract);});}
function loadIntoPage(){active=true;el('lobby').classList.add('hidden');el('result').classList.toggle('hidden',!(state&&state.status==='complete'));el('mission').classList.toggle('hidden',!state||state.status==='complete');if(state&&state.status==='settling')settleLoaded();render();var page=el('page'),container=page&&page.parentElement;if(container){var resetScroll=function(){container.scrollTop=0;};resetScroll();if(typeof root.requestAnimationFrame==='function')root.requestAnimationFrame(resetScroll);if(typeof root.setTimeout==='function')root.setTimeout(resetScroll,50);}}
function refreshLobby(){var found=loadSavedState(),button=el('continue'),status=el('saveStatus');active=false;
  el('lobby').classList.remove('hidden');el('mission').classList.add('hidden');el('result').classList.add('hidden');
  if(found.best&&state){button.hidden=false;button.textContent=state.status==='complete'?'查看上次结算':'继续行动 · 第 '+state.sector+' 舱段 / 第 '+state.turn+' 回合';setSaveStatus(recoveryNote||'行动档案已校验；每个战术动作都会自动保存。','ok');}
  else{button.hidden=true;setSaveStatus(recoveryNote||'本地没有进行中的行动；开始后会自动保存到当前浏览器。',found.invalid.length?'warn':'info');}
  renderContractPicker();
}
function enter(){if(state&&active)persist();refreshLobby();}
function leave(){if(state&&state.status==='active')persist();active=false;}
function newOperation(force){var found=readCheckpoint();if(found.best&&found.best.envelope.state.status==='active'&&!force){if(!root.confirm('当前有未完成行动。开始新行动会保留一个恢复副本并结束这次行动，继续吗？'))return false;}
  if(found.invalid.length&&!preserveInvalid(found.invalid)){setSaveStatus('无法安全保留损坏档案，因此没有开始新行动。','warn');return false;}
  state=createCampaign(contract);selectedId=state.selectedId;revision=Math.max(revision,found.best?found.best.envelope.revision:0);persist();loadIntoPage();return true;
}
function continueOperation(){var found=readCheckpoint();if(!found.best){refreshLobby();return false;}state=clone(found.best.envelope.state);revision=found.best.envelope.revision;selectedId=state.selectedId||'assault';if(state.status==='settling')settleLoaded();loadIntoPage();return true;}
function settleLoaded(){if(!state||state.status!=='settling')return;var outcome=state.outcome||'lost',reward=computeReward(state,outcome),bridge=root.NeonProfileBridge;if(bridge&&typeof bridge.recordBorderRun==='function')bridge.recordBorderRun({id:state.id,outcome:outcome,score:state.score,kills:state.kills,sector:state.sector,turns:state.turn,seed:state.seed,contract:CONTRACTS[state.contract].label,reward:reward});state.status='complete';state.phase='result';state.reward=reward;persist();}
function computeReward(s,outcome){var factor=CONTRACTS[s.contract].reward;return{shards:Math.max(1,Math.round((outcome==='clear'?8+Math.floor(s.score/120):Math.floor(s.score/180)+1)*factor)),intel:outcome==='clear'?4:1,modules:outcome==='clear'?2:0};}
function finishWithResult(outcome){if(!state||state.status==='complete')return;settle(state,outcome);persist();settleLoaded();render();}
function showLobby(){leave();root.location.hash='';}
function discardRun(){if(!root.confirm('这会清除本次进行中的行动档案。确定放弃吗？'))return false;clearCheckpoint();state=null;revision=0;recoveryNote='';refreshLobby();setSaveStatus('行动已放弃；可随时开始新的行动。','info');return true;}
function selectedUnit(){return state&&state.units.find(function(u){return u.id===selectedId&&u.alive;})||null;}
function selectUnit(id){if(!state||state.phase!=='player')return;var u=state.units.find(function(x){return x.id===id&&x.alive;});if(!u)return;selectedId=id;state.selectedId=id;render();}
function onCell(cell){if(!state||state.status!=='active'||state.phase!=='player')return;var own=unitAt(state,cell);if(own){selectUnit(own.id);return;}var enemy=enemyAt(state,cell),u=selectedUnit();if(!u)return;
  if(enemy){var ok=performAttack(state,u.id,enemy.id,false);if(!ok){setSaveStatus('目标超出射程或被墙体遮挡。','warn');return;}persist();render();return;}
  var path=findPath(state,u.cell,cell,u.id,3);if(path&&path.length){if(moveUnit(state,u.id,cell)){persist();render();return;}}
  setSaveStatus('该格不可达；每次移动最多穿过 3 格，并消耗 1 点行动。','warn');
}
function adjacentObjective(){var u=selectedUnit();if(!u||!state)return null;return state.map.objectives.find(function(o){return !o.secured&&distance(o.cell,u.cell)<=1;})||null;}
function useSelectedAbility(){var u=selectedUnit();if(!u||!useAbility(state,u.id)){setSaveStatus(u&&u.id==='medic'?'附近没有需要治疗的队员。':'没有可干扰的敌人，或技能仍在冷却。','warn');return;}persist();render();}
function interact(){var u=selectedUnit();if(!u||!interactObjective(state,u.id)){setSaveStatus('选一名干员靠近未启动终端后再互动。','warn');return;}persist();render();}
function endPlayerTurn(){if(!state||!endTurn(state)){render();return;}persist();render();}
function pickUpgrade(id){if(!chooseUpgrade(state,id))return;persist();render();}
function renderBoard(){var host=el('grid');if(!host||!state)return;var rows='';for(var cell=0;cell<CELLS;cell++){
    var own=unitAt(state,cell),enemy=enemyAt(state,cell),objective=state.map.objectives.find(function(o){return o.cell===cell;}),wall=wallAt(state,cell),cover=state.map.cover.indexOf(cell)>=0,exit=state.map.exit===cell;
    var selected=own&&own.id===selectedId,unit=selectedUnit(),reachable=!!(unit&&state.phase==='player'&&unit.ap>0&&cell!==unit.cell&&!own&&!enemy&&!wall&&findPath(state,unit.cell,cell,unit.id,3));
    var danger=state.enemies.some(function(e){return e.hp>0&&e.intent&&e.intent.cells&&e.intent.cells.indexOf(cell)>=0;});
    var classes=['borderTile'];if(wall)classes.push('isWall');if(cover)classes.push('isCover');if(objective)classes.push(objective.secured?'isSecured':'isObjective');if(exit)classes.push('isExit');if(selected)classes.push('isSelected');if(reachable)classes.push('isReachable');if(danger)classes.push('hasIntent');if(own)classes.push('hasUnit');if(enemy)classes.push('hasEnemy');
    var label=wall?'墙体':cover?'掩体':'通道';if(objective)label=objective.name+(objective.secured?' 已启动':' 未启动');if(exit)label='撤离标记';if(own)label=own.name+' · HP '+own.hp+'/'+own.maxHp+' · AP '+own.ap;if(enemy)label=enemy.name+' · HP '+enemy.hp+'/'+enemy.maxHp+(enemy.intent.kind!=='none'?' · '+intentLabel(enemy.intent.kind):'');
    var token=wall?'▰':own?'<span class="borderUnitGlyph" style="--unit-color:'+UNIT_DEFS[own.id].color+'">'+UNIT_DEFS[own.id].glyph+'</span>':enemy?'<span class="borderEnemyGlyph">'+enemy.glyph+'</span>':objective?(objective.secured?'✓':'⌖'):exit?'⇧':cover?'▧':'';
    if(own)token+='<small>'+own.ap+' AP</small>';if(enemy)token+='<small class="borderHp">'+Math.ceil(enemy.hp)+'</small>';if(danger&&!enemy&&!own)token+='<span class="borderIntentGlyph">!</span>';
    rows+='<button class="'+classes.join(' ')+'" type="button" role="gridcell" data-border-cell="'+cell+'" aria-label="'+html(label)+'" '+(wall?'disabled':'')+'><span class="borderTileToken">'+token+'</span></button>';
  }host.innerHTML=rows;
}
function intentLabel(kind){return({shot:'射击预警',strike:'近战预警',advance:'推进',blast:'范围爆破',none:'被打断'})[kind]||'待机';}
function renderSquad(){var host=el('squad');if(!host||!state)return;var living=aliveUnits(state);el('squadSummary').textContent=living.length+' / 3';host.innerHTML=state.units.map(function(u){var def=UNIT_DEFS[u.id],pct=Math.max(0,Math.min(100,Math.round(u.hp/u.maxHp*100)));return'<button class="borderSquadUnit '+(u.id===selectedId?'active':'')+(u.alive?'':' down')+'" type="button" data-border-unit="'+u.id+'" '+(!u.alive||state.phase!=='player'?'disabled':'')+'><span class="borderSquadGlyph" style="--unit-color:'+def.color+'">'+def.glyph+'</span><span class="borderSquadCopy"><b>'+html(def.name)+'</b><small>'+html(def.role)+' · AP '+u.ap+'/2 · '+(u.cooldown?'技能冷却 '+u.cooldown:'技能就绪')+'</small><i><em style="width:'+pct+'%"></em></i></span><strong>'+Math.max(0,u.hp)+'</strong></button>';}).join('');}
function renderEnemies(){var host=el('enemy');if(!host||!state)return;var enemies=livingEnemies(state);el('enemySummary').textContent=String(enemies.length);host.innerHTML=enemies.length?enemies.map(function(e){var pct=Math.max(0,Math.min(100,Math.round(e.hp/e.maxHp*100))),warning=e.intent.kind==='none'?'暂被打断':intentLabel(e.intent.kind);return'<article class="borderEnemyCard"><span class="borderEnemyGlyphCard">'+html(e.glyph)+'</span><div><b>'+html(e.name)+'</b><small>'+warning+(e.intent.kind==='advance'?' · 向小队推进':' · 预计落点已标红')+'</small><i><em style="width:'+pct+'%"></em></i></div><strong>'+Math.ceil(e.hp)+'</strong></article>';}).join(''):'<div class="borderNoEnemy">当前舱段敌人已清除；检查终端并确认目标。</div>';}
function renderLog(){var host=el('log');if(!host||!state)return;host.innerHTML=state.log.map(function(line){return'<p>'+html(line)+'</p>';}).join('');}
function renderUpgrades(){var host=el('upgrade');if(!host||!state)return;var show=state.phase==='upgrade';host.classList.toggle('hidden',!show);if(!show)return;host.innerHTML='<div class="borderDraftHead"><span class="kicker">SECTOR CLEAR / FIELD REQUISITION</span><b>选择一项整备</b></div><div class="borderDraftCards">'+state.offers.map(function(id){var d=UPGRADE_DEFS[id];return'<button class="borderUpgradeCard" type="button" data-border-upgrade="'+id+'"><small>'+d.tag+'</small><b>'+d.name+'</b><span>'+d.desc+'</span></button>';}).join('')+'</div>';}
function renderResult(){if(!state)return;var clear=state.outcome==='clear',reward=state.reward||computeReward(state,state.outcome||'lost');el('resultTag').textContent=clear?'OPERATION COMPLETE':'OPERATION ABORTED';el('resultTitle').textContent=clear?'航行档案已回收':'小队未能完成撤离';el('resultText').textContent=clear?'失落站的坐标已上传到新伊甸。整备下一次行动，继续清查边境航线。':'小队数据已写入作战日志。重组队伍后可以重新尝试。';el('resultStats').innerHTML='<div><b>'+state.score+'</b><span>行动评分</span></div><div><b>'+state.kills+'</b><span>瘫痪敌机</span></div><div><b>'+state.sector+'/3</b><span>抵达舱段</span></div><div><b>'+reward.shards+'</b><span>星尘奖励</span></div><div><b>'+reward.intel+'</b><span>舰站情报</span></div><div><b>'+reward.modules+'</b><span>舰站模块</span></div>';}
function render(){if(!state||!active)return;if(state.status==='settling')settleLoaded();var complete=state.status==='complete';el('lobby').classList.add('hidden');el('mission').classList.toggle('hidden',complete);el('result').classList.toggle('hidden',!complete);if(complete){renderResult();return;}
  var labels=['','外环泊位','冷却反应堆','中央控制室'];el('sectorTag').textContent='SECTOR '+String(state.sector).padStart(2,'0')+' / '+['','DOCK','REACTOR','CORE'][state.sector];el('sectorTitle').textContent=labels[state.sector];el('objectiveText').textContent='终端 '+state.map.objectives.filter(function(o){return o.secured;}).length+'/'+state.map.objectives.length+' · 敌人 '+livingEnemies(state).length+' · '+(state.sector===3?'全部清除后移至撤离格 ⇧':'清空并启动全部终端后选择补给');el('turn').textContent='我方行动 · 第 '+state.turn+' 回合';el('alert').textContent='警戒 '+state.alert;el('score').textContent=String(state.score);
  renderBoard();renderSquad();renderEnemies();renderLog();renderUpgrades();
  var unit=selectedUnit(),ability=el('ability'),objective=adjacentObjective(),allOut=sectorClear(state);ability.disabled=!unit||unit.ap<1||unit.cooldown>0||(unit.id==='medic'&&!state.units.some(function(u){return u.alive&&u.hp<u.maxHp&&distance(u.cell,unit.cell)<=2;}))||(unit.id!=='medic'&&!targetOptions(state,unit.cell,unit.id==='assault'?4:5).length);ability.textContent=unit?UNIT_DEFS[unit.id].ability+' · '+(unit.cooldown?'冷却 '+unit.cooldown:'消耗 1 AP'):'战术技能';
  el('interact').disabled=!unit||!objective||unit.ap<1;el('interact').textContent=objective?'启动 '+objective.name+' · 消耗 1 AP':'靠近终端后启动 · 消耗 1 AP';el('endTurn').disabled=state.phase!=='player'||state.status!=='active';el('next').classList.add('hidden');
  if(state.phase==='upgrade')el('targetHint').textContent='本段目标已完成。选择一项补给，下一段会保留队伍生命和强化。';else if(allOut&&state.sector===3)el('targetHint').textContent=aliveUnits(state).some(function(u){return u.cell===state.map.exit;})?'全队已到达撤离点，档案正在回收。':'敌人与终端均已处理。把任意存活干员移动到 ⇧ 撤离标记完成行动。';else if(allOut)el('targetHint').textContent='本段目标已完成。选择一项补给，下一段会保留队伍生命和强化。';else if(!unit)el('targetHint').textContent='没有可行动干员。';else el('targetHint').textContent=unit.name+' · '+unit.ap+' 点行动 · 蓝色格可移动，点敌人射击，红格是敌方预警落点。';
}
function refreshVisibleState(){if(active&&state){if(state.status==='settling')settleLoaded();render();}else if(!active)refreshLobby();}
function bind(){
  var grid=el('grid');if(grid)grid.addEventListener('click',function(e){var button=e.target&&e.target.closest?e.target.closest('[data-border-cell]'):null;if(button)onCell(Number(button.dataset.borderCell));});
  var roster=el('squad');if(roster)roster.addEventListener('click',function(e){var button=e.target&&e.target.closest?e.target.closest('[data-border-unit]'):null;if(button)selectUnit(button.dataset.borderUnit);});
  var contracts=el('contractPicker');if(contracts)contracts.addEventListener('click',function(e){var button=e.target&&e.target.closest?e.target.closest('[data-border-contract]'):null;if(button)selectContract(button.dataset.borderContract);});
  var upgrades=el('upgrade');if(upgrades)upgrades.addEventListener('click',function(e){var button=e.target&&e.target.closest?e.target.closest('[data-border-upgrade]'):null;if(button)pickUpgrade(button.dataset.borderUpgrade);});
  el('start').addEventListener('click',function(){newOperation(false);});el('continue').addEventListener('click',continueOperation);el('ability').addEventListener('click',useSelectedAbility);el('interact').addEventListener('click',interact);el('endTurn').addEventListener('click',endPlayerTurn);el('saveNow').addEventListener('click',function(){persist();showLobby();});el('abandon').addEventListener('click',discardRun);el('newAfterResult').addEventListener('click',function(){if(state&&state.status==='complete')newOperation(true);});
  root.addEventListener('pagehide',function(){if(state&&state.status==='active')persist();});root.addEventListener('pageshow',refreshVisibleState);document.addEventListener('visibilitychange',function(){if(document.hidden&&state&&state.status==='active')persist();else if(!document.hidden)refreshVisibleState();});
  refreshLobby();
}
root.NeonBorderTactics={enter:enter,leave:leave,refresh:refreshVisibleState,debug:{createCampaign:createCampaign,beginSector:beginSector,sectorClear:sectorClear,isStateValid:isStateValid,decodeEnvelope:decodeEnvelope,moveUnit:moveUnit,performAttack:performAttack,useAbility:useAbility,interactObjective:interactObjective,endTurn:endTurn,chooseUpgrade:chooseUpgrade,settle:settle,readCheckpoint:readCheckpoint,getState:function(){return state?clone(state):null;},setState:function(s){state=clone(s);},newOperation:function(contractId){contract=contractId||'recon';return newOperation(true);},continueOperation:continueOperation,saveCheckpoint:saveCheckpoint,loadSavedState:loadSavedState,clearCheckpoint:clearCheckpoint}};
bind();
})(window);
