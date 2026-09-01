# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(문서 라이프사이클 1건 + 유지보수성 2건)만 발견됐고 전부 순수 가독성/위생 문제로 런타임·테스트 영향 없음. 직전 라운드(14:31:12) WARNING 5건은 이번 changeset에서 실측(jest 77/77 GREEN, tsc 0-에러, 뮤테이션 RED 확인 등)으로 해소가 확인됐다.

**forced 화이트리스트 확인**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 7명 전원이 `forced`(router_safety)로 지정됐고, 7명 전원의 결과 전문을 인라인으로 확보했다(프롬프트 명시 "forced 전원 결과 확보됨" + 실제 디스크 파일 7개 전수 존재 확인). 누락된 forced reviewer 없음 — 이번 위험도 판정에 강제 화이트리스트 미이행으로 인한 거짓 음성 여지는 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation/Plan 위생 | `plan/in-progress/spec-draft-audit-write-failed-metric.md`가 약속한 spec 반영(A-1~A-3, B, C)이 같은 changeset 안에서 이미 전부 적용됐는데도 frontmatter `status: in-progress`로 남고 `plan/in-progress/`에 잔류 — `plan-lifecycle.md`가 명시한 "완료 시 `complete/`로 이동" 미이행이며 이 저장소에서 이미 2회(`#1108`·`#1117`) 재발한 패턴의 3번째 사례 후보 | `plan/in-progress/spec-draft-audit-write-failed-metric.md:6`(frontmatter) | 이 PR 안에서 `git mv`로 `plan/complete/`로 이동 + `status`를 `applied`(또는 `complete`)로 갱신. `plan/in-progress/spec-sync-auth-gaps.md:128`의 상대링크도 `../complete/...`로 함께 정정 |
| 2 | Maintainability | `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 블록이 `BusinessMetricsService`의 기존 클래스 설명 JSDoc과 클래스 선언(`@Injectable()`) 사이에 삽입돼, 원래 JSDoc이 더 이상 어떤 선언에도 귀속되지 않는 붕 뜬 주석이 됨(IDE hover/TypeDoc에서 클래스 설명이 사라짐) | `codebase/backend/src/modules/metrics/business-metrics.service.ts:48-74` | 신규 블록을 클래스 JSDoc 위(예: import 아래 유틸리티 섹션)로 옮기거나, 클래스 JSDoc을 신규 블록 아래 `@Injectable()` 바로 위로 이동 |
| 3 | Maintainability | `business-metrics.service.spec.ts`에서 `recordRedisFailOpen` 테스트를 설명하던 주석이 신규 `recordAuditWriteFailed` 테스트 삽입으로 그 테스트(73행) 바로 위로 밀려나고, 정작 원래 대상인 `recordRedisFailOpen` 테스트(90행)는 설명 주석 없이 남음 | `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:62-94` | 62-66행 주석을 `recordRedisFailOpen` 테스트(90행) 위로 되돌리고, 67-72행 새 주석은 "형제 메서드가 같은 이유로 직접 테스트를 갖는다(위 참고)" 형태의 순방향 참조로 전환 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 확인됨(해소) | 1라운드 WARNING 5건(카운터 무테스트, metrics 호출 무보호로 swallow 계약 파괴 가능, 클램핑 상수 중복, CHANGELOG 누락, spec 카탈로그 미반영) 전부 이번 diff에서 해소 — jest 77/77 GREEN, tsc 0-에러, 뮤테이션(try/catch 제거→RED) 실측으로 재확인 | `audit-logs.service.ts:109-113`, `business-metrics.service.ts:66-71,180-182`, `business-metrics.service.spec.ts:73-88`, `CHANGELOG.md:3-42`, `spec/5-system/_product-overview.md`, `spec/data-flow/{1-audit,9-observability}.md` | 조치 완료, 추가 조치 불요 |
| 2 | 확인됨(해소) | `auth-configs.service.ts`의 `recordAudit` `action` 타입을 `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`로 좁혀 리소스 오귀속을 컴파일타임에 차단(OWASP A09 개선), 기존 46개 테스트 무수정 GREEN 유지 | `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:82-86` | 없음 — 긍정적 개선 |
| 3 | 보안(이월) | 감사 실패 로그가 `action`/`resourceType`/`resourceId`/`workspaceId`/에러 메시지를 이스케이프 없이 단일 자유 텍스트로 결합(CWE-117 소지) — 현재 실측 호출부는 전부 UUID-shaped라 즉시 악용 경로는 없음 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:114-119` | 구조화 로깅 또는 개행 제거 유틸 전환 권장(low priority, 이월) |
| 4 | 보안/테스트(이월) | 신규 AST 가드(`audit-action-binding-guard.ts`)가 `AuditActionFor<` 접두 문자열만 검사하고 제네릭 인자(어느 리소스에 바인딩됐는지)까지는 비교하지 않음 — 값 방향 오용은 별도 컴파일타임 `_NoCrossDomain` 불변식이 방어 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125` | 제네릭 인자와 파일 내 `resourceType` 상수 일치까지 검사하도록 확장(low priority) |
| 5 | 테스트(신규, 저위험) | repo-guard fixture에 "제네릭 인자는 있지만 잘못된 리소스에 묶인" 케이스가 없어 그 known limitation이 테스트로 고정되어 있지 않음 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts` | `WRONG_RESOURCE_BOUND_SOURCE` fixture를 추가해 현재 동작(known gap)을 명시적으로 고정 |
| 6 | 테스트(이월) | `findAuditHelpers`가 `ts.isMethodDeclaration` 형태만 인식 — 화살표 함수 클래스 필드로 선언된 `recordAudit`는 스캔에서 조용히 제외됨(현재 5개 helper는 전부 MethodDeclaration이라 실질 위험 낮음) | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:79-96` | fixture에 화살표 함수 형태 추가해 잡도록 확장하거나 최소 xfail로 문서화 |
| 7 | 유지보수성(이월) | `audit-logs.spec.ts`에 목적이 같은 서비스 조립 헬퍼 두 벌(`makeService`/`build`)과 동일한 `entry` 리터럴이 두 곳에 중복 | `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-94,96-102,146-152,154-167` | 헬퍼 통일 또는 공용 상수로 승격(급하지 않음, 서로 어긋나 있지 않음 확인됨) |
| 8 | 문서화(이월) | `AuditLogsService.record()` JSDoc이 이번에 추가된 관측 동작(카운터 증가, 로그 필드 4종 확장)을 언급하지 않음 — spec/plan에는 상세 서술돼 있어 실질 정보 손실은 아님 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` | `{@link BusinessMetricsService.recordAuditWriteFailed}` 등 한 줄 추가 |
| 9 | 요구사항(이월) | `audit-action.const.ts`의 `_NoCrossDomain` 가드 주석이 "서비스 4곳"이라 서술하나 이번 PR로 실제 5곳(auth-configs 추가)이 됨 — 가드 로직 자체는 `Set` 기반이라 개수 의존 없음 | `codebase/backend/src/modules/audit-logs/audit-action.const.ts`(`_NoCrossDomain` 주석) | 다음에 이 파일을 건드릴 때 "4곳"→"5곳" 정정(급하지 않음) |
| 10 | Scope(정보) | 두 독립 plan 항목(타입 바인딩 가드 + 적재실패 관측)이 여전히 한 커밋에 번들 / 클램핑 상수 공유를 위해 감사와 무관한 `recordExecutionError`도 같은 커밋에서 리팩터(단, 이 PR 자신이 만든 중복을 이 PR 안에서 바로 해소한 것이라 정당) | `plan/in-progress/spec-sync-auth-gaps.md:52,99`; `business-metrics.service.ts:59-71,132-134` | 조치 불필요, 유사 패턴 반복 시 커밋 분리 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. `auth_config` 리소스 오귀속 컴파일타임 차단 + 적재실패 관측 강화(긍정 개선). 로그 인젝션 이스케이프 부재·가드 제네릭 미검사는 저위험 이월 |
| requirement | NONE | 1라운드 WARNING 5건 전부 실측 해소 확인(jest 77/77, tsc 0, grep 대조로 helper 5곳·resourceType 12종 검증). 잔여 INFO 2건은 이월·저우선순위 |
| scope | LOW | 3개 커밋 모두 각자 주장 범위와 일치. 클램핑 상수 공유 리팩터는 이 PR 자신의 중복 해소라 정당. spec 변경은 planner 정규 경로(consistency-check 통과) |
| side_effect | LOW | swallow 계약 유지 확인(이중 try/catch 실측), DI/모듈 결합 순환 없음, `@Optional()` 하위호환, repo-guard는 읽기 전용 |
| maintainability | LOW | 매직넘버 상수화는 잘 됐으나 JSDoc/테스트 설명 주석이 신규 코드 삽입으로 원 대상에서 물리적으로 분리(WARNING 2건). 헬퍼 중복 등은 이월 INFO |
| testing | LOW | 1라운드 WARNING 2건을 뮤테이션(RED 확인)으로 재검증해 해소 확인. fixture에 "잘못된 리소스 바인딩" 케이스 부재 등 저위험 이월/신규 |
| documentation | LOW | spec 3파일·CHANGELOG 반영이 코드와 line-level 일치 확인. 다만 그 반영을 만든 draft plan 자체가 완료 상태로 이동되지 않음(WARNING) |

