# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 20행) 을 SSOT 로 적재했다.

## 변경 set 요약

이번 diff 는 `chatChannel` PATCH 검증 에러 응답에 `details[].code` 를 15자리 배선하고(`triggers.service.ts` 13곳 + `password.util.ts` 2곳), `botToken` 에 `@MinLength(1)` 를 추가하고, 5개 차단 필드 거부 메시지를 `chat-channel-rejection-messages.const.ts` 상수로 통합한 backend PR 이다(+ 테스트·CHANGELOG·plan·review 산출물). frontend 파일은 diff 에 전혀 없다.

## 발견사항

- **[WARNING]** `chatChannel`/`provider` PATCH 거부 응답에 이번 PR 이 새로 실은 `details.code` 가 유저 가이드에 반영되지 않음
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.service.ts` (현재 734행 `details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD }`, 745행 `details: { field: 'provider', code: ErrorCode.INVALID_FIELD }` — 이 PR 이전엔 `{ field }` 만 있었음. `triggers.service.spec.ts` diff 의 `details: { field: 'chatChannel', code: 'INVALID_FIELD' }`(옛 3278행 부근) / `details: { field: 'provider', code: 'INVALID_FIELD' }`(옛 3416-3418행 부근) 이 이 배선의 회귀 캐너리다)
  - 매트릭스 항목: `backend-api-change` (`codebase/backend/src/**/dto/**` glob — 같은 PR 의 `chat-channel-config.dto.ts` 가 매치) target(b) *"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"*. `trigger.match=="semantic"` 이라 reviewer 판단 소관.
  - 누락된 동반 갱신: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429` / `triggers.en.mdx:418` — 다음 문장이 응답 바디를 리터럴로 인용한다:
    - KO(429행): `"PATCH 로 chatChannel 을 새로 붙이면 400 VALIDATION_ERROR (details.field='chatChannel'), provider 를 다른 값으로 바꾸면 400 (details.field='provider')"`
    - EN(418행): `"returns 400 VALIDATION_ERROR (details.field='chatChannel')"` / `"changing provider returns 400 (details.field='provider')"`
    - 두 문장 모두 이제 실제 응답에 있는 `code: 'INVALID_FIELD'` 키를 언급하지 않는다.
  - 상세: 이 문서는 실제로 `details.code=X` 표기 관례를 이미 갖고 있다 — 같은 파일 283/298행(KO)·272/287행(EN) 이 `submit_form` 검증 실패를 `error.details[{ field, message, code }]` 로 정확히 인용한다. 즉 이 유저 가이드는 API 응답 스키마를 소비자에게 문자 그대로 노출하는 문서이고, 그 스키마가 이번 PR 로 바뀌었는데 딱 이 두 문장만 갱신 안 됐다. `plan/in-progress/impl-details-code-wiring.md:129-134` (INFO 3) 이 "chatChannel/provider 분기도 code 를 받는다"는 사실을 이미 인지했지만, 그 메모는 **spec** 등재 여부(`spec/5-system/15-chat-channel.md` §5.4.1 표·`spec/2-navigation/2-trigger-list.md`)만 다뤘고 **frontend user-guide MDX** (`content/docs/02-nodes/triggers.mdx`) 는 언급하지 않는다 — 이번 리뷰가 잡아낸 것은 developer 가 이미 다룬 축과 다른 blind spot 이다. `verify: null` (자동 가드 없음)이라 사람 리뷰가 유일한 안전망이다.
  - 제안: 같은 PR/turn 안에서 `02-nodes/triggers.mdx:429` + `triggers.en.mdx:418` 두 줄에 `code='INVALID_FIELD'` 언급을 추가한다 (예: `details.field='chatChannel', details.code='INVALID_FIELD'`). 사용자 영향: API 연동 개발자가 이 가이드만 보고 응답 파싱 로직을 짜면 새 `code` 필드를 놓친다 — 가이드가 stale.

- **[INFO]** 인접 provider 문서(`slack.mdx`/`discord.mdx`/`telegram.mdx` KO/EN)의 `botToken`/`inboundSigningPlaintext` PATCH 거부 섹션도 동일 패턴으로 `code` 미언급이나, 이 경로의 `code` 는 이번 PR 이전부터 존재
  - 변경 파일: 해당 없음(이번 diff 밖) — `codebase/backend/src/common/pipes/validation.pipe.ts:58` 의 `flattenErrors` 가 이미 `code: 'INVALID_FIELD'` 를 싣고 있었다(이번 diff 미포함 파일, `git blame` 상 이전 커밋 소유)
  - 매트릭스 항목: `backend-api-change` — 다만 이번 diff 가 이 특정 응답 경로의 payload 를 바꾸지 않았으므로 이번 PR 의 직접 trigger 는 아니다.
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx:137-141`, `slack.en.mdx:137-141`, `discord.mdx:123-127`, `discord.en.mdx:112-116`, `telegram.mdx:119`, `telegram.en.mdx:106` — 전부 `details.field='chatChannel.botToken'` / `details.field='chatChannel.inboundSigningPlaintext'` 만 인용하고 `code` 는 언급 안 함(같은 파일 172행 부근의 `UNKNOWN_PLACEHOLDER` 절은 `details.code=` 표기를 이미 쓰는데도).
  - 상세: 이번 PR 이 직접 만든 gap 은 아니라 CRITICAL/WARNING 으로 격상하지 않지만, `chat-channel-rejection-messages.const.ts` 가 정확히 이 5필드(botToken 포함)의 거부 문면을 다루는 신규 파일이라 같은 turn 에 함께 정리하기 좋은 위치다. 방치하면 다음 세션이 "왜 어떤 곳은 code 를 적고 어떤 곳은 안 적었는지" 를 다시 추적해야 한다.
  - 제안: 후속 정리 항목으로 트래커에 등재하거나, 여유가 있으면 이번 turn 에 함께 `code` 표기를 6개 파일에 추가.

## 영역 무관 확인 (매칭 안 된 trigger)

- 새 노드 추가 / 노드 schema 변경 — 변경 파일이 `codebase/backend/src/nodes/**` 밖(`modules/triggers/`, `common/utils/`)이라 glob 미매칭
- 신규 UI 문자열(TSX) / 신규 위젯 chrome 문자열 — TSX·channel-web-chat 변경 없음
- i18n dict / backend-labels — `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 는 backend 리터럴 한국어 문자열을 응답에 직접 실어 보내는 방식(frontend `dict`/`backend-labels.ts` 경유 안 함)이라 parity 가드 대상 아님. `password.util.ts` 의 영문 message 도 동일하게 frontend 매핑 미경유
- 통합/제공자 신규·변경 — 신규 provider 추가나 provider별 설정 절차 변경 없음(기존 5필드 거부 로직의 내부 리팩터 + `code` additive)
- 유저 가이드 신규 섹션 디렉토리 — 신규 `docs/<NN>-<name>/` 없음
- 인증·권한·세션 흐름 변경 — `codebase/backend/src/modules/auth/**` 밖(`common/utils/password.util.ts` 는 auth 모듈이 아님), `07-workspace-and-team/password-and-sessions.mdx` 는 정책 설명만 하고 `details` 응답 스키마를 인용하지 않아 이번 `code` 추가와 무관
- 표현식 언어 변경 / 실행·디버깅 흐름 변경 — 해당 파일 변경 없음
- 신규 warningCode/errorCode 발행 — `error-codes.ts` 의 `ErrorCode` enum 자체는 변경 없음. `INVALID_FIELD` 는 기존 canonical 값(`error-codes.ts:116`, 다수 `modules/*` 가 이미 참조)을 응답 발행 지점 15곳에 **재사용**한 것 — "신규" 코드 발행이 아니므로 `ERROR_KO`/`WARNING_KO` 매핑 신설 트리거 미해당

## 요약

매트릭스 20행 중 명확히 매칭된 것은 `backend-api-change`(semantic, DTO glob) 1건이며, 그 target(b) "API 노출 변경 → user-guide 페이지" 동반 갱신이 누락됐다 — `02-nodes/triggers.mdx`/`.en.mdx` 가 이번 PR 이 `chatChannel`/`provider` PATCH 거부 응답에 새로 실은 `details.code` 를 반영하지 못해 WARNING 1건. 같은 기능 영역의 인접 provider 문서(`slack`/`discord`/`telegram`.mdx) 도 유사하게 `code` 미언급이지만 그 경로의 `code` 는 이번 diff 이전부터 존재해 이번 PR 의 직접 trigger 는 아니므로 INFO 로 등재. i18n dict parity·backend-labels·신규 섹션 locale·신규 node·auth 흐름·표현식 언어 등 나머지 19개 trigger 는 전부 미매칭(해당 없음).

## 위험도

LOW
