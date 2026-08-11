# 요구사항(Requirement) 리뷰 — trigger 시크릿/토큰 회전 3종 감사

## 조사 방법

프롬프트 번들이 잘려 전달되지 않은 파일들(spec 6곳 전체 본문·`triggers.controller.ts`·
`triggers.service.ts`·`triggers.service.spec.ts` 전체)을 `Read`/`Grep` 으로 직접 열어 line-level 로
대조했다. 확인 대상: `spec/5-system/1-auth.md §4.1`, `spec/conventions/audit-actions.md §1~§3`,
`spec/data-flow/1-audit.md §1.1`, `spec/5-system/15-chat-channel.md §5.4.1`,
`spec/2-navigation/2-trigger-list.md §3`, `spec/5-system/14-external-interaction-api.md §3.1/§3.3`,
`codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.controller.ts}`,
`codebase/backend/src/modules/audit-logs/audit-action.const.ts`, 두 spec 파일의 spec 테스트,
`plan/in-progress/spec-sync-auth-gaps.md`.

## 발견사항

### [WARNING] `rotateBotToken` 의 신규 감사 기록(`trigger.chat_channel_bot_token_rotated`)에 대한 단위 테스트가 전무

- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `describe('TriggersService — 감사 로깅 (trigger.*)')` 블록(게이트 2317~2379) 및 `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션')` 블록(게이트 1652 부근)
- 상세: 이번 PR 이 추가한 회전/폐기 3종 감사 테스트는 `rotateNotificationSecret`(성공+실패 2건, 게이트 2327·2368)과 `revokePerTriggerToken`(성공 1건, 게이트 2346)뿐이다. `rotateBotToken` 은 `recordAudit({ action: AUDIT_ACTIONS.TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED, ... })` 를 6단계 오케스트레이션 마지막에 실제로 호출하도록 구현돼 있으나(`triggers.service.ts:1113-1119`, 컬럼 갱신 뒤에 기록), 이를 검증하는 테스트가 `triggers.service.spec.ts` 전체에 **0건**이다 (`grep chat_channel_bot_token_rotated` 결과 없음). `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션')` 블록에는 `AuditLogsService` mock(`{ record: jest.fn() }`, 게이트 1679)이 주입돼 있어 호출 자체는 조용히 통과하지만, action/필드를 단언하는 코드가 없다. 성공 시 정확한 액션명이 기록되는지도, 6단계 중간에 던졌을 때 감사가 남지 않는지도 검증되지 않는다.
- 코드 자체는 옳다(recordAudit 배치·액션명·순서 모두 정확) — 이건 기능 결함이 아니라 **회귀 방어 커버리지 갭**이다. 그런데 이 PR 자신이 추가한 테스트 파일 주석(`triggers.service.spec.ts:2317-2326`)이 "이 셋은 ... **CRUD 와 같은 자리에서 전수로 본다**" 라고 명시적으로 선언하는데, 실제로는 3종 중 1종만 절반(성공만) 커버되고 1종(`rotateBotToken`)은 전무해 그 선언과 실제 커버리지가 어긋난다. 이 저장소가 반복적으로 강조하는 원칙("입력 집합 자체가 커버리지 — 새 자리를 등재하지 않으면 조용히 놓친다", 같은 파일 `triggers.controller.spec.ts:148-155` 주석이 정확히 이 논리로 controller 3종 테스트를 추가했다)이 서비스 레이어의 audit 단언에는 일관되게 적용되지 못했다.
- 제안: `rotateBotToken` 성공 시 `auditLogs.record` 가 `action: 'trigger.chat_channel_bot_token_rotated'`, `resourceId: trigger.id`, `userId` 로 호출되는지 단언하는 테스트, 그리고 `setupChannel` 이 throw 하는 케이스(이미 존재하는 실패 테스트들 중 하나에 이어서)에서 `auditLogs.record` 가 호출되지 않는지 단언하는 테스트를 추가한다.

### [INFO] `data-flow/1-audit.md §1.1` 서두 "8개 위치" 문구가 이번 PR 이전부터 stale — 이번 PR 도 같은 섹션을 편집했지만 정정하지 않음

