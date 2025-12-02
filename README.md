
# 온라인 체스 웹앱 

창의공학설계 과제용 **실시간 체스 + 친구/DM + 방 채팅** 프로젝트입니다.  
Next.js 프런트엔드와 Express + Socket.IO + MongoDB 백엔드가 하나의 리포지토리에서 동작합니다.

---

## 1. 프로젝트 구조

```text
.
├─ frontend/      # Next.js (App Router, TypeScript, Tailwind, Socket.IO client)
├─ server/        # Express + Socket.IO + MongoDB + Auth (JWT + Email 인증)
└─ docs/
   └─ db-design.md  # MongoDB 스키마/설계 문서
````

---

## 2. 스크립트 (루트 package.json 기준)

```bash
# 개발 (권장) - server 쪽 dev 스크립트만 실행
npm run dev
```

```js
"scripts": {
  // === 개발용 (권장) ===
  // 통합 서버(dev 모드)만 사용: Next + Socket.IO + Express를 한 번에
  "dev": "cd server && npm run dev",

  // === 빌드 ===
  // 프론트 Next 빌드 후 서버 TS 빌드
  "build:front": "cd frontend && npm run build",
  "build:back": "cd server && npm run build",
  "build": "npm run build:front && npm run build:back",

  // === 프로덕션 실행 ===
  // 빌드된 서버 실행 (server 쪽 start는 NODE_ENV=production을 설정)
  "start": "cd server && npm start",

  // === (옵션) 예전 방식 유지하고 싶을 때 ===
  // Next dev 서버와 서버 TS watch를 따로 돌리는 옛 구조
  "dev:split": "concurrently \"npm run dev:front\" \"npm run dev:back\"",
  "dev:front": "cd frontend && npm run dev",
  "dev:back": "cd server && npx tsc -w"
}
```

* 개발 시에는 보통:

  ```bash
  npm install
  npm run dev
  ```

  만 실행하면 됩니다. (MongoDB는 로컬에 띄워져 있어야 함)

---

## 3. 환경 변수 설정

### 3-1. 프런트엔드 (Next.js)

프런트에서 Socket.IO 서버 주소를 설정합니다.

개발용: `frontend/.env.local`

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

서비스용: `frontend/.env.production`

```env
NEXT_PUBLIC_SOCKET_URL=http://chess0924.iptime.org
```

`frontend/lib/socket.ts`에서 위 값을 우선 사용하고, 없으면 `window.location.origin` 또는 기본값 `http://localhost:3000`을 사용하도록 되어 있습니다.

### 3-2. 서버 (Express + Socket.IO + MongoDB + Auth)

서버에서는 `server/.env.development`, `server/.env.production` 파일을 사용합니다.
(실제 값은 민감 정보이므로 예시는 더미 값으로 작성합니다.)

개발용: `server/.env.development`

```env
NODE_ENV=development
PORT=3000

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=chess-app-dev

APP_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Auth / 세션 쿠키
AUTH_SECRET=change-this-to-a-long-random-string
AUTH_COOKIE_NAME=chess_auth

# 이메일 발송 설정 (회원가입 이메일 인증용)
EMAIL_FROM="chess0924 <no-reply@example.com>"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-account@gmail.com
SMTP_PASS=your-app-password
```

서비스용: `server/.env.production`

```env
NODE_ENV=production
PORT=80

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=chess-app-prod

APP_ORIGIN=http://chess0924.iptime.org
CORS_ORIGIN=http://chess0924.iptime.org

# Auth / 세션 쿠키
AUTH_SECRET=change-this-to-a-different-strong-secret
AUTH_COOKIE_NAME=chess_auth

# 이메일 발송 설정 (회원가입 이메일 인증용)
EMAIL_FROM="chess0924 <no-reply@your-domain>"

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-account@gmail.com
SMTP_PASS=your-app-password
```

서버 쪽에서는 `server/src/config/env.ts`에서 위 환경 변수를 읽어서 사용합니다.

* MongoDB 연결 정보 (`MONGODB_URI`, `MONGODB_DB_NAME`)
* CORS / APP_ORIGIN
* 인증 키 및 쿠키 이름 (`AUTH_SECRET`, `AUTH_COOKIE_NAME`)
* 이메일 발송 설정 (`EMAIL_FROM`, `SMTP_*`)

---

## 4. 기능 개요 (현재까지 구현 방향 요약)

* 회원가입 (이메일 + 비밀번호)

  * 비밀번호는 bcrypt 해시 저장
  * 이메일 인증 토큰 생성 후 SMTP로 인증 메일 발송
* 이메일 인증 페이지

  * 토큰 검증 후 계정 활성화
* 로그인

  * 이메일 + 비밀번호 검증
  * 이메일 미인증 계정은 로그인 불가
  * 성공 시 HTTP-only 쿠키(`AUTH_COOKIE_NAME`)에 세션 토큰 저장
* 추후 구현 예정

  * 비밀번호 초기화 (reset password)
  * 친구 / DM / 친선전, 방 채팅
  * 랭크 게임 및 전적/레이팅 관리 (MongoDB `docs/db-design.md` 참고)

---

## 5. MongoDB 설계

MongoDB 컬렉션 및 스키마 설계는 `docs/db-design.md` 문서를 기준으로 합니다.

* `users`, `friendships`, `conversations`, `chatMessages`, `rooms`, `games`,
  `matchQueues`, `userStats`, `friendlyMatchRequests` 등

실제 서버 코드에서는 `server/src/db/types.ts`, `server/src/db/collections.ts` 에서 해당 설계를 반영한 타입/컬렉션 핸들러를 사용합니다.

