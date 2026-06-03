import { apiClient } from "./client";
import type { WorkspaceSummary, WorkspaceRole } from "@/lib/stores/workspace-store";

export interface WorkspaceMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: WorkspaceRole;
  joinedAt: string | null;
}

export const workspacesApi = {
  list: async (): Promise<WorkspaceSummary[]> => {
    const { data } = await apiClient.get("/workspaces");
    return data.data ?? [];
  },
  createTeam: async (name: string): Promise<WorkspaceSummary> => {
    const { data } = await apiClient.post("/workspaces", { name });
    return data.data;
  },
  update: async (
    workspaceId: string,
    patch: { name?: string },
  ): Promise<WorkspaceSummary> => {
    const { data } = await apiClient.patch(`/workspaces/${workspaceId}`, patch);
    return data.data;
  },
  /**
   * 워크스페이스 설정(현재 interactionAllowedOrigins) 전체 교체 (Admin+).
   * 응답 body 는 사용하지 않고 호출자가 `workspace-settings` 쿼리를 invalidate 해 정규화 값을 재로드한다.
   */
  updateSettings: async (
    workspaceId: string,
    patch: { interactionAllowedOrigins: string[] },
  ): Promise<void> => {
    await apiClient.patch(`/workspaces/${workspaceId}/settings`, patch);
  },
  /** 워크스페이스 설정 조회 (멤버 read) — 편집기 시드용. */
  getSettings: async (
    workspaceId: string,
  ): Promise<{ interactionAllowedOrigins: string[] }> => {
    const { data } = await apiClient.get(`/workspaces/${workspaceId}/settings`);
    return data.data;
  },
  delete: async (workspaceId: string): Promise<void> => {
    await apiClient.delete(`/workspaces/${workspaceId}`);
  },
  leave: async (workspaceId: string): Promise<void> => {
    await apiClient.post(`/workspaces/${workspaceId}/leave`);
  },
  transferOwnership: async (
    workspaceId: string,
    newOwnerMemberId: string,
  ): Promise<void> => {
    await apiClient.post(
      `/workspaces/${workspaceId}/transfer-ownership`,
      { newOwnerMemberId },
    );
  },
  listMembers: async (
    workspaceId: string,
  ): Promise<WorkspaceMemberSummary[]> => {
    const { data } = await apiClient.get(`/workspaces/${workspaceId}/members`);
    return data.data ?? [];
  },
  addMember: async (
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<{ id: string; role: WorkspaceRole }> => {
    const { data } = await apiClient.post(
      `/workspaces/${workspaceId}/members`,
      { email, role },
    );
    return data.data;
  },
  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    role: WorkspaceRole,
  ): Promise<{ id: string; role: WorkspaceRole }> => {
    const { data } = await apiClient.patch(
      `/workspaces/${workspaceId}/members/${memberId}`,
      { role },
    );
    return data.data;
  },
  removeMember: async (
    workspaceId: string,
    memberId: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/workspaces/${workspaceId}/members/${memberId}`,
    );
  },
  listInvitations: async (
    workspaceId: string,
  ): Promise<WorkspaceInvitationSummary[]> => {
    const { data } = await apiClient.get(
      `/workspaces/${workspaceId}/invitations`,
    );
    return data.data ?? [];
  },
  invite: async (
    workspaceId: string,
    email: string,
    role: Exclude<WorkspaceRole, "owner">,
  ): Promise<WorkspaceInvitationSummary> => {
    const { data } = await apiClient.post(
      `/workspaces/${workspaceId}/invitations`,
      { email, role },
    );
    return data.data;
  },
  /**
   * 대기 중 초대를 재발송한다. 기존 토큰은 즉시 무효화되고, 새 토큰이 발급되며,
   * 만료 시계가 발송 시점부터 다시 7일로 재시작된다.
   * spec/5-system/1-auth.md §1.5.1
   */
  resendInvitation: async (
    workspaceId: string,
    invitationId: string,
  ): Promise<WorkspaceInvitationSummary> => {
    const { data } = await apiClient.post(
      `/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
    );
    return data.data;
  },
  revokeInvitation: async (
    workspaceId: string,
    invitationId: string,
  ): Promise<void> => {
    await apiClient.delete(
      `/workspaces/${workspaceId}/invitations/${invitationId}`,
    );
  },
  acceptInvitation: async (
    token: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole }> => {
    const { data } = await apiClient.post("/workspaces/invitations/accept", {
      token,
    });
    return data.data;
  },
};


export interface WorkspaceInvitationSummary {
  id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
}
