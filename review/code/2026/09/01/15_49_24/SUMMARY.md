# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(코드 결함 아님 — 이전 라운드 리뷰 산출물 자체의 미검증 인용/부정확 서술). 감사 로깅 관측성 신설 + `auth_config` 액션 타입 바인딩 수정 + AST 정적 가드 신설은 4라운드 재검증 결과 기능·보안·문서 전 축에서 안정적이며, forced 화이트리스트(security·architecture·requirement·scope·side_effect·maintainability·testing·documentation) 7건 전원 결과 확보됨(`requirement` 는 STATUS 라인이 `no_status` 였으나 인라인 전문이 존재해 정상 반영 — 화이트리스트 미이행 아님).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 1라운드 리뷰 산출물 `review/code/2026/09/01/14_31_12/architecture.md` 에 검증되지 않은 인용("가드의 한계가 설계 문서에 이미 트레이드오프로 명시됨" — 대상 3파일 grep 결과 0건으로 반증)과 부정확한 스캔 범위 서술("audit-logs/ 는 스캔 대상에서 자연히 제외됨" — 실제로는 `MODULES_DIR` 전체를 재귀 스캔하되 메서드 이름 필터로 걸러지는 것)이 잔존. 같은 PR 안에서 동일 결함 클래스가 `RESOLUTION.md` 2건에서는 이미 정정됐지만 `architecture.md` 자신은 한 번도 수정되지 않음(`git log` 확인, 생성 커밋 1개뿐) | `review/code/2026/09/01/14_31_12/architecture.md:54-75` | 이번 라운드(`15_49_24`) SUMMARY 또는 최종 아카이브 시점에 1라운드 `architecture.md` 두 항목이 사실과 다름을 정정 기록. 향후 리뷰 산출물에서 "설계 문서가 이미 명시한다" 류 주장은 작성 전 grep 으로 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `AuditLogsService.record()` 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId` 를 이스케이핑 없이 문자열 결합 — 구조적 로그 위조(CWE-117) 방어가 코드 레벨엔 없음. 단 12개 producer 전수 확인 결과 `resourceId`는 전부 서버 생성 DB id, `workspaceId`는 세션 컨텍스트 유래라 현재 악용 가능 경로 없음 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:114-119` | 구조화 로깅(`logger.warn({ msg, action, resourceType, ... })`)으로 전환하면 향후 producer 오용에도 구조적으로 방어됨 |
| 2 | security / architecture / requirement / maintainability | 신규 AST 가드 `findUnboundHelpers` 가 `AuditActionFor<` 접두 문자열만 검사하고 제네릭 인자(어느 리소스에 묶였는지)는 비교하지 않음 — 예: 다른 리소스 타입으로 잘못 바인딩돼도 접두사만 맞으면 통과. 단 `_NoCrossDomain` 컴파일타임 가드(`tsc --noEmit` 0에러 확인)가 이미 다른 도메인 액션의 대입 자체를 차단해 실제 발생 표면은 좁음 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157` | 각 서비스의 `resourceType` 상수를 함께 추출해 `AuditActionFor<X>` 의 `X` 가 동일 파일의 `resourceType` 상수와 일치하는지까지 비교. 우선순위 낮음 |
| 3 | maintainability | 신규 AST 가드 내부에서 `Identifier` 타입 좁힘이 함수 경계(`auditHelperParams` → `visit`)를 넘으며 무검증 캐스트(`(node.name as ts.Identifier).text`)로 다시 넓혀짐 — 가드 자신이 방지하려는 "구조적 불변식이 조용히 깨지는" 패턴과 같은 결. 현재 fixture 5종으로는 실제 버그 아님 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:89, 105-126` | `auditHelperParams` 가 `{ name: ts.Identifier; parameters }` 형태로 좁혀진 노드 자체를 반환하도록 리팩터해 캐스트 제거. 낮은 우선순위 |
| 4 | maintainability | 3라운드가 vacuous 테스트를 고치며 추가한 테스트가 기존 테스트와 거의 동일한 시나리오("metrics 없이 저장 실패해도 삼킨다")를 세 번째 임시 조립 스타일(인라인 `new AuditLogsService(repo)`)로 중복 — 기존 `makeService`/`build` 두 갈래 불일치를 완화가 아니라 확장 | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:239-247` (비교 대상 `:88-108`) | 중복 테스트 제거하거나 `makeService` 헬퍼 재사용. 급하지 않음 |
| 5 | testing | `clampLabel` 공유 리팩터가 스스로 명시한 근거("한쪽만 바뀌면 두 메트릭 방어 강도가 조용히 갈린다")가 `recordExecutionError` 쪽에서는 검증되지 않음 — 직접 뮤테이션(클램핑 호출 우회)으로 확인한 결과 해당 스위트 11/11 **GREEN 생존**(경계 미고정) | `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`recordExecutionError`), `business-metrics.service.spec.ts:54-60` | `recordExecutionError` 에도 65자 입력 → `toHaveLength(64)` 형제 테스트 추가해 대칭적으로 고정 |
| 6 | testing | AST 가드의 `AuditHelperSite.line` 단언이 `toBeGreaterThan(0)` 뿐이라 오프바이원 오류(예: `+1` 누락)를 못 잡음 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding.spec.ts:772` | fixture 의 알려진 줄 번호로 `toBe(N)` 단언 강화 |
| 7 | requirement / documentation | `AuditLogsService.record()` JSDoc 이 이번 PR 이 추가한 관측 동작(카운터 증가, 로그 4필드 확장)을 언급하지 않음 — "삼킨다"는 절반만 서술. 3~4라운드 연속 "우선순위 판단으로 유예"된 이월 항목, 재발 아님 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` | 다음에 이 메서드를 건드릴 계기에 JSDoc 한 줄 추가. `plan/in-progress/spec-sync-auth-gaps.md` 에 짧게 등재해 코드 리뷰 산출물에만 남지 않도록 권장 |
| 8 | scope | 두 독립 plan 항목(`recordAudit` 타입 바인딩 가드 + `audit_log` 적재 실패 관측성)이 여전히 첫 커밋(`9a2e860dc`) 한 곳에 번들 — 3라운드 연속 재확인, 은폐된 확장 아님 | `plan/in-progress/spec-sync-auth-gaps.md:52, 99` | 조치 불필요 — 기록으로만 유지 |
| 9 | user_guide_sync | `auth-configs.service.ts`(외부 연동 인증정보 모듈)와 `codebase/backend/src/modules/auth/`(사용자 로그인/세션 모듈)의 이름 유사성 때문에 `auth-session-flow-change` trigger 오탐 위험이 있었음 — `ls` 로 별개 모듈임과 이번 변경이 타입 좁히기뿐(런타임 무변화)임을 확인해 오탐 회피 | `.claude/config/doc-sync-matrix.json` (`auth-session-flow-change` 행) | 조치 불필요 — 확인 목적 기재 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 로그 구조화 부재(CWE-117 방어심층, 실제 악용경로 없음), 가드 제네릭 인자 미비교 — 전부 INFO. `auth-configs` 타입 좁힘·`@Optional` metrics 이중 try/catch 는 개선으로 확인 |
| architecture | LOW | **WARNING 1건**: 1라운드 `architecture.md` 산출물에 미검증 인용·부정확한 스캔범위 서술 잔존(코드 결함 아님). 코드 자체는 OCP·레이어 분리·순환의존 없음 재확인 |
| requirement | NONE | Spec 3문서(`_product-overview.md`, `1-audit.md`, `9-observability.md`) line-level 일치, 이전 3라운드 누적 Warning 10건 전부 해소 재검증(35 tests 통과, tsc 0에러). JSDoc 이월 항목만 INFO |
| scope | LOW | 5개 커밋 전부 자기 범위 일치, 3R 신규 커밋도 원 changeset 자신의 결함 수정에 국한. RESOLUTION.md 사후 정정은 원문 보존 방식이라 은폐 아님 |
| side_effect | LOW | swallow 계약 단일 chokepoint 가 이중 try/catch 로 안전, 생성자/메서드 시그니처 변경 전부 하위호환(`@Optional`/`private`) 확인. 신규 OTel 카운터는 기존 파이프라인 정상 확장 |
| maintainability | LOW | 신규 vacuous-fix 테스트가 세 번째 조립 스타일로 기존 테스트와 중복, AST 가드 내부 무검증 캐스트 — 둘 다 INFO, 즉시 버그 아님 |
| testing | LOW | `clampLabel` 대칭 테스트 누락을 뮤테이션으로 실증(GREEN 생존), 가드 line 단언 약함 — 둘 다 INFO. 핵심 로직(swallow, DI, 바인딩)은 촘촘한 뮤테이션 검증 통과 |
| documentation | NONE | 이전 3라운드 WARNING 7건 전부 실제 반영 재확인(카탈로그·CHANGELOG·JSDoc 귀속·plan 이동·링크). JSDoc 이월 항목만 INFO |
| user_guide_sync | NONE | 매트릭스 20개 trigger 전수 대조, 유일 매칭(`spec-major-change`)은 이미 같은 changeset 안에서 co-update 완료. frontend 파일 변경 0건 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 WARNING/INFO 를 기록했다(대부분 "정상 확인/기존 판정 재확인" 성격이며 신규 Critical/Warning 급 코드 결함은 없음).

