### 발견사항

- **[INFO]** `Promise.all` 후 순차 post-merge 설계 — 올바름
  - 위치: `ai-agent.handler.ts` — `providerBatchResults` 처리 루프 (단일/멀티턴 양쪽)
  - 상세: `Promise.all`로 병렬 실행한 후 결과를 `for...of` 루프에서 순차 적용(`toolCallCount++`, `ragGroup.pushSources`, `messages.push`). `RagAccumulator.seenChunkIds` 등 공유 가변 상태는 모두 병렬 실행 구간 밖에서만 변경되므로 경쟁 조건 없음. 설계 의도가 코드와 일치.

- **[INFO]** `runProviderTool` 내부 try-catch가 `Promise.all` 안전성을 보장
  - 위치: `ai-agent.handler.ts` `:runProviderTool`
  - 상세: `provider.execute()` 예외를 내부에서 흡수해 항상 `{ result, trace }`로 resolve. `Promise.all` 자체는 결코 reject되지 않아 부분 실패가 전체 배치를 중단시키지 않음. `isolates partial failures` 테스트가 이를 회귀 검증.

- **[INFO]** WS 이벤트 순서 비결정성 — 의도된 동작
  - 위치: `ai-agent.handler.ts` `:runProviderTool` — `emitExecutionEvent` 호출
  - 상세: 병렬 실행 시 `TOOL_CALL_STARTED`는 등록 순서대로 발화하지만 `TOOL_CALL_COMPLETED`는 완료 순서(비결정적)대로 발화. `messages` 배열 자체는 `Promise.all` 완료 후 `providerBatchResults` 순서로 결정론적으로 적재되므로 LLM 컨텍스트 일관성에는 영향 없음. UI 타임라인용 WS 이벤트의 순서 차이는 허용 가능.

- **[INFO]** `providerBudget` 계산 시점의 원자성
  - 위치: `ai-agent.handler.ts` — `const providerBudget = Math.max(0, maxToolCalls - toolCallCount)`
  - 상세: Node.js 단일 스레드 특성상 `toolCallCount` 읽기와 `Promise.all` 시작 사이에 선점 불가. `toolCallCount`는 `Promise.all` 실행 중 변경되지 않으므로 잘못된 budget 계산 없음.

- **[WARNING]** `normalToolCalls`는 budget 제한 밖 — 기존 문제이나 병렬화 이후 영향 확대 가능
  - 위치: `ai-agent.handler.ts` — `classification.normalToolCalls` 처리
  - 상세: `providerTruncated`로 provider 호출은 잘리지만, 같은 배치의 `normalToolCalls`는 별도 budget 검사 없이 전부 실행되어 `toolCallCount`를 초과시킬 수 있음. 기존 직렬 로직에서도 동일했으나, 병렬 provider 배치 후 normal 처리가 이어지면서 한 turn에서 `maxToolCalls`를 초과하는 경우가 더 명확히 노출됨. 다음 while iteration 진입 시 조건에서 차단되므로 무한 루프 등의 치명적 결과는 없음.
  - 제안: `normalToolCalls` 처리 전에도 `Math.min(remaining, normalToolCalls.length)`로 슬라이싱하거나 명시적 budget 검사 추가 고려.

- **[INFO]** `inFlight` 카운터 기반 병렬성 검증 테스트 — 설계 적절
  - 위치: `ai-agent.handler.spec.ts` — `executes provider tool calls within a turn concurrently`
  - 상세: Node.js 단일 스레드 + 이벤트 루프 특성상, `Promise.all`로 두 프로미스가 시작되면 첫 번째 `setTimeout(resolve, 30)` yield 이전에 두 번째 프로미스도 동기 구간(inFlight++)까지 실행. 30ms 대기는 두 번째 시작 전에 첫 번째가 완료될 가능성을 충분히 배제. 테스트 신뢰도 높음.

- **[INFO]** `KbToolProvider.buildTools` — `Promise.allSettled` 사용
  - 위치: `kb-tool-provider.ts`
  - 상세: 단일 KB NotFound가 전체 도구 노출을 막지 않도록 `Promise.allSettled` 사용. 기존부터 올바른 패턴.

---

### 요약

핵심 변경 사항인 `for...of` → `Promise.all` 병렬화는 Node.js 단일 스레드 모델에 적합하게 설계되었다. 공유 가변 상태(`RagAccumulator`, `messages`, `toolCallCount`, `toolCallTraces`)는 모두 `Promise.all` 완료 이후 순차 post-merge 루프에서만 변경되므로 경쟁 조건이 없으며, `runProviderTool` 내부 try-catch가 부분 실패를 격리해 `Promise.all`의 fast-fail 특성을 안전하게 우회한다. `normalToolCalls` budget 미적용은 기존 설계에서 이어진 사소한 약점이나 치명적이지 않다. 전반적으로 동시성 위험이 낮은 안전한 구현이다.

### 위험도
**LOW**