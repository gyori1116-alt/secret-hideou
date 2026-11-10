// 비밀 아지트 - 픽셀 그림 (바닥, 블록, 가구, 작물, 아이템 아이콘, 캐릭터)
(function () {
  'use strict';
  const S = window.SHARED;
  const hash = S.hash;

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.round(Math.min(255, Math.max(0, amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const pen = (g, ox, oy) => (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); };

  // world: { g(x,y) → 바닥, o(x,y) → 물건 } (아이콘 그릴 땐 null)
  const gAt = (world, x, y) => (world ? world.g(x, y) : null);
  const oAt = (world, x, y) => (world ? world.o(x, y) : null);

  // ───────── 바닥 ─────────
  function drawGround(R, type, x, y, world) {
    switch (type) {
      case 'path':
        R('#efdcab', 0, 0, 16, 16);
        for (let i = 0; i < 3; i++) R('#dcc48c', Math.floor(hash(x * 5 + i, y) * 14), Math.floor(hash(x, y * 9 + i) * 14), 2, 1);
        break;
      case 'stone_path':
        R('#d3cdc3', 0, 0, 16, 16);
        R('#b5ada1', 0, 7, 16, 1); R('#b5ada1', 8, 0, 1, 7); R('#b5ada1', 3, 8, 1, 8); R('#b5ada1', 12, 8, 1, 8);
        R('#e4dfd6', 1, 1, 3, 1); R('#e4dfd6', 9, 9, 3, 1); R('#e4dfd6', 4, 9, 2, 1);
        break;
      case 'brick_path':
        R('#de9474', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) { R('#bf7556', 0, j * 4 + 3, 16, 1); R('#bf7556', j % 2 ? 3 : 11, j * 4, 1, 3); }
        break;
      case 'sand':
        R('#f3e3b3', 0, 0, 16, 16);
        for (let i = 0; i < 4; i++) R('#e3cd94', Math.floor(hash(x * 3 + i, y * 7) * 15), Math.floor(hash(x * 7, y * 3 + i) * 15), 1, 1);
        break;
      case 'floor_wood':
        R('#e2b07c', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) { R('#c9955f', 0, j * 4 + 3, 16, 1); R('#c9955f', j % 2 ? 4 : 11, j * 4, 1, 3); }
        break;
      case 'floor_pink':
        R('#ffd3de', 0, 0, 16, 16);
        R('#f4b4c6', 0, 7, 16, 1); R('#f4b4c6', 7, 0, 1, 16); R('#ffe8ee', 1, 1, 2, 1); R('#ffe8ee', 9, 9, 2, 1);
        break;
      case 'floor_check':
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) R((i + j) % 2 ? '#bcd7f5' : '#fffaf2', i * 8, j * 8, 8, 8);
        break;
      case 'rug': {
        R('#e98a9b', 0, 0, 16, 16);
        const same = (dx, dy) => gAt(world, x + dx, y + dy) === 'rug';
        const b = '#ffd1dc';
        if (!same(0, -1)) R(b, 0, 2, 16, 1);
        if (!same(0, 1)) R(b, 0, 13, 16, 1);
        if (!same(-1, 0)) R(b, 2, 0, 1, 16);
        if (!same(1, 0)) R(b, 13, 0, 1, 16);
        R('#f6b3c0', 7, 7, 2, 2);
        break;
      }
      case 'farm':
        R('#9b6a43', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) R('#87593a', 1, j * 4 + 1, 14, 2);
        break;
      case 'water': {
        R('#63bde8', 0, 0, 16, 16);
        R('#9fdcf7', Math.floor(hash(x, y) * 10), 4, 4, 1);
        R('#9fdcf7', Math.floor(hash(y, x) * 10) + 2, 11, 3, 1);
        if (world) {
          const edge = (nx, ny) => { const t = gAt(world, nx, ny); return t && t !== 'water'; };
          if (edge(x, y - 1)) R('#4aa3cf', 0, 0, 16, 2);
          if (edge(x - 1, y)) R('#4aa3cf', 0, 0, 2, 16);
          if (edge(x + 1, y)) R('#4aa3cf', 14, 0, 2, 16);
          if (edge(x, y + 1)) R('#4aa3cf', 0, 14, 16, 2);
        }
        break;
      }
      default: // grass
        R('#8fd16f', 0, 0, 16, 16);
        for (let i = 0; i < 3; i++) R('#7bbd5c', Math.floor(hash(x * 7 + i, y * 13) * 15), Math.floor(hash(x * 3, y * 5 + i) * 14), 1, 2);
    }
  }

  // ───────── 벽 ─────────
  const WALLS = {
    wall_wood: ['#c99a6b', '#a5703f', '#7a4e2d'],
    wall_stone: ['#c4c0ba', '#9a958e', '#6f6b67'],
    wall_brick: ['#d97d63', '#b45d45', '#8a4232'],
    wall_white: ['#fdfaf3', '#e6dfd1', '#bdb39f'],
  };
  const isWallLike = (o) => !!o && !!(S.OBJ[o.t] && S.OBJ[o.t].wall);
  function drawWall(R, t, x, y, world) {
    const [top, front, line] = WALLS[t] || WALLS.wall_white;
    const showFront = !isWallLike(oAt(world, x, y + 1));
    R(top, 0, 0, 16, 16);
    // 위에서 본 테두리
    if (!isWallLike(oAt(world, x, y - 1))) R(shade(top, 0.35), 0, 0, 16, 1);
    if (!isWallLike(oAt(world, x - 1, y))) R(line, 0, 0, 1, 16);
    if (!isWallLike(oAt(world, x + 1, y))) R(line, 15, 0, 1, 16);
    if (showFront) {
      R(front, 0, 8, 16, 8); R(line, 0, 8, 16, 1);
      if (t === 'wall_wood') { R(line, 4, 9, 1, 7); R(line, 10, 9, 1, 7); }
      else if (t === 'wall_stone') { R(line, 0, 12, 16, 1); R(line, 5, 9, 1, 3); R(line, 11, 13, 1, 3); }
      else if (t === 'wall_brick') { R(line, 0, 12, 16, 1); R(line, 4, 9, 1, 3); R(line, 11, 9, 1, 3); R(line, 7, 13, 1, 3); }
      else R(line, 0, 14, 16, 2);
    } else {
      if (t === 'wall_wood') { R(shade(top, -0.08), 0, 5, 16, 1); R(shade(top, -0.08), 0, 11, 16, 1); }
      else if (t === 'wall_brick') { R(shade(top, -0.1), 0, 7, 16, 1); }
      else if (t === 'wall_stone') { R(shade(top, -0.08), 4, 4, 5, 1); R(shade(top, -0.08), 9, 10, 5, 1); }
    }
  }

  // ───────── 작물 ─────────
  function drawCrop(R, kind, stage, water) {
    if (water) R('rgba(50,25,10,0.3)', 0, 0, 16, 16);
    if (stage === 0) { R('#5a3d27', 5, 9, 2, 1); R('#5a3d27', 9, 8, 2, 1); R('#5a3d27', 7, 11, 2, 1); return; }
    if (stage === 1) { R('#5fb35f', 7, 8, 2, 4); R('#7ed492', 5, 7, 2, 2); R('#7ed492', 9, 7, 2, 2); return; }
    if (stage === 2) {
      R('#4caf50', 7, 5, 2, 8); R('#66c466', 4, 6, 4, 3); R('#66c466', 8, 4, 4, 3); R('#66c466', 5, 9, 3, 2);
      if (kind === 'sunflower') R('#ffe58a', 6, 2, 4, 3);
      return;
    }
    if (kind === 'carrot') {
      R('#4caf50', 5, 2, 2, 5); R('#4caf50', 9, 2, 2, 5); R('#66c466', 7, 1, 2, 6);
      R('#ff8c3a', 5, 8, 6, 4); R('#ff8c3a', 6, 12, 4, 2); R('#ffa860', 6, 8, 2, 2);
    } else if (kind === 'strawberry') {
      R('#4caf50', 3, 5, 10, 7); R('#66c466', 4, 4, 4, 2);
      R('#e8364f', 4, 8, 3, 3); R('#e8364f', 9, 6, 3, 3); R('#e8364f', 8, 10, 3, 3);
      R('#fff3a3', 5, 9, 1, 1); R('#fff3a3', 10, 7, 1, 1); R('#fff3a3', 9, 11, 1, 1);
    } else if (kind === 'pumpkin') {
      R('#4caf50', 2, 4, 4, 3); R('#ff9a2e', 3, 6, 10, 8); R('#e07f17', 7, 6, 1, 8); R('#e07f17', 4, 7, 1, 6); R('#e07f17', 11, 7, 1, 6);
      R('#ffb860', 5, 7, 2, 2); R('#7a4e2d', 7, 4, 2, 2);
    } else if (kind === 'sunflower') {
      R('#4caf50', 7, 6, 2, 10); R('#66c466', 4, 10, 3, 2); R('#66c466', 9, 9, 3, 2);
      R('#ffd34d', 4, 1, 8, 7); R('#ffd34d', 3, 2, 10, 5); R('#8b5a3c', 6, 3, 4, 3);
    }
  }

  // ───────── 물건 / 블록 / 가구 ─────────
  function drawObject(R, o, x, y, world) {
    const sameT = (dx, dy) => { const n = oAt(world, x + dx, y + dy); return !!n && n.t === o.t; };
    switch (o.t) {
      case 'tree':
        R('rgba(0,0,0,0.12)', 3, 13, 10, 3);
        R('#7a4e2d', 6, 10, 4, 6);
        R('#3f8f45', 2, 3, 12, 8); R('#3f8f45', 1, 5, 14, 4); R('#3f8f45', 4, 1, 8, 11);
        R('#5fb35f', 4, 3, 4, 3); R('#5fb35f', 3, 5, 2, 2);
        R('#2f7236', 9, 8, 3, 2); R('#2f7236', 11, 6, 2, 2);
        break;
      case 'stump':
        R('#7a4e2d', 5, 9, 6, 5); R('#b88252', 5, 9, 6, 2); R('#8b5a3c', 7, 9, 2, 1);
        break;
      case 'sapling':
        R('#7a4e2d', 7, 9, 2, 6); R('#5fb35f', 5, 6, 6, 4); R('#7ed492', 6, 5, 4, 2);
        break;
      case 'rock':
        R('rgba(0,0,0,0.12)', 2, 13, 12, 2);
        R('#8e8a85', 2, 5, 12, 9); R('#a8a49e', 3, 4, 10, 7); R('#c4c0ba', 5, 5, 4, 2); R('#6f6b67', 4, 12, 9, 2);
        break;
      case 'pebble':
        R('#9e9a94', 4, 10, 3, 2); R('#9e9a94', 9, 11, 3, 2); R('#b8b4ae', 7, 7, 2, 2);
        break;
      case 'flower': {
        const cols = ['#ff8fab', '#fff3a3', '#ffffff', '#c9a0ff', '#ffb36b'];
        for (let i = 0; i < 2; i++) {
          const fx = 3 + Math.floor(hash(x + i * 11, y) * 9), fy = 3 + Math.floor(hash(x, y + i * 7) * 9);
          const c = cols[Math.floor(hash(x * 2 + i, y * 3) * cols.length)];
          R('#5aa646', fx, fy + 2, 1, 2); R(c, fx - 1, fy, 3, 1); R(c, fx, fy - 1, 1, 3); R('#ffd34d', fx, fy, 1, 1);
        }
        break;
      }
      case 'crop':
        drawCrop(R, o.kind, o.stage, o.water);
        break;
      case 'wall_wood': case 'wall_stone': case 'wall_brick': case 'wall_white':
        drawWall(R, o.t, x, y, world);
        break;
      case 'window':
        drawWall(R, 'wall_white', x, y, world);
        R('#8b5a3c', 3, 3, 10, 10); R('#bfe9ff', 4, 4, 8, 8); R('#ffffff', 5, 5, 2, 2);
        R('#8b5a3c', 7, 4, 1, 8); R('#8b5a3c', 4, 7, 8, 1); R('#f7c6d0', 3, 12, 10, 1);
        break;
      case 'door':
        if (o.open) {
          R('#6e4626', 0, 0, 2, 16); R('#6e4626', 14, 0, 2, 16); R('#6e4626', 0, 0, 16, 2);
          R('#a8743f', 1, 2, 2, 14);
        } else {
          R('#6e4626', 1, 0, 14, 16); R('#a8743f', 2, 1, 12, 15); R('#c99558', 3, 2, 10, 5); R('#c99558', 3, 9, 10, 5);
          R('#ffd34d', 11, 8, 2, 2);
        }
        break;
      case 'fence': {
        const c = '#c99558', d = '#a8743f';
        if (sameT(-1, 0)) { R(d, 0, 6, 7, 2); R(d, 0, 10, 7, 2); }
        if (sameT(1, 0)) { R(d, 9, 6, 7, 2); R(d, 9, 10, 7, 2); }
        if (sameT(0, -1)) R(d, 7, 0, 2, 5);
        if (sameT(0, 1)) R(d, 7, 12, 2, 4);
        R(d, 6, 4, 4, 10); R(c, 6, 4, 4, 2);
        break;
      }
      case 'sign':
        R('#7a4e2d', 7, 8, 2, 8);
        R('#a8743f', 1, 2, 14, 7); R('#c99558', 2, 3, 12, 5);
        R('#7a4e2d', 4, 4, 8, 1); R('#7a4e2d', 4, 6, 6, 1);
        break;
      case 'lamp':
        R('#3b3740', 5, 14, 6, 2); R('#5a5560', 7, 4, 2, 11);
        R('#3b3740', 4, 0, 8, 1); R('#fff3a3', 5, 1, 6, 4); R('#ffe066', 6, 2, 4, 2); R('#3b3740', 5, 5, 6, 1);
        break;
      case 'table':
        R('#9c6b3f', 0, 4, 16, 8); R('#b88252', 0, 4, 16, 2);
        if (!sameT(-1, 0)) { R('#7a4e2d', 0, 4, 1, 8); R('#6e4626', 1, 12, 2, 3); }
        if (!sameT(1, 0)) { R('#7a4e2d', 15, 4, 1, 8); R('#6e4626', 13, 12, 2, 3); }
        if (hash(x, y) < 0.4) { R('#ffffff', 5, 5, 5, 4); R('#8b5a3c', 6, 6, 3, 2); R('#ffffff', 10, 6, 1, 2); }
        else if (hash(x, y) < 0.7) { R('#ffd95e', 6, 5, 5, 3); R('#ff8fab', 7, 4, 3, 1); }
        break;
      case 'chair':
        R('#8b5a3c', 4, 1, 8, 6); R('#a8743f', 5, 2, 6, 4);
        R('#c99558', 3, 7, 10, 4); R('#6e4626', 4, 11, 2, 4); R('#6e4626', 10, 11, 2, 4);
        break;
      case 'sofa':
        R('#c45686', 0, 1, 16, 6); R('#d96c9b', 0, 6, 16, 8); R('#e88bb4', 1, 7, 14, 2);
        if (!sameT(-1, 0)) R('#b04a76', 0, 3, 3, 11);
        if (!sameT(1, 0)) R('#b04a76', 13, 3, 3, 11);
        break;
      case 'bed':
        R('#8b5a3c', 1, 0, 14, 16); R('#ffffff', 2, 1, 12, 5); R('#e6e6f0', 2, 5, 12, 1);
        R('#9b8cff', 2, 6, 12, 9); R('#b8adff', 2, 7, 12, 1); R('#ffffff', 4, 10, 2, 2); R('#ffffff', 9, 12, 2, 2);
        break;
      case 'shelf': {
        R('#7b4a2a', 1, 0, 14, 16); R('#5a3520', 1, 7, 14, 1); R('#5a3520', 1, 15, 14, 1);
        const bc = ['#ff8fab', '#6ec6ff', '#ffd95e', '#7ed492', '#c9a0ff'];
        for (let i = 0; i < 5; i++) {
          R(bc[(i + x) % 5], 2 + i * 2 + (i > 2 ? 1 : 0), 2 + (i % 2), 2, 5 - (i % 2));
          R(bc[(i + x + 2) % 5], 2 + i * 2 + (i > 1 ? 1 : 0), 9 + ((i + 1) % 2), 2, 6 - ((i + 1) % 2));
        }
        break;
      }
      case 'plant':
        R('#c0623b', 5, 10, 6, 5); R('#d97a50', 4, 9, 8, 2);
        R('#4caf50', 3, 4, 10, 6); R('#66c466', 5, 1, 6, 5); R('#3d8f40', 7, 6, 2, 4);
        break;
      case 'teddy':
        R('#b07a4f', 3, 1, 3, 3); R('#b07a4f', 10, 1, 3, 3);
        R('#b07a4f', 4, 7, 8, 7); R('#b07a4f', 4, 2, 8, 6); R('#e8c39e', 6, 5, 4, 2);
        R('#2b2233', 5, 4, 1, 1); R('#2b2233', 10, 4, 1, 1); R('#2b2233', 7, 5, 2, 1);
        R('#ff5c8a', 6, 8, 4, 1); R('#e8c39e', 6, 10, 4, 3);
        break;
      case 'shop':
        for (let i = 0; i < 4; i++) R(i % 2 ? '#ffffff' : '#ff8fab', i * 4, 0, 4, 4);
        R('#e0708f', 0, 4, 16, 1);
        R('#ffb36b', 4, 5, 8, 5); R('#ffb36b', 4, 4, 2, 1); R('#ffb36b', 10, 4, 2, 1);
        R('#2b2233', 6, 7, 1, 1); R('#2b2233', 9, 7, 1, 1); R('#ff8fab', 7, 8, 2, 1);
        R('#a8743f', 0, 9, 16, 7); R('#c99558', 0, 9, 16, 2);
        R('#6ec6ff', 2, 12, 4, 2); R('#ff8c3a', 10, 12, 3, 2);
        break;
      case 'board':
        R('#7a4e2d', 2, 8, 2, 8); R('#7a4e2d', 12, 8, 2, 8);
        R('#a8743f', 1, 1, 14, 10); R('#c99558', 2, 2, 12, 8);
        R('#ffffff', 3, 3, 4, 5); R('#fff3a3', 9, 3, 4, 6); R('#e85d5d', 4, 3, 2, 1); R('#e85d5d', 10, 3, 2, 1);
        R('#e85d5d', 7, 11, 2, 1);
        break;
    }
  }

  function drawTile(g, ox, oy, x, y, world) {
    const R = pen(g, ox, oy);
    drawGround(R, world.g(x, y), x, y, world);
    const o = world.o(x, y);
    if (o) drawObject(R, o, x, y, world);
  }

  // ───────── 동물 ─────────
  // (x, y) = 발 위치, 오른쪽을 보는 그림을 left 일 때 뒤집어요
  function drawAnimal(g, x, y, kind, dir, step) {
    const flip = dir === 'left' ? -1 : 1;
    const R = (c, rx, ry, w, h) => { g.fillStyle = c; g.fillRect(flip > 0 ? x + rx : x - rx - w, y + ry, w, h); };
    const b = step === 0 ? -1 : 0;
    const legs = (c, xs, h) => xs.forEach((lx, i) => R(c, lx, -h + (step !== -1 && (i % 2) === step ? -1 : 0), 2, h));
    switch (kind) {
      case 'chicken':
        R('rgba(0,0,0,0.15)', -4, -1, 8, 2);
        legs('#ff9a2e', [-2, 1], 2);
        R('#ffffff', -4, -8 + b, 8, 6); R('#ffffff', -5, -9 + b, 2, 3); R('#e6e6f0', -2, -6 + b, 4, 2);
        R('#ffffff', 1, -11 + b, 4, 4); R('#e8364f', 2, -12 + b, 2, 1); R('#e8364f', 4, -8 + b, 1, 1);
        R('#ff9a2e', 5, -10 + b, 2, 1); R('#2b2233', 3, -10 + b, 1, 1);
        break;
      case 'cow':
        R('rgba(0,0,0,0.15)', -7, -1, 14, 2);
        legs('#e6e0d6', [-6, -3, 1, 4], 4);
        R('#ffffff', -7, -11 + b, 12, 7); R('#3b3740', -5, -10 + b, 3, 3); R('#3b3740', 0, -7 + b, 3, 2); R('#3b3740', 2, -11 + b, 2, 2);
        R('#3b3740', -8, -11 + b, 1, 4); R('#ffadc0', -2, -4 + b, 3, 1);
        R('#ffffff', 4, -13 + b, 5, 6); R('#ffadc0', 6, -9 + b, 4, 2); R('#2b2233', 6, -12 + b, 1, 1);
        R('#e8d3a8', 4, -14 + b, 1, 1); R('#e8d3a8', 8, -14 + b, 1, 1); R('#3b3740', 3, -12 + b, 1, 2);
        break;
      case 'sheep':
        R('rgba(0,0,0,0.15)', -6, -1, 12, 2);
        legs('#4a3b5c', [-5, -2, 1, 3], 3);
        R('#f7f4ee', -6, -10 + b, 11, 7); R('#f7f4ee', -5, -11 + b, 9, 1); R('#f7f4ee', -7, -9 + b, 1, 5);
        R('#e6e0d6', -4, -6 + b, 7, 1); R('#ffffff', -4, -10 + b, 3, 1);
        R('#4a3b5c', 4, -11 + b, 4, 5); R('#4a3b5c', 3, -11 + b, 1, 2); R('#ffffff', 6, -10 + b, 1, 1);
        break;
      case 'rabbit':
        R('rgba(0,0,0,0.15)', -4, -1, 8, 2);
        R('#c9a27a', -3, -6 + b, 6, 5); R('#c9a27a', -2, -2, 2, 2); R('#c9a27a', 2, -2, 2, 2);
        R('#ffffff', -4, -5 + b, 2, 2);
        R('#c9a27a', 1, -9 + b, 4, 4); R('#c9a27a', 1, -14 + b, 1, 5); R('#c9a27a', 3, -14 + b, 1, 5);
        R('#ffadc0', 3, -13 + b, 1, 3); R('#2b2233', 3, -8 + b, 1, 1); R('#ffadc0', 5, -7 + b, 1, 1);
        break;
      case 'boar':
        R('rgba(0,0,0,0.15)', -7, -1, 14, 2);
        legs('#4f3423', [-6, -3, 1, 3], 3);
        R('#7a5236', -7, -10 + b, 12, 7); R('#5a3a26', -6, -11 + b, 9, 1); R('#8e6446', -5, -9 + b, 6, 2);
        R('#7a5236', 4, -10 + b, 5, 5); R('#ffadc0', 8, -8 + b, 2, 2); R('#ffffff', 8, -6 + b, 1, 2);
        R('#2b2233', 6, -9 + b, 1, 1); R('#5a3a26', 4, -11 + b, 2, 1); R('#5a3a26', -8, -9 + b, 1, 2);
        break;
    }
  }

  // ───────── 아이템 아이콘 (16×16) ─────────
  const FISH_COL = { fish_minnow: '#c8d6dc', fish_crucian: '#9aa7b0', fish_tropical: '#ffb36b', fish_puffer: '#f2d16b', fish_golden: '#ffd34d' };
  const SEED_COL = { carrot: '#ff8c3a', strawberry: '#e8364f', sunflower: '#ffd34d', pumpkin: '#ff9a2e' };
  function drawItem(g, ox, oy, id) {
    const R = pen(g, ox, oy);
    const it = S.ITEMS[id];
    if (!it) return;
    if (it.ground) { drawGround(R, it.ground, 3, 5, null); R('rgba(0,0,0,0.15)', 0, 15, 16, 1); return; }
    if (it.obj) {
      if (S.OBJ[it.obj].wall && it.obj !== 'door') { drawObject(R, { t: it.obj }, 0, 0, null); return; }
      drawObject(R, { t: it.obj, open: false }, 0, 0, null);
      return;
    }
    if (it.seed) {
      R('#e8d3a8', 3, 2, 10, 13); R('#d4b98a', 3, 2, 10, 2); R('#ffffff', 5, 6, 6, 6);
      R(SEED_COL[it.seed], 6, 7, 4, 4); R('#4caf50', 7, 5, 2, 2);
      return;
    }
    if (S.CROPS[id]) { drawCrop(R, id, 3, false); return; }
    if (it.animal) { drawAnimal(g, ox + 8, oy + 15, it.animal, 'right', -1); return; }
    if (it.fish) {
      const c = FISH_COL[id];
      if (id === 'fish_puffer') {
        R(c, 3, 4, 9, 9); R(c, 2, 6, 11, 5); R('#c9a23a', 1, 5, 1, 1); R('#c9a23a', 6, 2, 1, 2); R('#c9a23a', 9, 13, 1, 2);
        R(c, 12, 7, 3, 3); R('#2b2233', 5, 7, 1, 1); R('#ffffff', 4, 9, 4, 2);
        return;
      }
      R(c, 2, 6, 10, 5); R(c, 4, 5, 6, 7); R(c, 12, 5, 3, 7); R(shade(c, -0.25), 12, 7, 1, 3);
      R('#2b2233', 4, 7, 1, 1); R(shade(c, 0.4), 5, 6, 4, 1);
      if (id === 'fish_tropical') { R('#ffffff', 7, 5, 1, 7); R('#ffffff', 10, 6, 1, 5); }
      if (id === 'fish_golden') { R('#ffffff', 1, 2, 1, 1); R('#ffffff', 13, 2, 1, 1); R('#fff3a3', 6, 8, 3, 1); }
      return;
    }
    switch (id) {
      case 'hoe': for (let i = 0; i < 10; i++) R('#a8743f', 3 + i, 14 - i, 2, 1); R('#9aa7b0', 9, 2, 6, 3); R('#c4ced6', 9, 2, 6, 1); break;
      case 'can': R('#6ec6ff', 3, 7, 9, 7); R('#4a9fd6', 3, 13, 9, 1); R('#6ec6ff', 12, 8, 3, 2); R('#6ec6ff', 14, 6, 1, 2); R('#4a9fd6', 5, 4, 5, 1); R('#4a9fd6', 5, 4, 1, 3); R('#4a9fd6', 9, 4, 1, 3); R('#bfe9ff', 5, 8, 3, 2); break;
      case 'rod': for (let i = 0; i < 11; i++) R('#a8743f', 2 + i, 14 - i, 1, 1); R('#ffffff', 13, 3, 1, 9); R('#e85d5d', 12, 11, 3, 2); break;
      case 'wood': R('#a8743f', 2, 5, 12, 7); R('#8b5a3c', 2, 8, 12, 1); R('#e2b07c', 11, 5, 3, 7); R('#c9955f', 12, 7, 1, 3); break;
      case 'stone': R('#8e8a85', 3, 5, 10, 8); R('#a8a49e', 4, 4, 8, 6); R('#c4c0ba', 5, 5, 3, 2); break;
      case 'bow':
        for (let i = 0; i < 6; i++) { R('#a8743f', 3 + Math.round(i * 0.4), 2 + i, 2, 1); R('#a8743f', 3 + Math.round(i * 0.4), 13 - i, 2, 1); }
        R('#ffffff', 4, 2, 1, 12); R('#9aa7b0', 6, 7, 8, 1); R('#e85d5d', 13, 6, 2, 3); R('#ffffff', 5, 6, 2, 3);
        break;
      case 'egg': R('#fff7ec', 5, 3, 6, 10); R('#fff7ec', 4, 5, 8, 7); R('#e8dcc8', 5, 11, 6, 2); R('#ffffff', 6, 5, 2, 2); break;
      case 'milk': R('#6ec6ff', 5, 2, 6, 3); R('#ffffff', 4, 5, 8, 9); R('#6ec6ff', 4, 8, 8, 3); R('#e6e6f0', 4, 13, 8, 1); break;
      case 'wool': R('#f7f4ee', 3, 5, 10, 7); R('#f7f4ee', 5, 3, 6, 11); R('#e6e0d6', 4, 9, 8, 1); R('#ffffff', 6, 5, 3, 2); break;
      case 'meat': R('#e85d5d', 3, 4, 8, 7); R('#ff8080', 4, 5, 4, 2); R('#fff7ec', 10, 9, 4, 2); R('#fff7ec', 13, 8, 2, 4); break;
      case 'hide': R('#a8743f', 3, 3, 10, 10); R('#a8743f', 1, 5, 14, 6); R('#8b5a3c', 5, 6, 6, 4); break;
      case 'boot': R('#7a4e2d', 5, 2, 5, 9); R('#7a4e2d', 5, 10, 9, 4); R('#5a3520', 5, 13, 9, 1); R('#9c6b3f', 6, 3, 3, 1); break;
    }
  }

  // ───────── 캐릭터 ─────────
  // (x, y) = 발 위치. av = 아바타, step: -1 서있음 / 0,1 걷기
  function drawChar(g, x, y, av, dir, step) {
    const R = pen(g, x, y);
    const skin = S.SKINS[av.skin] || S.SKINS[0];
    const hair = S.HAIR_COLORS[av.hc] || S.HAIR_COLORS[0];
    const tc = S.CLOTH[av.tc] || S.CLOTH[0], bc = S.CLOTH[av.bc] || S.CLOTH[8];
    const top = (S.TOPS[av.top] || S.TOPS[0]).id;
    const hs = (S.HAIR_STYLES[av.hs] || S.HAIR_STYLES[0]).id;
    const eyes = (S.EYES[av.eyes] || S.EYES[0]).id;
    const ink = '#2b2233', shoe = '#3b2f45';
    const b = step === 0 ? -1 : 0;
    const side = dir === 'left' || dir === 'right';
    const fl = dir === 'left' ? 1 : -1; // 옆모습일 때 뒤통수 방향 (left 보면 +)

    R('rgba(0,0,0,0.18)', -5, -1, 10, 2);
    // 다리
    const leg = top === 'dress' ? skin : (top === 'overalls' ? tc : bc);
    const L = (lx, ly, h) => { R(leg, lx, ly, 3, h); R(shoe, lx, ly + h - 1, 3, 1); };
    if (step === -1) { L(-4, -4, 4); L(1, -4, 4); }
    else if (step === 0) { L(-4, -5, 5); L(1, -4, 3); }
    else { L(-4, -4, 3); L(1, -5, 5); }

    // 몸통
    const tcd = shade(tc, -0.2);
    if (top === 'overalls') {
      R('#ffffff', -5, -10 + b, 10, 6); R(tc, -4, -8 + b, 8, 4); R(tc, -4, -10 + b, 1, 2); R(tc, 3, -10 + b, 1, 2);
      R('#ffd34d', -3, -8 + b, 1, 1); R('#ffd34d', 2, -8 + b, 1, 1);
    } else if (top === 'dress') {
      R(tc, -5, -10 + b, 10, 5); R(tc, -6, -5 + b, 12, 3); R(tcd, -6, -3 + b, 12, 1); R(shade(tc, 0.3), -1, -10 + b, 2, 1);
    } else {
      R(tc, -5, -10 + b, 10, 6); R(tcd, -5, -5 + b, 10, 1);
      if (top === 'stripe') { R('#ffffff', -5, -8 + b, 10, 1); R('#ffffff', -5, -6 + b, 10, 1); }
      if (top === 'hoodie') { R(tcd, -3, -7 + b, 6, 2); R('#ffffff', -2, -10 + b, 1, 2); R('#ffffff', 1, -10 + b, 1, 2); }
    }
    // 팔
    const arm = top === 'hoodie' ? tc : skin;
    R(arm, -6, -9 + b, 1, 4); R(arm, 5, -9 + b, 1, 4);
    if (top === 'hoodie') { R(skin, -6, -6 + b, 1, 1); R(skin, 5, -6 + b, 1, 1); }

    // 머리 (얼굴)
    const hy = -21 + b;
    R(skin, -6, hy + 1, 12, 10); R(skin, -5, hy, 10, 12);

    // 머리카락
    R(hair, -6, hy, 12, 3); R(hair, -5, hy - 1, 10, 1);
    const back = fl > 0 ? 2 : -6; // 옆모습일 때 뒤쪽 머리 x
    if (dir === 'up') {
      R(hair, -6, hy, 12, 10); R(hair, -5, hy + 10, 10, 1);
      if (hs === 'long') { R(hair, -7, hy + 1, 14, 13); }
      if (hs === 'bob') { R(hair, -7, hy + 1, 14, 9); }
    } else if (side) {
      R(hair, back, hy, 4, 8);
      if (hs === 'long') R(hair, fl > 0 ? 2 : -7, hy, 5, 14);
      if (hs === 'bob') { R(hair, fl > 0 ? 2 : -7, hy, 5, 10); R(hair, fl > 0 ? -6 : -2, hy + 2, 8, 2); }
      if (hs !== 'bob') R(hair, fl > 0 ? -6 : 3, hy + 2, 3, 1);
    } else {
      if (hs === 'long') { R(hair, -7, hy + 1, 2, 12); R(hair, 5, hy + 1, 2, 12); R(hair, -5, hy + 3, 4, 1); R(hair, 2, hy + 3, 3, 1); }
      else if (hs === 'bob') { R(hair, -7, hy + 1, 2, 9); R(hair, 5, hy + 1, 2, 9); R(hair, -6, hy + 3, 12, 2); }
      else { R(hair, -6, hy + 3, 1, 3); R(hair, 5, hy + 3, 1, 3); R(hair, -3, hy + 3, 4, 1); }
    }
    if (hs === 'twin') {
      const tie = '#ff5c8a';
      if (dir !== 'right') { R(hair, -9, hy + 3, 3, 7); R(tie, -8, hy + 3, 2, 1); }
      if (dir !== 'left') { R(hair, 6, hy + 3, 3, 7); R(tie, 6, hy + 3, 2, 1); }
    }
    if (hs === 'bun') { R(hair, -3, hy - 4, 6, 3); R(hair, -2, hy - 5, 4, 1); R(shade(hair, 0.2), -1, hy - 4, 2, 1); }
    if (hs === 'spiky') { R(hair, -6, hy - 2, 2, 2); R(hair, -2, hy - 3, 2, 2); R(hair, 2, hy - 3, 2, 2); R(hair, 5, hy - 1, 2, 2); }

    // 눈
    const eye = (ex, wink) => {
      const ey = hy + 6;
      if (wink || eyes === 'sleepy') { R(ink, ex - 1, ey + 1, 3, 1); return; }
      if (eyes === 'happy') { R(ink, ex - 1, ey + 1, 1, 1); R(ink, ex, ey, 1, 1); R(ink, ex + 1, ey + 1, 1, 1); return; }
      if (eyes === 'sparkle') { R(ink, ex, ey - 1, 2, 3); R('#ffffff', ex, ey - 1, 1, 1); return; }
      R(ink, ex, ey, 2, 2);
    };
    if (dir === 'down') {
      eye(-4, false); eye(2, eyes === 'wink');
      R('#c96a6a', -1, hy + 9, 2, 1);
      if (av.blush) { R('#ffadc0', -5, hy + 8, 2, 1); R('#ffadc0', 3, hy + 8, 2, 1); }
    } else if (side) {
      eye(fl > 0 ? -4 : 2, false);
      if (av.blush) R('#ffadc0', fl > 0 ? -5 : 3, hy + 8, 2, 1);
    }

    // 액세서리
    switch (av.acc) {
      case 'ribbon': R('#ff5c8a', 1, hy - 2, 2, 3); R('#ff5c8a', 5, hy - 2, 2, 3); R('#d63d6c', 3, hy - 1, 2, 1); break;
      case 'flower': R('#ffb3c7', 2, hy - 1, 3, 1); R('#ffb3c7', 3, hy - 2, 1, 3); R('#fff3a3', 3, hy - 1, 1, 1); break;
      case 'glasses':
        if (dir === 'down') { R(ink, -5, hy + 5, 4, 1); R(ink, -5, hy + 8, 4, 1); R(ink, -5, hy + 5, 1, 4); R(ink, -2, hy + 5, 1, 4); R(ink, 1, hy + 5, 4, 1); R(ink, 1, hy + 8, 4, 1); R(ink, 1, hy + 5, 1, 4); R(ink, 4, hy + 5, 1, 4); R(ink, -1, hy + 6, 2, 1); }
        else if (side) { const gx = fl > 0 ? -6 : 1; R(ink, gx, hy + 5, 5, 1); R(ink, gx, hy + 8, 5, 1); R(ink, gx + (fl > 0 ? 0 : 4), hy + 5, 1, 4); }
        break;
      case 'cap':
        R('#e85d5d', -6, hy - 2, 12, 4); R('#ff8080', -4, hy - 2, 4, 1);
        if (dir === 'down') R('#b84444', -6, hy + 2, 12, 1);
        else if (dir === 'left') R('#b84444', -9, hy + 1, 5, 1);
        else if (dir === 'right') R('#b84444', 4, hy + 1, 5, 1);
        break;
      case 'catears': {
        const c = av.hc === 3 || av.hc === 6 ? '#ffb36b' : hair;
        R(c, -6, hy - 3, 3, 3); R(c, 3, hy - 3, 3, 3); R(c, -5, hy - 4, 1, 1); R(c, 4, hy - 4, 1, 1);
        if (dir !== 'up') { R('#ffadc0', -5, hy - 2, 1, 1); R('#ffadc0', 4, hy - 2, 1, 1); }
        break;
      }
      case 'bunny':
        R('#ffffff', -5, hy - 7, 3, 7); R('#ffffff', 2, hy - 7, 3, 7);
        if (dir !== 'up') { R('#ffadc0', -4, hy - 6, 1, 5); R('#ffadc0', 3, hy - 6, 1, 5); }
        break;
      case 'crown':
        R('#ffd34d', -4, hy - 3, 8, 2); R('#ffd34d', -4, hy - 5, 1, 2); R('#ffd34d', -1, hy - 6, 2, 3); R('#ffd34d', 3, hy - 5, 1, 2);
        R('#ff5c8a', -1, hy - 3, 2, 1); R('#6ec6ff', -3, hy - 3, 1, 1); R('#6ec6ff', 2, hy - 3, 1, 1);
        break;
    }
  }

  window.DRAW = { shade, drawTile, drawItem, drawChar, drawAnimal, drawGround, drawObject, pen };
})();
