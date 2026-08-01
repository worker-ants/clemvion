# 아키텍처(Architecture) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config 감사 로깅 커버리지 확장)

## 발견사항

### [WARNING] `WorkflowsService` 의 `workflow.*` 감사 커버리지가 이번 PR 자신이 선언한 범위 안에서도 불완전 — 실제 캔버스 편집 경로가 통째로 빠짐

- 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:451`(`importWorkflow`), `:578`(`saveCanvas`), `:642`(`restoreVersion`) — 세 메서드 모두 `recordAudit` 호출이 없다. 대조: 같은 파일의 `:191`(`create`, `:220`에서 recordAudit), `:229`(`update`, `:245`), `:254`(`remove`, `:257`), `:277`(`duplicate`, `:397`)는 모두 감사된다.
- 상세: `spec/5-system/1-auth.md:433`(목표 커버리지 표)과 `plan/in-progress/spec-sync-auth-gaps.md:15-18`이 약속하는 건 **동사 단위**(`workflow.created`/`workflow.updated`/`workflow.deleted`)이지 특정 엔드포인트 단위가 아니다. 그런데 실제 구현은 "워크플로우 메타데이터(name/description/tags/settings)를 고치는 `PATCH /workflows/:id`" 한 경로만 `workflow.updated` 로 연결했고, 같은 워크플로우 리소스를 갱신하는 나머지 두 쓰기 경로는 빠졌다:
  - `saveCanvas()` (`POST /workflows/:id/save`, `workflows.controller.ts:456`) — 노드/엣지 전체를 교체하는, 캔버스 편집기가 실제로 가장 빈번히 호출하는 쓰기 경로. `manager.save(Workflow, workflow)`(`workflows.service.ts` 내부)로 직접 저장하며 `update()`/`recordAudit` 어느 쪽도 거치지 않는다.
  - `restoreVersion()` (`POST /workflows/:id/versions/:versionId/restore`, `workflows.controller.ts:482`) — `saveCanvas()` 에 위임(`:679` 부근)하므로 같은 사각지대를 그대로 물려받는다.
  - `importWorkflow()` (`POST /workflows/import`, `workflows.controller.ts:530`) — `manager.create(Workflow, …)` 로 새 Workflow 를 직접 만들며 `create()`/`recordAudit` 을 거치지 않는다. `duplicate()`(같은 파일 `:397`)는 정확히 같은 성격("새 workflow 행 생성")인데도 `AUDIT_ACTIONS.WORKFLOW_CREATED` 를 재사용해 감사되므로, `importWorkflow()`만 빠진 것은 일관성 결여다.
  - 테스트로도 이 갭이 문서화돼 있지 않다 — `workflows.service.spec.ts` 에서 `auditLogs.record` 를 단언하는 곳은 `create`(트랜잭션 순서)와 `duplicate` 뿐이고, `saveCanvas`/`restoreVersion`/`importWorkflow` 에 대해 "감사되지 않음을 의도적으로 확인"하는 캐노리도 없다 — 의도된 스코프 축소가 아니라 누락으로 보인다.
  - model-config/schedules/triggers 세 서비스는 각각 create/update/remove(+setDefault) 외에 별도 상태 변경 경로가 없어(grep 으로 `repo.save`/`repo.remove`/`manager.update` 호출부를 전수 대조) 이 문제가 없다 — `WorkflowsService` 에 고유한 갭이다.
- 제안: `saveCanvas()` 트랜잭션 커밋 뒤 `recordAudit({ action: AUDIT_ACTIONS.WORKFLOW_UPDATED, resourceId: id })` 를 추가한다(기존 액션 재사용, 신규 action 불필요 — `update()`와 동일 verb). `importWorkflow()` 는 트랜잭션 커밋 뒤 `AUDIT_ACTIONS.WORKFLOW_CREATED` 를 기록한다(`duplicate()`가 이미 정확히 이 패턴). `restoreVersion()`은 `saveCanvas()`를 통하므로 자동 해결된다. 추가 후 세 경로 각각에 "감사 호출됨"을 단언하는 테스트를 `workflows.service.spec.ts`의 `감사 로깅 (workflow.*)` describe 블록에 추가할 것.

### [WARNING] `recordAudit` private 래퍼가 구조적으로 동일한 형태로 5개 서비스에 손으로 반복 구현됨 — 확장될수록 유지비가 선형 증가

- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:239`, `codebase/backend/src/modules/schedules/schedules.service.ts:141`, `codebase/backend/src/modules/triggers/triggers.service.ts:209`, `codebase/backend/src/modules/workflows/workflows.service.ts:174` (신규 4곳) — 기존 선례 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:78` 까지 포함하면 5곳.
- 상세: 다섯 곳 모두 "`resourceType` 을 고정하고 `AuditLogsService.record()` 로 위임하는 private 메서드"라는 **동일한 shape** 이며, "positional 이면 인자 순서 스왑을 컴파일러가 못 잡는다"는 동일한 근거 주석까지 파일마다 손으로 복제돼 있다(예: `triggers.service.ts:202-208`, `workflows.service.ts:170-173`, `model-config.service.ts:232-238`, `schedules.service.ts:137-140`). `details` 셰이프(kind/type/duplicatedFrom 등)만 도메인마다 다르므로 완전한 함수 하나로 통일하기는 어렵지만, "resourceType 을 bind 하고 record 로 위임"하는 뼈대 자체는 동일하다. `audit-action.const.ts` 자체 주석(`:32-37`)이 "spec §4.1 의 나머지 Planned 액션은 구현 시 추가한다"고 명시하므로, 향후 리소스가 늘 때마다 이 패턴이 6번째, 7번째로 계속 복제될 가능성이 높다. 또한 "왜 named 필드인가"라는 근거 주석이 5곳에 흩어져 있어, 그 근거가 바뀌거나 반례가 발견돼도 5곳을 모두 찾아 고쳐야 하는 drift 위험이 있다.
- 제안: 필수 리팩터링은 아니지만, `AuditLogsService` 에 `scopedRecorder(resourceType: string)` 같은 팩토리를 추가해 "resourceType 고정 + record 위임" 뼈대만 공유하고, 도메인별 `details` 조립은 각 서비스가 계속 맡는 형태를 검토할 만하다. 최소한 지금 상태를 유지한다면, "왜 named 필드인가" 주석을 `AuditLogsService.record` 자체의 JSDoc 한 곳으로 옮기고 각 서비스에서는 참조만 하는 편이 5중 복제보다 낫다.

### [WARNING] `TriggersService.create`/`update` 내부에서 `recordAudit` 호출 자체가 메서드당 2곳으로 중복

- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:271`과 `:281`(`create` 내부 — `chatChannel` 유무에 따라 갈라지는 두 return 경로), `:356`과 `:366`(`update` 내부, 동일 구조).
- 상세: `chatChannel` 이 설정된 경우 재조회한 `refreshed` 로 감사를 남기고 `return`하며, 그렇지 않으면 아래로 흘러 `saved` 로 다시 감사를 남긴다 — 두 블록은 `resourceId`/`type` 의 출처(`refreshed` vs `saved`)만 다를 뿐 완전히 동일한 `recordAudit` 호출 형태를 복붙한 것이다. 이 PR 이전에도 `if (refreshed) return sanitize(refreshed);` 형태의 분기는 있었지만, 이번에 `recordAudit` 호출까지 그 분기 안으로 들어가면서 중복 지점이 늘었다. 향후 `details` 에 필드를 추가하는 변경이 한쪽만 반영되고 다른 쪽을 놓치는 drift 가 실제로 벌어지기 쉬운 모양이다(두 분기는 `chatChannel` 유무에 따라 서로 다른 테스트만 타므로 리뷰/테스트에서도 놓치기 쉽다).
- 제안: `const result = refreshed ?? saved;` 로 단일화한 뒤 `recordAudit`/`sanitizeChatChannelForResponse` 를 각각 한 번씩만 호출하도록 정리하면 중복 지점이 4곳→2곳으로 줄고, 두 메서드의 구조도 더 읽기 쉬워진다.

