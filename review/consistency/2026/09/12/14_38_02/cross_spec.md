# Cross-Spec 일관성 검토 — `impl-setup-error-code` (impl-done, scope=`spec/5-system/`)

## 전제 확인

- `spec/5-system/**` 델타는 실측대로 0개다. 이번 브랜치가 건드린 유일한 spec 파일은
  `spec/conventions/chat-channel-adapter.md`(frontmatter `pending_plans` + §1.1.2 각주 갱신)이고,
  본문 계약(`§5.4` 에러 표, `§1.1.2` `code` 선언 계약, `2-api-convention.md §6`, `swagger.md §2-4`)은
  이미 `origin/main` 커밋 `8964a7114`(`#1323`, planner 턴)에서 확정돼 있었다. 이번 diff(21파일/코드
  중심)는 **그 spec 을 코드가 뒤늦게 따라잡는 턴**이다(`plan/in-progress/impl-setup-error-code.md`
  `spec_impact: none` 명시).
- 따라서 본 검토의 실질 질문은 "새 spec 결정이 다른 영역과 충돌하는가" 가 아니라 **"코드
  구현이 이미 확정된 spec 계약 및 인접 영역과 일치하는가"** 다. 아래는 그 대조 결과다.

## 대조 결과 — 일치 확인 (충돌 없음)

| 대조 축 | spec 문서 | 코드 | 판정 |
|---|---|---|---|
| 400/502 상태 코드 분기 | `15-chat-channel.md §5.4` 에러 표 (`BOT_TOKEN_INVALID`=400, `CHAT_CHANNEL_SETUP_FAILED`=502) | `chat-channel-input-rules.ts` `translateSetupChannelError` | 일치 |
| 502 상태 코드 카탈로그 | `2-api-convention.md §6` (502 행, code=`CHAT_CHANNEL_SETUP_FAILED`, 근거 §5.4 링크) | 동일 | 일치 |
| Swagger 데코레이터 규칙 | `conventions/swagger.md §2-4` (`502 외부 provider 호출 실패 → @ApiBadGatewayResponse`) | `triggers.controller.ts` `rotateBotToken` 에 `@ApiBadGatewayResponse`+`@ApiBadRequestResponse` 신설 | 일치 |
| `code` 선언 계약 3중 네임스페이스 | `chat-channel-adapter.md §1.1.2` 표 (본 계약 `code` / EIA `event.error.code` / provider 원본 숫자 `code`) | `chat-channel/types.ts` `CREDENTIAL_REJECTED_CODE`/`isCredentialRejectedError` 주석이 표를 그대로 인용하고 Node/undici 시스템 에러 `code`(4번째 뜻)까지 화이트리스트 정확 일치로 방어 | 일치(오히려 spec 표보다 한 뜻 더 넓게 방어) |
| provider 원문 비노출 | `15-chat-channel.md §5.4` "실패 응답 본문에는 provider 원문을 싣지 않는다" | `translateSetupChannelError` 의 `details.reason` 제거 + `TriggersService.rotateBotToken` catch 의 `logger.warn` 이관 | 일치 |
| provider 문서 (discord/slack) 의 `code` 선언 언급 | `4-nodes/7-trigger/providers/discord.md`·`slack.md` 가 이미 CCA §1.1.2 를 인용해 `code: 'BOT_TOKEN_INVALID'` 를 서술 | adapter 구현이 그 서술대로 `credentialRejectedError()` 로 `code` 부착 | 일치 |
| Rationale 앵커 무결성 | `R-CCA-9`(chat-channel-adapter.md) · `R-CC-23`(15-chat-channel.md) 인용 | 코드 주석·plan 이 동일 앵커를 인용 | 앵커 실재 확인, 댕글링 없음 |

## 발견사항

