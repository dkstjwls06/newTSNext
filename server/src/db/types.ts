import type { ObjectId } from "mongodb";

// 공통 리터럴 타입들
export type GameMode = "rapid" | "blitz" | "bullet";
export type RoomType = "public" | "ai" | "friendly";
export type RoomStatus = "waiting" | "in_progress" | "finished";
export type ChannelType = "room" | "direct";
export type FriendlyRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

// 1) users
export interface UserDoc {
  _id: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  bio?: string;

  rating: {
    rapid: number;
    blitz: number;
    bullet: number;
  };

  social: {
    friendCount: number;
    blockedCount: number;
  };

  auth: {
    emailVerified: boolean;
    emailVerification?: {
      token: string;
      expiresAt: Date;
    } | null;
    resetPassword?: {
      token: string;
      expiresAt: Date;
    } | null;
  };

  createdAt: Date;
  updatedAt: Date;
}

// 2) friendships
export interface FriendshipDoc {
  _id: ObjectId;
  userAId: ObjectId; // 항상 정렬된 순서
  userBId: ObjectId;

  status: "pending" | "accepted" | "blocked";
  requestedBy: ObjectId;
  blockedBy: ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

// 3) conversations
export interface ConversationDoc {
  _id: ObjectId;
  type: "direct"; // 이후 "group" 등 확장 가능

  participants: ObjectId[]; // [userA, userB]

  lastMessage?: {
    messageId: ObjectId;
    text: string;
    senderId: ObjectId;
    createdAt: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

// 4) chatMessages
export interface ChatMessageDoc {
  _id: ObjectId;

  channelType: ChannelType;

  roomId: ObjectId | null;
  gameId: ObjectId | null;
  conversationId: ObjectId | null;

  userId: ObjectId;
  username: string;
  message: string;
  type: "text"; // 나중에 system / move 등 확장 가능

  createdAt: Date;
}

// 5) rooms
export interface RoomGameMove {
  moveNumber: number;
  from: string;
  to: string;
  san: string;
  by: "white" | "black";
  createdAt: Date;
}

export interface RoomGameState {
  boardFEN: string;
  moveCount: number;
  turn: "white" | "black";

  clocks: {
    whiteRemainingMs: number;
    blackRemainingMs: number;
    lastMoveAt: Date;
  };

  moves: RoomGameMove[];

  result: {
    status: "ongoing" | "white_win" | "black_win" | "draw";
    reason: string | null;
  };
}

export interface RoomDoc {
  _id: ObjectId;
  code?: string; // unique, sparse

  mode: GameMode | null;
  type: RoomType;
  status: RoomStatus;

  hostUserId: ObjectId;
  whiteUserId?: ObjectId;
  blackUserId?: ObjectId;
  spectators: ObjectId[];

  friendlyMatchRequestId?: ObjectId | null;

  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  rated: boolean;

  gameState: RoomGameState;
  gameId?: ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

// 6) games
export interface GameMoveDoc {
  moveNumber: number;
  from: string;
  to: string;
  san: string;
  by: "white" | "black";
  fenAfter: string;
  createdAt: Date;
}

export interface GameRatingChange {
  whiteBefore: number;
  whiteAfter: number;
  blackBefore: number;
  blackAfter: number;
}

export interface GameDoc {
  _id: ObjectId;
  roomId: ObjectId;

  whiteUserId: ObjectId;
  blackUserId: ObjectId;

  mode: GameMode | null;
  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };
  rated: boolean;

  result: {
    winner: "white" | "black" | "draw" | "none";
    reason: string;
    finalFEN: string;
  };

  moves: GameMoveDoc[];

  ratingChange: GameRatingChange | null;

  startedAt: Date;
  endedAt: Date;
}

// 7) matchQueues
export interface MatchQueueDoc {
  _id: ObjectId;
  userId: ObjectId;

  ratingSnapshot: {
    mode: GameMode;
    value: number;
  };

  timeControl: {
    initialSeconds: number;
    incrementSeconds: number;
  };

  region: string;
  status: "waiting" | "matched" | "cancelled";
  roomId?: ObjectId | null;

  createdAt: Date;
  matchedAt?: Date | null;
}

// 8) userStats
export interface UserStatsModeSummary {
  total: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface UserStatsDoc {
  _id: ObjectId;
  userId: ObjectId;

  summary: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
  };

  modes: {
    rapid?: UserStatsModeSummary;
    blitz?: UserStatsModeSummary;
    bullet?: UserStatsModeSummary;
  };

  lastUpdatedAt: Date;
}

// 9) friendlyMatchRequests
export interface FriendlyMatchRequestDoc {
  _id: ObjectId;

  fromUserId: ObjectId;
  toUserId: ObjectId;

  options: {
    timeControl: {
      initialSeconds: number;
      incrementSeconds: number;
    };
    rated: boolean; // 현재는 항상 false지만 타입은 그대로 둠
    colorPreference: "white" | "black" | "auto";
  };

  status: FriendlyRequestStatus;

  roomId?: ObjectId | null;
  gameId?: ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}