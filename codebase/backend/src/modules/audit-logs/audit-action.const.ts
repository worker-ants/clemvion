/**
 * 감사 로그 `action` 식별자 — 현재 구현된 action 의 단일 SoT.
 *
 * SoT: spec/5-system/1-auth.md §4.1 "구현된 액션" 표.
 *
 * Naming 규약: `<resource>.<verb>` — resource dot-prefix 가 필수다. verb 는
 * 도메인 관례를 따른다 (integration 은 발생 사건을 기록하므로 과거분사
 * `created`/`updated`, execution 은 `re_run`). audit 는 "일어난 일" 의 기록이라
 * resource prefix 로 필터·그룹이 가능하면 충분하며, verb 시제는 도메인별로 일관
 * 유지한다. 새 action 은 반드시 본 const 에 추가한 뒤 사용한다 (인라인 문자열 금지)
 * — `AuditLogsService.record({ action })` 가 `AuditAction` union 으로 강제한다.
 *
 * spec §4.1 의 Planned 액션(workflow.* · trigger.* · schedule.* · member.* ·
 * llm_config.* · rerank_config.* · password_change · 2fa_*)은 미구현이라 본
 * const 에 없다 — 구현 시 추가한다 (data-flow/1-audit.md §1.1 목표 커버리지).
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
  AUTH_CONFIG_REVEAL: 'auth_config.reveal',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
