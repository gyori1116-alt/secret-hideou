// 알PDF - 픽셀 그림 (바닥, 블록, 가구, 작물, 아이템 아이콘, 동물, 캐릭터, 움직이는 그림)
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
  const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];

  function drawRug(R, type, x, y, world, fill, border, dot) {
    R(fill, 0, 0, 16, 16);
    const same = (dx, dy) => gAt(world, x + dx, y + dy) === type;
    if (!same(0, -1)) R(border, 0, 2, 16, 1);
    if (!same(0, 1)) R(border, 0, 13, 16, 1);
    if (!same(-1, 0)) R(border, 2, 0, 1, 16);
    if (!same(1, 0)) R(border, 13, 0, 1, 16);
    if (dot) R(dot, 7, 7, 2, 2);
  }

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
      case 'floor_dark':
        R('#8b5a3c', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) { R('#6e4626', 0, j * 4 + 3, 16, 1); R('#6e4626', j % 2 ? 5 : 12, j * 4, 1, 3); R('#9c6b4a', 2, j * 4 + 1, 3, 1); }
        break;
      case 'floor_pink':
        R('#ffd3de', 0, 0, 16, 16);
        R('#f4b4c6', 0, 7, 16, 1); R('#f4b4c6', 7, 0, 1, 16); R('#ffe8ee', 1, 1, 2, 1); R('#ffe8ee', 9, 9, 2, 1);
        break;
      case 'floor_mint':
        R('#c8efdc', 0, 0, 16, 16);
        R('#9fd9bd', 0, 7, 16, 1); R('#9fd9bd', 7, 0, 1, 16); R('#e4fbf0', 1, 1, 2, 1); R('#e4fbf0', 9, 9, 2, 1);
        break;
      case 'floor_check':
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) R((i + j) % 2 ? '#bcd7f5' : '#fffaf2', i * 8, j * 8, 8, 8);
        break;
      case 'floor_marble':
        R('#f4f1ec', 0, 0, 16, 16); R('#e0dbd2', 0, 15, 16, 1); R('#e0dbd2', 15, 0, 1, 16);
        if (hash(x, y) < 0.5) { R('#d6d0c6', 2, 4, 5, 1); R('#d6d0c6', 6, 5, 4, 1); R('#d6d0c6', 9, 6, 3, 1); }
        else { R('#d6d0c6', 4, 10, 4, 1); R('#d6d0c6', 8, 9, 5, 1); }
        R('#ffffff', 2, 2, 2, 1);
        break;
      case 'floor_bath':
        R('#dff1fb', 0, 0, 16, 16);
        for (let i = 0; i < 4; i++) { R('#b5d8ec', i * 4 + 3, 0, 1, 16); R('#b5d8ec', 0, i * 4 + 3, 16, 1); }
        break;
      case 'floor_kitchen':
        R('#e9a77f', 0, 0, 16, 16);
        R('#c98463', 0, 7, 16, 1); R('#c98463', 7, 0, 1, 16); R('#c98463', 0, 15, 16, 1); R('#c98463', 15, 0, 1, 16);
        R('#f4bf9c', 1, 1, 3, 1); R('#f4bf9c', 9, 9, 3, 1);
        break;
      case 'floor_herring':
        R('#dcae7a', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const c = (i + j) % 2 ? '#c4945f' : '#e8c08f';
          if ((i + j) % 2) R(c, i * 4, j * 4, 2, 4); else R(c, i * 4, j * 4, 4, 2);
        }
        break;
      case 'carpet_blue':
        R('#7fa8e0', 0, 0, 16, 16);
        for (let i = 0; i < 5; i++) R('#6d95cc', Math.floor(hash(x * 9 + i, y * 2) * 15), Math.floor(hash(x * 2, y * 9 + i) * 15), 1, 1);
        break;
      case 'rug':
        drawRug(R, 'rug', x, y, world, '#e98a9b', '#ffd1dc', '#f6b3c0');
        break;
      case 'rug_green':
        drawRug(R, 'rug_green', x, y, world, '#6cbf8c', '#d6f5e1', '#a6e3bd');
        break;
      case 'rug_rainbow': {
        for (let i = 0; i < 6; i++) R(RAINBOW[(i + (y % 6)) % 6], 0, Math.round(i * 16 / 6), 16, 3);
        const same = (dx, dy) => gAt(world, x + dx, y + dy) === 'rug_rainbow';
        if (!same(0, -1)) R('#ffffff', 0, 1, 16, 1);
        if (!same(0, 1)) R('#ffffff', 0, 14, 16, 1);
        if (!same(-1, 0)) R('#ffffff', 1, 0, 1, 16);
        if (!same(1, 0)) R('#ffffff', 14, 0, 1, 16);
        break;
      }
      case 'floor_star':
        R('#2b2550', 0, 0, 16, 16);
        for (let i = 0; i < 3; i++) {
          const sx = Math.floor(hash(x * 7 + i, y * 3) * 14) + 1, sy = Math.floor(hash(x * 3, y * 7 + i) * 14) + 1;
          R(i ? '#fff3a3' : '#ffffff', sx, sy, 1, 1);
        }
        if (hash(x, y * 2) < 0.3) { R('#fff3a3', 7, 6, 1, 3); R('#fff3a3', 6, 7, 3, 1); }
        break;
      case 'floor_gold':
        R('#f2c230', 0, 0, 16, 16); R('#d9a81c', 0, 15, 16, 1); R('#d9a81c', 15, 0, 1, 16);
        R('#ffe27a', 2, 2, 5, 1); R('#ffe27a', 2, 2, 1, 4); R('#fff6c9', 3, 3, 1, 1);
        break;
      case 'dungeon': {
        const st = S.dungeonStar(x);
        const [a, b, c] = st === 1 ? ['#4f5a4a', '#5f6b58', '#43503f'] : st === 2 ? ['#5b5560', '#6a6470', '#4d4852'] : ['#5a3a34', '#6b463e', '#4a2e2a'];
        R(a, 0, 0, 16, 16); R(c, 0, 7, 16, 1); R(c, 8, 0, 1, 7); R(c, 3, 8, 1, 8); R(c, 12, 8, 1, 8);
        R(b, 1, 1, 3, 1); R(b, 9, 9, 3, 1);
        if (st === 1 && hash(x, y) < 0.2) R('#6e9e4a', 4, 3, 2, 1);
        if (st === 2 && hash(x, y) < 0.08) { R('#e6e0d6', 5, 11, 4, 1); R('#e6e0d6', 4, 10, 1, 3); }
        break;
      }
      case 'lava':
        R('#e8502a', 0, 0, 16, 16); R('#ffb02e', Math.floor(hash(x, y) * 10), 4, 4, 2); R('#ffd34d', Math.floor(hash(y, x) * 10) + 2, 11, 3, 1);
        if (world) { const e = (nx, ny) => gAt(world, nx, ny) !== 'lava'; if (e(x, y - 1)) R('#8a2e1a', 0, 0, 16, 2); if (e(x, y + 1)) R('#8a2e1a', 0, 14, 16, 2); }
        break;
      case 'path_park':
        R('#c9c2b8', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) { R('#a89f93', 0, j * 4 + 3, 16, 1); R('#a89f93', (j % 2 ? 0 : 4) + 0, j * 4, 1, 3); R('#a89f93', (j % 2 ? 8 : 12), j * 4, 1, 3); }
        R('#d9734f', 1, 1, 2, 2); R('#d9734f', 9, 9, 2, 2);
        break;
      case 'floor_cafe':
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) R((i + j) % 2 ? '#2b2233' : '#f4efe6', i * 4, j * 4, 4, 4);
        break;
      case 'floor_hex':
        R('#f2e6c9', 0, 0, 16, 16);
        for (const [hx, hy] of [[0, 0], [8, 4], [0, 8], [8, 12]]) { R('#d9c79f', hx, hy, 8, 1); R('#d9c79f', hx, hy, 1, 4); R('#fff6e0', hx + 2, hy + 1, 3, 1); }
        break;
      case 'floor_straw':
        R('#e8d48f', 0, 0, 16, 16);
        for (let j = 0; j < 16; j += 2) R('#d4bd72', 0, j, 16, 1);
        R('#9b8a4a', 0, 0, 16, 1); R('#9b8a4a', 0, 15, 16, 1);
        break;
      case 'floor_wood_white':
        R('#f4ead9', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) { R('#e0d2b8', 0, j * 4 + 3, 16, 1); R('#e0d2b8', j % 2 ? 6 : 13, j * 4, 1, 3); }
        break;
      case 'floor_stone_tile':
        R('#b9b4ad', 0, 0, 16, 16); R('#9a958e', 0, 15, 16, 1); R('#9a958e', 15, 0, 1, 16); R('#cfcac3', 1, 1, 6, 1); R('#a8a39c', 9, 10, 4, 2);
        break;
      case 'carpet_red':
        R('#c0392b', 0, 0, 16, 16);
        for (let i = 0; i < 5; i++) R('#a93226', Math.floor(hash(x * 9 + i, y * 2) * 15), Math.floor(hash(x * 2, y * 9 + i) * 15), 1, 1);
        if (gAt(world, x - 1, y) !== 'carpet_red') R('#ffd34d', 1, 0, 1, 16);
        if (gAt(world, x + 1, y) !== 'carpet_red') R('#ffd34d', 14, 0, 1, 16);
        break;
      case 'rug_blue':
        drawRug(R, 'rug_blue', x, y, world, '#6e9fe0', '#d6e8ff', '#a9c9f5');
        break;
      case 'farm':
        R('#9b6a43', 0, 0, 16, 16);
        for (let j = 0; j < 4; j++) R('#87593a', 1, j * 4 + 1, 14, 2);
        break;
      case 'water': {
        const cave = world && S.zoneAt(x, y) === 'cave';
        R(cave ? '#3f7fae' : '#63bde8', 0, 0, 16, 16);
        R(cave ? '#6aa6d1' : '#9fdcf7', Math.floor(hash(x, y) * 10), 4, 4, 1);
        R(cave ? '#6aa6d1' : '#9fdcf7', Math.floor(hash(y, x) * 10) + 2, 11, 3, 1);
        if (world) {
          const edge = (nx, ny) => { const t = gAt(world, nx, ny); return t && t !== 'water'; };
          const e = cave ? '#2d6690' : '#4aa3cf';
          if (edge(x, y - 1)) R(e, 0, 0, 16, 2);
          if (edge(x - 1, y)) R(e, 0, 0, 2, 16);
          if (edge(x + 1, y)) R(e, 14, 0, 2, 16);
          if (edge(x, y + 1)) R(e, 0, 14, 16, 2);
        }
        break;
      }
      case 'forest':
        R('#74b85e', 0, 0, 16, 16);
        for (let i = 0; i < 4; i++) R('#5f9f4b', Math.floor(hash(x * 7 + i, y * 13) * 15), Math.floor(hash(x * 3, y * 5 + i) * 14), 1, 2);
        if (hash(x * 5, y * 5) < 0.15) { R('#c98a3a', 4, 10, 2, 1); R('#d9a35a', 5, 11, 2, 1); }
        break;
      case 'cave':
        R('#5a5162', 0, 0, 16, 16);
        for (let i = 0; i < 4; i++) R(i % 2 ? '#4c4454' : '#686072', Math.floor(hash(x * 9 + i, y * 3) * 14), Math.floor(hash(x * 3, y * 9 + i) * 14), 2, 1);
        break;
      default: // grass
        R('#8fd16f', 0, 0, 16, 16);
        for (let i = 0; i < 3; i++) R('#7bbd5c', Math.floor(hash(x * 7 + i, y * 13) * 15), Math.floor(hash(x * 3, y * 5 + i) * 14), 1, 2);
    }
  }

  // ───────── 벽 ─────────
  const isWallLike = (o) => !!o && !!(S.OBJ[o.t] && S.OBJ[o.t].wall);
  function drawWall(R, t, x, y, world) {
    const [top, front, line] = S.WALLS[t] || S.WALLS.wall_white;
    const showFront = !isWallLike(oAt(world, x, y + 1));
    R(top, 0, 0, 16, 16);
    if (!isWallLike(oAt(world, x, y - 1))) R(shade(top, 0.35), 0, 0, 16, 1);
    if (!isWallLike(oAt(world, x - 1, y))) R(line, 0, 0, 1, 16);
    if (!isWallLike(oAt(world, x + 1, y))) R(line, 15, 0, 1, 16);
    if (showFront) {
      R(front, 0, 8, 16, 8); R(line, 0, 8, 16, 1);
      switch (t) {
        case 'wall_wood': case 'wall_dark': R(line, 4, 9, 1, 7); R(line, 10, 9, 1, 7); break;
        case 'wall_stone': R(line, 0, 12, 16, 1); R(line, 5, 9, 1, 3); R(line, 11, 13, 1, 3); break;
        case 'wall_brick': R(line, 0, 12, 16, 1); R(line, 4, 9, 1, 3); R(line, 11, 9, 1, 3); R(line, 7, 13, 1, 3); break;
        case 'wall_log': R(line, 0, 11, 16, 1); R(line, 0, 14, 16, 1); R(shade(front, 0.2), 0, 9, 16, 1); R(shade(front, 0.2), 0, 12, 16, 1); break;
        case 'wall_paper': for (let i = 1; i < 16; i += 3) R(line, i, 9, 1, 7); break;
        case 'wall_tile': R(line, 0, 12, 16, 1); for (let i = 3; i < 16; i += 4) R(line, i, 9, 1, 7); break;
        case 'wall_gold': R('#fff6c9', 2, 10, 4, 1); R(line, 0, 14, 16, 2); break;
        case 'wall_rainbow': for (let i = 0; i < 6; i++) R(RAINBOW[i], 0, 9 + i, 16, 1); R('#ffffff', 0, 15, 16, 1); break;
        case 'wall_candy': for (let i = -8; i < 16; i += 4) for (let k = 0; k < 7; k++) R(i + k >= 0 && i + k < 16 ? '#ff5c8a' : 'rgba(0,0,0,0)', Math.max(0, Math.min(15, i + k)), 9 + k, 2, 1); break;
        case 'wall_flower': for (const [fx, fy] of [[2, 10], [8, 12], [12, 9], [5, 14]]) { R('#ff8fab', fx, fy, 2, 2); R('#ffd34d', fx, fy, 1, 1); } R(line, 0, 15, 16, 1); break;
        case 'wall_star': for (const [fx, fy] of [[2, 10], [9, 12], [13, 9], [6, 14]]) R('#ffe066', fx, fy, 1, 1); R('#ffffff', 11, 11, 1, 1); R(line, 0, 15, 16, 1); break;
        case 'wall_wainscot': R('#fdfaf3', 0, 8, 16, 3); R('#c99558', 0, 11, 16, 1); R(front, 0, 12, 16, 4); R(line, 4, 12, 1, 4); R(line, 11, 12, 1, 4); break;
        default: R(line, 0, 14, 16, 2);
      }
    } else {
      if (t === 'wall_wood' || t === 'wall_dark' || t === 'wall_log') { R(shade(top, -0.08), 0, 5, 16, 1); R(shade(top, -0.08), 0, 11, 16, 1); }
      else if (t === 'wall_brick') { R(shade(top, -0.1), 0, 7, 16, 1); }
      else if (t === 'wall_stone' || t === 'wall_tile') { R(shade(top, -0.08), 4, 4, 5, 1); R(shade(top, -0.08), 9, 10, 5, 1); }
      else if (t === 'wall_rainbow' || t === 'wall_candy') { R(t === 'wall_candy' ? '#ff5c8a' : RAINBOW[(x + y) % 6], 6, 6, 4, 4); }
      else if (t === 'wall_gold') R('#fff6c9', 3, 3, 3, 1);
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
    } else if (kind === 'tomato') {
      R('#4caf50', 7, 2, 2, 13); R('#66c466', 3, 4, 10, 6);
      R('#e8364f', 3, 7, 4, 4); R('#e8364f', 9, 5, 4, 4); R('#e8364f', 8, 10, 4, 4); R('#ff8080', 4, 7, 1, 1); R('#ff8080', 10, 5, 1, 1); R('#ff8080', 9, 10, 1, 1);
    } else if (kind === 'corn') {
      R('#4caf50', 7, 1, 2, 15); R('#66c466', 3, 6, 4, 2); R('#66c466', 9, 9, 4, 2); R('#66c466', 4, 12, 3, 2);
      R('#7cbf5a', 9, 3, 4, 7); R('#ffd34d', 10, 3, 2, 6); R('#fff3a3', 10, 3, 1, 1); R('#c9a35a', 10, 1, 2, 2);
    } else if (kind === 'potato') {
      R('#4caf50', 4, 2, 8, 5); R('#66c466', 5, 1, 6, 2); R('#4caf50', 7, 6, 2, 3);
      R('#c9a26b', 3, 10, 5, 4); R('#c9a26b', 9, 9, 5, 5); R('#a8834f', 4, 11, 1, 1); R('#a8834f', 11, 11, 1, 1); R('#d9b882', 10, 9, 2, 1);
    } else if (kind === 'watermelon') {
      R('#4caf50', 1, 3, 4, 3); R('#3a8f3e', 2, 6, 12, 9); R('#2e7a32', 2, 6, 12, 9); R('#3fa146', 3, 7, 10, 7);
      for (let i = 3; i < 13; i += 3) R('#2e7a32', i, 7, 1, 7); R('#7ed492', 4, 8, 2, 1);
    }
  }

  // 그림자
  const shadow = (R, w = 12) => R('rgba(0,0,0,0.12)', 8 - w / 2, 14, w, 2);

  // ───────── 물건 / 블록 / 가구 ─────────
  function drawObject(R, o, x, y, world) {
    // 돌려놓은 가구는 "옆 칸"도 같이 돌려서 봐요 (옆으로 돌린 소파는 세로로 이어져요)
    const rot = o.r || 0;
    const sameT = (dx, dy) => {
      for (let i = 0; i < rot; i++) [dx, dy] = [-dy, dx];
      const n = oAt(world, x + dx, y + dy);
      return !!n && n.t === o.t && (n.r || 0) === rot;
    };
    if (S.WALLS[o.t]) { drawWall(R, o.t, x, y, world); return; }
    switch (o.t) {
      case 'tree':
        R('rgba(0,0,0,0.12)', 3, 13, 10, 3);
        R('#7a4e2d', 6, 10, 4, 6);
        R('#3f8f45', 2, 3, 12, 8); R('#3f8f45', 1, 5, 14, 4); R('#3f8f45', 4, 1, 8, 11);
        R('#5fb35f', 4, 3, 4, 3); R('#5fb35f', 3, 5, 2, 2);
        R('#2f7236', 9, 8, 3, 2); R('#2f7236', 11, 6, 2, 2);
        break;
      case 'pine':
        R('rgba(0,0,0,0.12)', 3, 13, 10, 3);
        R('#6e4626', 7, 11, 2, 5);
        R('#2e7a4a', 6, 0, 4, 3); R('#2e7a4a', 4, 3, 8, 3); R('#2e7a4a', 3, 6, 10, 3); R('#2e7a4a', 2, 9, 12, 3);
        R('#46a066', 6, 1, 2, 2); R('#46a066', 5, 4, 2, 2); R('#46a066', 4, 7, 2, 2); R('#46a066', 3, 10, 2, 1);
        R('#215c37', 10, 5, 2, 1); R('#215c37', 11, 8, 2, 1); R('#215c37', 12, 11, 2, 1);
        break;
      case 'stump':
        R('#7a4e2d', 5, 9, 6, 5); R('#b88252', 5, 9, 6, 2); R('#8b5a3c', 7, 9, 2, 1);
        break;
      case 'sapling':
        R('#7a4e2d', 7, 9, 2, 6); R('#5fb35f', 5, 6, 6, 4); R('#7ed492', 6, 5, 4, 2);
        break;
      case 'rock': case 'ore_iron': case 'ore_gold': {
        const cave = world && S.zoneAt(x, y) === 'cave';
        R('rgba(0,0,0,0.12)', 2, 13, 12, 2);
        R(cave ? '#7a7380' : '#8e8a85', 2, 5, 12, 9); R(cave ? '#938c9a' : '#a8a49e', 3, 4, 10, 7); R(cave ? '#aea7b4' : '#c4c0ba', 5, 5, 4, 2);
        R(cave ? '#5c5562' : '#6f6b67', 4, 12, 9, 2);
        if (o.t === 'ore_iron') { R('#d98c5f', 4, 7, 2, 2); R('#d98c5f', 9, 6, 2, 1); R('#e8a87c', 10, 9, 2, 2); R('#b8693f', 6, 10, 2, 1); }
        if (o.t === 'ore_gold') { R('#ffd34d', 4, 7, 2, 2); R('#ffd34d', 9, 5, 2, 2); R('#fff3a3', 9, 5, 1, 1); R('#ffd34d', 7, 10, 3, 1); }
        break;
      }
      case 'crystal':
        R('rgba(0,0,0,0.15)', 2, 13, 12, 2);
        R('#6f6b78', 3, 11, 10, 3);
        R('#b48cff', 4, 4, 3, 8); R('#d6c2ff', 5, 4, 1, 6); R('#7fdcff', 8, 1, 3, 11); R('#c9f2ff', 9, 2, 1, 7); R('#ff9ee6', 11, 6, 2, 6);
        break;
      case 'pebble':
        R('#9e9a94', 4, 10, 3, 2); R('#9e9a94', 9, 11, 3, 2); R('#b8b4ae', 7, 7, 2, 2);
        break;
      case 'cave_wall': {
        const below = oAt(world, x, y + 1), bw = below && below.t === 'cave_wall';
        R('#3a3341', 0, 0, 16, 16);
        R('#463e4e', Math.floor(hash(x, y) * 8), Math.floor(hash(y, x) * 8), 6, 4);
        R('#2e2834', Math.floor(hash(x * 3, y) * 10) + 2, Math.floor(hash(y * 3, x) * 6) + 2, 3, 2);
        if (!bw && world) { R('#2a2430', 0, 10, 16, 6); R('#3a3341', 0, 10, 16, 1); R('#221d27', 0, 15, 16, 1); }
        break;
      }
      case 'flower': {
        const cols = ['#ff8fab', '#fff3a3', '#ffffff', '#c9a0ff', '#ffb36b'];
        for (let i = 0; i < 2; i++) {
          const fx = 3 + Math.floor(hash(x + i * 11, y) * 9), fy = 3 + Math.floor(hash(x, y + i * 7) * 9);
          const c = cols[Math.floor(hash(x * 2 + i, y * 3) * cols.length)];
          R('#5aa646', fx, fy + 2, 1, 2); R(c, fx - 1, fy, 3, 1); R(c, fx, fy - 1, 1, 3); R('#ffd34d', fx, fy, 1, 1);
        }
        break;
      }
      case 'mushroom_wild':
        R('#f5ead6', 6, 9, 3, 5); R('#e85d5d', 3, 5, 9, 5); R('#e85d5d', 5, 4, 5, 1);
        R('#ffffff', 5, 6, 2, 1); R('#ffffff', 9, 7, 1, 1); R('#ffffff', 7, 5, 1, 1);
        R('#f5ead6', 11, 11, 2, 3); R('#c9894a', 10, 9, 4, 2);
        break;
      case 'sprout':
        R('#5fa046', 6, 11, 1, 3); R('#5fa046', 9, 10, 1, 4); R('#7ed492', 5, 10, 2, 1); R('#7ed492', 9, 9, 2, 1);
        break;
      case 'bush': case 'bush_berry':
        R('rgba(0,0,0,0.12)', 2, 13, 12, 2);
        R('#4c9a46', 2, 5, 12, 9); R('#4c9a46', 4, 3, 8, 2); R('#62b45a', 4, 5, 4, 3); R('#3d8238', 9, 10, 4, 2);
        if (o.t === 'bush_berry') { R('#e8364f', 4, 9, 2, 2); R('#e8364f', 9, 6, 2, 2); R('#e8364f', 7, 11, 2, 2); R('#c2185b', 11, 9, 2, 2); R('#ffadc0', 4, 9, 1, 1); }
        break;
      case 'crop':
        drawCrop(R, o.kind, o.stage, o.water);
        break;
      case 'window':
        drawWall(R, 'wall_white', x, y, world);
        R('#8b5a3c', 3, 3, 10, 10); R('#bfe9ff', 4, 4, 8, 8); R('#ffffff', 5, 5, 2, 2);
        R('#8b5a3c', 7, 4, 1, 8); R('#8b5a3c', 4, 7, 8, 1); R('#f7c6d0', 3, 12, 10, 1);
        break;
      case 'door': case 'door_white': {
        const [f, m, l] = o.t === 'door' ? ['#6e4626', '#a8743f', '#c99558'] : ['#bdb39f', '#fdfaf3', '#e6dfd1'];
        if (o.open) { R(f, 0, 0, 2, 16); R(f, 14, 0, 2, 16); R(f, 0, 0, 16, 2); R(m, 1, 2, 2, 14); }
        else { R(f, 1, 0, 14, 16); R(m, 2, 1, 12, 15); R(l, 3, 2, 10, 5); R(l, 3, 9, 10, 5); R('#ffd34d', 11, 8, 2, 2); }
        break;
      }
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
      case 'torch':
        R('#6e4626', 7, 7, 2, 8); R('#5a3520', 6, 14, 4, 1); R('#9aa7b0', 6, 6, 4, 2);
        R('#ff9a2e', 6, 2, 4, 4); R('#ffe066', 7, 3, 2, 3);
        break;
      case 'bench':
        shadow(R, 14);
        R('#8b5a3c', 1, 4, 14, 2); R('#a8743f', 1, 7, 14, 3); R('#c99558', 1, 7, 14, 1); R('#6e4626', 2, 10, 2, 4); R('#6e4626', 12, 10, 2, 4);
        break;
      case 'campfire':
        R('rgba(0,0,0,0.15)', 2, 12, 12, 3);
        R('#8e8a85', 2, 10, 3, 3); R('#8e8a85', 11, 10, 3, 3); R('#a8a49e', 6, 12, 4, 2); R('#8e8a85', 5, 8, 2, 2); R('#8e8a85', 9, 8, 2, 2);
        R('#7a4e2d', 4, 10, 8, 2); R('#5a3520', 6, 9, 4, 3);
        R('#ff7a1a', 5, 4, 6, 6); R('#ffb02e', 6, 3, 4, 6); R('#ffe066', 7, 5, 2, 4);
        break;
      case 'log_seat':
        shadow(R);
        R('#7a4e2d', 2, 7, 12, 7); R('#c99558', 2, 6, 12, 3); R('#e2b07c', 4, 7, 8, 1); R('#a8743f', 7, 7, 2, 1);
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
      case 'sofa': case 'sofa_blue': case 'sofa_green': {
        const [a, b2, c, d] = { sofa: ['#c45686', '#d96c9b', '#e88bb4', '#b04a76'], sofa_blue: ['#4a7fc4', '#6497d9', '#8cb4e8', '#3b6aa8'], sofa_green: ['#4f9a5c', '#68b274', '#8ccf96', '#3f8049'] }[o.t];
        R(a, 0, 1, 16, 6); R(b2, 0, 6, 16, 8); R(c, 1, 7, 14, 2);
        if (!sameT(-1, 0)) R(d, 0, 3, 3, 11);
        if (!sameT(1, 0)) R(d, 13, 3, 3, 11);
        break;
      }
      case 'bed_pink': case 'bed_blue': {
        const [bl, hl] = o.t === 'bed_pink' ? ['#ff8fab', '#ffb3c7'] : ['#6ec6ff', '#9ad8ff'];
        R('#f5f5f5', 1, 0, 14, 16); R('#ffffff', 2, 1, 12, 5); R('#e6e6f0', 2, 5, 12, 1);
        R(bl, 2, 6, 12, 9); R(hl, 2, 7, 12, 1); R('#ffffff', 4, 10, 2, 2); R('#ffffff', 9, 12, 2, 2);
        break;
      }
      case 'chest_big':
        R('rgba(0,0,0,0.15)', 0, 14, 16, 2);
        R('#5a3520', 0, 2, 16, 13); R('#8b5a3c', 1, 3, 14, 4); R('#a8743f', 1, 3, 14, 1); R('#8b5a3c', 1, 9, 14, 5);
        R('#9aa7b0', 0, 8, 16, 1); R('#9aa7b0', 3, 3, 1, 11); R('#9aa7b0', 12, 3, 1, 11);
        if (o.locked) { R('#9aa7b0', 6, 6, 4, 5); R('#c4ced6', 7, 4, 2, 2); R('#2b2233', 7, 8, 2, 1); }
        else { R('#ffd34d', 7, 7, 2, 3); R('#b58a12', 7, 9, 2, 1); }
        break;
      case 'notice_board':
        R('rgba(0,0,0,0.15)', 1, 14, 14, 2);
        R('#6e4626', 1, 6, 2, 10); R('#6e4626', 13, 6, 2, 10);
        R('#8b5a3c', 0, 0, 16, 11); R('#d9b882', 1, 1, 14, 9); R('#c0392b', 0, 0, 16, 2); R('#ffd34d', 7, 0, 2, 1);
        R('#ffffff', 2, 3, 4, 4); R('#fff3a3', 7, 3, 3, 5); R('#bfe9ff', 11, 3, 3, 3); R('#ff8fab', 11, 7, 3, 2);
        R('#e85d5d', 3, 3, 1, 1); R('#e85d5d', 8, 3, 1, 1); R('#4a3b5c', 3, 5, 2, 1); R('#4a3b5c', 8, 5, 1, 1);
        break;
      case 'snowman':
        R('rgba(0,0,0,0.12)', 3, 14, 10, 2);
        R('#ffffff', 3, 8, 10, 7); R('#ffffff', 5, 2, 6, 6); R('#e6eef3', 3, 13, 10, 2);
        R('#2b2233', 6, 4, 1, 1); R('#2b2233', 9, 4, 1, 1); R('#ff8c3a', 7, 5, 2, 1); R('#e85d5d', 4, 7, 8, 1); R('#2b2233', 7, 10, 1, 1); R('#2b2233', 7, 12, 1, 1);
        R('#3b3740', 5, 0, 6, 2); R('#3b3740', 4, 2, 8, 1);
        break;
      case 'teddy_big':
        R('rgba(0,0,0,0.12)', 1, 14, 14, 2);
        R('#c48b5c', 1, 0, 4, 4); R('#c48b5c', 11, 0, 4, 4); R('#c48b5c', 2, 2, 12, 8); R('#c48b5c', 1, 8, 14, 7);
        R('#ecc9a5', 6, 5, 4, 3); R('#2b2233', 5, 4, 1, 1); R('#2b2233', 10, 4, 1, 1); R('#2b2233', 7, 6, 2, 1);
        R('#ff5c8a', 5, 9, 6, 1); R('#ecc9a5', 5, 11, 6, 3);
        break;
      case 'rocking_chair':
        R('#8b5a3c', 3, 0, 10, 7); R('#a8743f', 4, 1, 8, 5); R('#ff8fab', 4, 7, 8, 4); R('#6e4626', 3, 11, 2, 3); R('#6e4626', 11, 11, 2, 3);
        R('#6e4626', 1, 14, 14, 1); R('#6e4626', 0, 13, 1, 1); R('#6e4626', 15, 13, 1, 1);
        break;
      case 'vanity':
        R('#fdfaf3', 1, 7, 14, 7); R('#e6dfd1', 1, 10, 14, 1); R('#ffd34d', 4, 8, 1, 1); R('#ffd34d', 11, 8, 1, 1); R('#bdb39f', 2, 14, 2, 2); R('#bdb39f', 12, 14, 2, 2);
        R('#c9a96b', 4, 0, 8, 7); R('#dff6ff', 5, 1, 6, 5); R('#ffffff', 6, 2, 1, 2); R('#ff8fab', 2, 5, 2, 2); R('#c9a0ff', 12, 5, 2, 2);
        break;
      case 'guitar':
        R('rgba(0,0,0,0.12)', 4, 14, 8, 2);
        R('#6e4626', 7, 0, 2, 7); R('#3b2f45', 6, 0, 4, 1); R('#d9783a', 4, 7, 8, 7); R('#d9783a', 5, 6, 6, 1); R('#2b1a14', 7, 9, 2, 2); R('#fff3e0', 7, 6, 1, 6); R('#8b3a2a', 5, 12, 6, 1);
        break;
      case 'globe':
        R('#8b5a3c', 5, 13, 6, 2); R('#a8743f', 7, 10, 2, 3); R('#c9a96b', 3, 2, 1, 9);
        R('#63bde8', 4, 1, 9, 9); R('#7ed492', 5, 3, 3, 3); R('#7ed492', 9, 6, 3, 2); R('#9fdcf7', 6, 2, 1, 1);
        break;
      case 'bonsai':
        R('#4a5a8c', 3, 11, 10, 4); R('#6576a8', 3, 11, 10, 1); R('#6e4626', 7, 6, 2, 5); R('#6e4626', 5, 7, 2, 1);
        R('#2e7a4a', 2, 3, 6, 3); R('#2e7a4a', 8, 1, 6, 4); R('#46a066', 3, 3, 2, 1); R('#46a066', 9, 1, 2, 1);
        break;
      case 'lantern':
        R('#5a3520', 7, 0, 2, 2); R('#3b3740', 4, 2, 8, 1); R('#3b3740', 4, 12, 8, 1);
        R('#e85d5d', 4, 3, 8, 9); R('#ff8080', 5, 4, 6, 7); R('#ffe066', 6, 5, 4, 5); R('#c0392b', 4, 6, 8, 1); R('#c0392b', 4, 9, 8, 1);
        R('#5a3520', 7, 13, 2, 3);
        break;
      case 'candle':
        R('#c9a96b', 4, 13, 8, 2); R('#c9a96b', 7, 9, 2, 4); R('#c9a96b', 3, 8, 10, 1);
        R('#fff7ec', 3, 4, 2, 4); R('#fff7ec', 7, 3, 2, 5); R('#fff7ec', 11, 4, 2, 4);
        R('#ffb02e', 3, 2, 2, 2); R('#ffb02e', 7, 1, 2, 2); R('#ffb02e', 11, 2, 2, 2);
        break;
      case 'fishbowl':
        R('#8b5a3c', 3, 13, 10, 3); R('#bfe9ff', 3, 3, 10, 10); R('#63bde8', 4, 6, 8, 7); R('#9fdcf7', 4, 6, 8, 1); R('#ffffff', 4, 3, 2, 1);
        R('#ff8c3a', 6, 8, 3, 2); R('#4caf50', 10, 9, 1, 4);
        break;
      case 'oven':
        R('rgba(0,0,0,0.12)', 1, 14, 14, 2);
        R('#3b3740', 1, 1, 14, 14); R('#5a5662', 1, 1, 14, 3); R('#e85d5d', 3, 2, 1, 1); R('#ffd34d', 5, 2, 1, 1); R('#9aa7b0', 11, 2, 3, 1);
        R('#2b2233', 3, 5, 10, 8); R('#ff9a2e', 4, 9, 8, 3); R('#ffb02e', 5, 10, 6, 1); R('#9aa7b0', 4, 5, 8, 1);
        break;
      case 'coffee_machine':
        R('#a8743f', 0, 10, 16, 5); R('#f0ece4', 0, 9, 16, 1);
        R('#3b3740', 3, 0, 10, 9); R('#5a5662', 4, 1, 8, 2); R('#2b2233', 6, 4, 4, 4); R('#ffffff', 6, 6, 4, 3); R('#8b5a3c', 7, 6, 2, 1); R('#7ed492', 11, 1, 1, 1);
        break;
      case 'rice_cooker':
        R('#a8743f', 0, 10, 16, 5); R('#f0ece4', 0, 9, 16, 1);
        R('#fdfaf3', 3, 2, 10, 7); R('#ff8fab', 3, 5, 10, 1); R('#e6dfd1', 4, 1, 8, 2); R('#3b3740', 7, 0, 2, 1); R('#7ed492', 6, 7, 1, 1); R('#e85d5d', 9, 7, 1, 1);
        break;
      case 'rubber_duck':
        R('rgba(0,0,0,0.12)', 4, 13, 9, 2);
        R('#ffd34d', 4, 8, 9, 5); R('#ffd34d', 5, 4, 5, 5); R('#ff8c3a', 10, 6, 3, 2); R('#2b2233', 8, 5, 1, 1); R('#ffe88a', 5, 9, 4, 1);
        break;
      case 'armchair':
        shadow(R);
        R('#3f9e94', 2, 1, 12, 6); R('#56b8ad', 2, 6, 12, 8); R('#7fd1c7', 4, 7, 8, 2); R('#33877e', 1, 3, 3, 11); R('#33877e', 12, 3, 3, 11);
        break;
      case 'beanbag':
        R('rgba(0,0,0,0.12)', 2, 13, 12, 2);
        R('#9b8cff', 2, 5, 12, 9); R('#9b8cff', 4, 3, 8, 2); R('#b8adff', 4, 5, 5, 3); R('#7e6fe0', 3, 11, 10, 2);
        break;
      case 'cushion':
        R('#ff8fab', 2, 5, 12, 9); R('#ffb3c7', 3, 6, 10, 2); R('#e0708f', 2, 13, 12, 1); R('#ffd34d', 7, 9, 2, 2);
        break;
      case 'bed': case 'royal_bed': {
        const roy = o.t === 'royal_bed';
        R(roy ? '#d4a017' : '#8b5a3c', 1, 0, 14, 16); R('#ffffff', 2, 1, 12, 5); R('#e6e6f0', 2, 5, 12, 1);
        R(roy ? '#ff8fab' : '#9b8cff', 2, 6, 12, 9); R(roy ? '#ffb3c7' : '#b8adff', 2, 7, 12, 1);
        if (roy) { R('#ffd34d', 2, 14, 12, 1); R('#ffffff', 5, 10, 1, 1); R('#ffffff', 10, 12, 1, 1); R('#ffd34d', 7, 0, 2, 1); }
        else { R('#ffffff', 4, 10, 2, 2); R('#ffffff', 9, 12, 2, 2); }
        break;
      }
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
      case 'plant_big':
        R('#f5f5f5', 4, 11, 8, 5); R('#d9d9d9', 4, 15, 8, 1);
        R('#2f8f4a', 1, 3, 6, 6); R('#2f8f4a', 9, 1, 6, 7); R('#3fae5c', 5, 5, 6, 7); R('#57c574', 6, 6, 2, 3); R('#1f6f36', 7, 9, 2, 3);
        R('#ffffff', 3, 5, 1, 1); R('#ffffff', 11, 3, 1, 1);
        break;
      case 'cactus':
        R('#c0623b', 5, 11, 6, 5); R('#d97a50', 4, 11, 8, 1);
        R('#4caf50', 6, 2, 4, 10); R('#4caf50', 3, 5, 2, 4); R('#4caf50', 11, 4, 2, 4); R('#3b8f3e', 3, 8, 3, 1); R('#3b8f3e', 10, 7, 3, 1);
        R('#ffffff', 7, 4, 1, 1); R('#ffffff', 8, 7, 1, 1); R('#ff8fab', 7, 1, 2, 1);
        break;
      case 'teddy':
        R('#b07a4f', 3, 1, 3, 3); R('#b07a4f', 10, 1, 3, 3);
        R('#b07a4f', 4, 7, 8, 7); R('#b07a4f', 4, 2, 8, 6); R('#e8c39e', 6, 5, 4, 2);
        R('#2b2233', 5, 4, 1, 1); R('#2b2233', 10, 4, 1, 1); R('#2b2233', 7, 5, 2, 1);
        R('#ff5c8a', 6, 8, 4, 1); R('#e8c39e', 6, 10, 4, 3);
        break;
      case 'tv':
        shadow(R, 14);
        R('#2b2233', 1, 2, 14, 10); R('#3b3740', 2, 3, 12, 8); R(o.on ? '#8fd3ff' : '#4a4652', 2, 3, 12, 8);
        if (!o.on) R('#5a5662', 3, 4, 3, 1);
        R('#2b2233', 6, 12, 4, 2); R('#4a3b5c', 4, 14, 8, 1);
        break;
      case 'stand_lamp':
        R('#3b3740', 5, 14, 6, 1); R('#5a5560', 7, 6, 2, 9);
        R(o.on ? '#fff3a3' : '#f2e6d0', 4, 1, 8, 5); R(o.on ? '#ffe066' : '#e0d2b8', 4, 5, 8, 1);
        if (o.on) { R('rgba(255,240,150,0.35)', 2, 6, 12, 3); }
        break;
      case 'picture':
        R('#8b5a3c', 2, 1, 12, 10); R('#9fdcf7', 3, 2, 10, 8); R('#7ed492', 3, 7, 10, 3); R('#5fb35f', 7, 6, 6, 4); R('#ffd34d', 4, 3, 2, 2);
        R('#6e4626', 4, 11, 1, 4); R('#6e4626', 11, 11, 1, 4);
        break;
      case 'clock':
        shadow(R, 8);
        R('#7a4e2d', 4, 0, 8, 15); R('#a8743f', 5, 1, 6, 13); R('#fffaf2', 5, 2, 6, 5); R('#2b2233', 8, 3, 1, 3); R('#2b2233', 8, 5, 2, 1);
        R('#ffd34d', 7, 9, 2, 3); R('#5a3520', 5, 8, 6, 1);
        break;
      case 'side_table':
        shadow(R, 10);
        R('#a8743f', 3, 4, 10, 9); R('#c99558', 3, 4, 10, 2); R('#8b5a3c', 4, 8, 8, 1); R('#ffd34d', 7, 9, 2, 1);
        R('#6e4626', 4, 13, 1, 2); R('#6e4626', 11, 13, 1, 2); R('#ff8fab', 5, 2, 2, 2); R('#4caf50', 9, 1, 2, 3);
        break;
      case 'display_shelf':
        R('#fdfaf3', 1, 0, 14, 16); R('#d9d0bf', 1, 5, 14, 1); R('#d9d0bf', 1, 10, 14, 1); R('#bdb39f', 1, 15, 14, 1);
        R('#6ec6ff', 3, 2, 2, 3); R('#ff8fab', 8, 3, 3, 2); R('#ffd34d', 12, 2, 1, 3);
        R('#7ed492', 3, 7, 3, 3); R('#c9a0ff', 9, 7, 2, 3); R('#ffffff', 10, 12, 3, 3); R('#e85d5d', 3, 12, 3, 3);
        break;
      case 'wall_shelf':
        R('#8b5a3c', 1, 6, 14, 2); R('#6e4626', 2, 8, 2, 2); R('#6e4626', 12, 8, 2, 2);
        R('#ff8fab', 2, 2, 2, 4); R('#6ec6ff', 4, 3, 2, 3); R('#4caf50', 9, 2, 3, 3); R('#c0623b', 9, 4, 3, 2); R('#ffd34d', 13, 3, 1, 3);
        break;
      case 'drawer':
        shadow(R, 14);
        R('#a8743f', 1, 2, 14, 12); R('#c99558', 1, 2, 14, 1);
        for (let i = 0; i < 3; i++) { R('#8b5a3c', 2, 4 + i * 3 + 2, 12, 1); R('#ffd34d', 7, 4 + i * 3, 2, 1); }
        R('#6e4626', 2, 14, 2, 2); R('#6e4626', 12, 14, 2, 2);
        break;
      case 'wardrobe':
        R('#8b5a3c', 1, 0, 14, 16); R('#a8743f', 2, 1, 5, 14); R('#a8743f', 9, 1, 5, 14); R('#ffd34d', 6, 7, 1, 2); R('#ffd34d', 9, 7, 1, 2);
        R('#6e4626', 1, 15, 14, 1);
        break;
      case 'desk':
        R('#b88252', 0, 3, 16, 3); R('#9c6b3f', 0, 6, 16, 1); R('#9c6b3f', 1, 7, 5, 6); R('#ffd34d', 3, 9, 1, 1); R('#6e4626', 13, 7, 2, 8);
        R('#ffffff', 8, 2, 4, 2); R('#6ec6ff', 3, 2, 3, 1);
        break;
      case 'computer':
        R('#b88252', 0, 9, 16, 3); R('#9c6b3f', 0, 12, 16, 1); R('#6e4626', 1, 13, 2, 3); R('#6e4626', 13, 13, 2, 3);
        R('#d9d9e0', 3, 1, 10, 7); R(o.on ? '#4a90e2' : '#3b3740', 4, 2, 8, 5); R('#b0b0bb', 7, 8, 2, 1); R('#e6e6f0', 4, 9, 7, 1);
        break;
      case 'stove':
        shadow(R, 14);
        R('#e6e6f0', 1, 1, 14, 14); R('#ffffff', 1, 1, 14, 1); R('#3b3740', 2, 2, 12, 5);
        R('#6f6b78', 3, 3, 3, 3); R('#6f6b78', 10, 3, 3, 3); R('#9aa7b0', 4, 4, 1, 1); R('#9aa7b0', 11, 4, 1, 1);
        R('#c4c4cc', 3, 8, 10, 6); R('#3b3740', 4, 9, 8, 3); R('#e85d5d', 3, 7, 1, 1); R('#e85d5d', 12, 7, 1, 1);
        break;
      case 'fridge':
        R('#f5f8fb', 2, 0, 12, 16); R('#d6dde3', 2, 6, 12, 1); R('#b8c2ca', 2, 15, 12, 1); R('#b8c2ca', 13, 0, 1, 16);
        R('#9aa7b0', 11, 2, 1, 3); R('#9aa7b0', 11, 8, 1, 5); R('#ff8fab', 4, 2, 2, 2); R('#ffd34d', 6, 9, 2, 2);
        break;
      case 'sink':
        shadow(R, 14);
        R('#d9d9e0', 0, 4, 16, 10); R('#f0f0f5', 0, 4, 16, 2); R('#9fc7e0', 3, 6, 10, 4); R('#7fb0cf', 3, 9, 10, 1);
        R('#9aa7b0', 7, 1, 2, 5); R('#9aa7b0', 7, 1, 4, 1); R('#a8743f', 1, 11, 14, 3); R('#ffd34d', 7, 12, 2, 1);
        break;
      case 'counter':
        R('#a8743f', 0, 6, 16, 9); R('#f0ece4', 0, 3, 16, 4); R('#d9d0bf', 0, 6, 16, 1);
        if (!sameT(-1, 0)) R('#8b5a3c', 0, 3, 1, 12);
        if (!sameT(1, 0)) R('#8b5a3c', 15, 3, 1, 12);
        R('#ffd34d', 7, 9, 2, 1);
        break;
      case 'microwave':
        R('#a8743f', 0, 8, 16, 7); R('#f0ece4', 0, 6, 16, 2);
        R('#e6e6f0', 2, 0, 12, 7); R('#3b3740', 3, 1, 7, 5); R('#5a5662', 4, 2, 2, 1); R('#9aa7b0', 11, 2, 2, 1); R('#9aa7b0', 11, 4, 2, 1);
        break;
      case 'dish_rack':
        R('#c4c4cc', 1, 9, 14, 3); R('#9aa7b0', 1, 12, 14, 1);
        for (let i = 0; i < 4; i++) { R('#ffffff', 2 + i * 3, 3, 2, 7); R('#bfe9ff', 2 + i * 3, 4, 1, 5); }
        R('#ff8fab', 14, 5, 1, 4);
        break;
      case 'kitchen_shelf':
        R('#8b5a3c', 1, 7, 14, 1); R('#8b5a3c', 1, 13, 14, 1); R('#6e4626', 1, 2, 1, 12); R('#6e4626', 14, 2, 1, 12);
        R('#e85d5d', 3, 4, 2, 3); R('#ffd34d', 6, 3, 2, 4); R('#7ed492', 9, 4, 2, 3); R('#ffffff', 12, 4, 1, 3);
        R('#c0623b', 3, 10, 3, 3); R('#f5f5f5', 8, 9, 4, 4); R('#4a3b5c', 9, 10, 2, 1);
        break;
      case 'toilet':
        R('#e6eef3', 4, 0, 8, 4); R('#ffffff', 4, 0, 8, 1);
        R('#ffffff', 3, 4, 10, 9); R('#e6eef3', 4, 12, 8, 2); R('#bfe9ff', 5, 6, 6, 5); R('#e6eef3', 3, 4, 10, 1); R('#9aa7b0', 10, 1, 1, 1);
        break;
      case 'bathtub':
        R('rgba(0,0,0,0.12)', 0, 14, 16, 2);
        R('#ffffff', 0, 3, 16, 11); R('#e6eef3', 0, 13, 16, 1); R('#8fd3ff', 2, 5, 12, 7); R('#bfe9ff', 3, 6, 4, 1);
        R('#ffffff', 9, 7, 2, 2); R('#ffffff', 5, 9, 1, 1); R('#9aa7b0', 12, 1, 2, 3); R('#ffd34d', 3, 8, 2, 2);
        break;
      case 'washbasin':
        R('#e6eef3', 6, 9, 4, 6); R('#ffffff', 2, 4, 12, 6); R('#bfe9ff', 4, 5, 8, 3); R('#9aa7b0', 7, 2, 2, 3); R('#d9e2e8', 2, 9, 12, 1);
        break;
      case 'shower':
        R('rgba(191,233,255,0.5)', 1, 0, 14, 16); R('#9fc7e0', 1, 0, 1, 16); R('#9fc7e0', 14, 0, 1, 16); R('#9fc7e0', 1, 15, 14, 1);
        R('#9aa7b0', 7, 1, 2, 2); R('#9aa7b0', 6, 3, 4, 1); R('#dff1fb', 3, 12, 10, 3);
        break;
      case 'mirror':
        R('#c9a96b', 4, 0, 8, 12); R('#dff6ff', 5, 1, 6, 10); R('#ffffff', 6, 2, 2, 3); R('#c9a96b', 7, 12, 2, 3); R('#a8874f', 5, 15, 6, 1);
        break;
      case 'towel_rack':
        R('#9aa7b0', 2, 2, 12, 1); R('#9aa7b0', 2, 2, 1, 13); R('#9aa7b0', 13, 2, 1, 13);
        R('#ff8fab', 3, 3, 4, 8); R('#ffb3c7', 3, 3, 4, 1); R('#6ec6ff', 8, 3, 5, 10); R('#9ad8ff', 8, 3, 5, 1);
        break;
      case 'washer':
        shadow(R, 14);
        R('#f5f8fb', 1, 0, 14, 15); R('#d6dde3', 1, 3, 14, 1); R('#9aa7b0', 3, 1, 3, 1); R('#7ed492', 11, 1, 2, 1);
        R('#9aa7b0', 4, 5, 8, 8); R('#bfe9ff', 5, 6, 6, 6); R('#dff6ff', 6, 7, 2, 2);
        break;
      case 'bath_shelf':
        R('#ffffff', 1, 7, 14, 1); R('#ffffff', 1, 13, 14, 1); R('#d9e2e8', 1, 3, 1, 11); R('#d9e2e8', 14, 3, 1, 11);
        R('#ff8fab', 3, 3, 2, 4); R('#6ec6ff', 6, 4, 2, 3); R('#ffd34d', 10, 4, 3, 3);
        R('#c9a0ff', 3, 9, 4, 4); R('#7ed492', 9, 10, 3, 3);
        break;
      case 'aquarium':
        R('#5a3520', 0, 12, 16, 4); R('#8b5a3c', 0, 12, 16, 1);
        R('#bfe9ff', 0, 2, 16, 10); R('#63bde8', 1, 4, 14, 8); R('#9fdcf7', 1, 4, 14, 1); R('#f3e3b3', 1, 10, 14, 2);
        R('#4caf50', 3, 6, 1, 4); R('#4caf50', 12, 5, 1, 5);
        break;
      case 'piano':
        R('#2b2233', 0, 1, 16, 12); R('#3b3740', 1, 2, 14, 4); R('#ffffff', 1, 7, 14, 3);
        for (let i = 2; i < 15; i += 2) R('#2b2233', i, 7, 1, 2);
        R('#2b2233', 1, 13, 2, 3); R('#2b2233', 13, 13, 2, 3); R('#ffd34d', 7, 3, 2, 1);
        break;
      case 'fireplace':
        R('#b45d45', 0, 1, 16, 15); R('#d97d63', 0, 1, 16, 2); R('#8a4232', 0, 6, 16, 1); R('#8a4232', 0, 11, 16, 1);
        R('#2b1a14', 3, 5, 10, 11); R('#7a4e2d', 4, 13, 8, 2); R('#ff7a1a', 5, 9, 6, 4); R('#ffe066', 7, 10, 2, 3);
        break;
      case 'trophy':
        R('#8b5a3c', 4, 13, 8, 3); R('#a8743f', 5, 12, 6, 1); R('#f2c230', 7, 9, 2, 3);
        R('#f2c230', 4, 2, 8, 7); R('#ffe27a', 5, 3, 2, 4); R('#f2c230', 2, 3, 2, 3); R('#f2c230', 12, 3, 2, 3); R('#d9a81c', 4, 8, 8, 1);
        break;
      case 'cat_tower':
        R('#e8d3a8', 2, 13, 12, 3); R('#c9b58a', 4, 4, 2, 9); R('#c9b58a', 10, 7, 2, 6);
        R('#e8d3a8', 1, 2, 7, 2); R('#e8d3a8', 8, 6, 7, 2);
        R('#ffb36b', 2, -0 + 0, 5, 2); R('#ffb36b', 2, 0, 1, 1); R('#ffb36b', 6, 0, 1, 1); R('#2b2233', 3, 1, 1, 1); R('#2b2233', 5, 1, 1, 1);
        break;
      case 'fountain':
        R('rgba(0,0,0,0.12)', 1, 14, 14, 2);
        R('#c4c0ba', 0, 7, 16, 8); R('#e4dfd6', 0, 7, 16, 1); R('#63bde8', 2, 8, 12, 5); R('#c4c0ba', 6, 3, 4, 7); R('#e4dfd6', 5, 2, 6, 2); R('#9fdcf7', 7, 0, 2, 2);
        break;
      case 'xmas_tree':
        R('#7a4e2d', 7, 13, 2, 3);
        R('#2e7a4a', 6, 2, 4, 3); R('#2e7a4a', 4, 5, 8, 3); R('#2e7a4a', 3, 8, 10, 3); R('#2e7a4a', 2, 11, 12, 2);
        R('#ffd34d', 7, 0, 2, 2); R('#e85d5d', 5, 6, 1, 1); R('#6ec6ff', 9, 9, 1, 1); R('#ffd34d', 4, 11, 1, 1); R('#ff8fab', 11, 11, 1, 1);
        break;
      case 'throne':
        shadow(R);
        R('#d4a017', 3, 0, 10, 14); R('#c0392b', 4, 1, 8, 7); R('#ffd34d', 7, 0, 2, 1); R('#ffd34d', 3, 0, 1, 2); R('#ffd34d', 12, 0, 1, 2);
        R('#c0392b', 3, 8, 10, 4); R('#e74c3c', 4, 8, 8, 1); R('#d4a017', 2, 7, 2, 6); R('#d4a017', 12, 7, 2, 6); R('#b58a12', 4, 14, 2, 2); R('#b58a12', 10, 14, 2, 2);
        break;
      case 'statue':
        R('#c4c0ba', 3, 12, 10, 4); R('#e4dfd6', 3, 12, 10, 1);
        R('#f2c230', 6, 1, 4, 4); R('#f2c230', 5, 5, 6, 6); R('#f2c230', 4, 5, 1, 4); R('#f2c230', 11, 3, 1, 4); R('#ffe27a', 6, 2, 1, 2); R('#d9a81c', 6, 10, 4, 2);
        break;
      case 'arcade':
        R('#6c3fb5', 2, 0, 12, 16); R('#8e5fd9', 2, 0, 12, 2); R('#2b2233', 3, 3, 10, 6); R(o.on ? '#7ed492' : '#3b3740', 4, 4, 8, 4);
        R('#3b3740', 3, 10, 10, 2); R('#e85d5d', 5, 10, 2, 1); R('#ffd34d', 9, 10, 1, 1); R('#6ec6ff', 11, 10, 1, 1);
        break;
      case 'telescope':
        R('#5a5560', 4, 9, 1, 7); R('#5a5560', 11, 9, 1, 7); R('#5a5560', 7, 9, 2, 6);
        R('#e6e6f0', 2, 4, 11, 4); R('#c4c4cc', 2, 7, 11, 1); R('#3b3740', 12, 3, 3, 6); R('#9fdcf7', 1, 5, 1, 2);
        break;
      case 'crystal_lamp':
        R('#6f6b78', 4, 12, 8, 4); R('#8e8a95', 5, 12, 6, 1);
        R('#b48cff', 5, 3, 6, 9); R('#d6c2ff', 6, 2, 4, 9); R('#ffffff', 7, 4, 1, 3); R('rgba(200,170,255,0.35)', 2, 1, 12, 12);
        break;
      case 'scarecrow':
        R('#7a4e2d', 7, 6, 2, 10); R('#7a4e2d', 2, 7, 12, 1);
        R('#e85d5d', 4, 6, 8, 5); R('#ffd95e', 2, 6, 2, 3); R('#ffd95e', 12, 6, 2, 3);
        R('#f3e3b3', 5, 1, 6, 5); R('#c9a35a', 3, 1, 10, 1); R('#c9a35a', 5, 0, 6, 1); R('#2b2233', 6, 3, 1, 1); R('#2b2233', 9, 3, 1, 1);
        break;
      case 'windmill':
        R('#fdfaf3', 5, 6, 6, 10); R('#e6dfd1', 5, 6, 1, 10); R('#e85d5d', 4, 4, 8, 3); R('#8b5a3c', 7, 12, 2, 4);
        R('#a8743f', 7, 0, 2, 5); R('#a8743f', 3, 4, 10, 1);
        break;
      case 'deer_trophy':
        R('#8b5a3c', 4, 7, 8, 8); R('#a8743f', 5, 8, 6, 6);
        R('#c98a5a', 6, 6, 4, 6); R('#2b2233', 6, 8, 1, 1); R('#2b2233', 9, 8, 1, 1); R('#3b2f45', 7, 11, 2, 1);
        R('#e8d3a8', 3, 1, 1, 6); R('#e8d3a8', 12, 1, 1, 6); R('#e8d3a8', 1, 2, 2, 1); R('#e8d3a8', 13, 2, 2, 1); R('#e8d3a8', 4, 4, 2, 1); R('#e8d3a8', 10, 4, 2, 1);
        break;
      case 'chest':
        R('rgba(0,0,0,0.15)', 1, 14, 14, 2);
        R('#7a4e2d', 1, 3, 14, 12); R('#a8743f', 2, 4, 12, 4); R('#c99558', 2, 4, 12, 1); R('#a8743f', 2, 9, 12, 5);
        R('#5a3520', 1, 8, 14, 1); R('#5a3520', 4, 4, 1, 10); R('#5a3520', 11, 4, 1, 10);
        if (o.locked) { R('#9aa7b0', 6, 6, 4, 5); R('#c4ced6', 7, 4, 2, 2); R('#2b2233', 7, 8, 2, 1); }
        else { R('#ffd34d', 7, 7, 2, 3); R('#b58a12', 7, 9, 2, 1); }
        break;
      // ── 던전
      case 'dungeon_wall': {
        const st = S.dungeonStar(x);
        const [top, front, line] = st === 1 ? ['#6b7563', '#4f5a4a', '#343c30'] : st === 2 ? ['#77717c', '#5b5560', '#3b3740'] : ['#7a4a40', '#5a3a34', '#3a221e'];
        const below = oAt(world, x, y + 1);
        R(top, 0, 0, 16, 16); R(shade(top, 0.15), 0, 0, 16, 1);
        R(line, 0, 5, 16, 1); R(line, 7, 0, 1, 5); R(line, 3, 6, 1, 5); R(line, 11, 6, 1, 5); R(line, 0, 11, 16, 1);
        if (!(below && below.t === 'dungeon_wall') && world) { R(front, 0, 11, 16, 5); R(line, 0, 11, 16, 1); R(line, 5, 12, 1, 4); R(line, 12, 12, 1, 4); }
        break;
      }
      case 'dungeon_gate': {
        const col = ['#a8743f', '#9aa7b0', '#c0392b'][(o.star || 1) - 1];
        R('#3b3740', 0, 0, 16, 16); R('#2b2233', 2, 2, 12, 14); R(col, 1, 0, 14, 3); R(col, 1, 0, 2, 16); R(col, 13, 0, 2, 16);
        for (let i = 4; i < 13; i += 3) R('#5a5560', i, 3, 1, 13);
        R('#ffd34d', 5, 1, 1, 1); R('#ffd34d', 7, 1, 2, 1); R('#ffd34d', 10, 1, 1, 1);
        for (let i = 0; i < (o.star || 1); i++) R('#ffe066', 6 + i * 2 - (o.star - 1), 8, 1, 1);
        break;
      }
      case 'dungeon_exit':
        R('rgba(0,0,0,0.15)', 2, 13, 12, 3);
        R('#5a5560', 2, 2, 12, 13); R('#7e6fe0', 4, 4, 8, 10); R('#b8adff', 6, 6, 4, 6); R('#ffffff', 7, 8, 2, 2);
        break;
      case 'job_master':
        R('rgba(0,0,0,0.15)', 2, 13, 12, 3);
        R('#4a3b5c', 4, 7, 8, 8); R('#6c3fb5', 5, 8, 6, 6); R('#ffd34d', 7, 9, 2, 4);
        R('#ffe0c2', 5, 1, 6, 6); R('#c9c9d3', 4, 0, 8, 2); R('#c9c9d3', 4, 5, 2, 4); R('#c9c9d3', 10, 5, 2, 4); R('#2b2233', 6, 3, 1, 1); R('#2b2233', 9, 3, 1, 1);
        R('#a8743f', 13, 1, 1, 14); R('#7fdcff', 12, 0, 3, 2);
        break;
      case 'anvil':
        R('rgba(0,0,0,0.15)', 1, 13, 14, 3);
        R('#6e4626', 4, 10, 8, 5); R('#8b5a3c', 4, 10, 8, 1);
        R('#5a5560', 1, 4, 14, 4); R('#7e7a85', 1, 4, 14, 1); R('#5a5560', 5, 8, 6, 2); R('#3b3740', 0, 5, 2, 2);
        R('#a8743f', 11, 0, 1, 4); R('#9aa7b0', 9, 0, 5, 2);
        break;
      // ── 공원
      case 'park_bench':
        shadow(R, 14);
        R('#5a8a3a', 1, 2, 14, 2); R('#5a8a3a', 1, 5, 14, 2); R('#3b3740', 1, 7, 14, 1);
        R('#6e9e4a', 1, 8, 14, 3); R('#8ab86a', 1, 8, 14, 1); R('#3b3740', 1, 2, 1, 13); R('#3b3740', 14, 2, 1, 13); R('#3b3740', 2, 11, 2, 4); R('#3b3740', 12, 11, 2, 4);
        break;
      case 'picnic_table':
        shadow(R, 14);
        R('#a8743f', 0, 2, 16, 2); R('#a8743f', 0, 12, 16, 2); R('#b88252', 2, 5, 12, 6); R('#c99558', 2, 5, 12, 1); R('#8b5a3c', 2, 7, 12, 1); R('#8b5a3c', 2, 9, 12, 1);
        R('#7a4e2d', 3, 11, 2, 1); R('#7a4e2d', 11, 11, 2, 1);
        break;
      case 'swing':
        R('#6e4626', 1, 0, 2, 16); R('#6e4626', 13, 0, 2, 16); R('#8b5a3c', 1, 0, 14, 2);
        R('#c4c0ba', 5, 2, 1, 9); R('#c4c0ba', 10, 2, 1, 9); R('#e85d5d', 4, 10, 8, 2); R('#b84444', 4, 12, 8, 1);
        break;
      case 'slide':
        R('rgba(0,0,0,0.12)', 1, 14, 14, 2);
        R('#6ec6ff', 9, 1, 6, 12); R('#4a9fd6', 9, 1, 1, 12); R('#ffd34d', 10, 2, 4, 2); R('#ffd34d', 10, 6, 4, 2); R('#ffd34d', 10, 10, 4, 2);
        R('#ff8fab', 1, 9, 9, 3); R('#ff8fab', 3, 6, 7, 3); R('#ff8fab', 6, 3, 4, 3); R('#e0708f', 1, 12, 9, 1);
        break;
      case 'flower_bed': {
        R('#8b5a3c', 0, 9, 16, 7); R('#a8743f', 0, 9, 16, 1); R('#6b4a2f', 1, 10, 14, 4);
        const cols = ['#ff8fab', '#ffd34d', '#ffffff', '#c9a0ff', '#e85d5d'];
        for (let i = 0; i < 6; i++) { const fx = 1 + i * 2 + (i % 2), fy = 4 + (i % 3) * 2; R('#4caf50', fx, fy + 2, 1, 10 - fy); R(cols[(i + x) % 5], fx - 1, fy, 3, 2); }
        break;
      }
      case 'hedge': {
        const g1 = '#3f8f45', g2 = '#5fb35f';
        R(g1, 2, 3, 12, 11); R(g2, 3, 3, 4, 2); R('#2f7236', 3, 12, 10, 2);
        if (sameT(-1, 0)) R(g1, 0, 3, 3, 11);
        if (sameT(1, 0)) R(g1, 13, 3, 3, 11);
        if (sameT(0, -1)) R(g1, 2, 0, 12, 4);
        if (sameT(0, 1)) R(g1, 2, 12, 12, 4);
        break;
      }
      case 'trash_bin':
        R('rgba(0,0,0,0.12)', 3, 14, 10, 2);
        R('#4caf50', 4, 4, 8, 10); R('#3d8f40', 4, 4, 8, 1); R('#3d8f40', 6, 6, 1, 7); R('#3d8f40', 9, 6, 1, 7); R('#2f7236', 3, 2, 10, 2); R('#ffffff', 7, 8, 2, 2);
        break;
      case 'vending_machine':
        R('rgba(0,0,0,0.12)', 1, 14, 14, 2);
        R('#e85d5d', 2, 0, 12, 15); R('#b84444', 2, 14, 12, 1); R('#bfe9ff', 3, 2, 7, 8);
        for (let i = 0; i < 3; i++) { R(['#ffd34d', '#6ec6ff', '#7ed492'][i], 4 + i * 2, 3, 1, 2); R(['#ff8fab', '#ffffff', '#ffb36b'][i], 4 + i * 2, 6, 1, 2); }
        R('#2b2233', 3, 11, 7, 2); R('#ffffff', 11, 3, 2, 1); R('#ffd34d', 11, 6, 2, 2);
        break;
      case 'parasol':
        R('rgba(0,0,0,0.15)', 1, 13, 14, 3);
        R('#ffffff', 7, 5, 2, 10);
        R('#ff8fab', 1, 3, 14, 3); R('#ff8fab', 3, 1, 10, 2); R('#ffffff', 5, 1, 2, 5); R('#ffffff', 10, 1, 2, 5); R('#e0708f', 1, 5, 14, 1);
        break;
      case 'garden_light':
        R('#3b3740', 6, 14, 4, 2); R('#5a5560', 7, 6, 2, 8); R('#3b3740', 5, 2, 6, 1); R('#fff3a3', 5, 3, 6, 3); R('#3b3740', 5, 6, 6, 1);
        break;
      // ── 카페
      case 'cafe_table':
        R('rgba(0,0,0,0.12)', 3, 14, 10, 2);
        R('#3b3740', 7, 9, 2, 5); R('#3b3740', 5, 14, 6, 1);
        R('#f4efe6', 2, 4, 12, 5); R('#ffffff', 3, 4, 10, 1); R('#d9d0bf', 2, 8, 12, 1);
        break;
      case 'cafe_chair':
        R('#3b3740', 4, 1, 8, 6); R('#e85d5d', 5, 2, 6, 4);
        R('#e85d5d', 3, 7, 10, 3); R('#ff8080', 3, 7, 10, 1); R('#3b3740', 4, 10, 1, 5); R('#3b3740', 11, 10, 1, 5);
        break;
      case 'bar_stool':
        R('rgba(0,0,0,0.12)', 4, 14, 8, 2);
        R('#3b3740', 7, 6, 2, 8); R('#3b3740', 5, 13, 6, 1); R('#9aa7b0', 5, 10, 6, 1);
        R('#8b5a3c', 4, 3, 8, 3); R('#a8743f', 4, 3, 8, 1);
        break;
      case 'cafe_counter':
        R('#5a4a40', 0, 6, 16, 9); R('#e8d9c6', 0, 3, 16, 4); R('#d9c3a5', 0, 6, 16, 1);
        if (!sameT(-1, 0)) R('#3b2f2a', 0, 3, 1, 12);
        if (!sameT(1, 0)) R('#3b2f2a', 15, 3, 1, 12);
        R('#7a6a5a', 2, 8, 12, 1); R('#ffd34d', 7, 10, 2, 1);
        break;
      case 'cake_showcase':
        R('rgba(0,0,0,0.12)', 0, 14, 16, 2);
        R('#fdfaf3', 0, 9, 16, 6); R('#e6dfd1', 0, 14, 16, 1); R('#bfe9ff', 1, 1, 14, 8); R('#9fdcf7', 1, 1, 14, 1); R('#9fc7e0', 0, 0, 16, 1);
        R('#ffffff', 2, 5, 4, 3); R('#ff8fab', 2, 4, 4, 1); R('#e8364f', 3, 3, 1, 1); R('#8b5a3c', 7, 5, 3, 3); R('#ffd34d', 11, 5, 3, 3); R('#ffffff', 11, 4, 3, 1);
        break;
      case 'menu_board':
        R('#8b5a3c', 3, 11, 2, 5); R('#8b5a3c', 11, 11, 2, 5);
        R('#8b5a3c', 1, 1, 14, 11); R('#2f4a3a', 2, 2, 12, 9);
        R('#ffffff', 3, 3, 6, 1); R('#ffffff', 3, 5, 8, 1); R('#ffd34d', 3, 7, 5, 1); R('#ff8fab', 3, 9, 7, 1);
        break;
      case 'bread_shelf':
        R('#a8743f', 1, 0, 14, 16); R('#8b5a3c', 1, 5, 14, 1); R('#8b5a3c', 1, 10, 14, 1); R('#8b5a3c', 1, 15, 14, 1);
        R('#e2b07c', 2, 2, 5, 3); R('#d9963f', 9, 2, 5, 3); R('#f2d16b', 2, 7, 4, 3); R('#e2b07c', 7, 7, 3, 3); R('#c9894a', 11, 7, 3, 3);
        R('#d9963f', 3, 12, 10, 3); R('#f2d16b', 4, 12, 2, 1);
        break;
      case 'coffee_cup':
        R('#ffffff', 4, 8, 7, 6); R('#e6e6f0', 4, 13, 7, 1); R('#8b5a3c', 5, 9, 5, 1); R('#ffffff', 11, 9, 2, 3); R('#e6e6f0', 2, 14, 11, 1);
        R('rgba(255,255,255,0.7)', 6, 5, 1, 2); R('rgba(255,255,255,0.7)', 8, 4, 1, 2);
        break;
      case 'cake':
        R('#e6e6f0', 2, 14, 12, 1); R('#fff7ec', 3, 8, 10, 6); R('#ff8fab', 3, 8, 10, 2); R('#e8364f', 5, 6, 2, 2); R('#e8364f', 9, 6, 2, 2); R('#ffd1dc', 3, 11, 10, 1);
        break;
      case 'bread_basket':
        R('#a8743f', 2, 9, 12, 5); R('#8b5a3c', 2, 11, 12, 1); R('#e2b07c', 3, 6, 4, 4); R('#d9963f', 7, 5, 5, 4); R('#f2d16b', 10, 7, 3, 3); R('#ffffff', 2, 9, 12, 1);
        break;
      case 'music_box':
        shadow(R, 10);
        R('#c0392b', 3, 6, 10, 8); R('#e74c3c', 3, 6, 10, 2); R('#ffd34d', 3, 9, 10, 1); R('#ffd34d', 13, 9, 2, 1); R('#ffd34d', 14, 7, 1, 3);
        R('#ff8fab', 7, 3, 2, 3); R('#ffd34d', 7, 2, 2, 1);
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

  // ───────── 돌린 가구 (옆모습·뒷모습) ─────────
  // r: 1 = 왼쪽을 봐요(옆모습), 2 = 뒤를 봐요(뒷모습), 3 = 오른쪽(왼쪽 옆모습을 좌우로 뒤집어요)
  // 아래 SIDE 에 그림이 있는 가구는 진짜 옆·뒷모습을, 없는 가구는 "서 있는 채로" 좁고 그늘지게 보여줘요.
  const tmpA = document.createElement('canvas'); tmpA.width = tmpA.height = 16;
  const tA = tmpA.getContext('2d');
  const tmpB = document.createElement('canvas'); tmpB.width = tmpB.height = 16;
  const tB = tmpB.getContext('2d');
  const SOFA_COL = { sofa: ['#c45686', '#d96c9b', '#e88bb4', '#b04a76'], sofa_blue: ['#4a7fc4', '#6497d9', '#8cb4e8', '#3b6aa8'], sofa_green: ['#4f9a5c', '#68b274', '#8ccf96', '#3f8049'] };
  const BED_COL = { bed: ['#8b5a3c', '#9b8cff', '#b8adff'], bed_pink: ['#e6dfd1', '#ff8fab', '#ffb3c7'], bed_blue: ['#e6dfd1', '#6ec6ff', '#9ad8ff'], royal_bed: ['#d4a017', '#ff8fab', '#ffb3c7'] };
  // same(dx, dy): 같은 방향으로 돌린 같은 가구가 그 옆(지도 기준)에 있는지
  const SIDE = {
    chair(R, v) {
      if (v === 'side') { R('#6e4626', 3, 11, 2, 4); R('#6e4626', 10, 11, 2, 4); R('#c99558', 3, 7, 9, 4); R('#e2b07c', 3, 7, 9, 1); R('#8b5a3c', 10, 0, 3, 11); R('#a8743f', 11, 1, 1, 9); }
      else { R('#6e4626', 4, 13, 2, 3); R('#6e4626', 10, 13, 2, 3); R('#c99558', 3, 3, 10, 4); R('#8b5a3c', 4, 5, 8, 9); R('#a8743f', 5, 6, 6, 6); }
    },
    rocking_chair(R, v) {
      SIDE.chair(R, v); R('#ff8fab', v === 'side' ? 4 : 5, v === 'side' ? 7 : 3, v === 'side' ? 6 : 6, 2);
      R('#6e4626', 1, 14, 14, 1); R('#6e4626', 0, 13, 1, 1); R('#6e4626', 15, 13, 1, 1);
    },
    armchair(R, v) {
      R('rgba(0,0,0,0.12)', 2, 14, 12, 2);
      if (v === 'side') { R('#56b8ad', 2, 6, 10, 8); R('#7fd1c7', 3, 8, 7, 2); R('#33877e', 2, 5, 10, 2); R('#3f9e94', 10, 1, 4, 13); R('#2f7d75', 2, 13, 12, 1); }
      else { R('#56b8ad', 2, 2, 12, 4); R('#3f9e94', 2, 5, 12, 9); R('#4caaa0', 3, 6, 10, 1); R('#33877e', 1, 4, 2, 10); R('#33877e', 13, 4, 2, 10); }
    },
    sofa(R, v, o, same) {
      const [a, b, c, d] = SOFA_COL[o.t] || SOFA_COL.sofa;
      if (v === 'side') {
        R(b, 2, 0, 9, 16); R(c, 3, 0, 7, 16); R(a, 11, 0, 4, 16);
        if (!same(0, -1)) { R(d, 1, 0, 14, 3); R(shade(d, 0.2), 1, 0, 14, 1); }
        if (!same(0, 1)) { R(d, 1, 12, 14, 4); R(shade(d, -0.15), 1, 15, 14, 1); }
      } else {
        R(b, 0, 1, 16, 6); R(a, 0, 6, 16, 9); R(shade(a, 0.15), 0, 6, 16, 1); R(shade(a, -0.15), 0, 14, 16, 1);
        if (!same(-1, 0)) R(d, 0, 2, 3, 13);
        if (!same(1, 0)) R(d, 13, 2, 3, 13);
      }
    },
    bench(R, v) {
      if (v === 'side') { R('#6e4626', 3, 11, 2, 4); R('#6e4626', 10, 11, 2, 4); R('#a8743f', 3, 7, 9, 3); R('#c99558', 3, 7, 9, 1); R('#8b5a3c', 10, 1, 2, 10); }
      else { R('#a8743f', 1, 3, 14, 4); R('#8b5a3c', 1, 7, 14, 2); R('#8b5a3c', 1, 10, 14, 2); R('#6e4626', 2, 12, 2, 4); R('#6e4626', 12, 12, 2, 4); }
    },
    throne(R, v) {
      R('rgba(0,0,0,0.12)', 2, 14, 12, 2);
      if (v === 'side') { R('#d4a017', 3, 10, 9, 4); R('#c0392b', 3, 7, 9, 3); R('#e74c3c', 3, 7, 9, 1); R('#d4a017', 10, 0, 4, 14); R('#c0392b', 11, 1, 2, 8); R('#ffd34d', 11, 0, 2, 1); }
      else { R('#d4a017', 3, 0, 10, 14); R('#b58a12', 3, 12, 10, 2); R('#ffd34d', 7, 0, 2, 1); R('#ffd34d', 6, 5, 4, 3); R('#ff5c8a', 7, 6, 2, 1); }
    },
    toilet(R, v) {
      if (v === 'side') { R('#e6eef3', 10, 1, 4, 9); R('#ffffff', 11, 1, 2, 1); R('#ffffff', 2, 6, 9, 5); R('#e6eef3', 2, 6, 9, 1); R('#d9e2e8', 4, 11, 5, 3); }
      else { R('#ffffff', 3, 2, 10, 6); R('#bfe9ff', 5, 3, 6, 3); R('#e6eef3', 4, 7, 8, 7); R('#ffffff', 4, 7, 8, 1); R('#9aa7b0', 7, 9, 2, 1); }
    },
    bed(R, v, o) {
      const [f, bl, hl] = BED_COL[o.t] || BED_COL.bed;
      if (v === 'side') {
        R(f, 0, 3, 16, 12); R(f, 13, 0, 3, 15); R(bl, 1, 4, 12, 7); R(hl, 1, 4, 12, 1); R('#ffffff', 9, 4, 4, 6); R('#e6e6f0', 9, 9, 4, 1);
        R(shade(f, -0.25), 0, 11, 16, 4);
      } else {
        R(f, 1, 0, 14, 2); R(bl, 1, 1, 14, 10); R(hl, 1, 1, 14, 1); R('#ffffff', 2, 7, 12, 4); R(f, 0, 10, 16, 6); R(shade(f, 0.15), 0, 10, 16, 1);
      }
    },
    tv(R, v, o) {
      R('#4a3b5c', 4, 14, 8, 1); R('#2b2233', 6, 12, 4, 2);
      if (v === 'side') { R('#2b2233', 6, 2, 4, 10); R(o.on ? '#8fd3ff' : '#4a4652', 6, 3, 1, 8); }
      else { R('#3b3740', 1, 2, 14, 10); R('#2b2233', 1, 2, 14, 1); for (let i = 3; i < 13; i += 3) R('#2b2233', i, 5, 1, 5); }
    },
    table(R, v, o, same, x, y) {
      if (v === 'side') {
        R('#9c6b3f', 3, 0, 10, 16); R('#b88252', 4, 0, 8, 16);
        if (!same(0, -1)) R('#c99558', 3, 0, 10, 1);
        if (!same(0, 1)) { R('#7a4e2d', 3, 11, 10, 2); R('#6e4626', 3, 13, 2, 3); R('#6e4626', 11, 13, 2, 3); }
        if (hash(x, y) < 0.4) { R('#ffffff', 6, 4, 4, 4); R('#8b5a3c', 7, 5, 2, 2); }
      } else {
        R('#9c6b3f', 0, 4, 16, 8); R('#b88252', 0, 4, 16, 2); R('#7a4e2d', 0, 11, 16, 1);
        if (!same(-1, 0)) R('#6e4626', 1, 12, 2, 3);
        if (!same(1, 0)) R('#6e4626', 13, 12, 2, 3);
      }
    },
    counter(R, v, o, same) {
      if (v === 'side') {
        R('#f0ece4', 3, 0, 10, 16); R('#d9d0bf', 12, 0, 1, 16); R('#a8743f', 2, 0, 1, 16);
        if (!same(0, 1)) { R('#a8743f', 2, 10, 11, 6); R('#8b5a3c', 2, 10, 11, 1); R('#ffd34d', 7, 12, 2, 1); }
      } else {
        R('#a8743f', 0, 3, 16, 12); R('#8b5a3c', 0, 3, 16, 1); R('#f0ece4', 0, 1, 16, 3);
        if (!same(-1, 0)) R('#8b5a3c', 0, 1, 1, 14);
        if (!same(1, 0)) R('#8b5a3c', 15, 1, 1, 14);
      }
    },
  };
  SIDE.sofa_blue = SIDE.sofa_green = SIDE.sofa;
  SIDE.bed_pink = SIDE.bed_blue = SIDE.royal_bed = SIDE.bed;
  SIDE.cafe_chair = (R, v) => {
    if (v === 'side') { R('#3b3740', 4, 10, 1, 5); R('#3b3740', 10, 10, 1, 5); R('#e85d5d', 3, 7, 9, 3); R('#ff8080', 3, 7, 9, 1); R('#3b3740', 10, 1, 2, 9); R('#e85d5d', 10, 2, 2, 4); }
    else { R('#3b3740', 4, 13, 1, 3); R('#3b3740', 11, 13, 1, 3); R('#e85d5d', 3, 4, 10, 3); R('#3b3740', 4, 6, 8, 7); R('#e85d5d', 5, 7, 6, 3); }
  };
  SIDE.park_bench = (R, v) => {
    if (v === 'side') { R('#3b3740', 3, 10, 2, 5); R('#3b3740', 10, 10, 2, 5); R('#5a8a3a', 3, 7, 9, 3); R('#7aa85a', 3, 7, 9, 1); R('#3b3740', 10, 1, 2, 10); R('#5a8a3a', 11, 2, 1, 7); }
    else { R('#5a8a3a', 0, 3, 16, 4); R('#3b3740', 0, 7, 16, 1); R('#5a8a3a', 0, 8, 16, 2); R('#5a8a3a', 0, 11, 16, 2); R('#3b3740', 2, 13, 2, 3); R('#3b3740', 12, 13, 2, 3); }
  };
  SIDE.picnic_table = (R, v, o, same, x, y) => {
    if (v === 'side') { R('#a8743f', 1, 3, 3, 12); R('#a8743f', 12, 3, 3, 12); R('#b88252', 5, 1, 6, 14); R('#c99558', 5, 1, 6, 1); R('#7a4e2d', 5, 13, 6, 2); }
    else SIDE.table(R, 'back', o, same, x, y);
  };
  SIDE.cafe_counter = (R, v, o, same) => {
    if (v === 'side') {
      R('#3b2f2a', 3, 0, 10, 16); R('#d9c3a5', 2, 0, 1, 16); R('#e8d9c6', 3, 0, 10, 1);
      if (!same(0, 1)) { R('#5a4a40', 2, 10, 11, 6); R('#3b2f2a', 2, 10, 11, 1); R('#ffd34d', 7, 12, 2, 1); }
    } else {
      R('#5a4a40', 0, 3, 16, 12); R('#3b2f2a', 0, 3, 16, 1); R('#e8d9c6', 0, 1, 16, 3);
      if (!same(-1, 0)) R('#3b2f2a', 0, 1, 1, 14);
      if (!same(1, 0)) R('#3b2f2a', 15, 1, 1, 14);
    }
  };

  function drawFacing(g, ox, oy, o, x, y, world) {
    const r = o.r || 0;
    const rot = r;
    const same = (dx, dy) => {
      if (rot === 3) dx = -dx; // 오른쪽 보기는 왼쪽 그림을 뒤집으니까 옆 칸도 뒤집어서 봐요
      const n = world ? world.o(x + dx, y + dy) : null;
      return !!n && n.t === o.t && (n.r || 0) === rot;
    };
    const art = SIDE[o.t];
    if (art) {
      if (r === 3) {
        tA.clearRect(0, 0, 16, 16);
        art(pen(tA, 0, 0), 'side', o, same, x, y);
        g.save(); g.translate(ox + 16, oy); g.scale(-1, 1); g.drawImage(tmpA, 0, 0); g.restore();
      } else art(pen(g, ox, oy), r === 2 ? 'back' : 'side', o, same, x, y);
      return;
    }
    // 그림이 없는 가구: 앞모습을 바탕으로 진짜 옆모습·뒷모습을 만들어요 (만든 그림은 기억해 둬요)
    const img = sideImage(o, r === 2 ? 2 : 1);
    g.save();
    g.imageSmoothingEnabled = false;
    if (r === 3) { g.translate(ox + 16, oy); g.scale(-1, 1); g.drawImage(img, 0, 0); }
    else g.drawImage(img, ox, oy);
    g.restore();
  }
  // 옆모습(v=1, 왼쪽을 봄): 가구 모양 그대로 "옆판"을 칠하고, 앞면 무늬는 왼쪽 가장자리에 얇게 보여요. 윗면은 밝게.
  // 뒷모습(v=2): 같은 모양에 "뒤판"을 칠하고 가운데 이음선·윗면 테두리를 그려요.
  const sideCache = new Map();
  function sideImage(o, v) {
    const k = `${o.t}|${v}|${o.on ? 1 : 0}|${o.locked ? 1 : 0}`;
    if (sideCache.has(k)) return sideCache.get(k);
    tA.clearRect(0, 0, 16, 16);
    drawObject(pen(tA, 0, 0), { t: o.t, on: o.on, locked: o.locked, open: o.open }, 0, 0, null);
    const src = tA.getImageData(0, 0, 16, 16).data;
    const op = (x, y) => src[(y * 16 + x) * 4 + 3] > 200;
    // 모양 범위와 가장 많이 쓴 색(= 몸통 색)
    let x0 = 16, x1 = -1, y0 = 16, y1 = -1;
    const count = {};
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!op(x, y)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      const i = (y * 16 + x) * 4, c = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
      count[c] = (count[c] || 0) + 1;
    }
    const out = document.createElement('canvas'); out.width = out.height = 16;
    if (x1 < 0) { sideCache.set(k, out); return out; }
    const body = +Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    const br = body >> 16, bg = (body >> 8) & 255, bb = body & 255;
    const mix = (f) => [Math.round(br * f), Math.round(bg * f), Math.round(bb * f)].map((c) => Math.min(255, c));
    const panel = mix(v === 2 ? 0.78 : 0.9), dark = mix(v === 2 ? 0.6 : 0.68), light = mix(1.18);
    const bw = x1 - x0 + 1, strip = Math.max(2, Math.min(4, Math.round(bw / 3)));
    const oc = out.getContext('2d'), od = oc.createImageData(16, 16), d = od.data;
    const put = (x, y, rgb, a = 255) => { const i = (y * 16 + x) * 4; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = a; };
    const topOf = []; for (let x = 0; x < 16; x++) { topOf[x] = -1; for (let y = 0; y < 16; y++) if (op(x, y)) { topOf[x] = y; break; } }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = (y * 16 + x) * 4;
      if (!op(x, y)) { if (src[i + 3] > 0) { d[i] = src[i]; d[i + 1] = src[i + 1]; d[i + 2] = src[i + 2]; d[i + 3] = src[i + 3]; } continue; }
      if (y === topOf[x] || y === topOf[x] + 1) { put(x, y, light); continue; }           // 윗면
      if (v === 1 && x < x0 + strip) {                                                     // 앞면 무늬 (얇게)
        const sx = x0 + Math.min(bw - 1, Math.floor((x - x0) * bw / strip));
        const j = (y * 16 + sx) * 4;
        if (src[j + 3] > 200) { put(x, y, [Math.round(src[j] * 0.92), Math.round(src[j + 1] * 0.92), Math.round(src[j + 2] * 0.92)]); continue; }
      }
      if (v === 1 && x === x0 + strip) { put(x, y, dark); continue; }                       // 모서리
      if (v === 2 && (x === Math.floor((x0 + x1) / 2) || x === x0 || x === x1)) { put(x, y, dark); continue; } // 뒤판 이음선
      if (y === y1) { put(x, y, dark); continue; }                                          // 바닥 그림자
      put(x, y, panel);
    }
    oc.putImageData(od, 0, 0);
    sideCache.set(k, out);
    return out;
  }
  // 조리대·싱크대 위에 올린 물건 (작게, 윗면에 앉혀요)
  const APPLIANCE = new Set(['microwave', 'coffee_machine', 'rice_cooker']);
  function drawTop(g, ox, oy, top) {
    tA.clearRect(0, 0, 16, 16);
    drawObject(pen(tA, 0, 0), { t: top }, 0, 0, null);
    const srcH = APPLIANCE.has(top) ? 9 : 16;
    const dw = APPLIANCE.has(top) ? 12 : 10, dh = Math.round(srcH * dw / 16);
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(tmpA, 0, 0, 16, srcH, ox + (16 - dw) / 2, oy + 6 - dh, dw, dh);
    g.restore();
  }
  function drawTile(g, ox, oy, x, y, world) {
    const R = pen(g, ox, oy);
    drawGround(R, world.g(x, y), x, y, world);
    const o = world.o(x, y);
    if (!o) return;
    if (o.r) drawFacing(g, ox, oy, o, x, y, world);
    else drawObject(R, o, x, y, world);
    if (o.top) drawTop(g, ox, oy, o.top);
  }
  // 놓기 미리보기 (방향 r)
  function drawItemRot(g, ox, oy, id, r) {
    const it = S.ITEMS[id];
    if (!r || !it || !it.obj) return drawItem(g, ox, oy, id);
    drawFacing(g, ox, oy, { t: it.obj, r }, 0, 0, null);
  }

  // ───────── 움직이는 그림 (매 프레임 타일 위에 덧그려요) ─────────
  function drawAnim(g, o, ox, oy, t) {
    if (o.r) return; // 옆·뒷모습에서는 화면이 안 보여요
    const R = pen(g, ox, oy);
    const f = Math.floor(t / 150);
    switch (o.t) {
      case 'tv': {
        const cols = ['#ff8fab', '#8fd3ff', '#ffe066', '#7ed492', '#c9a0ff'];
        const c = cols[Math.floor(t / 900) % cols.length];
        R(c, 2, 3, 12, 8); R('#ffffff', 3 + (f % 8), 5, 2, 2); R(shade(c, -0.25), 2, 9, 12, 2); R('rgba(255,255,255,0.25)', 2, 3 + (f % 8), 12, 1);
        break;
      }
      case 'computer': R('#4a90e2', 4, 2, 8, 5); R('#ffffff', 5, 3, 1 + (f % 6), 1); R('#bfe9ff', 5, 5, 4, 1); break;
      case 'arcade': R(['#7ed492', '#ff8fab', '#ffe066'][f % 3], 4, 4, 8, 4); R('#2b2233', 5 + (f % 6), 5, 1, 2); break;
      case 'washer': { const a = t / 150; R('#6ec6ff', 5, 6, 6, 6); R('#ffffff', Math.round(7 + Math.cos(a) * 2), Math.round(8 + Math.sin(a) * 2), 2, 2); break; }
      case 'shower': for (let i = 0; i < 4; i++) R('#6ec6ff', 4 + i * 2, 4 + ((f * 2 + i * 3) % 8), 1, 2); break;
      case 'campfire': R(f % 2 ? '#ff7a1a' : '#ff9a2e', 5, 4 - (f % 2), 6, 6); R('#ffb02e', 6, 3 + (f % 2), 4, 5); R('#ffe066', 7, 5, 2, 3 + (f % 2)); if (f % 3 === 0) R('#ffe066', 9, 1, 1, 1); break;
      case 'torch': R(f % 2 ? '#ff9a2e' : '#ff7a1a', 6, 2 - (f % 2), 4, 4); R('#ffe066', 7, 3, 2, 2 + (f % 2)); break;
      case 'fireplace': R(f % 2 ? '#ff7a1a' : '#ff9a2e', 5, 8 - (f % 2), 6, 5); R('#ffe066', 7, 10 - (f % 2), 2, 3); break;
      case 'aquarium': {
        const fx = 2 + Math.floor((t / 120) % 20); const px = fx > 11 ? 22 - fx : fx;
        R('#ffb36b', px, 6, 3, 2); R('#ff8c3a', px + (fx > 11 ? 3 : -1), 6, 1, 2);
        R('#ffd34d', 12 - (f % 9), 9, 2, 1); R('#ffffff', 5, 9 - (f % 5), 1, 1);
        break;
      }
      case 'fountain': R('#bfe9ff', 6 - (f % 2), 0, 1, 2); R('#bfe9ff', 9 + (f % 2), 0, 1, 2); R('#ffffff', 3 + (f % 9), 10, 1, 1); break;
      case 'xmas_tree': {
        const cols = ['#e85d5d', '#ffd34d', '#6ec6ff', '#ff8fab'];
        [[5, 6], [9, 9], [4, 11], [11, 11], [7, 4], [6, 9]].forEach(([lx, ly], i) => R(cols[(i + f) % 4], lx, ly, 1, 1));
        R(f % 2 ? '#fff3a3' : '#ffd34d', 7, 0, 2, 2);
        break;
      }
      case 'dungeon_exit': {
        const c = ['#7e6fe0', '#9b8cff', '#b8adff', '#9b8cff'][f % 4];
        R(c, 4, 4, 8, 10); R('#ffffff', 7 + Math.round(Math.sin(t / 200) * 2), 6 + (f % 6), 1, 1); R('#e6d9ff', 5, 12 - (f % 8), 1, 1);
        break;
      }
      case 'candle':
        for (const cx of [3, 7, 11]) { R(f % 2 ? '#ffb02e' : '#ff9a2e', cx, 2 - ((f + cx) % 2), 2, 2); R('#fff3a3', cx, 2, 1, 1); }
        break;
      case 'fishbowl': {
        const fx = 4 + Math.floor((t / 160) % 12), px = fx > 9 ? 19 - fx : fx;
        R('#63bde8', 4, 7, 8, 5); R('#ff8c3a', px, 8, 3, 2); R('#ffffff', 6, 10 - (f % 4), 1, 1); R('#4caf50', 10, 9, 1, 4);
        break;
      }
      case 'windmill': {
        const a = t / 400;
        for (let k = 0; k < 4; k++) {
          const ang = a + k * Math.PI / 2;
          for (let r = 1; r < 6; r++) R('#c99558', Math.round(8 + Math.cos(ang) * r) - 1, Math.round(4 + Math.sin(ang) * r), 2, 1);
        }
        R('#7a4e2d', 7, 4, 2, 1);
        break;
      }
    }
  }
  const hasAnim = (o) => { const d = o && S.OBJ[o.t]; return !!d && !!d.anim && (!d.toggle || !!o.on); };
  const lightOf = (o) => { const d = o && S.OBJ[o.t]; return d && d.light && (!d.toggle || o.on) ? d.light : 0; };

  // ───────── 동물 ─────────
  // (x, y) = 발 위치, 오른쪽을 보는 그림을 left 일 때 뒤집어요
  function drawAnimal(g, x, y, kind, dir, step, t) {
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
      case 'deer':
        R('rgba(0,0,0,0.15)', -6, -1, 12, 2);
        legs('#8b5a3c', [-5, -2, 1, 3], 5);
        R('#c98a5a', -6, -11 + b, 11, 6); R('#e8c39e', -4, -6 + b, 7, 1); R('#ffffff', -4, -10 + b, 1, 1); R('#ffffff', -1, -9 + b, 1, 1); R('#ffffff', 1, -10 + b, 1, 1);
        R('#ffffff', -7, -11 + b, 2, 2);
        R('#c98a5a', 3, -15 + b, 3, 5); R('#c98a5a', 4, -16 + b, 4, 4); R('#2b2233', 6, -15 + b, 1, 1); R('#3b2f45', 8, -13 + b, 1, 1);
        R('#e8d3a8', 4, -20 + b, 1, 4); R('#e8d3a8', 3, -19 + b, 1, 1); R('#e8d3a8', 6, -20 + b, 1, 4); R('#e8d3a8', 7, -19 + b, 1, 1);
        break;
      case 'dog': case 'dog_white': case 'dog_spot': {
        const [body, ear, belly] = S.ANIMALS[kind].col;
        const wag = Math.floor((t || 0) / 160) % 2;
        R('rgba(0,0,0,0.15)', -6, -1, 12, 2);
        legs(shade(body, -0.1), [-5, -2, 1, 3], 3);
        R(body, -6, -9 + b, 10, 6); R(belly, -4, -4 + b, 6, 1);
        R(body, -8, -10 + b - wag, 2, 3);
        if (kind === 'dog_spot') { R(ear, -4, -8 + b, 2, 2); R(ear, 0, -7 + b, 2, 1); R(ear, -2, -5 + b, 1, 1); }
        R(body, 2, -13 + b, 6, 6); R(body, 8, -10 + b, 2, 3); R('#2b2233', 9, -10 + b, 1, 1);
        R(ear, 2, -13 + b, 2, 4); R('#2b2233', 6, -11 + b, 1, 1);
        if (kind !== 'dog_spot') R(ear, 3, -12 + b, 1, 1);
        R('#ff8fab', 8, -8 + b, 1, 1);
        R('#e85d5d', -1, -9 + b, 4, 1); R('#ffd34d', 1, -8 + b, 1, 1); // 목걸이
        break;
      }
      case 'cat': case 'cat_black': case 'cat_calico': {
        const [body, dark, eye] = S.ANIMALS[kind].col;
        const sway = Math.floor((t || 0) / 220) % 2;
        R('rgba(0,0,0,0.15)', -5, -1, 10, 2);
        legs(shade(body, -0.12), [-4, -2, 1, 3], 3);
        R(body, -5, -8 + b, 9, 5);
        R(body, -7, -12 + b + sway, 2, 6); R(body, -8, -13 + b + sway, 2, 2);
        if (kind === 'cat') { R(dark, -3, -8 + b, 1, 4); R(dark, 0, -8 + b, 1, 4); }
        if (kind === 'cat_calico') { R(dark, -4, -8 + b, 3, 2); R(eye, 0, -7 + b, 3, 2); R(dark, -7, -12 + b + sway, 2, 2); }
        R(body, 2, -12 + b, 6, 5); R(body, 2, -14 + b, 2, 2); R(body, 6, -14 + b, 2, 2);
        if (kind === 'cat_calico') R(eye, 2, -12 + b, 3, 2);
        R(kind === 'cat_black' ? eye : '#2b2233', 5, -11 + b, 1, 1); R(kind === 'cat_black' ? eye : '#2b2233', 7, -11 + b, 1, 1);
        R('#ff8fab', 6, -9 + b, 1, 1); R('#ff8fab', 3, -13 + b, 1, 1);
        R('#6ec6ff', 1, -8 + b, 3, 1); // 목걸이
        break;
      }
      case 'pbunny': {
        const [body, inner, shadeC] = S.ANIMALS[kind].col;
        R('rgba(0,0,0,0.15)', -5, -1, 10, 2);
        R(body, -4, -7 + b, 8, 6); R(shadeC, -3, -2, 2, 2); R(shadeC, 2, -2, 2, 2); R('#ffffff', -6, -6 + b, 2, 2);
        R(body, 1, -11 + b, 5, 5); R(body, 1, -17 + b, 2, 6); R(body, 4, -17 + b, 2, 6);
        R(inner, 1, -16 + b, 1, 4); R(inner, 4, -16 + b, 1, 4); R('#2b2233', 4, -9 + b, 1, 1); R('#ff8fab', 6, -8 + b, 1, 1);
        R('#ff8fab', -1, -7 + b, 3, 1); // 리본
        break;
      }
      case 'duck':
        R('rgba(0,0,0,0.15)', -4, -1, 8, 2);
        legs('#ff9a2e', [-2, 1], 2);
        R('#ffffff', -5, -7 + b, 9, 5); R('#e6e6f0', -3, -4 + b, 5, 1); R('#ffffff', -6, -8 + b, 2, 2);
        R('#4caf50', 1, -12 + b, 4, 5); R('#ffffff', 1, -8 + b, 4, 1); R('#ff9a2e', 5, -10 + b, 3, 2); R('#2b2233', 3, -11 + b, 1, 1);
        break;
      case 'goat':
        R('rgba(0,0,0,0.15)', -6, -1, 12, 2);
        legs('#bdb39f', [-5, -2, 1, 3], 4);
        R('#f2ede4', -6, -11 + b, 11, 7); R('#e0d8c8', -4, -5 + b, 7, 1); R('#f2ede4', -7, -11 + b, 1, 2);
        R('#f2ede4', 3, -14 + b, 5, 6); R('#9a8a6a', 3, -16 + b, 1, 3); R('#9a8a6a', 6, -16 + b, 1, 3); R('#2b2233', 6, -12 + b, 1, 1);
        R('#e0d8c8', 6, -8 + b, 2, 3); R('#ffadc0', 7, -10 + b, 1, 1);
        break;
      case 'pig':
        R('rgba(0,0,0,0.15)', -6, -1, 12, 2);
        legs('#e891a6', [-5, -2, 1, 3], 3);
        R('#ffb3c7', -6, -10 + b, 12, 7); R('#ffc9d6', -4, -9 + b, 6, 2); R('#e891a6', -7, -9 + b, 1, 2);
        R('#ffb3c7', 4, -11 + b, 5, 6); R('#ff8fab', 8, -8 + b, 2, 2); R('#c2185b', 8, -7 + b, 1, 1); R('#2b2233', 6, -10 + b, 1, 1); R('#e891a6', 4, -12 + b, 2, 1);
        break;
    }
  }

  // ───────── 아이템 아이콘 (16×16) ─────────
  const FISH_COL = {
    fish_minnow: '#c8d6dc', fish_crucian: '#9aa7b0', fish_tropical: '#ffb36b', fish_puffer: '#f2d16b', fish_golden: '#ffd34d',
    fish_trout: '#a7c48a', fish_salmon: '#ff9a7a', fish_blind: '#f0eef5',
  };
  const SEED_COL = { carrot: '#ff8c3a', strawberry: '#e8364f', sunflower: '#ffd34d', pumpkin: '#ff9a2e', tomato: '#ff5c5c', corn: '#ffe066', potato: '#c9a26b', watermelon: '#3fa146' };
  // 요리 그림: [모양, 색1, 색2]
  const FOOD_ART = {
    carrot_soup: ['bowl', '#ff9a4a', '#ffbe8a'], mushroom_soup: ['bowl', '#f2e6d0', '#c98a5a'], veggie_stew: ['bowl', '#d9783a', '#7ed492'],
    cave_stew: ['bowl', '#e85d5d', '#ffffff'], fried_egg: ['egg'], grilled_fish: ['fish', '#c9894a'], trout_grill: ['fish', '#a7743f'],
    golden_dish: ['fish', '#ffd34d'], steak: ['steak'], bbq: ['skewer'], strawberry_jam: ['jar', '#e8364f'], strawberry_milk: ['cup', '#ffb3c7'],
    omelet: ['omelet'], pumpkin_pie: ['pie', '#ff9a2e'], berry_tart: ['pie', '#c2185b'], sun_cookie: ['cookie'], sashimi: ['sashimi'],
    tomato_soup: ['bowl', '#e8364f', '#ff8080'], corn_soup: ['bowl', '#ffe066', '#fff3a3'], baked_potato: ['potato'], fries: ['fries'],
    salad: ['bowl', '#7ed492', '#e8364f'], watermelon_juice: ['cup', '#ff6b81'], duck_egg_roll: ['omelet'], pizza: ['pizza'], truffle_pasta: ['pasta'],
  };
  function drawFood(R, id) {
    const [shape, c1, c2] = FOOD_ART[id] || ['bowl', '#ccc', '#eee'];
    const plate = () => { R('#ffffff', 1, 9, 14, 5); R('#e6e6f0', 2, 13, 12, 1); };
    switch (shape) {
      case 'bowl': R(c1, 3, 6, 10, 2); R('#ffffff', 2, 7, 12, 6); R('#e6e6f0', 4, 12, 8, 1); R(c1, 3, 6, 10, 3); R(c2, 5, 6, 2, 1); R(c2, 9, 7, 2, 1); R('#ffffff', 5, 3, 1, 2); R('#ffffff', 9, 2, 1, 2); break;
      case 'egg': plate(); R('#ffffff', 3, 7, 10, 5); R('#ffd34d', 6, 8, 4, 3); R('#ffe88a', 6, 8, 2, 1); break;
      case 'fish': plate(); R(c1, 3, 7, 9, 4); R(c1, 11, 6, 3, 6); R('#2b2233', 4, 8, 1, 1); R(shade(c1, -0.3), 6, 8, 1, 2); R(shade(c1, -0.3), 8, 8, 1, 2); if (id === 'golden_dish') R('#ffffff', 2, 3, 1, 1); break;
      case 'steak': plate(); R('#8b3a2a', 3, 6, 10, 6); R('#a8503a', 4, 7, 4, 2); R('#fff7ec', 11, 8, 2, 2); R('#7ed492', 2, 10, 2, 1); break;
      case 'skewer': R('#a8743f', 1, 13, 14, 1); for (let i = 0; i < 4; i++) R(i % 2 ? '#ff8c3a' : '#8b3a2a', 2 + i * 3, 9 - i, 3, 3); R('#a8743f', 13, 2, 1, 1); break;
      case 'jar': R(c1, 4, 5, 8, 9); R('#ffffff', 4, 3, 8, 2); R('#e85d5d', 4, 2, 8, 1); R(shade(c1, 0.3), 5, 7, 2, 4); R('#ffffff', 6, 9, 4, 2); break;
      case 'cup': R('#ffffff', 4, 4, 8, 10); R(c1, 5, 5, 6, 8); R('#ffffff', 12, 6, 2, 4); R('#e8364f', 7, 2, 2, 3); break;
      case 'omelet': plate(); R('#ffd34d', 3, 6, 10, 5); R('#ffe88a', 4, 6, 6, 1); R('#e85d5d', 6, 7, 4, 1); break;
      case 'pie': R('#e2b07c', 2, 6, 12, 7); R(c1, 3, 7, 10, 4); R('#c9955f', 2, 12, 12, 1); R('#e2b07c', 4, 8, 8, 1); R('#e2b07c', 7, 7, 1, 4); break;
      case 'cookie': R('#e2b07c', 2, 4, 6, 6); R('#c9955f', 3, 5, 1, 1); R('#8b5a3c', 5, 7, 1, 1); R('#e2b07c', 8, 7, 6, 6); R('#8b5a3c', 10, 9, 1, 1); R('#8b5a3c', 12, 10, 1, 1); break;
      case 'potato': plate(); R('#c9a26b', 3, 6, 10, 6); R('#a8834f', 5, 8, 1, 1); R('#fff3a3', 6, 6, 4, 2); R('#ffffff', 7, 5, 2, 1); break;
      case 'fries': R('#e85d5d', 4, 7, 8, 8); R('#c0392b', 4, 7, 8, 1); for (let i = 0; i < 4; i++) R('#ffd34d', 4 + i * 2, 2 + (i % 2), 1, 6); R('#ffffff', 6, 10, 4, 2); break;
      case 'pizza': R('#e2b07c', 1, 3, 14, 11); R('#ffd34d', 2, 4, 12, 9); R('#e8364f', 4, 6, 2, 2); R('#e8364f', 9, 5, 2, 2); R('#e8364f', 7, 9, 2, 2); R('#7ed492', 5, 10, 1, 1); R('#c9955f', 7, 3, 1, 11); break;
      case 'pasta': plate(); R('#f2d16b', 3, 6, 10, 5); R('#e8c25a', 4, 7, 8, 1); R('#e8c25a', 5, 9, 6, 1); R('#3b3740', 6, 5, 2, 2); R('#3b3740', 9, 6, 1, 1); break;
      case 'sashimi': R('#3b3740', 1, 9, 14, 5); R('#ff9a7a', 2, 7, 3, 4); R('#ffb3a0', 6, 7, 3, 4); R('#ffffff', 10, 7, 3, 4); R('#7ed492', 13, 8, 1, 3); break;
    }
  }
  // 무기 아이콘 (대각선)
  const WEAPON_COL = {
    wood_sword: ['#c99558', '#8b5a3c'], iron_sword: ['#c4ced6', '#6e4626'], knight_sword: ['#e6f0ff', '#d4a017'], hero_sword: ['#ffe27a', '#c0392b'],
    long_bow: ['#8b5a3c', '#ffffff'], elf_bow: ['#7ed492', '#ffffff'], phoenix_bow: ['#ff7a1a', '#ffe066'],
    staff_basic: ['#a8743f', '#7fdcff'], crystal_staff: ['#c9c9d3', '#b48cff'], arch_staff: ['#4a3b5c', '#ff5c8a'],
    kunai: ['#9aa7b0', '#3b3740'], ninja_blade: ['#c4ced6', '#2b2233'], shadow_blade: ['#6c3fb5', '#2b2233'],
  };
  function drawWeapon(R, id, it) {
    const [a, b] = WEAPON_COL[id] || ['#c4ced6', '#6e4626'];
    switch (it.weapon) {
      case 'sword': {
        const big = id === 'hero_sword' ? 1 : 0;
        for (let i = 0; i < 9; i++) R(a, 5 + i, 9 - i, 2 + big, 2);
        R(shade(a, 0.3), 6, 8, 1, 1); R(b, 2, 10, 6, 2); R(b, 4, 8, 2, 6); R('#6e4626', 2, 12, 2, 2); R('#ffd34d', 1, 13, 2, 2);
        break;
      }
      case 'bow':
        for (let i = 0; i < 6; i++) { R(a, 3 + Math.round(i * 0.4), 2 + i, 2, 1); R(a, 3 + Math.round(i * 0.4), 13 - i, 2, 1); }
        R(b, 4, 2, 1, 12); R('#9aa7b0', 6, 7, 8, 1); R('#e85d5d', 13, 6, 2, 3);
        if (id === 'phoenix_bow') { R('#ffe066', 2, 1, 2, 1); R('#ffe066', 2, 14, 2, 1); }
        break;
      case 'staff':
        for (let i = 0; i < 10; i++) R(a, 3 + i, 13 - i, 2, 1);
        R(b, 10, 1, 5, 5); R('#ffffff', 11, 2, 2, 2); R(shade(b, -0.3), 10, 5, 5, 1);
        break;
      case 'ninja':
        if (id === 'kunai') { R(a, 8, 2, 3, 3); R(a, 7, 5, 3, 3); R(a, 6, 7, 2, 2); R(b, 4, 9, 3, 4); R('#c4ced6', 2, 12, 3, 3); R('#ffffff', 3, 13, 1, 1); }
        else { for (let i = 0; i < 9; i++) R(a, 5 + i, 9 - i, 2, 1); R(b, 3, 10, 4, 4); R('#e85d5d', 2, 9, 6, 1); }
        break;
    }
  }
  function drawArmorIcon(R, ar) {
    const c = S.ARMOR_TIERS[ar.tier].col, d = shade(c, -0.3), l = shade(c, 0.35);
    switch (ar.part) {
      case 'helmet': R(c, 3, 3, 10, 7); R(c, 2, 6, 12, 6); R('#2b2233', 4, 8, 8, 3); R(l, 4, 4, 4, 1); R(d, 2, 11, 2, 2); R(d, 12, 11, 2, 2); break;
      case 'chest': R(c, 2, 3, 12, 10); R(c, 0, 3, 3, 5); R(c, 13, 3, 3, 5); R('#2b2233', 6, 2, 4, 2); R(l, 3, 4, 3, 1); R(d, 2, 12, 12, 1); R(d, 7, 5, 2, 7); break;
      case 'legs': R(c, 3, 2, 10, 4); R(c, 3, 6, 4, 8); R(c, 9, 6, 4, 8); R(d, 3, 2, 10, 1); R(l, 4, 7, 1, 5); R(l, 10, 7, 1, 5); break;
      case 'boots': R(c, 2, 6, 4, 6); R(c, 10, 6, 4, 6); R(c, 1, 11, 6, 3); R(c, 9, 11, 6, 3); R(d, 1, 13, 6, 1); R(d, 9, 13, 6, 1); R(l, 3, 7, 1, 3); R(l, 11, 7, 1, 3); break;
    }
  }
  function drawItem(g, ox, oy, id) {
    const R = pen(g, ox, oy);
    const it = S.ITEMS[id];
    if (!it) return;
    if (it.ground) { drawGround(R, it.ground, 3, 5, null); R('rgba(0,0,0,0.15)', 0, 15, 16, 1); return; }
    if (it.obj) { drawObject(R, { t: it.obj, open: false }, 0, 0, null); return; }
    if (it.seed) {
      R('#e8d3a8', 3, 2, 10, 13); R('#d4b98a', 3, 2, 10, 2); R('#ffffff', 5, 6, 6, 6);
      R(SEED_COL[it.seed], 6, 7, 4, 4); R('#4caf50', 7, 5, 2, 2);
      return;
    }
    if (S.CROPS[id]) { drawCrop(R, id, 3, false); return; }
    if (it.animal) { drawAnimal(g, ox + (S.ANIMALS[it.animal].pet ? 7 : 8), oy + 15, it.animal, 'right', -1, 0); return; }
    if (it.food) { drawFood(R, id); return; }
    if (it.weapon && id !== 'bow') { drawWeapon(R, id, it); return; }
    if (it.armor) { drawArmorIcon(R, it.armor); return; }
    if (it.fish) {
      if (id === 'fish_shrimp') {
        R('#ff9ee6', 3, 6, 8, 4); R('#ffc9f0', 4, 6, 3, 1); R('#ff9ee6', 10, 7, 3, 5); R('#ff9ee6', 1, 4, 3, 3); R('#2b2233', 2, 5, 1, 1);
        R('#ffffff', 2, 3, 1, 1); R('#ff6fd0', 5, 10, 1, 2); R('#ff6fd0', 8, 10, 1, 2);
        return;
      }
      const c = FISH_COL[id];
      if (id === 'fish_puffer') {
        R(c, 3, 4, 9, 9); R(c, 2, 6, 11, 5); R('#c9a23a', 1, 5, 1, 1); R('#c9a23a', 6, 2, 1, 2); R('#c9a23a', 9, 13, 1, 2);
        R(c, 12, 7, 3, 3); R('#2b2233', 5, 7, 1, 1); R('#ffffff', 4, 9, 4, 2);
        return;
      }
      R(c, 2, 6, 10, 5); R(c, 4, 5, 6, 7); R(c, 12, 5, 3, 7); R(shade(c, -0.25), 12, 7, 1, 3);
      R(id === 'fish_blind' ? '#ffadc0' : '#2b2233', 4, 7, 1, 1); R(shade(c, 0.4), 5, 6, 4, 1);
      if (id === 'fish_tropical') { R('#ffffff', 7, 5, 1, 7); R('#ffffff', 10, 6, 1, 5); }
      if (id === 'fish_golden') { R('#ffffff', 1, 2, 1, 1); R('#ffffff', 13, 2, 1, 1); R('#fff3a3', 6, 8, 3, 1); }
      if (id === 'fish_trout') { R('#e88a8a', 4, 9, 7, 1); R('#5f7f4a', 6, 6, 1, 1); R('#5f7f4a', 9, 7, 1, 1); }
      if (id === 'fish_salmon') { R('#ffcab5', 4, 9, 7, 1); }
      return;
    }
    switch (id) {
      case 'hoe': for (let i = 0; i < 10; i++) R('#a8743f', 3 + i, 14 - i, 2, 1); R('#9aa7b0', 9, 2, 6, 3); R('#c4ced6', 9, 2, 6, 1); break;
      case 'can': case 'can_gold': {
        const [a, d, l] = id === 'can' ? ['#6ec6ff', '#4a9fd6', '#bfe9ff'] : ['#f2c230', '#d9a81c', '#fff3a3'];
        R(a, 3, 7, 9, 7); R(d, 3, 13, 9, 1); R(a, 12, 8, 3, 2); R(a, 14, 6, 1, 2); R(d, 5, 4, 5, 1); R(d, 5, 4, 1, 3); R(d, 9, 4, 1, 3); R(l, 5, 8, 3, 2);
        break;
      }
      case 'rod': case 'rod_gold':
        for (let i = 0; i < 11; i++) R(id === 'rod' ? '#a8743f' : '#f2c230', 2 + i, 14 - i, 1, 1);
        R('#ffffff', 13, 3, 1, 9); R('#e85d5d', 12, 11, 3, 2);
        if (id === 'rod_gold') { R('#fff3a3', 3, 13, 1, 1); R('#fff3a3', 7, 9, 1, 1); }
        break;
      case 'wood': R('#a8743f', 2, 5, 12, 7); R('#8b5a3c', 2, 8, 12, 1); R('#e2b07c', 11, 5, 3, 7); R('#c9955f', 12, 7, 1, 3); break;
      case 'stone': R('#8e8a85', 3, 5, 10, 8); R('#a8a49e', 4, 4, 8, 6); R('#c4c0ba', 5, 5, 3, 2); break;
      case 'iron': R('#8e8a85', 3, 5, 10, 8); R('#a8a49e', 4, 4, 8, 6); R('#d98c5f', 5, 6, 3, 2); R('#e8a87c', 9, 8, 2, 2); R('#b8693f', 6, 10, 2, 1); break;
      case 'gold': R('#b58a12', 3, 6, 10, 7); R('#f2c230', 4, 5, 8, 6); R('#ffe27a', 5, 6, 3, 2); R('#fff6c9', 5, 6, 1, 1); break;
      case 'gem': R('#7fdcff', 5, 2, 6, 3); R('#b48cff', 3, 5, 10, 3); R('#b48cff', 5, 8, 6, 3); R('#9b6cf0', 7, 11, 2, 2); R('#ffffff', 6, 3, 2, 1); R('#e6d9ff', 4, 5, 2, 1); break;
      case 'mushroom': R('#f5ead6', 6, 8, 4, 6); R('#e85d5d', 2, 3, 12, 6); R('#e85d5d', 4, 2, 8, 1); R('#ffffff', 4, 4, 2, 2); R('#ffffff', 9, 5, 2, 1); R('#ffffff', 7, 3, 1, 1); break;
      case 'berry': R('#4caf50', 6, 2, 4, 2); for (const [bx, by] of [[3, 5], [8, 5], [5, 9], [10, 9]]) { R('#c2185b', bx, by, 4, 4); R('#ff6fa0', bx + 1, by, 1, 1); } break;
      case 'pinecone': R('#8b5a3c', 4, 3, 8, 11); R('#a8743f', 5, 4, 2, 2); R('#a8743f', 9, 4, 2, 2); R('#a8743f', 5, 8, 2, 2); R('#a8743f', 9, 8, 2, 2); R('#a8743f', 7, 11, 2, 2); R('#4caf50', 7, 1, 2, 2); break;
      case 'bow':
        for (let i = 0; i < 6; i++) { R('#a8743f', 3 + Math.round(i * 0.4), 2 + i, 2, 1); R('#a8743f', 3 + Math.round(i * 0.4), 13 - i, 2, 1); }
        R('#ffffff', 4, 2, 1, 12); R('#9aa7b0', 6, 7, 8, 1); R('#e85d5d', 13, 6, 2, 3); R('#ffffff', 5, 6, 2, 3);
        break;
      case 'egg': R('#fff7ec', 5, 3, 6, 10); R('#fff7ec', 4, 5, 8, 7); R('#e8dcc8', 5, 11, 6, 2); R('#ffffff', 6, 5, 2, 2); break;
      case 'milk': R('#6ec6ff', 5, 2, 6, 3); R('#ffffff', 4, 5, 8, 9); R('#6ec6ff', 4, 8, 8, 3); R('#e6e6f0', 4, 13, 8, 1); break;
      case 'wool': R('#f7f4ee', 3, 5, 10, 7); R('#f7f4ee', 5, 3, 6, 11); R('#e6e0d6', 4, 9, 8, 1); R('#ffffff', 6, 5, 3, 2); break;
      case 'meat': R('#e85d5d', 3, 4, 8, 7); R('#ff8080', 4, 5, 4, 2); R('#fff7ec', 10, 9, 4, 2); R('#fff7ec', 13, 8, 2, 4); break;
      case 'hide': R('#a8743f', 3, 3, 10, 10); R('#a8743f', 1, 5, 14, 6); R('#8b5a3c', 5, 6, 6, 4); break;
      case 'potion_s': case 'potion_m': case 'potion_l': {
        const c = { potion_s: '#e85d5d', potion_m: '#ff5c8a', potion_l: '#c0392b' }[id], big = id === 'potion_l' ? 1 : 0;
        R('#c4c0ba', 6, 1, 4, 2); R('#a8743f', 6, 0, 4, 1); R('#dff6ff', 4 - big, 3, 8 + big * 2, 2);
        R('#dff6ff', 3 - big, 5, 10 + big * 2, 9); R(c, 4 - big, 7, 8 + big * 2, 6); R('#ffffff', 5, 6, 2, 2); R(shade(c, -0.25), 4 - big, 12, 8 + big * 2, 1);
        break;
      }
      case 'slime_gel': R('#7ed492', 3, 6, 10, 8); R('#7ed492', 5, 4, 6, 2); R('#b8f0c4', 5, 6, 3, 2); R('#4caf50', 3, 13, 10, 1); break;
      case 'bone': R('#f2ede4', 3, 7, 10, 2); R('#f2ede4', 1, 5, 3, 3); R('#f2ede4', 1, 8, 3, 3); R('#f2ede4', 12, 5, 3, 3); R('#f2ede4', 12, 8, 3, 3); R('#d9d0bf', 4, 8, 8, 1); break;
      case 'ecto': R('#c9f2ff', 4, 3, 8, 9); R('#c9f2ff', 3, 6, 10, 6); R('#ffffff', 5, 5, 2, 2); R('#2b2233', 6, 7, 1, 1); R('#2b2233', 9, 7, 1, 1); R('#9fdcf7', 3, 12, 2, 2); R('#9fdcf7', 7, 12, 2, 2); R('#9fdcf7', 11, 12, 2, 2); break;
      case 'fire_core': R('#ff7a1a', 4, 4, 8, 8); R('#ffb02e', 5, 5, 6, 6); R('#ffe066', 6, 6, 4, 4); R('#ff7a1a', 7, 2, 2, 2); R('#ff7a1a', 7, 12, 2, 2); R('#ff7a1a', 2, 7, 2, 2); R('#ff7a1a', 12, 7, 2, 2); break;
      case 'dragon_scale': R('#c0392b', 3, 3, 10, 10); R('#e74c3c', 4, 4, 8, 4); R('#8a2e1a', 3, 8, 10, 1); R('#8a2e1a', 7, 3, 1, 10); R('#ffd34d', 5, 5, 1, 1); break;
      case 'duck_egg': R('#dff1f6', 5, 3, 6, 10); R('#dff1f6', 4, 5, 8, 7); R('#c3dfe8', 5, 11, 6, 2); R('#ffffff', 6, 5, 2, 2); R('#9fc7d4', 9, 7, 1, 1); break;
      case 'goat_milk': R('#c9a96b', 6, 1, 4, 2); R('#fff7ec', 4, 3, 8, 11); R('#e8d9c6', 4, 8, 8, 2); R('#e6dfd1', 4, 13, 8, 1); break;
      case 'truffle': R('#3b2f2a', 3, 5, 10, 8); R('#5a4a40', 4, 4, 8, 3); R('#2b2220', 5, 9, 2, 1); R('#2b2220', 9, 7, 2, 1); R('#6e5a4c', 5, 5, 2, 1); break;
      case 'boot': R('#7a4e2d', 5, 2, 5, 9); R('#7a4e2d', 5, 10, 9, 4); R('#5a3520', 5, 13, 9, 1); R('#9c6b3f', 6, 3, 3, 1); break;
    }
  }

  // ───────── 캐릭터 ─────────
  // (x, y) = 발 위치. av = 아바타, step: -1 서있음 / 0,1 걷기
  // opt: { held: 손에 든 아이템 id, sit: 앉음, sleep: 눈 감기 }
  function drawBack(R, id, dir, hy, b) {
    const side = dir === 'left' || dir === 'right';
    const fl = dir === 'left' ? 1 : -1;
    switch (id) {
      case 'backpack':
        if (dir === 'up') { R('#e85d5d', -4, -11 + b, 8, 7); R('#b84444', -4, -8 + b, 8, 1); R('#ffd34d', -1, -7 + b, 2, 1); }
        else if (side) R('#e85d5d', fl > 0 ? 4 : -7, -11 + b, 3, 6);
        else { R('#b84444', -5, -10 + b, 1, 4); R('#b84444', 4, -10 + b, 1, 4); }
        break;
      case 'cattail': {
        const c = '#ffb36b';
        if (dir === 'up') { R(c, -1, -6 + b, 2, 2); R(c, 1, -9 + b, 2, 3); R(c, 2, -11 + b, 2, 2); }
        else if (side) { R(c, fl > 0 ? 5 : -7, -6 + b, 2, 2); R(c, fl > 0 ? 6 : -8, -10 + b, 2, 4); }
        break;
      }
      case 'cape':
        if (dir === 'up') { R('#c0392b', -6, -11 + b, 12, 11); R('#e74c3c', -5, -11 + b, 2, 10); R('#ffd34d', -6, -11 + b, 12, 1); }
        else if (side) R('#c0392b', fl > 0 ? 3 : -7, -11 + b, 4, 10);
        else { R('#c0392b', -7, -10 + b, 2, 9); R('#c0392b', 5, -10 + b, 2, 9); }
        break;
      case 'balloon':
        R('#ffffff', fl > 0 ? -7 : 6, -22 + b, 1, 14);
        R('#ff5c8a', fl > 0 ? -10 : 4, -30 + b, 6, 7); R('#ff8fab', fl > 0 ? -9 : 5, -29 + b, 2, 2);
        break;
      case 'guitarback':
        if (dir === 'up') { R('#d9783a', -4, -11 + b, 7, 7); R('#2b1a14', -1, -9 + b, 2, 2); R('#6e4626', 2, -17 + b, 2, 7); }
        else if (side) R('#d9783a', fl > 0 ? 3 : -7, -12 + b, 4, 7);
        else R('#6e4626', 4, -16 + b, 2, 6);
        break;
      case 'jetpack':
        if (dir === 'up') { R('#9aa7b0', -5, -11 + b, 4, 7); R('#9aa7b0', 1, -11 + b, 4, 7); R('#e85d5d', -5, -11 + b, 4, 1); R('#e85d5d', 1, -11 + b, 4, 1); R('#ff9a2e', -4, -4 + b, 2, 2); R('#ff9a2e', 2, -4 + b, 2, 2); }
        else if (side) { R('#9aa7b0', fl > 0 ? 4 : -7, -11 + b, 3, 7); R('#ff9a2e', fl > 0 ? 4 : -7, -4 + b, 3, 2); }
        else { R('#9aa7b0', -7, -10 + b, 2, 6); R('#9aa7b0', 5, -10 + b, 2, 6); }
        break;
      case 'wings': case 'fairy': case 'batwings': {
        const [c, d] = id === 'wings' ? ['#ffffff', '#e6e6f0'] : id === 'fairy' ? ['rgba(190,235,255,0.85)', 'rgba(255,190,240,0.85)'] : ['#4a3b5c', '#2b2233'];
        if (side) { R(c, fl > 0 ? 3 : -8, -15 + b, 5, 7); R(d, fl > 0 ? 4 : -7, -10 + b, 3, 3); break; }
        R(c, -11, -15 + b, 5, 6); R(c, 6, -15 + b, 5, 6); R(d, -10, -9 + b, 4, 3); R(d, 6, -9 + b, 4, 3);
        if (id === 'batwings') { R('#2b2233', -11, -10 + b, 1, 1); R('#2b2233', 10, -10 + b, 1, 1); }
        if (id === 'wings') { R('#e6e6f0', -9, -13 + b, 2, 1); R('#e6e6f0', 7, -13 + b, 2, 1); }
        break;
      }
    }
  }
  function drawHeld(g, x, y, dir, id) {
    if (!id || !S.ITEMS[id]) return;
    const pos = { down: [3, -14], up: [3, -15], left: [-12, -14], right: [3, -14] }[dir] || [3, -14];
    g.save();
    g.translate(x + pos[0], y + pos[1]);
    if (dir === 'left') { g.translate(9.6, 0); g.scale(-1, 1); }
    g.scale(0.6, 0.6);
    drawItem(g, 0, 0, id);
    g.restore();
  }
  function drawChar(g, x, y, av, dir, step, opt) {
    opt = opt || {};
    const R = pen(g, x, y);
    const skin = S.SKINS[av.skin] || S.SKINS[0];
    const hair = S.HAIR_COLORS[av.hc] || S.HAIR_COLORS[0];
    const tc = S.CLOTH[av.tc] || S.CLOTH[0], bc = S.CLOTH[av.bc] || S.CLOTH[8];
    const top = (S.TOPS[av.top] || S.TOPS[0]).id;
    const hs = (S.HAIR_STYLES[av.hs] || S.HAIR_STYLES[0]).id;
    const eyes = opt.sleep ? 'sleepy' : (S.EYES[av.eyes] || S.EYES[0]).id;
    const ink = '#2b2233', shoe = '#3b2f45';
    const b = (step === 0 ? -1 : 0) + (opt.sit ? 3 : 0);
    const side = dir === 'left' || dir === 'right';
    const fl = dir === 'left' ? 1 : -1; // 옆모습일 때 뒤통수 방향 (left 보면 +)
    const hy = -21 + b;

    if (!opt.sit) R('rgba(0,0,0,0.18)', -5, -1, 10, 2);
    if (dir !== 'up' && av.back && av.back !== 'none') drawBack(R, av.back, dir, hy, b);
    if (dir === 'up' && opt.held) drawHeld(g, x, y + b, dir, opt.held);

    // 다리
    const longSkirt = top === 'hanbok' || top === 'royal';
    // 갑옷 (opt.eq = { helmet, chest, legs, boots } → 등급 이름)
    const eq = opt.eq || {};
    const AC = (part) => eq[part] && S.ARMOR_TIERS[eq[part]] ? S.ARMOR_TIERS[eq[part]].col : null;
    const legArmor = AC('legs'), bootArmor = AC('boots');
    const leg = legArmor || (top === 'dress' ? skin : (top === 'overalls' ? tc : longSkirt ? bc : bc));
    const L = (lx, ly, h) => {
      R(leg, lx, ly, 3, h);
      if (legArmor) R(shade(legArmor, 0.3), lx, ly, 1, h);
      if (bootArmor) { R(bootArmor, lx, ly + h - 2, 3, 2); R(shade(bootArmor, -0.3), lx, ly + h - 1, 3, 1); }
      else R(shoe, lx, ly + h - 1, 3, 1);
    };
    if (opt.sit) { L(-4, -2, 2); L(1, -2, 2); }
    else if (step === -1) { L(-4, -4, 4); L(1, -4, 4); }
    else if (step === 0) { L(-4, -5, 5); L(1, -4, 3); }
    else { L(-4, -4, 3); L(1, -5, 5); }

    // 몸통
    const tcd = shade(tc, -0.2);
    switch (top) {
      case 'overalls':
        R('#ffffff', -5, -10 + b, 10, 6); R(tc, -4, -8 + b, 8, 4); R(tc, -4, -10 + b, 1, 2); R(tc, 3, -10 + b, 1, 2);
        R('#ffd34d', -3, -8 + b, 1, 1); R('#ffd34d', 2, -8 + b, 1, 1);
        break;
      case 'dress':
        R(tc, -5, -10 + b, 10, 5); R(tc, -6, -5 + b, 12, 3); R(tcd, -6, -3 + b, 12, 1); R(shade(tc, 0.3), -1, -10 + b, 2, 1);
        break;
      case 'royal':
        R(tc, -5, -10 + b, 10, 5); R(tc, -6, -5 + b, 12, 5); R('#ffd34d', -6, -1 + b, 12, 1); R('#ffd34d', -5, -6 + b, 10, 1); R('#ffffff', -1, -10 + b, 2, 1); R('#ffd34d', -1, -8 + b, 2, 1);
        break;
      case 'hanbok':
        R(tc, -5, -10 + b, 10, 4); R('#ffffff', -2, -10 + b, 4, 1); R('#e85d5d', -1, -8 + b, 2, 3); R(bc, -6, -6 + b, 12, 6); R(shade(bc, -0.2), -6, -1 + b, 12, 1);
        break;
      case 'shirt':
        R(tc, -5, -10 + b, 10, 6); R(tcd, -5, -5 + b, 10, 1); R('#ffffff', -2, -10 + b, 1, 1); R('#ffffff', 1, -10 + b, 1, 1); R(tcd, 0, -9 + b, 1, 4);
        break;
      case 'suit':
        R(tc, -5, -10 + b, 10, 6); R('#ffffff', -1, -10 + b, 2, 4); R('#e85d5d', 0, -9 + b, 1, 3); R(tcd, -5, -5 + b, 10, 1);
        break;
      case 'sailor':
        R('#ffffff', -5, -10 + b, 10, 6); R(tc, -5, -10 + b, 10, 1); R(tc, -3, -9 + b, 6, 1); R('#e85d5d', -1, -8 + b, 2, 2); R(tc, -5, -5 + b, 10, 1);
        break;
      case 'startee':
        R(tc, -5, -10 + b, 10, 6); R(tcd, -5, -5 + b, 10, 1); R('#ffd34d', -1, -9 + b, 2, 3); R('#ffd34d', -2, -8 + b, 4, 1);
        break;
      case 'chefcoat':
        R('#ffffff', -5, -10 + b, 10, 6); R('#e6e6f0', -5, -5 + b, 10, 1); R(ink, -2, -9 + b, 1, 1); R(ink, -2, -7 + b, 1, 1); R(ink, 1, -9 + b, 1, 1); R(ink, 1, -7 + b, 1, 1);
        break;
      case 'pajama':
        R(tc, -5, -10 + b, 10, 6); R('#ffffff', -4, -9 + b, 1, 1); R('#ffffff', 2, -7 + b, 1, 1); R('#ffffff', -1, -6 + b, 1, 1); R('#ffffff', 3, -10 + b, 1, 1); R(tcd, -5, -5 + b, 10, 1);
        break;
      case 'jersey':
        R(tc, -5, -10 + b, 10, 6); R('#ffffff', -5, -10 + b, 1, 6); R('#ffffff', 4, -10 + b, 1, 6); R('#ffffff', -1, -10 + b, 2, 1); R(tcd, -5, -5 + b, 10, 1);
        break;
      case 'raincoat':
        R('#ffd34d', -6, -10 + b, 12, 7); R('#e8b923', -6, -4 + b, 12, 1); R('#e8b923', 0, -10 + b, 1, 6); R('#ffffff', -2, -8 + b, 1, 1); R('#ffffff', 2, -8 + b, 1, 1);
        break;
      case 'pirate':
        R('#ffffff', -5, -10 + b, 10, 6); R('#e85d5d', -5, -9 + b, 10, 1); R('#e85d5d', -5, -7 + b, 10, 1); R('#3b2f45', -5, -5 + b, 10, 1); R('#ffd34d', -1, -5 + b, 2, 1);
        R('#2b2233', -6, -10 + b, 2, 5); R('#2b2233', 4, -10 + b, 2, 5);
        break;
      case 'armor':
        R('#b8c2ca', -5, -10 + b, 10, 6); R('#d6dde3', -4, -10 + b, 3, 2); R('#8e98a0', -5, -6 + b, 10, 1); R(tc, -1, -9 + b, 2, 3); R('#ffd34d', -5, -5 + b, 10, 1);
        break;
      default:
        R(tc, -5, -10 + b, 10, 6); R(tcd, -5, -5 + b, 10, 1);
        if (top === 'stripe') { R('#ffffff', -5, -8 + b, 10, 1); R('#ffffff', -5, -6 + b, 10, 1); }
        if (top === 'hoodie') { R(tcd, -3, -7 + b, 6, 2); R('#ffffff', -2, -10 + b, 1, 2); R('#ffffff', 1, -10 + b, 1, 2); }
    }
    // 팔
    const sleeve = ['hoodie', 'suit', 'armor', 'chefcoat', 'hanbok', 'pajama', 'jersey', 'raincoat'].includes(top);
    const arm = sleeve ? (top === 'armor' ? '#b8c2ca' : top === 'chefcoat' ? '#ffffff' : top === 'raincoat' ? '#ffd34d' : tc) : skin;
    R(arm, -6, -9 + b, 1, 4); R(arm, 5, -9 + b, 1, 4);
    if (sleeve) { R(skin, -6, -6 + b, 1, 1); R(skin, 5, -6 + b, 1, 1); }
    const chestArmor = AC('chest');
    if (chestArmor) {
      R(chestArmor, -5, -10 + b, 10, 6); R(shade(chestArmor, 0.35), -4, -10 + b, 3, 1); R(shade(chestArmor, -0.3), -5, -5 + b, 10, 1);
      R(shade(chestArmor, -0.2), -7, -10 + b, 2, 3); R(shade(chestArmor, -0.2), 5, -10 + b, 2, 3);
      if (dir !== 'up') R(shade(chestArmor, -0.2), -1, -9 + b, 2, 3);
    }

    // 머리 (얼굴)
    R(skin, -6, hy + 1, 12, 10); R(skin, -5, hy, 10, 12);

    // 머리카락
    R(hair, -6, hy, 12, 3); R(hair, -5, hy - 1, 10, 1);
    const back = fl > 0 ? 2 : -6;
    if (dir === 'up') {
      R(hair, -6, hy, 12, 10); R(hair, -5, hy + 10, 10, 1);
      if (hs === 'long') { R(hair, -7, hy + 1, 14, 13); }
      if (hs === 'bob') { R(hair, -7, hy + 1, 14, 9); }
      if (hs === 'pony') { R(hair, -1, hy + 10, 3, 5); R('#ff5c8a', -1, hy + 9, 3, 1); }
    } else if (side) {
      R(hair, back, hy, 4, 8);
      if (hs === 'long') R(hair, fl > 0 ? 2 : -7, hy, 5, 14);
      if (hs === 'bob') { R(hair, fl > 0 ? 2 : -7, hy, 5, 10); R(hair, fl > 0 ? -6 : -2, hy + 2, 8, 2); }
      if (hs === 'pony') { R(hair, fl > 0 ? 6 : -9, hy + 2, 3, 8); R('#ff5c8a', fl > 0 ? 5 : -7, hy + 2, 2, 2); }
      if (hs !== 'bob') R(hair, fl > 0 ? -6 : 3, hy + 2, 3, 1);
    } else {
      if (hs === 'long') { R(hair, -7, hy + 1, 2, 12); R(hair, 5, hy + 1, 2, 12); R(hair, -5, hy + 3, 4, 1); R(hair, 2, hy + 3, 3, 1); }
      else if (hs === 'bob') { R(hair, -7, hy + 1, 2, 9); R(hair, 5, hy + 1, 2, 9); R(hair, -6, hy + 3, 12, 2); }
      else { R(hair, -6, hy + 3, 1, 3); R(hair, 5, hy + 3, 1, 3); R(hair, -3, hy + 3, 4, 1); }
      if (hs === 'pony') { R(hair, 6, hy + 1, 2, 7); }
    }
    if (hs === 'curly') {
      for (const [cx, cy] of [[-7, hy], [-7, hy + 3], [5, hy], [5, hy + 3], [-4, hy - 2], [0, hy - 2], [3, hy - 2]]) R(hair, cx, cy, 3, 3);
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
    const front = dir !== 'up';
    switch (av.acc) {
      case 'ribbon': R('#ff5c8a', 1, hy - 2, 2, 3); R('#ff5c8a', 5, hy - 2, 2, 3); R('#d63d6c', 3, hy - 1, 2, 1); break;
      case 'flower': R('#ffb3c7', 2, hy - 1, 3, 1); R('#ffb3c7', 3, hy - 2, 1, 3); R('#fff3a3', 3, hy - 1, 1, 1); break;
      case 'glasses': case 'sunglasses': {
        const sun = av.acc === 'sunglasses';
        if (dir === 'down') {
          if (sun) { R(ink, -6, hy + 5, 12, 1); R(ink, -5, hy + 5, 4, 3); R(ink, 1, hy + 5, 4, 3); R('#6f6b78', -4, hy + 6, 1, 1); R('#6f6b78', 2, hy + 6, 1, 1); }
          else { R(ink, -5, hy + 5, 4, 1); R(ink, -5, hy + 8, 4, 1); R(ink, -5, hy + 5, 1, 4); R(ink, -2, hy + 5, 1, 4); R(ink, 1, hy + 5, 4, 1); R(ink, 1, hy + 8, 4, 1); R(ink, 1, hy + 5, 1, 4); R(ink, 4, hy + 5, 1, 4); R(ink, -1, hy + 6, 2, 1); }
        } else if (side) { const gx = fl > 0 ? -6 : 1; R(ink, gx, hy + 5, 5, 1); if (sun) R(ink, gx + (fl > 0 ? 0 : 1), hy + 5, 4, 3); else { R(ink, gx, hy + 8, 5, 1); R(ink, gx + (fl > 0 ? 0 : 4), hy + 5, 1, 4); } }
        break;
      }
      case 'cap':
        R('#e85d5d', -6, hy - 2, 12, 4); R('#ff8080', -4, hy - 2, 4, 1);
        if (dir === 'down') R('#b84444', -6, hy + 2, 12, 1);
        else if (dir === 'left') R('#b84444', -9, hy + 1, 5, 1);
        else if (dir === 'right') R('#b84444', 4, hy + 1, 5, 1);
        break;
      case 'beanie': R('#6ec6ff', -6, hy - 3, 12, 5); R('#4a9fd6', -6, hy + 1, 12, 1); R('#ffffff', -1, hy - 5, 2, 2); break;
      case 'beret': R('#e85d5d', -7, hy - 3, 11, 3); R('#b84444', -7, hy - 1, 11, 1); R('#b84444', -1, hy - 4, 1, 1); break;
      case 'headphones':
        R('#3b3740', -6, hy - 2, 12, 1); R('#3b3740', -7, hy - 1, 1, 3);  R('#3b3740', 6, hy - 1, 1, 3);
        if (front) { R('#ff8fab', -8, hy + 3, 3, 4); R('#ff8fab', 5, hy + 3, 3, 4); } else { R('#ff8fab', -8, hy + 3, 3, 4); R('#ff8fab', 5, hy + 3, 3, 4); }
        break;
      case 'frog':
        R('#7ed492', -6, hy - 3, 12, 5); R('#5fb35f', -6, hy + 1, 12, 1);
        R('#7ed492', -6, hy - 6, 4, 3); R('#7ed492', 2, hy - 6, 4, 3);
        if (front) { R('#ffffff', -5, hy - 5, 2, 2); R('#ffffff', 3, hy - 5, 2, 2); R(ink, -4, hy - 4, 1, 1); R(ink, 4, hy - 4, 1, 1); }
        break;
      case 'catears': {
        const c = av.hc === 3 || av.hc === 6 ? '#ffb36b' : hair;
        R(c, -6, hy - 3, 3, 3); R(c, 3, hy - 3, 3, 3); R(c, -5, hy - 4, 1, 1); R(c, 4, hy - 4, 1, 1);
        if (front) { R('#ffadc0', -5, hy - 2, 1, 1); R('#ffadc0', 4, hy - 2, 1, 1); }
        break;
      }
      case 'bunny':
        R('#ffffff', -5, hy - 7, 3, 7); R('#ffffff', 2, hy - 7, 3, 7);
        if (front) { R('#ffadc0', -4, hy - 6, 1, 5); R('#ffadc0', 3, hy - 6, 1, 5); }
        break;
      case 'crown':
        R('#ffd34d', -4, hy - 3, 8, 2); R('#ffd34d', -4, hy - 5, 1, 2); R('#ffd34d', -1, hy - 6, 2, 3); R('#ffd34d', 3, hy - 5, 1, 2);
        R('#ff5c8a', -1, hy - 3, 2, 1); R('#6ec6ff', -3, hy - 3, 1, 1); R('#6ec6ff', 2, hy - 3, 1, 1);
        break;
      case 'tiara':
        R('#e6e6f0', -4, hy - 2, 8, 1); R('#e6e6f0', -1, hy - 4, 2, 2); R('#e6e6f0', -3, hy - 3, 1, 1); R('#e6e6f0', 2, hy - 3, 1, 1); R('#ff8fab', -1, hy - 3, 2, 1);
        break;
      case 'chef':
        R('#ffffff', -5, hy - 7, 10, 7); R('#ffffff', -6, hy - 6, 12, 3); R('#e6e6f0', -5, hy - 1, 10, 1); R('#e6e6f0', -2, hy - 5, 1, 3);
        break;
      case 'strawhat':
        R('#e8c76b', -9, hy, 18, 2); R('#f2d68a', -5, hy - 3, 10, 3); R('#e85d5d', -5, hy - 1, 10, 1);
        break;
      case 'fishhat':
        R('#6ec6ff', -6, hy - 4, 10, 4); R('#6ec6ff', 4, hy - 5, 3, 6); R('#4a9fd6', 4, hy - 3, 1, 2); R('#ffffff', -4, hy - 3, 2, 2); R(ink, -4, hy - 3, 1, 1); R('#bfe9ff', -2, hy - 4, 4, 1);
        break;
      case 'flowercrown':
        for (let i = -6; i <= 4; i += 3) { R(['#ff8fab', '#ffd34d', '#ffffff', '#c9a0ff'][((i + 6) / 3) % 4], i, hy - 2, 2, 2); }
        R('#5fb35f', -6, hy, 12, 1);
        break;
      case 'horns':
        R('#e85d5d', -6, hy - 3, 2, 3); R('#e85d5d', 4, hy - 3, 2, 3); R('#e85d5d', -7, hy - 4, 1, 1); R('#e85d5d', 6, hy - 4, 1, 1);
        break;
      case 'halo':
        R('#ffe066', -4, hy - 6, 8, 1); R('#ffe066', -5, hy - 5, 1, 1); R('#ffe066', 4, hy - 5, 1, 1); R('#ffe066', -4, hy - 4, 8, 1);
        break;
      case 'witch':
        R('#4a3b5c', -9, hy, 18, 2); R('#4a3b5c', -5, hy - 4, 10, 4); R('#4a3b5c', -3, hy - 7, 6, 3); R('#4a3b5c', -1, hy - 9, 3, 2); R('#4a3b5c', 1, hy - 10, 3, 1);
        R('#9b8cff', -5, hy - 1, 10, 1); R('#ffd34d', -1, hy - 1, 2, 1);
        break;
      case 'bearears':
        R('#8b5a3c', -7, hy - 3, 4, 4); R('#8b5a3c', 3, hy - 3, 4, 4);
        if (front) { R('#c98a5a', -6, hy - 2, 2, 2); R('#c98a5a', 4, hy - 2, 2, 2); }
        break;
      case 'partyhat':
        R('#9b8cff', -3, hy - 3, 6, 3); R('#9b8cff', -2, hy - 6, 4, 3); R('#9b8cff', -1, hy - 8, 2, 2); R('#ffd34d', -3, hy - 2, 6, 1); R('#ff8fab', -1, hy - 10, 2, 2);
        R('#ffffff', -1, hy - 5, 1, 1); R('#ffffff', 1, hy - 3, 1, 1);
        break;
      case 'starpin': R('#ffd34d', 3, hy - 1, 3, 1); R('#ffd34d', 4, hy - 2, 1, 3); break;
      case 'piratehat':
        R('#2b2233', -8, hy - 1, 16, 2); R('#2b2233', -5, hy - 5, 10, 4); R('#2b2233', -3, hy - 6, 6, 1); R('#ffffff', -1, hy - 4, 2, 2); R('#ffd34d', -5, hy, 10, 1);
        if (dir === 'down') R('#2b2233', 2, hy + 5, 3, 3);
        break;
      case 'santa':
        R('#e85d5d', -6, hy - 4, 12, 4); R('#e85d5d', -3, hy - 6, 7, 2); R('#e85d5d', 3, hy - 5, 3, 3); R('#ffffff', -7, hy - 1, 14, 2); R('#ffffff', 5, hy - 3, 3, 3);
        break;
    }
    const helmArmor = AC('helmet');
    if (helmArmor) {
      const d = shade(helmArmor, -0.3), l = shade(helmArmor, 0.35);
      R(helmArmor, -7, hy - 2, 14, 6); R(l, -5, hy - 2, 5, 1);
      if (dir === 'up') R(helmArmor, -7, hy + 3, 14, 6);
      else if (side) R(helmArmor, fl > 0 ? 1 : -7, hy + 3, 6, 6);
      else { R(helmArmor, -7, hy + 3, 2, 6); R(helmArmor, 5, hy + 3, 2, 6); R(d, -1, hy + 3, 2, 3); }
      R(d, -7, hy + 3, 14, 1);
    }
    if (dir === 'up' && av.back && av.back !== 'none') drawBack(R, av.back, dir, hy, b);
    if (dir !== 'up' && opt.held) drawHeld(g, x, y + b, dir, opt.held);
  }

  // ───────── 몬스터 ─────────
  // (x, y) = 발 위치. 보스는 2배 크기
  function drawMob(g, x, y, kind, dir, step, t) {
    const def = S.MOBS[kind];
    const sc = def && def.boss ? 2 : 1;
    g.save();
    g.translate(x, y);
    if (sc !== 1) g.scale(sc, sc);
    if (dir === 'left') g.scale(-1, 1);
    const R = (c, rx, ry, w, h) => { g.fillStyle = c; g.fillRect(rx, ry, w, h); };
    const f = Math.floor((t || 0) / 180) % 2, b = step === -1 ? 0 : (f ? -1 : 0);
    R('rgba(0,0,0,0.2)', -6, -1, 12, 2);
    switch (kind) {
      case 'slime': case 'king_slime': {
        const c = kind === 'slime' ? '#7ed492' : '#6ec6ff', h = f ? 7 : 8;
        R(c, -6, -h, 12, h); R(c, -4, -h - 2, 8, 2); R(shade(c, 0.4), -4, -h, 3, 2); R(shade(c, -0.25), -6, -1, 12, 1);
        R('#2b2233', -3, -h + 3, 2, 2); R('#2b2233', 2, -h + 3, 2, 2); R('#ffffff', -3, -h + 3, 1, 1); R('#ffffff', 2, -h + 3, 1, 1);
        if (kind === 'king_slime') { R('#ffd34d', -4, -h - 5, 8, 3); R('#ffd34d', -4, -h - 7, 1, 2); R('#ffd34d', -1, -h - 8, 2, 3); R('#ffd34d', 3, -h - 7, 1, 2); R('#e85d5d', -1, -h - 4, 2, 1); }
        break;
      }
      case 'bat':
        R('#4a3b5c', -2, -14 + b, 5, 5); R(f ? '#3b3740' : '#4a3b5c', -8, -15 + b + (f ? 2 : 0), 6, 3); R(f ? '#3b3740' : '#4a3b5c', 3, -15 + b + (f ? 2 : 0), 6, 3);
        R('#ff5c5c', -1, -12 + b, 1, 1); R('#ff5c5c', 1, -12 + b, 1, 1); R('#ffffff', 0, -10 + b, 1, 1);
        break;
      case 'skeleton': case 'skeleton_knight': {
        const bone = '#f2ede4', dk = '#3b3740';
        R(bone, -1, -6, 1, 5); R(bone, 1, -6, 1, 5);
        R(bone, -3, -12 + b, 6, 6); R(dk, -2, -11 + b, 1, 4); R(dk, 1, -11 + b, 1, 4); R(bone, -5, -11 + b, 1, 4); R(bone, 4, -11 + b, 1, 4);
        R(bone, -3, -18 + b, 6, 6); R(dk, -2, -16 + b, 2, 2); R(dk, 1, -16 + b, 2, 2); R(dk, -1, -13 + b, 3, 1);
        R('#9aa7b0', 5, -16 + b, 1, 8);
        if (kind === 'skeleton_knight') { R('#6f6b78', -4, -19 + b, 8, 3); R('#e85d5d', -1, -21 + b, 2, 2); R('#6f6b78', -4, -12 + b, 8, 5); R('#c4ced6', 5, -20 + b, 2, 12); }
        break;
      }
      case 'ghost':
        R('rgba(201,242,255,0.85)', -5, -16 + b, 10, 12); R('rgba(201,242,255,0.85)', -4, -18 + b, 8, 2);
        for (let i = 0; i < 3; i++) R('rgba(201,242,255,0.85)', -5 + i * 4, -4 + b + ((i + f) % 2), 2, 2);
        R('#2b2233', -3, -14 + b, 2, 3); R('#2b2233', 1, -14 + b, 2, 3); R('#2b2233', -1, -9 + b, 2, 2);
        break;
      case 'golem':
        R('#7a7380', -7, -16 + b, 14, 15); R('#938c9a', -6, -16 + b, 6, 3); R('#5c5562', -7, -2, 14, 1);
        R('#7a7380', -10, -13 + b, 3, 8); R('#7a7380', 7, -13 + b, 3, 8); R('#7fdcff', -4, -12 + b, 2, 2); R('#7fdcff', 2, -12 + b, 2, 2);
        R('#5c5562', -2, -8 + b, 4, 1); R('#b48cff', -1, -5 + b, 2, 2);
        break;
      case 'imp':
        R('#e8502a', -3, -11 + b, 7, 8); R('#e8502a', -4, -16 + b, 8, 6); R('#8a2e1a', -4, -18 + b, 2, 2); R('#8a2e1a', 3, -18 + b, 2, 2);
        R('#ffe066', -2, -14 + b, 1, 1); R('#ffe066', 2, -14 + b, 1, 1); R('#8a2e1a', -1, -12 + b, 3, 1);
        R('#ffb02e', -8, -12 + b + (f ? 1 : 0), 4, 3); R('#ffb02e', 5, -12 + b + (f ? 1 : 0), 4, 3); R('#8a2e1a', 4, -6 + b, 4, 1);
        break;
      case 'dragon':
        R('#c0392b', -9, -12 + b, 16, 9); R('#e74c3c', -8, -12 + b, 14, 2); R('#ffb36b', -6, -6 + b, 10, 2);
        R('#c0392b', 5, -18 + b, 7, 7); R('#ffe066', 9, -16 + b, 1, 1); R('#8a2e1a', 11, -13 + b, 2, 1); R('#e8d3a8', 6, -20 + b, 1, 2); R('#e8d3a8', 9, -20 + b, 1, 2);
        R('#8a2e1a', -6, -20 + b + (f ? 2 : 0), 8, 6); R('#a93226', -5, -19 + b + (f ? 2 : 0), 6, 4);
        R('#c0392b', -13, -8 + b, 4, 3); R('#c0392b', -15, -10 + b, 3, 3);
        R('#8a2e1a', -7, -3, 3, 3); R('#8a2e1a', 2, -3, 3, 3);
        break;
    }
    g.restore();
  }

  window.DRAW = { shade, drawTile, drawItem, drawItemRot, drawTop, drawChar, drawAnimal, drawMob, drawGround, drawObject, drawAnim, hasAnim, lightOf, pen };
})();
