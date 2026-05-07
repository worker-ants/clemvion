## 발견사항

### [HIGH] 핵심 로직 중복 — provider batch 실행 블록
- **위치**: `ai-agent.handler.ts` — `executeSingleTurn` 내 `// Provider tools (KB 등) — 핸들러 내부 직접 실행.` 블록 vs `processMultiTurnMessageInner` 내 `// Multi-turn resume: provider tool 들도 single-turn 과 동일하게 병렬` 블록
- **상세**: `providerBudget` 계산 → `slice` truncate → `Promise.all` 실행 → 결과 push → `tool_call_budget_exceeded` 회신까지 약 30줄이 두 경로에 거의 그대로 복제됨. 심지어 두 번째 블록의 주석 자체가 "single-turn 과 동일하게"라고 명시하고 있어 중복 사실을 인식하고도 추출하지 않았음. `runProviderTool` 인자의 `turnIndex`·`nodeId`·`executionId` 출처만 다르므로 아래와 같이 private 메서드로 추출 가능:

  ```typescript
  private async runProviderBatch(
    classification: ConditionClassification,
    budget: number,
    runArgs: Omit<Parameters<AiAgentHandler['runProviderTool']>[0], 'provider' | 'call'>,
    messages: ChatMessage[],
    toolCallCount: number,
    toolCallTraces: ToolCallTrace[],
    ragGroup: RagAccumulatorGroup,
  ): Promise<number> { ... }
  ```

- **제안**: `runProviderBatch()` 또는 `executeProviderToolBatch()` private 메서드로 추출. 현재 상태에서는 budget 계산 버그나 truncate 정책 변경 시 두 곳을 동시에 수정해야 하며, 누락 위험이 높음.

---

### [WARNING] 테스트 내 `resumeState` 거대 인라인 객체
- **위치**: `ai-agent.handler.spec.ts` — `'runs provider tools in parallel on multi-turn resume too'` 테스트, `resumeState` 리터럴 (~20개 필드)
- **상세**: multi-turn 상태 구조가 바뀔 때마다 이 인라인 객체도 수동으로 맞춰줘야 함. 필드 누락 시 런타임 캐스트(`as Record<string, unknown>`)가 타입 오류를 숨겨 조용히 동작이 달라질 수 있음.
- **제안**: 파일 상단에 `makeResumeState(overrides?)` 팩토리 헬퍼를 두어 최소 공통 필드는 기본값으로 제공하고, 테스트별 필요 필드만 override하도록 정리.

---

### [WARNING] inFlight 병렬성 검증 패턴 중복
- **위치**: `ai-agent.handler.spec.ts` — `'executes provider tool calls within a turn concurrently'` vs `'runs provider tools in parallel on multi-turn resume too'`
- **상세**: `inFlight`/`maxInFlight` 카운터 + `setTimeout(resolve, 30)` + 반환값 구성이 두 테스트에 동일하게 복제됨. 타이밍 값(30ms)이나 반환 스키마가 바뀌면 두 곳을 모두 수정해야 함.
- **제안**: `makeParallelTrackingMock(delayMs = 30)` 헬퍼로 추출해 `{ mock, getMaxInFlight }` 형태로 반환. 각 테스트는 헬퍼를 호출하고 `expect(getMaxInFlight()).toBeGreaterThanOrEqual(2)`만 작성.

---

### [INFO] 매직 넘버 `turnIndex: 1`
- **위치**: `ai-agent.handler.ts` — `executeSingleTurn` 내 `runProviderTool` 호출
- **상세**: single-turn 경로에서 `turnIndex: 1`이 직접 하드코딩됨. `processMultiTurnMessageInner`는 `turnCount` 변수를 사용해 의미가 명확한 반면, single-turn은 왜 1인지 코드만 보면 즉시 자명하지 않음.
- **제안**: `const SINGLE_TURN_INDEX = 1` 상수 또는 변수 `const turnIndex = 1`로 선언 후 전달.

---

### [INFO] `processMultiTurnMessageInner` 함수 길이
- **위치**: `ai-agent.handler.ts` — `processMultiTurnMessageInner` (전체 파일 컨텍스트 기준 약 130줄)
- **상세**: `executeSingleTurn`도 마찬가지지만, 두 함수 모두 "LLM 호출 → tool 분류 → provider batch → condition/normal 처리 → 재호출 루프"를 한 함수 안에서 수행해 순환 복잡도가 높음. 위의 `runProviderBatch` 추출이 이뤄지면 자연히 줄어듦.
- **제안**: HIGH 항목의 메서드 추출이 선행되면 충분. 추가 분리는 선택적.

---

## 요약

이번 변경의 핵심인 Promise.all 병렬 실행과 batch truncate 로직 자체는 명확하고 의도가 잘 문서화되어 있다. 그러나 동일한 30줄 블록이 single-turn과 multi-turn 경로에 복제되어 있어, 향후 budget 계산이나 truncate 정책이 바뀔 경우 두 곳을 동시에 수정해야 하는 기술 부채가 이미 생겼다. 두 번째 블록 주석 자체가 "single-turn과 동일하게"라고 명시하고 있으므로 private 메서드 추출이 가장 시급하다. 테스트 코드는 의도 파악이 용이하나 `resumeState` 인라인 객체와 병렬성 검증 헬퍼 부재가 유지보수 마찰을 높인다.

## 위험도

**MEDIUM**