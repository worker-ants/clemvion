# RESOLUTION — 15_02_20

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | 5b8c1c9b | `cancelParkedExecution`: `nodeExecutionRepository.createQueryBuilder().update(NodeExecution).andWhere('status=WAITING_FOR_INPUT').execute()` 추가 — Execution CANCELLED 와 동반 NodeExecution CANCELLED 동시 마킹 |
| W2 | SPEC-DRIFT | 5b8c1c9b | `spec/5-system/4-execution-engine.md §7.4 Worker 동작` 표에 `applyCancellation async` 전환 + `cancelParkedExecution` DB-level cancel 행위 명시 (코드 옳음, spec 갱신) |
| W3 | SPEC-DRIFT | 5b8c1c9b | §Rationale 단계적 롤아웃 절에 `runNodeDispatchLoop` 반환 계약 `Promise<{ parked: boolean }>` 명시 |
| W4 | DOCUMENTATION | — | `spec/data-flow/3-execution.md` `alt 멀티턴 AI 로컬 pendingContinuations hit (잠정 fast path — PR-B2 에서 제거)` 분기가 이미 존재하고 "PR-B2 에서 제거" 단서 명시됨. multi-turn AI 가 B1 과도기에 fast-path 를 유지하므로 분기 제거는 B2 범위가 맞다 — **verified-clean (scoping context 일치)** |
| W5 | DOCUMENTATION | — | `spec/4-nodes/6-presentation/0-common.md` L415 에 이미 "Phase B 단계 주" 절이 있어 `pendingContinuations` 가 멀티턴 AI 한정이며 PR-B2 에서 재작성 예정임을 명시함 — **verified-clean** |
| W6 | CONCURRENCY | 5b8c1c9b | W1 NodeExecution 마킹으로 TOCTOU 경합 해소. `rehydrateAndResume` 는 이미 `Execution.status=WAITING_FOR_INPUT` 재검증으로 이중 실행 차단 중 — DB 정합성 완성 |
| W7 | SIDE_EFFECT | — | grep 확인: `applyCancellation` 호출 사이트는 `continuation-execution.processor.ts:102` 단 1곳, 이미 `await` 됨 — **verified-clean** |
| W8 | SIDE_EFFECT | — | grep 확인: `runNodeDispatchLoop` mock 사이트 전부 `{ parked: false }` / `{ parked: boolean }` 반환 — `mockResolvedValue(undefined)` 잔존 없음 — **verified-clean** |
| W9 | SIDE_EFFECT | 5b8c1c9b | `cancelParkedExecution` JSDoc 에 PR-B1 범위 (form/button top-level park 전용) + `finalizeRehydrationCleanup` 경합 없음 명시 |
| W10 | TESTING | 5b8c1c9b | `describe('cancelParkedExecution — durable WAITING cancel')` 블록 추가: (a) affected:1 → NodeExecution CANCELLED + emit 발생, (b) affected:0 → 멱등 no-op, (c) emit throw → warn 흡수 3케이스 |
| W11 | TESTING | 5b8c1c9b | `applyCancellation` 테스트 async 전환 + createQueryBuilder mock 준비 + DB 경로 도달 단언. 테스트명 "silent skip" → 동작 기준 갱신 |
| W12 | TESTING | 5b8c1c9b | `pendingContinuations` 항목 있으면 `rejectPending` 경로 (createQueryBuilder 미호출) 분기 테스트 추가 |
| W13 | TESTING | 5b8c1c9b | `flushResumeDrive` 기본값 40ms → 200ms (CI 고부하 sporadic false negative 해소) |
| W14 | ARCHITECTURE | 5b8c1c9b | `cancelParkedExecution` JSDoc 에 "B2/B3 분리 예정" 주석. 실제 추출은 PR-B2/B3 — **deferred (out of B1 scope, B2/B3 예정)** |
| W15 | ARCHITECTURE | 5b8c1c9b | `waitForFormSubmission` / `waitForButtonInteraction` JSDoc 에 `@param parkMode` / `@returns` / `@todo PR-B2/B3 Strategy 추출` 주석 추가. 실제 분리는 PR-B2 — **deferred (out of B1 scope)** |
| W16 | ARCHITECTURE | — | emit 실패 warn 수준은 `markExecutionCancelled` 패턴과 일치. 현행 유지 확인 — **verified-clean (scoping context: keep consistent with warn pattern)** |
| W17 | MAINTAINABILITY | 5b8c1c9b | `runNodeDispatchLoop` `@returns` JSDoc 추가. 이중 try-catch 의 optional extract (`emitCancellationEvent` 헬퍼) 는 B1 scope 밖으로 미룸 — **deferred (optional, B2/B3)** |
| W18 | MAINTAINABILITY | — | `armSlowPathResume` INFO 수준 nit. 단기 수정 대상 아님 — **deferred (INFO-level, B2/B3)** |
| W19 | PERFORMANCE | 5b8c1c9b | `firePayload` 폴링 루프 위에 PR-B2 삭제 예정 주석 추가. 실제 제거는 PR-B2 — **deferred (B2 임시 메커니즘)** |

## TEST 결과

- lint  : 통과 (eslint --max-warnings=0, prettier --check)
- unit  : 통과 (302 passed, execution-engine.service.spec.ts)
- build : 통과 (nest build)
- e2e   : 통과 (174/174, 29 suites — dockerized make e2e-test)

## 보류·후속 항목

- **W4 deferred-verified**: `data-flow/3-execution.md` fast-path `alt` 분기 — 기존 "잠정 fast path — PR-B2 에서 제거" 노트로 reconcile. B2 범위.
- **W5 deferred-verified**: `0-common.md` L415 Phase B 단계 주 존재. PR-B2 turn-단위 park 전환 시 재작성.
- **W14 deferred**: `cancelParkedExecution` → `ExecutionCancellationService` 추출 PR-B3.
- **W15 deferred**: `waitForFormSubmission`/`waitForButtonInteraction` ParkMode Strategy 분리 PR-B2.
- **W17 optional**: `emitCancellationEvent` 헬퍼 추출 PR-B2/B3.
- **W18 optional**: `armSlowPathResume` 타입 캐스팅 정리 + 폴링 루프 상수화 PR-B2.
- **W19 deferred**: `firePayload` 폴링 메커니즘 PR-B2 `pendingContinuations` 제거 시 함께 삭제.
- **INFO #4**: e2e button park-release 시나리오 — form 전용 현재. button e2e 케이스 TODO 는 PR-B2 범위.
- **INFO #6**: park → cancel → CANCELLED e2e 케이스 — NodeExecution terminal 정책 확정 후 (B1 fix 로 정책 확정됨). e2e 추가는 PR-B2.
