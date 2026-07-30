# 부작용(Side Effect) 리뷰 — retry_last_turn 2차 claim (조건부 UPDATE 교체)

리뷰 대상:
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`

diff 범위(`git diff origin/main...HEAD`)를 직접 확인하고, 게이트 숫자는 실제
소스 파일(`Read`)과 대조해 검증했다. 이 변경은 `applyRetryLastTurn` 재진입의
비원자(read-then-branch) 가드를 `claimSpawnedRetryRow` 조건부 UPDATE(원자
claim)로 교체하는 것이 핵심이며, 이미 여러 라운드(5R/6R/7R)의 ai-review 를
거쳐 다듬어진 코드다. 아래는 "부작용" 관점에서의 잔여 관찰 사항이다 — 모두
설계상 의도된 것으로 확인됐고 신규 미인지 결함은 발견되지 않았다.

## 발견사항

- **[INFO]** 신규 원자 claim(DB 쓰기)이 존재성 검증보다 먼저 실행되도록 재정렬됨 — 의도된 순서, null-safety 확인 완료
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:331`(`claimSpawnedRetryRow` 호출), `:369`(`delete spawnedRow.inputData[RETRY_STATE_KEY]`), `:538-551`(`claimSpawnedRetryRow` 구현)
  - 상세: `applyRetryLastTurn`의 첫 상태변경 연산이 이제 `execution`/`node` 존재 검증(`:373` `Promise.all`)보다 앞선 DB UPDATE(`claimSpawnedRetryRow` — `input_data` JSONB 키 원자 제거)가 됐다. claim 성공 직후 in-memory `spawnedRow.inputData`에서도 동일 키를 즉시 `delete`해(`:369`) DB와 동기화하므로, 이후 `execution`/`node` 부재로 FAILED 마킹 + `save(spawnedRow)`(`:381-386`, `:393-398`)가 일어나도 TypeORM 의 stale jsonb diff 가 방금 지운 키를 부활시키지 않는다(과거 CRITICAL #2 재발 방지). `NodeExecution.inputData` 컬럼은 `nullable` 이 아니라 `@Column({ type: 'jsonb', default: {} })`(`node-execution.entity.ts:69`)이므로, claim 성공 경로에서 `spawnedRow.inputData`가 `null`이 되는 경우가 구조적으로 없어 `:369`의 무가드 `delete`(앞서 `:319`의 `?? {}` 패턴과 달리 방어 없음)가 런타임에서 `TypeError`를 낼 가능성도 없음을 확인했다.
  - 제안: 조치 불요 — 순서·null-safety 불변식은 이미 회귀 테스트(`(b2)`, `(b3)`, `(c)`, `(f)`, "claim 성공 후 try 진입 전" 케이스, `retry-turn.service.spec.ts`)로 잠겨 있다.

- **[INFO]** `NODE_STARTED` WS 이벤트 `input` payload 조용한 변경 — `_retryState` 더 이상 미노출 (의도됨·테스트로 고정·알려진 소비자 없음)
  - 위치: `retry-turn.service.ts:369`(delete 시점 재배치)가 동일 함수 하단 `this.eventEmitter.emitNode(...)` 호출의 `input: spawnedRow.inputData` 필드에 반영됨
  - 상세: claim 직후로 `delete`가 당겨지면서, 이 delivery 가 발행하는 `NODE_STARTED` 이벤트의 `input` 필드가 이전엔 `_retryState`를 포함했으나 이제는 포함하지 않는다. 코드 자체가 "internal 필드 비노출 원칙과 부합하는 의도된 변경"이라 명시하고(`:364-368` 주석), `retry-turn.service.spec.ts`에 회귀 테스트("NODE_STARTED emit 의 input payload 는 _retryState 를 포함하지 않는다 (W6)")로 고정했다. `spec/5-system/6-websocket-protocol.md` §4.2 의 `execution.node.started` 이벤트 표(182행)는 애초에 `input` 필드를 문서화된 계약에 포함하지 않아 formal contract 위반은 아니다. frontend 에서 WS payload 의 `_retryState` 를 실제로 read 하는 코드가 있는지 확인했으나 JSDoc 언급(`use-execution-interaction-commands.ts:110`, `conversation-utils.ts:44`) 뿐이고 런타임 프로퍼티 접근은 없음 — 알려진 소비자 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 이미 plan 에 추적 중인 잔여 side effect — claim 성공~try 진입 전 크래시 시 RUNNING orphan row 잔류
  - 위치: `retry-turn.service.ts:538-551`(`claimSpawnedRetryRow` JSDoc, "알려진 백스톱 갭" 문단)
  - 상세: claim 이 성공한 직후(`:369` delete)부터 `try` 블록(`:452` 부근) 진입 전 구간(execution/node lookup, `rehydrateContext` 등)에서 프로세스가 죽거나 예외가 나면, `_retryState` 가 이미 원자 제거된 RUNNING NodeExecution row 가 영구 고아로 남을 수 있다 — 부모 Execution 은 이미 `failed`(terminal)라 `recoverStuckExecutions`/`failOrphanRunningNodeExecutions` 백스톱이 닿지 않는다는 것이 코드 JSDoc 에 실측으로 명시돼 있다. 이는 "살아있는 작업을 오판해 죽이는" 이전 결함(claim-이전 무조건 FAILED 마킹)보다 명백히 안전한 트레이드오프로 이미 분석·수용됐고, `plan/in-progress/retry-turn-terminal-guard.md` 에 후속 작업으로 등재돼 있다. 오늘 diff 가 새로 만든 미인지 결함이 아니라 의도적으로 받아들인 잔존 부작용이므로 참고용으로만 기록한다.
  - 제안: 조치 불요(plan 추적 중). 해당 plan 처리 시 함께 정리.

- **[INFO]** 신규 모듈 상수 `RETRY_STATE_KEY` 도입 — "전역 변수" 체크리스트 항목 확인용 기록
  - 위치: `retry-turn.service.ts:42`
  - 상세: 파일 스코프 `const RETRY_STATE_KEY = '_retryState';` 가 새로 추가됐다. `export` 되지 않아 모듈-프라이빗이고 불변(`const`, 원시 문자열)이며, 오직 이 파일 내부의 raw SQL 조각(`output_data - '...'`, `jsonb_exists(...)`)과 TS 프로퍼티 접근 리터럴을 단일화하는 DRY 목적으로만 쓰인다(4곳 이상 중복되던 리터럴이 한 곳으로 수렴 — 과거 WARNING #3 해소). 다른 모듈에 영향을 주는 진짜 "전역 변수"가 아니며 side effect 없음. 참고로 동일 리터럴 `'_retryState'` 은 `execution-engine.service.ts`/`ai-turn-executor.ts`/`handler-output.adapter.ts` 등 다른 파일에는 여전히 하드코딩돼 있어(오늘 diff 범위 밖), "단일 진실 지점"이라는 JSDoc 문구는 이 파일 내부 한정임을 참고.

## 확인했으나 문제 없음으로 결론난 항목

- **시그니처/인터페이스**: `retryLastTurn(executionId, nodeExecutionId)` / `applyRetryLastTurn(executionId, spawnedNodeExecutionId)` 공개 시그니처는 변경되지 않았다. 신규 `claimSpawnedRetryRow` 는 `private` 메서드로 외부 호출자 영향 없음. 실제 호출부(`websocket.gateway.ts:847`, `continuation-execution.processor.ts:153`) 모두 기존 인자 그대로 호환됨을 확인했다.
- **환경 변수 / 파일시스템**: 이번 diff 에 해당 없음.
- **네트워크 호출**: 외부 서비스 호출 신규 도입 없음. `claimSpawnedRetryRow` 로 인해 `applyRetryLastTurn` 1회 호출당 DB round-trip 이 1회 추가되지만, 이는 원자성 확보라는 수정의 목적 그 자체이며 의도된 트레이드오프다.
- **claim 과 `continuation-execution.processor.ts` 의 상호작용**: 해당 processor 는 `retry_last_turn` 타입을 자신의 별도 generic 원자 claim 대상에서 명시적으로 제외한다(`continuation-execution.processor.ts:83-93`) — 이번 diff 의 `claimSpawnedRetryRow` 와 이중 claim 충돌 없음, JSDoc 의 전제와 실제 코드가 일치함을 확인했다.
- **테스트 파일의 mock 변경**: `retry-turn.service.spec.ts` 의 `beforeEach` 에 추가된 `mockNodeExecutionRepo.createQueryBuilder` 기본값(`affected: 1`, "claim 성공")은 `retryLastTurn` describe 블록(자체 `dataSource.transaction` mock 사용)과 충돌하지 않고, early-return 가드 테스트들에는 도달하지 않아 무해함을 확인했다.

## 요약

핵심 변경은 `applyRetryLastTurn` 재진입 가드를 비원자 read-then-branch 에서 조건부 UPDATE 기반 원자 claim(`claimSpawnedRetryRow`)으로 교체한 것이며, 부작용 관점에서 진짜 "의도치 않은" 상태 변경·전역 변수 오염·시그니처/인터페이스 파손·환경 변수·네트워크 호출 문제는 발견되지 않았다. 다만 세 가지는 사실로서 존재하는 부작용이므로 기록해 둔다: (1) claim UPDATE 가 이제 존재성 검증보다 먼저 DB 를 건드리도록 순서가 바뀌었고(unguarded delete 의 null-safety 는 컬럼 제약으로 안전함을 확인), (2) `NODE_STARTED` 이벤트의 `input` payload 에서 `_retryState` 가 조용히 빠지며(문서화된 계약 밖이라 破 아님, 알려진 소비자 없음), (3) claim 성공~try 진입 전 크래시 시 RUNNING orphan row 가 남을 수 있는 이미 추적 중인 트레이드오프가 있다. 세 항목 모두 코드 주석·회귀 테스트·plan 항목으로 이미 명시적으로 다뤄지고 있어 신규 조치가 필요한 결함은 아니다.

## 위험도

LOW
