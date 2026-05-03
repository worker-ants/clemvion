import { LLM_PROVIDER_NODES } from "@/lib/utils/node-config-summary";

/**
 * 새 노드의 초기 config 를 만든다.
 *
 * AI 노드(`ai_agent` / `text_classifier` / `information_extractor`) 인
 * 경우, 워크스페이스의 isDefault=true LLM Config ID 가 주어지면 `llmConfigId`
 * 에 pre-fill 한다. 이렇게 해야 셀렉터에 "기본 제공자(공백)" 가 아니라 실제
 * LLM 이름이 표시되어 UI / 실행 결과 신뢰가 일치한다.
 *
 * - 비-AI 노드는 defaultConfig 그대로 복사 (early-return).
 * - 이미 `llmConfigId` 가 정의된 defaultConfig 는 덮어쓰지 않는다.
 * - `defaultLlmConfigId` 가 null/빈 문자열이면 노드 생성을 막지는 않고 비어있는
 *   상태로 둔다 — 사용자가 셀렉터에서 직접 선택할 수 있다.
 */
export function buildNodeInitialConfig(
  nodeType: string,
  defaultConfig: Record<string, unknown> | undefined,
  defaultLlmConfigId: string | null | undefined,
): Record<string, unknown> {
  if (!LLM_PROVIDER_NODES.has(nodeType)) {
    return { ...(defaultConfig ?? {}) };
  }
  const config = { ...(defaultConfig ?? {}) };
  if (defaultLlmConfigId && !config.llmConfigId) {
    config.llmConfigId = defaultLlmConfigId;
  }
  return config;
}
