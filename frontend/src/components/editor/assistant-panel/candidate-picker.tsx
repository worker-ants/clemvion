"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type {
  CandidateEntry,
  PendingUserConfigField,
} from "@/lib/api/assistant";

/**
 * Spec ED-AI-39 (§3.2 "Candidate picker") — Assistant 가 `add_node`·
 * `update_node` 로 만든 노드의 selector 필드가 비어있을 때, 서버가 실어준
 * `pendingUserConfig[*].candidates` 를 이 컴포넌트가 picker 로 렌더한다.
 * 사용자가 항목을 고르고 Confirm 을 누르면 editor-store 가 즉시 업데이트되며,
 * picker 는 "✓ 설정됨" 읽기 전용 상태로 전환된다.
 *
 * **Selection mode**:
 *  - `selectionMode: 'single'` (default · scalar 필드) — native `<select>`.
 *  - `selectionMode: 'multi'`  (배열 필드 · `kb-selector` / `mcp-server-selector`)
 *    — 체크박스 리스트. 한 번의 Confirm 으로 여러 id 를 한꺼번에 주입한다.
 *
 * 상태 분기:
 *  - `currentValue` 가 이미 채워져 있으면 → "✓ 설정됨" 으로 진입.
 *  - 후보가 0 개 → amber 안내 박스 + Settings 딥링크.
 *  - 후보가 1+ 개 → picker + Confirm. 후보가 1 개여도 **자동 선택 금지**,
 *    사용자가 반드시 Confirm 을 눌러야 반영된다 (ED-AI-39 "명시적 확인").
 *
 * **Breaking change history**:
 *  - 2026-05: `onConfirm` 시그니처가 `(selectedId: string)` →
 *    `(selection: CandidatePickerSubmission)` 으로 확장됐다 — multi-select
 *    지원을 위해 single/multi 두 모드의 confirm payload 를 discriminated union
 *    으로 분리. 새 호출자는 `selection.mode` 를 분기해 처리해야 한다.
 */
export type CandidatePickerSubmission =
  | { mode: "single"; id: string }
  | { mode: "multi"; ids: string[] };

export interface CandidatePickerProps {
  field: PendingUserConfigField;
  /** 해당 노드의 현재 config 값 (rehydrate 판정용). */
  currentValue: unknown;
  /** 사용자가 Confirm 한 시점에 호출. parent 가 editor-store 로 주입. */
  onConfirm: (selection: CandidatePickerSubmission) => void;
  /** 후보 0 일 때 클릭할 "설정 화면" 경로. 일반적으로 `/integrations` 등. */
  settingsHref?: string;
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * 안전한 `settingsHref` 만 picker 에 전달한다 — 외부 URL / `javascript:` /
 * 빈 문자열은 거부 (review W-5). 현재 모든 widget 은 에디터 내부 경로
 * (`/integrations` 등) 만 사용한다.
 */
function sanitizeSettingsHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  return href.startsWith("/") ? href : undefined;
}

/**
 * `currentValue` 의 모양에서 picker 가 라벨을 매칭할 string id 배열을 뽑는다.
 *
 * KB-shape (`string[]`) 는 그대로 통과시키고, MCP-shape (`McpServerRef[]`,
 * `{integrationId: string, ...}` 객체 배열) 는 widget 별 unpacker 로 위임한다.
 * 도메인 schema 가 늘어날 때마다 본 정규화 함수가 부풀지 않게 picker 는
 * "string 후보"만 알도록 layering 한다.
 */
function extractMcpRefIds(value: unknown[]): string[] {
  const out: string[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      "integrationId" in entry &&
      typeof (entry as { integrationId: unknown }).integrationId === "string"
    ) {
      out.push((entry as { integrationId: string }).integrationId);
    }
  }
  return out;
}

function extractSelectedIds(
  widget: PendingUserConfigField["widget"],
  value: unknown,
): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (!Array.isArray(value)) return [];
  // string[] (KB 등 단순 id 배열) — 비어있는 entry 만 걸러 그대로 사용.
  if (value.every((v) => typeof v === "string")) {
    return (value as string[]).filter((v) => v.length > 0);
  }
  // 객체 배열 — widget 별 unpacker. 새 array-of-object widget 이 추가되면
  // 여기 분기를 늘리고 picker 표시 라벨을 맞출 수 있다.
  if (widget === "mcp-server-selector") return extractMcpRefIds(value);
  return [];
}