### [INFO] `AUDIT_ACTIONS` 로부터 이미 export 된 `AuditAction` 타입을 재사용하지 않고 4곳에서 동일 타입식을 재정의

- 위치: `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` — 전부 `action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];` 로 타입을 인라인 재정의.
- 상세: `audit-action.const.ts` 는 정확히 이 표현식을 `export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];` 로 이미 export 한다. 이번 4개 신규 파일이 설계 근거로 직접 인용하는 선례인 `auth-configs.service.ts:79` 는 `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const'` 로 깔끔하게 `AuditAction` 을 재사용한다. 신규 4개 파일은 `AUDIT_ACTIONS` 상수만 import 하고 타입은 다시 풀어 썼다 — 기능적으로 동일해 버그는 아니지만, 스스로 인용한 선례에서 벗어난 사소한 비일관성이다.
- 제안: 4개 파일 모두 `import { AUDIT_ACTIONS, AuditAction } from '../audit-logs/audit-action.const'` 로 바꾸고 `action: AuditAction` 으로 정리.

### [INFO] FK CASCADE 로 연쇄 삭제되는 리소스는 감사 트레일에 흔적이 남지 않음 (Workflow→Trigger, Trigger↔Schedule)

- 위치: `workflows.service.ts:254`(`remove`) — 소속 `Trigger` 들이 `trigger.entity.ts:46`(`@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })`)에 의해 DB 레벨에서 동반 삭제되지만 `trigger.deleted` 는 기록되지 않는다. `triggers.service.ts:859`(`remove`) — `type === 'schedule'` 인 트리거를 지우면(`:864` 분기) `schedule.entity.ts:28`(`@ManyToOne(() => Trigger, { onDelete: 'CASCADE' })`)에 의해 연결된 `Schedule` 행이 함께 사라지지만 `schedule.deleted` 는 없다. 반대 방향인 `schedules.service.ts:260`(`remove`)도 연결 `Trigger` 를 `triggerRepository.delete()` 로 직접 지우면서(같은 메서드 내부) `trigger.deleted` 를 남기지 않는다.
- 상세: "최상위 사용자 액션만 기록하고 부수적 cascade 는 기록하지 않는다"는 흔한 감사 로깅 설계일 수 있어 반드시 결함은 아니다. 다만 이 PR 자체가 삭제 순서(`config.id`/`trigger.type` 을 `remove` 호출 **전에** 읽어두는 등)에 상당한 정밀도를 쏟은 것과 대비해, cascade 로 사라지는 자매 리소스의 감사 여부는 명시적으로 결정된 흔적(주석·spec 언급)이 없다.
- 제안: 지금 동작(루트 액션만 기록)을 유지할 거라면 `audit-action.const.ts` 나 `1-audit.md` 어딘가에 "FK CASCADE 로 사라지는 자매 리소스는 별도로 감사하지 않는다"를 한 줄 명문화해 향후 리뷰에서 재질문되지 않게 하는 편을 권장한다.

