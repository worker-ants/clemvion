### 발견사항

---

**[WARNING] LLM API 원시 에러 메시지 클라이언트 노출**
- 위치: `google.client.ts` — `stream()` 메서드, catch 블록 (sendMessageStream 호출 전/후 두 곳)
- 상세: Gemini API에서 반환된 예외의 `.message`를 그대로 SSE 이벤트로 흘려보낸다. Google API 에러 메시지에는 내부 엔드포인트, 프로젝트 ID, 할당량 한도 등 인프라 정보가 포함될 수 있다.
  ```typescript
  const message = error instanceof Error ? error.message : 'Unknown stream error';
  yield { type: 'error', code: classifyStreamError(message), message };
  ```
- 제안: `classifyStreamError`로 코드를 분류한 뒤, `message` 필드는 코드에 대응하는 정적 문자열로 교체한다. 원문 메시지는 서버 로그에만 기록.

---

**[WARNING] `workflow-assistant-stream.service.ts` 동일 패턴 — 내부 서비스 에러 메시지 노출**
- 위치: `streamMessage()` 외부 catch 블록
- 상세: 내부 서비스 예외 메시지가 그대로 SSE `error` 이벤트로 전달된다.
  ```typescript
  const message = error instanceof Error ? error.message : 'Unknown error';
  yield { event: 'error', data: { code: 'ASSISTANT_STREAM_FAILED', message } };
  ```
- 제안: 외부로 노출하는 `message`는 고정된 안내 문자열로, 원문은 `this.logger.error()`로만 기록.

---

**[WARNING] LLM 프롬프트 인젝션 — 워크플로우 노드 config 경유**
- 위치: `workflow-assistant-stream.service.ts` → `buildSystemPrompt(nodeDefinitions, shadow.snapshot())`
- 상세: `shadow.snapshot()`에는 노드의 `config` 객체가 포함되며, `redactConfig`는 크리덴셜 키 이름 패턴만 걸러낸다. 공격자가 노드 config 값에 프롬프트 지시문(`Ignore previous instructions…`)을 삽입하면 LLM 동작을 조작할 수 있다.
- 제안: 시스템 프롬프트에 삽입되는 노드 config 값은 길이 상한(예: 512자)을 두거나, XML/JSON 이스케이프로 LLM이 구분자로 해석하지 못하게 감싼다. 또는 config를 별도 `<workflow_context>` 태그로 격리해 지시문 섹션과 분리한다.

---

**[INFO] `classifyStreamError` — HTTP 상태 코드 문자열 매칭 취약성**
- 위치: `google.client.ts`, `classifyStreamError` 함수
- 상세: `message.includes('429')`는 에러 메시지 본문에 `429`가 포함된 다른 원인(예: "Error code 4291", "retry after 429s")에도 오분류될 수 있다. 또한 Google SDK가 Rate Limit을 다른 형태로 표현하면 탐지가 누락된다.
- 제안: Google SDK의 공식 에러 타입/코드 필드를 우선 확인하고, 문자열 매칭은 최후 수단으로 사용.

---

**[INFO] `openQuestions` 타입 단언 — 요소 레벨 검증 없음**
- 위치: `workflow-assistant-stream.service.ts` → `buildPlanFromArgs`
- 상세: `args.openQuestions as string[]`는 배열임은 확인하지만 각 요소가 실제 `string`인지 검증하지 않는다. LLM이 객체나 숫자를 반환하면 그대로 DB에 저장된다.
- 제안:
  ```typescript
  openQuestions: Array.isArray(args.openQuestions)
    ? args.openQuestions.filter((q): q is string => typeof q === 'string')
    : undefined,
  ```

---

**[INFO] 도구 호출 ID에 `Math.random()` 사용**
- 위치: `google.client.ts` stream() 및 chat() — `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
- 상세: `Math.random()`은 암호학적으로 안전하지 않다. 이 ID는 LLM ↔ 서버 간 도구 결과 매핑에만 사용되며, 인증 토큰이나 세션 키가 아니므로 현재 맥락에서 실제 공격 면이 되기는 어렵다.
- 제안: 일관성을 위해 `import { randomUUID } from 'node:crypto'`로 대체하는 것을 권장한다.

---

### 긍정적 발견

- **`safeParse` 강화**: `!Array.isArray(parsed)` 조건 추가로 JSON 배열이 `Record<string, unknown>`으로 잘못 처리되던 타입 혼동을 제거했다.
- **`asString` helper 도입**: LLM 반환 인자에 `String(unknown)`을 직접 호출해 `[object Object]`가 ID나 경로 값으로 주입되던 경로를 차단했다.
- **`redactConfig` 배열 처리 수정**: TypeScript 타입 단언을 명확히 해 LSP 오류 없이 재귀 redact가 동작한다.

---

### 요약

이번 변경에서 직접적인 인젝션·인가 우회·하드코딩 시크릿 등의 Critical 취약점은 발견되지 않았다. 주요 위험은 두 가지다: (1) LLM API 원시 에러 메시지가 클라이언트 SSE로 노출돼 내부 인프라 정보가 유출될 수 있고, (2) 워크플로우 노드 config 값이 시스템 프롬프트에 비격리 상태로 삽입되므로 사용자가 악의적인 config 텍스트를 통해 LLM 동작을 조작할 수 있다. `asString`·`safeParse` 개선은 보안 방어 깊이를 높이는 올바른 방향이다.

### 위험도

**MEDIUM**