// 비밀 아지트 - 실시간 서버 (Express + Socket.IO)
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
// 비밀 코드: 호스팅 사이트의 환경변수 ROOM_CODE 로 설정하면, 코드를 아는 사람만 입장 가능
const ROOM_CODE = (process.env.ROOM_CODE || '').trim();

// 맵 크기 (client.js 와 동일하게 유지)
const TILE = 16;
const MAP_W = 40 * TILE;
const MAP_H = 30 * TILE;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server);

const ROOM = 'hideout';
const players = {}; // socket.id -> { id, name, color, x, y, dir, moving }
const chatLog = []; // 최근 대화 50개 보관
let dirty = false;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const DIRS = new Set(['up', 'down', 'left', 'right']);

function pushChat(msg) {
  chatLog.push(msg);
  if (chatLog.length > 50) chatLog.shift();
  io.to(ROOM).emit('chat', msg);
}

io.on('connection', (socket) => {
  let lastChat = 0;

  socket.on('join', (data = {}) => {
    if (players[socket.id]) return;
    if (ROOM_CODE && String(data.code || '').trim() !== ROOM_CODE) {
      socket.emit('joinError', '비밀 코드가 틀렸어요 🔒');
      return;
    }
    const name = String(data.name || '').trim().slice(0, 12) || '손님';
    const color = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#ff8fab';

    // 재접속이면 이전 위치 유지, 아니면 아지트 문 앞에서 시작
    let x = 20.5 * TILE + (Math.random() * 16 - 8);
    let y = 16.5 * TILE;
    if (isNum(data.x) && isNum(data.y)) {
      x = clamp(data.x, 0, MAP_W);
      y = clamp(data.y, 0, MAP_H);
    }

    players[socket.id] = { id: socket.id, name, color, x, y, dir: 'down', moving: false };
    socket.join(ROOM);
    socket.emit('init', { id: socket.id, players, chatLog });
    socket.to(ROOM).emit('playerJoined', players[socket.id]);
    if (!data.rejoin) pushChat({ system: true, text: `${name} 님이 아지트에 들어왔어요 🏠`, t: Date.now() });
    dirty = true;
  });

  socket.on('move', (d = {}) => {
    const p = players[socket.id];
    if (!p || !isNum(d.x) || !isNum(d.y)) return;
    p.x = clamp(d.x, 0, MAP_W);
    p.y = clamp(d.y, 0, MAP_H);
    if (DIRS.has(d.dir)) p.dir = d.dir;
    p.moving = !!d.moving;
    dirty = true;
  });

  socket.on('chat', (text) => {
    const p = players[socket.id];
    if (!p) return;
    const now = Date.now();
    if (now - lastChat < 300) return; // 도배 방지
    lastChat = now;
    text = String(text || '').trim().slice(0, 200);
    if (!text) return;
    pushChat({ id: p.id, name: p.name, color: p.color, text, t: now });
  });

  socket.on('typing', (on) => {
    if (!players[socket.id]) return;
    socket.to(ROOM).emit('typing', { id: socket.id, on: !!on });
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (!p) return;
    delete players[socket.id];
    io.to(ROOM).emit('playerLeft', socket.id);
    pushChat({ system: true, text: `${p.name} 님이 나갔어요 👋`, t: Date.now() });
  });
});

// 위치 정보는 초당 20번, 변화가 있을 때만 모두에게 전송
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  const state = Object.values(players).map((p) => [p.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.dir, p.moving ? 1 : 0]);
  io.to(ROOM).volatile.emit('state', state);
}, 50);

server.listen(PORT, () => {
  console.log(`🏠 비밀 아지트 서버 실행 중: http://localhost:${PORT}`);
  if (ROOM_CODE) console.log('🔒 비밀 코드가 설정되어 있어요.');
});
