---
id: "CLE-OBS-AUDIT-CATALOG"
title: "감사 로그 — 감사 액션 카탈로그"
type: "design"
version: 2
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-OBS-AUDIT"
ancestors: ["CLE-VISION", "CLE-OBS", "CLE-OBS-AUDIT"]
area: "CLE-OBS"
content_hash: "8c598ddc0a5a0781614507b9a038cb65f735710078aba55eb420ad008c3d3b40"
read_as: "approved_fallback"
task: "CLE-T-Q6E11N"
source_paths: ["spec/5-system/1-auth.md", "spec/conventions/audit-actions.md", "spec/data-flow/1-audit.md"]
mirror_sha256: "2ee124fc699ca2e6cc97d03f441aceed08ff6761150cd185bc7bb7de9f404afb"
etag: "sha256-695dfe5f8ebe8f04b7fad00596dd67a947f14bd8e270fdd93263e1465f8b0678"
---
> 구현 상태: 부분 구현(`workflow.executed` 미구현, `alerts` 모듈 커버리지 갭) · 상위: [감사 로그](CLE-OBS-AUDIT.md) · 원문: `spec/5-system/1-auth.md` (§4), `spec/data-flow/1-audit.md`, `spec/conventions/audit-actions.md` (§3) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 [감사 로그](CLE-OBS-AUDIT.md) 의 하위 문서로 감사 액션 카탈로그와 카탈로그에 딸린 기록 규칙을 정한다. 기록 계약과 워크스페이스 귀속은 [감사 로그 — 기록과 조회](CLE-OBS-AUDIT-RECORD.md) 에 있다. 기록 위치 경로는 `codebase/backend/src/modules/` 아래 경로다.

## 감사 액션 카탈로그

아래 표가 감사 액션의 단일 목록이다. 구현의 기준은 코드의 `AUDIT_ACTIONS` union 이다. 이 표는 그 union 과 기록 위치를 함께 적는다. 새 감사 액션을 더하면 union 과 이 표를 같이 고친다. 이름 규칙은 [감사 action 명명](CLE-OBS-AUDITNAME.md) 을 따른다.

