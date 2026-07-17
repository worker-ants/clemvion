# 보안(Security) Review

## 발견사항

없음 (Critical/Warning 없음).

- **[INFO]** 신규 terminal-state 분기가 서버 응답을 allow-list 검증 후에만 클라이언트 상태·host 메시지에 반영
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `seedWaitingFromStatus` — `if ((TERMINAL_EVENTS as readonly string[]).includes(\`execution.${status.status}\`)) { const reason = \`execution.${status.status}\`; teardownSession(); dispatch({ type: "ENDED", reason }); bridgeRef.current?.sendEvent("conversationEnded", { reason }); return; }`
  - 상세: `status.status` 는 기존에 인증된 세션 토큰(`session.token`)으로 호출한 `client.getStatus(session.endpoints, session.token)` 의 REST 응답 값이며, 이 값을 그대로 신뢰 경계 밖(host `postMessage`)으로 내보내기 전에 `TERMINAL_EVENTS`(고정된 문자열 집합: `execution.completed`/`execution.failed`/`execution.cancelled` 등)에 포함되는지 먼저 검사한다. 이 allow-list 매치를 통과한 값만 `reason` 으로 조립되므로, 서버가 예기치 않은 `status.status` 값을 반환하더라도 임의 문자열이 `reason` 에 실려 host 로 전달되는 경로가 없다(값이 allow-list 밖이면 분기 자체가 스킵됨). 신규 로직은 새 파싱기·새 신뢰 경계를 추가하지 않고 기존 SSE terminal 처리(`teardownSession` + `dispatch({type:"ENDED"})` + `bridgeRef.current?.sendEvent("conversationEnded", ...)`)와 동일한 코드 경로를 재사용한다.
  - 제안: 조치 불필요 — 안전한 설계로 확인.

- **[INFO]** `execution.replay_unavailable` 폴백 자체도 SSE 이벤트 payload 를 신뢰 경계로 쓰지 않음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent` 의 `execution.replay_unavailable` 분기(diff 범위 밖이지만 이번 변경이 배선하는 소비 대상)
  - 상세: 이 분기는 서버가 emit 한 이벤트의 `data`(예: `executionId`)를 파싱/신뢰하지 않고, 이미 클라이언트가 보관 중인 세션·토큰으로만 `getStatus` 를 재호출한다. 이벤트 스푸핑이 발생해도 공격자가 임의 executionId/엔드포인트로 유도할 수 없다.
  - 제안: 조치 불필요.

- **[INFO]** 에러 노출은 기존 soft-fail 관례를 유지 — UI 에 예외 원문 노출 없음
  - 위치: `use-widget.ts` `seedWaitingFromStatus` catch 블록(diff 범위 밖 기존 코드), 신규 terminal 분기는 이 catch 이전 happy path 라 별도 에러 처리 대상 아님
  - 상세: `use-widget-eager-start.test.ts` 의 신규 회귀 테스트("폴백의 getStatus 가 실패해도 크래시 없이 유지")가 `getStatus` 네트워크 실패 시에도 크래시 없이 기존 상태를 유지함을 단언해, 에러 상세가 UI 로 새지 않는 기존 패턴이 신규 경로에서도 보존됨을 확인.
  - 제안: 조치 불필요.

- **[INFO]** `webauthn.controller.spec.ts` 신규 테스트 — 테스트 fixture 값은 실제 시크릿이 아님
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts` 신규 `describe('webauthnList', ...)` — credential id `'cred-1'`, deviceName `'YubiKey'`, 날짜 리터럴 등
  - 상세: 신규 테스트가 추가한 값은 모두 mock 응답용 더미 데이터이며 실제 credential/토큰/자격증명이 아니다. `listCredentials` mock 추가 자체도 순수 테스트 배선이라 인증/인가 로직 변경 없음(컨트롤러 프로덕션 코드는 이 diff 범위에 포함되지 않음 — 테스트만 추가됨).
  - 제안: 조치 불필요.

- **[INFO]** `use-widget-eager-start.test.ts` — GET 판정 조건식 완화가 보안에 미치는 영향 없음
  - 위치: `if (u.endsWith("/api/external/executions/e1") && init?.method === undefined)` → `(init?.method ?? "GET") === "GET"` 로 변경(신규 테스트 2건 포함, 5곳)
  - 상세: 순수 테스트 mock 매처 로직 변경으로 런타임 프로덕션 코드·인증·네트워크 요청 방식에는 영향이 없다. `iext_x` 등 반복되는 토큰 문자열은 이전 리뷰와 동일하게 테스트 전용 더미이며 실제 시크릿 형식(API 키/JWT 서명 등)과 무관하다.
  - 제안: 조치 불필요.

- **[NONE]** `review/code/2026/07/17/01_42_44/**` (RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json, 개별 reviewer 산출물 9종) — 이전 ai-review 세션의 산출물을 저장소에 기록하는 문서/메타데이터 파일. `_retry_state.json` 에 담긴 값은 워크트리 절대경로(로컬 파일시스템 경로)뿐이며 API 키·토큰·자격증명 등 시크릿에 해당하는 값은 없음. 코드 로직 변경 없음.
  - 제안: 조치 불필요.

## 요약

이번 diff 의 핵심 프로덕션 코드 변경은 `use-widget.ts` 한 곳 — `seedWaitingFromStatus` 폴백이 서버 응답의 terminal 상태(`completed`/`failed`/`cancelled`)를 처리하도록 분기를 추가한 것이다. 이 분기는 신규 파싱·신규 신뢰 경계를 만들지 않고, 이미 인증된 세션 토큰으로 얻은 REST 응답 값을 `TERMINAL_EVENTS` allow-list 로 먼저 검증한 뒤에만 클라이언트 상태(`dispatch`)와 host 메시지(`bridgeRef.current?.sendEvent`)에 반영한다 — 인젝션·인증 우회·SSRF 등 새로운 공격면이 확인되지 않는다. 나머지 변경은 backend `webauthn.controller.spec.ts` 의 신규 테스트(`webauthnList` envelope pin), `use-widget-eager-start.test.ts` 의 GET 판정 조건식 통일 및 폴백 실패 회귀 테스트 추가, 그리고 이전 ai-review 세션 산출물(md/json) 커밋으로, 모두 프로덕션 로직·인증/인가·시크릿 취급에 영향이 없는 테스트/문서 변경이다. 하드코딩된 시크릿, 안전하지 않은 암호화, 입력 검증 누락, 민감정보 노출 에러 처리 등은 발견되지 않았다.

## 위험도
NONE
