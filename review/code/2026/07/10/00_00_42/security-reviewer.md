# Security Review — HEAD f456adedf (구조화 필드 JSON-safe redaction + ai_message egress 마스킹)

대상: `git show f456adedf` (thread-renderer.ts / ai-turn-orchestrator.service.ts / sanitize-error-message.ts + spec 동기화)

## 발견사항

### [CRITICAL] `nodeOutput.conversationConfig` (+ REST `nodeOutput`/`outputData`) 가 같은 이벤트/응답 안에서 방금 마스킹한 것과 동일한 raw 시크릿을 그대로 재노출

- 위치:
  - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:814-817` — 이번 커밋이 직접 손댄 `handleAiMessageTurn` 의 follow-up `EXECUTION_WAITING_FOR_INPUT` emit. 바로 위(787-789줄)에서 `conversationThreadSnapshot = redactThreadForPublic(liveThread)` 로 마스킹해놓고, 같은 payload 의 `nodeOutput.conversationConfig: { ...nextConv, ... }` 는 `nextConv`(= `buildConversationConfigFromOutput` 이 만든 `{message, messages, presentations, extracted, missingFields, ...}`, 전혀 마스킹 안 됨)를 그대로 스프레드.
  - `ai-turn-orchestrator.service.ts:470-475` — `emitAiWaitingForInput`(최초 진입 waiting emit, 이번 diff 는 미수정이지만 동일 이벤트 타입·동일 취약 패턴)의 `nodeOutput.conversationConfig: { ...initialConv, ... }` 도 동일하게 raw.
  - `codebase/backend/src/modules/external-interaction/interaction.service.ts:307`, `:314` — REST `GET /api/external/executions/:id`(`getStatus`) 가 `nodeOutput: out`(= `NodeExecution.outputData`, DB 에 영속된 raw 구조)을 그대로 응답에 동봉.
- 상세: `EXECUTION_WAITING_FOR_INPUT` 이벤트는 `WebsocketService.emitExecutionEvent` 를 통해 internal WS wire 뿐 아니라 **외부 fanout**(`executionEventSubject` → `SseAdapter`/`NotificationFanout`/`ChatChannelDispatcher`)으로도 그대로 나간다(`websocket.service.ts:441-495`). fanout 직전 필터는 `stripExternalOnlyFields`(`llmCalls` 만 제거) 와 `sanitizePayloadForWs`(키 이름 기반, `password/secret/token/...` exact match)뿐이라 값 패턴(`Bearer …`, `Authorization: …`) 기반 시크릿은 걸러지지 않는다. 즉 `message`/`content` 같은 일반 키 아래 박힌 시크릿 값은 `sanitizePayloadForWs` 를 통과한다.
  게다가 `nodeOutput.conversationConfig` 는 부가 필드가 아니라 **주 소비 경로**다 — 같은 파일 주석(479-482줄 부근, `context = { ...base, nodeOutput: out }` 직전)에 명시된 대로 "form / ai_conversation: parseWaitingForInput 이 nodeOutput.formConfig / nodeOutput.conversationConfig 를 읽는다" — 즉 대기 상태 UI 는 (마스킹된) `conversationThread` 가 아니라 이 raw 필드를 기본으로 읽도록 설계돼 있다.
  재현 시나리오: AI 응답 텍스트나 tool 호출 결과에 실제 `Authorization: Bearer sk-live-...` 값이 담기면(예: 통합 노드가 에러/응답을 그대로 되돌려주는 경우, 프롬프트 인젝션으로 모델이 이전 tool 결과의 토큰을 그대로 재출력하는 경우), 이번 커밋이 마스킹한 `AI_MESSAGE.message`/`.messages[]`/`.presentations[]` 와 `conversationThread` 스냅샷은 안전해지지만, **같은 turn 의 같은 값**이 `EXECUTION_WAITING_FOR_INPUT.nodeOutput.conversationConfig.message/.messages/.presentations` 와 REST `getStatus` 의 `nodeOutput`(`outputData`)을 통해 SSE 토큰 보유자·webhook 수신자·Chat Channel 로 그대로 나간다.
- 참고: 이 자체는 이번 diff 가 새로 만든 구멍이 아니라 커밋 메시지·spec 갱신(`spec/5-system/14-external-interaction-api.md`)에서도 "**`outputData`/`nodeOutput` 키 allowlist (미구현·잔여)**" 로 명시적으로 추적 중인 항목이다. 다만 그 문구는 "노출 키 집합을 제한하는 allowlist" 라는 위생/최소화 프레이밍이라, "이번 커밋이 방금 막은 것과 동일한 raw 시크릿이 형제 필드로 완전히 우회 가능하다"는 실질 위험도를 과소평가하는 것으로 보인다. `execution.ai_message` 공개 표면 마스킹을 "강제됨(enforced)" 이라고 서술한 spec 문구와 실제 동작(같은 이벤트 안에 미마스킹 사본 존재) 사이에 괴리가 있다.
- 제안: `nodeOutput.conversationConfig`(및 `buttonConfig.nodeOutput`, REST `context.nodeOutput`)도 `EXECUTION_WAITING_FOR_INPUT` fanout 직전(또는 `buildConversationConfigFromOutput` 반환 직후) 동일한 `redactSecrets`/`deepRedactSecrets`/`redactSecretsInJsonString` 을 적용하거나, 최소한 external fanout 경로에서 `nodeOutput`/`outputData` 를 렌더 필수 키로 allowlist 하기 전까지는 spec 의 "강제됨" 서술을 "부분적으로만 강제됨(잔여: nodeOutput 경유 우회)" 으로 정정해 후속 우선순위를 정확히 반영할 것을 권장.

### [WARNING] `AI_MESSAGE.messages[].toolCalls[].arguments`(중첩 raw JSON 문자열)는 `redactSecretsInJsonString` 을 타지 않고 flat 패턴 치환을 받아 JSON 이 깨질 수 있음 — 커밋이 고치려던 것과 동일 클래스의 버그가 다른 경로로 재발

- 위치: `ai-turn-orchestrator.service.ts:740-742`(`deepRedactSecrets(nextConv.messages)`), `:866-868`(`deepRedactSecrets(condMessages)`). 소스: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1580-1584` 의 `messages.push({ role: 'assistant', content, toolCalls: result.toolCalls })` — `toolCalls[].arguments` 는 `ConversationTurnToolCall.arguments: string`(raw JSON, `conversation-thread.types.ts:111`)와 동일 shape.
- 상세: `deepRedactSecrets` 는 문자열 leaf 를 만나면 무조건 `redactSecrets`(플랫 정규식 치환)을 적용한다(`sanitize-error-message.ts:82`). `messages[i].toolCalls[j].arguments` 는 object 가 아니라 raw JSON **문자열**이므로 이 leaf 판정에 걸려 `redactSecretsInJsonString`(parse→deep→재직렬화, JSON-safe) 이 아니라 flat `redactSecrets` 로 처리된다. flat 치환은 매치된 부분 문자열을 통째로 `***` 로 바꾸므로 JSON 구조를 깨뜨릴 수 있다.
- 실측 재현: `deepRedactSecrets` 를 직접 호출해 확인함 (`npx jest` 로 임시 spec 실행 후 삭제, 리포지토리에는 남기지 않음).
  ```
  input : {"endpoint":"https://api.example.com","api_key":"AKIA1234567890"}
  output: {"endpoint":"https://api.example.com",***}
  JSON.parse(output) → SyntaxError: Expected double-quoted property name in JSON at position 38
  ```
  즉 `messages[].toolCalls[].arguments` 에 `api_key`/`secret`/`Authorization:` 같은 키워드-값 패턴이 섞여 있으면 마스킹 후 `arguments` 가 **깨진 JSON 문자열**이 되어 이를 파싱해 툴콜 인자를 렌더링하는 외부 SSE/Chat Channel 클라이언트가 실패한다. (시크릿 값 자체는 `***` 로 가려지므로 기밀성은 지켜지나, 이 커밋이 명시적으로 방지하려 했던 "JSON 을 깨는" 문제가 `turn.toolCalls[].arguments`(thread-renderer.ts, 이번에 고침) 가 아닌 `ai_message.messages[].toolCalls[].arguments`(고치지 않음) 에서 그대로 재발한다.)
  같은 신규 테스트(`ai-turn-orchestrator.service.spec.ts` 의 `(b2)`)는 `messages[].content` 안의 평문 시크릿만 검증하고 `toolCalls` 를 포함한 메시지는 다루지 않아 이 경로는 회귀 테스트로도 잡히지 않는다.
