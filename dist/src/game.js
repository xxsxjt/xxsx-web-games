(function(){
'use strict';

var byId=function(id){return document.getElementById(id);};
var canvas=byId('gameCanvas');
var ctx=canvas.getContext('2d');
var wrap=byId('gameWrap');
var app=byId('appShell');

var ui={
  score:byId('score'),level:byId('level'),wave:byId('wave'),kills:byId('kills'),
  waveMeta:byId('waveMeta'),xpMeta:byId('xpMeta'),scrapMeta:byId('scrapMeta'),bossMeta:byId('bossMeta'),
  hpBar:byId('hpBar'),xpBar:byId('xpBar'),hpText:byId('hpText'),weaponText:byId('weaponText'),
  comboWrap:byId('comboWrap'),comboBar:byId('comboBar'),comboValue:byId('comboValue'),comboTimer:byId('comboTimer'),
  bossWrap:byId('bossWrap'),bossBar:byId('bossBar'),bossName:byId('bossName'),bossPhase:byId('bossPhase'),
  stageTag:byId('stageTag'),contract:byId('combatContract'),mission:byId('mission'),empBtn:byId('empBtn'),empText:byId('empText'),dashBtn:byId('dashBtn'),dashText:byId('dashText'),overdriveBtn:byId('overdriveBtn'),overdriveText:byId('overdriveText'),
  toast:byId('toast'),buildChip:byId('buildChip'),bestText:byId('bestText'),
  startOverlay:byId('startOverlay'),lootOverlay:byId('lootOverlay'),lootGrid:byId('lootGrid'),lootQueueText:byId('lootQueueText'),
  armoryOverlay:byId('armoryOverlay'),armoryStats:byId('armoryStats'),slotGrid:byId('slotGrid'),
  inventoryGrid:byId('inventoryGrid'),bagCount:byId('bagCount'),synergyStrip:byId('synergyStrip'),archiveOverlay:byId('archiveOverlay'),
  archiveGrid:byId('archiveGrid'),pauseOverlay:byId('pauseOverlay'),gameOverOverlay:byId('gameOverOverlay'),
  resultTitle:byId('resultTitle'),resultText:byId('resultText'),finalBuild:byId('finalBuild'),returnGamePageBtn:byId('returnGamePageBtn'),abandonExpeditionBtn:byId('abandonExpeditionBtn'),
  pauseBtn:byId('pauseBtn'),soundBtn:byId('soundBtn'),
  rerollBtn:byId('rerollBtn'),salvageLootBtn:byId('salvageLootBtn'),
  hubOverlay:byId('hubOverlay'),hubTitle:byId('hubTitle'),hubIntro:byId('hubIntro'),hubStartBtn:byId('hubStartBtn'),hubMoreBtn:byId('hubMoreBtn'),arcadeLanding:byId('arcadeLanding'),arcadeGamePages:byId('arcadeGamePages'),expeditionGamePage:byId('expeditionGamePage'),expeditionStartBtn:byId('expeditionStartBtn'),expeditionSetupBtn:byId('expeditionSetupBtn'),arcadeHomeBtn:byId('arcadeHomeBtn'),returnArcadeBtn:byId('returnArcadeBtn'),arcadeRunCount:byId('arcadeRunCount'),arcadeRelayBest:byId('arcadeRelayBest'),arcadeLabBest:byId('arcadeLabBest'),arcadeShardCount:byId('arcadeShardCount'),arcadeProfileHint:byId('arcadeProfileHint'),announcementBtn:byId('announcementBtn'),announcementOverlay:byId('announcementOverlay'),announcementHero:byId('announcementHero'),announcementList:byId('announcementList'),announcementCloseBtn:byId('announcementCloseBtn'),metaShards:byId('metaShards'),metaIntel:byId('metaIntel'),metaModules:byId('metaModules'),metaResearch:byId('metaResearch'),
  protocolGrid:byId('protocolGrid'),protocolSummary:byId('protocolSummary'),
  eventOverlay:byId('eventOverlay'),eventTag:byId('eventTag'),eventTitle:byId('eventTitle'),eventText:byId('eventText'),eventChoices:byId('eventChoices'),
  selectedShipLabel:byId('selectedShipLabel'),selectedRouteLabel:byId('selectedRouteLabel'),shipClassLabel:byId('shipClassLabel'),shipPowerLabel:byId('shipPowerLabel'),shipPerkLabel:byId('shipPerkLabel'),commanderRank:byId('commanderRank'),
  shipPicker:byId('shipPicker'),hubArmoryStats:byId('hubArmoryStats'),hubLoadout:byId('hubLoadout'),presetGrid:byId('presetGrid'),missionBoard:byId('missionBoard'),stationPortal:byId('stationPortal'),routeGrid:byId('routeGrid'),routeBrief:byId('routeBrief'),routeMap:byId('routeMap'),routeSeedLabel:byId('routeSeedLabel'),routeMapStatus:byId('routeMapStatus'),routeRerollBtn:byId('routeRerollBtn'),launchStageLabel:byId('launchStageLabel'),launchNodeLabel:byId('launchNodeLabel'),launchSeedLabel:byId('launchSeedLabel'),codexCount:byId('codexCount'),codexFilters:byId('codexFilters'),codexGrid:byId('codexGrid'),hubArchiveGrid:byId('hubArchiveGrid'),guideCount:byId('guideCount'),guideFilters:byId('guideFilters'),guideGrid:byId('guideGrid'),workbenchStatus:byId('workbenchStatus'),workbenchStats:byId('workbenchStats'),workbenchSynergy:byId('workbenchSynergy'),workbenchBlueprints:byId('workbenchBlueprints'),workbenchPresetActions:byId('workbenchPresetActions'),workbenchShipPicker:byId('workbenchShipPicker'),workbenchSlotTabs:byId('workbenchSlotTabs'),workbenchItemGrid:byId('workbenchItemGrid'),workbenchResetBtn:byId('workbenchResetBtn'),dispatchHero:byId('dispatchHero'),dispatchGrid:byId('dispatchGrid'),challengeGrid:byId('challengeGrid'),
  relayBoard:byId('relayBoard'),relayHint:byId('relayHint'),relayStatus:byId('relayStatus'),relayTimer:byId('relayTimer'),relayScore:byId('relayScore'),relayStreak:byId('relayStreak'),relayBest:byId('relayBest'),relayStartBtn:byId('relayStartBtn'),relayMastery:byId('relayMastery'),signalFeed:byId('signalFeed'),contractGrid:byId('contractGrid'),salvageBoard:byId('salvageBoard'),salvageGrid:byId('salvageGrid'),salvageHint:byId('salvageHint'),salvageStatus:byId('salvageStatus'),salvageTimer:byId('salvageTimer'),salvageScore:byId('salvageScore'),salvageCollected:byId('salvageCollected'),salvageHeat:byId('salvageHeat'),salvageBest:byId('salvageBest'),salvageStartBtn:byId('salvageStartBtn'),salvageExtractBtn:byId('salvageExtractBtn'),salvageMastery:byId('salvageMastery'),labBoard:byId('labBoard'),labHint:byId('labHint'),labStatus:byId('labStatus'),labTimer:byId('labTimer'),labRound:byId('labRound'),labScore:byId('labScore'),labBest:byId('labBest'),labStartBtn:byId('labStartBtn'),labNodes:byId('labNodes'),labMastery:byId('labMastery'),chronicleSummary:byId('chronicleSummary'),chronicleLoadout:byId('chronicleLoadout'),chronicleTrackMeta:byId('chronicleTrackMeta'),chronicleList:byId('chronicleList')
};
Object.assign(ui,{borderTacticsPage:byId('borderTacticsPage'),arcadeBorderClears:byId('arcadeBorderClears'),arcadeSalvageBest:byId('arcadeSalvageBest'),arcadeBlackboxBest:byId('arcadeBlackboxBest'),relaySector:byId('relaySector'),relayMisses:byId('relayMisses'),relayDraft:byId('relayDraft'),salvageSector:byId('salvageSector'),salvageDescendBtn:byId('salvageDescendBtn'),salvageContractPicker:byId('salvageContractPicker'),salvageData:byId('salvageData'),labStage:byId('labStage'),labLives:byId('labLives'),labDraft:byId('labDraft'),blackboxBoard:byId('blackboxBoard'),blackboxGrid:byId('blackboxGrid'),blackboxStatus:byId('blackboxStatus'),blackboxStage:byId('blackboxStage'),blackboxMoves:byId('blackboxMoves'),blackboxIntegrity:byId('blackboxIntegrity'),blackboxScore:byId('blackboxScore'),blackboxBest:byId('blackboxBest'),blackboxStartBtn:byId('blackboxStartBtn'),blackboxHintBtn:byId('blackboxHintBtn'),blackboxHintText:byId('blackboxHintText'),blackboxDraft:byId('blackboxDraft'),blackboxMastery:byId('blackboxMastery')});

var assets={enemy:new Image(),boss:new Image(),gear:new Image(),player:new Image(),hangar:new Image(),rainline:new Image(),abyss:new Image()};
var expeditionAssetSources={enemy:'assets/enemy-atlas-v3.png',boss:'assets/boss-atlas-v2.webp',gear:'assets/gear-atlas-v3.webp',player:'assets/player-ship-v2.webp',hangar:'assets/hangar-backdrop-v1.webp',rainline:'assets/sector-rainline-v1.webp',abyss:'assets/sector-abyss-v1.webp'};
var expeditionAssetsLoaded=false,assetsReady=null,startingRun=false,pendingStartToken=0,selectedRunMode='campaign';
function loadExpeditionAssets(){
  if(assetsReady)return assetsReady;
  var tasks=Object.keys(expeditionAssetSources).map(function(key){var img=assets[key];return new Promise(function(resolve,reject){if(typeof img.addEventListener!=='function'){img.src=expeditionAssetSources[key];resolve();return;}if(img.complete&&img.naturalWidth){resolve();return;}img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});img.src=expeditionAssetSources[key];});});
  document.querySelectorAll('[data-expedition-src]').forEach(function(img){img.src=img.dataset.expeditionSrc;});
  assetsReady=Promise.all(tasks).then(function(){expeditionAssetsLoaded=true;}).catch(function(error){assetsReady=null;throw error;});return assetsReady;
}
function prepareExpedition(){loadExpeditionAssets().catch(function(){toast('部分素材未能载入，开始时将重试。');});}
function selectRunMode(mode){selectedRunMode=mode==='endless'?'endless':'campaign';document.querySelectorAll('input[name="runMode"]').forEach(function(input){input.checked=input.value===selectedRunMode;});if(ui.expeditionStartBtn)ui.expeditionStartBtn.textContent=selectedRunMode==='campaign'?'开始战役':'开始无尽挑战';if(byId('expeditionRecord')&&profile)byId('expeditionRecord').textContent=selectedRunMode==='endless'?'无尽最高：'+(Number(profile.endlessBestScore)||0)+' 分 · '+(Number(profile.endlessBestWave)||0)+' 波':'战役最高：'+(Number(profile.campaignBestScore)||0)+' 分 · 通关 '+(Number(profile.campaignClears)||0)+' 次';}


var {slotMeta,rarityMeta,buildTagMeta,itemDefs,weaponBranchDefs,blueprintDefs,waveMods,enemyMutations,enemyDefs,enemyOrder,bossDefs,baseStats}=window.NeonCatalog;
var core=window.NeonCore;
var input=core.createPointer();
var keys={};
var ship={};
var traits={};
var shipBlueprints=[
  {id:'pulse',name:'脉冲猎手',className:'均衡型',desc:'稳定输出，容错最高。',perk:'稳定输出 · 适合新手',unlock:'默认',mods:{damage:0,fireRate:1,maxHp:1,shield:1,moveLerp:1}},
  {id:'lancer',name:'相位长枪',className:'爆发型',desc:'火力更集中，穿透更早成型。',perk:'初始穿透 +1 · 生命较低',unlock:'最高波次 3',mods:{damage:4,fireRate:.92,maxHp:.82,shield:.9,moveLerp:1.03}},
  {id:'warden',name:'棱镜守卫',className:'防御型',desc:'护盾厚重，适合高压航线。',perk:'护盾 +70 · 移速较慢',unlock:'累计星尘 15',mods:{damage:-2,fireRate:1.12,maxHp:1.18,shield:2.5,moveLerp:.9}}
];
var routeDefs=[
  {id:'standard',name:'初始航道',tag:'稳定成长',risk:'风险 低',desc:'敌群按标准节奏出现，适合测试新构筑。',brief:'奖励基准 ×1.0 · 普通节点较多 · 第 5 波出现 Boss',color:'#72f4ff',background:'rainline',tint:'#72f4ff',art:'assets/sector-rainline-v1.webp',mods:{speed:1,fire:1,reward:1}},
  {id:'storm',name:'霓虹风暴',tag:'高压弹幕',risk:'风险 中',desc:'敌方射击更频繁，但战利品品质会提高。',brief:'敌方射速 ×1.16 · 战利品品质提高 · 星尘奖励 ×1.25',color:'#ff718e',background:'abyss',tint:'#ff718e',art:'assets/sector-abyss-v1.webp',mods:{speed:1.04,fire:.86,reward:1.25}},
  {id:'salvage',name:'废墟回收线',tag:'资源航线',risk:'风险 中',desc:'敌人更耐打，击杀与拆解会带回更多星尘。',brief:'敌方生命 ×1.18 · 击杀废料提高 · 星尘奖励 ×1.45',color:'#ffd76a',background:'rainline',tint:'#ffd76a',art:'assets/sector-rainline-v1.webp',mods:{speed:1.02,fire:1.05,reward:1.45,hp:1.18}},
  {id:'abyss',name:'深渊捷径',tag:'极限挑战',risk:'风险 高',desc:'直接把危险推到面前，换取更高的局外解锁速度。',brief:'敌方速度 ×1.2 · 弹幕 ×1.12 · 星尘奖励 ×2.0',color:'#c29aff',background:'abyss',tint:'#c29aff',art:'assets/sector-abyss-v1.webp',mods:{speed:1.2,fire:.89,reward:2,hp:1.12}}
];
var starNodeDefs={
  combat:{label:'交战区',tag:'COMBAT',icon:'✦',accent:'#72f4ff',desc:'标准敌群，稳定积累经验。',mods:{speed:1,fire:1,hp:1,reward:1}},
  salvage:{label:'回收带',tag:'SALVAGE',icon:'⌖',accent:'#ffd76a',desc:'敌人更硬，但战利品与星尘更丰厚。',mods:{speed:1.02,fire:1,hp:1.12,reward:1.28,lootFloor:'rare'}},
  event:{label:'信号站',tag:'EVENT',icon:'◌',accent:'#ff66c4',desc:'下一段航线会接入一次额外事件。',mods:{speed:.98,fire:1,hp:1,reward:1.1,event:true}},
  elite:{label:'精英封锁',tag:'ELITE',icon:'◆',accent:'#ff718e',desc:'精英概率和敌方生命同步抬高。',mods:{speed:1.08,fire:.92,hp:1.2,reward:1.45,elite:true}},
  repair:{label:'修复港',tag:'REPAIR',icon:'+',accent:'#75ffb2',desc:'危险较低，进入节点时恢复一段生命。',mods:{speed:.96,fire:1.05,hp:.96,reward:.92,heal:.22}},
  anomaly:{label:'异常窗',tag:'ANOMALY',icon:'⌁',accent:'#c29aff',desc:'弹幕更慢，但异常敌群会携带额外护盾。',mods:{speed:1.02,fire:1.12,hp:1.06,reward:1.35,shield:1.2}},
  boss:{label:'Boss 闸门',tag:'BOSS GATE',icon:'◎',accent:'#ffd76a',desc:'终点节点，击破后带回本轮远征。',mods:{speed:1.08,fire:.9,hp:1.32,reward:1.8,boss:true}}
};
var protocolDefs=[
  {id:'hull',name:'装甲冗余',tag:'HULL / 01',desc:'每级为所有出击增加 8 点最大生命，容错更高。',max:6,base:8,cost:function(level){return 6+level*5},accent:'#75ffb2'},
  {id:'reactor',name:'反应堆调谐',tag:'REACTOR / 02',desc:'每级让主炮射击间隔缩短 4%，持续影响整局。',max:6,base:4,cost:function(level){return 7+level*6},accent:'#72f4ff'},
  {id:'salvage',name:'拾荒授权',tag:'SALVAGE / 03',desc:'每级提高 8% 星尘回收量，风险航线更值得冒险。',max:6,base:8,cost:function(level){return 8+level*7},accent:'#ffd76a'},
  {id:'capacitor',name:'电容预充',tag:'CAPACITOR / 04',desc:'每级提高初始护盾 10 点，并让 EMP 多储存 1 次。',max:4,base:10,cost:function(level){return 11+level*9},accent:'#c29aff'}
];
var stationContractDefs=[
  {id:'route-intel',name:'截获航线情报',tag:'ROUTE / INTEL',desc:'完成远征或把路线推进到第 5 波，提交给导航台。',kind:'expedition',view:'routes',target:5,unit:'波',accent:'#72f4ff',reward:{intel:5,shards:2}},
  {id:'salvage-modules',name:'拆解高能缓存',tag:'SALVAGE / MODULE',desc:'在深空打捞中找到 3 个高能缓存，换取机体模块和尾迹雷舱蓝图。',kind:'salvage',view:'salvage',target:3,unit:'个',accent:'#ffd76a',reward:{modules:3,blueprint:'salvage-mine'}},
  {id:'echo-research',name:'复现异常节奏',tag:'ECHO / RESEARCH',desc:'在回声实验室完成 5 轮序列，建立异常样本和光栅切割器蓝图。',kind:'lab',view:'lab',target:5,unit:'轮',accent:'#ffb75c',reward:{research:3,blueprint:'lab-beam'}},
  {id:'relay-intel',name:'稳定城市中继',tag:'RELAY / SIGNAL',desc:'在信号中继累计命中 80 次，解锁猎蜂无人机蓝图。',kind:'relay',view:'signals',target:80,unit:'次',accent:'#ff66c4',reward:{intel:4,shards:2,blueprint:'relay-drone'}},
  {id:'blackbox-research',name:'恢复黑盒链路',tag:'BLACKBOX / RESEARCH',desc:'累计解开 5 层线路，提交观测结果并获得舰站研究。',kind:'blackbox',view:'blackbox',target:5,unit:'层',accent:'#c29aff',reward:{research:4,shards:3}},
  {id:'border-clear',name:'夺回失落站档案',tag:'LOST STATION / TACTICS',desc:'完成一次三舱段小队行动，确认航行数据并提交边境情报。',kind:'border',view:'border',target:1,unit:'次',accent:'#ff8a6b',reward:{intel:4,modules:2,shards:3}}
];
var dailyDirectiveDefs=[
  {id:'daily-expedition',name:'穿越五段航线',tag:'DAILY / EXPEDITION',desc:'完成一局远征，把航线推进到更深处。',kind:'expedition',view:'routes',target:5,unit:'波',accent:'#72f4ff',reward:{intel:2,shards:3}},
  {id:'daily-border',name:'回收失落站档案',tag:'DAILY / TACTICS',desc:'完成一次边境战术行动，把核心档案带回舰站。',kind:'border',view:'border',target:1,unit:'次',accent:'#ff8a6b',reward:{modules:2,shards:3}},
  {id:'daily-relay',name:'清理城市中继',tag:'DAILY / RELAY',desc:'在短促的信号窗口里捕获一批有效节点。',kind:'relay',view:'signals',target:80,unit:'次',accent:'#ff66c4',reward:{intel:2,shards:2}},
  {id:'daily-lab',name:'重播异常节奏',tag:'DAILY / ECHO',desc:'完成记忆序列，把异常节奏写入实验室档案。',kind:'lab',view:'lab',target:9,unit:'轮',accent:'#ffb75c',reward:{research:2,shards:2}},
  {id:'daily-salvage',name:'带回三枚缓存',tag:'DAILY / SALVAGE',desc:'在废舰之间找到高能缓存，并在信标处结算。',kind:'salvage',view:'salvage',target:3,unit:'个',accent:'#75ffb2',reward:{modules:2,shards:2}},
  {id:'daily-blackbox',name:'接通观测链路',tag:'DAILY / BLACKBOX',desc:'连接数层线路，让深渊观测站重新回传。',kind:'blackbox',view:'blackbox',target:5,unit:'层',accent:'#c29aff',reward:{research:2,shards:3}}
];
var stationUpgradeDefs=[
  {id:'navigator',name:'航线预测阵列',tag:'NAV / FORECAST',resource:'intel',cost:4,max:3,accent:'#72f4ff',desc:'每级提高远征星尘回收 5%，让情报真正改变下一次出击。',effect:'reward'},
  {id:'moduleBay',name:'模块仓扩容',tag:'BAY / CAPACITY',resource:'modules',cost:3,max:3,accent:'#ffd76a',desc:'每级增加 2 个战斗背包槽位，重复装备更容易留下来自动融合。',effect:'capacity'},
  {id:'matrixBay',name:'战术矩阵扩展',tag:'MATRIX / SLOT',resource:'modules',cost:4,max:1,accent:'#c29aff',desc:'解锁第六个模组栏位，并把四种专属组件加入战斗掉落与构筑实验台。',effect:'slot'},
  {id:'echoDecoder',name:'异常解析器',tag:'ECHO / CHARGE',resource:'research',cost:3,max:3,accent:'#ffb75c',desc:'每级为下一局预充 1 次 EMP，把实验室研究转成战场应急能力。',effect:'emp'}
];
var signalChannels=[
  {tag:'ROUTE FEED',title:'霓虹雨线',text:'低温雨幕正在冲刷旧城区的信标，标准航道暂时保持稳定。',accent:'#72f4ff'},
  {tag:'BLACK BOX',title:'深渊回声',text:'深渊捷径的回传包出现未知噪声，风险航线可能藏着额外的高阶缓存。',accent:'#c29aff'},
  {tag:'RECOVERY LOG',title:'失联补给舱',text:'回收线已重新开放，拾荒授权与短局中继的奖励会同步计入档案。',accent:'#ffd76a'}
];
/* The command deck is also a small, authored content site. These entries stay
   local and versioned with the build so the station remains useful offline. */
var codexEntries=[
  {type:'world',typeLabel:'WORLD / 00',title:'霓虹突围是什么',tag:'站点总览',accent:'#72f4ff',intro:'一座漂浮在旧城区上空的指挥站，靠回收失控能源维持最后一条航线。',body:'城市被长夜和电磁雨切成互不相连的区块。每次出击都不是单纯清理敌机，而是把一小段可用的信号带回站点。',facts:['主舞台：新伊甸环城带','核心循环：构筑 → 航线 → 战斗 → 带回']},
  {type:'sector',typeLabel:'SECTOR / 01',title:'霓虹雨线',tag:'低温城区',accent:'#72f4ff',intro:'最适合建立第一套构筑的入口航线。',body:'雨幕会把远处的灯牌折射成假信标，侦察机在这里学会了贴着高架轨道俯冲。标准航道的奖励稳定，但不会替你隐藏失误。',facts:['推荐：脉冲猎手','关键词：稳定、补给、首个 Boss']},
  {type:'sector',typeLabel:'SECTOR / 02',title:'深渊断层',tag:'失重裂隙',accent:'#c29aff',intro:'一条把高压和高回报压缩在同一段路上的捷径。',body:'断层内部没有真正的上下，敌群会从屏幕边缘突然改写轨迹。能读懂护盾窗口的指挥官，才能把这里的风险换成成长。',facts:['推荐：棱镜守卫','关键词：高压、穿透、极限奖励']},
  {type:'faction',typeLabel:'FACTION / 03',title:'回收公社',tag:'拾荒者网络',accent:'#ffd76a',intro:'他们不相信英雄，只相信每一件能重新通电的零件。',body:'回收公社维护着废墟带的临时信标，也是“拾荒授权”协议的发起者。你带回的缓存，会在下一轮变成更可靠的起点。',facts:['关系：可交易的盟友','遗留协议：回收许可、失联补给舱']},
  {type:'faction',typeLabel:'FACTION / 04',title:'零相教团',tag:'未知观测者',accent:'#ff718e',intro:'把所有噪声都称作启示的一群人。',body:'零相教团从不直接占领航线，他们只是在 Boss 出现前留下不完整的观测记录。有人说他们在寻找一个能听见城市心跳的机体。',facts:['关系：敌对但可预测','危险：未知观测站、复仇核心']},
  {type:'world',typeLabel:'SYSTEM / 05',title:'星尘经济',tag:'局外成长',accent:'#75ffb2',intro:'每一份带回来的资源，都会在下一次出击里留下痕迹。',body:'星尘不是抽象分数，而是站点的实际供能单位。它能升级装甲、反应堆、回收许可和电容预充，也会提高指挥官档案的等级。',facts:['储存位置：本机档案','消费位置：局外协议、机体解锁']},
  {type:'sector',typeLabel:'SECTOR / 06',title:'废墟回收线',tag:'漂移残骸带',accent:'#75ffb2',intro:'短局打捞和主线远征共享同一片危险的废墟。',body:'这里的路线会不断改变，真正固定的只有“热度会累积”。找到信标、带够回收物，再决定是否撤离，是最接近站点生存哲学的一条线。',facts:['推荐：蜂群协议','关键词：相邻探索、热度、撤离']},
  {type:'world',typeLabel:'SYSTEM / 07',title:'回声协议',tag:'认知训练',accent:'#ffb75c',intro:'不是所有战斗都发生在炮火里。',body:'回声实验室把站点接收到的异常节奏转成可重复的节点序列。每次试炼会打乱四条记忆规则的顺序，序列会随轮次变长；完成阶段后可以接入认知协议，继续冲击两分钟内的最高轮数。',facts:['入口：新伊甸游戏厅 → 回声实验室','规则：正序、逆序、奇偶拆分、首位轮转','奖励：研究、蓝图、局内协议与本机纪录']},
  {type:'faction',typeLabel:'FACTION / 08',title:'漂移舰队',tag:'三种机体',accent:'#ff66c4',intro:'一支没有固定母舰、靠相位跳跃互相照明的幸存者舰队。',body:'脉冲猎手、相位长枪和棱镜守卫都来自漂移舰队的不同设计谱系。它们不是线性升级，而是三种看待航线的方式。',facts:['脉冲猎手：均衡','相位长枪：爆发','棱镜守卫：防御']}
];
var guideEntries=[
  {type:'starter',typeLabel:'STARTER',title:'前 3 波：先活下来再谈伤害',tag:'入门 / 01',accent:'#72f4ff',summary:'把移动、护盾和 EMP 当作同一个资源管理问题。',steps:['站在画面下半区，给自己留下横移空间。','优先处理火力艇与折跃翼，别被远程压制锁死。','EMP 留给弹幕密集的波次，不要为了单个侦察机提前交。']},
  {type:'build',typeLabel:'BUILD',title:'稳定脉冲：新手第一套五槽',tag:'构筑 / 02',accent:'#75ffb2',summary:'脉冲核心 + 追猎导弹舱 + 纳米修复舱 + EMP 电池 + 漂移推进器，容错和节奏最平衡。',steps:['先用脉冲核心建立单发伤害。','追猎导弹舱补足自动追击，重复掉落会自动融合升级。','纳米修复舱让击杀转换成持续生命，再用漂移推进器留出躲弹空间。']},
  {type:'build',typeLabel:'BUILD',title:'时滞穿刺：相位长矛路线',tag:'构筑 / 03',accent:'#c29aff',summary:'相位长矛与引力锚触发“时滞穿刺”，适合直线清理精英。',steps:['武器槽选择相位长矛，战斗中保持纵向射线。','引力锚减速后，穿透弹会获得更长的有效窗口。','遇到重装堡垒时先拆盾，再让穿透收益最大化。']},
  {type:'boss',typeLabel:'BOSS',title:'Boss 护盾窗口怎么打',tag:'战术 / 04',accent:'#ff718e',summary:'Boss 不是血条检查，而是一个“护盾归零后短暂暴露”的节奏题。',steps:['先绕开第一轮固定弹幕，别在护盾还满时交 EMP。','护盾归零后立刻把目标移动到屏幕中线。','窗口关闭前保留一次瞬闪，避免贪最后一发。']},
  {type:'mode',typeLabel:'MODE',title:'深空打捞：按委托改写探索路线',tag:'探索 / 05',accent:'#ffd76a',summary:'三张程序生成的废舰格网由 5×5 扩至 7×7。五类委托会改变舱格分布与撤离目标，找到信标后可带货撤离，也可加热度深入下一层。',steps:['出发前选缓存、数据、重载、遗物或幽灵委托；当前目标和进度显示在格网旁。','只能探索当前位置相邻的未知舱格：危险会加热并消耗氧压，维修舱能补时降热，数据与遗物会直接计入各自目标。','带够 3 件物资并找到信标后，达成委托再撤离有额外奖励；继续深入会重置地图、放大格网并增加热度。']},
  {type:'mode',typeLabel:'MODE',title:'信号中继：把 45 秒做成一场接收构筑',tag:'反应 / 06',accent:'#ff66c4',summary:'三个 15 秒频道逐段加速：青色信号累积连击、金色缓存高分、红色诱饵会中断接收。每次换频停下来选一个新协议。',steps:['青色目标稳定得分，金色缓存分值高但停留时间更短；红色目标应当避开。','每个目标都在随机位置出现；连续捕获提高倍率，错过会断连并扣分。','第 15 与 30 秒切换频道时，从三项协议中选一个：扩大反应窗、提高缓存率、加倍率、加基础信号分或获得一次连击保护。']},
  {type:'mode',typeLabel:'MODE',title:'回声实验室：在两分钟里不断适应新规则',tag:'记忆 / 09',accent:'#ffb75c',summary:'每局随机排列四条记忆规则，序列随轮次增长；第 7 轮开始混入必须忽略的紫色诱饵，第 10 轮切到 4×4 节点。',steps:['观察完整闪光序列，输入顺序由当前规则决定：正序、逆序、奇数位后偶数位，或首位移到末尾。','答错会扣生命并重播本轮；每连续完成三轮就暂停倒计时，让你选择一项认知强化。','没有固定结尾：尽量在 120 秒和有限生命内推进更远，速度、序列长度、诱饵与节点规模都会逐步提高。']},
  {type:'mode',typeLabel:'MODE',title:'黑盒解码：读接口，规划逐层通电',tag:'逻辑 / 10',accent:'#c29aff',summary:'七层程序电路从 5×5 扩至 7×7；输入和输出端每局会旋转到不同边，路线及干扰瓦片重新生成。',steps:['先定位带 IN 与 OUT 标记的边缘瓦片，沿相邻接口推断真正的供电通路。','点击有接口的瓦片顺时针旋转 90°；青色表示已通电。盲目转动干扰瓦片会消耗预算，却不推进目标。','步数耗尽会损失完整性并重置当前线路；通关一层后选择供电、提示、完整性或得分模组，再继续更大的棋盘。']},
  {type:'mode',typeLabel:'MODE',title:'失落站：读预警、分配行动、带队撤离',tag:'战术 / 11',accent:'#ff8a6b',summary:'三人小队按回合推进三个舱段。每名干员每回合有 2 点行动；攻击、移动、治疗和终端互动都要取舍，敌方攻击会在行动前显示落点。',steps:['突击手的震荡弹和工程师脉冲能打断预警；医护兵优先治疗生命比例最低的邻近队员。蓝色格在移动距离内，掩体会减轻所受伤害。','清除敌人并启动全部终端后，第 1、2 舱段可选择补给；最终舱段还要把一名存活干员移动到 ⇧ 撤离格。','每个动作自动写入本机断点档案。返回目录、刷新或关闭页面后，进入失落站点“继续行动”；档案会先校验，坏档会从上一份有效备份恢复。']},
  {type:'economy',typeLabel:'META',title:'六种游戏模式如何一起成长',tag:'站点 / 12',accent:'#75ffb2',summary:'各模式的规则和最高记录彼此独立，但奖励会流入同一份指挥官档案。',steps:['动作远征与边境战术各有完整战役；四种小游戏各自记录成绩。边境战术会带回星尘、情报与模块。','舰桥委托会读取各游戏的实际进度，达标后可领取额外资源或蓝图。','打开作战日志比较关卡、失误、提示与撤离深度，选择下一项需要推进的目标。']},
  {type:'route',typeLabel:'ROUTE',title:'四条航线的选择逻辑',tag:'规划 / 08',accent:'#ffb75c',summary:'不要问哪条最强，先问这一局你需要什么。',steps:['想练习：初始航道。','想冲奖励：霓虹风暴或废墟回收线。','想验证上限：深渊捷径，但要为更早的失误留资源。']}
];
var dispatchEntries=[
  {date:'2026.10.05',tag:'V50 / BREACH PRESSURE',title:'敌机不再悄悄穿过防线',accent:'#ff718e',text:'远征现在会把越过屏幕底部的敌机视为真正的突破：它们会造成冲击、打断连杀并扣除少量分数。进入底线前会显示 BREACH 预警，优先处理高威胁目标终于有了明确代价。',bullets:['越界敌机会按波次、航线压力和接触伤害计算突破冲击，护盾会先承受这次伤害','每次突破会清零当前连杀并扣分；HUD 会显示本波越界次数，方便复盘失误','敌机接近底线时会出现红色 BREACH / 越界标签，不再因为离屏而静默消失']},
  {date:'2026.10.05',tag:'V49 / OVERDRIVE PROTOCOL',title:'连杀现在可以兑现成一次真正的战术决策',accent:'#ffd76a',text:'霓虹突围新增过载协议：击破敌机、精英和 Boss 会积累过载能量。能量满后，你可以把它留给 Boss 护盾窗口，也可以在弹幕失控时主动释放，清除威胁并换取短时火力爆发。',bullets:['普通击破、精英击破和 Boss 击破提供不同额度的过载能量；连杀越高，充能越快','释放过载会清空敌方弹幕与激光，对战场敌群造成范围输出，同时恢复一部分护盾并短暂加速主炮','新增 OVR 按钮与 Q 键快捷键；未充满时不会误消耗，满能量后会有明确的 READY 反馈']},
  {date:'2026.10.05',tag:'V48 / TACTICAL FEEDBACK',title:'战术契约现在会改变接下来的几秒',accent:'#72f4ff',text:'契约不再只是战场角落里的一串进度数字：锁定目标会在目标消失后重新接管威胁，Boss 波的破盾要求和奖励会按实际护盾调整，完成后会立刻给主炮加速、漂移过载或短暂输出窗口。',bullets:['目标被撞毁或离屏后会自动补标新的优先敌人，锁定契约不会因为一次意外清空而卡住','Boss 波的破盾契约目标改为一次，普通波仍要求两次破盾；契约卡与主任务分开展示，手机端更容易读懂','完成契约会触发短时战斗状态：漂移过载提升射速、锁定奖励给主炮加速、破盾奖励给输出窗口']},
  {date:'2026.10.03',tag:'V47 / GAMEPLAY PASS',title:'霓虹突围开始要求你主动做选择',accent:'#ff718e',text:'这一版把远征的核心循环从“拖动躲弹幕并等待自动开火”推进成真正的战术驾驶：拖动方向会改变主炮瞄准，每个波次会给出移动、锁定或破盾契约，标记目标、契约进度和完成奖励都会直接出现在战场上。',bullets:['主炮沿机体当前瞄准方向发射，移动和手指拖动同时承担走位与瞄准；机体会跟随方向转向','每波契约轮换：漂移航线鼓励持续移动，锁定威胁会标记优先目标，破盾窗口要求主动击穿护盾','标记敌人有清晰的 FOCUS 轮廓与标签；契约完成会触发分数、废料、音效和浮动反馈']},
  {date:'2026.10.03',tag:'V46 / SAVE SAFETY',title:'本机档案写入有待提交档与有效备份',accent:'#75ffb2',text:'指挥官档案现在不会直接覆盖唯一一份本机记录：写入会先验证待提交内容，再保留上一份有效档作为备份；主档损坏时会优先回退到可读副本。切到后台时，短局倒计时和中继目标也会暂停，不再趁手机切屏偷偷消耗。',bullets:['旧版直接 JSON 档案仍可读取，首次成功写入后会升级为带修订号的事务记录','#neonDriftProfileV1.pending、主档和备份都会先读回校验；损坏主档不会覆盖有效备份','信号中继、回声实验和深空打捞切到后台时停止倒计时；回到页面后继续当前进度']},
  {date:'2026.10.03',tag:'V45 / ROUTE SAFETY',title:'旧书签会自动回到正确的独立游戏',accent:'#72f4ff',text:'舰站拆分后留下的旧游戏链接现在会被识别并规范到独立游戏路由；同时，损坏或类型错误的本机计数会在读取时归一化，避免下一次结算把资源写成字符串。',bullets:['#station/signals、#station/lab、#station/salvage 和 #station/blackbox 会分别转到对应的独立游戏页','#station/expedition、#station/border 与 #game/bridge 也会自动规范到当前 canonical route','星尘、远征次数和总击破等档案计数会在载入时过滤非法值；原有合法进度不变']},
  {date:'2026.09.23',tag:'V43 / DAILY STATION',title:'每日舰站指令让每次回站都有下一步',accent:'#72f4ff',text:'舰桥任务板现在每天轮换一项本机指令：远征、边境战术、信号中继、回声实验、深空打捞和黑盒解码都会成为当天的明确目标。对应结算会自动累计进度，完成后可领取情报、模块、研究或星尘。',bullets:['每日指令按本地日期稳定轮换，不需要登录、联网或服务器时钟','六种模式的实际结算数据都会回到当天指令；刷新和重复结算不会重复发奖','旧档案打开时自动补齐指令字段；奖励领取写入同一份本机指挥官档案']},
  {date:'2026.09.23',tag:'V41 / LOST STATION',title:'失落站小队战术战役与可恢复档案',accent:'#ff8a6b',text:'游戏厅新增三人小队回合战术战役：分配行动点、读取敌人预警、利用掩体、启动终端并在最终舱段撤离。每个动作都写入校验过的本机断点存档；恢复会优先选最近有效版本，结算奖励按行动编号只发放一次。',bullets:['三个连续舱段包含巡逻、哨戒和指挥机；突击手、医护兵、工程师拥有不同技能','清场后可选择补给，最后要抵达撤离格；三种行动合同改变敌群与奖励','主线战役接入舰桥资源、个人档案、委托与作战日志；旧档迁移到 schema 11','回归检查覆盖断点恢复、坏档保留、敌人追击、最终撤离与结算去重']},
  {date:'2026.09.23',tag:'V40 / COMBAT + BUILD',title:'前期弹幕、Boss 架构与装备成长重做',accent:'#c29aff',text:'前四波降低射手占比、刷新速度和射击频率；Boss 现在会轮换带预警的专属攻击，并把预警方向实际用于弹幕。战术矩阵扩展解锁第六模组槽，Boss 核心缓存必定掉落强化芯片。',bullets:['换装时旧装备进入背包；战斗中打开构筑界面会暂停，可强化装备或背包物品','新增棱镜阵列、磁通线圈、偏转网格、回收链路四种模组组件','小怪更少、更慢地发射弹幕；Boss 血量和护盾略降，阶段攻击种类增加','四个短局归入小游戏合集，仍保留独立页面与独立记录','旧档会迁移到新栏位规则，未解锁模组槽不会吞掉原有五槽构筑']},
  {date:'2026.09.23',tag:'V39 / MODE MASTERY',title:'四款独立玩法获得专属精通',accent:'#75ffb2',text:'短局现在有各自的长期练习目标：中继的捕获时窗、实验室的记忆闪光、打捞氧压与黑盒步数/提示都可以通过该玩法的累计记录解锁。精通只影响所属游戏，出局前可切换，开局后固定。',bullets:['信号中继：12 次拦截解锁宽频捕获；40 次解锁缓存共振','回声实验室：9 轮回想解锁延展闪忆；28 轮解锁备用生命','深空打捞：6 个样本解锁危险缓冲；20 个样本解锁备用氧瓶','黑盒解码：4 层连通解锁额外步数；15 层解锁免费提示','四款游戏拥有独立命中、错误、缓存、遗物、线路和通关视听反馈；无障碍减少动态效果仍有效']},
  {date:'2026.09.23',tag:'V38 / ARCADE DEPTH',title:'四款独立玩法摆脱固定关卡',accent:'#ffd76a',text:'中继、实验室、打捞和黑盒各自拥有不同的操作循环、局内选择与可复玩内容。程序生成现在会改变打捞舱格分布和黑盒终端方向；实验室每局重排规则，中继在频道切换时构筑。',bullets:['中继：三阶段反应赛，捕获不同信号、控连击并选择接收协议','实验室：两分钟无尽试炼，四种规则随机编排，阶段间选择认知强化','打捞：五种委托改写目标，5×5→7×7 三层探索逐层加压，撤离锁货或冒险深入','黑盒：七层随机线路，输入/输出端轮换方向，解层后选择系统模组','编年史保存委托、规则顺序、强化选择、提示数、数据与遗物；旧档案升级至 schema 8']},
  {date:'2026.09.23',tag:'V37 / INDEPENDENT GAME ROUTES',title:'五款游戏与舰站内容正式拆开',accent:'#72f4ff',text:'新伊甸游戏厅现在是独立站点入口。五款游戏各自有独立路由和全屏页面，舰桥资料与成长系统归到单独的站点区；进入、返回、刷新和浏览器前进后退都会恢复到对应区域。',bullets:['霓虹突围获得独立开场页，战斗中可暂停并放弃返回游戏目录','信号中继、回声实验室、深空打捞和黑盒解码已移出舰桥 DOM','舰桥侧栏不再把其他游戏作为它的附属子菜单','站点动态继续通过公告悬浮窗查看','活动任务板会直接跳转到独立游戏页；切换区域时清理计时器与未结算战斗']},
  {date:'2026.09.23',tag:'V36 / FIVE DISTINCT GAMES',title:'新伊甸游戏厅扩成五款独立游戏',accent:'#c29aff',text:'大厅现在提供五种各自成立的玩法：动作射击、信号拦截、记忆战役、格网打捞和电路解码。后三款老玩法也从一次失误即结束的短局扩成有阶段、决策和通关目标的完整循环。',bullets:['信号中继：45 秒三个阶段，捕获缓存、识别诱饵并维持连击','回声实验室：九轮三阶段记忆战役，倒序规则、诱饵和生命容错','深空打捞：三艘废舰逐层探索，可带货撤离或继续深入','新增黑盒解码：旋转 5×5 电路瓦片，完成五层线路谜题','五款游戏各自保存纪录，同时共享星尘、舰站研究、委托与作战日志']},
  {date:'2026.09.22',tag:'V35 / NEON ARCADE',title:'新伊甸游戏厅上线：三款玩法正式分层',accent:'#72f4ff',text:'Neon Drift 现在先从游戏大厅开始，再进入每一款独立子游戏。远征、信号中继和回声实验室各自拥有清晰的目标与节奏，同时共享同一份指挥官档案。',bullets:['打开站点先进入 Neon Arcade，三款真实可玩的入口不再和舰桥内容混在一起','完成任意小游戏后，远征次数、短局最高分、星尘、蓝图与作战日志继续互相回流','大厅为后续打捞、编队与黑箱破解预留真实扩展位，不把未完成玩法伪装上线']},
  {date:'2026.09.22',tag:'V34 / CONNECTED BUILDS',title:'蓝图进度可见，分支行为真的会连锁',accent:'#75ffb2',text:'构筑实验台现在会直接显示三个短局的蓝图进度；电弧分支也从“标签说明”变成可连续跳跃的真实链式攻击。旧档案启动时会自动补发已经达标的蓝图。',bullets:['信号中继、回声实验室和深空打捞各自对应一件副武器蓝图','每个蓝图卡显示来源、进度、掉落池状态，并可直接跳回对应短局','导流节点与雷暴分流会按剩余跳数寻找未命中的目标，避免分支只改变文案']},
  {date:'2026.09.22',tag:'V33 / BUILD IDENTITY',title:'构筑开始拥有分支，短局开始解锁战斗内容',accent:'#ffb75c',text:'本轮把“升级”从数值替换推进成行为选择：主武器满级重复掉落会进入分支选择，副武器新增追踪蜂机、光栅切割器和尾迹雷舱；信号中继、回声实验室和深空打捞会分别解锁它们的蓝图。',bullets:['主武器保持单槽，重复融合后选择新的行为分支','三个短局的成绩会扩展主战斗掉落池，而不只是增加通用资源','构筑标签会进入实验台、战斗 HUD 和掉落比较，手机端优先保留触控空间']},
  {date:'2026.09.21',tag:'V31 / COMBAT SLICE',title:'主副武器与敌群行为开始分流',accent:'#75ffb2',text:'升级不再把主武器当成唯一答案：主武器现在低频出现，副武器拥有独立成长和清晰弹道，组件卡会优先推动联动。战场新增护卫载体，Boss 阶段切换也会明确广播。',bullets:['重复装备继续自动融合，主武器掉落从每次替换改为偶发选择','追猎导弹、裂阵散射与五种主武器使用不同弹道表现','护卫载体半血部署两架护卫，Boss PHASE 2 / 3 会触发可见反馈']},
  {date:'2026.09.20',tag:'V30 / STATION LOOP',title:'跨模块委托与舰站升级上线',accent:'#72f4ff',text:'远征、短局和实验不再各自结算后结束：它们会把情报、模块和研究带回舰桥，转化为航线回报、背包容量和战场应急能力。公告现在作为全站悬浮窗打开。',bullets:['舰桥委托把四种活动串成同一条回流路径','舰站升级：航线预测、模块仓扩容、异常解析器','主武器重复掉落自动融合，副武器保留独立火力与成长']},
  {date:'2026.09.18',tag:'V25 / COMBAT READABILITY',title:'战斗开始说清楚：预警、破盾与命中反馈',accent:'#ff718e',text:'敌人的攻击不再只靠一张斜着的贴图和突然出现的弹幕来表达。开火、Boss 锁定和冲刺会提前给出方向与目标，伤害、护盾和破盾窗口会在战场上留下即时反馈。',bullets:['普通敌群与 Boss 都拥有可见的攻击前摇','浮动伤害数字区分舰体与护盾，破盾会触发高亮反馈','信号中继、回声实验室和深空打捞统一清理自己的计时器']},
  {date:'2026.09.16',tag:'V21 / STAR MAP',title:'星图上线：每次远征都有可复盘的路线',accent:'#ffd76a',text:'航线页现在会为本局生成一枚确定性的 runSeed，并把五段节点、风险和奖励计划展示出来。路线选择第一次真正影响到远征中的敌群、事件、修复和掉落门槛。',bullets:['四条星区航线共用五段分岔星图','相同种子会生成相同节点组合，可在日志里复盘','节点修饰会进入战斗：精英、回收、异常、修复与信号站']},
  {date:'2026.09.16',tag:'V20 / CONTENT HUB',title:'指挥站扩容：从小游戏到可探索站点',accent:'#72f4ff',text:'本次更新把舰桥拆成四类入口：世界观、攻略、构筑实验台和站点动态。它们与远征、短局和日志共享同一份本机档案。',bullets:['新增 8 条世界观资料与 8 篇可执行攻略','新增理论构筑模拟，不会改写当前实战装备','新增发布动态与验证边界，内容版本可追踪']},
  {date:'2026.09.16',tag:'VERIFIED',title:'移动端验收完成',accent:'#75ffb2',text:'320px 窄屏、390px 手机和桌面宽屏均通过溢出检查。导航在窄屏改为横向滚动，资料卡和构筑控件保留可触达尺寸。',bullets:['保留浏览器缩放，不锁定用户视口','内容筛选、导航与预设按钮均可键盘聚焦','短局运行时切换内容页会安全停止计时']},
  {date:'2026.09.15',tag:'V19 / PLAYABLE',title:'深空打捞与构筑预设上线',accent:'#ffd76a',text:'站点新增相邻格网打捞、三套构筑预设和任务板，让每次回到舰桥都有下一步可做。',bullets:['打捞支持信标、缓存、热度与撤离结算','预设保存稀有度和等级，写入本机 localStorage','日志统一收纳远征、中继、打捞和实验记录']},
  {date:'2026.09.14',tag:'DESIGN NOTE',title:'为什么站点仍然离线可用',accent:'#c29aff',text:'Neon Drift 的核心体验是“打开就能玩、玩完看得见成长”。当前版本刻意不接账号、云同步或虚构排行榜，避免把尚未实现的服务伪装成内容。',bullets:['所有档案保存在当前浏览器的本机空间','没有跨设备同步与多人榜单','后续扩展会先在动态页标注边界，再决定是否接入服务']},
  {date:'2026.09.13',tag:'WORLD SIGNAL',title:'零相教团的观测包仍未解密',accent:'#ff718e',text:'深渊断层的黑盒回传出现一组重复节拍。回声实验室可以复现其中一部分，但尚未确认它是否来自新的 Boss。',bullets:['现阶段可在实验室练习节奏','图鉴中的四种 Boss 仍是已验证敌对谱系','未知内容不会以锁死按钮的方式伪装上线']}
];
dispatchEntries=dispatchEntries.slice(0,23);
var contentFilters={codex:[['all','全部'],['world','世界'],['sector','星区'],['faction','势力']],guides:[['all','全部'],['starter','入门'],['build','构筑'],['boss','Boss'],['mode','短局'],['economy','局外'],['route','航线']]};
var contentState={codex:'all',guides:'all'};
var hubViewMeta={
  bridge:{title:'舰桥',intro:'选择机体，规划航线，把每一次出击变成下一次突破的筹码。'},
  armory:{title:'机库与构筑',intro:'先决定你想怎么赢，再把装备放进正确的槽位。'},
  routes:{title:'航线图',intro:'高奖励航线会带来更快的成长，也会把危险提前。'},
  codex:{title:'星区资料库',intro:'把一局游戏放回更大的世界里：城市、势力与废墟都在这里留下了自己的回声。'},
  archive:{title:'威胁图鉴',intro:'先读懂敌人的行为，再决定你的武器流派。'},
  guides:{title:'指挥官攻略',intro:'把站点里的真实系统写成短而具体的打法笔记。'},
  workbench:{title:'构筑实验台',intro:'先在理论面板里试错，再把满意的方案复制到预设。'},
  protocols:{title:'局外协议',intro:'把带回的星尘投入舰队系统，每次出击都能从更高的起点开始。'},
  challenges:{title:'挑战与解锁',intro:'局内表现会转化成局外资源，逐步打开新的出击方式。'},
  signals:{title:'信号台',intro:'不需要出击许可，接入城市中继，完成一轮短促的信号捕获。'},
  salvage:{title:'深空打捞',intro:'在三层废舰里判断路线、收集缓存，在信标处决定撤离还是继续下注。'},
  chronicle:{title:'作战日志',intro:'六种游戏模式的远征、战术、拦截、试炼、打捞与解码记录都在这里汇合。'},
  lab:{title:'回声实验室',intro:'在两分钟内挑战无尽记忆序列，适应随机规则、紫色诱饵与阶段强化。'},
  blackbox:{title:'黑盒解码',intro:'沿随机生成的 5×5 至 7×7 电路逐层通电；每局输入/输出端方位不同，并可选择线路模组。'},
  dispatch:{title:'站点动态',intro:'版本更新、已验证边界与世界内的频道广播，集中放在一条可追踪的时间线上。'}
};
var profileStorageKeys={main:'neonDriftProfileV1',pending:'neonDriftProfileV1.pending',backup:'neonDriftProfileV1.backup'};
var profileRevision=0,profileRecovered=false,profileStorageState='memory';
function decodeProfileRecord(raw,rank){
  if(typeof raw!=='string'||!raw)return null;
  try{
    var parsed=JSON.parse(raw);
    if(parsed&&parsed.kind==='neon-drift-profile'&&parsed.schema===1&&parsed.profile&&typeof parsed.profile==='object')return {profile:parsed.profile,revision:Math.max(0,Math.floor(Number(parsed.revision)||0)),savedAt:Number(parsed.savedAt)||0,rank:rank};
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return {profile:parsed,revision:0,savedAt:0,rank:rank,legacy:true};
  }catch(e){}
  return null;
}
function readProfileRecord(){
  var records=[];
  try{[profileStorageKeys.main,profileStorageKeys.backup,profileStorageKeys.pending].forEach(function(key,index){var record=decodeProfileRecord(localStorage.getItem(key),index);if(record)records.push(record);});}catch(e){profileStorageState='unavailable';}
  records.sort(function(a,b){return b.revision-a.revision||a.rank-b.rank;});
  var best=records[0]||null;if(best){profileRevision=best.revision;profileRecovered=best.rank!==0;profileStorageState=best.legacy?'legacy':'loaded';}return best;
}
var profile={schemaVersion:11,shards:0,runs:0,totalKills:0,bestCombo:0,relayBest:0,relayRuns:0,relayHits:0,relayClears:0,labBest:0,labRuns:0,labSolved:0,labClears:0,labBestStage:0,salvageBest:0,salvageRuns:0,salvageCollected:0,salvageCaches:0,salvageDepthBest:0,salvageData:0,salvageRelics:0,salvageContractClears:0,salvageContract:'cache',blackboxBest:0,blackboxRuns:0,blackboxLocks:0,blackboxClears:0,borderTactics:{runs:0,clears:0,bestScore:0,totalKills:0,deepestSector:0,settledRuns:[]},arcadeMastery:{relay:null,lab:null,salvage:null,blackbox:null},blueprints:[],presets:[null,null,null],activeLoadout:null,history:[],protocols:{hull:0,reactor:0,salvage:0,capacitor:0},station:{intel:0,modules:0,research:0,claimed:{}},dailyDirective:{date:'',id:'',value:0,claimed:false},unlockedShips:['pulse'],selectedShip:'pulse',selectedRoute:'standard',pendingSeed:null,lastRunSeed:null,routePlan:null};
var savedProfileRecord=readProfileRecord();
if(savedProfileRecord)Object.assign(profile,savedProfileRecord.profile);
var loadedProfileSchemaVersion=Math.max(0,Number(profile.schemaVersion)||0);
['shards','runs','totalKills'].forEach(function(key){profile[key]=Math.max(0,Math.floor(Number(profile[key])||0));});
if(!Array.isArray(profile.unlockedShips))profile.unlockedShips=['pulse'];
profile.unlockedShips=profile.unlockedShips.filter(function(id){return shipBlueprints.some(function(bp){return bp.id===id;});});
if(profile.unlockedShips.indexOf('pulse')<0)profile.unlockedShips.unshift('pulse');
if(!shipBlueprints.some(function(bp){return bp.id===profile.selectedShip;}))profile.selectedShip='pulse';
if(!routeDefs.some(function(route){return route.id===profile.selectedRoute;}))profile.selectedRoute='standard';
if(!profile.protocols||typeof profile.protocols!=='object')profile.protocols={};
protocolDefs.forEach(function(def){profile.protocols[def.id]=clamp(Number(profile.protocols[def.id])||0,0,def.max);});
profile.bestCombo=Math.max(0,Math.floor(Number(profile.bestCombo)||0));
profile.relayBest=Math.max(0,Math.floor(Number(profile.relayBest)||0));
profile.relayRuns=Math.max(0,Math.floor(Number(profile.relayRuns)||0));
profile.relayHits=Math.max(0,Math.floor(Number(profile.relayHits)||0));
profile.relayClears=Math.max(0,Math.floor(Number(profile.relayClears)||0));
profile.labBest=Math.max(0,Math.floor(Number(profile.labBest)||0));
profile.labRuns=Math.max(0,Math.floor(Number(profile.labRuns)||0));
profile.labSolved=Math.max(0,Math.floor(Number(profile.labSolved)||0));
profile.labClears=Math.max(0,Math.floor(Number(profile.labClears)||0));
profile.labBestStage=Math.max(0,Math.floor(Number(profile.labBestStage)||0));
profile.schemaVersion=11;
profile.salvageBest=Math.max(0,Math.floor(Number(profile.salvageBest)||0));
profile.salvageRuns=Math.max(0,Math.floor(Number(profile.salvageRuns)||0));
profile.salvageCollected=Math.max(0,Math.floor(Number(profile.salvageCollected)||0));
profile.salvageCaches=Math.max(0,Math.floor(Number(profile.salvageCaches)||0));
profile.salvageDepthBest=Math.max(0,Math.floor(Number(profile.salvageDepthBest)||0));
profile.salvageData=Math.max(0,Math.floor(Number(profile.salvageData)||0));profile.salvageRelics=Math.max(0,Math.floor(Number(profile.salvageRelics)||0));profile.salvageContractClears=Math.max(0,Math.floor(Number(profile.salvageContractClears)||0));
if(!['cache','data','cargo','relic','ghost'].includes(profile.salvageContract))profile.salvageContract='cache';
profile.blackboxBest=Math.max(0,Math.floor(Number(profile.blackboxBest)||0));
profile.blackboxRuns=Math.max(0,Math.floor(Number(profile.blackboxRuns)||0));
profile.blackboxLocks=Math.max(0,Math.floor(Number(profile.blackboxLocks)||0));
profile.blackboxClears=Math.max(0,Math.floor(Number(profile.blackboxClears)||0));
if(!profile.borderTactics||typeof profile.borderTactics!=='object'||Array.isArray(profile.borderTactics))profile.borderTactics={};
['runs','clears','bestScore','totalKills','deepestSector'].forEach(function(key){profile.borderTactics[key]=Math.max(0,Math.floor(Number(profile.borderTactics[key])||0));});
if(!Array.isArray(profile.borderTactics.settledRuns))profile.borderTactics.settledRuns=[];
profile.borderTactics.settledRuns=profile.borderTactics.settledRuns.filter(function(id){return typeof id==='string'&&id.length<=80;}).slice(-48);
if(!Array.isArray(profile.presets))profile.presets=[];profile.presets=profile.presets.slice(0,3);while(profile.presets.length<3)profile.presets.push(null);
if(!Array.isArray(profile.blueprints))profile.blueprints=[];
profile.blueprints=profile.blueprints.filter(function(id){return blueprintDefs.some(function(def){return def.id===id;});});
if(!profile.activeLoadout||typeof profile.activeLoadout!=='object')profile.activeLoadout=null;
if(!Array.isArray(profile.history))profile.history=[];profile.history=profile.history.filter(function(entry){return entry&&typeof entry==='object';}).slice(0,18);
if(typeof profile.pendingSeed!=='string'||!profile.pendingSeed)profile.pendingSeed=null;
if(typeof profile.lastRunSeed!=='string')profile.lastRunSeed=null;
if(!profile.routePlan||typeof profile.routePlan!=='object')profile.routePlan=null;
if(!profile.station||typeof profile.station!=='object')profile.station={};
profile.station.intel=Math.max(0,Math.floor(Number(profile.station.intel)||0));
profile.station.modules=Math.max(0,Math.floor(Number(profile.station.modules)||0));
profile.station.research=Math.max(0,Math.floor(Number(profile.station.research)||0));
if(!profile.station.claimed||typeof profile.station.claimed!=='object')profile.station.claimed={};
if(!profile.station.upgrades||typeof profile.station.upgrades!=='object')profile.station.upgrades={};
stationUpgradeDefs.forEach(function(def){profile.station.upgrades[def.id]=clamp(Number(profile.station.upgrades[def.id])||0,0,def.max);});
if(!profile.dailyDirective||typeof profile.dailyDirective!=='object'||Array.isArray(profile.dailyDirective))profile.dailyDirective={date:'',id:'',value:0,claimed:false};
if(typeof profile.dailyDirective.date!=='string')profile.dailyDirective.date='';
if(typeof profile.dailyDirective.id!=='string')profile.dailyDirective.id='';
profile.dailyDirective.value=Math.max(0,Math.floor(Number(profile.dailyDirective.value)||0));
profile.dailyDirective.claimed=!!profile.dailyDirective.claimed;
var dailyDirectiveChanged=ensureDailyDirective();
function saveProfile(){
  var next={kind:'neon-drift-profile',schema:1,revision:profileRevision+1,savedAt:Date.now(),profile:profile},payload;
  try{
    payload=JSON.stringify(next);localStorage.setItem(profileStorageKeys.pending,payload);
    if(localStorage.getItem(profileStorageKeys.pending)!==payload)throw new Error('pending profile write mismatch');
    var previous=localStorage.getItem(profileStorageKeys.main),previousRecord=decodeProfileRecord(previous,0);
    if(previousRecord){localStorage.setItem(profileStorageKeys.backup,previous);if(localStorage.getItem(profileStorageKeys.backup)!==previous)throw new Error('profile backup write mismatch');}
    localStorage.setItem(profileStorageKeys.main,payload);if(localStorage.getItem(profileStorageKeys.main)!==payload)throw new Error('profile write mismatch');
    localStorage.removeItem(profileStorageKeys.pending);profileRevision=next.revision;profileStorageState='saved';return true;
  }catch(e){profileStorageState='degraded';return false;}
}
function blueprintDef(id){return blueprintDefs.find(function(def){return def.id===id;})||null;}
function hasBlueprint(id){return !!(id&&Array.isArray(profile.blueprints)&&profile.blueprints.indexOf(id)>=0);}
function isItemUnlocked(def){return !def||((!def.unlockId||hasBlueprint(def.unlockId))&&isSlotUnlocked(def.slot));}
function unlockBlueprint(id,quiet){
  var def=blueprintDef(id);if(!def)return false;
  if(!Array.isArray(profile.blueprints))profile.blueprints=[];
  if(profile.blueprints.indexOf(id)>=0)return false;
  profile.blueprints.push(id);saveProfile();
  if(!quiet)toast('蓝图解锁 · '+def.name);
  return true;
}
function syncBlueprintUnlocks(quiet){
  var checks=[
    {id:'relay-drone',value:profile.relayHits||0},
    {id:'lab-beam',value:profile.labSolved||0},
    {id:'salvage-mine',value:profile.salvageCaches||0}
  ];
  var unlocked=[];checks.forEach(function(check){var def=blueprintDef(check.id);if(def&&check.value>=def.target&&unlockBlueprint(check.id,true))unlocked.push(def.name);});
  if(unlocked.length&&!quiet)toast('新蓝图可用 · '+unlocked.join(' / '));
  return unlocked;
}
function blueprintProgress(def){
  if(!def)return 0;
  if(def.id==='relay-drone')return Math.max(0,Math.floor(Number(profile.relayHits)||0));
  if(def.id==='lab-beam')return Math.max(0,Math.floor(Number(profile.labSolved)||0));
  if(def.id==='salvage-mine')return Math.max(0,Math.floor(Number(profile.salvageCaches)||0));
  return 0;
}
syncBlueprintUnlocks(true);
function stationResource(name){return Math.max(0,Math.floor(Number(profile.station&&profile.station[name])||0));}
function stationUpgradeLevel(id){return Math.max(0,Math.floor(Number(profile.station&&profile.station.upgrades&&profile.station.upgrades[id])||0));}
function isSlotUnlocked(slot){return slot!=='augment'||stationUpgradeLevel('matrixBay')>0;}
function inventoryCapacity(){return 12+stationUpgradeLevel('moduleBay')*2;}
function grantStationReward(reward){
  reward=reward||{};if(!profile.station)profile.station={intel:0,modules:0,research:0,claimed:{}};
  var labels=[];
  ['intel','modules','research'].forEach(function(key){var amount=Math.max(0,Math.floor(Number(reward[key])||0));if(amount){profile.station[key]=(Number(profile.station[key])||0)+amount;labels.push((key==='intel'?'情报':key==='modules'?'模块':'研究')+' +'+amount);}});
  if(reward.shards){var shards=Math.max(0,Math.floor(Number(reward.shards)||0));profile.shards+=shards;labels.push('星尘 +'+shards);}
  if(reward.blueprint&&unlockBlueprint(reward.blueprint,true)){var blueprint=blueprintDef(reward.blueprint);labels.push('蓝图 · '+blueprint.name);}
  saveProfile();return labels.join(' · ');
}
function grantActivityReward(kind,metrics){
  metrics=metrics||{};var reward={};
  if(kind==='expedition'){reward.intel=Math.max(1,Math.floor((metrics.wave||0)/4));if((metrics.bosses||0)>0)reward.modules=1;}
  if(kind==='relay')reward.intel=Math.max(1,Math.floor((metrics.hits||0)/25));
  if(kind==='salvage')reward.modules=Math.max(1,Math.floor(metrics.caches||0)+(metrics.collected>=5?1:0));
  if(kind==='lab')reward.research=Math.max(1,Math.floor((metrics.solved||0)/2));
  if(kind==='blackbox')reward.research=Math.max(1,Math.floor((metrics.locks||0)/2)+(metrics.cleared?2:0));
  return grantStationReward(reward);
}
function stationContractProgress(def){
  if(!def)return 0;
  if(def.kind==='expedition')return Math.max(0,Math.floor(bestWave||0));
  if(def.kind==='relay')return Math.max(0,Math.floor(profile.relayHits||0));
  if(def.kind==='salvage')return Math.max(0,Math.floor(profile.salvageCaches||0));
  if(def.kind==='lab')return Math.max(0,Math.floor(profile.labSolved||0));
  if(def.kind==='blackbox')return Math.max(0,Math.floor(profile.blackboxClears||0));
  if(def.kind==='border')return Math.max(0,Math.floor(profile.borderTactics&&profile.borderTactics.clears||0));
  return 0;
}
function claimStationContract(id){
  var def=stationContractDefs.find(function(item){return item.id===id;});if(!def)return false;
  if(profile.station.claimed[id]){toast('委托已领取');return false;}
  if(stationContractProgress(def)<def.target){toast('委托尚未完成');return false;}
  profile.station.claimed[id]=true;var reward=grantStationReward(def.reward);renderHubBridge();renderHubSignals();renderHubProtocols();toast(def.name+' · '+reward);beep(1040,.08,.03);return true;
}
function stationRewardLabel(reward){
  reward=reward||{};var labels=[];if(reward.intel)labels.push('情报 +'+reward.intel);if(reward.modules)labels.push('模块 +'+reward.modules);if(reward.research)labels.push('研究 +'+reward.research);if(reward.shards)labels.push('星尘 +'+reward.shards);return labels.join(' · ');
}
function dailyDirectiveDateKey(value){
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  var date=value instanceof Date?value:new Date();if(!date||!Number.isFinite(date.getTime()))date=new Date();
  return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function dailyDirectiveForDate(date){
  if(!dailyDirectiveDefs.length)return null;
  var parts=String(date).split('-').map(Number),stamp=Date.UTC(parts[0],(parts[1]||1)-1,parts[2]||1),day=Math.floor(stamp/86400000),index=((day%dailyDirectiveDefs.length)+dailyDirectiveDefs.length)%dailyDirectiveDefs.length;
  return dailyDirectiveDefs[index];
}
function dailyDirectiveById(id){return dailyDirectiveDefs.find(function(def){return def.id===id;})||null;}
function ensureDailyDirective(value){
  var date=dailyDirectiveDateKey(value),def=dailyDirectiveForDate(date),current=profile.dailyDirective||{};
  if(!def)return false;
  var changed=current.date!==date||current.id!==def.id||!Number.isFinite(Number(current.value));
  if(changed){profile.dailyDirective={date:date,id:def.id,value:0,claimed:false};return true;}
  var capped=clamp(Math.floor(Number(current.value)||0),0,def.target);if(capped!==current.value){current.value=capped;changed=true;}
  current.claimed=!!current.claimed;return changed;
}
function advanceDailyDirective(kind,amount,day){
  ensureDailyDirective(day);var current=profile.dailyDirective||{},def=dailyDirectiveById(current.id);if(!def||def.kind!==kind||current.claimed)return false;
  var next=clamp(Math.floor(Number(current.value)||0)+Math.max(0,Math.floor(Number(amount)||0)),0,def.target);if(next===current.value)return false;current.value=next;return true;
}
function claimDailyDirective(day){
  var hasExplicitDate=typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)||day instanceof Date;
  ensureDailyDirective(day);var current=profile.dailyDirective||{},def=dailyDirectiveById(current.id);if(!def)return false;
  if(current.claimed){toast('今日指令已领取');return false;}
  if(current.value<def.target){toast('今日指令尚未完成');return false;}
  current.claimed=true;var reward=grantStationReward(def.reward);renderHubBridge(hasExplicitDate?{refreshDaily:false}:null);renderHubSignals();renderHubProtocols();renderArcadeLanding();toast(def.name+' · '+reward);beep(1040,.08,.03);return true;
}
function buyStationUpgrade(id){
  var def=stationUpgradeDefs.find(function(item){return item.id===id;});if(!def)return false;
  var level=stationUpgradeLevel(id);if(level>=def.max){toast('站点升级已达上限');return false;}
  var balance=stationResource(def.resource);if(balance<def.cost){toast('资源不足 · 需要 '+def.cost+' '+(def.resource==='intel'?'情报':def.resource==='modules'?'模块':'研究'));return false;}
  profile.station[def.resource]=balance-def.cost;profile.station.upgrades[id]=level+1;saveProfile();resetRun();renderHubBridge();renderHubArmory();renderHubProtocols();toast(def.name+' · LV '+(level+1));beep(980,.08,.035);return true;
}
function selectedBlueprint(){return shipBlueprints.find(function(def){return def.id===profile.selectedShip;})||shipBlueprints[0];}
function selectedRoute(){return routeDefs.find(function(def){return def.id===profile.selectedRoute;})||routeDefs[0];}
function syncUnlocks(){
  if(bestWave>=3&&profile.unlockedShips.indexOf('lancer')<0)profile.unlockedShips.push('lancer');
  if(profile.shards>=15&&profile.unlockedShips.indexOf('warden')<0)profile.unlockedShips.push('warden');
  if(profile.unlockedShips.indexOf(profile.selectedShip)<0)profile.selectedShip='pulse';
  saveProfile();
}
function applyBlueprint(resetHp){
  var bp=selectedBlueprint(),m=bp.mods;
  ship.damage+=m.damage;ship.fireRate*=m.fireRate;ship.maxHp*=m.maxHp;ship.shield*=m.shield;ship.moveLerp*=m.moveLerp;
  if(resetHp)ship.hp=ship.maxHp;
  if(bp.id==='lancer')ship.pierce+=1;
}
function applyMetaProtocols(){
  var p=profile.protocols||{};
  ship.maxHp+=Number(p.hull||0)*8;
  ship.fireRate*=Math.pow(.96,Number(p.reactor||0));
  ship.shield+=Number(p.capacitor||0)*10;
  traits.empMax+=Number(p.capacitor||0)+stationUpgradeLevel('echoDecoder');
  traits.empCharges=traits.empMax;
  g.metaRewardBonus=(1+Number(p.salvage||0)*.08)*(1+stationUpgradeLevel('navigator')*.05);
}
var g={
  running:false,paused:false,choosing:false,eventActive:false,pendingEvent:false,modalPaused:false,last:0,raf:0,
  score:0,kills:0,wave:1,level:1,xp:0,xpNeed:80,levelQueue:0,
  waveKills:0,waveTarget:10,waveBreaches:0,breaches:0,spawnTimer:.55,elapsed:0,nextUid:1,combo:0,comboTimer:0,comboBest:0,overdrive:0,
  boss:null,bossDefeated:0,scrap:0,upgradeKits:0,empCooldown:0,mineTimer:4,lootRerolls:0,
  missionTarget:15,missionKills:0,missionDone:false,missionReward:850,nextMissionWave:0,eliteKills:0,
  waveMod:waveMods[0],mutation:null,contract:null,contractHasteTimer:0,breakWindow:0,route:routeDefs[0],routeMod:routeDefs[0].mods,routeMap:null,routePlan:[],runSeed:'',routeNodeStage:-1,nodeMod:{speed:1,fire:1,hp:1,reward:1},nodeRewardMultiplier:1,nodeLootFloor:null,equipment:{},inventory:[],pendingLoot:[],pendingLootFloor:null,nextLootFloor:null,pendingFusion:null,rewarded:false
};
var W=0,H=0,dpr=1,pointer=false,audio=null;
var stars=[],enemies=[],bullets=[],enemyBullets=[],drops=[],particles=[],mines=[],lasers=[],chainFx=[],impactFx=[],damageTexts=[];
var screenFx={shake:0,flash:0};
var soundOn=true;
try{soundOn=localStorage.getItem('neonDriftRogueSoundV2')!=='off';}catch(e){}
var bestScore=0,bestWave=0;
try{bestScore=+localStorage.getItem('neonDriftRogueBestScoreV2')||0;bestWave=+localStorage.getItem('neonDriftRogueBestWaveV2')||0;}catch(e){}
var relay={running:false,phase:'idle',score:0,hits:0,misses:0,streak:0,timeLeft:45,stage:1,interval:0,targetTimer:0,target:null,seed:'',offers:[],upgrades:[],windowBonus:0,cacheBonus:0,scoreMult:1,signalBonus:0,streakGuard:0,guardUsed:false,masteryId:null};
var lab={running:false,phase:'idle',sequence:[],displaySequence:[],inputSequence:[],inputIndex:0,round:0,stage:1,size:9,rule:'forward',ruleOrder:[],seed:'',offers:[],perks:[],scoreMult:1,flashBonus:0,lives:3,timeLeft:120,flashIndex:-1,flashType:'signal',sequenceTimer:0,clock:0,token:0,solved:0,mistakes:0,masteryId:null};
var salvage={running:false,phase:'idle',board:[],revealed:[],nodes:[],size:5,start:12,player:12,score:0,collected:0,caches:0,data:0,relics:0,heat:0,steps:0,timeLeft:60,sector:1,clock:0,best:0,token:0,seed:'',contract:'cache',masteryId:null,masteryGuard:0,masteryTimeBonus:0};
var blackbox={running:false,phase:'idle',board:null,score:0,stage:1,maxStage:7,integrity:3,locks:0,hints:0,hintDebt:0,attempt:0,seed:'',hintedIndex:-1,clock:0,flashTimer:0,offers:[],upgrades:[],movesBonus:0,scoreMult:1,freeHints:0,masteryId:null};
salvage.contract=profile.salvageContract;
var relayRuntime=window.NeonRuntime.create('relay'),labRuntime=window.NeonRuntime.create('lab'),salvageRuntime=window.NeonRuntime.create('salvage'),blackboxRuntime=window.NeonRuntime.create('blackbox');
var arcadeGen=window.NeonArcade;
var relayUpgradeDefs=[
  {id:'wideband',name:'宽频接收器',desc:'每个信号节点多停留 260 毫秒。',accent:'#72f4ff'},
  {id:'cache',name:'缓存雷达',desc:'金色缓存出现率提高 8%。',accent:'#ffd76a'},
  {id:'combo',name:'连击稳压器',desc:'连击分数提高 18%，诱饵惩罚不变。',accent:'#ff66c4'},
  {id:'amplifier',name:'载波放大器',desc:'每次普通信号额外 +5 分。',accent:'#75ffb2'},
  {id:'guard',name:'隔离防火墙',desc:'下一次误触或漏接不会打断连击。',accent:'#c29aff'}
];
var labPerkDefs=[
  {id:'lens',name:'慢帧镜片',desc:'节点闪光时间延长 75 毫秒。',accent:'#ffb75c'},
  {id:'buffer',name:'记忆缓存',desc:'立即获得 1 颗容错生命（最多 5 颗）。',accent:'#75ffb2'},
  {id:'scorer',name:'高频评分核',desc:'之后每轮得分提高 20%。',accent:'#72f4ff'},
  {id:'recall',name:'回忆协议',desc:'获得 1 次失误容错；每次错误消耗 1 层，可累积。',accent:'#c29aff'}
];
var blackboxUpgradeDefs=[
  {id:'buffer',name:'冗余电容',desc:'恢复 1 格完整性，最多 4 格。',accent:'#75ffb2'},
  {id:'wide',name:'宽幅供电',desc:'后续每层增加 4 步预算。',accent:'#72f4ff'},
  {id:'scanner',name:'线路扫描器',desc:'获得 1 次不扣分的线路提示。',accent:'#ffd76a'},
  {id:'multiplier',name:'超频计分器',desc:'后续连通奖励提高 15%。',accent:'#c29aff'}
];
var salvageContractDefs=[
  {id:'cache',name:'缓存回收',desc:'带回至少 2 个高能缓存。',goal:2,unit:'缓存',accent:'#ffd76a'},
  {id:'data',name:'黑匣寻迹',desc:'从废舰中找出 3 份航行数据。',goal:3,unit:'数据',accent:'#72f4ff'},
  {id:'cargo',name:'重载打捞',desc:'累计回收 8 件物资再撤离。',goal:8,unit:'物资',accent:'#75ffb2'},
  {id:'relic',name:'遗物追踪',desc:'找到 2 件相位遗物。',goal:2,unit:'遗物',accent:'#c29aff'},
  {id:'ghost',name:'幽灵穿行',desc:'热度不超过 2，并带回至少 1 个缓存。',goal:1,unit:'缓存',accent:'#ff718e'}
];
var arcadeMasteryDefs={
  relay:{title:'回波校准',metric:'累计有效拦截',value:function(){return profile.relayHits||0;},choices:[
    {id:'wideband',name:'宽频捕获',desc:'每个目标多停留 320 毫秒。',unlockAt:12,accent:'#72f4ff'},
    {id:'cache',name:'缓存共振',desc:'金色缓存出现率提高 8%。',unlockAt:40,accent:'#ffd76a'}
  ]},
  lab:{title:'记忆神经',metric:'成功回想轮数',value:function(){return profile.labSolved||0;},choices:[
    {id:'slowflash',name:'延展闪忆',desc:'节点记忆闪光延长 100 毫秒。',unlockAt:9,accent:'#c29aff'},
    {id:'extraheart',name:'备用神经元',desc:'每局多带 1 颗容错生命。',unlockAt:28,accent:'#ff718e'}
  ]},
  salvage:{title:'失事舰适应',metric:'带回的样本',value:function(){return (profile.salvageCollected||0)+(profile.salvageData||0)+(profile.salvageRelics||0);},choices:[
    {id:'hull',name:'隔舱缓冲',desc:'整场远征首次踩中危险时不损失氧压，警戒仍会升高。',unlockAt:6,accent:'#75ffb2'},
    {id:'oxygen',name:'备用氧瓶',desc:'每层开始时额外获得 12 秒氧压。',unlockAt:20,accent:'#72f4ff'}
  ]},
  blackbox:{title:'线路技师',metric:'成功连通层数',value:function(){return profile.blackboxLocks||0;},choices:[
    {id:'budget',name:'宽窗供电',desc:'每层线路多 3 步预算。',unlockAt:4,accent:'#72f4ff'},
    {id:'reader',name:'预读总线',desc:'每局获得 1 次不扣分的免费提示。',unlockAt:15,accent:'#c29aff'}
  ]}
};
if(!profile.arcadeMastery||typeof profile.arcadeMastery!=='object'||Array.isArray(profile.arcadeMastery))profile.arcadeMastery={};
var masterySelectionChanged=false;
Object.keys(arcadeMasteryDefs).forEach(function(mode){var selected=profile.arcadeMastery[mode],choice=arcadeMasteryDefs[mode].choices.find(function(item){return item.id===selected;});if(!choice||(Number(arcadeMasteryDefs[mode].value())||0)<choice.unlockAt){if(selected!==null&&selected!==undefined)masterySelectionChanged=true;profile.arcadeMastery[mode]=null;}});
if(loadedProfileSchemaVersion<11||masterySelectionChanged||dailyDirectiveChanged||profileRecovered||savedProfileRecord&&savedProfileRecord.legacy)saveProfile();
var workbench={shipId:'pulse',slot:'weapon',equipment:null};

function arcadeMasteryValue(mode){var def=arcadeMasteryDefs[mode];return def?Math.max(0,Number(def.value())||0):0;}
function arcadeMasteryUnlockCount(mode){var def=arcadeMasteryDefs[mode];if(!def)return 0;var value=arcadeMasteryValue(mode);return def.choices.filter(function(choice){return value>=choice.unlockAt;}).length;}
function activeArcadeMastery(mode){var def=arcadeMasteryDefs[mode],id=profile.arcadeMastery&&profile.arcadeMastery[mode];if(!def||!id)return null;return def.choices.find(function(choice){return choice.id===id&&arcadeMasteryValue(mode)>=choice.unlockAt;})||null;}
function arcadeModeRunning(mode){return mode==='relay'?relay.running:mode==='lab'?lab.running:mode==='salvage'?salvage.running:mode==='blackbox'?blackbox.running:false;}
function selectArcadeMastery(mode,id){
  var def=arcadeMasteryDefs[mode];if(!def||arcadeModeRunning(mode))return false;
  var choice=id?def.choices.find(function(item){return item.id===id&&arcadeMasteryValue(mode)>=item.unlockAt;}):null;
  if(id&&!choice)return false;
  profile.arcadeMastery[mode]=choice?choice.id:null;saveProfile();renderArcadeMastery(mode);toast(choice?'精通配置已装备 · '+choice.name:'已恢复标准精通配置');beep(choice?760:420,.055,.022);return true;
}
function renderArcadeMastery(mode){
  var def=arcadeMasteryDefs[mode],host=ui[mode+'Mastery'];if(!def||!host)return;
  var value=arcadeMasteryValue(mode),count=arcadeMasteryUnlockCount(mode),next=def.choices.find(function(choice){return value<choice.unlockAt;}),previous=count?def.choices[count-1].unlockAt:0;
  var pct=next?Math.round(clamp((value-previous)/(next.unlockAt-previous),0,1)*100):100,selected=profile.arcadeMastery[mode],busy=arcadeModeRunning(mode);
  var status=next?def.metric+' '+value+' / '+next.unlockAt+' · 下一项 '+next.name:'已全部解锁 · '+def.metric+' '+value;
  var choices='<button class="masteryChoice masteryStandard'+(!selected?' selected':'')+'" type="button" data-mastery-id="" aria-pressed="'+(!selected)+'"'+(busy?' disabled':'')+'><span><b>标准配置</b><small>不启用精通被动，使用玩法原始规则。</small></span><i>'+(!selected?'已装备':'选择')+'</i></button>';
  choices+=def.choices.map(function(choice){var unlocked=value>=choice.unlockAt,isSelected=selected===choice.id;return '<button class="masteryChoice" type="button" data-mastery-id="'+choice.id+'" aria-pressed="'+isSelected+'"'+(unlocked&&!busy?'':' disabled')+' style="--mastery-accent:'+choice.accent+'"><span><b>'+safeText(choice.name)+'</b><small>'+(unlocked?safeText(choice.desc):'🔒 '+def.metric+' 达到 '+choice.unlockAt+' 后解锁')+'</small></span><i>'+(isSelected?'已装备':unlocked?'装备':'未解锁')+'</i></button>';}).join('');
  host.innerHTML='<section class="modeMastery" aria-label="'+safeText(def.title)+'精通"><header><div><span class="kicker">MODE MASTERY / '+safeText(def.title.toUpperCase())+'</span><p>'+safeText(status)+'</p></div><b>'+count+' / '+def.choices.length+'</b></header><div class="masteryProgress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><i style="width:'+pct+'%"></i></div><div class="masteryChoices">'+choices+'</div><small class="masteryFoot">精通只作用于对应游戏；出局前可换装，开局后固定到结算。</small></section>';
  Array.prototype.forEach.call(host.querySelectorAll('button[data-mastery-id]'),function(button,index){var id=button.getAttribute?button.getAttribute('data-mastery-id')||'':button.dataset?button.dataset.masteryId||'':index===0?'':def.choices[index-1]&&def.choices[index-1].id||'';button.addEventListener('click',function(){selectArcadeMastery(mode,id);});});
}
function arcadeFeedback(mode,event,value){
  var board=ui[mode==='relay'?'relayBoard':mode==='lab'?'labBoard':mode==='salvage'?'salvageBoard':'blackboxBoard'];if(!board)return;
  var classes={relay:{hit:'fxHit',cache:'fxCache',error:'fxError',miss:'fxMiss',clear:'fxClear',start:'fxStart'},lab:{hit:'fxRecall',error:'fxError',clear:'fxClear',start:'fxStart'},salvage:{loot:'fxLoot',cache:'fxCache',data:'fxData',relic:'fxRelic',repair:'fxRepair',hazard:'fxHazard',beacon:'fxBeacon',clear:'fxClear',start:'fxStart'},blackbox:{rotate:'fxRotate',hint:'fxHint',error:'fxError',clear:'fxClear',start:'fxStart'}};
  var cssClass=(classes[mode]||{})[event];if(cssClass){board.classList.remove(cssClass);void board.offsetWidth;board.classList.add(cssClass);}
  var notes={relay:{hit:[560,610,660],cache:[940,1120,1320],error:[185,150],miss:[280],clear:[880,1180],start:[520,740]},lab:{hit:[310,370,440,520,610],error:[190,150,120],clear:[660,880,1040],start:[480,720]},salvage:{loot:[260,330],cache:[660,880,1080],data:[470,590],relic:[790,990,1210],repair:[390,520],hazard:[155,120],beacon:[520,780],clear:[620,840,1080],start:[360,500]},blackbox:{rotate:[230,280],hint:[690,820],error:[170,130],clear:[540,720,960],start:[330,490]}};
  var sequence=(notes[mode]||{})[event]||[420],tone=sequence[Math.abs(Math.floor(Number(value)||0))%sequence.length];beep(tone,.055,.022);
  if(event==='error'||event==='hazard'||event==='miss')vibrate(mode==='salvage'?45:24);else if(event==='cache'||event==='relic'||event==='clear')vibrate(mode==='lab'?[18,25,18]:20);
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rnd(a,b){return a+Math.random()*(b-a);}
function d2(a,b){var dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;}
function uid(prefix){return prefix+'-'+(g.nextUid++);}
function makeRunSeed(){var now=Date.now().toString(36).toUpperCase().slice(-5),noise=Math.floor(Math.random()*0x10000).toString(36).toUpperCase().padStart(3,'0');return 'ND-'+now+'-'+noise;}
function ensurePendingSeed(){if(typeof profile.pendingSeed!=='string'||!profile.pendingSeed){profile.pendingSeed=makeRunSeed();saveProfile();}return profile.pendingSeed;}
function routeMapForSeed(seed,routeId){return core.generateStarMap(seed,routeId);}
function validRoutePlan(map,plan){return !!(plan&&plan.seed===map.seed&&plan.routeId===map.routeId&&Array.isArray(plan.ids)&&plan.ids.length===map.stages.length&&map.stages.every(function(stage,index){return stage.nodes.some(function(node){return node.id===plan.ids[index];});}));}
function ensureRoutePlan(){var map=routeMapForSeed(ensurePendingSeed(),profile.selectedRoute);if(!validRoutePlan(map,profile.routePlan)){profile.routePlan={seed:map.seed,routeId:map.routeId,ids:map.stages.map(function(stage){return stage.nodes[0].id;})};saveProfile();}return map;}
function routeNodeById(map,id){for(var i=0;i<map.stages.length;i++){for(var j=0;j<map.stages[i].nodes.length;j++){if(map.stages[i].nodes[j].id===id)return map.stages[i].nodes[j];}}return null;}
function routeNodeForStage(stage,map,plan){map=map||g.routeMap;plan=plan||g.routePlan;var id=plan&&plan[stage];return routeNodeById(map,id)||map.stages[stage].nodes[0];}
function selectedRouteNode(stage){var map=ensureRoutePlan(),plan=profile.routePlan;return routeNodeById(map,plan.ids[stage])||map.stages[stage].nodes[0];}
function getDef(item){for(var i=0;i<itemDefs.length;i++)if(itemDefs[i].id===item.defId)return itemDefs[i];return itemDefs[0];}
function getRarity(item){return rarityMeta[item.rarity]||rarityMeta.common;}
function itemPower(item){return getRarity(item).mult*(1+(item.level-1)*.16);}
function rarityRank(name){return ['common','rare','epic','legendary'].indexOf(name);}
function branchDefinition(item){var def=getDef(item),options=weaponBranchDefs[def.id]||[];return options.find(function(option){return option.id===item.branch;})||null;}
function itemLabel(item){var branch=branchDefinition(item);return getDef(item).name+' · Lv.'+item.level+(branch?' · '+branch.name:'');}
function makeItem(defId,rarity){
  return {uid:uid('item'),defId:defId,rarity:rarity||'common',level:1,branch:''};
}
function normalizeRarity(value){return ['common','rare','epic','legendary'].indexOf(value)>=0?value:'common';}
function serializeLoadout(equipment){
  var source=equipment||g.equipment||{},result={};
  Object.keys(slotMeta).forEach(function(slot){if(!isSlotUnlocked(slot))return;var item=source[slot],def=item&&itemDefs.find(function(candidate){return candidate.id===item.defId&&candidate.slot===slot;});if(def)result[slot]={defId:def.id,rarity:normalizeRarity(item.rarity),level:clamp(Math.floor(Number(item.level)||1),1,6),branch:branchDefinition(item)?item.branch:''};});
  return result;
}
function restoreLoadout(data){
  if(!data||typeof data!=='object')return null;
  var result={},valid=true;
  Object.keys(slotMeta).forEach(function(slot){
    var raw=data[slot],def=raw&&itemDefs.find(function(candidate){return candidate.id===raw.defId&&candidate.slot===slot;});
    if(slot==='augment'&&!isSlotUnlocked(slot))return;
    if(slot==='augment'&&!raw){result[slot]=makeItem('aegisMesh','common');return;}
    if(!def&&slot==='subweapon'){def=itemDefs.find(function(candidate){return candidate.id==='missile';});raw=null;}
    if(!def){valid=false;return;}
    var item=makeItem(def.id,normalizeRarity(raw&&raw.rarity));item.level=clamp(Math.floor(Number(raw&&raw.level)||1),1,6);item.branch=branchDefinition({defId:def.id,branch:raw&&raw.branch})?raw.branch:'';result[slot]=item;
  });
  return valid?result:null;
}
function setDefaults(){
  g.equipment=restoreLoadout(profile.activeLoadout)||{
    weapon:makeItem('pulse','common'),
    subweapon:makeItem('missile','common'),
    core:makeItem('nano','common'),
    utility:makeItem('emp','common'),
    engine:makeItem('drift','common')
  };
  if(isSlotUnlocked('augment')&&!g.equipment.augment)g.equipment.augment=makeItem('aegisMesh','common');
  g.inventory=[];
}
function recalcBuild(fresh){
  var oldShield=Number.isFinite(ship.shield)?ship.shield:0;
  var oldCharges=Number.isFinite(traits.empCharges)?traits.empCharges:0;
  var ratio=ship.maxHp?clamp(ship.hp/ship.maxHp,0,1):1;
  var build=core.calculateBuild(g.equipment);
  Object.assign(ship,build.stats);Object.assign(traits,build.traits);applyBlueprint(false);applyMetaProtocols();
  ship.hp=clamp(ship.maxHp*ratio,1,ship.maxHp);
  ship.maxShield=ship.shield;
  if(fresh){g.shieldCapacityGranted=ship.maxShield;g.empCapacityGranted=traits.empMax;}
  else{
    // Only a new capacity record grants supplies. Unequip/re-equip cannot recharge.
    ship.shield=clamp(oldShield+Math.max(0,ship.maxShield-g.shieldCapacityGranted),0,ship.maxShield);
    traits.empCharges=clamp(oldCharges+Math.max(0,traits.empMax-g.empCapacityGranted),0,traits.empMax);
    g.shieldCapacityGranted=Math.max(g.shieldCapacityGranted,ship.maxShield);
    g.empCapacityGranted=Math.max(g.empCapacityGranted,traits.empMax);
  }
  g.empCooldown=clamp(g.empCooldown,0,traits.empCooldownMax);
}
function buildItems(){
  var arr=[];Object.keys(g.equipment).forEach(function(k){if(g.equipment[k])arr.push(g.equipment[k]);});return arr;
}
function buildNames(){
  return buildItems().map(itemLabel);
}
function estimatedDps(){return core.weaponDps(ship,traits);}
function buildSummary(){
  return 'DPS '+Math.round(estimatedDps())+' · 穿透 '+ship.pierce+' · 护盾 '+Math.round(ship.maxShield||0)+(traits.synergies.length?' · '+traits.synergies.join('/'):'');
}
function iconStyle(item,large){
  var def=getDef(item);
  if(!def.frame)return 'background-image:none;background-color:'+(def.glyphColor||'#c29aff')+'18;color:'+(def.glyphColor||'#c29aff')+';border:1px solid '+(def.glyphColor||'#c29aff')+'66;';
  var x=def.frame[0]*100/3,y=def.frame[1]*100/3;
  return 'background-image:url(assets/gear-atlas-v3.webp);background-size:400% 400%;background-position:'+x+'% '+y+'%;';
}
function iconMarkup(item,size){
  var def=getDef(item),glyph=def.glyph?' data-glyph="'+safeText(def.glyph)+'"':'';
  return '<div class="gearIcon '+(size||'small')+'"'+glyph+' style="'+iconStyle(item)+'"></div>';
}
function bossStyle(def){
  var x=def.frame[0]*100,y=def.frame[1]*100;
  return 'background-image:url(assets/boss-atlas-v2.webp);background-size:200% 200%;background-position:'+x+'% '+y+'%;';
}
function enemyStyle(def){
  var x=def.frame[0]*100/3,y=def.frame[1]*100;
  return 'background-image:url(assets/enemy-atlas-v3.png);background-size:400% 200%;background-position:'+x+'% '+y+'%;';
}
function threatMetaMarkup(def){
  return '<span class="threatRole" style="--threat-color:'+def.color+'">'+safeText(def.roleTag||'威胁')+'</span><span class="threatAttack">'+safeText(def.attackLabel||'攻击')+'</span><small class="threatCue">'+safeText(def.readableCue||def.desc)+'</small>';
}
function rarityClass(item){return 'r-'+(item.rarity||'common');}
function safeText(text){return String(text).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function hubButtonView(view){
  if(!document.querySelectorAll)return;
  document.querySelectorAll('[data-hub-view]').forEach(function(button){
    if(button.dataset&&button.dataset.hubView===view)button.classList.add('active');
    else button.classList.remove('active');
  });
  document.querySelectorAll('[data-hub-panel]').forEach(function(panel){panel.classList.toggle('active',panel.dataset&&panel.dataset.hubPanel===view);});
}
function closeHubMore(){
  var button=ui.hubMoreBtn,rail=button&&button.parentNode;if(!button||!rail)return;
  rail.classList.remove('moreOpen');button.setAttribute('aria-expanded','false');
}
function toggleHubMore(){
  var button=ui.hubMoreBtn,rail=button&&button.parentNode;if(!button||!rail)return;
  var open=!rail.classList.contains('moreOpen');rail.classList.toggle('moreOpen',open);button.setAttribute('aria-expanded',open?'true':'false');
}
var arcadeGameViews={relay:'signals',lab:'lab',salvage:'salvage',blackbox:'blackbox'};
var arcadeGameByHubView={signals:'relay',lab:'lab',salvage:'salvage',blackbox:'blackbox',border:'border'};
var stationViews=['bridge','armory','routes','chronicle','codex','archive','guides','workbench','protocols','challenges','dispatch'];
var legacyGameStationRoutes={expedition:'expedition',border:'border',signals:'relay',salvage:'salvage',lab:'lab',blackbox:'blackbox'};
function setArcadeHash(path){try{var next=path?'#'+path:'#arcade';if(window.location&&window.location.hash===next)return;if(window.history&&window.history.pushState)window.history.pushState(null,'',next);else if(window.location)window.location.hash=next;}catch(e){}}
function renderArcadeLanding(){
  if(!ui.arcadeLanding)return;
  if(ui.arcadeRunCount)ui.arcadeRunCount.textContent=String(Math.max(0,profile.runs||0));
  if(ui.arcadeRelayBest)ui.arcadeRelayBest.textContent=String(Math.max(0,profile.relayBest||0));
  if(ui.arcadeLabBest)ui.arcadeLabBest.textContent=String(Math.max(0,profile.labBest||0));
  if(ui.arcadeSalvageBest)ui.arcadeSalvageBest.textContent=String(Math.max(0,profile.salvageBest||0));
  if(ui.arcadeBlackboxBest)ui.arcadeBlackboxBest.textContent=String(Math.max(0,profile.blackboxBest||0));
  if(ui.arcadeBorderClears)ui.arcadeBorderClears.textContent=String(Math.max(0,profile.borderTactics.clears||0));
  if(ui.arcadeShardCount)ui.arcadeShardCount.textContent=String(Math.max(0,profile.shards||0));
  if(ui.arcadeProfileHint)ui.arcadeProfileHint.textContent=(profile.runs||0)+(profile.borderTactics.runs||0)+(profile.relayRuns||0)+(profile.labRuns||0)+(profile.salvageRuns||0)+(profile.blackboxRuns||0)>0?'原舰站模式的成绩与资源继续保留；新解码战役的关卡、接线和星级使用独立存档。':'本区展示原舰站集合的记录；新解码战役在自己的关卡地图保存进度。';
}
function stopArcadeSession(){
  pendingStartToken++;startingRun=false;if(ui.expeditionStartBtn){ui.expeditionStartBtn.disabled=false;selectRunMode(selectedRunMode);}
  if(window.NeonBorderTactics&&typeof window.NeonBorderTactics.leave==='function')window.NeonBorderTactics.leave();
  stopRelay(true);stopLab(true);stopSalvage(true);stopBlackbox(true);
  if(g.running)endGame('abandoned');
  g.paused=false;g.modalPaused=false;g.suspended=false;g.choosing=false;g.eventActive=false;g.pendingEvent=false;g.modal=null;
  pointer=false;if(input&&input.clear)input.clear();setCombatControls(false);
  [ui.startOverlay,ui.lootOverlay,ui.eventOverlay,ui.pauseOverlay,ui.gameOverOverlay,ui.armoryOverlay,ui.archiveOverlay].forEach(function(layer){if(layer)layer.classList.add('hidden');});
}
function showArcadeShell(mode){
  if(ui.arcadeLanding)ui.arcadeLanding.classList.add('hidden');
  if(ui.arcadeGamePages)ui.arcadeGamePages.classList.add('hidden');
  if(ui.hubOverlay)ui.hubOverlay.classList.add('hidden');
  app.classList.remove('hubMode');app.classList.remove('arcadeLandingMode');app.classList.remove('arcadeGameMode');
  if(mode)app.classList.add(mode);
}
function openArcadeLanding(silent){
  if(window.NeonPlayLoader){if(g.running)endGame('abandoned');stopArcadeSession();window.NeonPlayLoader.home();return;}
  stopArcadeSession();closeAnnouncement();showArcadeShell('arcadeLandingMode');
  if(ui.arcadeLanding)ui.arcadeLanding.classList.remove('hidden');
  renderArcadeLanding();
  if(!silent)setArcadeHash('');
}
function enterStation(view,silent){
  prepareExpedition();
  if(stationViews.indexOf(view)<0)view='bridge';
  stopArcadeSession();closeAnnouncement();showArcadeShell('hubMode');
  if(ui.hubOverlay)ui.hubOverlay.classList.remove('hidden');
  setHubView(view);
  if(!silent)setArcadeHash('station/'+view);
}
function openHubDestination(view,silent){var game=arcadeGameByHubView[view];if(game)enterArcadeGame(game,silent);else enterStation(view,silent);}
function enterArcadeGame(kind,silent){
  if(window.NeonPlayLoader&&!window.NeonPlayLoader.supports(kind)){stopArcadeSession();window.NeonPlayLoader.navigate(kind);return;}
  if(kind==='bridge'){enterStation('bridge',silent);return;}
  if(ui.arcadeGamePages)ui.arcadeGamePages.scrollTop=0;
  if(kind==='expedition'){
    prepareExpedition();stopArcadeSession();closeAnnouncement();showArcadeShell('arcadeGameMode');
    if(ui.arcadeGamePages)ui.arcadeGamePages.classList.remove('hidden');
    if(ui.expeditionGamePage)ui.expeditionGamePage.classList.remove('hidden');
    if(ui.borderTacticsPage)ui.borderTacticsPage.classList.add('hidden');
    if(!silent)setArcadeHash('game/expedition');
    return;
  }
  if(kind==='border'){
    stopArcadeSession();closeAnnouncement();showArcadeShell('arcadeGameMode');
    if(ui.arcadeGamePages)ui.arcadeGamePages.classList.remove('hidden');
    if(ui.expeditionGamePage)ui.expeditionGamePage.classList.add('hidden');
    if(ui.borderTacticsPage)ui.borderTacticsPage.classList.remove('hidden');
    if(window.NeonBorderTactics&&typeof window.NeonBorderTactics.enter==='function')window.NeonBorderTactics.enter();
    if(!silent)setArcadeHash('game/border');
    return;
  }
  var view=arcadeGameViews[kind];if(!view){openArcadeLanding(silent);return;}
  stopArcadeSession();closeAnnouncement();showArcadeShell('arcadeGameMode');
  if(ui.arcadeGamePages)ui.arcadeGamePages.classList.remove('hidden');
  if(ui.expeditionGamePage)ui.expeditionGamePage.classList.add('hidden');
  if(ui.borderTacticsPage)ui.borderTacticsPage.classList.add('hidden');
  setHubView(view);
  if(!silent)setArcadeHash('game/'+kind);
}
function syncArcadeRoute(){
  var hash='';try{hash=window.location&&window.location.hash||'';}catch(e){}
  var gameMatch=/^#game\/(expedition|border|relay|lab|salvage|blackbox|bridge)$/.exec(hash);
  var stationMatch=/^#station\/([a-z]+)$/.exec(hash);
  if(gameMatch){
    if(gameMatch[1]==='bridge'){enterStation('bridge',true);setArcadeHash('station/bridge');}
    else enterArcadeGame(gameMatch[1],true);
  }
  else if(stationMatch&&legacyGameStationRoutes[stationMatch[1]]){
    var legacyGame=legacyGameStationRoutes[stationMatch[1]];enterArcadeGame(legacyGame,true);setArcadeHash('game/'+legacyGame);
  }
  else if(stationMatch&&stationViews.indexOf(stationMatch[1])>=0)enterStation(stationMatch[1],true);
  else openArcadeLanding(true);
}
function setHubView(view){
  if(!ui.hubOverlay)return;
  if(view==='dispatch'){openAnnouncement();return;}
  closeHubMore();
  closeAnnouncement();
  if(view==='lab'){stopRelay(true);stopSalvage(true);stopBlackbox(true);}else if(view==='signals'){stopLab(true);stopSalvage(true);stopBlackbox(true);}else if(view==='salvage'){stopLab(true);stopRelay(true);stopBlackbox(true);}else if(view==='blackbox'){stopLab(true);stopRelay(true);stopSalvage(true);}else{stopLab(true);stopRelay(true);stopSalvage(true);stopBlackbox(true);}
  var meta=hubViewMeta[view]||hubViewMeta.bridge;if(ui.hubTitle)ui.hubTitle.textContent=meta.title;if(ui.hubIntro)ui.hubIntro.textContent=meta.intro;ui.hubOverlay.scrollTop=0;
  hubButtonView(view);
  if(view==='bridge')renderHubBridge();
  if(view==='armory')renderHubArmory();
  if(view==='routes')renderHubRoutes();
  if(view==='codex')renderHubCodex();
  if(view==='archive')renderHubArchive();
  if(view==='guides')renderHubGuides();
  if(view==='workbench')renderHubWorkbench();
  if(view==='protocols')renderHubProtocols();
  if(view==='challenges')renderHubChallenges();
  if(view==='signals')renderHubSignals();
  if(view==='salvage')renderHubSalvage();
  if(view==='lab')renderHubLab();
  if(view==='blackbox')renderHubBlackbox();
  if(view==='dispatch')renderHubDispatch();
  if(view==='chronicle')renderHubChronicle();
}
function renderHubBridge(options){
  syncUnlocks();
  var bp=selectedBlueprint(),route=selectedRoute(),map=ensureRoutePlan(),node=selectedRouteNode(0),nodeDef=starNodeDefs[node.type]||starNodeDefs.combat;
  ui.metaShards.textContent=profile.shards;ui.metaIntel.textContent=stationResource('intel');ui.metaModules.textContent=stationResource('modules');ui.metaResearch.textContent=stationResource('research');
  ui.commanderRank.textContent='RANK '+String(commanderRankValue()).padStart(2,'0');
  ui.selectedShipLabel.textContent=bp.name;ui.selectedRouteLabel.textContent=route.name;ui.shipClassLabel.textContent=bp.className;
  ui.shipPerkLabel.textContent=bp.perk;ui.shipPowerLabel.textContent='战力 '+Math.round(100+(bp.mods.damage*2)+(bp.mods.shield-1)*24+(bp.mods.maxHp-1)*18);
  if(ui.launchStageLabel)ui.launchStageLabel.textContent='01 / '+String(map.stages.length).padStart(2,'0');
  if(ui.launchNodeLabel)ui.launchNodeLabel.textContent=nodeDef.label;
  if(ui.launchSeedLabel)ui.launchSeedLabel.textContent=String(map.seed);
  renderHubMissionBoard(options);renderStationPortal();
}
function commanderRankValue(){var rankXp=Math.max(0,Math.floor((profile.shards||0)+(bestWave||0)*3+(profile.totalKills||0)/10+(profile.salvageCaches||0)*8));return Math.max(1,Math.floor(rankXp/25)+1);}
function renderHubProtocols(){
  if(!ui.protocolGrid)return;
  var p=profile.protocols||{};
  var spent=0;protocolDefs.forEach(function(def){for(var i=0;i<(p[def.id]||0);i++)spent+=def.cost(i);});
  ui.protocolSummary.innerHTML='<div class="protocolCurrency"><span>可用星尘</span><b>'+profile.shards+'</b></div><div><span>已投入</span><b>'+spent+'</b></div><div><span>永久加成</span><b>'+(Math.round(((p.salvage||0)*8)*10)/10)+'% 回收</b></div><p>协议只在舰桥生效；每次升级会立刻改变下一局的起点。</p>';
  ui.protocolGrid.innerHTML='';
  protocolDefs.forEach(function(def){
    var level=p[def.id]||0,maxed=level>=def.max,cost=maxed?0:def.cost(level),card=document.createElement('article');card.className='protocolCard'+(maxed?' maxed':'');
    var ticks='';for(var i=0;i<def.max;i++)ticks+='<i class="'+(i<level?'filled':'')+'"></i>';
    card.innerHTML='<div class="protocolHead"><span class="protocolTag" style="color:'+def.accent+'">'+def.tag+'</span><b>LV '+level+' / '+def.max+'</b></div><h3>'+safeText(def.name)+'</h3><p>'+safeText(def.desc)+'</p><div class="protocolTicks">'+ticks+'</div><div class="protocolFoot"><span>'+(maxed?'已达上限':'下一阶 · '+cost+' 星尘')+'</span><button class="miniBtn '+(maxed?'alt':'')+'" type="button" '+(maxed||profile.shards<cost?'disabled':'')+'>'+(maxed?'MAX':'升级')+'</button></div>';
    var button=card.querySelectorAll('button')[0];if(button)button.addEventListener('click',function(){buyProtocol(def.id);});
    ui.protocolGrid.appendChild(card);
  });
}
function buyProtocol(id){
  var def=protocolDefs.find(function(item){return item.id===id;}),p=profile.protocols||{};if(!def)return;
  var level=p[id]||0;if(level>=def.max){toast('协议已达上限');return;}
  var cost=def.cost(level);if(profile.shards<cost){toast('星尘不足 · 需要 '+cost);return;}
  profile.shards-=cost;p[id]=level+1;profile.protocols=p;saveProfile();resetRun();renderHubProtocols();renderHubBridge();toast(def.name+' 升级至 LV '+(level+1));beep(980,.08,.035);
}
function renderHubArmory(){
  syncUnlocks();
  ui.shipPicker.innerHTML='';
  shipBlueprints.forEach(function(bp){
    var unlocked=profile.unlockedShips.indexOf(bp.id)>=0,card=document.createElement('button');card.type='button';card.className='shipChoice'+(profile.selectedShip===bp.id?' selected':'');
    var lock=unlocked?'✓ 已解锁':'🔒 '+bp.unlock;
    card.innerHTML='<span class="choiceMark">'+lock+'</span><h3>'+safeText(bp.name)+'</h3><p>'+safeText(bp.desc)+'</p><div class="choiceStats"><span>伤害 '+(bp.mods.damage>=0?'+':'')+bp.mods.damage+'</span><span>生命 ×'+bp.mods.maxHp.toFixed(2)+'</span><span>护盾 ×'+bp.mods.shield.toFixed(2)+'</span></div>';
    card.addEventListener('click',function(){selectShip(bp.id);});ui.shipPicker.appendChild(card);
  });
  ui.hubArmoryStats.innerHTML='<div class="hubStat"><b>'+Math.round(estimatedDps())+'</b><span>理论 DPS</span></div><div class="hubStat"><b>'+Math.round(ship.maxHp)+'</b><span>生命上限</span></div><div class="hubStat"><b>'+Math.round(ship.maxShield||0)+'</b><span>护盾容量</span></div><div class="hubStat"><b>'+ship.pierce+'</b><span>穿透次数</span></div>';
  ui.hubLoadout.innerHTML='';Object.keys(slotMeta).forEach(function(slot){var item=g.equipment[slot],def=item&&getDef(item),el=document.createElement('article');el.className='hubSlot'+(!isSlotUnlocked(slot)?' locked':'');el.innerHTML=item?iconMarkup(item,'small')+'<b>'+safeText(def.name)+' · Lv.'+item.level+'</b><small>'+slotMeta[slot].label+' · '+safeText(def.desc)+(branchDefinition(item)?' · '+safeText(branchDefinition(item).name):'')+'</small>':!isSlotUnlocked(slot)?'<div class="gearIcon small">🔒</div><b>模组栏位未解锁</b><small>舰站升级「战术矩阵扩展」以启用第六栏</small>':'<div class="gearIcon small"></div><b>空槽位</b><small>'+slotMeta[slot].label+'</small>';ui.hubLoadout.appendChild(el);});
  renderLoadoutPresets();
}
function renderLoadoutPresets(){
  if(!ui.presetGrid)return;
  if(!Array.isArray(profile.presets))profile.presets=[null,null,null];
  ui.presetGrid.innerHTML='';
  for(var index=0;index<3;index++){
    var saved=restoreLoadout(profile.presets[index]),card=document.createElement('article');card.className='presetCard'+(saved&&profile.activeLoadout&&JSON.stringify(profile.presets[index])===JSON.stringify(serializeLoadout(g.equipment))?' active':'');
    var label='预设 '+String(index+1).padStart(2,'0');
    var summary=saved?Object.keys(slotMeta).filter(function(slot){return !!saved[slot];}).map(function(slot){return getDef(saved[slot]).name;}).join(' · '):'尚未记录构筑';
    card.innerHTML='<div class="presetCardHead"><span>'+label+'</span><b>'+(saved?'已保存':'空槽')+'</b></div><p>'+safeText(summary)+'</p><div class="presetCardMeta">'+(saved?'点击装载后会成为下一局起点':'保存当前已解锁栏位、装备等级与稀有度')+'</div><div class="presetActions"><button class="miniBtn" type="button">保存当前</button><button class="miniBtn alt" type="button" '+(saved?'':'disabled')+'>装载方案</button></div>';
    (function(slotIndex,presetCard){var buttons=presetCard.querySelectorAll('button');if(buttons[0])buttons[0].addEventListener('click',function(){savePreset(slotIndex);});if(buttons[1])buttons[1].addEventListener('click',function(){loadPreset(slotIndex);});})(index,card);
    ui.presetGrid.appendChild(card);
  }
}
function savePreset(index){
  index=Math.floor(Number(index));if(index<0||index>2)return false;
  profile.presets[index]=serializeLoadout(g.equipment);profile.activeLoadout=serializeLoadout(g.equipment);saveProfile();renderLoadoutPresets();renderHubBridge();toast('构筑预设 '+String(index+1).padStart(2,'0')+' 已保存');beep(760,.06,.025);return true;
}
function loadPreset(index){
  index=Math.floor(Number(index));if(index<0||index>2)return false;
  var restored=restoreLoadout(profile.presets[index]);if(!restored){toast('这个预设还是空的');return false;}
  profile.activeLoadout=serializeLoadout(restored);saveProfile();resetRun();renderHubArmory();renderHubBridge();toast('已装载构筑预设 '+String(index+1).padStart(2,'0'));beep(900,.07,.03);return true;
}
function renderHubMissionBoard(options){
  if(!ui.missionBoard)return;
  if(!options||options.refreshDaily!==false)ensureDailyDirective();
  var rankXp=Math.max(0,Math.floor((profile.shards||0)+(bestWave||0)*3+(profile.totalKills||0)/10+(profile.salvageCaches||0)*8+(profile.blackboxLocks||0)*4));
  var rank=commanderRankValue(),progress=rankXp%25;
  var activities=[
    {label:'远征深度',value:bestWave,target:5,unit:'波',view:'routes',accent:'#72f4ff',desc:'把航线推进到第 5 波，迎接首个完整 Boss 循环。'},
    {label:'夺回失落站',value:profile.borderTactics.clears||0,target:1,unit:'次',view:'border',accent:'#ff8a6b',desc:'穿过三个舱段，启动航行档案终端并抵达撤离标记。'},
    {label:'中继信号',value:profile.relayBest||0,target:120,unit:'分',view:'signals',accent:'#ff66c4',desc:'刷新一次个人中继纪录，测试你的手速与节奏。'},
    {label:'废墟缓存',value:profile.salvageCaches||0,target:3,unit:'个',view:'salvage',accent:'#75ffb2',desc:'找到三枚缓存，再带着热度从信标撤离。'},
    {label:'回声训练',value:profile.labSolved||0,target:9,unit:'轮',view:'lab',accent:'#ffb75c',desc:'跨局累计复现九轮，适应随机规则、长序列与诱饵信号。'},
    {label:'黑盒链路',value:profile.blackboxLocks||0,target:5,unit:'层',view:'blackbox',accent:'#c29aff',desc:'逐层连接电路，修复深渊观测站的五级加密网络。'}
  ];
  var daily=profile.dailyDirective||{},dailyDef=dailyDirectiveById(daily.id)||dailyDirectiveForDate(daily.date)||dailyDirectiveDefs[0],dailyValue=Math.min(Math.max(0,Math.floor(Number(daily.value)||0)),dailyDef.target),dailyReady=!daily.claimed&&dailyValue>=dailyDef.target,dailyPct=Math.round(dailyValue/dailyDef.target*100),dailyStatus=daily.claimed?'已领取':dailyReady?'可领取':'进行中';
  var dailyAction=daily.claimed?'<button class="miniBtn alt" type="button" disabled>今日已领取 <span>✓</span></button>':dailyReady?'<button class="miniBtn" type="button" data-daily-claim="1">领取奖励 <span>→</span></button>':'<button class="miniBtn alt" type="button" data-hub-view="'+safeText(dailyDef.view)+'">前往行动 <span>→</span></button>';
  var dailyMarkup='<section class="dailyDirective '+(dailyReady?'ready ':'')+(daily.claimed?'claimed':'')+'" style="--daily-accent:'+safeText(dailyDef.accent)+'"><div class="dailyDirectiveHead"><div><span class="kicker">'+safeText(dailyDef.tag)+'</span><h3>'+safeText(dailyDef.name)+'</h3><p>'+safeText(dailyDef.desc)+'</p></div><div class="dailyDirectiveStatus"><b>'+safeText(dailyStatus)+'</b><span>'+safeText(String(daily.date||'').replace(/-/g,'.'))+'</span></div></div><div class="dailyDirectiveBar"><i style="width:'+dailyPct+'%"></i></div><div class="dailyDirectiveFoot"><span>'+dailyValue+' / '+dailyDef.target+' '+safeText(dailyDef.unit)+' · 奖励 '+safeText(stationRewardLabel(dailyDef.reward))+'</span>'+dailyAction+'</div></section>';
  var contracts=stationContractDefs.map(function(def){
    var value=stationContractProgress(def),pct=Math.round(clamp(value,0,def.target)/def.target*100),claimed=!!profile.station.claimed[def.id],ready=!claimed&&value>=def.target;
    return '<article class="stationContractCard '+(claimed?'claimed ':'')+(ready?'ready':'')+'" style="--contract-accent:'+def.accent+'"><div class="stationContractCardTop"><span>'+safeText(def.tag)+'</span><b>'+safeText(claimed?'已领取':ready?'可领取':'进行中')+'</b></div><h3>'+safeText(def.name)+'</h3><p>'+safeText(def.desc)+'</p><div class="stationContractBar"><i style="width:'+pct+'%"></i></div><div class="stationContractReward"><span>'+Math.min(value,def.target)+' / '+def.target+' '+safeText(def.unit)+'</span><strong>'+safeText(stationRewardLabel(def.reward))+'</strong></div><div class="stationContractActions"><button class="miniBtn '+(ready?'':'alt')+'" type="button" data-station-contract="'+safeText(def.id)+'" data-hub-view="'+(ready?'':def.view)+'" '+(claimed?'disabled':'')+'>'+(claimed?'已领取':ready?'领取奖励':'查看行动')+'</button></div></article>';
  }).join('');
  ui.missionBoard.innerHTML='<div class="missionBoardHead"><div><span class="kicker">COMMANDER TASKBOARD</span><h2>当前循环</h2><p>六种游戏模式各有专属进度；每日指令给今天一个明确目标，舰站成果回到同一份档案。</p></div><div class="rankProgress"><span>RANK '+String(rank).padStart(2,'0')+'</span><b>'+progress+' / 25 XP</b><i><em style="width:'+(progress/25*100)+'%"></em></i></div></div>'+dailyMarkup+'<div class="missionCards">'+activities.map(function(item){var pct=Math.round(clamp(Number(item.value)||0,0,item.target)/item.target*100);return '<article class="missionCard"><div class="missionCardTop"><span style="color:'+item.accent+'">'+safeText(item.label)+'</span><b>'+Math.min(Number(item.value)||0,item.target)+' / '+item.target+' '+item.unit+'</b></div><p>'+safeText(item.desc)+'</p><div class="missionBar"><i style="width:'+pct+'%;background:'+item.accent+'"></i></div><button type="button" data-hub-view="'+item.view+'">'+(pct>=100?'查看纪录':'去完成')+' <span>→</span></button></article>';}).join('')+'</div><section class="stationContractPanel"><div class="stationContractHead"><div><span class="kicker">CROSS-MODE CONTRACTS</span><h3>跨模块委托</h3><p>游戏成果在这里汇合成舰站资源；完成目标后可领取额外奖励。</p></div><span class="contractPulse">'+stationResource('intel')+' 情报 · '+stationResource('modules')+' 模块 · '+stationResource('research')+' 研究</span></div><div class="stationContractList">'+contracts+'</div></section>';
}
function renderStationPortal(){
  if(!ui.stationPortal)return;
  var latest=dispatchEntries[0],historyCount=Array.isArray(profile.history)?profile.history.length:0,blueprintCount=Array.isArray(profile.blueprints)?profile.blueprints.length:0;
  var resourceNames={intel:'情报',modules:'模块',research:'研究'};
  var upgrades=stationUpgradeDefs.map(function(def){var level=stationUpgradeLevel(def.id),maxed=level>=def.max,cost=def.cost,canBuy=!maxed&&stationResource(def.resource)>=cost;return '<article class="stationUpgradeCard '+(maxed?'maxed':'')+'" style="--upgrade-accent:'+def.accent+'"><div class="stationUpgradeTop"><span>'+safeText(def.tag)+'</span><b>LV '+level+' / '+def.max+'</b></div><h3>'+safeText(def.name)+'</h3><p>'+safeText(def.desc)+'</p><div class="stationUpgradeTicks">'+Array.from({length:def.max},function(_,index){return '<i class="'+(index<level?'filled':'')+'"></i>';}).join('')+'</div><div class="stationUpgradeFoot"><span>'+(maxed?'已达上限':safeText(resourceNames[def.resource])+' '+cost+' · 当前 '+stationResource(def.resource))+'</span><button class="miniBtn '+(maxed?'alt':'')+'" type="button" data-station-upgrade="'+safeText(def.id)+'" '+(maxed||!canBuy?'disabled':'')+'>'+(maxed?'MAX':'升级')+'</button></div></article>';}).join('');
  ui.stationPortal.innerHTML='<div class="stationPortalHead"><div><span class="kicker">STATION DIRECTORY</span><h2>不止一场战斗</h2><p>把这里当作一座可以反复回来的站点：读世界、学打法、试构筑，再回到航线。</p></div><span class="contentCount">'+codexEntries.length+' 资料 · '+guideEntries.length+' 攻略 · '+historyCount+' 条本机记录</span></div><div class="stationPortalGrid"><button type="button" class="portalCard portalWorld" data-hub-view="codex"><span class="portalIcon">◎</span><span class="portalCopy"><b>世界观资料库</b><small>城市、势力与区域档案</small></span><strong>进入 <i>→</i></strong></button><button type="button" class="portalCard portalGuide" data-hub-view="guides"><span class="portalIcon">▤</span><span class="portalCopy"><b>指挥官攻略</b><small>8 篇可执行打法笔记</small></span><strong>阅读 <i>→</i></strong></button><button type="button" class="portalCard portalBuild" data-hub-view="workbench"><span class="portalIcon">⌬</span><span class="portalCopy"><b>构筑实验台</b><small>五个基础槽 + 可解锁第六模组</small></span><strong>模拟 <i>→</i></strong></button><article class="portalDispatch"><div class="portalDispatchTop"><span style="color:'+latest.accent+'">'+safeText(latest.tag)+'</span><time>'+safeText(latest.date)+'</time></div><b>'+safeText(latest.title)+'</b><p>'+safeText(latest.text)+'</p><button type="button" data-hub-view="dispatch">查看公告 <i>→</i></button></article></div><section class="stationUpgradePanel"><div class="stationUpgradeHead"><div><span class="kicker">STATION SYSTEMS</span><h3>把跨模块成果投入舰站</h3><p>情报、模块和研究不是装饰数字：它们会改变路线回报、背包容量、额外装备栏位与战斗应急能力。</p></div><span class="sectionHint">升级后立即生效</span></div><div class="stationUpgradeGrid">'+upgrades+'</div></section>';
  var contentCountEl=ui.stationPortal.querySelector&&ui.stationPortal.querySelector('.contentCount');if(contentCountEl)contentCountEl.textContent=codexEntries.length+' 资料 · '+guideEntries.length+' 攻略 · '+historyCount+' 条本机记录 · '+blueprintCount+'/3 蓝图';
  if(ui.stationPortal.querySelectorAll)ui.stationPortal.querySelectorAll('button').forEach(function(button){button.addEventListener('click',function(){var view=button.dataset&&button.dataset.hubView;if(view)setHubView(view);var upgrade=button.dataset&&button.dataset.stationUpgrade;if(upgrade)buyStationUpgrade(upgrade);});});
}
function renderContentFilters(kind,target){
  if(!target)return;
  var filters=contentFilters[kind]||[];target.innerHTML=filters.map(function(filter){return '<button type="button" class="filterTab '+(contentState[kind]===filter[0]?'active':'')+'" aria-selected="'+(contentState[kind]===filter[0]?'true':'false')+'">'+safeText(filter[1])+'</button>';}).join('');
  if(target.querySelectorAll)target.querySelectorAll('button').forEach(function(button,index){button.addEventListener('click',function(){contentState[kind]=filters[index][0];if(kind==='codex')renderHubCodex();else renderHubGuides();});});
}
function renderHubCodex(){
  if(!ui.codexGrid)return;
  renderContentFilters('codex',ui.codexFilters);
  var filter=contentState.codex||'all',entries=codexEntries.filter(function(entry){return filter==='all'||entry.type===filter;});
  if(ui.codexCount)ui.codexCount.textContent=entries.length+' 条记录';
  ui.codexGrid.innerHTML=entries.map(function(entry){return '<article class="codexCard" style="--card-accent:'+entry.accent+'"><div class="codexCardTop"><span>'+safeText(entry.typeLabel)+'</span><b>'+safeText(entry.tag)+'</b></div><h3>'+safeText(entry.title)+'</h3><p class="codexLead">'+safeText(entry.intro)+'</p><p>'+safeText(entry.body)+'</p><div class="codexFacts">'+entry.facts.map(function(fact){return '<span>'+safeText(fact)+'</span>';}).join('')+'</div></article>';}).join('');
}
function renderHubGuides(){
  if(!ui.guideGrid)return;
  renderContentFilters('guides',ui.guideFilters);
  var filter=contentState.guides||'all',entries=guideEntries.filter(function(entry){return filter==='all'||entry.type===filter;});
  if(ui.guideCount)ui.guideCount.textContent=entries.length+' 篇笔记';
  ui.guideGrid.innerHTML=entries.map(function(entry){return '<article class="guideCard" style="--card-accent:'+entry.accent+'"><div class="guideCardTop"><span>'+safeText(entry.typeLabel)+'</span><b>'+safeText(entry.tag)+'</b></div><h3>'+safeText(entry.title)+'</h3><p class="guideSummary">'+safeText(entry.summary)+'</p><ol>'+entry.steps.map(function(step){return '<li>'+safeText(step)+'</li>';}).join('')+'</ol></article>';}).join('');
}
function renderHubDispatch(){
  if(!ui.dispatchGrid)return;
  var latest=dispatchEntries[0];
  if(ui.dispatchHero)ui.dispatchHero.innerHTML='<div class="dispatchHeroMain"><div class="dispatchHeroTop"><span style="color:'+latest.accent+'">'+safeText(latest.tag)+'</span><time>'+safeText(latest.date)+'</time></div><h2>'+safeText(latest.title)+'</h2><p>'+safeText(latest.text)+'</p></div><div class="dispatchHeroBullets">'+latest.bullets.map(function(item,index){return '<div><i>0'+(index+1)+'</i><span>'+safeText(item)+'</span></div>';}).join('')+'</div>';
  ui.dispatchGrid.innerHTML=dispatchEntries.slice(1).map(function(entry){return '<article class="dispatchCard" style="--card-accent:'+entry.accent+'"><div class="dispatchCardTop"><span>'+safeText(entry.tag)+'</span><time>'+safeText(entry.date)+'</time></div><h3>'+safeText(entry.title)+'</h3><p>'+safeText(entry.text)+'</p><ul>'+entry.bullets.map(function(item){return '<li>'+safeText(item)+'</li>';}).join('')+'</ul></article>';}).join('');
}
function renderAnnouncement(){
  if(!ui.announcementOverlay)return;
  var latest=dispatchEntries[0];
  if(ui.announcementHero)ui.announcementHero.innerHTML='<div class="announcementTop"><span style="color:'+latest.accent+'">'+safeText(latest.tag)+'</span><time>'+safeText(latest.date)+'</time></div><h2>'+safeText(latest.title)+'</h2><p>'+safeText(latest.text)+'</p><div class="announcementBullets">'+latest.bullets.map(function(item){return '<span>＋ '+safeText(item)+'</span>';}).join('')+'</div>';
  if(ui.announcementList)ui.announcementList.innerHTML=dispatchEntries.slice(1).map(function(entry){return '<article class="announcementItem"><div><span style="color:'+entry.accent+'">'+safeText(entry.tag)+'</span><time>'+safeText(entry.date)+'</time></div><b>'+safeText(entry.title)+'</b><p>'+safeText(entry.text)+'</p></article>';}).join('');
}
function openAnnouncement(){
  renderAnnouncement();
  if(ui.announcementOverlay)ui.announcementOverlay.classList.remove('hidden');
}
function closeAnnouncement(){if(ui.announcementOverlay)ui.announcementOverlay.classList.add('hidden');}
function cloneLoadout(source){
  var result={};source=source||{};
  Object.keys(slotMeta).forEach(function(slot){if(!isSlotUnlocked(slot))return;var item=source[slot],def=item&&itemDefs.find(function(candidate){return candidate.id===item.defId&&candidate.slot===slot;});if(!def)def=itemDefs.find(function(candidate){return candidate.slot===slot&&isItemUnlocked(candidate);});if(def)result[slot]={defId:def.id,rarity:normalizeRarity(item&&item.rarity),level:clamp(Math.floor(Number(item&&item.level)||1),1,6),branch:branchDefinition({defId:def.id,branch:item&&item.branch})?(item&&item.branch):''};});
  return result;
}
function ensureWorkbench(){
  if(!workbench.equipment)workbench.equipment=cloneLoadout(g.equipment);
  if(!workbench.shipId||!shipBlueprints.some(function(bp){return bp.id===workbench.shipId;}))workbench.shipId=profile.selectedShip;
  if(!isSlotUnlocked(workbench.slot))workbench.slot='weapon';
  Object.keys(slotMeta).forEach(function(slot){if(isSlotUnlocked(slot)&&!workbench.equipment[slot]){var def=itemDefs.find(function(candidate){return candidate.slot===slot&&isItemUnlocked(candidate);});if(def)workbench.equipment[slot]={defId:def.id,rarity:'common',level:1};}});
}
function workbenchPreview(){
  ensureWorkbench();
  var build=core.calculateBuild(workbench.equipment),stats=build.stats,previewTraits=build.traits,bp=shipBlueprints.find(function(def){return def.id===workbench.shipId;})||shipBlueprints[0],m=bp.mods,p=profile.protocols||{};
  stats.damage+=m.damage;stats.fireRate*=m.fireRate;stats.maxHp*=m.maxHp;stats.shield*=m.shield;stats.moveLerp*=m.moveLerp;if(bp.id==='lancer')stats.pierce+=1;
  stats.maxHp+=Number(p.hull||0)*8;stats.fireRate*=Math.pow(.96,Number(p.reactor||0));stats.shield+=Number(p.capacitor||0)*10;previewTraits.empMax+=Number(p.capacitor||0);stats.maxShield=stats.shield;
  return {stats:stats,traits:previewTraits,bp:bp};
}
function workbenchSetShip(id){
  var bp=shipBlueprints.find(function(def){return def.id===id;});if(!bp)return false;
  if(profile.unlockedShips.indexOf(id)<0){toast('尚未解锁 · '+bp.unlock);return false;}
  workbench.shipId=id;renderHubWorkbench();beep(720,.05,.025);return true;
}
function workbenchSetSlot(slot){if(!slotMeta[slot])return false;if(!isSlotUnlocked(slot)){toast('需要先升级战术矩阵扩展');return false;}workbench.slot=slot;renderHubWorkbench();return true;}
function workbenchSetItem(defId){
  ensureWorkbench();var def=itemDefs.find(function(candidate){return candidate.id===defId&&candidate.slot===workbench.slot;});if(!def)return false;var current=workbench.equipment[workbench.slot]||{};workbench.equipment[workbench.slot]={defId:def.id,rarity:normalizeRarity(current.rarity),level:clamp(Math.floor(Number(current.level)||1),1,6),branch:current.defId===def.id?current.branch:''};renderHubWorkbench();beep(820,.04,.02);return true;
}
function workbenchSetBranch(branchId){
  ensureWorkbench();var item=workbench.equipment.weapon,branch=(weaponBranchDefs[item.defId]||[]).find(function(option){return option.id===branchId;});if(!branch||item.level<6)return false;item.branch=branch.id;renderHubWorkbench();toast('实验台分支 · '+branch.name);beep(1020,.05,.02);return true;
}
function workbenchCycleRarity(direction){
  ensureWorkbench();var item=workbench.equipment[workbench.slot],rarities=['common','rare','epic','legendary'],index=rarities.indexOf(item.rarity);item.rarity=rarities[(index+(direction||1)+rarities.length)%rarities.length];renderHubWorkbench();return item.rarity;
}
function workbenchAdjustLevel(delta){ensureWorkbench();var item=workbench.equipment[workbench.slot];item.level=clamp(item.level+(delta||1),1,6);renderHubWorkbench();return item.level;}
function saveWorkbenchPreset(index){
  ensureWorkbench();index=Math.floor(Number(index));if(index<0||index>2)return false;profile.presets[index]=serializeLoadout(workbench.equipment);saveProfile();renderLoadoutPresets();renderHubBridge();toast('理论构筑已复制到预设 '+String(index+1).padStart(2,'0'));beep(760,.06,.025);return true;
}
function resetWorkbench(){workbench.equipment=cloneLoadout(g.equipment);workbench.shipId=profile.selectedShip;workbench.slot='weapon';renderHubWorkbench();toast('实验台已回到当前构筑');}
function renderHubWorkbench(){
  if(!ui.workbenchStats||!ui.workbenchItemGrid)return;
  ensureWorkbench();var preview=workbenchPreview(),stats=preview.stats,traits=preview.traits,bp=preview.bp,current=workbench.equipment[workbench.slot],currentDef=getDef(current),pool=itemDefs.filter(function(def){return def.slot===workbench.slot;}),rarity=getRarity(current);
  if(ui.workbenchStatus)ui.workbenchStatus.textContent='预览模式 · '+bp.name+' · 协议已计入';
  ui.workbenchShipPicker.innerHTML=shipBlueprints.map(function(frame){var unlocked=profile.unlockedShips.indexOf(frame.id)>=0;return '<button type="button" class="workbenchShip '+(workbench.shipId===frame.id?'selected':'')+'" '+(unlocked?'':'disabled')+'><b>'+safeText(frame.name)+'</b><small>'+safeText(frame.className)+' · '+(unlocked?'可测试':frame.unlock)+'</small></button>';}).join('');
  ui.workbenchSlotTabs.innerHTML=Object.keys(slotMeta).map(function(slot){var locked=!isSlotUnlocked(slot);return '<button type="button" class="workbenchSlotTab '+(workbench.slot===slot?'active':'')+'" '+(locked?'disabled title="需要战术矩阵扩展"':'')+'><span>'+slotMeta[slot].icon+'</span><b>'+safeText(slotMeta[slot].label)+(locked?' · 🔒':'')+'</b></button>';}).join('');
  var branchOptions=workbench.slot==='weapon'?weaponBranchOptions(current):[];
  ui.workbenchItemGrid.innerHTML='<div class="workbenchCurrent">'+iconMarkup(current,'workbenchCurrentIcon gearIcon small')+'<div><span>当前测试</span><b>'+safeText(currentDef.name)+'</b><small>'+safeText(rarity.label)+' · Lv.'+current.level+(branchDefinition(current)?' · '+safeText(branchDefinition(current).name):'')+'</small></div><div class="workbenchStepper"><button type="button" class="miniBtn" aria-label="降低稀有度">−</button><button type="button" class="miniBtn" aria-label="提高稀有度">稀有度</button><button type="button" class="miniBtn" aria-label="提高等级">Lv +</button></div></div>'+(branchOptions.length?'<div class="workbenchBranches"><span>满级分支预览</span><div>'+branchOptions.map(function(option){return '<button type="button" class="branchMini '+(current.branch===option.id?'active':'')+'"><b>'+safeText(option.name)+'</b><small>'+safeText(option.desc)+'</small></button>';}).join('')+'</div></div>':'')+'<div class="workbenchItemChoices">'+pool.filter(isItemUnlocked).map(function(def){var active=def.id===current.defId;return '<button type="button" class="workbenchItem '+(active?'selected':'')+'">'+iconMarkup({defId:def.id,rarity:current.rarity,level:1},'tiny')+'<b>'+safeText(def.name)+'</b><small>'+safeText(def.desc)+'</small></button>';}).join('')+'</div>';
  ui.workbenchStats.innerHTML=[['理论 DPS',Math.round(core.weaponDps(stats,traits)),'cyan'],['单发伤害',Math.round(stats.damage),'violet'],['副武器',traits.auxMode?traits.auxLabel:'未装备','green'],['生命上限',Math.round(stats.maxHp),'green'],['护盾容量',Math.round(stats.shield),'gold'],['穿透次数',Math.round(stats.pierce),'pink'],['暴击率',Math.round(stats.crit*100)+'%','orange']].map(function(metric){return '<div class="workbenchMetric '+metric[2]+'"><span>'+metric[0]+'</span><b>'+metric[1]+'</b></div>';}).join('');
  var activeSynergies=traits.synergies||[],synergyText=activeSynergies.length?activeSynergies.map(function(name){return '<span class="workbenchSynergyChip">'+safeText(name)+'</span>';}).join(''):'<span class="workbenchMuted">尚未触发组合 · 试试相位长矛 + 引力锚</span>';
  var tagText=(traits.buildTagLabels||[]).map(function(label){return '<span class="buildTagChip">'+safeText(label)+'</span>';}).join('')||'<span class="workbenchMuted">还没有形成明确标签</span>';
  ui.workbenchSynergy.innerHTML='<div class="workbenchSynergyHead"><span>BUILD IDENTITY</span><b>'+activeSynergies.length+' 联动 · '+(traits.buildTagLabels||[]).length+' 标签</b></div><div class="workbenchTagList">'+tagText+'</div><div class="workbenchSynergyList">'+synergyText+'</div><p>标签会改变掉落比较与行为联动；战术矩阵扩展可解锁第六模组槽。复制到预设后，仍需在机库装载才会影响下一局。</p>';
  if(ui.workbenchBlueprints){
    var blueprintViews={'relay-drone':'signals','lab-beam':'lab','salvage-mine':'salvage'};
    ui.workbenchBlueprints.innerHTML='<div class="workbenchBlueprintHead"><div><span>BLUEPRINT PIPELINE</span><b>副武器解锁链</b></div><small>短局成绩会直接扩展主战斗掉落池</small></div><div class="blueprintCardList">'+blueprintDefs.map(function(def){var value=blueprintProgress(def),unlocked=hasBlueprint(def.id),pct=Math.round(clamp(value,0,def.target)/def.target*100),itemDef=itemDefs.find(function(item){return item.id===def.itemId;}),view=blueprintViews[def.id]||'signals',accent=(itemDef&&itemDef.tags&&buildTagMeta[itemDef.tags[0]]&&buildTagMeta[itemDef.tags[0]].color)||'#72f4ff';return '<article class="blueprintCard '+(unlocked?'unlocked':'locked')+'" style="--blueprint-accent:'+accent+'"><div class="blueprintCardTop"><span>'+safeText(def.source)+' / BLUEPRINT</span><b>'+(unlocked?'已装入掉落池':'待解锁')+'</b></div><div class="blueprintCardBody">'+iconMarkup({defId:def.itemId,rarity:'common',level:1},'tiny')+'<div><h4>'+safeText(itemDef?itemDef.name:def.name)+'</h4><p>'+safeText(def.desc)+'</p></div></div><div class="blueprintProgress"><i style="width:'+pct+'%"></i></div><div class="blueprintCardFoot"><span>'+Math.min(value,def.target)+' / '+def.target+' '+safeText(def.unit)+'</span>'+(unlocked?'<em>可在副武器槽测试</em>':'<button type="button" data-blueprint-view="'+view+'">前往'+safeText(def.source)+' →</button>')+'</div></article>';}).join('')+'</div>';
    ui.workbenchBlueprints.querySelectorAll('button[data-blueprint-view]').forEach(function(button){button.addEventListener('click',function(){setHubView(button.dataset.blueprintView);});});
  }
  ui.workbenchPresetActions.innerHTML='<div><span>保存实验结果</span><small>复制到一个空闲预设，不替换当前出击</small></div><div class="workbenchPresetButtons"><button type="button" class="miniBtn">预设 01</button><button type="button" class="miniBtn">预设 02</button><button type="button" class="miniBtn">预设 03</button></div>';
  if(ui.workbenchShipPicker.querySelectorAll)ui.workbenchShipPicker.querySelectorAll('button').forEach(function(button,index){button.addEventListener('click',function(){workbenchSetShip(shipBlueprints[index].id);});});
  if(ui.workbenchSlotTabs.querySelectorAll)ui.workbenchSlotTabs.querySelectorAll('button').forEach(function(button,index){button.addEventListener('click',function(){workbenchSetSlot(Object.keys(slotMeta)[index]);});});
  if(ui.workbenchItemGrid.querySelectorAll){var visiblePool=pool.filter(isItemUnlocked),itemButtons=ui.workbenchItemGrid.querySelectorAll('.workbenchItem');itemButtons.forEach(function(button,index){button.addEventListener('click',function(){workbenchSetItem(visiblePool[index].id);});});var branchButtons=ui.workbenchItemGrid.querySelectorAll('.branchMini');branchButtons.forEach(function(button,index){button.addEventListener('click',function(){workbenchSetBranch(branchOptions[index].id);});});var stepButtons=ui.workbenchItemGrid.querySelectorAll('.workbenchStepper button');if(stepButtons[0])stepButtons[0].addEventListener('click',function(){workbenchCycleRarity(-1);});if(stepButtons[1])stepButtons[1].addEventListener('click',function(){workbenchCycleRarity(1);});if(stepButtons[2])stepButtons[2].addEventListener('click',function(){workbenchAdjustLevel(1);});}
  if(ui.workbenchPresetActions.querySelectorAll)ui.workbenchPresetActions.querySelectorAll('button').forEach(function(button,index){button.addEventListener('click',function(){saveWorkbenchPreset(index);});});
}
function selectShip(id){
  var bp=shipBlueprints.find(function(def){return def.id===id;});if(!bp)return;
  if(profile.unlockedShips.indexOf(id)<0){toast('尚未解锁 · '+bp.unlock);return;}
  profile.selectedShip=id;saveProfile();resetRun();renderHubBridge();renderHubArmory();toast('机体已切换 · '+bp.name);beep(720,.05,.025);
}
function renderHubRoutes(){
  ui.routeGrid.innerHTML='';
  routeDefs.forEach(function(route){var card=document.createElement('button');card.type='button';card.className='routeCard'+(profile.selectedRoute===route.id?' selected':'');card.innerHTML='<span class="routeArt" style="background-image:url('+route.art+')"></span><span class="routeTag" style="border-color:'+route.color+';color:'+route.color+'">'+route.tag+'</span><span class="routeRisk">'+route.risk+'</span><h3>'+safeText(route.name)+'</h3><p>'+safeText(route.desc)+'</p>';card.addEventListener('click',function(){selectRoute(route.id);});ui.routeGrid.appendChild(card);});
  var route=selectedRoute(),map=ensureRoutePlan(),plan=profile.routePlan;
  if(ui.routeSeedLabel)ui.routeSeedLabel.textContent=String(map.seed);
  if(ui.routeMapStatus)ui.routeMapStatus.textContent='已规划 '+map.stages.length+' 段 · 点击任意节点改写本局路线';
  if(ui.routeMap){
    ui.routeMap.innerHTML=map.stages.map(function(stage){
      var selectedId=plan.ids[stage.index];
      return '<section class="starStage"><div class="starStageHead"><span>STAGE '+String(stage.index+1).padStart(2,'0')+'</span><b>'+safeText(stage.index===0?'出发窗口':stage.index===map.stages.length-1?'终点闸门':'航线分岔')+'</b></div><div class="starNodeGrid">'+stage.nodes.map(function(node){var def=starNodeDefs[node.type]||starNodeDefs.combat,selected=node.id===selectedId;return '<button type="button" class="starNode '+(selected?'selected':'')+'" data-stage="'+stage.index+'" data-node="'+safeText(node.id)+'" style="--node-accent:'+def.accent+'"><span class="starNodeIcon">'+def.icon+'</span><span class="starNodeCopy"><b>'+safeText(def.label)+'</b><small>'+safeText(def.tag)+' · '+safeText(def.desc)+'</small></span><i class="starNodeMark">'+(selected?'已选':'选择')+'</i></button>';}).join('')+'</div></section>';
    }).join('');
    ui.routeMap.querySelectorAll('button.starNode').forEach(function(button){button.addEventListener('click',function(){selectRouteNode(Number(button.dataset.stage),button.dataset.node);});});
  }
  var current=selectedRouteNode(0),currentDef=starNodeDefs[current.type]||starNodeDefs.combat;
  ui.routeBrief.innerHTML='<div class="routeBriefHead"><b>'+safeText(route.name)+' · '+safeText(currentDef.label)+'</b><span style="color:'+route.color+'">'+safeText(route.risk)+'</span></div><div class="routeNodeStrip">'+map.stages.map(function(stage,index){var node=routeNodeForStage(index,map,plan.ids),def=starNodeDefs[node.type]||starNodeDefs.combat;return '<span class="'+(index===0?'done ':'')+(index===map.stages.length-1?'boss':'')+'"><i style="border-color:'+def.accent+';color:'+def.accent+'">'+String(index+1).padStart(2,'0')+'</i><b>'+safeText(def.label)+'</b></span>';}).join('')+'</div><p>'+safeText(route.brief)+' 当前入口：'+safeText(currentDef.desc)+'  ·  种子会固定这次远征的节点组合。</p>';
}
function selectRouteNode(stage,id){var map=ensureRoutePlan(),node=routeNodeById(map,id);if(!node||!profile.routePlan)return false;profile.routePlan.ids[stage]=node.id;saveProfile();renderHubRoutes();renderHubBridge();toast('第 '+String(stage+1).padStart(2,'0')+' 段已改为 · '+(starNodeDefs[node.type]||starNodeDefs.combat).label);beep(680,.05,.025);return true;}
function rerollRouteSeed(){profile.pendingSeed=makeRunSeed();profile.routePlan=null;saveProfile();renderHubRoutes();renderHubBridge();toast('已生成新的远征种子 · 重新规划路线');beep(860,.06,.025);}
function selectRoute(id){var route=routeDefs.find(function(def){return def.id===id;});if(!route)return;profile.selectedRoute=id;profile.routePlan=null;saveProfile();g.route=route;g.routeMod=route.mods;renderHubRoutes();renderHubBridge();toast('航线已设为 · '+route.name);beep(580,.05,.025);}
function renderHubArchive(){
  ui.hubArchiveGrid.innerHTML='';
  enemyOrder.forEach(function(id){var def=enemyDefs[id],card=document.createElement('article');card.className='hubArchiveCard';card.innerHTML='<div class="archiveMiniArt" style="'+enemyStyle(def)+'"></div><b style="color:'+def.color+'">'+safeText(def.name)+'</b><div class="threatMeta">'+threatMetaMarkup(def)+'</div><p>'+safeText(def.desc)+'</p>';ui.hubArchiveGrid.appendChild(card);});
  bossDefs.forEach(function(def){var card=document.createElement('article');card.className='hubArchiveCard';card.innerHTML='<div class="archiveMiniArt" style="'+bossStyle(def)+'"></div><b style="color:'+def.color+'">'+safeText(def.name)+'</b><div class="threatMeta">'+threatMetaMarkup(def)+'</div><p>'+safeText(def.desc)+'</p>';ui.hubArchiveGrid.appendChild(card);});
}
function renderHubChallenges(){
  var challenges=[
    {name:'初次突破',desc:'抵达第 5 波并击破首个 Boss。',value:bestWave,max:5,reward:'+10 星尘'},
    {name:'回收协议',desc:'累计击毁 100 架敌机，把战斗转成成长。',value:profile.totalKills,max:100,reward:'+12 星尘'},
    {name:'深空猎手',desc:'抵达第 3 波，解锁相位长枪。',value:bestWave,max:3,reward:'解锁机体'},
    {name:'三相舰队',desc:'收集全部三种机体，完成指挥官档案。',value:profile.unlockedShips.length,max:3,reward:'+15 星尘'},
    {name:'连杀协议',desc:'在不被击中的节奏里维持连杀，冲上 12 倍率。',value:profile.bestCombo||0,max:12,reward:'+8 星尘'},
    {name:'黑盒全解',desc:'完成黑盒解码七层线路战役。',value:profile.blackboxClears||0,max:1,reward:'+12 星尘'}
  ];
  ui.challengeGrid.innerHTML=challenges.map(function(c){var pct=Math.round(clamp(c.value/c.max,0,1)*100);return '<article class="challengeCard"><h3>'+c.name+'</h3><p>'+c.desc+'</p><div class="challengeBar"><i style="width:'+pct+'%"></i></div><div class="challengeMeta"><span>'+Math.min(c.value,c.max)+' / '+c.max+'</span><b>'+c.reward+'</b></div></article>';}).join('');
}
function updateRelayUI(){
  if(!ui.relayBoard)return;
  relay.stage=Math.min(3,Math.floor((45-relay.timeLeft)/15)+1);
  ui.relayTimer.textContent=Math.max(0,relay.timeLeft)+'s';ui.relayScore.textContent=relay.score;ui.relayStreak.textContent=relay.streak;ui.relayBest.textContent=profile.relayBest||0;
  if(ui.relaySector)ui.relaySector.textContent=String(relay.stage).padStart(2,'0')+' / 03';
  if(ui.relayMisses)ui.relayMisses.textContent=relay.misses;
  ui.relayStatus.textContent=relay.running?(relay.phase==='draft'?'UPGRADE / CHOOSE':'PHASE '+relay.stage+' / INTERCEPT'):'待命';ui.relayBoard.classList.toggle('active',relay.running);ui.relayBoard.classList.toggle('stageTwo',relay.stage===2);ui.relayBoard.classList.toggle('stageThree',relay.stage===3);ui.relayStartBtn.disabled=relay.running;ui.relayStartBtn.textContent=relay.running?'中继进行中 · 阶段 '+relay.stage:'启动随机拦截赛';
  ui.relayHint.textContent=relay.running?(relay.phase==='draft'?'频道切换 · 选一项协议升级后继续': '青色捕获 · 金色缓存 · 红色诱饵 · 连击越高分数越高'):'每 15 秒升级一次接收协议；三阶段目标速度与诱饵密度递增';
  renderRelayDraft();
}
function renderRelayDraft(){
  if(!ui.relayDraft)return;ui.relayDraft.classList.toggle('hidden',!relay.running||relay.phase!=='draft');ui.relayDraft.innerHTML='';
  if(!relay.running||relay.phase!=='draft')return;
  ui.relayDraft.innerHTML='<b>第 '+relay.stage+' 频道 · 选择接收协议</b><div class="arcadeDraftCards"></div>';
  var host=ui.relayDraft.querySelectorAll('.arcadeDraftCards')[0];
  relay.offers.forEach(function(def){var card=document.createElement('button');card.type='button';card.className='arcadeDraftCard';card.style.setProperty('--draft-accent',def.accent);card.innerHTML='<strong>'+safeText(def.name)+'</strong><span>'+safeText(def.desc)+'</span>';card.addEventListener('click',function(){chooseRelayUpgrade(def.id);});host.appendChild(card);});
}
function prepareRelayDraft(){relay.phase='draft';clearRelayTarget();relay.offers=arcadeGen.offerChoices(relayUpgradeDefs,'relay|'+relay.seed+'|'+relay.stage,3,relay.upgrades);updateRelayUI();}
function chooseRelayUpgrade(id){
  if(!relay.running||relay.phase!=='draft')return false;var def=relay.offers.find(function(item){return item.id===id;});if(!def)return false;
  relay.upgrades.push(id);if(id==='wideband')relay.windowBonus+=260;else if(id==='cache')relay.cacheBonus+=.08;else if(id==='combo')relay.scoreMult+=.18;else if(id==='amplifier')relay.signalBonus+=5;else if(id==='guard')relay.streakGuard++;
  relay.phase='run';relay.offers=[];updateRelayUI();spawnRelayTarget();toast('中继协议接入 · '+def.name);beep(880,.06,.025);return true;
}
function clearRelayTarget(){
  if(relay.targetTimer)relayRuntime.clearTimeout(relay.targetTimer);relay.targetTimer=0;
  if(relay.target){if(relay.target.parentNode)relay.target.parentNode.removeChild(relay.target);else if(relay.target.remove)relay.target.remove();relay.target=null;}
}
function spawnRelayTarget(){
  if(!relay.running||relay.phase!=='run'||!ui.relayBoard)return;
  clearRelayTarget();var target=document.createElement('button'),roll=Math.random(),jammerChance=relay.stage===3?.23:.14,cacheChance=Math.min(.4,.16+relay.cacheBonus),kind=roll<cacheChance?'cache':roll>1-jammerChance?'jammer':'signal';target.type='button';target.className='relayTarget '+(kind==='cache'?'relayTargetCache':kind==='jammer'?'relayTargetJammer':'relayTargetSignal');target.textContent=kind==='cache'?'◆':kind==='jammer'?'×':'◎';target.setAttribute('aria-label',kind==='cache'?'捕获高值缓存':kind==='jammer'?'识别并避开诱饵脉冲':'捕获信号节点');
  var size=clamp(48-relay.hits*.14-(relay.stage-1)*4,27,48);target.style.width=size+'px';target.style.height=size+'px';target.style.left=(10+Math.random()*80)+'%';target.style.top=(14+Math.random()*72)+'%';
  target.addEventListener('click',function(){if(!relay.running||relay.target!==target)return;
    if(kind==='jammer'){relay.misses++;if(relay.streakGuard>0){relay.streakGuard--;toast('隔离防火墙吸收了诱饵脉冲');}else{relay.streak=0;relay.score=Math.max(0,relay.score-12*relay.stage);toast('诱饵脉冲 · 连击中断');}arcadeFeedback('relay','error',relay.misses);}
    else{relay.hits++;relay.streak++;var multiplier=(1+Math.min(15,Math.floor(relay.streak/3))*.1)*relay.scoreMult;relay.score+=Math.round(((kind==='cache'?32:12+Math.min(24,relay.streak)*2)+(kind==='signal'?relay.signalBonus:0))*multiplier);if(kind==='cache'){relay.caches++;arcadeFeedback('relay','cache',relay.caches);}else arcadeFeedback('relay','hit',relay.streak);}
    clearRelayTarget();updateRelayUI();spawnRelayTarget();
  });
  relay.target=target;ui.relayBoard.appendChild(target);
  var lifetime=Math.max(850,2600-(relay.stage-1)*470+relay.windowBonus);function expireRelayTarget(){if(!relay.running||relay.target!==target)return;if(document.hidden){relay.targetTimer=relayRuntime.setTimeout(expireRelayTarget,500);return;}relay.misses++;if(relay.streakGuard>0)relay.streakGuard--;else{relay.streak=0;relay.score=Math.max(0,relay.score-5*relay.stage);}arcadeFeedback('relay','miss',relay.misses);clearRelayTarget();updateRelayUI();spawnRelayTarget();}relay.targetTimer=relayRuntime.setTimeout(expireRelayTarget,lifetime);
}
function startRelay(){
  if(relay.running)return;
  stopLab(true);stopSalvage(true);stopBlackbox(true);relayRuntime.clearAll();relay.running=true;relay.phase='run';relay.seed=makeRunSeed();relay.offers=[];relay.upgrades=[];relay.windowBonus=0;relay.cacheBonus=0;relay.scoreMult=1;relay.signalBonus=0;relay.streakGuard=0;relay.score=0;relay.hits=0;relay.misses=0;relay.streak=0;relay.caches=0;relay.timeLeft=45;relay.stage=1;var mastery=activeArcadeMastery('relay');relay.masteryId=mastery&&mastery.id||null;if(relay.masteryId==='wideband')relay.windowBonus=320;if(relay.masteryId==='cache')relay.cacheBonus=.08;clearRelayTarget();spawnRelayTarget();updateRelayUI();
  relay.interval=relayRuntime.setInterval(function(){if(!relay.running||relay.phase==='draft'||document.hidden)return;relay.timeLeft--;relay.stage=Math.min(3,Math.floor((45-relay.timeLeft)/15)+1);updateRelayUI();if(relay.timeLeft<=0)finishRelay();else if(relay.timeLeft===30||relay.timeLeft===15)prepareRelayDraft();},1000);renderArcadeMastery('relay');arcadeFeedback('relay','start');
}
function finishRelay(){
  if(!relay.running)return;
  relay.stage=Math.min(3,Math.floor((45-Math.max(0,relay.timeLeft))/15)+1);relayRuntime.clearAll();relay.interval=0;relay.running=false;relay.phase='idle';clearRelayTarget();var masteryBefore=arcadeMasteryUnlockCount('relay');profile.relayRuns++;profile.relayHits+=relay.hits;var cleared=relay.timeLeft<=0&&relay.stage===3;if(cleared)profile.relayClears++;var masteryAfter=arcadeMasteryUnlockCount('relay');
  var record=relay.score>(profile.relayBest||0);if(record)profile.relayBest=relay.score;var shardGain=Math.max(1,Math.floor(relay.score/90));profile.shards+=shardGain;advanceDailyDirective('relay',relay.hits);var blueprintGain=syncBlueprintUnlocks(true);var stationGain=grantActivityReward('relay',{hits:relay.hits});var masteryChoice=arcadeMasteryDefs.relay.choices[masteryBefore];pushChronicle({type:'relay',title:cleared?'三段信号全捕获':record?'中继新纪录':'中继记录',subtitle:'NEON RELAY · 捕获 '+relay.hits+' · 诱饵/漏接 '+relay.misses+' · 协议 '+relay.upgrades.map(function(id){var def=relayUpgradeDefs.find(function(item){return item.id===id;});return def?def.name:id;}).join('、')+' · '+(cleared?'全阶段完成':'阶段 '+relay.stage)+(relay.masteryId?' · 精通 '+(arcadeMasteryDefs.relay.choices.find(function(item){return item.id===relay.masteryId;})||{}).name:'')+(stationGain?' · '+stationGain:'')+(blueprintGain.length?' · 蓝图 +'+blueprintGain.length:''),score:relay.score,hits:relay.hits,misses:relay.misses,sector:relay.stage,seed:relay.seed,upgrades:relay.upgrades.slice(),mastery:relay.masteryId,cleared:cleared,shards:shardGain});saveProfile();syncUnlocks();updateRelayUI();renderArcadeMastery('relay');renderHubSignals();renderHubChronicle();renderHubBridge();renderHubProtocols();renderArcadeLanding();toast(cleared?'信号中继通关 · 新纪录 '+relay.score+' · 星尘 +'+shardGain:record?'信号中继新纪录 · '+relay.score+' · 星尘 +'+shardGain:'信号中继结束 · 得分 '+relay.score+' · 星尘 +'+shardGain);if(masteryAfter>masteryBefore&&masteryChoice)toast('精通解锁 · '+masteryChoice.name+' · 可在下一局前装备');arcadeFeedback('relay',cleared?'clear':'miss',relay.score);
}
function stopRelay(silent){
  relayRuntime.clearAll();relay.interval=0;var wasRunning=relay.running;relay.running=false;relay.phase='idle';relay.offers=[];clearRelayTarget();updateRelayUI();renderArcadeMastery('relay');if(wasRunning&&!silent)toast('信号中继已中止');
}
function clearLabTimers(){
  labRuntime.clearAll();lab.clock=0;lab.sequenceTimer=0;
}
function renderLabNodes(){
  if(!ui.labNodes)return;
  if(!Array.isArray(lab.nodes))lab.nodes=[];
  if(lab.nodes.length!==lab.size){
    lab.nodes=[];ui.labNodes.innerHTML='';
    ui.labNodes.style.gridTemplateColumns='repeat('+(lab.size===16?4:3)+',minmax(0,1fr))';
    for(var i=0;i<lab.size;i++){
      var node=document.createElement('button');node.type='button';node.className='labNode';node.textContent=String(i+1).padStart(2,'0');node.setAttribute('aria-label','回声节点 '+(i+1));
      (function(index){node.addEventListener('click',function(){handleLabNode(index);});})(i);
      lab.nodes.push(node);ui.labNodes.appendChild(node);
    }
  }
  lab.nodes.forEach(function(node,index){
    node.disabled=!(lab.running&&lab.phase==='input');
    node.classList.toggle('flash',lab.running&&lab.flashIndex===index);
    node.classList.toggle('decoy',lab.running&&lab.flashIndex===index&&lab.flashType==='decoy');
    node.classList.toggle('ready',lab.running&&lab.phase==='input');
  });
}
function updateLabUI(){
  if(!ui.labBoard)return;
  ui.labTimer.textContent=Math.max(0,lab.timeLeft)+'s';ui.labRound.textContent=lab.round+' · 无尽';ui.labScore.textContent=lab.score;ui.labBest.textContent=profile.labBest||0;
  if(ui.labStage)ui.labStage.textContent='规则 '+String(lab.stage).padStart(2,'0');if(ui.labLives)ui.labLives.textContent='♥ '.repeat(Math.max(0,lab.lives)).trim()||'0';
  var ruleNames={forward:'正序回放',reverse:'逆序回放',split:'先奇后偶',shift:'首位移到末尾'};
  var status=lab.running?(lab.phase==='draft'?'CHOOSE / PROTOCOL':lab.phase==='memorize'?'READ / '+(ruleNames[lab.rule]||'回声规则'):lab.phase==='input'?'REPEAT / '+(ruleNames[lab.rule]||'回声规则'):'LIVE'):(lab.phase==='idle'?'待命':lab.phase==='timeout'?'信号耗尽':lab.phase==='clear'?'试炼完成':'实验结束');
  ui.labStatus.textContent=status;ui.labBoard.classList.toggle('active',lab.running);ui.labBoard.classList.toggle('inputMode',lab.running&&lab.phase==='input');ui.labBoard.classList.toggle('wide',lab.size===16);ui.labStartBtn.disabled=lab.running;ui.labStartBtn.textContent=lab.running?'试炼进行中 · '+lab.timeLeft+'s':'开始 120 秒无尽试炼';
  var rule=ruleNames[lab.rule]||'正序回放',hint=lab.phase==='memorize'?'观察序列 · '+rule+' · 第 '+lab.round+' 轮'+(lab.round>=7?' · 忽略紫色干扰':''):lab.phase==='input'?'执行 '+rule+' · '+lab.inputIndex+' / '+lab.inputSequence.length+(lab.round>=7?' · 忽略紫色干扰':''):lab.phase==='draft'?'连续完成三轮 · 选择一项认知协议':lab.phase==='success'?'序列正确 · 准备下一轮':lab.phase==='failed'?'容错生命耗尽 · 重新启动试炼':lab.phase==='timeout'?'两分钟结束 · 成绩已归档':lab.phase==='clear'?'无尽试炼完成 · 研究已写入档案':'120 秒生存记忆试炼 · 规则顺序每局变化';
  ui.labHint.textContent=hint;renderLabNodes();
  renderLabDraft();
}
function renderLabDraft(){
  if(!ui.labDraft)return;ui.labDraft.classList.toggle('hidden',!lab.running||lab.phase!=='draft');ui.labDraft.innerHTML='';if(!lab.running||lab.phase!=='draft')return;
  ui.labDraft.innerHTML='<b>阶段 '+lab.stage+' 完成 · 选择一项认知协议</b><div class="arcadeDraftCards"></div>';var host=ui.labDraft.querySelectorAll('.arcadeDraftCards')[0];
  lab.offers.forEach(function(def){var card=document.createElement('button');card.type='button';card.className='arcadeDraftCard';card.style.setProperty('--draft-accent',def.accent);card.innerHTML='<strong>'+safeText(def.name)+'</strong><span>'+safeText(def.desc)+'</span>';card.addEventListener('click',function(){chooseLabPerk(def.id);});host.appendChild(card);});
}
function chooseLabPerk(id){
  if(!lab.running||lab.phase!=='draft')return false;var def=lab.offers.find(function(item){return item.id===id;});if(!def)return false;
  lab.perks.push(id);if(id==='lens')lab.flashBonus+=75;else if(id==='buffer')lab.lives=Math.min(5,lab.lives+1);else if(id==='scorer')lab.scoreMult+=.2;else if(id==='recall')lab.recallCharge=(lab.recallCharge||0)+1;
  lab.phase='success';lab.offers=[];updateLabUI();lab.sequenceTimer=labRuntime.setTimeout(function(){if(lab.running)beginLabRound();},260);toast('认知协议接入 · '+def.name);beep(880,.06,.025);return true;
}
function showLabSequence(index,token){
  if(!lab.running||token!==lab.token)return;
  if(document.hidden){lab.sequenceTimer=labRuntime.setTimeout(function(){showLabSequence(index,token);},250);return;}
  if(index>=lab.displaySequence.length){lab.flashIndex=-1;lab.flashType='signal';lab.phase='input';lab.sequenceTimer=0;updateLabUI();return;}
  var cue=lab.displaySequence[index];lab.flashIndex=cue.index;lab.flashType=cue.decoy?'decoy':'signal';updateLabUI();
  lab.sequenceTimer=labRuntime.setTimeout(function(){
    if(!lab.running||token!==lab.token)return;
    lab.flashIndex=-1;updateLabUI();
    lab.sequenceTimer=labRuntime.setTimeout(function(){showLabSequence(index+1,token);},150);
  },Math.max(220,430+lab.flashBonus-Math.max(0,lab.round-4)*8));
}
function beginLabRound(){
  if(!lab.running)return;
  lab.round++;lab.stage=Math.ceil(lab.round/3);lab.size=lab.round>=10?16:9;lab.rule=lab.ruleOrder[Math.floor((lab.round-1)/3)%lab.ruleOrder.length];var generated=arcadeGen.generateLabRound(lab.seed,lab.round,lab.size,lab.rule);lab.sequence=generated.sequence;lab.inputSequence=generated.inputSequence;lab.displaySequence=generated.displaySequence;
  lab.inputIndex=0;lab.flashIndex=-1;lab.flashType='signal';lab.phase='memorize';lab.token++;updateLabUI();showLabSequence(0,lab.token);
}
function startLab(){
  if(lab.running)return;
  stopRelay(true);stopSalvage(true);stopBlackbox(true);clearLabTimers();lab.running=true;lab.phase='idle';lab.seed=makeRunSeed();lab.ruleOrder=arcadeGen.ruleOrder(lab.seed);lab.perks=[];lab.offers=[];lab.scoreMult=1;lab.flashBonus=0;lab.recallCharge=0;lab.sequence=[];lab.displaySequence=[];lab.inputSequence=[];lab.inputIndex=0;lab.round=0;lab.stage=1;lab.size=9;lab.score=0;lab.timeLeft=120;lab.flashIndex=-1;lab.solved=0;lab.lives=3;lab.mistakes=0;var mastery=activeArcadeMastery('lab');lab.masteryId=mastery&&mastery.id||null;if(lab.masteryId==='slowflash')lab.flashBonus=100;if(lab.masteryId==='extraheart')lab.lives=4;lab.token++;updateLabUI();
  lab.clock=labRuntime.setInterval(function(){if(!lab.running||lab.phase==='draft'||document.hidden)return;lab.timeLeft--;updateLabUI();if(lab.timeLeft<=0)finishLab('clear');},1000);beginLabRound();renderArcadeMastery('lab');arcadeFeedback('lab','start');
}
function handleLabNode(index){
  if(!lab.running||lab.phase!=='input')return;
  if(index!==lab.inputSequence[lab.inputIndex]){lab.mistakes++;var buffered=lab.recallCharge>0;if(buffered)lab.recallCharge--;else lab.lives--;lab.score=Math.max(0,lab.score-15);arcadeFeedback('lab','error',lab.mistakes);if(lab.lives<=0){finishLab('sequence');return;}lab.inputIndex=0;lab.phase='memorize';lab.flashIndex=-1;lab.token++;updateLabUI();var retryToken=lab.token;lab.sequenceTimer=labRuntime.setTimeout(function(){showLabSequence(0,retryToken);},420);toast(buffered?'输入偏差 · 缓存抵消伤害 · 重播本轮':'输入偏差 · 生命 -1 · 重播本轮');return;}
  lab.inputIndex++;arcadeFeedback('lab','hit',index);
  if(lab.inputIndex>=lab.inputSequence.length){lab.solved++;lab.score+=Math.round((lab.sequence.length*10+lab.round*5+lab.lives*3)*lab.scoreMult);lab.phase='success';lab.flashIndex=index;arcadeFeedback('lab','clear',lab.round);updateLabUI();if(lab.round%3===0){lab.phase='draft';lab.offers=arcadeGen.offerChoices(labPerkDefs,'lab|'+lab.seed+'|'+lab.stage,3,[]);updateLabUI();return;}lab.sequenceTimer=labRuntime.setTimeout(function(){if(lab.running)beginLabRound();},380);return;}
  updateLabUI();
}
function finishLab(reason){
  if(!lab.running)return;
  clearLabTimers();lab.running=false;lab.phase=reason==='clear'?'clear':reason==='time'?'timeout':'failed';lab.flashIndex=-1;lab.flashType='signal';
  var masteryBefore=arcadeMasteryUnlockCount('lab');profile.labRuns++;profile.labSolved+=lab.solved;profile.labBestStage=Math.max(profile.labBestStage||0,lab.stage);if(reason==='clear')profile.labClears++;var masteryAfter=arcadeMasteryUnlockCount('lab');var record=lab.score>=(profile.labBest||0);if(record)profile.labBest=lab.score;var shardGain=Math.max(1,Math.floor(lab.score/110)+Math.floor(lab.solved/4)+(reason==='clear'?5:0));profile.shards+=shardGain;
  advanceDailyDirective('lab',lab.solved);var blueprintGain=syncBlueprintUnlocks(true);var stationGain=grantActivityReward('lab',{solved:lab.solved});var masteryChoice=arcadeMasteryDefs.lab.choices[masteryBefore];pushChronicle({type:'lab',title:reason==='clear'?'无尽试炼完成':record?'实验新纪录':'实验记录',subtitle:'ECHO LAB · 完成 '+lab.solved+' 轮 · '+lab.mistakes+' 次失误 · 规则 '+lab.ruleOrder.map(function(id){return({forward:'正序',reverse:'逆序',split:'奇偶',shift:'首尾轮转'})[id]||id;}).join('→')+' · 强化 '+lab.perks.map(function(id){var def=labPerkDefs.find(function(item){return item.id===id;});return def?def.name:id;}).join('、')+(lab.masteryId?' · 精通 '+(arcadeMasteryDefs.lab.choices.find(function(item){return item.id===lab.masteryId;})||{}).name:'')+(stationGain?' · '+stationGain:'')+(blueprintGain.length?' · 蓝图 +'+blueprintGain.length:''),score:lab.score,round:lab.round,solved:lab.solved,stage:lab.stage,mistakes:lab.mistakes,seed:lab.seed,ruleOrder:lab.ruleOrder.slice(),perks:lab.perks.slice(),mastery:lab.masteryId,cleared:reason==='clear',shards:shardGain});saveProfile();syncUnlocks();updateLabUI();renderArcadeMastery('lab');renderHubSignals();renderHubChronicle();renderHubBridge();renderHubProtocols();renderArcadeLanding();toast(reason==='clear'?'120 秒试炼完成 · 得分 '+lab.score+' · 星尘 +'+shardGain:record?'回声实验新纪录 · '+lab.score+' · 星尘 +'+shardGain:'回声实验结束 · 完成 '+lab.solved+' 轮 · 星尘 +'+shardGain);if(masteryAfter>masteryBefore&&masteryChoice)toast('精通解锁 · '+masteryChoice.name+' · 可在下一局前装备');arcadeFeedback('lab',reason==='clear'?'clear':'error',lab.score);
}
function stopLab(silent){
  var wasRunning=lab.running;clearLabTimers();lab.running=false;lab.phase='idle';lab.sequence=[];lab.displaySequence=[];lab.inputSequence=[];lab.inputIndex=0;lab.round=0;lab.stage=1;lab.size=9;lab.score=0;lab.timeLeft=120;lab.flashIndex=-1;lab.solved=0;lab.lives=3;lab.mistakes=0;lab.offers=[];lab.token++;updateLabUI();renderArcadeMastery('lab');if(wasRunning&&!silent)toast('回声实验已中止');
}
function clearSalvageTimer(){salvageRuntime.clearAll();salvage.clock=0;}
function selectedSalvageContract(){return salvageContractDefs.find(function(def){return def.id===salvage.contract;})||salvageContractDefs[0];}
function salvageContractValue(){return salvage.contract==='cache'?salvage.caches:salvage.contract==='data'?salvage.data:salvage.contract==='cargo'?salvage.collected:salvage.contract==='relic'?salvage.relics:salvage.caches;}
function salvageContractComplete(){return salvage.contract==='ghost'?salvage.heat<=2&&salvage.caches>=1:salvageContractValue()>=selectedSalvageContract().goal;}
function selectSalvageContract(id){if(salvage.running)return false;var def=salvageContractDefs.find(function(item){return item.id===id;});if(!def)return false;profile.salvageContract=id;salvage.contract=id;saveProfile();updateSalvageUI();toast('打捞委托已选择 · '+def.name);return true;}
function renderSalvageContracts(){if(!ui.salvageContractPicker)return;ui.salvageContractPicker.innerHTML='';salvageContractDefs.forEach(function(def){var button=document.createElement('button');button.type='button';button.className='salvageContract'+(salvage.contract===def.id?' selected':'');button.style.setProperty('--contract-accent',def.accent);button.disabled=salvage.running;button.setAttribute('aria-pressed',salvage.contract===def.id?'true':'false');button.innerHTML='<strong>'+safeText(def.name)+'</strong><span>'+safeText(def.desc)+'</span>';button.addEventListener('click',function(){selectSalvageContract(def.id);});ui.salvageContractPicker.appendChild(button);});}
function makeSalvageBoard(){
  salvage.size=Math.min(7,4+salvage.sector);var map=arcadeGen.generateSalvageMap(salvage.seed,salvage.sector,salvage.size,salvage.contract);salvage.board=map.board;salvage.start=map.start;salvage.revealed=[map.start];salvage.player=map.start;return salvage.board;
}
function salvageRevealed(index){return salvage.revealed.indexOf(index)>=0;}
function isSalvageAdjacent(a,b){return Math.abs((a%salvage.size)-(b%salvage.size))+Math.abs(Math.floor(a/salvage.size)-Math.floor(b/salvage.size))===1;}
function salvageCellLabel(cell,index){
  if(!cell||!cell.revealed)return '未知舱格 '+String(index+1);
  return cell.type==='start'?'起始舱格':cell.type==='scrap'?'废料舱格':cell.type==='cache'?'高能缓存':cell.type==='hazard'?'危险舱格':cell.type==='beacon'?'撤离信标':cell.type==='data'?'航行数据':cell.type==='relic'?'相位遗物':cell.type==='repair'?'氧压补给':'空舱格';
}
function renderSalvageGrid(){
  if(!ui.salvageGrid)return;
  if(!Array.isArray(salvage.nodes)||salvage.nodes.length!==salvage.size*salvage.size){
    salvage.nodes=[];ui.salvageGrid.innerHTML='';
    ui.salvageGrid.style.gridTemplateColumns='repeat('+salvage.size+',minmax(0,1fr))';
    for(var i=0;i<salvage.size*salvage.size;i++){
      var node=document.createElement('button');node.type='button';node.className='salvageCell';
      (function(cellIndex){node.addEventListener('click',function(){handleSalvageCell(cellIndex);});})(i);
      salvage.nodes.push(node);ui.salvageGrid.appendChild(node);
    }
  }
  salvage.nodes.forEach(function(node,index){
    var cell=salvage.board[index]||(index===salvage.start?{type:'start',revealed:true}:{type:'empty',revealed:false}),revealed=salvageRevealed(index),adjacent=salvage.running&&isSalvageAdjacent(salvage.player,index);
    cell.revealed=revealed;node.disabled=!salvage.running||salvage.phase!=='explore'||revealed||!adjacent;node.className='salvageCell '+(revealed?'revealed ':'hiddenCell ')+(index===salvage.player?'playerCell ':'')+(revealed?cell.type:'unknown');
    node.textContent=revealed?(cell.type==='start'?'⌂':cell.type==='scrap'?'+':cell.type==='cache'?'◆':cell.type==='hazard'?'!':cell.type==='beacon'?'◎':cell.type==='data'?'▤':cell.type==='relic'?'◇':cell.type==='repair'?'✚':'·'):'?';
    node.setAttribute('aria-label',salvageCellLabel(cell,index));
  });
}
function updateSalvageUI(){
  if(!ui.salvageBoard)return;
  ui.salvageTimer.textContent=Math.max(0,salvage.timeLeft)+'s';ui.salvageScore.textContent=Math.max(0,salvage.score);ui.salvageCollected.textContent=Math.max(0,salvage.collected);ui.salvageHeat.textContent=Math.max(0,salvage.heat);ui.salvageBest.textContent=Math.max(0,profile.salvageBest||0);if(ui.salvageData)ui.salvageData.textContent=salvage.data+' 数据 · '+salvage.relics+' 遗物';
  if(ui.salvageSector)ui.salvageSector.textContent=String(salvage.sector).padStart(2,'0')+' / 03';
  var status=salvage.running?(salvage.phase==='decision'?'BEACON / DECIDE':'DECK '+salvage.sector+' · '+salvage.size+'×'+salvage.size):(salvage.phase==='success'?'已撤离':salvage.phase==='timeout'?'信号中断':'待命');
  ui.salvageStatus.textContent=status;ui.salvageBoard.classList.toggle('active',salvage.running);ui.salvageBoard.classList.toggle('hot',salvage.heat>=3);ui.salvageStartBtn.disabled=salvage.running;ui.salvageStartBtn.textContent=salvage.running?'打捞进行中 · 第 '+salvage.sector+' 层':'开始程序生成的三层远征';
  var decision=salvage.running&&salvage.phase==='decision';ui.salvageExtractBtn.hidden=!decision;ui.salvageExtractBtn.disabled=!decision;if(ui.salvageDescendBtn){ui.salvageDescendBtn.hidden=!(decision&&salvage.sector<3);ui.salvageDescendBtn.disabled=!(decision&&salvage.sector<3);ui.salvageDescendBtn.textContent='继续深入 · 第 '+Math.min(3,salvage.sector+1)+' 层';}
  var contract=selectedSalvageContract(),progress=salvage.contract==='ghost'?((salvage.heat<=2?'热度≤2':'热度超限 '+salvage.heat)+' · 缓存 '+salvage.caches+' / 1'):(salvageContractValue()+' / '+contract.goal+' '+contract.unit);
  var hint=decision?'信标已锁定 · '+contract.name+' '+progress+(salvageContractComplete()?' · 委托达成':' · 可继续搜寻')+' · 撤离保货，深入加风险':salvage.running?'只探索相邻舱格 · '+contract.name+' '+progress+' · 热度 '+salvage.heat+' · 已回收 '+salvage.collected+' 件':salvage.phase==='success'?'已安全撤离 · 成绩已写入日志':salvage.phase==='timeout'?'氧压耗尽 · 已结算本次发现':'先选一项打捞委托，再逐格探路';
  ui.salvageHint.textContent=hint;renderSalvageGrid();renderSalvageContracts();
}
function startSalvage(){
  if(salvage.running)return;
  stopRelay(true);stopLab(true);stopBlackbox(true);clearSalvageTimer();salvage.contract=profile.salvageContract;salvage.seed=makeRunSeed();salvage.sector=1;salvage.running=true;salvage.phase='explore';salvage.score=0;salvage.collected=0;salvage.caches=0;salvage.data=0;salvage.relics=0;salvage.heat=0;salvage.steps=0;var mastery=activeArcadeMastery('salvage');salvage.masteryId=mastery&&mastery.id||null;salvage.masteryGuard=salvage.masteryId==='hull'?1:0;salvage.masteryTimeBonus=salvage.masteryId==='oxygen'?12:0;salvage.timeLeft=60+salvage.masteryTimeBonus;salvage.token++;makeSalvageBoard();updateSalvageUI();
  salvage.clock=salvageRuntime.setInterval(function(){if(!salvage.running||document.hidden)return;salvage.timeLeft--;updateSalvageUI();if(salvage.timeLeft<=0)finishSalvage('time');},1000);renderArcadeMastery('salvage');arcadeFeedback('salvage','start');
}
function handleSalvageCell(index){
  if(!salvage.running||salvage.phase!=='explore')return false;
  index=Math.floor(Number(index));if(index<0||index>=salvage.board.length)return false;
  var cell=salvage.board[index];if(!cell||salvageRevealed(index)||!isSalvageAdjacent(salvage.player,index))return false;
  cell.revealed=true;salvage.revealed.push(index);salvage.player=index;salvage.steps++;
  if(cell.type==='scrap'){salvage.collected++;salvage.score+=12+Math.floor(Math.random()*13);toast('拆解废料 · 回收件 +1');}
  else if(cell.type==='cache'){salvage.collected++;salvage.caches++;salvage.score+=45+Math.floor(Math.random()*26);toast('高能缓存 · 得分跃升');}
  else if(cell.type==='data'){salvage.data++;salvage.score+=26;toast('航行数据 · 已记录');}
  else if(cell.type==='relic'){salvage.relics++;salvage.score+=70+salvage.sector*8;toast('相位遗物 · 高价值回收');}
  else if(cell.type==='repair'){salvage.timeLeft=Math.min(90,salvage.timeLeft+12);salvage.heat=Math.max(0,salvage.heat-1);salvage.score+=14;toast('氧压补给 · +12 秒 · 热度 -1');}
  else if(cell.type==='hazard'){var buffered=salvage.masteryGuard>0;if(buffered)salvage.masteryGuard--;salvage.heat++;salvage.timeLeft=Math.max(1,salvage.timeLeft-(buffered?0:3+salvage.sector-1));salvage.score=Math.max(0,salvage.score-18*salvage.sector);toast(buffered?'隔舱缓冲吸收氧压冲击 · 警戒仍 +1':'危险舱格 · 热度 +1 · 氧压下降');}
  else if(cell.type==='beacon'){salvage.score+=8;toast(salvage.collected>=3?'撤离信标已锁定':'信标发现 · 继续回收 3 件物资');}
  else salvage.score+=2;
  if(salvage.collected>=3&&salvage.revealed.some(function(revealedIndex){return salvage.board[revealedIndex]&&salvage.board[revealedIndex].type==='beacon';}))salvage.phase='decision';
  updateSalvageUI();arcadeFeedback('salvage',cell.type==='scrap'?'loot':cell.type==='hazard'?'hazard':cell.type, salvage.steps);return true;
}
function extractSalvage(){if(!salvage.running||salvage.phase!=='decision')return false;finishSalvage('extract');return true;}
function descendSalvage(){
  if(!salvage.running||salvage.phase!=='decision'||salvage.sector>=3)return false;
  salvage.score+=Math.max(0,salvage.timeLeft)*2+salvage.caches*8;salvage.sector++;salvage.heat++;salvage.timeLeft=Math.max(38,60-salvage.heat*3+salvage.masteryTimeBonus);salvage.phase='explore';makeSalvageBoard();updateSalvageUI();toast('进入废舰第 '+salvage.sector+' 层 · '+salvage.size+'×'+salvage.size+' 格网 · 警戒升高');arcadeFeedback('salvage','beacon',salvage.sector);return true;
}
function finishSalvage(reason){
  if(!salvage.running)return;
  clearSalvageTimer();salvage.running=false;salvage.phase=reason==='extract'?'success':'timeout';
  if(reason==='extract')salvage.score+=salvage.timeLeft*2+Math.max(0,3-salvage.heat)*5+(salvage.sector-1)*45;
  var masteryBefore=arcadeMasteryUnlockCount('salvage'),contractClear=salvageContractComplete(),record=salvage.score>(profile.salvageBest||0);if(contractClear&&reason==='extract')profile.salvageContractClears++;if(record)profile.salvageBest=salvage.score;profile.salvageRuns++;profile.salvageDepthBest=Math.max(profile.salvageDepthBest||0,salvage.sector);profile.salvageCollected+=salvage.collected;profile.salvageCaches+=salvage.caches;profile.salvageData+=salvage.data;profile.salvageRelics+=salvage.relics;advanceDailyDirective('salvage',salvage.caches);var masteryAfter=arcadeMasteryUnlockCount('salvage');
  var shardGain=Math.max(1,Math.floor(salvage.score/120)+salvage.caches+(reason==='extract'?salvage.sector-1:0)+(contractClear&&reason==='extract'?4:0));profile.shards+=shardGain;var blueprintGain=syncBlueprintUnlocks(true);var stationGain=grantActivityReward('salvage',{caches:salvage.caches,collected:salvage.collected});var masteryChoice=arcadeMasteryDefs.salvage.choices[masteryBefore];pushChronicle({type:'salvage',title:reason==='extract'?(salvage.sector===3?'三层打捞通关':record?'打捞新纪录':'打捞撤离成功'):'打捞信号中断',subtitle:'DERELICT BELT · '+selectedSalvageContract().name+(contractClear?' · 委托达成':' · 委托未达成')+' · 深入 '+salvage.sector+' 层 · '+salvage.steps+' 步 · 数据 '+salvage.data+' · 遗物 '+salvage.relics+' · 热度 '+salvage.heat+(salvage.masteryId?' · 精通 '+(arcadeMasteryDefs.salvage.choices.find(function(item){return item.id===salvage.masteryId;})||{}).name:'')+(stationGain?' · '+stationGain:'')+(blueprintGain.length?' · 蓝图 +'+blueprintGain.length:''),score:salvage.score,seed:salvage.seed,contract:salvage.contract,contractClear:contractClear,steps:salvage.steps,collected:salvage.collected,caches:salvage.caches,data:salvage.data,relics:salvage.relics,heat:salvage.heat,sector:salvage.sector,mastery:salvage.masteryId,shards:shardGain});saveProfile();updateSalvageUI();renderArcadeMastery('salvage');renderHubSignals();renderHubChronicle();renderHubBridge();renderArcadeLanding();toast(reason==='extract'?(salvage.sector===3?'三层打捞通关 · '+salvage.score+' 分 · 星尘 +'+shardGain:record?'打捞新纪录 · '+salvage.score+' · 星尘 +'+shardGain:'已撤离第 '+salvage.sector+' 层 · 星尘 +'+shardGain):'打捞信号中断 · 已结算 '+salvage.score+' 分');if(masteryAfter>masteryBefore&&masteryChoice)toast('精通解锁 · '+masteryChoice.name+' · 可在下一局前装备');arcadeFeedback('salvage',reason==='extract'?'clear':'hazard',salvage.score);
}
function stopSalvage(silent){
  var wasRunning=salvage.running;clearSalvageTimer();salvage.running=false;salvage.phase='idle';salvage.board=[];salvage.size=5;salvage.start=12;salvage.revealed=[12];salvage.player=12;salvage.score=0;salvage.collected=0;salvage.caches=0;salvage.data=0;salvage.relics=0;salvage.heat=0;salvage.steps=0;salvage.sector=1;salvage.timeLeft=60;salvage.token++;updateSalvageUI();renderArcadeMastery('salvage');if(wasRunning&&!silent)toast('深空打捞已中止');
}
function renderHubSalvage(){updateSalvageUI();renderArcadeMastery('salvage');}
function blackboxPortNames(mask){var names=[];if(mask&1)names.push('上');if(mask&2)names.push('右');if(mask&4)names.push('下');if(mask&8)names.push('左');return names.join('、')||'无接口';}
function renderBlackboxGrid(){
  if(!ui.blackboxGrid)return;
  var count=blackbox.board?blackbox.board.cells.length:25,size=blackbox.board?blackbox.board.size:5;
  if(!Array.isArray(blackbox.nodes)||blackbox.nodes.length!==count){blackbox.nodes=[];ui.blackboxGrid.innerHTML='';for(var i=0;i<count;i++){var node=document.createElement('button');node.type='button';node.className='bbTile';(function(index){node.addEventListener('click',function(){rotateBlackboxTile(index);});})(i);blackbox.nodes.push(node);ui.blackboxGrid.appendChild(node);}}
  ui.blackboxGrid.style.gridTemplateColumns='repeat('+size+',minmax(0,1fr))';ui.blackboxGrid.setAttribute('aria-label',size+'×'+size+' 程序生成线路棋盘');
  if(!blackbox.board){blackbox.nodes.forEach(function(node){node.disabled=true;node.className='bbTile';node.innerHTML='';node.setAttribute('aria-label','未启动');});return;}
  var powered=window.NeonBlackbox.poweredCells(blackbox.board);
  blackbox.nodes.forEach(function(node,index){var cell=blackbox.board.cells[index],isPowered=powered.indexOf(index)>=0,isInput=index===blackbox.board.start,isOutput=index===blackbox.board.end;node.disabled=!blackbox.running||blackbox.phase!=='solving'||!cell.rotatable||blackbox.board.movesLeft<=0;node.className='bbTile '+cell.kind+(isPowered?' powered':'')+(index===blackbox.hintedIndex?' hinted':'');node.innerHTML='<i class="bbPort north '+(cell.mask&1?'on':'')+'"></i><i class="bbPort east '+(cell.mask&2?'on':'')+'"></i><i class="bbPort south '+(cell.mask&4?'on':'')+'"></i><i class="bbPort west '+(cell.mask&8?'on':'')+'"></i><i class="bbCore"></i>'+(isInput?'<b class="bbEndpoint">IN</b>':isOutput?'<b class="bbEndpoint">OUT</b>':'');node.setAttribute('aria-label',(isInput?'输入端，':isOutput?'输出端，':'')+'第 '+(Math.floor(index/size)+1)+' 行第 '+(index%size+1)+' 列，接口 '+blackboxPortNames(cell.mask)+(isPowered?'，已通电':'')+(cell.rotatable?'，点击顺时针旋转':''));});
}
function updateBlackboxUI(){
  if(!ui.blackboxGrid)return;
  var board=blackbox.board;ui.blackboxStatus.textContent=blackbox.running?(blackbox.phase==='draft'?'CHOOSE / MODULE':'LAYER '+blackbox.stage+' / ROUTE'):'待命';ui.blackboxStage.textContent=blackbox.running?String(blackbox.stage).padStart(2,'0')+' / '+String(blackbox.maxStage).padStart(2,'0'):blackbox.phase==='clear'?String(blackbox.maxStage).padStart(2,'0')+' / '+String(blackbox.maxStage).padStart(2,'0'):'— / '+String(blackbox.maxStage).padStart(2,'0');ui.blackboxMoves.textContent=board?String(board.movesLeft)+' / '+board.moveLimit:'—';ui.blackboxIntegrity.textContent='◆ '.repeat(Math.max(0,blackbox.integrity)).trim()||'0';ui.blackboxScore.textContent=blackbox.score;ui.blackboxBest.textContent=profile.blackboxBest||0;ui.blackboxStartBtn.disabled=blackbox.running;ui.blackboxStartBtn.textContent=blackbox.running?'解码中 · 第 '+blackbox.stage+' 层':blackbox.phase==='clear'?'再挑战一轮':blackbox.phase==='failed'?'重新启动解码':'启动随机黑盒';ui.blackboxHintBtn.disabled=!blackbox.running||blackbox.phase!=='solving'||!board;ui.blackboxHintBtn.textContent=blackbox.freeHints?'读取线路提示 · 免费 '+blackbox.freeHints:'读取线路提示';
  if(blackbox.running&&board)ui.blackboxHintText.textContent=blackbox.phase==='draft'?'线路已连通 · 选择一个系统模组再进入下一张新图。':('已通电 '+window.NeonBlackbox.poweredCells(board).length+' / '+board.cells.length+' 格 · 找到连续路径后自动核算。'+(blackbox.freeHints?' · 免费提示 '+blackbox.freeHints:''));else if(blackbox.phase==='clear')ui.blackboxHintText.textContent='七层程序线路全部连通 · 研究与星尘已写入指挥官档案。';else if(blackbox.phase==='failed')ui.blackboxHintText.textContent='系统完整性耗尽 · 已按已解锁线路结算。';else ui.blackboxHintText.textContent='每局随机生成 5×5 至 7×7 电路。规划输入端到输出端的通路，旋转瓦片并管理步数。';
  renderBlackboxGrid();renderBlackboxDraft();
}
function renderBlackboxDraft(){if(!ui.blackboxDraft)return;ui.blackboxDraft.classList.toggle('hidden',!blackbox.running||blackbox.phase!=='draft');ui.blackboxDraft.innerHTML='';if(!blackbox.running||blackbox.phase!=='draft')return;ui.blackboxDraft.innerHTML='<b>第 '+blackbox.stage+' 层 · 选择线路模组</b><div class="arcadeDraftCards"></div>';var host=ui.blackboxDraft.querySelectorAll('.arcadeDraftCards')[0];blackbox.offers.forEach(function(def){var card=document.createElement('button');card.type='button';card.className='arcadeDraftCard';card.style.setProperty('--draft-accent',def.accent);card.innerHTML='<strong>'+safeText(def.name)+'</strong><span>'+safeText(def.desc)+'</span>';card.addEventListener('click',function(){chooseBlackboxUpgrade(def.id);});host.appendChild(card);});}
function chooseBlackboxUpgrade(id){if(!blackbox.running||blackbox.phase!=='draft')return false;var def=blackbox.offers.find(function(item){return item.id===id;});if(!def)return false;blackbox.upgrades.push(id);if(id==='buffer')blackbox.integrity=Math.min(4,blackbox.integrity+1);else if(id==='wide')blackbox.movesBonus+=4;else if(id==='scanner')blackbox.freeHints++;else if(id==='multiplier')blackbox.scoreMult+=.15;blackbox.offers=[];blackbox.stage++;blackbox.attempt=0;blackbox.phase='solving';loadBlackboxStage();updateBlackboxUI();toast('黑盒模组接入 · '+def.name);beep(900,.06,.025);return true;}
function loadBlackboxStage(){blackbox.board=window.NeonBlackbox.generate(blackbox.stage,blackbox.seed,blackbox.attempt,blackbox.movesBonus);blackbox.hintedIndex=-1;blackbox.hintDebt=0;}
function startBlackbox(){
  if(blackbox.running)return;
  stopRelay(true);stopLab(true);stopSalvage(true);blackboxRuntime.clearAll();blackbox.running=true;blackbox.phase='solving';blackbox.score=0;blackbox.stage=1;blackbox.maxStage=7;blackbox.integrity=3;blackbox.locks=0;blackbox.hints=0;blackbox.hintDebt=0;blackbox.attempt=0;blackbox.movesBonus=0;blackbox.scoreMult=1;blackbox.freeHints=0;blackbox.offers=[];blackbox.upgrades=[];blackbox.seed=makeRunSeed();blackbox.nodes=[];var mastery=activeArcadeMastery('blackbox');blackbox.masteryId=mastery&&mastery.id||null;if(blackbox.masteryId==='budget')blackbox.movesBonus=3;if(blackbox.masteryId==='reader')blackbox.freeHints=1;loadBlackboxStage();updateBlackboxUI();renderArcadeMastery('blackbox');arcadeFeedback('blackbox','start');
}
function rotateBlackboxTile(index){
  if(!blackbox.running||blackbox.phase!=='solving'||!blackbox.board)return false;
  if(!window.NeonBlackbox.rotate(blackbox.board,index))return false;
  if(window.NeonBlackbox.isSolved(blackbox.board)){var efficiency=Math.max(0,blackbox.board.movesLeft*2-blackbox.hintDebt);blackbox.score+=Math.round((90*blackbox.stage+efficiency)*blackbox.scoreMult);blackbox.locks++;blackbox.hintedIndex=-1;arcadeFeedback('blackbox','clear',blackbox.stage);if(blackbox.stage>=blackbox.maxStage){finishBlackbox('clear');return true;}blackbox.phase='draft';blackbox.offers=arcadeGen.offerChoices(blackboxUpgradeDefs,'blackbox|'+blackbox.seed+'|'+blackbox.stage,3,[]);updateBlackboxUI();return true;}
  arcadeFeedback('blackbox','rotate',index);if(blackbox.board.movesLeft<=0){blackbox.integrity--;blackbox.score=Math.max(0,blackbox.score-24*blackbox.stage);arcadeFeedback('blackbox','error',blackbox.integrity);if(blackbox.integrity<=0){finishBlackbox('failed');return true;}blackbox.attempt++;blackbox.phase='retry';updateBlackboxUI();toast('线路断开 · 完整性 -1 · 重置当前层');blackboxRuntime.setTimeout(function(){if(!blackbox.running)return;blackbox.phase='solving';loadBlackboxStage();updateBlackboxUI();},500);return true;}
  blackbox.hintedIndex=-1;updateBlackboxUI();return true;
}
function hintBlackbox(){
  if(!blackbox.running||blackbox.phase!=='solving'||!blackbox.board)return false;var hint=window.NeonBlackbox.hint(blackbox.board);if(!hint)return false;blackbox.hints++;if(blackbox.freeHints>0)blackbox.freeHints--;else blackbox.hintDebt+=12*blackbox.stage;blackbox.hintedIndex=hint.index;arcadeFeedback('blackbox','hint',blackbox.hints);updateBlackboxUI();ui.blackboxHintText.textContent='提示：第 '+(Math.floor(hint.index/blackbox.board.size)+1)+' 行第 '+(hint.index%blackbox.board.size+1)+' 列还需顺时针旋转 '+hint.turns+' 次。';blackboxRuntime.setTimeout(function(){if(blackbox.hintedIndex===hint.index){blackbox.hintedIndex=-1;updateBlackboxUI();}},1400);return true;
}
function finishBlackbox(reason){
  if(!blackbox.running)return false;blackboxRuntime.clearAll();blackbox.running=false;blackbox.phase=reason==='clear'?'clear':'failed';blackbox.hintedIndex=-1;var masteryBefore=arcadeMasteryUnlockCount('blackbox');profile.blackboxRuns++;profile.blackboxLocks+=blackbox.locks;advanceDailyDirective('blackbox',blackbox.locks);if(reason==='clear')profile.blackboxClears++;var masteryAfter=arcadeMasteryUnlockCount('blackbox');var record=blackbox.score>=(profile.blackboxBest||0);if(record)profile.blackboxBest=blackbox.score;var shardGain=Math.max(1,Math.floor(blackbox.score/180)+(reason==='clear'?6:0));profile.shards+=shardGain;var stationGain=grantActivityReward('blackbox',{locks:blackbox.locks,cleared:reason==='clear'});var masteryChoice=arcadeMasteryDefs.blackbox.choices[masteryBefore];pushChronicle({type:'blackbox',title:reason==='clear'?'黑盒七层全解':record?'解码新纪录':'解码结束',subtitle:'OBSCURA NETWORK · 连通 '+blackbox.locks+' 层 · 模组 '+blackbox.upgrades.map(function(id){var def=blackboxUpgradeDefs.find(function(item){return item.id===id;});return def?def.name:id;}).join('、')+' · 提示 '+blackbox.hints+' 次 · 星尘 +'+shardGain+(blackbox.masteryId?' · 精通 '+(arcadeMasteryDefs.blackbox.choices.find(function(item){return item.id===blackbox.masteryId;})||{}).name:'')+(stationGain?' · '+stationGain:''),score:blackbox.score,stage:blackbox.stage,locks:blackbox.locks,hints:blackbox.hints,seed:blackbox.seed,upgrades:blackbox.upgrades.slice(),mastery:blackbox.masteryId,cleared:reason==='clear',shards:shardGain});saveProfile();syncUnlocks();updateBlackboxUI();renderArcadeMastery('blackbox');renderHubChronicle();renderHubBridge();renderHubSignals();renderHubProtocols();renderArcadeLanding();toast(reason==='clear'?'黑盒七层全解 · '+blackbox.score+' 分 · 星尘 +'+shardGain:'黑盒中断 · 已连通 '+blackbox.locks+' 层 · 星尘 +'+shardGain);if(masteryAfter>masteryBefore&&masteryChoice)toast('精通解锁 · '+masteryChoice.name+' · 可在下一局前装备');arcadeFeedback('blackbox',reason==='clear'?'clear':'error',blackbox.score);return true;
}
function stopBlackbox(silent){
  var wasRunning=blackbox.running;blackboxRuntime.clearAll();blackbox.running=false;blackbox.phase='idle';blackbox.board=null;blackbox.score=0;blackbox.stage=1;blackbox.maxStage=7;blackbox.integrity=3;blackbox.locks=0;blackbox.hints=0;blackbox.hintDebt=0;blackbox.attempt=0;blackbox.hintedIndex=-1;blackbox.nodes=[];blackbox.offers=[];blackbox.upgrades=[];blackbox.movesBonus=0;blackbox.scoreMult=1;blackbox.freeHints=0;updateBlackboxUI();renderArcadeMastery('blackbox');if(wasRunning&&!silent)toast('黑盒解码已中止');
}
function renderHubBlackbox(){updateBlackboxUI();renderArcadeMastery('blackbox');}
function pushChronicle(entry){
  entry=entry||{};
  var safeList=function(value,limit){return Array.isArray(value)?value.slice(0,limit).map(function(item){return String(item).slice(0,32);}):[];};
  var record={
  type:entry.type==='border'?'border':entry.type==='relay'?'relay':entry.type==='lab'?'lab':entry.type==='salvage'?'salvage':entry.type==='blackbox'?'blackbox':'run',mastery:entry.mastery?String(entry.mastery).slice(0,24):'',operationId:entry.operationId?String(entry.operationId).slice(0,80):'',
    title:String(entry.title||'完成记录'),subtitle:String(entry.subtitle||''),score:Math.max(0,Math.floor(Number(entry.score)||0)),
    wave:Math.max(0,Math.floor(Number(entry.wave)||0)),kills:Math.max(0,Math.floor(Number(entry.kills)||0)),
    hits:Math.max(0,Math.floor(Number(entry.hits)||0)),misses:Math.max(0,Math.floor(Number(entry.misses)||0)),
    sector:Math.max(0,Math.floor(Number(entry.sector)||0)),shards:Math.max(0,Math.floor(Number(entry.shards)||0)),
    round:Math.max(0,Math.floor(Number(entry.round)||0)),solved:Math.max(0,Math.floor(Number(entry.solved)||0)),
    steps:Math.max(0,Math.floor(Number(entry.steps)||0)),collected:Math.max(0,Math.floor(Number(entry.collected)||0)),
    caches:Math.max(0,Math.floor(Number(entry.caches)||0)),data:Math.max(0,Math.floor(Number(entry.data)||0)),
    relics:Math.max(0,Math.floor(Number(entry.relics)||0)),heat:Math.max(0,Math.floor(Number(entry.heat)||0)),
    stage:Math.max(0,Math.floor(Number(entry.stage)||0)),locks:Math.max(0,Math.floor(Number(entry.locks)||0)),turns:Math.max(0,Math.floor(Number(entry.turns)||0)),
    hints:Math.max(0,Math.floor(Number(entry.hints)||0)),mistakes:Math.max(0,Math.floor(Number(entry.mistakes)||0)),
    contract:entry.contract?String(entry.contract).slice(0,24):'',contractClear:!!entry.contractClear,
    ruleOrder:safeList(entry.ruleOrder,4),upgrades:safeList(entry.upgrades,8),perks:safeList(entry.perks,8),
    outcome:entry.outcome==='victory'?'victory':entry.outcome==='abandoned'?'abandoned':'defeat',runMode:entry.runMode==='endless'?'endless':'campaign',cleared:!!entry.cleared,seed:entry.seed?String(entry.seed).slice(0,48):'',routeId:entry.routeId?String(entry.routeId).slice(0,24):'',
    routePlan:Array.isArray(entry.routePlan)?entry.routePlan.slice(0,5).map(String):[],at:new Date().toISOString()
  };
  if(!Array.isArray(profile.history))profile.history=[];profile.history.unshift(record);profile.history=profile.history.slice(0,18);saveProfile();
}
window.NeonProfileBridge={recordBorderRun:function(run){
  if(!run||typeof run.id!=='string'||!run.id||run.id.length>80)return false;
  var stats=profile.borderTactics;if(!Array.isArray(stats.settledRuns))stats.settledRuns=[];
  if(stats.settledRuns.indexOf(run.id)>=0)return false;
  var outcome=run.outcome==='clear'?'clear':'lost',score=Math.max(0,Math.floor(Number(run.score)||0)),kills=Math.max(0,Math.floor(Number(run.kills)||0)),sector=clamp(Math.floor(Number(run.sector)||0),1,3),reward=run.reward&&typeof run.reward==='object'?run.reward:{};
  var shards=clamp(Math.floor(Number(reward.shards)||0),0,10000),intel=clamp(Math.floor(Number(reward.intel)||0),0,10000),modules=clamp(Math.floor(Number(reward.modules)||0),0,10000);
  stats.settledRuns.push(run.id);stats.settledRuns=stats.settledRuns.slice(-48);stats.runs++;if(outcome==='clear')stats.clears++;advanceDailyDirective('border',outcome==='clear'?1:0);stats.bestScore=Math.max(stats.bestScore,score);stats.totalKills+=kills;stats.deepestSector=Math.max(stats.deepestSector,sector);profile.totalKills+=kills;
  var stationGain=grantStationReward({shards:shards,intel:intel,modules:modules});
  pushChronicle({type:'border',operationId:run.id,title:outcome==='clear'?'失落站行动完成':'失落站行动中断',subtitle:'LOST STATION · '+String(run.contract||'静默勘察').slice(0,24)+' · '+sector+'/3 舱段 · '+Math.max(0,Math.floor(Number(run.turns)||0))+' 回合'+(stationGain?' · '+stationGain:''),score:score,kills:kills,sector:sector,turns:Math.max(0,Math.floor(Number(run.turns)||0)),seed:run.seed,contract:run.contract,cleared:outcome==='clear',shards:shards});
  syncUnlocks();renderHubChronicle();renderHubBridge();renderHubSignals();renderHubProtocols();renderArcadeLanding();return true;
}};
function chronicleTime(value){var stamp=Date.parse(value);if(!Number.isFinite(stamp))return '时间未知';var date=new Date(stamp);return date.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})+' '+date.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});}
function renderHubChronicle(){
  if(!ui.chronicleSummary||!ui.chronicleList)return;
  var stats=[['远征次数',Math.max(0,profile.runs||0),'EXPEDITIONS'],['边境通关',Math.max(0,profile.borderTactics.clears||0),'LOST STATION'],['中继通关',Math.max(0,profile.relayClears||0),'RELAY CLEARS'],['实验通关',Math.max(0,profile.labClears||0),'ECHO CLEARS'],['打捞深入',Math.max(0,profile.salvageDepthBest||0),'SALVAGE DEPTH'],['黑盒解锁',Math.max(0,profile.blackboxLocks||0),'CIRCUIT LOCKS'],['总击破',Math.max(0,profile.totalKills||0),'HOSTILES'],['最佳连杀',Math.max(0,profile.bestCombo||0),'BEST COMBO']];
  ui.chronicleSummary.innerHTML=stats.map(function(stat){return '<div class="chronicleMetric"><span>'+stat[2]+'</span><b>'+stat[1]+'</b><small>'+stat[0]+'</small></div>';}).join('');
  var bp=selectedBlueprint(),route=selectedRoute();
  ui.chronicleLoadout.innerHTML=buildItems().map(function(item){return '<span class="chronicleChip">'+iconMarkup(item,'tiny')+'<b>'+safeText(itemLabel(item))+'</b></span>';}).join('');
  ui.chronicleTrackMeta.innerHTML='<div><span>当前机体</span><b>'+safeText(bp.name)+'</b></div><div><span>当前航线</span><b>'+safeText(route.name)+'</b></div><div><span>待出击种子</span><b>'+safeText(ensurePendingSeed())+'</b></div><div><span>上次远征</span><b>'+safeText(profile.lastRunSeed||'暂无')+'</b></div><div><span>失落站纪录</span><b>'+Math.max(0,profile.borderTactics.bestScore||0)+' · 通关 '+Math.max(0,profile.borderTactics.clears||0)+'</b></div><div><span>中继最高</span><b>'+Math.max(0,profile.relayBest||0)+'</b></div><div><span>实验最高</span><b>'+Math.max(0,profile.labBest||0)+'</b></div><div><span>打捞最高</span><b>'+Math.max(0,profile.salvageBest||0)+' · 深度 '+Math.max(0,profile.salvageDepthBest||0)+'</b></div><div><span>黑盒最高</span><b>'+Math.max(0,profile.blackboxBest||0)+' · '+Math.max(0,profile.blackboxLocks||0)+' 层</b></div>';
  var entries=Array.isArray(profile.history)?profile.history:[];
  if(!entries.length){ui.chronicleList.innerHTML='<div class="chronicleEmpty"><span>◌</span><b>还没有游戏记录</b><p>六种游戏模式的成绩、关卡和奖励都会汇总到这里。</p></div>';return;}
  ui.chronicleList.innerHTML=entries.map(function(entry){var type=entry&&entry.type||'run',borderEntry=type==='border',relayEntry=type==='relay',labEntry=type==='lab',salvageEntry=type==='salvage',blackboxEntry=type==='blackbox',accent=borderEntry?'#ff8a6b':salvageEntry?'#75ffb2':labEntry?'#ffb75c':relayEntry?'#ff66c4':blackboxEntry?'#c29aff':'#72f4ff',tag=borderEntry?'LOST STATION':salvageEntry?'SALVAGE EXPEDITION':labEntry?'ECHO LAB':relayEntry?'SIGNAL RELAY':blackboxEntry?'BLACKBOX':'EXPEDITION',title=safeText(entry&&entry.title||'未命名记录'),subtitle=safeText(entry&&entry.subtitle||'无附加说明'),score=Math.max(0,Math.floor(Number(entry&&entry.score)||0)),metric=borderEntry?'深入 '+Math.max(0,Math.floor(Number(entry&&entry.sector)||0))+' 舱段 · 击破 '+Math.max(0,Math.floor(Number(entry&&entry.kills)||0))+' · '+Math.max(0,Math.floor(Number(entry&&entry.turns)||0))+' 回合 · '+score+' 分':salvageEntry?'深入 '+Math.max(0,Math.floor(Number(entry&&entry.sector)||0))+' 层 · 回收 '+Math.max(0,Math.floor(Number(entry&&entry.collected)||0))+' · '+score+' 分':labEntry?'完成 '+Math.max(0,Math.floor(Number(entry&&entry.solved)||0))+' 轮 · 失误 '+Math.max(0,Math.floor(Number(entry&&entry.mistakes)||0))+' · '+score+' 分':relayEntry?'阶段 '+Math.max(0,Math.floor(Number(entry&&entry.sector)||0))+' · 捕获 '+Math.max(0,Math.floor(Number(entry&&entry.hits)||0))+' · 漏接 '+Math.max(0,Math.floor(Number(entry&&entry.misses)||0))+' · '+score+' 分':blackboxEntry?'连通 '+Math.max(0,Math.floor(Number(entry&&entry.locks)||0))+' 层 · 提示 '+Math.max(0,Math.floor(Number(entry&&entry.hints)||0))+' 次 · '+score+' 分':'WAVE '+Math.max(0,Math.floor(Number(entry&&entry.wave)||0))+' · 击破 '+Math.max(0,Math.floor(Number(entry&&entry.kills)||0))+' · 得分 '+score+(entry&&entry.shards?' · 星尘 +'+Math.max(0,Math.floor(Number(entry.shards)||0)):'')+(entry&&entry.seed?' · SEED '+safeText(entry.seed):'');return '<article class="chronicleEntry"><div class="chronicleEntryMark" style="color:'+accent+'">'+(borderEntry?'▦':salvageEntry?'⌖':labEntry?'⌘':relayEntry?'◌':blackboxEntry?'⌗':'✦')+'</div><div class="chronicleEntryBody"><div class="chronicleEntryHead"><span style="color:'+accent+'">'+tag+'</span><time>'+chronicleTime(entry&&entry.at)+'</time></div><h4>'+title+'</h4><p>'+subtitle+'</p><div class="chronicleEntryMeta"><b>'+metric+'</b></div></div></article>';}).join('');
}
function renderHubLab(){updateLabUI();renderArcadeMastery('lab');}
function renderHubSignals(){
  if(!ui.signalFeed||!ui.contractGrid)return;
  ui.signalFeed.innerHTML=signalChannels.map(function(channel){return '<article class="signalFeedCard"><div class="signalFeedTag" style="color:'+channel.accent+'">'+safeText(channel.tag)+'</div><h3>'+safeText(channel.title)+'</h3><p>'+safeText(channel.text)+'</p></article>';}).join('');
  var contracts=[
    {name:'深空航线',desc:'在主游戏抵达第 3 波，开放更多机体与高压敌群。',value:bestWave,max:3,status:bestWave>=3?'已完成':'进行中'},
    {name:'中继习惯',desc:'完成 3 场三阶段信号拦截赛，把连击成绩写入档案。',value:profile.relayRuns,max:3,status:profile.relayRuns>=3?'已完成':'进行中'},
    {name:'城市回声',desc:'在信号台累计捕获 50 个真实信号与缓存。',value:profile.relayHits,max:50,status:profile.relayHits>=50?'已完成':'进行中'},
    {name:'回声训练',desc:'跨局累计正确复现 9 轮，适应随机规则与诱饵信号。',value:profile.labSolved,max:9,status:profile.labSolved>=9?'已完成':'进行中'},
    {name:'打捞许可',desc:'从废墟带带回 12 件回收物，并尝试深入第二艘废舰。',value:profile.salvageCollected,max:12,status:profile.salvageCollected>=12?'已完成':'进行中'},
  {name:'黑盒观测',desc:'累计连通 5 层电路，修复深渊观测站的加密网。',value:profile.blackboxLocks,max:5,status:profile.blackboxLocks>=5?'已完成':'进行中'},
    {name:'失落站行动',desc:'完成一次三舱段边境战术行动并成功撤离。',value:profile.borderTactics.clears,max:1,status:profile.borderTactics.clears>=1?'已完成':'进行中'}
  ];
  ui.contractGrid.innerHTML=contracts.map(function(c){var pct=Math.round(clamp(c.value/c.max,0,1)*100);return '<article class="contractCard"><div class="contractTop"><span>'+safeText(c.name)+'</span><b>'+safeText(c.status)+'</b></div><p>'+safeText(c.desc)+'</p><div class="contractBar"><i style="width:'+pct+'%"></i></div><div class="contractMeta"><span>'+Math.min(c.value,c.max)+' / '+c.max+'</span><small>'+pct+'%</small></div></article>';}).join('');
  updateRelayUI();renderArcadeMastery('relay');
}
var eventDefs=[
  {tag:'SALVAGE SIGNAL',title:'失联补给舱',text:'一艘无人补给舱在航线边缘重复发送求救码。它的能源还够你做一次决定。',choices:[
    {title:'接管维修',desc:'恢复 36% 最大生命，并清空当前负面状态。',accent:'#75ffb2',apply:function(){ship.hp=Math.min(ship.maxHp,ship.hp+ship.maxHp*.36);ship.jammed=false;g.eventHazard=1;g.eventSlow=1;toast('维修舱接管 · HP 恢复');}},
    {title:'拆解货仓',desc:'立即获得 8 废料和 480 分，继续保持当前构筑。',accent:'#ffd76a',apply:function(){g.scrap+=8;g.score+=480;toast('补给舱拆解 · 废料 +8');}},
    {title:'黑入核心',desc:'获得一件稀有装备；若背包已满则自动转为废料。',accent:'#72f4ff',apply:function(){var item=rollItem(null,'rare'),slot=getDef(item).slot;if(g.equipment[slot]&&g.inventory.length>=inventoryCapacity()){g.scrap+=2;toast('核心超载 · 废料 +2');}else if(g.equipment[slot]){storeInventory(item);toast('黑入成功 · '+getDef(item).name+' 入包');}else equipNewItem(item);}}
  ]},
  {tag:'ANOMALY WINDOW',title:'引力裂隙',text:'裂隙会在数秒后闭合。你可以让它替你清理敌群，也可以拿走其中的高能废料。',choices:[
    {title:'压缩裂隙',desc:'下一波开始时清除全部普通敌机，并获得 1 次额外 EMP。',accent:'#c29aff',apply:function(){enemies=enemies.filter(function(e){return e.boss;});traits.empCharges=Math.min(traits.empMax,traits.empCharges+1);toast('裂隙压缩 · EMP +1');}},
    {title:'牵引废料',desc:'获得 12 废料，但下一波敌方生命提高 12%。',accent:'#ffd76a',apply:function(){g.scrap+=12;g.eventHazard=(g.eventHazard||1)*1.12;toast('牵引完成 · 废料 +12');}},
    {title:'穿越窗口',desc:'获得 620 分并进入 6 秒漂移超载，火力更快。',accent:'#72f4ff',apply:function(){g.score+=620;ship.driftTimer=6;toast('穿越完成 · 漂移超载');}}
  ]},
  {tag:'ROGUE TRANSMISSION',title:'未知观测站',text:'观测站没有船员，只有一组仍在运行的实验协议。它愿意给你一次改变航线节奏的机会。',choices:[
    {title:'读取战术档案',desc:'立刻获得一次升级选择，并把事件奖励保留到下一波。',accent:'#72f4ff',apply:function(){g.levelQueue++;toast('档案读取 · 获得升级');}},
    {title:'夺取星尘',desc:'立即获得 10 星尘；这是一次局内预支，不影响本局结算。',accent:'#ffd76a',apply:function(){profile.shards+=10;saveProfile();toast('星尘转移 · +10');}},
    {title:'切断观测',desc:'当前波次剩余敌机速度降低 18%，并获得 320 分。',accent:'#75ffb2',apply:function(){g.eventSlow=(g.eventSlow||1)*.82;g.score+=320;toast('观测站静默 · 航线减速');}}
  ]}
];
function eventForWave(){return eventDefs[Math.max(0,Math.floor(g.wave/3)-1)%eventDefs.length];}
function maybeOpenEvent(){if(g.pendingEvent&&!g.choosing&&g.levelQueue<=0)openEvent();}
function openEvent(){
  if(!g.running||!g.pendingEvent||g.choosing||g.eventActive)return;
  var event=eventForWave();g.pendingEvent=false;g.eventActive=true;g.paused=true;g.accumulator=0;pointer=false;input.clear();cancelAnimationFrame(g.raf);
  ui.eventTag.textContent=event.tag;ui.eventTitle.textContent=event.title;ui.eventText.textContent=event.text;ui.eventChoices.innerHTML='';
  event.choices.forEach(function(choice,index){var card=document.createElement('article');card.className='eventChoice';card.innerHTML='<div class="eventChoiceNum">0'+(index+1)+'</div><div class="eventChoiceCopy"><h3>'+safeText(choice.title)+'</h3><p>'+safeText(choice.desc)+'</p></div><button class="miniBtn" type="button" aria-label="执行 '+safeText(choice.title)+'" style="border-color:'+choice.accent+';color:'+choice.accent+'">执行</button>';card.querySelectorAll('button')[0].addEventListener('click',function(){chooseEvent(event,choice);});ui.eventChoices.appendChild(card);});
  ui.eventOverlay.classList.remove('hidden');updateUI();beep(520,.1,.035);
}
function chooseEvent(event,choice){
  if(!g.eventActive)return;
  choice.apply();g.eventActive=false;ui.eventOverlay.classList.add('hidden');g.paused=false;g.last=performance.now();g.accumulator=0;updateUI();draw();
  if(g.levelQueue>0){openLoot();}else{g.raf=requestAnimationFrame(loop);}
}
function renderHub(){if(!ui.hubOverlay)return;renderHubBridge();renderHubArmory();renderHubRoutes();renderHubCodex();renderHubArchive();renderHubGuides();renderHubWorkbench();renderHubProtocols();renderHubChallenges();renderHubSignals();renderHubSalvage();renderHubLab();renderHubBlackbox();renderHubDispatch();renderHubChronicle();}
function beep(f,d,v){
  if(!soundOn)return;
  try{
    audio=audio||new(window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    var o=audio.createOscillator(),gain=audio.createGain();
    o.type='sine';o.frequency.value=f||520;gain.gain.value=v||.025;o.connect(gain);gain.connect(audio.destination);
    o.start();gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+(d||.05));o.stop(audio.currentTime+(d||.05));
  }catch(e){}
}
function vibrate(value){if(navigator.vibrate)navigator.vibrate(value);}
function toast(message){
  ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toast.timer);
  toast.timer=setTimeout(function(){ui.toast.classList.remove('show');},1050);
}
function burst(x,y,color,count){
  for(var i=0;i<(count||12)&&particles.length<900;i++){var a=Math.random()*Math.PI*2,s=rnd(45,180);particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rnd(.35,.8),max:.8,size:rnd(1.2,3.5),color:color});}
}
function impact(x,y,color,heavy){
  impactFx.push({x:x,y:y,color:color||'#72f4ff',life:heavy?.42:.22,max:heavy?.42:.22,heavy:!!heavy,angle:Math.random()*Math.PI*2});
  if(impactFx.length>120)impactFx.splice(0,impactFx.length-120);
}
function addDamageText(x,y,amount,color,label,critical){
  var text=label||('−'+Math.max(1,Math.round(amount||0)));
  damageTexts.push({x:x+rnd(-4,4),y:y,vy:critical?-38:-28,life:critical?.82:.62,max:critical?.82:.62,text:text,color:color||'#fff',critical:!!critical});
  if(damageTexts.length>90)damageTexts.splice(0,damageTexts.length-90);
}
function pulseScreen(shake,flash){
  screenFx.shake=Math.max(screenFx.shake,shake||0);screenFx.flash=Math.max(screenFx.flash,flash||0);
}
function makeStars(){
  stars=[];for(var i=0;i<Math.max(34,Math.floor(W*H/6200));i++)stars.push({x:Math.random()*W,y:Math.random()*H,s:rnd(.4,1.8),v:rnd(20,70),a:rnd(.2,.82)});
}
function resize(){
  var oldW=W,oldH=H;
  var rect=wrap.getBoundingClientRect();W=Math.max(1,rect.width);H=Math.max(1,rect.height);
  dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(!g.running){ship.x=W/2;ship.y=H-78;ship.targetX=W/2;ship.targetY=ship.y;}
  else if(oldW>0&&oldH>0){
    ship.x=clamp(ship.x/oldW*W,28,Math.max(28,W-28));ship.y=clamp(ship.y/oldH*H,H*.42,Math.max(H*.42,H-46));
    ship.targetX=ship.x;ship.targetY=ship.y;pointer=false;input.clear();
    [enemies,bullets,enemyBullets,drops,mines,lasers].forEach(function(list){list.forEach(function(e){e.x=e.x/oldW*W;e.y=e.y/oldH*H;});});
  }
  makeStars();draw();
}
function targetPos(x,y,isTouch){
  var rect=canvas.getBoundingClientRect(),tx=(x-rect.left)/rect.width*W,ty=(y-rect.top)/rect.height*H-(isTouch?52:0);
  tx=clamp(tx,28,Math.max(28,W-28));ty=clamp(ty,H*.42,Math.max(H*.42,H-46));
  var dx=tx-ship.targetX,dy=ty-ship.targetY;
  if(Math.hypot(dx,dy)>=3){ship.dashX=dx;ship.dashY=dy;}
  var aimDx=tx-ship.x,aimDy=ty-ship.y;
  if(Math.hypot(aimDx,aimDy)>=18)ship.aimAngle=Math.atan2(aimDy,aimDx);
  ship.targetX=tx;ship.targetY=ty;
}
var waveContractDefs=[
  {id:'drift',title:'漂移航线',desc:'持续移动，把推进器热量转成额外回报。',target:520,reward:320,rewardLabel:'漂移过载 · 射速提升 3.2 秒',color:'#72f4ff'},
  {id:'hunt',title:'锁定威胁',desc:'优先击破战术标记目标，避免它把队形拖入混战。',target:1,reward:460,rewardLabel:'锁定回路 · 射速提升 3.2 秒',color:'#ff718e'},
  {id:'break',title:'破盾窗口',desc:'击穿敌方护盾，抓住短暂的舰体输出窗口。',target:2,reward:380,rewardLabel:'破盾窗口 · 伤害提升 14% / 3.2 秒',color:'#ffd76a'}
];
function setWaveContract(){
  var base=waveContractDefs[(Math.max(0,g.wave-1)+(g.bossDefeated||0))%waveContractDefs.length],kind=base.id;
  if(g.wave%5===0)kind='break';
  var def=waveContractDefs.find(function(item){return item.id===kind;})||base,target=def.id==='break'&&g.wave%5===0?1:def.target;
  g.contract={wave:g.wave,id:def.id,title:def.title,desc:def.desc,target:target,progress:0,reward:def.reward,rewardLabel:def.rewardLabel,color:def.color,complete:false,targetUid:null};
}
function ensureHuntTarget(){
  var c=g.contract;if(!c||c.complete||c.id!=='hunt')return;
  var current=enemies.find(function(e){return !e.dead&&!e.boss&&e.marked&&e.uid===c.targetUid;});
  if(current)return;
  c.targetUid=null;
  var next=enemies.find(function(e){return !e.dead&&!e.boss;});
  if(next){next.marked=true;c.targetUid=next.uid;toast('锁定回路转移 · 新目标已标记');}
}
function completeWaveContract(reason){
  var c=g.contract;if(!c||c.complete)return;
  c.complete=true;c.progress=c.target;g.score+=c.reward;g.scrap+=1;
  if(c.id==='drift')ship.driftTimer=Math.max(ship.driftTimer,3.2);
  else if(c.id==='hunt')g.contractHasteTimer=3.2;
  else if(c.id==='break')g.breakWindow=3.2;
  addDamageText(ship.x,ship.y-42,0,c.color,'契约完成');toast('战术契约完成 · '+c.title+' · '+c.rewardLabel+' · +'+c.reward+' 分 / 废料 +1');beep(1120,.08,.035);
}
function advanceWaveContract(kind,amount){
  var c=g.contract;if(!c||c.complete||c.id!==kind)return;
  c.progress=Math.min(c.target,c.progress+Math.max(0,amount||1));
  if(c.progress>=c.target)completeWaveContract(kind);
}
function resetRun(){
  stopRelay(true);
  stopLab(true);
  stopSalvage(true);
  stopBlackbox(true);
  g.running=false;g.paused=false;g.choosing=false;g.eventActive=false;g.pendingEvent=false;g.modalPaused=false;g.score=0;g.kills=0;g.wave=1;g.level=1;g.xp=0;g.xpNeed=80;g.levelQueue=0;
  g.waveKills=0;g.waveTarget=10;g.waveBreaches=0;g.breaches=0;g.spawnTimer=.55;g.elapsed=0;g.nextUid=1;g.combo=0;g.comboTimer=0;g.comboBest=0;g.overdrive=0;g.boss=null;g.bossDefeated=0;g.scrap=0;g.upgradeKits=0;g.empCooldown=0;g.dashCooldown=0;g.mineTimer=4;g.orbTimer=0;g.lootRerolls=0;g.eventHazard=1;g.eventSlow=1;g.routeNodeStage=-1;g.nodeMod={speed:1,fire:1,hp:1,reward:1};g.nodeRewardMultiplier=1;g.nodeLootFloor=null;g.contractHasteTimer=0;g.breakWindow=0;
  g.missionTarget=15;g.missionKills=0;g.missionDone=false;g.missionReward=850;g.nextMissionWave=0;g.eliteKills=0;g.waveMod=waveMods[0];g.mutation=null;g.contract=null;g.pendingLoot=[];g.pendingLootFloor=null;g.nextLootFloor=null;g.pendingFusion=null;g.rewarded=false;g.runMode=selectedRunMode;g.outcome=null;g.finalWave=10;
  g.route=selectedRoute();g.routeMod=g.route.mods;g.routeMap=ensureRoutePlan();g.runSeed=g.routeMap.seed;g.routePlan=g.routeMap.stages.map(function(stage){return profile.routePlan.ids[stage.index];});
  enemies=[];bullets=[];enemyBullets=[];drops=[];particles=[];mines=[];lasers=[];chainFx=[];impactFx=[];damageTexts=[];screenFx.shake=0;screenFx.flash=0;
  pointer=false;input.clear();g.modal=null;g.suspended=false;ship.swarmTimer=0;
  g.accumulator=0;g.hudTimer=0;g.updating=false;g.detailSlot='weapon';ship.dashX=0;ship.dashY=0;ship.aimAngle=-Math.PI/2;ship.driftTimer=0;ship.auxFireTimer=0;
  setDefaults();ui.eventOverlay&&ui.eventOverlay.classList.add('hidden');Object.assign(ship,{x:W/2,y:H-78,targetX:W/2,targetY:H-78,r:12,fireTimer:0,maxHp:baseStats.maxHp,hp:baseStats.maxHp,invuln:0,hasteTimer:0,driftCharge:0,jammed:false});
  recalcBuild(true);ui.bossWrap.classList.remove('show');ui.pauseBtn.textContent='Ⅱ 暂停';ui.startOverlay.classList.add('hidden');updateWaveMod();renderStarterLoadout();updateUI();
  renderHub();
  ui.hubOverlay.classList.remove('hidden');app.classList.add('hubMode');
  setCombatControls(false);
}
function setCombatControls(active){ui.pauseBtn.disabled=!active;ui.armoryBtn.disabled=!active;ui.dashBtn.disabled=!active;ui.overdriveBtn.disabled=!active;}
function startGame(){
  if(assets.player.addEventListener&&!expeditionAssetsLoaded){
    if(startingRun)return;startingRun=true;var startToken=++pendingStartToken;ui.expeditionStartBtn.disabled=true;ui.expeditionStartBtn.textContent='正在载入素材…';
    loadExpeditionAssets().then(function(){if(startToken!==pendingStartToken)return;startingRun=false;ui.expeditionStartBtn.disabled=false;selectRunMode(selectedRunMode);startGame();}).catch(function(){if(startToken!==pendingStartToken)return;startingRun=false;ui.expeditionStartBtn.disabled=false;selectRunMode(selectedRunMode);toast('素材载入失败，请重试。');});return;
  }
  cancelAnimationFrame(g.raf);
  resetRun();g.running=true;ui.startOverlay.classList.add('hidden');ui.gameOverOverlay.classList.add('hidden');ui.lootOverlay.classList.add('hidden');
  ui.armoryOverlay.classList.add('hidden');ui.archiveOverlay.classList.add('hidden');ui.pauseOverlay.classList.add('hidden');
  ui.hubOverlay.classList.add('hidden');if(ui.arcadeGamePages)ui.arcadeGamePages.classList.add('hidden');app.classList.remove('hubMode');app.classList.remove('arcadeLandingMode');app.classList.remove('arcadeGameMode');resize();
  setCombatControls(true);g.last=performance.now();g.raf=requestAnimationFrame(loop);beep(640,.07,.035);
}
function returnToExpeditionMenu(){
  if(g.running)return;
  enterArcadeGame('expedition',false);
}
function endGame(outcome){
  if(!g.running||g.rewarded)return;outcome=outcome==='victory'?'victory':outcome==='abandoned'?'abandoned':'defeat';g.outcome=outcome;g.rewarded=true;g.running=false;g.paused=false;g.choosing=false;g.eventActive=false;g.pendingEvent=false;g.modal=null;g.modalPaused=false;g.levelQueue=0;g.pendingLoot=[];cancelAnimationFrame(g.raf);
  setCombatControls(false);
  ui.lootOverlay.classList.add('hidden');ui.eventOverlay.classList.add('hidden');ui.armoryOverlay.classList.add('hidden');ui.archiveOverlay.classList.add('hidden');ui.pauseOverlay.classList.add('hidden');
  var recordScore=g.runMode==='endless'?Math.max(0,Number(profile.endlessBestScore)||0):Math.max(0,Number(profile.campaignBestScore)||0);
  var newRecord=g.score>recordScore;
  if(g.runMode==='endless'){profile.endlessBestScore=Math.max(recordScore,Math.floor(g.score));profile.endlessBestWave=Math.max(Number(profile.endlessBestWave)||0,g.wave);}
  if(g.score>bestScore){bestScore=Math.floor(g.score);try{localStorage.setItem('neonDriftRogueBestScoreV2',String(bestScore));}catch(e){}}
  if(g.wave>bestWave){bestWave=g.wave;try{localStorage.setItem('neonDriftRogueBestWaveV2',String(bestWave));}catch(e){}}
  if(g.runMode!=='endless'){profile.campaignBestScore=Math.max(recordScore,Math.floor(g.score));profile.campaignBestWave=Math.max(Number(profile.campaignBestWave)||0,g.wave);}
  if(outcome==='victory')profile.campaignClears=Math.max(0,Number(profile.campaignClears)||0)+1;
  profile.bestCombo=Math.max(profile.bestCombo||0,g.comboBest||0);
  profile.activeLoadout=serializeLoadout(g.equipment);
  var shardGain=Math.max(outcome==='abandoned'?0:1,Math.floor(((outcome==='abandoned'?Math.max(0,g.wave-1):g.wave)*2+g.kills/8)*(g.routeMod&&g.routeMod.reward||1)*(g.nodeRewardMultiplier||1)*(g.metaRewardBonus||1)));
  var planLabels=(g.routePlan||[]).map(function(id){var node=routeNodeById(g.routeMap,id),def=node&&starNodeDefs[node.type];return def?def.label:id;});
  profile.shards+=shardGain;advanceDailyDirective('expedition',g.wave);syncBlueprintUnlocks(true);var stationGain=outcome==='abandoned'&&g.kills===0&&g.wave===1?'':grantActivityReward('expedition',{wave:g.wave,bosses:g.bossDefeated});
  pushChronicle({type:'run',title:outcome==='victory'?'战役胜利':outcome==='abandoned'?'主动结束':newRecord?'远征新纪录':'远征结束',cleared:outcome==='victory',outcome:outcome,runMode:g.runMode,subtitle:selectedBlueprint().name+' · '+(g.route&&g.route.name||selectedRoute().name)+(stationGain?' · '+stationGain:''),score:g.score,wave:g.wave,kills:g.kills,shards:shardGain,seed:g.runSeed,routeId:g.route&&g.route.id,routePlan:planLabels});
  profile.lastRunSeed=g.runSeed;profile.pendingSeed=makeRunSeed();profile.routePlan=null;profile.runs++;profile.totalKills+=g.kills;syncUnlocks();saveProfile();renderHub();
  ui.resultTitle.textContent=outcome==='victory'?'战役胜利':outcome==='abandoned'?'本局已结束':'战机损毁';
  if(byId('resultOutcome'))byId('resultOutcome').textContent=outcome==='victory'?'五段航线已完成，终局 Boss 已击破。可以重玩战役，或另开一局无尽挑战。':outcome==='abandoned'?'已按当前进度结算，成长记录保存在本机。':'本局到此结束，已带回成长奖励。调整构筑后可以再次出击。';
  if(byId('endlessAfterWinBtn'))byId('endlessAfterWinBtn').classList.toggle('hidden',outcome!=='victory');
  if(byId('resultRecord'))byId('resultRecord').textContent=g.runMode==='endless'?'无尽最高：'+profile.endlessBestScore+' 分 · '+profile.endlessBestWave+' 波':'战役通关 '+(Number(profile.campaignClears)||0)+' 次 · 最高 '+(Number(profile.campaignBestScore)||0)+' 分';
  ui.resultText.textContent=(g.runMode==='endless'?'无尽':'战役')+' · 得分 '+Math.floor(g.score)+' · 波次 '+g.wave+' · 击杀 '+g.kills+' · 等级 '+g.level+' · 最佳连杀 '+(g.comboBest||0)+' · 击败 Boss '+g.bossDefeated+' · 星尘 +'+shardGain;
  ui.finalBuild.innerHTML='';
  buildItems().forEach(function(item){var chip=document.createElement('span');chip.className='finalChip';chip.textContent=getDef(item).name;ui.finalBuild.appendChild(chip);});
  ui.gameOverOverlay.classList.remove('hidden');ui.bestText.textContent='最高纪录：'+bestScore+' 分 · '+bestWave+' 波';pointer=false;input.clear();updateUI();vibrate(outcome==='victory'?[25,35,25]:[35,35,75]);beep(outcome==='victory'?780:120,.16,.05);
}
function updateWaveMod(){
  g.route=selectedRoute();g.routeMod=g.route.mods;
  var modIndex=g.wave<2?0:Math.min(waveMods.length-1,1+Math.floor((g.wave-2)/2));
  g.waveMod=waveMods[(modIndex+g.bossDefeated)%waveMods.length];
  g.mutation=g.wave<4?null:enemyMutations[(g.wave-4)%enemyMutations.length];
  g.waveTarget=Math.floor(8+g.wave*2.3);
  if(g.routeMap&&g.routePlan&&g.routePlan.length){
    var stage=clamp(Math.floor((g.wave-1)/2),0,g.routeMap.stages.length-1),node=routeNodeForStage(stage,g.routeMap,g.routePlan),def=starNodeDefs[node.type]||starNodeDefs.combat,mods=def.mods||{};
    if(g.routeNodeStage!==stage){
      g.routeNodeStage=stage;g.nodeMod=mods;g.nodeRewardMultiplier=Number(mods.reward)||1;g.nodeLootFloor=mods.lootFloor||null;
      if(mods.heal&&ship&&Number.isFinite(ship.hp))ship.hp=Math.min(ship.maxHp,ship.hp+ship.maxHp*mods.heal);
      if(mods.event&&g.wave>1)g.pendingEvent=true;
      if(g.running&&g.wave>1)toast('进入节点 · '+def.label);
    }
  }
  if(g.missionDone&&g.nextMissionWave&&g.wave>=g.nextMissionWave)startMission();
  if(!g.contract||g.contract.wave!==g.wave)setWaveContract();
  ui.stageTag.textContent='WAVE '+g.wave+' · '+g.waveMod.name+' · '+g.route.name;
}
function startMission(){
  g.missionKills=0;g.missionTarget=Math.floor(11+g.wave*1.8);g.missionReward=Math.floor(650+g.wave*115);g.missionDone=false;g.nextMissionWave=0;
  toast('新任务 · 击破 '+g.missionTarget+' 架敌机');
}
function waveScale(){var n=Math.max(0,g.wave-1);return 1+n*.14+Math.pow(n,1.28)*.012;}
function pickRarity(floor){
  floor=floor||g.nodeLootFloor;
  var r=Math.random();
  var result=g.wave>=10&&r<.08?'legendary':g.wave>=5&&r<.25?'epic':g.wave>=2&&r<.62?'rare':'common';
  return floor&&rarityRank(floor)>rarityRank(result)?floor:result;
}
function rollItem(preferSlot,floor){
  var pool=itemDefs.filter(function(def){return isItemUnlocked(def)&&(!preferSlot||def.slot===preferSlot);});
  var def=pool[Math.floor(Math.random()*pool.length)]||itemDefs[0];
  return makeItem(def.id,pickRarity(floor));
}
function lootDefPool(category,seen){
  return itemDefs.filter(function(def){
    if(seen[def.id]||!isItemUnlocked(def))return false;
    if(category==='weapon')return def.slot==='weapon';
    if(category==='subweapon')return def.slot==='subweapon';
    return def.slot!=='weapon'&&def.slot!=='subweapon';
  });
}
function rollLootChoices(floor){
  // A level-up is a decision board, not a slot-machine full of main-weapon swaps:
  // main weapons are occasional, subweapons are visible as their own lane, and
  // the remaining card is always a component that can complete a synergy.
  var out=[],seen={},categories=[];
  if(Math.random()<.34)categories.push('weapon');
  if(Math.random()<.58)categories.push('subweapon');
  categories.push('component');
  while(categories.length<3)categories.push('component');
  categories=categories.slice(0,3);
  categories.forEach(function(category){
    var pool=lootDefPool(category,seen);
    if(!pool.length)pool=itemDefs.filter(function(def){return !seen[def.id]&&isItemUnlocked(def)&&def.slot!=='weapon';});
    if(!pool.length)pool=itemDefs.filter(function(def){return !seen[def.id]&&isItemUnlocked(def);});
    var def=pool[Math.floor(Math.random()*pool.length)];
    if(def){seen[def.id]=true;out.push(makeItem(def.id,pickRarity(floor)));}
  });
  while(out.length<3){
    var fallback=itemDefs.find(function(def){return !seen[def.id]&&isItemUnlocked(def);})||itemDefs.find(function(def){return isItemUnlocked(def);})||itemDefs[0];
    if(seen[fallback.id])break;
    seen[fallback.id]=true;out.push(makeItem(fallback.id,pickRarity(floor)));
  }
  return out;
}
function storeInventory(item,excludeSlot){
  var slot=getDef(item).slot,equipped=g.equipment[slot];
  if(excludeSlot!==slot&&equipped&&equipped.defId===item.defId){mergeInto(equipped,item);recalcBuild();toast('重复装备自动融合 · '+itemLabel(equipped));return true;}
  var duplicate=g.inventory.find(function(existing){return existing&&existing.defId===item.defId;});
  if(duplicate){mergeInto(duplicate,item);toast('重复装备已在背包内融合 · '+itemLabel(duplicate));return true;}
  if(g.inventory.length>=inventoryCapacity()){g.scrap++;toast('背包已满，装备拆解为 +1 废料');return false;}
  g.inventory.push(item);return true;
}
function mergeInto(target,incoming){
  var merged=core.mergeItem(target,incoming);if(!merged)return false;
  if(target.level>=6&&target.rarity===merged.rarity)g.scrap++;
  Object.assign(target,merged);
  return true;
}
function weaponBranchOptions(item){return (item&&weaponBranchDefs[getDef(item).id]||[]);}
function shouldOfferWeaponBranch(item){
  var equipped=g.equipment.weapon,options=weaponBranchOptions(item);
  return !!(item&&getDef(item).slot==='weapon'&&equipped&&equipped.defId===item.defId&&equipped.level>=6&&options.length);
}
function completeLootChoice(){
  g.pendingLoot=[];g.pendingLootFloor=null;g.pendingFusion=null;
  g.levelQueue=Math.max(0,g.levelQueue-1);g.choosing=false;ui.lootOverlay.classList.add('hidden');updateUI();
  if(g.levelQueue>0)openLoot();else maybeOpenEvent();
}
function renderWeaponBranchChoice(item){
  var target=g.equipment.weapon,options=weaponBranchOptions(item);g.pendingFusion={item:item,targetUid:target&&target.uid};
  ui.lootQueueText.textContent='主武器已达 Lv.6 · 选择一次行为分支（本次融合不会替换主武器）';
  ui.lootGrid.innerHTML='<div class="branchChoiceIntro"><b>'+safeText(getDef(item).name)+' · 重复核心</b><span>选择后会写入当前主武器，并改变后续弹道或战场反馈。</span></div>'+options.map(function(option,index){return '<article class="branchCard" style="--branch-accent:'+(index?'#c29aff':'#72f4ff')+'"><span class="branchIndex">0'+(index+1)+'</span><div><b>'+safeText(option.name)+'</b><p>'+safeText(option.desc)+'</p><small>'+((option.tags||[]).map(function(tag){return buildTagMeta[tag]&&buildTagMeta[tag].label||tag;}).join(' · ')||'行为分支')+'</small></div><button type="button" class="miniBtn">选择分支</button></article>';}).join('');
  if(ui.lootGrid.querySelectorAll)ui.lootGrid.querySelectorAll('.branchCard button').forEach(function(button,index){button.addEventListener('click',function(){chooseWeaponBranch(options[index].id);});});
  ui.rerollBtn.disabled=true;ui.salvageLootBtn.disabled=true;ui.lootOverlay.classList.remove('hidden');updateUI();beep(980,.08,.035);
}
function chooseWeaponBranch(branchId){
  var pending=g.pendingFusion,options=pending&&weaponBranchOptions(pending.item),target=g.equipment.weapon,branch=options&&options.find(function(option){return option.id===branchId;});
  if(!pending||!target||!branch||target.uid!==pending.targetUid)return false;
  var merged=core.mergeItem(target,pending.item);if(!merged)return false;Object.assign(target,merged,{branch:branch.id});recalcBuild();toast('主武器融合 · '+branch.name);beep(1080,.08,.035);completeLootChoice();return true;
}
function equipNewItem(item){
  var slot=getDef(item).slot,old=g.equipment[slot];
  if(old&&mergeInto(old,item)){recalcBuild();toast('融合升级 '+itemLabel(old));beep(980,.07,.035);return true;}
  if(old&&g.inventory.length>=inventoryCapacity()){toast('背包已满，请先拆解或腾出空位');return false;}
  if(old)g.inventory.push(old);
  g.equipment[slot]=item;recalcBuild();toast('已装备 '+getDef(item).name);beep(880,.06,.035);
  return true;
}
function claimLoot(item,mode){
  if(!g.choosing||g.pendingLoot.indexOf(item)<0)return;
  if(mode==='equip'&&shouldOfferWeaponBranch(item)){renderWeaponBranchChoice(item);return;}
  if(mode==='equip'){if(!equipNewItem(item))return;}else storeInventory(item);
  completeLootChoice();
}
function lootRerollCost(){return 2+g.lootRerolls;}
function rerollLoot(){
  if(!g.choosing)return;var cost=lootRerollCost();
  if(g.scrap<cost){toast('废料不足');return;}
  g.scrap-=cost;g.lootRerolls++;openLoot(true);updateUI();
}
function salvageLoot(){
  if(!g.choosing)return;g.scrap+=2;g.pendingLoot=[];g.pendingLootFloor=null;g.pendingFusion=null;g.levelQueue=Math.max(0,g.levelQueue-1);g.choosing=false;ui.lootOverlay.classList.add('hidden');ui.salvageLootBtn.disabled=false;updateUI();
  toast('战利品已拆解 · 废料 +2');if(g.levelQueue>0)openLoot();else maybeOpenEvent();
}
function openLoot(isReroll){
  if(!g.running||g.levelQueue<=0||g.updating)return;
  pointer=false;input.clear();g.accumulator=0;
  if(!isReroll){g.lootRerolls=0;g.pendingLootFloor=g.nextLootFloor;g.nextLootFloor=null;}g.pendingFusion=null;ui.salvageLootBtn.disabled=false;
  g.choosing=true;g.pendingLoot=rollLootChoices(g.pendingLootFloor);
  ui.lootGrid.innerHTML='';
  ui.lootQueueText.textContent=(g.pendingLootFloor?'Boss 核心缓存 · 至少'+rarityMeta[g.pendingLootFloor].label:'本次升级可选装备')+' · 待处理升级 '+g.levelQueue;
  g.pendingLoot.forEach(function(item,index){
    var def=getDef(item),rare=getRarity(item),slotName=slotMeta[def.slot].label,card=document.createElement('article');card.className='lootCard';
    var equipped=g.equipment[def.slot],same=equipped&&equipped.defId===item.defId;
    var branchText=branchDefinition(item)?' · 分支 '+branchDefinition(item).name:'';
    card.innerHTML=iconMarkup(item,'large')+'<div class="rarity '+rarityClass(item)+'">'+rare.label+' · '+slotName+'</div><div class="itemName">'+safeText(itemLabel(item))+'</div><div class="itemDesc">'+safeText(def.desc)+'</div><div class="itemSlot">强度 ×'+itemPower(item).toFixed(2)+' · '+(def.slot==='weapon'?'主武器低频出现':def.slot==='subweapon'?'独立副武器 · 不占主槽':'组件标签 · '+((def.tags||[]).map(function(tag){return buildTagMeta[tag]&&buildTagMeta[tag].label||tag;}).join(' / ')||'可用于联动'))+branchText+(same?' · 已装备 '+safeText(itemLabel(equipped))+'，选择后融合':'')+'</div><div class="cardButtons"><button class="miniBtn" type="button">'+(same&&shouldOfferWeaponBranch(item)?'选分支':same?'融合':'装备')+'</button><button class="miniBtn alt" type="button">入包</button></div>';
    card.innerHTML=card.innerHTML.replace('<div class="cardButtons">',compareEquipment(item)+'<div class="cardButtons">');
    card.querySelectorAll('button')[0].addEventListener('click',function(){claimLoot(item,'equip');});
    card.querySelectorAll('button')[1].addEventListener('click',function(){claimLoot(item,'bag');});
    ui.lootGrid.appendChild(card);
  });
  ui.rerollBtn.textContent='重构选项 · '+lootRerollCost()+' 废料';ui.rerollBtn.disabled=g.scrap<lootRerollCost();
  ui.lootOverlay.classList.remove('hidden');updateUI();beep(760,.08,.035);
}
function gainXp(amount){
  g.xp+=amount;
  while(g.xp>=g.xpNeed){g.xp-=g.xpNeed;g.level++;g.xpNeed=Math.floor(g.xpNeed*1.2+24);g.levelQueue++;}
  if(g.levelQueue&&!g.choosing)openLoot();
}
function dropAt(x,y,elite,boss){
  var r=Math.random();
  if(boss||(elite&&r<.55)){drops.push({type:'kit',x:x,y:y,r:10,vy:62,life:14});return;}
  if(elite||r<.1)drops.push({type:'heal',x:x,y:y,r:9,vy:72,life:12});
  else if(r<.18)drops.push({type:'emp',x:x,y:y,r:9,vy:72,life:12});
  else if(r<.235)drops.push({type:'crate',x:x,y:y,r:10,vy:68,life:12});
}
function pickEnemyType(roll,eliteRoll){
  if(g.wave>=6&&eliteRoll)return'elite';
  var pool=['scout','scout','scout','scout','scout'];
  if(g.wave>=2)pool.push('zigzag');
  if(g.wave>=3)pool.push('zigzag','gunner');
  if(g.wave>=5)pool.push('tank');
  if(g.wave>=7)pool.push('blade');
  if(g.wave>=9)pool.push('artillery');
  if(g.wave>=8)pool.push('carrier');
  return pool[Math.min(pool.length-1,Math.floor(roll*pool.length))];
}
function spawnEnemy(){
  var eliteChance=clamp(.02+g.wave*.004+(g.waveMod.elite||0),0,.3);
  var type=pickEnemyType(Math.random(),Math.random()<eliteChance);
  var mutation=g.mutation&&type!=='elite'&&Math.random()<clamp(.14+g.wave*.022,0,.62)?g.mutation:null;
  var sp=enemyDefs[type],scale=waveScale(),e={
    uid:uid('enemy'),type:type,frame:sp.frame,x:rnd(28,W-28),y:-42,r:sp.r,
    hp:sp.hp*scale*(type==='elite'?1.2:1)*(g.eventHazard||1)*(g.nodeMod.hp||1),maxHp:sp.hp*scale*(type==='elite'?1.2:1)*(g.eventHazard||1)*(g.nodeMod.hp||1),
    vy:sp.vy*g.waveMod.speed*(g.routeMod.speed||1)*(g.nodeMod.speed||1)*(1+g.wave*.006)*(g.eventSlow||1),vx:rnd(54,98),phase:rnd(0,6.28),
    fire:sp.fire?rnd(.75,sp.fire+1.1)*(g.wave<5?1.35:1):0,score:Math.round(sp.score*(1+g.wave*.055)*(g.nodeRewardMultiplier||1)),xp:Math.round(sp.xp*(1+g.wave*.035)),
    armor:clamp(sp.armor+g.wave*.007+g.waveMod.armor,0,.55),maxShield:sp.shield*scale*g.waveMod.shield,
    shield:sp.shield*scale*g.waveMod.shield,shieldRegen:sp.shield?sp.shield*.12:0,contact:sp.contact+g.wave*1.2,
    bulletDamage:(7+g.wave*1.55)*(g.routeMod.hp&&g.route.id==='salvage'?1.05:1),typeColor:sp.color,mutation:mutation,summoned:false,deployed:false,dead:false,slowTimer:0,lastHit:0,flash:0,attackWarn:0,attackAngle:0,warnedFire:false,dashTimer:rnd(1.2,2.4),dashActive:0,dashWarning:0,dashTargetX:0,dashTargetY:0
  };
  if(g.routeMod.hp)e.hp*=g.routeMod.hp;e.maxHp=e.hp;
  if(g.nodeMod.shield){e.maxShield*=g.nodeMod.shield;e.shield=e.maxShield;}
  if(g.contract&&g.contract.id==='hunt'&&!g.contract.targetUid&&!e.boss){
    e.marked=true;g.contract.targetUid=e.uid;
  }
  enemies.push(e);
}
function spawnShard(origin,side){
  if(enemies.length>=48)return;
  var sp=enemyDefs.scout,scale=waveScale()*.58;
  enemies.push({uid:uid('shard'),type:'scout',frame:sp.frame,x:clamp(origin.x+side*18,20,W-20),y:origin.y,r:11,
    hp:sp.hp*scale,maxHp:sp.hp*scale,vy:sp.vy*1.45,vx:64,phase:rnd(0,6.28),fire:0,score:18,xp:6,
    armor:0,maxShield:0,shield:0,shieldRegen:0,contact:sp.contact+g.wave,bulletDamage:0,typeColor:'#c29aff',mutation:null,summoned:true,dead:false,slowTimer:0,lastHit:0,flash:0,attackWarn:0,attackAngle:0,warnedFire:false,dashTimer:2,dashActive:0,dashWarning:0,dashTargetX:0,dashTargetY:0});
}
function spawnBoss(){
  var def=bossDefs[(Math.floor(g.wave/5)-1)%bossDefs.length],scale=1+g.wave*.18+Math.pow(g.wave/5,1.2)*.18;
  var hp=1000*scale*(g.nodeMod.hp||1),e={
    uid:uid('boss'),boss:true,bossId:def.id,frame:def.frame,type:'boss',x:W/2,y:-120,targetY:98,r:52,
    hp:hp,maxHp:hp,armor:clamp(.08+g.wave*.006,0,.38),maxShield:220*scale,shield:220*scale,
    shieldRegen:16*scale,attackTimer:1.8,shieldTimer:0,phase:1,angle:0,attackIndex:0,summonedPhase:0,score:Math.round((2200+g.wave*170)*(g.nodeRewardMultiplier||1)),
    xp:260+g.wave*18,typeColor:def.color,dead:false,slowTimer:0,lastHit:0,flash:0,attackWarn:0,attackAngle:0,warnedAttack:false
  };
  g.boss=e;enemies.push(e);ui.bossName.textContent=def.name;ui.bossWrap.classList.add('show');toast(def.name+' 已接近');beep(150,.2,.06);
}
function spawnProjectile(x,y,angle,speed,damage,r,color,kind){
  if(enemyBullets.length>=700)enemyBullets.splice(0,enemyBullets.length-699);
  enemyBullets.push({x:x,y:y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,damage:damage,r:r||4,color:color||'#ff718e',kind:kind||'orb',life:8});
}
function aimAngle(e){return Math.atan2(ship.y-e.y,ship.x-e.x);}
function enemyShotInterval(type){
  var base=type==='gunner'?.95:type==='elite'?.78:type==='artillery'?1.55:type==='carrier'?1.65:1.25;
  return base*(g.wave<3?1.55:g.wave<5?1.25:1)*(g.waveMod.fire||1)*(g.routeMod.fire||1)*(g.nodeMod.fire||1);
}
function bossPatternAt(e,index){
  var patterns={cathedral:['ring','fan','pincer'],serpent:['spiral','lance','sweep'],prism:['cross','fan','laser'],eclipse:['volley','laser','crossfire']};
  var list=patterns[e.bossId]||patterns.cathedral,count=e.phase>=2?list.length:2;
  return list[(index||0)%count];
}
function enemyShoot(e){
  var base=aimAngle(e),speed=(e.boss?185:148+g.wave*2),damage=e.boss?18+g.wave*1.8:e.bulletDamage;
  if(e.boss){bossAttack(e);return;}
  if(e.type==='artillery'){
    for(var i=-1;i<=1;i++)spawnProjectile(e.x,e.y,base+i*.18,speed*.9,damage*1.1,5,e.typeColor);
  }else if(e.type==='carrier'){
    for(var c=-1;c<=1;c++)spawnProjectile(e.x,e.y,base+c*.2,speed*.82,damage*.92,4,e.typeColor,'carrier');
  }else if(e.type==='elite'){
    for(var j=-2;j<=2;j++)spawnProjectile(e.x,e.y,base+j*.16,speed,damage*1.15,5,e.typeColor);
  }else if(e.type==='blade'){
    spawnProjectile(e.x,e.y,base,speed*1.2,damage*1.35,5,e.typeColor);
  }else spawnProjectile(e.x,e.y,base,speed,damage,4,e.typeColor);
}
function bossAttack(e){
  var phase=e.phase||1,base=Number.isFinite(e.attackAngle)?e.attackAngle:aimAngle(e),pattern=e.attackPattern||bossPatternAt(e,e.attackIndex||0);
  e.lastAttackPattern=pattern;e.attackIndex=(e.attackIndex||0)+1;
  if(pattern==='ring'||pattern==='crossfire'){
    var count=(pattern==='ring'?9:7)+phase*2,offset=pattern==='ring'?g.elapsed*.2:g.elapsed*.7;
    for(var i=0;i<count;i++)spawnProjectile(e.x,e.y,offset+i*Math.PI*2/count,pattern==='ring'?165+g.wave:190,14+g.wave*.75,5,e.typeColor);
  }else if(pattern==='spiral'){
    for(var k=0;k<8+phase;k++)spawnProjectile(e.x,e.y,g.elapsed*1.1+k*.62,150+phase*12,12+g.wave,5,e.typeColor);
  }else if(pattern==='cross'){
    for(var q=0;q<4;q++)spawnProjectile(e.x,e.y,base+q*Math.PI/2,182,16+g.wave,5,q%2?'#72f4ff':'#c29aff');
  }else if(pattern==='laser'){
    lasers.push({x:e.x,y:e.y,angle:base,length:Math.max(W,H)*1.35,width:14,life:1.15,delay:.9,hitTimer:0,damage:22+g.wave*1.5,color:e.bossId==='prism'?'#72f4ff':'#ff4e83'});
  }else if(pattern==='fan'||pattern==='sweep'){
    var shots=pattern==='fan'?5:7,spread=pattern==='fan'?.24:.52;
    for(var j=0;j<shots;j++)spawnProjectile(e.x,e.y,base-spread+spread*2*j/(shots-1),pattern==='fan'?195:172,pattern==='fan'?18+g.wave:14+g.wave,5,e.typeColor);
  }else if(pattern==='pincer'){
    for(var p=-1;p<=1;p+=2){spawnProjectile(e.x,e.y,base+p*.24,218,22+g.wave,6,'#ffb75c');spawnProjectile(e.x,e.y,base+p*.54,174,15+g.wave,5,e.typeColor);}
  }else if(pattern==='lance'){
    for(var l=-1;l<=1;l++)spawnProjectile(e.x,e.y,base+l*.1,235,22+g.wave*1.4,6,'#ff66c4');
  }else{
    for(var z=-2;z<=2;z++)spawnProjectile(e.x,e.y,base+z*.13,210,20+g.wave*1.3,6,'#ff718e');
  }
}
function updateBoss(e,dt){
  e.flash=Math.max(0,e.flash-dt);
  var moveDt=dt*(e.slowTimer>0?1-traits.slow:1);e.slowTimer=Math.max(0,e.slowTimer-dt);
  if(e.y<e.targetY){e.y=Math.min(e.targetY,e.y+72*moveDt);return;}
  e.angle+=moveDt;
  var ratio=e.hp/e.maxHp,previousPhase=e.phase;e.phase=ratio<=.32?3:(ratio<=.66?2:1);
  if(previousPhase!==e.phase){
    pulseScreen(7,.16);burst(e.x,e.y,e.typeColor,24);addDamageText(e.x,e.y-(e.r||48)-28,0,'#ffd76a','PHASE '+e.phase);toast('Boss 阶段 '+e.phase+' · 攻击模式升级');beep(180,.12,.045);
    if(e.bossId==='prism'&&e.phase>=2&&e.summonedPhase<e.phase){e.summonedPhase=e.phase;spawnEnemy();if(e.phase===3)spawnEnemy();toast('镜像护卫部署 · 击破护卫可争取输出窗口');}
  }
  if(e.bossId==='cathedral')e.x=W/2+Math.sin(e.angle*.65)*W*.27;
  else if(e.bossId==='serpent')e.x=W/2+Math.sin(e.angle*.9)*W*.31;
  else if(e.bossId==='prism'){e.x=W/2+Math.sin(e.angle*.42)*W*.22;e.y=e.targetY+Math.sin(e.angle*1.1)*12;}
  else e.x=W/2+Math.sin(e.angle*.52)*W*.2;
  e.attackTimer-=dt;
  if(e.attackTimer>0&&e.attackTimer<=.95&&!e.warnedAttack){e.warnedAttack=true;e.attackWarn=.95;e.attackPattern=bossPatternAt(e,e.attackIndex||0);e.attackAngle=aimAngle(e);}
  if(e.attackWarn>0)e.attackWarn=Math.max(0,e.attackWarn-dt);
  if(e.shield<=0){e.shieldTimer-=dt;if(e.shieldTimer<=0){e.shield=Math.min(e.maxShield,e.maxShield*(e.phase===3?.42:.72));burst(e.x,e.y,e.typeColor,20);toast('Boss 护盾重启');}}
  if(e.attackTimer<=0){bossAttack(e);e.attackTimer=Math.max(1.3,2.5-e.phase*.32)*(g.waveMod.fire||1)*(g.routeMod.fire||1)*(g.nodeMod.fire||1);e.warnedAttack=false;e.attackWarn=0;}
  if(e.shield>0&&e.shield<e.maxShield&&g.elapsed-e.lastHit>2.5)e.shield=Math.min(e.maxShield,e.shield+e.shieldRegen*dt);
}
function damageEnemy(e,raw,source){
  if(!e||e.dead)return;
  var contractAmp=g.breakWindow>0&&g.contract&&g.contract.id==='break'&&g.contract.complete?1.14:1;
  var amount=raw*contractAmp,shieldBefore=Math.max(0,Number(e.shield)||0),hpBefore=Math.max(0,Number(e.hp)||0);
  if(e.shield>0){var absorbed=Math.min(e.shield,amount);e.shield-=absorbed;amount-=absorbed;if(e.boss&&e.shield<=0){e.shield=0;e.shieldTimer=5.2;toast('Boss 破盾 · 输出窗口');}}
  if(shieldBefore>0&&e.shield<=0)advanceWaveContract('break',1);
  if(amount>0)e.hp-=Math.max(1,amount*(1-e.armor));
  var shieldDamage=Math.max(0,shieldBefore-Math.max(0,Number(e.shield)||0)),hullDamage=Math.max(0,hpBefore-Math.max(0,Number(e.hp)||0));
  if(shieldDamage>0)addDamageText(e.x,e.y-(e.r||18)-7,shieldDamage,'#72f4ff','−'+Math.max(1,Math.round(shieldDamage))+' 盾');
  if(hullDamage>0)addDamageText(e.x,e.y-(e.r||18)-18,hullDamage,e.boss?'#ffd76a':'#fff',null,!!(source&&source.hitCritical));
  if(e.boss&&shieldBefore>0&&e.shield<=0){addDamageText(e.x,e.y-(e.r||18)-31,0,'#ffd76a','破盾');pulseScreen(10,.26);}
  e.lastHit=g.elapsed;e.flash=.08;impact(e.x,e.y,e.typeColor,e.boss||e.type==='elite');
  if(source&&source.slow!==false&&traits.slow>0)e.slowTimer=Math.max(e.slowTimer,traits.slowTime||1);
  if(source&&source.auxSlow)e.slowTimer=Math.max(e.slowTimer,1.1);
  if(source&&source.chain&&source.chainRemaining>0){chainFrom(e,raw*(traits.chainPower||.45),source);}
  if(e.hp<=0)killEnemy(e);
}
function chainFrom(origin,amount,source){
  var target=null,best=165*165;
  enemies.forEach(function(e){if(e.dead||e===origin||(source&&source.hitIds&&source.hitIds[e.uid]) )return;var dist=d2(origin,e);if(dist<best){best=dist;target=e;}});
  if(target){if(source&&source.hitIds)source.hitIds[target.uid]=true;if(source)source.chainRemaining--;chainFx.push({x1:origin.x,y1:origin.y,x2:target.x,y2:target.y,life:.22,color:'#72f4ff'});damageEnemy(target,amount,{noChain:true});if(source&&source.chainRemaining>0)chainFrom(target,amount*(traits.chainPower||.45),source);}
}
function killEnemy(e){
  if(e.dead||g.rewarded)return;e.dead=true;
  if(e.mutation&&e.mutation.id==='revenge')for(var ri=0;ri<8;ri++)spawnProjectile(e.x,e.y,ri*Math.PI/4,155+g.wave*2,e.bulletDamage*.72,4,e.mutation.color,'revenge');
  if(e.mutation&&e.mutation.id==='split'&&!e.summoned){spawnShard(e,-1);spawnShard(e,1);}
  g.combo=Math.min(30,(g.combo||0)+1);g.comboTimer=4.6;g.comboBest=Math.max(g.comboBest||0,g.combo);
  var overdriveGain=e.boss?38:e.type==='elite'?17:5;g.overdrive=Math.min(100,(g.overdrive||0)+overdriveGain+Math.min(4,g.combo||0)*.45);
  var scoreBoost=1+Math.min(20,g.combo-1)*.05;g.score+=Math.round(e.score*scoreBoost);g.kills++;g.waveKills++;g.missionKills++;gainXp(e.xp);dropAt(e.x,e.y,e.type==='elite',!!e.boss);
  if(g.combo===5||g.combo===10||g.combo===20)toast('COMBO x'+scoreBoost.toFixed(2)+' · 连杀奖励');
  impact(e.x,e.y,e.typeColor,true);burst(e.x,e.y,e.typeColor,e.boss?48:(e.type==='elite'?28:15));beep(e.boss?120:(e.type==='elite'?260:430),.045,.025);
  if(e.boss)pulseScreen(12,.3);else if(e.type==='elite')pulseScreen(4,.08);
  if(e.type==='elite')g.eliteKills++;
  if(e.marked)advanceWaveContract('hunt',1);
  if(traits.healOnKill>0)ship.hp=Math.min(ship.maxHp,ship.hp+traits.healOnKill*(e.type==='elite'?2.2:0.22));
  if(traits.shieldOnKill>0)ship.shield=Math.min(ship.maxShield,ship.shield+traits.shieldOnKill*(e.type==='elite'?1.8:1));
  if(traits.killHaste)ship.hasteTimer=Math.max(ship.hasteTimer,traits.killHaste);
  if(e.boss){
    g.boss=null;g.bossDefeated++;if(g.runMode==='campaign'&&g.wave>=g.finalWave){endGame('victory');return;}g.scrap+=3;g.levelQueue++;g.nextLootFloor=g.wave>=15?'legendary':'epic';ui.bossWrap.classList.remove('show');waveAdvanceAfterBoss();
    if(!g.choosing)openLoot();toast('Boss 击破 · 核心缓存 / 废料 +3');return;
  }
  if(!g.missionDone&&g.missionKills>=g.missionTarget){g.missionDone=true;g.nextMissionWave=g.wave+2;g.score+=g.missionReward;g.scrap+=2;ship.hp=Math.min(ship.maxHp,ship.hp+32);toast('任务完成 · +'+g.missionReward+' 分 / 废料 +2');}
}
function waveAdvanceAfterBoss(){
  g.wave++;g.waveKills=0;g.waveBreaches=0;g.spawnTimer=1.6;updateWaveMod();g.waveTarget+=3;burst(W/2,100,'#ffd76a',42);
}
function advanceWave(){
  if(g.boss||g.waveKills<g.waveTarget||enemies.some(function(e){return !e.dead&&!e.boss;}))return;
  g.wave++;g.waveKills=0;g.waveBreaches=0;g.spawnTimer=.75;updateWaveMod();
  if(g.wave%5===0)spawnBoss();else {toast('WAVE '+g.wave+' · '+g.waveMod.name);if(g.wave>=3&&g.wave%3===0){g.pendingEvent=true;maybeOpenEvent();}}
}
function damageShip(amount){
  if(!g.running||g.paused||g.choosing||ship.invuln>0)return false;
  var blocked=Math.min(ship.shield,amount);ship.shield-=blocked;amount-=blocked;
  if(blocked>0)addDamageText(ship.x,ship.y-30,blocked,'#72f4ff','−'+Math.max(1,Math.round(blocked))+' 盾');
  if(blocked>0&&traits.reflect>0){
    var enemy=enemies.filter(function(e){return !e.dead;}).sort(function(a,b){return d2(a,ship)-d2(b,ship);})[0];
    if(enemy&&Math.random()<traits.reflect){damageEnemy(enemy,blocked*.85,{noChain:true});chainFx.push({x1:ship.x,y1:ship.y,x2:enemy.x,y2:enemy.y,life:.2,color:'#ffd76a'});}
  }
  if(amount>0){ship.hp-=amount;addDamageText(ship.x,ship.y-18,amount,'#ff718e');}pulseScreen(Math.min(8,2+amount*.12),.12);ship.invuln=.2;burst(ship.x,ship.y,'#ff718e',10);vibrate(16);
  if(ship.hp<=0)endGame();
  return true;
}
function breachEnemy(e){
  if(!e||e.dead||e.boss)return false;
  e.dead=true;
  var routePressure=(g.routeMod&&g.routeMod.speed)||1;
  var damage=Math.max(4,Math.round((Number(e.contact)||8)*(.52+g.wave*.014)*routePressure));
  g.waveBreaches=(g.waveBreaches||0)+1;
  g.breaches=(g.breaches||0)+1;
  g.combo=0;g.comboTimer=0;
  g.score=Math.max(0,g.score-Math.max(12,damage*4));
  var applied=damageShip(damage);
  addDamageText(W*.5,H*.42,applied?damage:0,'#ff718e',applied?'BREACH':'已避开');
  toast(applied?'敌机突破防线 · 受到 '+damage+' 点冲击':'敌机突破防线 · 无敌保护避开冲击，连杀已中断');
  pulseScreen(Math.min(7,2+damage*.08),.12);
  return true;
}
function useEmp(){
  if(!g.running||g.paused||g.choosing||g.empCooldown>0||traits.empCharges<=0)return;
  traits.empCharges--;g.empCooldown=traits.empCooldownMax;enemyBullets=[];lasers=[];
  enemies.slice().forEach(function(e){if(!e.dead)damageEnemy(e,ship.damage*(traits.empDamage||3.1)*(e.shield>0?1.45:1),{slow:false});});
  enemies=enemies.filter(function(e){return !e.dead;});pulseScreen(5,.13);burst(ship.x,ship.y,'#72f4ff',38);toast('EMP PULSE · 弹幕清除');vibrate(30);beep(210,.13,.05);updateUI();
  if(traits.empOverload){ship.hasteTimer=Math.max(ship.hasteTimer,2.6);toast('电容回路 · 主炮过载');}
}
function useOverdrive(){
  if(!g.running||g.paused||g.choosing||g.eventActive||g.overdrive<100){if(g.running&&g.overdrive<100)toast('过载协议尚未充满 · 继续维持连杀');return false;}
  enemyBullets=[];lasers=[];
  var before=enemies.length;
  enemies.slice().forEach(function(e){if(!e.dead)damageEnemy(e,ship.damage*(e.boss?2.35:e.type==='elite'?4.8:3.2),{slow:false,hitCritical:true});});
  enemies=enemies.filter(function(e){return !e.dead;});g.overdrive=0;
  ship.hasteTimer=Math.max(ship.hasteTimer,4.8);ship.shield=Math.min(ship.maxShield,ship.shield+ship.maxShield*.28);g.combo=Math.min(30,(g.combo||0)+4);g.comboTimer=4.6;
  pulseScreen(9,.2);burst(ship.x,ship.y,'#ffd76a',54);toast('过载协议 · 清场 '+before+' 个威胁 · 火力爆发');vibrate([20,30,55]);beep(1320,.14,.06);updateUI();return true;
}
function useDash(){
  if(!g.running||g.paused||g.choosing||g.dashCooldown>0)return false;
  var oldX=ship.x,oldY=ship.y,destination=core.dashDestination(ship,W,H);
  ship.x=destination.x;ship.y=destination.y;
  ship.targetX=ship.x;ship.targetY=ship.y;ship.invuln=Math.max(ship.invuln,.62);g.dashCooldown=4.5;
  enemyBullets=enemyBullets.filter(function(b){return d2(b,ship)>92*92;});
  chainFx.push({x1:oldX,y1:oldY,x2:ship.x,y2:ship.y,life:.22,color:'#c29aff'});
  pulseScreen(3,.08);burst(oldX,oldY,'#9a7cff',16);burst(ship.x,ship.y,'#72f4ff',18);
  toast('相位瞬闪 · 近身弹幕清除');vibrate(18);beep(1040,.06,.03);updateUI();return true;
}
function fireInterval(){return ship.fireRate*(ship.hasteTimer>0?(traits.hasteRate||1):1)*(ship.driftTimer>0?.78:1)*(g.contractHasteTimer>0?.78:1)*(ship.jammed?1.38:1);}
function shoot(){
  ship.fireTimer=Math.max(0,ship.fireTimer)+fireInterval();
  var count=ship.shots;
  for(var i=0;i<count;i++){
    var offset=i-(count-1)/2,angle=(Number.isFinite(ship.aimAngle)?ship.aimAngle:-Math.PI/2)+offset*ship.spread;
    bullets.push({uid:uid('bullet'),x:ship.x+Math.cos(angle)*8,y:ship.y+Math.sin(angle)*8,vx:Math.cos(angle)*ship.bulletSpeed,vy:Math.sin(angle)*ship.bulletSpeed,r:traits.phase?4:3.3,damage:ship.damage,remainingPierce:ship.pierce+(traits.splitPierce&&traits.weaponMode==='splitter'?1:0),hitIds:{},chain:traits.chain>0,color:traits.bulletColor,kind:traits.weaponMode||'pulse'});
  }
  beep(traits.phase?900:760,.016,.009);
}
function shootAux(){
  if(!traits.auxMode||traits.auxDamage<=0)return;
  var target=enemies.filter(function(e){return !e.dead;}).sort(function(a,b){
    var priority=function(e){return e.boss?4:e.type==='elite'?3:e.type==='carrier'?2:e.type==='tank'?1:0;};
    return priority(b)-priority(a)||d2(a,ship)-d2(b,ship);
  })[0],angle=target?Math.atan2(target.y-ship.y,target.x-ship.x):-Math.PI/2;
  if(traits.auxMode==='missile'){
    bullets.push({uid:uid('missile'),x:ship.x,y:ship.y-10,vx:Math.cos(angle)*330,vy:Math.sin(angle)*330,speed:330,targetUid:target&&target.uid,r:5,damage:traits.auxDamage,remainingPierce:0,hitIds:{},chain:false,color:'#ff66c4',kind:'missile',aux:true,auxSlow:traits.auxSlow});
  }else if(traits.auxMode==='drone'){
    var droneCount=Math.max(1,traits.auxCount||1);
    for(var di=0;di<droneCount;di++){
      var droneTarget=enemies.filter(function(e){return !e.dead;}).sort(function(a,b){return (a.boss?4:a.type==='elite'?3:a.type==='carrier'?2:0)-(b.boss?4:b.type==='elite'?3:b.type==='carrier'?2:0)||d2(a,ship)-d2(b,ship);})[di%Math.max(1,enemies.filter(function(e){return !e.dead;}).length)]||target;
      var droneAngle=droneTarget?Math.atan2(droneTarget.y-ship.y,droneTarget.x-ship.x):-Math.PI/2;
      bullets.push({uid:uid('drone'),x:ship.x+Math.cos(droneAngle)*10,y:ship.y+Math.sin(droneAngle)*10,vx:Math.cos(droneAngle)*360,vy:Math.sin(droneAngle)*360,speed:360,targetUid:droneTarget&&droneTarget.uid,r:4.6,damage:traits.auxDamage,remainingPierce:0,hitIds:{},chain:false,color:'#ffb75c',kind:'drone',aux:true,auxSlow:traits.auxSlow});
    }
  }else if(traits.auxMode==='beam'){
    bullets.push({uid:uid('beam'),x:ship.x,y:ship.y-12,vx:0,vy:-720,r:6.5,damage:traits.auxDamage,remainingPierce:Math.max(0,traits.auxPierce||0),hitIds:{},chain:traits.chain>0,chainRemaining:Math.max(0,traits.chain),color:'#c29aff',kind:'beam',aux:true});
  }else if(traits.auxMode==='mine'){
    mines.push({x:ship.x,y:ship.y-24,r:10,armed:.35,life:11,damage:traits.auxDamage,aux:true});
  }else{
    [-.42,.42].forEach(function(offset){var a=-Math.PI/2+offset;bullets.push({uid:uid('flak'),x:ship.x,y:ship.y-8,vx:Math.cos(a)*480,vy:Math.sin(a)*480,r:3.4,damage:traits.auxDamage,remainingPierce:0,hitIds:{},chain:false,color:'#ffd76a',kind:'flak',aux:true});});
  }
  burst(ship.x,ship.y,traits.auxMode==='missile'?'#ff66c4':traits.auxMode==='beam'?'#c29aff':traits.auxMode==='drone'?'#ffb75c':'#ffd76a',traits.auxMode==='mine'?8:5);
}
function orbitalPos(index){
  var count=Math.max(1,orbitalCount()),angle=g.elapsed*1.7+index*Math.PI*2/count;
  return{x:ship.x+Math.cos(angle)*32,y:ship.y+Math.sin(angle)*32};
}
function shootOrbitals(){
  if(orbitalCount()<=0)return;
  for(var i=0;i<orbitalCount();i++){
    var pos=orbitalPos(i),target=null,best=Infinity;
    enemies.forEach(function(e){if(!e.dead){var priority=traits.orbitalHunter?(e.boss?100000:e.type==='elite'?50000:e.type==='carrier'?25000:0):0,dist=d2(pos,e)-priority;if(dist<best){best=dist;target=e;}}});
    if(target){var angle=Math.atan2(target.y-pos.y,target.x-pos.x);bullets.push({uid:uid('orb'),x:pos.x,y:pos.y,vx:Math.cos(angle)*430,vy:Math.sin(angle)*430,speed:430,targetUid:target.uid,r:3,damage:traits.orbitalDamage,remainingPierce:0,hitIds:{},chain:false,color:'#ffb75c',kind:'sentry'});}
  }
}
function orbitalCount(){return traits.orbitals+(traits.swarm&&ship.swarmTimer>0?2:0);}
function update(dt){
  if(!canSimulate())return;
  // Finish one atomic simulation step, then open loot. Never simulate behind it.
  g.updating=true;
  try{updateCombat(dt);}finally{g.updating=false;}
  if(g.running&&!g.paused&&!g.eventActive&&g.levelQueue>0&&!g.choosing)openLoot();
}
function updateCombat(dt){
  screenFx.shake=Math.max(0,screenFx.shake-dt*30);screenFx.flash=Math.max(0,screenFx.flash-dt*3.4);
  damageTexts.forEach(function(t){t.y+=t.vy*dt;t.vy+=18*dt;t.life-=dt;});
  ship.driftTimer=Math.max(0,ship.driftTimer-dt);
  ship.swarmTimer=Math.max(0,ship.swarmTimer-dt);
  g.elapsed+=dt;ship.fireTimer-=dt;ship.invuln=Math.max(0,ship.invuln-dt);ship.hasteTimer=Math.max(0,ship.hasteTimer-dt);g.contractHasteTimer=Math.max(0,g.contractHasteTimer-dt);g.breakWindow=Math.max(0,g.breakWindow-dt);g.empCooldown=Math.max(0,g.empCooldown-dt);g.dashCooldown=Math.max(0,g.dashCooldown-dt);g.comboTimer=Math.max(0,(g.comboTimer||0)-dt);if(g.comboTimer<=0)g.combo=0;
  if(ship.regen>0)ship.hp=Math.min(ship.maxHp,ship.hp+ship.regen*dt);
  var oldX=ship.x,oldY=ship.y;
  var keyX=(keys.ArrowRight||keys.KeyD||keys.d?1:0)-(keys.ArrowLeft||keys.KeyA||keys.a?1:0),keyY=(keys.ArrowDown||keys.KeyS||keys.s?1:0)-(keys.ArrowUp||keys.KeyW||keys.w?1:0);
  if(keyX||keyY){var keyLen=Math.hypot(keyX,keyY)||1;ship.targetX=clamp(ship.x+keyX/keyLen*150,28,Math.max(28,W-28));ship.targetY=clamp(ship.y+keyY/keyLen*150,H*.42,Math.max(H*.42,H-46));ship.dashX=keyX;ship.dashY=keyY;ship.aimAngle=Math.atan2(keyY,keyX);}
  ship.x+=(ship.targetX-ship.x)*Math.min(1,dt*ship.moveLerp);ship.y+=(ship.targetY-ship.y)*Math.min(1,dt*ship.moveLerp);
  ship.x=clamp(ship.x,28,W-28);ship.y=clamp(ship.y,H*.42,H-46);
  var moved=Math.hypot(ship.x-oldX,ship.y-oldY);
  if(g.contract&&g.contract.id==='drift'&&!g.contract.complete){g.contract.progress=Math.min(g.contract.target,g.contract.progress+moved);if(g.contract.progress>=g.contract.target)completeWaveContract('drift');}
  if(traits.drift){
    ship.driftCharge=clamp((ship.driftCharge||0)+(moved>18*dt?dt:-dt*.7),0,2.2);
    if(ship.driftCharge>=2.2){ship.driftCharge=0;ship.driftTimer=1.2;ship.invuln=Math.max(ship.invuln,.22);toast('漂移超载 · 射速提升');}
  }else ship.driftCharge=0;
  ship.jammed=enemies.some(function(e){return !e.dead&&e.mutation&&e.mutation.id==='jammer'&&d2(e,ship)<190*190;});
  if(ship.fireTimer<=0)shoot();
  ship.auxFireTimer=Math.max(0,(ship.auxFireTimer||0)-dt);
  if(traits.auxMode&&ship.auxFireTimer<=0){ship.auxFireTimer=traits.auxInterval;shootAux();}
  if(orbitalCount()>0){g.orbTimer=(g.orbTimer||0)-dt;if(g.orbTimer<=0){g.orbTimer=.72;shootOrbitals();}}
  if(traits.mineEvery>0){g.mineTimer-=dt;if(g.mineTimer<=0){g.mineTimer=traits.mineEvery;mines.push({x:ship.x,y:ship.y,r:8,armed:.45,life:12,damage:traits.mineDamage});}}
  if(!g.boss&&g.waveKills>=g.waveTarget)advanceWave();
  g.spawnTimer-=dt;
  if(!g.boss&&g.waveKills<g.waveTarget&&g.spawnTimer<=0){if(enemies.length<48)spawnEnemy();var early=g.wave<5;g.spawnTimer=(early?Math.max(.28,.98-g.wave*.035):Math.max(.18,.72-g.wave*.018))*rnd(early ? .86 : .7,1.12)*(early?Math.max(1,g.waveMod.spawn||1):(g.waveMod.spawn||1));}
  stars.forEach(function(s){s.y+=s.v*dt;if(s.y>H){s.y=-3;s.x=Math.random()*W;}});
  enemies.forEach(function(e){
    if(e.dead)return;
    if(e.boss){updateBoss(e,dt);return;}
    e.flash=Math.max(0,e.flash-dt);e.slowTimer=Math.max(0,e.slowTimer-dt);e.phase+=dt;
    var slow=e.slowTimer>0?(1-(traits.slow||0)) :1;
    var speedFactor=1;
    if(e.type==='artillery'&&e.y>Math.max(86,H*.2))speedFactor=0;
    if(e.type==='carrier'&&e.y>Math.max(120,H*.24))speedFactor=.08;
    if(e.type==='blade'){
      e.dashTimer-=dt;
      if(e.dashTimer<=.55&&e.dashTimer>0&&e.dashWarning<=0){e.dashWarning=.55;e.dashTargetX=ship.x;e.dashTargetY=ship.y;}
      if(e.dashWarning>0)e.dashWarning=Math.max(0,e.dashWarning-dt);
      if(e.dashTimer<=0){e.dashTimer=rnd(2.3,3.5);e.dashActive=.52;e.dashWarning=0;}
      e.dashActive=Math.max(0,e.dashActive-dt);if(e.dashActive>0)speedFactor=2.15;
    }
    if(e.mutation&&e.mutation.id==='berserk'&&e.hp/e.maxHp<.5){speedFactor*=1.55;e.fire-=dt*.55;}
    e.y+=e.vy*slow*dt*speedFactor;
    if(e.type==='zigzag')e.x+=Math.sin(e.phase*3.2)*e.vx*dt*slow;
    else if(e.type==='gunner')e.x+=Math.sin(e.phase*1.8)*e.vx*.45*dt*slow;
    else if(e.type==='blade'){if(e.dashActive>0)e.x+=(ship.x-e.x)*Math.min(1,dt*3.2);else e.x+=Math.sin(e.phase*2.4)*e.vx*.55*dt*slow;}
    else if(e.type==='elite')e.x+=Math.sin(e.phase*1.4)*e.vx*.35*dt;
    e.x=clamp(e.x,e.r,W-e.r);e.fire-=dt*slow;
    if(e.type==='tank'&&e.hp/e.maxHp<.45)e.fire-=dt*.55;
    if(e.type==='carrier'){
      e.x+=Math.sin(e.phase*1.35)*e.vx*.32*dt*slow;
      if(!e.deployed&&e.hp/e.maxHp<=.55){e.deployed=true;spawnShard(e,-1);spawnShard(e,1);burst(e.x,e.y,e.typeColor,22);addDamageText(e.x,e.y-e.r-18,0,e.typeColor,'护卫部署');toast('护卫载体 · 两架护卫已释放');}
    }
    if(e.type!=='scout'){
      var warnWindow=e.type==='artillery'?.82:e.type==='carrier'?.64:e.type==='elite'?.48:e.type==='tank'?.38:.3;
      if(e.fire>0&&e.fire<=warnWindow&&!e.warnedFire){e.warnedFire=true;e.attackWarn=warnWindow;e.attackAngle=aimAngle(e);}
      if(e.attackWarn>0)e.attackWarn=Math.max(0,e.attackWarn-dt);
    }
    if(e.type!=='scout'&&e.fire<=0&&e.y>30){enemyShoot(e);e.fire=enemyShotInterval(e.type);e.warnedFire=false;e.attackWarn=0;}
    if(e.shield<e.maxShield&&g.elapsed-e.lastHit>3)e.shield=Math.min(e.maxShield,e.shield+e.shieldRegen*dt);
  });
  bullets.forEach(function(b){
    if(b.targetUid){var target=enemies.find(function(e){return !e.dead&&e.uid===b.targetUid;});if(target){var angle=Math.atan2(target.y-b.y,target.x-b.x),turn=Math.min(1,dt*7);b.vx+=(Math.cos(angle)*(b.speed||430)-b.vx)*turn;b.vy+=(Math.sin(angle)*(b.speed||430)-b.vy)*turn;}}
    b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
  });
  enemyBullets.forEach(function(b){b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;});
  drops.forEach(function(d){d.y+=d.vy*dt;d.life-=dt;});
  particles.forEach(function(p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985;p.life-=dt;});
  mines.forEach(function(m){m.armed-=dt;m.life-=dt;});
  lasers.forEach(function(l){l.delay-=dt;l.life-=dt;l.hitTimer-=dt;});
  chainFx.forEach(function(f){f.life-=dt;});
  impactFx.forEach(function(f){f.life-=dt;});

  for(var i=bullets.length-1;i>=0;i--){
    var b=bullets[i],consumed=false;
    var targets=enemies.filter(function(e){return !e.dead&&!b.hitIds[e.uid]&&pointSegmentDistance(e.x,e.y,b.prevX,b.prevY,b.x,b.y)<b.r+e.r;});
    targets.sort(function(a,c){return (a.x-c.x)*b.vx+(a.y-c.y)*b.vy;});
    for(var j=0;j<targets.length;j++){
      var e=targets[j];if(e.dead)continue;
      var rr=b.r+e.r;
      if(pointSegmentDistance(e.x,e.y,b.prevX,b.prevY,b.x,b.y)<rr){
        var critical=Math.random()<ship.crit;b.hitIds[e.uid]=true;b.hitCritical=critical;damageEnemy(e,b.damage*(critical?ship.critMult:1),b);b.hitCritical=false;
        if(b.remainingPierce>0)b.remainingPierce--;else{bullets.splice(i,1);consumed=true;break;}
      }
    }
    if(consumed)continue;
  }
  for(var k=enemyBullets.length-1;k>=0;k--){
    var eb=enemyBullets[k];
    if(eb.x>-35&&eb.x<W+35&&eb.y>-35&&eb.y<H+45){
      if(pointSegmentDistance(ship.x,ship.y,eb.prevX,eb.prevY,eb.x,eb.y)<eb.r+ship.r){enemyBullets.splice(k,1);damageShip(eb.damage);if(!g.running)return;}
    }else enemyBullets.splice(k,1);
  }
  for(var li=lasers.length-1;li>=0;li--){
    var laser=lasers[li];if(laser.delay<=0&&laser.hitTimer<=0){var ex=laser.x+Math.cos(laser.angle)*laser.length,ey=laser.y+Math.sin(laser.angle)*laser.length;if(pointSegmentDistance(ship.x,ship.y,laser.x,laser.y,ex,ey)<laser.width+ship.r){damageShip(laser.damage);laser.hitTimer=.28;if(!g.running)return;}}
    if(laser.life<=0)lasers.splice(li,1);
  }
  for(var ei=enemies.length-1;ei>=0;ei--){
    var en=enemies[ei];if(!en||en.dead)continue;
    if(d2(en,ship)<(en.r+ship.r)*(en.r+ship.r)){damageShip(en.boss?35:en.contact);if(!en.boss)enemies.splice(ei,1);if(!g.running)return;}
    else if(en.y>H+70&&!en.boss){breachEnemy(en);enemies.splice(ei,1);if(!g.running)return;}
  }
  for(var di=drops.length-1;di>=0;di--){
    var drop=drops[di];
    if(d2(drop,ship)<(drop.r+ship.r)*(drop.r+ship.r)){
      if(drop.type==='kit'){g.upgradeKits++;toast('强化芯片 +1 · 在构筑界面强化装备');}
      else if(drop.type==='heal'){ship.hp=Math.min(ship.maxHp,ship.hp+28);toast('维修包 · HP +28');}
      else if(drop.type==='emp'){traits.empCharges=Math.min(traits.empMax,traits.empCharges+1);toast('EMP 充能 +1');}
      else{var loot=rollItem();if(!g.equipment[getDef(loot).slot])equipNewItem(loot);else if(storeInventory(loot))toast('战场装备 · '+getDef(loot).name);}
      if(traits.swarm)ship.swarmTimer=8;
      drops.splice(di,1);beep(660,.05,.03);
    }else if(drop.life<=0)drops.splice(di,1);
  }
  for(var mi=mines.length-1;mi>=0;mi--){
    var mine=mines[mi];if(mine.armed<=0){
      var target=enemies.find(function(e){return !e.dead&&d2(e,mine)<110*110;});
      if(target){enemies.forEach(function(e){if(!e.dead&&d2(e,mine)<125*125)damageEnemy(e,mine.damage,{slow:traits.slow>0});});burst(mine.x,mine.y,'#c29aff',30);mines.splice(mi,1);continue;}
    }
    if(mine&&mine.life<=0)mines.splice(mi,1);
  }
  bullets=bullets.filter(function(b){return b.x>-40&&b.x<W+40&&b.y>-60&&b.y<H+60;});
  enemyBullets=enemyBullets.filter(function(b){return b.life>0;});
  enemies=enemies.filter(function(e){return !e.dead;});ensureHuntTarget();particles=particles.filter(function(p){return p.life>0;});chainFx=chainFx.filter(function(f){return f.life>0;});impactFx=impactFx.filter(function(f){return f.life>0;});damageTexts=damageTexts.filter(function(t){return t.life>0;});
}
function pointSegmentDistance(px,py,x1,y1,x2,y2){
  var dx=x2-x1,dy=y2-y1;if(dx===0&&dy===0)return Math.hypot(px-x1,py-y1);
  var t=((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy);t=clamp(t,0,1);
  var x=x1+t*dx,y=y1+t*dy;return Math.hypot(px-x,py-y);
}
function canSimulate(){return g.running&&!g.paused&&!g.choosing&&!g.eventActive&&!g.suspended;}
function loop(time){
  if(!g.running||g.paused)return;
  var elapsed=Math.max(0,(time-g.last)/1000);g.last=time;
  if(elapsed>.5&&canSimulate()){
    togglePause();byId('pauseReason').textContent='检测到较长卡顿，已暂停保护战机。点继续恢复，不会快进补算伤害。';return;
  }
  core.stepFrame(g,elapsed,canSimulate,update);
  g.hudTimer=(g.hudTimer||0)+elapsed;if(g.hudTimer>=.1){g.hudTimer=0;updateUI();}
  draw();
  if(g.running&&!g.paused)g.raf=requestAnimationFrame(loop);
}
function drawAtlas(img,frame,cols,rows,size){
  if(!img.complete||!img.naturalWidth)return false;
  var sw=img.naturalWidth/cols,sh=img.naturalHeight/rows,sx=frame[0]*sw,sy=frame[1]*sh;
  var dw=size*sw/Math.max(sw,sh),dh=size*sh/Math.max(sw,sh);
  ctx.drawImage(img,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);return true;
}
function drawShip(){
  ctx.save();ctx.translate(ship.x,ship.y);ctx.globalAlpha=ship.invuln>0?.62:1;
  ctx.shadowBlur=20;ctx.shadowColor=traits.phase?'#c29aff':'#72f4ff';
  var rotation=(Number.isFinite(ship.aimAngle)?ship.aimAngle:-Math.PI/2)+Math.PI/2;
  ctx.save();ctx.rotate(rotation);
  if(assets.player.complete&&assets.player.naturalWidth)ctx.drawImage(assets.player,-27,-41,54,81);
  else{
    ctx.fillStyle='#dffcff';ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(17,13);ctx.lineTo(5,9);ctx.lineTo(0,15);ctx.lineTo(-5,9);ctx.lineTo(-17,13);ctx.closePath();ctx.fill();
    ctx.fillStyle=traits.phase?'#c29aff':'#72f4ff';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(6,9);ctx.lineTo(0,6);ctx.lineTo(-6,9);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ffb75c';ctx.globalAlpha*=.72;ctx.fillRect(-4,12,3,8);ctx.fillRect(1,12,3,8);ctx.globalAlpha=1;
  }
  ctx.restore();
  var aim=Number.isFinite(ship.aimAngle)?ship.aimAngle:-Math.PI/2;
  ctx.globalAlpha*=.42;ctx.strokeStyle=traits.phase?'#c29aff':'#72f4ff';ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(Math.cos(aim)*46,Math.sin(aim)*46);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=ship.invuln>0?.62:1;
  if(ship.shield>0){ctx.strokeStyle='rgba(114,244,255,.76)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,25+Math.sin(g.elapsed*5)*1.5,0,Math.PI*2);ctx.stroke();}
  for(var i=0;i<orbitalCount();i++){var pos=orbitalPos(i);ctx.save();ctx.translate(pos.x-ship.x,pos.y-ship.y);ctx.fillStyle='#ffb75c';ctx.shadowBlur=12;ctx.shadowColor='#ffb75c';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();ctx.restore();}
  ctx.restore();
}
function drawTelegraph(e){
  var warn=e.attackWarn||0;
  if(warn>0){
    var bossWarn=!!e.boss,color=e.boss?'#ffd76a':(e.typeColor||'#ff718e'),angle=Number.isFinite(e.attackAngle)?e.attackAngle:aimAngle(e),reach=Math.max(W,H)*.82,pattern=e.attackPattern||'',alpha=.18+clamp(warn/(bossWarn ? .95 : .82),0,1)*.38;
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.shadowBlur=14;ctx.shadowColor=color;ctx.lineWidth=bossWarn?3:2;ctx.setLineDash(bossWarn?[2,8]:[8,8]);
    if(bossWarn&&['ring','spiral','crossfire','cross'].indexOf(pattern)>=0){ctx.beginPath();ctx.arc(e.x,e.y,e.r+18+Math.sin(g.elapsed*8)*3,0,Math.PI*2);ctx.stroke();if(pattern==='cross'){ctx.beginPath();ctx.moveTo(e.x-reach,e.y);ctx.lineTo(e.x+reach,e.y);ctx.moveTo(e.x,e.y-reach);ctx.lineTo(e.x,e.y+reach);ctx.stroke();}}
    else{ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(angle)*reach,e.y+Math.sin(angle)*reach);ctx.stroke();if(bossWarn&&(pattern==='fan'||pattern==='sweep'||pattern==='pincer')){var spreads=pattern==='pincer'?[.24,.54]:[pattern==='sweep'?.52:.24];spreads.forEach(function(spread){ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(angle-spread)*reach,e.y+Math.sin(angle-spread)*reach);ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(angle+spread)*reach,e.y+Math.sin(angle+spread)*reach);ctx.stroke();});}}
    ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.x,e.y,bossWarn?e.r+16:e.r+8+Math.sin(g.elapsed*10)*2,0,Math.PI*2);ctx.stroke();ctx.restore();
    var labels={ring:'RING / 环形弹幕',spiral:'SPIRAL / 螺旋弹幕',crossfire:'CROSSFIRE / 交叉弹幕',cross:'CROSS / 十字弹幕',laser:'LASER / 扫描光束',fan:'FAN / 扇形齐射',sweep:'SWEEP / 横扫齐射',pincer:'PINCER / 夹击',lance:'LANCE / 锁定长矛',volley:'VOLLEY / 集中齐射'};
    ctx.save();ctx.globalAlpha=.55+clamp(warn/(bossWarn?.95:.82),0,1)*.35;ctx.fillStyle=color;ctx.font='800 9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(bossWarn?(labels[pattern]||'BOSS / 锁定'):e.type==='carrier'?'DEPLOY':'FIRE',e.x,e.y-(e.r||18)-19);ctx.restore();
  }
  if((e.dashWarning||0)>0){
    var tx=Number.isFinite(e.dashTargetX)?e.dashTargetX:ship.x,ty=Number.isFinite(e.dashTargetY)?e.dashTargetY:ship.y;
    ctx.save();ctx.globalAlpha=.28+clamp((e.dashWarning||0)/.55,0,1)*.46;ctx.strokeStyle='#ff718e';ctx.shadowBlur=16;ctx.shadowColor='#ff718e';ctx.lineWidth=3;ctx.setLineDash([6,6]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(tx,ty,12+Math.sin(g.elapsed*12)*3,0,Math.PI*2);ctx.stroke();ctx.restore();
    ctx.save();ctx.globalAlpha=.86;ctx.fillStyle='#ff718e';ctx.font='900 9px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText('DASH',tx,ty-16);ctx.restore();
  }
}
function drawEnemySignature(e){
  var type=e.boss?e.bossId:e.type, color=e.typeColor||'#ff718e', pulse=.5+.5*Math.sin(g.elapsed*7);
  ctx.save();ctx.globalAlpha=.28+.12*pulse;ctx.shadowBlur=12;ctx.shadowColor=color;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=e.boss?2.4:1.6;
  if(e.boss){
    var radius=Math.max(e.r+12,Math.min(W*.27,74));
    if(type==='cathedral'){ctx.setLineDash([3,8]);ctx.beginPath();ctx.arc(0,0,radius+5*pulse,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(0,0,radius*.62,0,Math.PI*2);ctx.stroke();}
    else if(type==='serpent'){ctx.setLineDash([2,7]);ctx.beginPath();ctx.arc(0,0,radius+Math.sin(g.elapsed*2)*5,0,Math.PI*1.55);ctx.stroke();ctx.setLineDash([]);}
    else if(type==='prism'){ctx.beginPath();ctx.moveTo(0,-radius);ctx.lineTo(radius*.72,0);ctx.lineTo(0,radius);ctx.lineTo(-radius*.72,0);ctx.closePath();ctx.stroke();}
    else {ctx.beginPath();ctx.moveTo(-radius,-radius*.55);ctx.lineTo(radius,radius*.55);ctx.moveTo(radius,-radius*.55);ctx.lineTo(-radius,radius*.55);ctx.stroke();}
  }else if(type==='scout'){ctx.setLineDash([2,6]);ctx.beginPath();ctx.arc(0,0,e.r+5+pulse*3,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  else if(type==='zigzag'){ctx.beginPath();ctx.moveTo(-e.r*.9,-e.r*.45);ctx.lineTo(0,0);ctx.lineTo(e.r*.9,e.r*.45);ctx.stroke();}
  else if(type==='gunner'){ctx.fillRect(-e.r*.95,-2,4,4);ctx.fillRect(e.r*.75,-2,4,4);}
  else if(type==='tank'){ctx.beginPath();ctx.arc(0,0,e.r*.34+2*pulse,0,Math.PI*2);ctx.stroke();ctx.fillRect(-2,-2,4,4);}
  else if(type==='blade'){ctx.beginPath();ctx.moveTo(-e.r*1.6,e.r*.75);ctx.lineTo(-e.r*.55,e.r*.2);ctx.stroke();}
  else if(type==='artillery'){ctx.beginPath();ctx.arc(0,0,e.r*.36+3*pulse,0,Math.PI*2);ctx.stroke();ctx.fillRect(-2,-2,4,4);}
  else if(type==='carrier'){ctx.beginPath();ctx.arc(0,0,e.r*.52+3*pulse,0,Math.PI*2);ctx.stroke();for(var port=0;port<4;port++){var pa=port*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(pa)*e.r*.58,Math.sin(pa)*e.r*.58);ctx.lineTo(Math.cos(pa)*(e.r+7),Math.sin(pa)*(e.r+7));ctx.stroke();}}
  else if(type==='elite'){ctx.beginPath();ctx.moveTo(-7,-e.r-4);ctx.lineTo(0,-e.r-11);ctx.lineTo(7,-e.r-4);ctx.stroke();}
  ctx.restore();
}
function drawThreatLabel(e){
  var def=e.boss?bossDefs.find(function(item){return item.id===e.bossId;}):enemyDefs[e.type];
  if(!def)return;
  var breach=!e.boss&&e.y>H-78;
  var active=(e.attackWarn||0)>0||(e.dashWarning||0)>0||e.boss||e.marked||breach;
  if(!active)return;
  ctx.save();ctx.globalAlpha=e.boss?.9:breach?.95:.72;ctx.textAlign='center';ctx.font='800 '+(e.boss?'10':'8')+'px ui-monospace,monospace';ctx.fillStyle=breach?'#ff718e':(e.marked?'#ff718e':(def.color||e.typeColor));ctx.fillText(breach?'BREACH / 越界':(e.marked?'FOCUS / 优先目标':(def.attackLabel||def.roleTag)),e.x,e.y-(e.boss?e.r+23:e.r+20));ctx.restore();
}
function drawEnemy(e){
  drawTelegraph(e);
  ctx.save();ctx.translate(e.x,e.y);ctx.shadowBlur=e.boss?28:14;ctx.shadowColor=e.typeColor;ctx.globalAlpha=e.flash>0?1:.96;
  drawEnemySignature(e);
  var size=e.boss?Math.min(W*.48,150):e.r*2.75;
  var drawn=e.boss?drawAtlas(assets.boss,e.frame,2,2,size):drawAtlas(assets.enemy,e.frame,4,2,size);
  if(!drawn){ctx.fillStyle=e.typeColor;ctx.beginPath();ctx.moveTo(0,e.r);ctx.lineTo(-e.r,-e.r*.7);ctx.lineTo(0,-e.r*.35);ctx.lineTo(e.r,-e.r*.7);ctx.closePath();ctx.fill();}
  if(!e.boss&&e.maxShield>0&&e.shield>0){ctx.strokeStyle='rgba(114,244,255,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,e.r+5,0,Math.PI*2);ctx.stroke();}
  if(e.boss&&e.shield>0){ctx.strokeStyle='rgba(114,244,255,.7)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,size*.34+Math.sin(g.elapsed*4)*2,0,Math.PI*2);ctx.stroke();}
  if(e.mutation){ctx.strokeStyle=e.mutation.color;ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(0,0,e.r+8+Math.sin(g.elapsed*6),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=e.mutation.color;ctx.fillRect(-3,-e.r-13,6,6);}
  if(e.marked){ctx.strokeStyle='#ff718e';ctx.lineWidth=2.4;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(0,0,e.r+11+Math.sin(g.elapsed*8)*2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ff718e';ctx.beginPath();ctx.moveTo(0,-e.r-16);ctx.lineTo(5,-e.r-8);ctx.lineTo(-5,-e.r-8);ctx.closePath();ctx.fill();}
  ctx.restore();
  drawThreatLabel(e);
  if(!e.boss&&e.maxHp>40){var w=Math.max(26,e.r*2.4),ratio=clamp(e.hp/e.maxHp,0,1);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(e.x-w/2,e.y-e.r-8,w,3);ctx.fillStyle=e.type==='elite'?'#ffd76a':'#ff718e';ctx.fillRect(e.x-w/2,e.y-e.r-8,w*ratio,3);}
}
function drawCombatBackdrop(){
  var route=g.route||routeDefs[0],bg=assets[route.background]||assets.rainline;
  var grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#07132d');grad.addColorStop(.55,'#040918');grad.addColorStop(1,'#02040c');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  if(bg&&bg.complete&&bg.naturalWidth){
    var scale=Math.max(W/bg.naturalWidth,H/bg.naturalHeight),dw=bg.naturalWidth*scale,dh=bg.naturalHeight*scale;
    var pan=g.running?Math.sin(g.elapsed*.22)*Math.min(12,Math.max(3,W*.018)):0;
    ctx.save();ctx.globalAlpha=.72;ctx.drawImage(bg,(W-dw)/2+pan,(H-dh)/2,dw,dh);ctx.restore();
  }
  var shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(2,7,20,.28)');shade.addColorStop(.46,'rgba(2,5,15,.34)');shade.addColorStop(1,'rgba(1,3,10,.68)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  var focus=ctx.createRadialGradient(W/2,H*.6,Math.min(W,H)*.08,W/2,H*.58,Math.max(W,H)*.72);focus.addColorStop(0,'rgba(5,13,31,.02)');focus.addColorStop(.72,'rgba(2,5,14,.18)');focus.addColorStop(1,'rgba(1,3,10,.54)');ctx.fillStyle=focus;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=.1;ctx.fillStyle=route.tint||'#72f4ff';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
}
function drawPlayerBullet(b){
  var angle=Math.atan2(b.vy,b.vx),kind=b.kind||'pulse',length=Math.max(9,Math.min(25,Math.hypot(b.vx,b.vy)*.035));
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(angle);ctx.globalAlpha=b.aux ? .94 : 1;ctx.strokeStyle=b.color||'#72f4ff';ctx.fillStyle=b.color||'#72f4ff';ctx.shadowBlur=kind==='phase'||kind==='missile'?12:7;ctx.shadowColor=ctx.strokeStyle;
  if(kind==='missile'){
    ctx.beginPath();ctx.moveTo(length*.9,0);ctx.lineTo(-length*.2,-4.2);ctx.lineTo(-length*.55,0);ctx.lineTo(-length*.2,4.2);ctx.closePath();ctx.fill();ctx.globalAlpha=.58;ctx.beginPath();ctx.moveTo(-length*.5,0);ctx.lineTo(-length*1.2,0);ctx.stroke();
  }else if(kind==='drone'){
    ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(length*.9,0);ctx.lineTo(-length*.35,-4);ctx.lineTo(-length*.8,0);ctx.lineTo(-length*.35,4);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.arc(-length*.05,0,Math.max(2.5,b.r*.72),0,Math.PI*2);ctx.fill();ctx.globalAlpha=.48;ctx.beginPath();ctx.moveTo(-length*.6,-6);ctx.lineTo(-length*1.2,-6);ctx.moveTo(-length*.6,6);ctx.lineTo(-length*1.2,6);ctx.stroke();
  }else if(kind==='beam'){
    ctx.globalAlpha=.26;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-length*1.8,0);ctx.lineTo(length*1.2,0);ctx.stroke();ctx.globalAlpha=.95;ctx.lineWidth=3.2;ctx.beginPath();ctx.moveTo(-length*2.2,0);ctx.lineTo(length*1.5,0);ctx.stroke();ctx.globalAlpha=.72;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-length*1.8,-4);ctx.lineTo(length*1.1,-4);ctx.moveTo(-length*1.8,4);ctx.lineTo(length*1.1,4);ctx.stroke();
  }else if(kind==='phase'){
    ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(-length*1.5,0);ctx.lineTo(length,0);ctx.stroke();ctx.globalAlpha=.35;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-length*2.1,-3);ctx.lineTo(-length*.9,-3);ctx.moveTo(-length*2.1,3);ctx.lineTo(-length*.9,3);ctx.stroke();
  }else if(kind==='arc'){
    ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,Math.max(3.5,b.r+1),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-length*.8,0);ctx.lineTo(length*.8,0);ctx.stroke();
  }else if(kind==='splitter'||kind==='flak'){
    ctx.beginPath();ctx.moveTo(length,0);ctx.lineTo(0,-b.r-1);ctx.lineTo(-length*.65,0);ctx.lineTo(0,b.r+1);ctx.closePath();ctx.fill();
  }else if(kind==='sentry'){
    ctx.beginPath();ctx.arc(0,0,Math.max(2.8,b.r+1),0,Math.PI*2);ctx.fill();ctx.globalAlpha=.5;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,Math.max(5,b.r+3),0,Math.PI*2);ctx.stroke();
  }else{
    ctx.lineWidth=Math.max(2,b.r*1.3);ctx.beginPath();ctx.moveTo(-length,0);ctx.lineTo(length,0);ctx.stroke();
  }
  ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);
  var shake=screenFx.shake;
  if(shake>0){ctx.save();ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);}
  drawCombatBackdrop();
  ctx.globalAlpha=.12;ctx.fillStyle=g.waveMod.color;ctx.fillRect(0,0,W,3);ctx.globalAlpha=1;
  stars.forEach(function(s){ctx.globalAlpha=s.a;ctx.fillStyle='#dff8ff';ctx.fillRect(s.x,s.y,s.s,s.s);});ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(114,244,255,.035)';ctx.setLineDash([4,14]);ctx.beginPath();ctx.moveTo(W*.18,0);ctx.lineTo(W*.18,H);ctx.moveTo(W*.82,0);ctx.lineTo(W*.82,H);ctx.stroke();ctx.setLineDash([]);
  mines.forEach(function(m){ctx.save();ctx.translate(m.x,m.y);ctx.globalAlpha=m.armed>0?.52:.95;ctx.strokeStyle='#c29aff';ctx.shadowBlur=14;ctx.shadowColor='#c29aff';ctx.beginPath();ctx.arc(0,0,m.armed>0?8:13+Math.sin(g.elapsed*5)*2,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#c29aff';ctx.fillRect(-2,-2,4,4);ctx.restore();});
  drops.forEach(function(d){var color=d.type==='heal'?'#75ffb2':d.type==='emp'?'#72f4ff':d.type==='kit'?'#c29aff':'#ffd76a';ctx.save();ctx.translate(d.x,d.y);ctx.shadowBlur=18;ctx.shadowColor=color;ctx.fillStyle=color;ctx.beginPath();ctx.rotate(g.elapsed*1.8);ctx.moveTo(0,-d.r);ctx.lineTo(d.r,0);ctx.lineTo(0,d.r);ctx.lineTo(-d.r,0);ctx.closePath();ctx.fill();if(d.type==='kit'){ctx.rotate(-g.elapsed*1.8);ctx.fillStyle='#070a18';ctx.font='900 9px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('+',0,1);}ctx.restore();});
  // Projectiles dominate dense scenes: crisp cores, no per-bullet blur filter.
  ctx.save();ctx.shadowBlur=0;
  bullets.forEach(drawPlayerBullet);
  enemyBullets.forEach(function(b){ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();});ctx.restore();
  lasers.forEach(function(l){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.angle);ctx.globalAlpha=l.delay>0?.28:.75;ctx.strokeStyle=l.color;ctx.shadowBlur=20;ctx.shadowColor=l.color;ctx.lineWidth=l.delay>0?3:l.width;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(l.length,0);ctx.stroke();ctx.restore();});
  enemies.forEach(function(e){if(!e.dead)drawEnemy(e);});
  chainFx.forEach(function(f){ctx.save();ctx.globalAlpha=clamp(f.life/.22,0,1);ctx.strokeStyle=f.color;ctx.shadowBlur=14;ctx.shadowColor=f.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(f.x1,f.y1);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.restore();});
  impactFx.forEach(function(f){var t=1-f.life/f.max,rad=(f.heavy?10:5)+t*(f.heavy?34:17);ctx.save();ctx.globalAlpha=(1-t)*.9;ctx.strokeStyle=f.color;ctx.shadowBlur=f.heavy?22:12;ctx.shadowColor=f.color;ctx.lineWidth=f.heavy?3:1.5;ctx.beginPath();ctx.arc(f.x,f.y,rad,0,Math.PI*2);ctx.stroke();if(f.heavy){ctx.rotate(f.angle);for(var ray=0;ray<6;ray++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(rad+3,0);ctx.lineTo(rad+12,0);ctx.stroke();}}ctx.restore();});
  damageTexts.forEach(function(t){var alpha=clamp(t.life/t.max,0,1);ctx.save();ctx.globalAlpha=alpha;ctx.font=(t.critical?'900 14px':'800 11px')+' ui-monospace,monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(2,5,15,.85)';ctx.strokeText(t.text,t.x,t.y);ctx.fillStyle=t.color;ctx.shadowBlur=t.critical?14:8;ctx.shadowColor=t.color;ctx.fillText(t.text,t.x,t.y);ctx.restore();});
  particles.forEach(function(p){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});ctx.globalAlpha=1;drawShip();
  if(shake>0)ctx.restore();
  if(screenFx.flash>0){ctx.save();ctx.globalAlpha=Math.min(.22,screenFx.flash*.62);ctx.fillStyle='#e8fbff';ctx.fillRect(0,0,W,H);ctx.restore();}
}
function updateUI(){
  ui.pauseBtn.disabled=!g.running||g.choosing||!!g.modal||g.eventActive;
  byId('armoryBtn').disabled=!g.running||g.choosing||g.eventActive;
  byId('archiveBtn').disabled=g.choosing||g.eventActive;
  byId('runClock').textContent=String(Math.floor(g.elapsed/60)).padStart(2,'0')+':'+String(Math.floor(g.elapsed%60)).padStart(2,'0');
  ui.score.textContent=Math.floor(g.score);ui.level.textContent=g.level;ui.wave.textContent=g.wave;ui.kills.textContent=g.kills;
  ui.waveMeta.textContent=g.boss?'Boss 战':g.waveMod.name+' '+Math.min(g.waveKills,g.waveTarget)+'/'+g.waveTarget+(g.mutation?' · 变异':'')+' · 越界 '+(g.waveBreaches||0);ui.xpMeta.textContent='XP '+Math.floor(g.xp)+' / '+g.xpNeed;ui.scrapMeta.textContent='废料 '+g.scrap+' · 芯片 '+g.upgradeKits;ui.bossMeta.textContent='Boss '+g.bossDefeated;
  ui.hpBar.style.width=clamp(ship.hp/ship.maxHp,0,1)*100+'%';ui.xpBar.style.width=clamp(g.xp/g.xpNeed,0,1)*100+'%';
  var comboMultiplier=1+Math.min(20,g.combo||0)*.05;ui.comboWrap.classList.toggle('hot',(g.combo||0)>=5);ui.comboValue.textContent='x'+comboMultiplier.toFixed(2);ui.comboTimer.textContent=(g.combo||0)>0?(g.combo+' 连杀 · '+(g.comboTimer||0).toFixed(1)+'s'):'待机';ui.comboBar.style.width=clamp((g.comboTimer||0)/4.6,0,1)*100+'%';
  ui.hpText.textContent='HP '+Math.ceil(ship.hp)+' / '+Math.ceil(ship.maxHp)+(ship.shield>0?' · 盾 '+Math.ceil(ship.shield):'');
  var dps=Math.round(estimatedDps()*ship.fireRate/fireInterval());
  ui.weaponText.textContent='主 '+traits.weaponLabel+(traits.weaponBranchLabel?' / '+traits.weaponBranchLabel:'')+' · DPS '+dps+' · 穿透 '+ship.pierce+' · 副 '+(traits.auxMode?traits.auxLabel:'空槽')+(ship.jammed?' · 受干扰':'');
  ui.stageTag.textContent='WAVE '+g.wave+' · '+g.waveMod.name+' · '+g.route.name+(g.mutation?' / '+g.mutation.name:'');
  var c=g.contract;
  if(ui.contract){
    if(c){
      ui.contract.style.setProperty('--contract-color',c.color||'#72f4ff');
      ui.contract.classList.toggle('complete',!!c.complete);
      ui.contract.innerHTML='<b>TACTICAL CONTRACT · '+safeText(c.title)+'</b><span>'+safeText(c.desc)+'</span><small>'+(c.complete?'已完成 · '+safeText(c.rewardLabel):'进度 '+Math.floor(c.progress)+' / '+c.target+' · 完成奖励：'+safeText(c.rewardLabel))+'</small>';
    }else{
      ui.contract.classList.remove('complete');ui.contract.innerHTML='<b>TACTICAL CONTRACT</b><span>战术契约准备中</span><small>完成后会改变战斗节奏</small>';
    }
  }
  ui.mission.textContent=g.missionDone?'任务完成 · WAVE '+g.nextMissionWave+' 刷新':'任务：击败 '+g.missionTarget+' 架敌机（'+Math.min(g.missionKills,g.missionTarget)+'/'+g.missionTarget+'）· '+g.missionReward+' 分';
  ui.empText.textContent=traits.empCharges+'/'+traits.empMax+(g.empCooldown>0?' · '+g.empCooldown.toFixed(1)+'s':'');
  ui.empBtn.classList.toggle('cooldown',g.empCooldown>0||traits.empCharges<=0);
  ui.empBtn.disabled=!g.running||g.paused||g.choosing||g.empCooldown>0||traits.empCharges<=0;
  ui.dashText.textContent=g.dashCooldown>0?g.dashCooldown.toFixed(1)+'s':'READY';
  ui.dashBtn.classList.toggle('cooldown',g.dashCooldown>0);
  ui.dashBtn.disabled=!g.running||g.paused||g.choosing||g.dashCooldown>0;
  ui.overdriveText.textContent=g.overdrive>=100?'READY':Math.floor(g.overdrive)+'%';
  ui.overdriveBtn.classList.toggle('ready',g.overdrive>=100);
  ui.overdriveBtn.classList.toggle('cooldown',g.overdrive<100);
  ui.overdriveBtn.disabled=!g.running||g.paused||g.choosing||g.eventActive||g.overdrive<100;
  ui.buildChip.textContent=traits.weaponBranchLabel?traits.weaponBranchLabel:(traits.synergies.length?'联动 · '+traits.synergies[0]:(traits.buildTagLabels||[]).slice(0,2).join(' · ')||buildNames().slice(0,3).join(' · '));
  if(g.boss){
    var shielded=g.boss.shield>0;ui.bossBar.classList.toggle('shielded',shielded);
    ui.bossBar.style.width=clamp(shielded?g.boss.shield/g.boss.maxShield:g.boss.hp/g.boss.maxHp,0,1)*100+'%';
    ui.bossName.textContent=bossDefs.find(function(d){return d.id===g.boss.bossId;}).name+' · 阶段 '+g.boss.phase;
    ui.bossPhase.textContent='PHASE '+g.boss.phase+(shielded?' · 护盾 '+Math.ceil(g.boss.shield):' · 舰体 '+Math.ceil(g.boss.hp));
  }
}
function renderStarterLoadout(){
  var el=byId('starterLoadout');el.innerHTML='';
  buildItems().forEach(function(item){var def=getDef(item),slot=document.createElement('div');slot.className='starterSlot';slot.innerHTML=iconMarkup(item,'small')+'<span>'+safeText(slotMeta[def.slot].label)+' · '+safeText(def.name)+(branchDefinition(item)?' · '+safeText(branchDefinition(item).name):'')+'</span>';el.appendChild(slot);});
}
function compareEquipment(item){
  var before=core.calculateBuild(g.equipment),after=core.calculateBuild(core.projectEquipment(g.equipment,item));
  var comparisons=[['总 DPS',core.weaponDps(before.stats,before.traits),core.weaponDps(after.stats,after.traits)],['穿透',before.stats.pierce,after.stats.pierce],['生命上限',before.stats.maxHp,after.stats.maxHp],['护盾上限',before.stats.shield,after.stats.shield]];
  var rows=comparisons.map(function(c){var delta=Math.round(c[2])-Math.round(c[1]);if(!delta)return '';return '<span class="'+(delta>0?'benefit':'cost')+'">'+c[0]+' '+(delta>0?'+':'')+delta+'</span>';}).join('');
  after.traits.synergies.forEach(function(s){if(!before.traits.synergies.includes(s))rows+='<span class="benefit">激活 '+s+'</span>';});
  before.traits.synergies.forEach(function(s){if(!after.traits.synergies.includes(s))rows+='<span class="cost">失去 '+s+'</span>';});
  return '<div class="comparison">'+(rows||'<span>主炮与防御不变 · 查看特殊效果</span>')+'</div>';
}
function renderEquipmentDetail(slot){
  g.detailSlot=slot;
  var item=g.equipment[slot],el=byId('equipmentDetail');
  if(!item){el.innerHTML='<div class="panelHint">'+slotMeta[slot].label+'为空，可从背包选择装备。</div>';return;}
  var def=getDef(item);
  var maxed=item.level>=6;
  el.innerHTML='<div class="rarity '+rarityClass(item)+'">'+getRarity(item).label+' · '+slotMeta[slot].label+'</div><h3>'+safeText(itemLabel(item))+'</h3><p>'+safeText(def.desc)+'</p><div class="equipmentDetailActions"><button class="miniBtn" type="button" '+(maxed||g.upgradeKits<1?'disabled':'')+'>强化 · 1 芯片</button><button class="miniBtn alt" type="button">卸下'+slotMeta[slot].label+'</button><small>'+(maxed?'已达最高等级':('强化芯片 '+g.upgradeKits+' · 精英与 Boss 会掉落'))+'</small></div>';
  var buttons=el.querySelectorAll('button');if(buttons[0])buttons[0].addEventListener('click',function(){upgradeEquipment(slot);});if(buttons[1])buttons[1].addEventListener('click',function(){unequipSlot(slot);});
}
function renderArmory(){
  ui.armoryStats.innerHTML='<div class="statPill"><b>'+Math.round(estimatedDps())+'</b><span>主炮理论 DPS</span></div><div class="statPill"><b>'+ship.pierce+'</b><span>穿透次数</span></div><div class="statPill"><b>'+Math.round(ship.maxHp)+'</b><span>最大生命</span></div><div class="statPill"><b>'+Math.round(ship.maxShield||0)+'</b><span>护盾容量</span></div><div class="statPill kitPill"><b>'+g.upgradeKits+'</b><span>强化芯片</span></div>';
  ui.synergyStrip.innerHTML=traits.synergies.length?'<span>构筑联动</span>'+traits.synergies.map(function(name){return '<span class="synergyChip">'+safeText(name)+'</span>';}).join(''):'<span>当前没有联动效果，尝试组合对应的武器、战术与推进装备。</span>';
  ui.slotGrid.innerHTML='';
  Object.keys(slotMeta).forEach(function(slot){
    var item=g.equipment[slot],card=document.createElement('button');card.type='button';card.className='slotCard'+(item?'':' empty');
    if(item){card.innerHTML=iconMarkup(item,'small')+'<div class="slotLabel">'+slotMeta[slot].label+' · 查看详情</div><div class="itemName">'+safeText(itemLabel(item))+'</div>';card.addEventListener('click',function(){renderEquipmentDetail(slot);});}
    else if(!isSlotUnlocked(slot)){card.className+=' locked';card.innerHTML='<div class="gearIcon small">🔒</div><div class="slotLabel">未解锁</div><div class="itemName">'+slotMeta[slot].label+' · 升级战术矩阵扩展</div>';}
    else{card.innerHTML='<div class="gearIcon small"></div><div class="slotLabel">'+slotMeta[slot].label+'</div><div class="itemName">空槽位</div>';}
    ui.slotGrid.appendChild(card);
  });
  renderEquipmentDetail(g.detailSlot||'weapon');
  byId('synergyGuide').innerHTML=core.synergyDefs.map(function(s){var names=s.needs.map(function(id){return itemDefs.find(function(d){return d.id===id;}).name;});return '<div class="synergyEntry"><b class="'+(traits.synergies.includes(s.name)?'benefit':'')+'">'+s.name+(traits.synergies.includes(s.name)?' · 已激活':'')+'</b><span>'+names.join(' + ')+'</span><span>'+s.desc+'</span></div>';}).join('');
  ui.inventoryGrid.innerHTML='';ui.bagCount.textContent=g.inventory.length+' / '+inventoryCapacity();
  if(!g.inventory.length){ui.inventoryGrid.innerHTML='<div class="emptyBag">背包为空。升级或拾取战场装备后会出现在这里。</div>';return;}
  g.inventory.forEach(function(item,index){
    var def=getDef(item),rare=getRarity(item),card=document.createElement('article');card.className='inventoryCard';
    var equipped=g.equipment[def.slot],same=equipped&&equipped.defId===item.defId;
    card.innerHTML=iconMarkup(item,'small')+'<div class="rarity '+rarityClass(item)+'">'+rare.label+' · '+slotMeta[def.slot].label+'</div><div class="itemName">'+safeText(itemLabel(item))+'</div><div class="itemDesc">'+safeText(def.desc)+'</div><div class="inventoryActions"><button class="miniBtn" type="button">'+(same?'融合':'装备')+'</button><button class="miniBtn" type="button" '+(item.level>=6||g.upgradeKits<1?'disabled':'')+'>强化</button><button class="miniBtn alt" type="button">拆解</button></div>';
    card.innerHTML=card.innerHTML.replace('<div class="inventoryActions">',compareEquipment(item)+'<div class="inventoryActions">');
    var actions=card.querySelectorAll('button');if(actions[0])actions[0].addEventListener('click',function(){equipInventory(index);});if(actions[1])actions[1].addEventListener('click',function(){upgradeInventory(index);});if(actions[2])actions[2].addEventListener('click',function(){scrapInventory(index);});
    ui.inventoryGrid.appendChild(card);
  });
}
function equipInventory(index){
  var source=g.inventory[index];if(!source)return false;
  var slot=getDef(source).slot,old=g.equipment[slot];
  if(old&&old.defId===source.defId){var duplicate=g.inventory.splice(index,1)[0];mergeInto(old,duplicate);recalcBuild();renderArmory();updateUI();toast('融合升级：'+itemLabel(old));beep(980,.06,.03);return true;}
  if(old&&g.inventory.length>inventoryCapacity()){toast('背包容量异常 · 未进行换装');return false;}
  var item=g.inventory.splice(index,1)[0];if(old)g.inventory.push(old);g.equipment[slot]=item;recalcBuild();renderArmory();updateUI();toast('换装完成：旧装备已放入背包 · '+getDef(item).name);beep(880,.06,.03);return true;
}
function upgradeGear(item){
  if(!g.running||g.modal!=='armory'){toast('只能在战斗暂停后的构筑界面使用强化芯片');return false;}
  if(!item||item.level>=6){toast('装备已达最高等级');return false;}
  if(g.upgradeKits<1){toast('强化芯片不足 · 精英与 Boss 会掉落');return false;}
  item.level++;g.upgradeKits--;recalcBuild();renderArmory();updateUI();toast('装备强化至 Lv.'+item.level+' · 芯片 −1');beep(1060,.08,.04);return true;
}
function upgradeEquipment(slot){return upgradeGear(g.equipment[slot]);}
function upgradeInventory(index){return upgradeGear(g.inventory[index]);}
function unequipSlot(slot){
  var item=g.equipment[slot];if(!item)return;
  if(g.inventory.length>=inventoryCapacity()){toast('背包已满，请先腾出空位');return;}
  if(storeInventory(item,slot)){g.equipment[slot]=null;recalcBuild();renderArmory();updateUI();toast('已卸下 '+getDef(item).name);}
}
function scrapInventory(index){
  if(!g.inventory[index])return;
  var item=g.inventory.splice(index,1)[0];g.scrap++;renderArmory();updateUI();toast('拆解 '+getDef(item).name+' · 废料 +1');beep(260,.05,.02);
}
function openModal(kind){
  if(!g.running||g.choosing||g.eventActive)return false;
  if(!g.modal)g.modalPaused=g.paused;
  g.modal=kind;g.paused=true;g.accumulator=0;pointer=false;input.clear();cancelAnimationFrame(g.raf);
  ui.pauseOverlay.classList.add('hidden');
  ui.armoryOverlay.classList.toggle('hidden',kind!=='armory');
  ui.archiveOverlay.classList.toggle('hidden',kind!=='archive');
  updateUI();
  return true;
}
function closeModal(){
  if(!g.modal)return;
  g.modal=null;ui.armoryOverlay.classList.add('hidden');ui.archiveOverlay.classList.add('hidden');
  g.paused=g.modalPaused;g.modalPaused=false;
  ui.pauseOverlay.classList.toggle('hidden',!g.paused);ui.pauseBtn.textContent=g.paused?'▶ 继续':'Ⅱ 暂停';
  updateUI();
  if(g.running&&!g.paused){cancelAnimationFrame(g.raf);g.last=performance.now();g.raf=requestAnimationFrame(loop);}
}
function openArmory(){if(openModal('armory')){renderArmory();draw();}}
function closeArmory(){closeModal();}
function renderArchive(){
  ui.archiveGrid.innerHTML='';
  enemyOrder.forEach(function(id){var def=enemyDefs[id],card=document.createElement('article');card.className='archiveCard';card.innerHTML='<div class="enemyArt" style="'+enemyStyle(def)+'"></div><b style="color:'+def.color+'">'+def.name+'</b><div class="threatMeta">'+threatMetaMarkup(def)+'</div><p>'+def.desc+'</p>';ui.archiveGrid.appendChild(card);});
  bossDefs.forEach(function(def){var card=document.createElement('article');card.className='archiveCard';card.innerHTML='<div class="bossArt" style="'+bossStyle(def)+'"></div><div class="rarity r-legendary">BOSS</div><b style="color:'+def.color+'">'+def.name+'</b><div class="threatMeta">'+threatMetaMarkup(def)+'</div><p>'+def.desc+'</p>';ui.archiveGrid.appendChild(card);});
}
function openArchive(){
  if(!g.running){renderArchive();ui.archiveOverlay.classList.remove('hidden');return;}
  if(openModal('archive')){renderArchive();draw();}
}
function closeArchive(){if(!g.running)ui.archiveOverlay.classList.add('hidden');else closeModal();}
function togglePause(){
  if(!g.running||g.choosing||g.modal||g.eventActive)return;
  g.paused=!g.paused;g.accumulator=0;pointer=false;input.clear();ui.pauseBtn.textContent=g.paused?'▶ 继续':'Ⅱ 暂停';ui.pauseOverlay.classList.toggle('hidden',!g.paused);
  byId('pauseReason').textContent='战斗与技能冷却已冻结。点继续后再拖动，瞬闪沿最近拖动方向释放。';
  updateUI();
  if(g.paused){cancelAnimationFrame(g.raf);draw();}else{g.last=performance.now();g.raf=requestAnimationFrame(loop);}
}
canvas.addEventListener('pointerdown',function(e){if(!canSimulate()||!input.start(e.pointerId))return;pointer=true;canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);targetPos(e.clientX,e.clientY,e.pointerType==='touch');});
canvas.addEventListener('pointermove',function(e){if(pointer&&canSimulate()&&input.owns(e.pointerId))targetPos(e.clientX,e.clientY,e.pointerType==='touch');});
function endPointer(e){if(input.end(e.pointerId))pointer=false;}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
window.addEventListener('keydown',function(e){
  var movement=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
  if(movement.indexOf(e.code)>=0||e.code==='Space')e.preventDefault();
  keys[e.code]=true;keys[e.key]=true;
  if(e.repeat)return;
  if(g.eventActive&&/^Digit[123]$/.test(e.code)){
    e.preventDefault();
    var eventIndex=Number(e.code.slice(-1))-1,eventButtons=ui.eventChoices&&ui.eventChoices.querySelectorAll?ui.eventChoices.querySelectorAll('button'):[];
    if(eventButtons[eventIndex])eventButtons[eventIndex].click();
    return;
  }
  if(e.code==='Space')useDash();
  else if(e.code==='KeyE')useEmp();
  else if(e.code==='KeyQ')useOverdrive();
  else if(e.code==='KeyP')togglePause();
  else if(e.code==='Escape'){if(ui.announcementOverlay&&!ui.announcementOverlay.classList.contains('hidden'))closeAnnouncement();else if(g.modal)closeModal();else togglePause();}
});
window.addEventListener('keyup',function(e){keys[e.code]=false;keys[e.key]=false;});
window.addEventListener('blur',function(){keys={};});
document.querySelectorAll('input[name="runMode"]').forEach(function(input){input.addEventListener('change',function(){selectRunMode(input.value);});});
byId('endlessAfterWinBtn')&&byId('endlessAfterWinBtn').addEventListener('click',function(){selectRunMode('endless');startGame();});
byId('startBtn').addEventListener('click',startGame);byId('restartBtn').addEventListener('click',startGame);ui.hubStartBtn.addEventListener('click',function(){enterArcadeGame('expedition',false);});ui.returnGamePageBtn&&ui.returnGamePageBtn.addEventListener('click',returnToExpeditionMenu);ui.returnArcadeBtn&&ui.returnArcadeBtn.addEventListener('click',function(){openArcadeLanding(false);});
ui.expeditionStartBtn&&ui.expeditionStartBtn.addEventListener('click',startGame);ui.expeditionSetupBtn&&ui.expeditionSetupBtn.addEventListener('click',function(){enterStation('routes',false);});ui.abandonExpeditionBtn&&ui.abandonExpeditionBtn.addEventListener('click',function(){endGame('abandoned');});
ui.empBtn.addEventListener('click',useEmp);ui.dashBtn.addEventListener('click',useDash);ui.overdriveBtn.addEventListener('click',useOverdrive);ui.pauseBtn.addEventListener('click',togglePause);byId('resumeBtn').addEventListener('click',togglePause);
ui.armoryBtn=byId('armoryBtn');ui.archiveBtn=byId('archiveBtn');ui.closeArmoryBtn=byId('closeArmoryBtn');ui.closeArchiveBtn=byId('closeArchiveBtn');
ui.armoryBtn.addEventListener('click',openArmory);ui.closeArmoryBtn.addEventListener('click',closeArmory);ui.relayStartBtn.addEventListener('click',startRelay);ui.salvageStartBtn.addEventListener('click',startSalvage);ui.salvageExtractBtn.addEventListener('click',extractSalvage);ui.salvageDescendBtn&&ui.salvageDescendBtn.addEventListener('click',descendSalvage);ui.labStartBtn.addEventListener('click',startLab);ui.blackboxStartBtn&&ui.blackboxStartBtn.addEventListener('click',startBlackbox);ui.blackboxHintBtn&&ui.blackboxHintBtn.addEventListener('click',hintBlackbox);ui.workbenchResetBtn.addEventListener('click',resetWorkbench);
ui.routeRerollBtn.addEventListener('click',rerollRouteSeed);
ui.archiveBtn.addEventListener('click',openArchive);ui.closeArchiveBtn.addEventListener('click',closeArchive);
ui.announcementBtn&&ui.announcementBtn.addEventListener('click',openAnnouncement);ui.announcementCloseBtn&&ui.announcementCloseBtn.addEventListener('click',closeAnnouncement);
ui.hubMoreBtn&&ui.hubMoreBtn.addEventListener('click',toggleHubMore);
ui.arcadeHomeBtn&&ui.arcadeHomeBtn.addEventListener('click',function(){openArcadeLanding(false);});
ui.rerollBtn.addEventListener('click',rerollLoot);ui.salvageLootBtn.addEventListener('click',salvageLoot);
ui.soundBtn.addEventListener('click',function(){soundOn=!soundOn;try{localStorage.setItem('neonDriftRogueSoundV2',soundOn?'on':'off');}catch(e){}ui.soundBtn.textContent=soundOn?'♪ 音效':'× 静音';if(soundOn)beep();});
document.addEventListener('click',function(event){var button=event.target&&event.target.closest?event.target.closest('[data-hub-view],[data-arcade-game],[data-arcade-home],[data-station-view],[data-station-contract],[data-daily-claim],[data-arcade-announcement]'):null;if(!button||!button.dataset)return;if(button.dataset.arcadeGame)enterArcadeGame(button.dataset.arcadeGame,false);else if(button.hasAttribute&&button.hasAttribute('data-arcade-home'))openArcadeLanding(false);else if(button.dataset.stationView)enterStation(button.dataset.stationView,false);else if(button.dataset.dailyClaim)claimDailyDirective();else if(button.dataset.hubView)openHubDestination(button.dataset.hubView,false);else if(button.dataset.stationContract)claimStationContract(button.dataset.stationContract);else if(button.hasAttribute&&button.hasAttribute('data-arcade-announcement'))openAnnouncement();});
window.addEventListener('hashchange',syncArcadeRoute);window.addEventListener('popstate',syncArcadeRoute);
document.addEventListener('visibilitychange',function(){
  if(document.hidden&&g.running){pointer=false;input.clear();g.accumulator=0;cancelAnimationFrame(g.raf);g.suspended=true;if(g.modal)g.modalPaused=true;else if(!g.choosing&&!g.eventActive){g.paused=true;ui.pauseBtn.textContent='▶ 继续';ui.pauseOverlay.classList.remove('hidden');}updateUI();}
  else if(!document.hidden&&g.running&&g.suspended){g.suspended=false;if(!g.paused){g.last=performance.now();g.raf=requestAnimationFrame(loop);}}
});
window.addEventListener('resize',resize,{passive:true});
ui.bestText.textContent='最高纪录：'+bestScore+' 分 · '+bestWave+' 波';ui.soundBtn.textContent=soundOn?'♪ 音效':'× 静音';
resetRun();resize();syncArcadeRoute();selectRunMode('campaign');window.NeonGameBooted=true;
})();
