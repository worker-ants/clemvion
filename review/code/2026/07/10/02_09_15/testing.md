# 테스트(Testing) 리뷰

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 버그 수정 — Information Extractor `node_execution_id` 오적재 교정 + AI Agent(`ai-turn-executor.ts`) resume 메인 chat 2곳 `LlmCallContext` 배선. 실행 확인: `codebase/backend` 에서
`npx jest src/nodes/ai/ai-agent/ai-turn-executor.spec.ts src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` 직접 재실행 — 2 suites / 66 tests 전부 통과 확인.

이 diff 에는 이전 리뷰 라운드(`review/code/2026/07/10/01_46_28/`)의 산출물(SUMMARY/RESOLUTION/각 리뷰어 파일)도 신규 파일로 포함돼 있으나, 그 라운드의 testing.md 가 낸 INFO#3(tool-loop 2번째 chat 호출 미검증)이 본 라운드 diff 에서 `ai-turn-executor.spec.ts` 에 직접 assertion 추가로 반영된 것을 실코드로 확인했다(아래 발견사항 참고 — 그 fix 자체는 적절).

## 발견사항

- **[INFO]** IE `runTurnWithCollectionRetries` 의 collection-retry 루프도 AI Agent tool-loop 와 동일하게 단일 `llmContext` 를 여러 `traceChat` 호출에 재사용하지만, 그 재사용을 직접 검증하는 테스트가 없음 (AI Agent 쪽만 이번에 보강됨 — 비대칭)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:993`(`llmContext?: LlmCallContext` 파라미터), `:1019-1038`(`for (;;)` 루프 내 `traceChat(..., params.llmContext)` 재사용) / 테스트: `information-extractor.handler.spec.ts:954-1120`(`describe('collection retry loop')`, `retryState()` 헬퍼와 그걸 쓰는 4개 테스트)
  - 상세: `ai-turn-executor.ts` 의 tool-call 루프는 이번 diff 에서 `calls[1][2]` 를 직접 단언하도록 보강됐다(`ai-turn-executor.spec.ts:519-532`, "ai-review INFO#3" 대응). 그런데 정확히 같은 형태의 리스크 — 루프 내 후속 LLM 호출이 attribution 을 계속 나르는지 — 를 갖는 IE 의 `runTurnWithCollectionRetries` `for(;;)` 루프는 이번 diff 에서 대칭적으로 보강되지 않았다. 실측 확인 결과 `collection retry loop` describe 블록의 `retryState()` 헬퍼(`information-extractor.handler.spec.ts:970-992`)는 `executionId`/`workflowId`/`nodeExecutionId` 를 전혀 포함하지 않고, 이 헬퍼를 쓰는 4개 테스트(`retryState()` 사용처 라인 971/1011/1028/1075/1101 부근) 중 어느 것도 이 필드들을 override 하지 않는다 — 즉 "2회 이상 chat 호출 + attribution 값 채움" 조합을 실행하는 테스트가 IE 쪽에는 전혀 없다(직접 grep 으로 확인). 코드 구조상(단일 참조 객체 재사용) 실질 회귀 위험은 낮지만, 바로 이 diff 가 "간접 커버는 불충분하니 직접 단언하자"는 판단을 AI Agent 쪽에 적용했던 논리가 IE 쪽에는 적용되지 않아 두 자매 핸들러 간 테스트 엄밀도가 비대칭해졌다.
  - 제안: 기존 `'feeds tool_result back and loops when finalize is called with missing required'` (2회 chat 호출, `information-extractor.handler.spec.ts:994-1019`) 의 `retryState()` 에 `executionId`/`workflowId`/`nodeExecutionId` override 를 추가하고, `mockLlmService.chat.mock.calls[1][2]` 에 대해 동일한 `objectContaining` 단언을 붙이면 낮은 비용으로 대칭을 맞출 수 있다.

- **[INFO]** `state.executionId` falsy-게이팅 삼항이 `llmContext` 전체를 `undefined` 로 떨어뜨리는 분기는 여전히 미검증(기존 방어 패턴, 이번 PR 로 도입된 회귀는 아님)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:891-897` (`llmContext: state.executionId ? { executionId, workflowId: state.workflowId, nodeExecutionId: state.nodeExecutionId } : undefined`)
  - 상세: `workflowId`/`nodeExecutionId` 가 채워져 있어도 `executionId` 가 없으면(이론상 `hydrateState`→`buildRetryReentryState` 경로에서 항상 채워지므로 실무 발생 가능성은 낮음) attribution 전체가 스킵된다. 이 게이팅 자체는 diff 이전부터 있던 기존 로직이라 이번 변경의 회귀는 아니며, 이전 라운드 requirement 리뷰에서도 이미 INFO 로 지적·"기존 방어 패턴, 선택"으로 처분됐다. 별도 조치 요구는 아니지만 여전히 미해결 상태임을 재확인.
  - 제안: 강제 아님. 후속으로 원한다면 `executionId` 단독 게이팅 대신 필드별 optional 전달로 바꾸고 그 분기를 테스트로 고정.

