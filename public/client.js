// 비밀 아지트 - 게임 화면 (이동, 건축, 농사, 낚시, 가방, 상점, 퀘스트, 꾸미기, 채팅)
(() => {
  'use strict';
  const S = window.SHARED, D = window.DRAW;
  const { TILE, W, H } = S;
  const ZOOM = 3;
  const SPEED = 80;
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
    g(x, y) { return this.ground && x >= 0 && y >= 0 && x < W && y < H ? this.ground[y][x] : null; },
    o(x, y) { return this.objects.get(x + ',' + y) || null; },
  };
  const signs = new Set();
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = W * TILE; mapCanvas.height = H * TILE;
  const mctx = mapCanvas.getContext('2d');

  function redraw(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    mctx.clearRect(x * TILE, y * TILE, TILE, TILE);
    D.drawTile(mctx, x * TILE, y * TILE, x, y, world);
  }
  function redrawAll() { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) redraw(x, y); }
  function applyTile(t) {
    const k = t.x + ',' + t.y;
    world.ground[t.y][t.x] = t.g;
    if (t.o) world.objects.set(k, t.o); else world.objects.delete(k);
    if (t.o && t.o.t === 'sign') signs.add(k); else signs.delete(k);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) redraw(t.x + dx, t.y + dy);
  }

  const isSolidAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return world.g(tx, ty) === 'water' || S.isSolidObj(world.o(tx, ty));
  };
  const blocked = (x, y) => isSolidAt(x - 4, y - 3) || isSolidAt(x + 4, y - 3) || isSolidAt(x - 4, y) || isSolidAt(x + 4, y);

  // ───────── 아이콘 ─────────
  const iconCache = {};
  function iconImg(id) {
    if (!iconCache[id]) {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      D.drawItem(c.getContext('2d'), 0, 0, id);
      iconCache[id] = c.toDataURL();
    }
    return el('img', { class: 'ic', src: iconCache[id], alt: S.ITEMS[id] ? S.ITEMS[id].name : id });
  }
  const itemName = (id) => (S.ITEMS[id] ? S.ITEMS[id].name : id);

  // ───────── 캔버스 ─────────
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, Sc = ZOOM;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    Sc = ZOOM * dpr;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
  }
  addEventListener('resize', resize);
  resize();

  // ───────── 상태 ─────────
  const socket = io();
  let myId = null, joinInfo = null;
  let my = null;              // 내 코인, 가방, 퀘스트 기록, 아바타
  let sel = 0;                // 선택한 단축바 칸
  let fishing = null;         // 내 낚시 상태
  const players = {};
  const animals = {};         // id -> { kind, x, y, dx, dy, dir, moving, flags(1 선물 준비, 2 배부름, 4 맞음) }
  const arrows = [], fxs = [];
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const me = { x: 0, y: 0, dir: 'down', moving: false };

  function syncAnimals(list) {
    const seen = new Set();
    for (const [id, kind, x, y, left, moving, flags] of list) {
      seen.add(id);
      const dir = left ? 'left' : 'right';
      if (!animals[id]) animals[id] = { kind, x, y, dx: x, dy: y, dir, moving: !!moving, flags };
      else Object.assign(animals[id], { x, y, dir, moving: !!moving, flags });
    }
    for (const id in animals) if (!seen.has(id)) delete animals[id];
  }
  function animalAt(tx, ty) {
    const cx = tx * TILE + 8, cy = ty * TILE + 8;
    let best = null, bd = 13;
    for (const a of Object.values(animals)) {
      const d = Math.hypot(a.dx - cx, a.dy - 4 - cy);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

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
      name: p.name, x: p.x, y: p.y, dx: p.x, dy: p.y, dir: p.dir, moving: p.moving, avatar: p.avatar, fishing: p.fishing,
    });
    updateWho();
  }

  // ───────── 알림 ─────────
  function showToast(text, item) {
    const box = $('toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const t = el('div', { class: 'toast', style: 'display:flex;gap:6px;align-items:center' }, item ? iconImg(item) : null, text);
    box.append(t);
    setTimeout(() => t.remove(), 2600);
  }

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
    signs.clear();
    for (const [k, o] of world.objects) if (o.t === 'sign') signs.add(k);
    redrawAll();
    for (const id in players) delete players[id];
    Object.values(d.players).forEach(addPlayer);
    for (const id in animals) delete animals[id];
    syncAnimals(d.animals || []);
    me.x = players[myId].x; me.y = players[myId].y;
    fishing = null;
    if (first) {
      $('log').innerHTML = '';
      d.chatLog.forEach(addLog);
      $('join').classList.add('hidden');
      ['top', 'who', 'chat', 'hotbarWrap'].forEach((id) => $(id).classList.remove('hidden'));
      showToast('❓ 조작법 버튼을 눌러 방법을 확인해 보세요!');
    }
  });

  socket.on('me', (d) => {
    my = d;
    $('coins').textContent = `💰 ${d.coins}`;
    if (players[myId]) players[myId].avatar = d.avatar;
    renderHotbar();
    if (modal === 'bag' || modal === 'shop' || modal === 'quests') renderModal();
  });

  socket.on('tiles', (list) => { if (world.ground) list.forEach(applyTile); });
  socket.on('playerJoined', addPlayer);
  socket.on('playerLeft', (id) => { delete players[id]; updateWho(); });
  socket.on('playerUpdate', ({ id, avatar }) => { if (players[id]) { players[id].avatar = avatar; updateWho(); } });
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
  socket.on('editSign', ({ x, y }) => setTimeout(() => openModal('sign', { x, y }), 120));
  socket.on('fishBite', () => { if (fishing) fishing.bite = true; });
  socket.on('fishResult', (r) => { fishing = null; showToast(r.text, r.item); });

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
      const li = el('li', {}, p.name + (id === myId ? ' (나)' : ''));
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
    const it = my && my.inv[sel];
    const box = $('itemName');
    box.textContent = it ? `${itemName(it.id)} — ${S.ITEMS[it.id].desc || ''}` : '빈 손 (Space = 상호작용)';
    box.style.opacity = 1;
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { box.style.opacity = 0; }, 2200);
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
      socket.emit('fishCast', { x: target.x, y: target.y });
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
    socket.emit('act', { type: 'use', slot: sel, x: target.x, y: target.y });
  }
  function doInteract() {
    if (animalAt(target.x, target.y)) { socket.emit('act', { type: 'interact', x: target.x, y: target.y }); return; }
    const o = world.o(target.x, target.y);
    if (!o) return;
    if (o.t === 'shop') return openModal('shop');
    if (o.t === 'board') return openModal('quests');
    if (o.t === 'sign') return openModal('sign', { x: target.x, y: target.y });
    socket.emit('act', { type: 'interact', x: target.x, y: target.y });
  }
  function doBreak() {
    if (fishing) return;
    socket.emit('act', { type: 'break', x: target.x, y: target.y });
  }

  // ───────── 키보드 / 마우스 ─────────
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const MODAL_KEYS = { KeyI: 'bag', KeyB: 'bag', KeyC: 'avatar', KeyQ: 'quests' };
  addEventListener('keydown', (e) => {
    if (!myId || document.activeElement === chatInput) return;
    const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
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

  // 목표 칸: 손 닿는 곳에 마우스가 있으면 그 칸, 아니면 바라보는 칸
  function computeTarget() {
    const cx = me.x, cy = me.y - 6;
    if (mouse.in && performance.now() - mouse.t < 4000) {
      const wx = mouse.sx * dpr / Sc + cam.x, wy = mouse.sy * dpr / Sc + cam.y;
      const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
      if (Math.hypot(tx * TILE + 8 - cx, ty * TILE + 8 - cy) <= S.REACH) return { x: tx, y: ty };
    }
    const fx = Math.floor(me.x / TILE), fy = Math.floor((me.y - 4) / TILE);
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[me.dir];
    return { x: fx + d[0], y: fy + d[1] };
  }

  // ───────── 창 (가방 / 상점 / 퀘스트 / 꾸미기 / 표지판 / 조작법) ─────────
  let modal = null, modalArg = null;
  let bagTab = 'inv', pick = null, shopTab = 'buy', avDraft = null, avTimer = null;
  function openModal(name, arg) {
    if (!my) return;
    modal = name; modalArg = arg || null;
    keys.clear();
    pick = null; avDraft = null;
    $('modal').classList.remove('hidden');
    renderModal();
  }
  function closeModal() {
    modal = null;
    clearInterval(avTimer); avTimer = null; avDraft = null;
    $('modal').classList.add('hidden');
    document.activeElement && document.activeElement.blur();
  }
  $('modalClose').addEventListener('click', closeModal);
  $('modal').addEventListener('mousedown', (e) => { if (e.target === $('modal')) closeModal(); });

  function renderModal() {
    if (!modal) return;
    const body = $('modalBody');
    body.innerHTML = '';
    ({ bag: renderBag, shop: renderShop, quests: renderQuests, avatar: renderAvatar, sign: renderSign, help: renderHelp })[modal](body);
  }
  const tabs = (cur, list, onPick) => el('div', { class: 'tabs' },
    list.map(([id, label]) => el('button', { class: 'btn' + (cur === id ? ' on' : ''), onclick: () => { onPick(id); renderModal(); } }, label)));

  function renderBag(body) {
    $('modalTitle').textContent = '🎒 가방';
    body.append(tabs(bagTab, [['inv', '🎒 가방'], ['craft', '🔨 만들기']], (t) => { bagTab = t; pick = null; }));
    if (bagTab === 'inv') {
      const grid = el('div', { class: 'grid' });
      my.inv.forEach((it, i) => {
        grid.append(el('div', {
          class: 'slot' + (i < 9 ? ' hb' : '') + (pick === i ? ' pick' : '') + (i === sel ? ' sel' : ''),
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
          el('div', { class: 'grow' }, el('b', {}, `${itemName(it.id)} ×${it.n}`), el('br'), S.ITEMS[it.id].desc || '', el('br'), el('small', { style: 'opacity:.6' }, '옮길 칸을 누르세요')),
          el('button', { class: 'btn', onclick: () => { if (confirm(`${itemName(it.id)} ×${it.n}, 버릴까요?`)) { socket.emit('trash', { slot: pick }); pick = null; } } }, '🗑️ 버리기'))
        : el('div', { class: 'info' }, '💡 칸을 누르고 다른 칸을 누르면 자리가 바뀌어요. 윗줄 9칸이 단축바(1~9)예요.'));
    } else {
      const rows = el('div', { class: 'rows' });
      S.RECIPES.forEach((r, i) => {
        const ok = Object.entries(r.need).every(([id, n]) => S.countItem(my.inv, id) >= n);
        const need = Object.entries(r.need).map(([id, n]) => `${itemName(id)} ${n}개 (보유 ${S.countItem(my.inv, id)})`).join(' + ');
        rows.append(el('div', { class: 'row' }, iconImg(r.out),
          el('div', { class: 'grow' }, `${itemName(r.out)} ×${r.n}`, el('small', {}, need)),
          el('button', { class: 'btn pink', disabled: !ok, onclick: () => socket.emit('craft', { i }) }, '만들기')));
      });
      body.append(el('p', { style: 'margin:0 0 8px;font-size:12px;opacity:.7' }, '🌳 나무는 나무 앞에서 X, ⛏ 돌은 채석장 바위 앞에서 X로 모아요.'), rows);
    }
  }

  function renderShop(body) {
    $('modalTitle').textContent = '🐱 모모네 상점';
    body.append(el('p', { style: 'margin:0 0 10px;font-size:13px' }, `어서오라냥! 지금 가진 돈: 💰 ${my.coins}`));
    body.append(tabs(shopTab, [['buy', '🛒 사기'], ['sell', '💰 팔기'], ['acc', '🎀 꾸미기 아이템']], (t) => { shopTab = t; }));
    const rows = el('div', { class: 'rows' });
    if (shopTab === 'buy') {
      S.SHOP.forEach(([id, price]) => {
        rows.append(el('div', { class: 'row' }, iconImg(id),
          el('div', { class: 'grow' }, `${itemName(id)} · 💰${price}`, el('small', {}, S.ITEMS[id].desc || '')),
          [1, 5].map((n) => el('button', { class: 'btn', disabled: my.coins < price * n, onclick: () => socket.emit('buy', { id, n }) }, `×${n}`))));
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
      S.ACCESSORIES.filter((a) => a.id !== 'none').forEach((a) => {
        const owned = my.unlocked.includes(a.id);
        const how = owned ? '보유 중 ✓' : a.price ? `💰${a.price}` : `퀘스트 보상: ${(S.QUESTS.find((q) => q.id === a.quest) || {}).name}`;
        rows.append(el('div', { class: 'row' }, avatarThumb(Object.assign({}, my.avatar, { acc: a.id })),
          el('div', { class: 'grow' }, a.name, el('small', {}, how)),
          a.price && !owned ? el('button', { class: 'btn pink', disabled: my.coins < a.price, onclick: () => socket.emit('buyAcc', { id: a.id }) }, '사기') : null));
      });
    }
    body.append(rows);
  }

  function avatarThumb(av) {
    const c = el('canvas', { width: 20, height: 18, style: 'width:40px;height:36px;image-rendering:pixelated;background:#8fd16f;border:2px solid #4a3b5c' });
    D.drawChar(c.getContext('2d'), 10, 27, av, 'down', -1);
    return c;
  }

  function rewardText(rw) {
    const out = [];
    if (rw.coins) out.push(`💰${rw.coins}`);
    if (rw.items) for (const [id, n] of Object.entries(rw.items)) out.push(`${itemName(id)} ×${n}`);
    if (rw.unlock) out.push(`${S.ACCESSORIES.find((a) => a.id === rw.unlock).name} (꾸미기)`);
    return '🎁 ' + out.join(', ');
  }
  function renderQuests(body) {
    $('modalTitle').textContent = '📜 퀘스트';
    const rows = el('div', { class: 'rows' });
    const state = (q) => (my.claimed.includes(q.id) ? 2 : (my.stats[q.stat] || 0) >= q.goal ? 0 : 1);
    [...S.QUESTS].sort((a, b) => state(a) - state(b)).forEach((q) => {
      const v = Math.min(q.goal, my.stats[q.stat] || 0), st = state(q);
      rows.append(el('div', { class: 'row q' + (st === 2 ? ' done' : '') },
        el('div', { class: 'grow' }, el('b', {}, q.name), ` — ${q.desc}`,
          el('div', { class: 'bar' }, el('i', { style: `width:${(v / q.goal) * 100}%` })),
          el('small', {}, `${v} / ${q.goal}   ${rewardText(q.reward)}`)),
        st === 0 ? el('button', { class: 'btn pink', onclick: () => socket.emit('claim', { id: q.id }) }, '보상 받기')
          : st === 2 ? el('span', {}, '✅') : null));
    });
    body.append(rows);
  }

  function renderAvatar(body) {
    $('modalTitle').textContent = '👗 꾸미기';
    if (!avDraft) avDraft = Object.assign({}, my.avatar);
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
    const opt = (label, ctl) => el('div', { class: 'opt' }, el('span', {}, label), ctl);
    const accRow = el('div', { class: 'pick-row' }, S.ACCESSORIES.map((a) => {
      const owned = my.unlocked.includes(a.id) || a.id === 'none';
      return el('button', {
        class: 'chip' + (avDraft.acc === a.id ? ' on' : ''), disabled: !owned,
        title: owned ? '' : a.price ? `상점에서 💰${a.price}` : '퀘스트 보상', onclick: () => setv('acc', a.id),
      }, (owned ? '' : '🔒') + a.name);
    }));
    body.append(el('div', { class: 'av' },
      el('div', { style: 'display:grid;gap:8px;justify-items:center' }, prev,
        el('button', { class: 'btn pink', style: 'width:160px', onclick: () => { socket.emit('avatar', avDraft); closeModal(); } }, '💾 저장하기'),
        el('button', { class: 'btn', style: 'width:160px', onclick: () => { avDraft = Object.assign({}, my.avatar); renderModal(); } }, '↩ 되돌리기')),
      el('div', {},
        opt('피부', sw('skin', S.SKINS)),
        opt('머리 모양', chips('hs', S.HAIR_STYLES)),
        opt('머리 색', sw('hc', S.HAIR_COLORS)),
        opt('눈', chips('eyes', S.EYES)),
        opt('볼터치', el('div', { class: 'pick-row' }, [['켜기', 1], ['끄기', 0]].map(([n, v]) =>
          el('button', { class: 'chip' + (avDraft.blush === v ? ' on' : ''), onclick: () => setv('blush', v) }, n)))),
        opt('옷', chips('top', S.TOPS)),
        opt('옷 색', sw('tc', S.CLOTH)),
        opt('바지 색', sw('bc', S.CLOTH)),
        opt('액세서리', accRow))));
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
      k('1 ~ 9 / 마우스 휠', '단축바 아이템 고르기'),
      k('Space / 왼쪽 클릭', '고른 아이템 쓰기 — 블록 놓기, 밭 갈기, 씨앗 심기, 물 주기, 낚시'),
      k('E / 빈 손 Space', '상호작용 — 상점, 퀘스트 게시판, 표지판 쓰기, 문 열기, 수확'),
      k('X / 오른쪽 클릭', '부수기·줍기 — 나무 베기, 바위 깨기, 놓은 블록 회수'),
      k('I', '가방 (자리 바꾸기, 🔨 만들기)'),
      k('C', '꾸미기 (머리, 얼굴, 옷)'),
      k('Q', '퀘스트'),
      k('Enter', '채팅'),
      k('Esc', '창 닫기 / 낚시 그만')),
      el('p', { style: 'font-size:12px;line-height:1.7;margin:14px 0 0' },
        '🎯 하얀 네모가 지금 손이 닿는 칸이에요. 마우스를 캐릭터 근처에 올리면 그 칸을 고를 수 있어요.', el('br'),
        '🌱 농사: 괭이로 밭 갈기 → 씨앗 심기 → 물 주기 (단계마다 다시 물 주기) → 다 자라면 E로 수확', el('br'),
        '🎣 낚시: 낚싯대를 들고 물을 보고 Space → 찌 위에 ❗가 뜨면 바로 Space!', el('br'),
        '🏠 건축: 나무를 베어 🔨 만들기에서 벽·바닥·문을 만들고, 표지판으로 내 땅을 표시해요.', el('br'),
        '🐔 동물: 상점에서 닭·양·소를 사서 Space로 풀어주고, 작물을 들고 Space로 밥 → 머리 위에 선물이 뜨면 E', el('br'),
        '🏹 사냥: 상점에서 활을 사서 Space로 쏴요 (마우스 쪽으로 조준). 토끼·멧돼지 → 고기·가죽'));
  }

  // ───────── 업데이트 ─────────
  let lastSent = 0, lastKey = '';
  function update(dt, now) {
    if (myId && players[myId]) {
      let vx = 0, vy = 0;
      if (!modal) {
        if (keys.has('left')) vx -= 1;
        if (keys.has('right')) vx += 1;
        if (keys.has('up')) vy -= 1;
        if (keys.has('down')) vy += 1;
      }
      me.moving = vx !== 0 || vy !== 0;
      if (me.moving) {
        if (fishing) { socket.emit('fishCancel'); fishing = null; }
        if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
        if (vy < 0) me.dir = 'up'; else if (vy > 0) me.dir = 'down';
        if (vx < 0) me.dir = 'left'; else if (vx > 0) me.dir = 'right';
        const stuck = blocked(me.x, me.y); // 블록에 갇혔으면 빠져나올 수 있게
        const nx = me.x + vx * SPEED * dt, ny = me.y + vy * SPEED * dt;
        if (stuck || !blocked(nx, me.y)) me.x = Math.min(W * TILE - 1, Math.max(1, nx));
        if (stuck || !blocked(me.x, ny)) me.y = Math.min(H * TILE - 1, Math.max(4, ny));
      }
      const p = players[myId];
      p.x = p.dx = me.x; p.y = p.dy = me.y; p.dir = me.dir; p.moving = me.moving;
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

  function drawLabels(p, id, now) {
    const [sx, sy] = toScreen(p.dx, p.dy);
    const headTop = sy - 25 * Sc;
    const u = dpr;
    ctx.font = `${12 * u}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = p.name + (id === myId ? ' ★' : '');
    const nw = ctx.measureText(name).width + 10 * u;
    ctx.fillStyle = 'rgba(74,59,92,0.75)';
    roundRect(sx - nw / 2, headTop - 18 * u, nw, 16 * u, 4 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(name, sx, headTop - 10 * u);
    let text = null;
    if (p.bubble && p.bubble.until > now) text = p.bubble.text;
    else if (p.typing) text = '.'.repeat(1 + Math.floor(now / 350) % 3);
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
      if (def.wild) return `야생 ${def.name} · 활 Space / X 사냥`;
      if (an.flags & 1) return `E ${S.ITEMS[def.produce].name} 받기 🎁`;
      const it = my.inv[sel];
      if (!(an.flags & 2) && it && S.FEED.includes(it.id)) return 'Space 밥 주기 😋';
      return an.flags & 2 ? `E 쓰담 (배불러요)` : `E 쓰담 · 작물 들고 Space = 밥`;
    }
    const o = world.o(x, y);
    if (!o) return null;
    if (o.t === 'shop') return 'E 상점';
    if (o.t === 'board') return 'E 퀘스트';
    if (o.t === 'sign') return 'E 글쓰기';
    if (o.t === 'door') return o.open ? 'E 닫기' : 'E 열기';
    if (o.t === 'crop' && o.stage >= 3) return 'E 수확';
    if (o.t === 'crop' && !o.water) return '💧 물 필요';
    return null;
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

    // 목표 칸 + 놓을 블록 미리보기
    if (my && !modal) {
      const it = my.inv[sel];
      const def = it && S.ITEMS[it.id];
      if (def && (def.ground || def.obj) && !world.o(target.x, target.y) && world.g(target.x, target.y) !== 'water') {
        ctx.globalAlpha = 0.5;
        D.drawItem(ctx, target.x * TILE, target.y * TILE, it.id);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(target.x * TILE + 0.5, target.y * TILE + 0.5, TILE - 1, TILE - 1);
    }

    // 캐릭터 + 동물 (아래쪽에 있는 것을 나중에 그려요)
    const order = Object.entries(players).sort((a, b) => a[1].dy - b[1].dy);
    const drawables = order.map(([, p]) => ({ y: p.dy, p })).concat(Object.values(animals).map((an) => ({ y: an.dy, an })));
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      if (d.p) {
        const p = d.p, step = p.moving ? Math.floor(now / 140) % 2 : -1;
        D.drawChar(ctx, Math.round(p.dx), Math.round(p.dy), p.avatar || {}, p.dir, step);
      } else {
        const an = d.an;
        if ((an.flags & 4) && Math.floor(now / 80) % 2) continue; // 맞으면 깜빡
        D.drawAnimal(ctx, Math.round(an.dx), Math.round(an.dy), an.kind, an.dir, an.moving ? Math.floor(now / 180) % 2 : -1);
        if (an.flags & 1) { // 선물 준비 완료
          const id = S.ANIMALS[an.kind].produce;
          const bx = Math.round(an.dx) - 6, by = Math.round(an.dy) - 30 + Math.round(Math.sin(now / 250));
          ctx.fillStyle = '#4a3b5c'; ctx.fillRect(bx - 1, by - 1, 14, 14);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, 12, 12);
          ctx.save(); ctx.translate(bx, by); ctx.scale(0.75, 0.75); D.drawItem(ctx, 0, 0, id); ctx.restore();
        }
      }
    }
    // 화살
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i], age = (now - a.t) / 220;
      if (age > 1) { arrows.splice(i, 1); continue; }
      const len = Math.hypot(a.x1 - a.x0, a.y1 - a.y0) || 1, ux = (a.x1 - a.x0) / len, uy = (a.y1 - a.y0) / len;
      const hx = a.x0 + (a.x1 - a.x0) * age, hy = a.y0 + (a.y1 - a.y0) * age;
      ctx.strokeStyle = '#7a4e2d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - ux * 7, hy - uy * 7); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = '#9aa7b0'; ctx.fillRect(hx - 1, hy - 1, 2, 2);
    }
    // 낚싯줄
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

    // 화면 글씨 (이름, 말풍선, 표지판, 힌트)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const k of signs) {
      const o = world.objects.get(k);
      if (!o || !o.text) continue;
      const [x, y] = k.split(',').map(Number);
      if (Math.hypot(x * TILE + 8 - me.x, y * TILE + 8 - me.y) > TILE * 6) continue;
      const [sx, sy] = toScreen(x * TILE + 8, y * TILE);
      bubble(sx, sy - 2 * dpr, o.text, { size: 11, maxW: 140, bg: '#fff3d6', tail: false });
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
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    render(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
