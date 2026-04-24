## 발견사항

### `[WARNING]` `sanitizeLabel`에 이중 따옴표 중화 누락
- **위치**: `system-prompt.ts` → `sanitizeLabel()` 함수
- **상세**: `sanitizeUserText`는 `"` → `'` 치환을 포함하지만, plan title·step description·openQuestions에 쓰이는 `sanitizeLabel`은 `"` 치환이 없음. LLM이 생성한 플랜 제목이나 질문에 `"` 문자가 포함될 경우, 프롬프트 내 인용 경계 혼란 가능성이 존재
- **제안**: `sanitizeLabel`에 `.replace(/"/g, "'")` 추가

---

### `[WARNING]` `JSON.parse(tc.arguments)` 예외 처리 누락
- **위치**: `anthropic.client.ts` → `chat()` 내부 (~line 42), `stream()` 내부 (~line 198)
- **상세**: LLM 응답의 tool call arguments를 `JSON.parse()` 없이 그대로 파싱. 토큰 잘림이나 비정상 LLM 응답으로 malformed JSON이 반환되면 `SyntaxError`가 uncaught로 전파. `stream()` 메서드는 `AsyncGenerator` 내부이므로 에러 핸들링 위치에 따라 스트림 전체가 중단될 수 있음
- **제안**: 두 곳 모두 try-catch로 감싸고 `ok: false, error: 'INVALID_TOOL_ARGUMENTS'` 형태로 정규화

```typescript
// 예시
let parsedInput: unknown;
try {
  parsedInput = JSON.parse(tc.arguments);
} catch {
  parsedInput = {};
}
```

---

### `[WARNING]` 스트림 에러 메시지 클라이언트 노출
- **위치**: `anthropic.client.ts` → `stream()` 에러 핸들러 (~line 243, ~line 294)
- **상세**: Anthropic SDK가 반환하는 에러 메시지를 그대로 `message` 필드로 클라이언트에 전달. SDK 오류에는 request ID, endpoint 경로, 내부 서비스 상태 정보 등이 포함될 수 있음. 특히 인증 실패 시 API 키 포맷이나 workspace 식별자가 일부 노출될 가능성
- **제안**: 에러 코드 기반으로 사용자에게 표시할 메시지를 별도로 매핑하고, 원본 SDK 메시지는 서버 로그에만 기록

---

### `[WARNING]` 툴 정의 UUID format 강제 미검증
- **위치**: `tool-definitions.ts` → `get_workflow.id`, `get_execution_details.id`
- **상세**: JSON Schema에 `format: 'uuid'`가 선언되어 있으나, JSON Schema `format` 키워드는 유효성 검증 라이브러리에서 명시적으로 활성화하지 않으면 무시됨. 임의 문자열이 백엔드 조회 로직에 도달할 수 있으며, 경로 탐색이나 NoSQL injection으로 이어질 가능성 존재
- **제안**: 서비스 레이어에서 UUID 형식을 정규식 또는 `uuid` 라이브러리로 명시적 검증 추가. JSON Schema 레벨의 format 선언만으로는 충분하지 않음

---

### `[INFO]` `config: additionalProperties: true` — 다운스트림 검증 의존
- **위치**: `tool-definitions.ts` → `add_node.config`, `update_node.patch.config`
- **상세**: LLM이 임의 key-value를 config로 전달 가능. Shadow workflow validator와 handler registry의 `validate()`가 유일한 방어선. 특정 노드 타입의 validator가 누락되거나 bypass되면 임의 config가 영속될 수 있음
- **제안**: 직접적인 취약점은 아니나, 각 node type handler에 대한 validate 커버리지가 중요. `handlerRegistry.has()` 반환값이 `false`일 때의 fallback 동작 명확화 필요

---

### `[INFO]` 프롬프트 인젝션 방어 전반적으로 양호
- **위치**: `system-prompt.ts` → `sanitizeUserText`, `renderActivePlanSection`
- **상세**: XML fence(`<user-request>...</user-request>`) + 헤더 중화 + fullwidth 치환 + 길이 절단의 다층 방어가 구현되어 있고, 처리 순서(헤더 중화 → 공백 압축)도 주석으로 명시. 테스트 파일에서 주요 인젝션 시나리오가 회귀 방어됨

---

## 요약

전체적으로 보안 의식이 높은 코드베이스로, 프롬프트 인젝션 방어·민감값 REDACTED 처리·`additionalProperties: false` 적용 등 적극적인 방어 패턴이 구현되어 있다. 주요 리스크는 두 가지다: (1) `JSON.parse(tc.arguments)` 무방비 — LLM 응답 파싱 실패 시 스트림 전체 중단으로 이어질 수 있으며, (2) `sanitizeLabel`의 `"` 미중화 — LLM 생성 텍스트가 프롬프트 내 인용 경계를 깨뜨릴 가능성. UUID format 미검증은 백엔드 조회 로직의 입력 신뢰도 문제로, 서비스 레이어의 명시적 검증으로 보완이 필요하다.

---

## 위험도

**LOW**