# 부작용(Side Effect) Review

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 수정 (Information Extractor `node_execution_id` 오적재 교정 + AI Agent resume 메인/후속 chat 2곳 `LlmCallContext` 미배선 교정) + 이전 /ai-review 세션(2026-07-10 01:46:28)의 review 산출물·RESOLUTION.md·spec 정정이 함께 포함된 diff.

## 발견사항

- **[INFO]** `llm_usage_log.node_execution_id` 컬럼의 향후 적재 값 의미가 IE resume 턴에 한해 변경됨
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:883-897`(resume `llmContext` 조립), `:1846-1852`(`hydrateState`)
  - 상세: 이전에는 resume 턴에서 `node_execution_id` 자리에 **Node 정의 id**(`state.nodeId`)가 잘못 적재됐고, 이제는 **NodeExecution row PK**(`state.nodeExecutionId`)가 적재된다(부재 시 `undefined` → NULL). `statistics.service.ts`/`alerts-evaluator.service.ts` 등 `llm_usage_log`를 `workflow_id`로 필터링하는 하류 쿼리는 이 컬럼이 기존엔 NULL(§4.6 활동 탭 공백)이던 행이 정상 적재로 전환되는 것이므로 CHANGELOG 에 기술된 의도된 수정과 일치한다. 정의 id 값에 우연히 의존하는 하류 로직이 있었다면 영향 받을 수 있으나 grep 상 그런 의존 코드는 확인되지 않았다. 계획된 데이터 의미 변화이며 CHANGELOG·spec 양쪽에 명시돼 은닉된 부작용은 아니다.
  - 제안: 별도 조치 불필요. 배포 직후 in-flight legacy resume checkpoint(신규 필드 미포함)는 과도기적으로 여전히 NULL 을 적재한다는 점만 인지.

- **[INFO]** IE resume `llmContext` 는 여전히 `state.executionId` 단일 필드로 전체 attribution 객체 유무를 게이팅
  - 위치: `information-extractor.handler.ts:891-897` — `llmContext: state.executionId ? { executionId, workflowId: state.workflowId, nodeExecutionId: state.nodeExecutionId } : undefined`
  - 상세: 이 게이트 패턴 자체는 이번 diff 이전부터 존재(`state.executionId ? {...} : undefined`)하며 이번 변경은 그 안에 `workflowId`/`nodeExecutionId` 필드만 추가했다. `executionId` 는 정상 실행 경로에서 항상 존재하는 값이라 실질 발동 가능성은 낮지만, 이론상 `executionId` 가 falsy 이고 `workflowId`/`nodeExecutionId` 만 있는 상태라면 전체 attribution 객체가 통째로 `undefined` 로 떨어져 세 컬럼 모두 NULL 이 된다(부분 채움 불가). 이번 PR 이 새로 도입한 리스크는 아니고 기존 게이트 구조를 그대로 재사용한 것.
  - 제안: 현행 유지로 충분(별도 조치 불요). 후속으로 게이트를 `state.executionId || state.workflowId || state.nodeExecutionId` 처럼 완화하면 부분 attribution 도 살릴 수 있으나 이번 PR 범위 밖.

- **[INFO]** `ai-turn-executor.ts` 신규 `llmContext` 객체가 동일 참조로 두 번의 `llmService.chat()` 호출(메인 + tool-loop 후속)에 재사용됨
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2591-2606`(선언), `:2727-2761`(두 번째 `chat(...)` 호출에서 재사용)
  - 상세: `LlmService.chat(config, params, context, opts)` 구현(`llm.service.ts:154-197`)을 직접 확인한 결과 `context` 는 `usageLogService.record({...})` 인자 구성에만 읽기 전용으로 쓰이고 mutate 되지 않는다(`llm-usage-log.service.ts`의 `record` 호출은 fire-and-forget, `void this.usageLogService.record(...)`). 따라서 동일 객체를 여러 호출 간 재사용해도 상태 오염(cross-call contamination) 위험 없음.
  - 제안: 조치 불요. 정보성 확인.

