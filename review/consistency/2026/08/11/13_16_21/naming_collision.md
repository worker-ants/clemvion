# 신규 식별자 충돌 검토 — trigger 시크릿/토큰 회전 감사 액션 3종 (2026-08-11 재검토)

## 범위·방법

대상 신규 식별자:

- 감사 액션 문자열 `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked`
- TS 상수 키 `TRIGGER_NOTIFICATION_SECRET_ROTATED` / `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` / `TRIGGER_INTERACTION_TOKEN_REVOKED` (`codebase/backend/src/modules/audit-logs/audit-action.const.ts`)

`prompt_file` 에 결합된 `spec/5-system` 번들은 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`·`15-chat-channel.md`·`spec/conventions/audit-actions.md`·실제 diff 본문 등 이번 판정에 핵심적인 파일 다수가 절단되어 있었다. 절단된 파일은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-rotation-audit`)에서 `Read`/`git diff`/`grep`으로 직접 열어 재확인했다.

**선행 검토 대조**: 같은 워크트리의 `review/consistency/2026/08/11/11_48_48/naming_collision.md`(더 이른 스냅샷 기준)가 이미 같은 3개 식별자를 검토해 WARNING 1건(`trigger.bot_token_rotated` 표기가 `chat_channel_*` 접두 관례와 불일치)·INFO 2건을 남겼다. 현재 target(diff `origin/main...HEAD`)을 실측한 결과 그 WARNING 은 **해소됐다** — 현재 표기는 `trigger.chat_channel_bot_token_rotated` 로, 엔티티 컬럼(`chat_channel_token_v2`)·스케줄러(`ChatChannelTokenRotatorService`)·HTTP 경로(`/chat-channel/rotate-bot-token`)와 접두가 완전히 정합한다. 선행 검토의 INFO 2번(`15-chat-channel.md` 의 가상 예시 `chat-channel.rotate-bot-token`)도 diff 에서 실제 채택 표기로 정정되고 "2026-08-11 정정" 주석까지 남겼음을 확인했다. 아래는 현재 target 기준 재실측 결과다.

## 발견사항

Critical 없음.

- **[INFO]** `integration.rotated` 와의 개념적 유사성은 실은 의도된 설계 분기이며 문서화돼 있다
  - target 신규 식별자: `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated`
  - 기존 사용처: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:57` `INTEGRATION_ROTATED: 'integration.rotated'` (기존, `AuthConfig`/외부 서비스 연동 자격증명 회전에 사용)
  - 상세: 호출자가 명시적으로 우려한 지점이라 확인했다. 두 액션은 문자열이 겹치지 않고(`integration.*` vs `trigger.*`, 각기 다른 resource dot-prefix), 근거 데이터도 별개다 — `integration.rotated` 는 `Integration`/`AuthConfig` 엔티티의 자격증명(외부 OAuth·API key 등)을 대상으로 하고, 신규 3종은 `Trigger.config` 아래 `secret_store` ref(`secret://triggers/{id}/...`)로 관리되는 per-trigger 자격증명(HMAC secret·bot token·interaction token)을 대상으로 한다 — 데이터 모델이 애초에 분리돼 있어(Trigger 엔티티가 Integration 을 참조하지 않음, `15-chat-channel.md:200-244` 확인) 같은 credential 이 두 액션 중 하나로 우연히 겹쳐 기록될 가능성도 없다. `spec/conventions/audit-actions.md` §3 하단 Rationale("트리거 시크릿/토큰 회전을 셋으로 가른 이유")이 바로 이 선례(`integration.rotated` 로 흡수하는 대안)를 명시적으로 검토하고 기각한 이력까지 남겨, "혼동 방지" 관점에서 오히려 모범적으로 처리됐다. CRITICAL/WARNING 대상 아님 — 사용자가 요청한 "선례와 의미가 겹쳐 혼동되지 않는가"에 대한 명시적 반증 기록으로 남긴다.

- **[INFO]** `interaction_token_revoked` 와 `login_history.event` 의 `session_revoked`·`token_reuse_detected` 는 어휘만 유사하고 네임스페이스가 다르다
  - target 신규 식별자: `trigger.interaction_token_revoked` (`audit_log.action`, workspace-scoped)
  - 기존 사용처: `spec/5-system/1-auth.md` §4.3 `login_history.event` enum 의 `session_revoked`/`token_reuse_detected` (user-scoped, 별도 테이블 `login_history`)
  - 상세: 저장 테이블·컬럼·스코프(워크스페이스 감사 로그 vs 사용자 본인 로그인 이력)가 완전히 분리돼 있어 조회 API·필터·타입 어디서도 충돌하지 않는다. 단어 `revoked` 재사용은 의미가 일관되므로(둘 다 "무효화") 오히려 자연스럽다. 충돌 아님 — 참고 기록.

