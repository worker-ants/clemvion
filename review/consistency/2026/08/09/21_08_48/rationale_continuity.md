STATUS=success rationale_continuity review complete — no CRITICAL/WARNING found

# Rationale 연속성 검토 — `spec/data-flow/` (impl-done, uuid-canary-docstring-fix)

## 대상 diff 요약

실제 코드 변경은 두 파일의 **docstring/주석뿐**이며 동작 변경 없음:

1. `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` — 부트 캐너리가 세는 대상이
   "`@Roles()` 가 없는 라우트 73건"(subset)이 아니라 "`@WorkspaceId()` 를 소비하는 라우트 전체 142건"
   (superset, 2026-08-09 정적 실측)임을 명확화.
2. `codebase/backend/src/common/utils/uuid.ts` — `system-status.e2e-spec.ts` 는 `isValidUuid` vs
   `isUuidShaped` 경계의 캐너리가 **아니라는** 정정과, 진짜 캐너리(`uuid.spec.ts` ·
   `workspace-context.util.spec.ts`)를 재확인, `spec/data-flow/12-workspace.md §Rationale
   "UUID 검증 강도 비대칭"` 을 SoT 로 명시.

## 발견사항

두 변경 모두 `spec/data-flow/12-workspace.md` 및 `spec/5-system/1-auth.md` 의 기존 `## Rationale` 항목과
**충돌 없이 일치**한다. 오히려 이 diff 는 그 Rationale 이 이미 지적해 둔 코드-주석 drift 를 뒤늦게
해소하는 성격이다 — 신규 결정도, 결정 번복도, 기각된 대안의 재도입도 아니다.

- **[INFO] uuid.ts 의 "그쪽 캐너리는 `roles.guard.spec.ts` …" 문구는 Rationale 에 아직 이름으로 없음**
  - target 위치: `codebase/backend/src/common/utils/uuid.ts` diff, `+` 라인 (system-status.e2e-spec.ts 가
    실제로 고정하는 별개 불변식의 "진짜 캐너리"를 `roles.guard.spec.ts` 의 특정 테스트명으로 지목)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` §Rationale "`X-Workspace-Id` 헤더 vs `:id` 경로
    파라미터 — UUID 검증 강도 비대칭 (2026-08-09)" 의 "캐너리 지목 정정" 및 "적용 범위" 문단
  - 상세: Rationale 은 "워크스페이스-무관 전역 라우트는 헤더를 무시한다" 는 별개 불변식의 존재만
    서술하고, 그 불변식을 고정하는 구체적 unit test 이름(`roles.guard.spec.ts` 의 `'형식이 깨진
    헤더여도 전역 라우트는 400 을 내지 않는다 — 단축이 헤더 파싱보다 먼저다'`)까지는 명시하지
    않는다. 코드에서 해당 테스트 존재는 직접 확인함(worktree 절대경로 grep, line 337) — **사실
    자체는 정확**하고 모순이 아니다. 다만 코드 docstring 이 Rationale 보다 한 단계 더 구체적인
    "캐너리 지목"을 새로 하고 있어, Rationale 쪽이 그 구체성을 아직 미러링하지 않은 상태다(단방향
    drift 여지).
  - 제안: 필수는 아님. 다음에 `spec/data-flow/12-workspace.md` §Rationale "UUID 검증 강도 비대칭" 을
    편집할 기회가 있으면 "적용 범위" 문단 말미에 `roles.guard.spec.ts` 테스트명을 함께 적어 코드
    docstring 과 완전히 대칭시키는 것을 고려. 이번 diff 를 막을 사유는 아니다.

## 교차 검증 메모 (참고, 발견사항 아님)

- `workspace-reflection-canary.ts` 의 "73건"(구주석, `#1103` 인용) 은 `spec/data-flow/12-workspace.md`
  §"멤버십 검증은 가드 1곳에서" 의 "HTTP 라우트 222건 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가
  없는 것 73건" 과 **정확히 같은 숫자·같은 정의**(subset)다. 옛 주석이 이 subset 수치를 부트 캐너리의
  superset 대상("`@WorkspaceId()` 를 소비하는 라우트 전체")에 잘못 붙여 썼던 것이며, diff 가 그 conflation
  을 correct 한다. `spec/5-system/1-auth.md §Rationale "부트 캐너리"` 는 애초에 "단언 대상은 라우트
  목록이 아니라 '0건이 아님'"이라 명시해 특정 개수 하드코딩을 금지했으므로, 코드가 정확한 개수를
  주석에만 적고 assertion 로직에는 쓰지 않는 현재 형태는 그 원칙과 부합한다.
- `uuid.ts` 의 정정은 `spec/data-flow/12-workspace.md` 의 "캐너리 지목 정정 (2026-08-09)" 서브섹션이
  이미 "구현 PR(#1108)의 plan 과 `common/utils/uuid.ts` docstring 은 … 잘못 지목했다" 고 자기-교정을
  선언해 둔 바로 그 교정을 코드에 반영한 것 — Rationale 이 먼저 쓰이고 코드가 뒤따라온 정상적인
  전파 순서다.
- 두 변경 모두 기존 invariant(header-first 우선순위, UUID 검증 강도 비대칭, opt-in 마커 기각, 라우트
  하드코딩 금지)를 우회하거나 재해석하지 않는다.

## 요약

이번 diff 는 `codebase/backend/src/common/{decorators/workspace-reflection-canary.ts,utils/uuid.ts}` 의
docstring 만 수정하며, 두 수정 모두 `spec/data-flow/12-workspace.md` 와 `spec/5-system/1-auth.md` 의
기존 `## Rationale` 이 이미 기록해 둔 정정 사항(캐너리 지목 오류, subset/superset 개수 conflation)을
코드 쪽에 뒤늦게 반영하는 것이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant
우회 중 어느 것도 관측되지 않았다. INFO 1건(Rationale 이 새 캐너리 테스트명을 아직 미러링하지 않음)은
비차단 권고다.

## 위험도
NONE
