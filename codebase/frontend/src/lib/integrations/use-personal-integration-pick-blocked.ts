import { useAuthStore } from "@/lib/stores/auth-store";
import { useEditorStore } from "@/lib/stores/editor-store";

/**
 * 지금 사용자가 이 워크플로우의 노드에 자기 개인 통합을 고를 수 없는지(REQ-INTMGMT-056). 지금 사용자가 워크플로우 작성자가
 * 아니면 `true` 다. 둘 중 하나라도 모르면 거르지 않고 `false` 다. 권위는 저장 검사다.
 *
 * 목록 조회는 남의 개인 통합을 돌려주지 않으므로 선택기에 보이는 개인 통합은 모두 지금 사용자의 것이다.
 */
export function usePersonalIntegrationPickBlocked(): boolean {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const workflowAuthorId = useEditorStore((s) => s.workflowCreatedBy);
  return (
    currentUserId !== null &&
    workflowAuthorId !== null &&
    currentUserId !== workflowAuthorId
  );
}