- **[INFO]** `execution-engine.service.ts` 변경은 순수 주석 2줄 추가 — 런타임 동작·시그니처·리턴값 변경 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4910-4913`(`buildRetryReentryState` 내부)
  - 상세: `buildRetryReentryState(execution, node, context, retryState, opts?)` 시그니처 불변, 로직 불변. `llm_usage_log` 소비처를 문서화하는 주석만 추가됐다.
  - 제안: 조치 불요.

- **[INFO]** `LlmService.chat` 3번째 인자(`LlmCallContext`, optional)는 이미 존재하던 시그니처 — 이번 diff 는 새 파라미터를 추가한 것이 아니라 기존에 생략되던 인자를 두 호출 사이트에서 채워 넣은 것
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:154-159`(`async chat(config, params, context?, opts?)`), `ai-turn-executor.ts:2600-2605`·`2757-2761`(신규로 3번째 인자 전달)
  - 상세: 함수 시그니처 자체는 불변이라 기존 호출자(단일 턴 경로 등)에 영향 없음. resume 경로가 이제 이미 존재하던 optional 파라미터를 채우는 형태라 하위 호환 파괴 없음.
  - 제안: 조치 불요.

- **[INFO]** `MultiTurnState`(IE) interface 에 추가된 `workflowId?`/`nodeExecutionId?` 는 `resume-state.schema.ts`(#877) 에 이미 등재된 필드를 소비만 함 — 신규 직렬화 계약 없음
  - 위치: `information-extractor.handler.ts:150-158`(interface), `:1846-1852`(`hydrateState`)
  - 상세: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 에 두 필드가 이미 optional 로 등재돼 있어(직접 확인) 이번 PR 은 스키마 변경 없이 소비 로직만 추가했다. `hydrateState` 는 캐스트 기반이라 필드 부재 시 throw 없이 `undefined` 로 graceful degrade.
  - 제안: 조치 불요.

- **[INFO]** 본 diff 에 `review/code/2026/07/10/01_46_28/**` · `review/consistency/2026/07/10/01_46_28/**` 산출물(SUMMARY.md, RESOLUTION.md, security.md 등 12개+ 파일)과 `plan/in-progress/resume-llm-usage-attribution.md` 신규 파일이 함께 커밋됨
  - 위치: 파일 8~26 (review 산출물 일체)
  - 상세: 이 파일들은 애플리케이션 런타임 코드가 아니라 이전 `/ai-review`·`/consistency-check` 실행의 산출물이며, `CLAUDE.md` 의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약에 따라 의도적으로 저장소에 커밋되는 대상이다. 애플리케이션 코드가 예상치 못하게 파일을 쓰는 부작용이 아니라 프로젝트 워크플로가 명시적으로 요구하는 아티팩트 저장이므로 side-effect 관점에서 문제 없음.
  - 제안: 조치 불요. (documentation/scope 관점 별도 검토 대상이며 side_effect 범위 밖.)

## 요약

이번 diff 는 이미 존재하던 "첫 턴은 `context.*`, resume 턴은 재구성 `state.*`" 대칭 패턴을 두 소비 사이트(Information Extractor resume `llmContext` 조립, AI Agent resume 메인/후속 chat 2곳)에 적용한 국소적 버그 수정이며, 신규 전역 상태·신규 파일시스템 부작용(애플리케이션 코드 관점)·환경변수 접근·외부 네트워크 호출·이벤트/콜백 변경을 도입하지 않는다. `LlmService.chat` 은 기존에도 3번째 인자로 `LlmCallContext` 를 받는 시그니처였으므로 새 파라미터 추가가 아니라 기존에 생략되던 인자를 채운 것이고, 코드로 직접 확인한 결과 `chat()` 내부는 그 값을 읽기 전용으로 usage-log 기록에만 사용해(fire-and-forget) 여러 호출 간 동일 객체 재사용도 안전하다. `MultiTurnState`(IE)에 추가된 optional 필드 2개는 이미 존재하던 `resume-state.schema.ts`(#877) 등재분을 소비만 하므로 직렬화 계약 변경도 없다. 실질적인 "부작용"은 향후 `llm_usage_log.workflow_id`/`node_execution_id` 컬럼에 적재되는 값의 의미가 (오적재 → 정상 적재 / NULL → 정상 적재로) 바뀐다는 점인데, 이는 CHANGELOG·spec 에 명시된 의도된 버그 수정이고 `statistics.service.ts` 등 `workflow_id` 필터링 하류 쿼리와의 정합성도 grep 으로 확인해 은닉된 부작용으로 보지 않는다. `execution-engine.service.ts` 변경은 순수 주석이라 무해하며, diff 에 포함된 `review/**`·`plan/**` 신규 파일들은 프로젝트 컨벤션이 요구하는 리뷰 산출물 저장으로 애플리케이션 부작용이 아니다. 시그니처·공개 인터페이스 파괴, 의도치 않은 상태 변경, 콜백/이벤트 변경은 발견되지 않았다.

## 위험도

LOW
