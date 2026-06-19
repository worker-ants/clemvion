"use client";

import { useQuery } from "@tanstack/react-query";
import {
  modelConfigsApi,
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
  type ModelConfigData,
} from "@/lib/api/model-configs";
import { ModelCombobox } from "@/components/llm-config/model-combobox";
import { EmbeddingModelCombobox } from "@/components/knowledge-base/embedding-model-combobox";
import { useT } from "@/lib/i18n";
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
 * 종전 `expression` 위젯에서 저장된 동적 참조(`{{ ... }}`) 값인지 판정. 신규 select
 * 는 이를 평가하지 않으므로 그대로 두면 리터럴 문자열이 모델명으로 호출돼 실패한다 —
 * 사용자에게 새로 선택하라고 경고하는 트리거 (ai-review DEFER follow-up).
 */
function looksLikeExpression(value: unknown): boolean {
  return typeof value === "string" && value.includes("{{");
}

/**
 * 모델 목록을 가져올 chat ModelConfig 를 해석한다: 노드 `llmConfigId` 가 set 이면 그
 * config, 아니면 워크스페이스 default chat config(`isDefault`, 없으면 첫 번째).
 * `useDefaultChatModelConfigId` 와 동일 폴백이되 combobox 가 provider/baseUrl 을
 * 필요로 하므로 전체 config 객체를 반환한다. `MODEL_CONFIGS_CHAT_LIST_QUERY_KEY`
 * 캐시를 selector 드롭다운·canvas pre-fill 과 공유한다.
 */
function useResolvedChatConfig(llmConfigId: string | undefined): {
  config: ModelConfigData | undefined;
  /** llmConfigId 가 지정됐는데 (로드된) 목록에 없어 default 로 fallback 한 상태. */
  isStale: boolean;
} {
  const { data: configs = [] } = useQuery({
    queryKey: MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("chat"),
    staleTime: 30_000,
  });
  const pinned = llmConfigId
    ? configs.find((c) => c.id === llmConfigId)
    : undefined;
  const config = pinned ?? configs.find((c) => c.isDefault) ?? configs[0];
  // 목록이 아직 비었으면(로딩 중) stale 로 단정하지 않는다 — 로드 완료(>0) 후에도
  // 지정 id 가 없을 때만 다른 provider 로 fallback 한 것이므로 경고 대상.
  const isStale = !!llmConfigId && configs.length > 0 && !pinned;
  return { config, isStale };
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
  const t = useT();
  const { config: modelConfig, isStale } = useResolvedChatConfig(
    siblingLlmConfigId(config),
  );
  return (
    <div className="flex flex-col gap-1">
      <ModelCombobox
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v)}
        provider={modelConfig?.provider ?? ""}
        // 의도적 "" — apiKey 빈 값 + configId 설정이면 loader 가 저장된 config 의
        // `:id/models` 엔드포인트로 모델을 조회한다 (preview 가 아닌 edit-mode 경로,
        // ModelCombobox JSDoc 참고). 노드는 자유 입력 키를 가지지 않는다.
        apiKey=""
        baseUrl={modelConfig?.baseUrl ?? undefined}
        configId={modelConfig?.id}
        modelType="chat"
      />
      {isStale && (
        <p
          className="text-xs text-[hsl(var(--destructive))]"
          data-testid="chat-model-stale-warning"
        >
          {t("nodeConfigs.modelSelector.staleConfigWarning")}
        </p>
      )}
      {looksLikeExpression(value) && (
        <p
          className="text-xs text-[hsl(var(--destructive))]"
          data-testid="chat-model-expression-warning"
        >
          {t("nodeConfigs.modelSelector.expressionValueWarning")}
        </p>
      )}
    </div>
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
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <EmbeddingModelCombobox
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v)}
        modelConfigId={siblingLlmConfigId(config)}
      />
      {looksLikeExpression(value) && (
        <p
          className="text-xs text-[hsl(var(--destructive))]"
          data-testid="embedding-model-expression-warning"
        >
          {t("nodeConfigs.modelSelector.expressionValueWarning")}
        </p>
      )}
    </div>
  );
}
