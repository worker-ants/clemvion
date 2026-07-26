# 테스트(Testing) 리뷰 — linear-cancel-mechanism (2026-07-26 13:47:42)

본 라운드는 `review/code/2026/07/26/12_55_55/RESOLUTION.md` 가 주장한 mutation 검증 4건을
**직접 재실측**하는 데 우선순위를 두었다. 결론부터: **4건 전부 주장과 정확히 일치**(과장·축소
없음). 이어서 신규 테스트(특히 스로틀의 `Date.now()` spy)가 vacuous 하지 않은지 별도로 실측했고,
그 과정에서 이번 라운드가 다루지 않은 **신규 커버리지 갭 2건**(WARNING)을 발견했다.

원복은 전 구간 `cp` 백업 → 대상 파일 덮어쓰기 → `diff` 로 완전 일치 확인 방식으로 수행했다
(`git checkout` 미사용). 백업 위치: 세션 scratchpad `mutation-backup/`. 재실측 종료 후
`git status --short` = `review/code/2026/07/26/13_47_42/` 신규 파일만 남고 `git diff --stat` 무변경 확인.

## 1. RESOLUTION mutation 주장 4건 직접 재실측

| # | 대상 | 조작 | 재실측 결과 | RESOLUTION 주장 | 판정 |
|---|---|---|---|---|---|
| 1 | C5 | `parallel-executor.ts:273-284` cancellation bypass 블록(`const cancellation = failures.find(...); if (cancellation) throw cancellation.error;`) 제거 | `parallel-executor.spec.ts` **4 failed**, 23 passed / 27 total | "4 tests failed" | **일치** |
| 2 | W9 | `execution-engine.service.ts` `runContainer` catch 상단의 `if (err instanceof ExecutionCancelledError) throw err;` 제거 | "Container runtime" describe 재실행 → **1 failed**(W9 신규 테스트, `foreachSaves.some(...FAILED)` 기대값 `false` 에 `true` 수신) | "1 test failed" | **일치** |
| 3 | W10 | `executeContainerBody` 호출부(`execution-engine.service.ts:6515`)의 `{ throttle: true }` 제거 | **1 failed**(`findOne` 호출 11회 ≥ itemCount 10) | "1 test failed(findOne 11회)" | **일치** |
| 4 | W11(=C4 배선) | `finalizeCancelledExecution`(`:4568-4581`)의 `updateExecutionStatus(...)` guarded UPDATE 를 옛 `savedExecution.status = CANCELLED; await this.executionRepository.save(savedExecution);` 로 되돌림 | **1 failed**(W11 신규 테스트 assertion (a) — guarded UPDATE 호출 자체가 `'cancelled'` 파라미터로 관측되지 않음) | "1 test failed(guarded UPDATE 미관측)" | **일치** |

각 조작 후 즉시 `cp` 로 원복하고 `diff` 로 바이트 단위 일치를 확인했으며, 4건 전부 원복 후 관련
스펙(`parallel-executor.spec.ts` · `execution-engine.service.spec.ts` · `foreach-executor.spec.ts` ·
`workflow.handler.spec.ts`, 총 507 tests) 을 재실행해 507/507 GREEN 을 재확인했다. RESOLUTION 의
mutation 주장은 과장·왜곡 없이 실측과 정확히 일치한다 — 이 4개 회귀 테스트는 각각 대응하는 가드가
없으면 결정적으로 RED 가 된다.

## 2. 스로틀 테스트의 `Date.now()` spy — vacuous 여부 실측

**결론: vacuous 아님. spy 는 실제 동작을 검증하는 데 load-bearing 하다.**

- `execution-engine.service.spec.ts:10006`(C3)·`:10110`(W9) 두 테스트는 `jest.spyOn(Date, 'now')`
  로 `simulatedNow` 를 제어하고, 아이템 0 처리 완료 시점에 `simulatedNow += 300`(스로틀 창 250ms 를
  실제로 넘김)을 실행한다. 이 advance 를 주석 처리해 재실행한 결과 — **두 테스트 모두 RED 로
  전환**(`bodyCalls` 기대값 `1` 에 실측 `3`: 스로틀이 "취소 관측"을 실제로 가려 남은 아이템까지
  전부 dispatch 됨). 이는 스로틀이 실전에서 취소 관측을 지연시킬 수 있다는 프로덕션 동작을
  정확히 재현한 것이고, spy 의 시간 조작 없이는 이 두 회귀 테스트가 (연속 실행 시 실제 경과
  시간이 250ms 미만이라) 서로 다른 이유로 우연히 통과했을 것임을 뜻한다 — spy 가 없으면 오히려
  **거짓 GREEN**(vacuous 위험이 반대 방향으로 존재)이었을 것이다.
