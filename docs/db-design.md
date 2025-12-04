# 실시간 체스 앱의 MongoDB용 NoSQL Database 설계 과정

------

## 1. 1단계 – 요구사항(기능) 정리

먼저 “어떤 기능이 있는지”를 전부 나열하는 단계.

### 1) 유저/인증/레이팅

- 회원가입 / 로그인
- 닉네임으로 유저 검색
- 유저 프로필(아바타, 닉네임, 레이팅 등) 조회

### 2) 친구 & 1:1 DM

- 닉네임으로 유저 검색 → 친구 요청 보내기
- 친구 요청 수락/거절
- 친구 삭제/차단
- 친구끼리만 1:1 채팅(DM) 가능
- 친구끼리 친선 경기 요청 가능 
  - DM / 친구 목록 등에서 "친선 경기 신청" 요청 -> 상대 수락 / 거절
  - 시간제, 초읽기 등 커스텀 옵션 설정 가능
  - 이 매치는 레이팅에 영향을 주지 않음 (non-rated, friendly)
- DM 방에서 채팅 로그 조회(최근 N개, 스크롤 시 더 가져오기)

### 3) 게임 방 & 실시간 게임

- 방 생성 (public/AI/friendly)
  - 매칭으로 생성 시, public 타입 활성화
  - AI 버전은 이번 프로젝트에서는 구현하지 않지만, 추후 고도화를 위해 타입은 남겨둘 것
  - 친선 경기 수락 시, 두 친구만 들어가는 friendly 타입 활성화
- public 시에는 rated 켜기, friendly 시에는 rated 끄기
- friendly 시에는 요청 시 옵션에서 골랐던 커스텀 기능 활성화
- 방 목록 보기 (대기 중 / 진행 중)
- 방 입장/퇴장, 관전자 입장
- 현재 게임 상태 공유
  - 판 상태(FEN)
  - 턴/수순
  - 남은 시간(초읽기)
- 방 안에서 실시간 방 채팅

### 4) 게임 기록

- 게임 종료 시 전체 수를 저장
- 유저별 전적/최근 게임 목록 조회
- 게임별 세부 기록(수순, 승패, 이유, 레이팅 변화) 조회

### 5) 매칭 큐(빠른 매칭)

- “빠른 매칭” 버튼 → 대기열에 들어감 (랭킹 활성화)
- 비슷한 레이팅 + 동일 시간 컨트롤 사용자끼리 자동 매칭
- 비슷한 레이팅의 유저가 없을 시, 단계적으로 매칭 레이팅 범위 확대
- 매칭 후 방 자동 생성

### 6) 전적/통계 캐시

- 유저 프로필에서 전체 승/패/무, 모드별 전적, 승률 등을 빠르게 보여주고 싶음
- 매번 `games`를 aggregate 하기엔 부담 → 캐시 컬렉션 필요

------

## 2. 2단계 – 접근 패턴(쿼리 패턴) 정리

NoSQL 설계에서 제일 중요한 “어떤 쿼리가 자주 나오냐”를 정리하는 단계.

- 로그인  
  → `email` 또는 `username`으로 `users` 찾기
- 유저 검색  
  → `username` 부분 매칭 / prefix 매칭
- 친구 상태 확인  
  → “나와 저 사람 사이의 친구 상태(대기, 수락, 차단)를 알고 싶다”
- 친구 목록  
  → “나와 친구인 모든 유저 목록”
- DM 방 찾기  
  → “유저 A와 B 사이의 1:1 대화방(conversation) 가져오기”
- DM 메시지 로딩  
  → “이 conversation의 최근 50개 메시지”
- “A가 B에게 보낸 **친선 경기 요청 목록**”
  - `fromUserId = A`, `status = "pending"`
- “B에게 도착한 **친선 경기 요청 목록**”
  - `toUserId = B`, `status = "pending"`
- “특정 요청의 상태” 확인  
  - 수락/거절/취소/만료 여부
- “친선 경기 수락 시”  
  - 요청의 옵션(timeControl, 기타 설정)을 읽어서  
  - **friendly 타입 방**(rooms) 생성
- 방 목록  
  → `status = waiting` / `in_progress` 인 방 리스트
- 방 정보  
  → roomId로 현재 게임 상태 + 참가자 정보
- 방 채팅  
  → 방의 최근 N개 채팅
- 게임 기록  
  → 특정 유저가 참가한 최근 게임들  
  → 특정 게임의 전체 수(run-through)
- 매칭 큐  
  → 특정 모드/시간제에 대해 `status = waiting` 인 유저들 중 상대 찾기

