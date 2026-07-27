# 부작용(Side Effect) Review — ie-resume-turn-boundary-cancel (2026-07-26 23:05)

본 세션은 이전 3개 라운드(`review/code/2026/07/26/20_10_51` → `21_08_01` → `22_11_22`, 각 라운드의
`side_effect.md` 포함)에 걸쳐 이미 여러 번 리뷰·수정된 누적 diff를 대상으로 한다. 이전 라운드의
`side_effect.md`가 이미 지적한 항목(공개 API 확대, 잠금 보유 시간 증가, 스로틀 없는 재조회, 짝
`markNodeCancelled`의 비원자적 별도 트랜잭션)은 이번 라운드의 fix 커밋(`d1d8d2db1` 등) 이후에도
실제 소스(`execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts`를 직접 Read로 재확인)에서 여전히 유효한지 재검증하고, 이번 라운드가
새로 도입한 변경(`assertActiveExecutionAndSaveNodeExec`)이 추가로 만드는 side effect를 점검했다.

## 발견사항

- **[WARNING]** `ExecutionEngineService`의 공개(public) 표면이 이번 라운드에서 3개 메서드로 더 늘었다 — `EngineDriver`를 우회해 직접 호출 가능한 진입점 확대
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `markNodeCancelled`(4586행, `private`→`public`), `assertExecutionNotCancelled`(7996행, `private`→`public`), `assertActiveExecutionAndSaveNodeExec`(8049행, 이번 라운드 신규 추가·`public`). 인터페이스 선언은 `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:134`(`assertExecutionNotCancelled`), `:161`(`markNodeCancelled`), `:183`(`assertActiveExecutionAndSaveNodeExec`) — 전부 `AiTurnEngineDriver`.
  - 상세: 이전 라운드(`22_11_22`)의 side_effect 리뷰가 앞의 두 메서드(`markNodeCancelled`/`assertExecutionNotCancelled`)의 `private→public` 전환을 이미 WARNING으로 기록했다. 이번 라운드는 여기에 **세 번째** public 메서드(`assertActiveExecutionAndSaveNodeExec`)를 추가했다 — `finalizeAiNode`의 "RUNNING 유지" 분기가 `updateExecutionStatus` choke point를 타지 않아 남았던 TOCTOU를 닫기 위해 도입됐다. DI는 여전히 `ENGINE_DRIVER` 토큰(`useExisting: ExecutionEngineService`)을 경유하므로 정상 호출 경로 자체는 변하지 않지만, 세 메서드 모두 이제 `ExecutionEngineService` 구상 클래스에 직접 참조가 있는 코드(테스트 spy, 향후 리팩터 중 실수로 DI 컨테이너 대신 직접 주입)라면 인터페이스 계약(turn/노드 경계에서만 호출)을 우회해 호출할 수 있다. 특히 `assertActiveExecutionAndSaveNodeExec`는 임의의 `NodeExecution`을 인자로 받아 그대로 `save`하므로, 잘못된 호출부가 생기면 검증 없이 임의 행을 덮어쓸 수 있는 표면이다.
  - 제안: 설계 의도(ISP, `AiTurnOrchestrator` 단일 소비자)는 문서화돼 있어 즉시 조치는 불요. 다만 공개 표면이 라운드마다 늘고 있으므로, 이후 form/button 후속 PR에서 실제로 `ENGINE_DRIVER` 경유 없이 concrete 서비스를 직접 참조하는 코드가 추가되지 않는지 리뷰 체크리스트에 명시해 둘 것을 권고.

