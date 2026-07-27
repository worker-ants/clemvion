# Architecture Review — ie-resume-turn-boundary-cancel (2026-07-26 22:11)

## 발견사항

- **[WARNING]** `assertLinkedTransitionApplied` 로 통합된 "취소 관측→마킹→throw" 계약이 소비처마다 원자성 보장 수준이 다르다 (LSP성 불일치)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1446` (`finalizeAiNode` "RUNNING 유지" 분기), 대조: 같은 파일 `:1466`~`:1483` (else 분기, RUNNING 재claim) 및 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8159`(`updateExecutionStatus` 의 `linkedNodeExec` 트랜잭션)
  - 상세: 이번 PR 은 `updateExecutionStatus` 의 `linkedNodeExec` 분기에 "같은 트랜잭션 안에서 `SELECT ... FOR UPDATE` 로 행을 잠근 뒤 확인" 이라는 완전한 검사-후-사용(check-then-act) 차단을 도입했다(else 분기·retry-last-turn RUNNING 재claim 분기 모두 이 choke point 를 거치므로 동일하게 보호된다). 그런데 `finalizeAiNode` 의 "이미 RUNNING"(정상 multi-turn 대화 종료 주 경로) 분기는 `updateExecutionStatus` 를 아예 호출하지 않는다는 기존 구조적 제약 때문에, Critical #1 수정이 대신 `this.driver.assertExecutionNotCancelled(executionId)` 로 **잠금 없는 단순 재조회**만 수행한다. 이 호출이 통과(취소 아님)하면 `assertLinkedTransitionApplied(!cancelledExternally, ...)` 도 그냥 반환하고, 코드는 이어서 `await this.nodeExecutionRepository.save(nodeExec)` (`ai-turn-orchestrator.service.ts:1462`)를 **아무 잠금·트랜잭션도 없이** 실행한 뒤, 함수 하단에서 무조건 `NODE_COMPLETED` + `EXECUTION_RESUMED` 를 emit 한다(`:1486`~`:1509`). 즉 `assertExecutionNotCancelled` 재조회와 `nodeExecutionRepository.save` 사이의 이벤트 루프 틈에 동시 `Stop` 이 끼어들면, Execution 은 CANCELLED 로 마감되는데 NodeExecution 은 COMPLETED 로 저장되고 완료 이벤트까지 발행되는 — 바로 이 PR 이 없애려는 "사후 오시그널" 결함 클래스가 **폭은 좁지만 동일한 구조로** 재현될 수 있다. 같은 이름의 헬퍼(`assertLinkedTransitionApplied`)가 호출부에 따라 "트랜잭션+행잠금" 과 "단순 재조회+무보호 save" 라는 서로 다른 원자성 계약을 감춘 채 재사용되고 있어, 호출부 입장에서는 동일한 안전성을 기대하기 쉽다.
  - 참고: 이번 PR 이 추가한 e2e(`execution-park-resume.e2e-spec.ts` "턴 진행 중 실 HTTP POST /stop")는 `__e2e_delay_ms:1200` 으로 LLM 호출 자체의 넓은 창(수백 ms~수 초)만 관측하도록 설계돼 있어, 위에서 지적한 "재조회↔save" 사이의 좁은 틈은 이 테스트로도 검출되지 않는다(회귀 감지 사각지대).
  - 제안: (a) "RUNNING 유지" 분기도 `nodeExecutionRepository.save` 를 트랜잭션 안에서 대상 Execution 행을 `FOR UPDATE` 로 재확인한 뒤 수행하도록 바꿔 linkedNodeExec 분기와 동일한 원자성 수준으로 맞추거나, (b) 그것이 과하면 최소한 이 잔여 좁은-창 리스크를 코드 주석과 plan(`ie-resume-turn-boundary-cancel.md` "후속" 절)에 "허용된 잔여 리스크" 로 명시적으로 등재해 다음 리뷰가 재발견하지 않도록 한다.

