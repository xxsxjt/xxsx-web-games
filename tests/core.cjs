const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const env={window:{}};vm.createContext(env);
for(const file of ['catalog','core','blackbox','arcade'])vm.runInContext(readFileSync(join(__dirname,'../src',file+'.js'),'utf8'),env);
const core=env.window.NeonCore, catalog=env.window.NeonCatalog;
const blackbox=env.window.NeonBlackbox, arcade=env.window.NeonArcade;
const item=(defId,rarity='common',level=1)=>({defId,rarity,level});
const starter=()=>({weapon:item('pulse'),core:item('nano'),utility:item('emp'),engine:item('drift')});
let failed=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
test('build projection never mutates equipped items',()=>{
 const equipped=starter(),saved=JSON.stringify(equipped),next=core.projectEquipment(equipped,item('pulse','epic'));
 assert.equal(JSON.stringify(equipped),saved);assert.equal(next.weapon.level,2);assert.equal(next.weapon.rarity,'epic');
});
test('every equipment preview matches the same production calculation',()=>{
 for(const def of catalog.itemDefs){const e=starter();const preview=core.calculateBuild(core.projectEquipment(e,item(def.id,'rare')));const slot=def.slot;e[slot]=core.mergeItem(e[slot],item(def.id,'rare'))||item(def.id,'rare');assert.equal(JSON.stringify(preview),JSON.stringify(core.calculateBuild(e)));}
});
test('all eight synergies activate only with their required equipment',()=>{
 for(const s of core.synergyDefs){const e={};for(const id of s.needs)e[catalog.itemDefs.find(d=>d.id===id).slot]=item(id);assert.ok(core.calculateBuild(e).traits.synergies.includes(s.name));delete e[catalog.itemDefs.find(d=>d.id===s.needs[0]).slot];assert.ok(!core.calculateBuild(e).traits.synergies.includes(s.name));}
});
for(const fps of [5,10,15,30,60,120])test('fixed simulation consumes 4.5s at '+fps+' FPS',()=>{
 const clock={},seconds=4.5,frames=Math.ceil(seconds*fps);let total=0,maxStep=0;
 for(let i=0;i<frames;i++)core.stepFrame(clock,Math.min(1/fps,seconds-i/fps),()=>true,dt=>{total+=dt;maxStep=Math.max(maxStep,dt);});
 assert.ok(Math.abs(total-seconds)<1e-7);assert.ok(maxStep<=1/60);
});
test('loot interrupt stops substeps and discards accumulated time',()=>{
 const clock={};let count=0,active=true;
 core.stepFrame(clock,.2,()=>active,()=>{count++;active=false;});assert.equal(count,1);assert.equal(clock.accumulator,0);
 active=true;core.stepFrame(clock,1/60,()=>active,()=>count++);assert.equal(count,2);
});
test('huge frame is resource bounded',()=>{let count=0;core.stepFrame({},100,()=>true,()=>count++);assert.equal(count,15);});
test('pointer ownership survives a second finger release',()=>{const p=core.createPointer();assert.ok(p.start(1));assert.equal(p.start(2),false);assert.equal(p.end(2),false);assert.ok(p.owns(1));assert.ok(p.end(1));});
test('dash remembers direction after reaching touch target',()=>{const ship={x:180,y:430,targetX:180,targetY:430,dashX:-40,dashY:0};const p=core.dashDestination(ship,360,540);assert.equal(p.x,75);assert.equal(p.y,430);});
test('dash destination is bounded at all four edges',()=>{for(const [dx,dy] of [[-100,0],[100,0],[0,-100],[0,100]]){const p=core.dashDestination({x:180,y:430,dashX:dx,dashY:dy},360,540);assert.ok(p.x>=28&&p.x<=332&&p.y>=540*.42&&p.y<=494);}});
test('seeded rng and star maps are deterministic',()=>{
 const a=core.generateStarMap('ND-TEST-01','storm'),b=core.generateStarMap('ND-TEST-01','storm'),c=core.generateStarMap('ND-TEST-02','storm');
 assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.equal(a.stages.length,5);assert.equal(a.stages[4].nodes[0].type,'boss');
});
test('blackbox campaign boards are deterministic and stage-distinct',()=>{
 const a=blackbox.generate(2,'ND-BLACKBOX'),b=blackbox.generate(2,'ND-BLACKBOX'),c=blackbox.generate(3,'ND-BLACKBOX');
 assert.deepEqual(a,b);assert.notDeepEqual(a.path,c.path);assert.ok(a.cells.length>=25);assert.ok(!blackbox.isSolved(a));
});
test('blackbox terminals rotate across all four edges and keep valid generated solutions',()=>{
 const sides=new Set();
 for(let seed=0;seed<160;seed++){
  const board=blackbox.generate(5,'ND-PORT-'+seed),port=board.startPort;
  sides.add(port===1?'north':port===2?'east':port===4?'south':'west');
  assert.equal(board.path[0],board.start);assert.equal(board.path.at(-1),board.end);
  for(const index of board.path)board.cells[index].mask=board.cells[index].solutionMask;
  assert.ok(blackbox.isSolved(board),'seed '+seed);assert.ok(blackbox.poweredCells(board).includes(board.end));
 }
 assert.deepEqual([...sides].sort(),['east','north','south','west']);
});
test('blackbox circuit routes solve when each wire is aligned',()=>{
 for(let stage=1;stage<=7;stage++){const board=blackbox.generate(stage,'ND-ROUTE-'+stage);for(const index of board.path)board.cells[index].mask=board.cells[index].solutionMask;assert.ok(blackbox.isSolved(board),'stage '+stage);assert.ok(blackbox.poweredCells(board).includes(board.end));}
});
test('blackbox rotation consumes a move and hints identify an unsolved tile',()=>{
 const board=blackbox.generate(1,'ND-HINT'),before=board.movesLeft,hint=blackbox.hint(board);assert.ok(hint);assert.ok(blackbox.rotate(board,hint.index));assert.equal(board.movesLeft,before-1);assert.equal(board.movesUsed,1);
});
test('blackbox rejects blank tiles and exhausted move budgets',()=>{
 const board=blackbox.generate(4,'ND-LOCK'),blank=board.cells.findIndex(cell=>!cell.rotatable);assert.ok(blank>=0);assert.equal(blackbox.rotate(board,blank),false);board.movesLeft=0;assert.equal(blackbox.rotate(board,board.path[0]),false);
});
test('blackbox seven-stage hint route always fits its move budget',()=>{
 for(let stage=1;stage<=7;stage++){const board=blackbox.generate(stage,'ND-BUDGET-'+stage);let guard=0;while(!blackbox.isSolved(board)&&guard++<100){const hint=blackbox.hint(board);assert.ok(hint);for(let turn=0;turn<hint.turns;turn++)assert.ok(blackbox.rotate(board,hint.index));}assert.ok(blackbox.isSolved(board));assert.ok(board.movesUsed<=board.moveLimit);}
});
test('new blackbox puzzle starts unsolved across multiple run seeds',()=>{
 for(let stage=1;stage<=7;stage++)for(let seed=0;seed<60;seed++)assert.ok(!blackbox.isSolved(blackbox.generate(stage,'ND-START-'+seed)));
});
process.exitCode=failed?1:0;