이 패턴을 기준으로, “어떤 데이터를 함께 묶어야 빠른지”를 결정한다.

------

## 3. 3단계 – 엔티티(컬렉션 후보) 추출

위 기능/쿼리를 기준으로 묶으면, 대략 이런 “덩어리”들이 나온다:

1. `users` – 계정, 프로필, 레이팅
2. `friendships` – 두 유저 사이의 친구/차단 관계
3. `conversations` – 1:1 DM 방
4. `chatMessages` – 채팅 메시지(방 채팅 + DM 공통)
5. `rooms` – 실시간 체스 방 + 현재 게임 상태
6. `games` – 끝난 게임 기록
7. `matchQueues` – 매칭 대기열 
8. `userStats` – 유저 전적/통계 캐시
9. `friendlyMatchRequests` - “친구끼리 친선 경기 요청/수락/거절” 기록

→ 이게 MongoDB 컬렉션 단위가 된다.

------

## 4. 4단계 – 임베딩 vs 레퍼런스 결정

각 컬렉션에 대해, 어떤 정보는 **서브도큐먼트(임베드)**로,  
어떤 정보는 **다른 컬렉션 참조(레퍼런스)**로 할지를 정하는 단계.

### 4-1. users

- 레이팅, 아바타, 이메일 → 유저 자체 상태 → **users 안에 임베드**
- 친구 관계 → 양방향/상태/차단 등 복잡한 관계 → **별도 `friendships` 컬렉션으로 분리**, users에는 friendCount 같은 요약만 캐시

### 4-2. friendships

- A–B 관계 문서 1개에 통합 (양쪽을 한 번에 표현)
- 두 유저는 `_id`로 참조 (`userAId`, `userBId`)

### 4-3. conversations

- participants 배열에 유저 `_id` 목록 임베드
- 마지막 메시지(lastMessage)는 자주 UI에 보여주니까 간단한 요약만 임베드

### 4-4. chatMessages

- 메시지는 무한히 늘어나기 때문에, **rooms나 conversations에 embed 하면 안 됨**
- 별도 컬렉션으로 분리하고, `roomId` 또는 `conversationId`로 연결하는 **레퍼런스 방식**

### 4-5. rooms

- 현재 게임 상태(boardFEN, turn, clocks, moves, result)는 **방을 조회할 때 항상 같이 필요**  
  → `rooms.gameState`에 embed
- 참여자는 `users._id`로 참조 (`whiteUserId`, `blackUserId` 등)
- 방 채팅은 `chatMessages`에서 따로 관리

### 4-6. games

- 하나의 게임에 속한 moves는 **그 게임에서만 의미가 있고 항상 같이 본다**  
  → `games.moves[]`에 embed
- 참가 유저는 `_id`로 참조(`whiteUserId`, `blackUserId`)
- 방과의 연결은 `roomId`로 참조

### 4-7. matchQueues

- 대기 중인 유저 1명 = 문서 1개  
  → `userId` 참조 + `ratingSnapshot`은 embed

### 4-8. userStats

- 유저 1명당 통계 문서 1개  
  → `userId` 참조, summary/modes는 embed

### 4-9. friendlyMatchRequests

- 참여자: 요청 보낸 사람(fromUserId), 요청 받은 사람(toUserId) → userId 참조
- timeControl 등의 옵션은 이 요청 문서에 그대로 임베딩 (요청 시점의 설정 유지)
- 방/게임은 나중에 생김 :
  - 수락되면 rooms에 방 생성 - `friendlyMatchRequests.roomId`로 참조
  - 게임 끝나면 `games`에도 저장 - `friendlyMatchRequests.gameId`로 연결

------

## 5. 5단계 – 컬렉션별 최종 스키마 요약

### 5-1. `users`