- **[WARNING]** `markNodeCancelled` 호출 전 `outputData`/`error` 초기화가 caller 관례로만 강제됨 — 공유 헬퍼의 암묵적 선행조건
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:356`~`:363` (`assertLinkedTransitionApplied` 내부), 대조: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4585`~`:4611` (`markNodeCancelled` 구현)
  - 상세: `markNodeCancelled` 는 `status`/`finishedAt`/`durationMs`(그리고 `errorEnvelope` 전달 시 `error`)만 갱신하고 `outputData` 는 전혀 건드리지 않는다(WARNING #10 수정 의도상 client-facing 오염 차단을 위해 의도적으로 그렇게 설계됨). 그래서 `assertLinkedTransitionApplied` 는 `markNodeCancelled` 호출 **직전**에 `nodeExec.outputData = {}; nodeExec.error = {};` 를 수동으로 선행한다. 이 "먼저 비워야 한다" 라는 계약은 타입 시그니처나 `markNodeCancelled` 자체에 강제되지 않고, 오직 이 한 호출부의 주석(WARNING #10 참조)으로만 존재한다. plan(`ie-resume-turn-boundary-cancel.md` "후속(본 PR 밖)")이 이미 `assertLinkedTransitionApplied` 의 "관측→마킹→throw" 로직 자체를 form/button 후속 PR 이 재사용할 수 없다고 명시했는데, 그 후속 작업이 이 사전 초기화 스텝을 빠뜨리면 WARNING #10 이 고쳤던 "취소된 NodeExecution 이 성공 페이로드를 노출" 문제가 조용히 재발한다 — 공유돼야 할 불변식이 캡슐화 경계 밖에 있다.
  - 제안: `markNodeCancelled` 자신이 (errorEnvelope 유무와 무관하게) `outputData`/기존 `error` 를 항상 초기화하도록 책임을 흡수하거나, 최소한 옵션 플래그(`clearPayload?: boolean`)로 명시적 계약을 인터페이스 시그니처에 노출해 다음 소비처가 실수로 빠뜨릴 수 없게 한다.

- **[INFO]** `assertLinkedTransitionApplied` 의 `phase` 파라미터가 자유 문자열(stringly-typed)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:347`~`:354` (시그니처), 호출부 `:411`, `:513`, `:1460`, `:1482`
  - 상세: `phase: string` 은 4개 호출부에서 각각 `'AI turn — re-park'`, `'첫 AI turn park'`, `'AI turn 종료 처리(RUNNING 유지)'`, `'AI turn 종료 처리(RUNNING 재claim)'` 리터럴을 전달한다. 오탈자나 문구 불일치가 컴파일 타임에 잡히지 않는다. 에러 메시지 구성 용도뿐이라 심각하지 않으나, 유니온 리터럴 타입(`type LinkedTransitionPhase = ...`)으로 좁히면 향후 소비처 추가 시 실수를 줄일 수 있다.
  - 제안: 우선순위 낮음 — 리팩터 기회가 있을 때 유니온 타입으로 전환 고려.

- **[INFO]** (양성 관찰) ISP·DRY 적용이 일관되게 확장됨
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:116`~`:165` (`AiTurnEngineDriver`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:507`~`:512` (`NON_TERMINAL_STATUSES_SQL`)
  - 상세: `assertExecutionNotCancelled`/`markNodeCancelled` 를 `CoreEngineDriver` 가 아니라 실제 유일 호출자인 `AiTurnOrchestrator` 전용 `AiTurnEngineDriver` 표면에 추가한 것은 기존 C-1 후속 ④ ISP 리팩터 방향과 일치한다. non-terminal status SQL 리터럴을 `NON_TERMINAL_STATUSES_SQL` 정적 상수(enum 기반 단일 출처)로 통합해 else 분기·linkedNodeExec 분기 두 곳의 하드코딩 중복을 제거한 것도 정당한 DRY 개선이다. 이미 알려진 채 명시적으로 defer 된 항목(form/button 4개 호출부 미소비 — WARNING #1/#2/#3, `updateExecutionStatus` 다중 책임 리팩터 — WARNING #4)은 plan 에 근거와 함께 정확히 추적되고 있어 별도 지적하지 않는다.

## 요약

이번 변경은 M-3 이 명시적으로 "범위 밖" 으로 남겨뒀던 park 짝 전이(`linkedNodeExec`) 무가드 full-entity save 를 트랜잭션 내 행잠금(`FOR UPDATE`)으로 닫고, 그 반환 계약(`false`=lost 방지)을 AI 경로 4개 소비처에 `assertLinkedTransitionApplied` 라는 단일 헬퍼로 일관되게 적용한 점에서 아키텍처적으로 건전한 방향이다. ISP·DRY 리팩터(`AiTurnEngineDriver` 표면 확장, `NON_TERMINAL_STATUSES_SQL` 단일화)도 기존 C-1 후속 궤적과 일치한다. 다만 `finalizeAiNode` 의 "이미 RUNNING" 분기는 구조적 제약(RUNNING→RUNNING `assertTransition` 회피)으로 `updateExecutionStatus` 의 트랜잭션+행잠금 경로를 타지 못해, 같은 이름의 헬퍼 뒤에서 더 약한(잠금 없는 재조회+무보호 save) 원자성으로 동일 책임을 수행한다 — 폭은 훨씬 좁지만 이 PR 이 없애려는 결함 클래스와 동형인 잔여 창이 남는다. 또한 `markNodeCancelled` 호출 전 `outputData`/`error` 사전 초기화가 타입이 아닌 호출부 관례로만 강제돼, 이미 예고된 form/button 후속 PR 이 이 계약을 놓치면 WARNING #10 이 고쳤던 데이터 위생 문제가 재발할 소지가 있다. 둘 다 즉시 차단할 결함은 아니나, 다음 라운드(특히 form/button 확장) 전에 명시적으로 처리하거나 최소한 plan 에 리스크로 등재해 둘 가치가 있다.

## 위험도
MEDIUM
