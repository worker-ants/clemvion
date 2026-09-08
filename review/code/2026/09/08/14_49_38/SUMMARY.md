# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음(전 14개 reviewer 전문 확보, forced 화이트리스트 전원 결과 확보됨). `side_effect`·`maintainability` 두 reviewer 가 LOW 로 판정했고 나머지 12개는 NONE. 실질 동작 결함은 5라운드 누적 검토 내내 0건이며, 이번 라운드 신규 지적도 전부 INFO(관찰/확인) 수준이다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/DB | `WorkspacesService.listMembers` 를 `relations`+JS `.map()` 수동 투영에서 TypeORM `select` 중첩 투영으로 전환 — 민감 `User` 컬럼이 애초에 DB→앱 경로에 오르지 않도록 방어를 "검출"에서 "강제"로 승격(응답 wire 6키는 불변, `assertMembership` 인가 체크 유지 확인). `relations`(배열)+`select`(중첩 객체) 조합은 TypeORM 0.3.31 소스 대조로 정상 지원 경로임을 확인 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`) | 조치 불요 — 보안/아키텍처 개선. 머지 전 `workspace-rbac.e2e-spec.ts` J. 실측 그린 1회 확인 권고(database) |
| 2 | 요구사항(SoT 미등재) | 위 DB-레벨 `select` 투영 패턴(`WorkflowVersionsService.findOne` 이어 2번째 사례)이 `spec/1-data-model.md ## Rationale` 표에 아직 정식 등재되지 않음 — 근거가 코드 주석에만 있음 | `spec/1-data-model.md ## Rationale`, `workspaces.service.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 project-planner 담당 오픈 항목으로 등재됨 확인 — developer 턴 추가 조치 불요 |
| 3 | Security/Concurrency/API | `GlobalExceptionFilter` 의 unique-violation 판정을 로컬 `isUniqueViolation`(QueryFailedError-wrap 표면만)에서 SoT `isPostgresUniqueViolation`(raw+wrapped 두 표면)으로 교체 — raw-surface `23505` 가 이제 409(기존 500)로 매핑됨. blast radius 0 실측(CHANGELOG) + 양방향 회귀 테스트(23505→409, 23502→500 유지)로 고정. 마스킹 메시지는 그대로 고정 문구 유지(정보 노출 아님, 상태코드 정합성 수정) | `codebase/backend/src/common/filters/http-exception.filter.ts` | 조치 불요 — 문서화·회귀 테스트 완비 |
| 4 | 아키텍처/의존성 | `integration-oauth.service.ts` cafe24/makeshop 두 자리의 손-작성 constraint 추출을 `pg-error.ts` 의 `pgErrorConstraint()` 로 치환 — 동작 동등성 확인(null/undefined 처리 포함), 순수 중복 제거 | `codebase/backend/src/modules/integrations/integration-oauth.service.ts` | 조치 불요 |
| 5 | 아키텍처/테스트 | 형제 AST 가드(`user-entity-exposure-guard.ts`, 신규 `endpoint-path-conflict-wrap-guard.ts`) 간 중복이던 스코프 이름 해석 로직을 `source-scan.ts` 의 `enclosingScopeName` 으로 승격 — 직전 라운드 WARNING 을 정확히 해소. 죽은 분기(`isFn`)는 뮤테이션으로 실측 후 삭제, 실재 갈래(변수 fallback·`'<module>'`)엔 신규 테스트 추가. 다만 `source-scan.ts` 자체는 8개 축의 책임을 한 파일에 누적 중(응집도 저하 추세, 급한 문제 아님) | `codebase/backend/src/common/__test-utils__/source-scan.ts`, `source-scan.spec.ts` | 조치 불요. 9번째 스캔 관심사가 생기면 파일 분리 고려 |
| 6 | 테스트/아키텍처 | 신규 가드 `endpoint-path-conflict-wrap-guard.ts` — "모든 `triggerRepository.save()` 8곳 전수 분류"(화이트리스트+래핑 여부) 술어로 vacuous 술어를 대체, 실제 소스 8개 호출 지점과 1:1 대응 실측 확인. 기존 가드 패밀리(파서/spec/fixture 3분할)와 구조 일관 | `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` 외 | 조치 불요 |
| 7 | 성능/의존성/동시성 | `.claude/test-stages.sh` `cmd_build()` 에 backend/frontend typecheck ratchet 2개가 `&&` 순차 추가 — 로컬 빌드 wall-clock 증가(CI 전용 검사를 로컬로 당겨오는 의도된 트레이드오프, `#1292` 재발 방지) | `.claude/test-stages.sh` (`_cmd_typecheck_ratchets`, `cmd_build`) | 급한 조치 불요. 체감 지연 시 병렬화(`wait`) 고려 |
| 8 | 문서화 | `production-build-devdep.spec.ts` 파일 최상단 describe-레벨 JSDoc 이 3번째 exclude 축(`__test-utils__`) 추가 이력을 아직 요약하지 않음 — 이전 라운드(`12_53_08`)부터 지속 | `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` | 필수 아님. 다음 편집 기회에 헤더에 3회 반복 패턴 한 줄 추가 |
| 9 | 아키텍처 | `tsconfig.build.json` exclude 목록이 `repo-guards/**`→`shared/testing/**`→`__test-utils__/**` 순으로 3번째 반복 확장 — 새 테스트 전용 디렉터리가 생길 때마다 중앙 설정 수정이 필요(Open/Closed 관찰) | `codebase/backend/tsconfig.build.json` | 조치 불요. 4번째 자리가 생기면 명명 규약 기반 일반화 검토 |
| 10 | 아키텍처/API 계약/부작용 | `WorkflowVersionDetail`→`WorkflowVersionDetailProjection` 개명은 이름 충돌(grep 오판) 증상만 해소 — FE/BE 가 같은 wire 계약을 공유 타입 패키지 없이 손-미러 중인 근본 원인은 그대로 남음(`creator` nullability·`createdAt` 타입이 이미 갈려 있음). docstring 이 명시적으로 유예 근거를 적어둠 | `workflow-versions.service.ts`, `codebase/frontend/src/lib/api/workflows.ts` | 조치 불요(범위 밖으로 이미 문서화). 공유 패키지화 시 타입 통일 선행 필요 |
| 11 | 유지보수성 | cafe24/makeshop 두 spec 파일에 `raceErrorSurfaces` 대조군 배열이 문자 그대로 복제 — 기존 "미러 중복은 의도" 프로젝트 컨벤션과 일치, 새 이탈 아님 | `integration-oauth.service.{cafe24,makeshop}.spec.ts` | 조치 불요. 3번째 서비스가 같은 패턴 요구 시 공용 헬퍼 승격 검토 |
| 12 | 유지보수성 | `_cmd_typecheck_ratchets()` 가 같은 파일의 `_run_internal()`(배열+루프)과 다른 관용구(`&&` 인라인 체인) 사용 — 현재 2건 규모에선 문제 아님 | `.claude/test-stages.sh` | 3번째 ratchet 추가 시 배열+루프로 통일 고려 |
| 13 | 테스트 | `cmd_build()`→ratchet 배선 자체는 harness 자동 테스트로 보호되지 않음 — 1라운드 RESOLUTION 이 이미 won't-do 로 처분(다른 `cmd_*` 조합도 전부 동일 미검증이라 이 자리만 예외적으로 고정하면 규약 위반). 실제 `run-test.sh build` 실행 로그로 배선 동작은 실측 확인됨 | `.claude/test-stages.sh` | 조치 불요(기존 처분 유지) |
| 14 | 테스트 | `TriggerSaveSite` 스캔은 `this.triggerRepository.save(...)` 형태만 잡고 구조분해 별칭 경유 호출은 미검출 — 3라운드 전 defer 처리됨, 저장소 전체에 해당 형태 0건 재확인(`grep`) | `endpoint-path-conflict-wrap-guard.ts` (`isPropertyAccessNamed`) | 조치 불요(기존 defer 유지) |
| 15 | 의존성 | `typescript`(기존 devDependency) 소비처가 `source-scan.ts` 로 한 곳 늘었으나, 해당 파일이 속한 `__test-utils__/` 글로브가 같은 배치 내에서 먼저 `tsconfig.build.json` exclude 에 들어가 프로덕션 빌드 격리 유지(순서상 안전, `production-build-devdep.spec.ts` 캐너리로 실측 확인). 원래 exclude 주석의 전제("devDependency 를 끌어오지 않는 형태")를 이 import 가 반증했었으나 저자가 이미 취소선+정정으로 갱신 | `source-scan.ts`, `tsconfig.build.json` | 조치 불요(재수정 불필요, 정정 내용이 diff 와 일치 확인됨) |
| 16 | 데이터베이스 | 신규 e2e(`webhook-trigger.e2e-spec.ts` B4)가 mock 이 아닌 실제 Postgres `(workspace_id, endpoint_path)` UNIQUE 제약 충돌 경로를 처음 검증(§1.10 계약, 드라이버 원문 미노출 포함) | `codebase/backend/test/webhook-trigger.e2e-spec.ts` | 조치 불요 — 커버리지 강화로 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | unique-violation 마스킹 유지 확인, `listMembers` select 투영은 보안 강화, 하드코딩 시크릿 없음 |
| performance | NONE | `listMembers` 투영 성능 개선, ratchet 추가로 로컬 빌드시간만 증가(의도된 트레이드오프) |
| architecture | NONE | `pg-error.ts`/`enclosingScopeName` SoT 통합 긍정적, FE/BE 손-미러·`source-scan.ts` 응집도는 기존 유예 부채 |
| requirement | NONE | spec 대조 line-level 검증, 불일치 0건, Rationale 표 미등재는 이미 상위 트래커 등재 확인 |
| scope | NONE | 138파일 중 108개는 review/consistency 산출물, 실질 30개 파일 전부 B-1~B-8 8개 항목에 귀속 |
| side_effect | LOW | 전역 필터 blast radius 확대는 CHANGELOG+회귀 테스트로 검증됨, 그 외 표면 없음 |
| maintainability | LOW | raceErrorSurfaces 복제(기존 컨벤션), ratchet 함수 스타일 불일치(경미) |
| testing | NONE | 277건 테스트 직접 실행 전부 통과, 남은 두 항목은 기존 defer/won't-do 유지 |
| documentation | NONE | CHANGELOG 갱신 확인, 유일한 잔여는 헤더 JSDoc 이력 미반영(이전 라운드부터 지속) |
| dependency | NONE | package.json/lockfile 변경 0건, devDependency 격리 순서 안전 확인 |
| database | NONE | 마이그레이션/엔티티 변경 없음, select+relations 조합 TypeORM 소스로 검증, e2e 보강 |
| concurrency | NONE | 공유 가변 상태·락 도입 없음, unique-violation race 처리는 순수 리팩터 |
| api_contract | NONE | breaking change 없음, 응답 wire 불변 확인, 상태코드 확장은 회귀 테스트로 고정 |
| user_guide_sync | NONE | 매트릭스 22개 trigger 행 중 매칭 0건, MDX/i18n 동반 갱신 불요 |

## 발견 없는 에이전트

(모든 reviewer 가 최소 1건 이상의 INFO 관찰을 남겼으며, Critical/Warning 은 전 reviewer 공통으로 0건)

## 권장 조치사항

1. (선택, 절차) `workspace-rbac.e2e-spec.ts` J.(`GET /:id/members`)·신규 `webhook-trigger.e2e-spec.ts` B4 가 실제 Postgres 환경(mock 아님)에서 그린임을 머지 전 1회 확인 — database reviewer 권고.
2. (선택, 문서) `production-build-devdep.spec.ts` 파일 헤더 JSDoc 에 "3회 반복된 exclude 확장 패턴" 한 줄 추가 — 다음 편집 기회로 미뤄도 무방.
3. (선택, 스타일) `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` 를 `_run_internal()` 과 동일한 배열+루프 관용구로 통일 — 3번째 ratchet 추가 시점에 고려.
4. 그 외 항목은 전부 이미 처분 완료(4~5라운드 누적 검토) 또는 범위 밖 유예로 문서화되어 있어 이번 배치의 developer 턴에서 추가 조치 불필요.

## 라우터 결정

- `routing=skipped` — 라우터 미사용. `forced` 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 전체 14개 reviewer 실행됨.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(forced 미이행 없음)
