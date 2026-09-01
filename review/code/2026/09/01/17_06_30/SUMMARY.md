# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건(신규 AST 가드 `audit-action-binding-guard.ts`의 스캔 범위가 `recordAudit` 명명 패턴에만 좁게 걸려, 감사 로그 직접 호출 27건 중 22건이 가드 밖에 남음 — 현재 값은 모두 올바르나 구조적 사각지대). forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨, 강제 미이행 없음. 다수 reviewer가 리뷰 도중 워킹트리에서 일시적 뮤테이션(병렬 프로세스 추정)을 관측했으나 전부 재확인 결과 원상복구 상태 — 코드 결함 아님(§INFO #15 참고).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | 신규 AST 가드(`audit-action-binding-guard.ts`)가 `recordAudit` 명명 패턴을 쓰는 helper만 스캔한다. `AuditLogsService.record()` 직접 호출 27건 중 22건(7개 파일: executions/integrations/users/workspaces/workspace-invitations/auth/webauthn)이 이 패턴 없이 인라인 호출돼 가드 범위 밖에 남는다. 현재 이 22곳의 값은 모두 올바르지만, 이 PR이 "닫았다"고 서술하는 액션-리소스 오귀속 결함 클래스가 이 22곳에서는 구조적으로 여전히 재현 가능하다(TS가 `action`↔`resourceType` 불일치를 못 잡음). | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:21`(`AUDIT_HELPER_NAMES`) vs `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:79`(`record()`의 맨 `action: AuditAction`) | (a) 스캔 대상을 `auditLogsService.record(` 호출식 전체로 확장해 호출부의 `resourceType`/`action` 리터럴을 직접 비교하거나, (b) 최소한 CHANGELOG/가드 JSDoc/plan에 "recordAudit 명명 패턴 전용, 직접 record() 호출 22곳은 범위 밖"이라는 스코프 한계를 명시. PR을 되돌릴 필요는 없음(회귀 아님, 처리 대상 자체는 정확) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 감사 로그 메시지에 DB 드라이버 에러문구 및 `action`/`resourceType`/`resourceId`/`workspaceId`가 인터폴레이션되나, 전부 검증된 값(UUID·내부 상수)이라 로그 위조 표면 없음 | `audit-logs.service.ts` `record()` catch 블록 | 조치 불요 |
| 2 | 보안 | `recordAuditWriteFailed`의 cardinality 방어가 닫힌 유니온이 아니라 `clampLabel()`(64자 truncate)에 의존 — 모든 호출부가 내부 상수만 사용해 실질 방어는 존재 | `business-metrics.service.ts` | 조치 불요 |
| 3 | 보안 / 부작용 | `auth-configs.service.ts`의 `recordAudit` 타입 좁힘(`AuditActionFor`)은 컴파일타임 전용, private 메서드 호출부 5곳 모두 named-object 리터럴이라 런타임 영향 없음 — 감사 무결성 강화 방향 | `auth-configs.service.ts` `recordAudit` | 없음 |
| 4 | 보안 / 부작용 | 신규 정적 가드의 AST 스캔은 읽기 전용(`fs.readdirSync`/`readFileSync`), 부수 파일쓰기·환경변수 조작 없음 | `audit-action-binding-guard.ts` `collectSourceFiles()` | 없음 |
| 5 | 부작용 | `AuditLogsService` 생성자 `@Optional() metrics?` 추가는 모든 기존 호출부(4+1곳, positional 인자)와 하위호환. `BusinessMetricsService`는 `@Global()` 등록이라 순환의존 없음 | `audit-logs.service.ts` constructor | 조치 불요 |
| 6 | 요구사항 / 문서 | 코드 주석의 producer 개수 표현 "12개+"가 spec의 정확한 표기 "12개"와 다름(기능 영향 없음) | `audit-logs.service.ts:105`, `audit-logs.spec.ts:204` | "12개+" → "12개" 통일(선택) |
| 7 | 문서 | `record()` JSDoc이 이번 diff로 추가된 관측 동작(카운터 emit + 로그 4필드 확장)을 서술하지 않음 — 3~4라운드 연속 plan 이월 항목, 우선순위 판단으로 미조치 유지 | `audit-logs.service.ts:72-75` | 이미 `plan/in-progress/spec-sync-auth-gaps.md` 등재, 조치 불요 |
| 8 | 문서 / 유지보수 | `recordAuditWriteFailed` JSDoc 한 줄(158자)이 인접 줄 대비 눈에 띄게 김 — 순수 가독성, 기능 영향 없음 | `business-metrics.service.ts:179` | 조치 불요 |
| 9 | 유지보수 / 테스트 | `audit-logs.spec.ts` 신설 3개 테스트가 `build()` 헬퍼를 재사용하지 않고 인라인 조립(각기 다른 mock 형태 필요해 의도적) | `audit-logs.spec.ts:202,223,239` | 조치 불요 |
| 10 | 유지보수 | `extractActionType`/`extractBoundResourceText`가 순회 골격을 공유(얕은 구조적 유사성), 반환값이 달라 추출 이득 적음 | `audit-action-binding-guard.ts:162,247` | 조치 불요 |
| 11 | 테스트 | `recordExecutionError`에 `clampLabel` 대칭 테스트 부재 — 4라운드부터 plan 이월 항목, 신규 아님 | `business-metrics.service.spec.ts:54-56` | plan 등재됨, 조치 불요 |
| 12 | 테스트 | `findMisboundHelpers`가 `action`이 유니온 타입으로 선언된 경우를 판정하지 않고 건너뜀(현재 5개 helper 전부 단일 타입이라 미발동) — 신규 발견, 실질 위험 없음 | `audit-action-binding-guard.ts`(`extractBoundResourceText`) | 다음에 이 가드를 손볼 때 `UNION_BOUND_SOURCE` 류 fixture 추가 권장 |
| 13 | 범위 | 7라운드 유일 신규 커밋(`4b1172b9f`)이 CHANGELOG 보강 + fixture 주석 정정으로 국한, `codebase/` 실행 코드 무변경 | `CHANGELOG.md`, `audit-action-binding-fixture.ts:98` | 없음 |
| 14 | 범위 | `codebase/`+`spec/` 11파일이 6라운드 이후 변화 없음, `review/**` 산출물이 diff 대다수 차지(정상 관례) | - | 없음 |
| 15 | 프로세스 관측 (코드 결함 아님) | 리뷰 진행 중 워킹트리에서 일시적 뮤테이션이 복수 reviewer(side_effect·maintainability·documentation)에게 관측됨 — `record()` catch 내부 `try`/`catch` 소실, 생성자 `@Optional()` 제거 등. 병렬로 도는 다른 리뷰어/뮤테이션 검증 세션의 부수효과로 추정되며, 각 reviewer가 재확인한 결과 원상복구된 상태(프롬프트 diff·커밋 상태와 일치)임을 확인. 이 세션 어느 reviewer도 파일을 직접 수정하지 않았음 | `audit-logs.service.ts`(`record()` catch, constructor) | 코드 결함 아님. push/커밋 전 오케스트레이터가 `git status --short`로 워킹트리 clean 여부(또는 diff가 프롬프트와 일치하는지) 최종 확인 권장 |
| 16 | 유저가이드동기화 | doc-sync-matrix 21개 trigger 행 중 매칭 0건(frontend·nodes·expression-engine·warningCode/errorCode 미변경). `auth-configs.service.ts`는 `modules/auth/**`(세션·인가 흐름)와 다른 디렉토리이며 외부 인증설정(트리거/웹훅 api_key 등) 모듈임을 명시적으로 배제 확인 | - | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인증우회·하드코딩 시크릿·안전하지 않은 암호화 없음. 로그 인터폴레이션·cardinality 방어 모두 검증된 값 기반이라 실질 위험 없음 |
| requirement | LOW | AST 가드 스캔범위가 `recordAudit` 명명패턴에 좁아 직접 호출 22곳이 범위 밖(WARNING 1건). 핵심 요구사항 2가지는 코드·테스트·spec 3층 모두 정확 구현, 6라운드 뮤테이션 검증 재확인 |
| scope | NONE | diff 범위가 6라운드 이후 불변(11파일), 유일 신규 커밋도 문서/주석 정정에 국한 |
| side_effect | LOW | 생성자 시그니처 변경 하위호환 실측 확인, 신규 전역변수/네트워크/이벤트 계약 변경 없음. 워킹트리 일시적 뮤테이션 관측(프로세스, 코드결함 아님) |
| maintainability | NONE | 신규 결함 없음. 함수 짧고 단일책임, 네이밍 일관, 매직넘버 제거(64→`PROMETHEUS_LABEL_MAX_LEN`) |
| testing | NONE | 대상 스위트 40건 통과. 핵심 계약 2건(swallow 격리·`@Optional` DI)을 직접 뮤테이션·복원으로 재현 확인. union 타입 갭 1건 INFO(현재 미발동) |
| documentation | NONE | CHANGELOG·JSDoc·주석·spec 4자간 정합 재확인, 불일치 없음. 이월 INFO 2건은 plan 등재됨 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건, 갱신 대상 문서 없음 |

