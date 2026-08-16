# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 EIA 종결 이벤트(`execution.failed` 등)의 `error.message`/`error.details` 가 WS·SSE·outbound
webhook 으로 **외부 제3자 통합사**에게 나가기 전 값-패턴 secret(Bearer 토큰, API 키, 자격증명 포함
URI 등) 마스킹을 추가하는 **보안 하드닝 PR** 이다. 실질 코드 변경은 3개 파일로 좁다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설, `toTerminalErrorPayload()` 의 4개 반환 경로 전부에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만(로직 무변경)

나머지(`CHANGELOG.md`, `plan/**`, `review/code/2026/08/16/{09_51_00,10_19_30,10_41_55,11_04_07}/**`,
`review/consistency/2026/08/16/{09_25_29,10_19_31}/**`)는 이 브랜치가 이미 거친 4라운드 `/ai-review`
+ 2라운드 consistency-check 산출물이 누적 커밋된 것으로, 코드 실행 경로에 영향이 없는 정적 문서다.
이번 라운드는 (a) 현재 소스를 직접 `Read` 로 재대조하고, (b) 4라운드 누적 리뷰가 이미 다룬 항목을
독자적으로 재검증하는 데 집중했다.

## 발견사항

- **[INFO]** `toTerminalErrorPayload`/`redactTerminalError` 에 길이 상한이 없다 — 마스킹 후 그대로 WS/SSE/webhook 으로 나간다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` — 함수 `redactTerminalError`(107행 정의), `toTerminalErrorPayload`(122~161행)
  - 상세: 형제 유틸 `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` 는 `ERROR_MESSAGE_MAX_LENGTH = 500` 으로 절단하지만(43행), 이번에 egress 초크포인트가 된 `toTerminalErrorPayload`/`redactTerminalError` 경로는 `message`·`details` 를 마스킹만 하고 길이를 제한하지 않는다. `Execution.error` 는 임의 내부 예외 원문을 담을 수 있어, 매우 긴 메시지나 큰 `details` 객체가 그대로(마스킹된 채로) outbound webhook 수신자에게 전달될 수 있다. secret 노출 관점에서는 문제없으나(마스킹은 전 경로 적용됨을 직접 확인, 아래 "확인한 항목" 참조), 이 갭은 이번 PR 이 만든 것이 아니라 `toTerminalErrorPayload` 자체가 처음부터 무제한이었던 선존 상태다.
  - 제안: 별도 후속으로 길이/크기 상한(예: 500자 또는 별도 상한) 검토를 등재할 것을 권장(차단 사유 아님).

- **[INFO]** `SECRET_LEAK_PATTERNS` 는 자격증명 패턴만 겨냥한다 — 자격증명 없는 연결 문자열·내부 호스트명·스택 프래그먼트는 여전히 마스킹 없이 외부로 나간다 (문서화된 의도적 잔여 갭)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` JSDoc "무엇을 못 잡는지" 표(80~93행) / `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` 캐너리 테스트(자격증명 없는 `postgres://db.internal:5432/prod`, `10.0.3.17:6379 (redis-primary.internal)` 무변화 단언)
  - 상세: 직접 `Read` 로 확인 — `postgres://db.internal:5432/prod`(자격증명 없음)·내부 IP/호스트명은 마스킹되지 않고 그대로 outbound webhook/SSE 로 나간다. 자매 유틸(`execution-engine/sanitize-error-message.ts`)의 `CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN` 을 shared SoT 로 올리면 `deepRedactSecrets` 의 다른 소비자(conversation-thread `turns[].data`·`ai_message.messages[]`·EIA `nodeOutput`) 전부에 영향을 주므로 이번 PR 은 의도적으로 범위를 자격증명 마스킹까지로 좁혔다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 후속 항목으로 등재돼 있고, JSDoc·CHANGELOG·테스트 캐너리 3곳에 일관되게 "잔여 갭"으로 명시돼 있어 은폐된 문제가 아니다. 다만 외부 제3자 통합사 관점에서 **내부 인프라 토폴로지 정보 노출**(사설 IP·내부 호스트명)이라는 정보 유출 성격은 실재하며, 이번 하드닝의 범위 밖으로 명시적으로 남겨진 것이다.
  - 제안: 조치 불요(이미 트래킹). 승격 시 `deepRedactSecrets` 의 다른 소비자 회귀 테스트를 선행해야 한다는 점도 이미 문서화돼 있다.

- **[INFO]** `execution.cancelled` 경로(`emitCancellationEvent`, 호출 5곳)는 `toTerminalErrorPayload` egress 초크포인트를 거치지 않는다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 상단 JSDoc(8~9행, "**현재 호출부는 `EXECUTION_FAILED` 4곳뿐이다.**")
  - 상세: 현재는 취소 이벤트가 고정 문자열/코드-파생 메시지만 써서(임의 원문 예외 메시지를 echo 하지 않음) 이 비대칭이 안전하다. 다만 향후 취소 사유를 상세화하는 리팩터로 raw 예외 메시지가 이 경로에 흘러들면, 이번에 새로 만든 마스킹 초크포인트를 조용히 우회하는 표면이 생긴다.
  - 제안: 코드 변경은 불요. `emitCancellationEvent` 를 손으로 조립하는 지점에 "raw 예외 메시지를 넣으려면 `deepRedactSecrets` 를 거칠 것" 주석 캐너리를 남기거나, 향후 통일 작업 시 `toTerminalErrorPayload` 경유를 강제하는 편이 안전하다.

