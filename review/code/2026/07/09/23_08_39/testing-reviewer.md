# Testing Review — HEAD 748d3813d (conversation_thread 공개 표면 secret 마스킹)

리뷰 대상: `git show HEAD` (748d3813d86e9b731b343a3952f7f2adf8172229)
관점: 테스트 존재/커버리지/엣지케이스/mock/격리/가독성/회귀/테스트 용이성

## 실행 결과

```
cd codebase/backend && npx jest sanitize-error-message thread-renderer interaction.service.spec
Test Suites: 5 passed, 5 total
Tests:       118 passed, 118 total
```

회귀 확인: `integration-oauth.service.spec.ts` 의 기존 `sanitizeLastErrorMessage` describe (exact `.toBe()` 어서션, 이번 커밋 미변경 파일)도 별도로 재실행해 10/10 통과 확인 — `redactSecrets` 추출 리팩터가 동작을 보존했음을 교차 검증.

추가로, 아래 CRITICAL #1/#2 는 주장이 아니라 **실제 소스 import 로 임시 스펙을 만들어 재현·검증**했다(재현 후 파일 삭제, 저장소에 잔존물 없음 — `git status` 로 확인):

```
OUT: *** dXNlcjpwYXNz
ARGS: {"headers":{***},"url":"https://x"}
```

---

## 발견사항

### [CRITICAL] `toolCalls[].arguments` 재사용 redaction 이 "Raw JSON-string" 계약을 깨는 경로가 테스트로 커버되지 않음
- 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts` `redactTurnForPublic` (L383-395) + `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS[1]`(키워드=값 패턴). 테스트: `thread-renderer.spec.ts` L248-269 (`masks secret-shaped tokens inside toolCalls[].arguments`)
- 상세: `ConversationTurnToolCall.arguments` 는 타입 JSDoc 에 명시된 대로 **"Raw JSON-string argument payload"** 계약이다(`conversation-thread.types.ts` L108-111). `redactTurnForPublic` 은 이 JSON 문자열을 프로즈 지향 정규식(`SECRET_LEAK_PATTERNS`)으로 그대로 마스킹하는데, 키워드=값 패턴(`"?\b(...|api[_-]key|password|...)"?\s*[=:]\s*(?:"[^"]*"|...)`)은 앞뒤 `"?` 로 JSON 의 key 따옴표까지 옵션으로 흡수하고 `[=:]` 가 JSON 의 `:` 와도 매치되므로, `{"headers":{"api_key":"AKIAEXAMPLE123"},"url":"https://x"}` 같은 흔한 tool-call arguments(HTTP 요청 도구 등)에서 `"api_key":"AKIAEXAMPLE123"` 전체가 `***` 로 치환돼 `{"headers":{***},"url":"https://x"}` 라는 **문법적으로 깨진 JSON** 을 만든다. 실측:
  ```
  ARGS: {"headers":{***},"url":"https://x"}
  ```
  `JSON.parse(args)` 는 throw 한다. 반면 기존 테스트(L248-269)는 Bearer/Authorization 패턴만 쓰는 케이스(우연히 값의 따옴표 안쪽만 치환돼 JSON 이 안 깨짐)만 검증하므로, 이 JSON-corruption 경로는 초록 스위트 뒤에 숨어 있다.
- 영향: `arguments` 는 공개 EIA REST/SSE 표면 계약 필드다. 향후 어떤 소비처든(웹챗 위젯의 tool-call 상세 렌더, 서드파티 EIA API consumer 의 `JSON.parse(toolCalls[i].arguments)`) 이 secret-shaped 키를 포함하는 tool call 인자를 만나면 마스킹 이후 파싱이 조용히 깨진다 — 이 커밋의 목적(secret 유출 방지)과 별개로 새로운 무결성 회귀다.
- 제안: (a) 최소한 "redaction 후에도 `arguments` 가 valid JSON 이다" 를 보증하는 테스트를 `api_key`/`password`/`secret`/`access_token` 키를 가진 JSON payload 로 추가해 이 경로를 gate 하거나, (b) 코드 쪽에서 `arguments` 를 파싱 가능하면 leaf string 값만 재귀적으로 마스킹 후 재직렬화(파싱 실패 시에만 raw-string 폴백)하도록 개선 — 후자는 코드 수정이라 developer 스킬 소관이지만, 테스트 관점에서는 최소 (a)가 이 리그레션을 즉시 잡아낼 수 있었다.

### [CRITICAL] `Authorization: <scheme> <credential>` 형태(Bearer 이외)는 스킴 이름만 마스킹되고 실제 자격증명이 노출됨 — 회귀 테스트 부재
- 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` 4번째 원소 `/\bAuthorization:\s*\S+/gi` (L28)
- 상세: `\S+` 는 공백에서 멈추는 greedy 매치라 `"Authorization: Bearer <token>"` 처럼 값이 공백 없는 단일 토큰일 때만 전체가 마스킹된다(사실상 이 경로는 앞선 Bearer 전용 패턴이 먼저 잡아서 성공하는 것). 값에 공백이 포함되는 스킴(`Basic <base64>`, `Digest realm="..." nonce="..."` 등 RFC 7235 계열 다수)은 첫 토큰(스킴 이름)만 `***` 로 치환되고 **실제 자격증명은 그대로 노출**된다. 실측:
  ```
  redactSecrets('Authorization: Basic dXNlcjpwYXNz')
  → '*** dXNlcjpwYXNz'   // dXNlcjpwYXNz(=base64 "user:pass") 그대로 노출
  ```
  이 커밋/spec §R17 스위트(`thread-renderer.spec.ts`, `sanitize-error-message.spec.ts`, `interaction.service.spec.ts`) 어디에도 "Authorization" 값에 공백이 포함된 케이스(Basic/Digest/커스텀 스킴, 또는 값 자체에 공백이 낀 원문 echo)를 넣는 테스트가 없다 — 모든 Authorization 픽스처가 예외 없이 `Bearer <no-space-token>` 형태라 이 gap 을 우연히도 은폐한다.
