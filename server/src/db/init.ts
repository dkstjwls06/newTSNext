import type { Db } from "mongodb";

export async function initDb(db: Db) {
  // 1) users
  await db.collection("users").createIndexes([
    { key: { username: 1 }, unique: true, name: "users_username_unique" },
    { key: { email: 1 }, unique: true, name: "users_email_unique" },
  ]);

  // 2) friendships
  await db.collection("friendships").createIndexes([
    {
      key: { userAId: 1, userBId: 1 },
      unique: true,
      name: "friendships_pair_unique",
    },
    { key: { userAId: 1 }, name: "friendships_userAId" },
    { key: { userBId: 1 }, name: "friendships_userBId" },
  ]);

  // 3) conversations
  await db.collection("conversations").createIndexes([
    { key: { participants: 1 }, name: "conversations_participants" },
  ]);

  // 4) chatMessages
  await db.collection("chatMessages").createIndexes([
    {
      key: { channelType: 1, roomId: 1, createdAt: -1 },
      name: "chatMessages_room_recent",
    },
    {
      key: { channelType: 1, conversationId: 1, createdAt: -1 },
      name: "chatMessages_direct_recent",
    },
  ]);

  // 5) rooms
  await db.collection("rooms").createIndexes([
    {
      key: { mode: 1, status: 1, createdAt: -1 },
      name: "rooms_mode_status_createdAt",
    },
    { key: { whiteUserId: 1 }, name: "rooms_whiteUserId" },
    { key: { blackUserId: 1 }, name: "rooms_blackUserId" },
    { key: { hostUserId: 1 }, name: "rooms_hostUserId" },
    { key: { code: 1 }, unique: true, sparse: true, name: "rooms_code_unique" },
  ]);

  // 6) games
  await db.collection("games").createIndexes([
    {
      key: { whiteUserId: 1, endedAt: -1 },
      name: "games_whiteUser_recent",
    },
    {
      key: { blackUserId: 1, endedAt: -1 },
      name: "games_blackUser_recent",
    },
    {
      key: { mode: 1, rated: 1, endedAt: -1 },
      name: "games_mode_rated_endedAt",
    },
  ]);

  // 7) matchQueues
  await db.collection("matchQueues").createIndexes([
    {
      key: {
        status: 1,
        "ratingSnapshot.mode": 1,
        "ratingSnapshot.value": 1,
        "timeControl.initialSeconds": 1,
      },
      name: "matchQueues_matching",
    },
    { key: { userId: 1 }, name: "matchQueues_userId" },
  ]);

  // 8) userStats
  await db.collection("userStats").createIndexes([
    { key: { userId: 1 }, unique: true, name: "userStats_userId_unique" },
  ]);

  // 9) friendlyMatchRequests
  await db.collection("friendlyMatchRequests").createIndexes([
    {
      key: { toUserId: 1, status: 1, createdAt: -1 },
      name: "fmr_to_status_createdAt",
    },
    {
      key: { fromUserId: 1, status: 1, createdAt: -1 },
      name: "fmr_from_status_createdAt",
    },
    { key: { roomId: 1 }, name: "fmr_roomId" },
    { key: { gameId: 1 }, name: "fmr_gameId" },
  ]);

  console.log("✅ MongoDB indexes ensured.");
}