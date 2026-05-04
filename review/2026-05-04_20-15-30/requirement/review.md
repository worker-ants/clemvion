### 발견사항

---

**[WARNING] 터미널 emit 분기의 동기화 여부 미검증**
- 위치: `execution-engine.service.ts`, diff 주석 "Shape mirrors the terminal-emit branch below"
- 상세: 변경 목적이 `waiting_for_input` 분기를 터미널 emit 분기와 동일한 shape으로 맞추는 것인데, 터미널 분기의 코드는 이번 diff에 포함되어 있지 않다. 주석은 터미널 분기가 이미 `llmCalls` shape을 사용한다고 암시하지만, 실제 코드가 확인되지 않아 스펙 요건("두 분기 모두 동일 shape으로 직렬화") 충족 여부를 검증할 수 없다.
- 제안: 터미널 emit 분기(`waitForAiConversation` 종료 경로)의 payload도 diff에 포함하거나, 해당 경로가 `buildAiMessageDebugFromResumeState`를 사용하는지 명시적으로 확인

---

**[WARNING] 기존 `requestPayload`/`responsePayload` 필드 제거로 인한 호환성 단절**
- 위치: `execution-engine.service.ts:1704–1706` (제거된 라인)
- 상세: `waiting_for_input` emit에서 `requestPayload: resumeState.lastTurnRequest`, `responsePayload: resumeState.lastTurnResponse`, `durationMs: resumeState.lastTurnDurationMs` 세 필드가 제거되고 `llmCalls[]` 배열로 대체되었다. 프론트엔드가 기존 flat 필드를 직접 읽고 있다면 이번 변경에서 무음 실패(silent regression)가 발생한다.
- 제안: 프론트엔드의 `execution.ai_message` 핸들러에서 구 필드 참조 여부를 확인하고, 제거 여부를 CHANGELOG나 마이그레이션 가이드에 기록

---

**[WARNING] `metadata.inputTokens`/`outputTokens` 가 누적값임을 스펙 예시가 명확히 하지 않음**
- 위치: `spec/5-system/6-websocket-protocol.md`, 추가된 JSON 예시
- 상세: 스펙 예시의 `metadata.inputTokens: 512`는 맥락 없이 보면 per-turn 값처럼 읽힌다. 실제 코드는 `resumeState.totalInputTokens`(대화 전체 누적)를 사용한다. per-turn 토큰 수는 `llmCalls[].responsePayload.usage` 안에 있다.
- 제안: 스펙 예시에 `// 대화 전체 누적 토큰` 주석을 추가하거나, 필드명을 `cumulativeInputTokens`로 구분

---

**[INFO] `llmCalls`가 `null`일 때 undefined 체크가 통과**
- 위치: `execution-engine.service.ts:177–178`
- 상세: `const llmCalls = lastTurnDebug?.llmCalls as unknown[] | undefined; if (llmCalls !== undefined) result.llmCalls = llmCalls;` — TypeScript의 `as` 캐스트는 런타임 검사가 아니므로, `lastTurnDebug.llmCalls`가 실제로 `null`이면 `null !== undefined`가 `true`가 되어 `result.llmCalls = null`이 설정된다. 반환 타입 `llmCalls?: unknown[]`에 위배된다.
- 제안: `if (Array.isArray(llmCalls)) result.llmCalls = llmCalls;`로 교체

---

**[INFO] 테스트에 `llmCalls: null` 케이스 누락**
- 위치: `execution-engine.service.spec.ts`, `buildAiMessageDebugFromResumeState` describe 블록
- 상세: `turnDebugHistory: [{ turnIndex: 1, llmCalls: null, totalDurationMs: 50 }]` 케이스가 없다. 위 `null` 이슈와 결합하면 실제로 `llmCalls: null`이 payload에 포함되는 버그가 테스트에서 검출되지 않는다.
- 제안: `llmCalls: null` 케이스를 추가하고 `debug.llmCalls`가 `undefined`임을 assert

---

**[INFO] `turnDebugHistory`가 비배열 타입일 때 동작 미검증**
- 위치: `execution-engine.service.ts:167–169`
- 상세: `(state.turnDebugHistory as Array<...> | undefined) ?? []` 패턴은 `turnDebugHistory`가 실제 배열이 아닌 객체나 숫자일 때도 `??`가 falsy일 때만 `[]`로 fallback하므로, truthy 비배열 값이면 `turnDebugArray.length`가 `undefined`가 되어 `lastTurnDebug`가 `undefined`를 반환한다. 결과는 `{}` — 무해하지만 테스트 없이 암묵 의존 중.
- 제안: 테스트 케이스 `{ turnDebugHistory: "unexpected_string" }` → `{}` 추가

---

### 요약

`buildAiMessageDebugFromResumeState` 헬퍼의 설계 의도(두 emit 분기의 payload 일관성 보장)는 명확하고, 5개의 테스트 케이스도 핵심 경로를 잘 커버하고 있다. 다만 가장 중요한 요구사항인 "터미널 emit 분기도 동일 shape"의 실제 충족 여부가 이번 diff에서 확인되지 않으며, `llmCalls: null` 런타임 케이스가 타입 캐스트에 의해 무음 통과되는 미세한 결함이 있다. 또한 기존 flat 필드(`requestPayload`/`responsePayload`) 제거가 프론트엔드와의 계약 단절을 유발할 수 있으므로 클라이언트 코드 검증이 필요하다.

### 위험도

**MEDIUM** — 터미널 분기 동기화 미확인과 `null` 케이스 미처리가 결합되면 프론트엔드 디버그 타임라인이 일부 구간에서 불일치하거나 렌더링 오류를 일으킬 수 있다.