# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 의 실질 코드 변경은 EIA 종결 이벤트(`execution.failed` 등)의 `error.message`/`error.details`
가 WS/SSE/EIA outbound webhook 으로 외부 제3자에게 나가기 전 값-패턴 secret(Bearer 토큰, API 키,
URI-userinfo 자격증명 등)을 마스킹하는 egress 초크포인트 하드닝이다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설,
  `toTerminalErrorPayload()` 의 4개 반환 지점 전부에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 신규 12건
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만
  (`sanitizeErrorMessage` 함수 로직·정규식 무변경, 직접 대조 확인)
- `CHANGELOG.md`, `plan/in-progress/eia-terminal-error-sanitize.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 추적 문서
- `review/code/2026/08/16/{09_51_00,10_19_30}/**`, `review/consistency/2026/08/16/{09_25_29,10_19_31}/**`
  — 앞선 두 리뷰 라운드의 산출물(마크다운/JSON 리포트). 코드 실행 경로 없음, 신규 보안 표면 아님.

`terminal-error-payload.ts` 실물 파일을 `Read` 로 직접 열어 diff 와 대조했고, `toTerminalErrorPayload`
의 실제 호출부 5곳(`chat-channel.dispatcher.ts:551`, `execution-engine.service.ts:668,3400,5030`,
`retry-turn.service.ts:1001`)을 grep 으로 직접 확인 — 전부 emit/fanout 조립 지점이고 DB write 는 없다
(JSDoc 의 "호출부 5곳이 전부 emit 쪽" 주장과 일치).

## 발견사항

- **[INFO]** 자격증명이 없는 연결 문자열·내부 호스트명·사설 IP·스택 프래그먼트는 여전히 마스킹되지 않는다 (기존 갭, 이번 diff 가 악화시키지 않음, 명시적으로 추적됨)
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `redactTerminalError`(107~115행)
  - 상세: 재사용되는 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts`, 이번 diff 밖·무변경)는 Bearer 토큰·`key=value` 형 secret·bare JWT·URI-userinfo만 잡고, `postgres://host:5432/db`(자격증명 없음)·내부 호스트명·사설 IP·스택 프래그먼트는 매칭하지 않는다. `Execution.error.message`는 DB 연결 실패 같은 흔한 시나리오에서 내부 인프라 정보를 담을 수 있고, 이 값이 WS/SSE/**EIA outbound webhook**(외부 제3자)으로 나간다 — CWE-200(정보 노출) 성격의 낮은 수준 정찰 표면이다. 다만 이는 이번 PR 이 새로 만든 결함이 아니라 선존 상태이며(오히려 자격증명 범위에서는 하드닝), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`에 무수정 프로브 근거와 함께 명시적으로 등재되어 후속 추적 중이다.
  - 제안: 별도 후속 PR 로 `CONNECTION_STRING_PATTERN`류를 shared SoT 로 승격할 때 blast radius(다른 `deepRedactSecrets` 소비자 — conversation-thread `turns[].data`·`ai_message.messages[]`·EIA `nodeOutput`)를 먼저 검토. 차단 사유는 아님.

- **[INFO]** `toTerminalErrorPayload`/`redactTerminalError` 출력에 길이/크기 상한이 없다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 함수 `toTerminalErrorPayload`(122~161행)
  - 상세: 자매 유틸 `execution-engine/sanitize-error-message.ts`(`ERROR_MESSAGE_MAX_LENGTH = 500`)는 알림 경로에서 길이를 절단하지만, 이번에 egress 초크포인트가 된 `toTerminalErrorPayload` 경로는 마스킹만 하고 크기를 제한하지 않는다. secret 노출 관점에서는 무해(마스킹은 걸림)하나, 매우 큰 `message`/`details`가 그대로 outbound webhook 수신자에게 전달될 수 있다(payload 크기 증폭). 이번 PR 이 만든 갭이 아니라 함수의 선존 상태이고 plan 도 "범위 밖"으로 명시했다.
  - 제안: 조치 불요(차단 사유 아님). 후속 항목으로 길이 상한 검토 권장.

- **[INFO]** 테스트 픽스처의 secret 형 리터럴은 합성 값이며 실제 자격증명이 아니다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (140행 `Bearer sk-live-abcdef123456`, 147행 `api-key=xyz789secret`, 154행 `authorization: 'Bearer leak-me-999'`, 166~167행 `Bearer sk-live-should-not-be-masked` / `api-key=must-stay-verbatim`)
  - 상세: 명백히 조작된 테스트 전용 문자열로, 마스킹 대상 형태를 검증하기 위한 정상적 관행이다. "하드코딩된 시크릿" 점검 항목에 대응해 명시적으로 확인·기록한다.
  - 제안: 조치 불요.

## 확인한 항목 (직접 검증, 문제 없음)

- `toTerminalErrorPayload`의 4개 반환 지점(문자열 레거시 130행 / 숫자·불리언·bigint 139~143행 / 그 외 스칼라 148행 / 객체 160행) **전부**가 `redactTerminalError()`를 거친다 — 코드 직접 확인. "한 곳만 빠뜨린다"는 이 저장소의 반복 실패 형태가 이번엔 전수 통과함을 확인했다.
- `redactTerminalError`(109~113행)는 `message`/`details`만 마스킹하고, `code`(enum 문자열)·`nodeId`(uuid)는 spread(`...p`)로 그대로 보존한다 — 값 공간이 닫힌 필드에 불필요한 변형을 가하지 않는 최소 권한 설계.
- 호출부 5곳(`chat-channel.dispatcher.ts:551`, `execution-engine.service.ts:668,3400,5030`, `retry-turn.service.ts:1001`)이 전부 emit/fanout 조립 지점이고 DB write 는 0개임을 grep 으로 직접 확인 — 마스킹이 egress 시점에만 걸리고 DB 원본(서버 로그/디버깅용)은 훼손되지 않는다는 §R17 egress-only 원칙 주장과 일치.
- `sanitize-error-message.ts`(execution-engine, 1~48행) 변경은 docstring 정정뿐이며 `sanitizeErrorMessage`/`STACK_TRACE_PATTERN`/`CONNECTION_STRING_PATTERN` 로직·정규식은 무변경 — 신규 인젝션·시크릿 취약점 없음.
- `redactTerminalError`/`deepRedactSecrets`는 입력을 mutate 하지 않는다(spread + copy-on-change) — 부수적으로 다른 곳에 원본 secret 이 남는 경로 없음.
- 인증/인가, SQL/커맨드 인젝션, 파일 경로 처리, 세션 관리 등 OWASP Top10 주요 축은 이번 diff 범위(문자열 마스킹 유틸 확장)와 무관 — 해당 없음.
- `review/code/**`·`review/consistency/**`·`plan/**` 신규/변경 파일은 정적 마크다운/JSON 리뷰 산출물이며 코드 실행 경로에 영향 없음 — 별도 보안 위험 없음.

## 요약

이번 변경은 EIA 종결 이벤트의 `error.message`/`error.details`가 WS/SSE/outbound webhook 을 통해 외부
제3자에게 나가기 전 값-패턴 secret 마스킹(`deepRedactSecrets`)을 egress 초크포인트(`toTerminalErrorPayload`)
에 구조적으로 삽입하는 순수 보안 하드닝이다. 이전 2개 리뷰 라운드(`09_51_00`, `10_19_30`)를 거치며
검증 범위 과장·판별력 없는 테스트 등이 이미 수정되었고, 이번 최종 diff 에서 4개 반환 지점 전수 적용·
호출부 5곳 전부 emit 쪽·DB 원본 보존 등 핵심 보안 설계 주장을 코드 레벨에서 직접 재확인했다. 신규
인젝션, 인증/인가 우회, 하드코딩된 실제 시크릿, 안전하지 않은 암호화/평문 전송, 민감정보 과다 노출형
에러 처리 문제는 발견되지 않았다. 잔여 항목(자격증명 없는 연결 문자열 미마스킹, 길이 상한 부재)은
모두 이 PR 이전부터 있던 선존 상태이며 후속 트래커에 근거와 함께 명시적으로 등재되어 있어 INFO 로
기록한다. Critical/Warning 급 발견 없음.

## 위험도

LOW
