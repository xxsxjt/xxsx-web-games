(function(){
  'use strict';
  var files=JSON.parse(document.getElementById('gameFiles').textContent),hash=window.location.hash;
  var aliases={signals:'relay',bridge:'station'},match=/^#(?:game|station)\/([a-z]+)/.exec(hash),kind=match?aliases[match[1]]||match[1]:'expedition';
  var short=['relay','lab','salvage'],known=['expedition','border','blackbox'].concat(short);
  if(known.indexOf(kind)<0)kind='station';
  var gameNames=[];function updateTitle(path){if(!gameNames.length)return;var route=path===undefined?window.location.hash:path,m=/^#?(?:game|station)\/([a-z]+)/.exec(route||''),id=m?aliases[m[1]]||m[1]:'arcade',game=gameNames.find(function(g){return g.id===id;});document.title=(game?game.name:id==='arcade'?'新伊甸游戏厅':'科幻舰站')+' · XXSX 游戏站';}
  fetch('content/games.fe8b86828415.json').then(function(r){return r.json();}).then(function(games){gameNames=games;updateTitle();}).catch(function(){});
  window.addEventListener('hashchange',function(){updateTitle();});window.addEventListener('popstate',function(){updateTitle();});
  var loadedKind=kind,common=['catalog','core','runtime'],extra=kind==='border'?['border']:kind==='blackbox'?['blackbox','circuit']:short.indexOf(kind)>=0?['arcade','campaignCore','salvageExpedition','echoDeck','relayDefense']:[];
  window.NeonPlayLoader={
    updateTitle:updateTitle,
    supports:function(id){return id==='expedition'||id==='station'||id===loadedKind||short.indexOf(id)>=0&&short.indexOf(loadedKind)>=0;},
    navigate:function(id){window.location.replace('play.html#game/'+id);window.location.reload();},
    home:function(){window.location.assign('./');}
  };
  function load(name){return new Promise(function(resolve,reject){var script=document.createElement('script');script.src=files[name];script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});}
  var loading=document.getElementById('playLoading');
  common.concat(extra,['game']).reduce(function(p,name){return p.then(function(){return load(name);});},Promise.resolve()).then(function(){if(!window.NeonGameBooted)throw new Error('game initialization');loading.remove();}).catch(function(){loading.innerHTML='<h1>游戏暂时未能载入</h1><p>请刷新重试，已有本机存档仍会保留。</p><a href="./">返回所有游戏</a>';});
})();
