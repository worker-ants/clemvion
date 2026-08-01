# 보안(Security) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위

`model-config` / `schedules` / `triggers` / `workflows` 4개 모듈에 `AuditLogsService` 를 주입해
CRUD(생성/수정/삭제/set-default/duplicate) 감사 로깅을 추가한 변경. 컨트롤러에 `@CurrentUser('sub')`
로 행위자(userId) 를 주입하고, 서비스 계층에 `recordAudit()` private 헬퍼를 신설해 트랜잭션 경계 뒤에서
`AuditLogsService.record()` 를 호출한다. `audit-action.const.ts` 에 13개 신규 액션 상수 추가.
프롬프트에서 크기 제한으로 생략된 파일(model-config/schedules/triggers/workflows 의 controller·service
본문 6개)은 `Read` 로 전체 직접 확인했고, 다이제스트 전용으로 언급된 sink(`audit-logs.service.ts`),
데코레이터(`current-user.decorator.ts`), 가드(`roles.guard.ts`), 모듈(`audit-logs.module.ts`) 도
연쇄 검증을 위해 직접 열어 확인했다.

## 발견사항

- **[INFO]** 신규 감사 기록 20+ 호출부가 공유하는 sink 가 쓰기 실패를 전부 삼킨다(swallow) — 감사 무결성 관점의 기존 트레이드오프가 이번에 4개 도메인으로 확대 적용됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97` (`record()`, 본 diff에는 포함되지 않은 기존 파일이나 이번 diff 가 추가한 모든 신규 호출부의 공통 sink)
  - 상세: `record()` 는 `try/catch` 로 감싸 DB 쓰기 실패 시 `logger.warn` 만 남기고 呼출자에는 항상 `Promise<void>` 로 정상 resolve 한다(주석: "Failures are swallowed — audit logging must never break the primary action"). 이는 사전에 내려진 설계 결정이고 이번 diff 가 그 자체를 바꾸지는 않지만, 이번 변경으로 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` 4개 도메인 13개 액션이 전부 이 sink 로 몰리면서 "감사 대상 mutation" 의 표면적이 크게 넓어졌다. OWASP A09(Security Logging and Monitoring Failures) 관점에서, DB 부하·일시적 커넥션 장애 시 다수의 특권 작업(모델 설정 API 키 교체, 트리거/스케줄 삭제, 워크플로우 삭제 등)이 아무 감사 흔적 없이 조용히 수행될 수 있다는 점을 인지할 필요가 있다.
  - 제안: 현재 diff 범위에서 조치 불필요(설계상 의도된 fail-open). 다만 향후 감사 신뢰도가 중요해지면 `record()` 실패를 별도 알림(예: 메트릭/알람)으로 승격하는 것을 검토. 이번 PR 의 스코프는 아님.

