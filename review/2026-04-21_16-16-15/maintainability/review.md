## 유지보수성 코드 리뷰 — Workflow AI Assistant

---

### 발견사항

---

**[WARNING]** `LlmService.chatStream`의 인라인 타입 정의
- 위치: `llm.service.ts` — `let lastUsage: { inputTokens: number; outputTokens: number; totalTokens: number; thinkingTokens?: number } | null`
- 상세: `ChatResult['usage']` 혹은 인터페이스의 `TokenUsage` 타입이 이미 존재할 가능성이 높음에도 긴 인라인 타입을 사용. 인터페이스 변경 시 이 위치가 누락될 위험.
- 제안: `llm-client.interface.ts`의 `TokenUsage` 타입을 export하고 `lastUsage: TokenUsage | null`로 교체.

---

**[WARNING]** `AnthropicClient.stream`과 `OpenAIClient.stream` 간 중복 에러 처리 패턴
- 위치: `anthropic.client.ts` L213~225, `openai.client.ts` L310~325
- 상세: `error.message.includes('429')` 로 에러 코드를 분류하는 로직이 양쪽에 복붙됨. 문자열 매칭 기반이라 취약하며, 에러 분류 정책이 바뀌면 두 파일을 동시에 수정해야 함.
- 제안: `LLMClient` 레이어의 공통 유틸(`mapProviderError(error): ChatStreamEvent`)로 추출.

---

**[WARNING]** `openai.client.ts` — `tool_call_end` 방출 시점이 `finish_reason` 조건에 묶여 있음
- 위치: `openai.client.ts` L263~281
- 상세: Anthropic 구현은 `content_block_stop`마다 `tool_call_end`를 방출하는 반면, OpenAI 구현은 `finish_reason === 'tool_calls'` 시점에 일괄 방출. 소비자(`stream.service.ts`)가 두 구현체를 동일하게 다루기 어렵고, 부분 스트리밍 UI 진행 표시가 불일치.
- 제안: 인터페이스 주석 혹은 별도 `STREAMING_NOTES.md`에 이 동작 차이를 명시하거나, 양쪽 구현을 정렬.

---

**[WARNING]** `appendMessage`의 비원자적 세션 카운터 갱신
- 위치: `workflow-assistant-session.service.ts` L131~145
- 상세: `messageRepo.save` → `sessionRepo.update` → `sessionRepo.increment` 세 단계가 트랜잭션 없이 실행됨. 중간에 실패하면 `message_count`와 실제 메시지 수가 어긋남. 주석에 "트랜잭션 없이도 안전"이라 표기했으나 실제로는 안전하지 않음.
- 제안: `DataSource.transaction()` 래핑 또는 `QueryRunner` 사용. 적어도 주석을 정확하게 수정("비정규화 필드는 best-effort로 갱신되며 실패 시 재동기화가 필요할 수 있음").

---

**[WARNING]** `handleSseEvent` — `AssistantState` 참조를 직접 뮤테이션
- 위치: `assistant-store.ts` L340~360
- 상세: `for (const other of [...s.messages].reverse()) { other.plan.steps = ... }` — `s.messages`를 복사해도 배열 내 객체는 shallow copy이므로 `other.plan.steps`를 직접 교체하면 이전 상태 객체가 수정됨. Zustand의 불변성 가정을 위반하여 렌더링 버그나 devtools 오동작을 유발할 수 있음.
- 제안:
```ts
messages: s.messages.map((m) => {
  if (!m.plan) return m;
  const updatedSteps = m.plan.steps.map((step) =>
    step.id === stepId && step.status === "pending"
      ? { ...step, status: "done" as const }
      : step,
  );
  return { ...m, plan: { ...m.plan, steps: updatedSteps } };
}),
```

---

