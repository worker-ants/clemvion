# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 신규 관측 메트릭(`clemvion.audit.write_failed`)이 spec NF-OB-07 카탈로그에 미반영(SPEC-DRIFT, 코드는 옳고 spec 갱신만 누락)되었고, 그 메트릭의 실제 구현(카운터 이름·라벨 키·64자 클램핑)이 어떤 테스트로도 실행되지 않는다는 두 건이 MEDIUM 등급 WARNING 으로 확인됐다. `record()` catch 블록 안 무방비 metrics 호출, 매직넘버 중복, CHANGELOG 누락도 WARNING 이나 저위험. forced(router_safety) 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보되어 강제 화이트리스트 미이행은 없음 — "clean" 오판 리스크 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| SD1 | SPEC-DRIFT | [SPEC-DRIFT] 신규 메트릭 `clemvion.audit.write_failed` 가 NF-OB-07 메트릭 카탈로그와 data-flow 문서 두 곳에 반영되지 않았다. `spec/data-flow/9-observability.md` 의 Rationale 이 스스로 "새 소비자를 배선할 때 유니온과 NF-OB-07 카탈로그 표를 동시에 넓히는 것이 규칙" 이라고 못 박고 있고, 선례(`clemvion.redis.fail_open`)는 전용 planner 턴으로 카탈로그를 갱신했다. 코드는 옳고(선례와 동일한 정당한 관측성 개선) spec 반영만 누락됨. | `spec/5-system/_product-overview.md:75, 79-87` (NF-OB-07 카탈로그 표·요약행), `spec/data-flow/9-observability.md:202-206`, `spec/data-flow/1-audit.md:21-23` ("실패는 로그로만 남는다" 문구가 이제 로그+카운터로 stale) | `plan/in-progress/spec-sync-auth-gaps.md` 에 등재 후 project-planner 턴으로 카탈로그 표 행 추가 + `9-observability.md` 불릿 갱신 + `1-audit.md` swallow 서술 세분화 |
| W1 | 테스트 커버리지 | `BusinessMetricsService.recordAuditWriteFailed` 의 실제 구현(카운터 이름 `clemvion.audit.write_failed`, `resource_type` 라벨 키, `.substring(0, 64)` 클램핑)이 어떤 테스트로도 실행되지 않는다. `audit-logs.spec.ts` 는 이 메서드를 `jest.fn()` 스텁으로만 검증해 "호출 여부"만 확인하고, `business-metrics.service.spec.ts` 에는 직접 테스트가 없다. 같은 파일의 형제 메서드(`recordExecutionError`, `recordRedisFailOpen`)는 전부 직접 테스트를 가지며, `recordRedisFailOpen` 테스트 옆 주석이 이 위험을 스스로 명문화하고 있다. | `codebase/backend/src/modules/metrics/business-metrics.service.ts:168-172`, 테스트: `business-metrics.service.spec.ts` (해당 메서드 부재) | `business-metrics.service.spec.ts` 에 형제 메서드와 동일 패턴의 직접 테스트 추가 — 카운터 `.add(1, {resource_type})` 호출 및 65자 이상 입력의 64자 클램핑 단언 |
| W2 | 부작용/신뢰성 | `AuditLogsService.record()` catch 블록 내부에서 신규 `this.metrics?.recordAuditWriteFailed(...)` 호출이 자체 try/catch 없이 무방비다. `record()` 의 존재 이유 자체가 "감사 실패가 절대 본 요청을 깨뜨리지 않는다"(swallow 계약)인데, 이 호출이 던지면 그 예외가 12개+ 특권 CRUD producer(`auth-configs` 의 시크릿 회전/삭제 포함) 전체로 전파돼 계약을 역행할 수 있는 새 실패 경로가 생긴다. 실측 OTel Counter 구현은 non-throwing 이라 발동 가능성은 낮고, 동일 무보호 패턴이 `idempotency.interceptor.ts` 에 선례로 이미 존재하나(이 PR 이 만든 새 패턴 아님), 이번 확장은 chokepoint 특성상 파급 범위가 더 넓다. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:104-110` | `this.metrics?.recordAuditWriteFailed(...)` 호출을 자체 `try { … } catch { /* best-effort */ }` 로 재차 감쌀 것. 동일 근거로 `idempotency.interceptor.ts` 의 기존 무보호 호출부도 후속 검토 권장 |
| W3 | 유지보수성 | Prometheus 라벨 클램핑 상한 `64` 가 `recordAuditWriteFailed`(신설)와 `recordExecutionError`(기존) 두 메서드에 매직넘버 리터럴로 중복돼 있다. 값의 의미(cardinality 방어 상한)는 JSDoc 서술로만 남아 있고 코드 레벨 공유 상수는 없다. | `codebase/backend/src/modules/metrics/business-metrics.service.ts:170` (신설), `:120` (기존) | `const PROMETHEUS_LABEL_MAX_LEN = 64` 또는 `clampLabel(value, max=64)` 헬퍼로 추출해 공유 |
| W4 | 문서화 | `CHANGELOG.md` 에 이번 변경의 "Unreleased" 서술이 없다. 동일 결함 클래스(경고 로그뿐이라 알람을 못 검)의 선례 `clemvion.redis.fail_open` 도입 PR 은 CHANGELOG 항목을 남겼고, 저장소는 보안/관측성 성격 fix 커밋에 거의 예외 없이 이 관례를 지켜왔다(git log 20건+ 확인). | `CHANGELOG.md` (이번 diff 에 미포함), 선례: `CHANGELOG.md:781` | `## Unreleased — 감사 로그 적재 실패를 알람 걸 수 있게 + auth_config 액션 타입 구멍` 섹션 추가, 커밋 본문 서사를 옮겨 적을 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `AuditLogsService` → `BusinessMetricsService` 신규 모듈 결합. 순환 의존 없음(실측), `@Optional()` + `@Global` MetricsModule 조합으로 audit-logs 핵심 책임이 metrics 가용성에 종속되지 않음. `idempotency.interceptor.ts` 선례와 결합 방식 일치. | `audit-logs.service.ts:8, 19, 104` | 없음(설계상 수용 가능) |
| 2 | 아키텍처(긍정) | 공통 팩토리 추출 대신 `AuditActionFor<T>` 팬텀 타입 + AST 기반 repo-guard 조합으로 리소스 바인딩 회귀를 구조적으로 방지 — 과도한 추상화를 피하면서 OCP 를 만족하는 fitness function. 기존 5개 가드와 동일한 3분할(`guard/fixture/spec`) 컨벤션 준수. | `auth-configs.service.ts:82-86`, `repo-guards/__tests__/audit-action-binding-guard.ts` | 없음(좋은 설계 판단) |
| 3 | 유지보수성/아키텍처 | 신규 가드가 메서드 **이름**(`recordAudit`)만으로 대상을 탐지하고, 그 helper 가 실제로 `AuditLogsService.record()` 에 위임하는지, `resourceType` 상수가 타입 바인딩과 실제 일치하는지는 검증하지 않는다. 설계 문서가 스스로 인지한 트레이드오프이며 이번에 고친 "맨 union" 결함 자체는 정확히 잡는다. | `repo-guards/__tests__/audit-action-binding-guard.ts:21, 66-96, 121-125` | 각 서비스의 `resourceType` 상수를 함께 추출해 `AuditActionFor<typeof X>` 의 `X` 정합까지 검사하면 닫힘. 우선순위 낮음 |
| 4 | 테스트/유지보수성 | 가드의 `findAuditHelpers` 가 `ts.isMethodDeclaration` 형태만 인식 — `recordAudit` 를 화살표 함수 클래스 필드로 선언하는 미래 서비스는 탐지 자체가 안 되며, `sites.length >= 5` 전제 단언도 이 누락을 못 잡는다(기존 5개가 그대로면 통과). 현재 5개 서비스는 전부 메서드 문법이라 실질 영향 없음. | `repo-guards/__tests__/audit-action-binding-guard.ts:78-96` | fixture 에 화살표 함수 형태 추가 + `ts.isPropertyDeclaration` 분기 고려 |
| 5 | 유지보수성 | `findUnboundHelpers` 의 바인딩 판정이 `startsWith` 문자열 접두 비교 — 제네릭 괄호 앞 공백이나 괄호 래핑 등 서식 변형에 이론상 취약. 현재 fixture 5종엔 정확히 동작. | `audit-action-binding-guard.ts:121-125` | `ts.isTypeReferenceNode` 기반 AST 판정으로 대체 고려(즉시 수정 불요) |
| 6 | 보안 | 신규 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId` 를 비구조화 문자열로 결합 — 제어문자 삽입 시 로그 위조(CWE-117) 가능한 구조적 방어 부재. 실측 호출부 값은 전부 UUID-shaped 검증되어 있어 즉시 악용 경로는 없음(관례 의존). | `audit-logs.service.ts:105-110` | 구조화 로깅 또는 개행/제어문자 제거 유틸 고려(low priority) |
| 7 | 문서화 | `AuditLogsService.record()` 공개 JSDoc 이 신규 관측 동작(카운터 증가, 로그 필드 확장)을 언급하지 않음 — "삼킨다"는 절반의 계약만 서술. | `audit-logs.service.ts:72-75` | JSDoc 에 관측 동작 한 줄 추가 |
| 8 | 요구사항 | `audit-action.const.ts` 의 `AuditActionFor` 사용처 "4곳" 주석이 이번 PR 로 5곳이 되어 stale. | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` | 다음 편집 시 "4곳"→"5곳" 정정(우선순위 낮음) |
| 9 | 스코프 | 독립된 두 plan 항목(공통 팩토리→가드 대체, 감사 실패 관측성)이 한 changeset 에 번들됨. plan 문서에 각 항목 근거가 투명히 기록되어 은폐된 확장은 아님. | `plan/in-progress/spec-sync-auth-gaps.md:52, 99` | 이상적으로는 별도 커밋/PR 분리 권장(실질 위험 낮음) |
| 10 | 스코프 | 원 계획("공통 팩토리 추출")이 신규 정적분석 인프라(3개 신규 파일, ~300줄)로 대체됨 — 판별 프로브(tsc 대조군)와 기존 가드 컨벤션 준수로 근거는 충분. | `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`, `.spec.ts` | 처방 전환 시 plan 제목 레벨 표시 권장(차단 사유 아님) |
| 11 | 유지보수성 | `audit-logs.spec.ts` 안에 서비스 조립 헬퍼가 `makeService`/`build` 두 벌 존재(이름·시그니처 스타일 상이), `entry` 픽스처도 두 describe 블록에 동일 리터럴로 중복. | `audit-logs.spec.ts` | 공유 헬퍼/상수로 통합(우선순위 낮음, 현재 사본 간 drift 없음 확인) |
| 12 | 유지보수성 | 신설/수정 메서드의 rationale 주석 비중이 로직 대비 큼 — plan 문서가 이미 등재한 "코드 내 서술형 근거 비대화" 패턴이 이번 PR 로 2개 파일에 더 확장됨. | `audit-logs.service.ts:97-104`, `business-metrics.service.ts:147-167` | 기존 plan 항목 범위를 이 두 파일로 확장해 정리 대상 등재 |
| 13 | 데이터베이스 | `audit_log` 적재는 여전히 본 트랜잭션과 분리된 단독 `save()` + swallow — 기존 의도된 설계(특권 작업이 감사 DB 장애로 실패하면 안 됨)이며 이번 diff 는 그 유실을 "보이게" 만드는 방향으로만 개선. 신규 DB 리스크 없음. | `audit-logs.service.ts:85-111` | 조치 불요(문서화·테스트됨). 향후 유실 허용 불가 판단 시 outbox 패턴 고려(범위 밖) |
| 14 | 신뢰성(확인) | `AuditLogsService` 생성자 신규 파라미터(`@Optional() metrics?`)는 하위 호환 확인됨(전수 `new AuditLogsService(` grep, 두 테스트 파일만 해당·대응됨). `AuthConfigsService.recordAudit` 타입 좁힘은 `private`+컴파일 타임 전용이라 런타임/DB 영향 없음. 신규 가드 스크립트는 읽기 전용 확인(REPO_ROOT 5단계 수동 검산). | `audit-logs.service.ts:19`, `auth-configs.service.ts:86`, `audit-action-binding-guard.ts:38-57` | 없음(확인 목적) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. catch 블록 무보호 metrics 호출·로그 위조 구조적 방어 부재·가드 제네릭 인자 미검사 (전부 INFO) |
| architecture | LOW | 신규 모듈 결합 안전(순환 없음), 가드 설계 긍정 평가. swallow 경계 내 무보호 호출·가드 이름 기반 탐지 범위 (INFO) |
| requirement | MEDIUM | [SPEC-DRIFT] NF-OB-07 카탈로그 미반영, `recordAuditWriteFailed` 미테스트 (WARNING 2건) + `AuditActionFor` stale 주석·가드 화살표함수 사각지대 (INFO) |
| scope | LOW | 두 독립 plan 항목 번들, 처방 전환(팩토리→가드) — 둘 다 plan 근거 충분해 실질 위험 낮음 |
| side_effect | LOW | catch 블록 무보호 metrics 호출이 swallow 계약 역행 가능성(WARNING) 외 시그니처 변경 전부 하위호환 확인 |
| maintainability | LOW | 클램핑 상수 64 중복(WARNING) 외 테스트 헬퍼 중복·가드 문자열 매칭 취약성·주석 비대화 (INFO) |
| testing | LOW | `recordAuditWriteFailed` 무테스트(WARNING) 외 가드 화살표함수 사각지대·헬퍼 중복 (INFO). 기존 스위트 회귀 없음(tsc/jest 실측 GREEN) |
| documentation | MEDIUM | NF-OB-07 카탈로그 미반영, CHANGELOG Unreleased 누락 (WARNING 2건) + record() 독스트링 불완전 (INFO) |
| database | NONE | 신규 DB 리스크 없음. 기존 swallow 설계 유지, 컴파일타임 전용 타입 변경 확인 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원 최소 1건 이상(대부분 INFO)을 보고함. 단 `database` 는 위험도 NONE(신규 리스크 없음 판정)이며 문제성 발견은 없음.

