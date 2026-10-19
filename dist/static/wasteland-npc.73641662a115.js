/* 界门交易行 · NPC与跨界商旅系统 · v1 */
(function(root){
  'use strict';

  // ── 工具 ──────────────────────────────────────────────────────────────────
  function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
  function pickN(arr,n){
    var a=arr.slice(),r=[];
    while(r.length<n&&a.length){var i=Math.floor(Math.random()*a.length);r.push(a.splice(i,1)[0]);}
    return r;
  }
  function rand(min,max){return min+Math.random()*(max-min);}
  function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}

  // ── 标签池 ────────────────────────────────────────────────────────────────
  var IDENTITY_TAGS=[
    '拾荒者','工地采购','黑市商人','执法人员','医疗工作者',
    '工程师/技术人员','农场主','酿酒师','势力代表','情报贩子','可接受派遣'
  ];
  var FACTION_TAGS=['执法派','黑市派','中立','势力派系'];
  var PERSONALITY_TAGS=[
    '记仇','软弱','守法','地头蛇','健谈','多疑','冲动','谨慎','嗜酒','清醒主义者','仗义'
  ];
  var ABILITY_TAGS=[
    '鉴定专家:金属','鉴定专家:化学','鉴定专家:食品',
    '容易被骗',
    '擅长城区搜索','擅长野外搜索','擅长工业区搜索',
    '高体力','武装','搜索:电子','搜索:医疗','搜索:食物','搜索:机械',
    '可靠','不可靠'
  ];
  var SHOPPING_TAGS=[
    '批发买家','批发卖家','急于出手','急于购买',
    '只买套装','指定规格','分期付款'
  ];
  // 世界表。顺序绝对不能重排——旧存档里的访客世界是用下标存的
  // （LEGACY_VISITOR_WORLD_ORDER），挪一下位置就会把老档的商旅送到错的世界。
  // status: 'playable' = 已实现完整内容；'wip' = 规划中，菜单里标注「开发中」。
  var WORLD_ORDER=[
    {id:'wasteland_nuclear',name:'核爆废土',mark:'☢',color:'#ffc867',status:'playable'},
    {id:'wasteland_plague',name:'瘟疫荒原',mark:'✚',color:'#85edbc',status:'wip'},
    {id:'wasteland_ai',name:'机械末日',mark:'⚙',color:'#ff7e8e',status:'wip'},
    {id:'xianxia_sect',name:'灵霄宗门界',mark:'☯',color:'#bb9bff',status:'playable'},
    {id:'xianxia_mortal',name:'凡界集市',mark:'▦',color:'#a7b8ce',status:'wip'},
    {id:'steampunk',name:'蒸汽帝国',mark:'⚙',color:'#79e7ee',status:'wip'},
    {id:'cybermage',name:'赛博魔法城',mark:'⌘',color:'#bb9bff',status:'wip'},
    {id:'medieval',name:'中世纪王国',mark:'⚗',color:'#85edbc',status:'wip'},
    {id:'stellar',name:'星际外站',mark:'✦',color:'#79e7ee',status:'wip'},
    {id:'ancient_empire',name:'古代帝国集市',mark:'◇',color:'#ffc867',status:'wip'},
    {id:'unknown',name:'第十一界 · 未知',mark:'?',color:'#a7b8ce',status:'wip'}
  ];
  var LEGACY_VISITOR_WORLD_ORDER=[WORLD_ORDER[0],WORLD_ORDER[5],WORLD_ORDER[1],WORLD_ORDER[6],WORLD_ORDER[9],WORLD_ORDER[4]];
  // 商旅角色 → 出身世界。只有两个世界是完整实现的，其余角色都属于这两界中的一个；
  // informant（情报贩子）不属于任何一界，他从维度中转站来，所以在下面退回默认值。
  var VISITOR_WORLDS={
    scavenger:WORLD_ORDER[0],
    trader:WORLD_ORDER[0],
    medic:WORLD_ORDER[0],
    contractor:WORLD_ORDER[0],
    herbalist:WORLD_ORDER[3],
    alchemist:WORLD_ORDER[3],
    cultivator:WORLD_ORDER[3],
    collector:WORLD_ORDER[3]
  };
  var WORLD_BY_ID={};
  WORLD_ORDER.forEach(function(w){WORLD_BY_ID[w.id]=w;});
  // 已实现完整内容的世界——玩家只能在这两个里选，其余标注开发中
  var PLAYABLE_WORLDS=WORLD_ORDER.filter(function(w){return w.status==='playable';});
  function worldById(id){return WORLD_BY_ID[id]||null;}

  // 互斥规则（11.3节）
  var MUTEX=[
    ['嗜酒','清醒主义者'],
    ['鉴定专家:金属','容易被骗'],
    ['鉴定专家:化学','容易被骗'],
    ['鉴定专家:食品','容易被骗'],
    ['记仇','软弱'],
    ['冲动','谨慎'],
    ['可靠','不可靠']
  ];

  function hasConflict(tags,candidate){
    for(var i=0;i<MUTEX.length;i++){
      var pair=MUTEX[i];
      if(pair.indexOf(candidate)!==-1){
        var other=pair[pair[0]===candidate?1:0];
        if(tags.indexOf(other)!==-1)return true;
      }
    }
    return false;
  }

  function addUnique(tags,pool,count){
    var shuffled=pool.slice().sort(function(){return Math.random()-0.5;});
    for(var i=0;i<shuffled.length&&tags.length<tags.length+count;i++){
      if(!hasConflict(tags,shuffled[i])&&tags.indexOf(shuffled[i])===-1){
        tags.push(shuffled[i]);
        if(--count<=0)break;
      }
    }
    return tags;
  }

  // ── 随机姓名生成 ──────────────────────────────────────────────────────────
  var SURNAMES=['陈','王','李','张','刘','赵','周','吴','郑','孙','钟','林'];
  var GIVEN=['铁','锋','义','柱','仓','漠','砂','荒','沛','烛','砾','尘','卯','壬'];
  function randomName(){
    return pick(SURNAMES)+pick(GIVEN)+(Math.random()<0.5?pick(GIVEN):'');
  }

  function worldForNpc(npc){
    var known=VISITOR_WORLDS[npc&&npc.role]||{id:'',name:'维度中转站',mark:'◇',color:'#79e7ee'};
    var rawWorldId=npc&&npc.worldId;
    var legacyId=typeof rawWorldId==='number'?rawWorldId:typeof rawWorldId==='string'&&/^\d+$/.test(rawWorldId)?Number(rawWorldId):0;
    var legacy=legacyId>0&&legacyId%1===0
      ? LEGACY_VISITOR_WORLD_ORDER[legacyId-1]||WORLD_ORDER[legacyId-1]
      : null;
    return {
      id:legacy&&legacy.id||typeof rawWorldId==='string'&&!/^\d+$/.test(rawWorldId)&&rawWorldId||known.id,
      name:npc&&npc.worldName||legacy&&legacy.name||known.name,
      mark:npc&&npc.worldMark||legacy&&legacy.mark||known.mark,
      color:npc&&npc.worldColor||legacy&&legacy.color||known.color
    };
  }

  // ── 1. generateNPC(role) ──────────────────────────────────────────────────
  // role: 'customer' | 'dispatcher' | 'bidder'
  function generateNPC(role){
    var tags=[];

    // 身份：1-2个
    addUnique(tags,IDENTITY_TAGS,1+Math.floor(Math.random()*2));

    // 派遣员强制含"可接受派遣"
    if(role==='dispatcher'&&tags.indexOf('可接受派遣')===-1){
      tags.push('可接受派遣');
    }

    // 阵营：1个
    var faction=pick(FACTION_TAGS);
    tags.push(faction);

    // 性格：1-3个，互斥过滤
    addUnique(tags,PERSONALITY_TAGS,1+Math.floor(Math.random()*3));

    // 能力：1-2个，互斥过滤
    addUnique(tags,ABILITY_TAGS,1+Math.floor(Math.random()*2));

    // 购物：0-2个
    addUnique(tags,SHOPPING_TAGS,Math.floor(Math.random()*3));

    return {
      id:'npc_'+(Date.now()%1e9)+'_'+Math.floor(Math.random()*1e4),
      name:randomName(),
      faction:faction,
      tags:tags,
      funds:Math.floor(rand(50,2000)),
      relation:0,           // 关系值 -100..100
      events:[],            // 最近3-5条关键事件
      role:role||'customer'
    };
  }

  // ── 2. evaluateTrade(npc, item, playerSkill) ─────────────────────────────
  // item: {type, authentic, quality}
  // playerSkill: 0-1 （0=无据，1=满级）
  // 返回 {confidence, verdict, method}
  //   method: 'tool' | 'skill' | 'guess'
  //   verdict: 'authentic' | 'fake' | 'uncertain'
  //   confidence: 0-1
  function evaluateTrade(npc,item,playerSkill){
    var tags=npc.tags||[];
    var itemType=(item&&(item.category||item.type))||'unknown';

    // 工具检测：npc携带对应鉴定专家标签即视为有工具
    var expertTag='鉴定专家:'+itemType;
    var hasTool=tags.indexOf(expertTag)!==-1;

    if(hasTool){
      return {
        confidence:1,
        verdict:item.genuine===false?'fake':'authentic',
        method:'tool'
      };
    }

    // 容易被骗：极低skill
    if(tags.indexOf('容易被骗')!==-1){
      playerSkill=Math.max(0,playerSkill-0.4);
    }

    // 多疑：提升npc自身的警觉，但这里评估的是NPC对物品的判断
    // playerSkill代表玩家的鉴定技能水平
    var skill=clamp(playerSkill||0,0,1);

    if(skill<0.1){
      // 完全无据：纯随机
      var guess=Math.random()<0.5;
      return {
        confidence:0.5,
        verdict:guess?'authentic':'fake',
        method:'guess'
      };
    }

    // 技能估算：越高越准
    var noise=(1-skill)*0.6;
    var trueConf=item.genuine===false?0.2-skill*0.15:0.8+skill*0.15;
    var conf=clamp(trueConf+(Math.random()-0.5)*noise,0.05,0.95);
    var verdict=conf>0.5?'authentic':'fake';
    if(Math.abs(conf-0.5)<0.15)verdict='uncertain';

    return{confidence:conf,verdict:verdict,method:'skill'};
  }

  // ── 3. negotiatePrice(npc, item, basePrice) ──────────────────────────────
  // 返回NPC出价（number）
  function negotiatePrice(npc,item,basePrice){
    var tags=npc.tags||[];
    var price=basePrice;

    // 急于购买：接受高价
    if(tags.indexOf('急于购买')!==-1)price*=rand(1.0,1.3);
    // 谨慎：压价
    if(tags.indexOf('谨慎')!==-1)price*=rand(0.6,0.85);
    // 冲动：可能溢价
    if(tags.indexOf('冲动')!==-1)price*=rand(0.9,1.4);
    // 批发买家：压低单价
    if(tags.indexOf('批发买家')!==-1)price*=rand(0.7,0.85);
    // 拾荒者：低预算抵触高价
    if(tags.indexOf('拾荒者')!==-1)price*=rand(0.5,0.8);
    // 嗜酒且物品是酒：溢价
    if(tags.indexOf('嗜酒')!==-1&&item&&item.type==='酒')price*=rand(1.1,1.5);
    // 清醒主义者对酒拒绝
    if(tags.indexOf('清醒主义者')!==-1&&item&&item.type==='酒')return 0;
    // 医疗工作者对药品加价
    if(tags.indexOf('医疗工作者')!==-1&&item&&item.type==='药品')price*=rand(1.0,1.2);
    // 黑市商人对违禁品兴趣
    if(tags.indexOf('黑市商人')!==-1&&item&&item.contraband)price*=rand(1.1,1.4);
    // 执法人员拒绝违禁品
    if(tags.indexOf('执法人员')!==-1&&item&&item.contraband)return 0;
    // 资金上限约束
    price=Math.min(price,npc.funds);
    return Math.floor(price);
  }

  // ── 4. resolveOutcome(npc, item, verdict) ────────────────────────────────
  // verdict: 'authentic'|'fake'|'uncertain'
  // 返回后果类型字符串
  // face/note/silent/spread/report/nothing
  function resolveOutcome(npc,item,verdict){
    if(verdict==='authentic')return'nothing';

    var tags=npc.tags||[];
    // 当场发现（工具鉴定或多疑型高概率）
    var immediateChance=tags.indexOf('多疑')!==-1?0.6:0.3;
    if(Math.random()<immediateChance)return'face';

    // 延迟反馈
    if(tags.indexOf('记仇')!==-1){
      // 记仇：高影响力→举报或散布
      if(tags.indexOf('地头蛇')!==-1)return Math.random()<0.5?'report':'spread';
      if(tags.indexOf('守法')!==-1)return'report';
      return Math.random()<0.4?'spread':'note';
    }
    if(tags.indexOf('软弱')!==-1)return'nothing';
    if(tags.indexOf('守法')!==-1)return Math.random()<0.6?'report':'note';
    if(tags.indexOf('地头蛇')!==-1||tags.indexOf('健谈')!==-1)return'spread';
    // 默认：随机
    return pick(['note','silent','spread','nothing']);
  }

  // ── 5. createReputation() ────────────────────────────────────────────────
  var FACTIONS=['执法派','黑市派','拾荒者群体','势力派系'];

  function createReputation(){
    var rep={overall:0,factions:{}};
    FACTIONS.forEach(function(f){rep.factions[f]=0;});
    return rep;
  }

  // effect: {overall?, factions?:{阵营:delta}}
  function applyEffect(rep,effect){
    if(effect.overall)rep.overall=clamp(rep.overall+effect.overall,-100,100);
    if(effect.factions){
      Object.keys(effect.factions).forEach(function(f){
        if(rep.factions[f]===undefined)rep.factions[f]=0;
        rep.factions[f]=clamp(rep.factions[f]+effect.factions[f],-100,100);
      });
    }
  }

  // ── 6. createFeedbackQueue() ─────────────────────────────────────────────
  // 延迟反馈队列：add(entry, delay) / tick() → fired[]
  function createFeedbackQueue(){
    var queue=[];
    return{
      add:function(entry,delay){
        queue.push({entry:entry,countdown:delay||1});
      },
      tick:function(){
        var fired=[];
        var remaining=[];
        queue.forEach(function(item){
          item.countdown--;
          if(item.countdown<=0)fired.push(item.entry);
          else remaining.push(item);
        });
        queue=remaining;
        return fired;
      },
      size:function(){return queue.length;}
    };
  }

  // ── 暴露 ──────────────────────────────────────────────────────────────────
  root.WastelandNPC={
    generateNPC:generateNPC,
    worldForNpc:worldForNpc,
    // 世界表必须导出：界门选择器靠 WORLD_ORDER 渲染，
    // 商店侧靠 worldById 判断某个世界能不能开张。
    // 漏掉任何一个，都会变成「面板在、里面是空的」这种静默失败。
    WORLD_ORDER:WORLD_ORDER,
    PLAYABLE_WORLDS:PLAYABLE_WORLDS,
    worldById:worldById,
    evaluateTrade:evaluateTrade,
    negotiatePrice:negotiatePrice,
    resolveOutcome:resolveOutcome,
    createReputation:createReputation,
    applyEffect:applyEffect,
    createFeedbackQueue:createFeedbackQueue,
    VERSION:'1'
  };
})(typeof window!=='undefined'?window:this);
