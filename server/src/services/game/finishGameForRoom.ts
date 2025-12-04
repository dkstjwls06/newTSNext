// server/src/services/game/finishGameForRoom.ts
import { ObjectId } from "mongodb";
import type { Collection } from "mongodb";
import { getDb } from "../../db/mongo";
import type {
  RoomDoc,
  GameDoc,
  GameRatingChange,
  GameMoveDoc,
  UserDoc,
  UserStatsDoc,
  GameMode,
} from "../../db/types";
  
// RoomGameState.result.status 의 타입을 그대로 따오기
type RoomResultStatus = RoomDoc["gameState"]["result"]["status"];
type WinnerColor = "white" | "black" | "draw" | "none";

export async function finishGameForRoom(
  roomId: ObjectId,
  params: {
    resultStatus: RoomResultStatus;
    resultReason: string;
  },
): Promise<{ room: RoomDoc; game: GameDoc }> {
  const db = getDb();

  const roomsCol = db.collection<RoomDoc>("rooms");
  const gamesCol = db.collection<GameDoc>("games");
  const usersCol = db.collection<UserDoc>("users");
  const userStatsCol = db.collection<UserStatsDoc>("userStats");

  // 1) room 조회
  const room = await roomsCol.findOne({ _id: roomId });
  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  // room.whiteUserId / blackUserId 존재 여부 확인
  if (!room.whiteUserId || !room.blackUserId) {
    throw new Error(
      `[finishGameForRoom] whiteUserId/blackUserId 가 없는 방입니다. roomId=${room._id.toHexString()}`
    );
  }

  const whiteUserId = room.whiteUserId;
  const blackUserId = room.blackUserId;
  

  const now = new Date();

  const RoomResultStatus: RoomResultStatus = params.resultStatus;

  // RoomGameState.result.status -> GameDoc.result.winner 로 매핑
  const winner: WinnerColor =
    RoomResultStatus === "white_win"
      ? "white"
      : RoomResultStatus === "black_win"
      ? "black"
      : RoomResultStatus === "draw"
      ? "draw"
      : "none";

  // 2) rooms.gameState.result / rooms.status 업데이트용 구조
  const updatedGameState: RoomDoc["gameState"] = {
    ...room.gameState,
    result: {
      status: RoomResultStatus,
      reason: params.resultReason,
    },
  };

  // RoomGameMove[] → GameMoveDoc[] 로 변환
  const gameMoves: GameMoveDoc[] = room.gameState.moves.map((m) => ({
    moveNumber: m.moveNumber,
    from: m.from,
    to: m.to,
    san: m.san,
    by: m.by,
    createdAt: m.createdAt,
    // 현재 서버에 per-move FEN은 없으므로 일단 최종 FEN을 그대로 넣어 둔다.
    // 나중에 서버 룰 엔진이 들어가면 여기서 정확한 fenAfter로 교체.
    fenAfter: room.gameState.boardFEN,
  }));

  // 3) GameDoc으로 변환할 기본 데이터 구성
  const baseGameDoc = {
    roomId: room._id,
    whiteUserId,
    blackUserId,
    mode: room.mode ?? null,
    timeControl: room.timeControl ?? null,
    rated: room.rated ?? false,
    result: {
      winner,
      reason: params.resultReason,
      finalFEN: room.gameState.boardFEN,
    },
    moves: gameMoves,
    startedAt: room.createdAt,
    endedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  let ratingChange: GameRatingChange | null = null;

  // 4) 랭크 게임일 때만 rating / userStats 갱신
  if (
    baseGameDoc.rated &&
    baseGameDoc.mode &&
    baseGameDoc.whiteUserId &&
    baseGameDoc.blackUserId &&
    (winner === "white" || winner === "black" || winner === "draw")
  ) {
    const mode: GameMode = baseGameDoc.mode;

    // 두 유저 정보 조회
    const [whiteUser, blackUser] = await Promise.all([
      usersCol.findOne({ _id: baseGameDoc.whiteUserId }),
      usersCol.findOne({ _id: baseGameDoc.blackUserId }),
    ]);

    if (whiteUser && blackUser) {
      const whiteBefore = whiteUser.rating[mode];
      const blackBefore = blackUser.rating[mode];

      const [whiteAfter, blackAfter] = computeEloForGame(
        whiteBefore,
        blackBefore,
        winner,
      );

      ratingChange = {
        whiteBefore,
        whiteAfter,
        blackBefore,
        blackAfter,
      };

      // users.rating.* 업데이트
      await usersCol.updateOne(
        { _id: whiteUser._id },
        {
          $set: {
            [`rating.${mode}`]: whiteAfter,
          },
        } as any,
      );

      await usersCol.updateOne(
        { _id: blackUser._id },
        {
          $set: {
            [`rating.${mode}`]: blackAfter,
          },
        } as any,
      );

      // userStats 요약 통계 업데이트 (랭크 게임만 집계)
      await updateUserStatsForRatedGame(userStatsCol, {
        mode,
        winner,
        whiteUserId: whiteUser._id,
        blackUserId: blackUser._id,
      });
    }
  }

  const gameDocToInsert: Omit<GameDoc, "_id"> = {
    ...baseGameDoc,
    ratingChange,
  };

  // 5) games 컬렉션에 GameDoc 생성
  const insertResult = await gamesCol.insertOne(gameDocToInsert as any);
  const gameId = insertResult.insertedId;

  // 6) rooms 상태 / gameState / gameId 업데이트
  await roomsCol.updateOne(
    { _id: room._id },
    {
      $set: {
        status: "finished",
        gameId,
        gameState: updatedGameState,
        updatedAt: now,
      },
    },
  );

  const savedGame = await gamesCol.findOne({ _id: gameId });
  if (!savedGame) {
    throw new Error("GAME_NOT_FOUND_AFTER_INSERT");
  }

  const updatedRoom: RoomDoc = {
    ...room,
    status: "finished",
    gameId,
    gameState: updatedGameState,
    updatedAt: now,
  };

  return {
    room: updatedRoom,
    game: savedGame,
  };
}

// ---- 내부 헬퍼들 ----

function computeEloForGame(
  whiteRating: number,
  blackRating: number,
  winner: WinnerColor,
): [number, number] {
  const K = 40;

  const expectedWhite =
    1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
  const expectedBlack =
    1 / (1 + Math.pow(10, (whiteRating - blackRating) / 400));

  let scoreWhite = 0.5;
  let scoreBlack = 0.5;

  if (winner === "white") {
    scoreWhite = 1;
    scoreBlack = 0;
  } else if (winner === "black") {
    scoreWhite = 0;
    scoreBlack = 1;
  } else if (winner === "draw") {
    scoreWhite = 0.5;
    scoreBlack = 0.5;
  } else {
    // winner === "none" 일 때는 rating 변화 없음 (양쪽 기대/실제 점수 0.5)
    scoreWhite = 0.5;
    scoreBlack = 0.5;
  }

  const newWhite = Math.round(
    whiteRating + K * (scoreWhite - expectedWhite),
  );
  const newBlack = Math.round(
    blackRating + K * (scoreBlack - expectedBlack),
  );

  return [newWhite, newBlack];
}

async function updateUserStatsForRatedGame(
  userStatsCol: Collection<UserStatsDoc>,
  params: {
    mode: GameMode;
    winner: WinnerColor;
    whiteUserId: ObjectId;
    blackUserId: ObjectId;
  },
): Promise<void> {
  const now = new Date();

  const whiteOutcome =
    params.winner === "white"
      ? "win"
      : params.winner === "black"
      ? "loss"
      : params.winner === "draw"
      ? "draw"
      : "none";

  const blackOutcome =
    params.winner === "white"
      ? "loss"
      : params.winner === "black"
      ? "win"
      : params.winner === "draw"
      ? "draw"
      : "none";

  await applyUserStatsIncrement(userStatsCol, {
    userId: params.whiteUserId,
    mode: params.mode,
    outcome: whiteOutcome,
    now,
  });

  await applyUserStatsIncrement(userStatsCol, {
    userId: params.blackUserId,
    mode: params.mode,
    outcome: blackOutcome,
    now,
  });
}

async function applyUserStatsIncrement(
  userStatsCol: Collection<UserStatsDoc>,
  params: {
    userId: ObjectId;
    mode: GameMode;
    outcome: "win" | "loss" | "draw" | "none";
    now: Date;
  },
): Promise<void> {
  const inc: Record<string, number> = {
    "summary.totalGames": 1,
    [`modes.${params.mode}.total`]: 1,
  };

  if (params.outcome === "win") {
    inc["summary.wins"] = 1;
    inc[`modes.${params.mode}.wins`] = 1;
  } else if (params.outcome === "loss") {
    inc["summary.losses"] = 1;
    inc[`modes.${params.mode}.losses`] = 1;
  } else if (params.outcome === "draw") {
    inc["summary.draws"] = 1;
    inc[`modes.${params.mode}.draws`] = 1;
  }

  await userStatsCol.updateOne(
    { userId: params.userId },
    {
      $inc: inc,
      $set: {
        lastUpdatedAt: params.now,
      },
    },
    { upsert: true },
  );
}
