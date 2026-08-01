# 보안(Security) 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 기록 추가)

## 발견사항

- **[CRITICAL]** `@Roles()` 미부착 라우트는 워크스페이스 멤버십 검증을 아예 건너뛴다 — `X-Workspace-Id` 헤더 위조로 비멤버가 타 워크스페이스 데이터를 열람/조작할 수 있다 (Broken Access Control / IDOR).
  - 위치(근본 원인): `codebase/backend/src/common/guards/roles.guard.ts:46-53` — `canActivate()` 가 `requiredRoles.length === 0` 이면 `return true` 로 즉시 통과한다. 멤버십 조회(`getMemberRole`, 66-70행)는 그 아래 코드라 **`@Roles()` 가 없는 라우트에서는 절대 실행되지 않는다**. 그런데 같은 클래스의 doc-comment(33-38행)는 "사용자가 워크스페이스 멤버가 아니면 거부" 를 무조건적으로 명시한다 — **구현이 자신의 문서화된 계약을 어긴다.**
  - 근거(팀 스스로 인지하고 있는 메커니즘): `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts:23-25` 의 주석이 정확히 이 메커니즘을 설명한다 — "RolesGuard 가 멤버십+역할을 함께 검증하므로 X-Workspace-Id 위조에 의한 비멤버 열람도 차단된다" — 그래서 이 엔드포인트만 `@Roles('admin')` 를 붙였다. `workflows.controller.ts` 의 `graphWarnings`(`@Roles('viewer')`, 119행)도 같은 이유로 의도적으로 붙어 있다. 즉 "읽기 전용 엔드포인트에도 최소 `@Roles('viewer')` 가 필요하다" 는 것을 팀이 알고 있는데, 이번 리뷰 대상 컨트롤러들의 대다수 조회 엔드포인트에는 빠져 있다.
  - 이번 리뷰 배치에 포함된 구체적 미보호 엔드포인트(전부 `@Roles()` 없음 → 비멤버도 헤더 위조로 접근 가능):
    - `codebase/backend/src/modules/triggers/triggers.controller.ts:59`(`findAll`) / `:76`(`findOne`) / `:141`(`getHistory`)
    - `codebase/backend/src/modules/schedules/schedules.controller.ts:62`(`findAll`) / `:79`(`findOne`) / `:105`(`getPreview`)
    - `codebase/backend/src/modules/workflows/workflows.controller.ts:93`(`findAll`) / `:111`(`findOne`) / `:508`(`exportWorkflow` — 노드/엣지 포함 워크플로우 전체 정의를 JSON 로 export)
    - `codebase/backend/src/modules/model-config/model-config.controller.ts:79`(`findAll`) / `:95`(`findOne`)
  - 더 심각한 변형: `codebase/backend/src/modules/triggers/triggers.controller.ts:236`(`rotateBotToken`) 는 **조회가 아니라 mutation**(Chat Channel bot token 회전 — secret rotation)인데도 `@Roles()` 가 전혀 없다. 같은 컨트롤러의 자매 mutation(`create`/`update`/`remove`/`rotateNotificationSecret`/`revokePerTriggerToken`)은 전부 `@Roles('editor')` 인 것과 대비된다. `X-Workspace-Id` 헤더만 위조하면 플랫폼의 아무 계정(멤버십 무관)이 타 워크스페이스 trigger 의 봇 토큰을 자신이 아는 값으로 회전시켜 그 채널을 탈취할 수 있다.
  - 영향: `workflow`/`trigger`/`schedule`/`model_config` 리소스는 워크플로우 정의(비즈니스 로직·프롬프트), 알림 URL, chat-channel 설정(sanitize 후에도 provider/식별자 노출), 모델 provider·baseUrl·마스킹된 apiKey 등을 담고 있어 cross-tenant 열람 자체로도 상당한 기밀성 침해다. `rotateBotToken` 은 열람을 넘어 계정 탈취급 mutation.
  - 스코프 노트: 이 결함은 **이번 audit-logging diff 가 도입한 것이 아니다** — RolesGuard/데코레이터 자체는 diff 밖이고, 위 컨트롤러들의 GET 핸들러도 이번 PR 에서 변경되지 않은 코드다(이번 diff 는 `create`/`update`/`remove`/`setDefault` 에 `userId` 파라미터·감사 기록만 추가). 다만 리뷰 프롬프트가 해당 파일 전체를 컨텍스트로 포함했고, 정확히 이 리뷰가 감사(추적성)를 다루는 기능이라 "누가 무엇을 봤는지" 조차 보장 못 하는 상위 인가 결함을 병기할 가치가 있어 보고한다. 별도 티켓으로 최우선 triage 를 권장.
  - 제안: 최소한 모든 조회 엔드포인트에 `@Roles('viewer')` 를, `rotateBotToken` 에는 다른 chat-channel/trigger mutation 과 동일하게 `@Roles('editor')` 를 추가한다. 근본적으로는 `RolesGuard.canActivate` 의 early-return 을 "역할 계층 검사만 skip, 멤버십 검사는 항상 수행" 으로 재구성해 opt-out 이 구조적으로 불가능하게 만드는 편이 이런 누락 재발을 막는다(현재는 라우트마다 사람이 기억해서 데코레이터를 붙여야 하는 opt-in 모델이라 이미 최소 2곳 넘게 누락됐다).

