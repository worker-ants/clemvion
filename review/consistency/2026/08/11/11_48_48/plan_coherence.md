# Plan 정합성 검토 — 트리거 시크릿/토큰 회전 3종 감사 착수 전 게이트

대상 항목: `plan/in-progress/spec-sync-auth-gaps.md` — "**트리거 시크릿/토큰 회전 3종 감사 —
planner 선행 필요**" (`TriggersService.rotateNotificationSecret` ·
`revokePerTriggerToken` · `rotateBotToken`).

> **번들 주의**: 프롬프트의 folder-dump 에는 `plan/in-progress/spec-sync-auth-gaps.md` 본문이
> 예산 초과로 생략돼 있었다(원본 5,635자). 아래 판정은 `Read` 로 해당 plan 원문 및
> `spec/conventions/audit-actions.md` · `spec/data-flow/1-audit.md` · `spec/5-system/15-chat-channel.md` ·
> `codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.controller.ts}` 를 직접 열어
> 실측한 결과다 — 번들 생략을 근거 부재로 취급하지 않았다.

## 판정 요약 (질의 (a)(b)(c))

**(a) 다른 진행 중 plan 과 충돌 여부 — 충돌 없음.** `TriggersService`·`audit-actions.md`·
`recordAudit` 를 언급하는 in-progress plan 은 `spec-sync-auth-gaps.md` 자신뿐이다(전수 grep).
`backend-lint-gate-broken-on-main.md` 가 `triggers.service.ts` 를 언급하지만 축이 다르다(미타입
반환값 lint, 6건) — 동일 파일을 다른 축으로 건드리는 경우이나, 이는 병렬 작업/브랜치 경합
범주라 본 검토 대상이 아니다(안내문에 명시된 제외 사유).

**(b) 선행 조건("액션명·시제 분류·감사 대상 범위를 새로 정해야 한다") 충족 가능 — 예, 지금
결정 가능.** `conventions/audit-actions.md` §2.1(과거분사 기본) + `integration.rotated` 선례가
이미 정착해 있어 "회전" 계열 verb 를 과거분사로 명명하는 것 자체는 새 taxonomy 신설이 아니라
기존 규약 적용이다. `trigger` resource 는 이미 §2.1(과거분사) 로 등재돼 있어(§3 레지스트리 —
`created`/`updated`/`deleted`), 새 verb 가 부자연스럽지 않은 한(예: `bot_token_rotated` ·
`notification_secret_rotated` · `interaction_token_revoked`) §2.2 로 재분류할 필요도 없다.
평문 시크릿을 `details` 에 남기지 않는다는 원칙도 `1.1.B-6`(`user.email_changed` raw 이메일
미저장) 선례로 이미 확립돼 있다. 즉 "새로 정해야 한다" 는 미해결 항목이지만, 결정에 필요한
규약적 재료는 이미 갖춰져 있어 이번 세션에서 막힘 없이 진행 가능하다. 다만 아래 두 가지는
이번 턴이 함께 처리하지 않으면 재drift 위험이 있다(발견사항 참조).

**(c) 같은 함수(`rotateBotToken`)를 건드리는 다른 plan — `auth-workspace-membership-guard.md`,
단 이미 `plan/complete/`로 이동해 완료됨(더 이상 "진행 중" plan 아님). 충돌 없음.** 그 plan 은
`rotateBotToken` 에 `@Roles('editor')` 를 부착하는 **RBAC(인가)** 결함 수정이었고(2026-08-08
완료, `c435a2aa6` 등), 본 항목은 **감사 로깅** 결정으로 관할이 다르다. 코드 실측
(`triggers.controller.ts:233`)으로 `@Roles('editor')` 부착이 실제로 살아있음을 확인했고, 이는
본 plan 항목의 전제("Editor+ 면 호출 가능한 특권 작업")와 정확히 일치한다 — 두 plan 사이에
모순이 없다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md:378` 이 미확정 액션명을 예시로 이미 박아 뒀다
  - target 위치: `spec/5-system/1-auth.md §4.1`(트리거 액션 카탈로그) — 이번 planner 턴이 편집할 곳
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` "트리거 시크릿/토큰 회전 3종 감사"
  - 상세: `15-chat-channel.md §5.4.1` 의 PATCH 차단 근거 문단이 "audit log 가 `trigger.updated`
    와 **`chat-channel.rotate-bot-token`** 으로 mixed" 라고 서술한다. 이 이름은 (1) resource
    prefix 가 `chat-channel` 인데 실제 구현·audit 카탈로그의 resource 는 `trigger` 이고, (2) verb
    가 하이픈(`rotate-bot-token`)이라 `conventions/audit-actions.md §1` "토큰 구분자는 언더스코어"
    규약과도 다르다. 즉 아직 정식으로 결정되지 않은 액션명이 별개 spec 문서에 **비공식적으로
    선점**돼 있다 — 이번 planner 턴이 `trigger.bot_token_rotated` 류로 확정하면 이 줄이 즉시
    불일치가 된다(같은 사건을 가리키는 두 이름이 spec 안에 공존).
  - 제안: 이번 턴에서 액션명을 확정할 때 `spec/5-system/15-chat-channel.md:378` 을 함께 정정
    대상에 넣는다. 원 plan 항목이 명시한 개정 대상(`1-auth.md §4.1` + `conventions/audit-actions.md`)
    에 이 파일도 추가해야 한다.

