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