### [INFO] Trigger 의 시크릿/토큰 회전 엔드포인트는 감사 범위 밖 — spec 상 의도된 스코프로 보이나 auth_config 의 `regenerate` 와 비대칭

- 위치: `triggers.service.ts:904`(`rotateNotificationSecret`), `:940`(`revokePerTriggerToken`), `:985`(`rotateBotToken`) — 셋 다 `recordAudit` 호출 없음. 대응 엔드포인트는 `triggers.controller.ts:189`, `:212`, `:236`.
- 상세: `spec/5-system/1-auth.md:434` 의 목표 커버리지가 `trigger.created`/`updated`/`deleted` 세 동사만 정의하므로(회전용 동사 없음) 구현이 spec 과 정합적이다. 다만 `auth_config` 계열은 `auth_config.regenerate`(키/토큰 재발급, `1-audit.md:64`)가 이미 감사 대상으로 구현돼 있어, "자격증명 회전은 감사한다"는 선례가 이미 codebase 안에 있다. trigger 의 HMAC secret/interaction token/bot token 회전이 그 선례와 다른 취급을 받는 것이 의도적 스코프 결정인지 우연한 누락인지 PR 안에서는 확인할 수 없다.
- 제안: 이번 PR 스코프(CRUD 4종)를 유지하는 것 자체는 spec 정합이니 문제 아님 — 다만 후속 작업으로 trigger 시크릿 회전 감사가 필요한지 project-planner 확인을 권장(차단 아님).

### [INFO] 컨트롤러 파라미터 관례의 사소한 불일치 (신규 코드가 같은 클래스의 기존 형제 메서드와 다른 스타일 채택)

