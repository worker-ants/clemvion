"use client";

import { AlertTriangle } from "lucide-react";
import { type TFunction } from "@/lib/i18n";

/**
 * Mirror of `codebase/backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts`
 * `CAFE24_INQUIRY_URL`. Kept here as a literal to avoid coupling the
 * frontend bundle to a backend-only module — the URL is stable and any
 * change requires touching both sides anyway.
 */
const CAFE24_INQUIRY_URL = "https://developers.cafe24.com";

/**
 * Reusable ⚠ badge for Cafe24 partner-approval scopes/operations.
 *
 * Rendered next to scope checkbox labels (wizard Step 2 + integration
 * detail Scope & Permissions tab) and next to Cafe24 node Operation
 * dropdown rows (AI Agent allowlist). SoT for the underlying list:
 * `spec/conventions/cafe24-restricted-scopes.md`.
 */
export function ApprovalRequiredBadge({ t }: { t: TFunction }) {
  return (
    <span
      role="img"
      aria-label={t("integrations.approvalRequiredBadge")}
      title={t("integrations.approvalRequiredTooltip")}
      className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"
    >
      <AlertTriangle aria-hidden="true" className="h-3 w-3" />
      {t("integrations.approvalRequiredBadge")}
    </span>
  );
}

/**
 * Inline notice rendered under a list of scope checkboxes when ≥1 of the
 * selected items requires Cafe24 partner approval. Counts are computed by
 * the caller — this component only renders the message + inquiry link.
 */
export function RestrictedScopeNotice({
  count,
  inquiryUrl = CAFE24_INQUIRY_URL,
  t,
}: {
  count: number;
  inquiryUrl?: string;
  t: TFunction;
}) {
  if (count <= 0) return null;
  return (
    <div
      role="note"
      className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t("integrations.cafe24RestrictedScopeNotice", { count })}{" "}
          <a
            href={inquiryUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {t("integrations.approvalInquiryLink")}
          </a>
        </span>
      </p>
    </div>
  );
}
