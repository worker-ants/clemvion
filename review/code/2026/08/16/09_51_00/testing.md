# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `code`·`nodeId` 비-마스킹 단언이 실제로는 판별력이 없는(vacuous) 테스트다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts:159` (`it('code·nodeId 는 건드리지 않는다 (값 공간이 닫혀 있다)', ...)`), 대응 구현: `codebase/backend/src/shared/utils/terminal-error-payload.ts:81-89` (`redactTerminalError`)
  - 상세: 이 테스트는 `code: 'EXECUTION_TIME_LIMIT_EXCEEDED'`, `nodeId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301'` 를 입력해 출력이 그대로인지 `toEqual` 로 확인한다. 그런데 두 값 모두 `SECRET_LEAK_PATTERNS`(Bearer/`*_secret`/`*_token`/`password`/`Authorization:`/bare-JWT/URI-userinfo) 어디에도 매칭되지 않는다. 즉 `redactTerminalError` 가 `code`/`nodeId` 에도 실수로 `deepRedactSecrets` 를 적용하는 회귀가 생겨도 — 이 값들엔 마스킹할 게 없어 no-op 이므로 — 이 테스트는 여전히 GREEN 이다. 직접 프로브로 확인: `toTerminalErrorPayload({ code: 'EXECUTION_TIME_LIMIT_EXCEEDED', message: 'boom', nodeId: '3f2504e0-...' })` 결과는 `deepRedactSecrets` 를 code/nodeId 에 걸든 안 걸든 동일하다. 이 테스트가 실제로 검증하는 것은 "값이 안 바뀐다" 이지 "코드가 그 필드를 건드리지 않는다" 가 아니다 — 이름이 약속하는 것보다 좁다. 이 저장소가 기록해 둔 "GREEN 은 증거가 아니다"·vacuous 테스트 패턴과 같은 결이다.
  - 제안: `code`/`nodeId` 값에 `SECRET_LEAK_PATTERNS` 가 실제로 매칭되는 adversarial 문자열(예: `code: 'Bearer sk-should-not-mask'`, `nodeId: 'api_key=should-not-mask-1234'`)을 넣어, 마스킹이 이 두 필드에 걸리지 **않는지**를 직접 검증하는 케이스로 교체하거나 추가한다.

