### 발견사항

- **[INFO]** WebSocket 대기 페이로드에 `conversationThread` 필드 추가 — 가산적 변경
  - 위치: `execution-engine.service.ts` — `emitFormWaitingForInput`, `emitAiWaitingForInput`, 버튼 waiting emit
  - 상세: form/버튼 경로는 `context.conversationThread`로 항상 정의된 값을 내보내지만, multi-turn AI 후속 waiting 경로(L2120 부근)는 `this.contextService.getContext(executionId)?.conversationThread`로 `undefined`가 될 수 있음. 세 경로 간 nullable 일관성이 없다.
  - 제안: multi-turn 경로도 `context`가 존재하는 시점에 호출되므로 non-null assertion이나 명시적 fallback(`?? null`)으로 타입을 정렬할 것.

- **[WARNING]** WebSocket 페이로드 크기 상한 미통제
  - 위치: `execution-engine.service.ts` — 세 곳의 `conversationThread: context.conversationThread` 직접 삽입
  - 상세: `applyCap`은 LLM 주입 시에만 적용되고, WebSocket emit 시에는 원본 thread가 그대로 직렬화됨. cap 미적용 시 최대 수십만 char의 thread가 매 waiting tick마다 클라이언트에 전송될 수 있음. 페이로드 크기 버짓이 spec §4.4.5에 명시되어 있지 않다면 추후 WebSocket 병목이 될 수 있다.
  - 제안: emit 직전 `applyCap(context.conversationThread.turns)`을 적용한 경량 snapshot을 내보내거나, spec에 페이로드 크기 SLA를 명문화할 것.

- **[INFO]** 구버전 `conversationHistory` / `maxHistoryCount` 필드 deprecated 표기 — 하위 호환성 유지
  - 위치: `ai-agent.schema.ts` L277–L309
  - 상세: 두 필드에 `deprecated: true` 메타와 UI 레이블 변경이 추가됨. 필드 자체는 제거되지 않고 핸들러가 읽지 않으므로 기존 워크플로 설정값은 무시(noop). API 소비자 측에서 이 필드를 의존하는 경우 silent 무시되어 예상치 못한 동작 변화는 없음.
  - 제안: deprecation 주석에 제거 예정 버전(milestone)을 명시하면 이후 cleanup 시 기준이 명확해진다.

- **[INFO]** 신규 AI Agent config 필드 전부 기본값 보존 — non-breaking
  - 위치: `ai-agent.schema.ts` — `contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`
  - 상세: 모든 신규 필드는 `.default(...)` 처리되어 있고, `contextScope` 기본값이 `'none'`이므로 기존 워크플로는 thread 주입 없이 동작함. 완전한 opt-in 설계로 하위 호환성 손상 없음.

- **[INFO]** `$thread` expression context 노출 — 표현식 평가 API 변경
  - 위치: `expression-resolver.service.ts` — `buildExpressionContext` 내 `$thread` 추가
  - 상세: `$thread.turns`, `$thread.length`, `$thread.text`가 모든 expression 평가 컨텍스트에 노출됨. 기존 표현식에서 `$thread`를 변수명으로 사용하던 경우 섀도잉 발생 가능성이 있으나, `$` prefix 변수는 engine 예약 공간이므로 실용적 충돌 가능성은 낮음.

---

### 요약

이번 변경의 API 계약 영향은 주로 WebSocket 이벤트 페이로드에 집중된다. form/버튼/AI 대기 이벤트에 `conversationThread` 필드가 추가되었는데, 이는 가산적 변경으로 기존 클라이언트가 해당 필드를 무시하면 영향이 없다. 다만 두 가지 주의 사항이 있다: multi-turn AI 경로에서만 `conversationThread`가 nullable로 emit될 수 있어 세 경로 간 타입 일관성이 깨지며, cap 적용 없이 원본 thread를 직접 직렬화하면 대화가 길어질수록 WebSocket 페이로드가 비례해 커진다. 나머지 변경(신규 schema 필드, deprecated 필드 유지, `$thread` expression)은 모두 하위 호환성을 보존하는 방식으로 설계되었다.

### 위험도
**LOW**