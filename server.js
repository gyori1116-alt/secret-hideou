// 알PDF - 실시간 서버 (Express + Socket.IO)
// 맵(블록·작물), 동물·강아지, 플레이어 가방·코인·퀘스트·도감·거래를 서버가 관리하고 저장해요.
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
// ⚠️ 저장 이름('hideout:')은 예전 데이터를 그대로 쓰려고 바꾸지 않아요.
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
let chests = new Map();     // "x,y" -> { items: [], owner, locked } (상자 안 물건은 서버만 알고, 연 사람에게만 보내요)
let profiles = {};          // 이름(소문자) -> 프로필
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
  version: S.WORLD_VERSION, w: W, h: H, ground: world.ground, objects: Object.fromEntries(world.objects), chests: Object.fromEntries(chests),
  animals: [...animals.values()].filter((a) => !S.ANIMALS[a.kind].wild)
    .map((a) => ({ kind: a.kind, x: a.x, y: a.y, hx: a.hx, hy: a.hy, fed: a.fed, ready: a.ready, readyAt: a.readyAt, owner: a.owner, mode: a.mode, pname: a.pname })),
});

// ───────── 동물 ─────────
const animals = new Map();
let nextAnimalId = 1, animalsDirty = true;
function spawnAnimal(a) {
  const def = S.ANIMALS[a.kind];
  const an = Object.assign({ hx: a.x, hy: a.y, fed: false, ready: false, readyAt: 0, owner: null }, a, {
    id: 'a' + nextAnimalId++, tx: a.x, ty: a.y, dir: 'right', moving: false, hp: def.hp || 1, hurtAt: 0, nextThink: 0, stuck: 0,
  });
  if (def.pet) { an.mode = an.mode || 'follow'; an.pname = an.pname || def.name; }
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
function animalAt(x, y) {
  const cx = x * TILE + 8, cy = y * TILE + 8;
  let best = null, bd = 13;
  for (const a of animals.values()) {
    const d = Math.hypot(a.x - cx, a.y - 4 - cy);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
const pubAnimal = (a) => {
  const r = [a.id, a.kind, Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.dir === 'left' ? 1 : 0, a.moving ? 1 : 0,
    (a.ready ? 1 : 0) | (a.fed ? 2 : 0) | (Date.now() - a.hurtAt < 400 ? 4 : 0)];
  if (S.ANIMALS[a.kind].pet) r.push(a.owner, a.pname, a.mode === 'follow' ? 1 : 0);
  return r;
};
const isOwner = (p, a) => !!a.owner && a.owner.toLowerCase() === p.key;
const ownerOnline = (a) => (a.owner ? Object.values(players).find((q) => q.key === a.owner.toLowerCase()) : null);

// ───────── 서버 ─────────
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.send('ok'));
const server = http.createServer(app);
const io = new Server(server);
const ROOM = 'hideout';

const players = {};     // socket.id -> { id, name, key, x, y, dir, moving, avatar, fishing, prof, socket, sel, held, pose, trade }
const chatLog = [];
const trades = new Map();
let stateDirty = false, nextTradeId = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const DIRS = new Set(['up', 'down', 'left', 'right']);
const pub = (p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, dir: p.dir, moving: p.moving, avatar: p.avatar, held: p.held, pose: p.pose,
  fishing: p.fishing ? { x: p.fishing.x, y: p.fishing.y } : null });

function pushChat(msg) {
  chatLog.push(msg);
  if (chatLog.length > 50) chatLog.shift();
  io.to(ROOM).emit('chat', msg);
}
const sys = (text) => pushChat({ system: true, text, t: Date.now() });
const toast = (socket, text) => socket.emit('toast', text);
const rand = Math.random;
// 받침에 맞는 조사 붙이기: j('닭', '이', '가') → '닭이'
function j(word, withBatchim, without) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 ? withBatchim : without);
}

// ───────── 프로필 ─────────
// 예전 프로필에 새 칸(도감, 기간 퀘스트 등)을 채워 넣어요. 원래 있던 값은 건드리지 않아요.
function ensureProfile(pr) {
  pr.stats = pr.stats || {};
  pr.claimed = pr.claimed || [];
  pr.unlocked = pr.unlocked || [];
  for (const id of S.FREE_ACC) if (!pr.unlocked.includes(id)) pr.unlocked.push(id);
  if (!Array.isArray(pr.inv)) pr.inv = S.starterInventory();
  while (pr.inv.length < S.INV_SIZE) pr.inv.push(null);
  pr.inv = pr.inv.map((it) => (it && S.ITEMS[it.id] && it.n > 0 ? it : null));
  if (!pr.col) {
    pr.col = {};
    for (const it of pr.inv) if (it && S.COL_INDEX[it.id]) pr.col[it.id] = 1;
  }
  pr.colClaimed = pr.colClaimed || [];
  pr.pq = pr.pq || {};
  pr.dlv = pr.dlv || 0;
  pr.stats.col = Object.keys(pr.col).length;
  pr.avatar = S.sanitizeAvatar(pr.avatar, pr.unlocked);
  if (!isNum(pr.coins)) pr.coins = 100;
  return pr;
}
// 기간 퀘스트: 날짜(한국 시간)가 바뀌면 새로 만들어요
function newPQ(pr, t, k, idx, list) {
  const avoid = list.filter((q) => !q.done).map((q) => q.stat);
  const lv = t === 'd' ? pr.dlv : 0;
  const q = S.makePQ(t, lv, `${pr.name}|${k}|${t}|${idx}|${lv}`, avoid);
  q.id = t + idx; q.base = pr.stats[q.stat] || 0; q.done = false;
  return q;
}
function refreshPQ(pr, now = Date.now()) {
  const per = S.periods(now);
  let changed = false;
  for (const t of ['d', 'w', 'm']) {
    const cur = pr.pq[t];
    if (cur && cur.key === per[t].key) continue;
    const list = [];
    for (let i = 0; i < S.PQ_SLOTS[t]; i++) list.push(newPQ(pr, t, per[t].key, i, list));
    pr.pq[t] = { key: per[t].key, list, n: S.PQ_SLOTS[t] };
    changed = true;
  }
  return changed;
}

