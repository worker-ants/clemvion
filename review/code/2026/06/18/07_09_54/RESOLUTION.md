# RESOLUTION — C-1 step4 (RetryTurnService, FINAL)

리뷰 세션: `review/code/2026/06/18/07_09_54/SUMMARY.md`
대상: `claude/engine-split-s4-retry` (C-1 step4)
전체 위험도: **MEDIUM** (retry 분기 테스트 갭) · Critical 0 · fix 커밋 `cffd95c8`

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W-5 | Testing | **fix** — `applyRetryLastTurn` early-exit guards 6건(spawned row 부재/타execution/non-RUNNING/`_retryState` 부재/execution 부재/node 부재 → zombie row FAILED·graph 미구동) 단위테스트 | `cffd95c8` |
| W-6 | Testing | **fix** — re-entry 가 `ExecutionCancelledError` throw 시 `EXECUTION_CANCELLED` emit(vs generic→FAILED) 검증 | `cffd95c8` |
| W-7 | Testing | **fix** — `resumeGraphAfterRetry` defensive fallback(빈 graph / sortedIndexMap miss → `completeRetryExecution`) 검증 | `cffd95c8` |
| W-2 | Architecture | **fix** — 엔진 PR4-승격 5 driver 메서드(`rehydrateContext`·`loadAndBuildGraph`·`runNodeDispatchLoop`·`findActivatedBackEdge`·`clearLlmDefaultConfigCache`)에 `@internal` JSDoc(직접 참조 금지 명시) | `cffd95c8` |
| W-8 | Maintainability | **fix** — `failRetryExecution` `@internal` JSDoc(applyRetryLastTurn catch 전용 호출 제약) | `cffd95c8` |
| W-1 | Architecture | **수용** — `EngineDriver` 가 lifecycle + graph capability 혼재(ISP). strangler-fig 누적 결과. 후속: 소비자별 부분 인터페이스 분리(c1-engine-split.md 후속 고려) |
| W-3 | Architecture | **수용** — Retry↔Engine↔AiTurn 3-way forwardRef 순환. strangler-fig 의도된 중간상태. 후속: 엔진→서비스 방향 제거(caller-side) 백로그(c1-engine-split.md) |
| W-4 | Architecture | **수용(이연)** — `completeRetryExecution` 가 `updateExecutionStatus` 우회 직접 status mutate(race 우려). **verbatim 이동된 pre-existing 행위** — `updateExecutionStatus` 경유 전환은 guarded transition+segmentStartMs 타이밍 변경이라 행위 동등성 검증 후 별도 후속. PR4 신규 아님 |
| W-9 | Maintainability | **수용** — `resumeGraphAfterRetry` 7단계/`resumeFromCheckpoint` 중복. verbatim 이동, helper 추출 후속 |

INFO 처분: I-7 [SPEC-DRIFT] (`ExecutionCancelledError` → `workflow-errors.ts` leaf 이동): spec 은 class 파일 위치 미정의 → **spec 무변**(선제 순환 차단의 부산물, 정합). 기타 INFO(EngineDriver JSDoc·delegator `@see`·zombie row helper·ExecutionGraphState leaf 이동·retryAfterSec fallback 테스트 등): verbatim/후속 — c1-engine-split.md 후속 고려 또는 chain-end spec-sync.

## TEST 결과

- **lint**: 통과 — 변경 3파일 eslint 0 errors.
- **unit**: 통과 — `src/modules/execution-engine` 33 suites / **805 passed** (retry-turn spec 신설 8 + W-5/6/7 11건 포함). execution-engine 은 otplib 미의존 → 환경오염 면역.
- **build**: 통과(본 PR 범위) — execution-engine tsc 컴파일 clean(`error TS` 중 totp 외 0). 호스트 `npm run build` 의 `totp.service.ts`(otplib) 실패는 환경오염.
- **e2e**: 통과 — dockerized **34 suites / 202 tests** (RetryTurnService DI 부팅 + `ExecutionCancelledError` leaf 이동 + 4-서비스 통합, npm ci=v12 호스트 오염 면역).

## 환경 노트

**otplib v13** 공유(심링크) node_modules 오염(병렬 잡 ^13 업그레이드) — 호스트 build/full-unit 의 `auth` 부분 실패, `totp.service.ts` 미변경(본 PR diff 아님). dockerized e2e(npm ci=package-lock v12) 면역·통과. (PR2·3 RESOLUTION 동일 사유, 잔존.)

## 보류·후속 항목

- **W-1·W-3·W-4·W-9**: strangler-fig 누적 구조 정리(EngineDriver ISP 분리·엔진→서비스 방향 제거·completeRetryExecution guarded 전환·resumeGraphAfterRetry helper) — c1-engine-split.md 후속 고려.
- **체인 종료 spec-sync**: PR1–4 누적 SPEC-DRIFT/포인터/Rationale 를 **`plan/in-progress/spec-update-engine-split.md`** 로 정리 → project-planner 가 `spec/` 반영 + `/consistency-check --spec BLOCK:NO`. (developer 는 spec write 금지.)