- **[INFO]** (재확인, 여전히 유효) `updateExecutionStatus`의 `linkedNodeExec` 분기 반환 계약이 "항상 `true`"에서 "`false`일 수 있음"으로 바뀌었으나, 이 값을 소비하지 않는 4개 호출부(form/button)의 동작은 관측상 변화 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8174`(`updateExecutionStatus` 시그니처는 불변, `@returns` JSDoc만 8164~8171행에서 갱신), 반환 계약 자체가 바뀌는 지점은 8230~8254행(`linkedNodeExec` 분기). 미소비 호출부는 `form-interaction.service.ts:110,325`, `button-interaction.service.ts:395,567`(plan `ie-resume-turn-boundary-cancel.md` "후속(본 PR 밖)" 절이 명시적으로 추적).
  - 상세: 함수 시그니처(파라미터·반환 타입) 자체는 변경되지 않아 컴파일 타임 파급은 없다. 그러나 **의미론적 계약**은 바뀌었다 — 이전에는 `linkedNodeExec`가 있으면 이 분기가 무조건 `true`를 반환했지만, 이제는 동시 cancel이 선점하면 `false`를 반환한다. 반환값을 이미 소비하지 않는 form/button 4개 호출부는 `false`가 와도 그냥 무시하고 진행하므로 즉시 오동작하지는 않지만("DB 자체는 FOR UPDATE 가드로 안전 — no-op이면 실제 UPDATE가 일어나지 않음"), 짝 `NodeExecution`이 terminal 마킹되지 않아 영구 RUNNING으로 잔류할 수 있다는 데이터 일관성 갭은 그대로 남는다. 이미 plan에 후속 항목으로 정확히 추적되고 있어 새로 발견된 사안은 아니다.
  - 제안: 조치 불요(이미 추적됨) — 후속 PR에서 `assertLinkedTransitionApplied` 패턴 재사용 권장.

- **[INFO]** (재확인, 여전히 유효) 신규 `assertActiveExecutionAndSaveNodeExec`도 형제 분기와 동일하게 `execution` 행에 커밋까지 유지되는 `FOR UPDATE` 잠금을 추가로 도입함 — `stop()`과의 직렬화 대기 지점이 하나 더 늘어남
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8049-8073`(`assertActiveExecutionAndSaveNodeExec` 트랜잭션 전체), 대조: 8230-8254행(`linkedNodeExec` 분기, 동일 패턴 선례)
  - 상세: `finalizeAiNode`의 "이미 RUNNING" 분기(정상 multi-turn 대화 종료의 주 경로, `ai-turn-orchestrator.service.ts:1471-1483`)가 매번 이 메서드를 거쳐 `SELECT ... FOR UPDATE` 트랜잭션을 새로 연다. `executions.service.ts`의 `stop()`(별도 비-트랜잭션 guarded UPDATE)이 같은 execution 행에 동시 도달하면 이 트랜잭션이 커밋될 때까지 블로킹된다 — 교착(deadlock)은 아니고(단일 행 잠금이라 lock-ordering 역전 없음) 직렬화 대기다. 이전 라운드 side_effect 리뷰가 `linkedNodeExec` 분기에 대해 이미 같은 관찰을 남겼는데, 이번 신규 메서드로 이 패턴이 **AI 대화가 정상 종료될 때마다**(엣지케이스가 아니라 주경로) 매번 실행되는 지점이 하나 늘었다.
  - 제안: 별도 조치 불요(의도된 동시성 강화, 잠금 범위가 단일 행·짧은 트랜잭션이라 실무적 영향은 낮음). 고빈도 멀티턴 워크로드에서 `stop()` 지연 체감이 보고되면 재검토.

