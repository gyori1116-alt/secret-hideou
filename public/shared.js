// 비밀 아지트 - 서버와 화면이 함께 쓰는 게임 데이터 (아이템, 블록, 작물, 퀘스트, 아바타, 맵 생성)
(function (root) {
  'use strict';

  const TILE = 16;
  const W = 64, H = 48;               // 맵 크기 (타일 수)
  const WORLD_VERSION = 3;
  const REACH = 3.6 * TILE;           // 손이 닿는 거리
  const BITE_WINDOW = 1200;           // 찌가 흔들린 뒤 당길 수 있는 시간(ms)
  const SAPLING_MS = 60000;           // 묘목이 나무가 되는 시간
  const SPAWN = { x: 31.5 * TILE, y: 19.5 * TILE };

  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ───────── 아이템 ─────────
  // tool: 도구 / seed: 심을 작물 / ground: 바닥에 까는 블록 / obj: 세우는 블록·가구 / sell: 상점 판매가
  const ITEMS = {
    hoe: { name: '괭이', tool: 'hoe', stack: 1, desc: '풀밭을 바라보고 Space → 밭이 돼요' },
    can: { name: '물뿌리개', tool: 'can', stack: 1, desc: '심은 작물에 Space → 물을 줘요' },
    rod: { name: '낚싯대', tool: 'rod', stack: 1, desc: '물을 보고 Space, 찌에 ❗가 뜨면 다시 Space!' },
    bow: { name: '활', tool: 'bow', stack: 1, desc: 'Space로 화살 발사! (마우스 쪽 또는 바라보는 쪽) 야생 동물 사냥' },

    animal_chicken: { name: '닭', animal: 'chicken', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 달걀을 낳아요' },
    animal_cow: { name: '소', animal: 'cow', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 우유를 줘요' },
    animal_sheep: { name: '양', animal: 'sheep', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 양털을 줘요' },
    egg: { name: '달걀', sell: 25, desc: '닭이 낳은 달걀' },
    milk: { name: '우유', sell: 45, desc: '신선한 우유' },
    wool: { name: '양털', sell: 55, desc: '포근한 양털' },
    meat: { name: '고기', sell: 30, desc: '사냥으로 얻어요' },
    hide: { name: '가죽', sell: 25, desc: '멧돼지를 사냥하면 얻어요' },

    wood: { name: '나무', sell: 2, desc: '나무를 X로 베면 얻어요. 만들기 재료' },
    stone: { name: '돌', sell: 3, desc: '바위를 X로 깨면 얻어요. 만들기 재료' },

    seed_carrot: { name: '당근 씨앗', seed: 'carrot', sell: 2, desc: '밭에 심어요 (빨리 자라요)' },
    seed_straw: { name: '딸기 씨앗', seed: 'strawberry', sell: 4, desc: '밭에 심어요 (여러 개 열려요)' },
    seed_sunflower: { name: '해바라기 씨앗', seed: 'sunflower', sell: 6, desc: '밭에 심어요' },
    seed_pumpkin: { name: '호박 씨앗', seed: 'pumpkin', sell: 10, desc: '밭에 심어요 (오래 걸리지만 비싸요)' },
    carrot: { name: '당근', sell: 15, desc: '상점에 팔 수 있어요' },
    strawberry: { name: '딸기', sell: 12, desc: '상점에 팔 수 있어요' },
    sunflower: { name: '해바라기', sell: 35, desc: '상점에 팔 수 있어요' },
    pumpkin: { name: '호박', sell: 70, desc: '상점에 팔 수 있어요' },

    fish_minnow: { name: '송사리', fish: 1, sell: 12, desc: '작고 귀여운 물고기' },
    fish_crucian: { name: '붕어', fish: 1, sell: 20, desc: '흔한 물고기' },
    fish_tropical: { name: '열대어', fish: 1, sell: 45, desc: '알록달록!' },
    fish_puffer: { name: '복어', fish: 1, sell: 70, desc: '뾰족뾰족' },
    fish_golden: { name: '황금잉어', fish: 1, sell: 250, desc: '전설의 물고기 ✨' },
    boot: { name: '낡은 장화', sell: 1, desc: '...누가 버렸지?' },

    path: { name: '흙길', ground: 'path', cat: 'path', desc: '바닥에 까는 길' },
    stone_path: { name: '돌길', ground: 'stone_path', cat: 'path', desc: '바닥에 까는 길' },
    brick_path: { name: '벽돌길', ground: 'brick_path', cat: 'path', desc: '바닥에 까는 길' },
    sand: { name: '모래', ground: 'sand', cat: 'path', desc: '바닥에 까는 모래' },
    floor_wood: { name: '나무 바닥', ground: 'floor_wood', cat: 'floor', desc: '집 바닥' },
    floor_pink: { name: '분홍 타일', ground: 'floor_pink', cat: 'floor', desc: '집 바닥' },
    floor_check: { name: '체크 타일', ground: 'floor_check', cat: 'floor', desc: '집 바닥' },
    rug: { name: '러그', ground: 'rug', cat: 'floor', desc: '이어서 깔면 큰 러그가 돼요' },

    wall_wood: { name: '나무 벽', obj: 'wall_wood', cat: 'wall', desc: '집을 짓는 벽' },
    wall_stone: { name: '돌 벽', obj: 'wall_stone', cat: 'wall', desc: '집을 짓는 벽' },
    wall_brick: { name: '벽돌 벽', obj: 'wall_brick', cat: 'wall', desc: '집을 짓는 벽' },
    wall_white: { name: '하얀 벽', obj: 'wall_white', cat: 'wall', desc: '집을 짓는 벽' },
    window: { name: '창문', obj: 'window', cat: 'wall', desc: '벽 대신 끼우는 창문' },
    door: { name: '문', obj: 'door', cat: 'wall', desc: 'E로 열고 닫아요' },
    fence: { name: '울타리', obj: 'fence', cat: 'deco', desc: '이어서 놓으면 연결돼요' },
    sign: { name: '표지판', obj: 'sign', cat: 'sign', desc: '세우고 글씨를 쓸 수 있어요' },
    lamp: { name: '가로등', obj: 'lamp', cat: 'deco', desc: '길가에 세워요' },
    flower: { name: '꽃', obj: 'flower', cat: 'deco', sell: 1, desc: '어디든 심어요' },
    sapling: { name: '묘목', obj: 'sapling', cat: 'deco', desc: '1분 뒤 나무가 돼요' },
    table: { name: '테이블', obj: 'table', cat: 'furniture', desc: '나란히 놓으면 이어져요' },
    chair: { name: '의자', obj: 'chair', cat: 'furniture', desc: '가구' },
    sofa: { name: '소파', obj: 'sofa', cat: 'furniture', desc: '나란히 놓으면 이어져요' },
    bed: { name: '침대', obj: 'bed', cat: 'furniture', desc: '가구' },
    shelf: { name: '책장', obj: 'shelf', cat: 'furniture', desc: '가구' },
    plant: { name: '화분', obj: 'plant', cat: 'furniture', desc: '가구' },
    teddy: { name: '곰인형', obj: 'teddy', cat: 'furniture', desc: '폭신폭신' },
  };
  for (const id in ITEMS) {
    if (!ITEMS[id].stack) ITEMS[id].stack = 99;
    ITEMS[id].id = id;
  }

  // ───────── 바닥 / 블록 ─────────
  const GROUND = {
    grass: {}, water: { solid: 1 }, farm: {},
  };
  const OBJ = {
    tree: { solid: 1, drop: { wood: 3 }, regrow: 'stump', regrowMs: 90000 },
    stump: { solid: 0 },
    rock: { solid: 1, drop: { stone: 2 }, regrow: 'pebble', regrowMs: 120000 },
    pebble: { solid: 0 },
    crop: { solid: 0 },
    shop: { solid: 1, fixed: 1 },
    board: { solid: 1, fixed: 1 },
    wall_wood: { solid: 1, wall: 1 }, wall_stone: { solid: 1, wall: 1 }, wall_brick: { solid: 1, wall: 1 },
    wall_white: { solid: 1, wall: 1 }, window: { solid: 1, wall: 1 }, door: { solid: 1, wall: 1 },
    fence: { solid: 1 }, sign: { solid: 1 }, lamp: { solid: 1 }, flower: { solid: 0 }, sapling: { solid: 0 },
    table: { solid: 1 }, chair: { solid: 0 }, sofa: { solid: 1 }, bed: { solid: 1 }, shelf: { solid: 1 },
    plant: { solid: 1 }, teddy: { solid: 1 },
  };
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.ground) GROUND[it.ground] = Object.assign(GROUND[it.ground] || {}, { item: id });
    if (it.obj) OBJ[it.obj] = Object.assign(OBJ[it.obj] || {}, { item: id });
  }
  const isSolidObj = (o) => !!o && !!(OBJ[o.t] && OBJ[o.t].solid) && !(o.t === 'door' && o.open);

  // ───────── 작물 ─────────
  // 물을 주면 stageMs 뒤에 한 단계 자라고, 다시 물이 필요해요 (0 씨앗 → 3 다 자람)
  const CROPS = {
    carrot: { name: '당근', seed: 'seed_carrot', produce: 'carrot', stageMs: 15000, yield: [1, 2] },
    strawberry: { name: '딸기', seed: 'seed_straw', produce: 'strawberry', stageMs: 22000, yield: [2, 3] },
    sunflower: { name: '해바라기', seed: 'seed_sunflower', produce: 'sunflower', stageMs: 28000, yield: [1, 2] },
    pumpkin: { name: '호박', seed: 'seed_pumpkin', produce: 'pumpkin', stageMs: 40000, yield: [1, 1] },
  };

  // ───────── 동물 ─────────
  // 집동물: 작물(당근·딸기·해바라기·호박)을 먹이면 produceMs 뒤에 선물을 줘요 / 야생동물: 활이나 X로 사냥
  const FEED = ['carrot', 'strawberry', 'sunflower', 'pumpkin'];
  const ANIMALS = {
    chicken: { name: '닭', item: 'animal_chicken', produce: 'egg', produceMs: 30000, speed: 16 },
    cow: { name: '소', item: 'animal_cow', produce: 'milk', produceMs: 45000, speed: 12 },
    sheep: { name: '양', item: 'animal_sheep', produce: 'wool', produceMs: 60000, speed: 14 },
    rabbit: { name: '토끼', wild: 1, hp: 1, drop: { meat: 1 }, speed: 22, flee: 1 },
    boar: { name: '멧돼지', wild: 1, hp: 3, drop: { meat: 2, hide: 1 }, speed: 18 },
  };
  const WILD_SPAWN = { rabbit: 6, boar: 3 };
  const BOW_RANGE = 7 * TILE;

  // ───────── 낚시 ─────────
  const FISH_TABLE = [
    ['fish_minnow', 32], ['fish_crucian', 34], ['fish_tropical', 14], ['fish_puffer', 8], ['boot', 8], ['fish_golden', 4],
  ];
  function rollFish(rand) {
    const total = FISH_TABLE.reduce((s, f) => s + f[1], 0);
    let r = rand() * total;
    for (const [id, w] of FISH_TABLE) { if ((r -= w) < 0) return id; }
    return FISH_TABLE[0][0];
  }

  // ───────── 상점 / 만들기 ─────────
  const SHOP = [
    ['seed_carrot', 5], ['seed_straw', 10], ['seed_sunflower', 15], ['seed_pumpkin', 25],
    ['path', 2], ['sand', 2], ['floor_pink', 3], ['floor_check', 3], ['rug', 6], ['wall_white', 3],
    ['flower', 5], ['sapling', 15], ['plant', 25], ['sofa', 60], ['bed', 80], ['teddy', 100],
    ['animal_chicken', 80], ['animal_sheep', 180], ['animal_cow', 250], ['bow', 120],
  ];
  const RECIPES = [
    { out: 'wall_wood', n: 4, need: { wood: 2 } },
    { out: 'floor_wood', n: 4, need: { wood: 1 } },
    { out: 'fence', n: 4, need: { wood: 2 } },
    { out: 'door', n: 1, need: { wood: 3 } },
    { out: 'sign', n: 1, need: { wood: 2 } },
    { out: 'chair', n: 1, need: { wood: 2 } },
    { out: 'table', n: 1, need: { wood: 4 } },
    { out: 'shelf', n: 1, need: { wood: 5 } },
    { out: 'window', n: 2, need: { wood: 2, stone: 1 } },
    { out: 'wall_stone', n: 4, need: { stone: 2 } },
    { out: 'stone_path', n: 4, need: { stone: 1 } },
    { out: 'wall_brick', n: 4, need: { stone: 2, wood: 1 } },
    { out: 'brick_path', n: 4, need: { stone: 2 } },
    { out: 'lamp', n: 1, need: { wood: 1, stone: 2 } },
  ];

  // ───────── 퀘스트 ─────────
  const QUESTS = [
    { id: 'q_fish1', name: '첫 손맛', desc: '물고기 1마리 낚기', stat: 'fish', goal: 1, reward: { coins: 50 } },
    { id: 'q_farm1', name: '꼬마 농부', desc: '작물 3개 수확하기', stat: 'harvest', goal: 3, reward: { items: { seed_straw: 5 } } },
    { id: 'q_wood', name: '나무꾼', desc: '나무 10개 모으기 (나무 앞에서 X)', stat: 'wood', goal: 10, reward: { coins: 80 } },
    { id: 'q_sign', name: '여긴 내 땅!', desc: '표지판 1개 세우기', stat: 'sign', goal: 1, reward: { items: { flower: 5 } } },
    { id: 'q_path', name: '길을 만들자', desc: '길 블록 15개 깔기', stat: 'pathPlaced', goal: 15, reward: { items: { stone_path: 20 } } },
    { id: 'q_style', name: '멋쟁이', desc: '꾸미기(C)에서 아바타 저장하기', stat: 'avatar', goal: 1, reward: { unlock: 'catears' } },
    { id: 'q_stone', name: '채석장 일꾼', desc: '돌 10개 모으기 (바위 앞에서 X)', stat: 'stone', goal: 10, reward: { items: { lamp: 2 } } },
    { id: 'q_build', name: '내 집 마련', desc: '벽·창문·문 30개 세우기', stat: 'wallPlaced', goal: 30, reward: { items: { door: 1, window: 2, bed: 1 } } },
    { id: 'q_deco', name: '인테리어 디자이너', desc: '가구 10개 놓기', stat: 'furniturePlaced', goal: 10, reward: { coins: 200 } },
    { id: 'q_chat', name: '수다쟁이', desc: '채팅 20번 하기', stat: 'chat', goal: 20, reward: { items: { teddy: 1 } } },
    { id: 'q_sell', name: '장사꾼', desc: '상점에 팔아서 500코인 벌기', stat: 'earned', goal: 500, reward: { items: { sofa: 2 } } },
    { id: 'q_fish15', name: '낚시왕', desc: '물고기 15마리 낚기', stat: 'fish', goal: 15, reward: { unlock: 'crown' } },
    { id: 'q_farm25', name: '풍년이다!', desc: '작물 25개 수확하기', stat: 'harvest', goal: 25, reward: { coins: 500 } },
    { id: 'q_ranch', name: '목장 주인', desc: '동물에게 작물 5번 먹이기', stat: 'feed', goal: 5, reward: { coins: 150 } },
    { id: 'q_produce', name: '신선한 선물', desc: '달걀·우유·양털 5개 모으기', stat: 'produce', goal: 5, reward: { items: { animal_chicken: 1 } } },
    { id: 'q_hunt', name: '사냥꾼', desc: '야생 동물 3마리 사냥하기 (활은 상점에서)', stat: 'hunt', goal: 3, reward: { coins: 200 } },
  ];

  // ───────── 아바타 ─────────
  const SKINS = ['#ffe0c2', '#f6caa0', '#dba578', '#9a6545'];
  const HAIR_STYLES = [
    { id: 'short', name: '짧은 머리' }, { id: 'long', name: '긴 머리' }, { id: 'twin', name: '양갈래' },
    { id: 'bob', name: '단발' }, { id: 'bun', name: '똥머리' }, { id: 'spiky', name: '삐죽 머리' },
  ];
  const HAIR_COLORS = ['#5b3a29', '#2b2233', '#a8643a', '#f2d16b', '#ff9ec4', '#8ab6ff', '#c9c9d3', '#b8e986'];
  const EYES = [
    { id: 'dot', name: '동글' }, { id: 'happy', name: '웃는 눈' }, { id: 'sparkle', name: '반짝' },
    { id: 'sleepy', name: '졸린 눈' }, { id: 'wink', name: '윙크' },
  ];
  const TOPS = [
    { id: 'tshirt', name: '티셔츠' }, { id: 'hoodie', name: '후드티' }, { id: 'stripe', name: '줄무늬' },
    { id: 'dress', name: '원피스' }, { id: 'overalls', name: '멜빵' },
  ];
  const CLOTH = ['#ff8fab', '#ffb36b', '#ffd95e', '#7ed492', '#6ec6ff', '#9b8cff', '#c9a0ff', '#f5f5f5', '#4a3b5c', '#e85d5d', '#8b5a3c', '#555a6e'];
  const ACCESSORIES = [
    { id: 'none', name: '없음' }, { id: 'ribbon', name: '리본' }, { id: 'flower', name: '꽃핀' }, { id: 'glasses', name: '안경' },
    { id: 'cap', name: '모자', price: 150 }, { id: 'bunny', name: '토끼 귀', price: 300 },
    { id: 'catears', name: '고양이 귀', quest: 'q_style' }, { id: 'crown', name: '왕관', quest: 'q_fish15' },
  ];
  const FREE_ACC = ACCESSORIES.filter((a) => !a.price && !a.quest).map((a) => a.id);

  function defaultAvatar(rand) {
    const r = (n) => Math.floor(rand() * n);
    return { skin: 0, hs: r(HAIR_STYLES.length), hc: r(3), eyes: 0, blush: 1, top: 0, tc: r(7), bc: 8, acc: 'none' };
  }
  function sanitizeAvatar(a, unlocked) {
    a = a || {};
    const int = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
    return {
      skin: int(a.skin, SKINS.length, 0), hs: int(a.hs, HAIR_STYLES.length, 0), hc: int(a.hc, HAIR_COLORS.length, 0),
      eyes: int(a.eyes, EYES.length, 0), blush: a.blush ? 1 : 0, top: int(a.top, TOPS.length, 0),
      tc: int(a.tc, CLOTH.length, 0), bc: int(a.bc, CLOTH.length, 8),
      acc: (unlocked || FREE_ACC).includes(a.acc) ? a.acc : 'none',
    };
  }

  // ───────── 가방 (36칸, 앞 9칸 = 단축바) ─────────
  const INV_SIZE = 36;
  function starterInventory() {
    const inv = new Array(INV_SIZE).fill(null);
    [['hoe', 1], ['can', 1], ['rod', 1], ['seed_carrot', 6], ['wood', 12], ['path', 10], ['sign', 1], ['wall_wood', 8], ['floor_wood', 8]]
      .forEach(([id, n], i) => { inv[i] = { id, n }; });
    return inv;
  }
  function countItem(inv, id) { return inv.reduce((s, it) => s + (it && it.id === id ? it.n : 0), 0); }
  function addItem(inv, id, n) {
    const max = (ITEMS[id] && ITEMS[id].stack) || 99;
    for (const it of inv) {
      if (n <= 0) break;
      if (it && it.id === id && it.n < max) { const k = Math.min(n, max - it.n); it.n += k; n -= k; }
    }
    for (let i = 0; i < inv.length && n > 0; i++) {
      if (!inv[i]) { const k = Math.min(n, max); inv[i] = { id, n: k }; n -= k; }
    }
    return n; // 못 넣은 개수
  }
  function removeItem(inv, id, n) {
    if (countItem(inv, id) < n) return false;
    for (let i = inv.length - 1; i >= 0 && n > 0; i--) {
      const it = inv[i];
      if (it && it.id === id) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (it.n <= 0) inv[i] = null; }
    }
    return true;
  }

  // ───────── 처음 맵 만들기 ─────────
  function generateWorld() {
    const ground = Array.from({ length: H }, () => new Array(W).fill('grass'));
    const objects = {};
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const setG = (x, y, g) => { if (inb(x, y)) ground[y][x] = g; };
    const setO = (x, y, o) => { if (inb(x, y)) { if (o) objects[x + ',' + y] = o; else delete objects[x + ',' + y]; } };
    const getO = (x, y) => objects[x + ',' + y];

    // 가장자리 숲 (부술 수 없음)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) setO(x, y, { t: 'tree', fixed: 1 });

    // 연못 + 모래사장
    const ellipse = (cx, cy, rx, ry, sandRing) => {
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d < 1) setG(x, y, 'water');
        else if (sandRing && d < 1.45 && ground[y][x] === 'grass') setG(x, y, 'sand');
      }
    };
    ellipse(13.5, 35, 7.5, 4.5, true);
    ellipse(51, 39, 4, 2.8, false);

    // 길
    for (let y = 17; y < H - 2; y++) setG(31, y, 'path');
    for (let x = 2; x < W - 2; x++) setG(x, 24, 'path');

    // 아지트 집
    const hx0 = 24, hx1 = 38, hy0 = 6, hy1 = 16;
    for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
      setG(x, y, 'floor_wood');
      if (x === hx0 || x === hx1 || y === hy0 || y === hy1) setO(x, y, { t: 'wall_wood' });
    }
    setO(31, hy1, { t: 'door', open: true });
    setO(27, hy0, { t: 'window' }); setO(35, hy0, { t: 'window' });
    setO(hx0, 11, { t: 'window' }); setO(hx1, 11, { t: 'window' });
    for (let y = 10; y <= 14; y++) for (let x = 28; x <= 34; x++) setG(x, y, 'rug');
    for (let x = 26; x <= 29; x++) setO(x, hy0 + 1, { t: 'shelf' });
    setO(36, 7, { t: 'bed' }); setO(37, 7, { t: 'bed' });
    setO(30, 11, { t: 'table' }); setO(31, 11, { t: 'table' }); setO(32, 11, { t: 'table' });
    setO(30, 13, { t: 'sofa' }); setO(31, 13, { t: 'sofa' }); setO(32, 13, { t: 'sofa' });
    setO(25, 7, { t: 'plant' }); setO(37, 15, { t: 'plant' }); setO(25, 15, { t: 'plant' });
    setO(34, 8, { t: 'teddy' });
    setO(33, 17, { t: 'sign', text: '🏠 비밀 아지트' });

    // 상점, 퀘스트 게시판
    setO(28, 22, { t: 'shop' });
    setO(26, 22, { t: 'sign', text: '🐱 모모네 상점 (E)' });
    setO(35, 22, { t: 'board' });

    // 텃밭 (울타리 + 밭)
    const fx0 = 40, fx1 = 48, fy0 = 27, fy1 = 33;
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      if (x === fx0 || x === fx1 || y === fy0 || y === fy1) setO(x, y, { t: 'fence' });
      else setG(x, y, 'farm');
    }
    setO(44, fy0, null);
    setG(44, 25, 'path'); setG(44, 26, 'path'); setG(44, 27, 'path');
    [[42, 29], [43, 29], [45, 29], [46, 29]].forEach(([x, y]) => setO(x, y, { t: 'crop', kind: 'carrot', stage: 3, water: false, since: 0 }));

    // 동물 우리 (울타리 + 닭 2마리, 양 1마리)
    const px0 = 51, px1 = 58, py0 = 27, py1 = 33;
    for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++)
      if (x === px0 || x === px1 || y === py0 || y === py1) setO(x, y, { t: 'fence' });
    setO(54, py0, null);
    setG(54, 25, 'path'); setG(54, 26, 'path'); setG(54, 27, 'path');
    setO(53, 22, { t: 'sign', text: '🐔 동물 우리 (작물을 먹여요)' });
    const animals = [
      { kind: 'chicken', x: 53.5 * TILE, y: 30 * TILE }, { kind: 'chicken', x: 56 * TILE, y: 31 * TILE },
      { kind: 'sheep', x: 55 * TILE, y: 29.5 * TILE },
    ];

    // 채석장 (오른쪽 위)
    for (let y = 3; y <= 16; y++) for (let x = 46; x <= 61; x++) {
      if (ground[y][x] !== 'grass') continue;
      const edge = Math.min(x - 46, 61 - x, y - 3, 16 - y);
      if (edge > 0 || hash(x, y * 5) < 0.5) setG(x, y, 'sand');
      if (hash(x * 3, y * 7) < 0.2 && !getO(x, y)) setO(x, y, { t: 'rock' });
    }

    // 숲 (왼쪽 위)
    for (let y = 3; y <= 18; y++) for (let x = 3; x <= 18; x++)
      if (ground[y][x] === 'grass' && !getO(x, y) && hash(x * 11, y * 3) < 0.3) setO(x, y, { t: 'tree' });

    // 흩어진 나무와 꽃
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (ground[y][x] !== 'grass' || getO(x, y)) continue;
      const nearRoad = Math.abs(x - 31) <= 1 || Math.abs(y - 24) <= 1;
      const nearHouse = x >= hx0 - 2 && x <= hx1 + 2 && y >= hy0 - 2 && y <= hy1 + 3;
      const nearFarm = x >= fx0 - 1 && x <= px1 + 1 && y >= fy0 - 1 && y <= fy1 + 1;
      const r = hash(x, y);
      if (!nearRoad && !nearHouse && !nearFarm && r < 0.03) setO(x, y, { t: 'tree' });
      else if (!nearRoad && r > 0.92) setO(x, y, { t: 'flower' });
    }
    return { ground, objects, animals };
  }

  const SHARED = {
    TILE, W, H, WORLD_VERSION, REACH, BITE_WINDOW, SAPLING_MS, SPAWN,
    hash, ITEMS, GROUND, OBJ, isSolidObj, CROPS, FEED, ANIMALS, WILD_SPAWN, BOW_RANGE, FISH_TABLE, rollFish, SHOP, RECIPES, QUESTS,
    SKINS, HAIR_STYLES, HAIR_COLORS, EYES, TOPS, CLOTH, ACCESSORIES, FREE_ACC, defaultAvatar, sanitizeAvatar,
    INV_SIZE, starterInventory, countItem, addItem, removeItem, generateWorld,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHARED;
  else root.SHARED = SHARED;
})(typeof window !== 'undefined' ? window : globalThis);
