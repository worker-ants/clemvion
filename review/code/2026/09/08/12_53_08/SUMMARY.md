# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(`CHANGELOG.md` 미갱신). 나머지는 전부 개선/정보성 관찰. router 가 강제 포함(router_safety)한 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 있어 강제 화이트리스트 미이행은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `CHANGELOG.md`가 이번 배치의 두 실질 변경(B-3: 전역 예외 필터 raw 표면 23505 오류가 500→409로 정정됨, B-4: `listMembers`가 검출 수준 방어에서 DB 레벨 강제 투영으로 승격됨)을 기록하지 않았다. 이 저장소는 직전 두 커밋(`08fbf133d`, `bfa124920`)에서 유사 성격 변경에 상세한 `## Unreleased` 항목을 남기는 강한 관례를 갖고 있으며, `CHANGELOG.md` 자체가 "개발 노트가 아니라 보안 공지"로 취급됨을 명시한다. | `CHANGELOG.md` (최상단), 관련: `codebase/backend/src/common/filters/http-exception.filter.ts:70`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` | `## Unreleased`에 B-3(raw 표면 23505 → 409 정정, 이전엔 500)과 B-4(`listMembers` 검출→강제 전환) 항목 추가. B-1/B-2/B-5~B-8은 순수 리팩터/테스트/harness 성격이라 전례상 CHANGELOG 불필요. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/부작용/DB/API계약 | 전역 예외 필터의 unique-violation 판정(`isPostgresUniqueViolation`)이 `instanceof QueryFailedError` 요구 없이 `err.code`/`err.driverError.code`만 검사하도록 넓어졌다. `GlobalExceptionFilter`는 `@Catch()` 전수 대상이라 앱 전역에 적용되는 변경. 응답 메시지는 고정 문구라 CWE-209 관점 안전, 실측 blast radius 0(전 서비스가 이미 자체적으로 23505를 가로챔), 신규 회귀 테스트 2건(23505→409 / non-23505→500)으로 양방향 고정됨. 다만 상태코드가 전역적으로 500→409로 바뀌는 동작 변경이므로 문서화 가치 있음. | `codebase/backend/src/common/filters/http-exception.filter.ts:70`, `codebase/backend/src/common/db/pg-error.ts:28` | 조치 불요(현재 안전, 테스트로 고정됨). 향후 이 분기를 확장할 때 비-Error 객체 매칭 폭을 재검토. 릴리스 노트에 "전역 unique-violation 매핑 확장" 한 줄 권장. |
| 2 | 성능/DB/보안 | `listMembers`가 `relations: ['user']`(User 전 컬럼 로드 후 JS 매핑)에서 DB 레벨 `select` 투영으로 전환됨 — 민감 컬럼이 애초에 로드되지 않아 방어가 검출→강제로 승격. `relations`+`select` 조합으로 단일 JOIN 유지, N+1 없음. 응답 wire 계약(6키)은 동일해 breaking change 아님. 신규 테스트가 "쿼리가 select로 좁혀 요청하는가"(DB축)와 "반환 키가 6개인가"(매핑축)를 분리 단언해, 투영을 되돌려도 매핑 단언만으론 못 잡는 함정을 막음. | `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` | 조치 불요(개선). 장기적으로 멤버 수가 매우 커지면 별도로 페이지네이션 검토(이번 범위 밖). |
| 3 | 유지보수성 | `production-build-devdep.spec.ts`에 거의 동형인 `it()` 블록 두 벌(`repo-guards`/`__test-utils__`)이 파라미터화 없이 존재. 파일 자신의 주석이 "세 번째 자리가 또 생긴다"고 이미 예견. | `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:59-64, 78-83` | `it.each(['repo-guards', '__test-utils__'])(...)` 또는 헬퍼 `expectExcludedFromBuild(dirName)`로 추출(이미 프로젝트 관례). |
| 4 | 성능 | 같은 스펙 파일 내 `resolveBuildFileNames()`가 `it`마다 독립 호출되어(현 3~4회) 매번 `tsconfig.build.json` 재파싱 + glob 재해석(805+ 파일 스캔). 테스트 스위트에만 영향, 프로덕션 무관. | `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` (describe 블록) | `describe` 최상단에서 1회 계산 후 공유하도록 리팩터(급하지 않음). |
| 5 | 성능 | `cmd_build()`에 신설된 두 typecheck ratchet(`check-backend-typecheck-ratchet.py && check-frontend-typecheck-ratchet.py`)이 순차 실행되어 로컬 `build` 단계 wall-clock이 증가(의도된 트레이드오프, 결함 아님). | `.claude/test-stages.sh:80-95` (`_cmd_typecheck_ratchets`, `cmd_build()` 호출부) | 급하지 않음. 반복 실행 빈도가 높으면 병렬 실행(`wait`) 고려. |
| 6 | 요구사항/테스트 | 신규 AST 가드의 `isWrappedByConflictCatch`가 실제 호출 여부가 아니라 `rethrowEndpointPathConflict` 식별자가 콜백 텍스트에 포함되는지만 검사한다. 파일 헤더 JSDoc이 "좁고 눈먼 술어"임을 명시하고 fail-safe(과탐) 방향을 택한 의도된 설계이며 대조군(`catchButNotWrapping`)이 일부 있음. 다만 "이름만 텍스트로 등장하고 실제 호출은 아님" 케이스의 대조군은 없음. | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (`isWrappedByConflictCatch`) | 차단 사유 아님. 필요 시 "이름만 등장·호출 없음" 대조군 fixture 추가로 회귀 고정 가능. |
| 7 | 테스트 | `integration-oauth.service.ts`의 `pgErrorConstraint()` 치환 2곳(cafe24/makeshop)에 대해 callsite 레벨에서 `driverError.constraint`(wrap된 표면, 실전에서 TypeORM이 실제로 주는 형태) 회귀 테스트가 없음 — flat 표면만 커버됨. 헬퍼 자체(`pg-error.spec.ts`)는 두 표면 모두 유닛 테스트로 보장되어 함수 단위 위험은 낮음. | `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1273, :1827` | `it.each`로 `driverError: { constraint: ... }` 형태 케이스 추가 권장(필수 아님). |
| 8 | 테스트 | `.claude/test-stages.sh`의 `_cmd_typecheck_ratchets()` → `cmd_build()` 배선 자체(실패 시 빌드 단계 전체가 비제로가 되는가)는 어떤 harness 자동 테스트도 검증하지 않음. 다만 이 저장소의 다른 `cmd_*` 조합도 동일하게 미검증이라 기존 관례와 일관됨. | `.claude/test-stages.sh:80, 95` | 필수 아님. plan 체크리스트가 수동 1회 검증을 이미 요구. 향후 `RUN_TEST_CONFIG` 스텁 패턴으로 배선 자체를 고정하는 것 고려. |
| 9 | 유지보수성 | `WorkflowVersionDetailProjection` 선언 위 JSDoc이 실제 타입 정의(4줄)의 5배 분량(20줄+). 저장소의 확립된 "근거를 코드 옆에 남긴다" 관례와 일치하나 누적되면 문서 대 코드 비율이 계속 커짐. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (타입 선언부 JSDoc, 대략 46-68행) | 지금 조치 불요. 다음에 만질 기회에 역사적 배경은 plan/review 링크로 축약 고려. |
| 10 | 문서화 | `production-build-devdep.spec.ts` 파일 최상단(describe 레벨) JSDoc이 최초 동기만 설명하고, 이후 두 차례(`shared/testing`, `__test-utils__`) 누적된 같은 패턴의 반복 이력을 요약하지 않음. 개별 테스트의 JSDoc은 각각 정확함. | `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` (파일 헤더) | 필수 아님. 다음 편집 시 "지금까지 3회 반복된 패턴" 한 줄 추가하면 이력이 한눈에 보임. |
| 11 | 범위(Scope) | `review/consistency/2026/09/08/12_21_11/**` 8개 산출물이 코드 변경과 같은 커밋에 포함됨 — CLAUDE.md의 `--impl-prep` 의무 절차 산출물이며 `review/**`는 커밋 대상 관례. 내용도 B-1~B-8 범위와 일치(`BLOCK: NO`, Critical/Warning 0). | `review/consistency/2026/09/08/12_21_11/SUMMARY.md` 외 7개 | 조치 불요, 정상 워크플로 산출물. |
| 12 | 범위(Scope) | B-1(`PROJECT.md`)/B-8(`workflow-versions.service.ts`, frontend `workflows.ts`) 변경에 상당한 JSDoc/문서 재작성이 동반되나, plan이 이를 명시적으로 요구했고 기존 문서화 관례와 문체가 일치. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` JSDoc, `PROJECT.md` 게이트 표 | 조치 불요. |
| 13 | API계약/부작용 | `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 백엔드 타입 개명은 저장소 전체에서 참조처가 정의 파일 자신뿐(소비처 0건, 구조적 타이핑이라 컨트롤러 영향 없음). 프런트엔드 동명 타입은 별도 미러 선언으로 이번 개명과 무관(JSDoc만 갱신). wire 응답 계약 변경 없음. | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69, :152` | 조치 불요. 두 타입을 실제로 합치려면 `Date` vs `string`, nullable 여부 등 계약 정합화가 선행되어야 함(이미 문서에 명시, 향후 추적 가능). |
| 14 | DB/부작용 | `tsconfig.build.json`의 `**/__test-utils__/**` exclude 확장 — 저장소 전수 검색 결과 프로덕션 코드에서의 import 0건 확인, 안전한 아티팩트 최소화(공급망 관점 방어적 개선). | `codebase/backend/tsconfig.build.json` (exclude 배열) | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | raw-surface 판정 확장은 정보노출 없음(고정 문구). B-3/B-4/B-6/B-7 전부 방어 강화 방향으로 확인. |
| performance | NONE | 핵심 리팩터는 O(1) 유지, `listMembers`는 성능 개선. 테스트 스위트 캐싱/병렬화 기회 2건은 INFO. |
| requirement | NONE | B-1~B-8 전부 계획서와 라인 레벨 일치. 관련 테스트 231건+ GREEN, 양쪽 typecheck ratchet 통과 실측 확인. |
| scope | NONE | 커밋 25개 파일 전부 B-1~B-8에 1:1 매핑, 스코프 이탈 없음. |
| side_effect | LOW | 전역 필터 매칭 폭 확대(의도됨, 실측 blast radius 0)가 유일한 주목 포인트. 나머지는 부작용 없음 또는 노출 축소 방향. |
| maintainability | LOW | `production-build-devdep.spec.ts` 반복 `it()` 파라미터화 여지, `WorkflowVersionDetailProjection` JSDoc 볼륨 과다(기존 관례와 일치). |
| testing | LOW | `pgErrorConstraint` wrap 표면 callsite 회귀 테스트 부재, `test-stages.sh` 배선이 자동 테스트로 미보호(기존 관례와 일관). 231건 실행 GREEN 확인. |
| documentation | LOW | `CHANGELOG.md` 미갱신(WARNING), `production-build-devdep.spec.ts` 파일헤더 누적 이력 미요약(INFO). 그 외 문서 밀도 매우 높고 정확. |
| database | NONE | SoT 통합·DB 투영·AST 래칫·e2e 전부 개선 방향. 마이그레이션 변경 없음, SQL 인젝션 표면 없음. |
| api_contract | LOW | 전역 상태코드 변경(500→409, blast radius 0)에 대한 문서화 권장이 유일한 주목 포인트. breaking change 없음. |

## 발견 없는 에이전트

없음 — 10개 에이전트 전원 최소 INFO 이상 발견을 보고함.

## 권장 조치사항

1. `CHANGELOG.md`에 `## Unreleased` 항목 추가 — B-3(전역 예외 필터 raw 표면 23505 오류 500→409 정정), B-4(`listMembers` 검출→강제 전환) 최소 기재 (WARNING 해소).
2. `production-build-devdep.spec.ts`의 반복 `it()` 블록을 `it.each`로 파라미터화해 세 번째 재발을 미리 차단.
3. `integration-oauth.service.ts`의 `pgErrorConstraint()` callsite 2곳에 `driverError.constraint`(wrap 표면) 회귀 케이스 추가 검토(실전에서 가장 흔한 표면).
4. (선택) `cmd_build()`의 두 typecheck ratchet 병렬화, `resolveBuildFileNames()` 테스트 스위트 내 캐싱으로 로컬 반복 실행 시간 단축.
5. (선택) 다음에 전역 예외 필터의 raw-surface 분기를 확장할 때 `isPostgresUniqueViolation`의 비-Error 객체 매칭 폭을 함께 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨 확인.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단(구체 사유 미제공, 이번 diff가 아키텍처 구조 변경을 포함하지 않는다고 판단한 것으로 추정) |
  | dependency | router 판단(구체 사유 미제공, 패키지 의존성 변경 없음) |
  | concurrency | router 판단(구체 사유 미제공, 동시성 관련 코드 변경 없음) |
  | user_guide_sync | router 판단(구체 사유 미제공, 사용자 가이드 영향 없음) |
