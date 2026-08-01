# Architecture Review — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 기록)

## 발견사항

- **[WARNING]** `WorkflowsService.importWorkflow()` 가 감사 기록을 남기지 않는다 — 동일 "생성" 계열 경로(`create`/`duplicate`)와의 크로스컷팅 커버리지 불일치
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:451` (메서드 시작) ~ `:576` (트랜잭션 반환, 여기서 `recordAudit` 호출 누락)
  - 상세: 같은 파일의 `create()`(:191-227)와 `duplicate()`(:277-405)는 신규 `Workflow` row 생성 뒤 `recordAudit({ action: AUDIT_ACTIONS.WORKFLOW_CREATED, ... })` 를 호출해 감사 로그를 남긴다. 그러나 마찬가지로 새 `Workflow` row 를 만드는 `importWorkflow()`(`POST /api/workflows/import`)는 트랜잭션을 커밋만 하고 `recordAudit` 를 전혀 호출하지 않는다. 컨트롤러는 이미 `userId`(`user.sub`)를 `importWorkflow(workspaceId, userId, dto)` 에 전달하고 있어(`createdBy` 용) — 감사 기록에 필요한 인자는 이미 존재하는데도 누락됐다. 이 PR 이 채택한 "각 서비스 메서드 안에 수동으로 `recordAudit()` 호출을 흩뿌리는" 방식(인터셉터/데코레이터/도메인 이벤트 같은 시스템적 강제 장치 없음)이 정확히 이런 커버리지 구멍을 예측 가능하게 만든다 — 크로스컷팅 관심사가 호출부 규율에만 의존하는 안티패턴의 실제 사례다. `importWorkflow()` 로 만들어진 워크플로우는 이 PR 이 메우려는 "감사 로그 갭"에서 조용히 빠진다.
  - 테스트로도 확인됨: `workflows.service.spec.ts` 의 `importWorkflow` 관련 `describe` 블록(1744, 2033줄)에는 `auditLogs.record` 호출을 단언하는 테스트가 하나도 없다(반면 `create`/`update`/`remove`/`duplicate` 는 각각 전용 `감사 로깅` describe 로 커버됨).
  - 제안: `create()` 패턴(트랜잭션 결과를 변수로 받은 뒤 커밋 밖에서 `recordAudit` 호출)과 동일하게 `importWorkflow()` 끝에 `WORKFLOW_CREATED` 감사 기록을 추가한다. 근본적으로는 "모든 상태변경 서비스 메서드는 반드시 감사 기록을 남긴다"는 불변식을 컴파일타임/테스트타임에 강제할 방법(예: 인터셉터+라우트 메타데이터, 또는 커버리지를 검증하는 공용 가드 테스트)을 검토할 가치가 있다.

- **[WARNING]** `TriggersService.update()` — 실패 가능한 외부 호출(`syncScheduleActivation` 내부의 BullMQ `registerJob`/`removeJob`)이 감사 기록보다 먼저 실행돼, 바로 위 주석이 명시한 "커밋 직후 기록" 불변식을 이 경로에서만 어긴다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:338-340` (`syncScheduleActivation` 호출) → `:341-350` (`recordAudit` 호출, 그 직전 주석이 "아래 secret 마이그레이션·chatChannel setup 은 실패할 수 있는 외부 호출이라 그 뒤로 미루면 감사가 안 남는다"고 명시)
  - 상세: `update()` 는 `saved = await this.triggerRepository.save(trigger)`(:333) 로 커밋한 뒤, `trigger.type === 'schedule'` 이면 `syncScheduleActivation(saved, rest.isActive)`(:338-340) 를 먼저 호출하고, 그다음에야 `recordAudit(...TRIGGER_UPDATED...)`(:344-350) 를 호출한다. 그런데 `syncScheduleActivation` 내부(:827-847)는 `scheduleRepository.save` 뒤 `scheduleRunner.registerJob`/`removeJob` 을 호출한다 — 이는 `normalizeNotificationSecretRef`/`setupChatChannel` 과 동급의 "실패할 수 있는 외부 호출"이다. `scheduleRunner.registerJob` 이 throw 하면 예외가 `update()` 밖으로 전파되어 `recordAudit` 에 도달하지 못한다: trigger row 는 이미 갱신·커밋됐고 schedule row 의 `isActive` 도 이미 저장됐는데, 감사 로그는 남지 않는다 — 바로 그 주석이 막으려던 "리뷰 W6" 버그 클래스가 이 한 경로에서 재발한다. 자매 메서드인 `SchedulesService.update()`(schedules.service.ts:242-259)는 반대로 BullMQ `registerJob`/`removeJob` 을 `recordAudit` **뒤**에 두어 이 불변식을 올바르게 지킨다 — 대칭이 깨졌다.
  - 제안: `syncScheduleActivation(saved, rest.isActive)` 호출을 `recordAudit` 호출 뒤로 옮긴다(다른 후속 호출들이 그 결과에 의존하지 않으므로 안전). 또는 `syncScheduleActivation` 내부 BullMQ 호출만 감사 뒤로 미루도록 재구성한다.

