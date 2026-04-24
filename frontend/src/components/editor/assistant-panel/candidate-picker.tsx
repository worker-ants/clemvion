"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type {
  CandidateEntry,
  PendingUserConfigField,
} from "@/lib/api/assistant";

/**
 * Spec ED-AI-39 (§3.2 "Candidate picker") — Assistant 가 `add_node`·
 * `update_node` 로 만든 노드의 selector 필드가 비어있을 때, 서버가 실어준
 * `pendingUserConfig[*].candidates` 를 이 컴포넌트가 드롭다운으로 렌더한다.
 * 사용자가 드롭다운에서 항목을 고르고 Confirm 을 누르면 editor-store 가
 * 즉시 업데이트되며, picker 는 "✓ 설정됨" 읽기 전용 상태로 전환된다.
 *
 * 상태 분기:
 *  - `currentValue` 가 이미 채워져 있으면 → "✓ 설정됨" 으로 진입 (rehydrate
 *    직후 사용자가 이미 선택을 완료한 상태).
 *  - 후보가 0 개 → amber 안내 박스 + Settings 딥링크.
 *  - 후보가 1+ 개 → 드롭다운 + Confirm 버튼. 후보가 1 개여도 **자동 선택 금지**,
 *    사용자가 반드시 Confirm 을 눌러야 반영된다 (ED-AI-39 "명시적 확인").
 */
export interface CandidatePickerProps {
  field: PendingUserConfigField;
  /** 해당 노드의 현재 config 값 (rehydrate 판정용). */
  currentValue: unknown;
  /** 사용자가 Confirm 한 시점에 호출. parent 가 editor-store 로 주입. */
  onConfirm: (selectedId: string) => void;
  /** 후보 0 일 때 클릭할 "설정 화면" 경로. 일반적으로 `/integrations` 등. */
  settingsHref?: string;
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function CandidatePicker({
  field,
  currentValue,
  onConfirm,
  settingsHref,
}: CandidatePickerProps) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string>(
    // 후보 1개여도 자동 선택은 하지 않는다 — 사용자가 명시적으로 드롭다운에서
    // 골라야 Confirm 이 활성화된다. `""` 는 "선택 안됨".
    "",
  );
  const [confirmed, setConfirmed] = useState<boolean>(isFilled(currentValue));

  // 이미 값이 채워져 있거나, 이 세션에서 사용자가 Confirm 한 경우.
  if (confirmed) {
    const selectedLabel =
      field.candidates.find((c) => c.id === selectedId)?.label ??
      (typeof currentValue === "string" ? currentValue : field.label);
    return (
      <div
        role="status"
        className="flex items-start gap-1.5 rounded-md border border-emerald-400/70 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-950 dark:border-emerald-500/60 dark:bg-emerald-950/70 dark:text-emerald-50"
      >
        <Check size={12} className="mt-[2px] shrink-0" aria-hidden="true" />
        <span>
          {t("assistant.candidatePickerSelected", {
            label: field.label,
            selected: selectedLabel,
          })}
        </span>
      </div>
    );
  }

  // 후보가 아예 없는 경우 — 사용자에게 "직접 등록하세요" 로 위임.
  if (field.candidates.length === 0) {
    return (
      <div
        role="note"
        aria-label={t("assistant.candidatePickerEmpty", {
          label: field.label,
        })}
        className="flex flex-col gap-1 rounded-md border border-amber-400/70 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/70 dark:text-amber-50"
      >
        <span>
          {t("assistant.candidatePickerEmpty", { label: field.label })}
        </span>
        {settingsHref && (
          <a
            href={settingsHref}
            className="inline-flex items-center gap-0.5 self-start text-[11px] font-semibold underline hover:opacity-80"
          >
            {t("assistant.candidatePickerEmptyLink")}
            <ChevronRight size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  // 정상 경로 — 드롭다운 + Confirm. 네이티브 <select> 를 써서 키보드 조작과
  // 접근성을 보장한다 (spec §3.3).
  const onSubmit = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
    setConfirmed(true);
  };

  return (
    <div
      role="group"
      aria-label={t("assistant.candidatePickerTitle", { label: field.label })}
      className="flex flex-col gap-1.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-2.5 py-1.5"
    >
      <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
        {t("assistant.candidatePickerTitle", { label: field.label })}
      </span>
      <div className="flex items-center gap-1.5">
        <select
          aria-label={field.label}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-w-0 flex-1 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1.5 py-0.5 text-[11px] text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
        >
          <option value="">—</option>
          {field.candidates.map((c: CandidateEntry) => (
            <option key={c.id} value={c.id}>
              {c.sublabel ? `${c.label} (${c.sublabel})` : c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedId}
          aria-disabled={!selectedId}
          className="shrink-0 rounded-sm bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("assistant.candidatePickerConfirm")}
        </button>
      </div>
    </div>
  );
}