## 발견 없는 에이전트

해당 없음 — 8개 reviewer 전원이 최소 INFO 이상을 기록함(신규 Critical/WARNING은 requirement 1건).

## 권장 조치사항

1. (선택, 우선순위 중) `audit-action-binding-guard.ts`의 스캔 범위를 `record()` 호출식 전체로 확장하거나, CHANGELOG/가드 JSDoc/plan에 "recordAudit 명명 패턴 전용, 직접 `record()` 호출 22곳은 범위 밖"이라는 스코프 한계를 명시한다 — 가드의 커버리지 주장과 실제 범위 사이 괴리를 다음 사람이 오해하지 않도록.
2. push/커밋 전 `git status --short`로 워킹트리가 clean한지(또는 diff가 프롬프트와 일치하는지) 최종 확인한다 — 리뷰 세션 중 복수 reviewer가 병렬 프로세스로 추정되는 일시적 뮤테이션(내부 try/catch 소실, `@Optional` 제거)을 관측했으며 현재는 원상복구가 확인됐으나, 최종 커밋 시점 재확인이 안전하다.
3. (낮은 우선순위, 이미 plan 등재) `record()` JSDoc에 관측 동작(카운터·로그 확장) 한 줄 보강, `recordExecutionError`에 `clampLabel` 대칭 테스트 추가, "12개+" → "12개" 표기 통일.

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 6명 (사유는 `_routing_decision.json` 상세 미제공, 라우터가 이번 changeset과 관련성 낮다고 판단한 표준 카테고리)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 changeset은 감사 로그 관측성 추가(카운터 emit, 로그 필드 확장) + 타입 좁힘 + 정적 가드로, 성능 critical path 변경 없음(router 판단) |
  | architecture | 기존 모듈 구조·의존성 그래프 변경 없음(router 판단) |
  | dependency | 신규 외부 패키지 의존성 추가 없음(router 판단) |
  | database | 스키마/쿼리 변경 없음(router 판단) |
  | concurrency | 동시성 제어 로직 변경 없음(router 판단) |
  | api_contract | 외부 API 계약(요청/응답 스키마) 변경 없음(router 판단) |