# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `record()`의 catch 블록 안에서 새로 추가된 metrics 호출이 무방비 상태라, "감사 실패는 절대 본 요청을 깨뜨리지 않는다"는 바로 그 계약을 이 diff 자신이 깰 수 있는 새 실패 경로를 만든다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:104` (`this.metrics?.recordAuditWriteFailed(entry.resourceType);`, `record()` catch 블록 내부) 및 `codebase/backend/src/modules/metrics/business-metrics.service.ts:168-172` (`recordAuditWriteFailed(resourceType: string)`의 `resourceType.substring(0, 64)`)
  - 상세: `record()`의 docstring 은 "Failures are swallowed — audit logging must never break the primary action"(주석: "삼키는 것 자체는 의도다")를 명시한다. 그런데 새로 삽입된 `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 호출은 그 catch 블록 **내부**에 있고, 자신을 감싸는 별도의 try/catch 가 없다. 만약 이 호출(또는 그 안의 `resourceType.substring(0, 64)`)이 던지면, 그 예외는 `record()` 밖으로 그대로 전파되어 `AuthConfigsService.create/update/regenerate/remove/reveal` 등 12개 감사 producer(triggers/workflows/schedules/workspaces/integrations/model-config/auth-configs/executions/users/webauthn/auth 등, `grep` 실측) 전부에서 **DB 저장은 성공했는데 그 뒤 audit 기록 호출이 예외를 던져 응답이 실패하는** 상황을 만들 수 있다 — 바로 이 PR 이 고치려던 "본 요청을 깨뜨리면 안 된다"는 원칙의 반대 방향 회귀다. `entry.resourceType`은 TS 타입상 항상 `string`이고 실측 OTel SDK(`sdk-metrics/Instruments.js`)의 `CounterInstrument.add()`는 잘못된 값에 대해 예외를 던지지 않고 `diag.warn`으로 무시하도록 구현돼 있어, 실무적 발동 가능성은 낮다. 다만 같은 패턴(`this.metrics?.recordRedisFailOpen(...)`을 catch 블록 안에서 무방비로 호출)이 `idempotency.interceptor.ts`에도 이미 존재해 — 이 PR 이 처음 만든 패턴은 아니라 **기존 관행의 연장**이다. 다만 idempotency 쪽은 캐시 fail-open 강등이 대상이고, 이번 확장은 시크릿 회전·삭제 같은 특권 CRUD 응답 전체를 좌우하는 단일 chokepoint(`AuditLogsService.record()`)라 파급 반경이 더 넓다.
  - 제안: `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 호출을 자체 `try { … } catch { /* metrics 실패도 삼킨다 */ }`로 한 번 더 감싸(또는 `record()` 바깥 catch 전체를 이중 try 구조로) "관측 실패가 감사 실패보다 더 큰 실패를 만들지 않는다"를 코드로도 보장할 것. (동일 근거로 `idempotency.interceptor.ts`의 `recordRedisFailOpen` 호출부도 후속으로 같은 보강을 검토할 가치가 있으나 이번 diff 범위 밖.)

