import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

/**
 * 지금 사용자와 현재 팀 워크스페이스의 역할을 스토어에 넣는다. 역할 · 통합 소유자에 따라 버튼을 숨기는 화면
 * (`useHasRole`, 통합 화면의 `useIntegrationPermissions`)을 렌더하기 전에 부른다.
 */
export function seedWorkspaceViewer(role: WorkspaceRole, userId = "user-1") {
  useAuthStore.setState({
    user: {
      id: userId,
      email: `${userId}@test.dev`,
      name: userId,
      locale: "en",
      theme: "light",
    },
    isAuthenticated: true,
    isLoading: false,
  });
  useWorkspaceStore.setState({
    workspaces: [
      { id: "ws-1", name: "Test", type: "team", slug: "team-1", role },
    ],
    currentWorkspaceId: "ws-1",
    loaded: true,
  });
}