- W10 테스트(`:10224`, "짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다")는
  `Date.now()` 를 mock 하지 않고 실제 wall-clock 에 의존한다. 임시 계측으로 실측한 결과 아이템
  10개에 대해 `findOne` 호출은 **2회**(최초 top-level 노드-경계 1회 + 스로틀 최초 미스 1회) —
  스로틀이 없으면 11회(위 mutation 결과)까지 치솟는 것과 대비되는 뚜렷한 신호이며, `toBeLessThan
  (itemCount)` 단언이 근소한 차이(예: 9 vs 10)로 우연히 통과하는 구조가 아님을 확인했다.

## 발견사항

- **[WARNING]** `containerCancelCheckedAtMs`(W10 스로틀 상태 Map) 의 누수 방지 정리 로직에
  회귀 테스트가 전혀 없다 — 두 정리 지점을 모두 제거해도 전체 스위트가 그대로 GREEN.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeRehydrationCleanup`(4568 인근이 아니라 별도 메서드 — `this.containerCancelCheckedAtMs.delete(executionId)` 호출부) 및 `runExecution` catch/finally 세그먼트의 동일 호출부. 실측 시점 기준 실제 줄 번호는 각각 함수 `finalizeRehydrationCleanup` 본문 마지막 줄, `runExecution` 의 `finally` 블록 마지막 줄(둘 다 W10 주석 "containerCancelCheckedAtMs(컨테이너 아이템 경계 cancel 스로틀 상태) 도 함께 정리해 executionId 별 누수를 막는다" 바로 아래).
  - 상세: 두 `.delete(executionId)` 호출을 모두 제거하고 `execution-engine.service.spec.ts` 전체(415 tests)를 재실행한 결과 **415/415 GREEN** — 이 정리 로직이 없어도 어떤 기존 테스트도 실패하지 않는다. `containerCancelCheckedAtMs` 는 서비스 인스턴스 수명 동안 유지되는 `Map`(싱글턴 서비스 필드)이라, 이 정리가 실제로 빠지면 컨테이너를 가진 실행이 누적될수록 `executionId` 키가 무한정 쌓이는 메모리 누수가 된다 — 정확히 이 PR(W10)이 스스로 명시한 위험이다.
  - 제안: `finalizeRehydrationCleanup`/`runExecution` 종료 후 (private 필드를 `as unknown as { containerCancelCheckedAtMs: Map<string, number> }` 캐스팅하는 이 파일의 기존 관행 — 예: `CycleSubject`/`MetricsSubject` 패턴 — 을 재사용해) "컨테이너를 포함한 실행이 종료되면 해당 executionId 키가 Map 에서 제거된다"를 직접 단언하는 회귀 테스트를 추가할 것.

- **[WARNING]** `LoopExecutor` 는 ForEachExecutor(C3)·ParallelExecutor(C5) 와 대칭적으로 "코드
  변경 불요"로 처리됐으나, 그 주장을 고정하는 회귀 테스트가 없고 **전용 spec 파일 자체가 존재하지
  않는다**(`loop-executor.spec.ts` 부재 — `find src -iname "loop-executor*"` 결과 소스 파일 1개뿐).
  - 위치: `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts:76-80` (§2.3 주석 — "unlike ForEachExecutor, this loop has no per-iteration try/catch... no explicit rethrow needed here").
  - 상세: 코드를 직접 읽어 주석의 주장(반복문 안에 `executeBody` 를 감싸는 catch 가 없고, `finally` 는 `loopContext` 복원만 하므로 `ExecutionCancelledError` 가 그대로 관통한다)은 **사실과 일치함을 확인**했다 — 이 자체는 오류가 아니다. 다만 ForEachExecutor·ParallelExecutor 는 각각 `describe.each` 로 정책별(`stop`/`skip`/`continue`, `stop`/`continue`/`cancel-others-on-fail`) 회귀 테스트를 받아 향후 리팩터링이 이 불변식을 깨면 결정적으로 RED 가 되도록 고정됐지만, LoopExecutor 는 코드 인용만으로 남아 있다. `LoopExecutor` 에 향후 `breakCondition` 평가 실패 처리나 유사 정책이 추가되며 실수로 catch 블록이 생기면, 이 회귀를 잡아줄 테스트가 없다.
  - 제안: 최소한 `execution-engine.service.spec.ts` 의 "Container runtime" describe 에 Loop 버전의 C3-대칭 테스트("아이템 경계가 아니라 iteration 경계에서 외부 cancel 관측 시 남은 iteration 은 dispatch 되지 않는다")를 1건 추가하거나, 신규 `loop-executor.spec.ts` 를 만들어 `LoopExecutor.execute` 에 직접 `executeBody` 가 `ExecutionCancelledError` 를 던지는 케이스를 단위 테스트로 고정할 것.

- **[INFO]** `jest.spyOn(Date, 'now')` 정리가 `try/finally` 가 아니라 테스트 마지막 줄의 trailing `nowSpy.mockRestore()` 로만 되어 있어(C3/W9 두 테스트, `execution-engine.service.spec.ts:10015-10017`·`:10115-10117`, `:10100`·`:10214`), 그 이전 assertion 이 throw 하면 spy 가 이후 테스트로 누수된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — C3 테스트(약 10006-10101줄) · W9 테스트(약 10110-10215줄).
  - 상세: 실측을 위해 C3 테스트의 첫 assertion(`expect(bodyCalls).toBe(1)`)을 일부러 실패하도록 바꿔(`toBe(999)`) `mockRestore()` 이전에 throw 하도록 만든 뒤 파일 전체(415 tests)를 재실행했다 — **실패는 그 1건뿐, 나머지 414건은 영향 없이 GREEN**이었다(cascading 없음). 즉 현재 시점에는 실질적 위험이 관측되지 않는다. 다만 이는 이 파일 전역에 `restoreMocks`/`clearMocks` 설정(`jest.config.ts` 미설정 확인)이 없는 상태에서 우연히 무해했을 뿐이고, 같은 파일의 다른 곳(`ws-rate-limiter.service.spec.ts`)도 동일한 trailing-restore 관행을 쓰는 반면 `llm.service.spec.ts:695-708` 은 `try/finally` 를 쓴다 — 코드베이스 내에서도 관행이 혼재한다.
  - 제안: 필수는 아니나(실측상 현재 무해), 견고성을 위해 `try { ... } finally { nowSpy.mockRestore(); }` 로 감싸는 편이 향후 assertion 추가/재배치 시 누수 재발을 원천 차단한다.

- **[INFO]** `ExecutionCancelledError` 생성자의 신규 optional `message` 파라미터(기본값 유지 동작)를 직접 단언하는 단위 테스트가 없다(`workflow-errors.spec.ts` 에 `ExecutionCancelledError` 관련 테스트 자체가 없음). 다만 JSDoc·구현이 명시하듯 분류는 전부 `instanceof` 기반이라 메시지 텍스트가 어떤 분기에도 영향을 주지 않으므로(실측: `runContainer`/`finalizeCancelledExecution`/`WorkflowHandler`/`ForEachExecutor`/`ParallelExecutor` catch 전부 `instanceof ExecutionCancelledError` 만 검사) 위험은 낮다. 여유가 되면 "no-arg 생성 시 기존 park 문구 유지"를 1줄 단언으로 고정하는 것을 권장.

## 요약

이번 라운드의 최우선 검증 대상이던 `review/code/2026/07/26/12_55_55/RESOLUTION.md` mutation
주장 4건(C5/W9/W10/W11-C4배선)은 전부 `cp` 기반 직접 재실측으로 **정확히 일치**함을 확인했다 —
과장·누락 없음. 신규 스로틀 회귀 테스트의 `Date.now()` spy 도 실측 결과 vacuous 하지 않고, 오히려
spy 없이는 이 테스트들이 (연속 실행 시 실제 경과 시간이 짧다는 우연) 다른 이유로 거짓 통과했을
것임을 확인했다. 다만 이번 조사 과정에서 이번 라운드의 SUMMARY 에는 없던 신규 커버리지 갭 2건을
발견했다 — (1) W10 스로틀 상태 Map(`containerCancelCheckedAtMs`) 의 누수 방지 정리 로직이 mutation
검증에서 커버리지 0(양쪽 정리 지점 모두 제거해도 415/415 GREEN), (2) `LoopExecutor` 는 ForEach/
Parallel 과 대칭적으로 "코드 변경 불요"라는 주장이 코드 검토로는 사실이나 이를 고정하는 회귀
테스트·전용 spec 파일 자체가 없다. 두 항목 모두 현재 활성 버그는 아니며 향후 리팩터링에 대한
방어선 부재(회귀 조용히 재발 가능)라는 성격의 WARNING이다. 추가로 `Date.now()` spy 정리 패턴과
`ExecutionCancelledError` 기본 메시지 미검증은 INFO 수준으로, 즉시 조치가 필요하지는 않다.

## 위험도

LOW
