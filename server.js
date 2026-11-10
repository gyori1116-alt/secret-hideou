// 비밀 아지트 - 실시간 서버 (Express + Socket.IO)
// 맵(블록·작물), 플레이어 가방·코인·퀘스트를 서버가 관리하고 저장해요.
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const ROOM_CODE = (process.env.ROOM_CODE || '').trim();           // 비밀 코드 (선택)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_URL = process.env.UPSTASH_REDIS_REST_URL;                 // 무료 클라우드 저장소 (선택)
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const { TILE, W, H } = S;

// ───────── 저장소: Upstash 가 설정되어 있으면 클라우드, 아니면 data 폴더 ─────────
async function upstash(cmd) {
  const r = await fetch(UP_URL, { method: 'POST', headers: { Authorization: `Bearer ${UP_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
async function loadData(key) {
  try {
    if (UP_URL && UP_TOKEN) {
      const v = await upstash(['GET', 'hideout:' + key]);
      return v ? JSON.parse(v) : null;
    }
    return JSON.parse(await fs.promises.readFile(path.join(DATA_DIR, key + '.json'), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('불러오기 실패', key, e.message);
    return null;
  }
}
async function saveData(key, obj) {
  const s = JSON.stringify(obj);
  if (UP_URL && UP_TOKEN) return upstash(['SET', 'hideout:' + key, s]);
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const f = path.join(DATA_DIR, key + '.json');
  await fs.promises.writeFile(f + '.tmp', s);
  await fs.promises.rename(f + '.tmp', f);
}

// ───────── 월드 ─────────
let world = null;           // { ground: string[][], objects: Map<"x,y", obj> }
let profiles = {};          // 이름(소문자) -> { name, coins, inv, stats, claimed, unlocked, avatar, x, y }
let worldDirty = false, profilesDirty = false;
const pending = new Map();  // 바뀐 타일 (모두에게 보낼 것)

const key = (x, y) => x + ',' + y;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const getO = (x, y) => world.objects.get(key(x, y)) || null;
function setTile(x, y, g, o) {
  if (g !== undefined) world.ground[y][x] = g;
  if (o !== undefined) { if (o) world.objects.set(key(x, y), o); else world.objects.delete(key(x, y)); }
  pending.set(key(x, y), [x, y]);
  worldDirty = true;
}
const serializeWorld = () => ({
  version: S.WORLD_VERSION, w: W, h: H, ground: world.ground, objects: Object.fromEntries(world.objects),
  animals: [...animals.values()].filter((a) => !S.ANIMALS[a.kind].wild)
    .map((a) => ({ kind: a.kind, x: a.x, y: a.y, hx: a.hx, hy: a.hy, fed: a.fed, ready: a.ready, readyAt: a.readyAt, owner: a.owner })),
});

// ───────── 동물 ─────────
const animals = new Map();  // id -> { id, kind, x, y, hx, hy, tx, ty, dir, moving, fed, ready, readyAt, hp, hurtAt, owner, nextThink }
let nextAnimalId = 1, animalsDirty = true;
function spawnAnimal(a) {
  const def = S.ANIMALS[a.kind];
  const an = Object.assign({ hx: a.x, hy: a.y, fed: false, ready: false, readyAt: 0, owner: null }, a, {
    id: 'a' + nextAnimalId++, tx: a.x, ty: a.y, dir: 'right', moving: false, hp: def.hp || 1, hurtAt: 0, nextThink: 0,
  });
  animals.set(an.id, an);
  animalsDirty = true;
  return an;
}
const isSolidAt = (px, py) => {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (!inMap(tx, ty)) return true;
  return world.ground[ty][tx] === 'water' || S.isSolidObj(getO(tx, ty));
};
const blockedAt = (x, y, r = 4) => isSolidAt(x - r, y - 3) || isSolidAt(x + r, y - 3) || isSolidAt(x - r, y) || isSolidAt(x + r, y);
// 그 칸 위에 있는 동물
function animalAt(x, y) {
  const cx = x * TILE + 8, cy = y * TILE + 8;
  let best = null, bd = 13;
  for (const a of animals.values()) {
    const d = Math.hypot(a.x - cx, a.y - 4 - cy);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
const pubAnimal = (a) => [a.id, a.kind, Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.dir === 'left' ? 1 : 0, a.moving ? 1 : 0,
  (a.ready ? 1 : 0) | (a.fed ? 2 : 0) | (Date.now() - a.hurtAt < 400 ? 4 : 0)];

// ───────── 서버 ─────────
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server);
const ROOM = 'hideout';

const players = {};     // socket.id -> { id, name, key, x, y, dir, moving, avatar, fishing, prof, socket }
const chatLog = [];
let stateDirty = false;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const DIRS = new Set(['up', 'down', 'left', 'right']);
const pub = (p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, dir: p.dir, moving: p.moving, avatar: p.avatar, fishing: p.fishing ? { x: p.fishing.x, y: p.fishing.y } : null });

function pushChat(msg) {
  chatLog.push(msg);
  if (chatLog.length > 50) chatLog.shift();
  io.to(ROOM).emit('chat', msg);
}
const sys = (text) => pushChat({ system: true, text, t: Date.now() });
const toast = (socket, text) => socket.emit('toast', text);

function sendMe(p) {
  const pr = p.prof;
  p.socket.emit('me', { coins: pr.coins, inv: pr.inv, stats: pr.stats, claimed: pr.claimed, unlocked: pr.unlocked, avatar: pr.avatar });
  profilesDirty = true;
}
function give(p, id, n) {
  const left = S.addItem(p.prof.inv, id, n);
  if (left > 0) toast(p.socket, '가방이 가득 찼어요! 🎒');
}
const stat = (p, k, n = 1) => { p.prof.stats[k] = (p.prof.stats[k] || 0) + n; };
function inReach(p, x, y, extra = 0) {
  const dx = x * TILE + 8 - p.x, dy = y * TILE + 8 - (p.y - 6);
  return Math.hypot(dx, dy) <= S.REACH + extra;
}
// 그 칸에 누가 서 있는지 (발밑 상자 기준)
function occupied(x, y) {
  return Object.values(players).some((p) =>
    p.x + 4 > x * TILE && p.x - 4 < (x + 1) * TILE && p.y > y * TILE && p.y - 3 < (y + 1) * TILE);
}
const rand = Math.random;
// 받침에 맞는 조사 붙이기: j('닭', '이', '가') → '닭이', j('소', '이', '가') → '소가'
function j(word, withBatchim, without) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 ? withBatchim : without);
}

// ───────── 블록 놓기 / 부수기 / 상호작용 ─────────
function hurtAnimal(p, a, dmg) {
  const def = S.ANIMALS[a.kind];
  a.hp -= dmg;
  a.hurtAt = Date.now();
  animalsDirty = true;
  // 맞으면 도망
  const ang = Math.atan2(a.y - p.y, a.x - p.x);
  a.tx = a.x + Math.cos(ang) * 48; a.ty = a.y + Math.sin(ang) * 48; a.nextThink = Date.now() + 1500;
  if (a.hp > 0) return null;
  animals.delete(a.id);
  for (const [id, n] of Object.entries(def.drop)) give(p, id, n);
  stat(p, 'hunt');
  io.to(ROOM).emit('fx', { x: a.x, y: a.y - 10, text: '💥' });
  return `${def.name} 사냥 성공! ${Object.entries(def.drop).map(([id, n]) => `${S.ITEMS[id].name} ${n}`).join(', ')} 🏹`;
}

function animalAct(p, type, a, slot) {
  const def = S.ANIMALS[a.kind];
  const heart = () => io.to(ROOM).emit('fx', { x: a.x, y: a.y - 14, text: '💕' });
  if (type === 'break') {
    if (def.wild) return hurtAnimal(p, a, 1);
    animals.delete(a.id);
    animalsDirty = worldDirty = true;
    give(p, def.item, 1);
    return `${j(def.name, '을', '를')} 가방에 넣었어요`;
  }
  if (def.wild) return type === 'interact' ? `야생 ${def.name}예요! 활(Space)이나 X로 사냥할 수 있어요` : null;
  if (type === 'interact') {
    if (a.ready) {
      a.ready = false; animalsDirty = worldDirty = true;
      give(p, def.produce, 1);
      stat(p, 'produce');
      heart();
      return `${j(S.ITEMS[def.produce].name, '을', '를')} 얻었어요! 🎁`;
    }
    heart();
    return a.fed ? `${j(def.name, '이', '가')} 배불러서 행복해요 💕` : `쓰담쓰담 💕 ${j(def.name, '이', '가')} 배고파 보여요 (작물을 들고 Space)`;
  }
  if (type === 'use') {
    const it = p.prof.inv[slot];
    if (!it || !S.FEED.includes(it.id)) return null;
    if (a.ready) return `먼저 선물을 받아주세요 (E)`;
    if (a.fed) return `${j(def.name, '은', '는')} 이미 배불러요`;
    a.fed = true; a.readyAt = Date.now() + def.produceMs;
    animalsDirty = worldDirty = true;
    it.n -= 1; if (it.n <= 0) p.prof.inv[slot] = null;
    stat(p, 'feed');
    heart();
    return `냠냠! ${j(def.name, '이', '가')} ${j(S.ITEMS[it.id].name, '을', '를')} 먹었어요 😋`;
  }
  return null;
}

function handleAct(p, type, x, y, slot) {
  const g = world.ground[y][x];
  const o = getO(x, y);
  const an = animalAt(x, y);
  if (an) {
    const it = p.prof.inv[slot];
    const usable = type !== 'use' || (it && (S.FEED.includes(it.id) || S.ITEMS[it.id].tool === 'bow'));
    if (usable) return animalAct(p, type, an, slot);
  }

  if (type === 'break') {
    if (o) {
      const def = S.OBJ[o.t] || {};
      if (def.fixed || o.fixed) return '이건 부술 수 없어요';
      if (o.t === 'crop') {
        setTile(x, y, undefined, null);
        if (o.stage === 0) give(p, S.CROPS[o.kind].seed, 1);
        return null;
      }
      if (def.drop) {
        for (const [id, n] of Object.entries(def.drop)) { give(p, id, n); stat(p, id, n); }
      }
      if (def.item) give(p, def.item, 1);
      setTile(x, y, undefined, def.regrow ? { t: def.regrow, at: Date.now() + def.regrowMs } : null);
      return null;
    }
    const gd = S.GROUND[g];
    if (gd && gd.item) { give(p, gd.item, 1); setTile(x, y, 'grass'); return null; }
    if (g === 'farm') { setTile(x, y, 'grass'); return null; }
    return null;
  }

  if (type === 'interact') {
    if (!o) return null;
    if (o.t === 'door') {
      if (o.open && occupied(x, y)) return '문 사이에 누가 있어요!';
      setTile(x, y, undefined, Object.assign({}, o, { open: !o.open }));
      return null;
    }
    if (o.t === 'crop') {
      if (o.stage < 3) return o.water ? '쑥쑥 자라는 중이에요 🌱' : '물이 필요해요 💧 (물뿌리개)';
      const c = S.CROPS[o.kind];
      const n = c.yield[0] + Math.floor(rand() * (c.yield[1] - c.yield[0] + 1));
      give(p, c.produce, n);
      if (rand() < 0.5) give(p, c.seed, 1);
      stat(p, 'harvest', n);
      setTile(x, y, undefined, null);
      return `${c.name} ${n}개 수확! 🎉`;
    }
    return null;
  }

  if (type === 'use') {
    const it = p.prof.inv[slot];
    if (!it) return null;
    const def = S.ITEMS[it.id];
    if (!def) return null;
    const take = () => { it.n -= 1; if (it.n <= 0) p.prof.inv[slot] = null; };

    if (def.tool === 'hoe') {
      if (o) return '위에 있는 걸 먼저 치워주세요 (X)';
      if (g === 'farm') return null;
      if (g !== 'grass') return '풀밭에서만 밭을 갈 수 있어요';
      setTile(x, y, 'farm');
      return null;
    }
    if (def.tool === 'can') {
      if (!o || o.t !== 'crop') return '심은 작물에 물을 줘요';
      if (o.stage >= 3) return '다 자랐어요! E로 수확하세요';
      if (o.water) return '이미 촉촉해요 💧';
      setTile(x, y, undefined, Object.assign({}, o, { water: true, since: Date.now() }));
      return null;
    }
    if (def.tool) return null;
    if (def.animal) {
      if (g === 'water' || S.isSolidObj(o)) return '동물이 설 수 있는 곳에 풀어주세요';
      if ([...animals.values()].filter((a) => !S.ANIMALS[a.kind].wild).length >= 40) return '동물이 너무 많아요!';
      spawnAnimal({ kind: def.animal, x: x * TILE + 8, y: y * TILE + 12, owner: p.name });
      worldDirty = true;
      take();
      return `${j(S.ANIMALS[def.animal].name, '을', '를')} 풀어줬어요! 작물을 먹여 보세요 🥕`;
    }
    if (def.seed) {
      if (g !== 'farm') return '괭이로 간 밭에 심어주세요';
      if (o) return '이미 뭔가 심어져 있어요';
      setTile(x, y, undefined, { t: 'crop', kind: def.seed, stage: 0, water: false, since: Date.now() });
      take();
      return null;
    }
    if (def.ground) {
      if (o) return '위에 물건이 있어요';
      if (g === 'water') return '물 위에는 깔 수 없어요';
      if (g === def.ground) return null;
      const old = S.GROUND[g];
      if (old && old.item) give(p, old.item, 1);
      setTile(x, y, def.ground);
      take();
      if (def.cat === 'path') stat(p, 'pathPlaced');
      return null;
    }
    if (def.obj) {
      if (o) return '이미 뭔가 있어요';
      if (g === 'water') return '물 위에는 놓을 수 없어요';
      const od = S.OBJ[def.obj];
      if (od.solid && occupied(x, y)) return '누가 서 있어요!';
      const obj = { t: def.obj };
      if (def.obj === 'sapling') obj.at = Date.now() + S.SAPLING_MS;
      if (def.obj === 'sign') obj.text = '';
      setTile(x, y, undefined, obj);
      take();
      if (def.cat === 'wall') stat(p, 'wallPlaced');
      if (def.cat === 'furniture') stat(p, 'furniturePlaced');
      if (def.cat === 'sign') { stat(p, 'sign'); p.socket.emit('editSign', { x, y }); }
      return null;
    }
  }
  return null;
}

// ───────── 낚시 ─────────
function endFishing(p, result) {
  if (!p.fishing) return;
  clearTimeout(p.fishing.timer);
  p.fishing = null;
  io.to(ROOM).emit('playerFx', { id: p.id, fishing: null });
  if (result) p.socket.emit('fishResult', result);
}

// ───────── 접속 ─────────
io.on('connection', (socket) => {
  let lastChat = 0, lastAct = 0;
  const me = () => players[socket.id];

  socket.on('join', (data = {}) => {
    if (players[socket.id]) return;
    if (ROOM_CODE && String(data.code || '').trim() !== ROOM_CODE) return socket.emit('joinError', '비밀 코드가 틀렸어요 🔒');
    const name = String(data.name || '').trim().slice(0, 12);
    if (!name) return socket.emit('joinError', '이름을 입력해 주세요');
    const k = name.toLowerCase();
    const dup = Object.values(players).find((q) => q.key === k);
    if (dup) {
      if (!data.rejoin) return socket.emit('joinError', '이미 같은 이름으로 접속 중이에요');
      dup.socket.disconnect(true);
    }

    let prof = profiles[k];
    const isNew = !prof;
    if (!prof) {
      prof = profiles[k] = { name, coins: 100, inv: S.starterInventory(), stats: {}, claimed: [], unlocked: S.FREE_ACC.slice(), avatar: S.defaultAvatar(rand), x: null, y: null };
      profilesDirty = true;
    }
    let x = S.SPAWN.x + (rand() * 16 - 8), y = S.SPAWN.y;
    if (isNum(prof.x) && isNum(prof.y)) { x = prof.x; y = prof.y; }

    const p = players[socket.id] = { id: socket.id, name: prof.name, key: k, x, y, dir: 'down', moving: false, avatar: prof.avatar, fishing: null, prof, socket };
    socket.join(ROOM);
    const ps = {};
    for (const q of Object.values(players)) ps[q.id] = pub(q);
    socket.emit('init', { id: socket.id, players: ps, chatLog, world: serializeWorld(), animals: [...animals.values()].map(pubAnimal) });
    sendMe(p);
    socket.to(ROOM).emit('playerJoined', pub(p));
    if (!data.rejoin) sys(isNew ? `${prof.name} 님이 처음으로 아지트에 왔어요! 🎉` : `${prof.name} 님이 들어왔어요 🏠`);
    stateDirty = true;
  });

  socket.on('move', (d = {}) => {
    const p = me();
    if (!p || !isNum(d.x) || !isNum(d.y)) return;
    p.x = clamp(d.x, 0, W * TILE);
    p.y = clamp(d.y, 0, H * TILE);
    if (DIRS.has(d.dir)) p.dir = d.dir;
    p.moving = !!d.moving;
    stateDirty = true;
  });

  socket.on('chat', (text) => {
    const p = me();
    if (!p) return;
    const now = Date.now();
    if (now - lastChat < 300) return;
    lastChat = now;
    text = String(text || '').trim().slice(0, 200);
    if (!text) return;
    stat(p, 'chat');
    sendMe(p);
    pushChat({ id: p.id, name: p.name, color: S.CLOTH[p.avatar.tc], text, t: now });
  });

  socket.on('typing', (on) => { if (me()) socket.to(ROOM).emit('typing', { id: socket.id, on: !!on }); });

  socket.on('act', (a = {}) => {
    const p = me();
    if (!p) return;
    const now = Date.now();
    if (now - lastAct < 80) return;
    lastAct = now;
    const x = a.x | 0, y = a.y | 0, slot = a.slot | 0;
    if (!inMap(x, y) || slot < 0 || slot >= S.INV_SIZE) return;
    if (!['use', 'break', 'interact'].includes(a.type)) return;
    if (!inReach(p, x, y, 8)) return toast(socket, '너무 멀어요');
    const msg = handleAct(p, a.type, x, y, slot);
    if (msg) toast(socket, msg);
    sendMe(p);
  });

  socket.on('swap', ({ a, b } = {}) => {
    const p = me();
    if (!p || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= S.INV_SIZE || b >= S.INV_SIZE) return;
    const inv = p.prof.inv;
    if (inv[a] && inv[b] && inv[a].id === inv[b].id && a !== b) { // 같은 아이템이면 합치기
      const max = S.ITEMS[inv[a].id].stack;
      const k = Math.min(inv[a].n, max - inv[b].n);
      inv[b].n += k; inv[a].n -= k;
      if (inv[a].n <= 0) inv[a] = null;
    } else {
      [inv[a], inv[b]] = [inv[b], inv[a]];
    }
    sendMe(p);
  });

  socket.on('trash', ({ slot } = {}) => {
    const p = me();
    if (!p || !Number.isInteger(slot) || slot < 0 || slot >= S.INV_SIZE) return;
    p.prof.inv[slot] = null;
    sendMe(p);
  });

  socket.on('buy', ({ id, n } = {}) => {
    const p = me();
    const entry = S.SHOP.find((e) => e[0] === id);
    n = [1, 5, 10].includes(n) ? n : 1;
    if (!p || !entry) return;
    const cost = entry[1] * n;
    if (p.prof.coins < cost) return toast(socket, '코인이 부족해요 💰');
    p.prof.coins -= cost;
    const left = S.addItem(p.prof.inv, id, n);
    if (left) { p.prof.coins += entry[1] * left; toast(socket, '가방이 가득 찼어요! 🎒'); }
    else toast(socket, `${S.ITEMS[id].name} ${n}개 샀어요!`);
    sendMe(p);
  });

  socket.on('sell', ({ id, all } = {}) => {
    const p = me();
    const def = S.ITEMS[id];
    if (!p || !def || !def.sell) return;
    const have = S.countItem(p.prof.inv, id);
    const n = all ? have : Math.min(1, have);
    if (!n) return;
    S.removeItem(p.prof.inv, id, n);
    const earned = def.sell * n;
    p.prof.coins += earned;
    stat(p, 'earned', earned);
    toast(socket, `${def.name} ${n}개 팔았어요 +${earned}💰`);
    sendMe(p);
  });

  socket.on('buyAcc', ({ id } = {}) => {
    const p = me();
    const acc = S.ACCESSORIES.find((a) => a.id === id);
    if (!p || !acc || !acc.price || p.prof.unlocked.includes(id)) return;
    if (p.prof.coins < acc.price) return toast(socket, '코인이 부족해요 💰');
    p.prof.coins -= acc.price;
    p.prof.unlocked.push(id);
    toast(socket, `${j(acc.name, '을', '를')} 얻었어요! 꾸미기(C)에서 써보세요`);
    sendMe(p);
  });

  socket.on('craft', ({ i } = {}) => {
    const p = me();
    const r = S.RECIPES[i];
    if (!p || !r) return;
    for (const [id, n] of Object.entries(r.need)) if (S.countItem(p.prof.inv, id) < n) return toast(socket, '재료가 부족해요');
    for (const [id, n] of Object.entries(r.need)) S.removeItem(p.prof.inv, id, n);
    give(p, r.out, r.n);
    toast(socket, `${S.ITEMS[r.out].name} ${r.n}개를 만들었어요! 🔨`);
    sendMe(p);
  });

  socket.on('claim', ({ id } = {}) => {
    const p = me();
    const q = S.QUESTS.find((x) => x.id === id);
    if (!p || !q || p.prof.claimed.includes(id) || (p.prof.stats[q.stat] || 0) < q.goal) return;
    p.prof.claimed.push(id);
    const rw = q.reward;
    if (rw.coins) p.prof.coins += rw.coins;
    if (rw.items) for (const [iid, n] of Object.entries(rw.items)) give(p, iid, n);
    if (rw.unlock && !p.prof.unlocked.includes(rw.unlock)) p.prof.unlocked.push(rw.unlock);
    toast(socket, `퀘스트 완료! "${q.name}" 보상을 받았어요 🎁`);
    sys(`${p.name} 님이 퀘스트 "${q.name}" 완료! 🏆`);
    sendMe(p);
  });

  socket.on('avatar', (av) => {
    const p = me();
    if (!p) return;
    p.prof.avatar = p.avatar = S.sanitizeAvatar(av, p.prof.unlocked);
    p.prof.stats.avatar = (p.prof.stats.avatar || 0) + 1;
    io.to(ROOM).emit('playerUpdate', { id: p.id, avatar: p.avatar });
    toast(socket, '새 모습 저장 완료! ✨');
    sendMe(p);
  });

  socket.on('signText', ({ x, y, text } = {}) => {
    const p = me();
    x |= 0; y |= 0;
    if (!p || !inMap(x, y)) return;
    const o = getO(x, y);
    if (!o || o.t !== 'sign') return;
    if (!inReach(p, x, y, TILE * 2)) return toast(socket, '표지판에 더 가까이 가주세요');
    setTile(x, y, undefined, Object.assign({}, o, { text: String(text || '').trim().slice(0, 40) }));
  });

  socket.on('fishCast', ({ x, y } = {}) => {
    const p = me();
    x |= 0; y |= 0;
    if (!p || p.fishing || !inMap(x, y)) return;
    if (world.ground[y][x] !== 'water') return toast(socket, '물을 바라보고 던져요 🎣');
    if (!inReach(p, x, y, 8)) return toast(socket, '물에 더 가까이 가주세요');
    if (!S.countItem(p.prof.inv, 'rod')) return;
    const biteIn = 1500 + rand() * 4500;
    const f = p.fishing = { x, y, biteAt: Date.now() + biteIn, timer: null };
    io.to(ROOM).emit('playerFx', { id: p.id, fishing: { x, y } });
    f.timer = setTimeout(() => {
      if (p.fishing !== f) return;
      socket.emit('fishBite');
      f.timer = setTimeout(() => endFishing(p, { ok: false, text: '놓쳤어요... 😢' }), S.BITE_WINDOW + 400);
    }, biteIn);
  });

  socket.on('fishReel', () => {
    const p = me();
    if (!p || !p.fishing) return;
    const now = Date.now();
    if (now < p.fishing.biteAt) return endFishing(p, { ok: false, text: '너무 일찍 당겼어요! 😅' });
    const id = S.rollFish(rand);
    const def = S.ITEMS[id];
    give(p, id, 1);
    if (def.fish) stat(p, 'fish');
    endFishing(p, { ok: true, item: id, text: `${def.name}${id === 'boot' ? '를 건졌어요... 👢' : '를 낚았어요! 🎣'}` });
    if (id === 'fish_golden') sys(`✨ ${p.name} 님이 전설의 황금잉어를 낚았어요! ✨`);
    sendMe(p);
  });

  socket.on('fishCancel', () => { const p = me(); if (p) endFishing(p, null); });

  // 활 쏘기: (ax, ay) 방향으로 화살이 날아가다 처음 만난 야생 동물에 맞아요
  let lastShot = 0;
  socket.on('shoot', ({ ax, ay } = {}) => {
    const p = me();
    const now = Date.now();
    if (!p || now - lastShot < 500 || !isNum(ax) || !isNum(ay)) return;
    if (!S.countItem(p.prof.inv, 'bow')) return;
    const len = Math.hypot(ax, ay);
    if (len < 0.01) return;
    lastShot = now;
    ax /= len; ay /= len;
    const x0 = p.x, y0 = p.y - 8;
    let x1 = x0, y1 = y0, hit = null;
    for (let d = 6; d <= S.BOW_RANGE; d += 3) {
      const px = x0 + ax * d, py = y0 + ay * d;
      const tx = Math.floor(px / TILE), ty = Math.floor((py + 8) / TILE); // 화살 그림자(땅) 위치로 장애물 확인
      if (!inMap(tx, ty) || S.isSolidObj(getO(tx, ty))) break;
      x1 = px; y1 = py;
      for (const a of animals.values()) {
        if (S.ANIMALS[a.kind].wild && Math.hypot(a.x - px, a.y - 5 - py) < 9) { hit = a; break; }
      }
      if (hit) break;
    }
    io.to(ROOM).emit('arrow', { x0, y0, x1, y1 });
    if (hit) {
      const msg = hurtAnimal(p, hit, 1);
      toast(socket, msg || `명중! 🎯 (${S.ANIMALS[hit.kind].name})`);
      sendMe(p);
    }
  });

  socket.on('disconnect', () => {
    const p = me();
    if (!p) return;
    endFishing(p, null);
    p.prof.x = p.x; p.prof.y = p.y;
    profilesDirty = true;
    delete players[socket.id];
    io.to(ROOM).emit('playerLeft', socket.id);
    if (!Object.values(players).some((q) => q.key === p.key)) sys(`${p.name} 님이 나갔어요 👋`);
  });
});

// ───────── 반복 작업 ─────────
// 위치·바뀐 블록을 초당 20번 전송
setInterval(() => {
  if (stateDirty) {
    stateDirty = false;
    const state = Object.values(players).map((p) => [p.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.dir, p.moving ? 1 : 0]);
    io.to(ROOM).volatile.emit('state', state);
  }
  if (pending.size) {
    const tiles = [...pending.values()].map(([x, y]) => ({ x, y, g: world.ground[y][x], o: getO(x, y) }));
    pending.clear();
    io.to(ROOM).emit('tiles', tiles);
  }
}, 50);

// 작물 성장, 나무·바위 다시 자라기 (1초마다)
setInterval(() => {
  if (!world) return;
  const now = Date.now();
  for (const [k, o] of world.objects) {
    const [x, y] = k.split(',').map(Number);
    if (o.t === 'crop') {
      const c = S.CROPS[o.kind];
      if (o.water && o.stage < 3 && now - o.since >= c.stageMs) setTile(x, y, undefined, Object.assign({}, o, { stage: o.stage + 1, water: false, since: now }));
    } else if ((o.t === 'stump' || o.t === 'pebble' || o.t === 'sapling') && o.at && now >= o.at) {
      if (occupied(x, y)) setTile(x, y, undefined, Object.assign({}, o, { at: now + 5000 }));
      else setTile(x, y, undefined, { t: o.t === 'pebble' ? 'rock' : 'tree' });
    }
  }
}, 1000);

// 동물 움직임 (초당 10번)
let lastWildSpawn = 0;
function randomSpawnTile(kind) {
  // 토끼: 풀밭 어디든 / 멧돼지: 왼쪽 위 숲
  for (let i = 0; i < 40; i++) {
    const x = kind === 'boar' ? 3 + Math.floor(rand() * 16) : 3 + Math.floor(rand() * (W - 6));
    const y = kind === 'boar' ? 3 + Math.floor(rand() * 16) : 3 + Math.floor(rand() * (H - 6));
    if (world.ground[y][x] !== 'grass' || getO(x, y)) continue;
    const px = x * TILE + 8, py = y * TILE + 12;
    if (Object.values(players).some((p) => Math.hypot(p.x - px, p.y - py) < TILE * 6)) continue;
    return { x: px, y: py };
  }
  return null;
}
setInterval(() => {
  if (!world) return;
  const now = Date.now(), dt = 0.1;
  // 야생 동물이 부족하면 새로 나타나요
  if (now - lastWildSpawn > 15000) {
    lastWildSpawn = now;
    for (const [kind, max] of Object.entries(S.WILD_SPAWN)) {
      const n = [...animals.values()].filter((a) => a.kind === kind).length;
      if (n < max) { const t = randomSpawnTile(kind); if (t) spawnAnimal({ kind, x: t.x, y: t.y }); }
    }
  }
  const plist = Object.values(players);
  for (const a of animals.values()) {
    const def = S.ANIMALS[a.kind];
    if (a.fed && !a.ready && now >= a.readyAt) { a.fed = false; a.ready = true; animalsDirty = worldDirty = true; }
    let speed = def.speed;
    // 토끼는 사람이 가까이 오면 도망
    if (def.flee) {
      const near = plist.find((p) => Math.hypot(p.x - a.x, p.y - a.y) < 40);
      if (near) {
        const ang = Math.atan2(a.y - near.y, a.x - near.x);
        a.tx = a.x + Math.cos(ang) * 40; a.ty = a.y + Math.sin(ang) * 40; a.nextThink = now + 800;
        speed *= 2.2;
      }
    }
    if (now >= a.nextThink) {
      a.nextThink = now + 2000 + rand() * 4000;
      if (rand() < 0.45) { a.tx = a.x; a.ty = a.y; } // 가만히 있기
      else {
        const r = def.wild ? 56 : 40;
        let tx = a.x + (rand() * 2 - 1) * r, ty = a.y + (rand() * 2 - 1) * r;
        if (!def.wild && Math.hypot(tx - a.hx, ty - a.hy) > TILE * 5) { tx = a.hx; ty = a.hy; } // 집동물은 집 근처
        a.tx = tx; a.ty = ty;
      }
    }
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    const wasMoving = a.moving;
    if (d > 1) {
      const step = Math.min(d, speed * dt);
      const nx = a.x + (dx / d) * step, ny = a.y + (dy / d) * step;
      let moved = false;
      if (!blockedAt(nx, a.y)) { a.x = nx; moved = true; }
      if (!blockedAt(a.x, ny)) { a.y = ny; moved = true; }
      if (!moved) { a.tx = a.x; a.ty = a.y; }
      if (Math.abs(dx) > 0.5) a.dir = dx < 0 ? 'left' : 'right';
      a.moving = moved;
      animalsDirty = true;
    } else a.moving = false;
    if (wasMoving !== a.moving) animalsDirty = true;
  }
  if (animalsDirty) {
    animalsDirty = false;
    io.to(ROOM).volatile.emit('animals', [...animals.values()].map(pubAnimal));
  }
}, 100);

async function saveAll() {
  try {
    if (worldDirty) { worldDirty = false; await saveData('world', serializeWorld()); }
    if (profilesDirty) { profilesDirty = false; await saveData('profiles', profiles); }
  } catch (e) {
    worldDirty = profilesDirty = true;
    console.error('저장 실패:', e.message);
  }
}
setInterval(saveAll, 15000);

async function shutdown() {
  for (const p of Object.values(players)) { p.prof.x = p.x; p.prof.y = p.y; }
  profilesDirty = true;
  await saveAll();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ───────── 시작 ─────────
(async () => {
  const saved = process.env.RESET_WORLD ? null : await loadData('world');
  if (saved && saved.version === S.WORLD_VERSION && saved.w === W && saved.h === H) {
    world = { ground: saved.ground, objects: new Map(Object.entries(saved.objects)) };
    (saved.animals || []).forEach((a) => { if (S.ANIMALS[a.kind]) spawnAnimal(a); });
    console.log('🗺️  저장된 맵을 불러왔어요');
  } else {
    const g = S.generateWorld();
    world = { ground: g.ground, objects: new Map(Object.entries(g.objects)) };
    g.animals.forEach(spawnAnimal);
    worldDirty = true;
    console.log('🗺️  새 맵을 만들었어요');
  }
  profiles = (await loadData('profiles')) || {};
  server.listen(PORT, () => {
    console.log(`🏠 비밀 아지트 서버 실행 중: http://localhost:${PORT}`);
    console.log(UP_URL && UP_TOKEN ? '☁️  Upstash 클라우드에 저장해요' : `💾 ${DATA_DIR} 폴더에 저장해요`);
    if (ROOM_CODE) console.log('🔒 비밀 코드가 설정되어 있어요.');
  });
})();
