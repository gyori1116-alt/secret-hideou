# 🏠 비밀 아지트

2D 픽셀 실시간 멀티플레이 소셜 게임. 브라우저 링크 하나로 접속해서 방향키로 돌아다니고, 머리 위 말풍선으로 대화해요.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `server.js` | 실시간 서버 (Express + Socket.IO). 접속자 위치를 초당 20번 모두에게 전달, 채팅 50개 보관 |
| `public/index.html` | 화면 틀: 입장 화면, 채팅창, 접속자 목록 |
| `public/client.js` | 게임 본체: 맵 그리기, 캐릭터 이동·충돌, 말풍선, 채팅 |
| `package.json` | 필요한 라이브러리 목록 |

## 내 컴퓨터에서 실행

[Node.js](https://nodejs.org) (LTS 버전) 설치 후, 이 폴더에서:

```bash
npm install
npm start
```

브라우저에서 http://localhost:3000 을 열고, 창을 하나 더 열면 혼자서 2인 테스트를 할 수 있어요.

## 인터넷에 올려서 언니 초대하기 (Render 무료)

1. **GitHub에 올리기**: github.com 가입 → New repository → 이 폴더의 파일들을 업로드 (`node_modules` 폴더는 빼고).
2. **Render 가입**: render.com → GitHub 계정으로 로그인.
3. **New + → Web Service** → 방금 만든 저장소 선택.
4. 설정:
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
5. (선택) **Environment** 에 `ROOM_CODE` = `우리만아는암호` 추가 → 이 코드를 아는 사람만 입장 가능.
6. **Create Web Service** → 몇 분 뒤 `https://내이름.onrender.com` 주소가 생겨요. 이 링크를 언니한테 보내면 끝!

> ⚠️ Render 무료 플랜은 15분 동안 아무도 없으면 잠들어요. 다음 첫 접속 때 깨어나는 데 30~60초 걸리니, 링크를 열고 조금 기다리면 돼요. 서버가 잠들면 채팅 기록도 지워져요.

코드를 고친 뒤 GitHub에 다시 올리면 Render가 자동으로 새 버전을 배포해요.

## 조작법

- **WASD / 방향키**: 이동
- **Enter**: 채팅 입력 → Enter로 전송 (Esc로 취소)
- 상대가 입력 중이면 머리 위에 `...` 이 떠요

## 고쳐보기 쉬운 곳

- 맵 모양: `client.js` 의 `buildMap()` — 나무 좌표, 집 위치, 연못 크기 등
- 캐릭터 모양/색: `drawChar()` 와 `COLORS`
- 이동 속도·말풍선 시간: 파일 맨 위 `SPEED`, `BUBBLE_MS`
- 맵 크기(`W`, `H`)를 바꾸면 `server.js` 의 `MAP_W`, `MAP_H` 도 같이 바꿔 주세요.
