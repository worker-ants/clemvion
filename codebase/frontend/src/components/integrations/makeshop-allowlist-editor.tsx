"use client";

import { useT, useLocale } from "@/lib/i18n";
import {
  readMakeshopExtras,
  resolveMakeshopOperationLabel,
} from "@/lib/node-definitions/makeshop-extras";
import type { MakeshopSupportedOperation } from "@/lib/node-definitions/types";

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
 * MakeShop MCP server 의 AI Agent allowlist (`enabledTools`) 를 **resource 카테고리
 * 단위 grouping** 으로 편집한다. `Cafe24AllowlistEditor` 미러링.
 *
 * **Cafe24 와의 차이**: MakeShop 은 별도 승인(⚠) 권한 tier 가 없으므로 그룹 헤더·
 * operation 행 어디에도 approval 배지를 렌더하지 않는다. planned tier 도 없다 —
 * 모든 operation 이 supported.
 *
 * **default_true materialize**: `enabledTools === undefined` 는 "전부 허용(향후
 * 추가되는 operation 포함)". 사용자가 처음 토글하면 현재 전체 id 로 materialize 한 뒤
 * 해당 id 만 제거한다 → 이후로는 명시 allowlist 로, 신규 operation 은 자동 포함되지
 * 않는다("내가 고른 것만"). 명시 배열이 전체와 일치하면 `undefined` 로 되돌려 default
 * 의미를 보존한다.
 */
export function MakeshopAllowlistEditor({ enabledTools, onChange }: Props) {
  const t = useT();
  const locale = useLocale();
  const extras = readMakeshopExtras();

  if (!extras) {
    return (
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.integration.makeshopAllowlistLoading")}
      </p>
    );
  }

  // resource 키는 런타임 string 이라 typed TranslationKey union 보다 넓다 —
  // dict miss 시 key 자체로 fallback 하므로 캐스팅해 사용한다.
  const resourceLabel = (r: string): string =>
    t(
      `nodeConfigs.integration.makeshopResources.${r}` as Parameters<
        typeof t
      >[0],
    );

  const resources = Object.keys(extras.operationsByResource).sort();
  const allIds = resources.flatMap((r) =>
    (extras.operationsByResource[r] ?? []).map((o) => o.id),
  );

  // 전부 허용 상태: `undefined` 또는 `['*']` wildcard (spec/5-system/11-mcp-client.md
  // §5.6 default_true). 둘 다 모든 operation 을 enabled 로 본다.
  const allAllowed = enabledTools == null || enabledTools.includes("*");

  const isEnabled = (id: string): boolean =>
    allAllowed || (enabledTools?.includes(id) ?? false);

  // 토글 기준값 — 전부 허용(undefined/['*']) 이면 전체 id 로 materialize 한다.
  const effectiveTools = (): string[] =>
    allAllowed ? allIds : enabledTools ?? [];

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

  const setCategory = (ops: MakeshopSupportedOperation[], on: boolean) => {
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
        {t("nodeConfigs.integration.makeshopAllowlistHint")}
      </p>
      {resources.map((resource) => {
        const ops = extras.operationsByResource[resource] ?? [];
        if (ops.length === 0) return null;
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
              <span className="ml-auto text-[9px] text-[hsl(var(--muted-foreground))]">
                {enabledCount}/{ops.length}
              </span>
            </div>
            <div className="mt-1 grid gap-0.5 pl-4">
              {ops.map((op) => (
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
                    {resolveMakeshopOperationLabel(locale, op.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
