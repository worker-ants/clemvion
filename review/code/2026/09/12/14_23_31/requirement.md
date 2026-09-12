# 요구사항(Requirement) 충족 리뷰

## 검증 방법

프롬프트 diff 외에 저장소 현재 상태를 `Read`/`Grep`/`git diff origin/main...HEAD`로 직접 대조했다
(이전 라운드 `review/code/2026/09/12/13_41_55/RESOLUTION.md`가 이번 diff에 포함돼 있어, "해결했다"는
주장을 코드로 재확인). 확인한 것:

- `spec/5-system/15-chat-channel.md §5.4` 실패 응답 표(400 `BOT_TOKEN_INVALID` / 502
  `CHAT_CHANNEL_SETUP_FAILED`, provider 원문 비노출 규정) — line-level로 코드와 대조.
- `spec/conventions/chat-channel-adapter.md §1.1.2`(`code` 선언 계약, 3중 네임스페이스 표,
  401/403 fallback 한시적 예외 + 제거 조건) — line-level로 코드와 대조.
- `translateSetupChannelError`, `credentialRejectedError`/`isCredentialRejectedError`, 3개
  provider adapter(discord/slack/telegram)의 실제 파일 내용을 diff와 별도로 `Read`.
- `triggers.service.ts`의 `rotateBotToken` catch 블록·`triggers.controller.ts`의 Swagger
  데코레이터·`triggers.service.spec.ts`의 `Logger.prototype.warn` spy try/finally 원복(이전
  라운드 SUMMARY WARNING #1에 대한 수정)이 실제로 적용됐음을 확인.
- `CHANGELOG.md`(이전 라운드 WARNING "changelog 누락"에 대한 수정) 헤더 확인.
- `spec/5-system/3-error-handling.md`에 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` grep
  0건 — 중앙 카탈로그 미등재는 여전함(이미 기존 consistency-check가 추적 중, 아래 INFO).

## 발견사항

- **[INFO]** `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 두 에러 코드가 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md §1`)에 여전히 미등재
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` — `CREDENTIAL_REJECTED_CODE` 정의부 / `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `translateSetupChannelError`
  - 상세: `grep`으로 `spec/5-system/3-error-handling.md`에 두 코드 문자열이 0건임을 재확인했다. 이 갭은 이번 PR이 새로 만든 것이 아니라(코드 자체는 이미 존재하던 두 코드를 재분류하는 것뿐) 기존 spec 갭이며, `review/consistency/2026/09/12/12_54_15/convention_compliance.md`가 이미 WARNING으로 등재해 별도 트래커가 추적 중이다. 병합을 막을 코드 결함은 아니다.
  - 제안: 코드 수정 불요 — 기존 consistency-check 트래커 항목이 처리한다.

- **[INFO]** Slack 자격 증명 거부 5값(`invalid_auth`/`not_authed`/`account_inactive`/`token_revoked`/`token_expired`) 열거가 `spec/4-nodes/7-trigger/providers/slack.md §3.1`의 개방형 서술을 코드가 처음 확정
  - 위치: `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:54-60`(`SLACK_CREDENTIAL_REJECTED_ERRORS`)
  - 상세: 코드 자체 주석이 "이 저장소 안에서 실측할 방법이 없다"고 근거(Slack 공식 문서)를 명시하며, `spec/conventions/chat-channel-adapter.md §1.1.2`의 계약(자격 증명 거부는 `code`로 선언)과 모순되지 않는다. slack.md §3.1에 이 5값을 명시적으로 반영하는 것은 아직 안 됐다 — 회색지대(spec 침묵)로 INFO. 병합 차단 사유 아님, 코드 fix 대상 아님(후속 spec PR 대상).

## 요구사항 충족 평가

`spec/conventions/chat-channel-adapter.md §1.1.2`(자격 증명 거부는 어댑터가 `Error.code` 프로퍼티로
선언, 호출자는 `code`만 보고 `message`를 파싱하지 않음)와 `spec/5-system/15-chat-channel.md
§5.4`/`R-CC-23`(원인 기반 400/502 분류, 실패 응답 본문에 provider 원문 비노출)의 계약을 3개
provider adapter(discord/slack/telegram)와 `chat-channel-input-rules.ts`의
`translateSetupChannelError`가 line-level로 정확히 구현했음을 spec 원문과 직접 대조해 확인했다.

- **함수 시그니처**: `translateSetupChannelError(err: unknown): BadRequestException |
  BadGatewayException` — spec §5.4의 400/502 두 갈래와 정확히 대응. 반환 타입 확장이 유일한
  호출자(`TriggersService.rotateBotToken`)에서 즉시 `throw`되므로 안전.
- **필드명·에러 코드**: `code: 'BOT_TOKEN_INVALID'`(400)/`code: 'CHAT_CHANNEL_SETUP_FAILED'`(502)가
  §5.4 표의 코드 문자열과 정확히 일치. `CREDENTIAL_REJECTED_CODE` 상수를 통해 오타를 원천 차단.
- **기본값/메시지**: 응답 `message`가 고정 client-safe 문자열(`'Bot token was rejected by the
  provider.'` / `'Chat channel setup failed after rotation.'`)이고 `details.reason`(provider
  원문 echo)이 완전히 제거됐다 — §5.4의 "실패 응답 본문에는 provider 원문을 싣지 않는다" 규정과
  정확히 일치. 원문은 `TriggersService.rotateBotToken`의 `catch` 블록에서 `this.logger.warn`으로만
  남도록 배선되어 있고, 신규 테스트(`triggers.service.spec.ts`)가 응답 본문 부재(`not.toContain`)와
  로그 존재(`toContain`) 양쪽을 모두 단언해 "어디에도 안 남는다"와 구별한다.
