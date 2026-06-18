# RESOLUTION — C-1 후속 ① delta 재검토 (02_19_11)

**맥락**: 본 세션은 `--commit 8a9d8a06`(ai-review INFO 주석 반영, 주석 7줄) **델타 재검토**다. 본체(`29e38a38`)는 `review/code/2026/06/19/01_41_04`(LOW·C0·W4, RESOLUTION 완비)에서 검토 완료. 본 세션은 review-gate(코드가 01_41_04 이후 `8a9d8a06` 으로 수정됨 → stale) 해소용 fresh 재검토.

RISK=LOW · Critical 0 · Warning 2.

## 조치 항목

| # | 카테고리 | 분류 | 근거 |
|---|---|---|---|
| W1 (god-class 미완 분해) | Architecture | 이연 | pre-existing. reviewer 명시 "본 변경 무관". → **C-1 후속 ④(forwardRef 제거) + PR-H/I** 백로그. |
| W2 (forwardRef 순환 DI 4개) | Architecture | 이연 | pre-existing = **C-1 후속 ④** 항목 그 자체. reviewer "Pre-existing". |
| I1 (SPEC-DRIFT: Rationale 멤버목록 3→12) | Requirement | 이관(planner) | spec 본문 staleness. developer spec read-only. `c1-engine-split.md` 후속 등재 완료(01_41_04 RESOLUTION 과 동일). |
| I2 (dead JSDoc 블록), I3 (일본어 주석), I6 (seenNodeIds 이중구조) | Maintainability | 이연(그루밍) | **전부 본 diff 밖 pre-existing** 코드(applyContinuation/rehydrateAndResume/rehydrateContext 본문 — 본 PR 미터치). 별도 그루밍. **본 PR 에서 미수정**: 추가 codebase 편집은 review-gate 재무장 → 무한 재리뷰 유발이라 의도적 보류(메모리 review-gate-loop-avoidance). |
| I4 / I9 (@internal 기존 7멤버 비대칭) | Maintainability/Arch | 수용(scope) | 초기 7멤버는 **impl 도 @internal 미보유** → 멤버별 대칭 유지가 옳음. 본 PR 에서 인터페이스 클래스 JSDoc 에 "모든 멤버 ENGINE_DRIVER 전용" 명시 추가(8a9d8a06)로 의미 보강. 7멤버 균등 @internal 은 별도 후속(impl 동반 필요). |
| I5 (dispatchMeta 인라인 타입) | Maintainability | 수용 | verbatim 이동된 기존 shape. `DispatchMeta` 추출은 선택적 그루밍. |
| I7 (executionId JSDoc 관계 미명시) | Maintainability | 수용 | 현 JSDoc("현재 처리 중인 Execution UUID") 충분. savedExecution.id 관계 보강은 선택 — 추가 편집 시 gate 재무장이라 보류. |
| I8 (주석에 리뷰 경로), I11 (ENGINE_DRIVER 바인딩 테스트) | Doc/Testing | 수용 | I8 필수 아님. I11 = 기존 `execution-engine.module.spec.ts` 가 `{provide: ENGINE_DRIVER, useExisting}` 바인딩을 부팅 검증(기존 존재 — 추가 불요). |
| I10 (assertSameWorkspace fail-open) | Security | 이연 | pre-existing = **C-1 후속 ★** 백로그(01_41_04 INFO #11 과 동일). |

**신규 Critical/Warning: 0** (W1/W2 는 pre-existing). **본 재검토에 대한 codebase 변경 없음** — 모든 발견이 pre-existing(diff 밖)·의도적 scope 결정·선택적 그루밍이라, 추가 codebase 편집을 하지 않는다(품질상 불필요 + review-gate 재무장 회피).

## TEST 결과

01_41_04 RESOLUTION 과 동일 (델타 `8a9d8a06` 은 주석-only → 컴파일 산출물 동일):

- **lint**: 통과 — backend `eslint --fix` (8a9d8a06 후 재통과)
- **unit**: 통과 — execution-engine 33 suites / 805 tests
- **build**: 통과 — backend tsc clean (8a9d8a06 후 재통과)
- **e2e**: 통과 — dockerized `make e2e-test` 34 suites / 202 tests (`29e38a38` 기준; 주석-only delta 라 컴파일 산출물 동일 → 유효. jest open-handle teardown 경고는 양성)

## 보류·후속 항목

- **SPEC-DRIFT I1** → planner (Rationale EngineDriver 멤버목록 3→12). `c1-engine-split.md` 후속 등재됨.
- **W1/W2/I10** → C-1 후속 ④(forwardRef 순환 DI 제거) + ★(assertSameWorkspace) 백로그.
- **I2/I3/I6** → pre-existing 코드 그루밍(본 PR 밖, execution-engine.service.ts 기존 주석/구조).
- **I4/I9/I5/I7** → 선택적 후속(7멤버 @internal 균등 · DispatchMeta 추출 등).
