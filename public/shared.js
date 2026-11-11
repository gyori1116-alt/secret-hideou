// 알PDF - 서버와 화면이 함께 쓰는 게임 데이터
// (아이템, 블록, 가구, 작물, 요리, 도감, 퀘스트, 아바타, 맵 생성)
(function (root) {
  'use strict';

  const TILE = 16;
  const OW = 64, OH = 48;             // 예전 맵 크기 (마을)
  const W = 100, H = 112;             // 지금 맵 크기: 마을(왼쪽 위) · 숲(오른쪽 위) · 집 짓는 들판(가운데) · 동굴(아래)
  const CY = 80;                      // 동굴이 시작하는 줄
  const WORLD_VERSION = 4;
  const REACH = 3.6 * TILE;           // 손이 닿는 거리
  const BITE_WINDOW = 1200;           // 찌가 흔들린 뒤 당길 수 있는 시간(ms)
  const SAPLING_MS = 60000;           // 묘목이 나무가 되는 시간
  const SPAWN = { x: 31.5 * TILE, y: 19.5 * TILE };
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
    bow: { name: '활', tool: 'bow', stack: 1, desc: 'Space로 화살 발사! (마우스 쪽 또는 바라보는 쪽) 야생 동물 사냥' },
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
  };
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (!it.stack) it.stack = 99;
    it.id = id;
    if (it.questOnly) { delete it.sell; it.desc = (it.desc || '') + ' · ' + QUEST_ONLY; }
  }

  // ───────── 바닥 / 블록 ─────────
  const GROUND = {
    grass: {}, water: { solid: 1 }, farm: {}, forest: {}, cave: {},
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
    chest: { solid: 1, chest: 1 },
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
  };
  for (const t in WALLS) OBJ[t] = Object.assign(OBJ[t] || {}, { solid: 1, wall: 1 });
  for (const id in ITEMS) {
    const it = ITEMS[id];
    if (it.ground) GROUND[it.ground] = Object.assign(GROUND[it.ground] || {}, { item: id });
    if (it.obj) OBJ[it.obj] = Object.assign(OBJ[it.obj] || {}, { item: id });
  }
  const isSolidObj = (o) => !!o && !!(OBJ[o.t] && OBJ[o.t].solid) && !(OBJ[o.t].door && o.open);
  // 돌릴 수 있는 것: 가구 (o.r = 시계 방향으로 90°씩 돌린 횟수, 0 앞 / 1 왼쪽 / 2 뒤 / 3 오른쪽)
  const canRotate = (t) => !!OBJ[t] && !!OBJ[t].item && ITEMS[OBJ[t].item].cat === 'furniture';
  const ROT_NAMES = ['앞', '왼쪽', '뒤', '오른쪽'];
  const ROT_DIRS = ['down', 'left', 'up', 'right']; // 앉았을 때 바라보는 쪽

  // ───────── 작물 ─────────
  // 물을 주면 stageMs 뒤에 한 단계 자라고, 다시 물이 필요해요 (0 씨앗 → 3 다 자람)
  const CROPS = {
    carrot: { name: '당근', seed: 'seed_carrot', produce: 'carrot', stageMs: 15000, yield: [1, 2] },
    strawberry: { name: '딸기', seed: 'seed_straw', produce: 'strawberry', stageMs: 22000, yield: [2, 3] },
    sunflower: { name: '해바라기', seed: 'seed_sunflower', produce: 'sunflower', stageMs: 28000, yield: [1, 2] },
    pumpkin: { name: '호박', seed: 'seed_pumpkin', produce: 'pumpkin', stageMs: 40000, yield: [1, 1] },
  };

  // ───────── 동물 ─────────
  // 집동물: 작물을 먹이면 produceMs 뒤에 선물 / 야생동물: 활이나 X로 사냥 / pet: 따라다니는 강아지
  const FEED = ['carrot', 'strawberry', 'sunflower', 'pumpkin'];
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
  };
  const WILD_SPAWN = { rabbit: 8, boar: 4, deer: 4 };
  const BOW_RANGE = 7 * TILE;
  const MAX_PETS = 2;

  // ───────── 지역 ─────────
  const zoneAt = (x, y) => (y >= CY ? 'cave' : y >= OH ? 'meadow' : x >= OW ? 'forest' : 'town');

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
  const SHOP_TABS = [
    ['farm', '🌱 농사', [['seed_carrot', 5], ['seed_straw', 10], ['seed_sunflower', 15], ['seed_pumpkin', 25], ['sapling', 15], ['flower', 5], ['path', 2], ['sand', 2]]],
    ['build', '🧱 벽·바닥', [['wall_white', 3], ['wall_pink', 4], ['wall_mint', 4], ['wall_blue', 4], ['wall_yellow', 4], ['wall_paper', 6], ['wall_dark', 5],
      ['door_white', 20], ['floor_pink', 3], ['floor_check', 3], ['floor_mint', 4], ['floor_kitchen', 4], ['floor_herring', 5], ['floor_marble', 8],
      ['rug', 6], ['rug_green', 6], ['carpet_blue', 6]]],
    ['furni', '🛋️ 가구', [['plant', 25], ['cactus', 35], ['plant_big', 50], ['cushion', 30], ['beanbag', 70], ['armchair', 90], ['sofa', 60], ['bed', 80],
      ['side_table', 45], ['picture', 40], ['clock', 60], ['display_shelf', 70], ['stand_lamp', 60], ['teddy', 100], ['tv', 300], ['computer', 400], ['bench', 50], ['chest', 40]]],
    ['kitchen', '🍳 주방', [['stove', 200], ['fridge', 250], ['sink', 150], ['counter', 40], ['microwave', 120], ['dish_rack', 50], ['kitchen_shelf', 60], ['floor_kitchen', 4]]],
    ['bath', '🛁 욕실', [['toilet', 120], ['bathtub', 220], ['washbasin', 100], ['shower', 180], ['mirror', 70], ['towel_rack', 40], ['washer', 260], ['bath_shelf', 50], ['floor_bath', 4]]],
    ['animal', '🐶 동물·도구', [['animal_chicken', 80], ['animal_sheep', 180], ['animal_cow', 250], ['pet_dog', 400], ['pet_dog_white', 600], ['bow', 120]]],
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
  ];

  // ───────── 요리 (가스레인지·전자레인지·모닥불·벽난로 앞에서 E) ─────────
  const COOK = [
    { out: 'carrot_soup', need: { carrot: 2 } },
    { out: 'fried_egg', need: { egg: 1 } },
    { out: 'grilled_fish', need: { fish_crucian: 1 } },
    { out: 'steak', need: { meat: 1 } },
    { out: 'strawberry_jam', need: { strawberry: 3 } },
    { out: 'strawberry_milk', need: { strawberry: 1, milk: 1 } },
    { out: 'omelet', need: { egg: 2, milk: 1 } },
    { out: 'sun_cookie', need: { sunflower: 1, egg: 1 } },
    { out: 'pumpkin_pie', need: { pumpkin: 1, egg: 1, milk: 1 } },
    { out: 'mushroom_soup', need: { mushroom: 2, milk: 1 } },
    { out: 'berry_tart', need: { berry: 3, egg: 1 } },
    { out: 'trout_grill', need: { fish_trout: 1, mushroom: 1 } },
    { out: 'bbq', need: { meat: 2, carrot: 1 } },
    { out: 'veggie_stew', need: { carrot: 1, pumpkin: 1, mushroom: 1 } },
    { out: 'sashimi', need: { fish_tropical: 1, fish_puffer: 1 } },
    { out: 'cave_stew', need: { fish_blind: 1, mushroom: 1 } },
    { out: 'golden_dish', need: { fish_golden: 1, carrot: 2, mushroom: 2 } },
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
    { id: 'suit', name: '정장', price: 400 }, { id: 'sailor', name: '세일러복', price: 350 }, { id: 'startee', name: '별무늬 티', price: 300 },
    { id: 'chefcoat', name: '요리사복', quest: 1 }, { id: 'armor', name: '기사 갑옷', quest: 1 },
    { id: 'hanbok', name: '한복', quest: 1 }, { id: 'royal', name: '왕실 드레스', quest: 1 },
  ];
  const CLOTH = ['#ff8fab', '#ffb36b', '#ffd95e', '#7ed492', '#6ec6ff', '#9b8cff', '#c9a0ff', '#f5f5f5', '#4a3b5c', '#e85d5d', '#8b5a3c', '#555a6e'];
  const ACCESSORIES = [
    { id: 'none', name: '없음' }, { id: 'ribbon', name: '리본' }, { id: 'flower', name: '꽃핀' }, { id: 'glasses', name: '안경' },
    { id: 'cap', name: '모자', price: 150 }, { id: 'bunny', name: '토끼 귀', price: 300 }, { id: 'beanie', name: '털모자', price: 200 },
    { id: 'beret', name: '베레모', price: 250 }, { id: 'headphones', name: '헤드폰', price: 350 }, { id: 'sunglasses', name: '선글라스', price: 300 },
    { id: 'frog', name: '개구리 모자', price: 400 },
    { id: 'catears', name: '고양이 귀', quest: 1 }, { id: 'crown', name: '왕관', quest: 1 }, { id: 'chef', name: '요리사 모자', quest: 1 },
    { id: 'strawhat', name: '밀짚모자', quest: 1 }, { id: 'fishhat', name: '물고기 모자', quest: 1 }, { id: 'flowercrown', name: '꽃 왕관', quest: 1 },
    { id: 'horns', name: '악마 뿔', quest: 1 }, { id: 'halo', name: '천사 링', quest: 1 }, { id: 'witch', name: '마법사 모자', quest: 1 },
    { id: 'santa', name: '산타 모자', quest: 1 }, { id: 'tiara', name: '티아라', quest: 1 },
  ];
  const BACKS = [
    { id: 'none', name: '없음' },
    { id: 'backpack', name: '배낭', price: 250 }, { id: 'cattail', name: '고양이 꼬리', price: 300 }, { id: 'cape', name: '망토', price: 400 },
    { id: 'wings', name: '천사 날개', quest: 1 }, { id: 'fairy', name: '요정 날개', quest: 1 }, { id: 'batwings', name: '박쥐 날개', quest: 1 },
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
    { id: 'fish', name: '🎣 낚시 도감', entries: ['fish_minnow', 'fish_crucian', 'fish_tropical', 'fish_puffer', 'fish_golden', 'fish_trout', 'fish_salmon', 'fish_blind', 'fish_shrimp', 'boot'], reward: { coins: 800, unlock: 'fishhat' } },
    { id: 'farm', name: '🌱 농사 도감', entries: ['carrot', 'strawberry', 'sunflower', 'pumpkin'], reward: { coins: 300, unlock: 'strawhat' } },
    { id: 'cook', name: '🍳 요리 도감', entries: COOK.map((r) => r.out), reward: { coins: 1000, unlock: 'chefcoat' } },
    { id: 'hunt', name: '🏹 사냥 도감', entries: ['hunt:rabbit', 'hunt:boar', 'hunt:deer'], reward: { coins: 300, items: { deer_trophy: 1 } } },
    { id: 'ranch', name: '🐔 목장 도감', entries: ['egg', 'milk', 'wool'], reward: { coins: 300, items: { windmill: 1 } } },
    { id: 'mine', name: '⛏ 광석 도감', entries: ['stone', 'iron', 'gold', 'gem'], reward: { coins: 500, items: { crystal_lamp: 1 } } },
    { id: 'forage', name: '🍄 채집 도감', entries: ['wood', 'mushroom', 'berry', 'pinecone'], reward: { coins: 300, unlock: 'fairy' } },
  ];
  const COL_INDEX = {};
  COLLECTIONS.forEach((c) => c.entries.forEach((e) => { COL_INDEX[e] = c.id; }));
  const colName = (e) => (e.startsWith('hunt:') ? ANIMALS[e.slice(5)].name : ITEMS[e].name);

  // ───────── 업적 퀘스트 (한 번만) ─────────
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
    // 새 퀘스트
    { id: 'q_cook1', name: '꼬마 요리사', desc: '요리 1번 하기 (가스레인지·모닥불 앞에서 E)', stat: 'cook', goal: 1, reward: { coins: 80, items: { seed_carrot: 5 } } },
    { id: 'q_cook10', name: '요리 솜씨', desc: '요리 10번 하기', stat: 'cook', goal: 10, reward: { unlock: 'chef' } },
    { id: 'q_cook50', name: '셰프의 길', desc: '요리 50번 하기', stat: 'cook', goal: 50, reward: { items: { fireplace: 1 }, coins: 500 } },
    { id: 'q_eat', name: '먹방', desc: '음식 5번 먹기 (요리를 들고 Space)', stat: 'eat', goal: 5, reward: { coins: 150 } },
    { id: 'q_iron', name: '광부', desc: '철광석 10개 캐기 (동굴)', stat: 'iron', goal: 10, reward: { items: { torch: 10 }, coins: 100 } },
    { id: 'q_gold', name: '골드러시', desc: '금광석 5개 캐기', stat: 'gold', goal: 5, reward: { items: { statue: 1 } } },
    { id: 'q_gem', name: '보석 사냥꾼', desc: '수정 3개 캐기', stat: 'gem', goal: 3, reward: { items: { crystal_lamp: 1 } } },
    { id: 'q_mush', name: '버섯 따기', desc: '버섯 10개 따기 (숲에서 E)', stat: 'mushroom', goal: 10, reward: { coins: 120 } },
    { id: 'q_berry', name: '산딸기 소녀', desc: '산딸기 15개 따기', stat: 'berry', goal: 15, reward: { unlock: 'flowercrown' } },
    { id: 'q_wood100', name: '숲의 나무꾼', desc: '나무 100개 모으기', stat: 'wood', goal: 100, reward: { items: { windmill: 1 } } },
    { id: 'q_hunt10', name: '숲의 사냥꾼', desc: '야생 동물 10마리 사냥하기', stat: 'hunt', goal: 10, reward: { unlock: 'horns' } },
    { id: 'q_sit', name: '쉬어가요', desc: '의자·소파에 5번 앉기 (E)', stat: 'sit', goal: 5, reward: { coins: 60 } },
    { id: 'q_tv', name: '텔레비전 보자', desc: 'TV 5번 켜기', stat: 'tv', goal: 5, reward: { items: { arcade: 1 } } },
    { id: 'q_sleep', name: '꿀잠', desc: '침대에 3번 눕기 (E)', stat: 'lie', goal: 3, reward: { items: { music_box: 1 } } },
    { id: 'q_trade1', name: '첫 거래', desc: '친구와 1번 거래하기 (접속자 목록 🤝)', stat: 'trade', goal: 1, reward: { coins: 100 } },
    { id: 'q_trade10', name: '무역왕', desc: '친구와 10번 거래하기', stat: 'trade', goal: 10, reward: { items: { trophy: 1 } } },
    { id: 'q_pet', name: '멍멍이 친구', desc: '강아지 10번 쓰다듬기 (E)', stat: 'pet', goal: 10, reward: { items: { cat_tower: 1 } } },
    { id: 'q_fish50', name: '바다의 전설', desc: '물고기 50마리 낚기', stat: 'fish', goal: 50, reward: { items: { rod_gold: 1 } } },
    { id: 'q_farm100', name: '대농장주', desc: '작물 100개 수확하기', stat: 'harvest', goal: 100, reward: { items: { can_gold: 1 } } },
    { id: 'q_col10', name: '수집가', desc: '도감 10칸 채우기', stat: 'col', goal: 10, reward: { items: { aquarium: 1 } } },
    { id: 'q_col30', name: '박물관장', desc: '도감 30칸 채우기', stat: 'col', goal: 30, reward: { unlock: 'wings' } },
    { id: 'q_daily10', name: '성실한 하루', desc: '일간 퀘스트 10개 깨기', stat: 'dailyDone', goal: 10, reward: { unlock: 'halo' } },
    { id: 'q_daily50', name: '퀘스트 마스터', desc: '일간 퀘스트 50개 깨기', stat: 'dailyDone', goal: 50, reward: { items: { throne: 1 } } },
    { id: 'q_weekly5', name: '한 주 한 주', desc: '주간 퀘스트 5개 깨기', stat: 'weeklyDone', goal: 5, reward: { items: { floor_star: 30 } } },
    { id: 'q_rich', name: '부자', desc: '상점에 팔아서 5000코인 벌기', stat: 'earned', goal: 5000, reward: { items: { wall_gold: 30 } } },
    { id: 'q_furn50', name: '인테리어 장인', desc: '가구 50개 놓기', stat: 'furniturePlaced', goal: 50, reward: { items: { piano: 1 } } },
    { id: 'q_build100', name: '건축가', desc: '벽·창문·문 100개 세우기', stat: 'wallPlaced', goal: 100, reward: { items: { wall_candy: 30 } } },
    { id: 'q_path100', name: '길 닦는 사람', desc: '길 블록 100개 깔기', stat: 'pathPlaced', goal: 100, reward: { items: { fountain: 1 } } },
    { id: 'q_plant', name: '씨앗 뿌리기', desc: '씨앗 30개 심기', stat: 'plant', goal: 30, reward: { items: { scarecrow: 1 } } },
    { id: 'q_water', name: '물 주기 달인', desc: '물 50번 주기', stat: 'water', goal: 50, reward: { coins: 200 } },
    { id: 'q_produce30', name: '목장의 아침', desc: '달걀·우유·양털 30개 모으기', stat: 'produce', goal: 30, reward: { items: { pet_dog_spot: 1 } } },
    { id: 'q_spend', name: '쇼핑왕', desc: '상점에서 3000코인 쓰기', stat: 'spent', goal: 3000, reward: { unlock: 'witch' } },
    { id: 'q_chat100', name: '인싸', desc: '채팅 100번 하기', stat: 'chat', goal: 100, reward: { items: { telescope: 1 } } },
  ];

  // ───────── 일간 / 주간 / 월간 퀘스트 ─────────
  // 일간: 3개, 깨면 레벨이 올라 더 어려운 퀘스트가 새로 나와요. 한국 시간 00시에 초기화
  // 주간: 4개, 일요일 00시에 초기화 / 월간: 3개, 다음 달 1일 00시에 초기화
  const PQ_TEMPLATES = [
    { stat: 'fish', n: 3, coin: 40, t: '물고기 {n}마리 낚기' },
    { stat: 'harvest', n: 5, coin: 40, t: '작물 {n}개 수확하기' },
    { stat: 'wood', n: 15, coin: 30, t: '나무 {n}개 모으기' },
    { stat: 'stone', n: 10, coin: 30, t: '돌 {n}개 모으기' },
    { stat: 'cook', n: 2, coin: 50, t: '요리 {n}번 하기' },
    { stat: 'feed', n: 3, coin: 35, t: '동물에게 밥 {n}번 주기' },
    { stat: 'produce', n: 2, coin: 40, t: '달걀·우유·양털 {n}개 받기' },
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
  const DAILY_BONUS = [{ seed_pumpkin: 3 }, { seed_sunflower: 4 }, { torch: 6 }, { omelet: 1 }, { mushroom: 4 }, { iron: 3 }, { steak: 2 }, { seed_straw: 6 }];
  const WEEKLY_POOL = [{ piano: 1 }, { fireplace: 1 }, { cat_tower: 1 }, { arcade: 1 }, { telescope: 1 }, { floor_star: 20 }, { rug_rainbow: 20 },
    { wall_candy: 20 }, { wall_rainbow: 20 }, { xmas_tree: 1 }, { music_box: 1 }, { aquarium: 1 }, { fountain: 1 }, { crystal_lamp: 1 }];
  const MONTHLY_POOL = [{ unlock: 'santa' }, { unlock: 'tiara' }, { unlock: 'armor' }, { unlock: 'hanbok' }, { unlock: 'royal' }, { unlock: 'batwings' },
    { items: { throne: 1 } }, { items: { royal_bed: 1 } }, { items: { floor_gold: 30 } }, { items: { wall_gold: 30 } }, { items: { trophy: 1 } },
    { items: { rod_gold: 1 } }, { items: { can_gold: 1 } }, { items: { pet_dog_spot: 1 } }, { items: { statue: 1 } }];
  const PQ_SLOTS = { d: 3, w: 4, m: 3 };
  const PQ_NAMES = { d: '일간', w: '주간', m: '월간' };

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
    if (type === 'd') {
      goal = Math.max(1, Math.round(tpl.n * (1 + 0.3 * lv)));
      reward = { coins: Math.round(tpl.coin * (1 + 0.25 * lv)) };
      if (lv % 3 === 2) reward.items = Object.assign({}, DAILY_BONUS[Math.floor(strHash(seed + ':b') * DAILY_BONUS.length)]);
    } else if (type === 'w') {
      goal = tpl.n * 6;
      reward = { coins: tpl.coin * 5, items: Object.assign({}, WEEKLY_POOL[Math.floor(strHash(seed + ':r') * WEEKLY_POOL.length)]) };
    } else {
      goal = tpl.n * 20;
      const r = MONTHLY_POOL[Math.floor(strHash(seed + ':r') * MONTHLY_POOL.length)];
      reward = Object.assign({ coins: tpl.coin * 15 }, r.items ? { items: Object.assign({}, r.items) } : {}, r.unlock ? { unlock: r.unlock } : {});
    }
    return { stat: tpl.stat, goal, desc: tpl.t.replace('{n}', goal), reward, lv };
  }

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
  function generateWorld() {
    const ground = Array.from({ length: H }, () => new Array(W).fill('grass'));
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

  // 숲(오른쪽)과 동굴(아래)을 만들고 마을과 이어요. 예전 맵을 넓힐 때도 그대로 써요.
  // ground: H×W 배열, objects: { "x,y": obj } — 마을(x<64, y<48) 안은 길목 말고는 건드리지 않아요.
  function expandWorld(ground, objects) {
    const setG = (x, y, g) => { ground[y][x] = g; };
    const setO = (x, y, o) => { if (o) objects[x + ',' + y] = o; else delete objects[x + ',' + y]; };
    const getO = (x, y) => objects[x + ',' + y];

    // ── 숲: x 64~99, y 0~47
    for (let y = 0; y < OH; y++) for (let x = OW; x < W; x++) {
      setG(x, y, 'forest'); setO(x, y, null);
      if (y < 2 || x >= W - 2 || y >= OH - 2) setO(x, y, { t: 'pine', fixed: 1 });
    }
    // 숲속 연못
    for (let y = 4; y < 18; y++) for (let x = 82; x < 96; x++) {
      const dx = (x + 0.5 - 89) / 5, dy = (y + 0.5 - 10) / 3.5, d = dx * dx + dy * dy;
      if (d < 1) setG(x, y, 'water'); else if (d < 1.5) setG(x, y, 'sand');
    }
    const camp = { x: 80, y: 26 };
    for (let x = OW - 2; x <= camp.x; x++) setG(x, 24, 'path');
    for (let y = 15; y <= 24; y++) setG(camp.x, y, 'path');
    const isPath = (x, y) => ground[y][x] === 'path' || ground[y][x] === 'sand' || ground[y][x] === 'water';
    for (let y = 2; y < OH - 2; y++) for (let x = OW; x < W - 2; x++) {
      if (isPath(x, y)) continue;
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
    setO(OW + 1, 23, { t: 'sign', text: '🌲 나무꾼의 숲 → (나무 X, 버섯·산딸기 E)' });
    setO(camp.x + 1, camp.y - 2, { t: 'sign', text: '🔥 모닥불 (E로 요리)' });

    // ── 집 짓는 들판: x 0~99, y 48~79 (넓은 빈 풀밭)
    for (let y = OH; y < CY; y++) for (let x = 0; x < W; x++) {
      setG(x, y, 'grass'); setO(x, y, null);
      if (x < 2 || x >= W - 2) { setO(x, y, { t: 'tree', fixed: 1 }); continue; }
      const r = hash(x * 7 + 5, y * 11 + 3);
      if (r < 0.008) setO(x, y, { t: 'tree' });
      else if (r > 0.96) setO(x, y, { t: 'flower' });
    }
    // 들판 작은 연못 (낚시용)
    for (let y = OH + 2; y < CY - 2; y++) for (let x = 4; x < 24; x++) {
      const dx = (x + 0.5 - 12) / 4.5, dy = (y + 0.5 - 64) / 2.8, d = dx * dx + dy * dy;
      if (d < 1) { setG(x, y, 'water'); setO(x, y, null); } else if (d < 1.45) { setG(x, y, 'sand'); setO(x, y, null); }
    }
    for (let y = OH - 2; y < CY; y++) { setG(31, y, 'path'); setO(31, y, null); }
    setO(33, OH + 1, { t: 'sign', text: '🏡 집 짓는 들판 — 마음껏 지어요!' });
    setO(33, CY - 3, { t: 'sign', text: '⛏ 아래로 가면 동굴' });
    // 마을 → 들판 길목 (마을 아래쪽 나무 넓게 치우기)
    for (let y = OH - 2; y < OH; y++) for (let x = 20; x <= 42; x++) { setO(x, y, null); setG(x, y, x === 31 ? 'path' : 'grass'); }
    // 숲 → 들판 길목
    for (let y = OH - 2; y < OH; y++) for (let x = 72; x <= 90; x++) { setO(x, y, null); setG(x, y, 'forest'); }

    // ── 동굴: y 80~111 (전부 바위벽으로 채운 뒤 안쪽을 파요)
    for (let y = CY; y < H; y++) for (let x = 0; x < W; x++) { setG(x, y, 'cave'); setO(x, y, { t: 'cave_wall', fixed: 1 }); }
    const corridorY = CY + 16;
    const open = (x, y) => {
      if (x < 4 || x >= W - 4 || y < CY + 4 || y >= H - 3) return false;
      if (Math.abs(y - corridorY) <= 1 || Math.abs(x - 31) <= 1) return true;
      const cx = Math.floor(x / 3), cy = Math.floor(y / 3);
      return hash(cx * 7 + 3, cy * 13 + 1) > 0.2;
    };
    for (let y = CY; y < H; y++) for (let x = 0; x < W; x++) if (open(x, y)) setO(x, y, null);
    // 입구 굴 (들판 가운데 길에서 이어져요)
    for (let y = CY - 2; y < CY + 5; y++) for (let x = 29; x <= 33; x++) {
      if (y < CY) { setO(x, y, null); setG(x, y, 'path'); } else setO(x, y, null);
    }
    // 지하 호수
    for (let y = CY + 4; y < H - 3; y++) for (let x = 60; x < 92; x++) {
      const dx = (x + 0.5 - 76) / 7, dy = (y + 0.5 - (CY + 24)) / 3.5;
      if (dx * dx + dy * dy < 1) { setG(x, y, 'water'); setO(x, y, null); }
      else if (dx * dx + dy * dy < 1.6 && getO(x, y) && getO(x, y).t === 'cave_wall') setO(x, y, null);
    }
    // 바위와 광석 (깊을수록 귀한 광석)
    for (let y = CY + 4; y < H - 3; y++) for (let x = 4; x < W - 4; x++) {
      if (getO(x, y) || ground[y][x] !== 'cave') continue;
      if (Math.abs(y - corridorY) <= 1 || (Math.abs(x - 31) <= 1 && y < corridorY)) continue;
      const depth = (y - CY) / (H - CY);
      const r = hash(x * 5 + 11, y * 9 + 7);
      if (r < 0.08) setO(x, y, { t: 'rock' });
      else if (r < 0.13) setO(x, y, { t: 'ore_iron' });
      else if (r < 0.13 + 0.01 + 0.025 * depth) setO(x, y, { t: 'ore_gold' });
      else if (r < 0.165 + 0.02 * depth) setO(x, y, depth > 0.4 ? { t: 'crystal' } : { t: 'rock' });
    }
    // 횃불
    for (let x = 6; x < W - 6; x += 7) if (!getO(x, corridorY - 1)) setO(x, corridorY - 1, { t: 'torch', fixed: 1 });
    for (let y = CY + 2; y < corridorY; y += 5) setO(29, y, { t: 'torch', fixed: 1 });
    setO(33, CY + 1, { t: 'sign', text: '⛏ 동굴 (바위·광석 X로 캐요)' });

    // ── 마을 → 숲 길목 (오른쪽 가장자리 나무 치우기)
    for (let y = 23; y <= 25; y++) for (let x = OW - 2; x < OW; x++) { setO(x, y, null); setG(x, y, y === 24 ? 'path' : 'grass'); }
  }

  const SHARED = {
    TILE, OW, OH, W, H, CY, WORLD_VERSION, REACH, BITE_WINDOW, SAPLING_MS, SPAWN, QUEST_ONLY,
    hash, strHash, ITEMS, GROUND, OBJ, WALLS, isSolidObj, canRotate, ROT_NAMES, ROT_DIRS, CROPS, FEED, ANIMALS, WILD_SPAWN, BOW_RANGE, MAX_PETS, zoneAt,
    FISH_TABLE, FISH_TABLES, rollFish, SHOP, SHOP_TABS, RECIPES, COOK, FOOD_BUFF_MS, QUESTS,
    PQ_TEMPLATES, PQ_SLOTS, PQ_NAMES, periods, makePQ, COLLECTIONS, COL_INDEX, colName,
    SKINS, HAIR_STYLES, HAIR_COLORS, EYES, TOPS, CLOTH, ACCESSORIES, BACKS, COSMETICS, COSMETIC_SRC, isLocked, FREE_ACC,
    defaultAvatar, sanitizeAvatar, INV_SIZE, CHEST_SIZE, starterInventory, countItem, addItem, removeItem, canTrade, canFit, PRICE_MULT, generateWorld, expandWorld,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SHARED;
  else root.SHARED = SHARED;
})(typeof window !== 'undefined' ? window : globalThis);
