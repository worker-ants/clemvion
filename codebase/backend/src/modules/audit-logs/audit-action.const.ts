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
 * **1:1 결합 리소스는 주(主) 리소스만 기록한다.** `Schedule` 과 `Trigger` 는 서로의 row 를
 * 직접 쓴다 — `SchedulesService` 가 짝 `Trigger` 를 만들고/지우고, `TriggersService` 의
 * `syncScheduleActivation` 이 짝 `Schedule.isActive` 를 바꾼다. 이때 **상대 리소스의 액션은
 * 남기지 않는다**: 사용자가 한 행위는 하나(스케줄 생성 / 트리거 비활성화)인데 양쪽을 다 남기면
 * 같은 조작이 감사에 2행으로 보여 "누가 트리거를 따로 건드렸나" 를 되묻게 만든다. 감사는 **호출된
 * 엔드포인트의 리소스** 기준이며, 짝 row 의 변화는 그 액션의 부수 효과로 읽는다.
 * (4차 리뷰 W4 — 라운드 사이에 유실됐던 항목이라 여기 명문화한다.)
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
  // 시크릿/토큰 회전·폐기 — CRUD 와 별개 축이다. Editor+ 가 부를 수 있는 특권 작업이고,
  // 실행되면 **기존 자격증명이 무효화된다**(대상은 액션마다 다르다 — 아웃바운드 수신자 /
  // 봇 세션 / 그 트리거로 열린 외부 대화 전부). 계정 탈취 후의 조용한 교체를 `audit_log`
  // 만으로 재구성할 수 있어야 한다.
  //
  // 셋으로 가른 근거(폭발 반경이 서로 다르다)와 액션명이 sub-channel 을 담는 이유는
  // `spec/conventions/audit-actions.md §3` Rationale.
  //
  // *(주의 — `notification_secret_rotated`·`interaction_token_revoked` 만 응답에 새 자격증명을
  // 1회 평문 반환한다. `chat_channel_bot_token_rotated` 는 새 토큰이 **호출자 입력**이라 응답에
  // 안 실린다. 이 주석의 첫 판은 셋 다 반환한다고 적었고
  // 그건 사실이 아니었다 — ai-review `12_22_23` documentation.)*
  TRIGGER_NOTIFICATION_SECRET_ROTATED: 'trigger.notification_secret_rotated',
  TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED: 'trigger.chat_channel_bot_token_rotated',
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
 * `'workflow.created' | 'workflow.updated' | 'workflow.deleted'` 로 좁혀진다.
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