**[WARNING]** `approveActivePlan` — 한국어 하드코딩
- 위치: `assistant-store.ts` L371
- 상세: `sendMessage("계획대로 진행해 주세요.", snapshot)` — 메시지가 하드코딩된 한국어. i18n dict를 쓰는 프론트엔드 전체 패턴에서 이탈.
- 제안: i18n key(`assistant.approveConfirmMessage`) 추가 후 `t()` 경유 또는 store 레이어에서 상수로 분리 (`APPROVE_PLAN_MESSAGE`).

---

**[INFO]** `workflow-assistant-session.service.ts` — `findOneForUser`의 이중 not-found 분기
- 위치: L107~120
- 상세: workspace 불일치 시 `ForbiddenException` 대신 `NotFoundException`을 던져 실제 소속 여부를 숨기는 것은 보안상 의도된 선택으로 보이나, 코드 내 주석이 없어 의도인지 버그인지 불명확.
- 제안: 한 줄 주석 추가 (`// Intentional: reveal no information about cross-workspace sessions`).

---

**[INFO]** `ShadowWorkflow.wouldCreateCycle` — DFS 스택 기반 구현
- 위치: `shadow-workflow.ts` L232~244
- 상세: 동작에 문제는 없으나, 노드/엣지가 수백 개 이상으로 성장 시 성능 특성이 명시적이지 않음. 현재 AI Assistant 사용 패턴(한 번에 소수의 연산)에서는 무관하나, 향후 대규모 workflow에서 호출 빈도가 높아지면 이슈가 될 수 있음.
- 제안: 현재 규모에서는 무방. 주석에 `// O(V+E) DFS` 명시 권장.

---

**[INFO]** `editor-store.ts` — `applyAssistantOperation`의 snake_case / camelCase 이중 처리
- 위치: `editor-store.ts` L490, L510~512
- 상세: `args.source_id ?? args.sourceId`처럼 두 가지 케이싱을 모두 처리하는 방어 코드가 여러 곳에 반복. 이는 `shadow-workflow.ts`의 `addEdge`도 동일하게 처리하여 전체적으로 계약이 불명확.
- 제안: 백엔드 도구 정의(`tool-definitions.ts`)를 snake_case로 고정하고, 소비자 측에서 하나의 케이싱만 기대하도록 정리.

---

**[INFO]** `system-prompt.ts` — 단일 함수에 6가지 섹션 조립
- 위치: `system-prompt.ts` L20~110
- 상세: `buildSystemPrompt`가 카탈로그 포매팅, 스냅샷 직렬화, few-shot 예시, 레이아웃 가이드 등 여러 관심사를 직접 처리함. 지금 크기에서는 수용 가능하나, 프롬프트 내용 변경 시 하나의 큰 함수를 탐색해야 함.
- 제안: 규모가 커지면 `buildCatalogSection`, `buildSnapshotSection` 등으로 분리 고려. 현 단계에서는 Low 우선순위.

---

**[INFO]** `assistant.ts` — `parseSseRecord`의 `data` 누산 방식
- 위치: `assistant.ts` L223
- 상세: `data += line.slice(5).trim()` — SSE 표준에서 `data:` 라인이 여러 줄일 경우 `\n`으로 합쳐야 하지만 직접 연결함. 현재 서버가 단일 `data:` 라인만 보내는 한 문제 없으나, 변경 시 파싱이 깨짐.
- 제안: `data += (data ? "\n" : "") + line.slice(5).trim()`

---

### 요약

전반적으로 코드 품질은 양호하며, 모듈 경계가 명확하고 테스트(`shadow-workflow.spec.ts`)가 핵심 로직을 잘 커버한다. 주요 유지보수성 위험은 두 가지다: **Zustand store에서의 상태 직접 뮤테이션**(렌더링 버그 잠재)과 **`appendMessage`의 비트랜잭션 카운터 갱신**(데이터 불일치 잠재). 에러 처리 코드 중복과 snake_case/camelCase 이중 처리 패턴은 interface contract가 확정되면 정리가 필요하다. 하드코딩된 한국어 문자열은 기존 i18n 패턴과 불일치하므로 조기에 수정하는 것이 좋다.

### 위험도

**MEDIUM**