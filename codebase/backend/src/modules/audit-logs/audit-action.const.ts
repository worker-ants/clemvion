/**
 * 감사 로그 `action` 식별자 — 현재 구현된 action 의 단일 SoT.
 *
 * SoT: spec/5-system/1-auth.md §4.1 "구현된 액션" 표.
 *
 * Naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수다. verb 는
 * 도메인 관례를 따른다 (integration 은 발생 사건을 기록하므로 과거분사
 * `created`/`updated`, execution 은 `re_run`, auth_config 은 CRUD 동사 현재형
 * `create`/`update`/`delete`/`regenerate`/`reveal`, user 는 발생 사건이라 과거분사
 * `password_changed`/`2fa_enabled`/`2fa_disabled`). audit 는 "일어난 일" 의 기록이라
 * resource prefix 로 필터·그룹이 가능하면 충분하며, verb 시제는 도메인별로 일관
 * 유지한다. 새 action 은 반드시 본 const 에 추가한 뒤 사용한다 (인라인 문자열 금지)
 * — `AuditLogsService.record({ action })` 가 `AuditAction` union 으로 강제한다.
 *
 * 인증(`user.*`) 액션은 **액터의 현재 세션 `workspaceId`**(인증 요청 JWT 의 workspace)에
 * 귀속한다 — 세 액션 모두 인증 세션에서만 발생하므로 항상 세션 workspace 가 있어
 * `audit_log.workspaceId`(non-nullable)를 schema 변경 없이 충족한다. 기록은 세션
 * 컨텍스트가 있는 controller 경계(`users.controller`·`auth.controller`·`webauthn.controller`)
 * 에서 수행한다 (1-auth §4.1 + §Rationale 4.1.B; data-flow/1-audit.md §1.1).
 *
 * workspace.created/updated 와 member.invited/role_changed/removed 는
 * spec-sync-data-flow-12-workspace-gaps 결정4(B, 2026-07-07)로 구현됐다 —
 * workspaces.service 가 workspace/member CRUD 를, workspace-invitations.service 가
 * member.invited(초대 생성)를 기록한다 (data-flow/1-audit.md §1.1; 1-auth §4.1).
 *
 * **workspace.deleted 는 의도적으로 audit 하지 않는다**: `audit_log.workspace_id` 는
 * `REFERENCES workspace(id) ON DELETE CASCADE` (V001) 라, 워크스페이스 삭제 감사 row 는
 * 삭제와 함께 cascade 제거되어(또는 삭제 후 INSERT 시 FK 위반) 영속될 수 없다. 워크스페이스
 * 범위 audit 모델의 구조적 제약이며, 삭제 이력은 별도 비-scoped 저장소가 필요하다(범위 밖).
 * (data-flow/1-audit.md §1.1 Rationale; 12-workspace §4).
 *
 * workflow/trigger/schedule/model_config 의 **CRUD** 액션은 spec-sync-auth-gaps §4.1 로
 * 구현됐다 (2026-08-01). 시제는 도메인 관례를 따른다 — workflow/trigger/schedule 은 발생
 * 사건이라 과거분사(`created`/`updated`/`deleted`), model_config 은 auth_config 과 같은
 * 설정 CRUD 라 현재형(`create`/`update`/`delete`/`set_default`). `set_default` 가 과거분사로
 * 부자연스러워 resource 단위 현재형으로 통일한 것이 후자의 근거다 (1-auth §Rationale 4.1.A).
 *
 * **`workflow.executed` 는 의도적으로 미구현이다.** spec §4.1 Planned 표에 있으나 나머지
 * 13개와 카디널리티 차원이 다르다 — CRUD 는 저빈도지만 `executed` 는 트리거·webhook 발동마다
 * 쌓인다. 그런데 `audit_log` 은 **보존 정책이 미정이고 pruner 가 없다**(§3 "현재 무제한";
 * `login_history` 는 pruner 가 있는 것과 대비). 무제한 테이블에 고빈도 액션을 넣는 것은 보존
 * 정책 결정과 묶여야 하므로 별도 항목으로 분리했다 (impl-prep consistency 2026/08/01 09_11_58
 * INFO 6 이 같은 결론).
 */
export const AUDIT_ACTIONS = {
  INTEGRATION_CREATED: 'integration.created',
  INTEGRATION_UPDATED: 'integration.updated',
  INTEGRATION_DELETED: 'integration.deleted',
  INTEGRATION_ROTATED: 'integration.rotated',
  INTEGRATION_SCOPE_CHANGED: 'integration.scope_changed',
  INTEGRATION_REAUTHORIZED: 'integration.reauthorized',
  WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership',
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  MEMBER_INVITED: 'member.invited',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  EXECUTION_RE_RUN: 'execution.re_run',
  AUTH_CONFIG_CREATE: 'auth_config.create',
  AUTH_CONFIG_UPDATE: 'auth_config.update',
  AUTH_CONFIG_DELETE: 'auth_config.delete',
  AUTH_CONFIG_REGENERATE: 'auth_config.regenerate',
  AUTH_CONFIG_REVEAL: 'auth_config.reveal',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_2FA_ENABLED: 'user.2fa_enabled',
  USER_2FA_DISABLED: 'user.2fa_disabled',
  USER_EMAIL_CHANGED: 'user.email_changed',
  WORKFLOW_CREATED: 'workflow.created',
  WORKFLOW_UPDATED: 'workflow.updated',
  WORKFLOW_DELETED: 'workflow.deleted',
  TRIGGER_CREATED: 'trigger.created',
  TRIGGER_UPDATED: 'trigger.updated',
  TRIGGER_DELETED: 'trigger.deleted',
  SCHEDULE_CREATED: 'schedule.created',
  SCHEDULE_UPDATED: 'schedule.updated',
  SCHEDULE_DELETED: 'schedule.deleted',
  MODEL_CONFIG_CREATE: 'model_config.create',
  MODEL_CONFIG_UPDATE: 'model_config.update',
  MODEL_CONFIG_DELETE: 'model_config.delete',
  MODEL_CONFIG_SET_DEFAULT: 'model_config.set_default',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
