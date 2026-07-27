# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `markNodeCancelled`/`assertExecutionNotCancelled` 의 접근제어자가 `private` → `public` 으로 변경돼 클래스 공개 API 표면이 넓어짐
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4586`, `:7996`
  - 상세: 두 메서드 모두 `AiTurnEngineDriver` 인터페이스 멤버로 노출하기 위해 `public` 으로 바뀌었다. DI 는 여전히 `ENGINE_DRIVER` 토큰(`useExisting: ExecutionEngineService`)을 경유하므로 정상 호출 경로 자체는 변하지 않지만, `ExecutionEngineService` 구상 클래스에 직접 참조를 가진 코드(테스트 spy, 향후 리팩터 중 실수로 주입 대신 직접 `new`/DI 컨테이너 조회)라면 이제 `markNodeCancelled`(임의 `NodeExecution` 을 즉시 CANCELLED 로 마킹 + `NODE_CANCELLED` emit)나 `assertExecutionNotCancelled`(임의 지점에서 취소 판정)를 인터페이스 계약(turn/노드 경계에서만 호출)을 우회해 호출할 수 있게 됐다. 이미 `updateExecutionStatus` 등 동일 사유로 `public` 화된 선례가 있어 패턴은 일관되고, 클래스 docstring/주석에도 사유가 명시돼 있어 의도된 변경이지만 "인터페이스 변경이 기존 사용자에 미치는 영향" 관점에서 기록해 둘 필요가 있다.
  - 제안: 별도 조치 불요(설계 의도대로 문서화됨). 다만 후속 form/button 소비 PR 에서 이 두 메서드를 직접 호출하는 새 코드가 `ENGINE_DRIVER` 경유가 아니라 concrete 서비스 직접 참조로 추가되지 않는지 리뷰 시 확인 권장.

- **[INFO]** `updateExecutionStatus` 의 `linkedNodeExec` 분기에 신규 `SELECT ... FOR UPDATE` 행 잠금이 추가되어 트랜잭션 커밋까지 `execution` 행 잠금이 유지됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8181-8189` (트랜잭션 블록 전체는 8182-8203)
  - 상세: 검사-후-사용 race 를 닫기 위한 의도된 설계(주석에 명시)지만, 이전에는 이 분기가 잠금 없이 즉시 `save()` 만 수행했던 반면 지금은 매 park/resume 전이마다 `execution` 행에 대한 `FOR UPDATE` 잠금을 트랜잭션 종료까지 보유한다. 동시에 `executions.service.ts:stop()` 이 같은 행에 대해 별도(비-트랜잭션) `UPDATE ... WHERE status IN (...)` 를 실행하므로, 두 경로가 동시에 도달하면 `stop()` 쪽이 이 잠금 해제까지 블로킹될 수 있다(교착은 아니고 직렬화 대기 — 두 경로 모두 `execution` 단일 행만 잠그므로 lock-ordering 역전에 의한 deadlock 가능성은 낮음). 의도된 동시성 제어 강화이므로 결함은 아니나, 잠금 보유 시간이 늘어난 새로운 side effect 로 기록.
  - 제안: 별도 조치 불요. 부하가 큰 환경에서 stop() 지연 체감이 보고되면 트랜잭션 범위 축소를 검토.

- **[INFO]** AI turn 마다(`handleAiMessageTurn`) 및 대화 종료마다(`finalizeAiNode` RUNNING 유지 분기) 스로틀 없는 `assertExecutionNotCancelled` DB 재조회가 신규로 추가됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:658`, `:1449`
  - 상세: 노드 dispatch 루프의 기존 호출부(`execution-engine.service.ts:6598`)는 `{ throttle: true }` 옵션으로 과도한 조회를 완화하는 반면, 이번에 추가된 두 호출부는 옵션 없이 매번 조회한다. LLM 호출이 초~분 단위인 점을 고려하면 상대적 오버헤드는 작지만, 매 turn·매 대화 종료마다 무조건 1회 추가 DB 왕복이 생기는 것은 실측된 성능 side effect다.
  - 제안: 별도 조치 불요(설계상 의도된 트레이드오프이며 이미 plan/RESOLUTION 에 문서화된 범위). 고빈도 멀티턴 워크로드에서 DB 부하가 문제되면 스로틀 옵션 적용을 후속 검토.

- **[INFO]** `assertLinkedTransitionApplied` 재사용 시 `markNodeCancelled` 의 저장이 원래 잠금을 획득했던 트랜잭션과 분리된 별도 트랜잭션에서 실행됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:347-368` (특히 363행 `markNodeCancelled` 호출)
  - 상세: `updateExecutionStatus` 의 `FOR UPDATE` 트랜잭션은 이미 커밋되어 잠금이 해제된 뒤, `assertLinkedTransitionApplied` 가 별도로 `markNodeCancelled`(자체 `save()` + `NODE_CANCELLED` emit)를 호출한다. 이론적으로 동일 `nodeExec` 에 대해 짝 전이 가드가 거의 동시에 두 곳(예: re-park 재시도와 finalize 경로)에서 각각 `applied===false` 를 관측하면, 두 호출이 모두 `markNodeCancelled` 를 실행해 `NODE_CANCELLED` 이벤트가 중복 emit 될 수 있다. 현재 이 가드의 실 소비처는 AI 경로 3~4곳뿐이고 실행당 순차 처리 모델(BullMQ job 1개)이라 실질 도달 가능성은 낮으나, "이벤트/콜백 발생 변경" 관점의 신규 표면이라 기록.
  - 제안: 별도 조치 불요(저확률·저영향). form/button 경로까지 이 헬퍼를 재사용하는 후속 PR에서 동시 소비처가 늘어날 경우 재검토 권장.

## 요약

이번 변경은 AI multi-turn 턴 진행 중 Stop 이 조용히 소실되던 실결함(park 짝 전이 lost-update)을 닫기 위한 의도된 side effect(신규 DB `FOR UPDATE` 잠금, `assertExecutionNotCancelled` 추가 호출, `markNodeCancelled`/`assertExecutionNotCancelled` 의 `public` 노출)로 구성돼 있으며, 각 항목은 코드 주석·plan·RESOLUTION.md 에 근거와 트레이드오프가 상세히 문서화돼 있다. `reparkAiResumeTurn` 시그니처에 `node` 파라미터가 추가됐지만 private 메서드로 동일 파일 내 전 호출부가 갱신됐고, `updateExecutionStatus` 의 반환 계약 변경(`linkedNodeExec` 분기도 이제 `false` 가능)은 AI 경로 3곳에서 전부 소비되며 미소비 form/button 4곳은 plan 에 후속으로 명시적으로 이관돼 있다. 신규로 발견된 항목은 접근제어자 확장(WARNING)과 잠금/DB 조회 증가·이벤트 중복 가능성(INFO 3건)으로, 모두 저위험·의도된 설계에 해당해 차단 사유는 없다.

## 위험도

LOW
