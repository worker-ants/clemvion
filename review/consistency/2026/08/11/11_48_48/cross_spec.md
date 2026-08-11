# Cross-Spec 일관성 검토 — trigger 회전/폐기 감사 액션 3종 추가 (착수 전 게이트)

## 조사 방법 요약

`spec/5-system/1-auth.md §4.1` 에 아직 추가되지 않은 "trigger 회전/폐기 3종" 이 정확히 무엇을 가리키는지부터 실측했다.
현재 `codebase/backend/src/modules/triggers/triggers.service.ts` 에는 audit 기록이 없는 3개 메서드가 존재하며, 이들이
각각 명세상 회전(2) + 폐기/revoke(1) 행위와 정확히 대응한다:

| 메서드 | 엔드포인트 | 요구사항 ID | audit 기록 여부(실측) |
|---|---|---|---|
| `rotateBotToken` | `POST /api/triggers/:id/chat-channel/rotate-bot-token` | CCH-SE-04 | 없음 (`this.recordAudit` 호출부 미존재) |
| `rotateNotificationSecret` | `POST /api/triggers/:id/notification/rotate-secret` | EIA-NX-12 | 없음 |
| `revokePerTriggerToken` | `POST /api/triggers/:id/interaction/revoke-token` | EIA-AU-07 | 없음 |

세 메서드 모두 `TriggersService` 내부에 있고, 기존 `trigger.created/updated/deleted` 를 기록하는 `recordAudit` 헬퍼는
`resourceType: TRIGGER_RESOURCE_TYPE` 을 **고정**하고 `action: AuditActionFor<typeof TRIGGER_RESOURCE_TYPE>` 로 타입
강제한다(`triggers.service.ts` 줄 205-224) — 즉 신규 액션은 구조적으로 `trigger.*` 네임스페이스에만 들어갈 수 있다.

이 실측을 토대로 아래 발견사항을 정리했다.

---

## 발견사항

### 1. [CRITICAL] "구현된 액션" 표에 잘못 배치되면 §4.1 자신의 정의·code SoT 와 즉시 모순

- **target 위치**: `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표 — 트리거 카테고리 행(신규 3개 verb 추가 예정 자리)
- **충돌 대상**:
  - `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 헤더 주석 — "SoT: spec/5-system/1-auth.md §4.1 '구현된 액션' 표" 라고 스스로 선언
  - `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateBotToken`/`rotateNotificationSecret`/`revokePerTriggerToken` 3개 메서드 전부 `recordAudit`/`auditLogsService.record` 호출 없음(실측)
  - `spec/data-flow/1-audit.md §1.1` Writer 표 — "이 표가 현재 코드에서 **실제로 기록되는** action 의 SoT" 라고 명시, 신규 3종 미등재
- **상세**: §4.1 은 "현재 구현된 액션" 표와 "Planned(미구현)" 표를 엄격히 분리하고, Planned 표 서두에 "spec 이 기록 의도를 선언했으나 아직 코드가 `AuditLogsService.record` 를 호출하지 않는다" 고 정의한다. 실측상 3개 메서드는 이 정의에 정확히 해당한다(코드 미호출). 이 상태에서 신규 액션을 "구현" 표에 넣으면 (a) §4.1 자신의 카테고리 정의와 모순, (b) `audit-action.const.ts` 가 선언한 SoT 관계상 코드 const 도 즉시 동기화돼야 하는데 안 됨, (c) `data-flow/1-audit.md` Writer 표(ground truth)와 불일치 — 세 자리가 동시에 어긋나는 전형적 재drift다.
- **제안**: (A) 이번 작업 범위에 `recordAudit` 3개 호출 추가 + `AUDIT_ACTIONS` const 확장을 포함시켜 "구현" 표·Writer 표·const 를 한 커밋에서 동기화하거나, (B) 코드 wiring 이 후속이면 §4.1 "Planned" 표 + `audit-actions.md §3` 에 우선 등재하고, 실제 구현 시점에 §4.1 이 이미 쓰고 있는 "2026-08-01 — 이 표에 있던 13개 액션이 구현·병합됐다" 식 승격 각주 패턴을 재사용한다.

### 2. [CRITICAL] `conventions/audit-actions.md §3` 레지스트리의 `trigger` 행이 신규 verb 를 반영하지 않으면 즉시 stale

- **target 위치**: §4.1 트리거 카테고리 행에 신규 verb 3개 추가
- **충돌 대상**: `spec/conventions/audit-actions.md §3` — `| trigger | 과거분사 (§2.1) | created, updated, deleted | 구현 |`
- **상세**: 이 레지스트리는 "도메인별 분류 레지스트리" 단일 SoT 로, §4.1 카탈로그와 1:1 대응해야 한다는 것이 문서 자신의 Rationale("왜 시제를 한 규약으로 묶는가")에 명시된 설계 목적이다 — 과거 `workspace.transfer_ownership` 이 이 표 밖에 방치됐던 사례가 바로 이 문서를 만든 계기였다. §4.1 에만 추가하고 §3 을 갱신하지 않으면 그 사례가 그대로 재발한다.
- **제안**: `trigger` 행의 액션 목록에 신규 verb 3개를 추가하고, §4.1 과 동일한 "구현/Planned" 상태를 유지한다(위 발견사항 1 참고).