- 영향: 이 커밋의 명시 목적("API 키·Bearer·Authorization 3종" 불변식의 런타임 강제, EIA §R17)에서 **Authorization 종은 부분적으로만 강제됨**. AI Agent 노드가 HTTP 도구 응답이나 요청 헤더를 turn 텍스트/`toolCalls.arguments` 에 echo 할 때 Basic auth 자격증명이 실제로 공개 REST/SSE 표면에 노출될 수 있다.
- 제안: `SECRET_LEAK_PATTERNS` 의 Authorization 패턴을 줄바꿈 전까지 전체를 잡도록 수정(예: `/\bAuthorization:\s*.+/gi` 또는 라인 경계 고려)하고, `redactSecrets`/`redactThreadForPublic`/`sanitizeLastErrorMessage` 세 스펙 모두에 `Authorization: Basic <base64>` 류 다중 토큰 케이스를 회귀 테스트로 추가. (이 패턴은 `sanitize-error-message.ts` SoT 를 공유하는 기존 OAuth 에러 sanitizer 에도 이미 존재하던 gap 이지만, 이번 커밋이 이 패턴을 더 넓고 위험도 높은 표면 — 임의 tool 응답이 흘러들 수 있는 conversation turn 텍스트 — 에 재사용하면서 실질 위험이 커졌다.)

