# 보안(Security) 코드 리뷰

## 리뷰 범위

이 diff 는 4라운드째(`09_51_00` → `10_19_30` → `10_41_55` → 본 `11_04_07`) 검토되는 동일 변경 계열의
최종 누적본이다. 핵심 코드 변경은 EIA 종결 이벤트(`execution.failed`)의 `error.message`/`error.details`
가 WS·SSE 스트림·EIA outbound webhook 으로 **외부 제3자**에게 나가기 전 값-패턴 secret 마스킹
(`deepRedactSecrets`)을 egress 초크포인트(`toTerminalErrorPayload`)에 구조적으로 삽입하는 보안
하드닝이다. 이전 라운드들이 이미 Critical 0 · Warning 0(security 관점, 3라운드 연속)으로 수렴했다고
기록했으나, 본 리뷰는 그 결론을 재사용하지 않고 소스를 직접 다시 열어 독립적으로 검증했다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설,
  `toTerminalErrorPayload()` 의 4개 반환 분기 전부에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀/음성 테스트 신규
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만
  (로직·정규식 무변경, 직접 대조 확인)
- `CHANGELOG.md`, `plan/in-progress/eia-terminal-error-sanitize.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 추적 문서
- `review/**` 대량 — 앞선 리뷰 라운드 산출물(정적 마크다운/JSON). 코드 실행 경로 없음.

## 독립 검증 (이번 라운드에서 직접 재확인)

- `toTerminalErrorPayload` 를 실제로 호출하는 지점을 `grep` 으로 전수 확인 — 5곳:
  `chat-channel.dispatcher.ts:551`, `execution-engine.service.ts:668,3400,5030`,
  `retry-turn.service.ts:1001`. **네 반환 분기(문자열 레거시 / 숫자·불리언·bigint / 그 외 스칼라 /
  객체) 전부가 `redactTerminalError()` 를 거친다** — 코드 직접 대조로 우회 경로 없음을 확인.
- `type: 'failed'` 로 `emitTerminalExecution` 을 호출하는 지점 4곳(`execution-engine.service.ts:663,
  3398, 5027`, `retry-turn.service.ts:997`)을 전수로 열어, **모두 `error: toTerminalErrorPayload(...)`
  를 거치고** `type: 'completed'`(error 필드 없음)·`type: 'cancelled'`(별도 경로, 아래 참조)와 섞이지
  않음을 직접 확인 — "한 곳만 빠뜨린다"는 이 저장소의 반복 실패 형태가 이번엔 전수 통과함을 소스
  레벨에서 재검증.
- `execution.cancelled` 5개 호출부(`emitCancellationEvent` 경유, `execution-engine.service.ts` 내
  `code`/`message` 손조립)의 `message` 실제 값을 직접 추적 — `'WEBCHAT_IDLE_TIMEOUT'` /
  `'Execution cancelled: queue wait time exceeded'` 등 **정적 상수 문자열**이고 `err.message` 원문을
  실지 않는다. `toTerminalErrorPayload` 를 거치지 않는 이 경로가 현재는 secret 노출 위험이 없다는
  JSDoc/plan 의 주장을 코드로 재확인했다(단, 아래 INFO 참조).
- `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts`, 이번 diff 무변경) 정규식 5종을
  직접 읽고 catastrophic backtracking 소지(중첩 정량자)가 없음을 확인 — 전부 선형 매칭.
- `deepRedactSecrets` 의 `JSON.parse` → 재귀 마스킹 → `JSON.stringify` 경로는 `JSON.parse` 결과를
  직접 프로퍼티 대입이 아닌 파서 산출물로만 쓰므로 prototype-pollution 벡터(`__proto__` 키를 통한
  `Object.prototype` 오염)에 해당하지 않는다.
- 마스킹 함수(`redactTerminalError`/`deepRedactSecrets`/`deepRedactObject`)는 입력을 mutate 하지
  않고(spread + copy-on-change), `MAX_REDACT_DEPTH=10` 로 무한 재귀/스택 오버플로를 방지한다 — 기존
  `sanitizePayloadForWs` 와 동일 방어.

## 발견사항

- **[INFO]** 자격증명이 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 여전히 마스킹되지
  않는다 (기존 갭, 이번 diff 가 악화시키지 않음 — 오히려 자격증명 범위에서는 신규 하드닝)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`
    (107~115행)
  - 상세: `SECRET_LEAK_PATTERNS` 는 Bearer 토큰·`key=value` 형 secret·bare JWT·URI-userinfo 만
    잡고 `postgres://host:5432/db`(자격증명 없음)·내부 호스트명·사설 IP·스택 프래그먼트는 매칭하지
    않는다. `Execution.error.message` 는 DB 연결 실패 같은 흔한 시나리오에서 내부 인프라 정보를
    담을 수 있고, 이 값이 WS/SSE/EIA outbound webhook(외부 제3자)으로 나간다 — CWE-200 성격의 낮은
    수준 정찰 표면. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 무수정 프로브
    근거와 함께 등재되어 후속 추적 중임을 확인.
  - 제안: 별도 후속 PR 로 `CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN` 류를 shared SoT 로
    승격할 때 blast radius(다른 `deepRedactSecrets` 소비자)를 먼저 검토. 차단 사유 아님.

- **[INFO]** `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이/크기 상한이 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수
    `toTerminalErrorPayload`(122~161행)
  - 상세: 자매 유틸 `execution-engine/sanitize-error-message.ts` 는 `ERROR_MESSAGE_MAX_LENGTH = 500`
    으로 절단하지만, egress 초크포인트가 된 이 경로는 마스킹만 하고 크기를 제한하지 않는다. secret
    노출 관점에서는 무해(마스킹은 걸림)하나 대형 `message`/`details` 가 그대로 outbound webhook
    수신자에게 전달될 수 있다(payload 크기 증폭). 선존 상태이며 plan 도 범위 밖으로 명시.
  - 제안: 조치 불요(차단 사유 아님). 후속 항목으로 길이 상한 검토 권장.

- **[INFO]** `execution.cancelled` 경로는 `toTerminalErrorPayload`/`redactTerminalError` 를 거치지
  않는 별도 조립 경로다 — 오늘은 안전하지만 구조적 보장은 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `emitCancellationEvent` 호출 5곳(`code`/`message` 손조립, 예: 1146~1147행 `WEBCHAT_IDLE_TIMEOUT`,
    2872~2873행 `EXECUTION_QUEUE_WAIT_TIMEOUT`)
  - 상세: 직접 추적한 결과 현재 이 5곳의 `message` 는 전부 정적 상수 문자열이라 `err.message` 원문이
    실릴 수 없고, 마스킹 부재가 실질적 위험으로 이어지지 않는다(코드로 재확인). 다만 이 사실은
    타입 시스템이나 테스트로 강제되지 않는다 — 향후 취소 사유를 상세화하는 리팩터가 `err.message`
    원문을 이 자리에 넣으면, 이번에 신설된 마스킹 초크포인트를 조용히 우회하는 표면이 생긴다. 이미
    JSDoc·plan 문서에 "다른 집합, 별건" 으로 명시돼 있어 인지된 상태다.
  - 제안: 코드 변경 불요. 다만 `emitCancellationEvent`/5개 호출부 인근에 "raw 예외 메시지를 여기
    넣지 말 것 — 넣으려면 `deepRedactSecrets`(또는 `toTerminalErrorPayload`)를 거칠 것" 캐너리
    주석을 남기면 다음 리팩터가 이 불변식을 놓치지 않는다.

- **[INFO]** 테스트 픽스처의 secret 형 리터럴은 합성 값이며 실제 자격증명이 아니다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (게이트 140
    `Bearer sk-live-abcdef123456`, 게이트 147 `api-key=xyz789secret`, 게이트 154
    `authorization: 'Bearer leak-me-999'`, 게이트 166~167 `Bearer sk-live-should-not-be-masked` /
    `api-key=must-stay-verbatim`)
  - 상세: 명백히 조작된 테스트 전용 문자열로, 마스킹 대상 형태를 검증하기 위한 정상적 관행이다.
    "하드코딩된 시크릿" 점검 항목에 대응해 명시적으로 확인·기록한다.
  - 제안: 조치 불요.

## 확인한 항목 (문제 없음)

- 인증/인가, SQL/커맨드/경로 인젝션, 세션 관리 등 OWASP Top10 주요 축은 이번 diff 범위(문자열 마스킹
  유틸 확장)와 무관 — 해당 없음.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 정정뿐이며 로직·정규식 무변경 —
  신규 취약점 없음.
- `plan/**`·`review/**` 변경은 정적 마크다운/JSON 산출물로 코드 실행 경로에 영향 없음.

## 요약

3라운드에 걸쳐 이미 Critical 0 · Warning 0(security)로 수렴했다고 기록된 변경을, 이번 4라운드에서
그 결론을 그대로 인용하지 않고 소스(`toTerminalErrorPayload` 5개 호출부, `emitTerminalExecution`
`type:'failed'` 4개 호출부, `execution.cancelled` 5개 호출부의 실제 `message` 값)를 전부 직접 열어
독립 재검증했다. 마스킹 우회 경로는 발견되지 않았고, `deepRedactSecrets` 재사용·copy-on-change·
depth cap·정규식 선형성도 이상 없다. 잔여 항목(자격증명 없는 연결 문자열 미마스킹, 길이 상한 부재,
cancelled 경로의 구조적(비강제) 안전성)은 모두 이 PR 이전부터 있던 선존 상태이거나 이 PR 이 의도적으로
범위 밖에 둔 것이며, 근거와 함께 후속 트래커에 등재되어 있다. Critical/Warning 급 인젝션·인증우회·
하드코딩된 실제 시크릿·평문전송·민감정보 과다노출 에러처리는 발견되지 않았다.

## 위험도

LOW