### 3. [CRITICAL] `chat-channel.md §5.4.1` 에 이미 박혀 있는 예시 액션명이 명명 규약·resource 모델을 이중 위반

- **target 위치**: `spec/5-system/15-chat-channel.md §5.4.1` 줄 378 (PATCH 차단 정당화 문단)
- **충돌 대상**:
  - `spec/conventions/audit-actions.md §1` — "토큰 구분자는 **언더스코어**. 하이픈·camelCase 는 쓰지 않는다"
  - `codebase/backend/src/modules/triggers/triggers.service.ts` `recordAudit` — `resourceType` 고정 `'trigger'`, `action: AuditActionFor<'trigger'>` (chat_channel 은 애초에 별도 resource 로 성립 불가)
  - `spec/conventions/audit-actions.md §3` 레지스트리 — `chat_channel` 행 자체가 없음
- **상세**: chat-channel.md §5.4.1 은 "PATCH 로 직접 `botTokenRef` 교체 시 ... audit log 가 `trigger.updated` 와 `chat-channel.rotate-bot-token` 으로 mixed" 라고 서술한다. 이 표기를 문자 그대로 신규 액션명으로 채택하면 (i) resource 가 `chat_channel` 인데 실제 코드 경로(`TriggersService.recordAudit`)는 `trigger.*` 로만 기록 가능해 타입이 안 맞고, (ii) 하이픈 구분자(`rotate-bot-token`)가 §1 규약 위반이다. `recordAudit` 는 `details.type`(webhook/schedule/chat_channel) 필드를 이미 이 구분 용도로 갖고 있으므로, 올바른 형태는 `trigger.<과거분사>` + `details.type='chat_channel'` 조합이다.
- **제안**: chat-channel.md §5.4.1 의 해당 문장을 확정될 `trigger.*` 액션명으로 정정하고, §4.1 확정 후 cross-link 를 건다. (참고: 레지스트리에 이미 `integration.rotated` 과거분사 전례가 있어, `trigger.bot_token_rotated` 류의 §2.1 패턴이 자연스럽다.)

### 4. [WARNING] `data-flow/1-audit.md §1.1` Writer 표 미갱신 + 이미 stale 인 "8개 위치" 서두 산문

- **target 위치**: §4.1 신규 카탈로그 항목(구현 시점)
- **충돌 대상**: `spec/data-flow/1-audit.md §1.1` Writer 표 + 서두 "`AuditLogsService.record` 의 실제 호출자는 **8개 위치(5개 service 모듈 + 3개 auth/user controller)** 다"
- **상세**: 신규 3종이 구현되면 `triggers/triggers.service.ts` writer 아래 3행이 추가돼야 한다(모듈 자체는 이미 표에 있으므로 모듈 수는 안 늘지만 action 행이 는다). 별개로, 이 서두 "8개 위치" 문구는 **이미 stale** 하다 — 실측 결과 표에 등장하는 distinct writer 모듈은 12개다(integrations/workspaces/workspace-invitations/executions/auth-configs 5개 서비스 + users/auth/webauthn 3개 controller + workflows/triggers/schedules/model-config 4개 서비스). 2026-08-01 워크플로우·트리거·스케줄·모델설정 CRUD 감사가 구현될 때 이 산문이 갱신되지 않은 것으로 보인다. 이번 작업이 같은 표를 다시 건드리므로, 방치하면 동일 패턴이 세 번째로 남는다.
- **제안**: Writer 표에 3행 추가 + 서두 카운트 문구를 실제 값으로 정정(혹은 산문을 제거하고 표만 SoT로 유지).

### 5. [WARNING] `2-navigation/2-trigger-list.md` 회전/폐기 엔드포인트 행에 감사 액션 cross-link 부재

- **target 위치**: `spec/2-navigation/2-trigger-list.md` 줄 156-158 (`rotate-bot-token` / `rotate-secret` / `revoke-token` 3행)
- **충돌 대상**: 같은 문서 줄 182("... audit log 의 `trigger.deleted` action 항목으로 기록된다") · 줄 252("활성/비활성 전환도 `trigger.updated` 로 기록한다") — 트리거 CRUD 엔드포인트는 이미 이런 cross-link 선례가 있다.
- **상세**: 3개 회전/폐기 엔드포인트 행에는 현재 감사 관련 언급이 전혀 없다. §4.1 에 신규 액션이 추가돼도 이 문서만 봐서는 "이 엔드포인트가 어떤 액션으로 기록되는지" 알 수 없는 국지적 비대칭이 남는다.
- **제안**: 3행에 신규 액션명 cross-link 추가(§4.1 확정 후).

