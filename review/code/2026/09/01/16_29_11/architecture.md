# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[WARNING]** `audit-action-binding-guard` 는 "리소스에 안 묶인 `action`" 은 잡지만, **"엉뚱한 리소스에 묶인 `action`"은 못 잡는다** — 그리고 이를 정적으로 막는다고 3라운드 RESOLUTION 이 기록한 `_NoCrossDomain` 은 실제로 이 경로를 검증하지 않는다(뮤테이션으로 재현·확인).
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`findUnboundHelpers` — `startsWith(\`${BOUND_TYPE_NAME}<\`)` 판정), `codebase/backend/src/modules/audit-logs/audit-action.const.ts` (`_NoCrossDomain` 선언부)
  - 상세: `findUnboundHelpers` 는 `action` 타입 텍스트가 `AuditActionFor<` 로 **시작하는지만** 본다 — 어떤 리소스 인자가 왔는지는 비교하지 않는다. 저장소 밖 scratch 에서 다음 두 가지로 직접 재현했다(저장소 파일은 건드리지 않았다):
    1. `AuthConfigsService.recordAudit` 의 `action` 파라미터를 `AuditActionFor<'workflow'>` (실제로는 `auth_config` 여야 함)로 바꾼 뮤턴트를 `tsc --strict --skipLibCheck` 로 컴파일 → **0 에러**. `_NoCrossDomain`(`audit-action.const.ts`)이 살아 있는 상태에서도 통과한다 — 그 캐너리는 `'trigger.created' extends AuditActionFor<'workflow'>` 라는 **단 하나의 하드코딩된 조합**에 대해 `AuditActionFor` 유틸리티 자체가 제대로 좁혀지는지를 한 번 검증할 뿐, 각 서비스의 `recordAudit` 이 **자신의 `resourceType` 과 일치하는 인자**를 썼는지는 전혀 보지 않는다.
    2. 같은 뮤턴트 소스를 저장소의 실제 `findAuditHelpers`/`findUnboundHelpers` 를 직접 import 해 돌렸다 → `unbound (flagged by guard): 0`. 즉 이 형태는 가드도 통과한다.
    이 조합(형태는 `AuditActionFor<...>` 로 맞지만 인자가 틀림 + `record()` 호출부에 `resourceType` 이 별도 상수로 하드코딩)은 `resourceType='auth_config'` 행에 `action='workflow.created'` 가 기록되는, **이 PR 이 막으려던 것과 동일한 결과**를 만든다 — 다만 경로가 "맨 union" 대신 "잘못 좁혀진 제네릭 인자"로 바뀌었을 뿐이다.
    `review/code/2026/09/01/15_25_56/RESOLUTION.md` 의 "INFO 3(가드가 제네릭 인자까지 비교하지 않음)도 같은 성격이다. 컴파일러의 `_NoCrossDomain` 가드가 다른 도메인 오귀속은 이미 정적으로 막으므로 우선순위가 낮다"는 서술은 위 재현 결과와 상충한다 — 이 PR 이 이미 두 차례(1·2라운드) "가드 헤더에 이미 문서화됨"이라는 미검증 주장을 스스로 반증한 이력이 있는 만큼(`14_31_12`/`15_10_38` RESOLUTION 정정 블록), 같은 클래스의 미검증 근거가 세 번째로 남아 있을 가능성을 짚어 둔다.
  - 제안: `_NoCrossDomain` 을 각 서비스별 캐너리로 확장하거나(예: `type _AuthConfigNoCrossDomain = 'workflow.created' extends AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE> ? never : true` 를 5곳에), 가드 쪽에서 `action` 의 제네릭 인자 텍스트와 같은 `recordAudit` 본문 내 `resourceType` 리터럴/상수 참조를 비교하도록 확장하는 편이 낫다. 우선순위 자체는 낮게 유지해도 되지만(원 결함처럼 실제 발생 전이라 P2 수준), **근거 문장("`_NoCrossDomain` 이 막는다")은 정정이 필요**하다 — 다음 사람이 이 문장을 믿고 조치를 계속 미루는 것이 실제 위험이다(1·2라운드에서 이미 같은 경로로 한 번 벌어졌다).

