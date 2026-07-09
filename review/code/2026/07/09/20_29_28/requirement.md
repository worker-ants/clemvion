# 요구사항(Requirement) 리뷰 결과

## 대상

`fix-resume-turn-usage-log-attribution` — 멀티턴 AI 에이전트 resume(2턴+) 턴에서
cafe24/makeshop/mcp provider-tool 실행이 `integration_usage_log` 에 기록되지 않던
회귀(#501, 커밋 `5e0c5e449`)를 `buildRetryReentryState` 가 `workflowId`/`nodeExecutionId`
를 재주입하도록 수정. 6개 코드/테스트 파일 + 신규 plan 문서 1건.

## 검증 방법

- 각 diff 라인을 실제 전체 파일 컨텍스트로 대조.
- 소비처(`ai-turn-executor.ts:2684-2685`, `cafe24-mcp-tool-provider.ts:500,541`)를
  직접 열어 `if (ctx.nodeExecutionId && ctx.workflowId)` 게이트와 `state.nodeExecutionId`
  / `state.workflowId` read 경로를 추적.
- turn-1 최초 state 구성(`ai-turn-executor.ts:1932-1935`, `context.nodeExecutionId`/
  `context.workflowId` 유래)과 resume 재구성(`buildRetryReentryState`)의 비대칭이
  실제로 회귀의 root cause 인지 대조 확인.
- `buildResumeCheckpoint`(DB 영속 allow-list, `execution-engine.service.ts:5008`)에
  `workflowId`/`nodeExecutionId` 가 원래도 없었음을 확인 — 이번 수정이 영속 정책을
  건드리지 않고 재구성 단계만 보강함을 검증.
- `nodeExec: NodeExecution | null` 타입(`resume-turn-dispatch.ts:69`)이 실제 AI
  dispatch 경로(`driveResumeAwaited`/`driveResumeFrame` innermost)에서 항상 non-null
  로 타입 좁혀짐을 호출부 추적으로 확인(`execution-engine.service.ts:1998`,`2182`).
- `nodeExecutionId&&ctx.workflowId` 요구가 spec `INT-US-05`(§4.6 Recent activity,
  `spec/4-nodes/4-integration/_product-overview.md` §2.4)와 `spec/4-nodes/4-integration/
  0-common.md` §4 6단계("성공·실패 무관 `logUsage` 호출 의무")에 정의된 요구사항임을 확인.
- `npx jest --testPathPatterns="execution-engine.service.spec|ai-turn-orchestrator.service.spec|retry-turn.service.spec"`
  전량 통과(464/464). 신규 회귀 테스트(`#501 regression`) 단독 실행도 통과.
- `npx eslint` 대상 5개 파일 — 사전 존재 warning 5건뿐(변경 라인과 무관, 신규 에러 0).

## 발견사항

- **[INFO]** 회귀 재구성기 호출부(`handleAiResumeTurn` / `applyRetryLastTurn`)의
  실제 인자 전달(`nodeExecutionId: ctx.nodeExec?.id`, `{ nodeExecutionId: spawnedRow.id }`)은
  mock 기반 spec(`ai-turn-orchestrator.service.spec.ts`, `retry-turn.service.spec.ts`)에서
  `driver.buildRetryReentryState`가 어떤 인자로 호출됐는지 단언하지 않는다 — driver 가
  전부 mock 이라 `toHaveBeenCalledWith(..., { nodeExecutionId: ... })` 류 assertion 이 없다.
  재구성 로직 자체(`buildRetryReentryState`)는 `execution-engine.service.spec.ts` 의 신규
  `#501 regression` 테스트로 직접 인스턴스 호출해 견고하게 검증되지만, "호출부가 실제로
  그 값을 넘긴다"는 배선(wiring)은 소스 읽기로만 확인했고 회귀 감지용 자동 테스트가 얇다.
  - 위치: `ai-turn-orchestrator.service.spec.ts` (`makeMockDriver` 의 `buildRetryReentryState`),
    `retry-turn.service.spec.ts:75,448`
  - 제안: 두 spec 파일에 `expect(driver.buildRetryReentryState).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ nodeExecutionId: <expected> }))` 류 assertion 1건씩 추가하면 향후 배선 회귀를 조기 포착 가능(선택적 개선, 이번 PR을 막을 사유는 아님 — 현재 구현은 코드 리딩으로 정확함을 확인).

- **[INFO]** (diff 범위 밖, 참고용) `information-extractor.handler.ts:875-881` 의 resume
  경로 `llmContext` 구성이 이번 수정과 같은 클래스의 문제(§1.3 usage-log attribution)를
  갖고 있어 보인다: `llmContext: { executionId: state.executionId, nodeExecutionId: state.nodeId }`
  — `nodeExecutionId` 에 `state.nodeId`(노드 **정의** id)가 들어가고 있어 `state.nodeExecutionId`
  (row PK, 이번 PR 로 `buildRetryReentryState` 가 재주입하기 시작한 바로 그 필드)와 다르다.
  또한 `workflowId` 자체가 `llmContext` 에 전혀 전달되지 않는다(주석 "workflowId 는 state 에
  없어 null, 추후 개선 가능"도 이번 PR 이후엔 `state.workflowId` 가 실제로 채워지므로 stale).
  이 경로는 cafe24/makeshop MCP tool 사용 로그가 아니라 information_extractor 의 LLM 호출
  자체 usage attribution(`spec/5-system/3-llm.md` §1.3)이라 이번 diff 의 파일 목록에
  포함되지 않았고, 이번 PR의 정확성 판정에는 영향이 없다. 다만 root-cause narrative
  (#501 이 같은 클래스의 attribution 갭을 다수 남겼을 가능성)와 결이 같아 후속 조치 후보로
  기록해 둔다.
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:875-881`
  - 제안: 별도 plan/이슈로 `nodeExecutionId: state.nodeExecutionId`, `workflowId: state.workflowId`
    보강 검토(현재 PR의 스코프 확장 불필요, 후속 추적만 권고).

- **[INFO]** plan 체크리스트의 `8. TEST WORKFLOW — e2e[ ]`, `9. REVIEW WORKFLOW` 가 아직
  미완료(`in-progress`)로 정확히 반영돼 있다 — 이는 결함이 아니라 현재 시점 상태를
  정직하게 기록한 것(허위 완료 체크 없음). 본 리뷰가 그 9번 항목의 일부.

## Spec fidelity

- `spec/4-nodes/4-integration/_product-overview.md` §2.4 (`INT-US-05`) 와
  `spec/4-nodes/4-integration/0-common.md` §4 6단계("성공·실패 무관 `logUsage` 호출",
  "AI Agent Internal Bridge MCP provider" 도 대상 명시)와 line-level 로 일치 — 이번 수정은
  spec 을 변경하지 않고(“spec_impact: none” 타당), 이미 spec 이 요구하던 동작(resume turn
  에서도 usage 기록 의무)을 구현이 실수로 놓쳤던 것을 복구한다. **코드가 틀렸었고 spec 이
  옳았던 케이스** — CRITICAL 이 아니라 이미 수정 완료된 상태로 리뷰됨. SPEC-DRIFT 아님.
- `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS`(`resume-state.schema.ts`) 갱신은
  기존 파일 상단의 라이프사이클 주석("DB 미영속 context-binding 필드")과 정합 — `nodeExecutionId`
  가 `.partial().catchall()` 스키마에 optional 로 추가되고 checkpoint allow-list 에서는
  제외 리스트(`CREDENTIAL_CONTEXT_FIELDS`)에 들어가 "persist 금지" 의도가 코드로 정확히
  반영됨.

## 요약

`buildRetryReentryState` 가 resume turn 재구성 시 `workflowId`/`nodeExecutionId` 를
누락하던 회귀(#501)를 정확한 root-cause 진단에 따라 최소 스코프로 수정했다. 두 소비
경로(AI resume `handleAiResumeTurn`, retry-last-turn `applyRetryLastTurn`) 모두
빠짐없이 갱신했고, DB 영속 정책(checkpoint allow-list)은 건드리지 않아 사이드이펙트가
없다. spec(`INT-US-05`, §4 6단계)과 line-level 로 정합하며, 신규 회귀 테스트가 실제로
버그를 재현/검증한다(전량 통과, 사전 결함 `svcMetrics` 오참조도 부수적으로 바로잡음).
발견된 이슈는 모두 INFO 수준 — call-site 배선에 대한 mock assertion 부재(테스트 커버리지
개선 여지)와 diff 범위 밖의 유사 클래스 갭(information_extractor LLM usage attribution)
뿐이며 이번 변경 자체의 정확성이나 완전성을 저해하지 않는다.

## 위험도

LOW
