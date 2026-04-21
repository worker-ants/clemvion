### 발견사항

---

**[WARNING] `stream()` 메서드에서 `tool_call_delta`와 `tool_call_end`에 동일한 `id` 사용**
- 위치: `google.client.ts` — stream() 내 functionCall 처리 블록
- 상세: 같은 turn에서 여러 functionCall이 등장할 경우 각 호출마다 `Date.now()` 기반 id를 생성하지만, 같은 millisecond 내에 두 functionCall이 처리되면 id 충돌 가능. `toolCallCount` 변수가 있음에도 id 생성에 활용되지 않음.
- 제안: `id` 생성 시 `toolCallCount`를 포함하거나 `randomUUID()`를 사용: `call_${Date.now()}_${toolCallCount}_${Math.random()...}`

---

**[WARNING] `stream()` abort 처리 후 `done` 이벤트가 항상 emit됨**
- 위치: `google.client.ts` — stream() 끝 부분 `yield { type: 'done', ... }`
- 상세: `finishReason === 'aborted'`인 경우에도 `done` 이벤트가 emit된다. 스펙상 abort된 스트림에서 `done`을 emit하는 것이 의도된 동작인지 불분명. `error` 이벤트 yield 후 `return`하는 패턴(연결 실패 시)과 일관성이 없음.
- 제안: `finishReason === 'aborted'`일 때도 `done`을 emit하는 것이 의도라면 주석으로 명시. 아니라면 early return 처리.

---

**[WARNING] `buildChatInputs()`에서 마지막 메시지가 `assistant` role일 경우 미검증**
- 위치: `google.client.ts` — `buildChatInputs()`, `stream()` 진입부
- 상세: Gemini API는 `sendMessageStream`에 전달되는 마지막 메시지가 반드시 `user` role이어야 한다. `lastMessage`가 `assistant` role인 경우(잘못된 호출 순서) API 오류가 발생하지만 이를 사전에 검증하지 않음. `chat()` 메서드도 동일.
- 제안: `lastMessage.role !== 'user'` 케이스에 대한 early return 또는 에러 yield 추가.

---

**[INFO] `classifyStreamError()`의 HTTP 상태코드 판별이 문자열 포함 여부에 의존**
- 위치: `google.client.ts` — `classifyStreamError()`
- 상세: `message.includes('429')` 방식은 오탐 가능성 있음 (예: 에러 메시지 내 "4291" 같은 문자열). OpenAI/Anthropic 클라이언트와 동일한 패턴을 사용하는지 확인 필요.
- 제안: 정규식 `\b429\b` 또는 HTTP status code 기반 판별로 개선 고려.

---

**[INFO] `safeParse()` 개선이 배열 케이스를 `{}` 로 처리**
- 위치: `workflow-assistant-stream.service.ts` — `safeParse()`
- 상세: LLM이 arguments를 배열로 반환하는 경우(비정상이지만 가능) 빈 객체 `{}`로 폴백됨. 이 경우 이후 `asString()` 호출에서 모두 fallback 값이 사용되어 잘못된 tool 호출이 실행될 수 있음. 오류를 조기에 감지하지 못함.
- 제안: 배열 케이스에서 `null`이나 별도 에러 표시를 반환하여 호출 측에서 스킵 처리하는 방안 고려.

---

**[INFO] `toShadowSnapshot()`의 edge `type` 캐스팅 제거**
- 위치: `workflow-assistant-stream.service.ts` — `toShadowSnapshot()`
- 상세: 기존 `(e.type ?? 'data') as 'data' | 'error'` 캐스팅이 제거되고 `e.type ?? 'data'`로 변경됨. 타입 정합성은 DTO 정의에 의존하게 됨. DTO에서 타입이 보장된다면 문제없으나, 런타임 입력(프론트엔드에서 오는 값)이 실제로 `'data' | 'error'`인지 검증하지 않음.
- 제안: DTO 레벨 또는 여기서 런타임 검증 추가 고려.

---

### 요약

전반적으로 변경사항은 코드 품질(공통 helper 추출, `asString` 유틸, `safeParse` 강화)을 개선하고 `stream()` 메서드를 신규 추가하는 유의미한 구현이다. 요구사항 충족 관점에서 핵심 기능(스트리밍, tool call, abort, usage 집계)은 구현되어 있으나, **Gemini API의 마지막 메시지 role 제약**을 사전에 검증하지 않는 점과 **abort 후 done 이벤트 emit 의도의 불명확성**이 잠재적 버그 지점이다. `classifyStreamError`의 문자열 포함 판별과 배열 arguments 폴백 처리는 낮은 우선순위의 개선 사항이다.

### 위험도

**LOW**