# 신규 식별자 충돌 검토 — refactor 03 m-3 (integrations/new/page.tsx 분할)

검토 모드: --impl-prep (구현 착수 전)
대상: `integrations/new/page.tsx` 1,444줄 행위 보존 분할

---

## 발견사항

### [WARNING] `openOAuthPopup` — 동일 이름 두 개의 분리된 구현체 공존 위험

- **target 신규 식별자**: `lib/integrations/openOAuthPopup` (util 추출 후 예정 경로)
- **기존 사용처**:
  - `codebase/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts:1` — `export function openOAuthPopup(url: string)` (반환값 없음, `void`)
  - `codebase/frontend/src/app/(main)/integrations/new/page.tsx:1331` — `function openOAuthPopup(url: string): Window | null` (Window 참조 반환)
  - `[id]/page.tsx:45`, `[id]/scope-tab.tsx:14` 에서 `[id]/open-oauth-popup.ts` 를 import
- **상세**: target 은 `new/page.tsx` 내부의 `openOAuthPopup`(Window 반환) 을 `lib/integrations/` 로 이동하려 한다. 그러나 `[id]` 디렉터리에 **동명의 별개 파일** `open-oauth-popup.ts` 가 이미 존재하며 두 구현은 **시그니처가 다르다** — `new` 쪽은 `Window | null` 을 반환하고(팝업 ref 추적에 사용), `[id]` 쪽은 반환값이 없다. `lib/integrations/` 로 단일 util 을 추출할 경우 어느 시그니처를 채택할지 결정하지 않으면 `[id]` 쪽 소비처(`scope-tab.tsx`, `[id]/page.tsx`)가 반환값 없음을 기대하는 코드와 충돌하거나, `new` 쪽의 Window-ref 폴링(`popupRef.current`) 이 깨진다.
- **제안**: `lib/integrations/open-oauth-popup.ts` 로 단일 추출 시 반환 타입을 `Window | null` 로 통일하고, `[id]/open-oauth-popup.ts` 를 삭제한 뒤 `[id]/page.tsx` 및 `scope-tab.tsx` 의 import 를 `lib/integrations/open-oauth-popup` 로 교체한다. 또는 분할 범위를 `new/page.tsx` 내부 이동에만 한정하고 `[id]` 쪽은 별도 PR 에서 통합한다.

---

### [WARNING] `useUnsavedChangesWarning` — 계획 문서(plan)와 target scope 의 hook 이름 불일치

- **target 신규 식별자**: `lib/integrations/useUnsavedChangesWarning` (target scope 문서 명시)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m3-integrations-new-split-b13a10/plan/in-progress/refactor/03-maintainability.md:344` — 동일 역할(§3.6 이탈·복원)에 대해 `useDraftRestore` 라는 이름을 명시
- **상세**: plan 문서(m-3 §3.6 개선 방안 2)는 이탈 복원 hook 을 `useDraftRestore` 로 부른다. target scope 는 같은 역할을 `useUnsavedChangesWarning` 으로 표기한다. 두 이름은 의미 범위가 다르다 — `useDraftRestore`는 "이탈 후 재진입 시 임시 저장값 복원" 을 암시하고, `useUnsavedChangesWarning`은 "이탈 전 경고"만 암시한다. `new/page.tsx:351` 의 실제 `beforeunload` 코드는 복원 기능 없이 경고만 한다. 이름 자체가 spec §3.6 의 "이탈·복원" 중 "복원" 부분과 불일치한다면 이후 복원 기능 추가 시 혼선이 발생할 수 있다. 또한 plan 이름과 다른 이름으로 구현되면 코드 추적 시 plan 문서와 코드가 불일치해 일관성이 깨진다.
- **제안**: hook 이름을 `useUnsavedChangesWarning`(경고 전용, 현 구현 범위)으로 채택할 경우 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m3-integrations-new-split-b13a10/plan/in-progress/refactor/03-maintainability.md:344` 의 `useDraftRestore` 표기를 같이 갱신한다. 또는 spec §3.6 의 "복원" 의미까지 포함하는 이름(`useDraftPersistence`, `useUnsavedChangesGuard` 등)으로 통일하고 plan 과 target scope 를 동기화한다.