- **[INFO]** `AuditLogsService` 생성자에 새 파라미터 추가 — 호출자 영향은 없음(확인됨).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19` (`@Optional() private readonly metrics?: BusinessMetricsService,`)
  - 상세: 기존 유일한 파라미터(`auditLogRepository`) 뒤에 `@Optional()` + `?:`로 추가되어 하위 호환이다. 저장소 전수 검색(`grep -rn "new AuditLogsService("`) 결과 직접 인스턴스화하는 곳은 `audit-logs.spec.ts`·`executions-rerun.service.spec.ts` 두 테스트 파일뿐이며 전부 metrics 생략 또는 명시 전달 형태로 이미 대응돼 있다. DI 경로는 `MetricsModule`이 `@Global()`이라 `AuditLogsModule`이 별도 import 없이도 주입받는다(실측: `metrics.module.ts`) — 설계 의도대로 동작한다.
  - 제안: 없음 (문제 아님, 확인 목적 기재).

- **[INFO]** `AuthConfigsService.recordAudit`의 `action` 파라미터 타입이 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`로 좁혀짐 — 런타임 영향 없는 컴파일 타임 전용 변경.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:86`
  - 상세: `recordAudit`는 `private` 메서드라 외부 호출자가 없다. 같은 파일 내 5개 호출부(`create/update/regenerate/remove/reveal`)가 전부 `AUDIT_ACTIONS.AUTH_CONFIG_*` (prefix `auth_config.`)만 전달하므로 타입 좁힘으로 인한 컴파일 실패나 동작 변화가 없다(타입 정의·narrows-guard 확인: `audit-action.const.ts`의 `AuditActionFor`/`_NoCrossDomain`). `auth-configs.spec.ts`에도 `recordAudit`를 직접 호출하는 테스트가 없어 회귀 위험 없음.
  - 제안: 없음.

- **[INFO]** `BusinessMetricsService.recordAuditWriteFailed`의 `resource_type` 라벨이 닫힌 유니온이 아니라 `substring(0, 64)` 클램핑만으로 방어됨 — 문서화된 트레이드오프.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:168-172`
  - 상세: 라벨 값의 출처는 `AuditLogsService.record()`의 `resourceType: string`(열린 타입)이고, 실제로는 코드가 정하는 12개 producer(`grep -rln "auditLogsService.record(" modules`로 실측 확인, 문서의 "실측 12종" 주장과 일치)로 유계다. 다만 컴파일러가 이를 증명하지 못하므로 이론상 향후 어떤 producer가 사용자 입력을 그대로 `resourceType`에 흘려보내면 Prometheus 라벨 카디널리티가 늘어날 수 있다. 이는 diff의 docstring이 이미 명시적으로 인지·설명한 설계 선택(닫힌 유니온 대신 클램핑)이라 결함으로 보지 않는다.
  - 제안: 없음 (향후 producer 추가 시 리마인더로만 유효).

- **[INFO]** 신설 가드(`audit-action-binding-guard.ts`/`-fixture.ts`/`.spec.ts`)는 `codebase/backend/src/modules` 하위를 `fs.readdirSync`/`fs.readFileSync`로 재귀 스캔하지만 **읽기 전용**이며 파일 쓰기·삭제는 없음. `REPO_ROOT = path.resolve(__dirname, '../../../../..')` 산출 경로를 수동 검산(`__tests__ → repo-guards → src → backend → codebase → repo-root`, 5단계)해 저장소 루트로 정확히 귀결됨을 확인했다. 스캔 범위 밖 이탈 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:38-57`, `audit-action-binding.spec.ts:51`
  - 상세/제안: 문제 없음, 확인 목적 기재.

## 요약

핵심 변경은 감사 로그 적재 실패를 관측 가능하게 만드는 것(카운터+상세 로그)과 `auth-configs`의 감사 액션 타입을 리소스에 묶는 것 두 갈래다. 시그니처 변경(`AuditLogsService` 생성자, `recordAudit` 파라미터 타입)은 전부 하위 호환이거나 `private`/컴파일 타임 전용이라 실질적 호출자 영향이 없음을 실측으로 확인했고, 새 가드 스크립트는 읽기 전용이라 파일시스템 부작용도 없다. 유일하게 주목할 부작용은 `record()`의 catch 블록 안에 무방비로 삽입된 metrics 호출이 이론상 "감사 실패가 본 요청을 깨뜨리지 않는다"는 이 PR 자신의 목표를 역행할 수 있는 새 실패 경로라는 점이다 — 실제 OTel Counter API 구현은 예외를 던지지 않도록 설계돼 있어 발동 가능성은 낮고, 동일 패턴이 `idempotency.interceptor.ts`에 선례로 이미 존재하지만, 이번엔 파급 범위가 특권 CRUD 12개 producer 전체로 넓어졌으므로 방어적 래핑을 권고한다.

## 위험도

LOW
