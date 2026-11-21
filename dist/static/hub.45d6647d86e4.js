(function () {
  'use strict';

  var storageKey = 'xxsxWebGamesHubV1';
  var idPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

  function safe(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character];
    });
  }

  // Deliberately narrow: local, unencoded paths only; no origin, traversal,
  // query, fragment, backslash or executable scheme can pass this allowlist.
  function localPath(value, extension) {
    if (typeof value !== 'string' || value.length > 240) return '';
    if (value.indexOf('./') === 0) value = value.slice(2);
    if (!/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*(?:\/[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)*$/i.test(value)) return '';
    return extension.test(value) ? value : '';
  }

  function safeEntry(value) {
    return localPath(value, /\.html$/i);
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalize(value) {
    value = String(value);
    if (value.normalize) value = value.normalize('NFKC');
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function normalizeCatalog(data) {
    if (!Array.isArray(data) || !data.length) throw new Error('Invalid catalogue');
    var ids = [];
    return data.map(function (source) {
      if (!source || typeof source !== 'object' || Array.isArray(source) ||
          typeof source.id !== 'string' || !idPattern.test(source.id) ||
          !text(source.name) || ids.indexOf(source.id) !== -1) throw new Error('Invalid game');
      ids.push(source.id);
      var game = {id: source.id, name: text(source.name), type: text(source.type) || '未分类'};
      ['description', 'controls', 'save', 'status', 'format'].forEach(function (field) {
        game[field] = text(source[field]);
      });
      game.href = safeEntry(source.entry) || 'play.html#game/' + source.id;
      game.cover = localPath(source.cover, /\.(?:svg|webp|png|jpe?g|avif|gif)$/i);
      var searchable = [game.id, game.name, game.type, game.description, game.controls, game.save, game.status, game.format];
      ['tags', 'keywords'].forEach(function (field) {
        if (Array.isArray(source[field])) searchable = searchable.concat(source[field].filter(function (item) { return typeof item === 'string'; }));
      });
      game.searchText = normalize(searchable.join(' '));
      return game;
    });
  }

  function filterGames(games, options, favorites) {
    var words = normalize(options.query || '').split(' ').filter(Boolean);
    return games.filter(function (game) {
      return (!options.type || game.type === options.type) &&
        (!options.favoritesOnly || favorites.indexOf(game.id) !== -1) &&
        words.every(function (word) { return game.searchText.indexOf(word) !== -1; });
    });
  }

  function copyState(state) {
    return {favorites: state.favorites.slice(), recent: state.recent.slice()};
  }

  function decodeState(raw) {
    var empty = {favorites: [], recent: []};
    if (raw === null) return {state: empty, writable: true};
    var source;
    try { source = JSON.parse(raw); } catch (error) { return {state: empty, writable: false}; }
    if (!source || typeof source !== 'object' || Array.isArray(source) ||
        (!Object.prototype.hasOwnProperty.call(source, 'favorites') && !Object.prototype.hasOwnProperty.call(source, 'recent'))) return {state: empty, writable: false};
    var writable = true;
    ['favorites', 'recent'].forEach(function (field) {
      if (source[field] === undefined) return;
      if (!Array.isArray(source[field])) { writable = false; return; }
      source[field].forEach(function (id) {
        if (typeof id !== 'string' || !idPattern.test(id)) { writable = false; return; }
        if (empty[field].indexOf(id) === -1) empty[field].push(id);
      });
    });
    empty.recent = empty.recent.slice(0, 6);
    return {state: empty, writable: writable};
  }

  function applyChanges(base, changes) {
    var next = copyState(base);
    changes.forEach(function (change) {
      if (change.kind === 'favorite') {
        next.favorites = next.favorites.filter(function (id) { return id !== change.id; });
        if (change.value) next.favorites.push(change.id);
      } else {
        next.recent = [change.id].concat(next.recent.filter(function (id) { return id !== change.id; })).slice(0, 6);
      }
    });
    return next;
  }

  // Re-read before each write and replay only this page's operations. An open
  // action therefore cannot replace newer favorites with an old page snapshot.
  // localStorage is not an atomic cross-tab transaction or a cloud save.
  function createStore(accessStorage) {
    var base = {favorites: [], recent: []}, state = copyState(base);
    var changes = [], issue = '', hasSnapshot = false;

    function refresh() {
      var decoded;
      try { decoded = decodeState(accessStorage().getItem(storageKey)); }
      catch (error) { issue = 'read'; return false; }
      if (decoded.writable || !hasSnapshot) base = decoded.state;
      hasSnapshot = true;
      issue = decoded.writable ? '' : 'corrupt';
      state = applyChanges(base, changes);
      return decoded.writable;
    }

    function save() {
      if (!refresh()) return false;
      try { accessStorage().setItem(storageKey, JSON.stringify(state)); }
      catch (error) { issue = 'write'; return false; }
      base = copyState(state);
      changes = [];
      issue = '';
      return true;
    }

    function change(kind, id, value) {
      if (typeof id !== 'string' || !idPattern.test(id)) return false;
      changes = changes.filter(function (item) { return item.kind !== kind || item.id !== id; });
      changes.push({kind: kind, id: id, value: value});
      state = applyChanges(base, changes);
      return save();
    }

    return {
      refresh: refresh,
      save: save,
      favorite: function (id, value) { return change('favorite', id, Boolean(value)); },
      opened: function (id) { return change('open', id); },
      snapshot: function () {
        var snapshot = copyState(state);
        snapshot.issue = issue;
        snapshot.pending = changes.length > 0;
        return snapshot;
      }
    };
  }

  function start(win, doc) {
    var games = [], types = [], shownIds = [], ready = false, loadVersion = 0;
    var options = {query: '', type: '', favoritesOnly: false};
    var list = doc.getElementById('games');
    var controls = doc.getElementById('catalogControls');
    var search = doc.getElementById('gameSearch');
    var clearSearch = doc.getElementById('clearSearch');
    var typeFilters = doc.getElementById('typeFilters');
    var favoriteFilter = doc.getElementById('favoritesFilter');
    var favoriteCount = doc.getElementById('favoriteCount');
    var summary = doc.getElementById('resultsSummary');
    var resetFilters = doc.getElementById('resetFilters');
    var recentContainer = doc.getElementById('recentGames');
    var notice = doc.getElementById('hubNotice');
    var storageMessage = doc.getElementById('storageMessage');
    var retryStorage = doc.getElementById('retryStorage');
    var store = createStore(function () { return win.localStorage; });

    function legacyRoute() {
      var hash = win.location.hash;
      if (/^#(?:game|station)\//.test(hash)) {
        win.location.replace('play.html' + hash);
        return true;
      }
      return false;
    }

    function renderStorage() {
      var snapshot = store.snapshot();
      var messages = {
        read: '暂时无法读取目录记录。本页收藏与最近打开暂不保存，游戏仍可打开。',
        write: '浏览器未能保存目录记录。改动暂留在本页，关闭页面后可能丢失。',
        corrupt: '目录记录格式异常，未覆盖原记录。本页改动暂不保存，各游戏存档未改动。'
      };
      storageMessage.hidden = !snapshot.issue && !snapshot.pending;
      notice.textContent = messages[snapshot.issue] || (snapshot.pending ? '本页有尚未保存的目录改动，可以重试保存。' : '目录记录已保存。');
    }

    function renderTypes() {
      typeFilters.innerHTML = [''].concat(types).map(function (type) {
        return '<button type="button" data-type="' + safe(type) + '" aria-pressed="' + String(options.type === type) + '">' + safe(type || '全部类型') + '</button>';
      }).join('');
    }

    function renderRecent(snapshot) {
      var recent = snapshot.recent.map(function (id) {
        return games.find(function (game) { return game.id === id; });
      }).filter(Boolean).slice(0, 3);
      recentContainer.hidden = !recent.length;
      recentContainer.innerHTML = recent.length ? '<div class="recentLabel"><h2 id="recentHeading">最近打开</h2><p>仅记录入口，不代表局内可续玩。</p></div><ul>' + recent.map(function (game) {
        return '<li><a href="' + safe(game.href) + '" data-open="' + safe(game.id) + '">' + safe(game.name) + '</a></li>';
      }).join('') + '</ul>' : '';
    }

    function gameCard(game, favorites) {
      var favorite = favorites.indexOf(game.id) !== -1;
      var id = safe(game.id), name = safe(game.name), href = safe(game.href);
      var cover = game.cover ? '<img src="' + safe(game.cover) + '" alt="" width="96" height="96" loading="lazy" decoding="async">' : '<span class="gameInitial" aria-hidden="true">' + safe(game.name.slice(0, 1)) + '</span>';
      return '<article class="gameCard"><div class="gameIdentity"><a class="gameCover" href="' + href + '" data-open="' + id + '" aria-label="打开' + name + '">' + cover + '</a><div class="gameHeading"><div class="gameMeta"><span>' + safe(game.type + (game.format ? ' · ' + game.format : '')) + '</span>' + (game.status ? '<span>' + safe(game.status) + '</span>' : '') + '</div><h2>' + name + '</h2></div></div><div class="gameInfo"><p>' + safe(game.description) + '</p>' + (game.controls ? '<div class="gameControls"><span>操作</span> ' + safe(game.controls) + '</div>' : '') + (game.save ? '<div class="gameSave"><span>存档</span> ' + safe(game.save) + '</div>' : '') + '<div class="cardActions"><a class="playLink" href="' + href + '" data-open="' + id + '" aria-label="打开' + name + '">打开游戏</a><button class="favoriteButton" type="button" data-favorite="' + id + '" aria-pressed="' + String(favorite) + '" aria-label="' + (favorite ? '取消收藏' : '收藏') + name + '">' + (favorite ? '已收藏' : '收藏') + '</button></div></div></article>';
    }

    function emptyResults(snapshot) {
      var title, description, action;
      if (normalize(options.query)) {
        title = '没有找到匹配的作品';
        description = '试试缩短关键词或清除搜索。类型与收藏条件也会影响结果。';
        action = '<button class="textButton" type="button" data-clear-search>清除搜索</button>';
      } else if (options.favoritesOnly && !games.some(function (game) { return snapshot.favorites.indexOf(game.id) !== -1; })) {
        title = '还没有收藏作品';
        description = '在作品上点击「收藏」，之后就能在这里找到它。';
        action = '<button class="textButton" type="button" data-reset>查看全部作品</button>';
      } else {
        title = '当前条件下没有作品';
        description = '可以切换类型、关闭「我的收藏」，或清除全部条件。';
        action = '<button class="textButton" type="button" data-reset>清除全部条件</button>';
      }
      return '<div class="emptyState"><h2>' + title + '</h2><p>' + description + '</p>' + action + '</div>';
    }

    function render() {
      renderStorage();
      if (!ready) return;
      var focused = doc.activeElement;
      var focusRegion = list.contains(focused) ? list : recentContainer.contains(focused) ? recentContainer : null;
      var focusAction = focused && focused.hasAttribute('data-favorite') ? 'favorite' : 'open';
      var focusId = focusRegion && focused.dataset[focusAction];
      var focusClass = focusId && focused.getAttribute('class');
      var focusEmptyAction = focusRegion && !focusId && ['data-clear-search', 'data-reset'].find(function (attribute) {
        return focused.hasAttribute(attribute);
      });
      var snapshot = store.snapshot();
      var shown = filterGames(games, options, snapshot.favorites);
      shownIds = shown.map(function (game) { return game.id; });
      list.innerHTML = shown.length ? shown.map(function (game) { return gameCard(game, snapshot.favorites); }).join('') : emptyResults(snapshot);
      summary.textContent = '显示 ' + shown.length + ' / ' + games.length + ' 款作品' +
        (options.type ? ' · ' + options.type : '') + (options.favoritesOnly ? ' · 我的收藏' : '') +
        (normalize(options.query) ? ' · 搜索「' + options.query.trim() + '」' : '');
      favoriteCount.textContent = String(games.filter(function (game) { return snapshot.favorites.indexOf(game.id) !== -1; }).length);
      favoriteFilter.setAttribute('aria-pressed', String(options.favoritesOnly));
      typeFilters.querySelectorAll('[data-type]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.type === options.type));
      });
      clearSearch.hidden = !search.value;
      resetFilters.hidden = !options.type && !options.favoritesOnly && !search.value;
      renderRecent(snapshot);
      if (focusId) {
        var candidates = Array.from(focusRegion.querySelectorAll('[data-' + focusAction + ']')).filter(function (element) {
          return element.dataset[focusAction] === focusId;
        });
        var replacement = candidates.find(function (element) { return element.getAttribute('class') === focusClass; }) || candidates[0];
        (replacement || favoriteFilter).focus();
      } else if (focusEmptyAction) {
        (list.querySelector('[' + focusEmptyAction + ']') || search).focus();
      }
    }

    function clearQuery() {
      search.value = '';
      options.query = '';
      render();
      search.focus();
    }

    function reset() {
      options = {query: '', type: '', favoritesOnly: false};
      search.value = '';
      render();
      search.focus();
    }

    function loadCatalog(returnFocus) {
      var version = ++loadVersion;
      var controller = win.AbortController ? new win.AbortController() : null;
      var timedOut = false;
      var timer = controller ? win.setTimeout(function () { timedOut = true; controller.abort(); }, 12000) : null;
      ready = false;
      controls.disabled = true;
      list.setAttribute('aria-busy', 'true');
      list.innerHTML = '<p class="emptyState">正在载入作品目录…</p>';
      summary.textContent = '正在载入目录…';
      Promise.resolve().then(function () {
        return win.fetch('content/games.a9fd6cc32b76.json', controller ? {signal: controller.signal} : {});
      }).then(function (response) {
        if (!response.ok) throw new Error('Catalogue request failed');
        return response.json();
      }).then(function (data) {
        if (version !== loadVersion) return;
        games = normalizeCatalog(data);
        types = games.map(function (game) { return game.type; }).filter(function (type, index, all) { return all.indexOf(type) === index; });
        if (types.indexOf(options.type) === -1) options.type = '';
        ready = true;
        controls.disabled = false;
        list.setAttribute('aria-busy', 'false');
        renderTypes();
        render();
        if (returnFocus) search.focus();
      }).catch(function () {
        if (version !== loadVersion) return;
        list.setAttribute('aria-busy', 'false');
        summary.textContent = '目录未能载入，暂无结果数。';
        list.innerHTML = '<div class="emptyState"><h2>目录暂时未能加载</h2><p>' + (timedOut ? '加载超时，请检查网络后重试。' : '连接或目录内容暂时不可用，请稍后重试。') + '收藏不会因此清除。</p><div class="emptyActions"><button class="textButton" type="button" data-retry-catalog>重试加载</button><a href="play.html#game/expedition">打开原游戏入口</a></div></div>';
        if (returnFocus) list.querySelector('[data-retry-catalog]').focus();
      }).then(function () {
        if (timer !== null) win.clearTimeout(timer);
      });
    }

    if (legacyRoute()) return;
    win.addEventListener('hashchange', legacyRoute);
    store.refresh();
    renderStorage();

    search.addEventListener('input', function () {
      options.query = search.value;
      render();
    });
    search.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !event.isComposing && search.value) {
        event.preventDefault();
        clearQuery();
      }
    });
    clearSearch.addEventListener('click', clearQuery);
    resetFilters.addEventListener('click', reset);
    retryStorage.addEventListener('click', function () {
      store.save();
      render();
      if (storageMessage.hidden) (ready ? favoriteFilter : list).focus();
    });

    doc.addEventListener('click', function (event) {
      if (event.defaultPrevented || !event.target.closest) return;
      var button = event.target.closest('[data-type],[data-favorites],[data-favorite],[data-open],[data-clear-search],[data-reset],[data-retry-catalog]');
      if (!button) return;
      if (button.hasAttribute('data-retry-catalog')) { loadCatalog(true); return; }
      if (!ready) return;
      if (button.hasAttribute('data-type')) {
        if (button.dataset.type && types.indexOf(button.dataset.type) === -1) return;
        options.type = button.dataset.type;
        render();
      } else if (button.hasAttribute('data-favorites')) {
        options.favoritesOnly = !options.favoritesOnly;
        render();
      } else if (button.hasAttribute('data-clear-search')) {
        clearQuery();
      } else if (button.hasAttribute('data-reset')) {
        reset();
      } else {
        var id = button.dataset.favorite || button.dataset.open;
        if (!games.some(function (game) { return game.id === id; })) return;
        if (button.hasAttribute('data-favorite')) {
          var index = shownIds.indexOf(id);
          store.favorite(id, store.snapshot().favorites.indexOf(id) === -1);
          render();
          var buttons = Array.from(list.querySelectorAll('[data-favorite]'));
          var next = buttons.find(function (item) { return item.dataset.favorite === id; }) || buttons[Math.min(index, buttons.length - 1)] || favoriteFilter;
          next.focus();
        } else {
          // Do not intercept navigation or replace the clicked link.
          store.opened(id);
          renderStorage();
          if (!recentContainer.contains(button)) renderRecent(store.snapshot());
        }
      }
    });

    win.addEventListener('storage', function (event) {
      if (event.key !== storageKey && event.key !== null) return;
      store.refresh();
      render();
    });
    win.addEventListener('pageshow', function (event) {
      if (event.persisted) { store.refresh(); render(); }
    });
    loadCatalog();
  }

  // CommonJS consumers can exercise the same pure helpers/store without a
  // browser or test globals. The published page exports nothing on window.
  if (typeof module === 'object' && module.exports) {
    module.exports = {safe: safe, safeEntry: safeEntry, normalizeCatalog: normalizeCatalog, filterGames: filterGames, decodeState: decodeState, createStore: createStore, start: start};
  } else {
    start(window, document);
  }
})();