- **검증 규칙/판별 순서**: `isCredentialRejectedError(err)`(정확 일치)를 주 경로로, message의
  `/\b(401|403)\b/` 정규식을 한시적 fallback으로 두는 순서가 §1.1.2의 "한시적 예외" 서술과
  일치한다. `isCredentialRejectedError`가 `err instanceof Error && code === 상수` 정확 일치로만
  판별해, Node/undici 시스템 에러(`ENOTFOUND` 등)의 `.code`와 충돌하지 않음을 회귀 테스트로
  직접 확인했다(`chat-channel-input-rules.spec.ts`의 `ENOTFOUND` fixture — 뮤테이션 없이 정적
  대조로 실측).
- **provider별 판별 신호**: Discord(`app.status`가 401/403), Slack(`error` 값 화이트리스트,
  HTTP 200 응답 특성 반영), Telegram(`error_code` 401/403, body에 HTTP status를 싣는 provider
  특성 반영) 세 provider의 서로 다른 신호 방식이 spec의 R-CC-23 표(Slack HTTP 200+`invalid_auth`,
  Discord status 자체 없음, Telegram HTTP status)와 정확히 대응된다.
- **엣지 케이스**: Discord의 `app.code`가 인증 실패 시 `0`(falsy)으로 오는 경우 — 어댑터가
  `app.code != null`(0은 null이 아님)로 처리해 이 분기를 정확히 타고, 판별은 `code` 값이 아니라
  `status` 필드로 하도록 재설계되어 spec §1.1.2 3중 네임스페이스 표(우리 `code` 문자열 vs
  Discord 원본 숫자 `code` vs Node 시스템 `.code`)의 혼동을 구조적으로 피한다. non-Error throw
  (문자열 등)도 502 봉투로 fallback함을 테스트로 확인.
- **비즈니스 로직 반전(캐너리)**: `chat-channel-input-rules.spec.ts`의 옛 캐너리("discord
  verify_key 불일치는 지금 502로 떨어진다 — 의도는 400")가 이번 PR로 의도대로 400 반전됐고,
  이는 plan(`plan/in-progress/impl-setup-error-code.md`)이 사전에 "캐너리 뒤집기가 의도"라고
  선언한 대로다.
- **반환값**: `translateSetupChannelError`의 모든 코드 경로(credential-rejected/그 외)가
  `BadRequestException`/`BadGatewayException` 인스턴스를 명시적으로 반환하며, undefined 경로
  없음.
- **TODO/FIXME/HACK/XXX**: diff 전체(`codebase/**`)에 잔존 없음(직접 grep 확인).
- **에러 시나리오**: 401/403(각 provider 신호), 404(자격 증명과 무관 → 502), non-JSON body,
  non-Error throw, DNS 계열 시스템 에러(`.code` 충돌) 등이 각각 테스트로 고정돼 있다.

이전 라운드(`13_41_55`)가 지적한 WARNING 5건(Logger spy 전역 누출 방지, http-exception.filter의
502 회귀 캐너리 부재, discord 401/403 매직리터럴, CHANGELOG 누락, 유저가이드 미갱신)과 SPEC-DRIFT
1건(spec frontmatter "미구현" 서술)을 코드/spec 현재 상태에서 모두 직접 재확인했고, 전부 실제로
반영돼 있다 — 특히 `triggers.service.spec.ts`의 신규 `Logger.prototype.warn` spy가 `try/finally`로
감싸져 있음을 소스로 직접 확인했고(`RESOLUTION.md`의 주장이 아니라 실물 코드 대조), spec
frontmatter도 "구현됐다"로 갱신되어 있음을 확인했다. 남은 것은 spec 쪽 INFO 2건(중앙 에러
카탈로그 미등재, Slack 5값 열거의 slack.md §3.1 미반영)뿐이며 둘 다 이미 다른 트래커가 추적
중이고 코드 결함이 아니다.

## 위험도

NONE — CRITICAL/WARNING 급 요구사항 미충족 없음. 코드는 관련 spec 두 문서(`15-chat-channel.md
§5.4`, `chat-channel-adapter.md §1.1.2`)와 line-level로 정확히 일치하며, 이전 리뷰 라운드의
지적사항이 모두 실제로 반영된 것을 직접 대조로 확인했다.
