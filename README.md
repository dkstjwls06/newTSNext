# TS web app example

## Dev

```bash
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

Put .env.local in frontend while on developing.
`NEXT_PUBLIC_SOCKET_URL=http://localhost:3000`

Put .env.production in frontend while on service.
`NEXT_PUBLIC_SOCKET_URL=http://chess0924.iptime.org`

Put .env.development in server while on developing.
```
NODE_ENV=development
PORT=3000

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=chess-app-dev

CORS_ORIGIN=http://localhost:3000
```
Put .env.production in server while on service.
```
NODE_ENV=production
PORT=80              

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=chess-app-prod

CORS_ORIGIN=http://chess0924.iptime.org
```