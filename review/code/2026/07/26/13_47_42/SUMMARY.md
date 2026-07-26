# Code Review 통합 보고서 (3R — 2R 조치 검증)

## 전체 위험도

**MEDIUM** — **Critical 0**. 2R 의 CRITICAL C5 를 포함해 W9~W13 전건이 **실측으로 해소 확인**됐다(testing 이 RESOLUTION 의 mutation 주장 4건을 독립 재실측해 전부 일치 확인). 잔여는 WARNING 5건으로, 대부분 **이번 라운드가 새로 도입한 스로틀의 부산물**이거나 같은 결함 클래스의 미방어 잔존 경로다.

## 2R 항목 검증 결과 — 전건 해소

| 항목 | 결과 | 근거 |
|---|---|---|
| **C5** `ParallelExecutor 'continue'` 취소 흡수 | **해소** | `parallel-executor.ts:273-284` 에서 `errorPolicy` 분기 **이전** 무조건 우회 재throw. `describe.each` 3정책 × 2케이스 회귀 6건. requirement·testing 확인 |
| W9 `runContainer` FAILED 오분류 | **해소** | `:7574-7576` 재throw 가 FAILED 마킹·`NODE_FAILED` emit 보다 앞. `save`/`emitNode` 인자 단언 테스트. security·side_effect 확인 |
| W10 아이템 경계 비용 | **해소** | 250ms 시간 스로틀. performance 정량 확인 — 조회 횟수가 **N 과 독립**(`≈ ceil(실행시간/250)+1`), 1만 건 기준 10,000회 → ~200회(빠른 아이템이면 1회) |
| W11 C4 배선 커버리지 | **해소** | 0행 매칭 시뮬레이션 테스트. mutation RED 확인 |
| W12 8줄 블록 2중 복제 | **해소** | `finalizeCancelledExecution` 헬퍼. 자매 `finalizeFailedExecution` 과 네이밍 일관 |
| W13 "단일 컬럼" 문구 | **해소** | JSDoc·CHANGELOG 모두 "id/status 2컬럼" 으로 정정 |

> **mutation 주장 독립 재실측(testing)**: C5 제거→4 failed / W9 제거→1 failed / `{throttle:true}` 제거→1 failed(findOne 11회) / C4 배선 되돌림→1 failed. **RESOLUTION 주장과 전부 정확히 일치**(과장·왜곡 없음). 스로틀 테스트의 `Date.now()` spy 도 load-bearing 확인(advance 제거 시 RED).

## Critical 발견사항

**없음.**

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W14 | concurrency · side_effect (**2명 수렴**) | **스로틀 Map 이 Background 경로에서 누수된다.** `containerCancelCheckedAtMs` 정리는 `finalizeRehydrationCleanup`·`runExecution` finally 두 곳뿐인데, `executeBackgroundSubgraph` 는 **부모와 같은 `executionId`** 를 공유하면서 `executeInline`→컨테이너 경로로 같은 키에 `set()` 한다. Background 는 fire-and-forget 이라 부모 finally 가 **먼저** 지운 뒤에 다시 set 되고 이후 아무도 지우지 않는다. spec `12-background.md:326` 이 "본문이 Loop/ForEach 포함 가능" 을 명시해 실사용 조합. 싱글턴 서비스 필드라 **무한 성장 누수**이며 코드 자신의 "누수 방지" 주장을 반증 | `execution-engine.service.ts:6930-6934`(`executeBackgroundSubgraph` finally — delete 없음) · 정리 지점 `:2670`·`:4544` | finally 에 `this.containerCancelCheckedAtMs.delete(job.executionId)` 추가 + 회귀 테스트 |
| W15 | security | **`executeNode` 의 generic catch 가 `ExecutionCancelledError` 를 분류하지 않는다** — W9 와 **동형 결함**이 Sub-Workflow 노드 경로에 잔존. `workflow.handler.ts` 의 C1 재throw 가 `executeNode` try 안에서 발생하므로 이 catch 로 떨어져, 기본 `stop_workflow` 정책에서 `nodeExecution.error = {message}` 저장 + `NODE_FAILED` 를 `error: err.message`(executionId 포함)로 WS emit 한다. `isAbortError`·`ParkReleaseSignal` 분기만 있고 취소 분기가 없다. RESOLUTION 의 mutation 7지점에도 미포함 | `execution-engine.service.ts:5758`(catch), `:5878-5905`(stop 분기) | `ParkReleaseSignal` 과 대칭으로 `if (err instanceof ExecutionCancelledError) throw err;` 추가 + 정상 그래프 dispatch 경로 회귀 테스트 |
| W16 | security | `RetryTurnService.failRetryExecution` 이 취소여도 `execution.error = {message}` 를 **무조건** 저장 → REST `GET /executions/:id` 로 내부 message 노출. WS emit 은 `isCancelled` 일 때 `error` 를 제외해 이미 안전한데 DB 저장만 분기가 없다. `finalizeCancelledExecution`(취소 시 error 를 비움)과도 불일치 | `retry-turn.service.ts:642`(판정) vs `:646-647`(무조건 대입) | `!isCancelled` 조건으로 감싸고 `execution.error` 자체를 단언하는 테스트 추가 |
| W17 | requirement | **W10 스로틀 회귀 테스트가 wall-clock `Date.now()` 에 의존해 flaky.** 자매 테스트(C3 `:10006`)는 `jest.spyOn(Date,'now')` 로 시각을 통제하는데 이 테스트만 누락. **실측: 415 테스트 40회 반복 중 3회 flake**, 그중 1회는 `findOne` 11회 — **스로틀이 아예 없을 때(mutation)와 수치적으로 구분 불가능한 실패 시그니처** | `execution-engine.service.spec.ts:10224`(단언 `:10290`) | C3 와 동일하게 `Date.now` spy 로 창을 결정적으로 고정 |
| W18 | testing | **스로틀 Map 정리 로직에 회귀 커버리지 0** — 두 `delete` 를 **모두 제거해도 415/415 GREEN**(실측). W14 가 지적한 실제 누수를 잡을 방어선이 없다. 부수적으로 `LoopExecutor` 는 "코드 변경 불요" 판단이 맞음을 코드로 확인했으나 이를 고정하는 테스트·spec 파일이 없다(ForEach·Parallel 은 `describe.each` 로 고정됨) | `execution-engine.service.ts:2670`·`:4544` / `containers/loop-executor.ts:76-80` | 실행 종료 후 Map 키 제거를 단언하는 테스트 + Loop 대칭 취소 테스트 |

