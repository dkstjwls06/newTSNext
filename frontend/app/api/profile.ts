/**
 * 유저 레이팅 정보
 * - 서버측 users 컬렉션의 rating 필드를 클라이언트에서 다룰 때 사용
 */
export interface UserRating {
  rapid: number;
  blitz: number;
  bullet: number;
  puzzle: number;
}

/**
 * 유저 프로필 기본 정보
 * - /api/users/me/profile 응답의 profile 필드와 매핑
 *
 * id / username / email 은 기존 auth 관련 응답과 일관되게 필수로 둠.
 * rating / avatarUrl / bio 는 서버 스펙 변경 여지를 고려해 선택적(optional)으로 둠.
 */
export interface UserProfile {
  id: string;
  username: string;
  email: string;

  // 서버에서 auth.emailVerified 를 그대로 내려줌
  emailVerified: boolean;
  rating?: UserRating;
  avatarUrl?: string | null;
  bio?: string | null;
  // 서버에서 social.friendCount / blockedCount 내려줌
  social?: {
    friendCount: number;
    blockedCount: number;
  };
  createdAt:Date;
  updatedAt:Date;
}

/**
 * GET /api/users/me/profile 성공 응답
 *   { ok: true, profile: { ... } }
 */
export interface GetMyProfileSuccessResponse {
  ok: true;
  profile: UserProfile;
}

/**
 * GET /api/users/me/profile 오류 응답
 * - 서버에서 내려주는 error 코드를 그대로 문자열로 받되,
 *   HTTP status 도 같이 보존해서 상위에서 분기할 수 있게 함.
 */
export interface GetMyProfileErrorResponse {
  ok: false;
  status: number;
  error: string;
}

/**
 * GET /api/users/me/profile 전체 응답 타입 유니온
 */
export type GetMyProfileResponse =
  | GetMyProfileSuccessResponse
  | GetMyProfileErrorResponse;

/**
 * PATCH /api/users/me/profile 요청 페이로드
 *
 * 서버에서 허용하는 필드는 기존 설계/라우터 구현을 기준으로,
 * displayName / avatarUrl / bio (+ emoji 등 확장 가능) 을 optional 로 둔다.
 * - 서버 쪽 zod 스키마가 변경되면 이 타입도 같이 조정해야 함.
 */
export interface UpdateMyProfileRequest {
  /**
   * 닉네임(=username)
   * 부분 업데이트를 허용하므로 optional
   */
  username?: string;

  /**
   * 아바타 이미지 URL
   * null 로 보내면 제거하는 의미로 사용할 수 있게 string | null
   */
  avatarUrl?: string | null;
}

/**
 * PATCH /api/users/me/profile 성공 응답
 *   { ok: true, profile: { ... } }
 */
export interface UpdateMyProfileSuccessResponse {
  ok: true;
  profile: UserProfile;
}

/**
 * PATCH /api/users/me/profile 오류 응답
 */
export interface UpdateMyProfileErrorResponse {
  ok: false;
  status: number;
  error: string;
}

export interface ChangeMyPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ChangeMyPasswordSuccessResponse {
  ok: true;
}

export interface ChangeMyPasswordErrorResponse {
  ok: false;
  status: number;
  error: string;
}


/**
 * PATCH /api/users/me/profile 전체 응답 타입 유니온
 */
export type UpdateMyProfileResponse =
  | UpdateMyProfileSuccessResponse
  | UpdateMyProfileErrorResponse;


export type ChangeMyPasswordResponse =
| ChangeMyPasswordSuccessResponse
| ChangeMyPasswordErrorResponse;

/**
 * 내부용 JSON 파싱 유틸
 * - 서버가 JSON이 아닌 응답을 내려도 호출 측에서 에러 핸들링을 단순화하기 위한 헬퍼
 */
async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * 프로필 조회 API 헬퍼
 *
 * GET /api/users/me/profile
 * - credentials: "include" 로 세션 쿠키를 함께 전송
 * - 성공/실패에 상관없이 GetMyProfileResponse 형태로 반환
 *   - 네트워크 에러 등 fetch() 자체가 실패하면 예외를 던짐
 */
export async function getMyProfile(options?: {
  signal?: AbortSignal;
}): Promise<GetMyProfileResponse> {
  const res = await fetch("/api/users/me/profile", {
    method: "GET",
    credentials: "include",
    signal: options?.signal,
  });

  const body = await parseJsonSafe<
    GetMyProfileSuccessResponse | { ok?: boolean; error?: unknown }
  >(res);

  if (body && typeof body === "object" && "ok" in body) {
    if ((body as any).ok === true) {
      // 성공 응답
      return body as GetMyProfileSuccessResponse;
    }

    // 서버에서 내려준 error 문자열이 있으면 우선 사용
    const serverError =
      "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : undefined;

    return {
      ok: false,
      status: res.status,
      error:
        serverError ??
        `Request failed with status ${res.status} (GET /api/users/me/profile)`,
    };
  }

  // ok 필드가 없거나 JSON 구조가 예상과 크게 다를 때
  return {
    ok: false,
    status: res.status,
    error: `Invalid response from server (status ${res.status}, GET /api/users/me/profile)`,
  };
}

/**
 * 프로필 수정 API 헬퍼
 *
 * PATCH /api/users/me/profile
 * - body: UpdateMyProfileRequest (모든 필드 optional)
 * - 성공/실패에 상관없이 UpdateMyProfileResponse 형태로 반환
 *   - 네트워크 에러 등 fetch() 자체 실패 시 예외를 던짐
 */
export async function updateMyProfile(
  payload: UpdateMyProfileRequest,
  options?: { signal?: AbortSignal }
): Promise<UpdateMyProfileResponse> {
  const res = await fetch("/api/users/me/profile", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  const body = await parseJsonSafe<
    UpdateMyProfileSuccessResponse | { ok?: boolean; error?: unknown }
  >(res);

  if (body && typeof body === "object" && "ok" in body) {
    if ((body as any).ok === true) {
      // 성공 응답
      return body as UpdateMyProfileSuccessResponse;
    }

    const serverError =
      "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : undefined;

    return {
      ok: false,
      status: res.status,
      error:
        serverError ??
        `Request failed with status ${res.status} (PATCH /api/users/me/profile)`,
    };
  }

  return {
    ok: false,
    status: res.status,
    error: `Invalid response from server (status ${res.status}, PATCH /api/users/me/profile)`,
  };
}

export async function changeMyPassword(
  payload: ChangeMyPasswordRequest,
  options?: { signal?: AbortSignal }
): Promise<ChangeMyPasswordResponse> {
  const res = await fetch("/api/users/me/password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  const body = await parseJsonSafe<{ ok?: boolean; error?: unknown }>(res);

  if (body && typeof body === "object" && "ok" in body) {
    if ((body as any).ok === true) {
      return { ok: true };
    }

    const serverError =
      "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : undefined;

    return {
      ok: false,
      status: res.status,
      error:
        serverError ??
        `Request failed with status ${res.status} (POST /api/users/me/password)`,
    };
  }

  return {
    ok: false,
    status: res.status,
    error: `Invalid response from server (status ${res.status}, POST /api/users/me/password)`,
  };
}
