(function(root){
  'use strict';
  var core=root.NeonCore;
  function rng(seed){return core.createRng(String(seed));}
  function shuffle(values,random){var copy=values.slice();for(var i=copy.length-1;i>0;i--){var j=Math.floor(random()*(i+1)),v=copy[i];copy[i]=copy[j];copy[j]=v;}return copy;}

  var labRules=['forward','reverse','split','shift'];
  function ruleOrder(seed){return shuffle(labRules,rng('LAB-RULES|'+seed));}
  function generateLabRound(seed,round,size,rule){
    round=Math.max(1,Math.floor(Number(round)||1));size=Math.max(9,Math.floor(Number(size)||9));
    var random=rng('LAB|'+seed+'|'+round),length=Math.min(14,2+Math.ceil(round*.55)),sequence=[],previous=-1;
    while(sequence.length<length){var next=Math.floor(random()*size);if(next!==previous){sequence.push(next);previous=next;}}
    var input=sequence.slice();
    if(rule==='reverse')input.reverse();
    else if(rule==='split')input=sequence.filter(function(_,i){return i%2===0;}).concat(sequence.filter(function(_,i){return i%2===1;}));
    else if(rule==='shift')input=sequence.slice(1).concat(sequence.slice(0,1));
    var display=sequence.map(function(index){return{index:index,decoy:false};});
    if(round>=7){var decoy=Math.floor(random()*size);while(sequence.indexOf(decoy)>=0)decoy=Math.floor(random()*size);display.splice(Math.floor(random()*(display.length+1)),0,{index:decoy,decoy:true});}
    return{sequence:sequence,inputSequence:input,displaySequence:display,slotCount:size,rule:rule};
  }
  function offerChoices(pool,seed,count,excluded){
    var blocked=new Set(excluded||[]),available=pool.filter(function(item){return !blocked.has(item.id);});
    return shuffle(available,rng('OFFER|'+seed)).slice(0,Math.max(0,count||3));
  }
  function generateSalvageMap(seed,sector,size,contract){
    sector=Math.max(1,Math.floor(Number(sector)||1));size=Math.max(5,Math.min(9,Math.floor(Number(size)||5)));
    var random=rng('SALVAGE|'+seed+'|'+sector+'|'+contract),board=Array.from({length:size*size},function(){return{type:'empty',revealed:false};});
    var center=Math.floor(size/2),start=center*size+center;board[start]={type:'start',revealed:true};
    var candidates=[];for(var i=0;i<board.length;i++)if(i!==start)candidates.push(i);
    var distance=function(index){return Math.abs(index%size-center)+Math.abs(Math.floor(index/size)-center);};
    var beaconCandidates=candidates.filter(function(index){return distance(index)>=2&&distance(index)<=Math.min(size,5);});
    if(!beaconCandidates.length)beaconCandidates=candidates.slice();
    var beacon=beaconCandidates[Math.floor(random()*beaconCandidates.length)];board[beacon].type='beacon';candidates.splice(candidates.indexOf(beacon),1);
    var placements=[];
    function place(type,count){for(var n=0;n<count&&candidates.length;n++){var pick=Math.floor(random()*candidates.length),index=candidates.splice(pick,1)[0];board[index].type=type;placements.push(index);}}
    var quiet=contract==='ghost';
    place('scrap',3+sector+Math.floor(random()*3)+(contract==='cargo'?2:0));
    place('cache',1+sector+Math.floor(random()*2)+(contract==='cache'?1:0));
    place('hazard',Math.max(1,2+sector+Math.floor(random()*3)-(quiet?2:0)));
    place('data',contract==='data'?3+Math.floor(random()*2):1+Math.floor(random()*2));
    place('relic',contract==='relic'?2+Math.floor(random()*2):1);
    place('repair',1+Math.floor(random()*2));
    return{seed:String(seed),sector:sector,size:size,start:start,beacon:beacon,board:board,placements:placements};
  }
  root.NeonArcade={labRules:labRules,ruleOrder:ruleOrder,generateLabRound:generateLabRound,offerChoices:offerChoices,generateSalvageMap:generateSalvageMap};
})(window);
