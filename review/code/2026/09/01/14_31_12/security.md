# Security Review — audit-record-factory

## 검토 범위 요약

- `AuditLogsService.record()` 실패 시 관측성 강화(카운터 + 상세 로그 필드) 및 `@Optional()` metrics 주입
- `AuthConfigsService.recordAudit()` 의 `action` 파라미터 타입을 맨 union(`AuditAction`)에서 리소스 바인딩 타입(`AuditActionFor<...>`)으로 강화
- `BusinessMetricsService.recordAuditWriteFailed()` 신설 (OTel counter, label clamping)
- 신규 정적 가드(`audit-action-binding-guard.ts` 등) — `recordAudit` 류 helper 의 `action` 타입이 리소스에 바인딩됐는지 소스 AST 스캔으로 강제
- `plan/in-progress/spec-sync-auth-gaps.md` 갱신 (문서만)

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서는 **새로 도입된 취약점을 발견하지 못했다.** DB 접근은 전부 TypeORM `QueryBuilder` 파라미터 바인딩(`:workspaceId` 등)이고, 이 diff 는 SQL 문자열 조립 부분을 건드리지 않는다. 시크릿은 여전히 `randomBytes` 로 자동 발급되며 하드코딩된 값은 없다. `verifyWebhookRequest`/`constantTimeEquals`/`bcrypt.compare` 등 인증 로직 자체는 이 diff 의 변경 범위 밖(컨텍스트로만 노출)이다.

## 발견사항

- **[INFO]** `AuditLogsService.record()` catch 블록 안에서 `metrics?.recordAuditWriteFailed(...)` 호출이 자체 보호(try/catch)되지 않는다 — 이 호출이 예외를 던지면 `record()` 의 "항상 resolve 한다(주 동작을 절대 깨뜨리지 않는다)" best-effort 계약이 깨지고, 예외가 호출자(`auth-configs.service.ts` 의 `create/update/regenerate/remove/reveal` — 특권 작업)까지 전파될 수 있다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:104` (`this.metrics?.recordAuditWriteFailed(entry.resourceType);`)
  - 상세: OTel `Counter.add()` 는 일반적으로 non-throwing 계약을 지키도록 설계되고, 동일 패턴(`this.metrics?.recordRedisFailOpen(...)`)이 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 에도 이미 무보호로 존재해(예: 178-186행) 이번 diff 가 새로 만든 패턴은 아니다. 다만 이 새 경로는 "감사 DB 장애 + 특권 작업(시크릿 회전/삭제/열람)" 이라는, 문서(`record()` 의 docstring)가 명시적으로 "절대 깨지면 안 된다"고 선언한 바로 그 시나리오에서 처음 실행되는 코드다. 즉 종전에는 이 catch 블록 안에서 던질 수 있는 코드가 `logger.warn` (동기, 사실상 non-throwing) 뿐이었는데, 이번에 예외 가능성이 있는 외부 라이브러리 호출이 하나 추가됐다.
  - 제안: `try { this.metrics?.recordAuditWriteFailed(entry.resourceType); } catch { /* metrics 는 best-effort 중의 best-effort */ }` 로 감싸거나, 최소한 `record()` 가 어떤 경우에도 reject 하지 않음을 고정하는 회귀 테스트(예: `metrics.recordAuditWriteFailed` 를 `mockImplementation(() => { throw ... })` 로 만든 뒤 `record()` 가 여전히 resolve 하는지 단언)를 추가할 것. 동일 근거로 `idempotency.interceptor.ts` 의 기존 3곳도 후속 검토 대상.

- **[INFO]** 새 경고 로그 메시지가 `action`·`resourceType`·`resourceId`·`workspaceId` 를 단일 비구조화 문자열로 결합한다. 값에 개행 등 제어문자가 섞이면 로그 위조(CWE-117, log injection)가 가능한 구조인데, 이를 막는 코드 차원의 방어(escaping/구조화 로깅)가 없다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:105-110`
  - 상세: 현재 실측된 호출부(`auth-configs.service.ts` 의 `resourceId`=`ParseUUIDPipe` 검증된 route param 또는 `saved.id`, `workspaceId`=`resolveRequestWorkspaceContext`→`isUuidShaped` 정규식(`^[0-9a-f]{8}-...$`, 개행 불가)으로 검증됨; `workspace-invitations.service.ts` 의 `resourceId`=`saved.id`(DB row UUID, PII 인 raw 이메일은 의도적으로 details 에도 안 넣음))는 전부 UUID-shaped 값이거나 닫힌 enum(`action`) 이라 실제 인젝션 경로는 확인되지 않았다. 다만 이 로그 포맷은 `AuditLogsService.record()` 를 호출하는 **12개+ producer 전체가 공유**하는 코드고, 향후 다른 producer 가 검증되지 않은 자유 텍스트를 `resourceId`/`workspaceId` 로 넘기면(현재는 관례로만 회피) 로그 위조로 이어질 수 있다.
  - 제안: 필수 사항은 아니나, 구조화 로깅(예: `logger.warn({ msg, action, resourceType, resourceId, workspaceId })`)으로 전환하거나 값에서 개행/제어문자를 제거하는 유틸을 한 곳에 두면 향후 producer 추가 시에도 관례에 의존하지 않고 구조적으로 방어된다.

