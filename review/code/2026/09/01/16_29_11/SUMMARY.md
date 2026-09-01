# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 2건은 모두 "코드에 지금 살아있는 결함"이 아니라 (1) 감사 액션 리소스 바인딩 가드의 남은 회귀 표면(뮤테이션으로 실측 확인된 미검증 근거 포함), (2) plan 라이프사이클 위생(완료된 draft 가 `plan/complete/` 로 미이동) — 둘 다 코드 실행 경로에는 영향 없음. forced reviewer 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE / TESTING / MAINTAINABILITY | `audit-action-binding-guard` 의 `findUnboundHelpers` 가 `AuditActionFor<` **접두 문자열만** 검사하고 제네릭 인자(어느 리소스에 묶였는지)는 비교하지 않는다. "형태는 맞지만 잘못된 리소스로 묶인 `action`"(예: `auth_config` 서비스에 `AuditActionFor<'workflow'>`)은 가드도 `tsc --strict` 도 통과함을 뮤테이션으로 재현 확인(architecture: 저장소 밖 스크래치 mutant + 실제 `findUnboundHelpers` import 실행, 둘 다 EXIT=0/unbound=0; testing: 격리 tsconfig 로 동일 결과 재현). 이전 라운드 RESOLUTION 이 "`_NoCrossDomain` 이 이미 이 경로를 막는다"고 적은 근거는 이 재현 결과와 **상충** — `_NoCrossDomain` 은 `'trigger.created' extends AuditActionFor<'workflow'>` 라는 단일 하드코딩 조합만 검증할 뿐, 각 서비스가 자기 `resourceType` 과 일치하는 인자를 썼는지는 보지 않는다. 회귀 방지 fixture 도 없고 `plan/in-progress/spec-sync-auth-gaps.md` 체크리스트에도 미등재(형제 항목인 `clampLabel` 대칭 테스트·`login_history` 축은 등재됨). 현재 실제 5개 호출부는 전부 올바르게 바인딩돼 있어 지금 당장 살아있는 결함은 아님. | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:152-157` (`findUnboundHelpers`), `audit-action-binding-fixture.ts`, `codebase/backend/src/modules/audit-logs/audit-action.const.ts:111-142`(`_NoCrossDomain`), `plan/in-progress/spec-sync-auth-gaps.md` | (1) `audit-action-binding-fixture.ts` 에 "제네릭 인자는 있으나 잘못된 리소스"(`WRONG_RESOURCE_BOUND_SOURCE`) 케이스를 추가하고, 가드가 이를 **지금은 통과시킨다**는 사실을 실제 단언(`it`, skip 아님)으로 회귀 고정. (2) 각 서비스별 `_NoCrossDomain` 캐너리 확장(예: `_AuthConfigNoCrossDomain`) 또는 가드에 제네릭 인자 vs 파일 내 `resourceType` 상수 비교 로직 추가. (3) `plan/in-progress/spec-sync-auth-gaps.md` 미결 목록에 형제 항목과 같은 형식으로 등재 — `review/**` 는 SoT 가 아니므로 지금 기록해 두지 않으면 판단이 유실된다. (4) RESOLUTION 문서의 "`_NoCrossDomain` 이 막는다"는 근거 문장 자체를 정정. |
| 2 | DOCUMENTATION | `plan/in-progress/spec-draft-audit-resource-type-count.md` — "동반 정정" 체크리스트 5개 항목 전부 `[x]`, `spec/5-system/_product-overview.md`("실측 distinct 10종")·`spec/data-flow/1-audit.md`("12개 위치")에도 실제 반영 확인됨에도 frontmatter 가 여전히 `status: in-progress` 이고 `completed:` 필드 없이 `plan/complete/` 로 이동되지 않았다. 같은 PR 의 자매 draft(`spec-draft-audit-write-failed-metric.md`)는 정확히 이 절차(`status: applied`+`completed`+배너+이동+인입 링크 정정)를 이미 마쳤고, 그 절차 자체가 이 PR **2라운드 RESOLUTION(W1)** 에서 "저장소에서 두 번 재발한 패턴" 으로 지적·수정됐던 항목 — 이번이 **3번째 재발**. | `plan/in-progress/spec-draft-audit-resource-type-count.md`(frontmatter), `plan/complete/spec-draft-audit-write-failed-metric.md:161`(인입 링크), `plan/in-progress/spec-sync-auth-gaps.md:134`(인입 링크) | 이번이 최종 라운드로 확정되면 마무리 커밋에서: `plan/complete/` 로 `git mv`, `status: applied`+`completed: 2026-09-01` 갱신, 자매 문서와 동일한 "✅ 적용 완료" 배너 추가, `spec-draft-audit-write-failed-metric.md:161` 및 `spec-sync-auth-gaps.md:134` 의 인입 링크를 `../complete/`로 동시 정정. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `AuditLogsService.record()` catch 블록의 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId` 를 이스케이핑 없이 단일 문자열로 결합(구조적 로그 위조 CWE-117 방어 심층화 관점). 현재 4개 auth_config 호출부는 `resourceId` 가 전부 서버 생성 UUID 라 악용 경로 없음(secret 값이 로그에 실리는 경로도 없음 확인). | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch 의 `logger.warn(...)` | 필수는 아니나 구조화 로깅(`logger.warn({ action, resourceType, ... })`)으로 전환하면 향후 producer 확장에도 관례가 아닌 구조로 방어됨. |
| 2 | SECURITY | `recordAuditWriteFailed(resourceType: string)` 의 라벨 타입이 열린 `string` — `clampLabel()` 64자 클램핑이 있어 무제한 증식은 막지만 시그니처상 여전히 열려 있음. 현재 호출부(12개 producer)는 전부 코드 내 상수(distinct 10종)만 넘겨 악용 경로 없음. | `codebase/backend/src/modules/metrics/business-metrics.service.ts` `recordAuditWriteFailed()` | 조치 불요 — 코드 주석이 "`record()` 가 닫힌 유니온으로 좁혀지면 이쪽도 좁힌다"고 이미 예고. |
| 3 | SECURITY | 신설 repo-guard 3파일(`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`)은 파일시스템 읽기 전용, 스캔 범위(`MODULES_DIR`) 고정 — 공격 표면 아님. | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` | 없음. |
| 4 | DOCUMENTATION / REQUIREMENT | `AuditLogsService.record()` JSDoc 이 이번 PR 이 추가한 관측 동작(카운터 증가 + 로그 4필드)을 여전히 서술하지 않음 — 4~5라운드째 이월, `plan/in-progress/spec-sync-auth-gaps.md` 에 "미조치·우선순위 판단"으로 이미 명시 등재됨. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` 바로 위 JSDoc | 다음에 이 메서드를 손댈 계기가 있으면 한 줄 추가. 현재는 차단 사유 아님. |
| 5 | TESTING | `recordExecutionError` 의 클램핑에는 `recordAuditWriteFailed` 와 대칭인 65자 경계 테스트가 없음(뮤테이션으로 클램핑 제거해도 생존 여지) — 이미 `spec-sync-auth-gaps.md` 에 등재된 기존 추적 항목. | `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:54-60` (대조군 `:75-83`) | 다음 세션에서 대칭 테스트 추가. |
| 6 | SCOPE | 5라운드 유일 커밋(`a09b4aee6`)에 감사 로깅과 무관한 expression-engine 사전 결함 발견이 `plan/` 문서로만 번들됨. `codebase/packages/` 는 건드리지 않았고, 확립된 선례(`backend-lint-gate-broken-on-main.md`)를 그대로 따름 — 실질 위험 낮음. | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` | 조치 불요. 다음엔 별도 커밋으로 분리하면 가독성 개선. |
| 7 | MAINTAINABILITY | `business-metrics.service.ts:179` JSDoc 한 줄이 158자로 인접 줄(평균 ~100자)보다 눈에 띄게 길다(Prettier 는 블록 주석 산문을 재포장하지 않음). | `codebase/backend/src/modules/metrics/business-metrics.service.ts:179` | 문장 중간에 줄바꿈 추가. |
| 8 | MAINTAINABILITY | `audit-logs.spec.ts` 신설 테스트 3건이 바로 위 `build()` 헬퍼를 재사용하지 않고 `repo`/`service` 조립을 각각 인라인 반복 — 각 테스트의 `metrics` mock 동작이 서로 달라 발생한 의도적 트레이드오프에 가까움. | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:202,223,239` | 우선순위 낮음. `build()` 에 `metrics` 오버라이드 파라미터를 추가하면 흡수 가능. |
| 9 | TESTING | `audit-logs.spec.ts` 의 `metrics` mock 이 `as unknown as BusinessMetricsService` 캐스트라 `recordAuditWriteFailed` 에 새 필수 파라미터가 추가돼도 `jest.fn()` 은 타입 에러 없이 통과할 수 있음 — 저장소 전역 표준 관례이며 `record()` 가 이 메서드 하나만 호출하므로 실질 위험 낮음. | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:154-167` | 조치 불요. |
| 10 | SCOPE | `review/code/**`·`review/consistency/**` 프로세스 산출물이 누적 diff 파일 수의 절반 이상 차지 — 저장소 관례상 정상, 은폐된 확장 아님(1~4라운드부터 반복 확인). | `review/code/2026/09/01/**`, `review/consistency/2026/09/01/**` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. 로그 결합 방식(CWE-117 방어심층화)·라벨 카디널리티 열림 등 INFO만, 실제 악용 경로 없음 확인 |
| architecture | LOW | guard 가 "잘못된 리소스에 묶인 action" 을 못 잡음(WARNING) — 뮤테이션으로 실측, 이전 라운드 근거 문장과 상충 |
| requirement | LOW | 핵심 계약 전부 구현·테스트로 검증(35/35 GREEN, tsc 0-에러). plan lifecycle 미이동·JSDoc 서술 부재는 기존 등재된 INFO |
| scope | NONE | 5라운드 유일 커밋이 자기 오기산 정정에 정확히 국한. 부수 문서 등재는 확립된 선례 준수 |
| side_effect | NONE | 신규 부작용 없음. DI 하위호환·swallow chokepoint·repo-guard 읽기전용 전부 재확인 |
| maintainability | NONE | 가독성 수준 INFO 4건뿐(가드 gap 은 architecture/testing 과 동일 이슈 언급) |
| testing | LOW | 4라운드 fix 를 뮤테이션으로 재검증(전부 진짜). guard 제네릭 인자 미비교가 회귀 고정도 plan 등재도 안 됨(WARNING) |
| documentation | LOW | CHANGELOG·JSDoc·spec 카탈로그 정확성 유지. plan lifecycle 미이동(WARNING, 3번째 재발) |