### [WARNING] SSE emit 4개 콜사이트(button/form/ai-turn) 는 마스킹 회귀 테스트가 전무 — REST(getStatus) 와 비대칭
- 위치: `ai-turn-orchestrator.service.ts`(2곳), `button-interaction.service.ts`, `form-interaction.service.ts` — 이번 커밋에서 `cloneThread` → `redactThreadForPublic` 로 교체된 4개 호출부. 대응 스펙: `ai-turn-orchestrator.service.spec.ts`, `button-interaction.service.spec.ts`, `form-interaction.service.spec.ts`
- 상세: 세 스펙 파일 어디에도 `conversationThread` 필드 자체에 대한 어서션이 없다(`grep -n "conversationThread"` 결과 0건 — DI 변수명 `conversationThreadService` 만 매치). 즉 emit 페이로드의 `conversationThread` 가 (a) 존재하는지, (b) secret 이 마스킹됐는지 **둘 다** 검증되지 않는다. `getStatus`(REST) 쪽엔 secret 마스킹 전용 회귀 테스트(`interaction.service.spec.ts` L612-649)가 신설됐는데 SSE 쪽엔 대칭 테스트가 없어, "REST·SSE 두 경로가 같은 helper 를 거쳐 일관 스크럽된다"는 커밋 메시지의 핵심 주장이 **REST 쪽만 테스트로 뒷받침**된다.
- 완화 요인: 4개 콜사이트 모두 `cloneThread(...)` → `redactThreadForPublic(...)` 로 바꾸는 1-라인 치환이고(diff 로 직접 확인), helper 자체는 `thread-renderer.spec.ts` 에서 충분히 유닛 테스트됨. 또한 이미 남아있는 `cloneThread` 호출 2곳(`execution-engine.service.ts` L6514 background snapshot, L7574 durable park stage)은 설계상 의도적으로 non-redacted 인 것으로 코드 확인됨(내부 경로 faithful 유지 정책과 일치) — 즉 wiring 자체는 리뷰 결과 정확해 보인다.
- 다만 이 세 스펙 파일은 이미 `mockEventEmitter.emitExecution` 호출 인자를 `expect.objectContaining({...})` 로 검사하는 인프라를 갖추고 있어(예: `button-interaction.service.spec.ts` L160-170, `ai-turn-orchestrator.service.spec.ts` L877 근방 `waitingCall`), secret 이 포함된 turn 을 seed 하고 emit 페이로드의 `conversationThread.turns[].text` 가 마스킹됐는지 확인하는 테스트를 추가하는 비용이 낮다.
- 제안: 4개 콜사이트 중 최소 1곳(예: `button-interaction.service.spec.ts` 의 기존 park emit 테스트)에 secret 포함 turn 을 seed 하고 emit 된 `conversationThread` 마스킹을 어서션하는 회귀 테스트를 추가해 REST/SSE 대칭을 맞출 것을 권고. helper 유닛 테스트로 로직 정확성은 이미 충분히 검증되므로 CRITICAL 이 아닌 WARNING.

### [INFO] "frozen turn safe" 주장이 실제로 frozen 객체로 검증되지 않음
- 위치: `thread-renderer.ts` L367-369 JSDoc 주석("frozen turn safe") + 커밋 메시지("copy-on-change (frozen turn safe)") vs `thread-renderer.spec.ts` `makeTurn()` 헬퍼(L17-28, 평범한 mutable 객체)
- 상세: 실제 프로덕션에서 conversation turn 은 `conversation-thread.service.ts` 의 `appendTurn` 이 `Object.freeze(...)` 로 push 한다(L212, JSDoc: "Object.freeze enforces the post-push immutability invariant"). `redactThreadForPublic`/`redactTurnForPublic` 이 이 불변식을 존중하는지(즉 in-place mutation 없이 항상 spread 로 새 객체를 만드는지)가 이 기능의 안전성 핵심 주장인데, 스펙의 `makeTurn` 은 freeze 되지 않은 plain object 라 이 경로를 실제로 검증하지 못한다. `redactTurnForPublic` 코드 자체는 항상 `{ ...turn, text, ... }` 로 새 객체를 반환하므로(직접 코드 리뷰 + 별도 재현 스크립트로 `Object.freeze` 된 turn 입력에 대해 throw 없이 정상 동작함을 확인) 현재 버그는 아니지만, 이 안전성을 보증하는 회귀 anchor 가 없다 — 향후 리팩터(예: 실수로 `turn.text = masked` 로 바꾸는 변경)가 들어와도 strict mode TypeError 를 어떤 테스트도 잡아주지 못한다.
- 제안: `redactThreadForPublic` 테스트 중 최소 1개는 `Object.freeze()` 로 감싼 turn 을 입력해 (a) throw 하지 않고 (b) 마스킹이 정상 동작함을 명시적으로 검증.

