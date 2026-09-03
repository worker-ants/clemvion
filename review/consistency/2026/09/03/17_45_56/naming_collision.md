# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 검토 범위 확인

- **spec 델타(`spec/5-system/`)**: 0개 파일 — 이 브랜치는 해당 spec 영역을 변경하지 않았다. spec 쪽에서 신규로 부여되는 요구사항 ID·엔티티명·endpoint·이벤트명·ENV·파일 경로는 없다.
- **구현 diff**: 13개 파일 / 396줄 (`origin/main...HEAD -- codebase/`), 아래 파일들로 구성됨을 워킹트리에서 직접 확인(`git diff --stat origin/main...HEAD -- codebase/`):
  - `modules/executions/entities/execution.entity.ts`
  - `modules/hooks/hooks.service.spec.ts`
  - `modules/knowledge-base/entities/knowledge-base.entity.ts`
  - `modules/node-executions/entities/node-execution.entity.ts`
  - `modules/nodes/entities/node.entity.ts`
  - `modules/notifications/entities/notification.entity.ts`
  - `modules/schedules/entities/schedule.entity.ts`
  - `modules/schedules/schedule-runner.service.spec.ts`
  - `modules/triggers/entities/trigger.entity.ts`
  - `modules/users/entities/user.entity.ts`
  - `modules/workflows/entities/workflow.entity.ts`
  - `shared/utils/redact-stored-error.ts`
  - `shared/utils/redact-stored-error.spec.ts`

각 diff 를 전수로 직접 열람한 결과, 변경 내용은 예외 없이 다음 두 패턴 중 하나다.

1. 기존 TypeORM `@Column(... nullable: true ...)` 필드의 **TypeScript 타입만** `X` → `X | null` 로 넓힘 (DB 스키마는 이미 `nullable: true` 였고, 타입 선언이 그것을 반영하지 않고 있던 갭을 메움). 예: `Execution.triggerId`, `Notification.resourceType/resourceId/emailSentAt`, `Trigger.endpointPath/lastTriggeredAt`, `User.avatarUrl/oauthProvider/oauthProviderId`, `Node.description/container/toolOwner`, `Workflow.description/folder`, `Schedule.lastRunAt`, `NodeExecution.finishedAt/durationMs/outputData/error/interactionData`.
2. 일부 `@Column` 데코레이터에 이미 존재하던 컬럼에 **명시적 `type: 'varchar' | 'int'`** 옵션을 추가(암묵적 타입 추론에 의존하던 것을 명시화). 컬럼명·필드명 변경 없음.
3. 테스트 파일에서 `null as unknown as Date` 캐스트를 `null` 로 단순화(테스트 fixture 정리, 신규 식별자 없음).
4. `redact-stored-error.ts` 의 `maskIfPresent` 시그니처가 `Record<string, unknown>` → `Record<string, unknown> | null` 로 넓어짐(기존 함수명 그대로, 반환 타입만 변경) + 관련 rationale 주석 정정.

## 발견사항

없음. 이번 diff 는 신규 엔티티·DTO·인터페이스·API endpoint·webhook/queue/SSE 이벤트명·ENV 변수·config key·spec 파일 경로 중 **어느 것도 새로 도입하지 않는다** — 기존 필드의 TypeScript nullability 표기를 실제 DB 제약(`nullable: true`)과 일치시키는 타입 정합화 배치("entity nullable 배치 2")다. 기존 식별자(컬럼명·필드명·함수명)는 하나도 rename 되지 않았고, 전부 그대로 유지된다. 따라서 "새 식별자가 기존 사용처와 다른 의미로 충돌" 이라는 이 관점의 전제 자체가 성립하지 않는다.

## 요약

이번 변경분은 `spec/5-system/` 자체를 건드리지 않았고(spec 델타 0), 구현 diff 13개 파일도 기존 TypeORM 엔티티 필드의 타입 표기를 DB nullable 제약과 일치시키는 순수 타입 정합화(+ 관련 테스트/유틸 함수 시그니처의 부수 조정)로, 신규 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로) 도입이 전무하다. 신규 식별자 충돌 관점에서 검토할 대상 자체가 없다.

## 위험도

NONE
