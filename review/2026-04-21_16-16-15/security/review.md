## 보안 코드 리뷰 결과

---

### 발견사항

---

#### **[WARNING] LLM 오류 메시지에서 에러 코드 감지 방식 — 문자열 매칭**
- **위치**: `anthropic.client.ts`, `openai.client.ts` — 오류 처리 블록
- **상세**: `message.includes('429')`로 rate limit을 판별함. 오류 메시지 포맷이 바뀌거나, 악의적인 프로바이더가 "429"를 포함한 메시지를 반환할 경우 오탐/미탐 가능.
- **제안**: HTTP 상태 코드나 SDK의 타입 가드(`error instanceof Anthropic.RateLimitError` 등)를 우선 사용.

---

#### **[WARNING] 워크플로우 스냅샷의 `config` 필드가 LLM 시스템 프롬프트에 포함될 가능성**
- **위치**: `system-prompt.ts` — `buildSystemPrompt()`, `workflow-assistant-stream.service.ts`
- **상세**: `AssistantMessageRequestDto.currentWorkflow.nodes[].config`는 `Record<string, unknown>`으로 크기 제한이 없다. config에 API 키, 비밀번호, 연결 문자열 등 민감 정보가 포함된 노드 설정값이 LLM 프롬프트에 그대로 실려갈 수 있음. 스냅샷은 사용자가 POST 바디로 직접 조합해 전송하기 때문에 서버 측 필터링이 없으면 민감 필드가 외부 LLM API로 유출됨.
- **제안**: 스트림 서비스에서 프롬프트 조립 전 `config` 필드에서 패스워드·토큰·키 류의 필드명을 redact 처리하거나, 시스템 프롬프트에 `config` 전체를 포함하지 않고 레이아웃/타입 정보만 포함하도록 제한.

---

#### **[WARNING] `get_workflow` explore 도구 — 다른 워크플로우의 `config` 노출**
- **위치**: `explore-tools.service.ts` — `getWorkflow()`, `tool-definitions.ts`
- **상세**: `mode: 'full'`일 때 다른 워크플로우의 노드 `config` 전체를 반환함. LLM이 이 값을 이용할 수 있고, 시스템 프롬프트에 삽입되어 외부 LLM API로 전달됨. 인가 확인은 `workspaceId`만으로 하며, 같은 워크스페이스 내 모든 워크플로우에 접근 가능.
- **제안**: `full` 모드를 제거하거나, config 내 민감 필드(secret, password, key, token, credential)를 항상 redact. LLM 도구 정의에서 `full` 옵션을 제거하는 것도 고려.

---

#### **[WARNING] SSE 스트림 응답에서 내부 오류 메시지 노출**
- **위치**: `workflow-assistant.controller.ts` — `sendMessage()` catch 블록
- **상세**: `error instanceof Error ? error.message : 'Unknown error'`를 그대로 클라이언트에 write함. 내부 스택 트레이스, DB 오류, LLM 오류 상세가 포함될 수 있음.
- **제안**: 오류 코드만 클라이언트에 반환하고, 상세 메시지는 서버 로그에만 기록.

---

#### **[WARNING] 사용자 입력(`content`) 길이 제한 없음**
- **위치**: `assistant-message-request.dto.ts` — `AssistantMessageRequestDto.content`
- **상세**: `@IsString()`만 있고 `@MaxLength()` 데코레이터 없음. 매우 긴 메시지를 전송하여 LLM 토큰 소비 또는 시스템 프롬프트 조립 비용 증가 유도 가능.
- **제안**: `@MaxLength(4000)` 또는 서비스 정책에 맞는 길이 제한 추가.

---

#### **[WARNING] `currentWorkflow.nodes` 배열 크기 제한 없음**
- **위치**: `assistant-message-request.dto.ts`, `workflow-assistant-stream.service.ts`
- **상세**: 클라이언트가 수천 개의 노드를 포함한 스냅샷을 전송하면 시스템 프롬프트가 LLM context window를 초과하거나, 처리 지연/OOM 유발 가능.
- **제안**: DTO에서 `nodes`, `edges` 배열의 최대 길이 제한(`@ArrayMaxSize()`), 또는 서비스에서 slice 처리.