## 발견 없는 에이전트

없음 — 7개 reviewer 전원이 최소 1건 이상의 발견사항(대부분 INFO, 확인/이월 포함)을 보고했다. Critical은 전 에이전트에서 0건.

## 권장 조치사항

1. `plan/in-progress/spec-draft-audit-write-failed-metric.md`를 `plan/complete/`로 이동하고 `status`를 완료 상태로 갱신, `spec-sync-auth-gaps.md:128`의 상대링크도 함께 정정한다 (WARNING #1 — plan 라이프사이클 재발 방지).
2. `business-metrics.service.ts`의 클래스 JSDoc과 신규 `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 블록 순서를 정리해 JSDoc이 클래스 선언에 다시 귀속되도록 한다 (WARNING #2).
3. `business-metrics.service.spec.ts`에서 `recordRedisFailOpen` 설명 주석을 원래 대상 테스트 위로 되돌린다 (WARNING #3).
4. (선택, 저우선순위) 로그 구조화, AST 가드의 제네릭 인자 검사 확장, repo-guard fixture에 "잘못된 리소스 바인딩" 케이스 추가 — 급하지 않으며 기존에도 이월되던 항목.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (실행된 7명 전원이 forced — 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 무관(비-성능 변경) |
  | architecture | router 판단상 이번 diff와 무관 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음(diff는 애플리케이션 코드/문서) |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | 외부 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 동기화 대상 아님 |