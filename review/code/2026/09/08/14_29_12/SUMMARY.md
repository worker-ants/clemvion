# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 3건(모두 "실동작 결함 아님, 문서/근거 서술이 실측과 어긋남" 성격). 14개 reviewer 전원(강제 포함 7명 포함) 결과가 인라인 전문으로 확보되어 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | REQUIREMENT | `listMembers` 를 DB 레벨 `select` 투영으로 전환했지만, "안전망은 이 e2e 뿐"이라고 예전부터 지목되어 온 `workspace-rbac.e2e-spec.ts` J 케이스의 JSDoc 은 옛 구현("`WorkspacesService.listMembers` 가 `relations:['user']` 로 `User` 를 전부 로드하고 지금은 JS 매핑만으로 걸러낸다")을 여전히 사실로 서술한다. 같은 PR 이 자매 파일 두 곳(`workspaces.service.spec.ts`, `user-entity-exposure.spec.ts`)의 동일 서술은 정정했는데 이 파일만 빠졌다. 동작 결함은 아니지만 다음 사람이 "지금 유일한 방어선은 JS 매핑뿐"이라는 인상을 받아 실제로는 존재하는 DB 투영 방어를 모른 채 위험도를 오판할 수 있다(stale-docstring 클래스). | `codebase/backend/test/workspace-rbac.e2e-spec.ts:590-593` | 취소선 + `> 정정 (2026-09-08)` 형식으로 "이제 DB 레벨 `select` 투영이 1차 방어, 이 e2e 는 투영이 넓어지거나 JS 매핑이 필드를 늘릴 때를 잡는 2차 방어선"이라고 정정 |
| 2 | TESTING | 이번 PR 에서 공용 함수로 승격된 `enclosingScopeName` 의 두 fallback 분기(감싸는 메서드가 없을 때 변수명 사용 / 변수도 없을 때 `'<module>'` 기본값)가 소비 가드(spec)를 통한 간접 실행만 되고 직접 단위 테스트·전용 fixture 로 결과를 단언받지 않는다. 같은 세션이 이 함수의 자매 분기(`isFn`)를 정확히 이 방법(뮤테이션 테스트)으로 죽은 코드로 잡아내 삭제한 직후라, 남은 두 분기도 검증 없이 남으면 같은 형태 재발 여지가 있다. 실질 위험은 낮음 — 위반 탐지 축(`EXPECTED_*` 배열 `toEqual`)은 fallback 오류와 무관하게 유효. | `codebase/backend/src/common/__test-utils__/source-scan.ts` 함수 `enclosingScopeName` | `source-scan.spec.ts` 에 `describe('enclosingScopeName', ...)` 추가해 (1) 메서드 있음 (2) 메서드 없고 변수만 있음 (3) 둘 다 없음 세 갈래를 인라인 소스 스니펫으로 직접 단언 |
| 3 | DEPENDENCY | `tsconfig.build.json` 의 세 번째 exclude(`**/__test-utils__/**`) 주석은 "이 5파일은 devDependency 를 끌어오지 않아 죽은 코드가 번들에 실릴 뿐"이라고 위험을 첫 번째 자리(`repo-guards/**`, 실제 devDependency 오염 위험)보다 약하게 규정한다. 그러나 같은 배치의 후속 커밋에서 그 exclude 로 보호받는 `source-scan.ts` 가 `import * as ts from 'typescript'`(devDependency-only 패키지)를 새로 추가해, "devDependency 프리" 전제가 현재 HEAD 기준 사실이 아니게 됐다. 실제 빌드 안전성은 깨지지 않았다(`production-build-devdep-guard.ts` 가 tsconfig 해석 기반 디렉터리 단위로 여전히 막음, git 이력상 노출 구간도 없음) — 다만 주석의 근거 서술이 실측과 어긋나 다음 편집자가 이 axis 를 안전하다고 오판할 위험이 남는다. | `codebase/backend/tsconfig.build.json:21-24` (근거) vs `codebase/backend/src/common/__test-utils__/source-scan.ts:42` (반증) | 주석의 "devDependency 를 끌어오지 않아" 문장을 취소선 처리하고 "현재는 `source-scan.ts` 가 `typescript` 를 import 하므로 이 axis 도 devDependency 격리 목적을 겸한다"로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY/DATABASE/PERFORMANCE/ARCHITECTURE/API_CONTRACT | `listMembers` 를 JS 단 매핑에서 DB 레벨 `select` 투영으로 전환 — `User` 민감 컬럼 방어가 "검출"(응답 형태 감시)에서 "강제"(쿼리 레벨 컬럼 제한)로 심화됨. 단일 JOIN 쿼리 유지(N+1 없음), 반환 wire 계약 불변, 신규 단위 테스트가 `select.user` 가 객체(불리언 아님)임을 별도 단언해 회귀 시 잡히도록 두 축 모두 고정 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` | 조치 불요 — 순수 개선 확인 |
| 2 | SECURITY/ARCHITECTURE/DEPENDENCY/DATABASE/CONCURRENCY/API_CONTRACT | Postgres 에러 판정을 `pg-error.ts` 단일 SoT(`isPostgresUniqueViolation`/`pgErrorConstraint`)로 통합 — `http-exception.filter.ts` 의 로컬 `isUniqueViolation`(QueryFailedError 요구)과 `integration-oauth.service.ts` 두 자리의 손-작성 constraint 추출을 모두 대체. DIP/DRY 개선, 동작 동치성 직접 대조 확인 | `codebase/backend/src/common/db/pg-error.ts`, `.../filters/http-exception.filter.ts:70`, `.../integrations/integration-oauth.service.ts` (두 콜사이트) | 조치 불요 |
| 3 | API_CONTRACT/DATABASE/CONCURRENCY/SIDE_EFFECT | `GlobalExceptionFilter` 의 unique-violation 판정이 `instanceof QueryFailedError` 요구 없는 duck-typing 으로 넓어짐 — raw 표면 23505 오류가 이제 전 엔드포인트에서 500 대신 409 로 응답. 정보 유출이 아니라 상태 코드 오분류 수정이며, 실측 blast radius 0(요청 경로에 raw query 없음), 양방향 회귀 테스트(23505→409/23502→500)로 고정 | `codebase/backend/src/common/filters/http-exception.filter.ts:70` | 조치 불요 — 의도된 수정, 관측성 손실 가능성만 팀 컨벤션에 한 줄 남길 가치 |
| 4 | ARCHITECTURE/MAINTAINABILITY/SIDE_EFFECT/DOCUMENTATION | 형제 AST 가드(`user-entity-exposure-guard.ts`)에 있던 "감싸는 스코프 이름 추출" 워커를 `source-scan.ts::enclosingScopeName` 공용 함수로 승격, `endpoint-path-conflict-wrap-guard.ts` 와 공유. 승격 과정에서 추가됐던 죽은 분기(`isFn` 우선순위)는 뮤테이션 테스트로 실측 확인 후 삭제됨 | `codebase/backend/src/common/__test-utils__/source-scan.ts` | 조치 불요 — 긍정 기록 |
| 5 | ARCHITECTURE/TESTING/CONCURRENCY | 신규 `endpoint-path-conflict-wrap-guard.ts`(+spec+fixture) — 트리거 `endpointPath` UNIQUE 충돌 캐치 래핑 누락을 감시하는 fitness-function 스타일 AST 가드. 최초 술어(특정 메서드만 검사)가 vacuous 였음을 실측해 "모든 save() 를 세고 화이트리스트 사유 요구"로 뒤집은 판단이 견고함. 읽기 전용 정적 분석이라 런타임 부작용 없음 | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`, `endpoint-path-conflict-wrap.spec.ts` | 조치 불요 |
| 6 | SECURITY/DATABASE/API_CONTRACT/CONCURRENCY | 신규 e2e(`webhook-trigger.e2e-spec.ts` B4) — 실 Postgres UNIQUE 제약을 실제로 밟아 409/`RESOURCE_CONFLICT`/`details:{field,code}` 계약과 드라이버 원문(`'duplicate key'`) 비노출을 동시에 검증. `spec/5-system/3-error-handling.md §1.10` 과 line-level 일치 확인 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` (B4) | 조치 불요 — 커버리지 개선. 순차 요청 2건 시나리오이며 실제 "동시 두 요청" race 재현은 아님(unit 레벨 mock 이 그 축을 담당, 범위 과장 없음) |
| 7 | SECURITY/DEPENDENCY/DATABASE | `tsconfig.build.json` 에 `**/__test-utils__/**` exclude 추가 — dist 산출물에서 테스트 전용 코드(5파일) 제거. 프로덕션 참조 부재를 grep 으로 직접 확인, `production-build-devdep-guard.ts` 가 구조적으로(디렉터리 단위) 보호 | `codebase/backend/tsconfig.build.json:20-28` | 조치 불요(단, 근거 문구는 위 WARNING #3 참고) |
| 8 | ARCHITECTURE/MAINTAINABILITY | cafe24/makeshop 두 spec 파일 간 `raceErrorSurfaces` 픽스처(약 26줄) 문자 그대로 중복 — provider 고유 로직이 아니라 provider 무관 "Postgres 에러 모양"이라 기존 provider-미러 중복 정책과 결이 다름. 직전 라운드에서 이미 지적·의도적 유예 확정, 이번 diff 에서도 재확인 | `codebase/backend/src/modules/integrations/integration-oauth.service.{cafe24,makeshop}.spec.ts` | 조치 불요, defer 유지 — 다음에 이 배열을 만질 기회에 공유 fixture 로 추출 검토 |
| 9 | ARCHITECTURE | `listMembers` 인라인 `select` 리터럴과 `workflow-versions.service.ts` 의 `CREATOR_PROJECTION` 상수가 값(3컬럼)만 우연히 겹침 — 직전 라운드가 저장소 전수 grep 으로 실측해 "서로 다른 바운디드 컨텍스트, 승격 시 결합 비용이 더 큼"으로 의도적 defer 확정, 재개 조건이 트래커에 등재됨 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-231` vs `.../workflow-versions/workflow-versions.service.ts:92` | 조치 불요 — 셋째 값-일치 사례 발생 시 재개 조건에 따라 공용 모듈 승격 검토 |
| 10 | ARCHITECTURE/SIDE_EFFECT/API_CONTRACT/DOCUMENTATION | `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 — 백엔드/프런트엔드 동명 타입 충돌(3라운드 연속 grep 오판 유발) 해소. 저장소 전체 참조 확인 결과 잔존 옛 이름 0건, 반환 타입·wire 계약 불변. 단, 두 wire 타입을 자동 동기화하는 계약 테스트는 여전히 부재(범위 밖으로 명시된 기존 부채, 이번 diff 가 악화시키지 않음) | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70,153` | 조치 불요 — 다음에 이 타입을 열 때 e2e 스냅샷/zod 스키마로 wire 형태 자동 검증 검토 |
| 11 | SCOPE | 4라운드째 이어지는 fix→review 루프(이 저장소가 이미 문서화한 패턴) — 이번 라운드 실질 신규 diff 는 81줄(코드 32줄+plan 49줄)뿐이고 직전 라운드 RESOLUTION 이 약속한 4건에 정확히 대응, 스코프 이탈·발산 신호 없음 | `plan/in-progress/spec-followups-batch-b.md` | 조치 불요 — 다음 라운드에서 Critical/Warning 0 유지 시 병합 준비 완료로 판단 가능 |
| 12 | PERFORMANCE/SIDE_EFFECT/TESTING | `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` 가 `cmd_build()` 에 순차(`&&`) 편입 — CI 전용 게이트를 로컬로 당겨온 의도된 트레이드오프로 로컬 build 시간 증가. harness 자체 배선(`&&` 체이닝)을 검증하는 unittest 는 없으나 기존 관례와 같은 성격이라 새 사각지대 아님 | `.claude/test-stages.sh` (`_cmd_typecheck_ratchets`, `cmd_build()`) | 급하지 않음 — 필요 시 두 ratchet 을 `&`+`wait` 로 병렬화 검토(1라운드 리뷰가 이미 제안, 3라운드째 미반영이나 defer 무방) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | listMembers DB 투영·pg-error SoT 통합 모두 방어 심화로 확인, 신규 시크릿/인젝션 표면 없음 |
| performance | NONE | listMembers 투영은 순수 개선, AST 가드는 O(파일 수) 유계, typecheck ratchet 순차 실행만 경미한 INFO |
| architecture | LOW | pg-error SoT·enclosingScopeName 승격 등 구조 개선 다수. 남은 두 결합(투영 리터럴 중복, WorkflowVersionDetail 미러)은 직전 라운드가 실측 후 의도적 defer 확정 |
| requirement | LOW | 8개 핵심 변경 모두 spec·실코드 line-level 일치 확인. WARNING: workspace-rbac e2e JSDoc 이 stale(옛 구현 서술) |
| scope | NONE | 4라운드 fix→review 루프 재현되나 실질 diff 81줄로 수렴 중, 계획 외 변경 없음 |
| side_effect | LOW | 전역 필터 duck-typing 확장(blast radius 0 재확인)과 typecheck ratchet 편입 외 새 부작용 없음, 저장소 뮤테이션 없음 확인 |
| maintainability | LOW | cafe24/makeshop 픽스처 중복(기존 defer)과 개명 JSDoc 분량(기존 관례) 외 새 이슈 없음, 3라운드 지적 대부분 해소 확인 |
| testing | LOW | WARNING: enclosingScopeName 두 fallback 분기 미검증. 그 외 신규/변경 테스트는 mock 충실도·격리·회귀 고정 축에서 규율 유지 |
| documentation | NONE | CHANGELOG·plan·JSDoc 모두 실 코드와 line-level 일치, 3라운드 WARNING 순차 해소 확인 |
| dependency | LOW | WARNING: `__test-utils__` exclude 근거 문구가 후속 커밋(`typescript` import 추가)으로 반증됨. 신규 외부 의존성 없음 |
| database | NONE | listMembers 단일 쿼리 유지·N+1 없음, pg-error SoT 통합 확인. 스키마/트랜잭션 변경 없음 |
| concurrency | NONE | race-backstop 패턴은 리팩터 전후 동작 동치, 새 race window 없음. e2e B4 는 순차 시나리오임을 스스로 명시(범위 과장 없음) |
| api_contract | LOW | raw 표면 23505→409 전역 확장(의도됨, blast radius 0) 외 breaking change 없음. §1.10 e2e 계약 검증 커버리지 개선 |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조, 트리거 매칭 파일 0건(순수 backend 내부 리팩터/방어 강화) |

## 발견 없는 에이전트

- user_guide_sync (매트릭스 21개 행 중 매칭 trigger 없음, "해당 없음"으로 명시적 결론)

## 권장 조치사항

1. `codebase/backend/test/workspace-rbac.e2e-spec.ts:590-593` 의 JSDoc 을 자매 파일 2곳과 동일한 방식(취소선 + `> 정정 (2026-09-08)`)으로 갱신 — "안전망은 이 e2e 뿐"이라는 문서가 이제 존재하는 DB 투영 방어를 가리지 않도록 한다.
2. `codebase/backend/tsconfig.build.json:21-24` 의 "devDependency 를 끌어오지 않는다" 근거 문구를 실측(현재 `source-scan.ts` 가 `typescript` import)에 맞게 정정 — 실제 빌드 안전성은 깨지지 않았으나 다음 편집자의 판단 축이 왜곡되지 않도록 한다.
3. `source-scan.spec.ts` 에 `enclosingScopeName` 의 두 fallback 분기(변수명 사용 / `'<module>'` 기본값)를 직접 단언하는 테스트를 추가 — 자매 분기(`isFn`)가 검증 부재로 죽은 코드가 됐던 것과 같은 재발 경로를 사전에 닫는다.
4. (급하지 않음) cafe24/makeshop `raceErrorSurfaces` 픽스처 중복은 다음에 그 배열을 만질 기회에 공유 fixture 로 추출, `.claude/test-stages.sh` 의 typecheck ratchet 2개는 필요 시 병렬화 검토 — 둘 다 현재 병합을 막을 사안 아님.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer 실행(14명).
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 프롬프트 및 실제 파일 존재 확인 결과 **전원 결과 확보됨**(누락 없음).
  - **제외**: 없음(router 미사용이므로 전원 실행).
