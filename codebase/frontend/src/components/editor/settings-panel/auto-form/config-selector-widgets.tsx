"use client";

import { useQuery } from "@tanstack/react-query";
import {
  modelConfigsApi,
  MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
  MODEL_CONFIGS_EMBEDDING_LIST_QUERY_KEY,
  type ModelConfigData,
} from "@/lib/api/model-configs";
import { useT, useLocale } from "@/lib/i18n";
import { translateBackendHint } from "@/lib/i18n/backend-labels";
import { FieldGroup } from "../node-configs/shared";
import type { WidgetProps } from "./widgets";

/**
 * 등록된 ModelConfig 한 건을 고르는 셀렉터의 공통 셸. `value`/`onChange` 는 **config.id**
 * 를 다룬다 (LLM 제공자 셀렉터와 동일 — 모델명 문자열을 저장하던 종전 위젯과 다르다).
 * 저장된 id 가 더 이상 목록에 없으면(설정 삭제) stale 경고를 노출한다. 자체 라벨이 없으므로
 * FieldGroup 으로 감싸 schema 의 label·hint 를 렌더한다 (selector-widgets 의 규약과 동일).
 */
function ConfigSelectorShell({
  ui,
  label,
  value,
  onChange,
  required,
  configs,
  isLoading,
  emptyOptionLabel,
  noConfigsHint,
  renderOption,
  testIdPrefix,
}: Pick<WidgetProps, "ui" | "label" | "value" | "onChange" | "required"> & {
  configs: ModelConfigData[];
  isLoading: boolean;
  emptyOptionLabel: string;
  noConfigsHint: string;
  renderOption: (c: ModelConfigData) => string;
  testIdPrefix: string;
}) {
  const t = useT();
  const locale = useLocale();
  const current = typeof value === "string" ? value : "";
  // 목록이 로드된 뒤에도(>0) 저장된 id 가 없으면 stale — 로딩 중(빈 배열)에는 단정하지 않는다.
  const isStale = !!current && configs.length > 0 && !configs.some((c) => c.id === current);
  // 로딩이 끝났는데 후보가 0건이면 모델 설정 페이지로 안내.
  const showNoConfigsHint = !isLoading && configs.length === 0;
  return (
    <FieldGroup
      label={label}
      hint={translateBackendHint(ui?.hint, locale)}
      required={required}
    >
      <div className="flex flex-col gap-1">
        <select
          className="h-8 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          value={current}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{emptyOptionLabel}</option>
          {configs.map((c) => (
            <option key={c.id} value={c.id}>
              {renderOption(c)}
            </option>
          ))}
        </select>
        {showNoConfigsHint && (
          <p
            className="text-xs text-[hsl(var(--destructive))]"
            data-testid={`${testIdPrefix}-no-configs-hint`}
          >
            {noConfigsHint}
          </p>
        )}
        {isStale && (
          <p
            className="text-xs text-[hsl(var(--destructive))]"
            data-testid={`${testIdPrefix}-stale-warning`}
          >
            {t("nodeConfigs.configSelector.staleConfigWarning")}
          </p>
        )}
      </div>
    </FieldGroup>
  );
}

/**
 * Auto-form widget for `summaryModelConfigId` / `extractionModelConfigId`: 워크스페이스에
 * 등록된 **chat ModelConfig** 를 고른다(저장 config.id). 빈 선택은 "노드 메인 LLM 설정
 * 따름"으로, 런타임이 노드 `llmConfigId` 로 폴백한다(ai-agent §12.12 재번복). 모델명을
 * 직접 저장하던 종전 `chat-model-selector` 를 대체한다 — 더 저렴한 다른 제공자 모델을
 * 메인 대화 LLM 과 독립적으로 고를 수 있다.
 */
export function ChatConfigSelectorWidget(props: WidgetProps) {
  const t = useT();
  const { data: configs = [], isLoading } = useQuery({
    queryKey: MODEL_CONFIGS_CHAT_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("chat"),
    staleTime: 30_000,
  });
  return (
    <ConfigSelectorShell
      {...props}
      configs={configs}
      isLoading={isLoading}
      emptyOptionLabel={t("nodeConfigs.configSelector.chatDefaultOption")}
      noConfigsHint={t("nodeConfigs.configSelector.noChatConfigsHint")}
      renderOption={(c) =>
        `${c.name} (${c.defaultModel})${c.isDefault ? " *" : ""}`
      }
      testIdPrefix="chat-config"
    />
  );
}

/**
 * Auto-form widget for `embeddingModelConfigId`: 워크스페이스에 등록된 **embedding
 * ModelConfig** 를 고른다(저장 config.id). 빈 선택은 워크스페이스 기본 임베딩 config 로
 * resolve 된다(ModelConfigService.resolveEmbedding 폴백). KB 의 검증된
 * `embeddingModelConfigId` 선례를 그대로 따른다 — provider+dimension 핀이 저장·회수
 * 차원 일치 불변식(agent-memory §3)을 구조적으로 보장한다.
 */
export function EmbeddingConfigSelectorWidget(props: WidgetProps) {
  const t = useT();
  const { data: configs = [], isLoading } = useQuery({
    queryKey: MODEL_CONFIGS_EMBEDDING_LIST_QUERY_KEY,
    queryFn: () => modelConfigsApi.list("embedding"),
    staleTime: 30_000,
  });
  return (
    <ConfigSelectorShell
      {...props}
      configs={configs}
      isLoading={isLoading}
      emptyOptionLabel={t("nodeConfigs.configSelector.embeddingDefaultOption")}
      noConfigsHint={t("nodeConfigs.configSelector.noEmbeddingConfigsHint")}
      renderOption={(c) =>
        `${c.name} · ${c.defaultModel}${c.dimension ? ` (${c.dimension}d)` : ""}${
          c.isDefault ? " *" : ""
        }`
      }
      testIdPrefix="embedding-config"
    />
  );
}