- **[WARNING]** `recordAudit` private 헬퍼가 5개 서비스에 거의 동일한 형태로 중복 구현됨 — DRY 위반, 추출 후보
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239-254`, `codebase/backend/src/modules/schedules/schedules.service.ts:141-154`, `codebase/backend/src/modules/triggers/triggers.service.ts:209-224`, `codebase/backend/src/modules/workflows/workflows.service.ts:174-189`, (기존 선례) `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:78-` 부근
  - 상세: 각 서비스가 `<RESOURCE>_RESOURCE_TYPE` 모듈 상수 + `private recordAudit(params): Promise<void> { return this.auditLogsService.record({ ...params, resourceType: <상수> }) }` 형태를 개별적으로 재구현한다. 이번 PR 로 이 패턴이 4곳 더 늘어 총 5곳이 됐다 — "rule of three" 를 넘겼다. 각 구현은 작지만(15~20줄) 구조가 사실상 동일해, 신규 필드 추가(예: `ipAddress` 전달)나 정책 변경(예: 실패 시 재시도) 시 5곳을 손으로 동기화해야 한다.
  - 제안: 공용 팩토리(`function createAuditRecorder(auditLogsService, resourceType) { return (params) => auditLogsService.record({ ...params, resourceType }); }`)나 protected 베이스 클래스로 추출해 각 서비스는 `resourceType` 만 주입하도록 단순화한다.

- **[INFO]** `recordAudit` 의 `action` 파라미터 타입이 해당 리소스 자신의 액션으로 좁혀지지 않고 전체 `AuditAction` 유니온을 그대로 받는다 — named-params 설계 의도(스왑 방지)를 부분적으로만 충족
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242` / `schedules.service.ts:144` / `triggers.service.ts:212` / `workflows.service.ts:177` — 모두 `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]`
  - 상세: 각 `recordAudit` 는 `resourceType` 을 모듈 상수로 고정하면서도 `action` 은 `AUDIT_ACTIONS` 전체(예: `'workspace.transfer_ownership'`, `'user.password_changed'` 등 무관한 액션 포함)를 허용한다. 즉 `TriggersService.recordAudit({ action: AUDIT_ACTIONS.WORKFLOW_CREATED, ... })` 같은 호출도 컴파일러가 막지 못한다. 각 서비스 주석이 "positional 이면 컴파일러가 스왑을 못 잡는다"며 named-params 를 채택한 근거를 설명하는데, 정작 `action`↔`resourceType` 불일치는 같은 타입 시스템으로 방어되지 않는다. 현재 실제 호출부는 전부 올바르므로 활성 버그는 아니지만, 향후 복붙 실수에 열려 있다.
  - 제안: 모듈별 액션 서브셋으로 타입을 좁힌다(예: `Extract<AuditAction, \`model_config.${string}\`>` 또는 `(typeof MODEL_CONFIG 관련 키만 모은 서브 객체)[...]`).

## 긍정적으로 확인된 사항

- **순환 의존성 없음**: `AuditLogsModule` 은 `TypeOrmModule.forFeature([AuditLog])` 만 import 하는 leaf/유틸리티 모듈이라(다른 feature 모듈을 참조하지 않음), 이번에 `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈에 새로 import 돼도 순환을 만들지 않는다. 4개 모듈 diff 모두 `AuditLogsModule` 을 자기 `imports` 배열에 정확히 추가했다(각 `<X>.module.ts`).
- **레이어 책임 분리 양호**: 컨트롤러가 `@CurrentUser('sub') userId` 로 액터를 추출해 서비스에 원시 `string` 으로 전달하는 패턴이 4개 컨트롤러 모두 일관적이다 — 서비스는 `Request`/JWT 인프라에 의존하지 않아 프레임워크 독립적으로 유지된다(테스트 용이성도 함께 확보).
- **감사 기록 실패가 주 트랜잭션을 깨지 않음**: `AuditLogsService.record()` 자체가 try/catch + `logger.warn` 로 감싸져 있어(audit-logs.service.ts:81-96), 감사 로깅이라는 부수 관심사의 실패가 CRUD 본 동작을 절대 막지 않는다 — best-effort 부수효과와 핵심 트랜잭션의 경계가 명확하다.
- **커밋 후 기록 원칙이 대부분 경로에서 일관 적용**: `model-config`/`schedules`/`workflows` 의 create/update/remove/duplicate/setDefault 전 경로에서 "DB 커밋 → 감사 기록 → (있다면) 실패 가능한 외부 호출" 순서가 정확히 지켜진다(위 WARNING 의 trigger update 경로 예외 제외).

## 요약

이번 변경은 기존 `auth-configs.service.ts` 의 `recordAudit` 선례를 model-config/schedules/triggers/workflows 4개 모듈에 동일한 형태로 확장하는 크로스컷팅 관심사 도입이다. 모듈 경계(`AuditLogsModule` 을 leaf 모듈로 각 모듈이 명시적으로 import)와 레이어 분리(컨트롤러가 userId 추출, 서비스는 원시 타입만 수신)는 견고하고, 순환 의존성도 없다. 다만 "각 서비스 메서드에 수동으로 호출을 흩뿌리는" 구현 방식 자체의 구조적 약점이 실제로 두 군데서 드러났다 — `WorkflowsService.importWorkflow()` 의 감사 기록 완전 누락(형제 경로 `create`/`duplicate` 는 남김)과 `TriggersService.update()` 에서 실패 가능한 BullMQ 호출이 감사 기록보다 먼저 실행되는 순서 역전이다. 둘 다 이 PR 이 명시적으로 세운 "커밋 후 기록" 불변식이 시스템적으로 강제되지 않고 호출부 규율에만 의존하기 때문에 생긴 구멍으로, 감사 로그 완전성이라는 이 기능의 목적 자체를 부분적으로 훼손한다. 또한 `recordAudit` 헬퍼가 5개 서비스에 거의 동일하게 중복 구현돼 DRY 관점의 추출 후보가 됐다.

## 위험도
MEDIUM
