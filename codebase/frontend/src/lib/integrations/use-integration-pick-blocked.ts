import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  canUseIntegrationInWorkflow,
  type VisibleIntegration,
} from "./node-integration-refs";

/**
 * 지금 사용자가 이 워크플로우의 노드에 그 통합을 고를 수 없는지 가르는 함수를 돌려준다(REQ-INTMGMT-056). 규칙은
 * `canUseIntegrationInWorkflow` 한 곳에 있고 이 훅은 지금 사용자와 워크플로우 작성자를 채워 넘긴다. 둘 중 하나라도 모르면
 * 거르지 않고 `false` 를 낸다. 권위는 저장 검사다.
 */
export function useIntegrationPickBlocked(): (
  integration: VisibleIntegration,
) => boolean {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const workflowAuthorId = useEditorStore((s) => s.workflowCreatedBy);
  return (integration) =>
    currentUserId !== null &&
    workflowAuthorId !== null &&
    !canUseIntegrationInWorkflow(integration, currentUserId, workflowAuthorId);
}