| 감사 액션 | `resource_type` | 기록 위치 | 기록하는 동작과 `details` | 상태 |
| --- | --- | --- | --- | --- |
| `integration.created` | integration | `integrations/integrations.service.ts` | 통합 생성 | 구현됨 |
| `integration.updated` | integration | 〃 | 통합 수정 | 구현됨 |
| `integration.deleted` | integration | 〃 | 통합 삭제. 멤버가 나가거나 제거되면서 그 사람의 개인 통합을 함께 지우면 나가기·제거 트랜잭션이 커밋된 뒤 `member.removed` 다음에 지운 통합마다 한 행씩 남긴다. 기록은 포트 `MEMBER_PERSONAL_INTEGRATIONS_PURGER` 의 커밋 뒤 처리에서 일반 삭제와 같은 `finishIntegrationDeletion` 을 불러 남긴다([통합 데이터와 흐름 「멤버가 나가거나 제거될 때」](../CLE-INT/CLE-INT-DATA.md#멤버가-나가거나-제거될-때)). 행위자는 나가기면 나간 멤버, 제거면 제거한 관리자다. `details` 에는 `member.removed` 와 같은 `mode`(`'left'` 또는 `'removed'`)와 `memberUserId` 를 싣는다([통합 관리](../CLE-INT/CLE-INT-MANAGE.md#감사-로그)). 일반 삭제의 행에는 두 키가 없다 | 구현됨 |
| `integration.rotated` | integration | 〃 | 자격 증명 교체 | 구현됨 |
| `integration.scope_changed` | integration | 〃 | 공개 범위(`Integration.scope`) 전환. personal ↔ organization. `details.from`·`to` | 구현됨 |
| `integration.reauthorized` | integration | 〃 | 통합 재인증. OAuth 제공자가 없는 통합의 reset 경로에서만 남는다(`details.mode='reset'`). OAuth 통합 재인증은 `oauth/begin` 에 위임하므로 시작과 콜백 어디에서도 남지 않는다(커버리지 갭, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md)) | 부분 구현 |
| `workspace.transfer_ownership` | workspace | `workspaces/workspaces.service.ts` | 소유자 이양 | 구현됨 |
| `workspace.created` | workspace | 〃 | 팀 워크스페이스 생성(`createTeam`) | 구현됨 |
| `workspace.updated` | workspace | 〃 | 이름·설정 변경(`renameWorkspace`, `updateWorkspaceSettings`). `details.field` | 구현됨 |
| `member.invited` | member | 〃 | 이메일로 직접 추가(`addMemberByEmail`). `details.mode='direct_add'` | 구현됨 |
| `member.invited` | member | `workspaces/workspace-invitations.service.ts` | 초대 발급(`invite`). `details.mode='invitation'`. 이메일 주소는 개인정보라 저장하지 않는다 | 구현됨 |
| `member.role_changed` | member | `workspaces/workspaces.service.ts` | 역할 변경(`updateMemberRole`). `details.from`·`to` | 구현됨 |
| `member.removed` | member | 〃 | 멤버 제거와 스스로 나가기(`removeMember`, `leaveWorkspace`). `details.mode='removed'` 또는 `'left'`, `details.memberUserId`(나가거나 제거된 멤버) | 구현됨 |
| `execution.re_run` | execution | `executions/executions.service.ts` | 재실행. `details` 에 `originalExecutionId`·`chainId`·`dryRun`·`inputModified`([재실행](../CLE-EXEC/CLE-EXEC-RERUN.md)) | 구현됨 |
| `auth_config.create` | auth_config | `auth-configs/auth-configs.service.ts` | 인증 설정 생성 | 구현됨 |
| `auth_config.update` | auth_config | 〃 | 인증 설정 수정 | 구현됨 |
| `auth_config.delete` | auth_config | 〃 | 인증 설정 삭제 | 구현됨 |
| `auth_config.regenerate` | auth_config | 〃 | 키·토큰 재발급 | 구현됨 |
| `auth_config.reveal` | auth_config | 〃 | 평문 보기. 비밀번호 재확인 뒤에만 된다([외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md)) | 구현됨 |
| `user.password_changed` | user | `users/users.controller.ts` | 로그인한 세션의 비밀번호 변경(`POST /users/me/change-password`) | 구현됨 |
| `user.email_changed` | user | 〃 | 이메일 변경 확인(`POST /users/me/email-change/verify`). `details` 에 이메일 주소를 싣지 않는다([가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md)) | 구현됨 |
| `user.2fa_enabled` | user | `auth/auth.controller.ts` | TOTP 켜기(`POST /auth/2fa/verify`). `details.method='totp'` | 구현됨 |
| `user.2fa_disabled` | user | 〃 | TOTP 끄기(`POST /auth/2fa/disable`). `details.method='totp'` | 구현됨 |
| `user.2fa_enabled` | user | `auth/webauthn/webauthn.controller.ts` | WebAuthn 등록(`POST …/webauthn/register/verify`). `details.method='webauthn'`·`credentialId`·`firstCredential` | 구현됨 |
| `user.2fa_disabled` | user | 〃 | WebAuthn 삭제(`POST …/webauthn/credentials/:id/delete`). `details.method='webauthn'`·`credentialId`·`remainingCredentials` | 구현됨 |
| `workflow.created` | workflow | `workflows/workflows.service.ts` | 워크플로우 생성 | 구현됨 |
| `workflow.updated` | workflow | 〃 | 워크플로우 수정 | 구현됨 |
| `workflow.deleted` | workflow | 〃 | 워크플로우 삭제 | 구현됨 |
| `workflow.executed` | workflow | 없음 | 워크플로우 실행. 보존 정책 결정 뒤로 미룬다(아래 Rationale) | 미구현 |
| `trigger.created` | trigger | `triggers/triggers.service.ts` | 트리거 생성. `details.type`(트리거 종류). 그 요청이 일회성 평문을 발급했으면 `details.issuedSecrets` 에 발급한 비밀의 종류 이름 배열을 싣는다. 값은 `notificationSigningSecret` 과 `interactionToken` 이고 발급한 것만 이 순서로 싣는다. 평문은 싣지 않는다. 발급하지 않았으면 키가 없다 | 구현됨 |
| `trigger.updated` | trigger | 〃 | 트리거 수정. 켜기·끄기도 이 감사 액션이다(토글 전용 동사가 없다). `details.type`. 그 요청이 일회성 평문을 발급했으면 `details.issuedSecrets` 를 싣는다(`trigger.created` 와 같다) | 구현됨 |
| `trigger.deleted` | trigger | 〃 | 트리거 삭제 | 구현됨 |
| `trigger.notification_secret_rotated` | trigger | 〃 | 알림 서명 시크릿 교체. 24시간 유예(`notificationSecretV2`). 새 시크릿을 응답에 한 번 평문으로 싣는다([EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)) | 구현됨 |
| `trigger.chat_channel_bot_token_rotated` | trigger | 〃 | 봇 토큰 재발급. 24시간 유예(`chatChannelTokenV2`). 새 토큰은 호출자가 입력하므로 응답에 싣지 않는다([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)) | 구현됨 |
| `trigger.interaction_token_revoked` | trigger | 〃 | 트리거 단위 토큰 재발급. 새 요청에 대해 이전 토큰을 곧바로 무효로 하고 그 토큰으로 연 SSE 스트림을 닫는다(유예 없음). 새 토큰을 응답에 한 번 평문으로 싣는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)) | 구현됨 |
| `schedule.created` | schedule | `schedules/schedules.service.ts` | 스케줄 생성 | 구현됨 |
| `schedule.updated` | schedule | 〃 | 스케줄 수정 | 구현됨 |
| `schedule.deleted` | schedule | 〃 | 스케줄 삭제 | 구현됨 |
| `model_config.create` | model_config | `model-config/model-config.service.ts` | 모델 설정 생성 | 구현됨 |
| `model_config.update` | model_config | 〃 | 모델 설정 수정 | 구현됨 |
| `model_config.delete` | model_config | 〃 | 모델 설정 삭제 | 구현됨 |
| `model_config.set_default` | model_config | 〃 | 워크스페이스 기본 모델 지정 | 구현됨 |

