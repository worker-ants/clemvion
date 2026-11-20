/**
 * 감사 로그 `action` 식별자 — 현재 구현된 action 의 단일 SoT.
 *
 * 이름 규칙(`<resource>.<verb>`, 도메인별 시제)은 [감사 action 명명](CLE-OBS-AUDITNAME),
 * 액션마다 무엇을 언제 남기는지 · `details` · 의도적으로 남기지 않는 것은
 * [감사 액션 카탈로그](CLE-OBS-AUDIT-CATALOG) 가 정한다. 새 action 은 이 const 에 더한 뒤
 * 쓴다(인라인 문자열 금지). `AuditLogsService.record({ action })` 가 `AuditAction` 합집합으로,
 * 서비스별 `recordAudit` 헬퍼는 `AuditActionFor<리소스>` 로 강제한다.
 *
 * 카탈로그 결정 가운데 코드만 보고는 놓치기 쉬운 것:
 * - `workspace.deleted` 는 남기지 않는다. `audit_log.workspace_id` 가 워크스페이스 삭제에
 *   CASCADE 로 함께 지워져 행이 남을 수 없다.
 * - 1:1 로 묶인 `schedule` · `trigger` 는 호출된 엔드포인트의 리소스만 남긴다.
 * - `workflow.executed` 와 캔버스 저장은 남기지 않는다. 실행은 `execution` 행이, 저장은
 *   `workflow_version` 스냅샷이 실행자 · 저장자와 시각을 남긴다. 워크플로우 쪽에서 더 남기는
 *   것은 버전 복원(`workflow.version_restored`) 하나다.
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
  WORKFLOW_VERSION_RESTORED: 'workflow.version_restored',
  TRIGGER_CREATED: 'trigger.created',
  TRIGGER_UPDATED: 'trigger.updated',
  TRIGGER_DELETED: 'trigger.deleted',
  // 시크릿/토큰 회전·폐기 — CRUD 와 별개 축이다. Editor+ 가 부를 수 있는 특권 작업이고,
  // 실행되면 **기존 자격증명이 무효화된다**(대상은 액션마다 다르다 — 아웃바운드 수신자 /
  // 봇 세션 / 그 트리거로 열린 외부 대화 전부). 계정 탈취 후의 조용한 교체를 `audit_log`
  // 만으로 재구성할 수 있어야 한다.
  //
  // 셋으로 가른 근거(폭발 반경이 서로 다르다)와 액션명이 sub-channel 을 담는 이유는
  // [감사 action 명명](CLE-OBS-AUDITNAME) Rationale 에 있다.
  //
  // `notification_secret_rotated` · `interaction_token_revoked` 만 응답에 새 자격증명을 한 번
  // 평문으로 싣는다. `chat_channel_bot_token_rotated` 는 새 토큰이 호출자 입력이라 응답에 없다.
  TRIGGER_NOTIFICATION_SECRET_ROTATED: 'trigger.notification_secret_rotated',
  TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED:
    'trigger.chat_channel_bot_token_rotated',
  // `revoked` 인 것은 의도다 — 나머지 둘은 24h grace 로 구·신 자격증명이 공존하지만
  // per_trigger 토큰 재발급은 **이전 토큰을 즉시 무효화**한다(유예 컬럼 없음).
  TRIGGER_INTERACTION_TOKEN_REVOKED: 'trigger.interaction_token_revoked',
  SCHEDULE_CREATED: 'schedule.created',
  SCHEDULE_UPDATED: 'schedule.updated',
  SCHEDULE_DELETED: 'schedule.deleted',
  MODEL_CONFIG_CREATE: 'model_config.create',
  MODEL_CONFIG_UPDATE: 'model_config.update',
  MODEL_CONFIG_DELETE: 'model_config.delete',
  MODEL_CONFIG_SET_DEFAULT: 'model_config.set_default',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * 특정 resource prefix 에 속한 action 만 뽑는다 — `AuditActionFor<'workflow'>` 는
 * `'workflow.created' | 'workflow.updated' | 'workflow.deleted' | 'workflow.version_restored'`
 * 로 좁혀진다.
 *
 * 각 서비스의 `recordAudit` 헬퍼는 `resourceType` 을 자기 리소스로 **고정**해 놓고 `action` 만
 * 인자로 받는다. 그런데 `action` 을 전체 `AuditAction` 합집합으로 받으면 `WorkflowsService` 에
 * `'trigger.deleted'` 를 넘겨도 컴파일이 통과해, `resourceType='workflow'` 인데 action 은
 * trigger 인 **모순된 감사 행**이 만들어진다. prefix 로 좁혀 그 조합을 타입에서 배제한다.
 * (7차 리뷰 architecture — 정합성이 주석으로만 보장되던 것을 타입으로 옮겼다.)
 */
export type AuditActionFor<P extends string> = Extract<
  AuditAction,
  `${P}.${string}`
>;

/**
 * `AuditActionFor` 가 **실제로 좁히는지** 를 빌드가 검증하는 가드.
 *
 * 서비스 4곳이 이 타입을 쓰지만, 그것만으로는 **넓어지는** 회귀를 못 잡는다 — 더 넓은 타입은
 * 좁은 값을 그대로 받아들여 전부 통과하기 때문이다. 아래는 그 반대 방향을 고정한다:
 * 다른 도메인 액션이 `AuditActionFor<'workflow'>` 에 들어오면 `_NoCrossDomain` 이 `never` 가
 * 되고, `never` 타입 변수에 `true` 를 대입할 수 없어 **컴파일이 깨진다**.
 *
 * 이 파일에 두는 이유: `tsconfig.build.json` 의 exclude 가 spec 파일을 걸러내므로, spec 에 둔
 * 타입 단언은 `nest build` 가 검사하지 않아 장식이 된다. 소스 파일이라야 TEST WORKFLOW 의
 * build 단계가 실제로 검증한다. (8차 리뷰 testing INFO — 수작업 1회성 `tsc` 확인을 상시
 * 빌드 불변식으로 승격.)
 */
type _NoCrossDomain =
  'trigger.created' extends AuditActionFor<'workflow'> ? never : true;
const _auditActionForNarrows: _NoCrossDomain = true;
void _auditActionForNarrows;
