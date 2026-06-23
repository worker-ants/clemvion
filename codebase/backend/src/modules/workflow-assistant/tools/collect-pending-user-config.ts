import { z } from 'zod';
import type { NodeComponentRegistry } from '../../../nodes/core/node-component.registry';
import {
  detectPendingUserConfig,
  PendingUserConfigField,
} from './detect-pending-user-config';
import type { ShadowWorkflow } from './shadow-workflow';

/**
 * 노드의 `configSchema` (zod) 를 즉석 JSON Schema 로 변환해, "사용자가 직접
 * 골라야 하는" 비어있는 필드를 감지하는 sync wrapper (`detectPendingUserConfig`).
 * 후보 채우기(async candidate lookup) 없이 detect 만 수행하므로, sync 가 필요한
 * review guard(`AssistantFinishGuard.evaluateReviewGuard`) 경로와 edit tool_result
 * 경로(`collectPendingUserConfigWithCandidates`)가 동일 로직을 공유한다.
 *
 * `nodeRegistry` 는 type-only import 로 받아 런타임 의존(순환)을 만들지 않는다 —
 * 호출부가 주입한 인스턴스를 그대로 사용한다.
 */
export function collectPendingUserConfig(
  shadow: ShadowWorkflow,
  nodeId: string,
  nodeRegistry: NodeComponentRegistry,
): PendingUserConfigField[] {
  const node = shadow.snapshot().nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const component = nodeRegistry.getComponent(node.type);
  if (!component) return [];
  // listDefinitions() 를 다시 돌리는 대신 zod 스키마에서 즉석 JSON 스키마를
  // 꺼낸다. z.toJSONSchema 는 .meta() 를 `ui` 필드로 flatten 하므로
  // detector 가 그대로 읽을 수 있다.
  const jsonSchema = z.toJSONSchema(component.configSchema);
  return detectPendingUserConfig(jsonSchema, node.config ?? {});
}
