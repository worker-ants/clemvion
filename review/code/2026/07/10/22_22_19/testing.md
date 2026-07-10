# 테스트(Testing) 리뷰

대상: AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선
(`ai-memory-manager.ts` / `agent-memory-injection.ts` / `ai-turn-executor.ts` +
관련 spec 3건 + CHANGELOG/plan)

## 발견사항

- **[WARNING]** multi-turn resume 경로의 실제 `state.*` → attribution 조립이 값 단위로
  end-to-end 검증되지 않음 (single-turn 은 되어 있음 — 비대칭)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2296-2302`
    (`applyMultiTurnTurnMemory` 의 `llmContext: { workflowId: state.workflowId, executionId, nodeExecutionId: state.nodeExecutionId }`)
  - 상세: single-turn 경로(`applySingleTurnMemoryInjection`, `ai-turn-executor.ts:1162-1167`)는
    `ai-agent.memory.spec.ts:458-521`(`'compresses oldest turns + sets runningSummary when over budget'`)이
    `handler.execute(...)` 를 실제 실행해 `mockLlmService.chat.mock.calls[0][2]` 가
    `context.workflowId`/`context.executionId`/`context.nodeExecutionId` 값과 일치하는지
    **값 단위로 end-to-end** 검증한다(테스트 주석에도 "ai-review Critical#1" 회귀 고정으로 명시).
    반면 대칭 경로인 multi-turn resume 은 이런 end-to-end 값 검증이 없다:
    - `ai-agent.memory.spec.ts:292-393`("multi-turn: summary 압축이 진행되면...")가
      `processMultiTurnMessage` 를 통해 `applyMultiTurnTurnMemory` 를 실제로 두 번(turn1/turn2)
      타면서 요약 압축이 실제 발생함을 확인하지만, `mockLlmService.chat.mock.calls[...][2]`
      (attribution 인자)는 전혀 assert 하지 않는다.
    - `ai-memory-manager.spec.ts:479-521`(새로 추가된 "multi-turn(system-only) 압축 시 요약 chat 에
      caller 의 llmContext 를 그대로 전달한다")는 `llmContext` 를 **테스트 코드가 직접 리터럴로
      구성**(`{ workflowId: 'wf-x', executionId: 'exec-x', nodeExecutionId: 'ne-row-x' }`)해
      `injectMemoryContext` 인자로 주입한 뒤 그대로 전달되는지만 본다 — `ai-turn-executor.ts`
      의 실제 `state.workflowId`/`state.nodeExecutionId` 추출·조립 로직은 전혀 거치지 않는다.
    - `ai-turn-executor.spec.ts:445-469`("passes llmContext ... to the resume-turn LLM chat")는
      `resumeState()` 의 기본값이 `memoryStrategy: 'manual'` 이라 `memoryManager` 자체를
      호출하지 않는 **메인 chat** 만 검증한다 (요약 압축 chat 경로는 타지 않음).
    결과적으로 이번 diff 가 신설한 `ai-turn-executor.ts:2296-2302` 리터럴(요약 압축 attribution 조립)은
    어떤 테스트도 실제 값으로 왕복 검증하지 않는다. 이 프로젝트에서 바로 이 종류의 버그
    (필드는 맞는 이름인데 잘못된 소스 값을 대입 — 예: `nodeExecutionId` 자리에 `nodeId`(정의 id)를
    넣는 실수)가 Information Extractor 에서 실제로 발생해 별도 PR(`resume-llm-usage-attribution`,
    커밋 `2db810893`)로 고쳐진 전례가 있어 (`plan/in-progress/resume-llm-usage-attribution.md`
    "배경/결함" §1 참고), 같은 클래스의 회귀가 여기서도 조용히 통과할 수 있다. TS 구조적 타입
    (excess-property check)은 필드 오탈자는 잡아도 "올바른 필드명에 잘못된 값" 은 잡지 못한다.
  - 제안: `ai-agent.memory.spec.ts:292` 의 기존 multi-turn `summary_buffer` 테스트(또는 신규 테스트)에
    `context = makeContext({ workflowId: 'wf-1', nodeExecutionId: 'ne-row-1' })` 를 쓰고, turn1/turn2
    의 요약 chat 호출(`mockLlmService.chat.mock.calls[0][2]`, `calls[2][2]` 등 — queueSummary/queueAnswer
    순서 기준)이 `{ workflowId: 'wf-1', executionId: 'exec-1', nodeExecutionId: ... }` 를 담는지
    single-turn 테스트(513-520행)와 대칭으로 단언을 추가한다. 이렇게 하면 `applyMultiTurnTurnMemory`
    의 실제 조립 로직까지 실값으로 왕복 검증된다.

- **[INFO]** `ai-memory-manager.spec.ts` 신규 테스트의 주석이 실제 커버리지를 과장 서술
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.spec.ts:124-126` (전체 파일 컨텍스트 기준 479-481행)
  - 상세: 주석이 "multi-turn resume 경로(`state.*` 조립)는 여기서 `injectMemoryContext`→요약 chat
    forwarding 을 고정한다" 라고 적혀 있지만, 실제 테스트는 `state.*` 를 전혀 다루지 않고
    호출자가 미리 만들어 둔 임의의 `llmContext` 객체가 `AiMemoryManager` 내부에서 손실 없이
    전달(forward)되는지만 검증한다. "resume=state.* 조립" 이라는 문구가 위 WARNING 에서 지적한
    갭(실제 `state.workflowId`/`state.nodeExecutionId` 추출 로직 검증)이 이미 커버된 것처럼 읽혀
    향후 리뷰/개발자가 이 갭을 재발견하지 못하게 할 위험이 있다.
  - 제안: 주석을 "AiMemoryManager 가 caller 로부터 받은 llmContext 를 요약 chat 에 손실 없이
    forward 하는지만 검증 — `ai-turn-executor.ts` 의 실제 `state.*` 추출/조립 자체는 별도
    커버리지 필요" 등으로 범위를 명확히 하거나, 위 WARNING 의 수정과 함께 실제 커버리지를
    보강해 주석 내용을 사실과 일치시킨다.

