# Architecture Review — audit-logging (workflow/trigger/schedule/model_config CRUD)

## 발견사항

- **[INFO]** `recordAudit` private 래퍼 메서드가 4개 서비스에 거의 동일한 형태로 중복 구현됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242-257`, `codebase/backend/src/modules/schedules/schedules.service.ts:144-157`, `codebase/backend/src/modules/triggers/triggers.service.ts:212-227`, `codebase/backend/src/modules/workflows/workflows.service.ts:177-192`
  - 상세: 네 서비스 모두 `{ workspaceId, userId, action: AuditActionFor<P>, resourceId, details? }` 형태의 파라미터를 받아 `auditLogsService.record({ ..., resourceType: <RESOURCE_TYPE 상수> })` 로 위임하는 사실상 동일한 15줄 안팎의 private 메서드를 각자 보유한다. named-params 로 positional swap 을 막는다는 의도(각 파일 주석의 "auth-configs W-1 과 동일 근거")는 타당하지만, 그 자체는 공용 헬퍼로 추출해도 유지할 수 있는 성질이다. 이 패턴이 이미 4개 리소스(model_config/schedule/trigger/workflow)에 적용됐고 auth_config/user/workspace/member/integration 등 기존 리소스에도 유사 패턴이 있어 앞으로도 신규 리소스가 추가될 때마다 같은 보일러플레이트가 반복될 가능성이 높다.
  - 제안: `AuditActionFor<P>` 를 활용하는 제네릭 팩토리(예: `makeResourceAuditRecorder<P extends string>(auditLogsService, resourceType: P)`)를 `audit-logs` 모듈에 추가해, 각 서비스는 생성자에서 `private readonly recordAudit = makeResourceAuditRecorder(this.auditLogsService, 'trigger')` 형태로 1줄 구성만 하도록 리팩터링을 검토할 수 있다. 타입 안전성(리소스별 action prefix 제한)은 그대로 유지된다. 현재 중복 규모가 크지 않아 즉시 조치가 필요한 수준은 아니다.

- **[INFO]** Schedule ↔ Trigger 1:1 페어 리소스에서 서로의 aggregate 를 리포지토리 레벨로 직접 쓰는 기존 결합이 audit 경계 설계에도 그대로 반영됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (`triggerRepository` 직접 주입·생성/삭제, 예: create 메서드 165-173, remove 메서드 271-274), `codebase/backend/src/modules/triggers/triggers.service.ts` (`scheduleRepository` 직접 주입·`syncScheduleActivation`, 839-849)
  - 상세: `SchedulesService` 가 `TriggersService` 를 거치지 않고 `Repository<Trigger>` 를 직접 주입받아 짝 Trigger row 를 생성/삭제하고, 반대로 `TriggersService` 가 `Repository<Schedule>` 를 직접 주입받아 짝 Schedule 의 `isActive` 를 직접 mutate 한다. 모듈 경계(서비스 캡슐화) 관점에서는 두 서비스가 서로의 소유 엔티티를 리포지토리 레벨로 우회 접근하는 형태다. 이번 변경은 이 기존 결합 위에 audit 기록을 얹으면서 "호출된 엔드포인트의 리소스만 기록하고 짝 리소스는 기록하지 않는다"는 규칙을 `audit-action.const.ts` 상단 주석(38-44행)에 명문화했는데, 이는 이미 존재하는 아키텍처 특성을 문서화·정합화한 것이지 새로 도입한 결합은 아니다.
  - 제안: 이번 diff 범위에서 즉시 리팩터링할 사안은 아니다. 다만 향후 두 서비스 중 하나에서 유효성 검증이나 감사 훅이 추가될 때 리포지토리 직접 접근 경로는 그 훅을 우회한다는 점을 인지하고, 장기적으로는 `SchedulesService`/`TriggersService` 가 서로를 공개 메서드로만 호출하도록(예: `TriggersService.syncPairedScheduleActivation()` 노출) 경계를 좁히는 방안을 고려할 수 있다.

- **[INFO]** `TriggersService` 가 audit 기록 책임까지 추가로 흡수하면서 단일 서비스의 책임 범위가 계속 확장됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (전체, 1300+ 줄 — CRUD, chat-channel setup/teardown/rotation, notification secret rotation, per-trigger token 재발급, cron 동기화, 응답 sanitize 를 모두 포함)
  - 상세: 이번 변경으로 `recordAudit`/`AUDIT_ACTIONS.TRIGGER_*` 호출이 `create`/`update`/`remove` 세 지점에 추가됐다. 개별 추가 자체는 작지만, 이미 다중 책임(SRP 관점에서 CRUD + 3개 채널 어댑터 lifecycle + 2종 secret rotation + 응답 DTO sanitize)을 지고 있는 서비스에 감사 책임이 한 겹 더 쌓이는 형태다.
  - 제안: 이번 diff 로 인한 신규 문제는 아니므로 즉시 분리를 요구하지 않는다. 다만 향후 리팩터링 라운드에서 chat-channel lifecycle(`setupChatChannel`/`teardownChatChannel`/`rotateBotToken`)과 secret rotation(`rotateNotificationSecret`/`promoteRotatedNotificationSecrets`/`cleanupRotatedChatChannelTokens`)을 별도 서비스로 추출하는 것을 후보로 남겨둘 만하다.

## 설계상 긍정적 포인트 (참고)

- `AuditActionFor<P extends string> = Extract<AuditAction, \`${P}.${string}\`>` (`audit-action.const.ts:103-106`) 는 리소스별 `recordAudit` 파라미터를 컴파일 타임에 prefix 로 제한해, "resourceType='workflow' 인데 action='trigger.deleted'" 같은 모순된 감사 행을 타입 시스템으로 배제한다. 인터페이스 분리(ISP)를 주석이 아닌 타입으로 강제한 좋은 사례다.
- `AuditLogsService.record()` (`audit-logs.service.ts:65-96`) 가 내부적으로 예외를 삼키고 로깅만 하도록 설계되어("Failures are swallowed — audit logging must never break the primary action") 있어, 각 도메인 서비스가 audit 실패로부터 스스로를 보호할 필요 없이 안전하게 `await recordAudit(...)` 할 수 있다. 횡단 관심사(cross-cutting concern)의 장애 격리 책임을 그 관심사 자신(AuditLogsService)에게 두어 호출부마다 try/catch 를 반복하지 않게 한 설계는 이번 리뷰에서 확인한 4개 서비스(`model-config`/`schedules`/`triggers`/`workflows`) 어디서도 별도 방어 코드 없이 일관되게 지켜지고 있다.
- 각 서비스의 `recordAudit` 호출 위치(트랜잭션/저장 커밋 **직후**, BullMQ 등록·secret 마이그레이션·chat-channel setup 등 실패 가능한 외부 호출 **이전**)가 4개 서비스 전반에 일관되게 적용되어 있고, 그 근거가 각 파일에 동일하게 문서화되어 있다(리뷰 W6). 계층 간 책임 경계(영속 계층의 commit 사실과 audit 기록의 결합, 외부 side-effect 와의 분리)가 명확하다.

## 요약

이번 변경은 `audit-action.const.ts` 에 `AuditActionFor<P>` 타입 유틸리티를 도입하고, 이를 `model-config`/`schedules`/`triggers`/`workflows` 4개 서비스의 CRUD 경로에 일관된 `recordAudit` 패턴으로 적용한 것이다. 리소스-액션 정합성을 타입 레벨로 강제하는 설계, audit 실패가 주 흐름을 깨지 않도록 `AuditLogsService.record()` 내부에서 격리한 설계, 트랜잭션 커밋 직후·외부 side-effect 이전이라는 일관된 기록 시점 규약은 모두 견고하다. 발견된 사항은 전부 INFO 수준으로, `recordAudit` 보일러플레이트의 점진적 중복(향후 공용 팩토리 추출 후보), Schedule/Trigger 간 기존 리포지토리 직접 결합 위에 audit 규칙이 얹힌 점, `TriggersService` 의 누적된 다중 책임 — 모두 이번 diff 가 새로 만든 결함이 아니라 기존 구조 위에서 관찰되는 개선 여지다. 순환 의존성, 레이어 위반, SOLID 원칙의 심각한 침해는 발견되지 않았다.

## 위험도

LOW
