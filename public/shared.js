// 알PDF - 서버와 화면이 함께 쓰는 게임 데이터
// (아이템, 블록, 가구, 작물, 요리, 도감, 퀘스트, 아바타, 맵 생성)
(function (root) {
  'use strict';

  const TILE = 16;
  const OW = 64, OH = 48;             // 예전 맵 크기 (마을)
  // 예전(v6) 지도 크기: 마을(왼쪽 위) · 집 짓는 땅 · 맨 아래 생산 구역(동굴·숲). 지도를 만들 때 이 크기로 먼저 그려요.
  const W0 = 100, H0 = 112, CY0 = 80, BX0 = 50;
  // v7: 왼쪽으로 TX칸, 위로 TY칸 넓혔어요 → 상점이 가로 한가운데, 위쪽 TY줄은 던전 지대
  const TX = 44, TY = 40;
  const W = W0 + TX, H = H0 + TY;     // 144 × 152
  const CY = TY + CY0;                // 생산 구역(맨 아래)이 시작하는 줄
  const BX = TX + BX0;                // 생산 구역에서 동굴(왼쪽)과 숲(오른쪽)을 나누는 칸
  const WORLD_VERSION = 7;
  const REACH = 3.6 * TILE;           // 손이 닿는 거리
  const BITE_WINDOW = 1200;           // 찌가 흔들린 뒤 당길 수 있는 시간(ms)
  const SAPLING_MS = 60000;           // 묘목이 나무가 되는 시간
  const SPAWN = { x: (31.5 + TX) * TILE, y: (19.5 + TY) * TILE };
  const QUEST_ONLY = '✨ 퀘스트 보상으로만 얻을 수 있어요 (상점·거래 불가)';

  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
  }

  // ───────── 아이템 ─────────
  // tool: 도구 / seed: 심을 작물 / ground: 바닥에 까는 블록 / obj: 세우는 블록·가구 / sell: 상점 판매가
  // food: 요리 (Space로 먹으면 잠깐 빨라져요) / questOnly: 퀘스트 보상 전용 (상점·만들기·거래 불가)
  const ITEMS = {
    hoe: { name: '괭이', tool: 'hoe', stack: 1, desc: '땅을 바라보고 Space → 밭이 돼요 (물 빼고 어디든! 바닥 블록은 가방으로 돌아와요)' },
    can: { name: '물뿌리개', tool: 'can', stack: 1, desc: '심은 작물에 Space → 물을 줘요' },
    rod: { name: '낚싯대', tool: 'rod', stack: 1, desc: '물을 보고 Space, 찌에 ❗가 뜨면 다시 Space!' },
    bow: { name: '활', tool: 'bow', weapon: 'bow', atk: 3, stack: 1, desc: 'Space로 화살 발사! 누구나 쓸 수 있어요. 야생 동물·몬스터 사냥' },
    rod_gold: { name: '황금 낚싯대', tool: 'rod', gold: 1, stack: 1, questOnly: 1, desc: '입질이 빠르고 귀한 물고기가 잘 잡혀요' },
    can_gold: { name: '황금 물뿌리개', tool: 'can', gold: 1, stack: 1, questOnly: 1, desc: '한 번에 주변 3×3칸에 물을 줘요' },

    animal_chicken: { name: '닭', animal: 'chicken', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 달걀을 낳아요' },
    animal_cow: { name: '소', animal: 'cow', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 우유를 줘요' },
    animal_sheep: { name: '양', animal: 'sheep', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 양털을 줘요' },
    pet_dog: { name: '강아지', animal: 'dog', stack: 1, desc: 'Space로 데리고 나와요. 졸졸 따라다녀요! E로 집에 두기/데려가기' },
    pet_dog_white: { name: '하얀 강아지', animal: 'dog_white', stack: 1, desc: '복슬복슬 하얀 강아지. E로 집에 두기/데려가기' },
    pet_dog_spot: { name: '점박이 강아지', animal: 'dog_spot', stack: 1, questOnly: 1, desc: '귀한 점박이 강아지!' },
    egg: { name: '달걀', sell: 25, desc: '닭이 낳은 달걀' },
    milk: { name: '우유', sell: 45, desc: '신선한 우유' },
    wool: { name: '양털', sell: 55, desc: '포근한 양털' },
    meat: { name: '고기', sell: 30, desc: '사냥으로 얻어요' },
    hide: { name: '가죽', sell: 25, desc: '멧돼지·사슴을 사냥하면 얻어요' },

    wood: { name: '나무', sell: 2, desc: '나무를 X로 베면 얻어요. 숲에 나무가 많아요' },
    stone: { name: '돌', sell: 3, desc: '바위를 X로 깨면 얻어요. 동굴에 바위가 많아요' },
    iron: { name: '철광석', sell: 15, desc: '동굴의 철광석을 X로 캐요. 주방·욕실 가구 재료' },
    gold: { name: '금광석', sell: 40, desc: '동굴 깊은 곳에서 캐요' },
    gem: { name: '수정', sell: 90, desc: '동굴 가장 깊은 곳의 반짝이는 수정' },
    mushroom: { name: '버섯', sell: 10, desc: '숲에서 E로 따요. 요리 재료' },
    berry: { name: '산딸기', sell: 8, desc: '숲의 덤불에서 E로 따요. 요리 재료' },
    pinecone: { name: '솔방울', sell: 6, desc: '소나무를 베면 가끔 나와요' },

    seed_carrot: { name: '당근 씨앗', seed: 'carrot', sell: 2, desc: '밭에 심어요 (빨리 자라요)' },
    seed_straw: { name: '딸기 씨앗', seed: 'strawberry', sell: 4, desc: '밭에 심어요 (여러 개 열려요)' },
    seed_sunflower: { name: '해바라기 씨앗', seed: 'sunflower', sell: 6, desc: '밭에 심어요' },
    seed_pumpkin: { name: '호박 씨앗', seed: 'pumpkin', sell: 10, desc: '밭에 심어요 (오래 걸리지만 비싸요)' },
    carrot: { name: '당근', sell: 15, desc: '상점에 팔거나 요리해요' },
    strawberry: { name: '딸기', sell: 12, desc: '상점에 팔거나 요리해요' },
    sunflower: { name: '해바라기', sell: 35, desc: '상점에 팔거나 요리해요' },
    pumpkin: { name: '호박', sell: 70, desc: '상점에 팔거나 요리해요' },

    fish_minnow: { name: '송사리', fish: 1, sell: 12, desc: '작고 귀여운 물고기' },
    fish_crucian: { name: '붕어', fish: 1, sell: 20, desc: '흔한 물고기' },
    fish_tropical: { name: '열대어', fish: 1, sell: 45, desc: '알록달록!' },
    fish_puffer: { name: '복어', fish: 1, sell: 70, desc: '뾰족뾰족' },
    fish_golden: { name: '황금잉어', fish: 1, sell: 250, desc: '전설의 물고기 ✨' },
    fish_trout: { name: '송어', fish: 1, sell: 35, desc: '숲속 연못에 살아요' },
    fish_salmon: { name: '연어', fish: 1, sell: 60, desc: '숲속 연못의 귀한 물고기' },
    fish_blind: { name: '동굴어', fish: 1, sell: 55, desc: '동굴 호수에 사는 하얀 물고기' },
    fish_shrimp: { name: '수정새우', fish: 1, sell: 120, desc: '동굴 호수의 반짝이는 새우' },
    boot: { name: '낡은 장화', sell: 1, desc: '...누가 버렸지?' },

    // 요리 (가스레인지·모닥불 앞에서 E)
    carrot_soup: { name: '당근 수프', food: 1, sell: 45, desc: '따끈따끈' },
    fried_egg: { name: '계란후라이', food: 1, sell: 40, desc: '반숙이 최고' },
    grilled_fish: { name: '생선구이', food: 1, sell: 40, desc: '노릇노릇' },
    steak: { name: '스테이크', food: 1, sell: 60, desc: '육즙 가득' },
    strawberry_jam: { name: '딸기잼', food: 1, sell: 55, desc: '달콤한 잼' },
    strawberry_milk: { name: '딸기우유', food: 1, sell: 75, desc: '분홍분홍' },
    omelet: { name: '오믈렛', food: 1, sell: 120, desc: '폭신폭신' },
    pumpkin_pie: { name: '호박파이', food: 1, sell: 180, desc: '가을의 맛' },
    sun_cookie: { name: '해바라기씨 쿠키', food: 1, sell: 90, desc: '바삭바삭' },
    mushroom_soup: { name: '버섯 크림수프', food: 1, sell: 110, desc: '숲의 향기' },
    berry_tart: { name: '산딸기 타르트', food: 1, sell: 100, desc: '새콤달콤' },
    trout_grill: { name: '송어 버섯구이', food: 1, sell: 120, desc: '캠핑 요리' },
    veggie_stew: { name: '야채 스튜', food: 1, sell: 170, desc: '든든한 한 그릇' },
    bbq: { name: '바베큐 꼬치', food: 1, sell: 110, desc: '모닥불엔 꼬치지' },
    sashimi: { name: '모둠회', food: 1, sell: 160, desc: '싱싱해요' },
    cave_stew: { name: '동굴 매운탕', food: 1, sell: 140, desc: '얼큰해요' },
    golden_dish: { name: '황금잉어 정식', food: 1, sell: 650, desc: '전설의 요리 ✨' },

    // 바닥
    path: { name: '흙길', ground: 'path', cat: 'path', desc: '바닥에 까는 길' },
    stone_path: { name: '돌길', ground: 'stone_path', cat: 'path', desc: '바닥에 까는 길' },
    brick_path: { name: '벽돌길', ground: 'brick_path', cat: 'path', desc: '바닥에 까는 길' },
    sand: { name: '모래', ground: 'sand', cat: 'path', desc: '바닥에 까는 모래' },
    floor_wood: { name: '나무 바닥', ground: 'floor_wood', cat: 'floor', desc: '집 바닥' },
    floor_pink: { name: '분홍 타일', ground: 'floor_pink', cat: 'floor', desc: '집 바닥' },
    floor_check: { name: '체크 타일', ground: 'floor_check', cat: 'floor', desc: '집 바닥' },
    rug: { name: '러그', ground: 'rug', cat: 'floor', desc: '이어서 깔면 큰 러그가 돼요' },
    floor_dark: { name: '진한 나무 바닥', ground: 'floor_dark', cat: 'floor', desc: '집 바닥' },
    floor_marble: { name: '대리석 바닥', ground: 'floor_marble', cat: 'floor', desc: '반들반들 고급 바닥' },
    floor_bath: { name: '욕실 타일', ground: 'floor_bath', cat: 'floor', desc: '화장실·욕실 바닥' },
    floor_kitchen: { name: '주방 타일', ground: 'floor_kitchen', cat: 'floor', desc: '주방 바닥' },
    floor_mint: { name: '민트 타일', ground: 'floor_mint', cat: 'floor', desc: '집 바닥' },
    floor_herring: { name: '헤링본 바닥', ground: 'floor_herring', cat: 'floor', desc: '지그재그 나무 바닥' },
    carpet_blue: { name: '파란 카펫', ground: 'carpet_blue', cat: 'floor', desc: '폭신한 카펫' },
    rug_green: { name: '초록 러그', ground: 'rug_green', cat: 'floor', desc: '이어서 깔면 큰 러그가 돼요' },
    floor_star: { name: '별빛 바닥', ground: 'floor_star', cat: 'floor', questOnly: 1, desc: '밤하늘 같은 바닥' },
    rug_rainbow: { name: '무지개 러그', ground: 'rug_rainbow', cat: 'floor', questOnly: 1, desc: '이어서 깔면 큰 러그가 돼요' },
    floor_gold: { name: '황금 바닥', ground: 'floor_gold', cat: 'floor', questOnly: 1, desc: '번쩍번쩍' },

    // 벽
    wall_wood: { name: '나무 벽', obj: 'wall_wood', cat: 'wall', desc: '집을 짓는 벽' },
    wall_stone: { name: '돌 벽', obj: 'wall_stone', cat: 'wall', desc: '집을 짓는 벽' },
    wall_brick: { name: '벽돌 벽', obj: 'wall_brick', cat: 'wall', desc: '집을 짓는 벽' },
    wall_white: { name: '하얀 벽', obj: 'wall_white', cat: 'wall', desc: '집을 짓는 벽' },
    wall_pink: { name: '분홍 벽', obj: 'wall_pink', cat: 'wall', desc: '집을 짓는 벽' },
    wall_mint: { name: '민트 벽', obj: 'wall_mint', cat: 'wall', desc: '집을 짓는 벽' },
    wall_blue: { name: '하늘 벽', obj: 'wall_blue', cat: 'wall', desc: '집을 짓는 벽' },
    wall_yellow: { name: '노랑 벽', obj: 'wall_yellow', cat: 'wall', desc: '집을 짓는 벽' },
    wall_log: { name: '통나무 벽', obj: 'wall_log', cat: 'wall', desc: '산장 느낌 벽' },
    wall_paper: { name: '줄무늬 벽지', obj: 'wall_paper', cat: 'wall', desc: '집을 짓는 벽' },
    wall_tile: { name: '욕실 타일 벽', obj: 'wall_tile', cat: 'wall', desc: '화장실에 어울려요' },
    wall_dark: { name: '어두운 나무 벽', obj: 'wall_dark', cat: 'wall', desc: '집을 짓는 벽' },
    wall_gold: { name: '황금 벽', obj: 'wall_gold', cat: 'wall', questOnly: 1, desc: '번쩍번쩍' },
    wall_rainbow: { name: '무지개 벽', obj: 'wall_rainbow', cat: 'wall', questOnly: 1, desc: '알록달록' },
    wall_candy: { name: '사탕 벽', obj: 'wall_candy', cat: 'wall', questOnly: 1, desc: '달콤한 줄무늬' },
    window: { name: '창문', obj: 'window', cat: 'wall', desc: '벽 대신 끼우는 창문' },
    door: { name: '문', obj: 'door', cat: 'wall', desc: 'E로 열고 닫아요' },
    door_white: { name: '하얀 문', obj: 'door_white', cat: 'wall', desc: 'E로 열고 닫아요' },

    // 꾸미기·바깥
    fence: { name: '울타리', obj: 'fence', cat: 'deco', desc: '이어서 놓으면 연결돼요' },
    sign: { name: '표지판', obj: 'sign', cat: 'sign', desc: '세우고 글씨를 쓸 수 있어요' },
    lamp: { name: '가로등', obj: 'lamp', cat: 'deco', desc: '길가에 세워요' },
    torch: { name: '횃불', obj: 'torch', cat: 'deco', desc: '어두운 동굴을 밝혀요' },
    flower: { name: '꽃', obj: 'flower', cat: 'deco', sell: 1, desc: '어디든 심어요' },
    sapling: { name: '묘목', obj: 'sapling', cat: 'deco', desc: '1분 뒤 나무가 돼요' },
    bench: { name: '벤치', obj: 'bench', cat: 'furniture', desc: 'E로 앉아요' },
    campfire: { name: '모닥불', obj: 'campfire', cat: 'furniture', desc: 'E로 요리해요 🔥' },
    log_seat: { name: '통나무 의자', obj: 'log_seat', cat: 'furniture', desc: 'E로 앉아요' },

    // 거실 가구
    table: { name: '테이블', obj: 'table', cat: 'furniture', desc: '나란히 놓으면 이어져요' },
    chair: { name: '의자', obj: 'chair', cat: 'furniture', desc: 'E로 앉아요' },
    sofa: { name: '소파', obj: 'sofa', cat: 'furniture', desc: 'E로 앉아요. 나란히 놓으면 이어져요' },
    bed: { name: '침대', obj: 'bed', cat: 'furniture', desc: 'E로 누워요' },
    shelf: { name: '책장', obj: 'shelf', cat: 'furniture', desc: '가구' },
    plant: { name: '화분', obj: 'plant', cat: 'furniture', desc: '가구' },
    teddy: { name: '곰인형', obj: 'teddy', cat: 'furniture', desc: '폭신폭신' },
    chest: { name: '나무 상자', obj: 'chest', cat: 'furniture', desc: 'E로 열어서 아이템을 27칸 보관해요. 주인은 잠글 수 있어요' },
    tv: { name: '텔레비전', obj: 'tv', cat: 'furniture', desc: 'E로 켜고 꺼요 📺' },
    stand_lamp: { name: '스탠드 조명', obj: 'stand_lamp', cat: 'furniture', desc: 'E로 켜고 꺼요' },
    armchair: { name: '1인 소파', obj: 'armchair', cat: 'furniture', desc: 'E로 앉아요' },
    beanbag: { name: '빈백', obj: 'beanbag', cat: 'furniture', desc: 'E로 푹 앉아요' },
    cushion: { name: '방석', obj: 'cushion', cat: 'furniture', desc: 'E로 앉아요' },
    cactus: { name: '선인장', obj: 'cactus', cat: 'furniture', desc: '가시 조심' },
    plant_big: { name: '큰 화분', obj: 'plant_big', cat: 'furniture', desc: '싱그러운 몬스테라' },
    picture: { name: '액자', obj: 'picture', cat: 'furniture', desc: '벽 앞에 두면 예뻐요' },
    clock: { name: '괘종시계', obj: 'clock', cat: 'furniture', desc: 'E로 지금 시간을 봐요' },
    side_table: { name: '협탁', obj: 'side_table', cat: 'furniture', desc: '침대 옆에 딱' },
    display_shelf: { name: '장식 선반', obj: 'display_shelf', cat: 'furniture', desc: '소품을 올려두는 선반' },
    wall_shelf: { name: '벽 선반', obj: 'wall_shelf', cat: 'furniture', desc: '벽 앞에 두는 작은 선반' },
    drawer: { name: '서랍장', obj: 'drawer', cat: 'furniture', desc: '가구' },
    wardrobe: { name: '옷장', obj: 'wardrobe', cat: 'furniture', desc: '가구' },
    desk: { name: '책상', obj: 'desk', cat: 'furniture', desc: '가구' },
    computer: { name: '컴퓨터', obj: 'computer', cat: 'furniture', desc: 'E로 켜고 꺼요' },

    // 주방
    stove: { name: '가스레인지', obj: 'stove', cat: 'furniture', desc: 'E로 요리해요 🍳' },
    fridge: { name: '냉장고', obj: 'fridge', cat: 'furniture', desc: '시원~' },
    sink: { name: '싱크대', obj: 'sink', cat: 'furniture', desc: 'E로 물을 틀어요' },
    counter: { name: '조리대', obj: 'counter', cat: 'furniture', desc: '나란히 놓으면 이어져요' },
    microwave: { name: '전자레인지', obj: 'microwave', cat: 'furniture', desc: 'E로 요리해요' },
    dish_rack: { name: '그릇 선반', obj: 'dish_rack', cat: 'furniture', desc: '그릇이 가득' },
    kitchen_shelf: { name: '양념 선반', obj: 'kitchen_shelf', cat: 'furniture', desc: '양념통이 줄줄이' },

    // 욕실·화장실
    toilet: { name: '변기', obj: 'toilet', cat: 'furniture', desc: 'E로 앉아요' },
    bathtub: { name: '욕조', obj: 'bathtub', cat: 'furniture', desc: 'E로 목욕해요 🛁' },
    washbasin: { name: '세면대', obj: 'washbasin', cat: 'furniture', desc: 'E로 손을 씻어요' },
    shower: { name: '샤워부스', obj: 'shower', cat: 'furniture', desc: 'E로 물을 켜고 꺼요' },
    mirror: { name: '거울', obj: 'mirror', cat: 'furniture', desc: 'E로 거울을 봐요' },
    towel_rack: { name: '수건걸이', obj: 'towel_rack', cat: 'furniture', desc: '보송보송 수건' },
    washer: { name: '세탁기', obj: 'washer', cat: 'furniture', desc: 'E로 돌려요' },
    bath_shelf: { name: '욕실 선반', obj: 'bath_shelf', cat: 'furniture', desc: '샴푸랑 비누' },

    // 퀘스트 보상 전용 가구
    aquarium: { name: '어항', obj: 'aquarium', cat: 'furniture', questOnly: 1, desc: '물고기가 헤엄쳐요' },
    piano: { name: '피아노', obj: 'piano', cat: 'furniture', questOnly: 1, desc: 'E로 연주해요 🎵' },
    fireplace: { name: '벽난로', obj: 'fireplace', cat: 'furniture', questOnly: 1, desc: '타닥타닥 따뜻해요. E로 요리도 돼요' },
    trophy: { name: '황금 트로피', obj: 'trophy', cat: 'furniture', questOnly: 1, desc: '자랑스러운 트로피' },
    cat_tower: { name: '캣타워', obj: 'cat_tower', cat: 'furniture', questOnly: 1, desc: '고양이가 좋아해요' },
    fountain: { name: '분수대', obj: 'fountain', cat: 'furniture', questOnly: 1, desc: '졸졸졸' },
    xmas_tree: { name: '크리스마스 트리', obj: 'xmas_tree', cat: 'furniture', questOnly: 1, desc: '반짝반짝' },
    throne: { name: '왕좌', obj: 'throne', cat: 'furniture', questOnly: 1, desc: 'E로 앉아요 👑' },
    royal_bed: { name: '공주 침대', obj: 'royal_bed', cat: 'furniture', questOnly: 1, desc: 'E로 누워요' },
    statue: { name: '황금 동상', obj: 'statue', cat: 'furniture', questOnly: 1, desc: '위풍당당' },
    arcade: { name: '오락기', obj: 'arcade', cat: 'furniture', questOnly: 1, desc: 'E로 켜고 꺼요 🕹️' },
    telescope: { name: '망원경', obj: 'telescope', cat: 'furniture', questOnly: 1, desc: 'E로 하늘을 봐요' },
    crystal_lamp: { name: '수정 램프', obj: 'crystal_lamp', cat: 'furniture', questOnly: 1, desc: '은은하게 빛나요' },
    scarecrow: { name: '허수아비', obj: 'scarecrow', cat: 'furniture', questOnly: 1, desc: '밭을 지켜요' },
    windmill: { name: '꼬마 풍차', obj: 'windmill', cat: 'furniture', questOnly: 1, desc: '빙글빙글' },
    deer_trophy: { name: '사슴뿔 장식', obj: 'deer_trophy', cat: 'furniture', questOnly: 1, desc: '사냥꾼의 증표' },
    music_box: { name: '오르골', obj: 'music_box', cat: 'furniture', questOnly: 1, desc: 'E로 음악을 들어요 🎶' },
    snowman: { name: '눈사람', obj: 'snowman', cat: 'furniture', questOnly: 1, desc: '녹지 않는 눈사람 ⛄' },
    teddy_big: { name: '왕 곰인형', obj: 'teddy_big', cat: 'furniture', questOnly: 1, desc: '엄청 큰 곰인형' },

    // ── v5 새 콘텐츠 ──
    chest_big: { name: '큰 상자', obj: 'chest_big', cat: 'furniture', desc: 'E로 열어서 54칸 보관해요 (Lv.10 만들기)' },
    notice_board: { name: '마을 게시판', obj: 'notice_board', cat: 'deco', desc: '건의함과 금주의 MVP' },
    // 작물
    seed_tomato: { name: '토마토 씨앗', seed: 'tomato', sell: 6, desc: '밭에 심어요' },
    seed_corn: { name: '옥수수 씨앗', seed: 'corn', sell: 8, desc: '밭에 심어요' },
    seed_potato: { name: '감자 씨앗', seed: 'potato', sell: 9, desc: '밭에 심어요 (여러 개 나와요)' },
    seed_watermelon: { name: '수박 씨앗', seed: 'watermelon', sell: 20, desc: '밭에 심어요 (오래 걸리지만 아주 비싸요)' },
    tomato: { name: '토마토', sell: 28, desc: '상점에 팔거나 요리해요' },
    corn: { name: '옥수수', sell: 40, desc: '상점에 팔거나 요리해요' },
    potato: { name: '감자', sell: 22, desc: '상점에 팔거나 요리해요' },
    watermelon: { name: '수박', sell: 140, desc: '상점에 팔거나 요리해요' },
    // 동물
    animal_duck: { name: '오리', animal: 'duck', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 오리알을 낳아요' },
    animal_goat: { name: '염소', animal: 'goat', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 염소젖을 줘요' },
    animal_pig: { name: '돼지', animal: 'pig', stack: 10, desc: 'Space로 풀어줘요. 작물을 먹으면 트러플을 찾아와요' },
    duck_egg: { name: '오리알', sell: 35, desc: '오리가 낳은 알' },
    goat_milk: { name: '염소젖', sell: 70, desc: '고소한 염소젖' },
    truffle: { name: '트러플', sell: 160, desc: '돼지가 찾아온 귀한 버섯' },
    // 펫
    pet_cat: { name: '고양이', animal: 'cat', stack: 1, desc: 'Space로 데리고 나와요. E로 따라오기/집에 두기' },
    pet_cat_black: { name: '검은 고양이', animal: 'cat_black', stack: 1, desc: '반짝이는 눈의 검은 고양이' },
    pet_bunny: { name: '토끼', animal: 'pbunny', stack: 1, desc: '깡총깡총 귀여운 토끼' },
    pet_cat_calico: { name: '삼색 고양이', animal: 'cat_calico', stack: 1, questOnly: 1, desc: '행운의 삼색 고양이' },
    // 요리
    tomato_soup: { name: '토마토 수프', food: 1, sell: 70, desc: '새콤따끈' },
    corn_soup: { name: '콘수프', food: 1, sell: 130, desc: '부드러워요' },
    baked_potato: { name: '군감자', food: 1, sell: 55, desc: '호호 불어 먹어요' },
    fries: { name: '감자튀김', food: 1, sell: 75, desc: '바삭바삭' },
    salad: { name: '샐러드', food: 1, sell: 60, desc: '아삭아삭' },
    watermelon_juice: { name: '수박 주스', food: 1, sell: 200, desc: '시원해요' },
    duck_egg_roll: { name: '계란말이', food: 1, sell: 90, desc: '도톰한 계란말이' },
    pizza: { name: '피자', food: 1, sell: 210, desc: '치즈가 쭉~' },
    truffle_pasta: { name: '트러플 파스타', food: 1, sell: 380, desc: '고급 요리' },
    // 벽·바닥
    wall_flower: { name: '꽃무늬 벽지', obj: 'wall_flower', cat: 'wall', desc: '집을 짓는 벽' },
    wall_star: { name: '별무늬 벽지', obj: 'wall_star', cat: 'wall', desc: '밤하늘 벽지' },
    wall_green: { name: '초록 벽', obj: 'wall_green', cat: 'wall', desc: '집을 짓는 벽' },
    wall_purple: { name: '보라 벽', obj: 'wall_purple', cat: 'wall', desc: '집을 짓는 벽' },
    wall_wainscot: { name: '웨인스코팅 벽', obj: 'wall_wainscot', cat: 'wall', desc: '아래는 나무, 위는 하얀 벽' },
    floor_hex: { name: '육각 타일', ground: 'floor_hex', cat: 'floor', desc: '벌집 모양 타일' },
    floor_straw: { name: '돗자리', ground: 'floor_straw', cat: 'floor', desc: '시원한 돗자리' },
    floor_wood_white: { name: '화이트 원목', ground: 'floor_wood_white', cat: 'floor', desc: '밝은 나무 바닥' },
    floor_stone_tile: { name: '석재 타일', ground: 'floor_stone_tile', cat: 'floor', desc: '큼직한 돌 타일' },
    carpet_red: { name: '빨간 카펫', ground: 'carpet_red', cat: 'floor', desc: '레드카펫!' },
    rug_blue: { name: '파란 러그', ground: 'rug_blue', cat: 'floor', desc: '이어서 깔면 큰 러그가 돼요' },
    // 가구
    sofa_blue: { name: '파란 소파', obj: 'sofa_blue', cat: 'furniture', desc: 'E로 앉아요. 나란히 놓으면 이어져요' },
    sofa_green: { name: '초록 소파', obj: 'sofa_green', cat: 'furniture', desc: 'E로 앉아요. 나란히 놓으면 이어져요' },
    bed_pink: { name: '분홍 침대', obj: 'bed_pink', cat: 'furniture', desc: 'E로 누워요' },
    bed_blue: { name: '파란 침대', obj: 'bed_blue', cat: 'furniture', desc: 'E로 누워요' },
    rocking_chair: { name: '흔들의자', obj: 'rocking_chair', cat: 'furniture', desc: 'E로 앉아요' },
    vanity: { name: '화장대', obj: 'vanity', cat: 'furniture', desc: 'E로 거울을 봐요' },
    guitar: { name: '기타', obj: 'guitar', cat: 'furniture', desc: 'E로 연주해요 🎸' },
    globe: { name: '지구본', obj: 'globe', cat: 'furniture', desc: '빙글빙글' },
    bonsai: { name: '분재', obj: 'bonsai', cat: 'furniture', desc: '작은 소나무' },
    lantern: { name: '등불', obj: 'lantern', cat: 'furniture', desc: '은은하게 빛나요' },
    candle: { name: '촛대', obj: 'candle', cat: 'furniture', desc: '촛불이 일렁여요' },
    fishbowl: { name: '금붕어 어항', obj: 'fishbowl', cat: 'furniture', desc: '금붕어가 뻐끔뻐끔' },
    oven: { name: '오븐', obj: 'oven', cat: 'furniture', desc: 'E로 요리해요 🥧' },
    coffee_machine: { name: '커피머신', obj: 'coffee_machine', cat: 'furniture', desc: 'E로 커피를 내려요 ☕' },
    rice_cooker: { name: '밥솥', obj: 'rice_cooker', cat: 'furniture', desc: 'E로 요리해요' },
    rubber_duck: { name: '고무오리', obj: 'rubber_duck', cat: 'furniture', desc: '꽥꽥' },
    // ── v6 공원 ──
    park_bench: { name: '공원 벤치', obj: 'park_bench', cat: 'furniture', desc: 'E로 앉아요' },
    picnic_table: { name: '피크닉 테이블', obj: 'picnic_table', cat: 'furniture', desc: '위에 물건을 올릴 수 있어요' },
    swing: { name: '그네', obj: 'swing', cat: 'furniture', desc: 'E로 앉아요 (흔들흔들)' },
    slide: { name: '미끄럼틀', obj: 'slide', cat: 'furniture', desc: 'E로 슝~' },
    flower_bed: { name: '화단', obj: 'flower_bed', cat: 'furniture', desc: '알록달록 꽃밭' },
    hedge: { name: '생울타리', obj: 'hedge', cat: 'furniture', desc: '이어서 놓으면 연결돼요' },
    trash_bin: { name: '쓰레기통', obj: 'trash_bin', cat: 'furniture', desc: '깨끗한 마을!' },
    vending_machine: { name: '자판기', obj: 'vending_machine', cat: 'furniture', desc: 'E로 음료 뽑기 🥤' },
    parasol: { name: '파라솔', obj: 'parasol', cat: 'furniture', desc: '그늘 아래서 쉬어요' },
    garden_light: { name: '정원등', obj: 'garden_light', cat: 'furniture', desc: '은은하게 빛나요' },
    path_park: { name: '보도블록', ground: 'path_park', cat: 'path', desc: '공원 길' },
    // ── v6 카페 ──
    cafe_table: { name: '카페 테이블', obj: 'cafe_table', cat: 'furniture', desc: '위에 커피잔·케이크를 올려요' },
    cafe_chair: { name: '카페 의자', obj: 'cafe_chair', cat: 'furniture', desc: 'E로 앉아요' },
    bar_stool: { name: '바 의자', obj: 'bar_stool', cat: 'furniture', desc: 'E로 앉아요' },
    cafe_counter: { name: '카페 카운터', obj: 'cafe_counter', cat: 'furniture', desc: '나란히 놓으면 이어져요. 위에 물건을 올려요' },
    cake_showcase: { name: '케이크 쇼케이스', obj: 'cake_showcase', cat: 'furniture', desc: '맛있는 케이크가 가득' },
    menu_board: { name: '메뉴 칠판', obj: 'menu_board', cat: 'furniture', desc: '오늘의 메뉴' },
    bread_shelf: { name: '빵 진열대', obj: 'bread_shelf', cat: 'furniture', desc: '갓 구운 빵' },
    coffee_cup: { name: '커피잔', obj: 'coffee_cup', cat: 'furniture', desc: '테이블 위에 올려요 ☕' },
    cake: { name: '케이크', obj: 'cake', cat: 'furniture', desc: '테이블 위에 올려요 🍰' },
    bread_basket: { name: '빵 바구니', obj: 'bread_basket', cat: 'furniture', desc: '테이블 위에 올려요 🥐' },
    floor_cafe: { name: '카페 바닥', ground: 'floor_cafe', cat: 'floor', desc: '흑백 체크 타일' },

    // ── v7 무기 (weapon: sword 검 / bow 활 / staff 지팡이 / ninja 표창, cls: 그 직업만 사용) ──
    wood_sword: { name: '목검', weapon: 'sword', atk: 4, stack: 1, desc: '누구나 쓸 수 있는 연습용 검. 앞의 적을 베어요' },
    iron_sword: { name: '철검', weapon: 'sword', atk: 9, cls: 'knight', stack: 1, desc: '기사의 검' },
    knight_sword: { name: '기사의 검', weapon: 'sword', atk: 16, cls: 'knight', stack: 1, desc: '빛나는 기사의 검' },
    hero_sword: { name: '용사의 대검', weapon: 'sword', atk: 26, cls: 'knight', stack: 1, desc: '3성 던전 보스에게서만 나와요 ✨' },
    long_bow: { name: '장궁', weapon: 'bow', atk: 8, cls: 'archer', stack: 1, desc: '궁수의 활' },
    elf_bow: { name: '엘프의 활', weapon: 'bow', atk: 15, cls: 'archer', stack: 1, desc: '가볍고 정확한 활' },
    phoenix_bow: { name: '불사조 활', weapon: 'bow', atk: 24, cls: 'archer', stack: 1, desc: '3성 던전 보스에게서만 나와요 ✨' },
    staff_basic: { name: '견습 지팡이', weapon: 'staff', atk: 6, cls: 'mage', stack: 1, desc: '마법사의 지팡이. 터지면서 주변에도 피해' },
    crystal_staff: { name: '수정 지팡이', weapon: 'staff', atk: 13, cls: 'mage', stack: 1, desc: '수정이 박힌 지팡이' },
    arch_staff: { name: '대마법사의 지팡이', weapon: 'staff', atk: 22, cls: 'mage', stack: 1, desc: '3성 던전 보스에게서만 나와요 ✨' },
    // (아이템 id는 저장 데이터 때문에 예전 이름 그대로: kunai=표창, ninja_blade=강철 표창, shadow_blade=그림자 표창)
    kunai: { name: '표창', weapon: 'ninja', atk: 6, cls: 'ninja', stack: 1, desc: '닌자의 표창. 가까운 적에게 아주 빠르게 던지고 치명타가 나와요' },
    ninja_blade: { name: '강철 표창', weapon: 'ninja', atk: 12, cls: 'ninja', stack: 1, desc: '날이 넷 달린 단단한 표창' },
    shadow_blade: { name: '그림자 표창', weapon: 'ninja', atk: 20, cls: 'ninja', stack: 1, desc: '3성 던전 보스에게서만 나와요 ✨' },
    // 물약 (Space로 마시면 체력 회복)
    potion_s: { name: '작은 물약', heal: 60, sell: 8, desc: '체력 60 회복' },
    potion_m: { name: '중간 물약', heal: 180, sell: 25, desc: '체력 180 회복' },
    potion_l: { name: '큰 물약', heal: 400, sell: 60, desc: '체력 400 회복' },
    // 던전 재료
    slime_gel: { name: '슬라임 젤리', sell: 6, desc: '1성 던전. 강화 재료' },
    bone: { name: '뼈', sell: 12, desc: '2성 던전. 강화·무기 재료' },
    ecto: { name: '유령 가루', sell: 18, desc: '2성 던전. 무기 재료' },
    fire_core: { name: '불꽃 핵', sell: 40, desc: '3성 던전. 강화 재료' },
    dragon_scale: { name: '용비늘', sell: 200, desc: '드래곤에게서만. 최고급 강화 재료' },
    // 전직 퀘스트 아이템 (전직 퀘스트를 하는 동안만 나와요)
    slime_core: { name: '슬라임의 핵', questOnly: 1, desc: '전직 퀘스트 아이템 · 1성 던전 슬라임' },
    bat_wing: { name: '박쥐 날개', questOnly: 1, desc: '전직 퀘스트 아이템 · 1성 던전 박쥐' },
    crown_shard: { name: '킹슬라임 왕관 조각', questOnly: 1, desc: '전직 퀘스트 아이템 · 1성 던전 보스' },
  };
  // ── 갑옷 (마인크래프트처럼 투구·갑옷·바지·신발 × 가죽·철·금·수정) ──
  const ARMOR_TIERS = {
    leather: { name: '가죽', mat: 'hide', lv: 3, def: [1, 3, 2, 1], col: '#a8743f' },
    iron: { name: '철', mat: 'iron', lv: 8, def: [2, 5, 4, 2], col: '#c4ced6' },
    gold: { name: '금', mat: 'gold', lv: 14, def: [3, 6, 5, 3], col: '#f2c230' },
    crystal: { name: '수정', mat: 'gem', lv: 20, def: [4, 8, 6, 4], col: '#7fdcff' },
  };
  const ARMOR_PARTS = [['helmet', '투구', 5], ['chest', '갑옷', 8], ['legs', '바지', 7], ['boots', '신발', 4]];
  for (const [tier, t] of Object.entries(ARMOR_TIERS)) ARMOR_PARTS.forEach(([part, pname], i) => {
    ITEMS[`${tier}_${part}`] = { name: `${t.name} ${pname}`, armor: { part, def: t.def[i], tier }, stack: 1, desc: `방어력 +${t.def[i]} (가방에서 장착)` };
  });
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (!it.stack) it.stack = 99;
    it.id = id;
    if (it.questOnly) { delete it.sell; it.desc = (it.desc || '') + ' · ' + QUEST_ONLY; }
  }

  // ───────── 바닥 / 블록 ─────────
  const GROUND = {
    grass: {}, water: { solid: 1 }, farm: {}, forest: {}, cave: {}, dungeon: {}, lava: { solid: 1 },
  };
  // solid: 못 지나가요 / fixed: 못 부숴요 / sit·lie: E로 앉기·눕기 / toggle: E로 켜고 끄기
  // cook: 요리 가능 / fx: E 누르면 뜨는 그림 / msg: E 누르면 뜨는 말 / light: 동굴에서 빛나는 반지름(칸)
  // anim: 움직이는 그림 / pick: E로 따기 / door: 문
  const OBJ = {
    tree: { solid: 1, drop: { wood: 3 }, regrow: 'stump', regrowMs: 90000 },
    pine: { solid: 1, drop: { wood: 4 }, bonus: [['pinecone', 0.35]], regrow: 'stump', regrowMs: 90000 },
    stump: { solid: 0 },
    rock: { solid: 1, drop: { stone: 2 }, regrow: 'pebble', regrowMs: 120000 },
    ore_iron: { solid: 1, drop: { iron: 2, stone: 1 }, regrow: 'pebble', regrowMs: 150000 },
    ore_gold: { solid: 1, drop: { gold: 1, stone: 1 }, regrow: 'pebble', regrowMs: 200000 },
    crystal: { solid: 1, drop: { gem: 1 }, regrow: 'pebble', regrowMs: 260000 },
    pebble: { solid: 0 },
    cave_wall: { solid: 1, fixed: 1 },
    mushroom_wild: { solid: 0, pick: { mushroom: 1 }, regrow: 'sprout', regrowMs: 60000 },
    bush_berry: { solid: 1, pick: { berry: 2 }, regrow: 'bush', regrowMs: 70000 },
    bush: { solid: 1 },
    sprout: { solid: 0 },
    crop: { solid: 0 },
    shop: { solid: 1, fixed: 1 },
    board: { solid: 1, fixed: 1 },
    window: { solid: 1, wall: 1 },
    door: { solid: 1, wall: 1, door: 1 }, door_white: { solid: 1, wall: 1, door: 1 },
    fence: { solid: 1 }, sign: { solid: 1 }, lamp: { solid: 1, light: 3 }, torch: { solid: 0, light: 4, anim: 1 },
    flower: { solid: 0 }, sapling: { solid: 0 },
    bench: { solid: 1, sit: 1 }, campfire: { solid: 1, cook: 1, anim: 1, light: 5 }, log_seat: { solid: 1, sit: 1 },
    table: { solid: 1 }, chair: { solid: 0, sit: 1 }, sofa: { solid: 1, sit: 1 }, bed: { solid: 1, lie: 1 }, shelf: { solid: 1 },
    plant: { solid: 1 }, teddy: { solid: 1, msg: '폭신폭신 꼬옥 🧸' },
    tv: { solid: 1, toggle: 1, anim: 1 }, stand_lamp: { solid: 1, toggle: 1, light: 3 }, armchair: { solid: 1, sit: 1 },
    beanbag: { solid: 0, sit: 1 }, cushion: { solid: 0, sit: 1 }, cactus: { solid: 1, msg: '앗 따가워! 🌵' }, plant_big: { solid: 1 },
    picture: { solid: 1 }, clock: { solid: 1, msg: 'time' }, side_table: { solid: 1 }, display_shelf: { solid: 1 },
    wall_shelf: { solid: 1 }, drawer: { solid: 1 }, wardrobe: { solid: 1, msg: '오늘은 뭘 입을까? 👗 (C 꾸미기)' }, desk: { solid: 1 },
    computer: { solid: 1, toggle: 1, anim: 1 },
    stove: { solid: 1, cook: 1 }, fridge: { solid: 1, msg: '시원해요 ❄️' }, sink: { solid: 1, fx: '💧' }, counter: { solid: 1 },
    microwave: { solid: 1, cook: 1 }, dish_rack: { solid: 1 }, kitchen_shelf: { solid: 1 },
    toilet: { solid: 0, sit: 1 }, bathtub: { solid: 1, lie: 1, fx: '🫧' }, washbasin: { solid: 1, fx: '💧' },
    shower: { solid: 0, toggle: 1, anim: 1 }, mirror: { solid: 1, msg: '오늘도 예뻐요! ✨' }, towel_rack: { solid: 1 },
    washer: { solid: 1, toggle: 1, anim: 1 }, bath_shelf: { solid: 1 },
    aquarium: { solid: 1, anim: 1 }, piano: { solid: 1, fx: '🎵' }, fireplace: { solid: 1, anim: 1, light: 4, cook: 1 },
    trophy: { solid: 1, msg: '반짝반짝 빛나는 트로피 🏆' }, cat_tower: { solid: 1, msg: '냥! 🐱' }, fountain: { solid: 1, anim: 1 },
    xmas_tree: { solid: 1, anim: 1 }, throne: { solid: 1, sit: 1 }, royal_bed: { solid: 1, lie: 1 }, statue: { solid: 1 },
    arcade: { solid: 1, toggle: 1, anim: 1 }, telescope: { solid: 1, msg: '반짝이는 별이 보여요 🌟' },
    chest: { solid: 1, chest: 27 }, chest_big: { solid: 1, chest: 54 }, notice_board: { solid: 1, fixed: 1 },
    snowman: { solid: 1, msg: '차가워요 ⛄' }, teddy_big: { solid: 1, msg: '포근포근 꼬옥 🧸' },
    sofa_blue: { solid: 1, sit: 1 }, sofa_green: { solid: 1, sit: 1 }, bed_pink: { solid: 1, lie: 1 }, bed_blue: { solid: 1, lie: 1 },
    rocking_chair: { solid: 0, sit: 1 }, vanity: { solid: 1, msg: '오늘도 반짝반짝 ✨' }, guitar: { solid: 1, fx: '🎸' }, globe: { solid: 1, msg: '세계 여행 가고 싶다 🌏' },
    bonsai: { solid: 1 }, lantern: { solid: 1, light: 3 }, candle: { solid: 1, light: 3, anim: 1 }, fishbowl: { solid: 1, anim: 1 },
    oven: { solid: 1, cook: 1 }, coffee_machine: { solid: 1, fx: '☕' }, rice_cooker: { solid: 1, cook: 1 }, rubber_duck: { solid: 0, msg: '꽥! 🦆' },
    park_bench: { solid: 1, sit: 1 }, picnic_table: { solid: 1 }, swing: { solid: 0, sit: 1 }, slide: { solid: 1, fx: '🎉' },
    flower_bed: { solid: 1 }, hedge: { solid: 1 }, trash_bin: { solid: 1, msg: '쓰레기는 쓰레기통에! 🗑️' }, vending_machine: { solid: 1, fx: '🥤' },
    parasol: { solid: 1 }, garden_light: { solid: 1, light: 3 },
    cafe_table: { solid: 1 }, cafe_chair: { solid: 0, sit: 1 }, bar_stool: { solid: 0, sit: 1 }, cafe_counter: { solid: 1 },
    cake_showcase: { solid: 1, msg: '어떤 케이크로 할까? 🍰' }, menu_board: { solid: 1, msg: '오늘의 추천: 딸기라떼 🍓' }, bread_shelf: { solid: 1 },
    coffee_cup: { solid: 0, fx: '☕' }, cake: { solid: 0, fx: '🍰' }, bread_basket: { solid: 0, fx: '🥐' },
    dungeon_wall: { solid: 1, fixed: 1 }, dungeon_gate: { solid: 1, fixed: 1 }, dungeon_exit: { solid: 0, fixed: 1, anim: 1, light: 3 },
    job_master: { solid: 1, fixed: 1 }, anvil: { solid: 1, fixed: 1 },
    crystal_lamp: { solid: 1, light: 5 }, scarecrow: { solid: 1 }, windmill: { solid: 1, anim: 1 }, deer_trophy: { solid: 1 },
    music_box: { solid: 1, fx: '🎶' },
  };
  // 벽 색 (윗면, 앞면, 선)
  const WALLS = {
    wall_wood: ['#c99a6b', '#a5703f', '#7a4e2d'],
    wall_stone: ['#c4c0ba', '#9a958e', '#6f6b67'],
    wall_brick: ['#d97d63', '#b45d45', '#8a4232'],
    wall_white: ['#fdfaf3', '#e6dfd1', '#bdb39f'],
    wall_pink: ['#ffd6e0', '#f5aec1', '#d4849b'],
    wall_mint: ['#d2f5e6', '#a3e3c8', '#6fbf9d'],
    wall_blue: ['#d6ecff', '#a9d3f7', '#79a8d6'],
    wall_yellow: ['#fff1c2', '#ffe08a', '#d6b45a'],
    wall_log: ['#b88252', '#8b5a3c', '#5a3520'],
    wall_paper: ['#fff3e6', '#f7d7c4', '#c9a08a'],
    wall_tile: ['#eef8ff', '#cfe8f7', '#9ec3dc'],
    wall_dark: ['#8b5a3c', '#6e4626', '#4a2e1a'],
    wall_gold: ['#ffe27a', '#f2c230', '#b58a12'],
    wall_rainbow: ['#ffffff', '#ff8fab', '#9b8cff'],
    wall_candy: ['#ffffff', '#ff5c8a', '#d63d6c'],
    wall_flower: ['#fff4f7', '#ffe0ea', '#d9a0b3'],
    wall_star: ['#3b3a6b', '#2b2a55', '#1d1c3d'],
    wall_green: ['#cdebc4', '#9fd18f', '#6aa35a'],
    wall_purple: ['#e6dcff', '#c9b8ff', '#9580d6'],
    wall_wainscot: ['#fdfaf3', '#a5703f', '#7a4e2d'],
  };
  for (const t in WALLS) OBJ[t] = Object.assign(OBJ[t] || {}, { solid: 1, wall: 1 });
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.ground) GROUND[it.ground] = Object.assign(GROUND[it.ground] || {}, { item: id });
    if (it.obj) OBJ[it.obj] = Object.assign(OBJ[it.obj] || {}, { item: id });
  }
  const isSolidObj = (o) => !!o && !!(OBJ[o.t] && OBJ[o.t].solid) && !(OBJ[o.t].door && o.open);
  // 돌릴 수 있는 것: 가구 (o.r = 시계 방향으로 90°씩 돌린 횟수, 0 앞 / 1 왼쪽 / 2 뒤 / 3 오른쪽)
  // 어느 쪽에서 봐도 똑같은 물건은 돌리지 않아요
  const NO_ROTATE = new Set(['campfire', 'log_seat', 'plant', 'plant_big', 'cactus', 'bonsai', 'candle', 'lantern', 'cushion', 'beanbag', 'rubber_duck',
    'fishbowl', 'globe', 'snowman', 'statue', 'fountain', 'xmas_tree', 'crystal_lamp', 'trophy', 'music_box', 'teddy', 'teddy_big',
    'flower_bed', 'hedge', 'trash_bin', 'parasol', 'garden_light', 'cafe_table', 'bar_stool', 'coffee_cup', 'cake', 'bread_basket']);
  const canRotate = (t) => !!OBJ[t] && !!OBJ[t].item && ITEMS[OBJ[t].item].cat === 'furniture' && !NO_ROTATE.has(t);
  // 조리대·싱크대·테이블 위에 올릴 수 있는 것 (surface 위에 onTop)
  for (const t of ['counter', 'sink', 'table', 'desk', 'side_table', 'drawer', 'picnic_table', 'cafe_table', 'cafe_counter']) OBJ[t].surface = 1;
  for (const t of ['dish_rack', 'kitchen_shelf', 'microwave', 'coffee_machine', 'rice_cooker', 'fishbowl', 'candle', 'globe', 'bonsai', 'music_box', 'trophy', 'rubber_duck',
    'coffee_cup', 'cake', 'bread_basket'])
    OBJ[t].onTop = 1;
  const ROT_NAMES = ['앞', '왼쪽', '뒤', '오른쪽'];
  const ROT_DIRS = ['down', 'left', 'up', 'right']; // 앉았을 때 바라보는 쪽

  // ───────── 작물 ─────────
  // 물을 주면 stageMs 뒤에 한 단계 자라고, 다시 물이 필요해요 (0 씨앗 → 3 다 자람)
  const CROPS = {
    carrot: { name: '당근', seed: 'seed_carrot', produce: 'carrot', stageMs: 15000, yield: [1, 2] },
    strawberry: { name: '딸기', seed: 'seed_straw', produce: 'strawberry', stageMs: 22000, yield: [2, 3] },
    sunflower: { name: '해바라기', seed: 'seed_sunflower', produce: 'sunflower', stageMs: 28000, yield: [1, 2] },
    pumpkin: { name: '호박', seed: 'seed_pumpkin', produce: 'pumpkin', stageMs: 40000, yield: [1, 1] },
    tomato: { name: '토마토', seed: 'seed_tomato', produce: 'tomato', stageMs: 25000, yield: [2, 3] },
    corn: { name: '옥수수', seed: 'seed_corn', produce: 'corn', stageMs: 32000, yield: [1, 2] },
    potato: { name: '감자', seed: 'seed_potato', produce: 'potato', stageMs: 30000, yield: [2, 4] },
    watermelon: { name: '수박', seed: 'seed_watermelon', produce: 'watermelon', stageMs: 55000, yield: [1, 1] },
  };

  // ───────── 동물 ─────────
  // 집동물: 작물을 먹이면 produceMs 뒤에 선물 / 야생동물: 활이나 X로 사냥 / pet: 따라다니는 강아지
  const FEED = ['carrot', 'strawberry', 'sunflower', 'pumpkin', 'tomato', 'corn', 'potato', 'watermelon'];
  const ANIMALS = {
    chicken: { name: '닭', item: 'animal_chicken', produce: 'egg', produceMs: 30000, speed: 16 },
    cow: { name: '소', item: 'animal_cow', produce: 'milk', produceMs: 45000, speed: 12 },
    sheep: { name: '양', item: 'animal_sheep', produce: 'wool', produceMs: 60000, speed: 14 },
    rabbit: { name: '토끼', wild: 1, hp: 1, drop: { meat: 1 }, speed: 22, flee: 1 },
    boar: { name: '멧돼지', wild: 1, hp: 3, drop: { meat: 2, hide: 1 }, speed: 18 },
    deer: { name: '사슴', wild: 1, hp: 2, drop: { meat: 2, hide: 1 }, speed: 24, flee: 1 },
    dog: { name: '강아지', item: 'pet_dog', pet: 1, speed: 40, col: ['#d9a066', '#b07a4f', '#fff3e0'] },
    dog_white: { name: '하얀 강아지', item: 'pet_dog_white', pet: 1, speed: 40, col: ['#fbf8f2', '#e2dccf', '#ffd1dc'] },
    dog_spot: { name: '점박이 강아지', item: 'pet_dog_spot', pet: 1, speed: 40, col: ['#ffffff', '#3b3740', '#ffd1dc'] },
    cat: { name: '고양이', item: 'pet_cat', pet: 1, speed: 38, look: 'cat', col: ['#ffb36b', '#e8954a', '#fff3e0'] },
    cat_black: { name: '검은 고양이', item: 'pet_cat_black', pet: 1, speed: 38, look: 'cat', col: ['#3b3740', '#2b2233', '#ffe066'] },
    cat_calico: { name: '삼색 고양이', item: 'pet_cat_calico', pet: 1, speed: 38, look: 'cat', col: ['#ffffff', '#ffb36b', '#3b3740'] },
    pbunny: { name: '토끼', item: 'pet_bunny', pet: 1, speed: 36, look: 'bunny', col: ['#fbf8f2', '#ffd1dc', '#e2dccf'] },
    duck: { name: '오리', item: 'animal_duck', produce: 'duck_egg', produceMs: 40000, speed: 14 },
    goat: { name: '염소', item: 'animal_goat', produce: 'goat_milk', produceMs: 55000, speed: 14 },
    pig: { name: '돼지', item: 'animal_pig', produce: 'truffle', produceMs: 80000, speed: 12 },
  };
  const WILD_SPAWN = { rabbit: 8, boar: 4, deer: 4 };
  const BOW_RANGE = 7 * TILE;
  // 펫: 따라다니는 건 1마리, 꺼내 둘 수 있는 수는 레벨에 따라 늘어요
  const maxPets = (lv) => Math.min(10, 2 + Math.floor((lv || 1) / 5));

  // ───────── 지역 ─────────
  // 지역: dungeon(맨 위) / town(마을) / meadow(집 짓는 땅) / cave·forest(맨 아래 생산 구역)
  const zoneAt = (x, y) => {
    if (y < TY) return 'dungeon';
    if (y >= CY) return x < TX ? 'forest' : x < BX ? 'cave' : 'forest';
    if (x >= TX && x < TX + OW && y < TY + OH) return 'town';
    return 'meadow';
  };
  const dungeonStar = (x) => (x < 48 ? 1 : x < 96 ? 2 : 3);  // 던전 지대에서 몇 성 던전인지

  // ───────── 낚시 (지역마다 다른 물고기) ─────────
  const FISH_TABLES = {
    town: [['fish_minnow', 32], ['fish_crucian', 34], ['fish_tropical', 14], ['fish_puffer', 8], ['boot', 8], ['fish_golden', 4]],
    forest: [['fish_minnow', 22], ['fish_trout', 40], ['fish_salmon', 18], ['boot', 10], ['fish_golden', 4]],
    cave: [['fish_blind', 45], ['fish_crucian', 18], ['fish_shrimp', 16], ['boot', 14], ['fish_golden', 5]],
  };
  const FISH_TABLE = FISH_TABLES.town;
  function rollFish(rand, zone, gold) {
    const table = (FISH_TABLES[zone] || FISH_TABLE).map(([id, w]) => [id, gold && id !== 'boot' && w < 20 ? w * 2.5 : gold && id === 'boot' ? w / 3 : w]);
    const total = table.reduce((s, f) => s + f[1], 0);
    let r = rand() * total;
    for (const [id, w] of table) { if ((r -= w) < 0) return id; }
    return table[0][0];
  }

  // ───────── 상점 (탭별) ─────────
  // [아이템, 기본 가격, 필요 레벨]  (레벨이 낮으면 🔒 잠겨 있어요)
  const SHOP_TABS = [
    ['farm', '🌱 농사', [['seed_carrot', 5, 1], ['seed_straw', 10, 1], ['seed_sunflower', 15, 2], ['seed_tomato', 18, 3], ['seed_pumpkin', 25, 4],
      ['seed_corn', 24, 5], ['seed_potato', 22, 7], ['seed_watermelon', 60, 10], ['sapling', 15, 1], ['flower', 5, 1], ['path', 2, 1], ['sand', 2, 1]]],
    ['build', '🧱 벽·바닥', [['wall_white', 3, 1], ['wall_pink', 4, 1], ['wall_mint', 4, 1], ['wall_blue', 4, 1], ['wall_yellow', 4, 1], ['wall_green', 4, 2],
      ['wall_purple', 4, 2], ['wall_paper', 6, 3], ['wall_dark', 5, 3], ['wall_wainscot', 7, 5], ['wall_flower', 8, 6], ['wall_star', 9, 8], ['door_white', 20, 2],
      ['floor_pink', 3, 1], ['floor_check', 3, 1], ['floor_mint', 4, 2], ['floor_kitchen', 4, 2], ['floor_wood_white', 5, 3], ['floor_herring', 5, 4],
      ['floor_straw', 5, 4], ['floor_hex', 6, 5], ['floor_marble', 8, 6], ['floor_stone_tile', 8, 6], ['rug', 6, 2], ['rug_green', 6, 2], ['rug_blue', 6, 3],
      ['carpet_blue', 6, 3], ['carpet_red', 7, 4]]],
    ['furni', '🛋️ 가구', [['chest', 40, 1], ['plant', 25, 1], ['cushion', 30, 1], ['cactus', 35, 2], ['sofa', 60, 2], ['bed', 80, 2], ['side_table', 45, 2],
      ['picture', 40, 2], ['bench', 50, 2], ['plant_big', 50, 3], ['beanbag', 70, 3], ['clock', 60, 3], ['stand_lamp', 60, 3], ['teddy', 100, 3], ['candle', 50, 3],
      ['armchair', 90, 4], ['sofa_blue', 80, 4], ['sofa_green', 80, 4], ['bed_pink', 100, 4], ['bed_blue', 100, 4], ['display_shelf', 70, 4], ['lantern', 70, 4],
      ['rocking_chair', 120, 5], ['globe', 90, 5], ['fishbowl', 110, 5], ['tv', 300, 6], ['vanity', 160, 6], ['bonsai', 140, 6], ['guitar', 220, 7], ['computer', 400, 9]]],
    ['kitchen', '🍳 주방', [['counter', 40, 1], ['stove', 200, 2], ['sink', 150, 2], ['dish_rack', 50, 2], ['fridge', 250, 3], ['kitchen_shelf', 60, 3],
      ['microwave', 120, 4], ['rice_cooker', 150, 5], ['oven', 280, 6], ['coffee_machine', 260, 7], ['floor_kitchen', 4, 2]]],
    ['bath', '🛁 욕실', [['towel_rack', 40, 1], ['toilet', 120, 2], ['washbasin', 100, 2], ['mirror', 70, 2], ['bath_shelf', 50, 2], ['rubber_duck', 30, 3],
      ['bathtub', 220, 4], ['shower', 180, 5], ['washer', 260, 6], ['floor_bath', 4, 2]]],
    ['park', '🌳 공원', [['path_park', 3, 1], ['hedge', 15, 1], ['flower_bed', 30, 1], ['trash_bin', 30, 1], ['park_bench', 70, 2], ['garden_light', 60, 2],
      ['picnic_table', 110, 3], ['parasol', 90, 3], ['swing', 180, 4], ['vending_machine', 260, 5], ['slide', 240, 6]]],
    ['cafe', '☕ 카페', [['floor_cafe', 5, 1], ['cafe_table', 70, 2], ['cafe_chair', 50, 2], ['coffee_cup', 20, 2], ['bar_stool', 60, 3], ['cafe_counter', 80, 3],
      ['cake', 40, 3], ['bread_basket', 40, 3], ['menu_board', 70, 4], ['bread_shelf', 150, 5], ['cake_showcase', 220, 6]]],
    ['animal', '🐶 동물·펫', [['animal_chicken', 80, 1], ['animal_sheep', 180, 3], ['animal_duck', 160, 4], ['animal_cow', 250, 5], ['animal_goat', 320, 8],
      ['animal_pig', 450, 12], ['pet_dog', 400, 2], ['pet_cat', 450, 6], ['pet_cat_black', 550, 8], ['pet_bunny', 500, 9], ['pet_dog_white', 600, 10]]],
    ['adv', '⚔️ 모험', [['wood_sword', 60, 1], ['bow', 120, 1], ['potion_s', 30, 1], ['potion_m', 90, 8], ['potion_l', 220, 16]]],
  ];
  // 사는 가격 배수 (돈이 너무 잘 벌려서 2배로 올렸어요. 파는 가격은 그대로)
  const PRICE_MULT = 2;
  for (const [, , list] of SHOP_TABS) for (const e of list) e[1] = Math.round(e[1] * PRICE_MULT);
  const SHOP = [];
  for (const [, , list] of SHOP_TABS) for (const e of list) if (!SHOP.some((s) => s[0] === e[0])) SHOP.push(e);

  // ───────── 만들기 ─────────
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
    { out: 'torch', n: 4, need: { wood: 2 } },
    { out: 'campfire', n: 1, need: { wood: 5, stone: 3 } },
    { out: 'log_seat', n: 1, need: { wood: 3 } },
    { out: 'bench', n: 1, need: { wood: 4 } },
    { out: 'wall_log', n: 4, need: { wood: 3 } },
    { out: 'wall_tile', n: 4, need: { stone: 2 } },
    { out: 'floor_dark', n: 4, need: { wood: 2 } },
    { out: 'floor_bath', n: 4, need: { stone: 1 } },
    { out: 'floor_marble', n: 4, need: { stone: 3 } },
    { out: 'wall_shelf', n: 1, need: { wood: 2 } },
    { out: 'drawer', n: 1, need: { wood: 4 } },
    { out: 'wardrobe', n: 1, need: { wood: 6 } },
    { out: 'desk', n: 1, need: { wood: 4 } },
    { out: 'counter', n: 2, need: { wood: 3, stone: 1 } },
    { out: 'stove', n: 1, need: { iron: 2, stone: 2 } },
    { out: 'fridge', n: 1, need: { iron: 3 } },
    { out: 'sink', n: 1, need: { iron: 2, stone: 1 } },
    { out: 'kitchen_shelf', n: 1, need: { wood: 2, iron: 1 } },
    { out: 'toilet', n: 1, need: { stone: 4 } },
    { out: 'washbasin', n: 1, need: { stone: 3 } },
    { out: 'bathtub', n: 1, need: { stone: 5, iron: 1 } },
    { out: 'stand_lamp', n: 1, need: { iron: 1, wood: 1 } },
    { out: 'chest', n: 1, need: { wood: 8 } },
    { out: 'chest_big', n: 1, need: { wood: 12, iron: 4 }, lv: 10 },
    // 무기
    { out: 'wood_sword', n: 1, need: { wood: 5 } },
    { out: 'iron_sword', n: 1, need: { iron: 5, wood: 2 }, lv: 10 },
    { out: 'long_bow', n: 1, need: { wood: 8, iron: 2 }, lv: 10 },
    { out: 'staff_basic', n: 1, need: { wood: 4, gem: 1 }, lv: 10 },
    { out: 'kunai', n: 1, need: { iron: 4 }, lv: 10 },
    { out: 'knight_sword', n: 1, need: { iron: 8, gold: 3, bone: 5 }, lv: 15 },
    { out: 'elf_bow', n: 1, need: { wood: 10, gem: 2, ecto: 3 }, lv: 15 },
    { out: 'crystal_staff', n: 1, need: { gem: 4, gold: 2, ecto: 3 }, lv: 15 },
    { out: 'ninja_blade', n: 1, need: { iron: 6, gold: 2, bone: 4 }, lv: 15 },
  ];
  for (const [tier, t] of Object.entries(ARMOR_TIERS)) ARMOR_PARTS.forEach(([part, , n]) => RECIPES.push({ out: `${tier}_${part}`, n: 1, need: { [t.mat]: n }, lv: t.lv }));

  // ───────── 요리 (가스레인지·전자레인지·모닥불·벽난로 앞에서 E) ─────────
  // lv: 이 레벨부터 만들 수 있어요
  const COOK = [
    { out: 'carrot_soup', need: { carrot: 2 }, lv: 1 },
    { out: 'fried_egg', need: { egg: 1 }, lv: 1 },
    { out: 'grilled_fish', need: { fish_crucian: 1 }, lv: 1 },
    { out: 'steak', need: { meat: 1 }, lv: 1 },
    { out: 'strawberry_jam', need: { strawberry: 3 }, lv: 2 },
    { out: 'strawberry_milk', need: { strawberry: 1, milk: 1 }, lv: 2 },
    { out: 'omelet', need: { egg: 2, milk: 1 }, lv: 3 },
    { out: 'tomato_soup', need: { tomato: 2 }, lv: 3 },
    { out: 'sun_cookie', need: { sunflower: 1, egg: 1 }, lv: 3 },
    { out: 'trout_grill', need: { fish_trout: 1, mushroom: 1 }, lv: 4 },
    { out: 'salad', need: { tomato: 1, carrot: 1 }, lv: 4 },
    { out: 'duck_egg_roll', need: { duck_egg: 2 }, lv: 4 },
    { out: 'mushroom_soup', need: { mushroom: 2, milk: 1 }, lv: 4 },
    { out: 'berry_tart', need: { berry: 3, egg: 1 }, lv: 5 },
    { out: 'bbq', need: { meat: 2, carrot: 1 }, lv: 5 },
    { out: 'pumpkin_pie', need: { pumpkin: 1, egg: 1, milk: 1 }, lv: 5 },
    { out: 'corn_soup', need: { corn: 2, milk: 1 }, lv: 5 },
    { out: 'veggie_stew', need: { carrot: 1, pumpkin: 1, mushroom: 1 }, lv: 6 },
    { out: 'sashimi', need: { fish_tropical: 1, fish_puffer: 1 }, lv: 6 },
    { out: 'baked_potato', need: { potato: 1 }, lv: 7 },
    { out: 'cave_stew', need: { fish_blind: 1, mushroom: 1 }, lv: 7 },
    { out: 'fries', need: { potato: 2 }, lv: 8 },
    { out: 'pizza', need: { tomato: 1, goat_milk: 1, corn: 1 }, lv: 9 },
    { out: 'golden_dish', need: { fish_golden: 1, carrot: 2, mushroom: 2 }, lv: 10 },
    { out: 'watermelon_juice', need: { watermelon: 1 }, lv: 10 },
    { out: 'truffle_pasta', need: { truffle: 1, egg: 1 }, lv: 12 },
  ];
  const FOOD_BUFF_MS = 30000;

  // ───────── 아바타 ─────────
  const SKINS = ['#ffe0c2', '#f6caa0', '#dba578', '#9a6545'];
  const HAIR_STYLES = [
    { id: 'short', name: '짧은 머리' }, { id: 'long', name: '긴 머리' }, { id: 'twin', name: '양갈래' },
    { id: 'bob', name: '단발' }, { id: 'bun', name: '똥머리' }, { id: 'spiky', name: '삐죽 머리' },
    { id: 'pony', name: '포니테일' }, { id: 'curly', name: '뽀글머리' },
  ];
  const HAIR_COLORS = ['#5b3a29', '#2b2233', '#a8643a', '#f2d16b', '#ff9ec4', '#8ab6ff', '#c9c9d3', '#b8e986'];
  const EYES = [
    { id: 'dot', name: '동글' }, { id: 'happy', name: '웃는 눈' }, { id: 'sparkle', name: '반짝' },
    { id: 'sleepy', name: '졸린 눈' }, { id: 'wink', name: '윙크' },
  ];
  // price: 상점에서 사요 / quest: 퀘스트·도감 보상으로만 (돈으로 못 사요)
  const TOPS = [
    { id: 'tshirt', name: '티셔츠' }, { id: 'hoodie', name: '후드티' }, { id: 'stripe', name: '줄무늬' },
    { id: 'dress', name: '원피스' }, { id: 'overalls', name: '멜빵' }, { id: 'shirt', name: '셔츠' },
    { id: 'suit', name: '정장', price: 400, lv: 6 }, { id: 'sailor', name: '세일러복', price: 350, lv: 5 }, { id: 'startee', name: '별무늬 티', price: 300, lv: 3 },
    { id: 'chefcoat', name: '요리사복', quest: 1 }, { id: 'armor', name: '기사 갑옷', quest: 1 },
    { id: 'hanbok', name: '한복', quest: 1 }, { id: 'royal', name: '왕실 드레스', quest: 1 },
    { id: 'pajama', name: '잠옷', price: 200, lv: 2 }, { id: 'jersey', name: '체육복', price: 250, lv: 3 }, { id: 'raincoat', name: '우비', price: 300, lv: 4 },
    { id: 'pirate', name: '해적 옷', quest: 1 },
  ];
  const CLOTH = ['#ff8fab', '#ffb36b', '#ffd95e', '#7ed492', '#6ec6ff', '#9b8cff', '#c9a0ff', '#f5f5f5', '#4a3b5c', '#e85d5d', '#8b5a3c', '#555a6e'];
  const ACCESSORIES = [
    { id: 'none', name: '없음' }, { id: 'ribbon', name: '리본' }, { id: 'flower', name: '꽃핀' }, { id: 'glasses', name: '안경' },
    { id: 'cap', name: '모자', price: 150, lv: 1 }, { id: 'bunny', name: '토끼 귀', price: 300, lv: 4 }, { id: 'beanie', name: '털모자', price: 200, lv: 2 },
    { id: 'beret', name: '베레모', price: 250, lv: 3 }, { id: 'headphones', name: '헤드폰', price: 350, lv: 5 }, { id: 'sunglasses', name: '선글라스', price: 300, lv: 6 },
    { id: 'frog', name: '개구리 모자', price: 400, lv: 8 }, { id: 'bearears', name: '곰 귀', price: 300, lv: 4 }, { id: 'partyhat', name: '고깔모자', price: 350, lv: 7 },
    { id: 'starpin', name: '별핀' }, { id: 'piratehat', name: '해적 모자', quest: 1 },
    { id: 'catears', name: '고양이 귀', quest: 1 }, { id: 'crown', name: '왕관', quest: 1 }, { id: 'chef', name: '요리사 모자', quest: 1 },
    { id: 'strawhat', name: '밀짚모자', quest: 1 }, { id: 'fishhat', name: '물고기 모자', quest: 1 }, { id: 'flowercrown', name: '꽃 왕관', quest: 1 },
    { id: 'horns', name: '악마 뿔', quest: 1 }, { id: 'halo', name: '천사 링', quest: 1 }, { id: 'witch', name: '마법사 모자', quest: 1 },
    { id: 'santa', name: '산타 모자', quest: 1 }, { id: 'tiara', name: '티아라', quest: 1 },
  ];
  const BACKS = [
    { id: 'none', name: '없음' },
    { id: 'backpack', name: '배낭', price: 250, lv: 3 }, { id: 'cattail', name: '고양이 꼬리', price: 300, lv: 5 }, { id: 'cape', name: '망토', price: 400, lv: 8 },
    { id: 'wings', name: '천사 날개', quest: 1 }, { id: 'fairy', name: '요정 날개', quest: 1 }, { id: 'batwings', name: '박쥐 날개', quest: 1 },
    { id: 'balloon', name: '풍선', price: 300, lv: 6 }, { id: 'guitarback', name: '기타 메기', price: 350, lv: 7 }, { id: 'jetpack', name: '제트팩', quest: 1 },
  ];
  for (const list of [TOPS, ACCESSORIES, BACKS]) for (const c of list) if (c.price) c.price = Math.round(c.price * PRICE_MULT);
  const COSMETICS = {}; // id -> { id, name, slot, price?, quest? }
  ACCESSORIES.forEach((a) => { COSMETICS[a.id] = Object.assign({ slot: 'acc' }, a); });
  TOPS.forEach((a) => { COSMETICS[a.id] = Object.assign({ slot: 'top' }, a); });
  BACKS.forEach((a) => { if (a.id !== 'none') COSMETICS[a.id] = Object.assign({ slot: 'back' }, a); });
  const isLocked = (c) => !!c && !!(c.price || c.quest);
  const FREE_ACC = ACCESSORIES.filter((a) => !isLocked(a)).map((a) => a.id);

  function defaultAvatar(rand) {
    const r = (n) => Math.floor(rand() * n);
    return { skin: 0, hs: r(6), hc: r(3), eyes: 0, blush: 1, top: 0, tc: r(7), bc: 8, acc: 'none', back: 'none' };
  }
  function sanitizeAvatar(a, unlocked) {
    a = a || {};
    unlocked = unlocked || FREE_ACC;
    const int = (v, n, d) => (Number.isInteger(v) && v >= 0 && v < n ? v : d);
    const ok = (id) => { const c = COSMETICS[id]; return !!c && (!isLocked(c) || unlocked.includes(id)); };
    let top = int(a.top, TOPS.length, 0);
    if (!ok(TOPS[top].id)) top = 0;
    return {
      skin: int(a.skin, SKINS.length, 0), hs: int(a.hs, HAIR_STYLES.length, 0), hc: int(a.hc, HAIR_COLORS.length, 0),
      eyes: int(a.eyes, EYES.length, 0), blush: a.blush ? 1 : 0, top,
      tc: int(a.tc, CLOTH.length, 0), bc: int(a.bc, CLOTH.length, 8),
      acc: ACCESSORIES.some((x) => x.id === a.acc) && ok(a.acc) ? a.acc : 'none',
      back: BACKS.some((x) => x.id === a.back) && (a.back === 'none' || ok(a.back)) ? a.back : 'none',
    };
  }

  // ───────── 도감 (처음 얻으면 등록, 다 모으면 보상) ─────────
  const COLLECTIONS = [
    { id: 'fish', name: '🎣 낚시 도감', entries: ['fish_minnow', 'fish_crucian', 'fish_tropical', 'fish_puffer', 'fish_golden', 'fish_trout', 'fish_salmon', 'fish_blind', 'fish_shrimp', 'boot'], reward: { coins: 800, exp: 300, unlock: 'fishhat' } },
    { id: 'farm', name: '🌱 농사 도감', entries: ['carrot', 'strawberry', 'sunflower', 'pumpkin', 'tomato', 'corn', 'potato', 'watermelon'], reward: { coins: 600, exp: 300, unlock: 'strawhat' } },
    { id: 'cook', name: '🍳 요리 도감', entries: COOK.map((r) => r.out), reward: { coins: 1500, exp: 600, unlock: 'chefcoat' } },
    { id: 'hunt', name: '🏹 사냥 도감', entries: ['hunt:rabbit', 'hunt:boar', 'hunt:deer'], reward: { coins: 300, exp: 150, items: { deer_trophy: 1 } } },
    { id: 'ranch', name: '🐔 목장 도감', entries: ['egg', 'milk', 'wool', 'duck_egg', 'goat_milk', 'truffle'], reward: { coins: 600, exp: 300, items: { windmill: 1 } } },
    { id: 'mine', name: '⛏ 광석 도감', entries: ['stone', 'iron', 'gold', 'gem'], reward: { coins: 500, exp: 200, items: { crystal_lamp: 1 } } },
    { id: 'forage', name: '🍄 채집 도감', entries: ['wood', 'mushroom', 'berry', 'pinecone'], reward: { coins: 300, exp: 150, unlock: 'fairy' } },
  ];
  const COL_INDEX = {};
  COLLECTIONS.forEach((c) => c.entries.forEach((e) => { COL_INDEX[e] = c.id; }));
  const colName = (e) => (e.startsWith('hunt:') ? ANIMALS[e.slice(5)].name : ITEMS[e].name);

  // ───────── 업적 퀘스트 (한 번만) ─────────
  // 보상은 대부분 코인 + 경험치. 아이템은 가끔, 상점에서 못 사는 것만 (퀘스트 전용·광석·요리·만들기 전용)
  const QUESTS = [
    { id: 'q_fish1', name: '첫 손맛', desc: '물고기 1마리 낚기', stat: 'fish', goal: 1, reward: { coins: 50, exp: 20 } },
    { id: 'q_farm1', name: '꼬마 농부', desc: '작물 3개 수확하기', stat: 'harvest', goal: 3, reward: { coins: 60, exp: 20 } },
    { id: 'q_wood', name: '나무꾼', desc: '나무 10개 모으기 (나무 앞에서 X)', stat: 'wood', goal: 10, reward: { coins: 80, exp: 25 } },
    { id: 'q_sign', name: '여긴 내 땅!', desc: '표지판 1개 세우기', stat: 'sign', goal: 1, reward: { coins: 40, exp: 15 } },
    { id: 'q_path', name: '길을 만들자', desc: '길 블록 15개 깔기', stat: 'pathPlaced', goal: 15, reward: { coins: 60, exp: 25, items: { stone_path: 20 } } },
    { id: 'q_style', name: '멋쟁이', desc: '꾸미기(C)에서 아바타 저장하기', stat: 'avatar', goal: 1, reward: { exp: 15, unlock: 'catears' } },
    { id: 'q_stone', name: '채석장 일꾼', desc: '돌 10개 모으기 (바위 앞에서 X)', stat: 'stone', goal: 10, reward: { coins: 60, exp: 25, items: { torch: 6 } } },
    { id: 'q_build', name: '내 집 마련', desc: '벽·창문·문 30개 세우기', stat: 'wallPlaced', goal: 30, reward: { coins: 200, exp: 60, items: { window: 2 } } },
    { id: 'q_deco', name: '인테리어 디자이너', desc: '가구 10개 놓기', stat: 'furniturePlaced', goal: 10, reward: { coins: 200, exp: 60 } },
    { id: 'q_chat', name: '수다쟁이', desc: '채팅 20번 하기', stat: 'chat', goal: 20, reward: { coins: 100, exp: 30, items: { teddy_big: 1 } } },
    { id: 'q_sell', name: '장사꾼', desc: '상점에 팔아서 500코인 벌기', stat: 'earned', goal: 500, reward: { exp: 60, items: { gold: 3 } } },
    { id: 'q_fish15', name: '낚시왕', desc: '물고기 15마리 낚기', stat: 'fish', goal: 15, reward: { exp: 80, unlock: 'crown' } },
    { id: 'q_farm25', name: '풍년이다!', desc: '작물 25개 수확하기', stat: 'harvest', goal: 25, reward: { coins: 400, exp: 100 } },
    { id: 'q_ranch', name: '목장 주인', desc: '동물에게 작물 5번 먹이기', stat: 'feed', goal: 5, reward: { coins: 150, exp: 50 } },
    { id: 'q_produce', name: '신선한 선물', desc: '동물 선물(달걀·우유 등) 5개 모으기', stat: 'produce', goal: 5, reward: { coins: 100, exp: 50, items: { omelet: 2 } } },
    { id: 'q_hunt', name: '사냥꾼', desc: '야생 동물 3마리 사냥하기 (활은 상점에서)', stat: 'hunt', goal: 3, reward: { coins: 200, exp: 60 } },
    { id: 'q_cook1', name: '꼬마 요리사', desc: '요리 1번 하기 (가스레인지·모닥불 앞에서 E)', stat: 'cook', goal: 1, reward: { coins: 80, exp: 20 } },
    { id: 'q_cook10', name: '요리 솜씨', desc: '요리 10번 하기', stat: 'cook', goal: 10, reward: { exp: 80, unlock: 'chef' } },
    { id: 'q_cook50', name: '셰프의 길', desc: '요리 50번 하기', stat: 'cook', goal: 50, reward: { coins: 500, exp: 250, items: { fireplace: 1 } } },
    { id: 'q_eat', name: '먹방', desc: '음식 5번 먹기 (요리를 들고 Space)', stat: 'eat', goal: 5, reward: { coins: 150, exp: 40 } },
    { id: 'q_iron', name: '광부', desc: '철광석 10개 캐기 (동굴)', stat: 'iron', goal: 10, reward: { coins: 150, exp: 60 } },
    { id: 'q_gold', name: '골드러시', desc: '금광석 5개 캐기', stat: 'gold', goal: 5, reward: { exp: 100, items: { statue: 1 } } },
    { id: 'q_gem', name: '보석 사냥꾼', desc: '수정 3개 캐기', stat: 'gem', goal: 3, reward: { exp: 120, items: { crystal_lamp: 1 } } },
    { id: 'q_mush', name: '버섯 따기', desc: '버섯 10개 따기 (숲에서 E)', stat: 'mushroom', goal: 10, reward: { coins: 120, exp: 40 } },
    { id: 'q_berry', name: '산딸기 소녀', desc: '산딸기 15개 따기', stat: 'berry', goal: 15, reward: { exp: 60, unlock: 'flowercrown' } },
    { id: 'q_wood100', name: '숲의 나무꾼', desc: '나무 100개 모으기', stat: 'wood', goal: 100, reward: { coins: 200, exp: 150, items: { windmill: 1 } } },
    { id: 'q_hunt10', name: '숲의 사냥꾼', desc: '야생 동물 10마리 사냥하기', stat: 'hunt', goal: 10, reward: { exp: 150, unlock: 'horns' } },
    { id: 'q_sit', name: '쉬어가요', desc: '의자·소파에 5번 앉기 (E)', stat: 'sit', goal: 5, reward: { coins: 60, exp: 20 } },
    { id: 'q_tv', name: '텔레비전 보자', desc: 'TV 5번 켜기', stat: 'tv', goal: 5, reward: { exp: 60, items: { arcade: 1 } } },
    { id: 'q_sleep', name: '꿀잠', desc: '침대에 3번 눕기 (E)', stat: 'lie', goal: 3, reward: { exp: 40, items: { music_box: 1 } } },
    { id: 'q_trade1', name: '첫 거래', desc: '친구와 1번 거래하기 (접속자 목록 🤝)', stat: 'trade', goal: 1, reward: { coins: 100, exp: 30 } },
    { id: 'q_trade10', name: '무역왕', desc: '친구와 10번 거래하기', stat: 'trade', goal: 10, reward: { exp: 150, items: { trophy: 1 } } },
    { id: 'q_pet', name: '멍멍이 친구', desc: '펫 10번 쓰다듬기 (E)', stat: 'pet', goal: 10, reward: { exp: 60, items: { cat_tower: 1 } } },
    { id: 'q_fish50', name: '바다의 전설', desc: '물고기 50마리 낚기', stat: 'fish', goal: 50, reward: { exp: 300, items: { rod_gold: 1 } } },
    { id: 'q_farm100', name: '대농장주', desc: '작물 100개 수확하기', stat: 'harvest', goal: 100, reward: { exp: 300, items: { can_gold: 1 } } },
    { id: 'q_col10', name: '수집가', desc: '도감 10칸 채우기', stat: 'col', goal: 10, reward: { exp: 150, items: { aquarium: 1 } } },
    { id: 'q_col30', name: '박물관장', desc: '도감 30칸 채우기', stat: 'col', goal: 30, reward: { exp: 400, unlock: 'wings' } },
    { id: 'q_daily10', name: '성실한 하루', desc: '일간 퀘스트 10개 깨기', stat: 'dailyDone', goal: 10, reward: { exp: 200, unlock: 'halo' } },
    { id: 'q_daily50', name: '퀘스트 마스터', desc: '일간 퀘스트 50개 깨기', stat: 'dailyDone', goal: 50, reward: { exp: 500, items: { throne: 1 } } },
    { id: 'q_weekly5', name: '한 주 한 주', desc: '주간 퀘스트 5개 깨기', stat: 'weeklyDone', goal: 5, reward: { exp: 300, items: { floor_star: 30 } } },
    { id: 'q_rich', name: '부자', desc: '상점에 팔아서 5000코인 벌기', stat: 'earned', goal: 5000, reward: { exp: 400, items: { wall_gold: 30 } } },
    { id: 'q_furn50', name: '인테리어 장인', desc: '가구 50개 놓기', stat: 'furniturePlaced', goal: 50, reward: { exp: 300, items: { piano: 1 } } },
    { id: 'q_build100', name: '건축가', desc: '벽·창문·문 100개 세우기', stat: 'wallPlaced', goal: 100, reward: { exp: 300, items: { wall_candy: 30 } } },
    { id: 'q_path100', name: '길 닦는 사람', desc: '길 블록 100개 깔기', stat: 'pathPlaced', goal: 100, reward: { exp: 300, items: { fountain: 1 } } },
    { id: 'q_plant', name: '씨앗 뿌리기', desc: '씨앗 30개 심기', stat: 'plant', goal: 30, reward: { coins: 200, exp: 100, items: { scarecrow: 1 } } },
    { id: 'q_water', name: '물 주기 달인', desc: '물 50번 주기', stat: 'water', goal: 50, reward: { coins: 200, exp: 80 } },
    { id: 'q_produce30', name: '목장의 아침', desc: '동물 선물 30개 모으기', stat: 'produce', goal: 30, reward: { exp: 200, items: { pet_dog_spot: 1 } } },
    { id: 'q_spend', name: '쇼핑왕', desc: '상점에서 3000코인 쓰기', stat: 'spent', goal: 3000, reward: { exp: 200, unlock: 'witch' } },
    { id: 'q_chat100', name: '인싸', desc: '채팅 100번 하기', stat: 'chat', goal: 100, reward: { exp: 200, items: { telescope: 1 } } },
    // v5
    { id: 'q_lv5', name: '쑥쑥 성장', desc: '레벨 5 달성하기', stat: 'level', goal: 5, reward: { coins: 300 } },
    { id: 'q_lv10', name: '마을의 기둥', desc: '레벨 10 달성하기', stat: 'level', goal: 10, reward: { coins: 800, items: { snowman: 1 } } },
    { id: 'q_lv15', name: '베테랑', desc: '레벨 15 달성하기', stat: 'level', goal: 15, reward: { coins: 1500, unlock: 'piratehat' } },
    { id: 'q_lv20', name: '전설의 주민', desc: '레벨 20 달성하기', stat: 'level', goal: 20, reward: { coins: 3000, unlock: 'jetpack' } },
    { id: 'q_post', name: '마을 소식통', desc: '마을 게시판 건의함에 글 1개 쓰기', stat: 'post', goal: 1, reward: { coins: 100, exp: 30 } },
    { id: 'q_newcrop', name: '새 작물 농부', desc: '토마토·옥수수·감자·수박 중 10개 수확', stat: 'newcrop', goal: 10, reward: { coins: 300, exp: 120 } },
    { id: 'q_pets3', name: '펫 부자', desc: '펫 3마리 꺼내 두기', stat: 'petsOut', goal: 3, reward: { exp: 200, items: { pet_cat_calico: 1 } } },
    { id: 'q_mvp', name: '금주의 MVP', desc: '금주의 MVP 1등 하기', stat: 'mvpWin', goal: 1, reward: { exp: 500, unlock: 'pirate' } },
    { id: 'q_chain10', name: '도전자', desc: '레벨 퀘스트 10개 깨기', stat: 'chainDone', goal: 10, reward: { coins: 300, exp: 200 } },
    { id: 'q_chain30', name: '끝없는 도전', desc: '레벨 퀘스트 30개 깨기', stat: 'chainDone', goal: 30, reward: { exp: 500, items: { teddy_big: 1 } } },
    { id: 'q_cafe', name: '카페 사장님', desc: '가구 20개 놓기', stat: 'furniturePlaced', goal: 20, reward: { coins: 300, exp: 100 } },
    // v7 전투
    { id: 'q_kill1', name: '첫 전투', desc: '던전 몬스터 1마리 처치 (Lv.5부터 1성 던전)', stat: 'kill', goal: 1, reward: { coins: 100, exp: 40, items: { potion_s: 3 } } },
    { id: 'q_kill100', name: '몬스터 사냥꾼', desc: '던전 몬스터 100마리 처치', stat: 'kill', goal: 100, reward: { coins: 800, exp: 400 } },
    { id: 'q_kill500', name: '전장의 영웅', desc: '던전 몬스터 500마리 처치', stat: 'kill', goal: 500, reward: { coins: 3000, exp: 1500 } },
    { id: 'q_boss1', name: '킹슬라임 토벌', desc: '1성 던전 보스 처치에 참여', stat: 'boss1', goal: 1, reward: { coins: 300, exp: 200 } },
    { id: 'q_boss2', name: '해골 기사 토벌', desc: '2성 던전 보스 처치에 참여', stat: 'boss2', goal: 1, reward: { coins: 800, exp: 600 } },
    { id: 'q_boss3', name: '드래곤 토벌', desc: '3성 던전 보스 처치에 참여', stat: 'boss3', goal: 1, reward: { coins: 3000, exp: 2000 } },
    { id: 'q_job', name: '새로운 길', desc: '전직하기 (Lv.10, 마을 전직 교관)', stat: 'jobChanged', goal: 1, reward: { coins: 500, exp: 200 } },
    { id: 'q_en5', name: '대장장이 수습', desc: '무기 +5 강화 성공 (마을 대장간)', stat: 'enMax', goal: 5, reward: { coins: 500, exp: 300 } },
    { id: 'q_armor', name: '완전 무장', desc: '갑옷 4부위 모두 장착하기', stat: 'armorParts', goal: 4, reward: { coins: 300, exp: 200 } },
  ];

  // ───────── 일간 / 주간 / 월간 퀘스트 ─────────
  // 일간: 3개, 깨면 레벨이 올라 더 어려운 퀘스트가 새로 나와요. 한국 시간 00시에 초기화
  // 주간: 4개, 일요일 00시에 초기화 / 월간: 3개, 다음 달 1일 00시에 초기화
  // 보상: 코인 + 경험치. 아이템은 가끔 (일간 3레벨마다, 주간 절반, 월간 전부) — 모두 상점에서 못 사는 것
  const PQ_TEMPLATES = [
    { stat: 'fish', n: 3, coin: 40, t: '물고기 {n}마리 낚기' },
    { stat: 'harvest', n: 5, coin: 40, t: '작물 {n}개 수확하기' },
    { stat: 'wood', n: 15, coin: 30, t: '나무 {n}개 모으기' },
    { stat: 'stone', n: 10, coin: 30, t: '돌 {n}개 모으기' },
    { stat: 'cook', n: 2, coin: 50, t: '요리 {n}번 하기' },
    { stat: 'feed', n: 3, coin: 35, t: '동물에게 밥 {n}번 주기' },
    { stat: 'produce', n: 2, coin: 40, t: '동물 선물 {n}개 받기' },
    { stat: 'hunt', n: 2, coin: 45, t: '야생 동물 {n}마리 사냥하기' },
    { stat: 'chat', n: 5, coin: 20, t: '채팅 {n}번 하기' },
    { stat: 'earned', n: 150, coin: 40, t: '상점에 팔아서 {n}코인 벌기' },
    { stat: 'plant', n: 5, coin: 30, t: '씨앗 {n}개 심기' },
    { stat: 'water', n: 8, coin: 30, t: '물 {n}번 주기' },
    { stat: 'mushroom', n: 3, coin: 35, t: '버섯 {n}개 따기' },
    { stat: 'berry', n: 4, coin: 30, t: '산딸기 {n}개 따기' },
    { stat: 'iron', n: 3, coin: 45, t: '철광석 {n}개 캐기' },
    { stat: 'eat', n: 1, coin: 30, t: '음식 {n}번 먹기' },
  ];
  const DAILY_BONUS = [{ mushroom: 4 }, { iron: 3 }, { gold: 1 }, { gem: 1 }, { omelet: 1 }, { steak: 2 }, { berry_tart: 1 }, { torch: 6 }];
  const WEEKLY_POOL = [{ piano: 1 }, { fireplace: 1 }, { cat_tower: 1 }, { arcade: 1 }, { telescope: 1 }, { floor_star: 20 }, { rug_rainbow: 20 },
    { wall_candy: 20 }, { wall_rainbow: 20 }, { xmas_tree: 1 }, { music_box: 1 }, { aquarium: 1 }, { fountain: 1 }, { crystal_lamp: 1 }, { snowman: 1 }, { teddy_big: 1 }];
  const MONTHLY_POOL = [{ unlock: 'santa' }, { unlock: 'tiara' }, { unlock: 'armor' }, { unlock: 'hanbok' }, { unlock: 'royal' }, { unlock: 'batwings' },
    { items: { throne: 1 } }, { items: { royal_bed: 1 } }, { items: { floor_gold: 30 } }, { items: { wall_gold: 30 } }, { items: { trophy: 1 } },
    { items: { rod_gold: 1 } }, { items: { can_gold: 1 } }, { items: { pet_dog_spot: 1 } }, { items: { statue: 1 } }, { items: { pet_cat_calico: 1 } }];
  // c = ⬆️ 레벨 퀘스트 (깰 때마다 단계가 올라 더 어려워져요, 초기화 없음)
  const PQ_SLOTS = { d: 3, w: 4, m: 3, c: 3 };
  const PQ_NAMES = { d: '일간', w: '주간', m: '월간', c: '레벨' };

  // 한국 시간 기준 기간 (서버가 외국에 있어도 한국 자정에 바뀌어요)
  const KST = 9 * 3600e3, DAY = 864e5;
  function periods(now) {
    const d = new Date(now + KST);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate(), wd = d.getUTCDay();
    const dayStart = Date.UTC(y, m, day) - KST;
    const sun = Date.UTC(y, m, day - wd) - KST;
    return {
      d: { key: `${y}-${m + 1}-${day}`, ends: dayStart + DAY },
      w: { key: 'w' + new Date(sun + KST).toISOString().slice(0, 10), ends: sun + 7 * DAY },
      m: { key: `${y}-${m + 1}`, ends: Date.UTC(y, m + 1, 1) - KST },
    };
  }
  // 퀘스트 하나 만들기 (type: d/w/m, lv: 일간 레벨, seed: 섞는 값, avoid: 피할 stat)
  function makePQ(type, lv, seed, avoid) {
    const pool = PQ_TEMPLATES.filter((t) => !avoid.includes(t.stat));
    const tpl = pool[Math.floor(strHash(seed + ':t') * pool.length)] || PQ_TEMPLATES[0];
    let goal, reward;
    if (type === 'c') {
      // ⬆️ 레벨 퀘스트: 단계(lv)가 오를수록 목표·보상이 커져요. 3단계마다 아이템
      goal = Math.max(1, Math.round(tpl.n * (1 + 0.3 * lv)));
      reward = { coins: Math.round(tpl.coin * (1 + 0.25 * lv)), exp: Math.round(15 * (1 + 0.3 * lv)) };
      if (lv % 3 === 2) reward.items = Object.assign({}, DAILY_BONUS[Math.floor(strHash(seed + ':b') * DAILY_BONUS.length)]);
    } else if (type === 'd') {
      // 📅 일간: 매일 3개, 난이도 고정 (내 레벨이 높으면 조금만 늘어요)
      const k = 1 + 0.1 * Math.floor((lv || 1) / 5);
      goal = Math.max(1, Math.round(tpl.n * 1.3 * k));
      reward = { coins: Math.round(tpl.coin * 1.5), exp: 25 };
      if (strHash(seed + ':i') < 0.34) reward.items = Object.assign({}, DAILY_BONUS[Math.floor(strHash(seed + ':b') * DAILY_BONUS.length)]);
    } else if (type === 'w') {
      goal = tpl.n * 6;
      reward = { coins: tpl.coin * 5, exp: 120 };
      if (strHash(seed + ':i') < 0.5) reward.items = Object.assign({}, WEEKLY_POOL[Math.floor(strHash(seed + ':r') * WEEKLY_POOL.length)]);
      else reward.coins += 150;
    } else {
      goal = tpl.n * 20;
      const r = MONTHLY_POOL[Math.floor(strHash(seed + ':r') * MONTHLY_POOL.length)];
      reward = Object.assign({ coins: tpl.coin * 15, exp: 400 }, r.items ? { items: Object.assign({}, r.items) } : {}, r.unlock ? { unlock: r.unlock } : {});
    }
    return { stat: tpl.stat, goal, desc: tpl.t.replace('{n}', goal), reward, lv };
  }

  // ───────── 레벨 ─────────
  // 다음 레벨까지 필요한 경험치: 처음엔 적고 갈수록 많이 필요해요 (Lv1→2: 20, Lv5→6: 263, Lv10→11: 796, Lv20→21: 2414)
  const expToNext = (lv) => Math.round(20 * Math.pow(lv, 1.6));
  function levelInfo(exp) {
    let lv = 1, left = exp || 0;
    while (left >= expToNext(lv) && lv < 99) { left -= expToNext(lv); lv++; }
    return { lv, cur: left, need: expToNext(lv) };
  }
  // 활동 경험치 (stat 이름 → 1번당 경험치)
  const EXP = { harvest: 2, fish: 4, wood: 1, stone: 1, iron: 3, gold: 5, gem: 8, cook: 5, produce: 3, hunt: 6, mushroom: 2, berry: 1, pinecone: 1, plant: 1, feed: 1, trade: 5 };
  // 가방 칸: Lv.10 → 45칸, Lv.20 → 54칸
  const invSize = (lv) => 36 + (lv >= 10 ? 9 : 0) + (lv >= 20 ? 9 : 0);
  // 레벨마다 해금되는 것 (상점 아이템·요리·만들기·꾸미기·가방·펫 수)
  function levelUnlocks(lv) {
    const out = [];
    for (const [, , list] of SHOP_TABS) for (const [id, , l] of list) if (l === lv && !out.includes(`🛒 ${ITEMS[id].name}`)) out.push(`🛒 ${ITEMS[id].name}`);
    for (const r of COOK) if (r.lv === lv && lv > 1) out.push(`🍳 ${ITEMS[r.out].name}`);
    for (const r of RECIPES) if (r.lv === lv) out.push(`🔨 ${ITEMS[r.out].name}`);
    for (const list of [TOPS, ACCESSORIES, BACKS]) for (const c of list) if (c.lv === lv && lv > 1) out.push(`👗 ${c.name}`);
    if (invSize(lv) > invSize(lv - 1)) out.push(`🎒 가방 ${invSize(lv)}칸`);
    if (lv > 1 && maxPets(lv) > maxPets(lv - 1)) out.push(`🐾 펫 ${maxPets(lv)}마리까지`);
    return out;
  }
  const shopLv = (id) => { for (const [, , list] of SHOP_TABS) for (const e of list) if (e[0] === id) return e[2] || 1; return 1; };

  // ───────── 금주의 MVP (일요일 00시에 정해요) ─────────
  const MVP_CATS = [
    { id: 'money', name: '💰 부자 MVP', desc: '상점에 팔아서 번 코인', unit: '코인' },
    { id: 'quest', name: '🏆 퀘스트 MVP', desc: '깬 퀘스트 수 (일간·주간·월간·업적)', unit: '개' },
    { id: 'maker', name: '🌾 장인 MVP', desc: '수확·낚시·요리한 개수', unit: '개' },
  ];
  // stat → MVP 항목
  const MVP_STAT = { earned: 'money', dailyDone: 'quest', chainDone: 'quest', weeklyDone: 'quest', monthlyDone: 'quest', questDone: 'quest', harvest: 'maker', fish: 'maker', cook: 'maker' };
  const MVP_PRIZE = [{ coins: 1000, exp: 300 }, { coins: 500, exp: 150 }, { coins: 300, exp: 80 }];

  // 보상에 쓰인 꾸미기 아이템 출처 (상점 화면에 표시)
  const COSMETIC_SRC = {};
  QUESTS.forEach((q) => { if (q.reward.unlock) COSMETIC_SRC[q.reward.unlock] = `퀘스트: ${q.name}`; });
  COLLECTIONS.forEach((c) => { if (c.reward.unlock) COSMETIC_SRC[c.reward.unlock] = `${c.name} 완성`; });
  MONTHLY_POOL.forEach((r) => { if (r.unlock) COSMETIC_SRC[r.unlock] = '월간 퀘스트 보상'; });

  // ───────── 가방 (36칸, 앞 9칸 = 단축바) ─────────
  const INV_SIZE = 36;
  const CHEST_SIZE = 27;              // 나무 상자 칸 수
  function starterInventory() {
    const inv = new Array(INV_SIZE).fill(null);
    [['hoe', 1], ['can', 1], ['rod', 1], ['seed_carrot', 6], ['wood', 12], ['path', 10], ['sign', 1], ['wall_wood', 8], ['floor_wood', 8]]
      .forEach(([id, n], i) => { inv[i] = { id, n }; });
    return inv;
  }
  function countItem(inv, id) { return inv.reduce((s, it) => s + (it && it.id === id ? it.n : 0), 0); }
  // extra: 칸에 같이 기억할 값 (예: 펫 이름 { pname }) — 있으면 합치지 않고 빈 칸에 따로 넣어요
  function addItem(inv, id, n, extra) {
    if (extra) {
      for (let i = 0; i < inv.length && n > 0; i++) if (!inv[i]) { inv[i] = Object.assign({ id, n: 1 }, extra); n--; }
      return n;
    }
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
  const canTrade = (id) => !!ITEMS[id] && !ITEMS[id].questOnly;
  // 이 아이템들이 가방에 전부 들어가는지 (remove 를 먼저 빼고 계산)
  function canFit(inv, items, remove) {
    const copy = inv.map((it) => (it ? { id: it.id, n: it.n } : null));
    if (remove) for (const [id, n] of Object.entries(remove)) removeItem(copy, id, n);
    for (const [id, n] of Object.entries(items || {})) if (addItem(copy, id, n) > 0) return false;
    return true;
  }

  // ───────── 처음 맵 만들기 ─────────
  // 마을(예전 맵 64×48)을 만든 뒤 expandWorld 로 숲과 동굴을 붙여요.
  function generateLegacy() {
    const ground = Array.from({ length: H0 }, () => new Array(W0).fill('grass'));
    const objects = {};
    const inb = (x, y) => x >= 0 && y >= 0 && x < OW && y < OH;
    const setG = (x, y, g) => { if (inb(x, y)) ground[y][x] = g; };
    const setO = (x, y, o) => { if (inb(x, y)) { if (o) objects[x + ',' + y] = o; else delete objects[x + ',' + y]; } };
    const getO = (x, y) => objects[x + ',' + y];

    // 가장자리 숲 (부술 수 없음)
    for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++)
      if (x < 2 || y < 2 || x >= OW - 2 || y >= OH - 2) setO(x, y, { t: 'tree', fixed: 1 });

    // 연못 + 모래사장
    const ellipse = (cx, cy, rx, ry, sandRing) => {
      for (let y = 2; y < OH - 2; y++) for (let x = 2; x < OW - 2; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
        if (d < 1) setG(x, y, 'water');
        else if (sandRing && d < 1.45 && ground[y][x] === 'grass') setG(x, y, 'sand');
      }
    };
    ellipse(13.5, 35, 7.5, 4.5, true);
    ellipse(51, 39, 4, 2.8, false);

    // 길
    for (let y = 17; y < OH - 2; y++) setG(31, y, 'path');
    for (let x = 2; x < OW - 2; x++) setG(x, 24, 'path');

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
    setO(33, 17, { t: 'sign', text: '🏠 알PDF 아지트' });

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
    for (let y = 2; y < OH - 2; y++) for (let x = 2; x < OW - 2; x++) {
      if (ground[y][x] !== 'grass' || getO(x, y)) continue;
      const nearRoad = Math.abs(x - 31) <= 1 || Math.abs(y - 24) <= 1;
      const nearHouse = x >= hx0 - 2 && x <= hx1 + 2 && y >= hy0 - 2 && y <= hy1 + 3;
      const nearFarm = x >= fx0 - 1 && x <= px1 + 1 && y >= fy0 - 1 && y <= fy1 + 1;
      const r = hash(x, y);
      if (!nearRoad && !nearHouse && !nearFarm && r < 0.03) setO(x, y, { t: 'tree' });
      else if (!nearRoad && r > 0.92) setO(x, y, { t: 'flower' });
    }
    expandWorld(ground, objects);
    return { ground, objects, animals };
  }

  // ───────── 지도 넓히기 ─────────
  // 마을(x<64, y<48)은 건드리지 않아요 (길목·게시판 자리만).
  // 오른쪽 위(x≥64, y<48) + 가운데(y 48~79) = 집 짓는 땅 / 맨 아래(y≥80) = 생산 구역: 왼쪽 동굴(x<50), 오른쪽 나무꾼의 숲
  const NATURAL = new Set(['tree', 'pine', 'stump', 'sapling', 'mushroom_wild', 'sprout', 'bush', 'bush_berry', 'flower', 'rock', 'pebble',
    'ore_iron', 'ore_gold', 'crystal', 'cave_wall', 'campfire', 'log_seat', 'torch']);
  function worldTools(ground, objects) {
    return {
      setG: (x, y, g) => { ground[y][x] = g; },
      setO: (x, y, o) => { if (o) objects[x + ',' + y] = o; else delete objects[x + ',' + y]; },
      getO: (x, y) => objects[x + ',' + y],
    };
  }
  // 오른쪽 위: 집 짓는 땅 (keep = 예전 숲을 바꿀 때 사람이 놓은 물건은 남겨요)
  function genTopRight(ground, objects, keep) {
    const { setG, setO, getO } = worldTools(ground, objects);
    for (let y = 0; y < OH; y++) for (let x = OW; x < W0; x++) {
      const o = getO(x, y);
      if (!keep) { setG(x, y, 'grass'); setO(x, y, null); continue; }
      if (o && (NATURAL.has(o.t) || o.fixed)) setO(x, y, null);
      if (ground[y][x] === 'forest') setG(x, y, 'grass');
    }
    if (!keep) {
      for (let y = 5; y < 16; y++) for (let x = 82; x < 96; x++) {
        const dx = (x + 0.5 - 89) / 4, dy = (y + 0.5 - 10) / 3, d = dx * dx + dy * dy;
        if (d < 1) setG(x, y, 'water'); else if (d < 1.45) setG(x, y, 'sand');
      }
    }
    for (let y = 0; y < OH; y++) for (let x = OW; x < W0; x++)
      if ((y < 2 || x >= W0 - 2) && !getO(x, y)) setO(x, y, { t: 'tree', fixed: 1 });
    for (let x = OW - 2; x < W0 - 2; x++) if (!getO(x, 24) && ground[24][x] === 'grass') setG(x, 24, 'path');
    for (let y = 2; y < OH; y++) for (let x = OW; x < W0 - 2; x++) {
      if (getO(x, y) || ground[y][x] !== 'grass' || Math.abs(y - 24) <= 1) continue;
      const r = hash(x * 13, y * 17);
      if (r < 0.012) setO(x, y, { t: 'tree' }); else if (r > 0.96) setO(x, y, { t: 'flower' });
    }
    // 마을 → 오른쪽 길목
    for (let y = 23; y <= 25; y++) for (let x = OW - 2; x < OW; x++) { setO(x, y, null); setG(x, y, y === 24 ? 'path' : 'grass'); }
  }
  // 가운데: 집 짓는 들판 (처음 만들 때만)
  function genMeadow(ground, objects) {
    const { setG, setO } = worldTools(ground, objects);
    for (let y = OH; y < CY0; y++) for (let x = 0; x < W0; x++) {
      setG(x, y, 'grass'); setO(x, y, null);
      if (x < 2 || x >= W0 - 2) { setO(x, y, { t: 'tree', fixed: 1 }); continue; }
      const r = hash(x * 7 + 5, y * 11 + 3);
      if (r < 0.008) setO(x, y, { t: 'tree' }); else if (r > 0.96) setO(x, y, { t: 'flower' });
    }
    for (let y = OH + 2; y < CY0 - 2; y++) for (let x = 4; x < 24; x++) {
      const dx = (x + 0.5 - 12) / 4.5, dy = (y + 0.5 - 64) / 2.8, d = dx * dx + dy * dy;
      if (d < 1) { setG(x, y, 'water'); setO(x, y, null); } else if (d < 1.45) { setG(x, y, 'sand'); setO(x, y, null); }
    }
    for (let y = OH - 2; y < CY0; y++) { setG(31, y, 'path'); setO(31, y, null); }
    setO(33, OH + 1, { t: 'sign', text: '🏡 마음껏 집을 지어요!' });
    for (let y = OH - 2; y < OH; y++) for (let x = 20; x <= 42; x++) { setO(x, y, null); setG(x, y, x === 31 ? 'path' : 'grass'); }
  }
  // 맨 아래: 생산 구역 (왼쪽 동굴, 오른쪽 나무꾼의 숲). 다시 자라니까 너무 크지 않게.
  function genBottom(ground, objects) {
    const { setG, setO, getO } = worldTools(ground, objects);
    for (let y = CY0; y < H0; y++) for (let x = 0; x < W0; x++) {
      if (x < BX0) { setG(x, y, 'cave'); setO(x, y, { t: 'cave_wall', fixed: 1 }); } else { setG(x, y, 'forest'); setO(x, y, null); }
    }
    // ── 동굴 (x 0~49)
    const corridorY = CY0 + 16;
    const open = (x, y) => {
      if (x < 4 || x >= BX0 - 4 || y < CY0 + 4 || y >= H0 - 3) return false;
      if (Math.abs(y - corridorY) <= 1 || Math.abs(x - 31) <= 1) return true;
      return hash(Math.floor(x / 3) * 7 + 3, Math.floor(y / 3) * 13 + 1) > 0.2;
    };
    for (let y = CY0; y < H0; y++) for (let x = 0; x < BX0; x++) if (open(x, y)) setO(x, y, null);
    for (let y = CY0 - 2; y < CY0 + 5; y++) for (let x = 29; x <= 33; x++) { setO(x, y, null); if (y < CY0) setG(x, y, 'path'); }
    for (let y = CY0 + 4; y < H0 - 3; y++) for (let x = 30; x < BX0 - 3; x++) {
      const dx = (x + 0.5 - 39) / 4.5, dy = (y + 0.5 - (CY0 + 24)) / 2.5, d = dx * dx + dy * dy;
      if (d < 1) { setG(x, y, 'water'); setO(x, y, null); } else if (d < 1.6 && getO(x, y) && getO(x, y).t === 'cave_wall') setO(x, y, null);
    }
    for (let y = CY0 + 4; y < H0 - 3; y++) for (let x = 4; x < BX0 - 4; x++) {
      if (getO(x, y) || ground[y][x] !== 'cave') continue;
      if (Math.abs(y - corridorY) <= 1 || (Math.abs(x - 31) <= 1 && y < corridorY)) continue;
      const depth = (y - CY0) / (H0 - CY0);
      const r = hash(x * 5 + 11, y * 9 + 7);
      if (r < 0.09) setO(x, y, { t: 'rock' });
      else if (r < 0.15) setO(x, y, { t: 'ore_iron' });
      else if (r < 0.16 + 0.03 * depth) setO(x, y, { t: 'ore_gold' });
      else if (r < 0.19 + 0.02 * depth) setO(x, y, depth > 0.4 ? { t: 'crystal' } : { t: 'rock' });
    }
    for (let x = 6; x < BX0 - 5; x += 7) if (!getO(x, corridorY - 1)) setO(x, corridorY - 1, { t: 'torch', fixed: 1 });
    for (let y = CY0 + 2; y < corridorY; y += 5) setO(29, y, { t: 'torch', fixed: 1 });
    setO(33, CY0 + 1, { t: 'sign', text: '⛏ 동굴 (바위·광석 X로 캐요)' });
    // 동굴 ↔ 숲 굴
    for (let y = corridorY - 1; y <= corridorY + 1; y++) for (let x = BX0 - 5; x < BX0 + 2; x++) { setO(x, y, null); if (x < BX0) setG(x, y, 'cave'); }
    // ── 나무꾼의 숲 (x 50~99)
    const EX = 75;
    for (let y = CY0; y < H0; y++) for (let x = BX0; x < W0; x++) {
      if (x >= W0 - 2 || y >= H0 - 2 || (y < CY0 + 2 && Math.abs(x - EX) > 2)) setO(x, y, { t: 'pine', fixed: 1 });
    }
    for (let y = CY0 + 4; y < CY0 + 17; y++) for (let x = 82; x < 96; x++) {
      const dx = (x + 0.5 - 89) / 4.5, dy = (y + 0.5 - (CY0 + 10)) / 3, d = dx * dx + dy * dy;
      if (d < 1) setG(x, y, 'water'); else if (d < 1.5) setG(x, y, 'sand');
    }
    const camp = { x: 66, y: CY0 + 18 };
    for (let y = CY0 - 8; y <= camp.y; y++) if (!getO(EX, y) || y >= CY0) { setG(EX, y, 'path'); if (y >= CY0) setO(EX, y, null); }
    for (let x = camp.x; x <= EX; x++) setG(x, camp.y, 'path');
    for (let y = CY0 + 2; y < H0 - 2; y++) for (let x = BX0; x < W0 - 2; x++) {
      const g = ground[y][x];
      if (g === 'path' || g === 'sand' || g === 'water' || getO(x, y)) continue;
      if (Math.hypot(x - camp.x, y - camp.y) < 4.2) continue;
      let nearPath = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground[y + dy] && ground[y + dy][x + dx] === 'path') nearPath = true;
      const r = hash(x * 13, y * 17);
      if (nearPath) { if (r > 0.94) setO(x, y, { t: 'flower' }); continue; }
      if (r < 0.2) setO(x, y, { t: 'tree' });
      else if (r < 0.34) setO(x, y, { t: 'pine' });
      else if (r < 0.375) setO(x, y, { t: 'mushroom_wild' });
      else if (r < 0.4) setO(x, y, { t: 'bush_berry' });
      else if (r > 0.95) setO(x, y, { t: 'flower' });
    }
    setO(camp.x, camp.y, { t: 'campfire', fixed: 1 });
    setO(camp.x - 2, camp.y, { t: 'log_seat', fixed: 1 }); setO(camp.x + 2, camp.y, { t: 'log_seat', fixed: 1 });
    setO(camp.x, camp.y + 2, { t: 'log_seat', fixed: 1 });
    setO(camp.x + 1, camp.y - 2, { t: 'sign', text: '🔥 모닥불 (E로 요리)' });
    setO(EX + 2, CY0 + 2, { t: 'sign', text: '🌲 나무꾼의 숲 (나무 X, 버섯·산딸기 E)' });
    if (!getO(EX + 2, CY0 - 3)) setO(EX + 2, CY0 - 3, { t: 'sign', text: '🌲 아래로 가면 나무꾼의 숲' });
    if (!getO(33, CY0 - 3)) setO(33, CY0 - 3, { t: 'sign', text: '⛏ 아래로 가면 동굴' });
  }
  // 마을 한가운데 게시판 (빈 칸을 찾아서)
  function placeBoard(ground, objects) {
    if (Object.values(objects).some((o) => o.t === 'notice_board')) return;
    for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = 34 + dx, y = 26 + dy;
      if (objects[x + ',' + y] || ground[y][x] === 'water' || ground[y][x] === 'path') continue;
      objects[x + ',' + y] = { t: 'notice_board' };
      return;
    }
  }
  // 처음 만들 때 / 예전 맵(64×48)을 넓힐 때
  function expandWorld(ground, objects) {
    genTopRight(ground, objects, false);
    genMeadow(ground, objects);
    genBottom(ground, objects);
    placeBoard(ground, objects);
    removeTownBorder(objects);
  }
  // 버전 4 맵 → 5: 오른쪽 위 숲을 집 짓는 땅으로, 아래쪽을 동굴+숲으로 다시 만들어요 (지은 건물은 그대로)
  function upgradeV4(ground, objects) {
    genTopRight(ground, objects, true);
    genBottom(ground, objects);
    placeBoard(ground, objects);
    removeTownBorder(objects);
  }
  // 버전 6: 마을을 네모로 둘러싼 "못 베는 나무"를 없애요 (마을이 들판·땅과 바로 이어져요)
  function removeTownBorder(objects) {
    for (const [k, o] of Object.entries(objects)) {
      if (!o || o.t !== 'tree' || !o.fixed) continue;
      const [x, y] = k.split(',').map(Number);
      if (x < OW && y < OH) delete objects[k];
    }
  }

  // ───────── ⚔️ 전투: 직업 · 무기 · 체력 · 몬스터 · 강화 · 칭호 ─────────
  const JOB_LV = 10, JOB_RESET_COST = 5000;
  const JOBS = {
    novice: { name: '모험가', icon: '🧭', desc: '처음엔 누구나 모험가! 목검과 활을 쓸 수 있어요. Lv.10부터 전직해요.' },
    // 전직 퀘스트 5단계: 1~2단계 = 모으기(stat, 단계를 시작한 뒤부터 센 개수) / 3~5단계 = 1성 던전 몬스터가 주는 퀘스트 아이템(item, 가방에 모아서 제출)
    knight: { name: '기사', icon: '🛡️', weapon: 'sword', hp: 40, def: 2, desc: '검으로 앞의 적들을 한꺼번에 베어요. 체력 +40, 방어력 +2',
      stages: [
        [{ stat: 'wood', n: 20, t: '나무 20개 모으기' }, { stat: 'stone', n: 15, t: '돌 15개 모으기' }],
        [{ stat: 'iron', n: 5, t: '철광석 5개 캐기' }, { stat: 'stone', n: 25, t: '돌 25개 더 모으기' }],
        [{ item: 'slime_core', n: 5, t: '슬라임에게서 슬라임의 핵 5개 얻어 오기' }],
        [{ item: 'bat_wing', n: 5, t: '박쥐에게서 박쥐 날개 5개 얻어 오기' }, { item: 'slime_core', n: 3, t: '슬라임의 핵 3개 더' }],
        [{ item: 'crown_shard', n: 1, t: '킹슬라임을 쓰러뜨리고 왕관 조각 얻어 오기' }],
      ], reward: { iron_sword: 1 } },
    archer: { name: '궁수', icon: '🏹', weapon: 'bow', speed: 0.75, desc: '멀리서 화살을 쏴요. 공격 속도 +25%, 사거리가 길어요',
      stages: [
        [{ stat: 'wood', n: 30, t: '나무 30개 모으기' }, { stat: 'berry', n: 5, t: '산딸기 5개 따기' }],
        [{ stat: 'stone', n: 15, t: '돌 15개 모으기' }, { stat: 'hunt', n: 2, t: '야생 동물 2마리 사냥' }],
        [{ item: 'bat_wing', n: 5, t: '박쥐에게서 박쥐 날개 5개 얻어 오기' }],
        [{ item: 'slime_core', n: 5, t: '슬라임에게서 슬라임의 핵 5개 얻어 오기' }, { item: 'bat_wing', n: 3, t: '박쥐 날개 3개 더' }],
        [{ item: 'crown_shard', n: 1, t: '킹슬라임을 쓰러뜨리고 왕관 조각 얻어 오기' }],
      ], reward: { long_bow: 1 } },
    mage: { name: '마법사', icon: '🔮', weapon: 'staff', desc: '마법 구슬이 터지면서 주변 적들에게도 피해를 줘요',
      stages: [
        [{ stat: 'mushroom', n: 5, t: '버섯 5개 따기' }, { stat: 'stone', n: 20, t: '돌 20개 모으기' }],
        [{ stat: 'wood', n: 20, t: '나무 20개 모으기' }, { stat: 'cook', n: 2, t: '요리 2번 하기' }],
        [{ item: 'slime_core', n: 6, t: '슬라임에게서 슬라임의 핵 6개 얻어 오기' }],
        [{ item: 'bat_wing', n: 4, t: '박쥐에게서 박쥐 날개 4개 얻어 오기' }, { item: 'slime_gel', n: 5, t: '슬라임 젤리 5개' }],
        [{ item: 'crown_shard', n: 1, t: '킹슬라임을 쓰러뜨리고 왕관 조각 얻어 오기' }],
      ], reward: { staff_basic: 1 } },
    ninja: { name: '닌자', icon: '🥷', weapon: 'ninja', crit: 0.3, desc: '가까운 적에게 표창을 아주 빠르게 던져요. 치명타 30% (피해 2배)',
      stages: [
        [{ stat: 'wood', n: 20, t: '나무 20개 모으기' }, { stat: 'hunt', n: 2, t: '야생 동물 2마리 사냥' }],
        [{ stat: 'stone', n: 20, t: '돌 20개 모으기' }, { stat: 'berry', n: 5, t: '산딸기 5개 따기' }],
        [{ item: 'bat_wing', n: 6, t: '박쥐에게서 박쥐 날개 6개 얻어 오기' }],
        [{ item: 'slime_core', n: 4, t: '슬라임에게서 슬라임의 핵 4개 얻어 오기' }, { item: 'bat_wing', n: 2, t: '박쥐 날개 2개 더' }],
        [{ item: 'crown_shard', n: 1, t: '킹슬라임을 쓰러뜨리고 왕관 조각 얻어 오기' }],
      ], reward: { kunai: 1 } },
  };
  // 예전(1단계짜리) 전직 퀘스트 조건: base에 남아 있는 통계별 목표 개수
  const LEGACY_JOB_GOAL = { hunt: 5, kill: 20 };
  const LEGACY_JOB_NAME = { hunt: '야생 동물 사냥', kill: '던전 몬스터 처치' };
  function legacyJobTasks(jq, stats) {
    return Object.keys((jq && jq.base) || {}).map((k) => {
      const n = LEGACY_JOB_GOAL[k] || 5;
      return { stat: k, n, t: `${LEGACY_JOB_NAME[k] || k} ${n}`, v: Math.max(0, ((stats || {})[k] || 0) - (jq.base[k] || 0)) };
    });
  }
  function legacyJobDone(jq, stats) {
    const t = legacyJobTasks(jq, stats);
    return t.length > 0 && t.every((q) => q.v >= q.n);
  }
  // 퀘스트 아이템이 나오는 몬스터 (그 아이템이 필요한 단계를 진행 중일 때만)
  const QUEST_DROPS = { slime: ['slime_core', 0.45], bat: ['bat_wing', 0.45], king_slime: ['crown_shard', 1] };
  // 무기 종류: cd 공격 간격(ms), range 사거리(px)
  const WEAPONS = { sword: { name: '검', cd: 520, range: 26 }, bow: { name: '활', cd: 560, range: 7 * TILE }, staff: { name: '지팡이', cd: 850, range: 6 * TILE, splash: 24 }, ninja: { name: '표창', cd: 300, range: 3 * TILE } };
  const maxHp = (lv, job) => 100 + 8 * ((lv || 1) - 1) + ((JOBS[job] || {}).hp || 0);
  function armorDef(equip, job) {
    let d = (JOBS[job] || {}).def || 0;
    for (const it of Object.values(equip || {})) if (it && ITEMS[it.id] && ITEMS[it.id].armor) d += ITEMS[it.id].armor.def;
    return d;
  }
  // 받는 피해: 방어력 1마다 3%씩 줄어요 (최대 70%)
  const dmgTaken = (atk, def) => Math.max(1, Math.round(atk * (1 - Math.min(0.7, def * 0.03))));
  // 무기 공격력: 강화 1단계마다 +12% +1
  const weaponAtk = (it) => { const d = ITEMS[it.id]; const en = it.en || 0; return Math.round((d.atk || 1) * (1 + 0.12 * en) + en); };
  const itemLabel = (it) => (it && it.en ? `+${it.en} ` : '') + (it && ITEMS[it.id] ? ITEMS[it.id].name : '');
  // 강화: [현재 단계] → 다음 단계 (실패해도 부서지지 않아요)
  const MAX_EN = 10;
  const ENHANCE = [
    { rate: 1, coins: 100, need: { slime_gel: 2 } }, { rate: 0.9, coins: 150, need: { slime_gel: 3 } }, { rate: 0.8, coins: 200, need: { slime_gel: 4 } },
    { rate: 0.7, coins: 300, need: { bone: 3, iron: 2 } }, { rate: 0.6, coins: 400, need: { bone: 4, iron: 3 } }, { rate: 0.5, coins: 500, need: { bone: 5, iron: 4 } },
    { rate: 0.4, coins: 800, need: { fire_core: 2, gold: 2 } }, { rate: 0.3, coins: 1000, need: { fire_core: 3, gold: 3 } }, { rate: 0.2, coins: 1300, need: { fire_core: 4, gold: 4 } },
    { rate: 0.12, coins: 2000, need: { dragon_scale: 1, gem: 2 } },
  ];
  // 몬스터 (던전 안에만): n 마릿수, drops [아이템, 확률, 개수]
  // 보스: 가장 많이 때린 1~3등에게만 보상 (1등 100% · 2등 60% · 3등 35%), rare = 등수별 확률로 주는 무기
  const MOBS = {
    slime: { name: '슬라임', star: 1, hp: 24, atk: 5, def: 0, speed: 18, exp: 8, coins: [3, 8], drops: [['slime_gel', 0.6, 1]], n: 10 },
    bat: { name: '박쥐', star: 1, hp: 16, atk: 4, def: 0, speed: 32, exp: 7, coins: [2, 6], drops: [['slime_gel', 0.3, 1]], n: 6 },
    king_slime: { name: '킹슬라임', star: 1, boss: 1, hp: 450, atk: 12, def: 2, speed: 14, exp: 150, coins: [150, 200], loot: { slime_gel: 6, gold: 2, potion_m: 2 } },
    skeleton: { name: '해골 병사', star: 2, hp: 80, atk: 13, def: 3, speed: 20, exp: 22, coins: [8, 15], drops: [['bone', 0.7, 1], ['iron', 0.25, 1]], n: 9 },
    ghost: { name: '유령', star: 2, hp: 60, atk: 15, def: 1, speed: 26, exp: 25, coins: [8, 15], drops: [['ecto', 0.6, 1]], n: 6 },
    skeleton_knight: { name: '해골 기사', star: 2, boss: 1, hp: 1600, atk: 26, def: 6, speed: 18, exp: 600, coins: [500, 600], loot: { bone: 8, gold: 4, gem: 1 },
      rare: ['knight_sword', 'elf_bow', 'crystal_staff', 'ninja_blade'] },
    golem: { name: '돌 골렘', star: 3, hp: 220, atk: 24, def: 9, speed: 13, exp: 55, coins: [15, 30], drops: [['gem', 0.25, 1], ['gold', 0.4, 1]], n: 8 },
    imp: { name: '불꽃 임프', star: 3, hp: 120, atk: 28, def: 3, speed: 30, exp: 50, coins: [15, 30], drops: [['fire_core', 0.45, 1]], n: 7 },
    dragon: { name: '드래곤', star: 3, boss: 1, hp: 5200, atk: 48, def: 12, speed: 16, exp: 2500, coins: [1500, 2000], loot: { fire_core: 6, dragon_scale: 2, gem: 3 },
      rare: ['hero_sword', 'phoenix_bow', 'arch_staff', 'shadow_blade'] },
  };
  const BOSS_SHARE = [1, 0.6, 0.35];                 // 보스 보상 등수별 비율
  const BOSS_RARE = { 2: [0.3, 0.15, 0.05], 3: [0.5, 0.25, 0.1] };  // 등수별 무기 확률
  const MOB_RESPAWN = 25000, BOSS_RESPAWN = 300000;
  // 칭호: stat 이 n 이상이면 / job 이면 얻어요
  const TITLES = [
    { id: 'newbie', name: '새싹 모험가', desc: '처음부터 가지고 있어요' },
    { id: 'fisher', name: '낚시꾼', stat: 'fish', n: 15, desc: '물고기 15마리' },
    { id: 'farmer', name: '농부', stat: 'harvest', n: 30, desc: '작물 30개 수확' },
    { id: 'chef', name: '요리사', stat: 'cook', n: 15, desc: '요리 15번' },
    { id: 'miner', name: '광부', stat: 'iron', n: 15, desc: '철광석 15개' },
    { id: 'hunter', name: '사냥꾼', stat: 'hunt', n: 15, desc: '야생 동물 15마리' },
    { id: 'rich', name: '큰손', stat: 'earned', n: 5000, desc: '판매 수익 5000' },
    { id: 'builder', name: '건축가', stat: 'wallPlaced', n: 100, desc: '벽 100개' },
    { id: 'decorator', name: '인테리어 장인', stat: 'furniturePlaced', n: 50, desc: '가구 50개' },
    { id: 'collector', name: '수집가', stat: 'col', n: 30, desc: '도감 30칸' },
    { id: 'social', name: '인싸', stat: 'chat', n: 100, desc: '채팅 100번' },
    { id: 'slime_hunter', name: '슬라임 사냥꾼', stat: 'kill_slime', n: 50, desc: '슬라임 50마리' },
    { id: 'monster_hunter', name: '몬스터 헌터', stat: 'kill', n: 300, desc: '몬스터 300마리' },
    { id: 'boss1', name: '킹슬라임 퇴치자', stat: 'boss1', n: 1, desc: '1성 보스 처치 참여' },
    { id: 'boss2', name: '해골 기사 퇴치자', stat: 'boss2', n: 1, desc: '2성 보스 처치 참여' },
    { id: 'boss3', name: '용 사냥꾼', stat: 'boss3', n: 1, desc: '3성 보스 처치 참여' },
    { id: 'boss_ace', name: '보스 킬러', stat: 'bossTop1', n: 5, desc: '보스 딜량 1등 5번' },
    { id: 'smith', name: '강화의 달인', stat: 'enMax', n: 7, desc: '+7 강화 성공' },
    { id: 'smith10', name: '강화의 신', stat: 'enMax', n: 10, desc: '+10 강화 성공' },
    { id: 'knight', name: '기사', job: 'knight', desc: '기사로 전직' },
    { id: 'archer', name: '궁수', job: 'archer', desc: '궁수로 전직' },
    { id: 'mage', name: '마법사', job: 'mage', desc: '마법사로 전직' },
    { id: 'ninja', name: '닌자', job: 'ninja', desc: '닌자로 전직' },
    { id: 'mvp', name: '금주의 MVP', stat: 'mvpWin', n: 1, desc: '금주의 MVP 1등' },
    { id: 'legend', name: '전설', stat: 'level', n: 20, desc: '레벨 20' },
    // ── ✨ 희귀 칭호 (hard): 아주 오래 해야 얻어요. 얻으면 마을 전체에 알려요 ──
    // all: 조건 여러 개를 모두 / stat: 통계 / col: 그 도감 항목을 얻은 횟수 / jobs: 전직해 본 직업 수
    { id: 'slime_doom', hard: 1, name: '슬라임 학살자', stat: 'kill_slime', n: 1000, desc: '슬라임 1000마리 처치' },
    { id: 'night_hunter', hard: 1, name: '밤의 사냥꾼', stat: 'kill_bat', n: 500, desc: '박쥐 500마리 처치' },
    { id: 'bone_breaker', hard: 1, name: '뼈 부수는 자', stat: 'kill_skeleton', n: 500, desc: '해골 병사 500마리 처치' },
    { id: 'exorcist', hard: 1, name: '퇴마사', stat: 'kill_ghost', n: 400, desc: '유령 400마리 처치' },
    { id: 'rock_breaker', hard: 1, name: '바위 깨는 자', stat: 'kill_golem', n: 300, desc: '돌 골렘 300마리 처치' },
    { id: 'flame_tamer', hard: 1, name: '불꽃 조련사', stat: 'kill_imp', n: 300, desc: '불꽃 임프 300마리 처치' },
    { id: 'war_legend', hard: 1, name: '전장의 전설', stat: 'kill', n: 5000, desc: '몬스터 5000마리 처치' },
    { id: 'slime_nemesis', hard: 1, name: '킹슬라임의 천적', stat: 'boss1', n: 30, desc: '킹슬라임 처치 30번 참여' },
    { id: 'grave_lord', hard: 1, name: '묘지의 지배자', stat: 'boss2', n: 20, desc: '해골 기사 처치 20번 참여' },
    { id: 'dragon_slayer', hard: 1, name: '드래곤 슬레이어', stat: 'boss3', n: 10, desc: '드래곤 처치 10번 참여' },
    { id: 'boss_legend', hard: 1, name: '보스 학살자', stat: 'bossTop1', n: 30, desc: '보스 딜량 1등 30번' },
    { id: 'undying', hard: 1, name: '오뚝이', all: [{ stat: 'deaths', n: 100 }, { stat: 'kill', n: 1000 }], desc: '100번 쓰러지고도 몬스터 1000마리 처치' },
    { id: 'en_addict', hard: 1, name: '강화 중독자', stat: 'enhanceTry', n: 500, desc: '강화 500번 시도' },
    { id: 'angler_king', hard: 1, name: '강태공', stat: 'fish', n: 1000, desc: '물고기 1000마리 낚기' },
    { id: 'golden_angler', hard: 1, name: '황금 낚시꾼', col: 'fish_golden', n: 10, desc: '황금잉어 10마리 낚기' },
    { id: 'big_farmer', hard: 1, name: '대농', stat: 'harvest', n: 3000, desc: '작물 3000개 수확' },
    { id: 'chef_king', hard: 1, name: '요리왕', stat: 'cook', n: 500, desc: '요리 500번' },
    { id: 'deep_miner', hard: 1, name: '심층 광부', stat: 'gem', n: 300, desc: '보석 300개 캐기' },
    { id: 'tycoon', hard: 1, name: '재벌', stat: 'earned', n: 200000, desc: '판매 수익 200,000' },
    { id: 'architect', hard: 1, name: '대건축가', all: [{ stat: 'wallPlaced', n: 1000 }, { stat: 'furniturePlaced', n: 300 }], desc: '벽 1000개 + 가구 300개 놓기' },
    { id: 'encyclopedia', hard: 1, name: '걸어다니는 도감', stat: 'col', n: Object.keys(COL_INDEX).length, desc: `도감 ${Object.keys(COL_INDEX).length}칸 전부 채우기` },
    { id: 'all_jobs', hard: 1, name: '만능 모험가', jobs: 4, desc: '기사·궁수·마법사·닌자 모두 전직해 보기' },
    { id: 'hall_of_fame', hard: 1, name: '명예의 전당', stat: 'mvpWin', n: 5, desc: '금주의 MVP 1등 5번' },
    { id: 'living_legend', hard: 1, name: '살아있는 전설', all: [{ stat: 'level', n: 40 }, { stat: 'enMax', n: 10 }], desc: '레벨 40 + 무기 +10 강화' },
  ];
  // 칭호 조건 목록 → [{ 조건, 지금 값 }]
  function titleConds(pr, t) {
    if (t.job) return [{ n: 1, v: pr.job === t.job || (pr.jobsDone || []).includes(t.job) ? 1 : 0 }];
    const list = t.all || (t.stat ? [{ stat: t.stat, n: t.n }] : t.col ? [{ col: t.col, n: t.n }] : t.jobs ? [{ jobs: 1, n: t.jobs }] : []);
    return list.map((c) => ({ n: c.n, v: c.stat ? ((pr.stats || {})[c.stat] || 0) : c.col ? ((pr.col || {})[c.col] || 0) : c.jobs ? (pr.jobsDone || []).length : 0 }));
  }
  const titleOk = (pr, t) => titleConds(pr, t).every((c) => c.v >= c.n);

  // ───────── v7 지도: 예전 지도를 오른쪽·아래로 옮기고, 위에 던전 지대 · 왼쪽에 새 땅 ─────────
  const DUNGEONS = [
    { star: 1, x0: 4, x1: 43, lv: 5, name: '⭐ 1성 던전 · 슬라임 동굴' },
    { star: 2, x0: 52, x1: 91, lv: 12, name: '⭐⭐ 2성 던전 · 해골 묘지' },
    { star: 3, x0: 100, x1: 139, lv: 20, name: '⭐⭐⭐ 3성 던전 · 용암 성채' },
  ];
  const DY0 = 2, DY1 = 31;                       // 던전 건물 위·아래 벽 줄
  DUNGEONS.forEach((d) => { d.cx = Math.floor((d.x0 + d.x1) / 2); d.gate = { x: d.cx, y: DY1 }; d.inside = { x: d.cx, y: DY1 - 3 }; d.outside = { x: d.cx, y: DY1 + 2 }; d.boss = { x: d.cx, y: DY0 + 4 }; });
  function toV7(ground0, objects0) {
    const ground = Array.from({ length: H }, () => new Array(W).fill('grass'));
    const objects = {};
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) ground[y + TY][x + TX] = ground0[y][x];
    for (const [k, o] of Object.entries(objects0)) { const [x, y] = k.split(',').map(Number); objects[(x + TX) + ',' + (y + TY)] = o; }
    genLeftStrip(ground, objects);
    genDungeonBand(ground, objects);
    cleanTrees(objects);
    placeNPCs(ground, objects);
    return { ground, objects };
  }
  function generateWorld() {
    const g = generateLegacy();
    const v = toV7(g.ground, g.objects);
    const animals = g.animals.map((a) => Object.assign({}, a, { x: a.x + TX * TILE, y: a.y + TY * TILE }));
    return { ground: v.ground, objects: v.objects, animals };
  }
  // 왼쪽 새 땅: 위쪽은 집 짓는 들판, 맨 아래는 숲 (생산 구역)
  function genLeftStrip(ground, objects) {
    const { setG, setO } = worldTools(ground, objects);
    for (let y = TY; y < H; y++) for (let x = 0; x < TX; x++) {
      setO(x, y, null);
      if (y < CY) {
        setG(x, y, 'grass');
        if (hash(x * 3 + 7, y * 5 + 1) > 0.965) setO(x, y, { t: 'flower' });
        continue;
      }
      setG(x, y, 'forest');
      if (x < 2 || y >= H - 2 || (y < CY + 2 && Math.abs(x - 22) > 2)) { setO(x, y, { t: 'pine', fixed: 1 }); continue; }
      if (Math.abs(x - 22) <= 1 && y < CY + 12) continue;
      const r = hash(x * 13 + 5, y * 17 + 3);
      if (r < 0.2) setO(x, y, { t: 'tree' });
      else if (r < 0.34) setO(x, y, { t: 'pine' });
      else if (r < 0.375) setO(x, y, { t: 'mushroom_wild' });
      else if (r < 0.4) setO(x, y, { t: 'bush_berry' });
      else if (r > 0.95) setO(x, y, { t: 'flower' });
    }
    for (let y = TY + 26; y < TY + 36; y++) for (let x = 12; x < 32; x++) {
      const dx = (x + 0.5 - 22) / 6, dy = (y + 0.5 - (TY + 31)) / 3, d = dx * dx + dy * dy;
      if (d < 1) setG(x, y, 'water'); else if (d < 1.45) setG(x, y, 'sand');
    }
    for (let y = CY - 6; y < CY + 12; y++) setG(22, y, 'path');
    setO(24, CY - 3, { t: 'sign', text: '🌲 아래로 가면 숲' });
  }
  // 맨 위: 던전 지대 (1성·2성·3성 던전 건물 + 앞마당)
  function genDungeonBand(ground, objects) {
    const { setG, setO } = worldTools(ground, objects);
    for (let y = 0; y < TY; y++) for (let x = 0; x < W; x++) {
      setO(x, y, null);
      setG(x, y, 'grass');
      if (y > DY1 + 1 && hash(x * 7 + 1, y * 3 + 9) > 0.97) setO(x, y, { t: 'flower' });
    }
    for (const d of DUNGEONS) {
      for (let y = DY0; y <= DY1; y++) for (let x = d.x0; x <= d.x1; x++) {
        setG(x, y, 'dungeon');
        const edge = x === d.x0 || x === d.x1 || y === DY0 || y === DY1;
        if (edge) { setO(x, y, { t: 'dungeon_wall', fixed: 1 }); continue; }
        const open = Math.abs(x - d.cx) <= 1 || Math.abs(y - 17) <= 1 || y <= DY0 + 7 || y >= DY1 - 4;
        if (!open && hash(Math.floor(x / 3) * 11 + d.star, Math.floor(y / 3) * 7 + 5) < 0.16) setO(x, y, { t: 'dungeon_wall', fixed: 1 });
        else if (d.star === 3 && !open && hash(x * 5, y * 9 + 3) < 0.06) setG(x, y, 'lava');
      }
      // 보스 방 칸막이
      for (let x = d.x0 + 1; x < d.x1; x++) if (Math.abs(x - d.cx) > 2) setO(x, DY0 + 8, { t: 'dungeon_wall', fixed: 1 });
      for (let x = d.x0 + 3; x < d.x1 - 1; x += 6) { setO(x, DY0 + 1, { t: 'torch', fixed: 1 }); setO(x, DY1 - 1, { t: 'torch', fixed: 1 }); setO(x, DY0 + 9, { t: 'torch', fixed: 1 }); }
      setO(d.gate.x, d.gate.y, { t: 'dungeon_gate', star: d.star, fixed: 1 });
      setO(d.cx, d.inside.y + 1, { t: 'dungeon_exit', star: d.star, fixed: 1 });
      setO(d.cx + 2, DY1 + 2, { t: 'sign', text: `${d.name} (Lv.${d.lv}부터 · 문 앞에서 E)` });
    }
    for (let x = 4; x < W - 4; x++) setG(x, DY1 + 4, 'path');
    for (const d of DUNGEONS) for (let y = DY1 + 1; y <= DY1 + 4; y++) setG(d.cx, y, 'path');
    for (let y = DY1 + 4; y < TY + 6; y++) if (!objects[(TX + 31) + ',' + y]) setG(TX + 31, y, 'path');
    setO(TX + 33, TY - 2, { t: 'sign', text: '⚔️ 위로 가면 던전 지대' });
  }
  // 숲이 아닌 곳의 나무는 없애요 (나무는 숲에만)
  function cleanTrees(objects) {
    for (const [k, o] of Object.entries(objects)) {
      if (!o || !['tree', 'pine', 'stump'].includes(o.t)) continue;
      const [x, y] = k.split(',').map(Number);
      if (zoneAt(x, y) !== 'forest') delete objects[k];
    }
  }
  // 마을 상점 근처에 전직 교관 · 대장간(모루)
  function placeNPCs(ground, objects) {
    const near = (t, cx, cy) => {
      if (Object.values(objects).some((o) => o.t === t)) return;
      for (let r = 0; r <= 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (objects[x + ',' + y] || ground[y][x] === 'water' || ground[y][x] === 'path') continue;
        objects[x + ',' + y] = { t, fixed: 1 };
        return;
      }
    };
    near('job_master', TX + 24, TY + 27);
    near('anvil', TX + 38, TY + 27);
  }

  // ───────── 📢 업데이트 소식 (마을 게시판에 자동으로 공지돼요) ─────────
  // 새 업데이트를 할 때 맨 앞에 하나 추가하면, 서버가 켜질 때 채팅으로 알리고 게시판 버튼에 🆕 가 떠요.
  const UPDATES = [
    {
      v: 'v7.1', date: '2026-11-13', title: '전투 다듬기 · 전직 퀘스트 5단계',
      items: [
        '❗ 몬스터가 공격하기 전에 머리 위에 빨간 느낌표를 띄우고 잠깐 멈춰요. 그 사이에 피하면 안 맞아요',
        '💥 보스 내려찍기는 바닥의 빨간 원으로 미리 알려줘요. 원이 다 차기 전에 빠져나오세요',
        '🎯 커서로 몬스터를 가리키고 공격하면, 사거리 안이면 그 몬스터에게 확실히 맞아요',
        '❤️ 체력은 저절로 차지 않아요. 요리나 물약을 먹어서 회복해요 (다시 접속해도 체력은 그대로)',
        '📜 전직 퀘스트가 5단계가 됐어요: 1~2단계 재료 모으기 → 3~5단계 1성 던전 몬스터의 퀘스트 아이템(슬라임의 핵·박쥐 날개·킹슬라임 왕관 조각)',
      ],
    },
    {
      v: 'v7', date: '2026-11-13', title: '던전 · 전직 · 장비 · 강화 · 칭호 대규모 업데이트',
      items: [
        '🗺️ 지도가 넓어졌어요! 상점이 가로 한가운데에 오도록 왼쪽으로 넓히고, 위쪽은 전부 던전 지대예요 (지은 집은 그대로 옮겼어요)',
        '⚔️ 던전 3곳: ⭐1성 슬라임 동굴(Lv.5) · ⭐⭐2성 해골 묘지(Lv.12) · ⭐⭐⭐3성 용암 성채(Lv.20). 문 앞에서 E로 입장',
        '👑 보스(킹슬라임·해골 기사·드래곤)는 가장 많이 때린 1~3등만 보상! 처치하면 채팅에 딜량 순위와 입힌 피해를 알려줘요',
        '❤️ 체력이 생겼어요. 쓰러지면 마을에서 다시 시작(잃는 건 없어요). 물약·요리로 회복',
        '🧭 Lv.10부터 마을 전직 교관에게서 전직 퀘스트: 🛡️ 기사(검) · 🏹 궁수(활) · 🔮 마법사(지팡이) · 🥷 닌자(표창)',
        '🗡️ 직업마다 무기 3단계 (만들기 2단계 + 3성 보스 전설 무기)',
        '🔨 마을 대장간(모루)에서 무기 강화 +1 ~ +10 (실패해도 안 부서져요)',
        '🛡️ 마인크래프트처럼 갑옷 4부위 × 가죽·철·금·수정! 장착하면 캐릭터에도 보여요',
        '🏷️ 칭호: 업적·직업·보스 처치로 얻고 이름 위에 달아요 (Lv 버튼 → 칭호)',
        '🌲 나무는 숲에만! 숲 밖의 나무는 다시 자라지 않고 2번 베면 사라져요',
      ],
    },
    {
      v: 'v6', date: '2026-11-12', title: '모바일 · 공원/카페 · 레벨 퀘스트 업데이트',
      items: [
        '📱 이제 휴대폰으로도 할 수 있어요! 왼쪽 아래 조이스틱으로 이동, 오른쪽 아래 버튼으로 사용·E·X·R, 화면을 톡 치면 그 칸을 겨눠요',
        '🌳 공원 가구: 공원 벤치·피크닉 테이블·그네·미끄럼틀·화단·생울타리·쓰레기통·자판기·파라솔·정원등·보도블록',
        '☕ 카페 가구: 카페 테이블·의자·바 의자·카운터·케이크 쇼케이스·메뉴 칠판·빵 진열대·커피잔·케이크·빵 바구니·카페 바닥',
        '↻ 가구를 돌리면 옆판·뒤판이 보이는 진짜 옆모습·뒷모습으로 보여요',
        '⬆️ 레벨 퀘스트가 따로 생겼어요: 깰 때마다 단계가 올라 더 어려워지고, 초기화되지 않아요',
        '📅 일간 퀘스트는 매일 3개, 깨도 어려워지지 않는 보통 퀘스트예요 (자정에 새로)',
        '🌲 마을을 네모로 둘러싸던 나무를 없앴어요. 마을이 바깥 땅과 바로 이어져요',
      ],
    },
    {
      v: 'v5', date: '2026-11-11', title: '레벨 · 마을 게시판 · 금주의 MVP 업데이트',
      items: [
        '⭐ 레벨이 생겼어요! 수확·낚시·채집·요리·사냥·퀘스트로 경험치를 모아요 (처음엔 쉽게, 갈수록 어렵게)',
        '🔓 레벨이 오르면 새 작물·동물·펫·가구·옷·요리법이 열리고, Lv.10·20에 가방이 45·54칸으로 늘어나요',
        '📌 마을 한가운데에 게시판이 생겼어요: 업데이트 소식, 건의함(원하는 업데이트를 적어 주세요!), 금주의 MVP',
        '🏅 금주의 MVP: 💰 부자 · 🏆 퀘스트 · 🌾 장인(수확·낚시·요리). 일요일 0시에 발표, 1~3등은 우편함으로 상품, 1등은 👑',
        '📮 우편함: 가방이 꽉 차서 못 받은 보상과 MVP 상품은 퀘스트 창 맨 위에서 받아요',
        '🗺️ 지도 정리: 오른쪽 위도 집 짓는 땅이 됐고, 동굴(왼쪽)과 나무꾼의 숲(오른쪽)은 맨 아래로 모았어요',
        '🌽 새 작물 토마토·옥수수·감자·수박, 🦆 새 동물 오리·염소·돼지, 🐱 새 펫 고양이·검은 고양이·토끼',
        '🍕 새 요리 9가지 (토마토 수프, 콘수프, 감자튀김, 피자, 트러플 파스타 등)',
        '🛋️ 가구 20여 가지, 🧱 벽지 5가지, 바닥 6가지, 👗 옷·모자·등 장식 11가지 추가',
        '🐾 펫을 여러 마리 기를 수 있어요 (따라다니는 건 1마리). 가방에 넣었다 꺼내도 이름을 기억해요',
        '↻ 돌린 의자·소파·침대 등이 옆모습·뒷모습으로 서 있는 것처럼 보여요',
        '🍽️ 조리대·싱크대·테이블 위에 그릇 선반·양념 선반·전자레인지·커피머신 등을 올려놓을 수 있어요',
        '🎁 퀘스트 보상은 주로 코인 + 경험치, 아이템은 가끔(상점에서 못 사는 것만)',
        '🔴 퀘스트 알림 숫자가 남아 있던 문제를 고쳤어요 (도감 보상은 도감 버튼에 따로 표시)',
      ],
    },
    {
      v: 'v4', date: '2026-11-10', title: '요리 · 도감 · 거래 · 강아지 업데이트',
      items: ['🍳 요리', '📖 도감', '📅 일간·주간·월간 퀘스트', '🤝 거래', '🐶 강아지', '📦 상자', '↻ 가구 회전', '🗺️ 미니맵'],
    },
  ];

  const SHARED = {
    UPDATES,
    TILE, OW, OH, W, H, CY, BX, WORLD_VERSION, REACH, BITE_WINDOW, SAPLING_MS, SPAWN, QUEST_ONLY,
    hash, strHash, ITEMS, GROUND, OBJ, WALLS, isSolidObj, canRotate, ROT_NAMES, ROT_DIRS, CROPS, FEED, ANIMALS, WILD_SPAWN, BOW_RANGE, maxPets, zoneAt,
    TX, TY, W0, H0, dungeonStar, DUNGEONS, toV7, ARMOR_TIERS, ARMOR_PARTS, JOB_LV, JOB_RESET_COST, JOBS, legacyJobTasks, legacyJobDone, titleConds, QUEST_DROPS, WEAPONS, maxHp, armorDef, dmgTaken, weaponAtk, itemLabel,
    MAX_EN, ENHANCE, MOBS, BOSS_SHARE, BOSS_RARE, MOB_RESPAWN, BOSS_RESPAWN, TITLES, titleOk,
    expToNext, levelInfo, EXP, invSize, levelUnlocks, shopLv, MVP_CATS, MVP_STAT, MVP_PRIZE, NATURAL, upgradeV4, removeTownBorder,
    FISH_TABLE, FISH_TABLES, rollFish, SHOP, SHOP_TABS, RECIPES, COOK, FOOD_BUFF_MS, QUESTS,
    PQ_TEMPLATES, PQ_SLOTS, PQ_NAMES, periods, makePQ, COLLECTIONS, COL_INDEX, colName,
    SKINS, HAIR_STYLES, HAIR_COLORS, EYES, TOPS, CLOTH, ACCESSORIES, BACKS, COSMETICS, COSMETIC_SRC, isLocked, FREE_ACC,
    defaultAvatar, sanitizeAvatar, INV_SIZE, CHEST_SIZE, starterInventory, countItem, addItem, removeItem, canTrade, canFit, PRICE_MULT, generateWorld, expandWorld,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHARED;
  else root.SHARED = SHARED;
})(typeof window !== 'undefined' ? window : globalThis);
