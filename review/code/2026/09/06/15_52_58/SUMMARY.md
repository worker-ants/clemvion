# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 실행 Critical 결함은 없다. 핵심 보안 수정(`WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출 차단)과 3축 검출 가드는 견고하나, `scope` 리뷰어가 지적한 "브랜치 하나에 서로 무관한 4개 관심사(User 방어·DTO JSDoc 인용 가드·하네스 YAML 파서 수정·트리거 UNIQUE 충돌 코드)가 누적됐고 그중 하나(`.claude/hooks/**`)는 `CLAUDE.md` 가 명시한 developer 쓰기 권한 범위 밖"이라는 지적이 전체 위험도를 MEDIUM으로 끌어올린다. forced(router_safety) 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 변경범위(Scope) | 브랜치명·과제("User 엔티티 컬럼 방어")와 무관한 3개 독립 산출물(DTO JSDoc 인용 가드+별도 plan 문서, 리뷰 하네스 YAML 파서 버그 수정, 트리거 `endpoint_path` UNIQUE 충돌 코드+`pg-error.ts` 확장)이 같은 diff 에 누적. `.claude/hooks/_lib/review_guard.py`/`.claude/tests/test_review_guard.py` 편집은 `CLAUDE.md` Skill 표가 명시한 developer 쓰기 권한(`codebase/**`,`plan/**`,`review/**`) 밖 경로 | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(신규), `.claude/hooks/_lib/review_guard.py:600-696`, `codebase/backend/src/modules/triggers/triggers.service.ts:213-226,423-427,509-513,1592-1631`, `codebase/backend/src/common/db/pg-error.ts:10-11,31-46` | 연쇄 발견 자체는 정상 관례이나, 향후 (c)하네스 파서·(d)트리거 코드는 별도 커밋/PR로 분리해 독립적으로 승인·롤백 가능하게 할 것. 하네스 코드 수정에 대한 명시적 예외 조항이 `CLAUDE.md`에 없다는 점을 planner에게 확인 요청 |
| 2 | 문서화(계약 불일치) | `CHANGELOG.md` 본문이 트리거 `endpoint_path` UNIQUE 충돌 응답의 세부 코드 키를 `subCode`로 서술 — 실제 코드·테스트는 `details.code`를 쓰며, 같은 파일 161행의 인용문과도 자기모순 | `CHANGELOG.md:153` (vs 실제: `triggers.service.ts` `rethrowEndpointPathConflict`, `triggers.service.spec.ts`) | `CHANGELOG.md:153`의 `subCode`를 `code`로 정정(코드·테스트·spec은 이미 올바름, 문서만 수정) |
| 3 | 유지보수성 | "PG 에러의 두 wrap 표면(driverError/flat)"을 만드는 테스트 헬퍼를 `pg-error.spec.ts`와 `triggers.service.spec.ts`가 각자 손으로 재작성 — 이 PR이 프로덕션 코드에서 막으려 한 "SoT 중복" 결함 클래스가 테스트 픽스처에는 재발 | `codebase/backend/src/common/db/pg-error.spec.ts:15-21`(`wrapped`/`flat`) vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2801-2817`(`uniqueViolation`) | 공유 fixture 모듈(예: `common/db/__test-utils__/pg-error-fixtures.ts`)에 `makePgUniqueViolation(constraint, surface)`를 한 번만 선언하고 양쪽이 import |
| 4 | 유지보수성 | 신규 JSDoc 블록과 대상 함수 선언 사이에 빈 줄 하나가 끼어 파일 전체의 "JSDoc은 선언에 바로 붙는다" 관례에서 이탈(기능 영향 없음, 과거 라운드가 지적한 orphan JSDoc 결함 클래스의 사소한 재발) | `codebase/backend/src/modules/triggers/triggers.service.ts:215-223`(`isEndpointPathUniqueViolation` 위 JSDoc, 222행 빈 줄) | 222행 빈 줄 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `WorkflowVersionsService.findOne`의 과거(수정 전) 무투영 `creator` 로드로 워크스페이스 멤버 누구나 다른 사용자의 `passwordHash`·2FA 복구코드 해시 등을 실제로 조회할 수 있었던 노출 창에 대해, 코드 수정과 별개로 사후 대응(접근 로그 확인, 필요 시 자격증명 로테이션) 필요 여부는 운영/보안팀 판단 사항 | `workflow-versions.service.ts:141-166`(수정됨), `user.entity.ts:81-124` | 별도 보안 인시던트 트래킹 항목으로 남겨 노출 기간·접근 로그를 확인 |
| 2 | 보안 | `WorkspacesService.listMembers`는 구조 가드(로드 형태 기반)가 닿지 않는 유일한 지점 — JS 단 수동 매핑이라 향후 넓어져도 구조 가드는 초록일 수 있음. 현재는 신규 단위 테스트+e2e로만 방어(이미 PR이 스스로 disclose) | `workspaces.service.ts:199-225` | 조치 불요(설계 판단으로 수용). 다음에 이 메서드를 만질 때 DB `select` 투영으로 전환 고려 |
| 3 | 성능 | `WorkflowVersionsService.findOne`의 `select` 투영 도입은 보안 수정이면서 동시에 로드 컬럼 수 감소로 성능 개선 부수효과 | `workflow-versions.service.ts` `findOne`(`CREATOR_PROJECTION`) | 없음(긍정적 변경) |
| 4 | 성능 | `dto-jsdoc-citation.spec.ts`의 3개 테스트가 동일 fixture 파일을 각각 독립 재파싱(비용은 무시할 수준, 형제 가드와 패턴 불일치) | `dto-jsdoc-citation.spec.ts:75,102,114` | `beforeAll`/모듈 스코프에서 1회 계산해 공유 |
| 5 | 요구사항 | `listMembers`의 구조적 갭(DB 투영 아닌 JS 매핑)은 PR 범위 밖으로 명시 disclose 및 plan 후속 등재 완료 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 후속 developer 턴 |
| 6 | 변경범위 | 신규 `pgErrorConstraint()`는 User 방어 축 어디에서도 소비되지 않음(트리거 충돌 판정 전용) — 위 WARNING#1의 "별개 관심사" 근거를 뒷받침 | `pg-error.ts:43-46`, 소비자 `triggers.service.ts:18,226` | 조치 불요 |
| 7 | 테스팅 | `listMembers` "관계 미로드" 테스트가 TypeORM 실제 null 관계 형태(`user: null`)가 아니라 키 자체가 없는 객체를 mock — 현재는 옵셔널 체이닝으로 결과 동일하나 시나리오 신뢰도 약화 | `workspaces.service.spec.ts`(관계 부재 테스트 블록) | `user: null` 명시로 실제 TypeORM 반환 형태에 가깝게 수정 |
| 8 | 테스팅 | `endpoint_path` UNIQUE 충돌 "매칭 안 되면 그대로 흘려보낸다" 부정 케이스 테스트가 `update()` 경로에만 있고 `create()`엔 없음(현재는 헬퍼 공유라 위험 낮음) | `triggers.service.spec.ts`(부정 케이스 2건) | `it.each`에 `create`/`update` 축 추가해 대칭 확보 |
| 9 | 테스팅 | `WorkspaceMemberDto.joinedAt`의 `nullable: true` 선언이 실제 `null` 값으로 검증된 적 없음(현재 4자리 전부 `new Date()`로 채워 도달 불가) | `workspace-response.dto.ts`(`joinedAt`) | 조치 불요 — 향후 null 도달 경로 생기면 계약 테스트 추가 |
| 10 | API계약 | 에러 봉투 `details` 필드의 배열/객체 이형이 `§5.3`에 아직 명문화되지 않은 기존 갭에 트리거 충돌 사례가 하나 더 추가됨(이미 planner 후속 등재, OpenAPI상 깨지는 계약 없음) | `triggers.service.ts`(`rethrowEndpointPathConflict`), `spec/5-system/2-api-convention.md §5.3` | 조치 불요 — planner 후속 반영 대기 |
| 11 | API계약 | 트리거 `endpoint_path` UNIQUE 충돌의 409 응답을 실 DB 유니크 제약 경로로 검증하는 e2e가 없음(unit mock 검증만 촘촘) — 다른 두 갈래(WorkflowVersions, WorkspaceMember)는 e2e 보강됨과 대비 | `triggers.service.spec.ts` vs `webhook-trigger.e2e-spec.ts`(대응 케이스 부재) | e2e에 중복 endpointPath 생성 시도로 409+code+details 단언 케이스 1건 추가(필수 아님, 형평 목적) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `findOne` 과거 유출 사후조치 필요성 판단 미해소(INFO), `listMembers` 구조가드 밖 잔여 리스크(INFO). 핵심 수정 자체는 적절 |
| performance | NONE | 실질 결함 없음. `findOne` select 투영은 보안+성능 동시 개선 |
| requirement | LOW | `CHANGELOG.md:153` subCode/code 자기모순(WARNING). 나머지 spec-코드-테스트 line-level 일치 확인 |
| scope | MEDIUM | 브랜치에 4개 독립 관심사 누적, 하네스 코드는 CLAUDE.md 쓰기권한 범위 밖(WARNING) |
| side_effect | NONE | 최신 커밋은 docstring 정정+테스트 확장뿐, 신규 부작용 없음 |
| maintainability | LOW | PG 에러 테스트 헬퍼 중복 재작성, JSDoc 빈 줄 이탈(WARNING 2건) |
| testing | LOW | 관계-부재 mock 사실성, create/update 비대칭, nullable 미검증(INFO 3건). 198개 테스트 전부 통과 실행 확인 |
| documentation | NONE | 신규 결함 없음, 과거 11라운드 지적 전부 해소 재확인 |
| api_contract | LOW | `details` 이형 미명문화 갭 사례 추가(INFO), 트리거 409 e2e 부재(INFO). breaking change 없음 |
| user_guide_sync | NONE | 매트릭스 19행 중 매칭 스코프 0건 실측(frontend/nodes/auth diff 없음) |

## 발견 없는 에이전트

performance, side_effect, documentation, user_guide_sync — 각각 INFO 수준 관찰은 있으나 WARNING/Critical 급 실질 결함 없음("문제 없음"으로 분류).

## 권장 조치사항

1. `CHANGELOG.md:153`의 `subCode`를 `code`로 정정 — API 계약 1차 문서가 실제 wire와 모순되는 상태를 해소 (WARNING#2)
2. 향후 유사 브랜치에서는 "연쇄 발견"으로 늘어난 독립 관심사(하네스 파서 수정, 부속 가드 신설 등)를 별도 커밋/PR로 분리 — 특히 `.claude/hooks/**` 편집의 권한 근거를 planner에게 확인 (WARNING#1)
3. `pg-error.spec.ts`/`triggers.service.spec.ts`의 중복 PG 에러 fixture 헬퍼를 공유 모듈로 통합 (WARNING#3)
4. `triggers.service.ts:222`의 JSDoc-선언 사이 빈 줄 제거 (WARNING#4)
5. (저비용, 선택) 트리거 409 UNIQUE 충돌 e2e 1건 추가, `listMembers` 관계-부재 mock을 `user: null`로 보정, create/update 부정 케이스 대칭화 (INFO#7~9, #11)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단 — 이번 diff 스코프에 비적용 |
  | dependency | router 판단 — 신규/변경 외부 의존성 없음 |
  | database | router 판단 — 스키마/마이그레이션 변경 없음(트리거 로직은 기존 인덱스 활용) |
  | concurrency | router 판단 — 동시성 관련 신규 코드 없음 |