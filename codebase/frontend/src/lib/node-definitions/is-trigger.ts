import type { Node } from "@xyflow/react";

type NodeLikeData = { type?: string; category?: string } | undefined;

/**
 * 트리거 카테고리의 노드인지 판별해요.
 * - 1차: `data.category === "trigger"` (Manual/Webhook/Schedule 모두 포괄)
 * - 2차 폴백: `data.type === "manual_trigger"` (category 누락 데이터 보호망)
 */
export function isTriggerNode(node: Node): boolean {
  const data = node.data as NodeLikeData;
  return data?.category === "trigger" || data?.type === "manual_trigger";
}

/** 모든 노드가 트리거일 때 true (최소 1개 이상) */
export function hasOnlyTriggerNodes(nodes: Node[]): boolean {
  return nodes.length > 0 && nodes.every(isTriggerNode);
}

/**
 * 실제 작업 노드가 하나도 없는 "빈" 워크플로우 여부.
 * 완전 빈 상태(노드 0개) 또는 트리거 노드만 있는 상태를 모두 포함해요.
 */
export function isWorkflowEmpty(nodes: Node[]): boolean {
  return nodes.length === 0 || hasOnlyTriggerNodes(nodes);
}

/** 노드 목록에서 첫 번째 트리거 노드를 반환해요. 없으면 undefined. */
export function findFirstTriggerNode(nodes: Node[]): Node | undefined {
  return nodes.find(isTriggerNode);
}
