"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UsageWorkflow } from "@/lib/api/integrations";
import type { TFunction } from "@/lib/i18n";

/**
 * 통합 사용처(워크플로우 → 노드) 목록 렌더.
 *
 * Usage 탭(§4.5)과 삭제 차단 다이얼로그(§7.2) 두 곳이 같은 워크플로우-노드
 * 목록 + `usageKind==='mcp'` 배지를 그리므로 한 컴포넌트로 추출해 중복을
 * 막는다. SoT: spec/2-navigation/4-integration.md §7.1 / §7.2.
 *
 * - `withLinks`: 워크플로우 이름을 `/workflows/<id>` 링크로 (Usage 탭처럼)
 *   렌더할지, 차단 다이얼로그처럼 "워크플로우 열기" 보조 링크를 별도 행으로
 *   둘지 분기한다. 차단 다이얼로그는 §7.2 mockup 의 `[Open Workflow A →]`
 *   액션을 워크플로우별로 노출한다.
 */
export function UsageNodeList({
  usages,
  t,
  variant = "tab",
}: {
  usages: UsageWorkflow[];
  t: TFunction;
  /**
   * `tab` — Usage 탭. 워크플로우 이름 자체가 링크.
   * `dialog` — 삭제 차단 다이얼로그. 워크플로우 이름은 텍스트, 하단에
   *   "워크플로우 열기" 액션 링크.
   */
  variant?: "tab" | "dialog";
}) {
  return (
    <div className="divide-y rounded-lg border border-[hsl(var(--border))]">
      {usages.map((w) => (
        <div key={w.workflowId} className="p-4">
          <div className="flex items-center gap-2">
            {variant === "tab" ? (
              <Link
                href={`/workflows/${w.workflowId}`}
                className="font-medium hover:underline"
              >
                {w.workflowName}
              </Link>
            ) : (
              <span className="font-medium">{w.workflowName}</span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                w.isActive
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
              )}
            >
              {w.isActive ? t("common.active") : t("common.inactive")}
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {w.nodes.map((n) => (
              <li key={n.id} className="text-[hsl(var(--muted-foreground))]">
                ├─ {n.label}{" "}
                {n.usageKind === "mcp" && (
                  <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                    {t("integrations.usageMcpBadge")}
                  </span>
                )}{" "}
                <span className="text-xs">({n.type})</span>
              </li>
            ))}
          </ul>
          {variant === "dialog" && (
            <Link
              href={`/workflows/${w.workflowId}`}
              className="mt-2 inline-flex items-center gap-1 text-sm text-[hsl(var(--primary))] hover:underline"
            >
              {t("integrations.usageOpenWorkflow")}
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
