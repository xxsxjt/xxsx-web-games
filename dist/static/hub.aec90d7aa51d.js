(function(){
  'use strict';
  var games=[],filter='all',key='xxsxWebGamesHubV1',state={favorites:[],recent:[]},storageAvailable=true;
  var list=document.getElementById('games'),notice=document.getElementById('hubNotice');
  function safe(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function save(){try{localStorage.setItem(key,JSON.stringify(state));}catch(e){storageAvailable=false;notice.textContent='浏览器未允许保存，收藏暂时只在本页保留。';}}
  function restore(){try{var saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object'){state.favorites=Array.isArray(saved.favorites)?saved.favorites.filter(function(id){return typeof id==='string';}):[];state.recent=Array.isArray(saved.recent)?saved.recent.filter(function(id){return typeof id==='string';}).slice(0,6):[];}}catch(e){notice.textContent='目录记录暂时不可用，仍可正常游玩。';}}
  function legacyRoute(){var hash=window.location.hash;if(/^#(?:game|station)\//.test(hash)){window.location.replace('play.html'+hash);return true;}return false;}
  function render(){
    var shown=games.filter(function(g){return filter==='all'||filter==='favorites'&&state.favorites.indexOf(g.id)>=0||g.type===filter;});
    list.innerHTML=shown.length?shown.map(function(g){var favorite=state.favorites.indexOf(g.id)>=0;return '<article class="gameCard"><a class="gameCover" href="play.html#game/'+g.id+'" data-open="'+g.id+'" aria-label="打开'+safe(g.name)+'"><img src="'+safe(g.cover)+'" alt="'+safe(g.name)+'界面截图" width="640" height="400" loading="lazy" decoding="async"></a><div class="gameInfo"><div class="gameMeta"><span>'+safe(g.type)+'</span><span>'+safe(g.status)+'</span></div><h2>'+safe(g.name)+'</h2><p>'+safe(g.description)+'</p><div class="gameControls">'+safe(g.controls)+'</div><div class="gameSave">'+safe(g.save)+'</div><div class="cardActions"><a class="playLink" href="play.html#game/'+g.id+'" data-open="'+g.id+'">打开游戏</a><button class="favoriteButton" type="button" data-favorite="'+g.id+'" aria-pressed="'+favorite+'" aria-label="'+(favorite?'取消收藏':'收藏')+safe(g.name)+'">'+(favorite?'已收藏':'收藏')+'</button></div></div></article>';}).join(''):'<p class="emptyState">还没有收藏。点击作品上的「收藏」，下次可以在这里找到它。</p>';
    document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
    var recent=state.recent.map(function(id){return games.find(function(g){return g.id===id;});}).filter(Boolean),container=document.getElementById('recentGames');
    container.hidden=recent.length===0;
    container.innerHTML=recent.length?'<span>最近打开</span>'+recent.slice(0,3).map(function(g){return '<a href="play.html#game/'+g.id+'" data-open="'+g.id+'">'+safe(g.name)+'</a>';}).join(''):'';
  }
  if(legacyRoute())return;
  window.addEventListener('hashchange',legacyRoute);
  restore();
  document.addEventListener('click',function(e){var b=e.target.closest('[data-filter],[data-favorite],[data-open]');if(!b)return;if(b.dataset.filter){filter=b.dataset.filter;render();}else if(b.dataset.favorite){var id=b.dataset.favorite,index=state.favorites.indexOf(id);if(index>=0)state.favorites.splice(index,1);else state.favorites.push(id);save();render();var next=list.querySelector('[data-favorite="'+id+'"]');if(next)next.focus();}else if(b.dataset.open){var opened=b.dataset.open;state.recent=[opened].concat(state.recent.filter(function(id){return id!==opened;})).slice(0,6);save();}});
  window.addEventListener('storage',function(e){if(e.key===key){restore();render();}});
  fetch('content/games.a86fe3363a72.json').then(function(r){if(!r.ok)throw new Error('catalog');return r.json();}).then(function(data){games=data;render();if(storageAvailable)notice.textContent='收藏与游玩记录保存在当前浏览器。';}).catch(function(){list.innerHTML='<p class="emptyState">目录暂时未能加载，请刷新重试。<a href="play.html#game/expedition">打开霓虹突围</a></p>';});
})();