## 참고 (INFO)

- plan `node-cancellation-residual-signal-propagation.md:177-178` 이 "best-effort" 근거로 §5 를 인용하나 실제 문구는 **§2.2** 에 있다. 결론은 정책과 일치하나 인용 오류 — 이 브랜치에서 "인용이 실체와 어긋난다" 패턴의 **3번째 재발**(W1→W13→이번).
- CHANGELOG·테스트 주석이 스로틀을 "(200~300ms)" 로만 표기해 실채택 250ms 를 명시하지 않음(JSDoc·plan 은 정확히 분리 기재).
- 스로틀은 시간 상한이지 **아이템 개수 상한이 아니다** — 순수 계산 본문처럼 아이템이 sub-ms 면 250ms 안에 다수 아이템이 dispatch 될 수 있다(§5 best-effort 상 수용 가능).
- `opts?.throttle` 조건 2회 반복 평가 / `Date.now` spy 를 `try/finally` 아닌 trailing `mockRestore()` 로 정리 / `ExecutionCancelledError` message 인자 전용 테스트 부재 — 전부 저위험.
- `ParallelExecutor` `'stop'` 의 `failures[0]` branch-index 우선순위 레이스(2R INFO 그대로), `runParallel` 이 `failures` 미소비 — 백로그 기록됨.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | MEDIUM | W9 해소 확인. 동형 잔존 2건(W15 `executeNode`, W16 retry-turn) |
| concurrency | MEDIUM | 스로틀 설계·경합은 안전. W14 Background 누수 |
| side_effect | LOW | W9 해소 확인. W14 독립 수렴 |
| requirement | LOW | **C5 해소 확인**. W17 테스트 flakiness 실측 |
| testing | LOW | **RESOLUTION mutation 주장 4건 전부 재실측 일치**. W18 커버리지 갭 |
| documentation | LOW | W13 해소 확인. §5/§2.2 인용 오류 |
| maintainability | LOW | W12 해소 확인. 스로틀 복잡도 수용 가능 |
| performance | NONE | **W10 정량 해소 확인** — 조회 횟수가 N 과 독립 |
| scope | NONE | 3라운드 확장 전부 "원 커밋 계약의 완성". 권한 밖·별규모는 일관되게 위임/백로그 분리 |

## 권장 조치사항

1. **W14** — `executeBackgroundSubgraph` finally 에 Map delete 추가.
2. **W15** — `executeNode` catch 에 취소 재throw 분기(W9 와 대칭).
3. **W16** — retry-turn 의 `execution.error` 대입을 `!isCancelled` 로 가드.
4. **W17** — 스로틀 테스트를 `Date.now` spy 로 결정화(현재 flaky 실측).
5. **W18** — Map 정리 회귀 테스트 + Loop 대칭 테스트.
6. INFO — §5→§2.2 인용 정정, 250ms 명시.

## 라우터 결정

- **실행 9명**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (강제 7명 전원 포함)
- **제외 5명**: architecture · dependency · database(2R NONE, 쿼리는 스로틀로 감소 방향) · api_contract · user_guide_sync
