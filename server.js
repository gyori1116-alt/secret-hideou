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
let board = { posts: [], nextId: 1, mvpWeek: null, lastMvp: null };  // 마을 게시판 (건의함 + 금주의 MVP)
let boardDirty = false;
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
const myPets = (p) => [...animals.values()].filter((a) => S.ANIMALS[a.kind].pet && isOwner(p, a));
// 따라오는 펫은 1마리만: a 를 따라오게 하고 나머지는 그 자리에서 지내게 (a = null 이면 모두 집)
function setFollower(p, a) {
  for (const b of myPets(p)) if (b !== a && b.mode === 'follow') { b.mode = 'home'; b.hx = b.x; b.hy = b.y; }
  if (a) a.mode = 'follow';
  animalsDirty = worldDirty = true;
}
// 펫을 가방에 넣어요 (이름 기억)
function bagPet(p, a) {
  animals.delete(a.id);
  animalsDirty = worldDirty = true;
  give(p, S.ANIMALS[a.kind].item, 1, true, { pname: a.pname });
}
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
const lvOf = (pr) => S.levelInfo(pr.exp || 0).lv;
const isMvp = (k) => !!(board.lastMvp && Object.values(board.lastMvp.cats || {}).some((list) => list[0] && list[0].name.toLowerCase() === k));
const pub = (p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, dir: p.dir, moving: p.moving, avatar: p.avatar, held: p.held, pose: p.pose,
  lv: lvOf(p.prof), mvp: isMvp(p.key),
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
  pr.inv = pr.inv.map((it) => (it && S.ITEMS[it.id] && it.n > 0 ? it : null));
  // 레벨: 처음이면 지금까지 한 활동으로 시작 경험치를 계산해 줘요
  if (!isNum(pr.exp)) {
    const st = pr.stats;
    let e = (pr.claimed.length || 0) * 30;
    for (const [k, v] of Object.entries(S.EXP)) e += (st[k] || 0) * v;
    pr.exp = Math.round(e);
  }
  pr.stats.level = lvOf(pr);
  while (pr.inv.length < S.invSize(pr.stats.level)) pr.inv.push(null);
  // 예전 "못 받은 보상" → 우편함
  pr.mail = pr.mail || [];
  if (pr.recover && Object.keys(pr.recover).length) pr.mail.push({ title: '📮 예전에 가방이 꽉 차서 못 받은 보상', items: pr.recover });
  delete pr.recover;
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
    col: pr.col, colClaimed: pr.colClaimed, pq: pr.pq, dlv: pr.dlv, mail: pr.mail, exp: pr.exp, wk: curWk(pr), ends: { d: per.d.ends, w: per.w.ends, m: per.m.ends }, now: Date.now(),
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
function give(p, id, n, noCol, extra) {
  const left = S.addItem(p.prof.inv, id, n, extra);
  if (left > 0) toast(p.socket, '가방이 가득 찼어요! 🎒');
  if (!noCol && n - left > 0) collect(p, id);
}
// 가방에 다 들어갈 때만 진행해요. 안 들어가면 알려주고 false (아이템이 사라지지 않게)
const FULL_MSG = '🎒 가방이 꽉 찼어요! 가방을 비워야 받을 수 있어요';
function room(p, items, remove) {
  if (S.canFit(p.prof.inv, items, remove)) return true;
  toast(p.socket, FULL_MSG);
  return false;
}
const natGround = (x, y) => ({ cave: 'cave', forest: 'forest' })[S.zoneAt(x, y)] || 'grass';
// 이번 주 MVP 기록 (주가 바뀌면 0부터)
function curWk(pr) {
  const k = S.periods(Date.now()).w.key;
  if (!pr.wk || pr.wk.key !== k) pr.wk = { key: k, money: 0, quest: 0, maker: 0 };
  return pr.wk;
}
// 통계 올리기 + 활동 경험치 + 금주의 MVP 기록
function stat(p, k, n = 1) {
  const pr = p.prof;
  pr.stats[k] = (pr.stats[k] || 0) + n;
  if (S.MVP_STAT[k]) curWk(pr)[S.MVP_STAT[k]] += n;
  if (S.EXP[k]) addExp(p, S.EXP[k] * n);
}
// 경험치 → 레벨업 (가방 칸 늘리기, 해금 알림)
function addExp(p, n) {
  const pr = p.prof;
  if (!n) return;
  const before = lvOf(pr);
  pr.exp = (pr.exp || 0) + n;
  const after = lvOf(pr);
  if (after <= before) return;
  pr.stats.level = after;
  while (pr.inv.length < S.invSize(after)) pr.inv.push(null);
  const unlocks = [];
  for (let l = before + 1; l <= after; l++) unlocks.push(...S.levelUnlocks(l));
  p.socket.emit('levelUp', { lv: after, unlocks });
  io.to(ROOM).emit('playerUpdate', { id: p.id, avatar: p.avatar, lv: after, mvp: isMvp(p.key) });
  sys(`🎉 ${p.name} 님이 레벨 ${after}(으)로 올랐어요!`);
}
// 보상 주기 + 받은 것 화면에 보여주기
function grant(p, title, rw) {
  const shown = { title, coins: rw.coins || 0, exp: rw.exp || 0, items: rw.items || {}, unlock: null, converted: 0 };
  if (rw.coins) p.prof.coins += rw.coins;
  if (rw.exp) setTimeout(() => { addExp(p, rw.exp); sendMe(p); }, 50);
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
    const cook = o && ((S.OBJ[o.t] && S.OBJ[o.t].cook) || (o.top && S.OBJ[o.top].cook));
    if (cook && inReach(p, x, y, TILE * 2)) return true;
  }
  return false;
}
// ───────── 상자 ─────────
function getChest(x, y) {
  const k = key(x, y), o = getO(x, y);
  const size = o && S.OBJ[o.t] && S.OBJ[o.t].chest;
  if (!size) return null;
  let c = chests.get(k);
  if (!c) { c = { items: new Array(size).fill(null), owner: null, locked: false }; chests.set(k, c); }
  while (c.items.length < size) c.items.push(null);
  return c;
}
const isChestObj = (o) => !!o && !!S.OBJ[o.t] && !!S.OBJ[o.t].chest;
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
  // 이름이 있는 펫은 이름째로 빈 칸에 옮겨요
  if (it.pname) {
    const i = toArr.findIndex((s) => !s);
    if (i < 0) return 0;
    toArr[i] = it; fromArr[slot] = null;
    return 1;
  }
  const left = S.addItem(toArr, it.id, it.n);
  const moved = it.n - left;
  fromArr[slot] = left > 0 ? { id: it.id, n: left } : null;
  return moved;
}

