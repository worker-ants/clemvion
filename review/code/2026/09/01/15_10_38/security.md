# Security Review — audit-record-factory (2026-09-01 15:10)

## 검토 범위 요약

- `AuditLogsService.record()` — DB 적재 실패(swallow 계약 유지) 시 관측 강화: 카운터
  (`BusinessMetricsService.recordAuditWriteFailed`) + 유실 대상을 담은 상세 `logger.warn`.
  metrics 의존은 `@Optional()`.
- `AuthConfigsService.recordAudit()` — `action` 파라미터 타입을 맨 union(`AuditAction`)에서
  리소스 바인딩 타입(`AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`)으로 강화.
- 신규 정적 가드 `repo-guards/__tests__/audit-action-binding-{guard,fixture,.spec}.ts` —
  `codebase/backend/src/modules` 전체를 AST 스캔해 `recordAudit` 류 helper 의 `action` 이
  리소스에 바인딩됐는지 검사.
- `BusinessMetricsService` — `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` 공통화, 신규
  `clemvion.audit.write_failed` Counter.
- `plan/`·`review/`·`spec/`·`CHANGELOG.md` 등 문서 변경(직전 라운드 산출물 포함).

인젝션(SQL/XSS/커맨드/경로탐색), 하드코딩 시크릿, 인증/인가 우회, 암호화 약화 관점에서
**새로 도입된 취약점은 없다.** `audit-logs.service.ts` `findAll()` 의 DB 접근은 여전히
TypeORM `QueryBuilder` 파라미터 바인딩(`:workspaceId` 등)이고 이 diff 는 건드리지 않는다.
전체 diff·문서(CHANGELOG, plan, spec draft) 를 grep 했으나 하드코딩된 API 키/비밀번호/토큰은
없다.

이 세션은 직전 라운드(`review/code/2026/09/01/14_31_12/`)의 WARNING 5건에 대한 fix 반영
라운드다. 그중 보안과 직결된 W2(관측 호출이 swallow 계약을 깰 수 있던 문제)가 이번 diff에서
**해결**됐음을 실코드로 확인했다(아래 상세).

## 발견사항

- **[INFO]** metrics 관측 호출이 swallow 계약을 깨지 못하도록 자체 `try`/`catch` 로 보호됨
  (직전 라운드 지적 해결 확인)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
  - 상세: 직전 라운드 security.md 는 `this.metrics?.recordAuditWriteFailed(...)` 가 무보호라
    OTel Counter 가 던지면 `record()` 의 "절대 reject 하지 않는다" 계약이 깨지고 그 예외가
    12개+ 특권 CRUD producer(시크릿 회전/삭제/열람 포함)로 전파될 수 있다고 지적했다. 이번
    diff 는 `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 를 별도
    `try { … } catch { /* best-effort */ }` 로 감쌌다 — 관측 호출 자체가 swallow 계약을
    역행하는 새 실패 경로가 되는 것을 막는다. `audit-logs.spec.ts` 의
    `metrics.recordAuditWriteFailed` 가 throw 하는 회귀 테스트(파일 3, `'metrics 호출이
    던져도 삼킨다'`)로 고정되어 있다. INFO 로 남기는 이유는 "고쳐졌음을 기록"하기 위함이며
    조치 불필요.

- **[INFO]** 감사 실패 로그 메시지가 여러 필드를 이스케이프 없이 단일 자유 텍스트로 결합
  (CWE-117, log injection) — 직전 라운드 지적 잔존, diff 로 필드 수 확대
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:114-119`
  - 상세: `action`·`resourceType`·`resourceId`·`workspaceId`·에러 메시지를 개행/제어문자
    escaping 없이 템플릿 문자열로 이어 붙인다. 종전에는 이 catch 블록의 로그가 에러 문구
    하나였는데, 이번 diff 로 자유 텍스트에 삽입되는 필드가 4개 늘었다 — 값 자체가 새로
    사용자 제어 가능해진 것은 아니지만(action 은 닫힌 enum, resourceType 은 서비스가 고정한
    상수, resourceId/workspaceId 는 실측된 호출부 전부 UUID-shaped) 인터폴레이션 지점의
    수는 늘었다. `record()` 는 `resourceId: string`/`workspaceId: string` 로 열려 있어
    새 producer 가 검증되지 않은 자유 텍스트를 넘기면(현재는 관례로만 회피) 로그 위조로
    이어질 수 있는 구조는 그대로다.
  - 제안: 필수는 아니나(직전 라운드도 low priority 로 판단, RESOLUTION.md 미조치 대상에
    포함) 구조화 로깅(`logger.warn({ msg, action, resourceType, resourceId, workspaceId })`)
    또는 개행 제거 유틸로 전환하면 향후 producer 추가 시 관례 의존 없이 구조적으로 방어된다.

- **[INFO]** 신규 AST 가드가 타입 생성자 이름 접두사만 검사, 제네릭 인자(어느 리소스에
  바인딩됐는지)는 검사하지 않음 — 직전 라운드 지적 잔존
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125`
    (`findUnboundHelpers`, `s.actionType?.startsWith('AuditActionFor<')`)
  - 상세: 예컨대 `TriggersService.recordAudit` 의 `action` 타입이 실수로
    `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`(다른 리소스에 바인딩)로 복붙돼도 이
    가드는 `AuditActionFor<` 접두사만 보므로 통과시킨다 — 이번 PR 이 `auth_config` 에서 고친
    "맨 union" 결함과 같은 계열의, 더 은밀한 오귀속(다른 리소스의 액션을 자기 resourceType 으로
    기록)을 못 잡는다. 다만 `audit-action.const.ts` 의 `_NoCrossDomain` 빌드타임 불변식이
    "다른 도메인 액션이 그 타입에 **값으로** 들어오면" 컴파일이 깨지는 별도 방어선이라, 실제
    악용 표면은 "제네릭 인자 자체를 잘못된 상수로 선언"하는 복붙 실수로 좁다. 이번 diff 의
    목표(맨 union 클래스)는 정확히 잡는다.
  - 제안: 각 서비스 파일에서 `resourceType` 상수를 함께 추출해 `AuditActionFor<typeof X>` 의
    `X` 가 같은 파일의 `resourceType` 상수와 일치하는지까지 검사하면 닫힌다. 직전 라운드와
    동일하게 low priority.

