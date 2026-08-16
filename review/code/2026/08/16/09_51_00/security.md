# 보안(Security) 코드 리뷰

## 리뷰 범위

핵심 변경은 EIA 종결 이벤트(`execution.failed` 등)의 `error` payload 가 WS/SSE/outbound webhook 으로
외부에 나가기 전 `deepRedactSecrets` 로 값-패턴 secret 마스킹을 추가하는 하드닝이다.

- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `redactTerminalError()` 신설, `toTerminalErrorPayload()` 의 모든 반환 경로에 적용
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 회귀 테스트 8건 추가
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — docstring 정정만 (기능 변경 없음)
- `plan/in-progress/eia-terminal-error-sanitize.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 추적 문서
- `review/consistency/2026/08/16/09_25_29/**` — 직전 라운드 consistency 산출물(신규 커밋된 리포트, 기능 코드 아님)

## 발견사항

- **[INFO]** `toTerminalErrorPayload`/`redactTerminalError` 에 길이 상한이 없다 — 마스킹 후 그대로 WS/SSE/webhook 으로 나간다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` — 함수 `redactTerminalError`(게이트 81~89), `toTerminalErrorPayload`(게이트 91~130)
  - 상세: 형제 유틸 `sanitize-error-message.ts` (파일 1) 는 `ERROR_MESSAGE_MAX_LENGTH = 500` 으로 절단하는데, 이번에 새로 egress 초크포인트가 된 `toTerminalErrorPayload`/`redactTerminalError` 경로는 `message`·`details` 를 마스킹만 하고 길이를 제한하지 않는다. `Execution.error` 는 임의 내부 예외 원문을 담을 수 있으므로, 매우 긴 메시지나 큰 `details` 객체가 그대로(마스킹된 채로) outbound webhook 수신자에게 전달되어 페이로드 크기 증폭에 쓰일 수 있다. secret 노출 관점에서는 문제없으나(마스킹은 적용됨), 크기 제한이 없다는 점은 이 PR 이 명시적으로 다루지 않은 잔여 사항이다. 이 갭은 이 PR 이 만든 것이 아니라 `toTerminalErrorPayload` 자체가 처음부터 무제한이었던 선존 상태이고, plan 의 "범위 밖" 절도 500자 절단 정책은 "기존 util 값을 그대로 쓴다"고만 적어 이 경로를 다루지 않는다.
  - 제안: 별도 후속 항목으로 `toTerminalErrorPayload` 출력에도 길이/크기 상한(예: `sanitizeErrorMessage` 와 동일한 500자 또는 별도 상한)을 검토해 등재할 것을 권장한다(차단 사유는 아님).

- **[INFO]** 마스킹 적용 범위가 `EXECUTION_FAILED` 계열 4곳 + `chat-channel.dispatcher` 5곳으로 좁혀져 있고, `execution.cancelled`(`emitCancellationEvent` 및 호출 5곳)는 여전히 `toTerminalErrorPayload` 를 거치지 않는다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts` 상단 docstring(게이트 8~9, "**현재 호출부는 `EXECUTION_FAILED` 4곳뿐이다.**")
  - 상세: 현재는 취소 이벤트가 고정 문자열/코드-파생 메시지만 쓰기 때문에(plan `eia-terminal-error-sanitize.md` "raw 를 쓰는 곳 — 3곳(전수)" 절에서 취소 경로는 유출 위험 없음으로 실측·문서화됨) 이 비대칭이 현재는 안전하다. 다만 향후 취소 경로에 임의 raw 예외 메시지가 흘러들어가도록 바뀌면(예: 취소 사유를 상세화하는 리팩터) 이 새 마스킹 초크포인트를 우회하는 표면이 조용히 생긴다.
  - 제안: 코드 변경은 불요하나, `emitCancellationEvent`/`{code, message}` 를 손으로 만드는 5곳에 "raw 예외 메시지를 여기 넣지 말 것 — 넣으려면 `deepRedactSecrets` 를 거칠 것" 이라는 주석 캐너리를 남기거나, 이미 등재된 후속 통일 작업(§6 표 통일) 시점에 자동으로 마스킹이 상속되도록 `toTerminalErrorPayload` 경유를 강제하는 편이 안전하다.

- **[INFO]** 테스트 픽스처의 secret-형 리터럴은 실제 자격증명이 아니라 합성 테스트 값이다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` (게이트 140 `Bearer sk-live-abcdef123456`, 게이트 147 `api-key=xyz789secret`, 게이트 154 `authorization: 'Bearer leak-me-999'`)
  - 상세: `sk-live-` 접두사는 Stripe 라이브 시크릿 키 포맷을 모사하나 뒤따르는 문자열이 짧고 명백히 조작된 값이라 실제 유출 자격증명이 아니다. 마스킹 대상 형태를 검증하기 위한 정상적인 테스트 관행이다. 문제로 등재하지 않되, 리뷰 관행상 "하드코딩된 시크릿" 점검 항목에 대응해 명시적으로 확인·기록한다.

## 확인한 항목 (문제 없음)

- `toTerminalErrorPayload` 의 5개 반환 경로(문자열/숫자·불리언·bigint/그 외 스칼라/typeof!=='object'/최종 객체) **전부**가 `redactTerminalError()` 를 거친다 — "한 곳만 빠뜨린다"는 이 저장소의 반복 실패 형태가 이번엔 컴파일 타임 강제는 아니지만 코드 리딩상 전수 확인됨(게이트 99, 108~112, 117, 129).
- `redactTerminalError` 는 `code`/`nodeId` (enum 문자열/uuid, 자유 텍스트 아님)는 건드리지 않고 `message`/`details` 만 대상으로 한다 — 값 공간이 닫힌 필드까지 불필요하게 변형하지 않는 최소 권한 원칙에 부합.
- `deepRedactSecrets`(기존 shared SoT, 이번 diff 로 신규 도입되지 않음)는 depth cap(`MAX_REDACT_DEPTH=10`)과 credential 키-이름 마스킹, JSON 문자열 안전 파싱을 이미 갖추고 있어 재사용이 적절하다. 이 함수는 이번 diff 의 변경 대상이 아니다.
- `sanitize-error-message.ts` (execution-engine) 변경은 docstring 정정뿐이며 로직·정규식·마스킹 대상에 기능적 변화가 없다 — 인젝션/시크릿 취약점 신규 발생 없음.
- 인증/인가, DB 쿼리, 커맨드 실행, 파일 경로 처리 등 OWASP Top10 주요 축은 이번 diff 범위(문자열 마스킹 유틸 확장)와 무관 — 해당 없음.
- `plan/`·`review/consistency/**` 문서 변경은 정적 마크다운/JSON 산출물이며 코드 실행 경로에 영향 없음. 별도 보안 위험 없음.

## 요약

이번 변경은 EIA 종결 이벤트의 `error.message`/`details` 가 WS/SSE/outbound webhook 을 통해 외부 제3자에게 나가기 전 값-패턴 secret(Bearer 토큰, API 키, 연결 문자열 자격증명 등) 마스킹을 추가하는 **보안 하드닝**이다. 기존에 문서로만 인지되고 4~5라운드에 걸쳐 INFO 로 미뤄졌던 실재 갭(WS 경로는 키-이름 기반 마스킹만 있어 자유 텍스트 내부 토큰을 못 잡음)을 egress 초크포인트(`toTerminalErrorPayload`)에서 구조적으로 막았고, 5개 반환 경로 전부가 마스킹을 거치는지 코드 상으로 확인했다. 남은 항목은 모두 INFO 수준으로, (1) 마스킹 후에도 길이/크기 상한이 없어 대형 payload 증폭 가능성이 선존한다는 점, (2) `execution.cancelled` 경로는 현재 고정 문자열만 쓰기 때문에 안전하지만 이 새 초크포인트를 거치지 않는다는 비대칭이 향후 리팩터 시 재발 소지가 있다는 점이다. Critical/Warning 급 인젝션·인증우회·평문전송·하드코딩된 실제 시크릿은 발견되지 않았다.

## 위험도

LOW
