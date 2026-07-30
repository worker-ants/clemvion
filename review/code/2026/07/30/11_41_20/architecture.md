# Architecture Review — retry_last_turn 재진입 원자 claim

대상 diff: `b351731f0`(조건부 UPDATE claim 도입) + `414550a1d`(claim 삽입 위치 결함 2건 수정)
리뷰 파일: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`

## 발견사항

- **[WARNING]** 재진입 절차 docstring 이 이미 제거된 `runAiConversationLoop` 를 여전히 협력 컴포넌트로 서술 — 실제 turn-park 패턴(`processAiResumeTurn`)과 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:272-273` (`applyRetryLastTurn` 재진입 절차 6번 항목), 동일 문제가 `:122-123`(`retryLastTurn` "재진입 구현 완료" 단락)에도 있음
  - 상세: `applyRetryLastTurn` 의 재진입 절차 docstring 6번 항목은 "`runAiConversationLoop` 를 마지막 user message replay 로 구동"이라고 서술하지만, 실제 구현(`:443`)은 `this.aiTurnOrchestrator.processAiResumeTurn(...)` 을 호출한다. 바로 그 호출부 위 인라인 주석(`:438-439`, "exec-park D6 full B3")이 "옛 `runAiConversationLoop(initialAction)` 장수 루프 replay 를 turn-park 모델의 단발 처리기로 이관한다"고 명시하며, `ai-turn-orchestrator.service.ts:186` 도 "옛 in-memory 장수 루프(runAiConversationLoop)는 제거됐다"고 재확인해준다 — 즉 `runAiConversationLoop` 는 코드베이스에 더 이상 존재하지 않는 메서드다. 같은 클래스의 `retryLastTurn` docstring(`:122-123`)도 동일한 stale 참조를 갖고 있다. 이번 diff 가 정확히 `:272-273` 줄을 편집(항목 번호 재부여: 2→3, 5→6 등)했음에도 문구 자체는 고치지 않아, "제거된" 협력 컴포넌트를 "현재 협력 컴포넌트"로 서술하는 자기모순이 같은 메서드 본문 안(주석 `:438-439`)과 자매 파일(`ai-turn-orchestrator.service.ts:186`) 양쪽에 이미 명시된 채로 diff 이후에도 남았다. 아키텍처 review 관점에서, 이 JSDoc 은 재진입의 실제 협력 패턴(장수 loop 재구동이 아니라 turn-park 단발 처리 + `PARK_RELEASED` re-park)을 잘못 전달해 향후 유지보수자가 재진입 메커니즘의 설계를 오해할 위험이 있다.
  - 제안: `:122-123`, `:272-273` 두 곳 모두 `runAiConversationLoop` → `processAiResumeTurn`(및 `PARK_RELEASED` 시 re-park 흐름)으로 갱신.