- **[INFO]** (재확인, 여전히 유효) 짝 `NodeExecution`의 terminal 마킹(`markNodeCancelled`)이 위 두 종류의 관측 트랜잭션(`updateExecutionStatus`의 `linkedNodeExec` FOR UPDATE / `assertActiveExecutionAndSaveNodeExec`의 FOR UPDATE)과 별도의, 원자적으로 묶이지 않은 save로 실행됨 — 콜백/이벤트 발행 경로 신규 표면
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:360-381`(`assertLinkedTransitionApplied` — `shouldProceed===false`일 때 369~376행에서 `markNodeCancelled` 호출), 호출부 4곳: `reparkAiResumeTurn`(418행), `emitAiWaitingForInput`(520행 부근), `finalizeAiNode`의 RUNNING 유지 분기(1476행)·RUNNING 재claim 분기(1495행)
  - 상세: 관측(FOR UPDATE 트랜잭션)이 커밋된 **이후**, 별도의 `markNodeCancelled` 호출이 `NodeExecution`을 CANCELLED로 save하고 `NODE_CANCELLED` 이벤트를 emit한다. 이 두 단계 사이(관측 커밋 ~ markNodeCancelled 완료)에 프로세스 크래시가 나면 NodeExecution이 비-terminal로 잔류하는 좁은 창이 남는다(이미 이전 라운드 database.md가 INFO로 지적). 이론적으로 같은 `nodeExec`에 대해 두 소비처(예: retry-last-turn 재claim과 finalize 경로)가 거의 동시에 각각 `shouldProceed===false`를 관측하면 `markNodeCancelled`가 중복 호출돼 `NODE_CANCELLED`가 이중 emit될 수 있으나, 실행당 순차 처리 모델(BullMQ job 1개)이라 실질 도달 가능성은 낮다. 새로 추가된 코드가 아니라 이전 라운드부터 존재하던 패턴이 신규 소비처(`finalizeAiNode` RUNNING 유지 분기)로 한 곳 더 확장된 것뿐이다.
  - 제안: 별도 조치 불요(저확률·저영향, 이미 추적됨).

- **[INFO]** (양성 확인) `emitTerminalExecutionMetrics`/`recordRunningSegmentStart` 호출 인자가 `persisted`(실제 반영 여부) 기준으로 정정되어, no-op 전이에 대한 메트릭/in-memory 상태 오염이 제거됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8195-8196`(`enteringRunning` 계산 분리), `:8249-8253`(`linkedNodeExec` 분기 — `persisted`일 때만 `recordRunningSegmentStart` 호출 + `emitTerminalExecutionMetrics(execution, newStatus, persisted)`), `:8293-8297`(else 분기 동일 패턴)
  - 상세: 이전 코드는 `linkedNodeExec` 분기에서 `emitTerminalExecutionMetrics(execution, newStatus, true)`로 **항상 `true`**를 넘겼고, `recordRunningSegmentStart`도 가드 통과 여부와 무관하게 무조건 호출됐다. 지금은 두 호출 모두 실제 DB 반영 여부(`persisted`)를 따르도록 바뀌어, 거부된(no-op) 전이에 대해 메트릭이 잘못 집계되거나 `segmentStartMs`에 정리되지 않는 유령 항목(in-memory 누수, DB 오염은 아님)이 쌓이던 부작용을 제거했다. 이는 이번 diff가 의도적으로 고친 부작용이며 회귀 방향이 아니다.
  - 제안: 조치 불요 — 확인용 기록.