export function CandidatePicker({
  field,
  currentValue,
  onConfirm,
  settingsHref,
}: CandidatePickerProps) {
  const t = useT();
  // legacy DB row (selectionMode 누락) 는 'single' 로 fallback.
  const mode: "single" | "multi" = field.selectionMode ?? "single";
  // review W-1: legacy row 또는 SSE 스트림 오류로 candidates 가 missing 일
  // 수 있다. optional 로 받아 빈 배열로 normalize — rehydrate 시 panel 전체가
  // `TypeError` 로 크래시하지 않도록 방어.
  const candidates = Array.isArray(field.candidates) ? field.candidates : [];
  const safeSettingsHref = sanitizeSettingsHref(settingsHref);

  // single: "" = 미선택. multi: [] = 미선택.
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<boolean>(isFilled(currentValue));
  // review I-4: currentValue 가 외부(editor-store Undo/Redo, Settings Panel
  // 직접 편집 등)에서 바뀌었을 때 confirmed 상태가 이중 진실 공급원이 되지
  // 않도록 동기화. 단 사용자가 이 세션 안에서 Confirm 한 직후에는 setConfirmed(true)
  // 가 먼저 반영되므로 UX 에 영향 없음.
  useEffect(() => {
    setConfirmed(isFilled(currentValue));
  }, [currentValue]);

  if (confirmed) {
    // multi 는 currentValue 의 각 entry 를 candidate 라벨로 변환해 콤마 결합.
    // single 은 W-10 라벨 매칭 (raw id 노출 방지).
    const selectedLabel = (() => {
      if (mode === "multi") {
        const ids = extractSelectedIds(field.widget, currentValue);
        const labels = ids.map(
          (id) => candidates.find((c) => c.id === id)?.label ?? id,
        );
        return labels.length > 0 ? labels.join(", ") : field.label;
      }
      const matchedLabel = candidates.find(
        (c) =>
          c.id === selectedId ||
          (typeof currentValue === "string" && c.id === currentValue),
      )?.label;
      return (
        matchedLabel ??
        (typeof currentValue === "string" ? currentValue : field.label)
      );
    })();

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
  if (candidates.length === 0) {
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
        {safeSettingsHref && (
          <a
            href={safeSettingsHref}
            className="inline-flex items-center gap-0.5 self-start text-[11px] font-semibold underline hover:opacity-80"
          >
            {t("assistant.candidatePickerEmptyLink")}
            <ChevronRight size={12} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  // ── Multi-select branch (kb-selector / mcp-server-selector) ─────────
  if (mode === "multi") {
    const onToggle = (id: string) => {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
      );
    };
    const onSubmitMulti = () => {
      if (selectedIds.length === 0) return;
      // candidate 표시 순서를 그대로 유지해 deterministic 한 결과를 만든다
      // — Set/배열 토글 순서가 사용자 클릭 순서를 따라가지 않게 안정화.
      const ordered = candidates
        .map((c) => c.id)
        .filter((id) => selectedIds.includes(id));
      onConfirm({ mode: "multi", ids: ordered });
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
        <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
          {candidates.map((c: CandidateEntry) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px] hover:bg-[hsl(var(--accent))]"
            >
              <input
                type="checkbox"
                aria-label={c.label}
                checked={selectedIds.includes(c.id)}
                onChange={() => onToggle(c.id)}
                className="h-3 w-3 rounded"
              />
              <span className="truncate">
                {c.sublabel ? `${c.label} (${c.sublabel})` : c.label}
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={onSubmitMulti}
          disabled={selectedIds.length === 0}
          aria-disabled={selectedIds.length === 0}
          className="self-end rounded-sm bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("assistant.candidatePickerConfirm")}
        </button>
      </div>
    );
  }

  // ── Single-select branch (integration / llm-config / workflow) ──────
  const onSubmitSingle = () => {
    if (!selectedId) return;
    onConfirm({ mode: "single", id: selectedId });
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
          {candidates.map((c: CandidateEntry) => (
            <option key={c.id} value={c.id}>
              {c.sublabel ? `${c.label} (${c.sublabel})` : c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSubmitSingle}
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