- **[INFO]** 신규 정적 가드(`findUnboundHelpers`)의 판정이 타입 생성자 이름 접두사(`AuditActionFor<`)만 검사하고 **제네릭 인자(어느 리소스에 바인딩됐는지)는 검사하지 않는다** — 감사 추적 무결성을 보증하는 가드치고는 판정이 느슨하다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125` (`findUnboundHelpers` — `s.actionType?.startsWith('AuditActionFor<')`)
  - 상세: 예를 들어 `TriggersService.recordAudit` 의 `action` 타입이 실수로 `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`(다른 리소스에 바인딩)로 복붙되어도 이 가드는 `AuditActionFor<` 접두사만 보므로 통과시킨다 — 이번 PR 이 고친 "맨 union" 결함(다른 리소스의 액션을 조용히 기록)과 같은 계열의, 더 은밀한 오귀속을 못 잡는다. 보안적으로는 사고 조사 시 감사 로그의 `resourceType`↔`action` 정합성을 신뢰할 수 있는가와 관련된 방어선의 완결성 문제다.
  - 제안: 각 서비스 파일에서 `resourceType` 상수(예: `AUTH_CONFIG_RESOURCE_TYPE`)를 함께 추출해 `AuditActionFor<typeof X>` 의 `X` 가 같은 파일의 `resourceType` 상수와 일치하는지까지 검사하면 이 구멍이 닫힌다. 현재로선 low priority (이번 diff 의 목표였던 "맨 union" 클래스는 확실히 잡음).

## 요약

이번 diff 는 신규 인젝션·인증 우회·하드코딩 시크릿·암호화 약화를 도입하지 않았고, 오히려 두 가지 점에서 보안 태세를 개선한다: (1) `auth-configs.service.ts` 의 `recordAudit` action 타입을 리소스 바인딩 타입으로 좁혀 감사 로그 오귀속(다른 리소스의 액션이 `auth_config` 로 기록되는) 가능성을 컴파일 타임에 차단했고, (2) 감사 적재 실패가 조용히 묻히던 것을 카운터+상세 로그로 가시화해 "특권 작업 성공, 감사 행 유실" 시나리오의 탐지를 가능하게 했다. 로그 메시지에 시크릿·`details` 페이로드는 포함되지 않으며, 실측 확인한 호출부의 `resourceId`/`workspaceId` 는 모두 UUID-shaped 검증을 거친 값이라 즉시 악용 가능한 로그 인젝션 경로는 없다. 남은 발견사항은 모두 INFO 등급의 방어 심층화(defense-in-depth) 성격 — catch 블록 안 미보호 metrics 호출이 best-effort 계약을 깰 잠재 가능성, 로그 포맷의 구조적 방어 부재, 신규 가드의 판정 느슨함(제네릭 인자 미검사) — 이며 즉시 조치가 필요한 결함은 아니다.

## 위험도

LOW