function sendMe(p) {
  const pr = p.prof;
  const per = S.periods(Date.now());
  p.socket.emit('me', {
    coins: pr.coins, inv: pr.inv, stats: pr.stats, claimed: pr.claimed, unlocked: pr.unlocked, avatar: pr.avatar,
    col: pr.col, colClaimed: pr.colClaimed, pq: pr.pq, dlv: pr.dlv, ends: { d: per.d.ends, w: per.w.ends, m: per.m.ends }, now: Date.now(),
  });
  updateHeld(p);
  profilesDirty = true;
}
function updateHeld(p) {
  const it = p.prof.inv[p.sel | 0];
  const id = it ? it.id : null;
  if (id !== p.held) { p.held = id; io.to(ROOM).emit('held', { id: p.id, held: id }); }
}
function collect(p, k) {
  const pr = p.prof;
  if (!S.COL_INDEX[k]) return;
  if (pr.col[k]) { pr.col[k]++; return; }
  pr.col[k] = 1;
  pr.stats.col = Object.keys(pr.col).length;
  p.socket.emit('colNew', { key: k, name: S.colName(k) });
}
function give(p, id, n, noCol) {
  const left = S.addItem(p.prof.inv, id, n);
  if (left > 0) toast(p.socket, '가방이 가득 찼어요! 🎒');
  if (!noCol && n - left > 0) collect(p, id);
}
const stat = (p, k, n = 1) => { p.prof.stats[k] = (p.prof.stats[k] || 0) + n; };
// 보상 주기 + 받은 것 화면에 보여주기
function grant(p, title, rw) {
  const shown = { title, coins: rw.coins || 0, items: rw.items || {}, unlock: null, converted: 0 };
  if (rw.coins) p.prof.coins += rw.coins;
  if (rw.items) for (const [iid, n] of Object.entries(rw.items)) give(p, iid, n, true);
  if (rw.unlock) {
    if (p.prof.unlocked.includes(rw.unlock)) { p.prof.coins += 300; shown.converted = 300; }
    else { p.prof.unlocked.push(rw.unlock); shown.unlock = rw.unlock; }
  }
  p.socket.emit('reward', shown);
}
function inReach(p, x, y, extra = 0) {
  const dx = x * TILE + 8 - p.x, dy = y * TILE + 8 - (p.y - 6);
  return Math.hypot(dx, dy) <= S.REACH + extra;
}
function occupied(x, y) {
  return Object.values(players).some((p) =>
    p.x + 4 > x * TILE && p.x - 4 < (x + 1) * TILE && p.y > y * TILE && p.y - 3 < (y + 1) * TILE);
}
function setPose(p, pose) {
  p.pose = pose;
  if (pose) { p.x = pose.x * TILE + 8; p.y = pose.y * TILE + (pose.k === 'lie' ? 12 : 13); p.moving = false; }
  io.to(ROOM).emit('pose', { id: p.id, pose, x: p.x, y: p.y });
  stateDirty = true;
}
function nearStation(p) {
  const fx = Math.floor(p.x / TILE), fy = Math.floor(p.y / TILE);
  for (let y = fy - 3; y <= fy + 3; y++) for (let x = fx - 3; x <= fx + 3; x++) {
    const o = inMap(x, y) && getO(x, y);
    if (o && S.OBJ[o.t] && S.OBJ[o.t].cook && inReach(p, x, y, TILE * 2)) return true;
  }
  return false;
}
// ───────── 상자 ─────────
function getChest(x, y) {
  const k = key(x, y), o = getO(x, y);
  if (!o || o.t !== 'chest') return null;
  let c = chests.get(k);
  if (!c) { c = { items: new Array(S.CHEST_SIZE).fill(null), owner: null, locked: false }; chests.set(k, c); }
  return c;
}
const chestMine = (p, c) => !c.owner || c.owner.toLowerCase() === p.key;
function chestView(p, x, y) {
  const c = getChest(x, y);
  return c ? { x, y, items: c.items, owner: c.owner, locked: c.locked, mine: chestMine(p, c) } : null;
}
// 그 상자를 열어둔 사람 모두에게 새 내용 보내기
function sendChest(x, y) {
  const k = key(x, y);
  for (const q of Object.values(players)) if (q.viewChest === k) q.socket.emit('chest', chestView(q, x, y));
}
function openChest(p, x, y) {
  const c = getChest(x, y);
  if (!c) return null;
  if (c.locked && !chestMine(p, c)) return `🔒 ${c.owner} 님이 잠근 상자예요`;
  p.viewChest = key(x, y);
  p.socket.emit('chest', chestView(p, x, y));
  return null;
}
// 상자 조작 전에: 열어둔 상자가 맞는지, 손이 닿는지, 잠기지 않았는지
function usableChest(p, x, y) {
  x |= 0; y |= 0;
  if (!inMap(x, y) || p.viewChest !== key(x, y)) return null;
  const c = getChest(x, y);
  if (!c) return null;
  if (!inReach(p, x, y, TILE * 2)) { toast(p.socket, '상자에 더 가까이 가주세요'); return null; }
  if (c.locked && !chestMine(p, c)) return null;
  return c;
}
// from 칸의 묶음을 to 로 옮기기 (못 들어간 만큼은 그대로)
function moveStack(fromArr, slot, toArr) {
  const it = fromArr[slot];
  if (!it) return 0;
  const left = S.addItem(toArr, it.id, it.n);
  const moved = it.n - left;
  fromArr[slot] = left > 0 ? { id: it.id, n: left } : null;
  return moved;
}

const kstTime = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16);

// ───────── 블록 놓기 / 부수기 / 상호작용 ─────────
function hurtAnimal(p, a, dmg) {
  const def = S.ANIMALS[a.kind];
  a.hp -= dmg;
  a.hurtAt = Date.now();
  animalsDirty = true;
  const ang = Math.atan2(a.y - p.y, a.x - p.x);
  a.tx = a.x + Math.cos(ang) * 48; a.ty = a.y + Math.sin(ang) * 48; a.nextThink = Date.now() + 1500;
  if (a.hp > 0) return null;
  animals.delete(a.id);
  for (const [id, n] of Object.entries(def.drop)) give(p, id, n);
  stat(p, 'hunt');
  collect(p, 'hunt:' + a.kind);
  io.to(ROOM).emit('fx', { x: a.x, y: a.y - 10, text: '💥' });
  return `${def.name} 사냥 성공! ${Object.entries(def.drop).map(([id, n]) => `${S.ITEMS[id].name} ${n}`).join(', ')} 🏹`;
}

