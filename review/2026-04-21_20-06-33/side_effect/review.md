### 발견사항

---

**[INFO] `buildChatInputs` / `startChatSession` 추출 — 외부 시그니처 무변경**
- 위치: `google.client.ts` — `chat()` 리팩토링 구간
- 상세: `private` 메서드로만 분리되었으며, `LLMClient` 인터페이스의 `chat()` 시그니처는 유지됨. 호출자에 영향 없음.
- 제안: 없음.

---

**[WARNING] `stream()` 내 `tool_call_delta` + `tool_call_end` 동일 `id` 생성 — 레이스 가능성**
- 위치: `google.client.ts` L256–262 (functionCall 처리 블록)
- 상세: `id`를 `call_${Date.now()}_${Math.random()...}` 방식으로 생성하는데, 동일 청크 내에서 여러 `functionCall`이 동시에 나올 경우 `Date.now()`가 동일값을 반환해 **id 충돌** 위험이 있음. `chat()`의 동일 패턴도 같은 문제를 내포하나, 이번 변경으로 `stream()`에도 복제되었음.
- 제안: `randomUUID()`(이미 서비스 계층에서 import 중) 또는 단조 증가 카운터로 대체.

```typescript
import { randomUUID } from 'node:crypto';
const id = `call_${randomUUID()}`;
```

---

**[WARNING] `stream()` — abort 후 `done` 이벤트의 `finishReason: 'aborted'` 타입 불일치**
- 위치: `google.client.ts` L300, `done` yield 구간
- 상세: `finishReason` 변수 타입은 `ChatResult['finishReason'] | 'aborted'`로 선언되었지만, `done` 이벤트 타입(`ChatStreamEvent`)이 `'aborted'`를 허용하는지 인터페이스 정의에 따라 달라짐. 허용하지 않는다면 다운스트림 소비자가 예상치 못한 값을 수신할 수 있음.
- 제안: `ChatStreamEvent['done'].finishReason` 유니온에 `'aborted'`를 명시하거나, emit 전에 `'stop'`으로 정규화.

---

**[INFO] `safeParse` — `Array` 반환값 차단 추가**
- 위치: `workflow-assistant-stream.service.ts` L519–527
- 상세: 기존에는 배열 JSON(`[...]`)을 파싱하면 `object` 체크를 통과해 `Record<string, unknown>`으로 반환되었음. 이번 변경으로 배열은 `{}`로 대체됨. LLM이 배열 최상위 JSON을 반환하는 경우 toolCall 인자가 무시될 수 있으나, 이는 **버그 수정**이므로 의도된 변경. 기존 동작에 의존하는 호출자가 없다면 무해함.
- 제안: 없음.

---

**[INFO] `asString` helper — `String()` 대비 동작 변경**
- 위치: `workflow-assistant-stream.service.ts` L525–528, 각 호출부
- 상세: `String(args.type ?? '')` 패턴을 `asString(args.type, '')` 로 교체. 숫자형 id(`42`)가 들어올 경우 `String(42)` → `"42"` 였던 것이 이제 `fallback("")` 으로 바뀜. 실제 LLM 도구 호출에서 id/type이 숫자로 내려올 가능성은 낮지만 **묵시적 타입 변환 제거**가 특정 케이스에서 빈 문자열 오류를 유발할 수 있음.
- 제안: 의도적 변경이라면 유지. 숫자 id 허용이 필요하다면 `typeof value === 'string' || typeof value === 'number' ? String(value) : fallback` 고려.

---

**[INFO] `redact.ts` — `value.map()` 타입 캐스팅 강화**
- 위치: `redact.ts` L16
- 상세: `value.map(...)` 앞에 `(value as unknown[])` 캐스트 추가. 런타임 동작 변경 없음; TypeScript strict 모드 대응용 수정.
- 제안: 없음.

---

**[INFO] `toShadowSnapshot` — edge `type` 캐스팅 제거**
- 위치: `workflow-assistant-stream.service.ts` L469
- 상세: `(e.type ?? 'data') as 'data' | 'error'` → `e.type ?? 'data'` 로 변경. DTO의 `e.type` 정의가 이미 `'data' | 'error' | undefined`라면 무해. DTO 타입이 더 넓은 경우(예: `string`) 타입 안전성이 낮아질 수 있음.
- 제안: DTO 타입 확인 후 필요 시 캐스팅 유지.

---

### 요약

세 파일 모두 외부 공개 API(`LLMClient` 인터페이스, SSE 이벤트 계약)의 시그니처를 변경하지 않았으며, 전역 상태·파일시스템·환경 변수에 대한 의도치 않은 부작용은 없다. 주요 리스크는 `stream()`의 **tool call id 충돌 가능성**(동일 millisecond 내 복수 functionCall)과, `finishReason: 'aborted'`가 인터페이스 유니온에 포함되어 있지 않을 경우의 **타입 불일치** 두 가지다. `asString` 도입으로 숫자 타입 인자에 대한 묵시적 변환이 제거된 것은 의도적 방어 코드이나 edge case 동작 변화를 수반한다.

### 위험도

**LOW**