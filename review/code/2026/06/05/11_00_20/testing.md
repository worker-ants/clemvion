# Testing Review — summaryModel / extractionModel (A3)

Worktree: `agent-memory-summary-model-fa4efb`  
Diff: `origin/main..HEAD`  
신규 테스트: `ai-agent.memory.spec.ts` (+144 lines), `agent-memory-extraction.processor.spec.ts` (+28 lines)  
검토일: 2026-06-05

---

## CRITICAL

### (없음)

---

## WARNING

### W1 — multi-turn summaryModel: `_resumeState` 누락 → resume turn 에서 묵시 폴백, 미검증

- **파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:2152-2191`
- **상세**: `multiTurnStateBase` 에 `summaryModel` 필드가 없다. `processMultiTurnMessageInner` 는 `state.summaryModel as string | undefined` (L2527) 로 읽는데, `_resumeState` 에 저장된 적이 없으므로 항상 `undefined` → `model` 폴백이 발생한다. summaryModel 을 set 한 multi-turn 세션의 2번째 이후 turn 에서 전용 모델이 무음으로 무시된다.
- **미커버**: 신규 테스트 suite 내 multi-turn + summaryModel 조합 케이스가 전혀 없다. 기존 `multi_turn: first turn over budget` 테스트(`L180`)는 summaryModel 없이 동작하므로 이 버그를 잡지 못한다.
- **제안**: `multiTurnStateBase` 에 `summaryModel: config.summaryModel as string | undefined` 추가 (`extractionModel` 도 동일 패턴 — 아래 W2). 테스트: `processMultiTurnMessage` 2번째 turn 에서 `mockLlmService.chat.mock.calls` 의 요약 콜이 `summaryModel` 을 쓰는지 단언하는 케이스 추가.

### W2 — multi-turn extractionModel: `_resumeState` 누락 → resume turn 에서 payload.extractionModel=undefined

- **파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:2152-2191` / `L1146`
- **상세**: `extractionModel` 역시 `multiTurnStateBase` 에 없다. `scheduleMemoryExtraction` 은 `args.config.extractionModel as string | undefined` (L1146) 로 읽고, multi-turn `processMultiTurnMessageInner` 는 `state` 자체가 config 역할을 하므로 `state.extractionModel` 이 없으면 `undefined` 전달 → processor 에서 node `model` 폴백으로 degradation.
- **미커버**: 신규 테스트의 `extractionModel` 케이스는 single-turn only (`handler.execute(...)`). multi-turn `processMultiTurnMessage` resume turn 에서 `scheduleExtraction` payload 를 단언하는 케이스 없음.
- **제안**: `multiTurnStateBase` 에 `extractionModel: config.extractionModel as string | undefined` 추가. 테스트: `processMultiTurnMessage` turn 결과의 `scheduleExtraction` mock call 에서 `extractionModel` 단언.

---

## INFO

### I1 — 폴백 체인 3단계 커버리지: 추출 processor 쪽은 완전, 요약 쪽은 3단계 중 2단계만

