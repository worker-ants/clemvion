# Requirement 충족 리뷰 — B-track (B2 doc + B3 test + B4 typing) resume attribution 후속

대상: `CHANGELOG.md` · `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` ·
`codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` ·
`spec/5-system/4-execution-engine.md` (4 files, +65/-13, uncommitted diff, diff-base `origin/main`=HEAD).

## 발견사항

- **[INFO]** B4 타이핑 통일이 동일 함수(`processMultiTurnMessage`) 내 동일 필드(`nodeId`)의 1개
  사이트를 놓침 — `resumeState` 가 이미 스코프에 있는데도 raw cast 잔존
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2815`
    (`scheduleMemoryExtraction` 호출의 `selfNodeId: (state.nodeId as string) ?? ''`)
  - 상세: 이번 diff 는 동일 함수(`processMultiTurnMessage`, L2489-3420) 안에서 `nodeId` 필드를
    두 곳(`applyMultiTurnTurnMemory` 의 `selfNodeId`, `executeProviderToolBatch` 인자의 `nodeId`)
    에서 `state.nodeId as string` → `resumeState.nodeId` 로 교체했다. `resumeState`(L2509) 는
    이미 함수 스코프에 선언돼 있어 이 3번째 `scheduleMemoryExtraction` 호출(L2815)의
    `selfNodeId` 도 같은 리팩터를 적용할 수 있었는데 raw cast 그대로 남았다. `narrowResumeState`
    는 순수 타입 단언(`state as ResumeState`)이라 런타임 값은 `state.nodeId` 와 동일 —
    **행위 차이는 없다**. B4 가 스스로 선언한 목표("attribution·nodeId 는 ResumeState 로 좁혀
    타입 접근… 필드명 오탈자를 컴파일 타임 차단")를 이 한 사이트에서만 완전히 달성하지 못한
    완결성 갭.
  - 제안: blocking 아님(behavior-preserving, 기능 결함 없음). 후속에서
    `selfNodeId: resumeState.nodeId ?? ''` 로 정리하면 B4 목표가 함수 전체에서 완결된다.

- **[INFO]** plan 체크리스트가 전부 미체크 상태로 남아 있음 (진행 중 표기)
  - 위치: `plan/in-progress/llm-usage-resume-followups.md` (모든 `- [ ]` 항목)
  - 상세: 코드/스펙/테스트 diff 는 plan 이 정의한 B2/B3/B4 3개 세트를 실제로 모두 구현·검증
    완료한 상태(테스트 통과·tsc clean 확인됨)이나, plan 파일 자체의 체크박스는 아직 갱신 전.
    라이프사이클 상 PR 직전 갱신되는 정상 흐름일 수 있어 결함은 아님.
  - 제안: PR/커밋 직전 plan 체크리스트를 실제 완료 상태로 갱신(관례상 통상 절차).

## 검증 근거 (직접 재현)

- `npx tsc -p tsconfig.build.json --noEmit` → 0 errors (B4 타이핑 교체가 `ResumeState`
  필드 형과 소비처 형을 정확히 만족).
- `npx jest information-extractor.handler.spec.ts ai-turn-executor.spec.ts` → 2 suites, 67
  tests 전부 pass (B3 신규 테스트 포함).
- `npx eslint ai-turn-executor.ts` diff 전/후 비교 → 동일 7건 pre-existing warning(라인 번호만
  +4 shift), 신규 warning/error 없음.
- B3 신규 테스트 로직 추적: `information-extractor.handler.ts:891-897`
  (`processMultiTurnMessage` → `state.executionId` truthy 시 `llmContext` 조립) →
  `runTurnWithCollectionRetries`(L981-1038, `for(;;)` 매 iteration `traceChat(..., params.llmContext)`)
  → `traceChat`(L1881-1899, `llmService.chat(llmConfig, params, llmContext, {signal})` — 3번째
  인자가 `LlmCallContext`) → 테스트의 `mock.calls[1][2]` 단언과 시그니처 일치. 회귀 시나리오
  (`nodeId` 오사입 방지) 도 `not.toBe('node-def-cr')` 로 커버.
- B2 doc 정정의 사실관계 확인: `grep -i "processMultiTurnMessage\|resume\|multiTurn"
  text-classifier.handler.ts` → 0 hits(Text Classifier 는 실제로 단발, resume 경로 없음).
  변경된 문장은 이미 SoT 인 `spec/data-flow/7-llm-usage.md` §1.3(L105-113, L195-203)의 기존
  구분("멀티턴(AI Agent/IE)은 첫 턴·resume 턴, Text Classifier 는 단발")과 정확히 대칭 —
  진짜 오기 정정이며 SPEC-DRIFT 케이스 아님(코드 신규 동작 없음, 문서만 SoT 에 맞춤).
- B4 behavior-preserving 확인: `narrowResumeState(state)` 는 `return state as ResumeState;`
  뿐(런타임 무연산) — `resumeState.workflowId` 등은 `state.workflowId` 와 동일 참조/값.
  `ResumeState`(`resume-state.schema.ts` L110-142, `.partial().catchall(z.unknown())`)에
  `workflowId`/`executionId`/`nodeExecutionId`/`nodeId` 가 모두 optional string 으로 존재해
  기존 `as string | undefined` 캐스트와 타입 동치.
- CHANGELOG 문구/스펙 표 형식(마크다운 테이블 셀) 무결성 확인 — 행 구조 파손 없음.

## 요약

B2(doc)·B3(test)·B4(typing) 세 변경 모두 선언한 목적을 정확히 달성한다. B2 는 `spec/5-system/
4-execution-engine.md` §6.1 표와 `CHANGELOG.md` 서술을 이미 정확했던 SoT(`7-llm-usage.md §1.3`)
및 실제 코드(Text Classifier 에 `processMultiTurnMessage` 부재)에 맞춰 정밀화하는 순수 문서
정정이며 spec 본문과의 불일치는 이 diff 로 오히려 해소된다. B3 은 기존에 코드가 이미 올바르게
동작하던 `runTurnWithCollectionRetries` 의 2번째(재시도) chat attribution 을 처음으로 회귀
고정하는 테스트로, 대상 traceChat/llmService.chat 시그니처와 정확히 대응하며 실제로 pass 한다.
B4 는 raw `state.X as string|undefined` 캐스트를 기존 `narrowResumeState` 접근으로 교체하는
behavior-preserving 리팩터로, tsc/lint/test 모두 diff 전후 동일하게 clean 함을 직접 재현
확인했다. 유일한 흠은 동일 함수 내 동일 `nodeId` 필드의 1개 잔여 raw cast 사이트(L2815)가
이번 리팩터에서 빠진 완결성 갭이며, 이는 순수 타입 단언이라 런타임 동작에는 영향이 없다.
Critical/Warning 급 기능·엣지케이스·에러시나리오·spec fidelity 문제는 발견되지 않았다.

## 위험도

LOW

STATUS=success ISSUES=2 PATH=/Volumes/project/private/clemvion/.claude/worktrees/llm-usage-resume-followups/review/code/2026/07/11/00_58_46/requirement.md RESET_HINT=
