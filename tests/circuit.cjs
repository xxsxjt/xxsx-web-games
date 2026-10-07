const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/circuit-campaign.js'),'utf8');
function load(seed){
 const values=new Map(Object.entries(seed||{}));let click;
 const host={innerHTML:'',addEventListener(name,fn){click=fn;},querySelector(){return{disabled:false,focus(){}};}};
 const window={document:{getElementById(){return host;}},localStorage:{getItem(k){return values.get(k)||null;},setItem(k,v){values.set(k,v);}}};
 vm.runInNewContext(source,{window});
 return{api:window.NeonCircuitCampaign,values,host,act(dataset){click({target:{closest(){return{dataset};}}});},save(){return JSON.parse(values.get('xxsxCircuitCampaignV1'));}};
}
function test(name,fn){fn();console.log('✓ '+name);}
function solve(board){board.cells.forEach(c=>c.mask=c.solutionMask);return board;}
test('all eighteen authored networks have a valid solution and increasing rule requirements',()=>{
 const {api:a}=load();assert.equal(a.levels.length,18);
 for(let id=0;id<18;id++){const b=a.makeBoard(id);assert.equal(a.inspect(solve(b)).solved,true,'level '+(id+1));assert.equal(!!a.validBoard(b),true);}
 assert.equal(a.makeBoard(0).relays.length,0);assert.equal(a.makeBoard(4).relays.length,2);assert.equal(a.makeBoard(17).relays.length,4);assert.ok(a.makeBoard(17).hazards.length>=3);
});
test('a lit output cannot bypass mandatory relays or hazardous sinks',()=>{
 const {api:a}=load(),b=solve(a.makeBoard(3));b.cells[17].mask=a.rotateMask(b.cells[17].mask,1);
 assert.equal(a.inspect(b).output,true);assert.equal(a.inspect(b).solved,false);
 const h=solve(a.makeBoard(6));h.cells[12].mask=11;
 assert.equal(a.inspect(h).output,true);assert.equal(a.inspect(h).danger.length,1);assert.equal(a.inspect(h).solved,false);
});
test('undo restores orientation and move count, locks reject moves and hints affect stars',()=>{
 const {api:a}=load(),b=a.makeBoard(0),mask=b.cells[11].mask;
 assert.equal(a.turn(b,10,1),false);assert.equal(a.turn(b,11,1),true);assert.equal(b.moves,1);assert.equal(a.undo(b),true);assert.equal(b.moves,0);assert.equal(b.cells[11].mask,mask);
 assert.ok(a.hint(b));assert.equal(b.hints,1);assert.equal(a.stars(b),2);a.hint(b);assert.equal(a.stars(b),1);
 b.solved=true;assert.equal(a.turn(b,11,1),false);
});
test('only legitimate rotations and consistent undo history are restored',()=>{
 const {api:a}=load(),b=a.makeBoard(0);b.cells[10].mask=15;assert.equal(a.validBoard(b),false);
 const c=a.makeBoard(0);c.history.push({index:11,mask:c.cells[11].mask});assert.equal(a.validBoard(c),false);
 const d=a.makeBoard(0);d.solved=true;assert.equal(a.validBoard(d),false);
 const e=a.makeBoard(0);a.turn(e,11,-1);const restored=a.validBoard(JSON.parse(JSON.stringify(e)));assert.equal(restored.cells[11].mask,e.cells[11].mask);assert.equal(a.undo(restored),true);
});
test('real action flow saves wiring, resumes after reload and unlocks the next level',()=>{
 const first=load();first.act({circuitCell:'11'});const saved=first.save(),second=load(Object.fromEntries(first.values));
 assert.match(second.host.innerHTML,/旋转 <b>1<\/b>/);assert.equal(saved.board.moves,1);
 second.act({circuitCell:'12'});second.act({circuitCell:'13'});second.act({circuitAction:'check'});
 assert.equal(second.save().progress[0].stars,3);assert.match(second.host.innerHTML,/进入下一关/);
 second.act({circuitAction:'next'});assert.equal(second.save().board.id,1);assert.equal(second.save().progress[0].stars,3);
 second.act({circuitLevel:'17'});assert.equal(second.save().board.id,1);
});
test('malformed saved bytes are preserved before replacing the campaign save',()=>{
 const bad='{broken',session=load({xxsxCircuitCampaignV1:bad});assert.match(session.host.innerHTML,/旧内容会保留/);
 assert.equal(session.values.get('xxsxCircuitCampaignV1'),bad);session.act({circuitCell:'11'});
 assert.equal(session.values.get('xxsxCircuitCampaignV1.rejected'),bad);assert.equal(session.save().board.moves,1);
});
console.log('Circuit campaign rules and save tests passed');