- **파일**: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.spec.ts:171-198`
- **상세**: processor 폴백 체인 `extractionModel → model → llmConfig.defaultModel` 은 3단계 모두 커버됨 (케이스 3개, L172/L180/L186). 반면 요약 폴백 체인(`summaryModel → model → llmConfig 기본`)은 (a) summaryModel 설정, (b) 미설정→model 폴백만 테스트하고, (c) summaryModel·model 모두 미설정·llmConfig.defaultModel 만 있는 경우가 없다. `buildSummaryBufferUpdate` 내부에서 `llmService.chat` 에 model 이 undefined 로 전달되면 실제로 defaultModel 이 사용된다는 단언이 없다.
- **위험도**: LOW — processor 가 이미 3단계를 커버하고 요약 경로의 3단계도 구조상 동일하지만, 명시적 단언 부재로 회귀 시 탐지 불가.
- **제안**: `llmService.resolveConfig.mockResolvedValue({ defaultModel: 'ws-default' })` + `model` 미전달로 요약 콜 model 단언 추가 (processor spec 패턴 그대로).

### I2 — extractionModel 테스트의 `makeJob` 타입 캐스트 불안정

- **파일**: `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.spec.ts:173-175`
- **상세**: `(job.data as { extractionModel?: string }).extractionModel = 'cheap-extract'` — `makeJob` 반환 타입이 `Job<AgentMemoryExtractionJob>` 인데 `AgentMemoryExtractionJob` 에 `extractionModel?` 이 있으면 캐스트 없이 직접 대입 가능하다. 현재 `makeJob` 이 `extractionModel` 을 생성 인자로 받지 않으므로 사후 직접 대입하는 방식인데, 이는 `AgentMemoryExtractionJob` 타입 자체가 필드를 포함하고 있음에도 `makeJob` 헬퍼가 해당 필드를 파라미터로 수용하지 않는 불일치에서 비롯된다.
- **제안**: `makeJob` 에 `extractionModel?: string` 파라미터 추가해 타입 안전하게 주입. 캐스트 제거로 필드명 오타 컴파일 타임 탐지 가능.

### I3 — single-turn summaryModel 테스트: main 콜의 llmConfig 인자 미확인

- **파일**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts:1297-1305`
- **상세**: 요약 콜(0번째)이 `cheap-mini` 를 쓰고 main 콜(1번째)이 `gpt-4o` 를 씀을 단언한다. 양 콜 모두 `mockLlmService.chat.mock.calls[n][0]` (llmConfig 첫 인자) 을 검증하지 않으므로, 요약 콜이 잘못된 llmConfig 를 넘겨도 탐지되지 않는다. 실제로 현재 구현에서는 두 콜 모두 동일한 `llmConfig` 를 쓰므로 특별히 위험하지 않으나, 향후 분리 시 silent regression 가능.
- **제안**: `summaryCall.model` 단언 옆에 `expect(mockLlmService.chat.mock.calls[0][0]).toMatchObject({ id: 'cfg-1' })` 추가.

### I4 — `llmConfig.defaultModel` 3단계 폴백이 요약에서 실제로 동작하는지 확인하려면 `buildSummaryBufferUpdate` mock 경계 확인 필요

- **파일**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` (변경 외 파일)
- **상세**: `injectMemoryContext` 는 `buildSummaryBufferUpdate({ model: args.summaryModel || args.model })` 을 호출한다 (L952). `args.model` 은 호출부에서 `model || llmConfig.defaultModel` 로 이미 합성된다 (L1639). 따라서 3단계 폴백의 실질적 보장은 `execute` 내의 `model || llmConfig.defaultModel` 합성에 달려있는데, 이 부분의 직접 단언이 없다.

---

## 요약

추출 processor 의 폴백 체인 3단계(extractionModel → model → llmConfig.defaultModel) 테스트는 완전하고 격리도 우수하다. 핸들러 측의 single-turn summaryModel/extractionModel 단언도 의도를 명확히 표현한다. 그러나 `multiTurnStateBase` 에 `summaryModel` 과 `extractionModel` 이 누락되어 multi-turn resume turn 에서 두 전용 필드가 묵시적으로 폴백된다는 구현 버그가 존재하며(W1/W2), 해당 경로를 커버하는 테스트가 없어 현재 테스트 suite 가 이 버그를 잡지 못한다. 이 버그는 단순 `multiTurnStateBase` 두 줄 추가와 대응 테스트 케이스 2개로 수정 가능하다.

---

## 위험도

**MEDIUM**

*`summaryModel`/`extractionModel` 이 multi-turn resume 에서 무음 소실되는 것은 사용자가 저렴한 전용 모델을 설정했음에도 메인 모델이 요약/추출에 사용되는 비용 비대칭 버그 + 기대 동작 위반이지만, 응답 정확성이나 데이터 유실에는 영향이 없다.*

---

BLOCK: NO