- **[INFO]** 신규 회귀 테스트를 기존 "toolCalls 카운팅" 테스트에 얹어 재사용 — 비용은 낮지만 실패 시 원인 구분이 즉각적이지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts:485-533` (`it('does not count condition tools toward toolCalls in multi-turn, only normal tools', ...)` 에 `calls[1][2]` attribution 단언 추가)
  - 상세: 별도 테스트를 새로 만들지 않고 이미 2회 `chat` 호출을 발생시키는 기존 시나리오에 assertion 을 얹은 선택은 셋업 중복을 피하는 합리적 트레이드오프다. 다만 테스트명이 "toolCalls 카운팅" 의도만 표현하므로, CI 실패 리포트만 보고 "attribution 회귀"인지 "카운팅 회귀"인지 즉시 구분하기는 어렵다(둘 다 같은 `it` 블록 안에서 실패로 보고됨).
  - 제안: 강제 아님. 원한다면 주석(이미 존재)을 유지하는 선에서 충분 — 테스트명까지 바꿀 필요는 없다고 판단.

- **[INFO]** attribution 검증은 `llmService.chat` 호출 인자(mock) 경계까지만 — `llm_usage_log` 실제 컬럼 매핑까지의 통합 테스트는 이번 diff 범위 밖(기존 관례·이전 라운드 requirement 리뷰가 end-to-end 코드 추적으로 이미 대체 확인함)
  - 위치: `ai-turn-executor.spec.ts` 신규 테스트, `information-extractor.handler.spec.ts` 신규 테스트 — 둘 다 `mockLlmService.chat.mock.calls[n][2]` 까지만 단언
  - 상세: `LlmCallContext → LlmService.chat → LlmUsageLogService.record → llm_usage_log` 컬럼 매핑 배선 자체는 이번 PR 의 genuine 증분이 아니라 기존 경로(PR #519)에 의존하므로 별도 통합 테스트 부재가 새로운 갭은 아니다. unit 레벨에서 "핸들러가 올바른 값을 올바른 인자 자리에 넘긴다"는 계약만 고정하는 것으로 이 PR 범위에서는 충분하다고 판단.

## 확인된 양호 사항

- **회귀 테스트 설계**: 두 신규 테스트 모두 `nodeId`(정의 id)와 `nodeExecutionId`(row PK)에 의도적으로 다른 값(`'node-def-1'` vs `'nodeexec-row-1'`)을 부여하고 `expect(llmContext.nodeExecutionId).not.toBe('node-def-1')` 로 실제 과거 버그(정의 id 오적재) 재발을 적극적으로 봉쇄한다 — 단순 happy-path 확인을 넘어 "혼동 가능한 두 값이 섞이지 않는다"를 직접 고정하는 좋은 패턴.
- **테스트 격리**: `ai-turn-executor.spec.ts`/`information-extractor.handler.spec.ts` 모두 `beforeEach` 에서 `mockLlmService`(`jest.fn()`)를 매번 새로 생성해 `.mock.calls` 잔류가 테스트 간 누수되지 않음을 코드로 확인.
- **회귀 방지**: 기존 테스트(`toolCalls` 카운팅, `max_turns` 라우팅, `hydrateState` round-trip 등)는 이번 diff 로 인해 깨지지 않으며, 직접 실행 결과로도 66/66 통과를 재확인했다. 새로 추가된 `state` override(`workflowId`/`nodeExecutionId`)는 관련 없는 기존 assertion(`toolCalls===1`, `chat` 호출 횟수 등)에 영향을 주지 않는 optional 필드라 회귀 위험이 낮다.
- **엔진 재주입 경계 확인**: `execution-engine.service.ts` `buildRetryReentryState` 가 매 재진입마다 `workflowId`/`nodeExecutionId` 를 무조건 덮어쓰므로(코드 확인: `workflowId: execution.workflowId, nodeExecutionId: opts?.nodeExecutionId`), 핸들러가 이전 턴에서 스스로 들고 있던 값의 "다회차 전파" 를 별도로 테스트할 필요는 없다 — 이 PR 의 유닛 테스트 스코프(핸들러가 주어진 state 값을 올바르게 소비하는지)가 적절하다.

## 요약

핵심 결함(IE resume 턴의 `node_execution_id` 오적재, AI Agent resume 메인 chat 의 `LlmCallContext` 미전달)에 대한 회귀 테스트 2건은 설계가 명확하고(정의 id vs row PK 를 의도적으로 다른 값으로 부여 + `not.toBe` 로 혼동 차단), 이전 라운드에서 지적된 "tool-loop 2번째 호출 간접 커버" 갭도 기존 테스트에 최소 비용으로 직접 assertion 을 추가해 해소했다. 다만 정확히 같은 논리(루프 내 단일 `llmContext` 객체의 다회차 재사용 검증)를 AI Agent 쪽에만 적용하고 대칭 구조인 IE 의 `runTurnWithCollectionRetries` 재시도 루프에는 적용하지 않아 두 자매 핸들러 간 테스트 엄밀도가 비대칭하다는 점이 이번 라운드에서 새로 확인한 갭이다. 그 외 `executionId` falsy 게이팅 미검증, DB 컬럼까지의 통합 테스트 부재는 기존에 이미 인지·처분된 저위험 항목으로 재확인 수준이다. 두 spec 파일 모두 fresh mock 재생성으로 테스트 격리가 보장되고, 직접 재실행 결과 66/66 전부 통과했다. 발견된 모든 항목이 INFO 수준이며 차단 사유는 없다.

## 위험도

LOW