- **[WARNING]** `claimSpawnedRetryRow` 의 in-memory 동기화 계약이 구조적으로 강제되지 않고 프로즈 규약에만 의존
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:520-534`(`claimSpawnedRetryRow` 정의) / 호출부 `:324`(claim 호출), `:337-348`(방어 분기), `:356`(동기화 `delete`)
  - 상세: `claimSpawnedRetryRow` 는 DB 의 `input_data` 에서만 `_retryState` 키를 원자 제거하며, in-memory `spawnedRow.inputData` 의 동기화는 JSDoc `@returns` 산문 계약("caller 는 in-memory `spawnedRow.inputData` 도 함께 동기화해야 한다")과 호출부의 단일 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 문장(`:356`)에 전적으로 의존한다. 정확히 이 결함 클래스(claim 이 지운 키를 stale in-memory 엔티티의 후속 `save()` 가 되살림)가 직전 라운드 CRITICAL #2(2026-07-28)였고, 이번 diff 는 그 한 줄을 claim 성공 판정 직후·모든 하위 `save()` 호출 이전에 정확히 배치해 올바르게 고쳤다(코드 대조로 확인). 다만 이 불변식은 여전히 "이 줄을 지우거나 순서를 바꾸지 말 것"이라는 코드 관례로만 지탱되고 타입 시스템/캡슐화로 강제되지 않는다 — 향후 편집이 claim 성공과 `delete` 사이에 새 로직을 끼워 넣거나 두 문장의 순서를 바꾸면 동일 결함이 조용히 재발할 수 있다. 이미 한 번 발생한 결함 클래스라는 점에서 재발 방지를 구조적으로(계약이 아니라 타입/캡슐화로) 다지는 편이 안전하다.
  - 제안: `claimSpawnedRetryRow` 가 `spawnedRow`(또는 그 `inputData`)를 인자로 받아 성공 시 직접 mutate 하거나, `{ claimed: boolean; retryState?: RetryState }` 형태로 이미 동기화된 결과를 반환해 "동기화를 잊는" 호출 경로 자체를 구조적으로 제거하는 방안을 고려.

- **[INFO]** (이월, 이번 diff 범위 밖 — 비차단) 생성자 forwardRef 근거 주석이 C-1 후속④ 배선과 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:88-90`
  - 상세: `@Inject(forwardRef(() => AiTurnOrchestrator))` 위 주석 "orchestrator 가 ENGINE_DRIVER(=엔진) 를 주입받고 엔진은 본 서비스를 주입받으므로 transitive 순환 DI"는, 클래스 상단 docstring(`:61-64`, "C-1 후속 ④ … engine→Retry 역방향 주입을 없애 … 단방향(Retry→engine)으로 정리")과 `execution-engine.service.ts:764-765`("C-1 후속 ④ — RetryTurnService 역방향 주입 제거")가 함께 서술하는 현재 배선과 어긋난다. 직접 grep 재확인 결과 `ExecutionEngineService` 생성자는 더 이상 `RetryTurnService` 를 주입받지 않고(`continuation-execution.processor.ts` 만 주입), `AiTurnOrchestrator` 생성자도 `RetryTurnService` 를 주입받지 않아, 현재 provider 그래프상 `RetryTurnService → AiTurnOrchestrator` 로 되돌아오는 edge 는 보이지 않는다. 이 항목은 `review/code/2026/07/28/20_32_57/SUMMARY.md` #8 이 이미 "diff 범위 밖, 사전 존재"로 low-severity 이월 처리한 것과 동일 지적이며, 이번 두 커밋의 diff 에도 포함되지 않아 여전히 미반영이다 — 새로 발생한 문제가 아니라 재확인 차원의 기록.
  - 제안: (이전 라운드 제안과 동일) 주석을 현재 배선에 맞게 갱신하거나, forwardRef 가 실제로 필요한 다른 근거(있다면)로 교체.

