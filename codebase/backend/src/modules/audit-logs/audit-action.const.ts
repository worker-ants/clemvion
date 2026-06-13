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
 * spec §4.1 의 Planned 액션(workflow.* · trigger.* · schedule.* · member.* ·
 * model_config.* · workspace.created/updated/deleted)은 미구현이라 본 const 에 없다 —
 * 구현 시 추가한다 (data-flow/1-audit.md §1.1 목표 커버리지; 명칭은 1-auth §4.1 +
 * §Rationale 4.1.A 확정 표기).
 */
export const AUDIT_ACTIONS = {
  INTEGRATION_CREATED: 'integration.created',
  INTEGRATION_UPDATED: 'integration.updated',
  INTEGRATION_DELETED: 'integration.deleted',
  INTEGRATION_ROTATED: 'integration.rotated',
  INTEGRATION_SCOPE_CHANGED: 'integration.scope_changed',
  INTEGRATION_REAUTHORIZED: 'integration.reauthorized',
  WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership',
  EXECUTION_RE_RUN: 'execution.re_run',
  AUTH_CONFIG_CREATE: 'auth_config.create',
  AUTH_CONFIG_UPDATE: 'auth_config.update',
  AUTH_CONFIG_DELETE: 'auth_config.delete',
  AUTH_CONFIG_REGENERATE: 'auth_config.regenerate',
  AUTH_CONFIG_REVEAL: 'auth_config.reveal',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_2FA_ENABLED: 'user.2fa_enabled',
  USER_2FA_DISABLED: 'user.2fa_disabled',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
