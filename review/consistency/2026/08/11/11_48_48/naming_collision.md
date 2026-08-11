# 신규 식별자 충돌 검토 — trigger 시크릿/토큰 회전 감사 액션 3종

> **범위 정정**: `prompt_file` 에 결합된 "Target 문서"는 `spec/5-system/1-auth.md` 전체(감사
> 액션 규약·카탈로그 포함)였으나, 그 안에는 이번에 도입하려는 `trigger.notification_secret_rotated`
> / `trigger.bot_token_rotated` / `trigger.interaction_token_revoked` 3개 액션이 아직 등장하지
> 않는다(§4.1 표에 미등재). 호출자 지시대로 이 3개 신규 식별자를 대상으로 별도 실측(코드 grep +
> `AUDIT_ACTIONS` union + `conventions/audit-actions.md` + `spec/5-system/15-chat-channel.md` +
> `plan/in-progress/spec-sync-auth-gaps.md` + 과거 code-review 산출물)해 판정했다.

## 발견사항

- **[WARNING]** `trigger.bot_token_rotated` 가 같은 기능의 기존 명명 관례(`chat_channel_*`)와 다른 네임스페이스를 쓴다
  - target 신규 식별자: `trigger.bot_token_rotated` (`TriggersService.rotateBotToken` 대응)
  - 기존 사용처:
    - DB 컬럼 `chat_channel_token_v2` / `chat_channel_rotated_at` (`codebase/backend/src/modules/triggers/entities/trigger.entity.ts:143-152`)
    - 스케줄러 클래스 `ChatChannelTokenRotatorService` (`codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts:24`, `triggers.module.ts:17,47`)
    - HTTP endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` (`triggers.controller.ts:222-232`, 주석 "동사 `rotate-bot-token`")
    - spec `5-system/15-chat-channel.md:91` (`CCH-SE-04-C`, `ChatChannelTokenRotatorService` 서술) · `spec/2-navigation/2-trigger-list.md:106,156`
    - 과거 code-review 산출물이 이미 이 정확한 gap 을 지적하며 다른 이름을 제안한 이력 3건: `review/code/2026/08/01/12_06_37/security.md:68-69` → `trigger.chat_channel_token_rotated`, `review/code/2026/08/01/18_44_56/security.md:14` → `trigger.chat_channel_bot_token_rotated`, `review/code/2026/08/01/19_10_47/security.md:9` → `trigger.bot_token_rotated`(현재안과 동일 표기 — 셋 중 하나만 현재안과 일치)
  - 상세: 이 기능(rotateBotToken)의 나머지 모든 식별자 — 엔티티 컬럼, 스케줄러 서비스명, HTTP 경로, spec 서술 — 는 예외 없이 `chat_channel` 접두를 붙인다. 반면 제안된 감사 액션명 `trigger.bot_token_rotated` 는 그 접두를 생략해 자매 액션 `trigger.notification_secret_rotated`(엔티티 컬럼 `notification_secret_v2`·서비스 `NotificationSecretRotatorService` 와 완전 정합)와 대칭이 깨진다. "동일 식별자가 다른 의미로 이미 쓰이는" CRITICAL 충돌은 아니지만, `chat_channel`/`chat-channel` 로 grep 하는 운영자가 이 audit action 을 못 찾고, `bot_token` 으로 grep 하면 이 액션만 걸리는 비대칭 검색성 문제가 생긴다. 과거 리뷰 3회 중 2회가 `chat_channel` 접두 포함 안을 제안했던 것도 이 비대칭을 이미 인지했다는 방증이다.
  - 제안: `trigger.chat_channel_token_rotated` (엔티티 컬럼·스케줄러명과 완전 정합, 권장) 또는 `trigger.chat_channel_bot_token_rotated` 로 변경. 현재 표기(`bot_token_rotated`)를 그대로 채택하려면 `conventions/audit-actions.md §3` 레지스트리 주석에 "chat_channel 접두 생략은 의도" 라는 근거를 명시해 재검토 시 실수/의도를 구분 가능하게 할 것.

- **[INFO]** spec 본문의 예시적 audit action 표기(`chat-channel.rotate-bot-token`)가 실제 채택 표기와 다른 형식
  - target 신규 식별자: (참고) `trigger.bot_token_rotated` / `trigger.chat_channel_*` 계열과 비교 대상
  - 기존 사용처: `spec/5-system/15-chat-channel.md:378`, `:610` — PATCH 차단 근거 서술 중 "audit log 가 `trigger.updated` 와 `chat-channel.rotate-bot-token` 으로 mixed" 라는 **가상의(실제 미채택)** 예시
  - 상세: 이 문자열은 `<resource>.<verb>` 규약(`conventions/audit-actions.md §1`, 토큰 구분자는 언더스코어)과 달리 kebab-case(`chat-channel`, `rotate-bot-token`)이고 resource 도 `trigger` 가 아니라 `chat-channel` 이다. 실제 `AUDIT_ACTIONS`/제안된 3개 액션 어디에도 이 표기는 없어 직접 충돌은 아니지만, 이번 gate 통과 후 실제 액션명이 §4.1/conventions 레지스트리에 등재되면 이 예시 문구가 "다른 표기의 audit action 이 실재한다"는 오독을 유발할 수 있다.
  - 제안: 실제 액션명이 확정되면(위 WARNING 항목 결론 반영) `15-chat-channel.md:378,610` 의 예시 문구를 실제 채택 표기로 갱신하거나 "예시(가상)" 임을 명시.

- **[INFO]** 3개 신규 식별자는 현재 `AUDIT_ACTIONS`/spec 카탈로그/conventions 레지스트리 어디에도 존재하지 않음 — 직접 재사용 충돌 없음
  - target 신규 식별자: `trigger.notification_secret_rotated`, `trigger.bot_token_rotated`, `trigger.interaction_token_revoked`
  - 기존 사용처: 없음 — `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AUDIT_ACTIONS`, 31개 기존 값), `spec/5-system/1-auth.md §4.1`, `spec/conventions/audit-actions.md §3` 레지스트리 표를 전수 대조했으나 세 문자열 모두 0건.
  - 상세: (a) 구조 규약(`<resource>.<verb>`, 토큰 언더스코어)·시제 분류(§2.1 과거분사, "목적어+과거분사" 합성형은 `scope_changed`·`reauthorized` 선례로 허용됨) 양쪽 다 정합. (b) `interaction_token_revoked` 의 `revoked` 는 현재 `AUDIT_ACTIONS` 에 없는 새 verb 지만 여전히 과거분사(§2.1)라 taxonomy 위반은 아니며, `login_history.event` 의 `session_revoked`/`token_reuse_detected` 는 별개 테이블·컬럼이라 네임스페이스 충돌이 아니다(단순 어휘 유사). (c) `notification_secret_rotated` 는 엔티티 컬럼 `notification_secret_v2`·서비스 `NotificationSecretRotatorService` 와 완전 정합. (d) `AuditActionFor<'trigger'>` 타입 좁히기(`audit-action.const.ts:103-124`)에도 `trigger.` 접두가 유지되는 한 영향 없음. (e) `plan/in-progress/spec-sync-auth-gaps.md:56-68` 이 바로 이 gap 을 "planner 선행 필요" 항목으로 이미 추적 중이며, `integration.rotated` 를 선례로 인용한다 — 호출자가 제시한 선례와 일치.
  - 제안: 착수 게이트 관점에서 세 식별자 자체의 CRITICAL 충돌은 없어 진행 가능. 다만 위 WARNING(`bot_token_rotated` 접두 비대칭)을 반영해 planner 턴에서 확정 표기를 정하고, `1-auth.md §4.1` Planned 표 + `conventions/audit-actions.md §3` 레지스트리 + `AUDIT_ACTIONS` union 3곳을 동시 갱신할 것 (기존 패턴과 동일 — spec-sync-auth-gaps 커밋 방식 참고).

## 요약

`trigger.notification_secret_rotated` / `trigger.bot_token_rotated` / `trigger.interaction_token_revoked` 3개 신규 감사 액션은 기존 `AUDIT_ACTIONS` union·spec 카탈로그·conventions 레지스트리 어디와도 동일 문자열로 겹치지 않으며, `<resource>.<verb>` 구조·과거분사 시제 분류 규약에도 정합해 CRITICAL 수준의 identifier 충돌은 없다. 다만 `trigger.bot_token_rotated` 는 같은 기능의 엔티티 컬럼(`chat_channel_token_v2`)·스케줄러(`ChatChannelTokenRotatorService`)·HTTP 경로(`/chat-channel/rotate-bot-token`)가 일관되게 쓰는 `chat_channel` 접두를 생략해 검색성·명명 대칭이 깨지는 WARNING 이 있고, 과거 code-review 3회 중 2회가 `chat_channel` 접두 포함안을 제안했던 이력과도 어긋난다. spec `15-chat-channel.md` 의 가상 예시 표기(`chat-channel.rotate-bot-token`)도 실제 채택 표기와 형식이 달라 향후 혼동 소지가 있다(INFO). 착수 게이트는 통과 가능하나, planner 턴에서 `bot_token_rotated` 표기를 재검토(또는 의도 근거 명시)하고 3곳(§4.1·conventions·`AUDIT_ACTIONS`)을 동시 갱신할 것을 권고한다.

## 위험도

LOW