- **[INFO]** `StubLlmClient`에 신설된 `__e2e_delay_ms` 마커/`STUB_MAX_DELAY_MS`는 프로덕션 경로에 도달 불가능한 테스트 전용 side effect — 신규 export 상수 1개
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` — `DELAY_MARKER`(module-private, export 안 됨)·`STUB_MAX_DELAY_MS`(export const, 신규 공개 표면)
  - 상세: `StubLlmClient`는 `LLM_STUB_MODE`가 설정됐을 때만 `LlmService.createClient`가 바인딩하는 테스트 전용 클라이언트로, 클래스 상단 JSDoc이 "프로덕션 경로에는 절대 활성화되지 않는다"를 명시한다. `chat()`이 마커를 인식하면 `setTimeout` 기반 실제 지연(최대 `STUB_MAX_DELAY_MS`로 캡)을 도입하는데, 이는 순수 함수/즉시 반환이었던 이전 동작에 비해 **호출부 입장에서 관측 가능한 타이밍 부작용**이 새로 생긴 것이다 — 마커가 없으면 기존과 동일하게 즉시 응답하므로(회귀 테스트로 고정) 하위 호환은 유지된다. `STUB_MAX_DELAY_MS`가 새 공개 상수로 export되어 패키지 표면이 넓어졌으나, 테스트 스텁의 export라 영향 범위는 테스트 코드로 한정된다.
  - 제안: 조치 불요 — production 도달 불가 확인됨, 상한도 적용돼 있어 무한 대기(hang) 위험 없음.

- **[INFO]** WS 이벤트(`AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`) emit이 turn-경계 취소 가드보다 먼저 실행되는 기존 순서는 이번 diff로 바뀌지 않음 — 이벤트/콜백 관점에서 잔존하는 사전 존재 갭(이미 다른 리뷰어·plan에 추적)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `handleAiMessageTurn` 내부 `AI_MESSAGE` emit(838행, 966행 부근)·`EXECUTION_WAITING_FOR_INPUT` emit(901행 부근)은 turn 경계 가드(671행, `assertExecutionNotCancelled`) **이후**·짝 전이 가드(`reparkAiResumeTurn`/`finalizeAiNode`의 `assertLinkedTransitionApplied`, 각각 418행·1476행·1495행) **이전**에 무조건 실행된다.
  - 상세: 이번 PR이 새로 추가한 turn-경계 가드는 handler(LLM) 호출 **이전**에만 취소를 관측한다 — handler가 반환한 뒤 `handleAiMessageTurn`이 곧바로 발행하는 두 WS 이벤트는 재개/종료 가드(별도 메서드, `handleAiMessageTurn` 반환 이후 `processAiResumeTurn`이 호출)보다 먼저 실행된다. 즉 LLM 호출 도중 Stop이 눌리면 DB/`NodeExecution` 최종 상태는 이 PR로 안전해졌지만, 클라이언트는 "대화가 계속된다"는 WS 이벤트를 잠깐 먼저 받을 수 있다. 이 항목은 같은 라운드의 requirement.md가 WARNING으로 이미 지적했고, `plan/in-progress/ie-resume-turn-boundary-cancel.md` "## 후속 (본 PR 밖)" 절(3차 라운드 추가 후속, SUMMARY#2)에 증상·영향·닫는 방법과 함께 명시적으로 등재돼 있다 — 이번 diff가 새로 도입한 회귀가 아니라, 이 PR이 완전히 닫지 못한 채 의도적으로 이관한 기존 갭이다.
  - 제안: side_effect 관점에서 추가 조치는 불요(이미 요구사항 리뷰·plan에 추적) — 다만 이 이관 항목이 "이벤트 발행 순서 변경"이라는 side-effect 성격도 겸하므로 교차 참조로 기록.

## 요약

이번 라운드의 신규 변경(`assertActiveExecutionAndSaveNodeExec` 도입, `recordRunningSegmentStart`/`emitTerminalExecutionMetrics` 인자 정정, e2e `pollNodeExecutionTerminal`/`__e2e_delay_ms` 테스트 인프라, CHANGELOG/plan 문서 갱신)은 전부 이전 라운드에서 지적된 잔여 TOCTOU·부수효과 버그를 닫는 의도된 side effect이며, 새로운 전역 상태·환경변수·네트워크 호출·파일시스템 부작용은 관측되지 않았다. 다만 `ExecutionEngineService`의 `public` 표면이 이번 라운드로 3개 메서드(`markNodeCancelled`/`assertExecutionNotCancelled`/`assertActiveExecutionAndSaveNodeExec`)로 늘어난 점, 그리고 그에 딸린 신규 `FOR UPDATE` 트랜잭션이 `stop()`과의 직렬화 대기 지점을 하나 더 만든 점은 라운드를 거듭할수록 누적되는 side effect로 기록해 둘 가치가 있다 — 둘 다 설계 의도가 문서화돼 있고 위험도는 낮다. `updateExecutionStatus` 반환 계약 변경을 소비하지 않는 form/button 4개 호출부, `markNodeCancelled`의 비원자적 별도 트랜잭션, WS 이벤트 발행 순서 갭은 모두 이전 라운드부터 이어진 기지 항목으로 plan에 정확히 추적돼 있어 이번 라운드에서 새로 발견된 차단 사유는 없다.

## 위험도

LOW