- 제안: `messages[]` 를 마스킹할 때 각 message 의 `toolCalls[].arguments` 필드를 감지해 `redactSecretsInJsonString` 으로 우회 처리하거나, `deepRedactSecrets` 자체에 "이 키가 `arguments`/`toolCalls[].arguments` 형태의 raw-JSON 필드다" 라는 스키마 인지를 추가.

### [WARNING] `CREDENTIAL_KEY_PATTERN` 키 매칭 — 과소(흔한 헤더 키 누락) / 과잉(일반 단어 오탐) 양쪽 다 존재

- 위치: `sanitize-error-message.ts:65-66` (`CREDENTIAL_KEY_PATTERN`, 신규 `deepRedactSecrets` 전용이지만 `websocket.service.ts:223-224` 의 동일 패턴을 의도적으로 미러링).
- 과소 (miss): 패턴이 `^(...)$` 로 완전 일치만 허용해 `x-api-key`, `x-auth-token` 같은 **하이픈 프리픽스가 붙은 흔한 HTTP 헤더 키**를 잡지 못한다. `api[_-]?key` 는 문자열 전체가 `api...key` 형태여야 매치되므로 `"x-api-key"` 는 대상 밖. 값 자체도 (`AKIA...` 처럼 키워드-프리픽스 없는 bare 토큰이면) `redactSecrets` 의 값 패턴에도 안 걸린다. `turns[].data`/`presentations[].payload`/`toolCalls[].arguments` 는 정확히 "AI 가 만든 임의 API 호출 인자" 를 담는 필드라 `x-api-key: <value>` 형태의 실제 시크릿이 나타날 개연성이 낮지 않다. (기존 WS 레이어의 pre-existing 제약을 그대로 물려받은 것이라 이번 diff 가 새로 만든 결함은 아니지만, 적용 대상이 tool-call 인자·AI 응답이라는 훨씬 노출 가능성 높은 데이터로 확장됐다는 점에서 실질 리스크가 커졌다.)
- 과잉 (false positive): 정확히 `token`/`secret` 이라는 이름의 **비-시크릿 필드**(예: 암호화폐 심볼 `token`, 페이지네이션 커서 `token`, UI 도메인 용어)가 있으면 값 전체가 `***` 로 무조건 대체된다. 사용자에게 노출되는 AI 응답/구조화 데이터가 뜻하지 않게 손상될 수 있다(보안성보다는 데이터 정합성 문제지만, 리뷰 지시사항에 명시된 항목이라 기록).
- 제안: (a) `x-api-key`/`x-auth-token` 등 프리픽스형 흔한 헤더 키 이름을 패턴에 추가, (b) 과잉 마스킹은 현재 설계상 감내 가능한 트레이드오프로 보이며 별도 조치는 우선순위 낮음(문서화만 권장).