- **[INFO]** attribution 필드 검증에 `toMatchObject` 사용 (엄격도 낮음)
  - 위치: `ai-agent.memory.spec.ts:516` (`expect(mockLlmService.chat.mock.calls[0][2]).toMatchObject({...})`)
  - 상세: 같은 PR 의 다른 동형 테스트들(`agent-memory-injection.spec.ts` 신규 테스트,
    `ai-memory-manager.spec.ts` 신규 테스트, `ai-turn-executor.spec.ts:460`)은 `toEqual`
    (또는 `expect.objectContaining` 명시)을 쓰는데 이 테스트만 `toMatchObject` 를 써서, 만약
    `LlmCallContext` 조립 시 의도치 않은 여분 필드가 섞여 들어가도(예: 다른 속성을 spread 로
    같이 넘기는 실수) 이 테스트는 이를 놓친다. 위험도는 낮음(다른 계층에서 `LlmCallContext`
    타입 자체가 3필드로 제한돼 있어 컴파일 타임에 어느 정도 방지됨) — 우선순위 낮은 일관성
    이슈로만 표기.
  - 제안: 다른 신규 테스트들과 통일해 `toEqual` 로 좁히거나, 의도적으로 permissive 하게 두는
    이유를 주석으로 남긴다.

## 요약

이번 diff 는 AI Agent 자동 메모리 롤링 요약 압축 chat 의 `llm_usage_log` attribution 배선을
single-turn(`context.*`)과 multi-turn resume(`state.*`) 양쪽에 추가하면서, `buildSummaryBufferUpdate`
→ `AiMemoryManager.injectMemoryContext` 각 계층의 forwarding 은 spec으로 촘촘히 고정했고, 특히
single-turn 은 실제 핸들러 실행 경로를 관통하는 값 단위 회귀 테스트(과거 Critical#1 재발 방지)까지
갖춰 모범적이다. 다만 대칭이어야 할 multi-turn resume 경로는 `ai-turn-executor.ts` 안에서 신설된
`state.workflowId`/`state.nodeExecutionId` 조립 리터럴 자체를 실값으로 왕복 검증하는 테스트가 빠져
있고, 그 공백을 메우는 것처럼 읽히는 신규 `ai-memory-manager.spec.ts` 테스트는 실제로는 forwarding
계층만 검증해 커버리지가 있는 것처럼 보이는 사각지대를 만든다. 이 프로젝트에 동일 클래스의 attribution
오배선 버그가 실제로 재발한 전례(IE `nodeId`↔`nodeExecutionId` 혼용)가 있는 만큼, 값 단위 회귀 테스트를
multi-turn 경로에도 대칭으로 추가할 것을 권고한다. 그 외 mock 격리·가독성·회귀 테스트 유효성은 전반적으로
양호하다.

## 위험도

MEDIUM
