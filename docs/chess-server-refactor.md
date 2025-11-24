# chess-server-refactor: 서버 구조 및 환경 정리

## 1. 목표

- 온라인 사용자끼리 **실시간 체스**를 둘 수 있는 웹 앱.
- **하나의 Node 서버(Express + Socket.IO + Next.js)** 로
  - 정적/동적 페이지 렌더링 (Next.js)
  - 실시간 체스 통신 (Socket.IO)
  를 모두 처리한다.

## 2. 환경

### 개발 환경

- OS: Windows 11
- 브라우저에서 `http://localhost:3000` 으로 접속해서 테스트.
- 개발 시에는 Next.js, Express, Socket.IO를 **통합 서버(dev 모드)** 로 구동하는 것을 기준으로 한다.

### 배포 환경

- 하드웨어: Raspberry Pi 4 (Linux)
- 도메인: `chess0924.iptime.org`
- 포트: 80 (HTTP, 추후 HTTPS 도입 예정)
- Pi에서 코드 빌드 후, Node 서버를 실행해 서비스한다.
- 실제 서비스는 추후 reverse proxy(예: nginx) 도입을 고려하지만,
  1차 목표는 **Node 서버를 직접 80 포트에서 띄우는 것**을 가정한다
  (리눅스에서 80포트는 root 권한이 필요하다는 점을 주의).

## 3. 현재 리포지토리 구조 (요약)

- 루트
  - `frontend/`: Next.js 16 기반 프론트엔드
  - `server/`: Express + Socket.IO + Next 통합 서버 (TypeScript)
  - `package.json`: 루트 스크립트 (dev/build/start 등)
- `server/src/index.ts`
  - `next({ dev, dir: ../../frontend })` 로 Next 앱을 로딩
  - `http.createServer(app)` 위에 Socket.IO(`Server`)를 붙이고
  - 모든 HTTP 요청은 `handle(req, res)` 로 Next에 위임
  - 현재 CORS `origin: "*"` 상태, 포트는 `process.env.PORT || 3000` 을 사용
- `frontend/lib/socket.ts`
  - Socket.IO 클라이언트가 **고정 주소** `http://chess0924.iptime.org:80` 에 연결하도록 되어 있음
  - dev/prod 환경에 따라 다른 서버를 쓰는 구조는 아직 없음

## 4. 리팩토링 방향 (요약)

1. **서버 구동 방식 통합**
   - 개발: Windows 11에서 `npm run dev` 로
     `Express + Socket.IO + Next` 통합 dev 서버(포트 3000)를 실행.
   - 배포: Raspberry Pi 4에서 `npm run build && PORT=80 npm start` 로
     통합 서버를 production 모드로 실행.

2. **크로스 플랫폼 스크립트**
   - Windows/리눅스 모두에서 동일한 npm 스크립트를 사용할 수 있도록
     `cross-env` 를 도입하고, `NODE_ENV` 설정을 통일.

3. **Socket.IO 접속 URL 동적화**
   - 클라이언트(`frontend/lib/socket.ts`)에서
     - 개발: `http://localhost:3000`
     - 배포: `http://chess0924.iptime.org`
     로 자동/환경변수 기반 전환이 가능하도록 수정.

4. **CORS 및 포트 정책 정리**
   - dev: `origin` 에 `http://localhost:3000`
   - prod: `origin` 에 `http://chess0924.iptime.org`
   를 허용하도록 CORS 설정 분리.
   - 포트는 `PORT` 환경 변수로 제어하고, 디폴트는 3000으로 유지.