카탈로그에 딸린 규칙과 사실:

- 워크스페이스·멤버 감사 액션은 결정4(B, 2026-07-07)로 구현됐다. 워크플로우·트리거·스케줄·모델 설정 CRUD 는 2026-08-01, 트리거 시크릿·토큰 세 감사 액션은 2026-08-11 에 구현됐다.
- **`workspace.deleted` 는 남기지 않는다.** 결정4 는 워크스페이스 CRUD 전체의 감사를 의도했다. 그런데 `audit_log.workspace_id` 가 `REFERENCES workspace(id) ON DELETE CASCADE`(V001)다. 삭제 전에 남기면 삭제와 함께 cascade 로 지워지고 삭제 뒤에 남기면 FK 위반이 난다. 그래서 `AUDIT_ACTIONS` 에 두지 않는다. 삭제 이력을 남기려면 워크스페이스에 묶이지 않은 별도 저장소가 필요하고 이는 범위 밖이다. 근거 원본은 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 의 Rationale 이다.
- **짝 리소스는 호출된 엔드포인트 쪽만 남긴다.** 트리거의 켜기·끄기와 스케줄의 활성 상태는 서로를 동기화한다. `SchedulesService` 가 짝 트리거를 만들고 지운다. `TriggersService` 의 `syncScheduleActivation` 이 짝 스케줄의 `isActive` 를 바꾼다. 이때 상대 리소스의 감사 액션은 남기지 않는다. 사용자가 한 행위는 하나(스케줄 생성, 트리거 끄기)인데 양쪽을 다 남기면 같은 조작이 두 행으로 보여 "누가 트리거를 따로 건드렸나" 를 되묻게 된다. 짝 행의 변화는 호출된 감사 액션의 부수 효과로 읽는다. 멤버가 나가거나 제거될 때 남는 `member.removed` 한 행과 `integration.deleted` 여러 행은 이 규칙의 대상이 아니다. 지운 개인 통합은 멤버십과 서로의 행을 맞추는 짝 리소스가 아니고 그 요청으로 실제로 지워진 리소스라서 통합마다 남긴다([Rationale](#나가기와-제거가-지운-개인-통합은-통합마다-한-행씩-남긴다-2026-10-29)).
- **트리거 시크릿·토큰 교체는 CRUD 와 다른 축이다.** 편집자 이상이 부를 수 있는 특권 작업이고 실행하면 기존 자격 증명이 무효가 된다. 무효가 되는 대상은 감사 액션마다 다르다. 계정 탈취 뒤의 조용한 교체를 `audit_log` 만으로 재구성할 수 있어야 해서 기록한다. 세 감사 액션으로 나눈 근거는 [감사 action 명명](CLE-OBS-AUDITNAME.md) 에 있다. 트리거 생성 · 수정 요청이 첫 알림 서명 시크릿이나 트리거 단위 토큰을 발급하는 일에는 전용 감사 액션을 두지 않는다. 그 요청의 `trigger.created` · `trigger.updated` 행이 `details.issuedSecrets` 로 발급을 표시한다([Rationale](#첫-발급-표시는-생성과-수정-기록에-싣는다)).
- **Telegram 인바운드 서명의 서버 재발급에는 전용 감사 액션이 없다.** Telegram 어댑터는 `setupChannel()` 이 불릴 때마다 `secret_token` 을 새로 만들어 등록한다. 서버는 그 값을 다시 저장한다([채팅 채널 「인바운드 서명 자료 변경」](../CLE-CHAT/CLE-CHAT-CORE.md#인바운드-서명-자료-변경)). 이 재발급은 사용자가 고른 자격 증명 교체가 아니라 프로바이더 등록의 일부라서 위 세 교체 감사 액션의 대상이 아니다. 재발급을 일으킨 요청의 감사 액션(`trigger.created`, `trigger.updated`, `trigger.chat_channel_bot_token_rotated`)이 그 기록을 겸한다. 감사 로그 조회에서 서명 재발급만 따로 거를 수는 없다(알려진 한계, [Rationale](#telegram-서버-발급-서명에-전용-감사-액션을-두지-않는다)).
- **모델 설정 레거시 행**: 모델 설정 통합(2026-08-01) 전에 `llm_config.*`·`rerank_config.*` 로 남은 행은 append-only 로 보존하고 다시 쓰지 않는다. 모델 설정 감사를 조회할 때는 두 집합(`model_config.*` 또는 `llm_config.*`·`rerank_config.*`)을 OR 로 묶는다.
- **남은 커버리지 갭**: `workflow.executed` 외에 알림 규칙 CRUD 를 맡는 `alerts` 모듈이 감사 로그를 남기지 않는다(`AuditLogsService` 를 가져다 쓰지 않는다). 알림 규칙 평가가 알림을 보낼 때도 감사 행은 없다([알림](CLE-OBS-NOTIFY.md)).

## 구현 위치

- `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`AUDIT_ACTIONS`, 감사 액션 union 의 기준)
- 각 감사 액션의 기록 위치는 위 카탈로그 표의 기록 위치 열에 적은 서비스와 컨트롤러다.

## Rationale

### 감사 액션 카탈로그를 한 표로 합친다

예전에는 세 문서(인증 명세의 감사 절, 감사 데이터 흐름 문서, 명명 규약 문서)가 감사 액션 목록을 따로 들고 각자 기준이라고 적었다. 감사 액션을 하나 더할 때마다 세 곳을 고쳐야 했고 실제로 어긋났다. 이제 목록은 이 카탈로그 한 곳에만 두고 명명 규약은 [감사 action 명명](CLE-OBS-AUDITNAME.md) 이 맡는다. 구현의 기준은 여전히 코드의 `AUDIT_ACTIONS` union 이다.

기록 위치도 한정해서 적는다. 예전에는 감사 로그를 "모든 도메인 서비스가 부르는 공통 관심사" 로 적었다. 실제로 기록하는 곳은 카탈로그에 적은 서비스와 컨트롤러뿐이라 그 서술은 버렸다.

### `workflow.executed` 를 보존 정책 결정 뒤로 미룬다

`workflow.executed` 는 다른 감사 액션과 빈도가 다르다. CRUD 는 드물지만 `executed` 는 트리거와 웹훅이 발동할 때마다 쌓인다. 그런데 `audit_log` 은 보존 정책이 정해지지 않았고 정리 배치도 없다([보존](CLE-OBS-AUDIT.md#보존)). 로그인 이력에 보존 배치가 있는 것과 대비된다. 무제한 테이블에 고빈도 감사 액션을 넣는 일은 보존 정책 결정과 묶어야 해서 따로 떼어 미뤘다.

이 유예 원칙의 축은 특권성이 아니라 "빈도 × 보존 정책 미정" 이다. 그래서 트리거 시크릿·토큰 교체에는 적용하지 않는다. 교체와 재발급은 드문 특권 작업이고 같은 이유로 `integration.rotated`·`auth_config.regenerate` 가 이미 구현돼 있다.

### Telegram 서버 발급 서명에 전용 감사 액션을 두지 않는다

NERV Task `CLE-T-W11BQ9` 에서 정했다.

기각한 대안은 전용 감사 액션이다. [감사 action 명명](CLE-OBS-AUDITNAME.md) 은 무엇이 교체됐는지 `details` 를 열어야 알 수 있는 액션을 피한다. 그 원칙은 사용자가 고른 자격 증명 교체를 대상으로 한다. 이 재발급은 사용자가 고른 교체가 아니고 프로바이더 등록에 딸린 결과다. 회전 주체와 PATCH 비밀을 나누는 기준은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) R-CC-21 의 「세 축」 이다. 재발급을 일으킨 요청의 감사 액션이 이미 남으므로 같은 사건을 두 번 적게 된다. 대가는 조회 필터로 서명 재발급만 고를 수 없다는 점이다.

### 첫 발급 표시는 생성과 수정 기록에 싣는다

2026-10-17 에 NERV Task `CLE-T-EMB0YG` 에서 정했다(사용자 결정). 트리거 생성과 수정(PATCH)은 첫 알림 서명 시크릿과 트리거 단위 토큰(`itk_*`)을 발급하고 그 평문을 응답에 한 번 싣는다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 4). 이 발급은 감사 로그에서 구분되지 않았고 일반 `trigger.created` · `trigger.updated` 행만 남았다. 이제 그 행의 `details.issuedSecrets` 에 발급한 비밀의 종류 이름을 싣는다. 평문은 싣지 않는다. 발급하지 않은 요청에는 이 키가 없다. 그래서 키가 있는지만 보고 발급한 요청을 고를 수 있다. 이 행의 감사 액션은 생성이나 수정이다. `details.issuedSecrets` 는 그 행에 붙는 보조 표시일 뿐이다. 그래서 무엇이 교체됐는지 `details` 를 열어야 알 수 있는 액션을 피한다는 [감사 action 명명](CLE-OBS-AUDITNAME.md) 의 원칙과 어긋나지 않는다.

기각한 대안:

- **전용 감사 액션을 둔다**(예: `trigger.notification_secret_issued`). 한 요청이 생성이나 수정 행과 발급 행 두 줄로 남는다. 같은 사건을 두 번 적는다는 점에서 위 Telegram 결정과 같은 이유로 택하지 않았다. 첫 발급은 기존 자격 증명을 무효로 하지 않으므로 교체 감사 액션과도 성격이 다르다.
- **표시하지 않는다.** 계정을 탈취한 사람이 트리거를 만들거나 고쳐 비밀을 받아 간 일을 `audit_log` 만으로 재구성할 수 없다. 교체를 기록하는 이유(카탈로그 규칙의 「트리거 시크릿·토큰 교체는 CRUD 와 다른 축이다」)와 같은 요구다.

시크릿 교체(`rotate-secret`)와 트리거 단위 토큰 재발급(`revoke-token`)은 지금처럼 각자의 감사 액션을 쓴다. 두 동작은 기존 자격 증명을 무효로 한다.

### 나가기와 제거가 지운 개인 통합은 통합마다 한 행씩 남긴다 (2026-10-29)

멤버가 나가거나 제거되면 그 사람의 개인 통합도 함께 지운다. 2026-10-29 에 사용자가 정했다(NERV Task `CLE-T-TGZGM9`, [통합 관리](../CLE-INT/CLE-INT-MANAGE.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)). 감사 로그는 `member.removed` 한 행 다음에 지운 통합마다 `integration.deleted` 한 행을 남긴다. 기록 형식은 [통합 관리 「감사 로그」](../CLE-INT/CLE-INT-MANAGE.md#감사-로그) 가 정한다. 이 절은 짝 리소스 규칙과 이 문서의 선례에 견준 근거를 적는다.

- **짝 리소스 규칙의 대상이 아니다.** 트리거와 스케줄은 서로의 행을 맞추는 짝이라 상대 행의 변화는 호출된 감사 액션의 부수 효과다. 지운 개인 통합은 멤버십과 짝이 아니고 그 요청으로 실제로 사라진 리소스다.
- **«같은 사건을 두 번 적지 않는다» 선례와도 다르다.** [Telegram 서버 발급 서명](#telegram-서버-발급-서명에-전용-감사-액션을-두지-않는다) 과 [첫 발급 표시](#첫-발급-표시는-생성과-수정-기록에-싣는다) 에서 기각한 전용 감사 액션은 같은 트리거에 대한 한 요청을 두 줄로 적는 안이었다. 여기서는 리소스가 다르다. 멤버십이 끝난 것과 통합이 지워진 것은 각자의 리소스 이력에 남아야 한다. 통합의 이력(`resource_type='integration'`, `resource_id`)을 조회하는 사람은 그 통합이 언제 누구의 요청으로 지워졌는지 봐야 한다.
- **비교한 안: 지운 통합 목록을 `member.removed` 의 `details` 에 싣는다.** 2026-10-30 에 견줘 택하지 않았다(NERV Task `CLE-T-395HK2`). 통합의 리소스 이력으로 조회하면 그 삭제가 나오지 않는다. 한 멤버가 가진 개인 통합 수에 상한이 없어 `details` 크기도 정해지지 않는다. 일반 삭제와 같은 마무리(`finishIntegrationDeletion`)를 쓰지 못해 통합 삭제 기록이 두 형식으로 갈린다.
- **대가**: 요청 하나가 여러 행으로 남는다. 같은 요청의 행은 행위자와 `details.mode` · `details.memberUserId` 로 묶어 본다. 두 키는 `member.removed` 와 같은 값이다.

감사 행은 나가기·제거 트랜잭션이 커밋된 뒤에 남긴다. 그래서 그 트랜잭션이 롤백되면 `member.removed` 와 `integration.deleted` 둘 다 남지 않는다.