- 위치: `workflows.controller.ts:158`(`create`, `:160` `@CurrentUser() user: JwtPayload` 뒤 `user.sub` 사용) vs `:181`(`update`, `:185` `@CurrentUser('sub') userId: string` 직접 추출) — 같은 컨트롤러 안에서 두 스타일이 공존. 서비스 시그니처도 `workflows.service.ts:191` `create(workspaceId, userId, dto)`(userId 가 2번째) vs `:229` `update(id, workspaceId, dto, userId)`/`:254` `remove(id, workspaceId, userId)`(userId 가 맨 끝)로 파라미터 순서가 다르다.
- 상세: 둘 다 기능적으로 동일하고 `create`/`duplicate` 는 이 PR 이전부터 있던 기존 코드라 이 PR 의 신규 결함은 아니다. 다만 `recordAudit` 설계 근거로 "동일 타입(string) positional 인자 순서 스왑을 컴파일러가 못 잡는다"는 위험을 명시적으로 의식하면서도(위 WARNING 2 참조), 정작 `create/update/remove` 같은 공개 서비스 메서드 자체는 여전히 `workspaceId`/`userId`/`id` 를 위치 기반 string 파라미터로 받는다 — 같은 클래스 안에서도 그 인자 순서가 메서드마다 다르다. 우연히 `create(workspaceId, userId, …)`  와 `update(id, workspaceId, …, userId)` 를 헷갈려 호출해도 컴파일러가 잡지 못한다.
- 제안: 시급하지 않음. 새 서비스 메서드를 추가할 때는 `recordAudit` 에 적용한 것과 같은 기준(문자열 인자가 3개 이상이면 명명된 옵션 객체 고려)을 CRUD 진입점에도 점진적으로 적용할 가치가 있다는 정도로 참고.

### [INFO] 감사 로깅과 무관한 drive-by 수정 1건이 같은 diff 에 포함됨

- 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:105` — `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], { each: true })` → `@IsIn(NOTIFICATION_EVENT_TYPES, { each: true })`.
- 상세: `as unknown as string[]` 이중 캐스트를 제거한 것 자체는 개선(불필요한 타입 우회 제거)이지만, 감사 로깅 기능과는 무관한 별개 변경이다. 아키텍처적으로 위험하지는 않으나, 이 diff 를 나중에 이력 추적(`git log -S`/`git blame`)할 때 "왜 이 파일이 audit-logging PR 에 포함됐는가"를 헷갈리게 할 수 있다.
- 제안: 차단 사유 아님 — 향후에는 무관 정리성 변경을 별도 커밋/PR 로 분리하는 편을 권장.

## 요약

이번 변경은 이미 `auth-configs.service.ts` 에서 검증된 "resourceType 을 고정한 private `recordAudit` 래퍼 + 트랜잭션 커밋 뒤 기록 + 실패 swallow" 패턴을 model-config/schedules/triggers/workflows 4개 모듈에 동일하게 확장한 것으로, 레이어 책임(얇은 컨트롤러 → 서비스가 `userId` 를 받아 명시적으로 감사)과 모듈 경계(신규로 추가된 `AuditLogsModule` 의존은 4개 모듈 모두 단방향이며 `AuditLogsModule` 자신은 `TypeOrmModule.forFeature` 외 의존이 없는 순수 leaf 모듈이라 순환 참조가 전혀 생기지 않음)가 전반적으로 견고하다. `AuditLogsService.record()` 가 내부적으로 실패를 삼키는 설계여서 감사 기록 실패가 본 트랜잭션을 깨뜨리지 않는 점, `setDefault`/`create`(workflow) 처럼 트랜잭션 커밋 이후에만 기록하도록 순서를 의식적으로 맞춘 점, TypeORM `remove()` 가 엔티티 id 를 지우는 특성을 감안해 삭제 전에 필드를 미리 읽어두는 점 등은 세부 정확도가 높다. 다만 정작 이 기능의 핵심 목적(완전한 변경 이력)이 `WorkflowsService` 에서는 스스로 선언한 범위(`workflow.updated`) 안에서도 가장 빈번한 실제 편집 경로(`saveCanvas`/`restoreVersion`/`importWorkflow`)를 놓쳐 불완전하며, 같은 `recordAudit` 래퍼가 5개 서비스에 거의 동일한 모양으로 손으로 반복 구현되어 있어 향후 감사 대상 리소스가 늘어날수록(spec 이 이미 그 방향을 예고) 유지비가 선형으로 증가하는 확장성 리스크가 있다. FK CASCADE 로 사라지는 자매 리소스(Trigger↔Schedule, Workflow→Trigger)의 감사 공백은 의도된 설계일 가능성이 높지만 문서화돼 있지 않다.

## 위험도

MEDIUM