### [INFO] `deepRedactSecrets` 에 재귀 깊이 상한 없음 — `sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH` 방어와 비대칭

- 위치: `sanitize-error-message.ts:81-107`(`deepRedactSecrets`) vs `websocket.service.ts:226,249-263`(`sanitizePayloadForWs`, `MAX_SANITIZE_DEPTH = 10` 초과 시 `'[REDACTED_DEPTH]'` 로 강제 치환).
- 상세: `deepRedactSecrets` 는 깊이 제한이 없고, 호출부(`thread-renderer.ts`, `ai-turn-orchestrator.service.ts`) 어디에도 try/catch 가 없다. LLM 이 생성하는 `presentations[].payload`/`toolCalls[].arguments`(parse 후 구조) 는 모델이 사실상 자유롭게 구조를 만들 수 있는 입력이라, 극단적으로 깊게 중첩된 구조가 들어오면(프롬프트 인젝션 등으로 유도 가능성 있음) 스택 오버플로(`RangeError`)로 emit/REST 핸들러가 처리되지 않은 예외를 던질 수 있다. `redactSecretsInJsonString` 은 `JSON.parse` 실패만 catch 하고 이후 `deepRedactSecrets` 호출은 보호되지 않는다.
- 실무적으로 발생 가능성은 낮음(수천 단계 중첩이 필요하고 JSON.parse 자체도 그 전에 한계를 만날 수 있음)이나, 기존에 이미 채택된 깊이 상한 패턴과 비대칭이라는 점에서 defense-in-depth 일관성 차원의 기록.
- 제안: `deepRedactSecrets` 에도 depth 파라미터 + 상한(예: 기존 `MAX_SANITIZE_DEPTH` 재사용)을 추가하거나, 최소한 호출부에서 예외를 잡아 안전한 폴백(예: 원본 대신 `'[REDACTION_FAILED]'`)으로 처리.

