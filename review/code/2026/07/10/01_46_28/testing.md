# 테스트(Testing) 리뷰

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 버그 수정 (Information Extractor `node_execution_id` 오적재 + AI Agent resume 메인 chat `LlmCallContext` 미전달)

실행 확인: `codebase/backend` 에서 `npx jest src/nodes/ai/ai-agent/ai-turn-executor.spec.ts src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` → 2 suites / 66 tests 전부 통과.

## 발견사항

- **[INFO]** ai-turn-executor.ts 의 두 번째 `llmService.chat` 호출부(도구 실행 루프 후속 호출)는 신규 테스트로 직접 검증되지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`processMultiTurnMessage` 내 `llmContext` 선언부 및 두 호출 사이트, diff 라인 ~2591·~2743) / `ai-turn-executor.spec.ts` 신규 테스트 `'passes llmContext (workflowId/executionId/nodeExecutionId row PK) to the resume-turn LLM chat'` (라인 629-653)
  - 상세: 이번 fix 는 `processMultiTurnMessage` 내에서 물리적으로 다른 두 곳의 `llmService.chat(...)` 호출(① 사용자 메시지 수신 직후 메인 chat, ② provider-tool 실행 후 루프 재호출)에 각각 `llmContext` 를 전달하도록 고쳤다. 신규 회귀 테스트는 `mockLlmService.chat.mock.calls[0][2]`(첫 번째 호출)만 검증하고, 두 번째 호출(`calls[1][2]`)의 context 는 검증하지 않는다. 현재는 두 호출부가 동일한 지역변수 `llmContext` 를 참조하므로 실제 회귀 위험은 낮지만, 향후 리팩터링으로 두 호출부의 context 계산이 분리되면 두 번째 호출의 attribution 누락을 이 테스트만으로는 못 잡는다. 파일 내 기존 tool-loop 테스트(`'does not count condition tools toward toolCalls in multi-turn...'` 등, 2회 chat mock 사용)가 이미 이 경로를 실행 중이므로, 거기에 `calls[1][2]` assertion 을 추가하는 비용이 낮다.
  - 제안: 기존 2-call tool-loop 테스트(또는 신규 attribution 테스트를 도구 호출이 있는 시나리오로 확장)에서 `calls[1][2]` 도 `objectContaining({ workflowId, executionId, nodeExecutionId })` 로 고정.

- **[INFO]** 레거시(배포 이전) 영속 resume/retry state — `workflowId`/`nodeExecutionId` 부재 시 graceful degrade 경로 미검증
  - 위치: `ai-turn-executor.spec.ts` `resumeState()` 헬퍼(라인 588-607), `information-extractor.handler.spec.ts` `buildState()` 헬퍼(라인 2027-2052) — 둘 다 기본값에 `workflowId`/`nodeExecutionId` 를 포함하지 않음
  - 상세: 이번 배포 이전에 DB 에 영속된 `_resumeState`/`_retryState` JSONB 는 신규 필드(`workflowId`/`nodeExecutionId`)를 담고 있지 않다. 배포 직후 그런 레거시 체크포인트가 resume 되면 `state.workflowId`/`state.nodeExecutionId` 가 `undefined` 인 채로 `llmContext` 가 구성된다(예외 없이 undefined → NULL 로 조용히 저하). 두 스펙 파일 모두 이 케이스를 실행은 하지만(대부분의 기존 테스트가 override 없이 헬퍼를 그대로 씀) attribution 필드에 대한 명시적 assertion 은 신규 테스트에만 있고, 그 신규 테스트는 반대로 필드가 채워진 경우만 다룬다. "필드 부재 시 크래시 없이 undefined 로 저하한다"를 명시적으로 고정하는 테스트가 없다.
  - 제안: `llmContext.workflowId`/`nodeExecutionId` 가 `undefined` 인 케이스(override 없는 기본 state)에 대해 "throw 하지 않고 undefined 로 전달됨"을 고정하는 테스트 1개씩 추가하면 배포 직후 하위호환 회귀를 더 명시적으로 방어.

- **[INFO]** unit 레벨 검증에 그침 — `llm_usage_log` 실제 DB row 적재까지의 e2e/integration 회귀 테스트는 이번 diff 범위 밖
  - 위치: 전체 diff(`ai-turn-executor.spec.ts`, `information-extractor.handler.spec.ts`)
  - 상세: 신규 테스트는 `llmService.chat` 에 전달되는 3번째 인자(`LlmCallContext`)까지만 검증한다. `LlmService.chat → LlmUsageLogService.record` 가 이 context 를 실제 `llm_usage_log.workflow_id`/`node_execution_id` 컬럼에 매핑하는 배선 자체는 이번 PR 의 genuine 증분이 아니라 이미 존재하는 경로(PR #519)에 의존한다고 plan 문서에 명시돼 있으므로 별도 검증이 필수는 아니다. 다만 이 버그의 원 증상이 "§4.6 활동 탭 공백 / attribution 오적재"라는 사용자 가시적 데이터 정합성 문제였던 만큼, DB row 까지 고정하는 통합 테스트가 있었다면 회귀 방어가 한 단계 더 강했을 것.
  - 제안: 필수는 아님. 이미 존재하는 `LlmUsageLogService`/`LlmService.chat` 레벨 테스트가 context→컬럼 매핑을 커버하는지만 별도로 확인 권장(이번 리뷰 범위에서는 미확인).

## 요약

두 소비 사이트(Information Extractor resume 턴, AI Agent resume 메인 chat)에 대해 과거 버그(`nodeId`(정의 id)를 `nodeExecutionId`(row PK) 자리에 오적재)를 정확히 재현·방지하는 명확한 회귀 테스트가 추가됐고, `not.toBe(정의 id)` assertion 으로 혼동 가능성을 적극적으로 차단한 점이 인상적이다. 두 스펙 파일 모두 기존 헬퍼(`resumeState`/`buildState`)를 재사용해 중복 없이 작성됐고, `objectContaining` 사용으로 향후 필드 추가에도 깨지지 않는 유연한 assertion 이며, 직접 실행 결과 66개 테스트 전부 통과했다. 다만 (1) `ai-turn-executor.ts` 의 두 번째 chat 호출 사이트(tool-loop 후속 호출)는 동일 변수 재사용에 의존해 간접적으로만 커버되고, (2) 배포 이전 영속 레거시 state(신규 필드 부재)의 graceful-degrade 경로가 명시적으로 고정되지 않았다는 두 가지 갭이 있다 — 둘 다 현재 코드 구조상 실질 회귀 위험은 낮은 INFO 수준이다.

## 위험도

LOW