- 위치: `spec/data-flow/1-audit.md:40`
- 상세: "`AuditLogsService.record` 의 실제 호출자는 **8개 위치(5개 service 모듈 + 3개 auth/user controller)** 다" 라는 문구는 실측상 이미 12개 writer 모듈(질문 착수 전 게이트 cross_spec.md 발견사항 #4 가 정확히 이 stale 을 지적)로, 이번 PR 이전부터 존재하던 결함이며 착수 전 게이트도 이를 "이 작업과 무관한 기존 결함" 이 아니라 WARNING(비차단)으로 분류했을 뿐 필수 개정 대상 6곳에는 포함하지 않았다. 다만 이번 PR 이 바로 아래 문단(게이트 101~103, "커버리지 갭")을 트리거 회전 3종 반영으로 직접 편집했으므로, 같은 문단 안에서 인접한 stale 카운트를 그대로 남겨둔 점은 저장소 자신의 원칙("한 커밋에서 동시에 고쳐야 재drift 하지 않는다", `plan/in-progress/spec-sync-auth-gaps.md:37` 인용)과 약하게 어긋난다. 코드 결함은 아니며 이 PR 을 막을 사유도 아니다.
- 제안: 후속 정정으로 실제 writer 모듈 수를 재계산해 반영(이 PR 범위는 아님).

## 통과 확인 (요구사항 핵심 질의 (a)(b)(c) — 문제 없음)

- **(a) spec 서술 ↔ 구현 line-level 일치**: 세 액션명(`trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked`)이 `audit-action.const.ts`(게이트 86-90), `triggers.service.ts`(게이트 928·976·1116)와 spec 6곳(1-auth §4.1:431, audit-actions §3:58, data-flow/1-audit:78-80, 15-chat-channel:378, 2-trigger-list:156-158, 14-EIA:65·95) 전부에서 문자 그대로 동일하다. `resourceType='trigger'`(고정, `TRIGGER_RESOURCE_TYPE`)와 `AuditActionFor<'trigger'>` 타입 좁히기도 세 액션 전부에 적용돼 spec 의 "짝 리소스는 호출된 엔드포인트 쪽만 기록" 원칙(§3 각주)과 일치한다.
- **기록 시점**: 세 메서드 모두 상태 변경(DB `save`/`update`) 완료 **후**에 `recordAudit` 를 호출한다(`rotateNotificationSecret:924→925`, `revokePerTriggerToken:972→973`, `rotateBotToken:1101-1110→1113`). `rotateBotToken` 주석("컬럼 갱신이 끝난 뒤에 기록한다 ... 실패했으면 회전은 일어나지 않은 것")이 실제 배치와 일치하고, `rotateNotificationSecret` 의 "던지면 감사를 남기지 않는다" 테스트(`triggers.service.spec.ts:2368`)로 검증됨.
- **`interaction_token_revoked` vs `*_rotated` 구분**: `revokePerTriggerToken` 코드에 grace 컬럼이 없고(`trigger.config.interaction.triggerToken` 을 즉시 덮어씀, 게이트 966-971) 이전 토큰을 보관하지 않는다 — spec 의 "이전 토큰 즉시 무효화, grace 없음" 서술과 정확히 일치.
- **(b) spec 6곳 상호 모순 없음**: `trigger.chat_channel_bot_token_rotated` 로 세 문서(1-auth·audit-actions·data-flow) 및 두 사용처(chat-channel §5.4.1, trigger-list) 전부 통일됐다. 착수 전 게이트가 지적한 명명 비대칭(`bot_token_rotated` vs `chat_channel_*` 접두 불일치, naming_collision.md WARNING)과 `chat-channel.rotate-bot-token` 이라는 규약 위반 예시(cross_spec.md CRITICAL #3)가 모두 `chat_channel_bot_token_rotated` + 언더스코어 구조로 정정되어 잔존하지 않음(`grep 'chat-channel.rotate-bot-token'` → 정정 이력 각주 1건만, `grep 'trigger.bot_token_rotated'` → 0건). `conventions/audit-actions.md` 에 3분리 근거(폭발 반경) Rationale 도 신설되어 convention_compliance.md 가 요구한 문서화도 충족.
- **(c) `1-auth §4.1` "현재 구현된 액션" 배치 ↔ 코드 상태 일치**: 신규 행(게이트 431)은 "Planned" 표(§4.1 게이트 439-445)가 아니라 "현재 구현된 액션" 표(게이트 419-433) 안에 있고, 실측 결과 `triggers.service.ts` 세 메서드 모두 실제로 `recordAudit`(→`AuditLogsService.record`)를 호출하도록 구현돼 있다(cross_spec.md 가 착수 시점에 CRITICAL 로 경고했던 "구현 미완인데 구현 표에 배치" 시나리오가 실현되지 않았다). `audit-action.const.ts` 의 union·`data-flow/1-audit.md §1.1` Writer 표(게이트 78-80)도 동시에 갱신되어 §4.1 자신이 선언한 SoT 관계와 모순되지 않는다.
- 컨트롤러 3곳 모두 `@Roles('editor')` 유지 + `@CurrentUser('sub') userId` 신규 배선, `triggers.controller.spec.ts`/`triggers.service.spec.ts` 가 인자 자리(스왑 방지)까지 위치 고정 단언.
- TODO/FIXME/HACK/XXX 신규 주석 없음(diff 전수 grep 0건).

## 요약

구현은 착수 전 consistency 게이트가 요구한 6개 spec 문서 동반 갱신과 코드 wiring(controller `userId` 배선 + service `recordAudit` 3건)을 모두 정확히 이행했다. 액션명·resource·기록 시점·grace 유무 구분이 spec 6곳과 코드 사이에서 line-level 로 일치하며, 게이트가 CRITICAL 로 경고했던 "§4.1 구현 표 배치가 코드 상태와 어긋날 위험"도 실제로 recordAudit 3건이 구현돼 해소됐다. 명명 비대칭(`chat_channel_*` 접두 누락)과 `15-chat-channel.md` 의 규약 위반 예시 문구도 이번 PR 에서 함께 정정됐다. 유일한 실질 갭은 `rotateBotToken` 의 신규 감사 호출에 대한 테스트가 전무하다는 점(WARNING) — 코드는 맞지만 이 PR 자신이 선언한 "전수 커버리지" 의도와 실제 테스트 커버리지가 어긋나 회귀 방어가 비어 있다. `data-flow/1-audit.md` 의 "8개 위치" 문구 stale 은 이 PR 이전부터 있던 낮은 우선순위 결함으로 INFO 로만 남긴다.

## 위험도

LOW

STATUS: DONE — 발견 CRITICAL 0, WARNING 1, INFO 1. 산출물 review/code/2026/08/11/12_22_23/requirement.md
