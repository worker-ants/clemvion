# 부작용 리뷰 — HEAD f456adedf (feat(external-interaction): 구조화 필드 JSON-safe redaction + ai_message egress 마스킹)

## 발견사항

- **[WARNING]** 신규 마스킹 표면이 "표시/디버그"가 아니라 "실제 발송"까지 확장됨 — false-positive redaction 이 Chat Channel(Telegram/Slack/Discord) 로 나가는 실제 메시지를 비가역적으로 손상시킬 수 있음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:738,864` (`message: redactSecrets(nextConv.message)` / `redactSecrets(responseText)`) → `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:495-519` (`execution.ai_message` 케이스가 `event.payload.message` 를 그대로 dispatcher 출력 `message` 로 사용)
  - 상세: `emitExecution` 은 내부 WS wire envelope 과 외부 fanout envelope(SseAdapter/NotificationFanout/ChatChannelDispatcher) 을 **같은 payload** 에서 파생시킨다(websocket.service.ts:441-477, `stripExternalOnlyFields` 는 `llmCalls` 만 벗겨내고 `message`/`messages`/`presentations` 는 그대로 통과). 이번 diff 이전에는 `ai_message.message`/`.messages[]` 가 전혀 마스킹되지 않았는데(스펙 구절도 "미커버·별개 표면"이었음), 이제는 egress 시점에 `SECRET_LEAK_PATTERNS` 로 마스킹된 뒤 그대로 `chat-channel.dispatcher.ts` 가 소비해 Telegram 등으로 **실제 발송**한다. `SECRET_LEAK_PATTERNS` 중 `/"?\b(...|password|passwd|pwd|...)"?\s*[=:]\s*.../gi` 와 `/\bAuthorization:[^\r\n]*/gi` 는 일반 대화체에서 흔히 오탐할 수 있는 패턴이다 — 예를 들어 코딩/터미널 지원 챗봇이 `pwd: /home/user` 를 설명하거나, "Authorization: 관리자 승인이 필요합니다" 같은 문장을 답하면 뒤 문장 전체가 `***` 로 치환된 채 사용자에게 전송된다. `text`/`runningSummary` 필드는 기존에도 같은 패턴으로 마스킹돼 왔지만 그건 "재노출(read-only REST/SSE 렌더)" 표면이었던 반면, 이번에 새로 편입된 `ai_message.message`는 **능동 발송** 표면이라 오탐의 결과가 (내부 debug 패널처럼) 확인·복구 가능한 게 아니라 사용자에게 이미 전달된 메시지 자체가 훼손된다.
  - 제안: 최소한 (a) 실제 대화 로그 샘플로 false-positive rate 를 점검하는 회귀 테스트를 추가하거나, (b) Chat Channel 발송 전용 경로에는 더 타이트한(리터럴 시크릿 형태에 한정된) 패턴을 쓰는 것을 검토. 최소 스펙 문서에 "발송 표면 오탐 시 복구 불가"라는 트레이드오프를 명시적으로 기록해 향후 담당자가 인지하게 할 것.

- **[WARNING]** `deepRedactSecrets`/`redactSecretsInJsonString` 에 깊이(depth) 제한이 없음 — 형제 WS-layer sanitizer 가 겪었던 것과 동일한 클래스의 리스크가 무방비
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:81-127` (`deepRedactSecrets`, `redactSecretsInJsonString`)
  - 상세: 같은 코드베이스의 `codebase/backend/src/modules/websocket/websocket.service.ts:226,242-251` 의 `sanitizePayloadForWs` 는 `MAX_SANITIZE_DEPTH = 10` 을 명시적으로 두고 있고, 주석에 "옛 구현은 원본을 그대로 반환해 누출 위험이 있었음(Review 후속 #4)"이라고 **동일 문제를 이미 한 번 겪었던 이력**이 남아 있다. 그런데 이번에 추가된 `deepRedactSecrets`(및 이를 감싸는 `redactSecretsInJsonString`)는 깊이 캡도, 순환참조 방지도 없이 무제한 재귀한다. 이 함수는 `turns[].data`, `presentations[].payload`, `toolCalls[].arguments`(파싱된 JSON), `ai_message.messages[]`/`.presentations[]` 등 **LLM/외부 tool 이 만들어낸, 신뢰도가 낮은 구조**를 입력으로 받는다. 깊이 중첩된(또는 handler 버그로 순환 참조가 생긴) 객체가 들어오면 `RangeError: Maximum call stack size exceeded` 로 동기적으로 throw 되며, 이는 `redactThreadForPublic` 호출부(`interaction.service.ts` REST `getStatus`, `ai-turn-orchestrator.service.ts` 두 emit site)에서 캐치되지 않는다. WS 레이어의 `sanitizePayloadForWs` 는 이 함수 **이후** 단계(emitExecutionEvent 내부)에서 실행되므로 방어망이 되어주지 못한다(우리 함수가 먼저 스택오버플로우를 낸다).
  - 제안: `sanitizePayloadForWs` 와 동일하게 depth 파라미터 + 상한을 추가하거나, 공용 depth-guard 유틸을 추출해 재사용.

