"use client";

import { useQuery } from "@tanstack/react-query";
import {
  modelConfigsApi,
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
  type ModelConfigData,
} from "@/lib/api/model-configs";
import { ModelCombobox } from "@/components/llm-config/model-combobox";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
import type { WidgetProps } from "./widgets";

/**
 * 같은 노드 config 의 형제 `llmConfigId`(노드가 고른 LLM provider connection) 값.
 * 모델 select 는 이 provider 의 등록 모델로 후보를 한정한다 (런타임이 세 모델 필드를
 * 모두 노드 `llmConfigId` config 로 resolve 하므로 — spec/4-nodes/3-ai §12.12).
 */
function siblingLlmConfigId(
  config: Record<string, unknown> | undefined,
): string | undefined {
  const raw = config?.llmConfigId;
  return typeof raw === "string" && raw ? raw : undefined;
}

/**
 * 모델 목록을 가져올 chat ModelConfig 를 해석한다: 노드 `llmConfigId` 가 set 이면 그
 * config, 아니면 워크스페이스 default chat config(`isDefault`, 없으면 첫 번째).
 * `useDefaultChatModelConfigId` 와 동일 폴백이되 combobox 가 provider/baseUrl 을
 * 필요로 하므로 전체 config 객체를 반환한다. `MODEL_CONFIGS_CHAT_LIST_QUERY_KEY`
 * 캐시를 selector 드롭다운·canvas pre-fill 과 공유한다.
 */
function useResolvedChatConfig(
  llmConfigId: string | undefined,
): ModelConfigData | undefined {
  const { data: configs = [] } = useQuery({
    queryKey: MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("chat"),
    staleTime: 30_000,
  });
  if (llmConfigId) {
    const pinned = configs.find((c) => c.id === llmConfigId);
    if (pinned) return pinned;
  }
  return configs.find((c) => c.isDefault) ?? configs[0];
}

/**
 * Auto-form widget for `summaryModel` / `extractionModel`: 노드 `llmConfigId`
 * provider 의 등록 **chat 모델명**을 lazy-load select 로 고른다. 저장 값은 모델명
 * 문자열이라 종전 `expression` 위젯과 하위호환이고, 종전에 저장된 임의 모델명은
 * `ModelCombobox` 의 saved-fallback 으로 계속 노출된다. apiKey="" 로 두면 loader 가
 * 저장된 config 의 `:id/models` 엔드포인트로 모델을 조회한다.
 */
export function ChatModelSelectorWidget({
  value,
  onChange,
  config,
}: WidgetProps) {
  const modelConfig = useResolvedChatConfig(siblingLlmConfigId(config));
  return (
    <ModelCombobox
      value={typeof value === "string" ? value : ""}
      onChange={(v) => onChange(v)}
      provider={modelConfig?.provider ?? ""}
      apiKey=""
      baseUrl={modelConfig?.baseUrl ?? undefined}
      configId={modelConfig?.id}
      modelType="chat"
    />
  );
}

/**
 * Auto-form widget for `embeddingModel`: 노드 `llmConfigId` provider(미지정 시
 * 워크스페이스 default)의 등록 **embedding 모델명**을 고른다. `EmbeddingModelCombobox`
 * 는 select-only(자유 입력 없음 — KB §Rationale R-1)라, embeddingModel 의 차원
 * 불변식(저장·회수 모델 일치, agent-memory §3)이 요구하는 "오타·미존재 모델명 저장
 * 차단"을 정확히 충족한다. 저장 값은 모델명 문자열(종전 `text` 위젯과 하위호환).
 */
export function EmbeddingModelSelectorWidget({
  value,
  onChange,
  config,
}: WidgetProps) {
  return (
    <EmbeddingModelCombobox
      value={typeof value === "string" ? value : ""}
      onChange={(v) => onChange(v)}
      modelConfigId={siblingLlmConfigId(config)}
    />
  );
}
