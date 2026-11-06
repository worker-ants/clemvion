import { useAuthStore } from "@/lib/stores/auth-store";
import {
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

/**
 * 지금 사용자와 현재 팀 워크스페이스의 역할을 스토어에 넣는다. 역할 · 통합 소유자에 따라 버튼을 숨기는 화면
 * (`useHasRole`, 통합 화면의 `useIntegrationPermissions`)을 렌더하기 전에 부른다.
 *
 * 두 스토어는 모듈 전역이라 같은 파일의 다음 테스트까지 값이 남는다. 테스트마다 역할을 바꾸는 파일은
 * `afterEach` 에서 {@link resetWorkspaceViewer} 를 불러 앞 테스트의 역할이 넘어가지 않게 한다.
 */
export function seedWorkspaceViewer(role: WorkspaceRole, userId = "user-1") {
  useAuthStore.setState({
    user: {
      id: userId,
      email: `${userId}@test.dev`,
      name: userId,
      locale: "en",
      theme: "light",
      twoFactorEnabled: false,
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

/** {@link seedWorkspaceViewer} 가 넣은 사용자와 워크스페이스를 두 스토어의 처음 상태로 되돌린다. */
export function resetWorkspaceViewer() {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
}
