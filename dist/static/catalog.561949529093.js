(function(){
"use strict";
var slotMeta={
  weapon:{label:'武器',icon:'⚡'},
  subweapon:{label:'副武器',icon:'✧'},
  core:{label:'核心',icon:'◉'},
  utility:{label:'战术',icon:'⌁'},
  engine:{label:'推进',icon:'✦'},
  augment:{label:'模组',icon:'⌬'}
};
var rarityMeta={
  common:{label:'普通',color:'#aabbd0',mult:1},
  rare:{label:'稀有',color:'#72d9ff',mult:1.18},
  epic:{label:'史诗',color:'#c29aff',mult:1.38},
  legendary:{label:'传说',color:'#ffd76a',mult:1.68}
};
var buildTagMeta={
  kinetic:{label:'动能',color:'#72f4ff',desc:'直接火力与射击节奏'},
  spread:{label:'散射',color:'#ffb75c',desc:'多方向覆盖与近距离压制'},
  pierce:{label:'穿透',color:'#c29aff',desc:'穿过目标并扩大输出窗口'},
  electric:{label:'电磁',color:'#72f4ff',desc:'连锁、EMP 与弹幕清除'},
  control:{label:'控制',color:'#ff66c4',desc:'减速、地雷与位置管理'},
  missile:{label:'导弹',color:'#ff66c4',desc:'追踪与远距离锁定'},
  targeting:{label:'锁定',color:'#ffd76a',desc:'自动寻找高价值目标'},
  drone:{label:'无人机',color:'#ffb75c',desc:'环绕单位与额外火力'},
  shield:{label:'护盾',color:'#75ffb2',desc:'吸收伤害并转化为反击'},
  repair:{label:'修复',color:'#75ffb2',desc:'生命恢复与续航'},
  mobility:{label:'机动',color:'#c29aff',desc:'移动、闪避与漂移'},
  tempo:{label:'节奏',color:'#ffd76a',desc:'射速、连杀与过载'}
};

var itemDefs=[
  {id:'pulse',name:'脉冲核心',slot:'weapon',frame:[0,0],combatKind:'pulse',tags:['kinetic'],desc:'稳定高能脉冲，直接提高单发伤害。',apply:function(s,t,p){s.damage+=4*p;t.bulletColor='#72f4ff';t.weaponMode='pulse';t.weaponLabel='脉冲核心';}},
  {id:'splitter',name:'裂光棱镜',slot:'weapon',frame:[1,0],combatKind:'splitter',tags:['spread','kinetic'],desc:'每次射击额外发射两枚扇形弹丸，近距离火力更密。',apply:function(s,t,p){s.shots+=2;s.spread+=.08;s.damage+=1.5*p;t.bulletColor='#ffb75c';t.weaponMode='splitter';t.weaponLabel='裂光棱镜';}},
  {id:'phase',name:'相位长矛',slot:'weapon',frame:[2,0],combatKind:'phase',tags:['pierce'],desc:'子弹可穿过多个目标；每次穿透保留完整弹道。',apply:function(s,t,p){s.damage+=5*p;s.pierce+=2+Math.floor(p-.9);s.bulletSpeed+=70;t.bulletColor='#c79aff';t.phase=true;t.weaponMode='phase';t.weaponLabel='相位长矛';}},
  {id:'arc',name:'电弧线圈',slot:'weapon',frame:[3,0],combatKind:'arc',tags:['electric','control'],desc:'命中后跳跃至附近敌人，链式电击不会消耗穿透次数。',apply:function(s,t,p){s.damage+=2*p;t.chain+=1;t.chainPower=.48*p;t.bulletColor='#72f4ff';t.weaponMode='arc';t.weaponLabel='电弧线圈';}},
  {id:'sentry',name:'轨道哨兵',slot:'weapon',frame:[0,1],combatKind:'sentry',tags:['drone','targeting'],desc:'召唤一台环绕战机，自动锁定敌人发射追踪弹。',apply:function(s,t,p){t.orbitals+=1;t.orbitalDamage+=8*p;t.weaponMode='sentry';t.weaponLabel='轨道哨兵';}},
  {id:'missile',name:'追猎导弹舱',slot:'subweapon',frame:[2,3],combatKind:'missile',tags:['missile','targeting'],desc:'独立副武器：周期性发射一枚追踪导弹，不占用主武器槽。',apply:function(s,t,p){t.auxMode='missile';t.auxLabel='追猎导弹舱';t.auxDamage+=18*p;t.auxInterval=Math.min(t.auxInterval,1.55-.08*p);}},
  {id:'flak',name:'裂阵散射舱',slot:'subweapon',frame:[3,3],combatKind:'flak',tags:['spread','kinetic'],desc:'独立副武器：周期性向两侧发射散射弹，补足近身火力。',apply:function(s,t,p){t.auxMode='flak';t.auxLabel='裂阵散射舱';t.auxDamage+=9*p;t.auxInterval=Math.min(t.auxInterval,1.15-.05*p);}},
  {id:'drone',name:'猎蜂无人机',slot:'subweapon',frame:null,glyph:'◈',glyphColor:'#ffb75c',unlockId:'relay-drone',combatKind:'drone',tags:['drone','targeting'],desc:'独立副武器：放出追踪蜂机编队，优先追击精英和载体。',apply:function(s,t,p){t.auxMode='drone';t.auxLabel='猎蜂无人机';t.auxDamage+=11*p;t.auxInterval=Math.min(t.auxInterval,1.7-.06*p);t.auxCount=2;}},
  {id:'beam',name:'光栅切割器',slot:'subweapon',frame:null,glyph:'╋',glyphColor:'#c29aff',unlockId:'lab-beam',combatKind:'beam',tags:['pierce','electric'],desc:'独立副武器：周期性发射可贯穿多目标的高能光栅。',apply:function(s,t,p){t.auxMode='beam';t.auxLabel='光栅切割器';t.auxDamage+=27*p;t.auxInterval=Math.min(t.auxInterval,2.15-.07*p);t.auxPierce=4;}},
  {id:'mineLauncher',name:'尾迹雷舱',slot:'subweapon',frame:null,glyph:'⌁',glyphColor:'#c29aff',unlockId:'salvage-mine',combatKind:'mine',tags:['control','utility'],desc:'独立副武器：在战机前方投放高能雷区，逼迫敌群改道。',apply:function(s,t,p){t.auxMode='mine';t.auxLabel='尾迹雷舱';t.auxDamage+=42*p;t.auxInterval=Math.min(t.auxInterval,2.5-.08*p);t.auxMine=true;}},
  {id:'barrier',name:'离子穹顶',slot:'core',frame:[1,1],tags:['shield'],desc:'大幅提升护盾；吸收伤害时有概率反射至最近敌人。',apply:function(s,t,p){s.maxHp+=25*p;s.shield+=55*p;t.reflect=.22*p;}},
  {id:'nano',name:'纳米修复舱',slot:'core',frame:[2,1],tags:['repair'],desc:'持续修复生命；击杀精英或 Boss 时额外恢复一段生命。',apply:function(s,t,p){s.maxHp+=12*p;s.regen+=.9*p;t.healOnKill=9*p;}},
  {id:'emp',name:'EMP 电池',slot:'utility',frame:[3,1],tags:['electric','utility'],desc:'增加 EMP 储量并降低冷却；释放时对护盾造成额外破坏。',apply:function(s,t,p){t.empMax+=1;t.empCharges=t.empMax;t.empCooldownMax=Math.max(6,12-2*p);t.empDamage=4.2*p;}},
  {id:'gravity',name:'引力锚',slot:'utility',frame:[0,2],tags:['control'],desc:'子弹命中会减速敌人；精英和 Boss 的移动也会被短暂拖慢。',apply:function(s,t,p){t.slow=.18+.04*p;t.slowTime=1.6;}},
  {id:'mine',name:'虚空雷区',slot:'utility',frame:[1,2],tags:['control','utility'],desc:'每隔数秒在战机身后部署地雷，敌人靠近后范围爆炸。',apply:function(s,t,p){t.mineEvery=Math.max(2.9,5.4-1.1*p);t.mineDamage=34*p;}},
  {id:'drift',name:'漂移推进器',slot:'engine',frame:[2,2],tags:['mobility'],desc:'提升操控灵敏度和移动速度，连续闪避会积累短暂超载。',apply:function(s,t,p){s.moveLerp+=3*p;s.maxHp+=8*p;t.drift=true;}},
  {id:'overdrive',name:'过载反应堆',slot:'engine',frame:[3,2],tags:['kinetic','tempo'],desc:'射击频率大幅提升；击杀后进入短暂狂热状态。',apply:function(s,t,p){s.fireRate=Math.max(.105,s.fireRate*(.82-.025*p));t.killHaste=1.25;t.hasteRate=.72;}},
  {id:'prism',name:'棱镜反射镜',slot:'core',frame:[0,3],tags:['shield','tempo'],desc:'暴击率提高；护盾吸收伤害时有概率向攻击者反射能量。',apply:function(s,t,p){s.crit+=.07*p;s.critMult+=.15*p;t.reflect=Math.max(t.reflect,.12*p);}},
  {id:'swarm',name:'蜂群协议',slot:'engine',frame:[1,3],tags:['drone','tempo'],desc:'每次拾取战术掉落都会短暂召出两架微型无人机。',apply:function(s,t,p){t.swarm=true;t.orbitalDamage+=4*p;}},
  {id:'prismArray',name:'棱镜阵列',slot:'augment',frame:null,glyph:'◇',glyphColor:'#c29aff',tags:['targeting','tempo'],desc:'校准主炮的弱点识别，提升暴击率与暴击伤害。',apply:function(s,t,p){s.crit+=.08*p;s.critMult+=.22*p;}},
  {id:'fluxCoil',name:'磁通线圈',slot:'augment',frame:null,glyph:'⟲',glyphColor:'#72f4ff',tags:['electric','kinetic'],desc:'主副武器共用过载回路，射击间隔缩短，并强化电弧。',apply:function(s,t,p){s.fireRate=Math.max(.11,s.fireRate*(1-.09*p));t.chain+=1;t.chainPower+=.08*p;}},
  {id:'aegisMesh',name:'偏转网格',slot:'augment',frame:null,glyph:'⬡',glyphColor:'#75ffb2',tags:['shield','mobility'],desc:'受击时有机会折射弹幕，并增加少量护盾上限。',apply:function(s,t,p){s.shield+=24*p;t.reflect=Math.max(t.reflect,.16*p);t.shieldOnKill+=2*p;}},
  {id:'salvageLink',name:'回收链路',slot:'augment',frame:null,glyph:'⌘',glyphColor:'#ffd76a',tags:['repair','control'],desc:'每次击毁敌机都会修复战机，击毁精英时修复更多，并延长减速持续时间。',apply:function(s,t,p){s.regen+=.35*p;t.healOnKill+=4*p;t.slowTime+=.35*p;}}
];

var weaponBranchDefs={
  pulse:[
    {id:'conductor',name:'导流节点',desc:'主炮命中后的电弧会额外跳跃一次。',tags:['electric'],apply:function(s,t){t.chain+=1;t.chainPower+=.12;}},
    {id:'guard',name:'护航脉冲',desc:'击毁敌机时恢复少量护盾，连杀越稳定越耐打。',tags:['shield'],apply:function(s,t){t.shieldOnKill=5;}}
  ],
  splitter:[
    {id:'fan',name:'扩散扇叶',desc:'扇形弹幕再增加两枚弹丸，但弹道更宽。',tags:['spread'],apply:function(s,t){s.shots+=2;s.spread+=.07;}},
    {id:'razor',name:'切割棱面',desc:'每枚散射弹获得一次额外穿透。',tags:['pierce'],apply:function(s,t){s.pierce+=1;t.splitPierce=true;}}
  ],
  phase:[
    {id:'lance',name:'贯星矛尖',desc:'穿透弹会在命中后保留更高的动能。',tags:['pierce'],apply:function(s,t){s.pierce+=2;s.damage+=3;}},
    {id:'rift',name:'裂隙回响',desc:'穿透命中会短暂减速目标，扩大下一发的安全窗口。',tags:['control'],apply:function(s,t){t.slow+=.1;t.slowTime+=.8;}}
  ],
  arc:[
    {id:'storm',name:'雷暴分流',desc:'电弧额外跳跃，且不会因目标护盾而中断。',tags:['electric'],apply:function(s,t){t.chain+=2;t.chainPower+=.12;}},
    {id:'capacitor',name:'电容回路',desc:'EMP 释放后会短暂提高主炮射速。',tags:['electric','tempo'],apply:function(s,t){t.empOverload=true;}}
  ],
  sentry:[
    {id:'swarm',name:'蜂群编队',desc:'轨道哨兵增加一台，环绕火力更密集。',tags:['drone'],apply:function(s,t){t.orbitals+=1;t.orbitalDamage+=4;}},
    {id:'hunter',name:'猎杀协议',desc:'哨兵优先锁定精英、载体和 Boss，并造成更高伤害。',tags:['targeting'],apply:function(s,t){t.orbitalHunter=true;t.orbitalDamage+=7;}}
  ]
};
var blueprintDefs=[
  {id:'relay-drone',name:'猎蜂无人机蓝图',itemId:'drone',source:'信号中继',target:24,unit:'累计命中',desc:'把中继捕获的目标预测算法装入副武器池。'},
  {id:'lab-beam',name:'光栅切割器蓝图',itemId:'beam',source:'回声实验室',target:3,unit:'完成轮次',desc:'将实验室的节奏采样转成贯穿型副武器。'},
  {id:'salvage-mine',name:'尾迹雷舱蓝图',itemId:'mineLauncher',source:'深空打捞',target:2,unit:'高能缓存',desc:'用回收的失控电容制造可改变敌群路线的雷舱。'}
];

var waveMods=[
  {name:'初始航道',desc:'标准敌群，适合建立第一套构筑。',color:'#72f4ff',speed:1,fire:.98,armor:0,shield:1,spawn:1,elite:0},
  {name:'相位装甲',desc:'敌方护盾更厚，优先用穿透或 EMP 拆解。',color:'#c29aff',speed:1,fire:1.03,armor:.06,shield:1.8,spawn:1,elite:.02},
  {name:'霓虹风暴',desc:'弹幕密度上升，移动与护盾管理更重要。',color:'#ff718e',speed:1.05,fire:.72,armor:.015,shield:1.1,spawn:.86,elite:.04},
  {name:'猎杀协议',desc:'精英猎手频繁出现，击杀后会掉落高品质战利品。',color:'#ffd76a',speed:1.12,fire:.9,armor:.035,shield:1.25,spawn:.94,elite:.18},
  {name:'失重断层',desc:'重型敌机提前进场，火力窗口更短。',color:'#75ffb2',speed:1.18,fire:1.02,armor:.08,shield:1.35,spawn:.92,elite:.08}
];

var enemyMutations=[
  {id:'berserk',name:'狂暴协议',color:'#ff718e',desc:'半血后移速和射速显著提升。'},
  {id:'revenge',name:'复仇核心',color:'#ffb75c',desc:'被击毁时释放一圈追命弹幕。'},
  {id:'split',name:'裂变装甲',color:'#c29aff',desc:'被击毁后分裂出两架高速碎片机。'},
  {id:'jammer',name:'压制力场',color:'#72f4ff',desc:'靠近玩家时干扰武器，降低射击频率。'}
];

var enemyDefs={
  scout:{name:'侦察机',frame:[0,0],r:15,hp:25,vy:88,fire:0,score:48,xp:17,armor:.01,shield:0,contact:18,color:'#ff6d8e',roleTag:'侦察',attackLabel:'俯冲',readableCue:'只会直线接近；看到粉红环时横向移开即可。',desc:'高速俯冲，不会射击。'},
  zigzag:{name:'折跃翼',frame:[1,0],r:16,hp:35,vy:76,fire:1.3,score:65,xp:23,armor:.03,shield:8,contact:21,color:'#c071ff',roleTag:'瞄准',attackLabel:'折线弹',readableCue:'紫色准线会指向当前位置；保持移动，不要停在航线中线。',desc:'蛇形移动并向玩家当前位置瞄准射击。'},
  gunner:{name:'火力艇',frame:[2,0],r:18,hp:48,vy:55,fire:1.05,score:95,xp:29,armor:.06,shield:15,contact:25,color:'#ffb75c',roleTag:'压制',attackLabel:'连射',readableCue:'橙色炮口亮起后横向扫射；优先拆盾，再穿过火力线。',desc:'横向压制并持续瞄准射击，带有轻型护盾。'},
  tank:{name:'重装堡垒',frame:[3,0],r:24,hp:135,vy:39,fire:1.4,score:180,xp:48,armor:.17,shield:35,contact:38,color:'#ff718e',roleTag:'重装',attackLabel:'重炮',readableCue:'红色核心越亮越危险；用穿透持续输出，别与它贴身换血。',desc:'高护甲与高生命；舰体受损后射速提高。'},
  blade:{name:'裂刃猎手',frame:[1,1],r:18,hp:62,vy:110,fire:1.8,score:130,xp:37,armor:.07,shield:10,contact:34,color:'#d17bff',roleTag:'冲刺',attackLabel:'锁定突进',readableCue:'出现 DASH 和落点圆环时立刻闪避；它的危险来自碰撞，不是弹幕。',desc:'周期性锁定玩家高速突进，碰撞伤害很高。'},
  artillery:{name:'深空炮舰',frame:[2,1],r:21,hp:88,vy:34,fire:1.75,score:165,xp:44,armor:.13,shield:28,contact:32,color:'#76c8ff',roleTag:'炮击',attackLabel:'三联重弹',readableCue:'蓝色蓄能核闪烁后会发射三枚重弹；预判空隙移动。',desc:'停留在远距离发射三联重弹。'},
  carrier:{name:'护卫载体',frame:[0,1],r:23,hp:118,vy:42,fire:1.9,score:210,xp:56,armor:.11,shield:48,contact:36,color:'#75ffb2',roleTag:'部署',attackLabel:'护卫部署',readableCue:'绿色核心降到半血会释放两架护卫；先处理载体，避免敌群翻倍。',desc:'悬停在中场，半血时释放两架高速护卫。'},
  elite:{name:'协议执行者',frame:[3,1],r:27,hp:220,vy:48,fire:.82,score:360,xp:95,armor:.22,shield:115,contact:55,color:'#ffd76a',roleTag:'精英',attackLabel:'五连射',readableCue:'金色标记代表高价值高威胁；先拆护盾，击破后获得更好掉落。',desc:'精英单位，密集五连射并掉落高价值补给。'}
};
var enemyOrder=['scout','zigzag','gunner','tank','blade','artillery','carrier','elite'];

var bossDefs=[
  {id:'cathedral',name:'圣堂审判者',frame:[0,0],color:'#72f4ff',roleTag:'护盾 Boss',attackLabel:'环形炮阵',readableCue:'护盾展开时集中走位，护盾破裂后才是稳定输出窗口。',desc:'环形炮阵与周期性护盾。'},
  {id:'serpent',name:'环渊巨蛇',frame:[1,0],color:'#c17cff',roleTag:'收缩弹幕',attackLabel:'螺旋弹幕',readableCue:'弹幕间距会持续缩小；沿圆弧移动，不要逆着螺旋钻入中心。',desc:'螺旋弹幕会逐步收缩，保持移动。'},
  {id:'prism',name:'棱镜母舰',frame:[0,1],color:'#a6c8ff',roleTag:'分裂 Boss',attackLabel:'镜像炮列',readableCue:'镜像炮列出现时优先清理护卫，留出可穿越的安全通道。',desc:'镜像炮列与分裂护卫。'},
  {id:'eclipse',name:'赤蚀歼灭舰',frame:[1,1],color:'#ff718e',roleTag:'激光 Boss',attackLabel:'扫射近身',readableCue:'红色激光预警会扫过场地；向空隙移动，近身阶段用闪避脱离。',desc:'激光扫射与高压近身阶段。'}
];

var baseStats={maxHp:120,hp:120,damage:15,fireRate:.34,shots:1,spread:.12,pierce:0,crit:.08,critMult:2,shield:28,regen:0,bulletSpeed:560,moveLerp:14};
window.NeonCatalog={slotMeta,rarityMeta,buildTagMeta,itemDefs,weaponBranchDefs,blueprintDefs,waveMods,enemyMutations,enemyDefs,enemyOrder,bossDefs,baseStats};
})();