- **[WARNING]** `deepRedactSecrets` 의 key-name 기반 마스킹은 문자열 값에만 적용 — WS-layer 형제 함수와 "mirrors" 주장과 달리 실제 커버리지가 더 좁음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:94-98` vs `codebase/backend/src/modules/websocket/websocket.service.ts:278-289`
  - 상세: 두 함수 모두 동일한 `CREDENTIAL_KEY_PATTERN` 을 쓰고 docstring 은 "Mirrors the WS-layer CREDENTIAL_KEY_PATTERN intentionally"라고 명시하지만, WS 레이어(`sanitizeInner`)는 credential-named 키의 값이 **어떤 타입이든**(문자열/숫자/객체/배열) 통째로 `[REDACTED]` 로 치환하는 반면, 신규 `deepRedactSecrets` 는 `typeof v === 'string'` 인 경우만 `'***'` wholesale 치환하고, 값이 객체/배열이면 그냥 재귀(`deepRedactSecrets(v)`)로 내려가 **각 leaf 가 개별적으로 SECRET_LEAK_PATTERNS 값 패턴에 걸릴 때만** 마스킹된다. 즉 `{ credentials: { token: { deviceId: "abc123", scope: "read" } } }` 같은 구조에서 `token` 키 자체는 credential-key 매치이지만 값이 객체라 wholesale 치환이 스킵되고, 내부의 `deviceId`/`scope` 는 이름도 값 패턴도 credential 매치가 아니라 그대로 노출된다. "mirrors" 라는 docstring 문구가 이 gap 을 가리므로 향후 유지보수자가 동등한 커버리지로 오인할 위험이 있다.
  - 제안: credential-named 키를 만나면 값 타입 불문 wholesale 치환(WS 레이어와 동일)하거나, 최소한 docstring 에서 "값이 string 인 경우만" 이라는 제약을 명시.

- **[INFO]** 내부 WS 에디터의 `turns[].data`/`presentations[].payload` false-positive 시 원문 확인 경로가 항상 보장되지는 않음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-conversation-helpers.ts:124-139` (`buildAiMessageDebugFromResumeState`, `llmCalls` 를 마스킹 없이 그대로 spread) / `spec/5-system/14-external-interaction-api.md` 개정분 ("내부 WS 에디터는 llmCalls 디버그로 faithful 원문 확인 가능")
  - 상세: `llmCalls[].requestPayload`/`responsePayload` 는 마스킹 없이 전달되는 것을 확인했고(review 시 grep 으로 검증), `messages[]`/`toolCalls[].arguments` 는 대체로 LLM request/response 안에 포함되므로 이 필드들은 이 전제가 대체로 성립한다. 다만 `turns[].data` 는 노드 핸들러가 자유롭게 채우는 임의 필드(스펙상 LLM 에 보내지 않는 내부 부기용 값도 허용)라, 해당 값이 `llmCalls` 의 request/response 안에 항상 포함된다는 보장은 없다. `data` 에서 오탐이 나면(예: 대화와 무관한 내부 코드/식별자가 `Bearer ` 패턴과 우연히 매치) 내부 워크스페이스 에디터도 원문을 확인할 방법이 없어질 수 있다.
  - 제안: `turns[].data` 사용 범위가 넓어질 경우, 해당 필드만이라도 llmCalls 와 별개의 raw 디버그 경로(내부 WS 전용, external strip)를 열어두는 것을 고려.

