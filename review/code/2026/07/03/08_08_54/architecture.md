### 발견사항

- **[WARNING]** `claimResumeEntry` 가 중앙 상태 전이 게이트(`assertTransition`/`ALLOWED_TRANSITIONS`)를 우회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:663-709` (`claimResumeEntry`), 비교 대상 `codebase/backend/src/modules/execution-engine/state/state-machine.ts` (`assertTransition`), `execution-engine.service.ts:6871` (`updateExecutionStatus` 가 `assertTransition` 호출)
  - 상세: 이 프로젝트는 `waiting_for_input → running` 등 Execution/NodeExecution 상태 전이의 적법성을 `state-machine.ts` 의 `ALLOWED_TRANSITIONS` 테이블 + `assertTransition` 을 단일 게이트로 강제해왔다(`updateExecutionStatus` 경유). 그런데 신규 `claimResumeEntry` 는 `manager.createQueryBuilder().update(NodeExecution)/update(Execution)` 를 직접 사용해 `waiting_for_input → running` 전이를 수행하며, 이 경로는 `assertTransition` 을 전혀 거치지 않는다. 현재는 표에 이미 등재된 legal 전이라 즉시 오류는 없지만, "전이 적법성 검증 지점이 하나"라는 불변식이 깨졌다 — 향후 이 표가 바뀌거나 다른 개발자가 `claimResumeEntry` 를 다른 전이에 재사용하면 검증 없이 통과한다. 실제로 `execution-engine.service.ts:2475-811`(`markNodeExecutionFailed` cascade), `:2585-853`(`recoverStuckExecutions` cascade) 등 이번 diff의 다른 신규 코드들도 모두 raw query builder 로 status 를 직접 쓰며 같은 패턴을 반복한다 — 원자 claim/cascade 류가 늘어날수록 "상태 전이는 항상 게이트를 거친다"는 아키텍처 원칙이 예외투성이가 된다.
  - 제안: 최소한 주석으로 "이 경로는 의도적으로 state-machine 게이트를 우회한다(트랜잭션 원자성이 우선)"는 근거를 명시하거나, `assertTransition` 을 no-DB dry-run 형태로도 호출해 표와의 정합을 코드 레벨에서 계속 강제하는 얇은 헬퍼를 고려. 최소 조치로 spec Rationale(§7.5 신규 소절)에 있는 근거를 코드 주석에도 요약 인용해 "왜 게이트 밖인지"를 코드에서도 추적 가능하게 할 것.

- **[WARNING]** `execution-engine.service.ts` 가 7000줄 넘는 단일 클래스로 계속 성장 — SRP 위반 심화
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (전체 7025줄), 이번 diff 로 `claimResumeEntry`(신규 public 메서드), `recoverStuckExecutions` cascade 로직, `markNodeExecutionFailed` 상태 목록 확장 등이 같은 클래스에 추가됨
  - 상세: 이 서비스는 이미 continuation 처리, rehydration, stuck-execution 복구, segment 시간 추적, cancel, retry 등 다수의 책임을 한 클래스가 갖고 있다(메모리 기록상 관련 god-handler 분할(M-1)이 다른 모듈에서는 이미 진행됨). 이번 PR 은 "재개 진입 원자 claim" 이라는 새 책임(동시성 제어/레이스 방지)을 또 이 클래스에 얹었다. `dataSource.transaction` 직접 호출 + query builder 조합까지 서비스 레이어에 노출되어 있어, 이 클래스는 사실상 (a) 도메인 오케스트레이션과 (b) 저수준 트랜잭션/영속 로직을 동시에 갖는 레이어 혼재 상태다.
  - 제안: 즉시 리팩터를 요구하진 않되(기존 백로그에 M-3/M-7 계열 리팩터가 이미 진행 중이므로), `claimResumeEntry` + `recoverStuckExecutions` 의 cascade 로직처럼 "동시성/claim 전용" 저수준 트랜잭션 코드를 별도 `ResumeClaimRepository`/`ExecutionRecoveryService` 같은 협력 객체로 분리하는 것을 다음 리팩터 사이클(현재 진행 중인 `plan/in-progress/refactor/06-concurrency.md` 트랙)에서 후보로 등재 검토.

- **[INFO]** `reparkAiResumeTurn` 의 `nodeExec.status` 직접 mutation — 암묵적 계약에 의존한 결합
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:330-349`
  - 상세: `claimResumeEntry` 가 이제 nodeExec 를 RUNNING 상태로 로드시키는 부수효과가 있고, `reparkAiResumeTurn` 은 그 새 불변식("claim 이후 로드된 nodeExec 는 RUNNING")을 알고 있어야만 정확히 동작한다(주석에 명시돼 있어 추적은 가능). 이는 두 서비스(`ExecutionEngineService.claimResumeEntry`와 `AiTurnOrchestrator.reparkAiResumeTurn`)가 "claim 이후 nodeExec 의 상태 값" 이라는 암묵적 계약으로 결합돼 있다는 뜻이다 — 즉 이 결합이 타입 시스템이나 인터페이스가 아니라 주석과 팀 지식으로만 강제된다.
  - 제안: 현재 규모에서는 과설계를 피하기 위해 주석 수준 대응으로 충분해 보이나, 유사 패턴(claim 후 상태 되돌리기)이 추가로 발생하면 `ResumeState`/`ParkSignal` 같은 기존 타입에 "claim 여부"를 명시 필드로 실어 컴파일 타임에 드러나게 하는 것을 고려.

- **[INFO]** 짝 전이(NodeExecution/Execution) 순서 결합이 두 개의 개별 query builder 호출로 표현됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:677-701` (`claimResumeEntry` 내부)
  - 상세: 레이스 결정자는 NodeExecution UPDATE 단독이고 Execution UPDATE 는 "이미 이겼으니 그냥 맞춰준다"는 설계인데, 이 순서 의존성(NodeExecution 먼저 → 결과로 조기 return, Execution 은 결과 무시)이 함수 본문에 인라인으로만 존재한다. 트랜잭션 안이라 원자성 자체는 보장되지만, "어느 쪽이 레이스 결정자인지"가 코드 구조(순서)에만 담겨 있어 향후 순서를 바꾸면 조용히 의미가 달라질 수 있다.
  - 제안: 현재 diff 범위에서는 주석이 이미 상세하므로 즉시 조치 불요. 다만 이런 "짝 전이" 패턴이 3번째로 재등장하면 (`_retryState` 패턴, 이번 claim 패턴에 이어) 공통 헬퍼로 추출을 고려할 시점.

### 요약

이번 변경은 §7.5 재개(rehydration) 진입 지점의 check-then-act 레이스를 DB 조건부 UPDATE 기반 원자 claim 으로 대체하는 동시성 하드닝으로, spec 문서·plan·구현·테스트가 일관되게 갱신되어 추적 가능성은 양호하다. 다만 이 claim 로직이 프로젝트가 이미 확립한 "상태 전이는 `assertTransition`/`ALLOWED_TRANSITIONS` 단일 게이트를 거친다"는 아키텍처 불변식을 우회하는 새 경로를 추가했고, 이미 대형화된 `ExecutionEngineService`(7000줄+)에 저수준 트랜잭션 로직을 계속 축적시키는 방향으로 진행됐다는 점에서 레이어 경계가 다소 흐려졌다. 즉시 차단할 결함은 아니며, 다음 리팩터 라운드에서 claim/recovery 계열 로직 분리와 상태 전이 게이트 일원화를 후보로 검토할 만하다.

### 위험도
LOW