- **[WARNING]** `spec/data-flow/1-audit.md §1.1` 커버리지 갭 서술이 이미 stale — plan 개정
  대상 목록에서 빠져 있다
  - target 위치: `spec/5-system/1-auth.md §4.1`
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
  - 상세: `data-flow/1-audit.md:98-100` 는 "남은 갭은 두 가지다: (a) `workflow.executed` …
    (b) `alerts` 모듈" 이라고 **닫힌 목록**으로 서술한다. 그러나 본 plan 항목이 지적하는 트리거
    회전 3종 감사 갭은 이 목록에 없다 — 즉 이 SoT 문서는 이미 실제(3개 갭)보다 좁게 서술 중이다.
    plan 항목은 선행 개정 대상을 "`1-auth.md §4.1` + `conventions/audit-actions.md`" 로만
    명시하는데, 선례("spec SoT 4곳 동기화" 항목, 2026-08-06)를 보면 §4.1 카탈로그를 바꿀 때마다
    `data-flow/1-audit.md §1.1` 의 갭 문단도 동시에 갱신하지 않으면 바로 다음 사이클에 같은
    drift 가 재발했다(그 항목 자체가 이 재발을 막으려 4개 파일을 한 커밋에서 동시에 고친
    사례다).
  - 제안: 이번 planner 턴이 `1-auth.md §4.1` / `conventions/audit-actions.md` 를 개정할 때
    `data-flow/1-audit.md:98-100` "남은 갭은 두 가지" 문구도 세 번째 항목(트리거 회전, Planned
    상태)을 반영하도록 함께 갱신한다.

- **[INFO]** `recordAudit` 는 `userId` 필수 파라미터인데 3개 rotate/revoke 엔드포인트는
  현재 액터 식별을 배선하지 않는다 (구현 턴 참고용, 이번 결정 자체를 막지는 않음)
  - target 위치: (구현 단계 — spec 결정과 별개)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
  - 상세: `triggers.service.ts:212-227` 의 `recordAudit` 는 `userId: string` 을 필수로 받는다.
    반면 `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 의 서비스 시그니처와
    `triggers.controller.ts` 의 세 핸들러(`:192`,`:215`,`:241`) 모두 `@CurrentUser()`류 액터
    파라미터가 없다(`create`/`update`/`remove` 등 기존 audit 호출부와 대조됨, `:229` 참고). 스펙
    결정(액션명·시제·대상범위)에는 영향 없지만, "감사 대상 범위" 결정에 액터 배선 필요성을
    함께 적어두면 후속 developer 턴에서 놓치지 않는다.
  - 제안: 이번 plan 항목의 후속 체크리스트(구현 단계)에 "controller 3곳 userId 배선 추가"를
    명시적으로 남긴다.

## 요약

착수 게이트로서 이 항목은 **진행해도 안전**하다 — 다른 in-progress plan 과 결정 충돌이 없고
(전수 grep 확인), `rotateBotToken` 을 건드리는 유일한 관련 plan(`auth-workspace-membership-guard.md`)
은 이미 완료돼 관할이 겹치지 않는 RBAC 결정만 남겼으며, "액션명·시제 분류·감사 대상 범위"
선행 조건은 기존 `conventions/audit-actions.md` taxonomy(과거분사 기본 + `integration.rotated`
선례)로 이번 세션 안에 결정 가능하다. 다만 사전 정합성 점검에서 두 가지 실질적 갭을 발견했다 —
① `spec/5-system/15-chat-channel.md:378` 이 규약에 어긋나는 액션명을 비공식적으로 이미 인용하고
있어 이번 결정과 충돌할 것이고, ② `spec/data-flow/1-audit.md §1.1` 의 "남은 갭은 두 가지"
서술이 이미 stale 인데 plan 이 명시한 개정 대상 파일 목록에 빠져 있다. 두 파일 모두 이번
planner 턴의 개정 범위에 포함시키지 않으면 완료 직후 다시 drift 가 재발한다(이 plan 자신의
"spec SoT 4곳 동기화" 항목이 정확히 같은 실패 패턴의 재발 방지 목적으로 만들어졌다).

## 위험도

LOW
