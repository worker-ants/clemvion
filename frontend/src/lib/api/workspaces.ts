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

/**
 * 공개(인증 불요) 초대 토큰 메타 조회. 회원가입 페이지가 `?invitationToken=...` 처리 시
 * 이메일·워크스페이스 이름·초대자 이름을 prefill 하기 위해 사용한다.
 *
 * spec/2-navigation/10-auth-flow.md §2.6, spec/5-system/1-auth.md §1.5
 */
export const invitationsApi = {
  getByToken: async (token: string): Promise<InvitationMeta> => {
    const { data } = await apiClient.get(
      `/invitations/${encodeURIComponent(token)}`,
    );
    return data.data;
  },
};

export interface InvitationMeta {
  workspaceName: string;
  invitedByName: string | null;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresAt: string;
}

export interface WorkspaceInvitationSummary {
  id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  expiresAt: string;
  invitedBy: string | null;
  createdAt: string;
}