- **[INFO]** TS 상수 키 3개(`TRIGGER_NOTIFICATION_SECRET_ROTATED`/`TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`/`TRIGGER_INTERACTION_TOKEN_REVOKED`)는 `AUDIT_ACTIONS` const 객체 내에서도, 프로젝트 전역 codebase grep 에서도 유일하다
  - 확인: `AUDIT_ACTIONS` 객체(31개 기존 키 + 신규 3개, `audit-action.const.ts:53-106`)에 중복 키 없음. `grep -rn "TRIGGER_NOTIFICATION_SECRET_ROTATED\|TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED\|TRIGGER_INTERACTION_TOKEN_REVOKED" codebase/` 결과는 정의부(`audit-action.const.ts`)와 사용부(`triggers.service.ts` 3곳)뿐. frontend 쪽에는 이 상수를 참조하는 코드가 아예 없다(감사 로그 라벨 매핑이 frontend 에 없는 것으로 보이나, 이는 naming collision 이 아니라 별도 커버리지 이슈라 본 체크 범위 밖).

## 항목별 점검 요약

1. **요구사항 ID 충돌** — 없음. `EIA-NX-12`/`EIA-AU-07`(기존 req ID)는 본문만 갱신됐고 신규 ID 부여 없음.
2. **엔티티/타입명 충돌** — 없음. 신규 DTO/인터페이스/엔티티 없음 (기존 `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 시그니처에 `userId` 인자만 추가).
3. **API endpoint 충돌** — 없음. 신규 endpoint 없음 — `POST /api/triggers/:id/notification/rotate-secret`·`/interaction/revoke-token`·`/chat-channel/rotate-bot-token` 모두 기존에 이미 정의돼 있던 endpoint 이며, 이번 diff 는 감사 로깅 호출과 `userId` 배선만 추가.
4. **이벤트/메시지명 충돌** — 없음. WS 프로토콜(`6-websocket-protocol.md`)·큐명(`data-flow/10-triggers.md`, `data-flow/14-chat-channel.md`, `data-flow/15-external-interaction.md`) 어디에도 세 액션 문자열이 등장하지 않음(grep 0건) — 감사 로그 전용 문자열로 격리돼 있어 WS/큐 이벤트명과 겹칠 표면 자체가 없음.
5. **환경변수·설정키 충돌** — 없음. 이번 diff 는 신규 env/config key 를 도입하지 않음(controller/service diff 확인).
6. **파일 경로 충돌** — 없음. 신규 spec 파일 없음 — 기존 6개 파일(`1-auth.md`, `14-external-interaction-api.md`, `15-chat-channel.md`, `2-navigation/2-trigger-list.md`, `conventions/audit-actions.md`, `data-flow/1-audit.md`) 본문 갱신만.

## 요약

`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked` 3개 신규 감사 액션과 대응 TS 상수 3개는 기존 `AUDIT_ACTIONS` union·spec 카탈로그(`1-auth.md §4.1`)·conventions 레지스트리(`audit-actions.md §3`) 어디와도 동일 문자열로 겹치지 않으며, 6개 관련 spec 파일이 모두 이번 diff 로 동기 갱신돼 명명이 일관된다. 호출자가 특히 우려한 `integration.rotated` 선례와의 혼동은 resource dot-prefix(`integration.*` vs `trigger.*`)와 데이터 모델 자체(Integration vs per-trigger secret_store ref)가 분리돼 있어 실질 충돌이 없고, `conventions/audit-actions.md` 가 그 대안을 명시적으로 검토·기각한 근거까지 남겨 오히려 모범적이다. 더 이른 스냅샷(11:48:48) 검토가 지적했던 유일한 WARNING(`trigger.bot_token_rotated` 의 `chat_channel` 접두 누락)은 현재 target 에서 `trigger.chat_channel_bot_token_rotated` 로 이미 정정돼 재발하지 않는다. 신규 endpoint·엔티티·env var·spec 파일 경로 도입도 없어 나머지 4개 점검 관점도 전부 충돌 없음.

## 위험도

NONE