## 권장 조치사항

1. **[SPEC-DRIFT]** `project-planner` 턴으로 `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 표 + `spec/data-flow/9-observability.md` + `spec/data-flow/1-audit.md` 를 `clemvion.audit.write_failed` 반영해 갱신 (SD1)
2. `business-metrics.service.spec.ts` 에 `recordAuditWriteFailed` 직접 단위 테스트 추가 — 카운터/라벨/64자 클램핑 단언 (W1)
3. `AuditLogsService.record()` catch 블록 안 `metrics?.recordAuditWriteFailed(...)` 호출을 자체 try/catch 로 재차 감싸 swallow 계약 강화 (W2)
4. Prometheus 라벨 클램핑 상한을 이름 있는 상수/헬퍼로 추출 (W3)
5. `CHANGELOG.md` 에 Unreleased 항목 추가 (W4)
6. (낮은 우선순위) 가드의 화살표 함수 형태 탐지 사각지대 보강, `resourceType` 정합 검사 확장, 테스트 헬퍼 중복 정리, `record()` JSDoc 관측 동작 서술 추가

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database` (9명)
  - **제외**: 아래 표 (5명). 개별 사유는 라우팅 결정 메타데이터에 상세 텍스트로 포함되지 않아, 이 diff(백엔드 audit/metrics 서비스 로직 + 정적 가드 신설, 외부 API/DB 스키마/동시성/성능 표면 미변경) 특성상 router 가 비대상으로 판단한 것으로 추정된다.
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이 diff 는 핫패스 성능 특성(쿼리·알고리즘 복잡도) 변경 없음 — router 판단 |
  | dependency | 신규 외부 패키지 의존성 추가 없음 — router 판단 |
  | concurrency | 동시성 제어(락·트랜잭션 경계) 변경 없음 — router 판단 |
  | api_contract | 공개 API 계약(REST/GraphQL 스펙) 변경 없음 — router 판단 |
  | user_guide_sync | 사용자 대면 문서/가이드 영향 없음(내부 관측성·타입 안전성 변경) — router 판단 |