- **[INFO, 설계 긍정 — 재확인]** `AuditActionFor<T>` + `_NoCrossDomain` + AST fitness-function 가드 3중 방어 구조 자체는 OCP 를 지키며 회귀를 구조적으로 막는 좋은 설계다. 이전 라운드(`14_31_12`, `15_49_24` architecture.md)가 이미 상세히 평가했고 이번 라운드에서도 재확인했다 — `{name}-guard.ts`/`{name}-fixture.ts`/`{name}.spec.ts` 3분할은 `engine-error-code-anchor-guard.ts` 등 기존 5개 가드와 동일한 컨벤션(`ls codebase/backend/src/repo-guards/__tests__/` 로 재확인), 공통 팩토리 추출(억지 추상화) 대신 "지켜지는지 검사하는 가드"를 택한 처방은 5개 helper 의 `details` 계약이 전부 다르다는 실측에 부합한다. 위 WARNING 은 이 설계 전체를 무효화하는 것이 아니라 **가드가 커버하는 위반 형태가 하나 더 있다**는 지적이다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:111-142`, `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts`
  - 제안: 없음.

- **[INFO — 재확인]** `AuditLogsService` → `BusinessMetricsService` 결합, 순환 의존 없음. `MetricsModule` 이 `@Global()` 이고 `AuditLogsModule` 을 참조하지 않으며, `@Optional()` 주입이라 metrics 부재 시에도 `record()` 의 핵심 책임(영속화)이 깨지지 않는다 — `idempotency.interceptor.ts` 와 동일한 기존 관례. `MetricsModule`/`AuditLogsModule` 소스를 직접 열어 재확인했다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:1,8,19`, `codebase/backend/src/modules/audit-logs/audit-logs.module.ts`, `codebase/backend/src/modules/metrics/metrics.module.ts`
  - 제안: 없음.

- **[INFO]** 이번 changeset 의 타입/가드 방어는 5개 `recordAudit` 파사드(리소스별 래퍼)만 덮는다 — `AuditLogsService.record()` 를 **직접** 호출하는 나머지 producer(9개 파일, `auth.controller.ts`/`webauthn.controller.ts`/`webauthn.service.ts`/`users.controller.ts`/`workspaces.service.ts`/`workspace-invitations.service.ts`/`integrations.service.ts`/`executions.service.ts`)는 `action`·`resourceType` 을 호출부에서 **같은 객체 리터럴에 나란히** 적으므로 원 결함(래퍼가 숨긴 `resourceType`과 넓은 `action` 파라미터의 불일치)과는 형태가 다르고, 이는 `spec/data-flow/1-audit.md`(12개 위치 실측)·`plan/in-progress/spec-draft-audit-resource-type-count.md`(27개 호출 지점 실측)에 이미 투명하게 기록돼 있어 은폐된 갭은 아니다. `record()` 자체는 여전히 열린 계약(`action: AuditAction`, `resourceType: string`)이며, 좁히는 시점은 `business-metrics.service.ts` docstring 이 이미 예고해 뒀다("record() 가 닫힌 유니온을 받게 되면 그때 좁힌다").
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:76-84` (`record()` 시그니처), `codebase/backend/src/modules/workspaces/workspaces.service.ts:188` 등 직접 호출 예시
  - 제안: 없음(우선순위 판단 — 좁히는 리팩터는 별 트랙).

## 요약

핵심 변경 두 갈래(감사 적재 실패 관측성 추가, `auth-configs` 의 `recordAudit` 타입 바인딩 구멍을 `AuditActionFor<T>` + AST 가드로 봉합) 는 3라운드에 걸친 자기-검증 끝에 레이어 분리·결합도·순환 의존·OCP 관점에서 견고한 상태에 도달해 있다 — 이번 라운드에서 직접 소스를 열어 재확인한 결과 회귀는 없었다. 다만 가드의 방어 범위를 재점검하는 과정에서 **아직 닫히지 않은 변종 한 가지**를 뮤테이션으로 실측했다: `action` 을 형태상 `AuditActionFor<...>` 로 감싸되 **잘못된 리소스 인자**를 넣으면(예: `auth_config` 서비스에 `AuditActionFor<'workflow'>`), `tsc --strict` 도 가드의 `findUnboundHelpers` 도 통과한다. 이 결과는 그 갭을 "이미 `_NoCrossDomain` 이 막는다"며 낮은 우선순위로 넘긴 3라운드 RESOLUTION 의 근거와 상충하므로, 근거 문장 자체의 정정을 제안한다 — 우선순위는 낮게 유지해도 되지만(원 결함도 발생 전 예방적 조치였다), 이 PR 이 이미 두 번 겪은 "미검증 주장을 근거로 조치를 미룬다"는 패턴이 세 번째로 반복될 위험이 있다.

## 위험도
LOW
