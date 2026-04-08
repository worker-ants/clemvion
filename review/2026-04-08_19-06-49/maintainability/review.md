### 발견사항

---

**[WARNING] `newState` 변수 중복 — `multiTurnState`와 동일한 값**
- 위치: `execution-engine.service.ts` diff +3~+6
- 상세: `newState`는 `resultObj._multiTurnState`로 할당되는데, 바로 위 라인에서 `multiTurnState = resultObj._multiTurnState`로 이미 갱신됨. 즉 `newState === multiTurnState`이므로 변수가 하나 더 생길 필요가 없음.
- 제안: `newState` 제거 후 `multiTurnState.model`, `multiTurnState.totalInputTokens` 등으로 직접 참조.

```ts
// Before
multiTurnState = resultObj._multiTurnState as Record<string, unknown>;
const newState = resultObj._multiTurnState as Record<string, unknown>;

// After
multiTurnState = resultObj._multiTurnState as Record<string, unknown>;
// 이후 참조 시 multiTurnState.model, multiTurnState.lastTurnRequest 등으로 사용
```

---

**[WARNING] `chatParams`와 실제 LLM 호출 파라미터 불일치 — 디버깅 데이터 신뢰성 문제**
- 위치: `ai-agent.handler.ts` diff +3~+9, +15~+21
- 상세: `chatParams`는 첫 번째 LLM 호출 파라미터를 스냅샷하지만, 툴 호출 루프가 있을 경우 `messages` 배열은 중간에 변이(mutate)된다. `chatParams.messages`는 `[...messages]`로 얕은 복사를 하지만 배열 내 객체들은 공유됨. 또한 툴 호출 루프 이후 마지막 LLM 호출 파라미터는 `chatParams`에 반영되지 않아, "마지막 턴의 요청"이 아닌 "첫 번째 요청"이 기록됨.
- 제안: `chatParams` 캡처를 마지막 LLM 호출 직전으로 이동하거나, 구조상 "첫 번째 요청"임을 명시하는 변수명(`firstTurnRequest`)을 사용할 것.

---

**[WARNING] `SummaryView` 내 인라인 IIFE — 가독성 저하**
- 위치: `conversation-inspector.tsx` SummaryView 함수 내 `items` 계산
- 상세: `isLive ? ... : (() => { ... })()` 패턴은 즉시 실행 함수를 삼항 연산자 안에 삽입하여 가독성을 떨어뜨림.
- 제안: 별도의 유틸 함수나 `useMemo`/단순 함수 추출로 분리.

```tsx
// Before
const items = isLive ? conversationMessages : (() => { ... })();

// After
function buildHistoryItems(output, conversationMessages) { ... }
const items = isLive ? conversationMessages : buildHistoryItems(output, conversationMessages);
```

---

**[WARNING] `key={i}` 인덱스 사용 — 리렌더링 안정성 문제**
- 위치: `conversation-inspector.tsx` SummaryView 내 `items.map((item, i) => <div key={i}>`
- 상세: 배열 인덱스를 `key`로 사용하면 대화 메시지가 추가/삭제될 때 React가 컴포넌트를 잘못 재사용할 수 있음.
- 제안: `turnIndex + type` 조합이나 고유 식별자를 `key`로 사용.

```tsx
key={`${item.type}-${item.turnIndex}-${i}`}
```

---

**[INFO] `durationMs` 포맷 로직 중복**
- 위치: `conversation-inspector.tsx` — `ResponseTab`, `UsageTab` 두 곳에 동일한 포맷 로직
- 상세: `item.durationMs < 1000 ? \`${item.durationMs}ms\` : \`${(item.durationMs / 1000).toFixed(2)}s\`` 패턴이 두 군데 반복됨.
- 제안: `formatDuration(ms: number): string` 유틸 함수로 추출.

---

**[INFO] `handleAiMessage`에서 `payload.message !== ""` 조건 — 의도 불명확**
- 위치: `use-execution-events.ts` diff +14
- 상세: `!payload.message && payload.message !== ""` 조건은 `payload.message`가 `undefined` 또는 `null`인 경우만 걸러냄. 빈 문자열을 허용하는 의도라면 명시적으로 `payload.message == null`로 표현하는 것이 더 명확함.
- 제안: `if (payload.message == null) return;`

---

**[INFO] `AssistantTabId` 타입과 `ASSISTANT_TABS` 상수가 컴포넌트 파일 최상단 외부에 위치**
- 위치: `conversation-inspector.tsx` 전반
- 상세: 현재 구조는 문제없지만, 탭 정의(`ASSISTANT_TABS`, `AssistantTabId`)가 향후 다른 컴포넌트에서도 재사용될 여지가 있다면 별도 파일로 분리하는 것이 바람직함. 현재 규모에서는 INFO 수준.

---

### 요약

이번 변경의 핵심은 AI 대화 디버깅을 위한 request/response payload 및 메타데이터 전달 파이프라인 추가로, 전체적인 설계 방향은 명확하다. 다만 `newState`와 `multiTurnState`의 중복 참조, `chatParams`가 툴 호출 루프 이전 스냅샷만 캡처하는 문제는 디버깅 데이터의 신뢰성에 직접적인 영향을 미치므로 수정이 필요하다. 프론트엔드 측에서는 IIFE를 포함한 복잡한 인라인 로직과 배열 인덱스 key 사용이 향후 유지보수 시 혼란을 야기할 수 있다. 전반적인 컴포넌트 분리(`ToolDetail`, `UserDetail`, `PreviewTab` 등)는 이전보다 훨씬 개선되었으며 구조적 일관성도 양호하다.

### 위험도

**MEDIUM**