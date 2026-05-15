### 발견사항

---

#### anthropic.client.ts

- **[HIGH] `JSON.parse(tc.arguments)` 미보호 — 히스토리 재조립 시 예외 전파**
  - 위치: `chat()` L42–47, `stream()` L215–220 (assistant toolCalls 루프)
  - 상세: 대화 히스토리를 Anthropic 메시지 형식으로 재조립하는 과정에서 `JSON.parse(tc.arguments)`를 try/catch 없이 호출. streaming 중 부분 수신된 인자가 DB에 저장된 뒤 다음 턴에 로드될 때 malformed JSON이면 unhandled exception이 발생해 전체 스트림이 중단됨.
  - 제안: `JSON.parse(tc.arguments)` 를 `safeParseJson(tc.arguments, {})` 같은 보호 래퍼로 감싸거나, try/catch로 `input: {}` 폴백 처리.

- **[WARNING] `tool_result` content에 null 전달 가능**
  - 위치: `chat()` L55–62, `stream()` L228–235 (`m.role === 'tool'` 분기)
  - 상세: `content: m.content`를 그대로 넘기는데, `LLMMessage.content`가 `null`이면 Anthropic API는 `content: null`을 거부하고 400을 반환. `tool_result` content는 반드시 string 또는 block 배열이어야 함.
  - 제안: `content: m.content ?? ''` 또는 `content: m.content || '[no content]'`로 폴백.

- **[WARNING] `toolCallId || ''` — 빈 문자열 tool_use_id가 API 오류 유발**
  - 위치: `chat()` L57, `stream()` L230
  - 상세: `m.toolCallId`가 없으면 `''`를 `tool_use_id`로 전송. Anthropic은 `tool_use_id`가 실제 존재하는 `tool_use` 블록 id와 일치해야 하며, 빈 문자열은 API 오류를 유발함. 히스토리 재구성 버그와 결합하면 전체 메시지 전송 실패.
  - 제안: `toolCallId`가 없으면 해당 메시지 자체를 필터링하거나 예외를 던져 상위에서 처리.

- **[WARNING] 에러 코드 감지 `message.includes('429')` — 취약한 문자열 매칭**
  - 위치: `stream()` L258, L291 (두 곳의 catch 블록)
  - 상세: Anthropic SDK는 `RateLimitError` 클래스를 별도로 노출(`error instanceof Anthropic.RateLimitError` 또는 `error.status === 429`). 에러 메시지에 "429"가 포함되지 않거나 메시지 포맷이 바뀌면 rate limit를 `LLM_CONNECTION_ERROR`로 잘못 분류함.
  - 제안: `error instanceof Anthropic.RateLimitError` 또는 `(error as { status?: number }).status === 429` 확인으로 교체.

- **[WARNING] `{ type: 'none' } as never` 타입 강제 캐스트**
  - 위치: `chat()` L66, `stream()` L239
  - 상세: `as never` 캐스트는 컴파일러가 타입 불일치를 감지하지 못하게 막음. Anthropic SDK ToolChoiceParam 타입 정의에 `'none'`이 없거나 형식이 다를 경우 런타임 오류가 발생해도 사전에 탐지 불가.
  - 제안: SDK의 `ToolChoiceAuto | ToolChoiceAny` 교차 타입을 확인하고, `none` 처리가 실제로 API에서 지원되는지 검증 후 적절한 타입 선언 또는 타입 가드 추가.

- **[INFO] `testConnection` 하드코딩 폴백 모델**
  - 위치: L174
  - 상세: `this.defaultModel || 'claude-haiku-4-5-20251001'` — 폴백 모델명이 하드코딩되어 향후 deprecated 될 수 있음. 최소 토큰 테스트 목적이므로 상수화 권장.

---

#### system-prompt.ts

- **[WARNING] `renderNodeCatalog` JSDoc과 ED-AI-40 정책 불일치**
  - 위치: L78–82 (함수 JSDoc)
  - 상세: JSDoc이 "LLM이 `add_edge` 전에 `get_node_schema`로 실제 포트를 먼저 확인해야 함"이라고 서술하지만, 코드 본문(`STATIC_BLOCK_2_CONTRACTS`의 dynamic-ports 절)과 spec 테스트(ED-AI-40 기조)는 정반대를 명시 — `add_node`/`update_node` 결과의 `result.ports`를 바로 사용하고 `get_node_schema` 선행 호출은 불필요. 주석이 살아있으면 개발자 혼선을 유발.
  - 제안: JSDoc을 "live port ids come back on every `add_node`/`update_node` via `result.ports`; `get_node_schema` is only for pre-existing unedited nodes" 로 업데이트.

- **[INFO] `sanitizeUserText`의 `"` → `'` 치환이 과도하게 공격적**
  - 위치: L354
  - 상세: 사용자 요청의 ASCII 큰따옴표를 모두 작은따옴표로 교체하면, 사용자가 의도한 표현이 변형되어 LLM이 다른 의미로 해석할 수 있음.
  - 제안: XML fence(`<user-request>...</user-request>`) 자체가 구분 경계를 제공하므로 `<`/`>` 치환으로 충분함. 큰따옴표 치환은 제거 검토.

---

#### system-prompt.spec.ts

- **[INFO] `resetExpressionCacheForTesting` 테스트 — 실제 캐시 무효화 검증 없음**
  - 위치: 마지막 `resetExpressionCacheForTesting` describe 블록
  - 상세: `prompt1 === prompt2` 검증은 출력 결정성만 확인할 뿐, 캐시가 실제로 초기화·재생성되었는지는 검증하지 않음. `resetExpressionCacheForTesting`이 no-op이어도 테스트가 통과.
  - 제안: `getAllFunctionNames`를 mock해서 리셋 전후 다른 결과를 반환하도록 하면 캐시 재생성 경로를 실제로 검증 가능.

---

### 요약

코드 전반의 구조는 요구사항을 잘 반영하고 있으며, 병렬 도구 호출 유도(ED-AI-40), plan gating, pendingUserConfig, 프롬프트 인젝션 방어 등 핵심 비즈니스 로직이 충실히 구현되어 있다. 그러나 `anthropic.client.ts`에는 대화 히스토리 재조립 시 `JSON.parse` 미보호, `tool_result` content null 전달, 빈 `tool_use_id` 전송이라는 조합으로 **다음 턴 LLM 호출 자체가 실패하는** 연쇄 오류 경로가 존재한다. 특히 이 세 가지 결함은 동시에 발생할 수 있는 시나리오(도구 호출 후 스트리밍 중단 → DB 저장 → 다음 턴 재조립)이므로 프로덕션 배포 전 수정이 필요하다. 나머지 경고 항목들은 런타임 안정성보다는 방어적 코드 품질과 유지보수성에 관한 것이다.

### 위험도

**HIGH**