(function(root){
  'use strict';
  var clamp=function(v,a,b){return Math.max(a,Math.min(b,v));};
  function create(){return {width:3200,height:2400,camera:{x:0,y:0},stick:null,target:null,beacons:[{x:850,y:720,name:'维修站',charge:0,claimed:false},{x:2380,y:850,name:'弹药站',charge:0,claimed:false},{x:1800,y:1930,name:'核心站',charge:0,claimed:false}]};}
  function camera(f,p,w,h){f.camera.x=clamp(p.x-w/2,0,Math.max(0,f.width-w));f.camera.y=clamp(p.y-h/2,0,Math.max(0,f.height-h));return f.camera;}
  function spawn(f,p,w,h,random){
    var c=camera(f,p,w,h),result;
    function at(a){var dx=Math.cos(a),dy=Math.sin(a),distance=Math.min((dx>=0?c.x+w-p.x:p.x-c.x)/Math.max(.001,Math.abs(dx)),(dy>=0?c.y+h-p.y:p.y-c.y)/Math.max(.001,Math.abs(dy)))+100;return {x:clamp(p.x+dx*distance,32,f.width-32),y:clamp(p.y+dy*distance,32,f.height-32)};}
    for(var i=0;i<12;i++){result=at(random()*Math.PI*2);if(Math.hypot(result.x-p.x,result.y-p.y)>160&&(result.x<c.x-40||result.x>c.x+w+40||result.y<c.y-40||result.y>c.y+h+40))return result;}
    return at(Math.atan2(f.height/2-p.y,f.width/2-p.x));
  }
  function target(f,p,list,w,h){var candidates=list.filter(function(e){return !e.dead&&e.x>f.camera.x-60&&e.x<f.camera.x+w+60&&e.y>f.camera.y-60&&e.y<f.camera.y+h+60;});candidates.sort(function(a,b){return Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y);});var nearest=candidates[0],old=candidates.find(function(e){return e.uid===f.target;});var picked=old&&nearest&&Math.hypot(old.x-p.x,old.y-p.y)<Math.hypot(nearest.x-p.x,nearest.y-p.y)*1.18?old:nearest;f.target=picked?picked.uid:null;return picked||null;}
  function move(f,p,x,y,dt,speed){var length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}p.x=clamp(p.x+x*dt*speed,28,f.width-28);p.y=clamp(p.y+y*dt*speed,28,f.height-28);p.targetX=p.x;p.targetY=p.y;if(length>.05){p.dashX=x;p.dashY=y;}}
  function stick(f,x,y){if(!f.stick)f.stick={x:x,y:y,dx:0,dy:0};var dx=x-f.stick.x,dy=y-f.stick.y,length=Math.hypot(dx,dy),scale=length>8?Math.min(1,(length-8)/56)/length:0;f.stick.dx=dx*scale;f.stick.dy=dy*scale;}
  function chase(f,e,p,dt,speed){var dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,range=e.boss?210:e.type==='artillery'?220:e.type==='gunner'?155:e.type==='carrier'?190:0,forward=range?clamp((d-range)/75,-.65,1):1,side=e.type==='zigzag'?Math.sin(e.phase*3)*.7:e.boss?.38:range?.25:0;
    if(e.type==='blade'&&e.dashActive>0){dx=e.dashTargetX-e.x;dy=e.dashTargetY-e.y;d=Math.hypot(dx,dy)||1;side=0;forward=1;}
    e.x=clamp(e.x+(dx/d*forward-dy/d*side)*speed*dt,e.r,f.width-e.r);e.y=clamp(e.y+(dy/d*forward+dx/d*side)*speed*dt,e.r,f.height-e.r);
  }
  function dash(f,p){var x=p.dashX||0,y=p.dashY||0;if(!x&&!y)y=-1;var d=Math.hypot(x,y);return {x:clamp(p.x+x/d*110,28,f.width-28),y:clamp(p.y+y/d*110,28,f.height-28)};}
  function beacons(f,p,enemies,dt){var rewards=[];f.beacons.forEach(function(b){if(b.claimed)return;var near=Math.hypot(b.x-p.x,b.y-p.y)<85,contested=enemies.some(function(e){return !e.dead&&Math.hypot(e.x-b.x,e.y-b.y)<125;});if(near&&!contested)b.charge=Math.min(5,b.charge+dt);else b.charge=Math.max(0,b.charge-dt*.35);if(b.charge>=5){b.claimed=true;rewards.push(b);}});return rewards;}
  root.NeonFreeField={create:create,camera:camera,spawn:spawn,target:target,move:move,stick:stick,chase:chase,dash:dash,beacons:beacons};
})(typeof window!=='undefined'?window:globalThis);
