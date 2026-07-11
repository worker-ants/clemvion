# RESOLUTION — EIA 클라이언트 context 타입 + 링크 가드 (review 11_44_59)

Critical 2 · Warning 5+. 위험도 HIGH(testing). 근본 = 인프라 배선 갭. 본 PR 에서 해소 가능한 것 조치, pre-existing red 얽힌 것은 후속 plan.

## 조치 항목

| # | 검출 | 내용 | 조치 | 상태 |
| --- | --- | --- | --- | --- |
| C1 | testing | SDK 타입 테스트가 harness 어디에도 미실행(`test-stages.sh` cmd_unit/cmd_build 에 `@workflow/sdk` 없음) | `cmd_unit`+`cmd_build` 에 `pnpm --filter @workflow/sdk test`/`build` 추가. SDK `tsc` green 이라 배선 즉시 통과 | **fixed** |
| W-scan-frontend | testing·maintainability | 가드 `CODEBASE_SOURCE_ROOTS` 가 `codebase/frontend/src` 제외 → `widgets.tsx:130`·`multi-select-widget.test.tsx:3` 깨진 링크 놓침 | frontend/src 를 스캔에 추가 + 두 링크 depth 정정(`../×6→×7`, `../×7→×8`). spec-links.ts:242 주석 예시는 백틱이라 `extractLinks` 가 제외 — 가드 green 재확인(13 pass) | **fixed** |
| W-negative-test | testing | union "닫힘" 을 고정하는 `@ts-expect-error` negative test 없음(allow 방향만) | 위젯 + SDK 에 negative 케이스 추가(ButtonsContext buttonConfig 누락·두 판별키 모두 누락). SDK 는 build=tsc 로 즉시 검증, 위젯은 typecheck 배선 후 유효(주석 명시) | **fixed** |
| maint-nodeOutput | maintainability | 위젯 `NodeOutputContext.nodeOutput = WaitingForInputEvent["nodeOutput"]` 가 optional 이라 `undefined` silent 허용 | `NonNullable<...>` 로 required 강제 | **fixed** |
| C2 | testing | 타입 가드 테스트가 실제 타입체크 안 됨(channel-web-chat `vitest run` 타입 strip, `typecheck` 미배선) | channel-web-chat `tsc --noEmit` 이 **pre-existing red**(`use-widget-eager-start.test.ts` EventSource mock, 본 PR 무관 — 실측)라 배선하려면 그 정리 선행 = 본 PR 범위 밖 → **후속 plan**. 소비처(use-widget) 타입은 `next build` 가 커버, 내 타입 테스트는 "로컬 tsc + 소비처 build" 보조 가드로 명시 | **deferred** |
| W-spec-link-ci | testing | 가드가 frontend vitest 에만 있고 `frontend-checks.yml` trigger 가 backend/webchat 제외 → CI PR-trigger 갭(harness unit 은 커버) | CI 정책·`.github/` 변경이라 **후속 plan** | **deferred** |
| W-bare-see | testing | bracket 없는 `@see spec/…` 참조 regex 우회 | 실측 grep 0건(내 패턴 기준) → 실체 약함 | **no_change_needed** |
| W-spec-edit | scope | developer 가 `spec-impl-evidence.md §4.2` 편집(CLAUDE.md 경계) | 가드 확장 종속 정합화 + subagent write 격리로 위임 불가 + impl-done 이 사후 검증. commit 에 근거 기록. planner/사용자 사후 확인 권고 | **acknowledged** |
| maint-homonym | maintainability | `WaitingContext` cross-package homonym(위젯·SDK) 구조 parity 자동 가드 없음 | 의도된 mirror(선례 `ExecutionStatus`), 무조치. 후속 여지만 | **no_change_needed** |
| maint-dup | maintainability | `spec-links.ts` 신규 함수 ~40줄 중복 | 동작 정확, 저우선 → 후속 plan | **deferred** |
| api-sdk-breaking | api_contract | SDK narrowing breaking 이론상 | `@workflow/sdk` v0.1.0 internal-only(`eia-sdk-publish.md` 정책) → 위험 낮음 | **no_change_needed** |

후속 4건은 `plan/in-progress/eia-context-schema-followups.md` §리뷰 후속 에 등재.

## TEST 결과

fix 후 TEST WORKFLOW 재수행 (SDK 배선 포함):

| 단계 | 결과 |
| --- | --- |
| lint | **PASS** (39s) |
| unit | **PASS** (SDK `@workflow/sdk` 신규 배선 포함) |
| build | **PASS** — SDK `tsc` 가 negative `@ts-expect-error` 검증(통과 = union 실제로 닫힘) |
| e2e | **통과** — 250 passed |

## 보류·후속 항목

- C2(channel-web-chat typecheck 배선) · W-spec-link-ci(CI trigger) · spec-links 중복 · 타 packages 배선 → `eia-context-schema-followups.md` §리뷰 후속.