---

#### **[WARNING] `findOneForUser` — workspace 불일치 시 403 대신 404 반환**
- **위치**: `workflow-assistant-session.service.ts` — `findOneForUser()`
- **상세**: `session.workspaceId !== workspaceId`일 때 `NotFoundException`을 던짐. 정보 은닉 목적으로 이해되나, 같은 함수에서 `userId !== userId`는 `ForbiddenException`을 던져 일관성이 없음. 공격자가 다른 워크스페이스의 세션 UUID를 404를 통해 열거하는 것을 막지 못함(ID가 UUID라 실질적 위험은 낮으나).
- **제안**: 두 경우 모두 동일한 `NotFoundException`으로 통일하거나, 워크스페이스 체크를 쿼리 WHERE 조건에 포함해 DB 수준에서 처리.

---

#### **[WARNING] SSE 연결 당 `AbortController` 누수 가능성**
- **위치**: `workflow-assistant.controller.ts` — `sendMessage()` finally 블록
- **상세**: `req.off('close', onClose)` 전에 예외 발생 시 이벤트 리스너가 해제되지 않을 수 있음 (finally에서 처리하므로 실제로는 괜찮으나, `res.end()` 이후 추가 write 시도 방어 로직 `if (!res.writableEnded)` 없는 keepalive 핸들러 타이밍 이슈 가능).
- **제안**: `clearInterval(keepalive)`가 `finally` 가장 첫 번째로 실행되도록 순서 보장.

---

#### **[INFO] LLM 응답 내 tool call `arguments`를 `JSON.parse` 없이 사용 시 오류**
- **위치**: `anthropic.client.ts` — `tc.arguments` 파싱 `JSON.parse(tc.arguments)` (stream 시 `input_json_delta` 누적 후)
- **상세**: partial JSON이 완전히 누적되기 전에 parse를 시도하는 경로가 없어 현재 구현은 올바름. 단, `tool_call_end`에서 `block.args || '{}'`로 fallback하는 점은 빈 인자가 유효하지 않은 스키마에 대해 validation 없이 통과될 수 있음.
- **제안**: 서비스 레이어에서 tool call arguments를 JSON Schema 검증 후 실행.

---

#### **[INFO] 프론트엔드 — `applyAssistantOperation`이 서버 검증 없이 에디터 상태 직접 변경**
- **위치**: `editor-store.ts` — `applyAssistantOperation`, `assistant-store.ts` — `handleSseEvent`
- **상세**: SSE `tool_call` 이벤트의 `result.ok === true`만 확인하고 바로 클라이언트 상태를 변경함. 악의적인 중간자(MITM)나 서버 버그가 `ok: true`를 반환하면 임의 노드 추가/삭제가 클라이언트에서 발생. 단, HTTPS 환경에서 MITM 위험은 낮음.
- **제안**: SSE는 서버가 push하는 신뢰된 채널이므로 현재 구조에서 큰 문제는 아니나, 클라이언트가 `result`를 sanity-check(예: `res.id`가 UUID 패턴인지)하는 것을 권장.

---

### 요약

전체적으로 인증/인가 구조(JWT + RolesGuard + workspace 스코핑)는 잘 갖추어져 있으며, SQL 인젝션 위험은 TypeORM의 파라미터 바인딩으로 차단되어 있다. 가장 주목해야 할 위험은 **노드 `config`에 포함될 수 있는 민감 정보(API 키, 패스워드 등)가 LLM 프롬프트를 통해 외부 AI 서비스로 전달될 수 있다는 점**이다. 또한 사용자 메시지와 스냅샷 배열에 대한 크기 제한이 없어 LLM 비용 과다 소비 및 서비스 안정성 문제가 발생할 수 있다. SSE 오류 메시지 노출과 `get_workflow full` 모드의 config 반환도 보완이 필요하다.

---

### 위험도

**MEDIUM**