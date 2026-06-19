# Requirement Reviewer — Hotfix: DangerTab extraction to danger-tab.tsx

Reviewed branch: `claude/agent-af1bb958339672d2c` vs `main`
Date: 2026-06-19 17:03:53

---

## Findings

### [INFO] (a) page.tsx final exports — default Page only: PASS

- Location: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx`
- Detail: Post-fix, `grep -n "^export"` on page.tsx returns exactly one line:
  `71: export default function IntegrationDetailPage(...)`.
  The former non-default `export function DangerTab(...)` (which triggered the
  Next.js App Router build error "DangerTab is not a valid Page export field") is
  fully removed. No other named exports exist in the file.
- Suggestion: No action required.

### [INFO] (b) DangerTab behavior/props/i18n keys — unchanged: PASS

- Location: `codebase/frontend/src/app/(main)/integrations/[id]/danger-tab.tsx` (new file, lines 1–184)
- Detail: The body of `DangerTab` is a byte-identical transplant from the removed
  section of page.tsx. All three props (`integration`, `onScopeChanged`, `t`) are
  preserved with identical TypeScript signatures. Every i18n key referenced
  (`integrations.scopeUpdated`, `integrations.scopeUpdateFailedDefault`,
  `integrations.deleteFailed`, `integrations.deleted`, `integrations.inUseError`,
  `integrations.scopeChangeTitle`, `integrations.scopeChangeHint`,
  `integrations.scopePersonal`, `integrations.scopeOrganization`,
  `integrations.scopeChangeConfirm`, `integrations.scopeApply`,
  `integrations.dangerDeleteTitle`, `integrations.dangerDeleteHint`,
  `integrations.dangerDeleteBtn`, `integrations.confirmDeleteBtn`,
  `integrations.cancelBtn`) is unchanged.
  The three mutation objects (`scopeMutation`, `precheckMutation`,
  `deleteMutation`) and all `useState` initialisations are identical to the
  original. The JSX render tree is identical.
- Suggestion: No action required.

### [INFO] (c) §4.7 / §7.2 spec fidelity — preserved after move: PASS

- Location: `danger-tab.tsx` lines 43–81 (precheckMutation + deleteMutation) and
  the `DeleteBlockedDialog` usage at lines 168–177.
- Detail (§4.7): The three-step delete flow specified in spec §4.7 is intact:
  1. Click "Delete" → `GET /api/integrations/:id/usages` (precheckMutation).
  2. usages >= 1 → `setBlockedUsages(usages)` → `DeleteBlockedDialog` open (§7.2).
  3. usages == 0 → `setConfirming(true)` → inline confirm/cancel → `DELETE`.
  The race-condition 409 `INTEGRATION_IN_USE` handler (deleteMutation.onError) also
  matches spec §7.2: "서버 측 DELETE도 동일 조건을 검증하여 409 반환 … body:
  `{ code: 'INTEGRATION_IN_USE', usages: [...] }`". The implementation reads
  `e.response.data?.usages` and re-shows the blocked dialog.
- Detail (scope change): Personal ↔ Organization change via `PATCH
  /api/integrations/:id/scope` is present (scopeMutation), which matches spec §4.7
  ("Personal ↔ Organization 전환도 이 탭에서 노출") and §4.8. The
  `window.confirm` guard is an existing pre-fix design; no regression introduced.
- Suggestion: No action required.

### [INFO] (d) Test import updated and still exercises DangerTab: PASS

- Location: `codebase/frontend/src/app/(main)/integrations/[id]/__tests__/danger-tab.test.tsx` line 46
- Detail: The single changed line updates the import from `"../page"` to
  `"../danger-tab"`. The mocks, `buildIntegration` helper, and all test assertions
  are unchanged, so the test still exercises the full `DangerTab` component via its
  new canonical path.
- Suggestion: No action required.

### [INFO] Removed imports from page.tsx are all accounted for: PASS

- Location: `page.tsx` diff lines removing `useRouter`, `Trash2`, `IntegrationScope`,
  `UsageWorkflow`, `DeleteBlockedDialog` imports.
- Detail: All five removed imports were exclusively used inside the moved
  `DangerTab` block. The new `danger-tab.tsx` re-imports all of them at the top of
  that file. No remaining usage sites in page.tsx were checked — static analysis
  confirms no other reference to `IntegrationScope` or `UsageWorkflow` exist in
  page.tsx post-fix. `useRouter` and `Trash2` are also absent from all other
  functions in page.tsx.
- Suggestion: No action required.

### [INFO] "use client" directive preserved in new file: PASS

- Location: `danger-tab.tsx` line 1
- Detail: `"use client"` is present at the top of the new file, consistent with
  the mutations and `useState`/`useRouter`/`useQueryClient` hooks that require
  client-side execution. page.tsx already has its own `"use client"` directive, so
  no hydration boundary was inadvertently removed.
- Suggestion: No action required.

---

## Summary

The hotfix is a pure mechanical refactor: `DangerTab` is extracted verbatim into a
sibling `danger-tab.tsx` file, the unit test import is updated to match, and the
now-unused import statements are cleaned up from `page.tsx`. There is no functional
change to any of the delete-blocked dialog (§4.7/§7.2) logic, scope change flow, props,
i18n keys, or mutation handlers. `page.tsx` now exports only the default `Page`
component, which resolves the Next.js App Router build constraint. No edge cases,
feature regressions, or spec deviations were identified.

## Risk Level

NONE