- **[INFO]** `redactSecretsInJsonString` 의 JSON round-trip — 마스킹이 실제로 발생한 경우에 한해 원본 포맷을 재직렬화(compact) 로 바꾸고, 64-bit 급 큰 정수는 정밀도 손실 가능
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-127`
  - 상세: `red === parsed` 최적화 덕분에 마스킹할 게 없으면 원본 문자열을 그대로 반환하므로(포맷 보존), 이 이슈는 "실제로 시크릿이 하나라도 매치된 tool-call arguments" 로 범위가 좁혀진다. 그 케이스에 한해 `JSON.stringify` 재직렬화가 일어나 (a) 들여쓰기/공백 제거, (b) `Number.MAX_SAFE_INTEGER` 를 넘는 정수(예: 64-bit 채널/주문 ID 가 tool arguments 에 raw number 로 실렸다면)의 정밀도 손실 위험이 있다. 프론트(`conversation-inspector.tsx`, `conversation-utils.ts`)는 `tryParseJson` 으로 구조적으로만 소비하므로 포맷 변화 자체는 무해하나, 큰 정수 필드가 tool arguments 에 들어갈 가능성이 있다면 점검 가치가 있다.
  - 제안: 현재로선 실사용 tool 스펙 상 큰 정수 ID 가 arguments 에 실릴 가능성이 낮아 보이나(케이스 확인 안 됨), 우려되면 `JSON.parse` 를 `bigint`-safe 파서(reviver로 큰 정수를 문자열 보존)로 교체하는 것도 고려.

- **[INFO]** 매 `ai_message`/`waiting_for_input` emit 마다 `messages`/`presentations` 전체 deep-walk (+ `toolCalls` 는 JSON parse/stringify), 캐시 없음
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:738-756,862-885`, `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:268-304`
  - 상세: WS 레이어의 `sanitizePayloadForWs` 는 동일 객체 참조 재방문을 `WeakMap` 캐시(`SANITIZE_CACHE`)로 O(1) 처리하는 반면(ForEach 5,000회 emit 최적화 사례가 주석에 명시), 신규 `deepRedactSecrets`/`redactSecretsInJsonString` 는 매 호출마다 전체를 다시 훑는다. AI turn 당 1~2회 emit 빈도이므로 통상 규모에선 무해하나, 매우 긴 멀티턴 대화(`messages[]` 누적)나 큰 tool 결과가 반복 emit 되는 경로가 생기면 누적 비용을 재고할 필요.
  - 제안: 현재로선 조치 불요. 향후 대화 길이가 커지는 프로덕트 요구가 생기면 캐시/증분 마스킹 검토.

## 요약

핵심 로직(`deepRedactSecrets`/`redactSecretsInJsonString`)의 copy-on-change·불변성·JSON 유효성 보존은 테스트로 잘 뒷받침되며, 프론트/파서(`tryParseJson`) 소비 경로와 구조적으로 호환된다. 다만 이번 변경은 마스킹 표면을 "읽기 전용 재노출"에서 "실제 능동 발송(Chat Channel)"과 "내부 WS 에디터 wire envelope" 까지 확장하면서, 기존에 존재하던 오탐(false-positive) 리스크의 **파급 범위**가 넓어졌고 — 특히 Telegram 등으로 나가는 메시지가 오탐으로 조용히 손상될 수 있다는 점은 이 PR 이 새로 만들어낸 실질적 부작용이다. 또한 신규 `deepRedactSecrets` 는 같은 코드베이스가 이미 한 번 겪고 고쳤던 "깊이 무제한 재귀" 문제를 재도입했고(`sanitizePayloadForWs`의 `MAX_SANITIZE_DEPTH` 선례를 안 따름), credential-key wholesale 마스킹도 문자열 값에만 적용되어 문서의 "mirrors" 주장보다 커버리지가 좁다. 파일시스템/전역상태/환경변수/네트워크 호출 자체는 건드리지 않으며, 시그니처·공개 API 변경도 하위호환적(신규 named export 추가뿐)이라 그 축의 부작용 위험은 없다.

## 위험도

MEDIUM