### [INFO] `redactSecretsInJsonString` 의 JSON round-trip 이 큰 정수 정밀도를 손상시킬 수 있음

- 위치: `sanitize-error-message.ts:117-127`(`redactSecretsInJsonString`), 소비처 `thread-renderer.ts` 의 `toolCalls[].arguments` 마스킹.
- 실측: `JSON.parse('{"id":9007199254740993,...}')` → `JSON.stringify` 재직렬화 시 `9007199254740992` 로 값이 바뀜(`Number.MAX_SAFE_INTEGER` 초과). Tool 호출 인자에 큰 정수 ID(스노플레이크 ID, 나노초 타임스탬프 등)가 있으면 공개 표면에 표시되는 값이 실제 전송된 값과 달라질 수 있다.
- egress-only 설계라 durable 저장/LLM 재주입 경로에는 영향이 없고(§8.4/`§R17` 문서화된 대로 마스킹은 read/emit-time 에만 적용), 보안 취약점이라기보다 표시 정확도 문제. 참고로만 기록.

## 확인 완료(이슈 없음)

- **Egress-only 유지**: `redactThreadForPublic`/`deepRedactSecrets`/`redactSecretsInJsonString` 은 모두 순수 함수(copy-on-change, mutation 없음)이며, 호출부는 `context.conversationThread`/`Execution.conversation_thread`/`NodeExecution._resumeState` 등 durable·LLM 재주입 경로가 아니라 emit/응답 조립 시점에만 사용됨을 코드로 확인. 저장 시점(append-time) redaction 은 여전히 미적용(의도된 설계, LLM 컨텍스트 오염 방지).
- **`llmCalls` internal/external 경계**: `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`(`websocket.service.ts:310`)는 이번 diff 로 변경되지 않았고, `buildAiMessageDebugFromResumeState` 가 만드는 top-level `llmCalls` 키와 정확히 일치해 여전히 external fanout 에서만 strip 됨을 확인. 이번 diff 가 추가한 `redactSecrets(message)`/`deepRedactSecrets(messages/presentations)` 는 payload 조립 시점(내부 wire 와 external fanout 분기 이전)에 적용되므로 **내부 인증 WS 에디터 채널도 마스킹된 값을 받는다** — 이는 spec 에 명시적으로 문서화된 의도된 트레이드오프(과다 마스킹 쪽으로 치우침, 안전한 방향)이며 취약점 아님.
- `SECRET_LEAK_PATTERNS` 4개 정규식에서 중첩 quantifier 등 ReDoS 유발 구조는 발견되지 않음.
- 이번 diff 에서 하드코딩된 시크릿/자격증명은 발견되지 않음.

## 요약

이번 커밋은 목표한 두 표면(`redactThreadForPublic` 의 구조화 필드, `AI_MESSAGE` 두 emit site 의 `message`/`messages`/`presentations`)에 대해서는 마스킹을 정확히 구현했고 관련 신규 테스트도 통과 가능한 수준으로 작성돼 있다. 다만 같은 `EXECUTION_WAITING_FOR_INPUT` 이벤트(및 REST `getStatus`) 안에 존재하는 형제 필드 `nodeOutput.conversationConfig`(및 `outputData`)가 정확히 같은 raw 데이터를 마스킹 없이 그대로 외부 SSE/webhook/Chat Channel 로 내보내고 있어, 마스킹 우회 경로가 실질적으로 열려 있다 — 더구나 이 필드는 대기 상태 UI 렌더링의 주 소비 경로로 코드 주석에 명시돼 있어 부수적 경로가 아니다. 이는 커밋 자신의 spec 갱신에도 "잔여(outputData/nodeOutput allowlist)" 로 이미 추적되고 있는 항목이지만, 실질적으로는 이번에 추가된 마스킹의 보안 효과를 크게 상쇄한다는 점을 명확히 인지할 필요가 있다. 추가로 `AI_MESSAGE.messages[].toolCalls[].arguments`(중첩 raw JSON)는 `redactSecretsInJsonString` 을 타지 않아 이 커밋이 다른 곳에서 고친 것과 동일한 "마스킹이 JSON 을 깨는" 문제가 재발할 수 있음을 실측으로 확인했다. 나머지(키 패턴 커버리지 한계, 깊이 상한 부재, 큰 정수 정밀도 손실)는 낮은 실무적 영향의 견고성 항목이다.

## 위험도

HIGH