- **[INFO, 긍정]** `auth_config` 감사의 리소스 오귀속 컴파일타임 차단 — OWASP A09(Security
  Logging and Monitoring Failures) 관점 개선
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:86`
    (`action: AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`)
  - 상세: 종전 `action: AuditAction`(맨 union)이라 `resourceType: 'auth_config'` 로 다른
    리소스의 액션(예: `trigger.created`)을 기록해도 컴파일러가 잡지 못했다(plan 문서가 실측
    프로브로 확인: auth-configs 는 tsc 0 에러, 대조군 schedules 는 TS2322). 사고 조사 시
    "누가 auth_config 를 회전/삭제/열람했는가"를 감사 로그로 재구성하는 신뢰가 이 타입 구멍에
    의존하고 있었는데, 이번 변경이 그 구멍을 컴파일타임에 닫는다. 특권 작업(시크릿
    회전/삭제/열람)의 감사 정합성을 강화하는 실질적 보안 개선.

- **[INFO, 긍정]** 감사 적재 실패 관측 강화 — 침묵하던 실패를 알람 가능하게
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:180-182`
    (`recordAuditWriteFailed`), `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-119`
  - 상세: 감사 로그는 "계정 탈취 후 조용한 시크릿 교체를 재구성한다"는 신뢰를 지탱하는데,
    종전에는 적재 실패가 `logger.warn` 한 줄뿐이라 비율/추세 알람이 불가능했고 그 로그조차
    무엇이 유실됐는지 안 적어 조사 시작점이 없었다. 신규 카운터
    (`clemvion.audit.write_failed{resource_type}`)와 상세 로그 필드가 이 갭을 닫는다.
    `resource_type` 라벨은 `clampLabel()`(64자, `PROMETHEUS_LABEL_MAX_LEN` 공유 상수)로
    cardinality 방어 — `recordExecutionError` 와 동일 상한을 공유하도록 리팩터되어 두
    메트릭의 방어 강도가 따로 갈릴 여지가 줄었다.

## 요약

이번 diff 는 새로운 인젝션·인증 우회·하드코딩 시크릿·암호화 약화를 도입하지 않았다.
오히려 두 가지 실질적 보안 개선이 있다 — (1) `auth-configs.service.ts` 의 감사 `action` 타입을
리소스 바인딩 타입으로 좁혀 특권 작업(시크릿 회전/삭제/열람) 감사 로그의 오귀속 가능성을
컴파일 타임에 차단했고, (2) 감사 적재 실패가 조용히 묻히던 것을 카운터 + 상세 로그로 가시화해
탐지·조사를 가능하게 했다(OWASP A09 개선). 직전 라운드에서 지적된 "관측 호출이 swallow 계약을
깰 수 있다"(W2)는 이번 diff 에서 자체 `try/catch` 로 실제로 해결됐음을 소스로 확인했다. 남은
발견사항은 모두 INFO 등급이며 직전 라운드에서도 low priority 로 판정·이월된 항목이다 — 로그
메시지의 구조적 이스케이핑 부재(현재 실측 호출부는 전부 UUID-shaped 라 즉시 악용 경로 없음)와
신규 AST 가드가 제네릭 인자까지는 검사하지 않는 판정 느슨함(별도의 빌드타임 `_NoCrossDomain`
불변식이 값 방향 오용은 이미 막고 있어 실제 악용 표면은 좁음). 즉시 조치가 필요한 결함은 없다.

## 위험도

LOW