// ───────── 게시판 · 금주의 MVP ─────────
// 이번 주 순위 (항목마다 위 5명)
function mvpStandings(weekKey) {
  const out = {};
  for (const c of S.MVP_CATS) {
    out[c.id] = Object.values(profiles)
      .filter((pr) => pr.wk && pr.wk.key === weekKey && pr.wk[c.id] > 0)
      .map((pr) => ({ name: pr.name, v: pr.wk[c.id] }))
      .sort((a, b) => b.v - a.v).slice(0, 5);
  }
  return out;
}
function boardView(p) {
  const per = S.periods(Date.now());
  return {
    posts: board.posts.slice(0, 100).map((x) => ({ id: x.id, name: x.name, text: x.text, t: x.t, likes: x.likes.length, liked: x.likes.includes(p.key), mine: x.name.toLowerCase() === p.key })),
    cur: mvpStandings(per.w.key), ends: per.w.ends, last: board.lastMvp, me: curWk(p.prof),
  };
}
function openBoard(p) { p.viewBoard = true; p.socket.emit('board', boardView(p)); }
function sendBoardAll() { for (const q of Object.values(players)) if (q.viewBoard) q.socket.emit('board', boardView(q)); }
// 주가 바뀌면 지난주 1~3등을 정하고 상품을 우편함으로 보내요
function checkMvpWeek() {
  const cur = S.periods(Date.now()).w.key;
  if (board.mvpWeek === cur) return;
  if (board.mvpWeek) {
    const cats = mvpStandings(board.mvpWeek);
    for (const c of S.MVP_CATS) {
      (cats[c.id] || []).slice(0, 3).forEach((row, rank) => {
        const pr = profiles[row.name.toLowerCase()];
        if (!pr) return;
        pr.mail = pr.mail || [];
        pr.mail.push(Object.assign({ title: `🏅 금주의 MVP ${rank + 1}등 — ${c.name}` }, S.MVP_PRIZE[rank]));
        if (rank === 0) pr.stats.mvpWin = (pr.stats.mvpWin || 0) + 1;
      });
      cats[c.id] = (cats[c.id] || []).slice(0, 3);
    }
    board.lastMvp = { week: board.mvpWeek, cats };
    const names = S.MVP_CATS.map((c) => (cats[c.id][0] ? `${c.name} ${cats[c.id][0].name}` : null)).filter(Boolean);
    if (names.length) sys(`🏅 지난주 MVP 발표! ${names.join(' · ')} — 축하해요! 👑`);
    profilesDirty = true;
    for (const p of Object.values(players)) { sendMe(p); io.to(ROOM).emit('playerUpdate', { id: p.id, avatar: p.avatar, lv: lvOf(p.prof), mvp: isMvp(p.key) }); }
  }
  board.mvpWeek = cur;
  boardDirty = true;
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
  if (!room(p, def.drop)) { a.hp = 1; return null; }
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
      if (!isOwner(p, a)) return `${a.owner} 님의 ${def.name}예요 🐾`;
      if (!room(p, { [def.item]: 1 })) return null;
      bagPet(p, a);
      return `${j(a.pname, '을', '를')} 가방에 넣었어요 (이름은 기억해요)`;
    }
    if (type === 'interact' || type === 'use') {
      heart(); stat(p, 'pet');
      return isOwner(p, a) ? null : `쓰담쓰담 💕 ${a.owner} 님의 ${a.pname}`;
    }
    return null;
  }
  if (type === 'break') {
    if (def.wild) return hurtAnimal(p, a, 1);
    if (!room(p, { [def.item]: 1 })) return null;
    animals.delete(a.id);
    animalsDirty = worldDirty = true;
    give(p, def.item, 1, true);
    return `${j(def.name, '을', '를')} 가방에 넣었어요`;
  }
  if (def.wild) return type === 'interact' ? `야생 ${def.name}예요! 활(Space)이나 X로 사냥할 수 있어요` : null;
  if (type === 'interact') {
    if (a.ready) {
      if (!room(p, { [def.produce]: 1 })) return null;
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
  if (!room(p, def.pick)) return null;
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
      if (o.top) { // 위에 올린 것부터 회수
        const topItem = S.OBJ[o.top].item;
        if (!room(p, { [topItem]: 1 })) return null;
        give(p, topItem, 1, true);
        const n = Object.assign({}, o); delete n.top;
        setTile(x, y, undefined, n);
        return null;
      }
      if (isChestObj(o)) {
        const c = getChest(x, y);
        if (c.locked && !chestMine(p, c)) return `🔒 ${c.owner} 님이 잠근 상자예요`;
        if (c.items.some(Boolean)) return '상자를 먼저 비워주세요 📦';
        chests.delete(key(x, y));
        for (const q of Object.values(players)) if (q.viewChest === key(x, y)) { q.viewChest = null; q.socket.emit('chest', null); }
      }
      if (o.t === 'crop') {
        if (o.stage === 0 && !room(p, { [S.CROPS[o.kind].seed]: 1 })) return null;
        setTile(x, y, undefined, null);
        if (o.stage === 0) give(p, S.CROPS[o.kind].seed, 1, true);
        return null;
      }
      if (od.pick) return pickAt(p, x, y, o, od);
      if (o.at && o.back) return '다시 자라는 중이에요 🌱';
      const willGet = Object.assign({}, od.drop || {});
      for (const [id] of od.bonus || []) willGet[id] = (willGet[id] || 0) + 1;
      if (od.item) willGet[od.item] = (willGet[od.item] || 0) + 1;
      if (!room(p, willGet)) return null;
      if (od.drop) {
        for (const [id, n] of Object.entries(od.drop)) { give(p, id, n); stat(p, id, n); }
        for (const [id, chance] of od.bonus || []) if (rand() < chance) { give(p, id, 1); stat(p, id, 1); }
      }
      if (od.item) give(p, od.item, 1, true);
      setTile(x, y, undefined, od.regrow ? { t: od.regrow, at: Date.now() + od.regrowMs, back: o.t } : null);
      return null;
    }
    const gd = S.GROUND[g];
    if (gd && gd.item) { if (!room(p, { [gd.item]: 1 })) return null; give(p, gd.item, 1, true); setTile(x, y, natGround(x, y)); return null; }
    if (g === 'farm') { setTile(x, y, natGround(x, y)); return null; }
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
      if (!room(p, { [c.produce]: c.yield[1], [c.seed]: 1 })) return null;
      const n = c.yield[0] + Math.floor(rand() * (c.yield[1] - c.yield[0] + 1));
      give(p, c.produce, n);
      if (rand() < 0.5) give(p, c.seed, 1, true);
      stat(p, 'harvest', n);
      if (['tomato', 'corn', 'potato', 'watermelon'].includes(o.kind)) stat(p, 'newcrop', n);
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
    const td = o.top && S.OBJ[o.top];
    if (td && td.fx) { io.to(ROOM).emit('fx', { x: x * TILE + 8, y: y * TILE, text: td.fx }); return null; }
    if (td && td.msg) return td.msg;
    if (o.t === 'notice_board') { openBoard(p); return null; }
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
      // 물만 빼고 어디든 밭으로! 바닥 블록(나무 바닥·길 등)은 가방으로 돌아와요
      if (o) return '위에 있는 걸 먼저 치워주세요 (X)';
      if (g === 'farm') return null;
      if (g === 'water') return '물 위에는 밭을 갈 수 없어요';
      const gd0 = S.GROUND[g];
      if (gd0 && gd0.item) { if (!room(p, { [gd0.item]: 1 })) return null; give(p, gd0.item, 1, true); }
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
        const lim = S.maxPets(lvOf(p.prof));
        if (myPets(p).length >= lim) return `지금은 펫을 ${lim}마리까지 꺼내 둘 수 있어요 (레벨이 오르면 늘어나요)`;
        const pname = it.pname || ad.name;
        setFollower(p, null); // 원래 따라오던 펫은 그 자리에서 지내요
        spawnAnimal({ kind: def.animal, x: x * TILE + 8, y: y * TILE + 12, owner: p.prof.name, mode: 'follow', pname });
        worldDirty = true;
        take();
        p.prof.stats.petsOut = Math.max(p.prof.stats.petsOut || 0, myPets(p).length);
        return `${j(pname, '이', '가')} 나왔어요! 졸졸 따라와요 🐾 (따라오는 펫은 1마리, E로 집에 두기)`;
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
      // 조리대·싱크대·테이블 위에 올리기
      if (o && S.OBJ[def.obj].onTop && od.surface) {
        if (o.top) return '위에 이미 뭔가 올려져 있어요';
        setTile(x, y, undefined, Object.assign({}, o, { top: def.obj }));
        take();
        stat(p, 'furniturePlaced');
        return null;
      }
      if (o) return S.OBJ[def.obj].onTop ? '조리대·싱크대·테이블 위나 빈 칸에 놓아요' : '이미 뭔가 있어요';
      if (g === 'water') return '물 위에는 놓을 수 없어요';
      const od2 = S.OBJ[def.obj];
      if (od2.solid && occupied(x, y)) return '누가 서 있어요!';
      const obj = { t: def.obj };
      if (def.obj === 'sapling') obj.at = Date.now() + S.SAPLING_MS;
      if (def.obj === 'sign') obj.text = '';
      if (rot && S.canRotate(def.obj)) obj.r = rot;
      setTile(x, y, undefined, obj);
      if (S.OBJ[def.obj].chest) chests.set(key(x, y), { items: new Array(S.OBJ[def.obj].chest).fill(null), owner: p.prof.name, locked: false });
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
    if (!inMap(x, y) || slot < 0 || slot >= p.prof.inv.length) return;
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
    if (isChestObj(o)) { const c = getChest(x, y); if (c.locked && !chestMine(p, c)) return toast(socket, `🔒 ${c.owner} 님이 잠근 상자예요`); }
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
    if (Math.hypot(a.x - p.x, a.y - p.y) > TILE * 6) return toast(socket, '펫에게 더 가까이 가주세요');
    if (cmd === 'follow') { setFollower(p, a); toast(socket, `${j(a.pname, '이', '가')} 따라와요! 🐾 (다른 펫은 그 자리에서 지내요)`); }
    else if (cmd === 'stay') { a.mode = 'home'; a.hx = a.x; a.hy = a.y; toast(socket, `${j(a.pname, '은', '는')} 여기서 지내요 🏠`); }
    else if (cmd === 'name') {
      const n = String(name || '').trim().slice(0, 10);
      if (!n) return;
      a.pname = n; toast(socket, `이름이 "${n}"(으)로 바뀌었어요`);
    } else if (cmd === 'bag') {
      if (!room(p, { [S.ANIMALS[a.kind].item]: 1 })) return;
      bagPet(p, a);
      toast(socket, `${j(a.pname, '을', '를')} 가방에 넣었어요 (이름은 기억해요)`);
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
    if (from === 'inv' && slot >= 0 && slot < p.prof.inv.length) {
      if (!moveStack(p.prof.inv, slot, c.items)) toast(socket, '상자가 가득 찼어요 📦');
    } else if (from === 'chest' && slot >= 0 && slot < c.items.length) {
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
    if (dir === 'in') { for (let i = 9; i < p.prof.inv.length; i++) n += moveStack(p.prof.inv, i, c.items); } // 단축바(1~9)는 남겨요
    else if (dir === 'out') {
      for (let i = 0; i < c.items.length; i++) {
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
    if (!p || !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= p.prof.inv.length || b >= p.prof.inv.length) return;
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
    if (!p || !Number.isInteger(slot) || slot < 0 || slot >= p.prof.inv.length) return;
    p.prof.inv[slot] = null;
    sendMe(p);
  });

  socket.on('buy', ({ id, n } = {}) => {
    const p = me();
    const entry = S.SHOP.find((e) => e[0] === id);
    n = [1, 5, 10].includes(n) ? n : 1;
    if (!p || !entry || !S.ITEMS[id] || S.ITEMS[id].questOnly) return;
    if ((entry[2] || 1) > lvOf(p.prof)) return toast(socket, `🔒 레벨 ${entry[2]}부터 살 수 있어요`);
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
    if ((c.lv || 1) > lvOf(p.prof)) return toast(socket, `🔒 레벨 ${c.lv}부터 살 수 있어요`);
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
    if ((r.lv || 1) > lvOf(p.prof)) return toast(socket, `🔒 레벨 ${r.lv}부터 만들 수 있어요`);
    for (const [id, n] of Object.entries(r.need)) if (S.countItem(p.prof.inv, id) < n) return toast(socket, '재료가 부족해요');
    if (!room(p, { [r.out]: r.n }, r.need)) return;
    for (const [id, n] of Object.entries(r.need)) S.removeItem(p.prof.inv, id, n);
    give(p, r.out, r.n, true);
    toast(socket, `${S.ITEMS[r.out].name} ${r.n}개를 만들었어요! 🔨`);
    sendMe(p);
  });

  socket.on('cook', ({ i, n } = {}) => {
    const p = me();
    const r = S.COOK[i];
    if (!p || !r) return;
    if ((r.lv || 1) > lvOf(p.prof)) return toast(socket, `🔒 레벨 ${r.lv}부터 만들 수 있는 요리예요`);
    if (!nearStation(p)) return toast(socket, '가스레인지나 모닥불 가까이에서 요리해요 🍳');
    n = n === 5 ? 5 : 1;
    let made = 0;
    for (let k = 0; k < n; k++) {
      if (!Object.entries(r.need).every(([id, c]) => S.countItem(p.prof.inv, id) >= c)) break;
      if (!S.canFit(p.prof.inv, { [r.out]: 1 }, r.need)) { toast(socket, FULL_MSG); break; }
      for (const [id, c] of Object.entries(r.need)) S.removeItem(p.prof.inv, id, c);
      give(p, r.out, 1);
      stat(p, 'cook');
      made++;
    }
    if (!made) return S.canFit(p.prof.inv, { [r.out]: 1 }, r.need) ? toast(socket, '재료가 부족해요') : null;
    io.to(ROOM).emit('fx', { x: p.x, y: p.y - 28, text: '🍳' });
    toast(socket, `${S.ITEMS[r.out].name} ${made}개 완성! 😋`);
    sendMe(p);
  });

  socket.on('claim', ({ id } = {}) => {
    const p = me();
    const q = S.QUESTS.find((x) => x.id === id);
    if (!p || !q || p.prof.claimed.includes(id) || (p.prof.stats[q.stat] || 0) < q.goal) return;
    if (!room(p, q.reward.items)) return;
    p.prof.claimed.push(id);
    stat(p, 'questDone');
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
    if (!room(p, q.reward.items)) return;
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
    if (!room(p, c.reward.items)) return;
    p.prof.colClaimed.push(id);
    grant(p, `📖 ${c.name} 완성!`, c.reward);
    sys(`${p.name} 님이 ${c.name}을 완성했어요! 📖`);
    sendMe(p);
  });

  // 📮 우편함 (못 받은 보상, 금주의 MVP 상품)
  socket.on('claimMail', ({ i } = {}) => {
    const p = me();
    const m = p && Number.isInteger(i) && p.prof.mail[i];
    if (!m) return;
    if (!room(p, m.items)) return;
    p.prof.mail.splice(i, 1);
    grant(p, m.title, m);
    sendMe(p);
  });

  // 📌 마을 게시판: 건의함 + 금주의 MVP
  let lastPost = 0;
  socket.on('boardOpen', () => { const p = me(); if (p) openBoard(p); });
  socket.on('boardClose', () => { const p = me(); if (p) p.viewBoard = false; });
  socket.on('boardPost', ({ text } = {}) => {
    const p = me();
    if (!p) return;
    text = String(text || '').trim().slice(0, 150);
    if (!text) return;
    if (Date.now() - lastPost < 20000) return toast(socket, '조금 있다가 다시 써주세요 (20초)');
    lastPost = Date.now();
    board.posts.unshift({ id: board.nextId++, name: p.name, text, t: Date.now(), likes: [] });
    if (board.posts.length > 200) board.posts.length = 200;
    boardDirty = true;
    stat(p, 'post');
    toast(socket, '📌 건의함에 글을 올렸어요! 고마워요');
    sendBoardAll();
    sendMe(p);
  });
  socket.on('boardLike', ({ id } = {}) => {
    const p = me();
    const post = p && board.posts.find((x) => x.id === id);
    if (!post) return;
    const i = post.likes.indexOf(p.key);
    if (i >= 0) post.likes.splice(i, 1); else post.likes.push(p.key);
    boardDirty = true;
    sendBoardAll();
  });
  socket.on('boardDel', ({ id } = {}) => {
    const p = me();
    const idx = p ? board.posts.findIndex((x) => x.id === id && x.name.toLowerCase() === p.key) : -1;
    if (idx < 0) return;
    board.posts.splice(idx, 1);
    boardDirty = true;
    sendBoardAll();
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
    if (!p.prof.inv.some((s) => !s)) return toast(socket, '🎒 가방이 꽉 차서 물고기를 넣을 칸이 없어요! 한 칸 비워주세요');
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
  checkMvpWeek();
}, 30000);

// 동물 움직임 (초당 10번)
let lastWildSpawn = 0;
function randomSpawnTile(kind) {
  for (let i = 0; i < 40; i++) {
    let x, y;
    // 사슴·멧돼지: 아래쪽 나무꾼의 숲 (멧돼지는 가끔 마을 왼쪽 위 숲에도)
    if (kind === 'deer' || (kind === 'boar' && rand() < 0.6)) { x = S.BX + 2 + Math.floor(rand() * (W - S.BX - 5)); y = S.CY + 3 + Math.floor(rand() * (H - S.CY - 6)); }
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
    if (boardDirty) { boardDirty = false; await saveData('board', board); }
  } catch (e) {
    worldDirty = profilesDirty = boardDirty = true;
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
// 깬 퀘스트·도감 보상 중 오래 쓰는 물건(퀘스트 전용·도구·강아지·가구)이 가방·내 상자·맵·내 강아지 어디에도 없으면 돌려줄 목록에 넣어요.
// (씨앗처럼 써서 없어지는 물건은 썼는지 잃었는지 알 수 없어서 빼요)
const recoverable = (id) => { const d = S.ITEMS[id]; return !!d && !!(d.questOnly || d.tool || d.animal || (d.obj && d.cat === 'furniture')); };
function computeRecover(pr) {
  const expect = {};
  const add = (items) => { for (const [id, n] of Object.entries(items || {})) if (recoverable(id)) expect[id] = (expect[id] || 0) + n; };
  for (const q of S.QUESTS) if (pr.claimed.includes(q.id)) add(q.reward.items);
  for (const c of S.COLLECTIONS) if (pr.colClaimed.includes(c.id)) add(c.reward.items);
  for (const t of ['w', 'm']) for (const q of (pr.pq[t] ? pr.pq[t].list : [])) if (q.done) add(q.reward.items);
  const k = pr.name.toLowerCase(), missing = {};
  for (const [id, n] of Object.entries(expect)) {
    const d = S.ITEMS[id];
    let have = S.countItem(pr.inv, id);
    for (const c of chests.values()) if (c.owner && c.owner.toLowerCase() === k) have += S.countItem(c.items, id);
    if (d.obj) for (const o of world.objects.values()) { if (o.t === d.obj) have++; if (o.top === d.obj) have++; }
    if (d.animal) for (const a of animals.values()) if (a.kind === d.animal && a.owner && a.owner.toLowerCase() === k) have++;
    if (n > have) missing[id] = n - have;
  }
  return missing;
}

function migrateWorld(saved) {
  const ground = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (y < saved.h && x < saved.w ? saved.ground[y][x] : 'grass')));
  const objects = Object.assign({}, saved.objects);
  S.expandWorld(ground, objects);
  return { ground, objects: new Map(Object.entries(objects)) };
}
// 버전 4 맵 → 5: 오른쪽 위 숲은 집 짓는 땅으로, 아래쪽은 동굴(왼쪽)+숲(오른쪽)으로 다시 만들어요.
// 지은 집·놓은 물건은 그대로. 아래쪽에 있던 상자의 물건은 주인 우편함으로, 아래쪽 동물은 마을로 옮겨요.
function upgradeWorldV4(saved) {
  const objects = Object.assign({}, saved.objects);
  const ground = saved.ground.map((row) => row.slice());
  for (const [k, c] of Object.entries(saved.chests || {})) {
    const y = +k.split(',')[1];
    if (y < S.CY) continue;
    const items = {};
    for (const it of c.items || []) if (it) items[it.id] = (items[it.id] || 0) + it.n;
    const pr = c.owner && profiles[c.owner.toLowerCase()];
    if (pr && Object.keys(items).length) { pr.mail = pr.mail || []; pr.mail.push({ title: '📦 지도가 바뀌어서 옮겨드린 상자 속 물건', items }); }
    delete saved.chests[k];
  }
  S.upgradeV4(ground, objects);
  for (const a of saved.animals || []) if (a.y >= S.CY * TILE) { a.x = a.hx = S.SPAWN.x + 40; a.y = a.hy = S.SPAWN.y + 80; }
  return { ground, objects: new Map(Object.entries(objects)) };
}
(async () => {
  profiles = (await loadData('profiles')) || {};
  board = Object.assign(board, (await loadData('board')) || {});
  const saved = process.env.RESET_WORLD ? null : await loadData('world');
  if (saved && saved.version === S.WORLD_VERSION && saved.w === W && saved.h === H) {
    world = { ground: saved.ground, objects: new Map(Object.entries(saved.objects)) };
    chests = new Map(Object.entries(saved.chests || {}));
    (saved.animals || []).forEach((a) => { if (S.ANIMALS[a.kind]) spawnAnimal(a); });
    console.log('🗺️  저장된 맵을 불러왔어요');
  } else if (saved && saved.version === 4 && saved.w === W && saved.h === H) {
    await saveData('world_backup_v4', saved);
    world = upgradeWorldV4(saved);
    chests = new Map(Object.entries(saved.chests || {}));
    (saved.animals || []).forEach((a) => { if (S.ANIMALS[a.kind]) spawnAnimal(a); });
    worldDirty = profilesDirty = true;
    console.log('🗺️  지도를 새 배치로 바꿨어요 (생산 구역은 아래로). 예전 맵은 world_backup_v4 에 보관했어요');
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
  if (Object.keys(profiles).length && !(await loadData('profiles_backup_v5'))) {
    await saveData('profiles_backup_v5', profiles);
    console.log('💾 업데이트 전 프로필을 profiles_backup_v5 에 따로 보관했어요');
  }
  for (const pr of Object.values(profiles)) {
    ensureProfile(pr);
    // 한 번만: 예전에 가방이 꽉 차서 사라졌을 수 있는 보상 찾기 → 📮 우편함에서 돌려받아요
    if (!pr.recoverChecked) {
      pr.recoverChecked = 1;
      const m = computeRecover(pr);
      if (Object.keys(m).length) {
        pr.mail.push({ title: '📮 예전에 가방이 꽉 차서 못 받은 보상', items: m });
        console.log(`📮 ${pr.name} 님에게 돌려줄 보상:`, JSON.stringify(m));
      }
    }
    profilesDirty = true;
  }
  checkMvpWeek();
  // 📢 새 업데이트면 채팅으로 공지 (게시판 '업데이트 소식' 탭에 자세히)
  const latest = S.UPDATES[0];
  if (board.noticeV !== latest.v) {
    board.noticeV = latest.v;
    boardDirty = true;
    sys(`📢 새 업데이트! "${latest.title}" — 마을 게시판(📌)에서 자세히 볼 수 있어요`);
  }
  server.listen(PORT, () => {
    console.log(`📄 알PDF 서버 실행 중: http://localhost:${PORT}`);
    console.log(UP_URL && UP_TOKEN ? '☁️  Upstash 클라우드에 저장해요' : `💾 ${DATA_DIR} 폴더에 저장해요`);
    if (ROOM_CODE) console.log('🔒 비밀 코드가 설정되어 있어요.');
  });
})();