- **[INFO]** 이번 diff(감사 로깅 배선 자체)는 인젝션·시크릿·인가 관점에서 클린하다.
  - `model-config.service.ts`(`create`/`update`/`setDefault`/`remove`) · `schedules.service.ts`(`create`/`update`/`remove`) · `triggers.service.ts`(`create`/`update`/`remove`) · `workflows.service.ts`(`create`/`update`/`remove`/`duplicate`/`importWorkflow`) 전부 `recordAudit()` 을 named 파라미터로 감싸고, `resourceType`/`action` 은 상수·`AUDIT_ACTIONS` enum 값이며, `details`(`{kind}`/`{type}`/`{duplicatedFrom}`/`{imported: true}`) 는 서버 확정 값 또는 이미 DTO 레벨에서 화이트리스트 검증된 값(`type: @IsIn(['webhook','manual'])`, `kind: parseKind()` 화이트리스트)만 담는다 — 자유 문자열이 감사 로그에 그대로 흘러들지 않는다.
  - `AuditLogsService.record()`(변경 없음, `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:81-96`)는 TypeORM parameterized query 만 사용하고 실패를 내부에서 swallow — 감사 기록 실패가 트랜잭션 커밋 후 호출부를 500 으로 깨거나 반대로 "커밋됐는데 감사만 없는" 상태를 호출자에게 노출하지 않는다.
  - 신규 `AUDIT_ACTIONS`/`AuditLogDto` 변경은 상수·문서 문자열 추가일 뿐 런타임 로직 변화가 없다.
  - 시크릿 하드코딩 없음 — diff 내 `apiKey`/`botToken`/`secret` 유사 리터럴은 전부 `*.spec.ts` 의 mock/fixture 값(`'sk-test123456789abcdef'`, `'xoxb-fake-token'`, `'111:TestToken'` 등)이며 실제 자격증명이 아니다.

- **[INFO]** (긍정적) 신규 추가된 컨트롤러 spec(`schedules.controller.spec.ts`, `triggers.controller.spec.ts`, `workflows.controller.spec.ts`, `model-config.controller.spec.ts` 의 "행위자(userId) 배선" describe 블록)이 실제로 관측된 취약 클래스 — `update(id, workspaceId, dto, userId)` 처럼 동일 타입(string) 인자가 여럿이라 위치가 바뀌어도 컴파일이 통과하는 경우, 스왑되면 감사 로그의 행위자·워크스페이스가 조용히 뒤바뀌는 문제 — 를 정확히 겨냥한 회귀 가드다. 감사 로그의 non-repudiation(누가 했는지) 무결성을 지키는 데 실질적으로 기여하는 테스트.

## 요약

이번 audit-logging PR 자체(`workflow`/`trigger`/`schedule`/`model_config` CRUD 에 `AuditLogsService.record()` 배선 추가)는 보안 관점에서 안전하다 — 인젝션 표면 없음, 시크릿 하드코딩 없음, 새로 기록되는 `details` 는 화이트리스트된 값만 포함, 트랜잭션 커밋 후 기록(롤백된 작업이 감사에 남는 것을 방지)하는 기존 관례를 일관되게 따르며, 행위자(userId)/워크스페이스 인자 스왑을 잡는 회귀 테스트까지 동반한다. 다만 리뷰 대상 파일 전체를 훑는 과정에서 **이 diff 와 무관한, 그러나 훨씬 심각한 상위 인가 결함**을 발견했다 — `RolesGuard` 는 `@Roles()` 데코레이터가 없는 라우트에서 워크스페이스 멤버십 검사 자체를 건너뛰어(`roles.guard.ts:51-53`), `X-Workspace-Id` 헤더를 위조하면 어떤 인증된 사용자든 자신이 속하지 않은 워크스페이스의 workflow/trigger/schedule/model-config 를 조회하거나(대부분의 `findAll`/`findOne`), 심지어 trigger 의 chat-channel bot token 을 회전(`rotateBotToken`, 어떤 `@Roles` 도 없음)시킬 수 있다. `audit-logs.controller.ts` 자체의 주석이 이 메커니즘과 위험을 팀이 이미 알고 있음을 보여주는데도(그래서 그 엔드포인트만 `@Roles('admin')` 로 방어) 이번 리뷰 대상 4개 리소스의 조회 엔드포인트 대부분에는 적용되지 않았다. 이 diff 의 범위는 아니지만, 정확히 "누가 무엇을 했는지 추적한다" 는 감사 기능을 다루는 리뷰라 "누가 볼 수 있는지" 조차 보장 못 하는 이 결함을 병기해 별도로 긴급 triage 할 것을 강력히 권장한다.

## 위험도

CRITICAL (사유: 이번 diff 자체의 위험도는 NONE 에 가까우나, 리뷰 대상 파일 전반에서 발견한 사전 존재 결함 — `@Roles()` 미부착 라우트의 워크스페이스 멤버십 검증 완전 누락 — 이 cross-tenant 데이터 노출/탈취로 이어질 수 있어 CRITICAL 로 상향. 이 결함은 이번 PR 이 만든 것이 아니므로 audit-logging 자체를 되돌릴 필요는 없고, 별도 트랙으로 즉시 대응 권장)