- **[WARNING]** JSON 형태로 보이는 `message` 는 마스킹과 함께 **재직렬화(포맷 변경)** 부수효과가 생기는데, 이 경로가 테스트로 잠겨 있지 않다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:84` (`message: deepRedactSecrets(p.message) as string`) — `deepRedactSecrets` 의 `looksLikeJson`/`redactSecretsInJsonString` 분기(`codebase/backend/src/shared/utils/sanitize-error-message.ts`)를 그대로 상속
  - 상세: `deepRedactSecrets` 는 문자열이 `{`/`[` 로 시작하면 "그 자체가 JSON" 으로 보고 `JSON.parse` → 재귀 마스킹 → `JSON.stringify` 재직렬화한다. `message` 의 출처가 `err.message`(임의 원문)이므로, 업스트림 SDK/HTTP 클라이언트가 JSON 본문을 그대로 `Error.message` 에 넣는 경우 이 경로를 탄다. 직접 프로브로 확인: 입력 `'{"error":"Bearer abc123 failed",  "extra":   1}'` → 출력 `'{"error":"*** failed","extra":1}'` — 시크릿은 지워지지만 **공백/포맷도 함께 정규화**된다(원문 바이트가 아니다). 이 PR 이 `message` 를 처음으로 이 재귀 마스킹 경로에 올리는데, "평범한 메시지는 훼손하지 않는다 (오탐 대조)" 테스트는 `{`/`[` 로 시작하지 않는 문자열만 쓰므로 이 분기를 건드리지 않는다.
  - 제안: `message` 가 JSON 형태(`'{"code":429,"message":"quota"}'` 류)인 경우를 위한 케이스를 하나 추가해 "시크릿은 지워지되 포맷이 바뀔 수 있다"는 동작을 명시적으로 고정한다. 버그는 아니지만, 조사자가 "왜 payload 의 message 바이트가 DB 원본과 다르지?" 를 물을 때 근거가 필요하다.

- **[INFO]** `details` 가 명시적 `null` 인 경로가 테스트되지 않음
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:85-87` (`p.details === undefined ? {} : { details: deepRedactSecrets(p.details) }`)
  - 상세: `Execution.error` 는 `Record<string, unknown>` 이라 `details: null` 이 이론상 들어올 수 있다. `p.details === undefined` 체크는 `null` 을 걸러내지 않으므로 `deepRedactSecrets(null)` 이 호출되고(안전하게 `null` 반환), 결과 payload 는 `details: null` 키를 **갖는다**(undefined 일 때와 달리). 크래시 위험은 없지만 이 분기(“`null` 은 `undefined` 와 다르게 취급된다”)를 고정하는 테스트가 없다.
  - 제안: `toTerminalErrorPayload({ message: 'x', details: null })` 가 `{ ..., details: null }` 을 돌려주는지 확인하는 케이스 1개 추가 (낮은 우선순위).

## 정합성/회귀 확인 (실측)

- `terminal-error-payload.spec.ts` 23/23 통과 확인 (jest 직접 실행).
- `redactTerminalError` 가 `toTerminalErrorPayload` 의 네 반환 지점(string 레거시·number/boolean/bigint·비-object·object) 전부를 통과하도록 감싼 것을 확인 — "한 갈래만 빠뜨린다" 회귀 형태를 구조적으로 막는 설계이고, docstring 의 뮤테이션 근거(23/23 GREEN 이던 copy-on-change 조기반환 제거)도 코드에 반영되어 있다.
- 기존 호출부(`execution-engine.service.ts`, `retry-turn.service.ts`, `chat-channel.dispatcher.ts`) 의 관련 spec (`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`, `chat-channel.dispatcher.spec.ts`) 에서 `error`/`message` 픽스처를 훑어 `SECRET_LEAK_PATTERNS` 오탐(false-positive redaction)으로 인한 회귀 가능성을 점검 — 매칭되는 픽스처 없음, 기존 회귀 테스트들은 이 변경 후에도 유효.
- `sanitize-error-message.ts` 변경은 docstring 전용(코드 diff 없음) — 대응하는 `sanitize-error-message.spec.ts` 는 영향 없고 갱신 불요.
- `code`/`nodeId` 비-마스킹 설계 자체(스프레드 후 `message`/`details` 만 덮어씀)는 구조적으로 올바르며 현재는 결함이 없다. 위 WARNING 은 "지금 틀렸다"가 아니라 "미래 회귀를 잡아줄 판별력이 없다"는 지적이다.
- 새 describe 블록은 mock/stub 없이 실제 `deepRedactSecrets`/`redactSecrets` 를 그대로 태우는 순수 함수 유닛테스트라 mock 과 실동작의 괴리가 없다. 테스트 간 공유 상태 없음(각 `it` 이 독립 리터럴 사용), `DEEP_REDACT_CACHE`(WeakMap, object identity 키)로 인한 테스트 간 오염 가능성도 없음(리터럴마다 새 객체).
- `plan/in-progress/eia-terminal-error-sanitize.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/consistency/2026/08/16/09_25_29/**` 는 문서/리뷰 산출물이며 테스트 대상 코드가 아님(리뷰 관점 해당 없음).

## 요약

핵심 변경(`toTerminalErrorPayload` 의 egress 마스킹 도입)은 이미 이 저장소의 반복 교훈(GREEN 은 증거가 아니다·자매 함수 하드닝 누락·vacuous 테스트)을 의식해 만들어졌고, 실제로 사전 뮤테이션 테스트로 죽은 분기(copy-on-change 조기 반환)를 제거한 흔적이 코드·주석에 남아 있으며, 새 테스트 스위트(23건)는 mock 없이 실제 마스킹 로직을 태우는 깨끗한 유닛테스트로 positive/negative 케이스를 균형 있게 갖췄다. 다만 실측 결과 두 가지 미세한 판별력 구멍이 남아 있다 — (1) "code/nodeId 는 안 건드린다" 테스트가 마스킹 패턴에 안 걸리는 값만 써서 실제로는 그 속성을 증명하지 못하고, (2) JSON 형태 `message` 가 재직렬화되는 부수효과가 문서화되지 않은 채 잠금(lock) 테스트가 없다. 둘 다 현재 동작을 깨는 결함은 아니며 회귀 방지력의 갭이다. `sanitize-error-message.ts` 는 docstring 정정뿐이라 테스트 변경이 불필요하고, 기존 호출부 회귀 테스트들은 픽스처에 시크릿 패턴이 없어 이번 변경 후에도 그대로 유효함을 실측 확인했다.

## 위험도

LOW