### [INFO] Authorization 헤더 패턴이 Bearer 와 항상 겹치는 픽스처로만 테스트됨(단독 분기 미검증) — 위 CRITICAL #2 와 동일 근본 원인의 커버리지 서술
- 위치: `sanitize-error-message.spec.ts` L419("masks Authorization header values" — `'Authorization: Bearer xyz'`), `thread-renderer.spec.ts` L227-237, `interaction.service.spec.ts` L612 신규 테스트 — 세 곳 모두 `Authorization: Bearer ...` 조합만 사용
- 상세: `SECRET_LEAK_PATTERNS` 순서상 Bearer 패턴이 먼저 실행되어 "Bearer <token>" 을 통째로 지우므로, 뒤이어 실행되는 Authorization 전용 패턴(`/\bAuthorization:\s*\S+/gi`)은 이미 `***` 로 바뀐 잔여물(`Authorization: ***`)에 대해서만 작동해 "성공한 것처럼" 보인다. Authorization 패턴 자신의 매칭 로직(스킴+자격증명 전체를 잡는지)은 어떤 테스트에서도 단독으로 검증되지 않는다.
- 제안: 위 CRITICAL #2 수정과 함께 Bearer 가 아닌 스킴을 쓰는 독립 테스트 케이스로 통합.

### [INFO] `toContain('***')` 위주 어서션 — 부분 검증에 그침(기존 exact-match 관례와 대비)
- 위치: `thread-renderer.spec.ts` 신규 `redactThreadForPublic` describe 전반(L227-279), `sanitize-error-message.spec.ts` L412-433, `interaction.service.spec.ts` L154-157
- 상세: `expect(out).not.toContain(secret)` + `expect(out).toContain('***')` 조합은 "우연한 `***` 등장으로 통과"할 위험은 테스트 픽스처 특성상 사실상 없어 크리티컬하지 않지만, 정확히 어느 부분이 얼마나 치환됐는지(과잉 치환으로 주변 텍스트까지 날아갔는지)는 검증하지 않는다. 대조적으로 같은 SoT 를 이전부터 테스트해 온 `integration-oauth.service.spec.ts` 의 `sanitizeLastErrorMessage` 테스트들은 `.toBe('request body: *** & grant_type=auth')` 같은 전체-문자열 exact match 를 사용해 "치환 범위가 의도한 부분에만 한정되는지"까지 커버한다. 신규 테스트들은 이 엄격도를 상속하지 않았다.
- 제안: 필수는 아니나, 최소 1~2개 케이스는 exact `.toBe()` 로 업그레이드해 과잉/과소 치환 회귀를 더 좁게 잡을 것을 권고.

### [INFO] 빈 turns / `runningSummary` 미설정 등 최소 엣지 케이스 미검증
- 위치: `thread-renderer.spec.ts` `redactThreadForPublic` describe
- 상세: `turns: []` (빈 스레드), `runningSummary` 필드 자체가 아예 없는 wrapper(spread guard `!== undefined` 분기의 "없음" 경로)에 대한 명시적 테스트가 없다. 코드상 가드(`thread.runningSummary !== undefined ? {...} : {}`)가 안전해 보이나(스프레드로 키 자체를 생략), 명시 테스트로 "출력에 `runningSummary` 키가 아예 없다(undefined 로 남지 않는다)"를 고정해두면 향후 회귀를 더 빨리 잡는다.

---

## 요약

핵심 helper(`redactThreadForPublic`/`redactSecrets`)와 REST(`getStatus`) 경로는 참조 동일성·no-mutation·frozen-turn 안전성(코드상)·false-positive(정상 한국어 텍스트 exact-match)까지 폭넓게 다루는 양질의 신규 테스트를 갖추고 있고, 118개 대상 테스트는 모두 통과하며 기존 `sanitizeLastErrorMessage` 회귀도 손상되지 않았다. 그러나 테스트가 "이번 커밋이 무엇을 마스킹하는가"만 확인하고 "마스킹이 데이터 계약(JSON)과 위협 모델(비-Bearer Authorization) 경계에서 실제로 안전한가"는 검증하지 않아, 실제로 재현 가능한 두 개의 회귀(① `toolCalls[].arguments` JSON 파손, ② `Authorization: Basic ...` 류 자격증명 미마스킹)를 놓치고 있음을 직접 재현으로 확인했다. 두 결함 모두 "테스트 스위트가 초록인데 실제로는 이 PR 이 해결하려는 문제(공개 표면 secret 유출)가 부분적으로 남아있다"는 동일한 패턴이라 우선순위가 높다. 추가로 SSE emit 4개 콜사이트는 REST 와 달리 마스킹 회귀 테스트가 전혀 없어(코드 자체는 1-라인 치환이라 리뷰로 정확성은 확인했지만) 향후 리팩터 안전망이 비대칭적이다.

## 위험도

CRITICAL
