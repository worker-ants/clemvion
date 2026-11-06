import type { AxiosRequestConfig } from "axios";
import { apiClient } from "./client";

export type ServerTheme = "light" | "dark" | "system";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  /** 아바타 이미지 URL. 업로드한 공개 URL 이거나 사용자가 넣은 외부 URL 이다. 없으면 null. */
  avatarUrl?: string | null;
  locale: string;
  theme: string;
  /** TOTP 2단계 인증이 켜져 있는지. Passkey 등록 여부는 담지 않는다. */
  twoFactorEnabled: boolean;
  /** 진행 중인 이메일 변경의 확인 대기 신규 이메일 (없으면 null). */
  pendingEmail?: string | null;
}

/** 부모-자식 컴포넌트가 동일한 react-query 캐시 키를 공유하기 위한 단일 진실 상수. */
export const USER_PROFILE_QUERY_KEY = ["user-profile"] as const;

/**
 * 아바타 업로드 한도. 서버(`UsersService.AVATAR_MAX_BYTES` · `AVATAR_CONTENT_TYPES`)와 같은 값이다.
 * 클라이언트 검증은 빠른 안내용이고 최종 판정은 서버가 한다(400 `INVALID_FILE_TYPE` ·
 * `FILE_REQUIRED`, 413 `PAYLOAD_TOO_LARGE`).
 */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

export interface EmailChangeRequestBody {
  newEmail: string;
  password?: string;
  totpCode?: string;
}

export const usersApi = {
  getMe: (config?: Pick<AxiosRequestConfig, "timeout">) =>
    apiClient.get<{ data: UserProfile }>("/users/me", config),
  /** 아바타 이미지를 `multipart/form-data` 의 `file` 필드로 올린다. 응답은 갱신된 프로필이다. */
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<{ data: UserProfile }>("/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  // 이메일 변경 (spec/5-system/1-auth.md §1.1.B)
  requestEmailChange: (body: EmailChangeRequestBody) =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/request",
      body,
    ),
  verifyEmailChange: (token: string) =>
    apiClient.post<{ data: { accessToken: string } }>(
      "/users/me/email-change/verify",
      { token },
    ),
  resendEmailChange: () =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/resend",
      {},
    ),
  cancelEmailChange: () =>
    apiClient.post<{ data: { message: string } }>(
      "/users/me/email-change/cancel",
      {},
    ),
};
