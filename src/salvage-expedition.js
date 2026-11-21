/* Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4. */
(function(root){
 'use strict';var C=root.XXSXCampaignCore,B=C.button,E=C.escape;
 var layouts=['R.C.L.#.#.D.G.A.#...S...X',' .D..L.##R.C.G.A.#...S..TX'.trim(),'D.R.L.#G#.T...A.#C..S.R.X'];
 var rooms={'.':['走廊','·'],'#':['封闭舱壁','▰'],S:['登陆舱','始'],X:['撤离舱','出'],L:['下层气闸','梯'],D:['数据仓','数'],R:['遗物仓','物'],A:['核心仓','核'],G:['守卫舱','危'],C:['氧气站','氧'],T:['工具仓','工']};
 var items={data:{name:'研究数据',weight:1,value:55},relic:{name:'异构遗物',weight:3,value:120},scrap:{name:'精密组件',weight:2,value:35},core:{name:'主机核心',weight:4,value:400}};
 var kits={scout:{name:'勘察员',oxygen:100,cap:9,tools:3,tip:'额外氧气；侦察守卫只需 1 工具。'},hauler:{name:'回收员',oxygen:90,cap:13,tools:3,tip:'货舱更大；满载仍会提高移动耗氧。'},engineer:{name:'工程师',oxygen:90,cap:9,tools:6,tip:'工具更多；爆破守卫的伤害减半。'}};
 function create(seed,kit){kit=kits[kit]?kit:'scout';var load=kits[kit];return{version:1,rng:seed>>>0,kit:kit,deck:0,pos:20,phase:'explore',hp:80,oxygen:load.oxygen,cap:load.cap,tools:load.tools,heat:0,steps:0,planGoal:'lift',bag:[],visited:[[20],[20],[20]],cleared:[[],[],[]],used:[[],[],[]],ground:layouts.map(function(map,deck){return map.split('').flatMap(function(type,cell){return 'DRA'.indexOf(type)>=0?[{id:deck+'-'+cell,kind:type==='D'?'data':type==='R'?'relic':deck===2?'core':'scrap',cell:cell}]:[];});}),message:'地图已扫描。选择相邻舱室，规划往返氧气与货舱容量。',recorded:false};}
 function weight(s){return s.bag.reduce(function(n,i){return n+items[i.kind].weight;},0);}
 function cost(s){return 2+Math.floor(weight(s)/5)+(s.heat>=5?2:0);}
 function capacity(s,item){var needed=items[item.kind].weight,available=s.cap-weight(s);return{needed:needed,available:available,shortage:Math.max(0,needed-available)};}
 function capacityMessage(item,fit){return '货舱容量不足：'+items[item.kind].name+'需要 '+fit.needed+' 重量，可用 '+fit.available+'，还差 '+fit.shortage+'；放下至少 '+fit.shortage+' 重量再装载。';}
 function adjacent(a,b){return Math.abs(a%5-b%5)+Math.abs(Math.floor(a/5)-Math.floor(b/5))===1;}
 function hackTools(s){return s.kit==='scout'?1:2;}
 function guardWarning(s){
  if(s.tools<1)return '守卫未解除，工具不足；改走其他路线。';
  if(s.tools<hackTools(s))return '守卫未解除，工具只够爆破；先核对消耗，或绕行。';
  return '守卫未解除；先在舱室操作中选择入侵或爆破，或绕行。';
 }
 function alive(s){if(s.hp<=0||s.oxygen<=0){s.phase='lost';s.message='氧气或护甲耗尽，远征失联；这次携带的货物未能带回。';}return s.phase==='explore';}
 function move(s,cell){if(s.phase!=='explore'||!C.integer(cell,0,24)||!adjacent(s.pos,cell)||layouts[s.deck][cell]==='#')return false;var type=layouts[s.deck][cell];if(type==='G'&&s.cleared[s.deck].indexOf(cell)<0){s.message=guardWarning(s);return true;}s.oxygen=Math.max(0,s.oxygen-cost(s));if(s.heat>=5)s.hp=Math.max(0,s.hp-2);s.pos=cell;s.steps++;if(s.visited[s.deck].indexOf(cell)<0)s.visited[s.deck].push(cell);s.message=roomName(s,type)+'：'+(s.ground[s.deck].some(function(i){return i.cell===cell;})?'发现可回收货物，装载会消耗 1 氧气并增加热度。':'可继续规划路线。');if(s.used[s.deck].indexOf(cell)<0&&(type==='C'||type==='T')){s.used[s.deck].push(cell);if(type==='C'){s.oxygen=Math.min(120,s.oxygen+24);s.heat=Math.max(0,s.heat-2);s.message='一次性补给：氧气 +24，热度 −2。';}else{s.tools+=2;s.message='一次性补给：工具 +2。';}}alive(s);return true;}
 function roomName(s,type){return type==='A'?(s.deck===2?'主机核心仓':'组件仓'):rooms[type][0];}
 function plan(s,goal){goal=goal||s.planGoal||(s.deck===2?'extract':'lift');var map=layouts[s.deck],targets=map.split('').flatMap(function(type,i){return (goal==='extract'&&(type==='S'||type==='X')||goal==='lift'&&type==='L'&&s.deck<2||goal==='oxygen'&&type==='C'&&s.used[s.deck].indexOf(i)<0||goal==='tools'&&type==='T'&&s.used[s.deck].indexOf(i)<0)?[i]:[];});var queue=[[s.pos]],seen=new Set([s.pos]),path=null;while(queue.length){var route=queue.shift(),at=route[route.length-1];if(targets.indexOf(at)>=0){path=route;break;}for(var next=0;next<25;next++){if(seen.has(next)||!adjacent(at,next)||map[next]==='#'||map[next]==='G'&&s.cleared[s.deck].indexOf(next)<0)continue;seen.add(next);queue.push(route.concat(next));}}if(!path)return{path:[],steps:null,oxygen:s.oxygen,hp:s.hp,safe:false,reason:targets.length?'blocked':'missing'};var oxygen=s.oxygen,hp=s.hp,heat=s.heat,used=s.used[s.deck].slice(),spent=0;for(var cell of path.slice(1)){var amount=2+Math.floor(weight(s)/5)+(heat>=5?2:0);spent+=amount;oxygen=Math.max(0,oxygen-amount);if(heat>=5)hp=Math.max(0,hp-2);if(map[cell]==='C'&&used.indexOf(cell)<0){used.push(cell);oxygen=Math.min(120,oxygen+24);heat=Math.max(0,heat-2);}if(oxygen<=0||hp<=0)return{path:path,steps:path.length-1,oxygen:oxygen,hp:hp,safe:false,spent:spent,failedAt:cell};}return{path:path,steps:path.length-1,oxygen:oxygen,hp:hp,safe:true,spent:spent};}
 function act(s,action,d){if(s.phase==='upgrade'){if(action!=='upgrade'||['cargo','seal','coolant'].indexOf(d.choice)<0)return false;if(d.choice==='cargo')s.cap+=3;if(d.choice==='seal'){s.hp=Math.min(100,s.hp+24);s.oxygen=Math.min(120,s.oxygen+12);}if(d.choice==='coolant'){s.heat=0;s.tools+=2;}s.deck++;s.planGoal=s.deck===2?'extract':'lift';s.pos=20;s.oxygen=Math.min(120,s.oxygen+28);s.heat=Math.max(0,s.heat-1);s.phase='explore';s.message='深入第 '+(s.deck+1)+' 层。气闸补充 28 氧气，装备随远征保留。';return true;}if(s.phase!=='explore')return false;
  if(action==='plan'&&['extract','lift','oxygen','tools'].indexOf(d.choice)>=0){s.planGoal=d.choice;return true;}
  if(action==='move')return move(s,Number(d.cell));
  if(action==='take'){var at=s.ground[s.deck].findIndex(function(i){return i.id===d.item&&i.cell===s.pos;});if(at<0)return false;var item=s.ground[s.deck][at],fit=capacity(s,item);if(fit.shortage){s.message=capacityMessage(item,fit);return true;}s.bag.push(s.ground[s.deck].splice(at,1)[0]);s.oxygen=Math.max(0,s.oxygen-1);s.heat=Math.min(8,s.heat+1);s.message='装载 '+items[item.kind].name+'。热度 '+s.heat+'；移动耗氧 '+cost(s)+'。';alive(s);return true;}
  if(action==='drop'){var i=s.bag.findIndex(function(item){return item.id===d.item;});if(i<0)return false;var item=s.bag.splice(i,1)[0];item.cell=s.pos;s.ground[s.deck].push(item);s.message='放下 '+items[item.kind].name+'，留在当前舱室，可再取回。';return true;}
  if(action==='hack'||action==='breach'){var cell=Number(d.cell);if(!C.integer(cell,0,24)||!adjacent(s.pos,cell)||layouts[s.deck][cell]!=='G'||s.cleared[s.deck].indexOf(cell)>=0)return false;var tools=action==='hack'?hackTools(s):1;if(s.tools<tools){s.message='工具不足，需要绕路或寻找工具仓。';return true;}s.tools-=tools;s.oxygen=Math.max(0,s.oxygen-(action==='hack'?3:1));if(action==='breach'){s.hp=Math.max(0,s.hp-(s.kit==='engineer'?8:16));s.heat=Math.min(8,s.heat+2);}s.cleared[s.deck].push(cell);s.message=action==='hack'?'静默入侵成功，守卫已解除。':'爆破成功；护甲与热度付出代价。';alive(s);return true;}
  if(action==='vent'){if(s.tools<1)return false;s.tools--;s.oxygen=Math.max(0,s.oxygen-2);s.heat=Math.max(0,s.heat-3);s.message='主动冷却：工具 −1，氧气 −2，热度 −3。';alive(s);return true;}
  if(action==='descend'){if(layouts[s.deck][s.pos]!=='L'||s.deck>=2)return false;s.phase='upgrade';s.message='选择一项现场改装，再进入下层。';return true;}
  if(action==='extract'){if(['S','X'].indexOf(layouts[s.deck][s.pos])<0)return false;var core=s.bag.some(function(i){return i.kind==='core';});s.phase=core?'won':'extracted';s.message=core?'主机核心回收成功，三层远征完成。':'安全撤离，货物已带回；主机核心仍在第三层。';return true;}
  return false;
 }
 function score(s){return s.phase==='lost'?0:s.bag.reduce(function(n,i){return n+items[i.kind].value;},0)+(s.phase==='won'?300:0);}
 function valid(s){if(!s||s.version!==1||!kits[s.kit]||!C.integer(s.rng,0,0xffffffff)||!C.integer(s.deck,0,2)||!C.integer(s.pos,0,24)||layouts[s.deck][s.pos]==='#'||['explore','upgrade','won','extracted','lost'].indexOf(s.phase)<0)return false;for(var p of ['hp','oxygen','cap','tools','heat','steps'])if(!C.integer(s[p],0,p==='steps'?100000:p==='heat'?8:p==='cap'?30:200))return false;if(typeof s.recorded!=='boolean'||typeof s.message!=='string'||s.message.length>500||!Array.isArray(s.bag)||s.bag.length>30)return false;
  if(!['visited','cleared','used','ground'].every(function(k){return Array.isArray(s[k])&&s[k].length===3&&s[k].every(function(a){return Array.isArray(a)&&a.length<=60;});}))return false;
  if(!['visited','cleared','used'].every(function(k){return s[k].every(function(a){return a.every(function(n){return C.integer(n,0,24);})&&new Set(a).size===a.length;});}))return false;
  if(s.planGoal!==undefined&&['extract','lift','oxygen','tools'].indexOf(s.planGoal)<0)return false;
  var all=s.bag.concat.apply(s.bag,s.ground);if(!all.every(function(i){return i&&typeof i.id==='string'&&/^\d-\d{1,2}$/.test(i.id)&&items[i.kind]&&C.integer(i.cell,0,24);})||new Set(all.map(function(i){return i.id;})).size!==all.length||weight(s)>s.cap)return false;
  return s.phase!=='won'||s.bag.some(function(i){return i.kind==='core';});
 }
 function cellLabel(cell){return '第 '+(Math.floor(cell/5)+1)+' 行第 '+(cell%5+1)+' 列';}
 function exhausted(s){return s.oxygen<=0?(s.hp<=0?'氧气与护甲':'氧气'):'护甲';}
 function goalResult(s,goal){
  if(goal==='extract'){
   if(s.bag.some(function(i){return i.kind==='core';}))return '可选择「带货撤离」，完成核心回收。';
   return s.bag.length?'可撤离并带回货物，尚未回收核心。':'可撤离，但未携带货物。';
  }
  if(goal==='lift')return '可选择「进入下层」，改装后下潜。';
  if(goal==='oxygen')return '氧气补给已计入到达值。';
  return '到站可获得一次工具补给（+2）。';
 }
 function routeSummary(s,goal,p){
  if(s.phase!=='explore')return s.phase==='upgrade'?'先选择改装，再进入下层规划路线。':'远征已结束，不能继续移动或执行目标动作。';
  if(p.steps===null){
   if(p.reason==='blocked')return '目标路线被守卫阻挡；先解除守卫或改选目标。';
   if(goal==='lift')return '第三层没有可进入的下层；改选撤离目标。';
   if(goal==='oxygen'||goal==='tools'){
    var name=goal==='oxygen'?'氧气站':'工具仓',exists=layouts[s.deck].includes(goal==='oxygen'?'C':'T');
    return (exists?'本层'+name+'的补给已用完':'本层没有'+name)+'；改选路线目标。';
   }
   return '本层没有撤离目标。';
  }
  if(!p.safe)return '途中资源会耗尽：'+cellLabel(p.failedAt)+exhausted(p)+'耗尽，无法执行目标动作。最短路线共 '+p.steps+' 步；失联时剩余氧气 '+p.oxygen+'、护甲 '+p.hp+'，不是目标到达值。可尝试绕行或先补给，再规划。';
  if(p.steps===0)return '已在目标舱室。'+(goal==='oxygen'||goal==='tools'?'补给只在移动到站时触发。':goalResult(s,goal));
  return '最短路线 '+p.steps+' 步 · 到达氧气 '+s.oxygen+' → '+p.oxygen+' · 护甲 '+s.hp+' → '+p.hp+'。'+goalResult(s,goal);
 }
 function movePreview(s,cell){
  // Forecast on a disposable copy: movement decides the arrival order and survival.
  var copy=JSON.parse(JSON.stringify(s)),type=layouts[s.deck][cell];
  if(!move(copy,cell))return '当前不能进入。';
  if(copy.pos!==cell)return copy.message;
  var supplied=copy.used[s.deck].length!==s.used[s.deck].length;
  var text='氧气 '+s.oxygen+' → '+copy.oxygen+'（步耗 '+cost(s)+(supplied&&type==='C'?'，含首次补给':'')+'）；护甲 '+s.hp+' → '+copy.hp+'；热度 '+s.heat+' → '+copy.heat+'。';
  if(copy.phase==='lost')return '移动后'+exhausted(copy)+'耗尽，远征失联，货物无法带回。'+text;
  if(type==='S'||type==='X')return text+goalResult(copy,'extract');
  if(type==='L')return text+(copy.deck<2?goalResult(copy,'lift'):'第三层没有可进入的下层。');
  if(type==='T'&&supplied)return text+'工具 '+s.tools+' → '+copy.tools+'（一次补给）。';
  if((type==='C'||type==='T')&&!supplied)text+='补给已用。';
  if(copy.ground[s.deck].some(function(i){return i.cell===cell;}))text+='到达后可查看货物与装载条件。';
  return text;
 }
 function view(s,meta,warn){if(!s)return '<div class="campaignPane"><h3>废舰核心回收</h3><p>深入三层，带回主机核心。氧气、工具、护甲和货舱都有限；可以提前撤离保住货物。</p><div class="campaignChoices">'+Object.entries(kits).map(function(pair){var k=pair[1];return '<article class="campaignChoice"><h3>'+k.name+'</h3><p>'+k.tip+'<br>氧气 '+k.oxygen+' · 容量 '+k.cap+' · 工具 '+k.tools+'</p>'+B('start','选择'+k.name,false,'data-choice="'+pair[0]+'"')+'</article>';}).join('')+'</div><p class="campaignNote">已完成撤离 '+meta.clears+' 次 · 最高回收价值 '+meta.best+'。新远征每步自动保存。</p>'+(warn?'<p class="campaignWarning">'+E(warn)+'</p>':'')+'</div>';
  var map=layouts[s.deck].split(''),active=s.phase==='explore',goal=s.planGoal||(s.deck===2?'extract':'lift'),planned=active?plan(s,goal):null,terminal=['won','lost','extracted'].indexOf(s.phase)>=0;
  var ground=s.ground[s.deck].filter(function(i){return i.cell===s.pos;});
  var nearby=map.flatMap(function(type,i){return active&&type!=='#'&&adjacent(s.pos,i)?[i]:[];});
  var guards=nearby.filter(function(cell){return map[cell]==='G'&&s.cleared[s.deck].indexOf(cell)<0;});
  return '<div class="campaignLayout"><section class="campaignPane"><h3>第 '+(s.deck+1)+' 层 · '+kits[s.kit].name+'</h3>'+
   '<div class="campaignMetrics"><span>氧气 <b>'+s.oxygen+'</b></span><span>护甲 <b>'+s.hp+'</b></span><span>工具 <b>'+s.tools+'</b></span><span>热度 <b>'+s.heat+'/8</b></span><span>货舱 <b>'+weight(s)+'/'+s.cap+'</b></span></div>'+
   '<div class="campaignGrid" aria-label="五乘五废舰地图">'+map.map(function(type,i){
    var canChoose=nearby.includes(i),locked=type==='G'&&s.cleared[s.deck].indexOf(i)<0;
    return '<button type="button" data-campaign-action="move" data-cell="'+i+'" '+(canChoose?'aria-describedby="salvage-step-'+i+'"':'disabled')+
     ' class="'+(s.pos===i?'isHere ':'')+(s.visited[s.deck].indexOf(i)>=0?'isKnown ':'')+(planned&&planned.path.indexOf(i)>0?'isRoute ':'')+(locked?'isDanger':'')+
     '" aria-label="'+E(cellLabel(i)+' '+roomName(s,type)+(s.pos===i?'，当前位置':''))+'">'+(s.pos===i?'●':type==='G'&&!locked?'·':type==='A'&&s.deck<2?'件':rooms[type][1])+'</button>';
   }).join('')+'</div>'+
   (nearby.length?'<p class="campaignNote"><b>相邻移动风险预览</b><br>'+nearby.map(function(cell){
    return '<span id="salvage-step-'+cell+'"><b>'+E(cellLabel(cell)+' '+roomName(s,map[cell]))+'</b>：'+E(movePreview(s,cell))+'</span>';
   }).join('<br>')+'</p>':'')+
   '<div class="campaignToolbar" aria-label="规划路线">'+[['lift','规划气闸'],['extract','规划撤离'],['oxygen','寻找氧气'],['tools','寻找工具']].map(function(g){
    return B('plan',g[1],!active||g[0]==='lift'&&s.deck>=2,'data-choice="'+g[0]+'" aria-pressed="'+(goal===g[0])+'"');
   }).join('')+'</div>'+
   '<p class="campaignRoute '+(planned&&planned.steps!==null&&!planned.safe?'campaignWarning':'')+'" role="status">'+E(routeSummary(s,goal,planned))+'</p>'+
   '<p class="campaignNote">路线已计入沿途未使用的氧气补给；规划不会自动移动。始 / 出：可撤离 · 梯：深入 · 数 / 物 / 件 / 核：货物 · 氧 / 工：一次补给 · 危：守卫。当前每步耗氧 '+cost(s)+'，热度 ≥5 时移动损失 2 护甲。</p>'+
   '<div class="campaignLog" role="status">'+E(warn||s.message)+'</div><div class="campaignToolbar">'+B('vent','冷却 · 1工具 / 2氧气',!active||s.tools<1||s.heat===0)+B('extract','带货撤离',!active||['S','X'].indexOf(map[s.pos])<0)+B('descend','进入下层',!active||map[s.pos]!=='L'||s.deck>=2)+'</div>'+
   (terminal?B('start','开始新远征',false,'data-choice="'+s.kit+'"'):'')+
   (s.phase==='upgrade'?'<div class="campaignChoices">'+[['cargo','扩展货舱','容量 +3'],['seal','气密修复','护甲 +24，氧气 +12'],['coolant','冷却组件','清空热度，工具 +2']].map(function(u){
    return '<article class="campaignChoice"><h3>'+u[1]+'</h3><p>'+u[2]+'</p>'+B('upgrade','安装',false,'data-choice="'+u[0]+'"')+'</article>';
   }).join('')+'</div>':'')+
   '</section><aside class="campaignPane"><h3>舱室操作</h3>'+guards.map(function(cell){
    return '<p>相邻守卫：'+cellLabel(cell)+'</p><div class="campaignToolbar">'+B('hack','静默入侵',s.tools<hackTools(s),'data-cell="'+cell+'"')+B('breach','强行爆破',s.tools<1,'data-cell="'+cell+'"')+'</div><p class="campaignNote">入侵：'+hackTools(s)+' 工具、3 氧气。爆破：1 工具、1 氧气、'+(s.kit==='engineer'?8:16)+' 护甲、2 热度。</p>';
   }).join('')+
   (ground.length?'<h3>当前货物</h3><div class="campaignInventory">'+ground.map(function(i){
    var fit=capacity(s,i),details=items[i.kind].name+' · 重 '+fit.needed+' · 值 '+items[i.kind].value;
    return '<div><span>'+E(details)+(active&&fit.shortage?'<br><span class="campaignWarning">'+E(capacityMessage(i,fit))+'</span>':'')+'</span>'+B('take','装载',!active||fit.shortage>0,'data-item="'+i.id+'"')+'</div>';
   }).join('')+'</div>':'<p class="campaignNote">当前舱室没有待装载货物。</p>')+
   '<h3>货舱 · 价值 '+score(s)+'</h3><div class="campaignInventory">'+s.bag.map(function(i){return '<div><span>'+items[i.kind].name+' · 重 '+items[i.kind].weight+'</span>'+B('drop','放下',!active,'data-item="'+i.id+'"')+'</div>';}).join('')+'</div><p class="campaignNote">目标核心位于第三层。放下的货物会留在该层当前舱室；进入下层后无法返回。收益只有撤离后计入本游戏记录。</p></aside></div>';
 }
 var api={create:create,act:act,move:move,weight:weight,cost:cost,score:score,valid:valid,layouts:layouts,plan:plan};root.XXSXSalvage=api;C.mount('salvageExpedition','xxsxSalvageExpeditionV1',api,view);
})(window);
