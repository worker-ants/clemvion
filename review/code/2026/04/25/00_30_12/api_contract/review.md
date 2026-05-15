### 발견사항

---

**[WARNING] 오류 코드 감지를 문자열 매칭으로 수행 (anthropic.client.ts)**
- 위치: `stream()` 및 `chat()` 메서드의 에러 핸들링
- 상세: `message.includes('429')` 로 rate-limit 여부를 판별한다. Anthropic SDK는 `APIStatusError.status` 필드로 HTTP 상태 코드를 구조적으로 노출하는데, 오류 메시지 포맷이 SDK 버전에 따라 변경될 경우 `LLM_RATE_LIMIT` 대신 `LLM_CONNECTION_ERROR`가 발생해 호출자의 재시도 로직이 오동작한다.
- 제안:
  ```ts
  import Anthropic from '@anthropic-ai/sdk';
  const code =
    error instanceof Anthropic.RateLimitError ? 'LLM_RATE_LIMIT'
    : error instanceof Anthropic.APIConnectionError ? 'LLM_CONNECTION_ERROR'
    : 'LLM_CONNECTION_ERROR';
  ```

---

**[WARNING] `tool_choice: { type: 'none' }` 를 `as never` 로 타입 회피 (anthropic.client.ts)**
- 위치: `chat()` 및 `stream()` 의 `toolChoice === 'none'` 분기
- 상세: `({ type: 'none' } as never)` 는 SDK 타입이 해당 shape를 인식하지 못한다는 신호다. Anthropic API는 `type: 'none'`을 유효한 값으로 지원하지만, SDK 타입 정의가 미갱신된 상태에서 런타임 직렬화 결과가 서버 스키마와 맞지 않을 경우 400 에러가 발생할 수 있다. SDK 업그레이드 시 이 조용한 타입 우회는 탐지되지 않는다.
- 제안: SDK가 해당 shape를 정식 타입으로 포함할 때까지 `as Anthropic.ToolChoiceNone` (또는 SDK 공개 타입명) 으로 캐스팅하거나, 유닛 테스트에서 `tool_choice`의 직렬화 결과를 명시적으로 검증한다.

---

**[WARNING] 스트림 이터레이션에서 이중 캐스팅 사용 (anthropic.client.ts)**
- 위치: `for await (const event of stream as unknown as AsyncIterable<Anthropic.MessageStreamEvent>)`
- 상세: `as unknown as` 이중 캐스팅은 SDK가 반환하는 `Stream<T>` 타입의 실제 이터레이션 프로토콜을 컴파일러가 검증하지 않게 한다. SDK가 내부적으로 `[Symbol.asyncIterator]` 구현 방식을 변경하면 런타임에 무증상으로 silently break된다.
- 제안: SDK의 `stream()` 헬퍼(`this.client.messages.stream(...)`)를 사용하면 타입 안전하게 이벤트를 이터레이션할 수 있다.

---

**[WARNING] 도구 결과(response shape)에 대한 기계 판독 가능한 스키마 부재 (tool-definitions.ts)**
- 위치: 모든 tool 정의 (반환 schema 없음)
- 상세: `add_node`, `update_node`, `add_edge` 등의 도구 정의는 요청 파라미터 스키마만 선언하고, 응답 형식(`{ ok, id, result, error, warning, pendingUserConfig, ... }`)은 시스템 프롬프트 산문에만 명시된다. LLM이 응답 shape를 오해하거나 서버 구현이 변경될 때 시스템 프롬프트와의 드리프트를 정적으로 탐지할 방법이 없다.
- 제안: OpenAI function-calling이 표준화한 방식처럼 도구 정의에 `returns` 또는 `output_schema` 필드를 추가하고, 통합 테스트에서 실제 응답이 해당 스키마를 준수하는지 검증한다.

---

