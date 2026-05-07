### 발견사항

---

**[WARNING] 병렬 실행 블록 중복 — DRY 위반**
- 위치: `ai-agent.handler.ts` — `executeSingleTurn` (diff +566~599) 와 `processMultiTurnMessageInner` (diff +981~1014) 양쪽
- 상세: `providerBudget` 계산 → `providerToRun` / `providerTruncated` 슬라이싱 → `Promise.all` → 결과 직렬 누적 → truncated 회신, 이 20여 줄 블록이 두 경로에 거의 동일하게 복사됐다. 차이는 `runProviderTool`의 `turnIndex` 인자 (`1` vs `turnCount`) 와 `config` 참조 이름(`config` vs `turnConfig`) 뿐이다. 현재는 두 곳 중 한 쪽만 수정하면 동작 불일치가 생기는 구조다.
- 제안: 아래와 같은 private 헬퍼로 추출. `runProviderTool`의 공통 인자를 Partial로 받고 `turnIndex`·`config`를 오버라이드하는 방식으로 단일 경로로 합칠 수 있다.

```typescript
private async executeProviderToolBatch(
  providerToolCalls: Array<{ provider: AgentToolProvider; call: ToolCall }>,
  budget: number,
  runCtx: Omit<Parameters<AiAgentHandler['runProviderTool']>[0], 'provider' | 'call'>,
): Promise<{
  batchResults: Awaited<ReturnType<AiAgentHandler['runProviderTool']>>[];
  truncated: ToolCall[];
}>
```

---

**[INFO] `AiAgentHandler` 의 책임 범위 확대 추세**
- 위치: `ai-agent.handler.ts` 전체
- 상세: 이번 변경으로 핸들러는 LLM 오케스트레이션, 도구 분류, 병렬 실행·예산 관리, RAG 누적, WS 텔레메트리, 결과 직렬화를 모두 담당한다. 현재 단계에서는 허용 범위이지만, MCP 병렬화나 추가 provider 등장 시 `ProviderToolExecutor` 같은 협력 객체로 분리 압력이 생길 수 있다.
- 제안: 즉시 조치는 불필요하나, 위 WARNING 의 헬퍼 추출이 자연스러운 분리 준비 단계가 된다.

---

**[INFO] `turnIndex: 1` 하드코딩**
- 위치: `executeSingleTurn` 내 `Promise.all` 콜백
- 상세: single-turn 은 항상 1이므로 정확하지만, 이 값이 헬퍼로 추출될 때 인자로 파라미터화되지 않으면 버그로 이어질 수 있다. 현재는 중복 블록으로 인해 경계가 묵시적으로 유지되고 있다.
- 제안: 헬퍼 추출 시 `turnIndex`를 명시적 인자로 받아 의도를 문서화.

---

**[INFO] 테스트에서 `processMultiTurnMessage` 접근 시 타입 캐스팅**
- 위치: `ai-agent.handler.spec.ts` 신규 테스트 (diff +2173~)
- 상세: `handler as unknown as { processMultiTurnMessage: ... }` 패턴을 사용한다. 해당 메서드는 `public`이므로 캐스팅 없이 직접 호출 가능하다. `as unknown` 경유 캐스팅은 컴파일러 보호를 우회하는 불필요한 패턴이다.
- 제안: `await handler.processMultiTurnMessage('turn2 question', resumeState as never)` 또는 `resumeState` 타입을 올바르게 정의하면 캐스팅 불필요.

---

### 요약

이번 변경의 핵심 구조 — `AgentToolProvider` 인터페이스를 통한 전략 패턴, `RagAccumulator`/`RagAccumulatorGroup` 의 책임 분리, `runProviderTool` 추상화를 통한 텔레메트리 격리 — 는 견고하다. 병렬 실행은 기존 추상화 경계를 깨지 않고 도입됐으며, truncate 처리도 프로토콜 계층 요건(Anthropic tool_use↔tool_result 매칭)을 handler 레이어에서 올바르게 흡수했다. 다만 `executeSingleTurn`과 `processMultiTurnMessageInner` 양쪽에 동일한 `Promise.all` 블록이 복사된 점은 명확한 DRY 위반으로, 현재는 두 메서드의 인자 차이(`turnIndex`, `config`)가 블록을 묵시적으로 분리하고 있어 향후 유지보수 시 불일치 위험이 있다. 단일 private 헬퍼로 추출하는 것이 유일한 구조적 개선 포인트다.

### 위험도

**LOW**