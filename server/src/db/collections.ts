import type { Collection } from "mongodb";
import { getDb } from "./mongo";
import type {
  UserDoc,
  FriendshipDoc,
  ConversationDoc,
  ChatMessageDoc,
  RoomDoc,
  GameDoc,
  MatchQueueDoc,
  UserStatsDoc,
  FriendlyMatchRequestDoc,
} from "./types";

export interface DbCollections {
    users: Collection<UserDoc>;
    friendships: Collection<FriendshipDoc>;
    conversations: Collection<ConversationDoc>;
    chatMessages: Collection<ChatMessageDoc>;
    rooms: Collection<RoomDoc>;
    games: Collection<GameDoc>;
    matchQueues: Collection<MatchQueueDoc>;
    userStats: Collection<UserStatsDoc>;
    friendlyMatchRequests: Collection<FriendlyMatchRequestDoc>;
  }

export function usersCol(): Collection<UserDoc> {
  return getDb().collection<UserDoc>("users");
}

export function friendshipsCol(): Collection<FriendshipDoc> {
  return getDb().collection<FriendshipDoc>("friendships");
}

export function conversationsCol(): Collection<ConversationDoc> {
  return getDb().collection<ConversationDoc>("conversations");
}

export function chatMessagesCol(): Collection<ChatMessageDoc> {
  return getDb().collection<ChatMessageDoc>("chatMessages");
}

export function roomsCol(): Collection<RoomDoc> {
  return getDb().collection<RoomDoc>("rooms");
}

export function gamesCol(): Collection<GameDoc> {
  return getDb().collection<GameDoc>("games");
}

export function matchQueuesCol(): Collection<MatchQueueDoc> {
  return getDb().collection<MatchQueueDoc>("matchQueues");
}

export function userStatsCol(): Collection<UserStatsDoc> {
  return getDb().collection<UserStatsDoc>("userStats");
}

export function friendlyMatchRequestsCol(): Collection<FriendlyMatchRequestDoc> {
  return getDb().collection<FriendlyMatchRequestDoc>("friendlyMatchRequests");
}