- **[INFO]** `audit_log` 무제한 보존 — 이번 diff 는 저빈도 CRUD 만 추가해 즉각적 위험은 낮으나, 설계 문서 자체가 이미 리스크를 인지하고 있음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`
  - 상세: 신규 주석이 `workflow.executed`(고빈도) 를 의도적으로 이번 스코프에서 제외한 이유로 "`audit_log` 는 보존 정책 미정, pruner 없음(§3 현재 무제한)" 을 명시한다. 이번 diff 가 실제로 추가한 13개 액션은 전부 저빈도 CRUD 라 가용성(DoS/스토리지 팽창) 리스크는 낮지만, 근본 원인(무제한 테이블)은 그대로 남아 있다.
  - 제안: 조치 불요(이미 문서화된 의도적 유예, `review/consistency/2026/08/01/09_11_58/plan_coherence.md` INFO 2 도 동일 결론). 추후 `workflow.executed` 등 고빈도 액션을 추가할 때는 보존 정책(pruner)을 선결 조건으로 둘 것.

- **[INFO] (diff 범위 밖 — 참고용)** `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재 — 이번 diff 가 건드리지 않은 인접 코드에서 발견
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:229-239` (`@Post(':id/chat-channel/rotate-bot-token')`)
  - 상세: 같은 파일에서 이번 diff 가 수정한 `create`/`update`/`remove` 는 모두 `@Roles('editor')` 를 유지하지만(회귀 없음, 정상 확인됨), 바로 아래의 `rotateBotToken` 엔드포인트는 `@Roles(...)` 가 없다. `RolesGuard`(`codebase/backend/src/common/guards/roles.guard.ts:51-53`, 주석: "`@Roles()`가 없는 라우트는 자동 통과(default Allow)")에 따라 이 엔드포인트는 워크스페이스의 `viewer` 역할까지도 chat-channel bot token 회전을 수행할 수 있다. 다만 이 라인은 이번 diff 의 변경 대상이 아니고(diff 는 `create`/`update`/`remove` 시그니처에 `@CurrentUser` 파라미터만 추가), 사전에 존재하던 상태다.
  - 제안: 이번 PR 의 차단 사유는 아님. 별도 정정 필요 여부는 담당자 판단(의도된 설계일 수도 있음 — 예: chat-channel 봇 토큰 회전이 알림 채널 소유자 자기서비스 목적이라면 viewer 허용이 의도일 수 있음). 확인 후 필요 시 `@Roles('editor')` 추가 검토 권장.

## 확인된 안전한 설계 패턴 (positive findings)

- **행위자(userId) 스푸핑 불가**: 모든 신규 `userId` 는 `@CurrentUser('sub')`(`current-user.decorator.ts:10-19`)로 검증된 JWT `sub` claim 에서만 나온다. `CreateModelConfigDto`/`CreateScheduleDto`/`CreateTriggerDto`/`CreateWorkflowDto` 어디에도 client 가 주입 가능한 `userId` 필드가 없어(grep 확인) 요청 바디로 감사 행위자를 위조할 수 없다.
- **RBAC 회귀 없음**: 이번 diff 가 시그니처를 바꾼 모든 mutating 엔드포인트(`model-config`/`schedules`/`triggers`/`workflows` 의 create/update/remove/setDefault/duplicate)에 `@Roles('editor')`(또는 그 이상)가 그대로 유지됨을 전수 확인.
- **IDOR 방지 유지**: `remove`/`setDefault`/`update` 계열은 모두 감사 기록 이전에 `findEntity(id, workspaceId)`/`findById(id, workspaceId)` 로 워크스페이스 스코프 조회를 선행한다(예: `model-config.service.ts:394-399`, `schedules.service.ts:260-262`, `triggers.service.ts:859-861`). 타 워크스페이스 리소스에 대해서는 그 이전에 404 로 차단되므로, 신규 `recordAudit` 호출이 크로스-워크스페이스 리소스에 도달할 경로가 없다.
- **행위자·대상 뒤바뀜 방지**: 4개 서비스 모두 `recordAudit(params: {...})` 를 object 파라미터로 설계해 "동일 타입(string) positional 인자 순서 스왑을 컴파일러가 못 잡는" 클래스의 버그를 원천 차단한다(코드 주석이 `auth-configs W-1` 선례를 명시적으로 인용).
- **트랜잭션 경계 정확성**: `model-config.setDefault`/`workflows.create`/`workflows.duplicate` 는 감사 기록을 트랜잭션 **커밋 뒤**로 명시적으로 옮기고, 그 순서를 관측 가능한 형태(`order: string[]`)로 단언하는 테스트를 추가했다 — 롤백된 작업이 감사에 남는 것(위양성 감사 기록)을 방지.
- **정보 노출 최소화**: `details` 필드에는 `kind`(chat/embedding/rerank), `type`(webhook/schedule/chat_channel), `duplicatedFrom`(UUID) 같은 저위험 열거형/식별자만 기록되며, API 키·webhook HMAC secret·`dto.name` 등 자유 텍스트/민감값은 어디에도 노출되지 않는다. `model-config.service.ts` 의 API 키 암호화(`encrypt`/`decrypt`)·마스킹(`maskApiKey`) 로직도 이번 diff 에서 변경되지 않았다.
- **SQL 인젝션 없음**: 새로 조회/갱신되는 모든 경로가 TypeORM `QueryBuilder` 파라미터 바인딩(`:workspaceId` 등) 또는 `Repository`/`EntityManager` 메서드를 사용하며, 신규로 추가된 원시 문자열 결합은 없다. `resourceId` 는 항상 `ParseUUIDPipe` 로 검증된 라우트 파라미터이거나 DB 가 생성한 `saved.id` 이며 사용자 자유 입력이 아니다.
- **하드코딩 시크릿 없음**: 테스트 픽스처의 `apiKey: 'sk-abc'` 는 명백한 더미 값이고, `ENCRYPTION_KEY` 는 테스트에서 `randomBytes(32)` 로 매 실행 생성된다. 실제 시크릿·키·토큰의 하드코딩은 발견되지 않았다.
- **`NotificationConfigDto` 의 `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], ...)` → `@IsIn(NOTIFICATION_EVENT_TYPES, ...)` 변경**은 동일 `as const` 배열 참조를 넘기는 순수 타입 단순화이며 런타임 검증 로직·화이트리스트에 변화가 없다 — 보안 영향 없음.

## 요약

이번 diff 는 4개 모듈(model-config/schedules/triggers/workflows)에 감사 로깅을 추가하는 순수 기능 확장이며, 신규로 도입된 인젝션·인증 우회·시크릿 노출·권한 검증 누락 취약점은 발견되지 않았다. 오히려 행위자(userId)를 검증된 JWT claim 에서만 취하고, 파라미터 객체화로 행위자·대상 뒤바뀜을 컴파일 타임에 방지하며, 트랜잭션 커밋 후에만 감사를 기록하도록 설계해 감사 무결성을 적극적으로 강화한 코드다. 기존 워크스페이스 스코프 IDOR 방지·RBAC 데코레이터·API 키 암호화/마스킹 로직도 회귀 없이 유지된다. 남은 항목은 모두 INFO 수준으로, (1) 감사 쓰기 실패를 조용히 삼키는 기존 sink 의 적용 범위가 넓어진 점, (2) `audit_log` 무제한 보존이라는 이미 문서화된 기존 리스크, (3) 이번 diff 와 무관한 인접 엔드포인트(`rotateBotToken`)의 `@Roles` 부재를 참고로 남긴다 — 셋 다 이번 PR 을 차단할 사유는 아니다.

## 위험도

LOW
