# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위와 방법

대상은 `spec/5-system/` 전체이나, 프롬프트 예산 초과로 `2-api-convention.md` · `1-auth.md` ·
`3-error-handling.md` 세 파일만 전문이 실렸고 나머지 15개 파일은 절단됐다. 절단된 파일과
`related_specs`(대부분 절단)는 저장소에서 직접 `Read`/`grep` 하여 보완했다 — 특히
`spec/5-system/15-chat-channel.md`(R-CC-21 · §5.4·§5.4.1) · `spec/2-navigation/2-trigger-list.md`
(PATCH 정책·필드 표) · `spec/conventions/error-codes.md`(§4.1·§4.2·§5) 를 전문 대조했다. 이번
검토는 `plan/in-progress/impl-details-code-wiring.md`(details[].code 배선·botToken
`@MinLength(1)`·메시지 상수화)의 impl-prep 게이트이므로, 그 작업이 딛고 서는 spec 표면을
중점적으로 봤다.

이미 알려져 있고 처리된 항목(예: `2-trigger-list.md:106` botToken 마스킹 자기모순 — 2026-09-08
배치 A-2-4 완료, `error.details[].code` 신규 규약 배선 갭 — 현재 PR 이 닫는 대상)은 재기재하지
않았다.

---

## 발견사항

- **[WARNING]** `botToken` 형식 검증 규칙이 provider 셋 중 하나(Telegram)에만 맞는 정규식인데
  일반 규칙으로 인용되고, 인용 대상 절에는 그 정규식이 없다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `Chat Channel | botToken` 행
    ("형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$` ([Spec Chat Channel §5.4](../5-system/15-chat-channel.md#54-bot-token-rotation-api-응답-계약))")
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §4.1 (`Trigger.config.chatChannel`) 의 provider별
    포맷 서술 — *"telegram=BotFather `\d+:[A-Za-z0-9_-]+` / slack=`xoxb-*` / discord=Developer
    Portal Bot Token"* — 그리고 `15-chat-channel.md §5.4`(Bot Token Rotation API 응답 계약,
    실제 인용 대상) 자체에는 해당 정규식이 등장하지 않는다.
  - 상세: `2-trigger-list.md` 의 `botToken` 행은 provider 무관 공용 행이다(바로 위 `provider`
    행·`inboundSigning` 행과 달리 "telegram/slack/discord 한정" 같은 스코프 한정 문구가 없다).
    그런데 인용된 정규식 `^\d{6,}:[A-Za-z0-9_-]{30,}$` 는 Telegram BotFather 발급 형식 전용이다 —
    Slack bot token 은 `xoxb-` 로 시작하고 Discord 는 별도 Developer Portal 형식이라 둘 다 이
    정규식을 통과하지 못한다. 실제로 이 정규식은 코드베이스에서 `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:67`
    ·`telegram.en.mdx:56`·`codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts` 에 **Telegram
    전용** 안내문으로만 존재하며, 실제 검증 코드로 배선돼 있지도 않다(문서화된 형태일 뿐). 게다가
    인용 target 인 `15-chat-channel.md §5.4`(Bot Token Rotation API 응답 계약)는 rotate 엔드포인트의
    요청/응답·에러 코드 표를 다루는 절이라 애초에 이 정규식을 포함하지 않는다 — 앵커가 착지하지
    않는 인용이다. 이 문서는 마침 진행 중인 PR(`ChatChannelConfigDto.botToken` 에 `@MinLength(1)`
    추가, `plan/in-progress/spec-draft-nullable-notation-followups.md:2219` 백로그)이 다루는 바로 그
    필드의 검증 규칙을 서술하는 자리라, 다음 구현자가 이 문구를 근거로 provider 공용 정규식을
    DTO 에 배선하면(3-provider 공용 `ChatChannelConfigDto`) Slack/Discord 트리거 생성이 항상
    400 으로 막히는 실질 회귀가 된다.
  - 제안: (1) `2-trigger-list.md` 의 `botToken` 행에서 이 정규식 문구를 **Telegram 전용**으로
    스코프를 좁히거나(바로 위 `inboundSigning` 행의 "slack / discord 한정" 패턴처럼), (2) 인용
    대상을 실제 provider별 형식이 있는 `15-chat-channel.md §4.1`(또는 Telegram 통합 가이드)로
    정정한다. 현재 in-flight PR 의 item C(`@MinLength(1)`)는 이 정규식을 쓰지 않는 방향으로 이미
    정해져 있어 이번 PR 의 동작에 즉시 영향은 없으나, 문서 자체의 교차 인용은 planner 턴에서
    바로잡아야 다음 사람이 잘못된 근거로 provider 공용 정규식을 얹지 않는다.

---

## 요약

이번 --impl-prep 대상인 `spec/5-system/2-api-convention.md`(§5.3 `details[].code` 신규 규약)
·`1-auth.md`·`3-error-handling.md` 는 서로 및 `conventions/error-codes.md`·`15-chat-channel.md`
·`2-navigation/2-trigger-list.md` 등 관련 영역과 **폭넓게 정합적**이다 — 특히 §5.3 의 신규
"field 를 실으면 code 도 싣는다" 규약은 `3-error-handling.md §1.10`(TRIGGER_ENDPOINT_PATH_CONFLICT)
·`conventions/error-codes.md §4.2`(trigger 파라미터 검증 정규화)·`15-chat-channel.md §5.4.1`
(R-CC-21 배선 전/후 관측값 구분)과 교차 인용이 정확히 착지한다. 이번 PR 이 배선하려는
`details[].code` 갭(13+2곳)과 `botToken` `@MinLength(1)` 은 모두 사전에 별도 리뷰 세션에서
근거가 실측되고 백로그에 등재된 항목이라 이 스코프 자체의 위험은 낮다. 다만 위에서 지적한
`2-trigger-list.md` 의 botToken 형식 검증 인용은 (a) 인용 target 이 실제로 그 내용을 담고 있지
않고 (b) provider 하나에만 맞는 규칙을 공용 행에 무자격으로 적용한 상태라, 이번 PR 이 같은
필드의 검증 규칙을 만지는 시점에 함께 바로잡을 가치가 있는 WARNING 이다. CRITICAL 급 데이터
모델·API 계약·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다.

## 위험도

LOW