- **[INFO]** JSONB 원자 conditional-consume 패턴이 클래스 내 두 곳에 유사 형태로 존재
  - 위치: `retryLastTurn` 트랜잭션 내 consume(`:204-224`, 특히 `:208-217`) vs `claimSpawnedRetryRow`(`:520-534`)
  - 상세: 두 곳 모두 "JSONB 키 원자 제거 + `jsonb_exists` 가드" 형태의 conditional UPDATE 를 반복 구현한다(키 리터럴 자체는 `RETRY_STATE_KEY` 상수로 이미 통합돼 이전 WARNING #3 은 해소 확인됨, `:42`). 컬럼(`output_data` vs `input_data`)과 트랜잭션 필요 여부(전자는 spawn 과 원자 동반이라 트랜잭션 필수, 후자는 단독 UPDATE)가 달라 완전한 통합은 간단하지 않지만, 공통 "conditional key-removal" 헬퍼로 추출할 여지는 있다. 다만 이 파일은 이미 유사한 다른 중복(`resumeGraphAfterRetry`/`resumeFromCheckpoint` traversal loop, `:739-741` "PR2 scope creep 회피" 주석)을 의도적으로 후속 이연한 전례가 있어, 같은 기준을 적용하면 이번 항목도 즉시 조치 대상이라기보다 저-우선 순위 후속 후보로 판단된다.
  - 제안: 즉시 조치 불필요. 3번째 JSONB conditional-consume 사례가 추가되면 공통 헬퍼 추출을 고려.

## 확인된 정상 사항 (참고)

- 직전 라운드(`review/code/2026/07/28/20_32_57`) CRITICAL #1(손상 판정이 claim 보다 먼저 실행돼 정상적인 "이미 다른 delivery 가 claim 함" 상태를 오판) — claim 호출(`:324`)이 구 "`_retryState` 부재→FAILED" 판정보다 앞으로 이동했고 그 판정 분기 자체가 로그-only discard(`:337-348`)로 교체돼 코드 대조로 해소 확인.
- CRITICAL #2(claim 이 지운 `_retryState` 가 stale in-memory `save()` 로 부활) — `delete spawnedRow.inputData[RETRY_STATE_KEY]`(`:356`)가 claim 성공 판정 직후·모든 하위 `save()` 호출 이전에 정확히 배치돼 해소 확인.
- WARNING #3(JSONB 키 리터럴 4중 중복) — `RETRY_STATE_KEY` 상수(`:42`) 도입 후 전체 코드 사용처(`:160,202,210,217,313,356,526,531`) 가 리터럴 없이 상수만 참조하도록 통일됨을 grep 으로 확인.
- `RetryEngineDriver` ISP 경계 — 신규 private helper(`claimSpawnedRetryRow`)가 driver 표면을 확장하지 않고 서비스 내부에 완전히 캡슐화됨. 신규 cross-module import 도 없어 이번 diff 자체가 새로운 순환 의존성을 만들지 않음.
- 테스트(`retry-turn.service.spec.ts`) — 두 CRITICAL 각각에 정확히 대응하는 회귀 테스트를 추가(`(b2)`/`(b3)`/`(c)` 재작성/"claim 성공 후 try 진입 전 구간 예외" 케이스 포함), claim 성공 후 BullMQ 재배달 시나리오까지 구체적으로 고정해 이번 변경의 구조적 견고성을 뒷받침.

## 요약

이번 diff(`b351731f0`+`414550a1d`)는 `RetryTurnService.applyRetryLastTurn` 의 재진입 가드를 read-then-branch 에서 조건부 UPDATE 기반 원자 claim(`claimSpawnedRetryRow`)으로 교체하고, 직전 라운드의 CRITICAL #1(손상 판정이 claim 보다 먼저 실행돼 살아있는 delivery 를 오판)·CRITICAL #2(claim 이 지운 키가 stale in-memory `save()` 로 부활)를 코드 대조 결과 정확한 위치(순서 재배치 + 단일 `delete` 삽입)로 올바르게 닫았다. `RETRY_STATE_KEY` 상수 도입으로 이전 리터럴 중복 WARNING 도 함께 해소됐고, `RetryEngineDriver` ISP 경계는 그대로 유지되며 새로운 순환 의존성도 없다. 남은 발견은 모두 비차단 성격이다 — (1) 재진입 절차 docstring 두 곳이 이미 제거된 `runAiConversationLoop` 를 여전히 협력 대상으로 서술해 실제 turn-park 패턴과 어긋나고 이번 diff 가 해당 줄을 직접 편집하고도 고치지 않았다, (2) claim↔in-memory 동기화 불변식이 구조적 강제 없이 주석/관례로만 지탱돼 동일 결함 클래스의 재발 가능성이 남아 있다, (3)(이월, diff 범위 밖) 생성자의 forwardRef 근거 주석이 C-1 후속④ 이후 실제 배선과 어긋난다는 지난 라운드 지적이 여전히 미반영이다. 이번 변경 자체의 아키텍처 건전성은 양호하다.

## 위험도

LOW