- **[INFO]** Slack 자격 증명 거부 값 목록 — spec 예시가 "..." 로 열어 뒀고 코드가 5값으로 처음 확정
  - target 위치: `spec/conventions/chat-channel-adapter.md` §1.1.2 pending_plans 갱신부 (본 diff), 구현은 `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` `SLACK_CREDENTIAL_REJECTED_ERRORS`
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md` §3.1 코드 주석 — `'invalid_auth' | 'not_authed' | 'account_inactive' | 'token_revoked' | ...`(4값 + 개방형 `...`)
  - 상세: 코드가 실제로 화이트리스트하는 값은 `invalid_auth`·`not_authed`·`account_inactive`·`token_revoked`·**`token_expired`** 5개다. `token_expired` 는 slack.md 의 예시 목록에 없다. 모순은 아니다(spec 자체가 `...`로 비-완결 목록임을 표시) — 다만 slack.md 예시가 이제 코드보다 좁아 "정본 목록이 코드에 있다"는 사실이 spec 독자에게 안 보인다.
  - 제안: 코드 리뷰(`review/code/2026/09/12/14_23_31` documentation INFO#8)에서 이미 동일 지점을 "후속 spec PR 대상, 병합 차단 아님"으로 처분함 — 다음 spec 편집 시 slack.md §3.1 목록을 5값 정확 열거 또는 "정본은 코드 상수" cross-link 로 갱신 권고. 병합 차단 사유 아님.

- **[INFO]** 중앙 에러 카탈로그(`3-error-handling.md §1`) 에 chat-channel rotate 코드군 미등재 — 기존 갭, 이미 트래커에 옮겨짐
  - target 위치: 없음(이번 diff 는 `3-error-handling.md` 를 건드리지 않음 — spec_impact: none 대로)
  - 충돌 대상: `3-error-handling.md §1.7`~`§1.11` (webhook·KB·workspace-member·trigger-endpointPath·trigger-authConfig) 이 확립한 "도메인 특화 코드는 `(도메인 spec 참조)` 서브섹션으로 중앙 카탈로그에 가시성 등재" 패턴
  - 상세: `BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`·`INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED` 등은 같은 `triggers` 도메인(§1.10/§1.11 과 동일 컨트롤러 파일)인데도 이 패턴을 따르지 않아, 카탈로그 등재 관례가 도메인마다 비일관적으로 보인다. 단, 이 gap 은 이번 PR 이 만든 것이 아니라 `#1323`(spec-only) 시점부터 있었고, `plan/in-progress/spec-draft-nullable-notation-followups.md:2806` 에 "`§1.12` 가칭"으로 명시적으로 옮겨져 미체크(`[ ]`) 항목으로 추적 중임을 확인했다 — spec 권한이 없는 developer 턴이 손댈 범위가 아니라는 처분도 합리적이다.
  - 제안: 조치 불요(이미 별도 planner 턴 대상으로 등재됨). 다음 planner 턴에서 `3-error-handling.md` 에 `§1.12` 신설 시 이 항목을 닫을 것.

- **[INFO]** `getCodeFromStatus`(http-exception filter) 502 기본 코드 행 부재 — 현재 도달 불가, 이미 트래커에 등재
  - target 위치: 코드 diff 밖(`codebase/backend/src/common/filters/http-exception.filter.ts` 무변경)
  - 충돌 대상: `2-api-convention.md §6` 502 카탈로그
  - 상세: `translateSetupChannelError` 는 항상 명시적 `code` 를 실어 던지므로 필터의 status→기본코드 fallback 표가 502 를 다루지 않아도 현재는 도달 불가 경로다. `spec-draft-nullable-notation-followups.md:2911` 에 "두 번째 502 소비자가 `code` 없이 생기면 그때 행을 추가한다"는 조건부로 이미 추적 중.
  - 제안: 조치 불요. 병합 차단 아님.

## 요약

이번 diff 는 스스로 spec 을 만들지 않고(`spec_impact: none`), `#1323`(이미 `origin/main` 에 병합된 planner 턴)이 `15-chat-channel.md §5.4`·`chat-channel-adapter.md §1.1.2`·`2-api-convention.md §6`·`swagger.md §2-4` 네 곳에 확정해 둔 계약을 그대로 구현했다. 400/502 분기, `code` 프로퍼티 선언 계약, provider 원문 비노출, Swagger 데코레이터까지 네 SoT 문서와 라인 단위로 대조했고 모순을 찾지 못했다 — 오히려 CCA §1.1.2 의 3중 네임스페이스 표에 없는 4번째 뜻(Node/undici 시스템 에러 `code`)까지 코드가 스스로 식별해 화이트리스트 정확 일치로 방어한 점은 spec 의도를 좁게가 아니라 정확히 구현한 사례다. 발견한 세 건(Slack 값 목록의 spec-code drift, 중앙 에러 카탈로그 미등재, 필터 502 기본 코드 부재)은 모두 이 PR 이전부터 존재했고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 명시적 근거와 함께 이미 추적 중인 항목이라 이번 병합을 막을 사유가 아니다.

## 위험도

NONE
