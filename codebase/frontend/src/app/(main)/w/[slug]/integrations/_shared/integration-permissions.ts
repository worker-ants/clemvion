import { hasMinRole } from "@/components/auth/role-gate";
import type { IntegrationDto } from "@/lib/api/integrations";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  selectCurrentRole,
  useWorkspaceStore,
  type WorkspaceRole,
} from "@/lib/stores/workspace-store";

/*
 * 통합 상세 화면이 변경 동작을 보일지 정한다 — NERV CLE-INT-MANAGE 「권한」 표 · 판정 규칙, Task CLE-T-EDQYGH.
 * 화면은 요청자가 할 수 없는 동작을 숨겨 버튼을 눌러 403 을 받는 경로를 없앤다. 서버는 같은 규칙으로 따로 막는다.
 */

export const INTEGRATION_CHANGE_ACTIONS = [
  "rename",
  "reauthorize",
  "rotate",
  "requestScopes",
  "changeScope",
  "delete",
] as const;

/** 별칭 수정 · 통합 재인증 · 자격 증명 교체 · 추가 권한 요청 · 공개 범위 전환 · 삭제. */
export type IntegrationChangeAction =
  (typeof INTEGRATION_CHANGE_ACTIONS)[number];

export type IntegrationPermissions = Readonly<
  Record<IntegrationChangeAction, boolean>
>;

export interface IntegrationViewer {
  userId: string | null;
  role: WorkspaceRole | null;
}

/**
 * 개인 통합에서 동작마다 필요한 최소 역할. 통합 소유자(`createdBy`)여야 한다는 조건은 모든 동작에 붙는다.
 * 공개 범위 전환은 라우트 가드가 관리자 이상으로 막고, 삭제는 뷰어인 통합 소유자에게도 열려 있다(REQ-INTMGMT-051).
 */
const PERSONAL_MIN_ROLE: Record<IntegrationChangeAction, WorkspaceRole> = {
  rename: "editor",
  reauthorize: "editor",
  rotate: "editor",
  requestScopes: "editor",
  changeScope: "admin",
  delete: "viewer",
};

/**
 * 요청자가 그 통합에 그 동작을 할 수 있는가. 조직 통합은 동작과 상관없이 관리자 이상이다(REQ-INTMGMT-031).
 * 개인 통합은 통합 소유자만 바꾸고 소유자 · 관리자 역할도 남의 개인 통합에는 우위가 없다(REQ-INTMGMT-034).
 */
export function canChangeIntegration(
  action: IntegrationChangeAction,
  integration: Pick<IntegrationDto, "scope" | "createdBy">,
  viewer: IntegrationViewer,
): boolean {
  if (integration.scope === "organization") {
    return hasMinRole(viewer.role, "admin");
  }
  if (viewer.userId === null || integration.createdBy !== viewer.userId) {
    return false;
  }
  return hasMinRole(viewer.role, PERSONAL_MIN_ROLE[action]);
}

export function integrationPermissions(
  integration: Pick<IntegrationDto, "scope" | "createdBy">,
  viewer: IntegrationViewer,
): IntegrationPermissions {
  return Object.fromEntries(
    INTEGRATION_CHANGE_ACTIONS.map((action) => [
      action,
      canChangeIntegration(action, integration, viewer),
    ]),
  ) as Record<IntegrationChangeAction, boolean>;
}

/** 위험 영역 탭(공개 범위 전환 · 삭제)에 보일 동작이 하나라도 있는가. 없으면 탭을 두지 않는다. */
export function hasDangerZoneAction(
  permissions: IntegrationPermissions,
): boolean {
  return permissions.changeScope || permissions.delete;
}

const NO_PERMISSIONS: IntegrationPermissions = Object.fromEntries(
  INTEGRATION_CHANGE_ACTIONS.map((action) => [action, false]),
) as Record<IntegrationChangeAction, boolean>;

/** 지금 사용자와 현재 워크스페이스 역할로 판정한다. 통합을 아직 읽지 못했으면 모든 동작이 `false` 다. */
export function useIntegrationPermissions(
  integration: Pick<IntegrationDto, "scope" | "createdBy"> | undefined,
): IntegrationPermissions {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useWorkspaceStore(selectCurrentRole);
  if (!integration) return NO_PERMISSIONS;
  return integrationPermissions(integration, { userId, role });
}