## 권장 조치사항

1. `review/code/2026/09/01/14_31_12/architecture.md` 의 미검증 인용·부정확한 스캔범위 서술을 정정 기록(가장 최근 라운드 SUMMARY 또는 아카이브 시점에 블록쿼트로 추가) — 유일한 WARNING.
2. `recordExecutionError` 에 `clampLabel` 경계값(65자 → `toHaveLength(64)`) 대칭 테스트 추가 — 뮤테이션으로 실증된 커버리지 공백.
3. (선택, 낮은 우선순위) AST 가드 `findUnboundHelpers` 가 `resourceType` 제네릭 인자까지 비교하도록 확장, `auditHelperParams` 가 좁혀진 노드를 직접 반환하도록 리팩터, `AuditHelperSite.line` 단언을 `toBe(N)` 으로 강화, `audit-logs.spec.ts` 의 세 번째 조립 스타일 중복 제거 — 전부 즉시 조치 불요, 다음 확장 계기에 함께 정리.
4. `AuditLogsService.record()` JSDoc 에 관측 동작(카운터+로그 확장) 한 줄 보강 — 3~4라운드 연속 이월, `plan/in-progress/spec-sync-auth-gaps.md` 에 등재해 가시성 확보 권장.

이 changeset 은 위 항목들이 전부 INFO/1건의 문서성 WARNING 수준이라 **push 차단 사유 없음**.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨(`requirement` 는 STATUS 라인 `no_status` 였으나 인라인 전문 존재로 정상 반영, 누락 아님)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 changeset(감사 로깅 관측성+타입 좁힘+정적 가드) 과 무관 |
  | dependency | 신규/변경 외부 의존성 없음 |
  | database | 스키마/쿼리 조립부 변경 없음(TypeORM 파라미터 바인딩 그대로) |
  | concurrency | 동시성 제어 로직 변경 없음 |
  | api_contract | API 표면(엔드포인트/요청·응답 스키마) 변경 없음, 서비스 계층 타입 좁힘뿐 |