## 발견 없는 에이전트

해당 없음 — 8개 reviewer 전원이 최소 INFO 이상 발견사항을 보고함.

## 권장 조치사항

1. `audit-action-binding-fixture.ts` 에 "형태는 맞지만 잘못된 리소스로 묶인 action" 케이스를 추가하고, 가드가 이를 **지금은 통과시킨다**는 사실을 실제 단언으로 회귀 고정한다. 각 서비스별 `_NoCrossDomain` 캐너리 확장 또는 가드의 제네릭 인자 비교 로직 추가를 검토한다.
2. RESOLUTION 문서의 "`_NoCrossDomain` 이 이미 이 경로를 막는다"는 근거 문장을 정정하고, `plan/in-progress/spec-sync-auth-gaps.md` 미결 목록에 이 항목을 형제 항목과 같은 형식으로 등재한다(review/** 는 SoT 아님 — 지금 기록하지 않으면 판단이 유실됨).
3. `plan/in-progress/spec-draft-audit-resource-type-count.md` 를 `plan/complete/` 로 이동하고 `status: applied`+`completed` 날짜 갱신, 배너 추가, 자매 문서·`spec-sync-auth-gaps.md` 의 인입 링크 2곳을 `../complete/` 로 동시 정정한다.
4. (낮은 우선순위) `AuditLogsService.record()` JSDoc 에 새 관측 동작(카운터+로그 4필드) 서술 추가, `recordExecutionError` 클램핑 대칭 테스트 추가 — 둘 다 이미 plan 에 등재된 이월 항목이므로 다음 세션에서 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음). 8명 중 `architecture` 만 router 자체 선택이었고 나머지 7명은 router_safety 로 강제 포함됨.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |
  | dependency | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |
  | database | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |
  | concurrency | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |
  | api_contract | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |
  | user_guide_sync | router 판단(이 changeset 특성상 비관련) — manifest 에 구체 사유 미제공 |