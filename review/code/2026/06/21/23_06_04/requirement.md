# 요구사항(Requirement) Review — AiTurnExecutor 추출 (M-1 3단계)

## 발견사항

---

### **[WARNING]** 조건 도구 호출이 `processMultiTurnMessage` 에서 `toolCallCount` 에 산입됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` line 2153
- **상세**: spec `§1` 의 `maxToolCalls` 설명 "KB·MCP·일반 합산", `§7.1` 테이블 `meta.toolCalls` 설명 "KB·MCP·일반 도구 호출 횟수 합산 (**조건 도구 제외**)"이 명시적으로 조건 도구를 제외한다. 그런데 `processMultiTurnMessage` 의 `conditionToolCalls` 루프(line 2153)에서 `toolCallCount++` 가 실행되어 조건 도구 호출이 카운터에 포함된다.

  반면 `executeSingleTurn` 의 동일 루프(line 1257)에는 `// Condition tool: send deferral message (does not count toward toolCallCount).` 주석과 함께 카운터 증가가 없다. 두 경로 사이에 명백한 동작 불일치가 있다.

  파급 효과:
  1. `meta.toolCalls` 출력값이 spec 기술(조건 도구 제외)과 다르게 부풀어 노출됨.
  2. 조건 도구 + 비조건 도구 혼재 시 `maxToolCalls` 예산 소진이 빨라져 정상 tool provider 호출이 조기 truncate 될 수 있음.
  3. `executeSingleTurn` 과 `processMultiTurnMessage` 가 동일 비즈니스 규칙(조건 도구 제외)을 다르게 구현하는 분기.
- **제안**: `processMultiTurnMessage` 의 `conditionToolCalls` 루프에서 `toolCallCount++` 를 제거한다. `executeSingleTurn` 패턴과 동일하게 단순 deferral tool_result 회신만 수행하고 카운터를 건드리지 않는다.

---

### **[INFO] [SPEC-DRIFT]** spec frontmatter `code:` 에 `ai-turn-executor.ts` 미등재

- **위치**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` frontmatter lines 5–16
- **상세**: 리팩터링 결과 turn 실행 로직의 사실상 구현체가 `ai-turn-executor.ts` 로 이동했으나 spec frontmatter `code:` 배열에 `ai-agent.handler.ts` 만 등재되어 있다. `ai-condition-evaluator.ts`, `ai-memory-manager.ts`(M-1 1·2단계 신설)도 동일하게 미등재 상태다. plan `02-architecture.md §M-1` 의 "planner 후속(비차단 SPEC-DRIFT)" 항목으로 이미 인지된 사항이다.
- **제안**: 코드 유지 + spec 반영. `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 다음 세 항목 추가 필요 (project-planner 위임):
  - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`
  - `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts`
  - `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`

---

### **[INFO]** 단일 턴 tool 루프의 후속 LLM 호출에 `LlmCallContext` 미전달 (attribution gap)

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` line 1343
- **상세**: `executeSingleTurn` 의 첫 LLM 호출(line 1532)은 `{ workflowId, executionId, nodeExecutionId }` context를 전달해 `llm_usage_log` attribution을 채운다. 그러나 tool 루프 내부의 반복 LLM 호출(line 1332)은 `undefined`를 전달해 attribution gap이 발생한다. 이는 기존 핸들러에서 verbatim 이동된 코드이므로 본 리팩터링이 도입한 회귀는 아니다. 코드 주석(line 1543)에 "[Spec 7-llm-usage §1.3] WARNING#5 해소"가 언급되어 있으나 루프 내 호출에는 미적용되어 있다.
- **제안**: 별도 작업으로 tool 루프의 LLM 호출에도 동일한 context를 전달하는 것을 검토한다. 이는 본 리팩터링 범위 밖(behavior-preserving 목표 위반 없음)이며 별도 이슈로 추적한다.

---

### **[INFO]** `processMultiTurnMessage` 의 첫 LLM 호출에 `LlmCallContext` 미전달

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` line 2428
- **상세**: `processMultiTurnMessage` 의 LLM chat 호출(line 2428)에 `LlmCallContext`(`workflowId`/`executionId`/`nodeExecutionId`)가 전달되지 않는다. resume turn의 attribution gap. 역시 기존 코드의 verbatim 이동이므로 본 리팩터링 도입 회귀는 아님.
- **제안**: INFO 수준 — 별도 attribution 개선 작업에서 처리.

---

### **[INFO]** `capFormDataBytes` 의 256B JSON overhead 여유 마진이 하드코딩됨

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` line 745
- **상세**: `const stringBudget = Math.max(0, capBytes - nonStringBytes - 256)` 에서 256을 JSON 구조 overhead로 하드코딩. 필드 수가 많은 formData에서 실제 overhead가 256을 초과할 수 있으나, spec §12.7이 "선택지 (A) per-field string 균등 truncate" 로 결정했고 현 구현이 그것을 충실히 따르므로 기능적 문제는 없다. 극단적 케이스(비-string 필드 256개 이상)는 pratical하게 발생하지 않는다.
- **제안**: 현행 유지. 필요 시 동적 계산으로 개선 가능하나 spec 요구사항 수준에서는 문제없음.

---

### **[INFO]** `RagAccumulator.fromState` 가 hydrate 시 `attempted`/`kbCallCount` 미복원

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/m1-step3-ai-turn-executor/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` line 877~893
- **상세**: `fromState` 는 `seenChunkIds` 와 `sources` 만 복원하고 `attempted`, `kbCallCount`, `unsearchableKbCallCount`, `queries` 는 초기값(0/false/empty)으로 시작한다. 따라서 multi-turn resume 시 `getDiagnostics()` 의 `attempted`, `skipReason` 등 진단 필드가 이전 turn 누적 기준이 아닌 현재 turn 기준으로만 산정된다. spec §4.2의 "RagDiagnostics — KB 검색 진단" 은 노드 레벨 누적(turn 합산)을 정의하나, resume 시 이전 turn 진단 카운터 복원은 명시되지 않았다. `ragSources` 배열(dedup)은 복원되므로 소스 중복 방지는 올바름. skipReason 진단은 현재 turn 단위로 해석되어도 큰 실용 영향은 없다.
- **제안**: INFO. 현행 동작은 spec 의 미정의 영역이며 기존 코드에서 verbatim 이동된 패턴. 필요 시 spec 명확화 후 개선.

---

## 요약

AiTurnExecutor 추출은 god-handler 분할 목표를 달성했으며(2999→219줄 핸들러, 단방향 위임 아키텍처), spec §6.2 multi-turn blocking 흐름·§7.4~7.9 출력 포트 shape·§7.9 retryState allow-list·§12.6~12.8 form 재호출 가드·formData cap·retry_last_turn 등 핵심 비즈니스 로직이 verbatim 이동으로 충실하게 보존되었다. 주요 spec 일치 관련 요구사항(출력 포트 shape, `_resumeState`/`_retryState` 생명주기, credential 미동봉, MAX_RESUME_RAG_SOURCES/MAX_TURN_DEBUG_HISTORY 상수)은 코드와 spec 이 line-level로 일치한다. **단 하나의 WARNING 발견사항**: `processMultiTurnMessage` 에서 조건 도구 호출이 `toolCallCount` 에 산입되어, spec §7.1의 "meta.toolCalls 조건 도구 제외" 명세와 `executeSingleTurn` 동작 모두와 불일치한다. 이 불일치는 `maxToolCalls` 예산 조기 소진과 `meta.toolCalls` 부정확 노출의 기능적 회귀를 유발할 수 있어 수정이 필요하다.

## 위험도

MEDIUM