- **[INFO]** 테스트 픽스처의 secret-형 리터럴은 실제 자격증명이 아니라 합성 테스트 값이다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (`Bearer sk-live-abcdef123456`, `api-key=xyz789secret`, `Bearer leak-me-999`, `Bearer leak-json-777` 등)
  - 상세: `sk-live-` 접두사는 Stripe 라이브 키 포맷을 모사하나 후속 문자열이 짧고 명백히 조작된 값이라 실제 유출 자격증명이 아니다. 마스킹 대상 형태를 검증하기 위한 정상적인 테스트 관행. 문제로 등재하지 않되 "하드코딩된 시크릿" 점검 항목에 대응해 명시적으로 확인 기록한다.

## 확인한 항목 (문제 없음)

- `toTerminalErrorPayload` 의 4개 반환 경로(문자열 레거시 / 스칼라(number·boolean·bigint) / non-object / 최종 객체) **전부**가 `redactTerminalError()` 를 경유함을 소스(`terminal-error-payload.ts:130,139,148,160`)를 직접 읽어 확인했다 — "한 곳만 빠뜨린다"는 반복 실패 형태가 컴파일 타임 강제는 아니지만 코드 리딩상 전수 확인됨.
- `redactTerminalError` 는 `code`/`nodeId`(닫힌 값 공간: enum 문자열/uuid)는 건드리지 않고 `message`/`details` 만 마스킹한다 — 최소 권한 원칙에 부합.
- `deepRedactSecrets`/`SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts`)는 이번 diff 의 변경 대상이 아니며, depth cap(`MAX_REDACT_DEPTH=10`)·credential 키-이름 마스킹·JSON 안전 파싱을 이미 갖춘 기존 shared SoT 를 재사용한다.
- `sanitize-error-message.ts`(execution-engine) 변경은 docstring 정정뿐이고 정규식·상수·런타임 로직에 기능적 변화가 없음을 직접 확인했다.
- 마스킹은 DB 원문을 건드리지 않는다(egress-only, EIA §R17 원칙) — 서버 로그·사후 디버깅용 원문은 보존되며, 이 설계 자체는 developer 권한 안에서 코드가 실제로 구현한 대로다.
- `TerminalErrorPayload` 인터페이스와 함수 시그니처는 변경되지 않아 하위 호환성 파괴가 없다. 값이 좁아지는 방향(마스킹 추가)만 있고 값이 넓어지는 방향은 없다.
- 인증/인가, DB 쿼리, 커맨드 실행, 파일 경로 처리, HTTP 엔드포인트 등 OWASP Top10 주요 축은 이번 diff 범위(문자열 마스킹 유틸 확장 + 문서)와 무관 — 신규 취약점 없음.
- `CHANGELOG.md`(§3.1 EIA-NX-02 인용 오류 정정)·`plan/**`·`review/**` 문서 변경은 정적 마크다운/JSON 산출물이며 코드 실행 경로에 영향 없음.

## 요약

핵심 변경은 EIA 종결 이벤트의 `error.message`/`error.details` 가 WS/SSE/outbound webhook 을 통해 외부
제3자에게 나가기 전 값-패턴 secret(Bearer 토큰, API 키, 자격증명 포함 URI 등) 마스킹을 추가하는 보안
하드닝이다. 4~5라운드에 걸쳐 문서로만 인지되고 INFO 로 미뤄졌던 실재 갭(WS 경로는 키-이름 기반
마스킹만 있어 자유 텍스트 내부 토큰을 못 잡음)을 egress 초크포인트(`toTerminalErrorPayload`)에서
구조적으로 막았다. 직접 소스를 읽어 4개 반환 경로 전부가 마스킹을 거치는지, 테스트 픽스처가 실제
시크릿이 아닌지, 관련 유틸(`deepRedactSecrets`/`sanitize-error-message.ts`)이 이번 diff 로 훼손되지
않았는지 독립적으로 재확인했으며 이전 4라운드 리뷰의 결론(Critical 0, 실질 코드 결함은 1라운드에서
전량 해소)과 일치한다. 남은 항목은 전부 INFO 수준으로 (1) 마스킹 후에도 길이/크기 상한이 없다는 선존
갭, (2) 자격증명 없는 연결 문자열·내부 호스트명은 여전히 통과한다는 의도적으로 범위를 좁힌 잔여 갭
(이미 트래킹됨), (3) `execution.cancelled` 경로가 이 초크포인트를 아직 거치지 않는다는 비대칭(현재는
raw 메시지를 안 써서 안전)이다. 인젝션, 하드코딩된 실제 시크릿, 인증/인가 우회, 평문 전송, 안전하지
않은 암호화 알고리즘, 민감정보 에러 노출, 알려진 취약 의존성 사용 등 Critical/Warning 급 문제는
발견되지 않았다.

## 위험도

LOW
