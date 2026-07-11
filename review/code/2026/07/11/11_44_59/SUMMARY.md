# AI Review SUMMARY — EIA 클라이언트 context 타입 + 링크 가드

- diff base: `1682777fe..HEAD` (내 2커밋: `964e887af` 클라이언트 타입 A, `428134b64` 가드+링크 B)
- 세션: `review/code/2026/07/11/11_44_59/`
- 실행 reviewer 5: api_contract · testing · side_effect · maintainability · scope

## 종합

| 항목 | 값 |
| --- | --- |
| **Critical** | **2** (testing) |
| **Warning** | 5+ |
| 위험도 | **HIGH** (testing) — 나머지 LOW |

핵심: 로직 버그가 아니라 **인프라 배선 갭** — B의 새 가드와 A의 타입 가드 테스트가 **실제로는 harness/CI에서 실행·타입체크되지 않아** "재발 자동 방지"라는 목적이 무력화될 수 있다. 실측으로 대부분 확인됨.

## Critical (전부 실측 확인)

### C1. SDK 타입 테스트가 harness 어디에서도 실행 안 됨
`.claude/test-stages.sh` `cmd_unit`·`cmd_build` 둘 다 `@workflow/sdk`(packages/sdk) 미포함 (backend·frontend·@workflow/web-chat·channel-web-chat 만). 내 `client.spec.ts` 신규 타입 가드는 orphaned — 로컬 `jest`로만 확인됨. (SDK `tsc --noEmit` 은 로컬 green.)
→ **조치**: `cmd_unit`+`cmd_build` 에 `pnpm --filter @workflow/sdk` 추가.

### C2. 타입 가드 테스트가 실제 타입체크 안 됨
channel-web-chat `test`=`vitest run`(esbuild 타입 strip). `typecheck`(`tsc --noEmit`)는 별도 script인데 harness가 호출 안 함. `next build`도 test 파일 미검. 즉 "캐스트 없이 컴파일된다"는 가드가 harness 어디서도 타입체크 안 됨.
→ **부분 조치 + 후속**: channel-web-chat `tsc --noEmit` 은 **이미 pre-existing red**(`use-widget-eager-start.test.ts` EventSource mock 타입 에러 3건, 내 변경 무관 — 실측 확인). 그래서 harness 미배선. 이걸 배선하려면 그 pre-existing red 먼저 정리해야 = 본 PR 범위 밖 → **후속 plan**. 소비처(use-widget.ts) 타입은 `next build`(앱 소스)가 잡으므로 실제 회귀는 일부 커버. 내 타입 테스트는 "로컬 tsc + 소비처 build" 로 검증되는 보조 가드임을 명시.

## Warning

- **W-scan-frontend** (testing·maintainability 수렴): 내 가드 `CODEBASE_SOURCE_ROOTS` 가 `codebase/frontend/src` 제외 — 같은 hand-counted `../` 링크 패턴 존재. 실측: `widgets.tsx:130`, `multi-select-widget.test.tsx:3` 2곳 실제 깨짐(MISSING). → **frontend/src 스캔 추가 + 2 링크 수정.** (spec-links.ts:242 는 내 주석 속 백틱 예시라 `extractLinks` 인라인코드 제거로 제외 — 확인 예정.)
- **W-spec-link-ci** (testing): spec-link 가드가 frontend vitest 에만 있고, `frontend-checks.yml` trigger paths 가 backend/channel-web-chat 제외 → 가드가 스캔하는 영역이 CI trigger 밖. → **후속**(CI 정책, `.github/` 변경). harness `unit` stage 는 무조건 frontend test 를 돌리므로 로컬/harness 는 커버, CI PR-trigger 만 갭.
- **W-negative-test** (testing): union "닫힘" 을 `@ts-expect-error` 로 고정하는 negative test 없음(allow 방향만). → **조치**: negative 케이스 추가.
- **W-bare-see** (testing): bracket 없는 `@see spec/…` 참조는 regex 우회. 내 실측 grep = **0건**(내 패턴 기준) → 실체 약함, no-op.
- **W-spec-edit** (scope): developer 가 `spec/conventions/spec-impl-evidence.md §4.2` 를 self-justify 로 편집(CLAUDE.md 경계). 내용 정확. → planner/사용자 사후 확인 권고(impl-done 이 검증).

## Info / maintainability

- SDK narrowing 은 breaking 이론상 가능하나 `@workflow/sdk` v0.1.0 internal-only(`plan/complete/eia-sdk-publish.md` 정책)라 위험 낮음 — 무조치.
- `WaitingContext` cross-package homonym = 의도된 mirror(선례 `ExecutionStatus`). 구조 parity 자동 가드는 없음 → 후속 여지.
- `NodeOutputContext.nodeOutput = WaitingForInputEvent["nodeOutput"]` indexed-access 가 `nodeOutput: undefined` 를 silent 허용(maintainability, `tsc --strict` 실측). → **조치 검토**(required 강제).
- `spec-links.ts` 신규 함수가 기존 `collectSpecMarkdown`/`findBrokenLinks` 와 ~40줄 중복 → 후속 리팩터 여지(무조치, 동작 정확).

## Resolution 계획

이 PR: C1(SDK 배선) · W-scan-frontend(frontend/src + 2링크) · W-negative-test · nodeOutput required. 
후속 plan: C2(channel-web-chat typecheck 배선, pre-existing red 정리) · W-spec-link-ci(CI trigger) · spec-links 중복 리팩터.