test('echo runs rotate four rules and produce larger replayable sequences',()=>{const order=arcade.ruleOrder('LAB-SEED'),first=arcade.generateLabRound('LAB-SEED',1,9,order[0]),late=arcade.generateLabRound('LAB-SEED',12,16,order[3]),again=arcade.generateLabRound('LAB-SEED',12,16,order[3]);assert.equal(new Set(order).size,4);assert.equal(first.sequence.length,3);assert.equal(late.slotCount,16);assert.deepEqual(late,again);assert.ok(late.displaySequence.some(cue=>cue.decoy));});
test('salvage contracts generate varied maps with distinct loot and safe beacons',()=>{const a=arcade.generateSalvageMap('SALVAGE-A',3,7,'data'),b=arcade.generateSalvageMap('SALVAGE-B',3,7,'data');assert.notDeepEqual(a.board,b.board);assert.equal(a.board.length,49);assert.equal(a.board.filter(cell=>cell.type==='beacon').length,1);assert.ok(a.board.filter(cell=>cell.type==='data').length>=3);assert.ok(Math.abs(a.start%7-Math.floor(a.start/7)-0)<=6);});
test('draft offers contain no duplicate card in one choice set',()=>{const cards=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];const offer=arcade.offerChoices(cards,'SEED',3,[]);assert.equal(offer.length,3);assert.equal(new Set(offer.map(card=>card.id)).size,3);});
