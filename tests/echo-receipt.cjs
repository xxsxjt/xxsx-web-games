const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
function load(){const host={innerHTML:'',getClientRects(){return[{}];},querySelector(){return null;},addEventListener(){}};const window={document:{hidden:false,getElementById(id){return id==='echoDeck'?host:null;},addEventListener(){}},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},requestAnimationFrame(){},addEventListener(){}};for(const file of ['campaign-core','echo-deck'])vm.runInNewContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),{window,console});return window.XXSXEchoDeck;}
const D=load();
function test(name,fn){fn();console.log('✓ '+name);}
function battle(enemies){const s=D.create(319,'resonance');D.battle(s,false);s.enemies=enemies.map((e,id)=>({id,kind:e.kind,hp:e.hp===undefined?32:e.hp,shield:e.shield||0,vulnerable:0}));return s;}

test('real multi-enemy resolution reports per-hit block, actual loss, poison settlement and total delta',()=>{const s=battle([{kind:'shooter'},{kind:'drone'}]);s.hp=60;s.shield=10;s.poison=3;const before=s.hp;assert.equal(D.endTurn(s),true);assert.equal(s.hp,48);assert.match(s.message,/连射机#1 挡护盾4 \/ 生命−0/);assert.match(s.message,/连射机#3 挡护盾2 \/ 生命−2/);assert.match(s.message,/污染探针#1 挡护盾0 \/ 生命−5/);assert.match(s.message,/污染伤害 5 \/ 剩余 4/);assert.match(s.message,/本轮生命 -12/);assert.equal(s.hp-before,-12);assert.equal(D.valid(s),true);});

test('zero-shield fatal hits retain failure reason and report capped actual health loss',()=>{const s=battle([{kind:'shooter'}]);s.hp=5;s.shield=0;assert.equal(D.endTurn(s),true);assert.equal(s.phase,'lost');assert.match(s.message,/实验失败/);assert.match(s.message,/连射机#1 挡护盾0 \/ 生命−4/);assert.match(s.message,/连射机#2 挡护盾0 \/ 生命−1/);assert.doesNotMatch(s.message,/连射机#3/);assert.match(s.message,/本轮生命 -5/);assert.equal(D.valid(s),true);});

test('pollution can be fatal and is reported separately from the attack',()=>{const s=battle([{kind:'drone'}]);s.hp=7;s.poison=3;assert.equal(D.endTurn(s),true);assert.equal(s.phase,'lost');assert.match(s.message,/污染探针#1 挡护盾0 \/ 生命−5/);assert.match(s.message,/污染伤害 2 \/ 剩余 4/);assert.match(s.message,/本轮生命 -7/);assert.equal(D.valid(s),true);});

test('later attacks and enemies not executed after death are absent from the receipt',()=>{const s=battle([{kind:'shooter'},{kind:'drone'}]);s.hp=1;assert.equal(D.endTurn(s),true);assert.equal(s.phase,'lost');assert.match(s.message,/连射机#1 挡护盾0 \/ 生命−1/);assert.doesNotMatch(s.message,/连射机#2|污染探针|污染伤害/);assert.match(s.message,/本轮生命 -1/);assert.equal(D.valid(s),true);});

test('recovery relic healing is included in the actual end-of-round health delta',()=>{const s=battle([{kind:'shooter',hp:5}]);s.hp=50;s.shield=20;s.counter=10;s.relics=['recovery'];assert.equal(D.endTurn(s),true);assert.equal(s.hp,56);assert.match(s.message,/回复 6/);assert.match(s.message,/本轮生命 \+6/);assert.equal(D.valid(s),true);});

test('long legal multi-attacker receipt stays within the existing 500-character message bound',()=>{const s=battle([{kind:'shooter'},{kind:'shooter'},{kind:'shooter'}]);s.hp=100;s.maxHp=100;assert.equal(D.endTurn(s),true);assert.equal((s.message.match(/ 挡护盾/g)||[]).length,9);assert.match(s.message,/本轮生命 -36/);assert.ok(s.message.length<=500);assert.equal(D.valid(s),true);});

test('legacy in-progress state without reserve and with its old message still continues',()=>{const s=D.create(320,'phase');D.battle(s,false);delete s.reserve;s.message='旧版进行中的实验记录。';assert.equal(D.valid(s),true);assert.equal(D.endTurn(s),true);assert.equal(s.turn,2);assert.match(s.message,/本轮生命/);assert.ok(s.message.length<=500);assert.equal(D.valid(s),true);});

console.log('Echo turn receipt checks passed');
