# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `llmService.chat()` 3번째 인자(`llmContext`)로 undefined 필드 전달 시 `usageLogService.record()` 로 그대로 흘러가 `llm_usage_log.workflow_id`/`node_execution_id` 가 (기존과 동일하게) NULL 적재됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (신규 `llmContext` 상수, ~L2596-2601), `codebase/backend/src/modules/llm/llm.service.ts:186-195` (`record` 호출)
  - 상세: `state.workflowId`/`state.nodeExecutionId` 는 `MultiTurnState`/`ResumeState` 에서 optional 이라, 배포 시점에 이미 대기 중이던 과거 persisted resume checkpoint(신규 필드 미포함)로 재개되는 turn 은 여전히 `undefined` 를 흘려보낸다. `LlmService.chat`/`usageLogService.record` 는 이 값을 그대로 읽기만 하고 별도 예외를 던지지 않으므로 **기능 저하(NULL 적재)** 로만 나타나고 crash 등 부작용은 없음 — in-flight 오래된 checkpoint 한정 과도기적 갭이며 신규 실행에는 영향 없음.
  - 제안: 별도 조치 불필요(신규 실행부터는 `#877` 의 `buildRetryReentryState` 가 항상 채움). in-flight 오래된 checkpoint 로 인한 일시적 attribution 갭이 존재할 수 있음을 배포 노트에 인지만 해두면 충분.

- **[INFO]** `llmContext` 객체를 두 번의 `llmService.chat()` 호출(메인 호출 + tool-call 루프 후속 호출)에 동일 참조로 재사용
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` diff L2596-2601(`const llmContext = {...}`), L2743-2788(두 번째 `chat(...)` 호출에서 동일 `llmContext` 재사용)
  - 상세: `LlmService.chat(config, params, context, opts)` 구현(`llm.service.ts:154-197`)은 `context` 를 **읽기 전용**으로만 사용(`usageLogService.record` 인자 구성)하고 mutate 하지 않으므로, 동일 객체를 여러 호출에 재사용해도 상태 오염(cross-call contamination) 위험은 없음을 코드로 확인함. 의도된 재사용으로 문제 없음 — 기록 목적의 정보성 항목.

- **[INFO]** `MultiTurnState`(IE) 인터페이스에 `workflowId?`/`nodeExecutionId?` 필드 추가는 이미 `resume-state.schema.ts`(PR #877) 에 등재된 필드를 단순 소비하는 것으로, 신규 스키마 등재나 직렬화 shape 변경이 이번 diff 에는 없음
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`MultiTurnState` 인터페이스, `hydrateState`)
  - 상세: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:118,121,155-156` 에 `workflowId`/`nodeExecutionId` 가 이미 optional 필드로 등재되어 있음을 확인. 이번 PR 은 그 값을 IE 핸들러가 **소비**하는 코드만 추가하므로 스키마·직렬화 계약 변경 없음(하위 호환).

- **[INFO]** `execution-engine.service.ts` 변경은 순수 주석 추가로 런타임 동작 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff (`buildRetryReentryState` 내부 주석 2줄 추가)
  - 상세: 코드 로직·시그니처·리턴값 변경 없음. 정보성 문서화 목적.

- **[INFO]** `llm_usage_log.node_execution_id` 컬럼 값의 의미가 IE resume 턴에 한해 소급 아닌 향후 적재분부터 변경됨(버그 수정에 따른 의도된 데이터 의미 변화)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` diff L883-897
  - 상세: 과거엔 resume 턴에서 `node_execution_id` 자리에 **Node 정의 id**(`state.nodeId`)가 잘못 적재됐고, 이제는 **NodeExecution row PK**(`state.nodeExecutionId`)가 적재된다. 이 컬럼을 소비하는 하류(Statistics·Alerts·`getActivity` 류)가 과거의 (잘못된) 정의 id 값에 우연히 의존하고 있었다면 영향받을 수 있으나, 정의 id 는 FK 무결성이 없는 값이라 그런 의존이 존재할 가능성은 낮음. 의도된 수정이며 CHANGELOG/spec 에도 명시됨 — 부작용이라기보다 계획된 동작 변경.

## 요약

이번 변경은 두 소비 사이트(`ai-turn-executor.ts` 의 resume 메인/후속 chat 호출, `information-extractor.handler.ts` 의 resume llmContext 조립)가 이미 엔진 공유 재구성기(`buildRetryReentryState`, PR #877)가 실어주는 `workflowId`/`nodeExecutionId` 를 소비하도록 고친 것으로, 신규 전역 상태·신규 파일시스템 부작용·환경변수 접근·외부 네트워크 호출을 도입하지 않는다. `LlmService.chat` 은 기존에도 3번째 인자로 `LlmCallContext` 를 받는 시그니처였으므로 이번 변경은 새 파라미터를 추가한 것이 아니라 기존에 생략되던 인자를 채워 넣은 것이며, `chat()` 내부는 그 값을 읽기 전용으로 로그 기록에만 사용해 여러 호출 간 객체 재사용도 안전함을 코드로 확인했다. `MultiTurnState`(IE)에 추가된 두 optional 필드는 이미 존재하던 `resume-state.schema.ts` 등재분을 소비만 하므로 직렬화 계약 변경도 없다. 유일한 실질적 "부작용"은 향후 `llm_usage_log.node_execution_id` 에 적재되는 값의 **의미가 바뀐다**는 점인데, 이는 오적재 버그를 고치는 의도된 변경이고 CHANGELOG/spec 문서에 명시적으로 반영돼 있어 은닉된 부작용으로 보지 않는다. `execution-engine.service.ts` 변경은 순수 주석이라 무해하다. 관련 유닛 테스트(`ai-turn-executor.spec.ts`, `information-extractor.handler.spec.ts`) 실행 결과 66건 전부 통과했다.

## 위험도

LOW