function animalAct(p, type, a, slot) {
  const def = S.ANIMALS[a.kind];
  const heart = () => io.to(ROOM).emit('fx', { x: a.x, y: a.y - 14, text: '💕' });
  if (def.pet) {
    if (type === 'break') {
      if (!isOwner(p, a)) return `${a.owner} 님의 강아지예요 🐶`;
      animals.delete(a.id);
      animalsDirty = worldDirty = true;
      give(p, def.item, 1, true);
      return `${j(a.pname, '을', '를')} 가방에 넣었어요`;
    }
    if (type === 'interact' || type === 'use') {
      heart(); stat(p, 'pet');
      return isOwner(p, a) ? null : `쓰담쓰담 💕 ${a.owner} 님의 ${a.pname}`;
    }
    return null;
  }
  if (type === 'break') {
    if (def.wild) return hurtAnimal(p, a, 1);
    animals.delete(a.id);
    animalsDirty = worldDirty = true;
    give(p, def.item, 1, true);
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

function pickAt(p, x, y, o, def) {
  const got = [];
  for (const [id, n] of Object.entries(def.pick)) { give(p, id, n); stat(p, id, n); got.push(`${S.ITEMS[id].name} ${n}`); }
  setTile(x, y, undefined, { t: def.regrow, at: Date.now() + def.regrowMs, back: o.t });
  io.to(ROOM).emit('fx', { x: x * TILE + 8, y: y * TILE, text: o.t === 'bush_berry' ? '🫐' : '🍄' });
  return `${got.join(', ')} 땄어요!`;
}

function waterCrop(x, y) {
  const o = inMap(x, y) && getO(x, y);
  if (!o || o.t !== 'crop' || o.stage >= 3 || o.water) return false;
  setTile(x, y, undefined, Object.assign({}, o, { water: true, since: Date.now() }));
  return true;
}

function handleAct(p, type, x, y, slot, rot) {
  const g = world.ground[y][x];
  const o = getO(x, y);
  const od = (o && S.OBJ[o.t]) || {};
  const an = animalAt(x, y);
  if (an) {
    const it = p.prof.inv[slot];
    const usable = type !== 'use' || (it && (S.FEED.includes(it.id) || S.ITEMS[it.id].tool === 'bow')) || S.ANIMALS[an.kind].pet && !it;
    if (usable) return animalAct(p, type, an, slot);
  }

  if (type === 'break') {
    if (o) {
      if (od.fixed || o.fixed) return '이건 부술 수 없어요';
      if (o.t === 'chest') {
        const c = getChest(x, y);
        if (c.locked && !chestMine(p, c)) return `🔒 ${c.owner} 님이 잠근 상자예요`;
        if (c.items.some(Boolean)) return '상자를 먼저 비워주세요 📦';
        chests.delete(key(x, y));
        for (const q of Object.values(players)) if (q.viewChest === key(x, y)) { q.viewChest = null; q.socket.emit('chest', null); }
      }
      if (o.t === 'crop') {
        setTile(x, y, undefined, null);
        if (o.stage === 0) give(p, S.CROPS[o.kind].seed, 1, true);
        return null;
      }
      if (od.pick) return pickAt(p, x, y, o, od);
      if (o.at && o.back) return '다시 자라는 중이에요 🌱';
      if (od.drop) {
        for (const [id, n] of Object.entries(od.drop)) { give(p, id, n); stat(p, id, n); }
        for (const [id, chance] of od.bonus || []) if (rand() < chance) { give(p, id, 1); stat(p, id, 1); }
      }
      if (od.item) give(p, od.item, 1, true);
      setTile(x, y, undefined, od.regrow ? { t: od.regrow, at: Date.now() + od.regrowMs, back: o.t } : null);
      return null;
    }
    const gd = S.GROUND[g];
    if (gd && gd.item) { give(p, gd.item, 1, true); setTile(x, y, S.zoneAt(x, y) === 'cave' ? 'cave' : S.zoneAt(x, y) === 'forest' ? 'forest' : 'grass'); return null; }
    if (g === 'farm') { setTile(x, y, 'grass'); return null; }
    return null;
  }

  if (type === 'interact') {
    if (!o) return null;
    if (od.door) {
      if (o.open && occupied(x, y)) return '문 사이에 누가 있어요!';
      setTile(x, y, undefined, Object.assign({}, o, { open: !o.open }));
      return null;
    }
    if (o.t === 'crop') {
      if (o.stage < 3) return o.water ? '쑥쑥 자라는 중이에요 🌱' : '물이 필요해요 💧 (물뿌리개)';
      const c = S.CROPS[o.kind];
      const n = c.yield[0] + Math.floor(rand() * (c.yield[1] - c.yield[0] + 1));
      give(p, c.produce, n);
      if (rand() < 0.5) give(p, c.seed, 1, true);
      stat(p, 'harvest', n);
      setTile(x, y, undefined, null);
      return `${c.name} ${n}개 수확! 🎉`;
    }
    if (od.pick) return pickAt(p, x, y, o, od);
    if (o.at && o.back) return '다시 자라는 중이에요 🌱';
    if (od.chest) return openChest(p, x, y);
    if (od.sit || od.lie) {
      const k = od.lie ? 'lie' : 'sit';
      if (Object.values(players).some((q) => q !== p && q.pose && q.pose.x === x && q.pose.y === y)) return '누가 먼저 쓰고 있어요!';
      if (p.fishing) endFishing(p, null);
      setPose(p, { k, x, y });
      stat(p, k);
      if (od.fx) io.to(ROOM).emit('fx', { x: x * TILE + 8, y: y * TILE, text: od.fx });
      return k === 'lie' ? '쿨쿨... 💤 (움직이면 일어나요)' : '털썩 🪑 (움직이면 일어나요)';
    }
    if (od.toggle) {
      const on = !o.on;
      setTile(x, y, undefined, Object.assign({}, o, { on }));
      if (on && o.t === 'tv') stat(p, 'tv');
      return null;
    }
    if (od.fx) { io.to(ROOM).emit('fx', { x: x * TILE + 8, y: y * TILE, text: od.fx }); return null; }
    if (od.msg) return od.msg === 'time' ? `🕰️ 지금은 ${kstTime()} 이에요` : od.msg;
    return null;
  }

  if (type === 'use') {
    const it = p.prof.inv[slot];
    if (!it) return null;
    const def = S.ITEMS[it.id];
    if (!def) return null;
    const take = () => { it.n -= 1; if (it.n <= 0) p.prof.inv[slot] = null; };

    if (def.food) {
      take();
      stat(p, 'eat');
      p.socket.emit('buff', { ms: S.FOOD_BUFF_MS });
      io.to(ROOM).emit('fx', { x: p.x, y: p.y - 28, text: '😋' });
      return `냠냠! ${j(def.name, '을', '를')} 먹었어요. 잠깐 빨라져요 💨`;
    }
    if (def.tool === 'hoe') {
      if (o) return '위에 있는 걸 먼저 치워주세요 (X)';
      if (g === 'farm') return null;
      if (g !== 'grass' && g !== 'forest') return '풀밭에서만 밭을 갈 수 있어요';
      setTile(x, y, 'farm');
      return null;
    }
    if (def.tool === 'can') {
      if (def.gold) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (waterCrop(x + dx, y + dy)) n++;
        if (!n) return '물 줄 작물이 없어요';
        stat(p, 'water', n);
        return null;
      }
      if (!o || o.t !== 'crop') return '심은 작물에 물을 줘요';
      if (o.stage >= 3) return '다 자랐어요! E로 수확하세요';
      if (o.water) return '이미 촉촉해요 💧';
      waterCrop(x, y);
      stat(p, 'water');
      return null;
    }
    if (def.tool) return null;
    if (def.animal) {
      const ad = S.ANIMALS[def.animal];
      if (g === 'water' || S.isSolidObj(o)) return '동물이 설 수 있는 곳에 풀어주세요';
      if (ad.pet) {
        if ([...animals.values()].filter((a) => S.ANIMALS[a.kind].pet && isOwner(p, a)).length >= S.MAX_PETS) return `강아지는 ${S.MAX_PETS}마리까지 데리고 있을 수 있어요`;
        spawnAnimal({ kind: def.animal, x: x * TILE + 8, y: y * TILE + 12, owner: p.prof.name, mode: 'follow' });
        worldDirty = true;
        take();
        return `${j(ad.name, '이', '가')} 나왔어요! 졸졸 따라와요 🐶 (E로 집에 두기)`;
      }
      if ([...animals.values()].filter((a) => !S.ANIMALS[a.kind].wild && !S.ANIMALS[a.kind].pet).length >= 40) return '동물이 너무 많아요!';
      spawnAnimal({ kind: def.animal, x: x * TILE + 8, y: y * TILE + 12, owner: p.name });
      worldDirty = true;
      take();
      return `${j(ad.name, '을', '를')} 풀어줬어요! 작물을 먹여 보세요 🥕`;
    }
    if (def.seed) {
      if (g !== 'farm') return '괭이로 간 밭에 심어주세요';
      if (o) return '이미 뭔가 심어져 있어요';
      setTile(x, y, undefined, { t: 'crop', kind: def.seed, stage: 0, water: false, since: Date.now() });
      take();
      stat(p, 'plant');
      return null;
    }
    if (def.ground) {
      if (o) return '위에 물건이 있어요';
      if (g === 'water') return '물 위에는 깔 수 없어요';
      if (g === def.ground) return null;
      const old = S.GROUND[g];
      if (old && old.item) give(p, old.item, 1, true);
      setTile(x, y, def.ground);
      take();
      if (def.cat === 'path') stat(p, 'pathPlaced');
      return null;
    }
    if (def.obj) {
      if (o) return '이미 뭔가 있어요';
      if (g === 'water') return '물 위에는 놓을 수 없어요';
      const od2 = S.OBJ[def.obj];
      if (od2.solid && occupied(x, y)) return '누가 서 있어요!';
      const obj = { t: def.obj };
      if (def.obj === 'sapling') obj.at = Date.now() + S.SAPLING_MS;
      if (def.obj === 'sign') obj.text = '';
      if (rot && S.canRotate(def.obj)) obj.r = rot;
      setTile(x, y, undefined, obj);
      if (def.obj === 'chest') chests.set(key(x, y), { items: new Array(S.CHEST_SIZE).fill(null), owner: p.prof.name, locked: false });
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

// ───────── 거래 ─────────
function tradeView(T, pid) {
  const other = T.a === pid ? T.b : T.a;
  return { id: T.id, other: players[other] ? players[other].name : '?', mine: T.offer[pid], theirs: T.offer[other], myReady: !!T.ready[pid], theirReady: !!T.ready[other] };
}
function sendTrade(T) { for (const pid of [T.a, T.b]) if (players[pid]) players[pid].socket.emit('trade', tradeView(T, pid)); }
function endTrade(T, msg) {
  trades.delete(T.id);
  for (const pid of [T.a, T.b]) {
    const q = players[pid];
    if (!q) continue;
    q.trade = null;
    q.socket.emit('tradeEnd', { msg });
  }
}
function execTrade(T) {
  const pa = players[T.a], pb = players[T.b];
  if (!pa || !pb) return endTrade(T, '상대가 나갔어요');
  const oa = T.offer[T.a], ob = T.offer[T.b];
  const valid = (p, o) => p.prof.coins >= o.coins && Object.entries(o.items).every(([id, n]) => S.canTrade(id) && S.countItem(p.prof.inv, id) >= n);
  if (!valid(pa, oa) || !valid(pb, ob)) { T.ready = {}; sendTrade(T); return; }
  const sim = (p, give, get) => {
    const inv = p.prof.inv.map((it) => (it ? { id: it.id, n: it.n } : null));
    for (const [id, n] of Object.entries(give.items)) S.removeItem(inv, id, n);
    for (const [id, n] of Object.entries(get.items)) if (S.addItem(inv, id, n) > 0) return null;
    return inv;
  };
  const ia = sim(pa, oa, ob), ib = sim(pb, ob, oa);
  if (!ia || !ib) {
    T.ready = {}; sendTrade(T);
    toast((ia ? pb : pa).socket, '가방이 가득 차서 거래할 수 없어요 🎒');
    toast((ia ? pa : pb).socket, `${(ia ? pb : pa).name} 님의 가방이 가득 찼어요`);
    return;
  }
  pa.prof.inv = ia; pb.prof.inv = ib;
  pa.prof.coins += ob.coins - oa.coins; pb.prof.coins += oa.coins - ob.coins;
  stat(pa, 'trade'); stat(pb, 'trade');
  endTrade(T, null);
  pa.socket.emit('reward', { title: `🤝 ${pb.name} 님과 거래 완료!`, coins: ob.coins, items: ob.items });
  pb.socket.emit('reward', { title: `🤝 ${pa.name} 님과 거래 완료!`, coins: oa.coins, items: oa.items });
  sendMe(pa); sendMe(pb);
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
    }
    ensureProfile(prof);
    refreshPQ(prof);
    profilesDirty = true;
    let x = S.SPAWN.x + (rand() * 16 - 8), y = S.SPAWN.y;
    if (isNum(prof.x) && isNum(prof.y)) { x = prof.x; y = prof.y; }

    const p = players[socket.id] = { id: socket.id, name: prof.name, key: k, x, y, dir: 'down', moving: false, avatar: prof.avatar, fishing: null, prof, socket,
      sel: 0, held: prof.inv[0] ? prof.inv[0].id : null, pose: null, trade: null, tradeAsk: null };
    socket.join(ROOM);
    const ps = {};
    for (const q of Object.values(players)) ps[q.id] = pub(q);
    socket.emit('init', { id: socket.id, players: ps, chatLog, world: serializeWorld(), animals: [...animals.values()].map(pubAnimal) });
    sendMe(p);
    socket.to(ROOM).emit('playerJoined', pub(p));
    if (!data.rejoin) sys(isNew ? `${prof.name} 님이 처음으로 놀러 왔어요! 🎉` : `${prof.name} 님이 들어왔어요 🏠`);
    stateDirty = true;
  });

  socket.on('move', (d = {}) => {
    const p = me();
    if (!p || !isNum(d.x) || !isNum(d.y)) return;
    if (p.pose && d.moving) setPose(p, null);
    if (p.pose) return;
    p.x = clamp(d.x, 0, W * TILE);
    p.y = clamp(d.y, 0, H * TILE);
    if (DIRS.has(d.dir)) p.dir = d.dir;
    p.moving = !!d.moving;
    stateDirty = true;
  });

  socket.on('sel', ({ slot } = {}) => {
    const p = me();
    if (!p || !Number.isInteger(slot) || slot < 0 || slot > 8) return;
    p.sel = slot;
    updateHeld(p);
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
    const rot = Number.isInteger(a.r) && a.r >= 0 && a.r < 4 ? a.r : 0;
    const msg = handleAct(p, a.type, x, y, slot, rot);
    if (msg) toast(socket, msg);
    sendMe(p);
  });

  // 놓아둔 가구 돌리기 (R)
  socket.on('rotate', ({ x, y } = {}) => {
    const p = me();
    x |= 0; y |= 0;
    if (!p || !inMap(x, y)) return;
    const o = getO(x, y);
    if (!o || !S.canRotate(o.t)) return;
    if (!inReach(p, x, y, 8)) return toast(socket, '너무 멀어요');
    if (o.t === 'chest') { const c = getChest(x, y); if (c.locked && !chestMine(p, c)) return toast(socket, `🔒 ${c.owner} 님이 잠근 상자예요`); }
    if (Object.values(players).some((q) => q.pose && q.pose.x === x && q.pose.y === y)) return toast(socket, '누가 쓰고 있어요!');
    const r = ((o.r || 0) + 1) % 4;
    const n = Object.assign({}, o);
    if (r) n.r = r; else delete n.r;
    setTile(x, y, undefined, n);
  });

  socket.on('petCmd', ({ id, cmd, name } = {}) => {
    const p = me();
    const a = animals.get(id);
    if (!p || !a || !S.ANIMALS[a.kind].pet || !isOwner(p, a)) return;
    if (Math.hypot(a.x - p.x, a.y - p.y) > TILE * 6) return toast(socket, '강아지에게 더 가까이 가주세요');
    if (cmd === 'follow') { a.mode = 'follow'; toast(socket, `${j(a.pname, '이', '가')} 따라와요! 🐾`); }
    else if (cmd === 'stay') { a.mode = 'home'; a.hx = a.x; a.hy = a.y; toast(socket, `${j(a.pname, '은', '는')} 여기서 지내요 🏠`); }
    else if (cmd === 'name') {
      const n = String(name || '').trim().slice(0, 10);
      if (!n) return;
      a.pname = n; toast(socket, `이름이 "${n}"(으)로 바뀌었어요`);
    } else if (cmd === 'bag') {
      animals.delete(a.id);
      give(p, S.ANIMALS[a.kind].item, 1, true);
      toast(socket, `${j(a.pname, '을', '를')} 가방에 넣었어요`);
      sendMe(p);
    } else if (cmd === 'pat') {
      stat(p, 'pet');
      io.to(ROOM).emit('fx', { x: a.x, y: a.y - 14, text: '💕' });
      sendMe(p);
    }
    animalsDirty = worldDirty = true;
  });

  // 상자: 칸 하나 옮기기 / 모두 넣기·꺼내기 / 잠그기 / 닫기
  socket.on('chestMove', ({ x, y, from, slot } = {}) => {
    const p = me();
    const c = p && usableChest(p, x, y);
    if (!c || !Number.isInteger(slot)) return;
    if (from === 'inv' && slot >= 0 && slot < S.INV_SIZE) {
      if (!moveStack(p.prof.inv, slot, c.items)) toast(socket, '상자가 가득 찼어요 📦');
    } else if (from === 'chest' && slot >= 0 && slot < S.CHEST_SIZE) {
      const it = c.items[slot];
      if (it && S.ITEMS[it.id] && S.ITEMS[it.id].questOnly && !chestMine(p, c)) return toast(socket, '✨퀘스트 전용 아이템은 상자 주인만 꺼낼 수 있어요');
      if (!moveStack(c.items, slot, p.prof.inv)) toast(socket, '가방이 가득 찼어요 🎒');
    } else return;
    worldDirty = true;
    sendChest(x | 0, y | 0);
    sendMe(p);
  });
  socket.on('chestAll', ({ x, y, dir } = {}) => {
    const p = me();
    const c = p && usableChest(p, x, y);
    if (!c) return;
    let n = 0;
    if (dir === 'in') { for (let i = 9; i < S.INV_SIZE; i++) n += moveStack(p.prof.inv, i, c.items); } // 단축바(1~9)는 남겨요
    else if (dir === 'out') {
      for (let i = 0; i < S.CHEST_SIZE; i++) {
        const it = c.items[i];
        if (it && S.ITEMS[it.id] && S.ITEMS[it.id].questOnly && !chestMine(p, c)) continue;
        n += moveStack(c.items, i, p.prof.inv);
      }
    } else return;
    toast(socket, n ? (dir === 'in' ? `📦 ${n}개를 상자에 넣었어요 (단축바는 그대로)` : `🎒 ${n}개를 꺼냈어요`) : (dir === 'in' ? '넣을 수 없어요 (상자가 가득 찼거나 가방이 비었어요)' : '꺼낼 수 없어요 (가방이 가득 찼거나 상자가 비었어요)'));
    worldDirty = true;
    sendChest(x | 0, y | 0);
    sendMe(p);
  });
  socket.on('chestLock', ({ x, y } = {}) => {
    const p = me();
    const c = p && usableChest(p, x, y);
    if (!c) return;
    if (!c.owner) c.owner = p.prof.name; // 주인 없는 상자는 처음 잠근 사람이 주인
    if (!chestMine(p, c)) return toast(socket, '상자 주인만 잠글 수 있어요');
    c.locked = !c.locked;
    x |= 0; y |= 0;
    setTile(x, y, undefined, Object.assign({}, getO(x, y), { locked: c.locked }));
    toast(socket, c.locked ? '🔒 잠갔어요. 이제 나만 열 수 있어요' : '🔓 잠금을 풀었어요. 누구나 열 수 있어요');
    sendChest(x, y);
  });
  socket.on('chestClose', () => { const p = me(); if (p) p.viewChest = null; });

  socket.on('swap', ({ a, b } = {}) => {
    const p = me();
    if (!p || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= S.INV_SIZE || b >= S.INV_SIZE) return;
    const inv = p.prof.inv;
    if (inv[a] && inv[b] && inv[a].id === inv[b].id && a !== b) {
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
    if (!p || !entry || !S.ITEMS[id] || S.ITEMS[id].questOnly) return;
    const cost = entry[1] * n;
    if (p.prof.coins < cost) return toast(socket, '코인이 부족해요 💰');
    p.prof.coins -= cost;
    const left = S.addItem(p.prof.inv, id, n);
    if (left) { p.prof.coins += entry[1] * left; toast(socket, '가방이 가득 찼어요! 🎒'); }
    else toast(socket, `${S.ITEMS[id].name} ${n}개 샀어요!`);
    stat(p, 'spent', entry[1] * (n - left));
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
    const c = S.COSMETICS[id];
    if (!p || !c || !c.price || c.quest || p.prof.unlocked.includes(id)) return;
    if (p.prof.coins < c.price) return toast(socket, '코인이 부족해요 💰');
    p.prof.coins -= c.price;
    p.prof.unlocked.push(id);
    stat(p, 'spent', c.price);
    toast(socket, `${j(c.name, '을', '를')} 얻었어요! 꾸미기(C)에서 써보세요`);
    sendMe(p);
  });

  socket.on('craft', ({ i } = {}) => {
    const p = me();
    const r = S.RECIPES[i];
    if (!p || !r) return;
    for (const [id, n] of Object.entries(r.need)) if (S.countItem(p.prof.inv, id) < n) return toast(socket, '재료가 부족해요');
    for (const [id, n] of Object.entries(r.need)) S.removeItem(p.prof.inv, id, n);
    give(p, r.out, r.n, true);
    toast(socket, `${S.ITEMS[r.out].name} ${r.n}개를 만들었어요! 🔨`);
    sendMe(p);
  });

  socket.on('cook', ({ i, n } = {}) => {
    const p = me();
    const r = S.COOK[i];
    if (!p || !r) return;
    if (!nearStation(p)) return toast(socket, '가스레인지나 모닥불 가까이에서 요리해요 🍳');
    n = n === 5 ? 5 : 1;
    let made = 0;
    for (let k = 0; k < n; k++) {
      if (!Object.entries(r.need).every(([id, c]) => S.countItem(p.prof.inv, id) >= c)) break;
      for (const [id, c] of Object.entries(r.need)) S.removeItem(p.prof.inv, id, c);
      give(p, r.out, 1);
      stat(p, 'cook');
      made++;
    }
    if (!made) return toast(socket, '재료가 부족해요');
    io.to(ROOM).emit('fx', { x: p.x, y: p.y - 28, text: '🍳' });
    toast(socket, `${S.ITEMS[r.out].name} ${made}개 완성! 😋`);
    sendMe(p);
  });

  socket.on('claim', ({ id } = {}) => {
    const p = me();
    const q = S.QUESTS.find((x) => x.id === id);
    if (!p || !q || p.prof.claimed.includes(id) || (p.prof.stats[q.stat] || 0) < q.goal) return;
    p.prof.claimed.push(id);
    grant(p, `🏆 퀘스트 완료! "${q.name}"`, q.reward);
    sys(`${p.name} 님이 퀘스트 "${q.name}" 완료! 🏆`);
    sendMe(p);
  });

  socket.on('claimP', ({ type, id } = {}) => {
    const p = me();
    if (!p || !['d', 'w', 'm'].includes(type)) return;
    const pr = p.prof;
    if (refreshPQ(pr)) { sendMe(p); return toast(socket, '퀘스트가 새로 바뀌었어요!'); }
    const box = pr.pq[type];
    const idx = box.list.findIndex((q) => q.id === id);
    const q = box.list[idx];
    if (!q || q.done || (pr.stats[q.stat] || 0) - q.base < q.goal) return;
    const label = S.PQ_NAMES[type];
    if (type === 'd') {
      pr.dlv++;
      stat(p, 'dailyDone');
      box.list[idx] = newPQ(pr, 'd', box.key, box.n++, box.list.filter((_, i) => i !== idx));
      grant(p, `📅 일간 퀘스트 완료! (Lv.${q.lv + 1} → 다음은 Lv.${pr.dlv + 1})`, q.reward);
    } else {
      q.done = true;
      stat(p, type === 'w' ? 'weeklyDone' : 'monthlyDone');
      grant(p, `🗓️ ${label} 퀘스트 완료!`, q.reward);
      if (type === 'm') sys(`${p.name} 님이 월간 퀘스트를 깼어요! 🌟`);
    }
    sendMe(p);
  });

  socket.on('claimCol', ({ id } = {}) => {
    const p = me();
    const c = S.COLLECTIONS.find((x) => x.id === id);
    if (!p || !c || p.prof.colClaimed.includes(id) || !c.entries.every((e) => p.prof.col[e])) return;
    p.prof.colClaimed.push(id);
    grant(p, `📖 ${c.name} 완성!`, c.reward);
    sys(`${p.name} 님이 ${c.name}을 완성했어요! 📖`);
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

  socket.on('fishCast', ({ x, y, slot } = {}) => {
    const p = me();
    x |= 0; y |= 0;
    if (!p || p.fishing || !inMap(x, y)) return;
    if (world.ground[y][x] !== 'water') return toast(socket, '물을 바라보고 던져요 🎣');
    if (!inReach(p, x, y, 8)) return toast(socket, '물에 더 가까이 가주세요');
    const it = p.prof.inv[slot | 0];
    const rod = it && S.ITEMS[it.id] && S.ITEMS[it.id].tool === 'rod' ? S.ITEMS[it.id] : null;
    if (!rod) return;
    if (p.pose) setPose(p, null);
    const biteIn = rod.gold ? 700 + rand() * 2300 : 1500 + rand() * 4500;
    const f = p.fishing = { x, y, biteAt: Date.now() + biteIn, timer: null, gold: !!rod.gold, zone: S.zoneAt(x, y) };
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
    const id = S.rollFish(rand, p.fishing.zone, p.fishing.gold);
    const def = S.ITEMS[id];
    give(p, id, 1);
    if (def.fish) stat(p, 'fish');
    endFishing(p, { ok: true, item: id, text: `${def.name}${id === 'boot' ? '를 건졌어요... 👢' : j(def.name, '을', '를').slice(def.name.length) + ' 낚았어요! 🎣'}` });
    if (id === 'fish_golden') sys(`✨ ${p.name} 님이 전설의 황금잉어를 낚았어요! ✨`);
    sendMe(p);
  });

  socket.on('fishCancel', () => { const p = me(); if (p) endFishing(p, null); });

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
      const tx = Math.floor(px / TILE), ty = Math.floor((py + 8) / TILE);
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

  // 거래: 신청 → 수락 → 서로 물건·코인 올리기 → 둘 다 확인하면 바꿔요
  socket.on('tradeReq', ({ to } = {}) => {
    const p = me(), q = players[to];
    if (!p || !q || q === p) return;
    if (p.trade || q.trade) return toast(socket, '이미 거래 중이에요');
    p.tradeAsk = { to: q.id, at: Date.now() };
    q.socket.emit('tradeAsk', { from: p.id, name: p.name });
    toast(socket, `${q.name} 님에게 거래를 신청했어요 🤝`);
  });
  socket.on('tradeAnswer', ({ from, ok } = {}) => {
    const q = me(), p = players[from];
    if (!q || !p || !p.tradeAsk || p.tradeAsk.to !== q.id || Date.now() - p.tradeAsk.at > 30000) return toast(socket, '거래 신청이 끝났어요');
    p.tradeAsk = null;
    if (!ok) return toast(p.socket, `${q.name} 님이 거래를 거절했어요`);
    if (p.trade || q.trade) return toast(socket, '이미 거래 중이에요');
    const T = { id: 't' + nextTradeId++, a: p.id, b: q.id, offer: { [p.id]: { items: {}, coins: 0 }, [q.id]: { items: {}, coins: 0 } }, ready: {} };
    trades.set(T.id, T);
    p.trade = q.trade = T.id;
    sendTrade(T);
  });
  socket.on('tradeSet', ({ items, coins } = {}) => {
    const p = me();
    const T = p && p.trade && trades.get(p.trade);
    if (!T) return;
    const clean = {};
    if (items && typeof items === 'object') {
      for (const [id, n] of Object.entries(items).slice(0, 12)) {
        const c = Number.isInteger(n) ? Math.min(n, S.countItem(p.prof.inv, id)) : 0;
        if (S.canTrade(id) && c > 0) clean[id] = c;
      }
    }
    T.offer[p.id] = { items: clean, coins: clamp(Number.isInteger(coins) ? coins : 0, 0, p.prof.coins) };
    T.ready = {};
    sendTrade(T);
  });
  socket.on('tradeReady', ({ on } = {}) => {
    const p = me();
    const T = p && p.trade && trades.get(p.trade);
    if (!T) return;
    T.ready[p.id] = !!on;
    if (T.ready[T.a] && T.ready[T.b]) execTrade(T); else sendTrade(T);
  });
  socket.on('tradeCancel', () => {
    const p = me();
    const T = p && p.trade && trades.get(p.trade);
    if (T) endTrade(T, `${p.name} 님이 거래를 취소했어요`);
  });

  socket.on('disconnect', () => {
    const p = me();
    if (!p) return;
    endFishing(p, null);
    if (p.trade && trades.get(p.trade)) endTrade(trades.get(p.trade), `${p.name} 님이 나가서 거래가 취소됐어요`);
    p.prof.x = p.x; p.prof.y = p.y;
    profilesDirty = true;
    delete players[socket.id];
    // 따라다니던 강아지는 집으로 돌아가요
    if (!Object.values(players).some((q) => q.key === p.key)) {
      for (const a of animals.values()) if (S.ANIMALS[a.kind].pet && isOwner(p, a)) { a.x = a.tx = a.hx; a.y = a.ty = a.hy; animalsDirty = worldDirty = true; }
    }
    io.to(ROOM).emit('playerLeft', socket.id);
    if (!Object.values(players).some((q) => q.key === p.key)) sys(`${p.name} 님이 나갔어요 👋`);
  });
});

// ───────── 반복 작업 ─────────
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

// 작물 성장, 나무·바위·버섯 다시 자라기 (1초마다)
setInterval(() => {
  if (!world) return;
  const now = Date.now();
  for (const [k, o] of world.objects) {
    const [x, y] = k.split(',').map(Number);
    if (o.t === 'crop') {
      const c = S.CROPS[o.kind];
      if (o.water && o.stage < 3 && now - o.since >= c.stageMs) setTile(x, y, undefined, Object.assign({}, o, { stage: o.stage + 1, water: false, since: now }));
    } else if (o.at && now >= o.at && (o.back || o.t === 'stump' || o.t === 'pebble' || o.t === 'sapling')) {
      const next = o.back || (o.t === 'pebble' ? 'rock' : 'tree');
      if (S.OBJ[next] && S.OBJ[next].solid && occupied(x, y)) setTile(x, y, undefined, Object.assign({}, o, { at: now + 5000 }));
      else setTile(x, y, undefined, { t: next });
    }
  }
}, 1000);

// 날짜가 바뀌면 접속 중인 사람의 기간 퀘스트를 새로 만들어요 (30초마다 확인)
setInterval(() => {
  for (const p of Object.values(players)) {
    if (refreshPQ(p.prof)) { toast(p.socket, '📅 새 퀘스트가 도착했어요! (Q)'); sendMe(p); }
  }
}, 30000);

// 동물 움직임 (초당 10번)
let lastWildSpawn = 0;
function randomSpawnTile(kind) {
  for (let i = 0; i < 40; i++) {
    let x, y;
    if (kind === 'deer' || (kind === 'boar' && rand() < 0.6)) { x = S.OW + 1 + Math.floor(rand() * (W - S.OW - 4)); y = 3 + Math.floor(rand() * (S.OH - 6)); }
    else if (kind === 'boar') { x = 3 + Math.floor(rand() * 16); y = 3 + Math.floor(rand() * 16); }
    else { x = 3 + Math.floor(rand() * (W - 6)); y = 3 + Math.floor(rand() * (S.CY - 6)); }
    const g = world.ground[y][x];
    if ((g !== 'grass' && g !== 'forest') || getO(x, y)) continue;
    const px = x * TILE + 8, py = y * TILE + 12;
    if (Object.values(players).some((p) => Math.hypot(p.x - px, p.y - py) < TILE * 6)) continue;
    return { x: px, y: py };
  }
  return null;
}
setInterval(() => {
  if (!world) return;
  const now = Date.now(), dt = 0.1;
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
    let follow = null;
    if (def.pet && a.mode === 'follow') follow = ownerOnline(a);
    if (follow) {
      // 강아지: 주인을 졸졸 따라가요. 너무 멀거나 막히면 주인 옆으로 순간이동
      const d = Math.hypot(follow.x - a.x, follow.y - a.y);
      if (d > TILE * 9 || (a.stuck && now - a.stuck > 1800)) {
        a.x = a.tx = follow.x - 10; a.y = a.ty = follow.y + 2; a.stuck = 0; animalsDirty = true;
      } else if (d > 22) {
        const ang = Math.atan2(follow.y - a.y, follow.x - a.x);
        a.tx = follow.x - Math.cos(ang) * 16; a.ty = follow.y - Math.sin(ang) * 16;
        speed = Math.min(120, Math.max(def.speed, d * 1.6));
      } else { a.tx = a.x; a.ty = a.y; }
      a.nextThink = now + 1000;
    } else if (def.flee) {
      const near = plist.find((p) => Math.hypot(p.x - a.x, p.y - a.y) < 40);
      if (near) {
        const ang = Math.atan2(a.y - near.y, a.x - near.x);
        a.tx = a.x + Math.cos(ang) * 40; a.ty = a.y + Math.sin(ang) * 40; a.nextThink = now + 800;
        speed *= 2.2;
      }
    }
    if (!follow && now >= a.nextThink) {
      a.nextThink = now + 2000 + rand() * 4000;
      if (rand() < 0.45) { a.tx = a.x; a.ty = a.y; }
      else {
        const r = def.wild ? 56 : 40;
        let tx = a.x + (rand() * 2 - 1) * r, ty = a.y + (rand() * 2 - 1) * r;
        const home = def.pet ? TILE * 3 : TILE * 5;
        if (!def.wild && Math.hypot(tx - a.hx, ty - a.hy) > home) { tx = a.hx; ty = a.hy; }
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
      if (!moved) { if (follow) a.stuck = a.stuck || now; else { a.tx = a.x; a.ty = a.y; } } else a.stuck = 0;
      if (Math.abs(dx) > 0.5) a.dir = dx < 0 ? 'left' : 'right';
      a.moving = moved;
      animalsDirty = true;
    } else { a.moving = false; a.stuck = 0; }
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
// 예전 맵(버전 3, 64×48)이 있으면 지은 건물은 그대로 두고 숲·동굴만 붙여서 넓혀요.
function migrateWorld(saved) {
  const ground = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (y < saved.h && x < saved.w ? saved.ground[y][x] : 'grass')));
  const objects = Object.assign({}, saved.objects);
  S.expandWorld(ground, objects);
  return { ground, objects: new Map(Object.entries(objects)) };
}
(async () => {
  const saved = process.env.RESET_WORLD ? null : await loadData('world');
  if (saved && saved.version === S.WORLD_VERSION && saved.w === W && saved.h === H) {
    world = { ground: saved.ground, objects: new Map(Object.entries(saved.objects)) };
    chests = new Map(Object.entries(saved.chests || {}));
    (saved.animals || []).forEach((a) => { if (S.ANIMALS[a.kind]) spawnAnimal(a); });
    console.log('🗺️  저장된 맵을 불러왔어요');
  } else if (saved && saved.version === 3 && saved.w === S.OW && saved.h === S.OH) {
    await saveData('world_backup_v3', saved);
    world = migrateWorld(saved);
    (saved.animals || []).forEach((a) => { if (S.ANIMALS[a.kind]) spawnAnimal(a); });
    worldDirty = true;
    console.log('🗺️  예전 맵을 넓혔어요 (숲·동굴 추가). 예전 맵은 world_backup_v3 에 따로 보관했어요');
  } else {
    const g = S.generateWorld();
    world = { ground: g.ground, objects: new Map(Object.entries(g.objects)) };
    g.animals.forEach(spawnAnimal);
    worldDirty = true;
    console.log('🗺️  새 맵을 만들었어요');
  }
  profiles = (await loadData('profiles')) || {};
  if (Object.keys(profiles).length && !(await loadData('profiles_backup_v4'))) {
    await saveData('profiles_backup_v4', profiles);
    console.log('💾 업데이트 전 프로필을 profiles_backup_v4 에 따로 보관했어요');
  }
  for (const pr of Object.values(profiles)) ensureProfile(pr);
  server.listen(PORT, () => {
    console.log(`📄 알PDF 서버 실행 중: http://localhost:${PORT}`);
    console.log(UP_URL && UP_TOKEN ? '☁️  Upstash 클라우드에 저장해요' : `💾 ${DATA_DIR} 폴더에 저장해요`);
    if (ROOM_CODE) console.log('🔒 비밀 코드가 설정되어 있어요.');
  });
})();
