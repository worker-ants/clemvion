"use client";

import { useT, useLocale } from "@/lib/i18n";
import {
  readCafe24Extras,
  resolveCafe24OperationLabel,
} from "@/lib/node-definitions/cafe24-extras";
import type { Cafe24SupportedOperation } from "@/lib/node-definitions/types";
import { ApprovalRequiredBadge } from "@/components/integrations/approval-required-badge";

interface Props {
  /**
   * AI Agent config `mcpServers[i].enabledTools` — bare operation id 배열.
   * `undefined` 면 전부 허용(default_true, spec/5-system/11-mcp-client.md §5.6).
   */
  enabledTools: string[] | undefined;
  // `undefined` 면 default_true(전부 허용) 로 복원한다 — McpServerRef.enabledTools
  // 가 optional 이므로 부모는 그대로 patch 한다.
  onChange: (enabledTools: string[] | undefined) => void;
}

/**
 * Cafe24 MCP server 의 AI Agent allowlist (`enabledTools`) 를 **resource 카테고리
 * 단위 grouping** 으로 편집한다. spec/4-nodes/4-integration/4-cafe24.md §8.3.
 *
 * **별도 승인 ⚠**:
 * - `restrictedApproval.level === 'scope'` (resource 전체 별도 승인 — mileage /
 *   notification / privacy) → **그룹 헤더에 ⚠**.
 * - `restrictedApproval.level !== 'scope'` (operation / program 단위 — store 안
 *   paymentgateway_* / menus_get / activitylogs_* 등) → **operation 행에 ⚠**.
 * 차단 없음 — 인지·선택만 돕는다.
 *
 * **default_true materialize**: `enabledTools === undefined` 는 "전부 허용(향후
 * 추가되는 operation 포함)". 사용자가 처음 토글하면 현재 전체 id 로 materialize 한 뒤
 * 해당 id 만 제거한다 → 이후로는 명시 allowlist 로, 신규 operation 은 자동 포함되지
 * 않는다("내가 고른 것만"). 명시 배열이 전체와 일치하면 `undefined` 로 되돌려 default
 * 의미를 보존한다.
 */
export function Cafe24AllowlistEditor({ enabledTools, onChange }: Props) {
  const t = useT();
  const locale = useLocale();
  const extras = readCafe24Extras();

  if (!extras) {
    return (
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.integration.cafe24AllowlistLoading")}
      </p>
    );
  }

  // resource 키는 런타임 string 이라 typed TranslationKey union 보다 넓다 —
  // dict miss 시 key 자체로 fallback 하므로 캐스팅해 사용한다.
  const resourceLabel = (r: string): string =>
    t(
      `nodeConfigs.integration.cafe24Resources.${r}` as Parameters<
        typeof t
      >[0],
    );

  const resources = Object.keys(extras.operationsByResource).sort();
  const allIds = resources.flatMap((r) =>
    (extras.operationsByResource[r] ?? []).map((o) => o.id),
  );

  // 전부 허용 상태: `undefined` 또는 `['*']` wildcard (spec/5-system/11-mcp-client.md
  // §5.6 default_true). 둘 다 모든 operation 을 enabled 로 본다.
  const allAllowed =
    enabledTools == null || enabledTools.includes("*");

  const isEnabled = (id: string): boolean =>
    allAllowed || (enabledTools?.includes(id) ?? false);

  // 토글 기준값 — 전부 허용(undefined/['*']) 이면 전체 id 로 materialize 한다.
  const effectiveTools = (): string[] => (allAllowed ? allIds : enabledTools ?? []);

  // 명시 배열이 전체 id 와 동일하면 `undefined`(default_true) 로 되돌려 의미 보존.
  const commit = (next: string[]) => {
    const allSet = new Set(allIds);
    const sameAsAll =
      next.length === allIds.length && next.every((id) => allSet.has(id));
    onChange(sameAsAll ? undefined : next);
  };

  const toggleOp = (id: string) => {
    const b = effectiveTools();
    commit(
      isEnabled(id)
        ? b.filter((x) => x !== id)
        : Array.from(new Set([...b, id])),
    );
  };

  const setCategory = (ops: Cafe24SupportedOperation[], on: boolean) => {
    const ids = ops.map((o) => o.id);
    const idSet = new Set(ids);
    const b = effectiveTools();
    commit(
      on
        ? Array.from(new Set([...b, ...ids]))
        : b.filter((x) => !idSet.has(x)),
    );
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.integration.cafe24AllowlistHint")}
      </p>
      {resources.map((resource) => {
        const ops = extras.operationsByResource[resource] ?? [];
        if (ops.length === 0) return null;
        const categoryRestricted = ops.some(
          (o) => o.restrictedApproval?.level === "scope",
        );
        const enabledCount = ops.filter((o) => isEnabled(o.id)).length;
        const allOn = enabledCount === ops.length;
        const someOn = enabledCount > 0 && !allOn;
        return (
          <div
            key={resource}
            className="rounded-md border border-[hsl(var(--input))] p-1.5"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn;
                }}
                onChange={(e) => setCategory(ops, e.target.checked)}
                className="h-3 w-3"
                aria-label={resourceLabel(resource)}
              />
              <span className="text-[11px] font-medium">
                {resourceLabel(resource)}
              </span>
              {categoryRestricted && <ApprovalRequiredBadge t={t} />}
              <span className="ml-auto text-[9px] text-[hsl(var(--muted-foreground))]">
                {enabledCount}/{ops.length}
              </span>
            </div>
            <div className="mt-1 grid gap-0.5 pl-4">
              {ops.map((op) => {
                const opRestricted =
                  op.restrictedApproval &&
                  op.restrictedApproval.level !== "scope";
                return (
                  <label
                    key={op.id}
                    className="flex cursor-pointer items-center gap-1.5 text-[10px]"
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled(op.id)}
                      onChange={() => toggleOp(op.id)}
                      className="h-3 w-3"
                    />
                    <span className="truncate">
                      {resolveCafe24OperationLabel(locale, op.labelKey)}
                    </span>
                    {opRestricted && <ApprovalRequiredBadge t={t} />}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
