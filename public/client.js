// 비밀 아지트 - 클라이언트 (맵 렌더링, 캐릭터 이동, 말풍선, 채팅)
(() => {
  'use strict';

  // ───────── 기본 설정 ─────────
  const TILE = 16;          // 타일 1칸 = 16 픽셀
  const W = 40, H = 30;     // 맵 크기 (타일 수) - server.js 와 동일
  const ZOOM = 3;           // 픽셀 확대 배율
  const SPEED = 80;         // 이동 속도 (픽셀/초)
  const BUBBLE_MS = 6000;   // 말풍선 유지 시간
  const FONT = "'Galmuri11', 'Malgun Gothic', sans-serif";
  const COLORS = ['#ff8fab', '#ffb36b', '#ffd95e', '#7ed492', '#6ec6ff', '#9b8cff', '#c9a0ff', '#f5f5f5', '#555a6e'];

  // ───────── 맵 만들기 ─────────
  const T = { GRASS: 0, PATH: 1, FLOOR: 2, WALL: 3, TREE: 4, WATER: 5, FLOWER: 6, SHELF: 8, TABLE: 9, SOFA: 10, PLANT: 11, WINDOW: 12, SIGN: 13, BED: 14 };
  const SOLID = new Set([T.WALL, T.TREE, T.WATER, T.SHELF, T.TABLE, T.SOFA, T.PLANT, T.WINDOW, T.SIGN, T.BED]);
  const INDOOR = new Set([T.FLOOR, T.SHELF, T.TABLE, T.SOFA, T.PLANT, T.BED]);

  // 좌표마다 항상 같은 값이 나오는 난수 (맵이 모두에게 똑같이 보이도록)
  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  const map = Array.from({ length: H }, () => new Array(W).fill(T.GRASS));
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y][x] = t; };
  const RUG = { x0: 17, y0: 8, x1: 23, y1: 11 };

  (function buildMap() {
    // 가장자리 숲
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, T.TREE);
    // 길
    for (let y = 14; y < H - 2; y++) set(20, y, T.PATH);
    for (let x = 2; x < W - 2; x++) set(x, 21, T.PATH);
    // 아지트 집
    const hx0 = 13, hx1 = 27, hy0 = 3, hy1 = 13;
    for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++)
      set(x, y, (x === hx0 || x === hx1 || y === hy0 || y === hy1) ? T.WALL : T.FLOOR);
    set(20, hy1, T.FLOOR);                 // 문
    set(16, hy0, T.WINDOW); set(24, hy0, T.WINDOW);
    for (let x = 15; x <= 18; x++) set(x, hy0 + 1, T.SHELF);   // 책장
    set(19, 9, T.TABLE); set(20, 9, T.TABLE); set(21, 9, T.TABLE);
    set(19, 11, T.SOFA); set(20, 11, T.SOFA); set(21, 11, T.SOFA);
    set(24, 4, T.BED); set(25, 4, T.BED);
    set(14, 4, T.PLANT); set(26, 12, T.PLANT); set(14, 12, T.PLANT);
    set(22, 14, T.SIGN);                   // 표지판
    // 연못
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - 8.5) / 4.6, dy = (y + 0.5 - 25) / 2.4;
      if (dx * dx + dy * dy < 1) set(x, y, T.WATER);
    }
    // 나무
    [[6, 6], [9, 10], [5, 14], [32, 6], [35, 9], [31, 13], [34, 25], [29, 26], [36, 17], [8, 17], [27, 17]]
      .forEach(([x, y]) => set(x, y, T.TREE));
    // 꽃
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (map[y][x] === T.GRASS && hash(x, y) < 0.09) set(x, y, T.FLOWER);
  })();

  const isSolidAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return SOLID.has(map[ty][tx]);
  };
  // 캐릭터 발밑 상자로 충돌 판정
  const blocked = (x, y) =>
    isSolidAt(x - 4, y - 3) || isSolidAt(x + 4, y - 3) || isSolidAt(x - 4, y) || isSolidAt(x + 4, y);

  // ───────── 맵 그리기 (한 번만 그려서 저장) ─────────
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = W * TILE; mapCanvas.height = H * TILE;
  (function renderMap() {
    const g = mapCanvas.getContext('2d');
    let ox = 0, oy = 0;
    const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); };

    const grass = (x, y) => {
      R('#8fd16f', 0, 0, 16, 16);
      for (let i = 0; i < 3; i++)
        R('#7bbd5c', Math.floor(hash(x * 7 + i, y * 13) * 15), Math.floor(hash(x * 3, y * 5 + i) * 14), 1, 2);
    };
    const floor = () => {
      R('#e2b07c', 0, 0, 16, 16);
      for (let j = 0; j < 4; j++) {
        R('#c9955f', 0, j * 4 + 3, 16, 1);
        R('#c9955f', j % 2 ? 4 : 11, j * 4, 1, 3);
      }
    };

    // 1단계: 바닥
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ox = x * TILE; oy = y * TILE;
      const t = map[y][x];
      if (INDOOR.has(t)) { floor(); continue; }
      switch (t) {
        case T.PATH:
          R('#efdcab', 0, 0, 16, 16);
          for (let i = 0; i < 3; i++)
            R('#dcc48c', Math.floor(hash(x * 5 + i, y) * 14), Math.floor(hash(x, y * 9 + i) * 14), 2, 1);
          break;
        case T.WALL: case T.WINDOW:
          R('#b07656', 0, 0, 16, 16);
          R('#c48a68', 0, 0, 16, 2);
          for (let j = 0; j < 4; j++) {
            R('#8e5a3f', 0, j * 4 + 3, 16, 1);
            R('#8e5a3f', j % 2 ? 3 : 10, j * 4, 1, 3);
          }
          if (t === T.WINDOW) {
            R('#6e4a35', 3, 3, 10, 9); R('#bfe9ff', 4, 4, 8, 7);
            R('#ffffff', 5, 5, 2, 2); R('#6e4a35', 7, 4, 1, 7); R('#6e4a35', 4, 7, 8, 1);
          }
          break;
        case T.WATER: {
          R('#63bde8', 0, 0, 16, 16);
          R('#9fdcf7', Math.floor(hash(x, y) * 10), 4, 4, 1);
          R('#9fdcf7', Math.floor(hash(y, x) * 10) + 2, 11, 3, 1);
          // 물가 테두리
          const edge = (nx, ny) => map[ny] && map[ny][nx] !== undefined && map[ny][nx] !== T.WATER;
          if (edge(x, y - 1)) R('#4aa3cf', 0, 0, 16, 2);
          if (edge(x - 1, y)) R('#4aa3cf', 0, 0, 2, 16);
          if (edge(x + 1, y)) R('#4aa3cf', 14, 0, 2, 16);
          if (edge(x, y + 1)) R('#4aa3cf', 0, 14, 16, 2);
          break;
        }
        case T.SIGN:
          grass(x, y);
          R('#7a4e2d', 7, 8, 2, 8);
          R('#a8743f', 1, 2, 14, 7); R('#c99558', 2, 3, 12, 5);
          R('#ff8fab', 4, 4, 2, 2); R('#ff8fab', 7, 5, 5, 1); R('#ff8fab', 7, 3, 3, 1);
          break;
        default:
          grass(x, y);
      }
      if (t === T.FLOWER) {
        const cols = ['#ff8fab', '#fff3a3', '#ffffff', '#c9a0ff', '#ffb36b'];
        for (let i = 0; i < 2; i++) {
          const fx = 2 + Math.floor(hash(x + i * 11, y) * 10), fy = 2 + Math.floor(hash(x, y + i * 7) * 10);
          const c = cols[Math.floor(hash(x * 2 + i, y * 3) * cols.length)];
          R(c, fx - 1, fy, 3, 1); R(c, fx, fy - 1, 1, 3); R('#ffd34d', fx, fy, 1, 1);
          R('#5aa646', fx, fy + 2, 1, 2);
        }
      }
      if (t === T.TREE) {
        R('#7a4e2d', 6, 10, 4, 6);
        R('#3f8f45', 2, 3, 12, 8); R('#3f8f45', 1, 5, 14, 4); R('#3f8f45', 4, 1, 8, 11);
        R('#5fb35f', 4, 3, 4, 3); R('#5fb35f', 3, 5, 2, 2);
        R('#2f7236', 9, 8, 3, 2); R('#2f7236', 11, 6, 2, 2);
      }
    }

    // 2단계: 러그
    ox = RUG.x0 * TILE + 4; oy = RUG.y0 * TILE + 4;
    const rw = (RUG.x1 - RUG.x0 + 1) * TILE - 8, rh = (RUG.y1 - RUG.y0 + 1) * TILE - 8;
    R('#e98a9b', 0, 0, rw, rh);
    R('#ffd1dc', 3, 3, rw - 6, 1); R('#ffd1dc', 3, rh - 4, rw - 6, 1);
    R('#ffd1dc', 3, 3, 1, rh - 6); R('#ffd1dc', rw - 4, 3, 1, rh - 6);
    for (let i = 8; i < rw - 8; i += 8) R('#f6b3c0', i, rh / 2 - 1, 3, 3);

    // 3단계: 가구
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ox = x * TILE; oy = y * TILE;
      const t = map[y][x];
      if (t === T.SHELF) {
        R('#7b4a2a', 1, 0, 14, 16); R('#5a3520', 1, 7, 14, 1); R('#5a3520', 1, 15, 14, 1);
        const bc = ['#ff8fab', '#6ec6ff', '#ffd95e', '#7ed492', '#c9a0ff'];
        for (let i = 0; i < 5; i++) {
          R(bc[(i + x) % 5], 2 + i * 2 + (i > 2 ? 1 : 0), 2 + (i % 2), 2, 5 - (i % 2));
          R(bc[(i + x + 2) % 5], 2 + i * 2 + (i > 1 ? 1 : 0), 9 + ((i + 1) % 2), 2, 6 - ((i + 1) % 2));
        }
      } else if (t === T.TABLE) {
        R('#9c6b3f', 0, 4, 16, 8); R('#b88252', 0, 4, 16, 2);
        if (map[y][x - 1] !== T.TABLE) R('#6e4626', 1, 12, 2, 3);
        if (map[y][x + 1] !== T.TABLE) R('#6e4626', 13, 12, 2, 3);
        if (x === 20) { R('#ffffff', 5, 5, 6, 4); R('#8b5a3c', 6, 6, 4, 2); R('#ffffff', 11, 6, 1, 2); } // 찻잔
        if (x === 19) { R('#ffd95e', 6, 5, 5, 3); R('#ff8fab', 7, 4, 3, 1); } // 케이크
      } else if (t === T.SOFA) {
        R('#c45686', 0, 1, 16, 6); R('#d96c9b', 0, 6, 16, 8); R('#e88bb4', 2, 7, 12, 2);
        if (map[y][x - 1] !== T.SOFA) R('#b04a76', 0, 3, 3, 11);
        if (map[y][x + 1] !== T.SOFA) R('#b04a76', 13, 3, 3, 11);
      } else if (t === T.BED) {
        const left = map[y][x - 1] !== T.BED;
        R('#8b5a3c', 0, 0, 16, 16); R('#ffffff', 1, 1, 14, 14);
        if (left) { R('#ffffff', 2, 2, 12, 5); R('#e6e6f0', 2, 6, 12, 1); R('#9b8cff', 1, 8, 15, 7); }
        else { R('#9b8cff', 0, 8, 15, 7); R('#b8adff', 0, 9, 15, 1); }
      } else if (t === T.PLANT) {
        R('#c0623b', 5, 10, 6, 5); R('#d97a50', 4, 9, 8, 2);
        R('#4caf50', 3, 4, 10, 6); R('#66c466', 5, 1, 6, 5); R('#3d8f40', 7, 6, 2, 4);
      }
    }
  })();

  // ───────── 화면/캔버스 ─────────
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, S = ZOOM;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    S = ZOOM * dpr;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
  }
  addEventListener('resize', resize);
  resize();

  // ───────── 상태 ─────────
  const socket = io();
  let myId = null;
  let joinInfo = null;
  const players = {}; // id -> { name, color, x, y (목표), dx, dy (화면 표시용), dir, moving, bubble, typing }
  const me = { x: 0, y: 0, dir: 'down', moving: false };
  const keys = new Set();

  function addPlayer(p) {
    players[p.id] = Object.assign(players[p.id] || {}, {
      name: p.name, color: p.color, x: p.x, y: p.y, dx: p.x, dy: p.y, dir: p.dir, moving: p.moving,
    });
    updateWho();
  }

  // ───────── 네트워크 ─────────
  socket.on('connect', () => {
    document.getElementById('status').style.display = 'none';
    if (joinInfo) socket.emit('join', Object.assign({}, joinInfo, { x: me.x, y: me.y, rejoin: true })); // 자동 재접속
  });
  socket.on('disconnect', () => { document.getElementById('status').style.display = 'block'; });

  socket.on('joinError', (msg) => {
    joinInfo = null;
    document.getElementById('joinMsg').textContent = msg;
  });

  socket.on('init', (d) => {
    const firstJoin = myId === null;
    myId = d.id;
    for (const id in players) delete players[id];
    Object.values(d.players).forEach(addPlayer);
    const mine = players[myId];
    me.x = mine.x; me.y = mine.y;
    if (firstJoin) {
      document.getElementById('log').innerHTML = '';
      d.chatLog.forEach(addLog);
      document.getElementById('join').classList.add('hidden');
      ['help', 'who', 'chat'].forEach((id) => document.getElementById(id).classList.remove('hidden'));
      canvas.focus();
    }
  });

  socket.on('playerJoined', addPlayer);
  socket.on('playerLeft', (id) => { delete players[id]; updateWho(); });

  socket.on('state', (list) => {
    for (const [id, x, y, dir, moving] of list) {
      const p = players[id];
      if (!p || id === myId) continue;
      p.x = x; p.y = y; p.dir = dir; p.moving = !!moving;
    }
  });

  socket.on('chat', (m) => {
    addLog(m);
    if (m.id && players[m.id]) {
      players[m.id].bubble = { text: m.text, until: performance.now() + BUBBLE_MS };
      players[m.id].typing = false;
    }
  });

  socket.on('typing', ({ id, on }) => { if (players[id]) players[id].typing = on; });

  // ───────── 입장 화면 ─────────
  const sw = document.getElementById('swatches');
  let chosenColor = localStorage.getItem('hideout.color') || COLORS[0];
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = c; b.title = c;
    if (c === chosenColor) b.classList.add('on');
    b.onclick = () => {
      chosenColor = c;
      sw.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    sw.appendChild(b);
  });
  const nameInput = document.getElementById('nameInput');
  nameInput.value = localStorage.getItem('hideout.name') || '';
  nameInput.focus();

  document.getElementById('joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    try { localStorage.setItem('hideout.name', name); localStorage.setItem('hideout.color', chosenColor); } catch (_) {}
    document.getElementById('joinMsg').textContent = '';
    joinInfo = { name, color: chosenColor, code: document.getElementById('codeInput').value };
    socket.emit('join', joinInfo);
  });

  // ───────── 채팅 ─────────
  const log = document.getElementById('log');
  const chatInput = document.getElementById('chatInput');

  function addLog(m) {
    const div = document.createElement('div');
    const time = new Date(m.t || Date.now()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (m.system) {
      div.className = 'sys';
      div.textContent = m.text;
    } else {
      const nm = document.createElement('span');
      nm.className = 'nm'; nm.style.color = shade(m.color, -0.35); nm.textContent = m.name + ': ';
      div.appendChild(nm);
      div.appendChild(document.createTextNode(m.text));
    }
    const tm = document.createElement('span');
    tm.className = 'tm'; tm.textContent = time;
    div.appendChild(tm);
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 10;
    log.appendChild(div);
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  let typingSent = false;
  const setTyping = (on) => { if (on !== typingSent) { typingSent = on; socket.emit('typing', on); } };
  chatInput.addEventListener('input', () => setTyping(chatInput.value.trim().length > 0));
  chatInput.addEventListener('blur', () => setTyping(false));
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') chatInput.blur();
    e.stopPropagation();
  });

  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) socket.emit('chat', text);
    chatInput.value = '';
    setTyping(false);
    chatInput.blur();
  });

  function updateWho() {
    const list = Object.entries(players);
    const box = document.getElementById('who');
    box.querySelector('b').textContent = `접속 중 ${list.length}명`;
    const ul = box.querySelector('ul');
    ul.innerHTML = '';
    list.forEach(([id, p]) => {
      const li = document.createElement('li');
      li.style.setProperty('--c', p.color);
      li.textContent = p.name + (id === myId ? ' (나)' : '');
      ul.appendChild(li);
    });
  }

  // ───────── 키보드 ─────────
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  addEventListener('keydown', (e) => {
    if (!myId || document.activeElement === chatInput) return;
    if (e.key === 'Enter') { e.preventDefault(); keys.clear(); chatInput.focus(); return; }
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => keys.clear());
  chatInput.addEventListener('focus', () => keys.clear());

  // ───────── 업데이트 ─────────
  let lastSent = 0, lastKey = '';
  function update(dt, now) {
    if (myId && players[myId]) {
      let vx = 0, vy = 0;
      if (keys.has('left')) vx -= 1;
      if (keys.has('right')) vx += 1;
      if (keys.has('up')) vy -= 1;
      if (keys.has('down')) vy += 1;
      me.moving = vx !== 0 || vy !== 0;
      if (me.moving) {
        if (vx && vy) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }
        if (vy < 0) me.dir = 'up'; else if (vy > 0) me.dir = 'down';
        if (vx < 0) me.dir = 'left'; else if (vx > 0) me.dir = 'right';
        const nx = me.x + vx * SPEED * dt, ny = me.y + vy * SPEED * dt;
        if (!blocked(nx, me.y)) me.x = nx;   // 벽에 비스듬히 부딪히면 미끄러지듯 이동
        if (!blocked(me.x, ny)) me.y = ny;
      }
      const p = players[myId];
      p.x = p.dx = me.x; p.y = p.dy = me.y; p.dir = me.dir; p.moving = me.moving;

      const key = `${me.x.toFixed(1)},${me.y.toFixed(1)},${me.dir},${me.moving}`;
      if (key !== lastKey && now - lastSent > 50) {
        lastKey = key; lastSent = now;
        socket.volatile.emit('move', { x: me.x, y: me.y, dir: me.dir, moving: me.moving });
      }
    }
    // 다른 사람 캐릭터는 부드럽게 따라가기
    const a = 1 - Math.exp(-dt * 14);
    for (const id in players) {
      if (id === myId) continue;
      const p = players[id];
      p.dx += (p.x - p.dx) * a;
      p.dy += (p.y - p.dy) * a;
    }
  }

  // ───────── 캐릭터 그리기 ─────────
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function drawChar(p, t) {
    const x = Math.round(p.dx), y = Math.round(p.dy);
    const R = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + rx, y + ry, w, h); };
    const step = p.moving ? Math.floor(t / 140) % 2 : -1;
    const b = p.moving && step === 0 ? -1 : 0; // 걸을 때 통통
    const skin = '#ffe0c2', hair = '#5b3a29', pants = '#4a3b5c';
    const body = p.color, bodyD = shade(p.color, -0.2);

    R('rgba(0,0,0,0.18)', -5, -1, 10, 2);
    // 다리
    if (step === -1) { R(pants, -4, -4, 3, 4); R(pants, 1, -4, 3, 4); }
    else if (step === 0) { R(pants, -4, -5, 3, 5); R(pants, 1, -4, 3, 3); }
    else { R(pants, -4, -4, 3, 3); R(pants, 1, -5, 3, 5); }
    // 몸통
    R(body, -5, -10 + b, 10, 6); R(bodyD, -5, -5 + b, 10, 1);
    R(skin, -6, -9 + b, 1, 4); R(skin, 5, -9 + b, 1, 4);
    // 머리
    const hy = -21 + b;
    R(skin, -6, hy + 1, 12, 10); R(skin, -5, hy, 10, 12);
    R(hair, -6, hy, 12, 3); R(hair, -5, hy - 1, 10, 1);
    if (p.dir === 'down') {
      R(hair, -6, hy + 3, 1, 4); R(hair, 5, hy + 3, 1, 4); R(hair, -3, hy + 3, 3, 1);
      R('#2b2233', -4, hy + 6, 2, 2); R('#2b2233', 2, hy + 6, 2, 2);
      R('#ffadc0', -5, hy + 8, 2, 1); R('#ffadc0', 3, hy + 8, 2, 1);
    } else if (p.dir === 'up') {
      R(hair, -6, hy, 12, 10); R(hair, -5, hy + 10, 10, 1);
    } else {
      const s = p.dir === 'left' ? 1 : -1; // 뒤통수 쪽
      R(hair, s > 0 ? 2 : -6, hy, 4, 9);
      R('#2b2233', s > 0 ? -4 : 2, hy + 6, 2, 2);
      R('#ffadc0', s > 0 ? -5 : 3, hy + 8, 2, 1);
    }
  }

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

  function drawLabels(p, id, camX, camY, now) {
    const sx = (p.dx - camX) * S, sy = (p.dy - camY) * S;
    const headTop = sy - 23 * S;
    const u = dpr;
    // 이름표
    ctx.font = `${12 * u}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const name = p.name + (id === myId ? ' ★' : '');
    const nw = ctx.measureText(name).width + 10 * u;
    ctx.fillStyle = 'rgba(74,59,92,0.75)';
    roundRect(sx - nw / 2, headTop - 18 * u, nw, 16 * u, 4 * u); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(name, sx, headTop - 10 * u);

    // 말풍선
    let text = null;
    if (p.bubble && p.bubble.until > now) text = p.bubble.text;
    else if (p.typing) text = '.'.repeat(1 + Math.floor(now / 350) % 3);
    if (!text) return;
    ctx.font = `${13 * u}px ${FONT}`;
    const lines = wrapText(text, 180 * u);
    const lh = 17 * u, pad = 8 * u;
    const bw = Math.max(30 * u, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
    const bh = lines.length * lh + pad * 2 - 4 * u;
    const bx = sx - bw / 2, by = headTop - 26 * u - bh;
    const life = p.bubble && p.bubble.until > now ? p.bubble.until - now : BUBBLE_MS;
    ctx.globalAlpha = Math.min(1, life / 400);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#4a3b5c'; ctx.lineWidth = 2 * u;
    roundRect(bx, by, bw, bh, 6 * u); ctx.fill(); ctx.stroke();
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(sx - 6 * u, by + bh - 1 * u); ctx.lineTo(sx, by + bh + 7 * u); ctx.lineTo(sx + 6 * u, by + bh - 1 * u);
    ctx.fill(); ctx.stroke();
    ctx.fillRect(sx - 5 * u, by + bh - 3 * u, 10 * u, 3 * u);
    ctx.fillStyle = '#4a3b5c';
    lines.forEach((l, i) => ctx.fillText(l, sx, by + pad + lh / 2 - 2 * u + i * lh));
    ctx.globalAlpha = 1;
  }

  // ───────── 화면 그리기 ─────────
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2f6b3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const vw = canvas.width / S, vh = canvas.height / S;
    const mw = W * TILE, mh = H * TILE;
    const focus = myId ? me : { x: mw / 2, y: mh / 2 };
    let camX = mw <= vw ? (mw - vw) / 2 : Math.min(mw - vw, Math.max(0, focus.x - vw / 2));
    let camY = mh <= vh ? (mh - vh) / 2 : Math.min(mh - vh, Math.max(0, focus.y - vh / 2));
    camX = Math.round(camX * S) / S; camY = Math.round(camY * S) / S;

    ctx.setTransform(S, 0, 0, S, -camX * S, -camY * S);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(mapCanvas, 0, 0);

    const order = Object.entries(players).sort((a, b) => a[1].dy - b[1].dy);
    order.forEach(([, p]) => drawChar(p, now));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    order.forEach(([id, p]) => drawLabels(p, id, camX, camY, now));
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
