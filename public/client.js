// 알PDF - 게임 화면 (이동, 건축, 농사, 낚시, 요리, 가방, 상점, 퀘스트, 도감, 꾸미기, 거래, 강아지, 미니맵, 채팅)
(() => {
  'use strict';
  const S = window.SHARED, D = window.DRAW;
  const { TILE, W, H } = S;
  let ZOOM = 3;               // 화면 확대 (휴대폰처럼 작은 화면은 2)
  const SPEED = 80;
  // 📱 터치 기기면 조이스틱·버튼을 보여줘요
  const TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  if (TOUCH) document.body.classList.add('touch');
  const BUBBLE_MS = 6000;
  const FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";
  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  // ───────── 월드 ─────────
  const world = {
    ground: null,
    objects: new Map(),
    g(x, y) { return this.ground && x >= 0 && y >= 0 && x < W && y < H && this.ground[y] ? this.ground[y][x] : null; },
    o(x, y) { return this.objects.get(x + ',' + y) || null; },
  };
  const signs = new Set(), anims = new Set(), lights = new Set();
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = W * TILE; mapCanvas.height = H * TILE;
  const mctx = mapCanvas.getContext('2d');

  function redraw(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    mctx.clearRect(x * TILE, y * TILE, TILE, TILE);
    D.drawTile(mctx, x * TILE, y * TILE, x, y, world);
  }
  function indexTile(k, o) {
    if (o && o.t === 'sign') signs.add(k); else signs.delete(k);
    if (D.hasAnim(o)) anims.add(k); else anims.delete(k);
    if (o && S.OBJ[o.t] && S.OBJ[o.t].light) lights.add(k); else lights.delete(k);
  }
  function redrawAll() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { redraw(x, y); mmPixel(x, y); } }
  function applyTile(t) {
    const k = t.x + ',' + t.y;
    world.ground[t.y][t.x] = t.g;
    if (t.o) world.objects.set(k, t.o); else world.objects.delete(k);
    indexTile(k, t.o);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) redraw(t.x + dx, t.y + dy);
    mmPixel(t.x, t.y);
  }

  const isSolidAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return world.g(tx, ty) === 'water' || S.isSolidObj(world.o(tx, ty));
  };
  const blocked = (x, y) => isSolidAt(x - 4, y - 3) || isSolidAt(x + 4, y - 3) || isSolidAt(x - 4, y) || isSolidAt(x + 4, y);

  // ───────── 미니맵 (오른쪽 위) ─────────
  const mmBase = document.createElement('canvas');
  mmBase.width = W; mmBase.height = H;
  const mmb = mmBase.getContext('2d');
  const mm = $('minimap'), mmx = mm.getContext('2d');
  const MM_GROUND = {
    grass: '#8fd16f', forest: '#6aae55', water: '#63bde8', sand: '#f3e3b3', farm: '#9b6a43', path: '#efdcab', stone_path: '#d3cdc3',
    brick_path: '#de9474', cave: '#5a5162',
  };
  function mmColor(x, y) {
    const o = world.o(x, y), g = world.g(x, y);
    if (o) {
      if (o.t === 'tree' || o.t === 'pine') return o.fixed ? '#2f7236' : '#3f8f45';
      if (o.t === 'cave_wall') return '#2a2430';
      if (o.t === 'rock' || o.t === 'pebble') return '#a8a49e';
      if (o.t === 'ore_iron') return '#d98c5f';
      if (o.t === 'ore_gold') return '#ffd34d';
      if (o.t === 'crystal') return '#b48cff';
      if (o.t === 'shop') return '#ff5c8a';
      if (o.t === 'board') return '#ffb36b';
      if (o.t === 'crop') return '#7ed492';
      if (o.t === 'campfire' || o.t === 'torch') return '#ff9a2e';
      if (S.WALLS[o.t] || (S.OBJ[o.t] && S.OBJ[o.t].wall)) return S.WALLS[o.t] ? S.WALLS[o.t][2] : '#8b5a3c';
      if (o.t === 'flower' || o.t === 'sprout' || o.t === 'stump' || o.t === 'sapling') return MM_GROUND[g] || '#8fd16f';
      if (o.t === 'fence') return '#c99558';
      return '#d9a066';
    }
    return MM_GROUND[g] || (S.GROUND[g] && S.GROUND[g].item ? '#e8d3b8' : '#8fd16f');
  }
  function mmPixel(x, y) { mmb.fillStyle = mmColor(x, y); mmb.fillRect(x, y, 1, 1); }
  let mmBig = false;
  function mmSize() {
    const small = innerWidth < 700;
    const cssW = mmBig ? (small ? Math.min(260, innerWidth - 24) : 300) : (small ? 96 : 160);
    mm.style.width = cssW + 'px'; mm.style.height = Math.round(cssW * H / W) + 'px';
    mm.width = Math.round(cssW * dpr); mm.height = Math.round(cssW * H / W * dpr);
  }
  mm.addEventListener('click', () => { mmBig = !mmBig; mmSize(); });
  function drawMinimap(now) {
    if (!world.ground || $('mmWrap').classList.contains('hidden')) return;
    const w = mm.width, h = mm.height, sx = w / W, sy = h / H;
    mmx.imageSmoothingEnabled = false;
    mmx.drawImage(mmBase, 0, 0, w, h);
    // 지금 보이는 화면 범위
    const vw = canvas.width / Sc, vh = canvas.height / Sc;
    mmx.strokeStyle = 'rgba(255,255,255,0.9)'; mmx.lineWidth = Math.max(1, dpr);
    mmx.strokeRect(cam.x / TILE * sx, cam.y / TILE * sy, vw / TILE * sx, vh / TILE * sy);
    // 다른 사람: 작은 점
    for (const [id, p] of Object.entries(players)) {
      if (id === myId) continue;
      mmx.fillStyle = S.CLOTH[p.avatar ? p.avatar.tc : 0];
      mmx.strokeStyle = '#4a3b5c'; mmx.lineWidth = dpr;
      mmx.beginPath(); mmx.arc(p.dx / TILE * sx, p.dy / TILE * sy, 3 * dpr, 0, Math.PI * 2); mmx.fill(); mmx.stroke();
    }
    // 나: 빨간 원 (반짝)
    if (myId) {
      const px = me.x / TILE * sx, py = me.y / TILE * sy;
      const pulse = 1 + 0.25 * Math.sin(now / 250);
      mmx.fillStyle = 'rgba(255,59,92,0.25)';
      mmx.beginPath(); mmx.arc(px, py, 8 * dpr * pulse, 0, Math.PI * 2); mmx.fill();
      mmx.fillStyle = '#ff3b5c'; mmx.strokeStyle = '#ffffff'; mmx.lineWidth = 2 * dpr;
      mmx.beginPath(); mmx.arc(px, py, 4.5 * dpr, 0, Math.PI * 2); mmx.fill(); mmx.stroke();
    }
  }

  // ───────── 아이콘 ─────────
  const iconCache = {};
  function iconSrc(id) {
    if (!iconCache[id]) {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      D.drawItem(c.getContext('2d'), 0, 0, id);
      iconCache[id] = c.toDataURL();
    }
    return iconCache[id];
  }
  const iconImg = (id, cls) => el('img', { class: cls || 'ic', src: iconSrc(id), alt: S.ITEMS[id] ? S.ITEMS[id].name : id });
  const itemName = (id) => (S.ITEMS[id] ? S.ITEMS[id].name : id);

  // ───────── 캔버스 ─────────
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
  let dpr = 1, Sc = ZOOM;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    ZOOM = Math.min(innerWidth, innerHeight) < 560 ? 2 : 3;
    Sc = ZOOM * dpr;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    dark.width = canvas.width; dark.height = canvas.height;
    mmSize();
  }
  addEventListener('resize', resize);

  // ───────── 상태 ─────────
  const socket = io();
  let myId = null, joinInfo = null;
  let my = null;              // 내 코인, 가방, 퀘스트 기록, 아바타, 도감
  let clockSkew = 0;          // 서버 시간 - 내 시간
  let sel = 0;
  let placeRot = 0;           // 가구 놓을 방향 (R로 돌려요)
  let myLv = 1;               // 내 레벨
  let fishing = null;
  let buffUntil = 0;
  const players = {};
  const animals = {};         // id -> { kind, x, y, dx, dy, dir, moving, flags, owner, pname, follow }
  const arrows = [], fxs = [];
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const me = { x: 0, y: 0, dir: 'down', moving: false, pose: null };
  resize();

  function syncAnimals(list) {
    const seen = new Set();
    for (const [id, kind, x, y, left, moving, flags, owner, pname, follow] of list) {
      seen.add(id);
      const dir = left ? 'left' : 'right';
      const extra = { owner: owner || null, pname: pname || null, follow: !!follow };
      if (!animals[id]) animals[id] = Object.assign({ kind, x, y, dx: x, dy: y, dir, moving: !!moving, flags }, extra);
      else {
        const a = animals[id];
        if (Math.hypot(a.dx - x, a.dy - y) > TILE * 6) { a.dx = x; a.dy = y; } // 순간이동
        Object.assign(a, { x, y, dir, moving: !!moving, flags }, extra);
      }
    }
    for (const id in animals) if (!seen.has(id)) delete animals[id];
  }
  function animalAt(tx, ty) {
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    let best = null, bd = 13, bid = null;
    for (const [id, a] of Object.entries(animals)) {
      const d = Math.hypot(a.dx - cx, a.dy - 4 - cy);
      if (d < bd) { bd = d; best = a; bid = id; }
    }
    if (best) best.id = bid;
    return best;
  }
  const myName = () => (my && players[myId] ? players[myId].name.toLowerCase() : '');
  const isMyPet = (a) => !!a && !!a.owner && a.owner.toLowerCase() === myName();

  // ───────── 탭 제목 / 안 읽은 채팅 알림 ─────────
  const BASE_TITLE = '알PDF';
  let unread = 0, blinkTimer = null;
  function setFavicon(badge) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#e53935'; g.fillRect(5, 2, 22, 28);
    g.fillStyle = '#ffffff'; g.fillRect(9, 9, 14, 2); g.fillRect(9, 14, 14, 2); g.fillRect(9, 19, 10, 2);
    if (badge) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(24, 8, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffc400'; g.beginPath(); g.arc(24, 8, 6, 0, Math.PI * 2); g.fill();
    }
    $('favicon').href = c.toDataURL();
  }
  setFavicon(false);
  function notifyUnread() {
    if (TOUCH && !document.body.classList.contains('chatOpen')) {
      chatUnread++;
      $('bChatN').textContent = chatUnread; $('bChatN').style.display = 'inline-block';
    }
    if (!document.hidden && document.hasFocus()) return;
    unread++;
    document.title = `💬 새 메시지 ${unread}개`;
    setFavicon(true);
    if (!blinkTimer) {
      let on = true;
      blinkTimer = setInterval(() => { on = !on; document.title = on ? `💬 새 메시지 ${unread}개` : `(${unread}) ${BASE_TITLE}`; }, 1000);
    }
  }
  function clearUnread() {
    if (!unread && !blinkTimer) return;
    unread = 0;
    clearInterval(blinkTimer); blinkTimer = null;
    document.title = BASE_TITLE;
    setFavicon(false);
  }
  addEventListener('focus', clearUnread);
  addEventListener('mousedown', clearUnread);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.hasFocus()) clearUnread(); });
  const keys = new Set();
  const cam = { x: 0, y: 0 };
  const mouse = { sx: 0, sy: 0, in: false, t: 0 };
  let target = { x: 0, y: 0 };

  function addPlayer(p) {
    players[p.id] = Object.assign(players[p.id] || {}, {
      name: p.name, x: p.x, y: p.y, dx: p.x, dy: p.y, dir: p.dir, moving: p.moving, avatar: p.avatar, fishing: p.fishing, held: p.held, pose: p.pose,
      lv: p.lv || 1, mvp: !!p.mvp,
    });
    updateWho();
  }

  // ───────── 알림 ─────────
  function showToast(text, item) {
    const box = $('toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const t = el('div', { class: 'toast', style: 'display:flex;gap:6px;align-items:center' }, item ? iconImg(item) : null, text);
    box.append(t);
    setTimeout(() => t.remove(), 2800);
  }

  // 보상 확인 창 (여러 개면 차례대로)
  const rewardQueue = [];
  function showReward(r) {
    rewardQueue.push(r);
    if (rewardQueue.length === 1) renderReward();
  }
  function renderReward() {
    const r = rewardQueue[0];
    const box = $('reward');
    if (!r) { box.classList.add('hidden'); return; }
    const list = el('div', { class: 'rw-list' });
    if (r.coins) list.append(el('div', { class: 'rw-item' }, el('span', { class: 'rw-coin' }, '💰'), el('b', {}, `+${r.coins}`), el('small', {}, '코인')));
    for (const [id, n] of Object.entries(r.items || {})) {
      const def = S.ITEMS[id];
      list.append(el('div', { class: 'rw-item' + (def && def.questOnly ? ' rare' : '') }, iconImg(id, 'ic big'), el('b', {}, `×${n}`), el('small', {}, itemName(id))));
    }
    if (r.unlock) {
      const c = S.COSMETICS[r.unlock];
      const av = Object.assign({}, my ? my.avatar : S.defaultAvatar(Math.random));
      av[c.slot] = c.slot === 'top' ? S.TOPS.findIndex((t) => t.id === c.id) : c.id;
      list.append(el('div', { class: 'rw-item rare' }, avatarThumb(av, 56), el('b', {}, '꾸미기'), el('small', {}, c.name)));
    }
    if (r.converted) list.append(el('div', { class: 'rw-item' }, el('span', { class: 'rw-coin' }, '💰'), el('b', {}, `+${r.converted}`), el('small', {}, '(이미 가진 꾸미기 → 코인)')));
    if (r.exp) list.append(el('div', { class: 'rw-item' }, el('span', { class: 'rw-coin' }, '⭐'), el('b', {}, `+${r.exp}`), el('small', {}, '경험치')));
    if (r.unlocks) {
      if (!r.unlocks.length) list.append(el('div', {}, '계속 힘내요! 💪'));
      else list.append(el('div', { class: 'rw-unlocks' }, el('b', {}, '🔓 새로 열린 것'), el('div', {}, r.unlocks.map((u) => el('span', { class: 'chip' }, u)))));
    }
    if (!list.children.length) list.append(el('div', {}, '받을 것이 없었어요'));
    $('rewardBody').innerHTML = '';
    $('rewardBody').append(...[el('h3', {}, r.title || '🎁 보상'), list,
      r.unlock ? el('p', { class: 'rw-hint' }, '👗 꾸미기(C)에서 바로 입어볼 수 있어요!') : null,
      Object.keys(r.items || {}).length ? el('p', { class: 'rw-hint' }, '🎒 가방에 넣었어요') : null].filter(Boolean));
    box.classList.remove('hidden');
    $('rewardOk').focus();
  }
  $('rewardOk').addEventListener('click', () => { rewardQueue.shift(); renderReward(); });

  // ───────── 네트워크 ─────────
  socket.on('connect', () => {
    $('status').style.display = 'none';
    if (joinInfo && myId) socket.emit('join', Object.assign({}, joinInfo, { rejoin: true }));
  });
  socket.on('disconnect', () => { $('status').style.display = 'block'; });
  socket.on('joinError', (msg) => { joinInfo = null; $('joinMsg').textContent = msg; });

  socket.on('init', (d) => {
    const first = myId === null;
    myId = d.id;
    world.ground = d.world.ground;
    world.objects = new Map(Object.entries(d.world.objects));
    signs.clear(); anims.clear(); lights.clear();
    for (const [k, o] of world.objects) indexTile(k, o);
    redrawAll();
    for (const id in players) delete players[id];
    Object.values(d.players).forEach(addPlayer);
    for (const id in animals) delete animals[id];
    syncAnimals(d.animals || []);
    me.x = players[myId].x; me.y = players[myId].y; me.pose = null;
    fishing = null;
    if (first) {
      $('log').innerHTML = '';
      d.chatLog.forEach(addLog);
      $('join').classList.add('hidden');
      if (document.activeElement) document.activeElement.blur(); // 입장 후 바로 키보드로 조작할 수 있게
      ['top', 'side', 'chat', 'hotbarWrap'].forEach((id) => $(id).classList.remove('hidden'));
      mmSize();
      showToast('❓ 조작법 버튼을 눌러 방법을 확인해 보세요!');
      socket.emit('sel', { slot: sel });
    }
  });

  socket.on('me', (d) => {
    my = d;
    clockSkew = d.now - Date.now();
    $('coins').textContent = `💰 ${d.coins}`;
    const li = S.levelInfo(d.exp);
    myLv = li.lv;
    $('lvText').textContent = `Lv.${li.lv}`;
    $('lvBar').style.width = `${Math.floor((li.cur / li.need) * 100)}%`;
    $('lvBox').title = `경험치 ${li.cur} / ${li.need} (누르면 레벨 보상 보기)`;
    if (players[myId]) { players[myId].avatar = d.avatar; players[myId].lv = li.lv; }
    renderHotbar();
    updateQuestBadge();
    if (['bag', 'shop', 'quests', 'cook', 'col', 'trade', 'chest', 'level'].includes(modal)) renderModal();
  });
  socket.on('levelUp', ({ lv, unlocks }) => showReward({ title: `⬆️ 레벨 업! Lv.${lv}`, unlocks }));
  // 게시판
  let boardData = null, boardTab = 'posts';
  socket.on('board', (b) => { boardData = b; if (modal !== 'board') openModal('board'); else renderModal(); });

  socket.on('tiles', (list) => { if (world.ground) list.forEach(applyTile); });
  socket.on('playerJoined', addPlayer);
  socket.on('playerLeft', (id) => { delete players[id]; updateWho(); });
  socket.on('playerUpdate', ({ id, avatar, lv, mvp }) => {
    const p = players[id];
    if (!p) return;
    if (avatar) p.avatar = avatar;
    if (lv) p.lv = lv;
    if (mvp !== undefined) p.mvp = mvp;
    updateWho();
  });
  socket.on('held', ({ id, held }) => { if (players[id]) players[id].held = held; });
  socket.on('pose', ({ id, pose, x, y }) => {
    const p = players[id];
    if (!p) return;
    p.pose = pose;
    if (pose) { p.x = p.dx = x; p.y = p.dy = y; }
    if (id === myId) { me.pose = pose; if (pose) { me.x = x; me.y = y; me.dir = 'down'; } }
  });
  socket.on('playerFx', ({ id, fishing: f }) => {
    if (players[id]) players[id].fishing = f;
    if (id === myId) fishing = f ? { x: f.x, y: f.y, bite: false } : null;
  });
  socket.on('state', (list) => {
    for (const [id, x, y, dir, moving] of list) {
      const p = players[id];
      if (!p || id === myId) continue;
      p.x = x; p.y = y; p.dir = dir; p.moving = !!moving;
    }
  });
  socket.on('animals', syncAnimals);
  socket.on('arrow', (a) => arrows.push(Object.assign(a, { t: performance.now() })));
  socket.on('fx', (f) => fxs.push(Object.assign(f, { t: performance.now() })));
  socket.on('chat', (m) => {
    addLog(m);
    if (m.id && m.id !== myId) notifyUnread();
    if (m.id && players[m.id]) {
      players[m.id].bubble = { text: m.text, until: performance.now() + BUBBLE_MS };
      players[m.id].typing = false;
    }
  });
  socket.on('typing', ({ id, on }) => { if (players[id]) players[id].typing = on; });
  socket.on('toast', (t) => showToast(t));
  socket.on('reward', showReward);
  socket.on('colNew', ({ key, name }) => showToast(`📖 도감 등록! ${name}`, key.startsWith('hunt:') ? null : key));
  socket.on('buff', ({ ms }) => { buffUntil = performance.now() + ms; });
  socket.on('editSign', ({ x, y }) => setTimeout(() => openModal('sign', { x, y }), 120));
  socket.on('fishBite', () => { if (fishing) fishing.bite = true; });
  socket.on('fishResult', (r) => { fishing = null; showToast(r.text, r.item); });

  // 상자
  let chest = null;
  socket.on('chest', (c) => {
    chest = c;
    if (!c) { if (modal === 'chest') closeModal(); return; }
    if (modal !== 'chest') openModal('chest'); else renderModal();
  });

  // 거래
  let trade = null, tradeAskFrom = null;
  socket.on('tradeAsk', ({ from, name }) => {
    tradeAskFrom = from;
    $('tradeAskText').textContent = `🤝 ${name} 님이 거래를 신청했어요!`;
    $('tradeAsk').classList.remove('hidden');
    clearTimeout($('tradeAsk')._t);
    $('tradeAsk')._t = setTimeout(() => $('tradeAsk').classList.add('hidden'), 30000);
  });
  const answerTrade = (ok) => { if (tradeAskFrom) socket.emit('tradeAnswer', { from: tradeAskFrom, ok }); tradeAskFrom = null; $('tradeAsk').classList.add('hidden'); };
  $('tradeYes').addEventListener('click', () => answerTrade(true));
  $('tradeNo').addEventListener('click', () => answerTrade(false));
  socket.on('trade', (t) => {
    trade = t;
    if (modal !== 'trade') openModal('trade'); else renderModal();
  });
  socket.on('tradeEnd', ({ msg }) => {
    trade = null;
    if (modal === 'trade') closeModal();
    if (msg) showToast(msg);
  });

  // ───────── 입장 ─────────
  const nameInput = $('nameInput');
  try { nameInput.value = localStorage.getItem('hideout.name') || ''; } catch (_) {}
  nameInput.focus();
  $('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    try { localStorage.setItem('hideout.name', name); } catch (_) {}
    $('joinMsg').textContent = '';
    joinInfo = { name, code: $('codeInput').value };
    socket.emit('join', joinInfo);
  });

  // ───────── 채팅 ─────────
  const log = $('log');
  const chatInput = $('chatInput');
  function addLog(m) {
    const time = new Date(m.t || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const div = m.system
      ? el('div', { class: 'sys' }, m.text)
      : el('div', {}, el('span', { class: 'nm', style: `color:${D.shade(m.color || '#ff8fab', -0.4)}` }, m.name + ': '), m.text);
    div.append(el('span', { class: 'tm' }, time));
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 10;
    log.append(div);
    if (atBottom) log.scrollTop = log.scrollHeight;
  }
  let typingSent = false;
  const setTyping = (on) => { if (on !== typingSent) { typingSent = on; socket.emit('typing', on); } };
  chatInput.addEventListener('input', () => setTyping(chatInput.value.trim().length > 0));
  chatInput.addEventListener('blur', () => setTyping(false));
  chatInput.addEventListener('focus', () => keys.clear());
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') chatInput.blur(); e.stopPropagation(); });
  $('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) socket.emit('chat', text);
    chatInput.value = '';
    setTyping(false);
    chatInput.blur();
  });

  function updateWho() {
    const list = Object.entries(players);
    $('who').querySelector('b').textContent = `접속 중 ${list.length}명`;
    const ul = $('who').querySelector('ul');
    ul.innerHTML = '';
    list.forEach(([id, p]) => {
      const li = el('li', {}, el('span', { class: 'dot' }), el('span', { class: 'grow' }, p.name + (id === myId ? ' (나)' : '')),
        id !== myId ? el('button', { class: 'mini', title: '거래 신청', onclick: () => socket.emit('tradeReq', { to: id }) }, '🤝') : null);
      li.style.setProperty('--c', S.CLOTH[p.avatar ? p.avatar.tc : 0]);
      ul.append(li);
    });
  }

  // ───────── 단축바 ─────────
  let nameTimer = null;
  function renderHotbar() {
    const hb = $('hotbar');
    hb.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const it = my && my.inv[i];
      hb.append(el('div', { class: 'slot' + (i === sel ? ' sel' : ''), title: it ? itemName(it.id) : '', onclick: () => selectSlot(i) },
        el('span', { class: 'k' }, i + 1), it ? iconImg(it.id) : null, it && it.n > 1 ? el('span', { class: 'n' }, it.n) : null));
    }
  }
  function selectSlot(i) {
    sel = (i + 9) % 9;
    renderHotbar();
    socket.emit('sel', { slot: sel });
    const it = my && my.inv[sel];
    const box = $('itemName');
    const rotTip = it && S.ITEMS[it.id].obj && S.canRotate(S.ITEMS[it.id].obj) ? ` (R = 방향 돌리기, 지금: ${S.ROT_NAMES[placeRot]})` : '';
    box.textContent = it ? `${itemName(it.id)} — ${S.ITEMS[it.id].desc || ''}${rotTip}` : '빈 손 (Space = 상호작용)';
    box.style.opacity = 1;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { box.style.opacity = 0; }, 2400);
  }

  // ───────── 행동 ─────────
  function doUse() {
    if (!my) return;
    if (fishing) { socket.emit('fishReel'); return; }
    const it = my.inv[sel];
    if (!it) { doInteract(); return; }
    const def = S.ITEMS[it.id];
    if (def.tool === 'rod') {
      if (world.g(target.x, target.y) !== 'water') { showToast('물을 바라보고 던져요 🎣'); return; }
      socket.emit('fishCast', { x: target.x, y: target.y, slot: sel });
      return;
    }
    if (def.tool === 'bow') {
      let ax, ay;
      if (mouse.in && performance.now() - mouse.t < 4000) {
        ax = mouse.sx * dpr / Sc + cam.x - me.x; ay = mouse.sy * dpr / Sc + cam.y - (me.y - 8);
        me.dir = Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? 'left' : 'right') : (ay < 0 ? 'up' : 'down');
      } else [ax, ay] = DIRV[me.dir];
      socket.emit('shoot', { ax, ay });
      return;
    }
    const an = animalAt(target.x, target.y);
    if (an && isMyPet(an) && !S.FEED.includes(it.id)) { openModal('pet', an.id); return; }
    socket.emit('act', { type: 'use', slot: sel, x: target.x, y: target.y, r: def.obj && S.canRotate(def.obj) ? placeRot : 0 });
  }
  // R: 가구를 들고 있으면 놓을 방향 돌리기, 아니면 바라보는 가구 돌리기
  function doRotate() {
    if (!my) return;
    const it = my.inv[sel], def = it && S.ITEMS[it.id];
    if (def && def.obj && S.canRotate(def.obj)) {
      placeRot = (placeRot + 1) % 4;
      showToast(`↻ 놓을 방향: ${S.ROT_NAMES[placeRot]}`, it.id);
      return;
    }
    const o = world.o(target.x, target.y);
    if (o && S.canRotate(o.t)) socket.emit('rotate', { x: target.x, y: target.y });
    else showToast('가구를 들거나, 놓아둔 가구를 바라보고 R을 눌러요');
  }
  function doInteract() {
    const an = animalAt(target.x, target.y);
    if (an) {
      if (isMyPet(an)) return openModal('pet', an.id);
      socket.emit('act', { type: 'interact', x: target.x, y: target.y });
      return;
    }
    const o = world.o(target.x, target.y);
    if (!o) return;
    const od = S.OBJ[o.t] || {};
    if (o.t === 'shop') return openModal('shop');
    if (o.t === 'board') return openModal('quests');
    if (o.t === 'sign') return openModal('sign', { x: target.x, y: target.y });
    if (od.cook || (o.top && S.OBJ[o.top].cook)) return openModal('cook');
    socket.emit('act', { type: 'interact', x: target.x, y: target.y });
  }
  function doBreak() {
    if (fishing) return;
    socket.emit('act', { type: 'break', x: target.x, y: target.y });
  }

  // ───────── 키보드 / 마우스 ─────────
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const MODAL_KEYS = { KeyI: 'bag', KeyB: 'bag', KeyC: 'avatar', KeyQ: 'quests', KeyK: 'col' };
  addEventListener('keydown', (e) => {
    if (!myId || document.activeElement === chatInput) return;
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!$('reward').classList.contains('hidden')) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.code === 'Space') { e.preventDefault(); rewardQueue.shift(); renderReward(); }
      return;
    }
    if (modal) {
      if (e.key === 'Escape') closeModal();
      else if (!typing && MODAL_KEYS[e.code] === modal) closeModal();
      return;
    }
    if (typing) return;
    if (e.key === 'Enter') { e.preventDefault(); keys.clear(); chatInput.focus(); return; }
    if (e.key === 'Escape') { if (fishing) socket.emit('fishCancel'); return; }
    if (/^Digit[1-9]$/.test(e.code)) { selectSlot(+e.code.slice(5) - 1); return; }
    if (MODAL_KEYS[e.code]) { openModal(MODAL_KEYS[e.code]); return; }
    if (e.code === 'KeyM') { $('mmWrap').classList.toggle('hidden'); return; }
    if (['Space', 'KeyE', 'KeyF', 'KeyX', 'KeyR'].includes(e.code)) target = computeTarget();
    if (e.code === 'KeyR') { if (!e.repeat) doRotate(); return; }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) doUse(); return; }
    if (e.code === 'KeyE' || e.code === 'KeyF') { if (!e.repeat) doInteract(); return; }
    if (e.code === 'KeyX') { if (!e.repeat) doBreak(); return; }
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => { mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.in = true; mouse.t = performance.now(); });
  canvas.addEventListener('mouseleave', () => { mouse.in = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // ───────── 📱 터치 조작: 조이스틱 + 버튼 + 화면 톡(겨누기) ─────────
  let chatUnread = 0;
  const joy = { id: null, x: 0, y: 0 };
  {
    const base = $('joy'), knob = $('joyKnob');
    const R = 44;
    const move = (e) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      joy.x = dx / R; joy.y = dy / R;
    };
    const end = (e) => {
      if (e.pointerId !== joy.id) return;
      joy.id = null; joy.x = joy.y = 0; knob.style.transform = '';
    };
    base.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.id = e.pointerId; base.setPointerCapture(e.pointerId); move(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) move(e); });
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!my) return;
      if (!$('reward').classList.contains('hidden')) { rewardQueue.shift(); renderReward(); return; }
      if (modal) return;
      target = computeTarget();
      fn();
    });
    tap('bUse', () => doUse());
    tap('bE', () => doInteract());
    tap('bX', () => doBreak());
    tap('bR', () => doRotate());
    $('bChat').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const open = document.body.classList.toggle('chatOpen');
      if (open) { chatUnread = 0; $('bChatN').style.display = 'none'; const l = $('log'); l.scrollTop = l.scrollHeight; }
      else chatInput.blur();
    });
    // 화면을 톡: 그 칸을 겨눠요 (손이 닿는 칸이면 하얀 네모가 옮겨가요)
    canvas.addEventListener('touchstart', (e) => {
      if (!my || modal) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      mouse.sx = t.clientX; mouse.sy = t.clientY; mouse.in = true; mouse.t = performance.now() + 6000;
      target = computeTarget();
    }, { passive: false });
    $('who').querySelector('b').addEventListener('click', () => $('who').classList.toggle('open'));
  }

  canvas.addEventListener('mousedown', (e) => {
    if (!my || modal) return;
    mouse.sx = e.clientX; mouse.sy = e.clientY; mouse.in = true; mouse.t = performance.now();
    target = computeTarget();
    if (e.button === 0) doUse();
    else if (e.button === 2) doBreak();
  });
  canvas.addEventListener('wheel', (e) => { if (my && !modal) selectSlot(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const n = b.dataset.open;
    if (modal === n) closeModal(); else openModal(n);
    b.blur();
  }));

  function computeTarget() {
    const cx = me.x, cy = me.y - 6;
    if (mouse.in && performance.now() - mouse.t < 4000) {
      const wx = mouse.sx * dpr / Sc + cam.x, wy = mouse.sy * dpr / Sc + cam.y;
      const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
      if (Math.hypot(tx * TILE + 8 - cx, ty * TILE + 8 - cy) <= S.REACH) return { x: tx, y: ty };
    }
    const fx = Math.floor(me.x / TILE), fy = Math.floor((me.y - 4) / TILE);
    const d = DIRV[me.dir];
    return { x: fx + d[0], y: fy + d[1] };
  }

  // ───────── 창 ─────────
  let modal = null, modalArg = null;
  let bagTab = 'inv', pick = null, shopTab = 'farm', questTab = 'c', avDraft = null, avTimer = null;
  function openModal(name, arg) {
    if (!my) return;
    if (modal === 'trade' && name !== 'trade' && trade) return showToast('거래 중이에요! 먼저 거래를 끝내주세요');
    if (name === 'board' && modal !== 'board') {
      socket.emit('boardOpen');
      let seen = '';
      try { seen = localStorage.getItem('alpdf.notice') || ''; } catch (_) {}
      boardTab = seen !== S.UPDATES[0].v ? 'news' : boardTab;
    }
    modal = name; modalArg = arg || null;
    keys.clear();
    pick = null; avDraft = null;
    $('modal').classList.remove('hidden');
    renderModal();
  }
  function closeModal() {
    if (modal === 'trade' && trade) socket.emit('tradeCancel');
    if (modal === 'chest') { socket.emit('chestClose'); chest = null; }
    if (modal === 'board') socket.emit('boardClose');
    modal = null;
    clearInterval(avTimer); avTimer = null; avDraft = null;
    $('modal').classList.add('hidden');
    document.activeElement && document.activeElement.blur();
  }
  $('modalClose').addEventListener('click', closeModal);
  $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal') && modal !== 'trade') closeModal(); });

  function renderModal() {
    if (!modal) return;
    const body = $('modalBody');
    const scroll = body.scrollTop;
    body.innerHTML = '';
    ({ bag: renderBag, shop: renderShop, quests: renderQuests, avatar: renderAvatar, sign: renderSign, help: renderHelp,
      cook: renderCook, col: renderCol, pet: renderPet, trade: renderTrade, chest: renderChest, board: renderBoard, level: renderLevel })[modal](body);
    body.scrollTop = scroll;
  }
  const tabs = (cur, list, onPick) => el('div', { class: 'tabs' },
    list.map(([id, label]) => el('button', { class: 'btn' + (cur === id ? ' on' : ''), onclick: () => { onPick(id); renderModal(); } }, label)));
  const qoTag = (id) => (S.ITEMS[id] && S.ITEMS[id].questOnly ? el('span', { class: 'tag' }, '✨퀘스트 전용') : null);

  function renderBag(body) {
    $('modalTitle').textContent = '🎒 가방';
    body.append(tabs(bagTab, [['inv', '🎒 가방'], ['craft', '🔨 만들기']], (t) => { bagTab = t; pick = null; }));
    if (bagTab === 'inv') {
      const grid = el('div', { class: 'grid' });
      my.inv.forEach((it, i) => {
        grid.append(el('div', {
          class: 'slot' + (i < 9 ? ' hb' : '') + (pick === i ? ' pick' : '') + (i === sel ? ' sel' : '') + (it && S.ITEMS[it.id].questOnly ? ' qo' : ''),
          title: it ? itemName(it.id) : '',
          onclick: () => {
            if (pick === null) { if (it) pick = i; }
            else { if (pick !== i) socket.emit('swap', { a: pick, b: i }); pick = null; }
            renderModal();
          },
        }, i < 9 ? el('span', { class: 'k' }, i + 1) : null, it ? iconImg(it.id) : null, it && it.n > 1 ? el('span', { class: 'n' }, it.n) : null));
      });
      body.append(grid);
      const it = pick !== null && my.inv[pick];
      body.append(it
        ? el('div', { class: 'info' }, iconImg(it.id),
          el('div', { class: 'grow' }, el('b', {}, `${itemName(it.id)} ×${it.n}`), ' ', qoTag(it.id), el('br'), S.ITEMS[it.id].desc || '', el('br'), el('small', { style: 'opacity:.6' }, '옮길 칸을 누르세요')),
          el('button', { class: 'btn', onclick: () => { if (confirm(`${itemName(it.id)} ×${it.n}, 버릴까요?`)) { socket.emit('trash', { slot: pick }); pick = null; } } }, '🗑️ 버리기'))
        : el('div', { class: 'info' }, '💡 칸을 누르고 다른 칸을 누르면 자리가 바뀌어요. 윗줄 9칸이 단축바(1~9)예요.'));
    } else {
      const rows = el('div', { class: 'rows' });
      S.RECIPES.forEach((r, i) => {
        const ok = Object.entries(r.need).every(([id, n]) => S.countItem(my.inv, id) >= n);
        const need = Object.entries(r.need).map(([id, n]) => `${itemName(id)} ${n}개 (보유 ${S.countItem(my.inv, id)})`).join(' + ');
        const full = ok && !fits({ [r.out]: r.n }, r.need);
        const locked = (r.lv || 1) > myLv;
        rows.append(el('div', { class: 'row' + (locked ? ' dim' : '') }, iconImg(r.out),
          el('div', { class: 'grow' }, `${itemName(r.out)} ×${r.n}`, el('small', {}, locked ? `🔒 레벨 ${r.lv}부터 만들 수 있어요` : full ? '🎒 가방이 꽉 찼어요 — 가방을 비워야 만들 수 있어요' : need)),
          el('button', { class: 'btn pink', disabled: !ok || full || locked, onclick: () => socket.emit('craft', { i }) }, locked ? `🔒 Lv.${r.lv}` : full ? '가방 부족' : '만들기')));
      });
      body.append(el('p', { class: 'note' }, '🌲 나무는 숲에서, ⛏ 돌·철광석은 동굴에서 X로 모아요.'), rows);
    }
  }

  function renderShop(body) {
    $('modalTitle').textContent = '🐱 모모네 상점';
    body.append(el('p', { class: 'note' }, `어서오라냥! 지금 가진 돈: 💰 ${my.coins}  ·  ✨퀘스트 전용 아이템은 여기서 못 사요`));
    body.append(tabs(shopTab, S.SHOP_TABS.map(([id, label]) => [id, label]).concat([['acc', '🎀 꾸미기'], ['sell', '💰 팔기']]), (t) => { shopTab = t; }));
    const rows = el('div', { class: 'rows' });
    const tab = S.SHOP_TABS.find((t) => t[0] === shopTab);
    if (tab) {
      tab[2].forEach(([id, price, lv]) => {
        const stack1 = S.ITEMS[id].stack === 1;
        const locked = (lv || 1) > myLv;
        rows.append(el('div', { class: 'row' + (locked ? ' dim' : '') }, iconImg(id),
          el('div', { class: 'grow' }, `${itemName(id)} · 💰${price}`, locked ? el('span', { class: 'tag soft' }, `🔒 Lv.${lv}`) : null, el('small', {}, S.ITEMS[id].desc || '')),
          locked ? el('button', { class: 'btn', disabled: true }, `🔒 Lv.${lv}`)
            : (stack1 ? [1] : [1, 5]).map((n) => el('button', { class: 'btn', disabled: my.coins < price * n, onclick: () => socket.emit('buy', { id, n }) }, `×${n}`))));
      });
    } else if (shopTab === 'sell') {
      const ids = [...new Set(my.inv.filter((it) => it && S.ITEMS[it.id].sell).map((it) => it.id))];
      if (!ids.length) rows.append(el('div', { class: 'row' }, '팔 수 있는 물건이 없어요. 물고기를 낚거나 작물을 키워 보세요!'));
      ids.forEach((id) => {
        const n = S.countItem(my.inv, id), price = S.ITEMS[id].sell;
        rows.append(el('div', { class: 'row' }, iconImg(id),
          el('div', { class: 'grow' }, `${itemName(id)} ×${n}`, el('small', {}, `개당 💰${price}`)),
          el('button', { class: 'btn', onclick: () => socket.emit('sell', { id }) }, '1개'),
          el('button', { class: 'btn pink', onclick: () => socket.emit('sell', { id, all: true }) }, `전부 +${price * n}`)));
      });
    } else {
      const slotName = { acc: '머리', top: '옷', back: '등' };
      Object.values(S.COSMETICS).filter((c) => S.isLocked(c)).sort((a, b) => (a.quest ? 1 : 0) - (b.quest ? 1 : 0)).forEach((c) => {
        const owned = my.unlocked.includes(c.id);
        const av = Object.assign({}, my.avatar);
        av[c.slot] = c.slot === 'top' ? S.TOPS.findIndex((t) => t.id === c.id) : c.id;
        const locked = !owned && (c.lv || 1) > myLv;
        const how = owned ? '보유 중 ✓' : c.price ? `💰${c.price}${locked ? ` · 🔒 레벨 ${c.lv}부터` : ''}` : `✨ ${S.COSMETIC_SRC[c.id] || '퀘스트 보상'} (돈으로 못 사요)`;
        rows.append(el('div', { class: 'row' + (c.quest ? ' qrow' : '') + (locked ? ' dim' : '') }, avatarThumb(av),
          el('div', { class: 'grow' }, `${c.name} `, el('span', { class: 'tag soft' }, slotName[c.slot]), el('small', {}, how)),
          c.price && !owned ? el('button', { class: 'btn pink', disabled: locked || my.coins < c.price, onclick: () => socket.emit('buyAcc', { id: c.id }) }, locked ? `🔒 Lv.${c.lv}` : '사기') : null));
      });
    }
    body.append(rows);
  }

  function avatarThumb(av, size) {
    const s = size || 40;
    const c = el('canvas', { width: 26, height: 26, style: `width:${s}px;height:${s}px;image-rendering:pixelated;background:#8fd16f;border:2px solid #4a3b5c;flex:none` });
    D.drawChar(c.getContext('2d'), 13, 25, av, 'down', -1);
    return c;
  }

  function rewardText(rw) {
    const out = [];
    if (rw.coins) out.push(`💰${rw.coins}`);
    if (rw.exp) out.push(`⭐${rw.exp}`);
    if (rw.items) for (const [id, n] of Object.entries(rw.items)) out.push(`${itemName(id)} ×${n}${S.ITEMS[id] && S.ITEMS[id].questOnly ? '✨' : ''}`);
    if (rw.unlock) out.push(`${S.COSMETICS[rw.unlock].name}✨ (꾸미기)`);
    return '🎁 ' + out.join(', ');
  }
  function timeLeft(t) {
    const ms = Math.max(0, my.ends[t] - (Date.now() + clockSkew));
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m}분` : `${m}분`;
  }
  const pqReady = (q) => !q.done && (my.stats[q.stat] || 0) - q.base >= q.goal;
  // 보상 받기 버튼: 가방에 다 안 들어가면 막고 알려줘요
  const fits = (items, remove) => S.canFit(my.inv, items || {}, remove);
  function claimBtn(items, onclick) {
    if (fits(items)) return el('button', { class: 'btn pink', onclick }, '보상 받기');
    return el('div', { class: 'fullbox' }, el('button', { class: 'btn', disabled: true }, '🎒 가방 부족'), el('small', {}, '가방을 비워야 받을 수 있어요'));
  }
  // 📮 우편함 (못 받은 보상, 금주의 MVP 상품)
  function mailRows() {
    if (!my.mail || !my.mail.length) return null;
    return el('div', { class: 'rows', style: 'margin-bottom:10px' }, my.mail.map((m, i) => el('div', { class: 'row ready' },
      el('div', { class: 'grow' }, el('b', {}, m.title),
        el('div', { class: 'pick-row', style: 'margin-top:4px' },
          m.coins ? el('span', {}, `💰${m.coins}`) : null, m.exp ? el('span', {}, `⭐${m.exp}`) : null,
          Object.entries(m.items || {}).map(([id, n]) => el('span', { class: 'pick-row', title: itemName(id) }, iconImg(id), `${itemName(id)} ×${n}`)))),
      claimBtn(m.items, () => socket.emit('claimMail', { i })))));
  }
  // 퀘스트 알림 숫자: 퀘스트 창에서 받을 수 있는 것만 (도감 보상은 도감 버튼에 따로)
  function questReadyCount() {
    if (!my) return 0;
    let n = S.QUESTS.filter((q) => !my.claimed.includes(q.id) && (my.stats[q.stat] || 0) >= q.goal).length;
    for (const t of ['c', 'd', 'w', 'm']) if (my.pq[t]) n += my.pq[t].list.filter(pqReady).length;
    n += (my.mail || []).length;
    return n;
  }
  function updateQuestBadge() {
    const n = questReadyCount();
    $('qBadge').textContent = n || '';
    $('qBadge').style.display = n ? 'inline-block' : 'none';
    const c = my ? S.COLLECTIONS.filter((x) => !my.colClaimed.includes(x.id) && x.entries.every((e) => my.col[e])).length : 0;
    $('cBadge').textContent = c || '';
    $('cBadge').style.display = c ? 'inline-block' : 'none';
    let seen = '';
    try { seen = localStorage.getItem('alpdf.notice') || ''; } catch (_) {}
    $('bBadge').style.display = seen !== S.UPDATES[0].v ? 'inline-block' : 'none';
  }
  function renderQuests(body) {
    $('modalTitle').textContent = '📜 퀘스트';
    const cnt = (t) => (my.pq[t] ? my.pq[t].list.filter(pqReady).length : 0);
    const badge = (n) => (n ? ` 🔴${n}` : '');
    const aCnt = S.QUESTS.filter((q) => !my.claimed.includes(q.id) && (my.stats[q.stat] || 0) >= q.goal).length;
    const rr = mailRows();
    if (rr) body.append(el('b', { style: 'display:block;margin-bottom:6px' }, '📮 우편함'), rr);
    body.append(tabs(questTab, [['c', '⬆️ 레벨' + badge(cnt('c'))], ['d', '📅 일간' + badge(cnt('d'))], ['w', '🗓️ 주간' + badge(cnt('w'))], ['m', '🌙 월간' + badge(cnt('m'))], ['a', '🏆 업적' + badge(aCnt)]], (t) => { questTab = t; }));
    const rows = el('div', { class: 'rows' });
    if (questTab !== 'a') {
      const t = questTab;
      const resetTxt = { d: '매일 밤 12시', w: '일요일 밤 12시', m: '다음 달 1일 0시' }[t];
      body.append(t === 'c'
        ? el('div', { class: 'qhead' }, el('b', {}, `⬆️ 레벨 퀘스트 ${my.dlv + 1}단계`),
          el('small', {}, '깰 때마다 단계가 올라 그 자리에 더 어려운 퀘스트가 나와요. 초기화되지 않아요. 3단계마다 아이템 보상!'))
        : el('div', { class: 'qhead' },
          el('span', {}, `⏰ 초기화까지 ${timeLeft(t)} (${resetTxt}, 한국 시간)`),
          el('small', {}, t === 'd' ? '하루 3개! 깨도 어려워지지 않아요. 못 깬 건 자정에 새 퀘스트로 바뀌어요.' : t === 'w' ? '보상: 코인 + 경험치 + 가끔 ✨퀘스트 전용 가구' : '보상: 코인 + 경험치 + ✨퀘스트 전용 꾸미기·가구')));
      (my.pq[t] ? my.pq[t].list : []).forEach((q) => {
        const v = Math.min(q.goal, Math.max(0, (my.stats[q.stat] || 0) - q.base)), ready = pqReady(q);
        rows.append(el('div', { class: 'row q' + (q.done ? ' done' : '') + (ready ? ' ready' : '') },
          el('div', { class: 'grow' }, el('b', {}, t === 'c' ? `${q.lv + 1}단계 ` : ''), q.desc,
            el('div', { class: 'bar' }, el('i', { style: `width:${(v / q.goal) * 100}%` })),
            el('small', {}, `${v} / ${q.goal}   ${rewardText(q.reward)}`)),
          ready ? claimBtn(q.reward.items, () => socket.emit('claimP', { type: t, id: q.id }))
            : q.done ? el('span', {}, '✅') : null));
      });
    } else {
      const state = (q) => (my.claimed.includes(q.id) ? 2 : (my.stats[q.stat] || 0) >= q.goal ? 0 : 1);
      [...S.QUESTS].sort((a, b) => state(a) - state(b)).forEach((q) => {
        const v = Math.min(q.goal, my.stats[q.stat] || 0), st = state(q);
        rows.append(el('div', { class: 'row q' + (st === 2 ? ' done' : '') + (st === 0 ? ' ready' : '') },
          el('div', { class: 'grow' }, el('b', {}, q.name), ` — ${q.desc}`,
            el('div', { class: 'bar' }, el('i', { style: `width:${(v / q.goal) * 100}%` })),
            el('small', {}, `${v} / ${q.goal}   ${rewardText(q.reward)}`)),
          st === 0 ? claimBtn(q.reward.items, () => socket.emit('claim', { id: q.id }))
            : st === 2 ? el('span', {}, '✅') : null));
      });
    }
    body.append(rows);
  }

  function renderCol(body) {
    $('modalTitle').textContent = '📖 도감';
    const total = S.COLLECTIONS.reduce((s, c) => s + c.entries.length, 0);
    body.append(el('p', { class: 'note' }, `처음 얻은 것은 도감에 등록돼요. 한 도감을 다 채우면 ✨특별 보상! (전체 ${Object.keys(my.col).filter((k) => S.COL_INDEX[k]).length} / ${total})`));
    const rows = el('div', { class: 'rows' });
    S.COLLECTIONS.forEach((c) => {
      const got = c.entries.filter((e) => my.col[e]).length, done = got === c.entries.length, claimed = my.colClaimed.includes(c.id);
      const cells = el('div', { class: 'colgrid' }, c.entries.map((e) => {
        const has = !!my.col[e];
        const icon = e.startsWith('hunt:') ? huntIcon(e.slice(5)) : iconImg(e);
        if (!has) icon.classList.add('unknown');
        return el('div', { class: 'colcell' + (has ? '' : ' no'), title: has ? `${S.colName(e)} (${my.col[e]}번)` : '???' }, icon, el('small', {}, has ? S.colName(e) : '???'));
      }));
      rows.append(el('div', { class: 'row col' + (claimed ? ' done' : '') },
        el('div', { class: 'grow' }, el('b', {}, `${c.name}  ${got} / ${c.entries.length}`), cells, el('small', {}, rewardText(c.reward))),
        done && !claimed ? claimBtn(c.reward.items, () => socket.emit('claimCol', { id: c.id })) : claimed ? el('span', {}, '✅') : null));
    });
    body.append(rows);
  }
  function huntIcon(kind) {
    const c = el('canvas', { width: 24, height: 24, class: 'ic' });
    D.drawAnimal(c.getContext('2d'), 12, 22, kind, 'right', -1, 0);
    return c;
  }

  function renderCook(body) {
    $('modalTitle').textContent = '🍳 요리하기';
    body.append(el('p', { class: 'note' }, '요리를 들고 Space로 먹으면 30초 동안 빨라져요 💨  상점에 팔면 재료보다 비싸요!'));
    const rows = el('div', { class: 'rows' });
    S.COOK.forEach((r, i) => {
      const ok = Object.entries(r.need).every(([id, n]) => S.countItem(my.inv, id) >= n);
      const need = Object.entries(r.need).map(([id, n]) => `${itemName(id)} ${n} (${S.countItem(my.inv, id)})`).join(' + ');
      const full = ok && !fits({ [r.out]: 1 }, r.need);
      const locked = (r.lv || 1) > myLv;
      rows.append(el('div', { class: 'row' + (ok && !locked ? '' : ' dim') }, iconImg(r.out),
        el('div', { class: 'grow' }, `${itemName(r.out)} · 팔면 💰${S.ITEMS[r.out].sell}`, my.col[r.out] ? null : el('span', { class: 'tag' }, 'NEW'),
          el('small', {}, locked ? `🔒 레벨 ${r.lv}부터 만들 수 있어요 (${need})` : full ? '🎒 가방이 꽉 찼어요 — 가방을 비워야 요리할 수 있어요' : need)),
        el('button', { class: 'btn pink', disabled: !ok || full || locked, onclick: () => socket.emit('cook', { i }) }, locked ? `🔒 Lv.${r.lv}` : full ? '가방 부족' : '요리'),
        el('button', { class: 'btn', disabled: !ok || full || locked, onclick: () => socket.emit('cook', { i, n: 5 }) }, '×5')));
    });
    body.append(rows);
  }

  // 📌 마을 게시판: 업데이트 소식 / 건의함 / 금주의 MVP
  function renderBoard(body) {
    $('modalTitle').textContent = '📌 마을 게시판';
    if (!boardData) { socket.emit('boardOpen'); body.append(el('p', {}, '불러오는 중...')); return; }
    if (boardTab === 'news') { try { localStorage.setItem('alpdf.notice', S.UPDATES[0].v); } catch (_) {} updateQuestBadge(); }
    body.append(tabs(boardTab, [['news', '📢 업데이트 소식'], ['posts', '📝 건의함'], ['mvp', '🏅 금주의 MVP']], (t) => { boardTab = t; }));
    const ago = (t) => { const m = Math.floor((Date.now() + clockSkew - t) / 6e4); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : `${Math.floor(m / 1440)}일 전`; };
    if (boardTab === 'news') {
      body.append(el('div', { class: 'rows' }, S.UPDATES.map((u, i) => el('div', { class: 'row news' + (i === 0 ? ' ready' : '') },
        el('div', { class: 'grow' }, el('b', {}, `${i === 0 ? '🆕 ' : ''}${u.title}`), el('small', {}, u.date),
          el('ul', { class: 'newslist' }, u.items.map((t) => el('li', {}, t))))))));
    } else if (boardTab === 'posts') {
      const ta = el('textarea', { rows: 2, maxlength: 150, placeholder: '이런 기능이 있으면 좋겠어요! (150자)' });
      body.append(el('div', { class: 'postbox' }, ta, el('button', { class: 'btn pink', onclick: () => { if (ta.value.trim()) socket.emit('boardPost', { text: ta.value }); } }, '✍️ 올리기')));
      const rows = el('div', { class: 'rows', style: 'margin-top:10px' });
      if (!boardData.posts.length) rows.append(el('div', { class: 'row' }, '아직 글이 없어요. 원하는 업데이트를 처음으로 적어 보세요!'));
      boardData.posts.forEach((x) => rows.append(el('div', { class: 'row' },
        el('div', { class: 'grow' }, el('b', {}, x.name), el('span', { style: 'opacity:.5;font-size:11px;margin-left:6px' }, ago(x.t)), el('div', { class: 'posttext' }, x.text)),
        el('button', { class: 'btn' + (x.liked ? ' pink' : ''), onclick: () => socket.emit('boardLike', { id: x.id }) }, `👍 ${x.likes}`),
        x.mine ? el('button', { class: 'btn', onclick: () => { if (confirm('이 글을 지울까요?')) socket.emit('boardDel', { id: x.id }); } }, '🗑️') : null)));
      body.append(rows);
    } else {
      const leftMs = Math.max(0, boardData.ends - (Date.now() + clockSkew));
      const d = Math.floor(leftMs / 864e5), h = Math.floor(leftMs / 36e5) % 24;
      body.append(el('p', { class: 'note' }, `이번 주 순위예요. 일요일 0시에 결과가 정해져요 (남은 시간 ${d}일 ${h}시간). 1등 💰1000, 2등 💰500, 3등 💰300 + 경험치는 📮 우편함으로! 1등은 일주일 동안 이름 옆에 👑`));
      const medal = ['🥇', '🥈', '🥉', '4', '5'];
      body.append(el('div', { class: 'mvpgrid' }, S.MVP_CATS.map((c) => el('div', { class: 'mvpcard' },
        el('b', {}, c.name), el('small', {}, c.desc),
        el('ol', {}, (boardData.cur[c.id] || []).length ? boardData.cur[c.id].map((row, i) => el('li', {}, `${medal[i]} ${row.name} — ${row.v.toLocaleString()}${c.unit}`)) : [el('li', { style: 'opacity:.6' }, '아직 기록이 없어요')]),
        el('small', { style: 'opacity:.8' }, `내 기록: ${(boardData.me[c.id] || 0).toLocaleString()}${c.unit}`)))));
      if (boardData.last) {
        body.append(el('p', { style: 'margin:14px 0 6px;font-size:13px' }, el('b', {}, '👑 지난주 MVP')),
          el('div', { class: 'mvpgrid' }, S.MVP_CATS.map((c) => el('div', { class: 'mvpcard last' }, el('b', {}, c.name),
            el('ol', {}, (boardData.last.cats[c.id] || []).map((row, i) => el('li', {}, `${medal[i]} ${row.name} — ${row.v.toLocaleString()}${c.unit}`)))))));
      }
    }
  }

  // ⭐ 레벨 보상 (레벨마다 열리는 것)
  function renderLevel(body) {
    const li = S.levelInfo(my.exp);
    $('modalTitle').textContent = `⭐ 레벨 ${li.lv}`;
    body.append(el('p', { class: 'note' }, `다음 레벨까지 ${li.need - li.cur} 경험치! 수확·낚시·채집·요리·사냥·퀘스트로 경험치를 얻어요. 레벨이 오를수록 더 많이 필요해요.`),
      el('div', { class: 'bar', style: 'height:12px;margin-bottom:12px' }, el('i', { style: `width:${(li.cur / li.need) * 100}%;background:#ffd34d` })));
    const rows = el('div', { class: 'rows' });
    for (let l = 2; l <= 20; l++) {
      const u = S.levelUnlocks(l);
      if (!u.length) continue;
      rows.append(el('div', { class: 'row' + (l <= li.lv ? ' done' : l === li.lv + 1 ? ' ready' : '') },
        el('b', { style: 'min-width:52px' }, `${l <= li.lv ? '✅' : '🔒'} Lv.${l}`),
        el('div', { class: 'grow pick-row' }, u.map((t) => el('span', { class: 'chip' }, t)))));
    }
    body.append(rows);
  }

  function renderPet(body) {
    const a = animals[modalArg];
    if (!a) { closeModal(); return; }
    $('modalTitle').textContent = `${petEmoji(a.kind)} ${a.pname}`;
    const nameIn = el('input', { class: 'txt', maxlength: 10, value: a.pname });
    const cmd = (c, extra) => { socket.emit('petCmd', Object.assign({ id: modalArg, cmd: c }, extra)); closeModal(); };
    body.append(el('div', { class: 'petbox' },
      el('div', { class: 'petpic' }, huntIcon(a.kind)),
      el('div', { class: 'grow' },
        el('p', { style: 'margin:0 0 8px' }, a.follow ? '🐾 지금 나를 따라다니고 있어요' : '🏠 지금 이 근처에서 지내고 있어요 (집)'),
        el('div', { class: 'pick-row' },
          el('button', { class: 'btn pink', onclick: () => cmd('follow') }, '🐾 따라와!'),
          el('button', { class: 'btn', onclick: () => cmd('stay') }, '🏠 여기서 지내'),
          el('button', { class: 'btn', onclick: () => cmd('pat') }, '💕 쓰다듬기')),
        el('div', { class: 'pick-row', style: 'margin-top:10px' }, nameIn,
          el('button', { class: 'btn', onclick: () => cmd('name', { name: nameIn.value }) }, '✏️ 이름 바꾸기')),
        el('div', { class: 'pick-row', style: 'margin-top:10px' },
          el('button', { class: 'btn', onclick: () => cmd('bag') }, '🎒 가방에 넣기')),
        el('small', { style: 'opacity:.6;display:block;margin-top:8px' }, '따라다니는 펫은 1마리예요. 다른 펫을 "따라와!" 하면 지금 펫은 그 자리에서 지내요. 집에 두려면 집 안에서 "여기서 지내". 가방에 넣어도 이름을 기억해요.'))));
  }
  const petEmoji = (kind) => ({ cat: '🐱', bunny: '🐰' })[S.ANIMALS[kind].look] || '🐶';

  function renderChest(body) {
    if (!chest) { closeModal(); return; }
    const { x, y } = chest;
    $('modalTitle').textContent = `📦 나무 상자${chest.owner ? ` (${chest.owner} 님)` : ''}${chest.locked ? ' 🔒' : ''}`;
    const cell = (it, i, from, extraCls) => el('div', {
      class: 'slot' + (extraCls || '') + (it && S.ITEMS[it.id] && S.ITEMS[it.id].questOnly ? ' qo' : ''),
      title: it ? `${itemName(it.id)} ×${it.n} — 누르면 ${from === 'inv' ? '상자에 넣어요' : '가방으로 꺼내요'}` : '',
      onclick: () => { if (it) socket.emit('chestMove', { x, y, from, slot: i }); },
    }, from === 'inv' && i < 9 ? el('span', { class: 'k' }, i + 1) : null, it ? iconImg(it.id) : null, it && it.n > 1 ? el('span', { class: 'n' }, it.n) : null);
    const used = chest.items.filter(Boolean).length;
    body.append(
      el('div', { class: 'chesthead' },
        el('b', {}, `📦 상자 (${used} / ${S.CHEST_SIZE}칸)`),
        el('span', { class: 'pick-row' },
          el('button', { class: 'btn', onclick: () => socket.emit('chestAll', { x, y, dir: 'out' }) }, '⬇️ 모두 꺼내기'),
          chest.mine ? el('button', { class: 'btn', onclick: () => socket.emit('chestLock', { x, y }) }, chest.locked ? '🔓 잠금 풀기' : '🔒 잠그기') : null)),
      el('div', { class: 'grid chestgrid' }, chest.items.map((it, i) => cell(it, i, 'chest'))),
      el('div', { class: 'chesthead', style: 'margin-top:14px' },
        el('b', {}, '🎒 내 가방'),
        el('button', { class: 'btn pink', onclick: () => socket.emit('chestAll', { x, y, dir: 'in' }) }, '⬆️ 모두 넣기 (단축바 빼고)')),
      el('div', { class: 'grid' }, my.inv.map((it, i) => cell(it, i, 'inv', i < 9 ? ' hb' : ''))),
      el('p', { class: 'note', style: 'margin-top:10px' },
        '💡 칸을 누르면 그 묶음이 통째로 옮겨져요. ',
        chest.mine ? '🔒 잠그면 나만 열 수 있어요.' : '이 상자는 다른 사람 거예요. ✨퀘스트 전용 아이템은 주인만 꺼낼 수 있어요.',
        ' 빈 상자는 X로 회수해요.'));
  }

  function renderTrade(body) {
    if (!trade) { closeModal(); return; }
    $('modalTitle').textContent = `🤝 ${trade.other} 님과 거래`;
    const mine = trade.mine, theirs = trade.theirs;
    const set = (items, coins) => socket.emit('tradeSet', { items, coins });
    const list = (o, editable) => {
      const box = el('div', { class: 'tlist' });
      const ent = Object.entries(o.items);
      if (!ent.length && !o.coins) box.append(el('small', { style: 'opacity:.6' }, '아직 없어요'));
      if (o.coins) box.append(el('div', { class: 'trow' }, el('span', { class: 'rw-coin' }, '💰'), el('span', { class: 'grow' }, `${o.coins} 코인`)));
      ent.forEach(([id, n]) => box.append(el('div', { class: 'trow' }, iconImg(id), el('span', { class: 'grow' }, `${itemName(id)} ×${n}`),
        editable ? el('button', { class: 'mini', onclick: () => { const it = Object.assign({}, o.items); if (--it[id] <= 0) delete it[id]; set(it, o.coins); } }, '−') : null)));
      return box;
    };
    const coinIn = el('input', { class: 'txt', type: 'number', min: 0, max: my.coins, value: mine.coins, style: 'width:90px' });
    const invIds = [...new Set(my.inv.filter((it) => it).map((it) => it.id))];
    const inv = el('div', { class: 'tinv' }, invIds.map((id) => {
      const have = S.countItem(my.inv, id), off = mine.items[id] || 0, okT = S.canTrade(id);
      return el('button', {
        class: 'tcell' + (okT ? '' : ' no'), disabled: !okT || off >= have, title: okT ? `${itemName(id)} (보유 ${have})` : '✨퀘스트 전용 아이템은 거래할 수 없어요',
        onclick: () => set(Object.assign({}, mine.items, { [id]: off + 1 }), mine.coins),
        oncontextmenu: (e) => { e.preventDefault(); set(Object.assign({}, mine.items, { [id]: have }), mine.coins); },
      }, iconImg(id), el('span', { class: 'n' }, have - off));
    }));
    body.append(
      el('div', { class: 'tcols' },
        el('div', { class: 'tcol' + (trade.myReady ? ' ok' : '') }, el('b', {}, `내가 줄 것 ${trade.myReady ? '✅' : ''}`), list(mine, true)),
        el('div', { class: 'tcol' + (trade.theirReady ? ' ok' : '') }, el('b', {}, `${trade.other} 님이 줄 것 ${trade.theirReady ? '✅' : ''}`), list(theirs, false))),
      el('p', { class: 'note' }, '아래 내 물건을 누르면 1개씩 올라가요 (오른쪽 클릭 = 전부). 무엇이든 바뀌면 확인이 풀려요.'),
      inv,
      el('div', { class: 'pick-row', style: 'margin-top:10px;justify-content:space-between' },
        el('span', { class: 'pick-row' }, '💰 코인 ', coinIn, el('button', { class: 'btn', onclick: () => set(mine.items, Math.max(0, Math.min(my.coins, coinIn.value | 0))) }, '올리기')),
        el('span', { class: 'pick-row' },
          el('button', { class: 'btn', onclick: () => { socket.emit('tradeCancel'); } }, '❌ 취소'),
          el('button', { class: 'btn pink', onclick: () => socket.emit('tradeReady', { on: !trade.myReady }) }, trade.myReady ? '확인 풀기' : '✅ 확인 (거래하기)'))),
      el('small', { style: 'opacity:.6;display:block;margin-top:6px' }, '둘 다 ✅ 확인을 누르면 바로 바꿔요.'));
  }

  function renderAvatar(body) {
    $('modalTitle').textContent = '👗 꾸미기';
    if (!avDraft) avDraft = Object.assign({ back: 'none' }, my.avatar);
    const prev = el('canvas', { width: 40, height: 50, id: 'avPrev' });
    const dirs = ['down', 'left', 'up', 'right'];
    let di = 0;
    const paint = () => {
      const c = $('avPrev');
      if (!c) return;
      const g = c.getContext('2d');
      g.clearRect(0, 0, 40, 50);
      D.drawChar(g, 20, 44, avDraft, dirs[di], -1);
    };
    clearInterval(avTimer);
    avTimer = setInterval(() => { di = (di + 1) % 4; paint(); }, 900);
    const setv = (k, v) => { avDraft[k] = v; renderModal(); };
    const sw = (k, colors) => el('div', { class: 'pick-row' }, colors.map((c, i) =>
      el('button', { class: 'sw' + (avDraft[k] === i ? ' on' : ''), style: `background:${c}`, onclick: () => setv(k, i) })));
    const chips = (k, list) => el('div', { class: 'pick-row' }, list.map((o, i) =>
      el('button', { class: 'chip' + (avDraft[k] === i ? ' on' : ''), onclick: () => setv(k, i) }, o.name)));
    const lockChips = (k, list, byIndex) => el('div', { class: 'pick-row' }, list.map((a, i) => {
      const owned = !S.isLocked(a) || my.unlocked.includes(a.id);
      const v = byIndex ? i : a.id;
      return el('button', {
        class: 'chip' + (avDraft[k] === v ? ' on' : '') + (a.quest ? ' q' : ''), disabled: !owned,
        title: owned ? '' : a.price ? `상점에서 💰${a.price}` : (S.COSMETIC_SRC[a.id] || '퀘스트 보상'), onclick: () => setv(k, v),
      }, (owned ? '' : '🔒') + a.name);
    }));
    const opt = (label, ctl) => el('div', { class: 'opt' }, el('span', {}, label), ctl);
    body.append(el('div', { class: 'av' },
      el('div', { style: 'display:grid;gap:8px;justify-items:center' }, prev,
        el('button', { class: 'btn pink', style: 'width:160px', onclick: () => { socket.emit('avatar', avDraft); closeModal(); } }, '💾 저장하기'),
        el('button', { class: 'btn', style: 'width:160px', onclick: () => { avDraft = Object.assign({ back: 'none' }, my.avatar); renderModal(); } }, '↩ 되돌리기'),
        el('small', { style: 'opacity:.6;text-align:center' }, '🔒 = 상점(🎀 꾸미기)에서 사거나\n퀘스트·도감 보상으로 얻어요')),
      el('div', {},
        opt('피부', sw('skin', S.SKINS)),
        opt('머리 모양', chips('hs', S.HAIR_STYLES)),
        opt('머리 색', sw('hc', S.HAIR_COLORS)),
        opt('눈', chips('eyes', S.EYES)),
        opt('볼터치', el('div', { class: 'pick-row' }, [['켜기', 1], ['끄기', 0]].map(([n, v]) =>
          el('button', { class: 'chip' + (avDraft.blush === v ? ' on' : ''), onclick: () => setv('blush', v) }, n)))),
        opt('옷', lockChips('top', S.TOPS, true)),
        opt('옷 색', sw('tc', S.CLOTH)),
        opt('바지 색', sw('bc', S.CLOTH)),
        opt('머리 장식', lockChips('acc', S.ACCESSORIES, false)),
        opt('등', lockChips('back', S.BACKS, false)))));
    paint();
  }

  function renderSign(body) {
    const { x, y } = modalArg;
    const o = world.o(x, y);
    if (!o || o.t !== 'sign') { closeModal(); return; }
    $('modalTitle').textContent = '📋 표지판';
    const ta = el('textarea', { rows: 2, maxlength: 40, placeholder: '예: 언니네 집 → / 낚시터 / 출입금지 🚫' });
    ta.value = o.text || '';
    const save = () => { socket.emit('signText', { x, y, text: ta.value }); closeModal(); };
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } });
    body.append(ta, el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:10px' },
      el('button', { class: 'btn', onclick: closeModal }, '닫기'), el('button', { class: 'btn pink', onclick: save }, '✍️ 저장')));
    setTimeout(() => ta.focus(), 30);
  }

  function renderHelp(body) {
    $('modalTitle').textContent = '❓ 조작법';
    const k = (key, desc) => [el('kbd', {}, key), el('span', {}, desc)];
    body.append(el('div', { class: 'keys' },
      k('WASD / 방향키', '이동'),
      k('1 ~ 9 / 마우스 휠', '단축바 아이템 고르기 (고른 아이템을 손에 들어요)'),
      k('Space / 왼쪽 클릭', '고른 아이템 쓰기 — 블록 놓기, 밭 갈기, 씨앗, 물 주기, 낚시, 음식 먹기'),
      k('E / 빈 손 Space', '상호작용 — 상점, 게시판, 문, 수확, 앉기·눕기, TV 켜기, 요리, 버섯 따기'),
      k('X / 오른쪽 클릭', '부수기·줍기 — 나무 베기, 바위·광석 캐기, 놓은 블록 회수'),
      k('R', '가구 돌리기 — 가구를 들고 누르면 놓을 방향, 놓은 가구를 보고 누르면 그 자리에서 회전'),
      k('I', '가방 (자리 바꾸기, 🔨 만들기)'),
      k('C', '꾸미기 (머리, 얼굴, 옷, 머리 장식, 등)'),
      k('Q', '퀘스트 (일간·주간·월간·업적)'),
      k('K', '도감'),
      k('M', '미니맵 켜기/끄기 (미니맵을 누르면 크게)'),
      k('Enter', '채팅'),
      k('Esc', '창 닫기 / 낚시 그만'),
      k('📱 휴대폰', '왼쪽 아래 조이스틱 = 이동 · 화면 톡 = 그 칸 겨누기 · [사용]=Space · [E] · [X] · [R] · 💬 = 채팅')),
      el('p', { style: 'font-size:12px;line-height:1.8;margin:14px 0 0' },
        '🗺️ 마을 오른쪽과 아래는 집 짓는 땅이에요. 맨 아래로 내려가면 생산 구역: 왼쪽 ⛏ 동굴(돌·철·금·수정·동굴어), 오른쪽 🌲 나무꾼의 숲(나무·버섯·산딸기·사슴·송어)', el('br'),
        '🍳 요리: 가스레인지·전자레인지·모닥불·벽난로 앞에서 E. 숲 캠프에 모닥불이 있어요', el('br'),
        '📦 상자: 만들기(나무 8개)나 상점에서 구해서 놓고 E로 열어요. 27칸 보관(큰 상자 54칸은 Lv.10), 주인은 잠글 수 있어요', el('br'),
        '⭐ 레벨: 수확·낚시·채집·요리·사냥·퀘스트로 경험치! 레벨이 오르면 새 작물·동물·펫·가구·옷·요리법과 가방 칸이 열려요 (왼쪽 위 Lv 누르기)', el('br'),
        '📌 마을 게시판: 마을 한가운데. 업데이트 소식, 건의함(원하는 업데이트 적기), 금주의 MVP', el('br'),
        '🍽️ 조리대·싱크대·테이블 위에 그릇 선반·양념 선반·전자레인지 등을 올려놓을 수 있어요 (X로 위에 올린 것부터 회수)', el('br'),
        '📖 도감: 처음 얻은 물고기·작물·요리·광석 등이 등록돼요. 다 모으면 특별 보상', el('br'),
        '🐶 강아지: 상점에서 사서 Space로 꺼내요. E로 따라오기/집에 두기', el('br'),
        '🤝 거래: 오른쪽 접속자 목록의 🤝 버튼으로 신청해요 (✨퀘스트 전용 아이템은 거래 불가)', el('br'),
        '🛋️ 의자·소파·변기는 E로 앉고, 침대·욕조는 E로 누워요. 움직이면 일어나요'));
  }

  // ───────── 업데이트 ─────────
  let lastSent = 0, lastKey = '';
  function update(dt, now) {
    if (myId && players[myId]) {
      let vx = 0, vy = 0;
      if (!modal && $('reward').classList.contains('hidden')) {
        if (Math.hypot(joy.x, joy.y) > 0.25) { vx = joy.x; vy = joy.y; } // 📱 조이스틱
        if (keys.has('left')) vx -= 1;
        if (keys.has('right')) vx += 1;
        if (keys.has('up')) vy -= 1;
        if (keys.has('down')) vy += 1;
      }
      me.moving = vx !== 0 || vy !== 0;
      if (me.moving) {
        me.pose = null;
        if (fishing) { socket.emit('fishCancel'); fishing = null; }
        if (joy.id !== null) {
          // 조이스틱: 기울인 만큼 속도, 더 많이 기울인 쪽을 바라봐요
          const m = Math.min(1, Math.hypot(vx, vy)); const d = Math.hypot(vx, vy) || 1;
          vx = vx / d * m; vy = vy / d * m;
          me.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
        } else {
          if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
          if (vy < 0) me.dir = 'up'; else if (vy > 0) me.dir = 'down';
          if (vx < 0) me.dir = 'left'; else if (vx > 0) me.dir = 'right';
        }
        const sp = SPEED * (now < buffUntil ? 1.4 : 1);
        const stuck = blocked(me.x, me.y);
        const nx = me.x + vx * sp * dt, ny = me.y + vy * sp * dt;
        if (stuck || !blocked(nx, me.y)) me.x = Math.min(W * TILE - 1, Math.max(1, nx));
        if (stuck || !blocked(me.x, ny)) me.y = Math.min(H * TILE - 1, Math.max(4, ny));
      }
      const p = players[myId];
      p.x = p.dx = me.x; p.y = p.dy = me.y; p.dir = me.dir; p.moving = me.moving; p.pose = me.pose;
      const key = `${me.x.toFixed(1)},${me.y.toFixed(1)},${me.dir},${me.moving}`;
      if (key !== lastKey && now - lastSent > 50) {
        lastKey = key; lastSent = now;
        socket.volatile.emit('move', { x: me.x, y: me.y, dir: me.dir, moving: me.moving });
      }
      target = computeTarget();
    }
    const a = 1 - Math.exp(-dt * 14);
    for (const id in players) {
      if (id === myId) continue;
      const p = players[id];
      p.dx += (p.x - p.dx) * a;
      p.dy += (p.y - p.dy) * a;
    }
    const b = 1 - Math.exp(-dt * 10);
    for (const an of Object.values(animals)) { an.dx += (an.x - an.dx) * b; an.dy += (an.y - an.dy) * b; }
  }

  // ───────── 그리기 ─────────
  function wrapText(text, maxW) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch.trim() ? ch : ''; }
      else line += ch;
    }
    if (line) lines.push(line);
    if (lines.length > 4) { lines.length = 4; lines[3] = lines[3].slice(0, -1) + '…'; }
    return lines;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const toScreen = (wx, wy) => [(wx - cam.x) * Sc, (wy - cam.y) * Sc];

  function bubble(sx, bottomY, text, opts = {}) {
    const u = dpr;
    ctx.font = `${(opts.size || 13) * u}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapText(text, (opts.maxW || 180) * u);
    const lh = (opts.size || 13) * 1.3 * u, pad = 7 * u;
    const bw = Math.max(26 * u, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
    const bh = lines.length * lh + pad * 2 - 4 * u;
    const bx = sx - bw / 2, by = bottomY - bh;
    ctx.fillStyle = opts.bg || '#fff'; ctx.strokeStyle = '#4a3b5c'; ctx.lineWidth = 2 * u;
    roundRect(bx, by, bw, bh, 6 * u); ctx.fill(); ctx.stroke();
    if (opts.tail !== false) {
      ctx.beginPath();
      ctx.moveTo(sx - 6 * u, by + bh - 1 * u); ctx.lineTo(sx, by + bh + 7 * u); ctx.lineTo(sx + 6 * u, by + bh - 1 * u);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(sx - 5 * u, by + bh - 3 * u, 10 * u, 3 * u);
    }
    ctx.fillStyle = opts.color || '#4a3b5c';
    lines.forEach((l, i) => ctx.fillText(l, sx, by + pad + lh / 2 - 2 * u + i * lh));
  }

  // 그리는 위치 (앉기·눕기면 가구 위)
  function charPos(p) {
    if (p.pose) return [p.pose.x * TILE + 8, p.pose.y * TILE + (p.pose.k === 'lie' ? 21 : 13)];
    return [Math.round(p.dx), Math.round(p.dy)];
  }
  function drawLabels(p, id, now) {
    const [px, py] = charPos(p);
    const [sx, sy] = toScreen(px, py - (p.pose && p.pose.k === 'lie' ? 9 : 0));
    const headTop = sy - 25 * Sc;
    const u = dpr;
    ctx.font = `${12 * u}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = `${p.mvp ? '👑 ' : ''}Lv.${p.lv || 1} ${p.name}${id === myId ? ' ★' : ''}`;
    const nw = ctx.measureText(name).width + 10 * u;
    ctx.fillStyle = 'rgba(74,59,92,0.75)';
    roundRect(sx - nw / 2, headTop - 18 * u, nw, 16 * u, 4 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(name, sx, headTop - 10 * u);
    let text = null;
    if (p.bubble && p.bubble.until > now) text = p.bubble.text;
    else if (p.typing) text = '.'.repeat(1 + Math.floor(now / 350) % 3);
    else if (p.pose && p.pose.k === 'lie') text = 'z'.repeat(1 + Math.floor(now / 500) % 3) + '💤';
    if (!text) return;
    const life = p.bubble && p.bubble.until > now ? p.bubble.until - now : BUBBLE_MS;
    ctx.globalAlpha = Math.min(1, life / 400);
    bubble(sx, headTop - 26 * u, text);
    ctx.globalAlpha = 1;
  }

  function hintFor(x, y) {
    const an = animalAt(x, y);
    if (an) {
      const def = S.ANIMALS[an.kind];
      if (def.pet) return isMyPet(an) ? `E ${an.pname} 🐶 (${an.follow ? '따라오는 중' : '집'})` : `E 쓰담 💕 (${an.owner} 님의 ${an.pname})`;
      if (def.wild) return `야생 ${def.name} · 활 Space / X 사냥`;
      if (an.flags & 1) return `E ${S.ITEMS[def.produce].name} 받기 🎁`;
      const it = my.inv[sel];
      if (!(an.flags & 2) && it && S.FEED.includes(it.id)) return 'Space 밥 주기 😋';
      return an.flags & 2 ? `E 쓰담 (배불러요)` : `E 쓰담 · 작물 들고 Space = 밥`;
    }
    const o = world.o(x, y);
    if (!o) return null;
    const h = baseHint(o);
    const it = my.inv[sel], held = it && S.ITEMS[it.id];
    if (S.canRotate(o.t) && !(held && held.obj && S.canRotate(held.obj))) return h ? `${h} · R 돌리기` : 'R 돌리기 ↻';
    return h;
  }
  function baseHint(o) {
    const od = S.OBJ[o.t] || {};
    if (o.t === 'shop') return 'E 상점';
    if (o.t === 'board') return 'E 퀘스트';
    if (o.t === 'sign') return 'E 글쓰기';
    if (od.door) return o.open ? 'E 닫기' : 'E 열기';
    if (o.t === 'crop' && o.stage >= 3) return 'E 수확';
    if (o.t === 'crop' && !o.water) return '💧 물 필요';
    if (od.cook || (o.top && S.OBJ[o.top].cook)) return 'E 요리 🍳';
    if (o.t === 'notice_board') return 'E 마을 게시판 📌';
    if (o.top && (S.OBJ[o.top].fx || S.OBJ[o.top].msg)) return 'E · X 위에 올린 것 회수';
    if (od.chest) return o.locked ? 'E 상자 열기 🔒' : 'E 상자 열기 📦';
    if (od.pick) return 'E 따기';
    if (o.at && o.back) return '🌱 다시 자라는 중';
    if (od.lie) return 'E 눕기';
    if (od.sit) return 'E 앉기';
    if (od.toggle) return o.on ? 'E 끄기' : 'E 켜기';
    if (o.t === 'ore_iron' || o.t === 'ore_gold' || o.t === 'crystal') return 'X 캐기 ⛏';
    if (od.fx || od.msg) return 'E';
    return null;
  }

  const LIE_COVER = { bed: '#9b8cff', royal_bed: '#ff8fab', bathtub: '#8fd3ff', bed_pink: '#ff8fab', bed_blue: '#6ec6ff' };
  function drawPlayer(p, now) {
    const [x, y] = charPos(p);
    const seat = p.pose ? world.o(p.pose.x, p.pose.y) : null;
    const rot = (seat && seat.r) || 0;
    if (p.pose && p.pose.k === 'lie') {
      // 침대 방향대로 돌려서 그려요 (머리는 베개 쪽)
      const c = LIE_COVER[seat && seat.t] || '#9b8cff';
      ctx.save();
      ctx.translate(p.pose.x * TILE + 8, p.pose.y * TILE + 8);
      ctx.rotate(rot * Math.PI / 2);
      D.drawChar(ctx, 0, 13, p.avatar || {}, 'down', -1, { sleep: true });
      ctx.fillStyle = c; ctx.fillRect(-7, -1, 14, 9);
      ctx.fillStyle = D.shade(c, 0.25); ctx.fillRect(-7, -1, 14, 1);
      ctx.restore();
      return;
    }
    const step = p.moving ? Math.floor(now / 140) % 2 : -1;
    D.drawChar(ctx, x, y, p.avatar || {}, p.pose ? S.ROT_DIRS[rot] : p.dir, p.pose ? -1 : step, { held: p.pose || p.fishing ? null : p.held, sit: !!p.pose });
  }

  function drawDarkness(now) {
    const inCave = me.x < S.BX * TILE && me.y >= S.CY * TILE + 8;
    const t = me.x < S.BX * TILE ? Math.max(0, Math.min(1, (me.y - (S.CY - 1) * TILE) / (TILE * 4))) : 0;
    if (!inCave && t <= 0) return;
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = `rgba(12,8,24,${0.86 * t})`;
    dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r) => {
      const [sx, sy] = toScreen(wx, wy), rr = r * Sc;
      if (sx < -rr || sy < -rr || sx > dark.width + rr || sy > dark.height + rr) return;
      const gr = dctx.createRadialGradient(sx, sy, rr * 0.25, sx, sy, rr);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = gr; dctx.beginPath(); dctx.arc(sx, sy, rr, 0, Math.PI * 2); dctx.fill();
    };
    hole(me.x, me.y - 8, 64 + Math.sin(now / 300) * 2);
    for (const [id, p] of Object.entries(players)) if (id !== myId) hole(p.dx, p.dy - 8, 40);
    for (const k of lights) {
      const o = world.objects.get(k), r = D.lightOf(o);
      if (!r) continue;
      const [x, y] = k.split(',').map(Number);
      hole(x * TILE + 8, y * TILE + 6, r * TILE * (0.95 + Math.sin(now / 200 + x) * 0.05));
    }
    ctx.drawImage(dark, 0, 0);
  }

  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2f6b3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!world.ground) return;

    const vw = canvas.width / Sc, vh = canvas.height / Sc;
    const mw = W * TILE, mh = H * TILE;
    const focus = myId ? me : { x: S.SPAWN.x, y: S.SPAWN.y };
    let cx = mw <= vw ? (mw - vw) / 2 : Math.min(mw - vw, Math.max(0, focus.x - vw / 2));
    let cy = mh <= vh ? (mh - vh) / 2 : Math.min(mh - vh, Math.max(0, focus.y - vh / 2));
    cam.x = Math.round(cx * Sc) / Sc; cam.y = Math.round(cy * Sc) / Sc;

    ctx.setTransform(Sc, 0, 0, Sc, -cam.x * Sc, -cam.y * Sc);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas, 0, 0);

    // 움직이는 가구·불
    const x0 = Math.floor(cam.x / TILE) - 1, y0 = Math.floor(cam.y / TILE) - 1, x1 = x0 + vw / TILE + 3, y1 = y0 + vh / TILE + 3;
    for (const k of anims) {
      const [x, y] = k.split(',').map(Number);
      if (x < x0 || y < y0 || x > x1 || y > y1) continue;
      D.drawAnim(ctx, world.objects.get(k), x * TILE, y * TILE, now);
    }

    if (my && !modal) {
      const it = my.inv[sel];
      const def = it && S.ITEMS[it.id];
      const to = world.o(target.x, target.y);
      if (def && (def.ground || def.obj) && !to && world.g(target.x, target.y) !== 'water') {
        ctx.globalAlpha = 0.5;
        D.drawItemRot(ctx, target.x * TILE, target.y * TILE, it.id, def.obj && S.canRotate(def.obj) ? placeRot : 0);
        ctx.globalAlpha = 1;
      } else if (def && def.obj && S.OBJ[def.obj].onTop && to && S.OBJ[to.t] && S.OBJ[to.t].surface && !to.top) {
        ctx.globalAlpha = 0.6;
        D.drawTop(ctx, target.x * TILE, target.y * TILE, def.obj);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(target.x * TILE + 0.5, target.y * TILE + 0.5, TILE - 1, TILE - 1);
    }

    // 캐릭터 + 동물 (아래쪽에 있는 것을 나중에 그려요)
    const order = Object.entries(players).sort((a, b) => a[1].dy - b[1].dy);
    const drawables = order.map(([, p]) => ({ y: charPos(p)[1], p })).concat(Object.values(animals).map((an) => ({ y: an.dy, an })));
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.p) drawPlayer(d.p, now);
      else {
        const an = d.an;
        if ((an.flags & 4) && Math.floor(now / 80) % 2) continue;
        D.drawAnimal(ctx, Math.round(an.dx), Math.round(an.dy), an.kind, an.dir, an.moving ? Math.floor(now / 160) % 2 : -1, now);
        if (an.flags & 1) {
          const id = S.ANIMALS[an.kind].produce;
          const bx = Math.round(an.dx) - 6, by = Math.round(an.dy) - 30 + Math.round(Math.sin(now / 250));
          ctx.fillStyle = '#4a3b5c'; ctx.fillRect(bx - 1, by - 1, 14, 14);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 12, 12);
          ctx.save(); ctx.translate(bx, by); ctx.scale(0.75, 0.75); D.drawItem(ctx, 0, 0, id); ctx.restore();
        }
      }
    }
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i], age = (now - a.t) / 220;
      if (age > 1) { arrows.splice(i, 1); continue; }
      const len = Math.hypot(a.x1 - a.x0, a.y1 - a.y0) || 1, ux = (a.x1 - a.x0) / len, uy = (a.y1 - a.y0) / len;
      const hx = a.x0 + (a.x1 - a.x0) * age, hy = a.y0 + (a.y1 - a.y0) * age;
      ctx.strokeStyle = '#7a4e2d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - ux * 7, hy - uy * 7); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#9aa7b0'; ctx.fillRect(hx - 1, hy - 1, 2, 2);
    }
    for (const [id, p] of order) {
      if (!p.fishing) continue;
      const bite = id === myId && fishing && fishing.bite;
      const hx = p.dx + (p.dir === 'left' ? -7 : p.dir === 'right' ? 7 : 5), hy = p.dy - 9;
      const bx = p.fishing.x * TILE + 8, by = p.fishing.y * TILE + 8 + (bite ? 2 : Math.sin(now / 300) * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo((hx + bx) / 2, Math.min(hy, by) - 10, bx, by); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1.5, by - 1.5, 3, 1.5);
      ctx.fillStyle = '#e85d5d'; ctx.fillRect(bx - 1.5, by, 3, 1.5);
      if (bite) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(bx - 4, by + 2, 8, 0.6); }
    }

    // 동굴 어둠
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawDarkness(now);

    // 화면 글씨 (이름, 말풍선, 표지판, 힌트)
    for (const k of signs) {
      const o = world.objects.get(k);
      if (!o || !o.text) continue;
      const [x, y] = k.split(',').map(Number);
      if (Math.hypot(x * TILE + 8 - me.x, y * TILE + 8 - me.y) > TILE * 6) continue;
      const [sx, sy] = toScreen(x * TILE + 8, y * TILE);
      bubble(sx, sy - 2 * dpr, o.text, { size: 11, maxW: 140, bg: '#fff3d6', tail: false });
    }
    for (const an of Object.values(animals)) {
      if (!an.pname || Math.hypot(an.dx - me.x, an.dy - me.y) > TILE * 5) continue;
      const [sx, sy] = toScreen(an.dx, an.dy - 16);
      ctx.font = `${10 * dpr}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = `${petEmoji(an.kind)} ${an.pname}`, w = ctx.measureText(label).width + 8 * dpr;
      ctx.fillStyle = isMyPet(an) ? 'rgba(255,92,138,0.85)' : 'rgba(74,59,92,0.7)';
      roundRect(sx - w / 2, sy - 16 * dpr, w, 13 * dpr, 4 * dpr); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(label, sx, sy - 9.5 * dpr);
    }
    for (const [id, p] of order) drawLabels(p, id, now);
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i], age = (now - f.t) / 1000;
      if (age > 1) { fxs.splice(i, 1); continue; }
      const [sx, sy] = toScreen(f.x, f.y);
      ctx.globalAlpha = 1 - age;
      ctx.font = `${18 * dpr}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.text, sx, sy - age * 30 * dpr);
      ctx.globalAlpha = 1;
    }
    if (fishing && fishing.bite) {
      const [sx, sy] = toScreen(fishing.x * TILE + 8, fishing.y * TILE);
      bubble(sx, sy - 4 * dpr + Math.sin(now / 60) * 2 * dpr, '❗', { size: 18, bg: '#fff3a3' });
    }
    if (my && !modal) {
      const h = hintFor(target.x, target.y);
      if (h) {
        const [sx, sy] = toScreen(target.x * TILE + 8, (target.y + 1) * TILE);
        bubble(sx, sy + 22 * dpr, h, { size: 11, tail: false, bg: 'rgba(74,59,92,0.85)', color: '#fff' });
      }
    }
    if (now < buffUntil) {
      ctx.font = `${12 * dpr}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(74,59,92,0.85)'; roundRect(12 * dpr, 64 * dpr, 118 * dpr, 20 * dpr, 4 * dpr); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(`💨 빨라짐 ${Math.ceil((buffUntil - now) / 1000)}초`, 18 * dpr, 68 * dpr);
    }
  }

  let last = performance.now(), lastMM = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    render(now);
    if (now - lastMM > 66) { lastMM = now; drawMinimap(now); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
