"use client";

import { type ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import type { ModelInfo } from "@/lib/api/llm-configs";

interface ModelSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  models: ModelInfo[];
  errorMessage: string | null;
  isPending: boolean;
  canLoad: boolean;
  hasAttemptedLoad: boolean;
  load: () => void;
  /**
   * 사용자가 저장된 모델 ID 가 새로 불러온 목록에 없을 때 placeholder option 으로
   * 표시할 텍스트를 만드는 함수. ModelCombobox / EmbeddingModelCombobox 각자
   * i18n 키가 달라 호출자에서 주입한다.
   */
  formatSavedFallback: (model: string) => string;
  /**
   * 모델을 한 번도 불러오지 않은 상태에서 select 아래에 표시되는 안내 메시지.
   */
  loadRequiredHint: string;
  /**
   * 로드 후 표시되는 안내 메시지.
   */
  loadedHint: string;
  /**
   * placeholder text — `value === ""` 일 때 select 의 disabled option 으로 노출.
   */
  placeholder?: string;
  /**
   * 외부 disabled (예: 폼 자체가 비활성). select 와 load 버튼 모두 강제 비활성화.
   */
  disabled?: boolean;
  /**
   * data-testid 접두어 — 호출자별 고유 id 부여. `${prefix}-select`, `${prefix}-load` 형태로 사용.
   */
  testIdPrefix: string;
  /**
   * Option 렌더링을 호출자가 커스터마이즈하고 싶을 때. 미지정 시 기본 포맷
   * (`name (id)` 또는 `id`) 사용.
   */
  renderOption?: (m: ModelInfo) => ReactNode;
}

function defaultOptionLabel(m: ModelInfo): string {
  return m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id;
}

/**
 * "모델 불러오기" 버튼 + NativeSelect + 상태 메시지 4-way (error / empty / not-yet
 * loaded / loaded) UI 를 캡슐화. ModelCombobox 와 EmbeddingModelCombobox 가 동일
 * 패턴을 공유한다. 자유 입력은 제공하지 않으며, 저장된 값 호환은 호출자에서
 * `formatSavedFallback` 로 placeholder option 텍스트를 주입한다.
 */
export function ModelSelectField({
  value,
  onChange,
  models,
  errorMessage,
  isPending,
  canLoad,
  hasAttemptedLoad,
  load,
  formatSavedFallback,
  loadRequiredHint,
  loadedHint,
  placeholder,
  disabled,
  testIdPrefix,
  renderOption,
}: ModelSelectFieldProps) {
  const t = useT();
  const hasLoadedModels = models.length > 0;
  // 본 resetKey 범위에서 로드를 시도했으나 반환된 모델이 0건인 상태.
  // useMutation.isSuccess 대신 hasAttemptedLoad 로 판단해 resetKey 변경 시
  // 즉시 "모델 없음" 메시지가 잘못 표시되는 버그를 방지한다 (PR review SUMMARY #1).
  const isEmpty = !errorMessage && hasAttemptedLoad && !hasLoadedModels;
  const savedValueMissingFromLoaded =
    value !== "" && !models.some((m) => m.id === value);
  const selectDisabled = disabled || !hasLoadedModels;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <NativeSelect
          data-testid={`${testIdPrefix}-select`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={selectDisabled}
        >
          {!value && (
            <option value="" disabled>
              {placeholder ?? t("llmConfigs.modelPlaceholder")}
            </option>
          )}
          {savedValueMissingFromLoaded && (
            <option value={value}>{formatSavedFallback(value)}</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {renderOption ? renderOption(m) : defaultOptionLabel(m)}
            </option>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          onClick={load}
          disabled={disabled || !canLoad || isPending}
          aria-label={
            isPending
              ? t("llmConfigs.loadingModels")
              : t("llmConfigs.loadModels")
          }
          data-testid={`${testIdPrefix}-load`}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1.5 text-xs">
            {isPending
              ? t("llmConfigs.loadingModels")
              : t("llmConfigs.loadModels")}
          </span>
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-xs text-[hsl(var(--destructive))]">{errorMessage}</p>
      ) : isEmpty ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("llmConfigs.noModelsFound")}
        </p>
      ) : !hasLoadedModels ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {loadRequiredHint}
        </p>
      ) : (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {loadedHint}
        </p>
      )}
    </div>
  );
}
