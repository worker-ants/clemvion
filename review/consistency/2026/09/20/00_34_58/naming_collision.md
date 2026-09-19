# 신규 식별자 충돌 검토 — `spec/2-navigation/`

## 검토 범위에 대한 사전 확인

- `git status --short spec/2-navigation/` = 깨끗함(무변경). 이번 --impl-prep 은 plan
  `plan/in-progress/column-guard-gaps.md`(컬럼 층 가드 테스트 빈칸 — `spec_impact: none`) 기준인데,
  이 plan 은 `spec/2-navigation/` 어떤 파일도 건드리지 않는다. 즉 이번 실행에서 `spec/2-navigation/`
  이 **새로 도입하는 식별자는 없다** — 폴더 전체가 이미 main 에 merge 되어 있는 기존 spec 이다.
  최근 관련 커밋은 `19d9dedca`(웹훅 endpoint 예약, `2-trigger-list.md` 2줄만 갱신)이 마지막이다.
- 위 사실을 근거로 "target 이 새로 부여하는 ID/타입/endpoint" 관점에서는 원칙적으로 대상이 없다.
  다만 판정을 근거 없이 내리지 않기 위해, bundle 에 온전히 실린 세 파일
  (`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`)이 참조하는 식별자들을 실제
  저장소 전수 grep 으로 교차검증했다 (프롬프트의 "관련 spec 본문" 코퍼스는 예산 초과로 대부분
  절단되어 있었음).

## 교차검증한 식별자와 결과

| 식별자 | target 내 위치 | 교차검증 결과 |
|---|---|---|
| `NAV-WF-07` | `1-workflow-list.md` Rationale §1 | `_product-overview.md:54` 에서 정의된 동일 요구사항 ID 를 정확히 인용. 충돌 없음 |
| `WebhookEndpointReservation` / `webhook_endpoint_reservation` | `2-trigger-list.md` §2.3.1 `endpointPath` 행 | `1-data-model.md §2.8.1`, `data-flow/10-triggers.md` 와 동일 개념·동일 명명. 충돌 없음 |
| `TRIGGER_ENDPOINT_PATH_CONFLICT` | `2-trigger-list.md` §2.3.1 / §3 | `1-data-model.md`, `5-system/2-api-convention.md`, `5-system/3-error-handling.md` 전부 같은 의미로 일관. 충돌 없음 |
| `POST /api/workflows/:id/duplicate` | `1-workflow-list.md` §3 | `data-flow/11-workflow.md:137` 이 동일 endpoint 를 상세 정의 — 같은 계약의 상호 참조. 충돌 없음 |
| `Folder` 엔티티 / `(workspace_id, parent_id, name)` UNIQUE | `1-workflow-list.md` §3.1 | knowledge-base 쪽(`5-knowledge-base.md`, `data-flow/6-knowledge-base.md`)에 동명 "폴더" 개념이 있는지 확인 — 없음. Folder 는 워크플로우 폴더 단일 의미. 충돌 없음 |
| `rateLimitPerMinute` / `languageHints` / `uiMapping.*` | `2-trigger-list.md` §2.3.1 Chat Channel 카드 | `5-system/15-chat-channel.md`, `conventions/chat-channel-adapter.md`, `data-flow/14-chat-channel.md`, provider 문서(`telegram/slack/discord.md`) 전체와 동일 스키마·동일 의미로 일관. 충돌 없음 |
| `trigger.chat_channel_bot_token_rotated` / `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` / `trigger.updated` / `trigger.deleted` | `2-trigger-list.md` §3 audit 언급 | `data-flow/1-audit.md:93-97`, `5-system/1-auth.md:430-431` 과 정확히 동일한 액션명·의미. 충돌 없음 |
| `NEXT_PUBLIC_WEBHOOK_BASE_URL` | `2-trigger-list.md` §2.4 | `5-system/12-webhook.md`, `7-channel-web-chat/5-admin-console.md`, 실제 `codebase/frontend/.env.example` · `webhook-url.ts` 와 동일 용도로 일관. 충돌 없음 |
| Rationale 로컬 ID (`R-1`~`R-17`, `2-trigger-list.md`) | 해당 파일 자체 | 다른 spec 파일들은 각자 다른 접두사(`R-CC-*`)로 로컬 스코프를 분리해 두어 파일 간 `R-N` 재사용이 실제 혼동으로 이어지지 않는 것을 확인 — 오히려 의도된 관례로 보인다 |

## 발견사항

없음 — 이번 검토 범위에서 target 이 실제로 새로 도입하는 식별자가 없고, target 이 참조·재확인하는
기존 식별자들도 코퍼스 전체와 의미가 일치했다.

## 요약

이번 --impl-prep 실행의 scope 로 지정된 `spec/2-navigation/` 은 대상 plan(`column-guard-gaps`,
`spec_impact: none`)이 건드리지 않는 이미 merge 된 안정 spec 이라, "신규 식별자" 자체가 없다.
프롬프트 코퍼스가 예산 절단으로 비어 있었기 때문에 저장소를 직접 grep 해 요구사항 ID · 엔티티명 ·
API endpoint · 이벤트/audit 액션명 · ENV 변수 · Chat Channel 필드명 등 target 이 인용하는 주요
식별자들을 교차검증했고, 전부 단일 의미로 일관되게 사용되고 있음을 확인했다. 신규 식별자 충돌
관점에서 차단 사유는 없다.

## 위험도

NONE
