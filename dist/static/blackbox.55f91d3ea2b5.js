(function(root){
  'use strict';
  var N=1,E=2,S=4,W=8;
  function rotateMask(mask,turns){var result=mask&15,n=((turns%4)+4)%4;while(n--){result=((result<<1)&15)|((result>>3)&1);}return result;}
  function direction(a,b,size){var ax=a%size,ay=Math.floor(a/size),bx=b%size,by=Math.floor(b/size);if(bx===ax&&by===ay-1)return N;if(bx===ax+1&&by===ay)return E;if(bx===ax&&by===ay+1)return S;if(bx===ax-1&&by===ay)return W;return 0;}
  function transformIndex(index,size,rotation,mirror){
    var x=index%size,y=Math.floor(index/size);
    if(mirror)x=size-1-x;
    for(var i=0;i<rotation;i++){var nextX=size-1-y;y=x;x=nextX;}
    return y*size+x;
  }
  function boundaryPort(index,size){var x=index%size,y=Math.floor(index/size);if(y===0)return N;if(x===size-1)return E;if(y===size-1)return S;return W;}
  function pathMasks(path,size,startPort,endPort){return path.map(function(index,position){var mask=position===0?startPort:direction(index,path[position-1],size);if(position<path.length-1)mask|=direction(index,path[position+1],size);else mask|=endPort;return mask;});}
  function walkPath(size,stage,rng){
    var middle=Math.floor(size/2),row=middle,path=[middle*size],maxDrift=stage>=5?2:1;
    for(var col=0;col<size-1;col++){
      var change=0,roll=rng();
      if(roll<.38)change=-1;else if(roll<.76)change=1;
      if(stage>=4&&rng()<.24)change*=2;
      var target=Math.max(0,Math.min(size-1,row+Math.max(-maxDrift,Math.min(maxDrift,change))));
      while(row!==target){row+=row<target?1:-1;path.push(row*size+col);}
      path.push(row*size+col+1);
    }
    while(row!==middle){row+=row<middle?1:-1;path.push(row*size+size-1);}
    return path;
  }
  function generate(stage,seed,attempt,bonusMoves){
    stage=Math.max(1,Math.min(7,Math.floor(Number(stage)||1)));attempt=Math.max(0,Math.floor(Number(attempt)||0));bonusMoves=Math.max(0,Math.floor(Number(bonusMoves)||0));
    var size=stage<=2?5:stage<=4?6:7,random=root.NeonCore.createRng(String(seed||'ND-RUN')+'|'+stage+'|'+attempt),path=walkPath(size,stage,random),rotation=Math.floor(random()*4),mirror=random()<.5;
    path=path.map(function(index){return transformIndex(index,size,rotation,mirror);});
    var start=path[0],end=path[path.length-1],startPort=boundaryPort(start,size),endPort=boundaryPort(end,size),masks=pathMasks(path,size,startPort,endPort),cells=Array.from({length:size*size},function(){return{mask:0,solutionMask:0,rotatable:false,kind:'blank'};});
    path.forEach(function(index,position){var turns=1+Math.floor(random()*3),mask=masks[position];if(mask===5||mask===10)turns=1+(Math.floor(random()*2)*2);cells[index]={mask:rotateMask(mask,turns),solutionMask:mask,rotatable:true,kind:position===0?'source':position===path.length-1?'output':'wire'};});
    var vacant=[];for(var i=0;i<cells.length;i++)if(path.indexOf(i)<0)vacant.push(i);
    var decoyMasks=[3,6,12,9,5,10,7,11,13,14],decoys=Math.min(4+stage,Math.floor(size*size*.32));
    for(var d=0;d<decoys&&vacant.length;d++){var slot=Math.floor(random()*vacant.length),index=vacant.splice(slot,1)[0],base=decoyMasks[Math.floor(random()*decoyMasks.length)],turns=Math.floor(random()*4);cells[index]={mask:rotateMask(base,turns),solutionMask:rotateMask(base,turns),rotatable:true,kind:'decoy'};}
    var moveLimit=path.length*3+stage*2+bonusMoves;
    return{stage:stage,size:size,seed:String(seed||'ND-RUN'),attempt:attempt,start:start,end:end,startPort:startPort,endPort:endPort,rotation:rotation,mirror:mirror,cells:cells,path:path,solutionPath:path.slice(),scrambled:path.slice(),movesUsed:0,movesLeft:moveLimit,moveLimit:moveLimit};
  }
  function poweredCells(state){
    if(!state||!state.cells||!state.cells[state.start]||!(state.cells[state.start].mask&(state.startPort||W)))return[];
    var size=state.size,seen={};seen[state.start]=true;var queue=[state.start],cursor=0;
    while(cursor<queue.length){var index=queue[cursor++],row=Math.floor(index/size),col=index%size,steps=[[-size,N,S],[1,E,W],[size,S,N],[-1,W,E]];
      for(var i=0;i<steps.length;i++){var delta=steps[i][0],port=steps[i][1],back=steps[i][2],next=index+delta;if((port===E&&col===size-1)||(port===W&&col===0)||(port===N&&row===0)||(port===S&&row===size-1))continue;if(!(state.cells[index].mask&port)||!state.cells[next]||!(state.cells[next].mask&back)||seen[next])continue;seen[next]=true;queue.push(next);}
    }
    return queue;
  }
  function isSolved(state){var powered=poweredCells(state);return !!state&&powered.indexOf(state.end)>=0&&!!(state.cells[state.end].mask&(state.endPort||E));}
  function rotate(state,index,turns){
    if(!state||!Number.isInteger(index)||index<0||index>=state.cells.length||!state.cells[index].rotatable||state.movesLeft<=0)return false;
    turns=turns===-1?-1:1;state.cells[index].mask=rotateMask(state.cells[index].mask,turns);state.movesUsed++;state.movesLeft=Math.max(0,state.moveLimit-state.movesUsed);return true;
  }
  function hint(state){if(!state)return null;for(var i=0;i<state.path.length;i++){var index=state.path[i],cell=state.cells[index];if(cell.mask!==cell.solutionMask){var turns=0,mask=cell.mask;while(mask!==cell.solutionMask&&turns<4){mask=rotateMask(mask,1);turns++;}return{index:index,turns:turns===4?0:turns};}}return null;}
  root.NeonBlackbox={ports:{north:N,east:E,south:S,west:W},generate:generate,rotateMask:rotateMask,poweredCells:poweredCells,isSolved:isSolved,rotate:rotate,hint:hint};
})(window);