**[WARNING] `planStepId`(레거시)와 `planStepIds`(권장)의 동시 지원으로 인한 계약 모호성 (tool-definitions.ts)**
- 위치: `add_node`, `update_node`, `remove_node`, `add_edge`, `remove_edge` 의 파라미터 정의
- 상세: 두 필드가 모두 선택적(optional)으로 존재하며 둘 다 허용된다. 시스템 프롬프트에는 `planStepIds`를 선호하라고 명시되어 있지만, 도구 스키마 자체에는 `planStepId`의 deprecated 표시가 없다. LLM이 두 필드를 동시에 전송하는 경우 서버 처리 우선순위가 문서화되지 않았다.
- 제안: `planStepId`를 `deprecated: true`로 마킹하거나, `description`에 "Deprecated: use `planStepIds` instead" 를 명시한다. 서버에서 두 필드 동시 전송 케이스에 대한 결정적 처리 규칙을 테스트로 고정한다.

---

**[WARNING] `JSON.parse(tc.arguments)` — 오류 처리 없음 (anthropic.client.ts)**
- 위치: `chat()` 메서드 내 메시지 맵핑, 어시스턴트 히스토리 재구성 경로
- 상세: `toolCalls`가 있는 어시스턴트 메시지를 Anthropic 포맷으로 변환할 때 `JSON.parse(tc.arguments)`를 try-catch 없이 호출한다. `arguments`가 스트리밍 중 truncated된 부분 JSON이거나 빈 문자열일 경우 `SyntaxError`가 caller 전체를 crash시킨다.
- 제안:
  ```ts
  input: (() => {
    try { return JSON.parse(tc.arguments); } catch { return {}; }
  })(),
  ```

---

**[INFO] JSON Schema의 `default`/`format` 은 서버 측 강제 없음 (tool-definitions.ts)**
- 위치: `add_edge.source_port` (default: `'out'`), `add_edge.type` (default: `'data'`), `get_workflow.id` (format: `'uuid'`)
- 상세: JSON Schema의 `default`와 `format` 키워드는 function-calling에서 문서화 목적으로만 작동하며 서버/LLM이 자동으로 강제하지 않는다. LLM이 `type` 필드를 생략하면 서버가 명시적으로 default를 처리해야 하고, 유효하지 않은 UUID 문자열을 `id`로 전송해도 스키마 레벨에서 거부되지 않는다.
- 제안: `required` 배열에 필수 식별자 파라미터를 추가하거나, 서버 핸들러에서 명시적으로 default 적용 및 UUID 형식 검증을 수행한다.

---

**[INFO] `testConnection`의 모델 하드코딩 (anthropic.client.ts)**
- 위치: `testConnection()` 메서드
- 상세: `'claude-haiku-4-5-20251001'` 모델이 폴백으로 하드코딩되어 있다. 해당 모델이 deprecated되면 `testConnection`이 실패해 API 키가 유효함에도 연결 오류로 오인될 수 있다.
- 제안: 폴백 모델을 상수로 분리하거나, `listModels()`의 첫 번째 결과를 사용하는 동적 폴백을 구현한다.

---

### 요약

변경 코드는 외부 HTTP API 엔드포인트가 아닌 LLM function-calling 도구 계약 레이어를 다루며, Anthropic SDK를 통한 API 호출 및 LLM에게 노출되는 도구 스키마가 핵심 계약 경계다. 주요 위험은 두 곳에 집중된다: (1) `anthropic.client.ts`에서 SDK 타입 우회(`as never`, `as unknown as`)와 문자열 기반 에러 코드 감지로 인해 SDK 버전 업그레이드 시 silently break될 가능성, (2) `tool-definitions.ts`에서 도구 요청 파라미터만 정의하고 응답 shape는 시스템 프롬프트 산문에만 의존해 서버-프롬프트 간 드리프트를 정적으로 탐지하기 어려운 구조. `planStepId`/`planStepIds` 이중 지원 및 JSON Schema `default`의 비강제 특성도 계약 명확성을 저하시킨다.

### 위험도
**MEDIUM**