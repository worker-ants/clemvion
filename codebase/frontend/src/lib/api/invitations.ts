import { apiClient } from "./client";
import type { WorkspaceRole } from "@/lib/stores/workspace-store";

export interface InvitationMeta {
  workspaceName: string;
  /** 초대자 계정이 조회 불가(탈퇴 등)일 때 null. */
  invitedByName: string | null;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresAt: string;
}

/**
 * 초대 조회 API. `getByToken` 은 공개(인증 불요) 토큰 조회로, 회원가입 페이지가 `?invitationToken=...` 처리 시
 * 이메일·워크스페이스 이름·초대자 이름을 prefill 하기 위해 사용한다. `getMine` · `acceptMine` 은 초대 알림이 연
 * 수락 페이지의 초대 id 모드가 쓴다(로그인 필요). 인증된 멤버 관리
 * API(워크스페이스별 초대 발송·취소·재발송)는 `workspacesApi` 에 분리되어 있다.
 *
 * spec/2-navigation/10-auth-flow.md §2.6, spec/5-system/1-auth.md §1.5
 */
export const invitationsApi = {
  getByToken: async (token: string): Promise<InvitationMeta> => {
    // base64url 토큰은 이미 URL-safe 지만 path 안전성을 위해 한 번 더 보호.
    const { data } = await apiClient.get(
      `/invitations/${encodeURIComponent(token)}`,
    );
    return data.data;
  },

  /**
   * 초대 id 모드(초대 알림에서 연 수락 페이지)의 메타 조회. 로그인 필요. 로그인 이메일로 온 초대가 아니면 404 다.
   */
  getMine: async (invitationId: string): Promise<InvitationMeta> => {
    const { data } = await apiClient.get(
      `/users/me/invitations/${encodeURIComponent(invitationId)}`,
    );
    return data.data;
  },

  /** 초대 id 모드의 수락. 토큰 수락과 같은 결과(합류한 워크스페이스 · 역할)를 돌려준다. */
  acceptMine: async (
    invitationId: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> => {
    const { data } = await apiClient.post(
      `/users/me/invitations/${encodeURIComponent(invitationId)}/accept`,
    );
    return data.data;
  },
};

/** 백엔드 에러 응답에 담기는 코드(spec/5-system/1-auth.md §1.5.4). */
export const INVITATION_ERROR = {
  EMAIL_MISMATCH: "invitation_email_mismatch",
  EXPIRED: "invitation_expired",
  ALREADY_USED: "invitation_already_used",
  NOT_FOUND: "invitation_not_found",
} as const;