---

### [INFO] `components/integrations/steps/` — 신규 디렉터리 경로, 기존 패턴 검토

- **target 신규 식별자**: `components/integrations/steps/` 디렉터리 및 그 안의 `AuthStep`, `TestStep`, `Cafe24PrivatePendingStep`, `MakeshopPendingStep`, `Cafe24ExtraFields`, `MakeshopExtraFields` 컴포넌트
- **기존 사용처**: `codebase/frontend/src/components/integrations/` 에는 현재 `approval-required-badge.tsx`, `cafe24-allowlist-editor.tsx`, `makeshop-allowlist-editor.tsx`, `mcp-server-selector.tsx` 가 있으며 `steps/` 하위 디렉터리는 존재하지 않는다. `AuthStep`, `TestStep` 등은 현재 `new/page.tsx` 안의 file-private 함수이며 다른 곳에 동명 식별자 없음.
- **상세**: 신규 `steps/` 디렉터리와 6개 컴포넌트 이름은 기존 코드베이스에서 충돌하는 식별자가 없다. 다만 `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-m3-integrations-new-split-b13a10/plan/in-progress/refactor/03-maintainability.md:343` 은 `SaveStep` 이라는 이름도 언급하나 target scope 에서는 `SaveStep` 이 없고 대신 `Cafe24PrivatePendingStep`, `MakeshopPendingStep` 이 등장한다 — plan 에서 `SaveStep` 으로 통칭됐던 로직이 실제 구현에서는 provider별로 분기된 이름으로 세분화됐음을 명시적으로 확인하면 된다.
- **제안**: 구현 착수 시 `03-maintainability.md` 의 `SaveStep` 기재를 `Cafe24PrivatePendingStep` / `MakeshopPendingStep` 으로 갱신하거나, 범위 결정 근거를 plan 에 한 줄 주석으로 남겨 plan-code 불일치를 방지한다.

---

### [INFO] `useOauthPopupReturn` — plan/target 동일 이름, 기존 충돌 없음

- **target 신규 식별자**: `lib/integrations/useOauthPopupReturn`
- **기존 사용처**: 코드베이스 전체 검색 결과 동명 식별자 없음. `useOauthPopupReturn`, `OauthPopupReturn` 모두 0건.
- **상세**: 신규 hook 이름으로 기존 충돌 없다. 단 네이밍 일관성 관점에서 프로젝트 내 다른 hook 들은 `use-cafe24-pending-polling.ts`, `use-makeshop-pending-polling.ts` 처럼 `kebab-case` 파일명 + `camelCase` export 를 사용하므로 파일명은 `use-oauth-popup-return.ts` 가 될 것이 자연스럽다 (충돌 아님, 관습 확인 수준).
- **제안**: 없음.

---

## 요약

이번 분할(refactor 03 m-3)이 도입하는 신규 식별자 중 실질적 충돌 위험은 두 가지다. 첫째, `openOAuthPopup` 이름과 시그니처가 `integrations/[id]/open-oauth-popup.ts` 에 이미 존재하며 반환 타입(`Window | null` vs void)이 달라, `lib/integrations/` 로 단순 이동 시 `[id]` 측 소비처가 깨지거나 반환값 불일치로 런타임 버그가 발생할 수 있다. 둘째, 이탈 가드 hook 이름이 plan 문서(`useDraftRestore`)와 target scope(`useUnsavedChangesWarning`)에서 달라 코드-문서 불일치를 초래한다. 나머지 신규 식별자(`useOauthPopupReturn`, `AuthStep`, `TestStep`, `Cafe24PrivatePendingStep`, `MakeshopPendingStep`, `Cafe24ExtraFields`, `MakeshopExtraFields`, `NewIntegrationPage` 유지)는 코드베이스 전체에서 충돌하는 기존 사용처가 없다.

## 위험도

MEDIUM
