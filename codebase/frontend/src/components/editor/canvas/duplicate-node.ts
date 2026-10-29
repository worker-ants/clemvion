import type { Node as RFNode } from "@xyflow/react";
import { generateUniqueLabel } from "@/lib/utils/generate-unique-label";
import {
  clearUnusableIntegrationRefsInNodes,
  type IntegrationRefFilterContext,
} from "@/lib/integrations/node-integration-refs";

/** 노드 컨텍스트 메뉴 «복제» 가 원본에서 어긋나게 두는 거리(px). */
export const NODE_DUPLICATE_OFFSET_PX = 50;

/**
 * 노드 컨텍스트 메뉴 «복제» 가 추가할 노드를 만든다. 새 id · 어긋난 위치 · 유일한 레이블을 주고, 지금 사용자가 고를 수 없는
 * 통합 참조는 비운다(REQ-EDITOR-059). 비운 노드의 레이블은 `clearedLabels` 로 돌려주고 부르는 쪽이 경고한다.
 *
 * `refFilter` 는 필수 인자다. 붙여넣기 · 키보드 복제(`editor-store`)와 같은 규칙이라, 이 경로만 비우기를 빠뜨리는 일을 컴파일
 * 단계에서 막는다.
 */
export function buildDuplicatedNode(
  node: RFNode,
  baseLabel: string,
  existingLabels: string[],
  refFilter: IntegrationRefFilterContext,
): { node: RFNode; clearedLabels: string[] } {
  const {
    nodes: [duplicated],
    clearedLabels,
  } = clearUnusableIntegrationRefsInNodes(
    [
      {
        id: crypto.randomUUID(),
        type: "custom",
        position: {
          x: node.position.x + NODE_DUPLICATE_OFFSET_PX,
          y: node.position.y + NODE_DUPLICATE_OFFSET_PX,
        },
        data: {
          ...node.data,
          label: generateUniqueLabel(baseLabel, existingLabels),
        },
      },
    ],
    refFilter,
  );
  return { node: duplicated, clearedLabels };
}