```js
{
  _id: ObjectId("..."),
  username: "chessMaster99",     // unique
  email: "user@example.com",     // unique
  passwordHash: "bcrypt...",
  avatarUrl: "https://...",
  bio: "sfesf" | undefined,
  rating: {
    rapid: 1500,
    blitz: 1500,
    bullet: 1500
  },

  social: {
    friendCount: 10,
    blockedCount: 2
  },

  auth: {
    emailVerified: false,
    emailVerification: {
      token: "random-hex-string",
      expiresAt: ISODate("...")   // 생성 시점 + 30분
    },
    resetPassword: null           // 또는 { token, expiresAt }
  },

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### 5-2. `friendships`

```js
{
  _id: ObjectId("..."),

  userAId: ObjectId("..."),   // 항상 정렬된 순서로 저장
  userBId: ObjectId("..."),

  status: "pending",          // "pending" | "accepted" | "blocked"
  requestedBy: ObjectId("..."),
  blockedBy: null,            // or ObjectId("..."),

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### 5-3. `conversations` (1:1 DM 방)

```js
{
  _id: ObjectId("..."),
  type: "direct",             // 이후 "group" 등 확장 가능

  participants: [
    ObjectId("userA"),
    ObjectId("userB")
  ],

  lastMessage: {
    messageId: ObjectId("..."),
    text: "마지막 메시지 요약",
    senderId: ObjectId("..."),
    createdAt: ISODate("...")
  },

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### 5-4. `chatMessages` (방 채팅 + DM 공용)

```js
{
  _id: ObjectId("..."),

  channelType: "room",          // "room" | "direct"

  roomId: ObjectId("...") | null,      // room 채팅일 때 rooms._id
  gameId: ObjectId("...") | null,      // games._id (옵션)

  conversationId: ObjectId("...") | null, // DM일 때 conversations._id

  // Invariants for chatMessages:
  //
  // if (channelType === "room") {
  //   roomId         !== null
  //   conversationId === null
  //   // gameId: optional (null or games._id after archive)
  // }
  //
  // if (channelType === "direct") {
  //   conversationId !== null
  //   roomId         === null
  //   // gameId: usually null
  // }

  userId: ObjectId("..."),
  username: "chessMaster99",    // 당시 닉네임 denormalization
  message: "안녕",
  type: "text",

  createdAt: ISODate("...")
}
```

### 5-5. `rooms` (실시간 체스 방)

```js
// Invariant:
// rooms.type === "friendly"  => rooms.rated === false
// rooms.type === "public"    => rooms.rated === true
// If this room/game was created from a friendlyMatchRequest:
//   friendlyMatchRequests.options.rated must equal rooms.rated and games.rated.
{
  _id: ObjectId("..."),
      
  // 이 방이 어떤 레이팅 모드에 해당하는지
  // public(랭크) 게임은 필수, friendly/ai는 선택(또는 null)
  mode: "rapid" | "blitz" | "bullet" | null,
     
  type: "public" | "ai" | "friendly",
  status: "waiting" | "in_progress" | "finished",

  hostUserId: ObjectId("..."),
  whiteUserId: ObjectId("..."),
  blackUserId: ObjectId("..."),
  spectators: [ObjectId("...")],

  friendlyMatchRequestId: ObjectId("...") || null, // friendlyMatchRequests._id

  timeControl: { // friendly 시에는 friendlyMatchRequests.options.timeControl 따라가기
    initialSeconds: 600,
    incrementSeconds: 5
  },
  rated: true | false, // false if friendly

  gameState: {
    boardFEN: "current FEN",
    moveCount: 0,
    turn: "white",

    clocks: {
      whiteRemainingMs: 600000,
      blackRemainingMs: 600000,
      lastMoveAt: ISODate("...")
    },

    moves: [
      {
        moveNumber: 1,
        from: "e2",
        to: "e4",
        san: "e4",
        by: "white",
        createdAt: ISODate("...")
      }
      // ...
    ],

    result: {
      status: "ongoing" | "white_win" | "black_win" | "draw",
      reason: null
    }
  },

  gameId: null | ObjectId("..."), // games._id

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### 5-6. `games` (완료된 게임 기록)

```js
{
  _id: ObjectId("..."),
  roomId: ObjectId("..."), // rooms._id

  whiteUserId: ObjectId("..."),
  blackUserId: ObjectId("..."),

  // 이 게임이 어떤 레이팅 모드로 치러졌는지
  // rooms.mode와 동일해야 함 (public 게임일 때)
  mode: "rapid" | "blitz" | "bullet" | null,
      
  timeControl: {
    initialSeconds: 600,
    incrementSeconds: 5
  },
  rated: true | false,

  result: {
    winner: "white",           // "white" | "black" | "draw" | "none"
    reason: "checkmate",       // or "[black/white] disconnected", etc...
    finalFEN: "..."
  },

  moves: [
    {
      moveNumber: 1,
      from: "e2",
      to: "e4",
      san: "e4",
      by: "white",
      fenAfter: "FEN after move",
      createdAt: ISODate("...")
    },
    // ...
  ],

  ratingChange: null | {
    whiteBefore: 1500,
    whiteAfter: 1515,
    blackBefore: 1500,
    blackAfter: 1485
  },
  // If games.rated === true:
  //   ratingChange is required, and before/after must differ at least for one side.
  // If games.rated === false:
  //   ratingChange is either null.

  startedAt: ISODate("..."),
  endedAt: ISODate("...")
}
```

### 5-7. `matchQueues` (매칭 큐)

```js
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),

  ratingSnapshot: {
    mode: "rapid" | "blitz" | "bullet",
    value: 1500
  },

  timeControl: {
    initialSeconds: 600,
    incrementSeconds: 5
  },

  region: "asia",
  status: "waiting",            // "waiting" | "matched" | "cancelled"

  // 매칭 성공 시, 어떤 방으로 이어졌는지 (optional)
  roomId: null | ObjectId("..."), // rooms._id    
      
  createdAt: ISODate("..."),
  matchedAt: null
}
```

### 5-8. `userStats` (전적/통계 캐시)

```js
{
  _id: ObjectId("..."),
  userId: ObjectId("..."), // users._id

  summary: {
    totalGames: 120,
    wins: 60,
    losses: 50,
    draws: 10
  },

  modes: {
    rapid:  { total: 50, wins: 30, losses: 15, draws: 5 },
    blitz:  { total: 70, wins: 30, losses: 35, draws: 5 },
    bullet: { total: 50, wins: 30, losses: 15, draws: 5 }
  },

  lastUpdatedAt: ISODate("...")
}
```

### 5-9. `friendlyMatchRequests` (친선 게임 요청)

```js
{
  _id: ObjectId("..."),

  fromUserId: ObjectId("..."),  // 요청 보낸 사람
  toUserId: ObjectId("..."),    // 요청 받은 사람

  // 커스텀 매치 설정
  options: {
    timeControl: {
      initialSeconds: 600,      // 예: 10분
      incrementSeconds: 5       // 5초 증가
    },
    rated: false,               // 친선 매치는 항상 false (현재 설계 기준)
    colorPreference: "auto"     // "white" | "black" | "auto" (옵션)
    // 나중에 핸디캡, 변형룰 등도 여기에 추가 가능
  },

  status: "pending",            // "pending" | "accepted" | "declined" | "cancelled" | "expired"

  // 요청이 수락되어 방이 실제로 만들어졌다면
  roomId: null,                 // or ObjectId("...") -> rooms._id
  gameId: null,                 // games._id도 연결 가능

  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

------

## 6. 6단계 – 인덱스 & 일관성 규칙

### 주요 인덱스 (쿼리 패턴 기준)

- `users`

  - 로그인 / 검색:

    ```js
    db.users.createIndex({ username: 1 }, { unique: true });
    db.users.createIndex({ email: 1 }, { unique: true });
    // 부분 검색용 text / regex는 상황에 따라 추가
    
    ```
  - 이메일 인증 토큰, 비밀번호 재설정 토큰 조회
    ```js
    db.users.createIndex({ "auth.emailVerification.token": 1 });
    db.users.createIndex({ "auth.resetPassword.token": 1 });  
    ```

- `friendships`

  - 두 유저 사이 관계 한 개만 존재하도록:

    ```js
    db.friendships.createIndex(
      { userAId: 1, userBId: 1 },
      { unique: true }
    );
    ```

  - 유저의 친구/요청 목록 조회:

    ```js
    db.friendships.createIndex({ userAId: 1 });
    db.friendships.createIndex({ userBId: 1 });
    ```

- `conversations`

  - 특정 유저가 속한 DM 리스트:

    ```js
    db.conversations.createIndex({ participants: 1 });
    // participants는 [userA, userB] 배열 → 멀티키 인덱스
    ```

- `chatMessages`

  - 게임 방 채팅(최근 N개):

    ```js
    db.chatMessages.createIndex({
      channelType: 1,
      roomId: 1,
      createdAt: -1
    });
    ```

  - DM 채팅(최근 N개):

    ```js
    db.chatMessages.createIndex({
      channelType: 1,
      conversationId: 1,
      createdAt: -1
    });
    ```

- `rooms`

  - 상태별 방 목록 (대기/진행 중 정렬):

    ```js
    db.rooms.createIndex({
      mode: 1,
      status: 1,
      createdAt: -1
    });
    ```

  - 유저가 참여 중인 방 찾기:

    ```js
    db.rooms.createIndex({ whiteUserId: 1 });
    db.rooms.createIndex({ blackUserId: 1 });
    db.rooms.createIndex({ hostUserId: 1 });
    ```


- `games`

  - 유저별 최근 게임 목록:

    ```js
    db.games.createIndex({ whiteUserId: 1, endedAt: -1 });
    db.games.createIndex({ blackUserId: 1, endedAt: -1 });
    ```

  - 레이팅 게임 통계/랭킹 계산용:

    ```js
    db.games.createIndex({ mode: 1, rated: 1, endedAt: -1 });
    ```

- `matchQueues`

  - 빠른 매칭용 (상태 + 모드 + 레이팅 + 시간제):

    ```js
    db.matchQueues.createIndex({
      status: 1,
      "ratingSnapshot.mode": 1,
      "ratingSnapshot.value": 1,
      "timeControl.initialSeconds": 1
    });
    ```

  - 유저별 대기 상태 확인/취소:

    ```js
    db.matchQueues.createIndex({ userId: 1 });
    ```

- `userStats`

  - 유저별 통계 1:1 매핑:

    ```js
    db.userStats.createIndex({ userId: 1 }, { unique: true });
    ```

- `friendlyMatchRequests`

  - 나에게 들어온 pending 요청 목록:

    ```js
    db.friendlyMatchRequests.createIndex({
      toUserId: 1,
      status: 1,
      createdAt: -1
    });
    ```

  - 내가 보낸 pending 요청 목록:

    ```js
    db.friendlyMatchRequests.createIndex({
      fromUserId: 1,
      status: 1,
      createdAt: -1
    });
    ```

  - (선택) 특정 요청에서 생성된 방/게임 역조회:

    ```js
    db.friendlyMatchRequests.createIndex({ roomId: 1 });
    db.friendlyMatchRequests.createIndex({ gameId: 1 });
    ```

### 일관성 규칙

- `rooms.type` vs `rated` vs `friendlyMatchRequests.options.rated`
  - `rooms.type = "friendly"` → `rooms.rated` = **항상 false**
  - `rooms.type = "ai"`  → 이번 프로젝트에서는 `rooms.rated = false`
  - friendlyMatchRequest로부터 생성된 방/게임이라면:
    `friendlyMatchRequests.options.rated === rooms.rated === games.rated`
  - public(랭크) 게임에 대해서:
    - `rooms.type = "public"` 이면 `rooms.rated = true` 이고,
      `rooms.mode`는 `"rapid" | "blitz" | "bullet"` 중 하나여야 한다.
    - `games.rated = true` 인 게임은 `games.mode`도 반드시 동일 모드여야 하고,
      `rooms.mode`와 `games.mode`는 항상 일치해야 한다.
- `friendships` 생성 시
  → 항상 `(userAId, userBId)`를 정렬해서 넣기 → 중복 방지
- DM 메시지 보내기 전
  → `friendships`에서 두 유저가 `status: "accepted"` & 차단 안 됐는지 체크
- 게임 종료 처리
  1. `rooms.gameState.result` 설정 & `rooms.status = "finished"`
  2. `games`에 기록 생성 (`rated` / `ratingChange` 일관성 유지)
  3. `users.rating` 및 `userStats` 갱신

------

## 7. 7단계 – 전체 흐름 예시로 다시 한번 연결해 보기

### 예시 1) 친구 맺고 DM 채팅 or 친선 경기

1. A가 B 검색 (`users`에서 username으로 검색)
2. A가 친구 요청 → `friendships`에 `status: "pending"`
3. B가 수락 → `status: "accepted"`
4. (필요하면) `conversations`에 A–B direct 방 생성
5. A/B가 DM 입장 → 해당 `conversationId`기반으로 소켓 join
6. 메시지 전송 → `chatMessages`에 `channelType: "direct", conversationId: ...` 인서트
7. DM 대화방에서 한 쪽이 친선전 커스텀 룰 설정 후 요청 → `friendlyMatchRequests`에 새 요청 생성
8. 요청 생성 시 상대 DM 창에 표시, 수락 시 `rooms(type: "friendly")` 생성 후 게임 진행

### 예시 2) 방 만들고 게임 + 방 채팅

1. A가 방 생성 → `rooms.insertOne(...)` (`status: "waiting"`, `type: "public"`)
2. B가 입장 → `rooms.whiteUserId`, `blackUserId` 세팅
3. 소켓에서 move 이벤트 → 서버가 룰 검증 후 `rooms.gameState` 업데이트
4. 게임 방 채팅 → `chatMessages`에 `channelType: "room", roomId: ...`
5. 게임 종료 → `rooms.gameState.result` 설정 후 `games`에 기록 저장, 레이팅/통계 갱신

