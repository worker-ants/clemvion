import type { ClearedIntegrationRef } from "@/lib/api/workflows";

/**
 * 비운 통합 참조의 노드 레이블을 처음 나온 순서대로 중복 없이 돌려준다. 한 노드에서 MCP 서버 항목 여럿을 비울 수 있다.
 * 응답에 목록이 없으면 빈 배열이다.
 */
export function clearedIntegrationRefLabels(
  refs: readonly ClearedIntegrationRef[] | undefined,
): string[] {
  return [...new Set((refs ?? []).map((ref) => ref.nodeLabel))];
}

/**
 * sessionStorage 키. 버전 복원은 페이지를 다시 불러오므로 비운 참조 목록을 같은 탭에 넘겨 두고 다시 불러온 에디터가 꺼내며
 * 지운다(REQ-WFVER-027). 앱 전역 키라 `clemvion.` 접두를 쓰고 워크플로우마다 따로 둔다.
 */
const restoreKey = (workflowId: string) =>
  `clemvion.restoreClearedIntegrationRefs:${workflowId}`;

/** 다시 불러오기 전에 비운 참조 목록을 넘겨 둔다. 저장소를 쓸 수 없으면 경고 없이 넘어간다. */
export function stashRestoreClearedIntegrationRefs(
  workflowId: string,
  refs: readonly ClearedIntegrationRef[] | undefined,
): void {
  if (!refs || refs.length === 0) return;
  try {
    window.sessionStorage.setItem(restoreKey(workflowId), JSON.stringify(refs));
  } catch {
    // 사생활 보호 모드 등에서 저장소를 막으면 경고만 잃는다. 복원은 이미 끝났다.
  }
}

/** 넘겨 둔 목록을 꺼내고 지운다. 없거나 읽지 못하면 빈 배열이다. */
export function takeRestoreClearedIntegrationRefs(
  workflowId: string,
): ClearedIntegrationRef[] {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(restoreKey(workflowId));
    window.sessionStorage.removeItem(restoreKey(workflowId));
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (ref): ref is ClearedIntegrationRef =>
            typeof ref === "object" &&
            ref !== null &&
            typeof (ref as ClearedIntegrationRef).nodeLabel === "string",
        )
      : [];
  } catch {
    return [];
  }
}