### 6. [WARNING] `5-system/14-external-interaction-api.md` 요구사항 행(EIA-NX-12/EIA-AU-07)에 감사 요건 미기재

- **target 위치**: `spec/5-system/14-external-interaction-api.md` 줄 65(EIA-NX-12) · 줄 95(EIA-AU-07) · §7.1/§7.3
- **충돌 대상**: §4.1 신규 카탈로그
- **상세**: 두 요구사항 행 모두 rotate/revoke 동작만 서술하고 audit 기록 요건이 없다. §4.1 이 이 엔드포인트들을 감사 대상으로 확정하면, EIA 문서 단독으로는 그 의무를 알 수 없는 상태로 남는다(요구사항 카탈로그와 감사 카탈로그가 별도 문서에서 각자 완결되지 않음).
- **제안**: EIA-NX-12/EIA-AU-07 행에 "성공 시 audit_log 기록(action=…)" 한 줄 + cross-link 추가.

### 7. [INFO] 인접 data-flow 문서 2건도 동일 패턴 — 오케스트레이터 지정 3파일 밖이지만 companion 후보

- **target 위치**: `spec/data-flow/14-chat-channel.md §1.3`(bot token 라이프사이클) · `spec/data-flow/15-external-interaction.md`(secret rotation / revoke-token 파이프라인)
- **충돌 대상**: `spec/data-flow/12-workspace.md` 의 "Audit 도메인 cross-ref" 절 — 다른 도메인 data-flow 문서는 관례적으로 자신이 적재하는 audit_log 액션을 명시 cross-ref 한다.
- **상세**: 두 문서는 회전/revoke 파이프라인(secret 생성 → grace → cron 승격 등)을 상세히 서술하지만 audit_log 기록 단계는 전혀 등장하지 않는다. 오케스트레이터가 지정한 3파일(trigger-list/chat-channel/EIA) 밖이지만, "회전 엔드포인트 서술"을 담은 실질적 인접 문서라 이번 검토에서 함께 세었다 — 방치하면 같은 재drift 패턴이 여기서도 재현된다.
- **제안**: 두 문서에 audit_log 기록 단계 + 신규 action 명 cross-ref 추가(구현 시점).

### 8. [INFO] 신규 verb 후보와 기존 명명 전례 정합성 — 참고용, 충돌 아님

- **target 위치**: §4.1/§3 신규 verb 확정 시
- **상세**: 레지스트리에 이미 `integration.rotated`(과거분사, §2.1)가 "회전"을 나타내는 전례로 존재한다. 신규 3종이 §2.1 과거분사 패턴(`bot_token_rotated`/`notification_secret_rotated`/`interaction_token_revoked` 류)을 따르면 트리거 행의 기존 패턴(created/updated/deleted)과 자연스럽게 정합한다.

---

## 요약

"trigger 회전/폐기 3종"은 실측 결과 `TriggersService.rotateBotToken`(CCH-SE-04) · `rotateNotificationSecret`(EIA-NX-12) · `revokePerTriggerToken`(EIA-AU-07) 3개 메서드에 대응하며, 셋 다 현재 audit_log 를 전혀 쓰지 않는다. §4.1 카탈로그 추가 자체는 `trigger` 리소스의 기존 과거분사 명명 패턴과 무리 없이 어울리지만, (1) "구현" vs "Planned" 배치를 실제 코드 wiring 여부와 맞추지 않으면 `audit-action.const.ts`(자신이 §4.1 을 SoT 로 선언) · `data-flow/1-audit.md §1.1` Writer 표와 즉시 모순되고, (2) `chat-channel.md §5.4.1` 에 이미 박혀 있는 예시 액션명(`chat-channel.rotate-bot-token`)을 그대로 채택하면 하이픈 구분자·비-trigger resource 라는 이중 명명 규약 위반이 발생한다. 오케스트레이터가 지정한 세 자리(`audit-actions.md §3`, `data-flow/1-audit.md §1.1`, `trigger-list.md`/`chat-channel.md`/`external-interaction-api.md`) 외에 EIA 요구사항 행(EIA-NX-12/AU-07)과 data-flow 문서 2건(14-chat-channel/15-external-interaction)까지 포함해 **총 7곳**의 companion 갱신이 필요하다. 이 게이트를 통과하려면 카탈로그 배치를 코드 상태와 정합시키고, 액션명을 `trigger.*` + 언더스코어 규약으로 확정한 뒤 위 자리를 동일 작업 범위에서 함께 갱신해야 한다.

## 위험도

HIGH
