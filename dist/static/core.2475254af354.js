(function () {
  'use strict';
  const catalog = window.NeonCatalog;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rank = rarity => ['common', 'rare', 'epic', 'legendary'].indexOf(rarity);
  const synergyDefs = [
    {name:'时滞穿刺', needs:['phase','gravity'], desc:'穿透 +1，命中减速额外 +8%', apply:(s,t)=>{s.pierce++;t.slow+=.08;}},
    {name:'橙色风暴', needs:['splitter','overdrive'], desc:'扇形弹射击间隔再缩短 12%', apply:s=>{s.fireRate*=.88;}},
    {name:'蜂群母舰', needs:['sentry','swarm'], desc:'常驻无人机 +1，每架伤害 +6', apply:(s,t)=>{t.orbitals++;t.orbitalDamage+=6;}},
    {name:'雷暴回路', needs:['arc','emp'], desc:'电弧倍率 +0.16，EMP 倍率 +0.8', apply:(s,t)=>{t.chainPower+=.16;t.empDamage+=.8;}},
    {name:'再生雷区', needs:['nano','mine'], desc:'每秒修复 +0.55，地雷伤害 +20%', apply:(s,t)=>{s.regen+=.55;t.mineDamage*=1.2;}},
    {name:'脉冲漂移', needs:['pulse','drift'], desc:'脉冲单发伤害 +3', apply:s=>{s.damage+=3;}},
    {name:'导弹牵引', needs:['missile','gravity'], desc:'追踪导弹伤害 +30%，命中后短暂减速', apply:(s,t)=>{t.auxDamage*=1.3;t.auxSlow=true;}},
    {name:'裂阵漂移', needs:['flak','drift'], desc:'散射副武器间隔再缩短 18%', apply:(s,t)=>{t.auxInterval*=.82;}}
  ];
  function definition(item) {
    return catalog.itemDefs.find(def=>def.id===item.defId);
  }
  function calculateBuild(equipment) {
    const stats = {...catalog.baseStats};
    const traits = {
      bulletColor:'#72f4ff',weaponMode:'pulse',weaponLabel:'脉冲核心',weaponBranch:'',weaponBranchLabel:'',phase:false,chain:0,chainPower:.45,orbitals:0,orbitalDamage:10,
      slow:0,slowTime:0,mineEvery:0,mineDamage:0,empMax:1,empCharges:1,empCooldownMax:12,
      empDamage:3,healOnKill:0,reflect:0,drift:false,killHaste:0,hasteRate:1,swarm:false,shieldOnKill:0,empOverload:false,orbitalHunter:false,splitPierce:false,synergies:[],buildTags:[],buildTagLabels:[]
    };
    traits.auxMode='';traits.auxLabel='暂无副武器';traits.auxDamage=0;traits.auxInterval=2;traits.auxSlow=false;traits.auxCount=1;traits.auxPierce=0;traits.auxMine=false;
    const ids = Object.values(equipment).filter(Boolean).map(item=>item.defId);
    const tagSet = {};
    for (const item of Object.values(equipment)) {
      if (!item) continue;
      const def = definition(item);
      if (!def) throw new Error('Unknown equipment: '+item.defId);
      const power = catalog.rarityMeta[item.rarity].mult*(1+(item.level-1)*.16);
      def.apply(stats, traits, power);
      (def.tags||[]).forEach(tag=>{tagSet[tag]=(tagSet[tag]||0)+1;});
      if (item.branch && def.slot==='weapon') {
        const options = catalog.weaponBranchDefs[def.id]||[];
        const branch = options.find(option=>option.id===item.branch);
        if (branch) {
          branch.apply(stats, traits, power);
          traits.weaponBranch=branch.id;
          traits.weaponBranchLabel=branch.name;
          (branch.tags||[]).forEach(tag=>{tagSet[tag]=(tagSet[tag]||0)+1;});
        }
      }
    }
    // Tags are behavior signals, not only display labels. These small rules
    // make a mixed build feel different without turning every choice into DPS.
    if (tagSet.electric && tagSet.control) { traits.chainPower+=.08; traits.slowTime+=.25; }
    if (tagSet.drone && tagSet.targeting) { traits.auxCount+=1; traits.orbitalDamage+=3; }
    if (tagSet.shield && tagSet.mobility) { stats.moveLerp+=1.2; traits.reflect=Math.max(traits.reflect,.08); }
    if (tagSet.missile && tagSet.control) { traits.auxSlow=true; }
    if (tagSet.tempo && tagSet.kinetic) { stats.fireRate*=.95; }
    for (const synergy of synergyDefs) {
      if (synergy.needs.every(id=>ids.includes(id))) {
        synergy.apply(stats,traits);
        traits.synergies.push(synergy.name);
      }
    }
    traits.buildTags=Object.keys(tagSet).sort();
    traits.buildTagLabels=traits.buildTags.map(tag=>catalog.buildTagMeta[tag]&&catalog.buildTagMeta[tag].label||tag);
    return {stats,traits};
  }
  // Same fusion rule for preview and actual equipment; never mutates the source.
  function mergeItem(target, incoming) {
    if (!target || !incoming || target.defId!==incoming.defId) return null;
    return {...target,level:Math.min(6,target.level+1),rarity:rank(incoming.rarity)>rank(target.rarity)?incoming.rarity:target.rarity,branch:target.branch||''};
  }
  function projectEquipment(equipment, incoming) {
    const next = {...equipment}, slot = definition(incoming).slot;
    next[slot] = mergeItem(next[slot],incoming)||{...incoming};
    return next;
  }
  function weaponDps(stats, traits) {
    const main=stats.damage*stats.shots/stats.fireRate*(1+stats.crit*(stats.critMult-1));
    const aux=traits&&traits.auxMode?traits.auxDamage/Math.max(.2,traits.auxInterval)*(traits.auxMode==='flak'?2:traits.auxMode==='drone'?Math.max(1,traits.auxCount||1):traits.auxMode==='mine'?.75:1):0;
    return main+aux;
  }
  // Seeded helpers are intentionally pure.  Combat can keep its expressive
  // runtime randomness while route planning, replay labels, and node choices
  // remain reproducible from one run seed.
  function hashSeed(value) {
    let hash = 2166136261 >>> 0;
    for (const char of String(value == null ? '' : value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  function createRng(seed) {
    let state = hashSeed(seed) || 1;
    return function () {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  function generateStarMap(seed, routeId) {
    const rng = createRng(String(seed) + '|' + String(routeId || 'standard'));
    const pools = [
      ['combat','salvage','event'],
      ['combat','salvage','elite','event','repair'],
      ['combat','elite','salvage','anomaly','repair'],
      ['elite','salvage','event','anomaly','repair'],
      ['boss']
    ];
    const counts = [2,3,3,2,1];
    const stages = pools.map((pool, stageIndex) => {
      const candidates = pool.slice();
      const count = counts[stageIndex];
      const nodes = [];
      while (nodes.length < count && candidates.length) {
        const pick = Math.floor(rng() * candidates.length);
        const type = candidates.splice(pick, 1)[0];
        nodes.push({id:'s' + stageIndex + 'n' + nodes.length, type, stage:stageIndex});
      }
      return {index:stageIndex, nodes};
    });
    // The final node is always a boss gate; this keeps a malformed seed from
    // producing an unfinishable expedition while preserving the rest of the
    // generated route.
    stages[stages.length - 1].nodes = [{id:'s4n0', type:'boss', stage:4}];
    return {seed:String(seed), routeId:String(routeId || 'standard'), stages};
  }
  function stepFrame(clock, seconds, canStep, update) {
    if (!canStep()) {clock.accumulator=0;return 0;}
    // 15 fixed steps maximum: bounded work, no giant collision steps.
    clock.accumulator=Math.min(.25,(clock.accumulator||0)+Math.max(0,seconds));
    let steps=0;
    while(clock.accumulator+1e-9>=1/60 && steps<15 && canStep()) {
      clock.accumulator=Math.max(0,clock.accumulator-1/60);
      update(1/60);steps++;
    }
    // No deferred time may leak through a loot/pause transition.
    if(!canStep()) clock.accumulator=0;
    return steps;
  }
  function createPointer() {
    return {
      id:null,
      start(id){if(this.id!==null)return false;this.id=id;return true;},
      owns(id){return this.id===id;},
      end(id){if(this.id!==id)return false;this.id=null;return true;},
      clear(){this.id=null;}
    };
  }
  function dashDestination(ship,width,height) {
    let dx=ship.dashX||0,dy=ship.dashY||0;
    if(Math.hypot(dx,dy)<.1) {dx=ship.targetX-ship.x;dy=ship.targetY-ship.y;}
    let length=Math.hypot(dx,dy);
    if(length<.1){dx=0;dy=-1;length=1;}
    return {x:clamp(ship.x+dx/length*105,28,Math.max(28,width-28)),y:clamp(ship.y+dy/length*105,height*.42,Math.max(height*.42,height-46))};
  }
  window.NeonCore={calculateBuild,mergeItem,projectEquipment,weaponDps,synergyDefs,branchDefs:catalog.weaponBranchDefs,tagMeta:catalog.buildTagMeta,stepFrame,createPointer,dashDestination,hashSeed,createRng,generateStarMap};
})();
