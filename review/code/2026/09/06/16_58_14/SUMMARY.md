# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. `User` 엔티티 컬럼 노출 방어(검출 2~3축 + `WorkflowVersionsService.findOne` 실유출 수정)라는 핵심 산출물 자체는 견고하나(security/performance/side_effect/testing/maintainability/documentation/user_guide_sync 전원 LOW~NONE), scope 리뷰어가 지적한 **세 갈래 스코프 확산**(`.claude/**` harness 쓰기 권한 미문서화, CHANGELOG 제목이 무관한 두 관심사를 묶음, 트리거 409 계약 정합화)과 api_contract 리뷰어가 지적한 **에러 응답 형태 이중화 + SoT 미이관(전역 예외 필터)** 이 겹쳐 MEDIUM 으로 판정한다. forced whitelist 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `.claude/**` harness(`review_guard.py`) 쓰기 권한을 이미 행사했으나 `CLAUDE.md` Skill 표는 여전히 미갱신 — "관행 허용, 문서 미기술" 상태가 plan 이 스스로 진단한 그대로 남음(체크박스도 `- [ ]` 미완료) | `.claude/hooks/_lib/review_guard.py:600~709`, `plan/in-progress/spec-draft-nullable-notation-followups.md:451-488` | 다음 planner 턴에서 `CLAUDE.md` Skill 표 갱신이 실제로 체크박스를 닫는지 추적 |
| 2 | Scope | `dto-jsdoc-citation-guard` 축은 User 컬럼 방어와 무관한 별개 관심사(DTO JSDoc 공개 노출 위생)인데 CHANGELOG 제목이 여전히 "검출 3축"으로 두 관심사를 하나로 묶음 — 직전 라운드(`16_28_58`) 지적이 미반영 | `CHANGELOG.md:3`, `:58` | CHANGELOG 절 제목을 "User 컬럼 검출 2축"/"DTO JSDoc 주석 위생 검출" 두 절로 분리 |
| 3 | Scope | 트리거 `endpoint_path` UNIQUE 충돌 409 상세화(`pg-error.ts` SoT 포함)도 User 컬럼 방어와 무관한 별개 spec-impl 갭 수정 — harness 파서 강화 → 게이트 범위 확대 → 연쇄 발견이라는 경위는 투명히 기록됨, plan 이 추가 확산(`integration-oauth.service.ts` 치환)은 스코프 규율로 명시적으로 보류(자기 억제 작동 중) | `triggers.service.ts:222,1607-1608`, `common/db/pg-error.ts` | 이미 커밋된 순수 additive 수정이라 되돌릴 필요 없음. 스코프 규율 유지 확인만 |
| 4 | Requirement | `dto-jsdoc-citation-guard.ts` 의 "bare 시각" 패턴(`CITATION_PATTERNS[2]`)이 **백틱 없이 쓴** `hh_mm_ss` 인용을 놓침 — "세 형태 모두 대칭적으로 잡는다"는 자체 서술과 어긋남. 저장소 비변경 재현으로 확인(scratch 프로브: 백틱 없는 인용 → `[]`, 백틱 두르면 정상 검출) | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts:40-47` | 패턴을 `(?<!\S)\d{2}_\d{2}_\d{2}(?!\S)` 류로 완화하거나, 백틱 요구가 의도라면 그 이유를 코드 주석 + `review-citations.md §2` 에 명시. 반대 방향 대조군(백틱 없는 fixture)도 추가 |
| 5 | API Contract | 도메인 conflict 코드 표현 방식이 저장소에 이미 두 관례(top-level `code` 교체 / `details[]` array)가 공존하는데, 이번 PR 이 `details` **단일 object**(`{field, code}`)라는 세 번째 shape 를 추가 — spec(`2-trigger-list.md §3`)을 충실히 구현했으나 `2-api-convention.md §5.3`/`3-error-handling.md §1` 은 아직 택일 기준·카탈로그 등재 안 됨(이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:595-613` 에 planner 항목으로 등재됨) | `codebase/backend/src/modules/triggers/triggers.service.ts:1607-1631` | 신규 결함 아님 — 등재된 planner 항목(§5.3 택일 기준 + §1 카탈로그) 처리 여부를 다음 라운드에서 확인 |
| 6 | API Contract | 이번 PR 이 세운 "PG unique violation 두 표면 통합" SoT(`pg-error.ts`)가 **전역 예외 필터**(`http-exception.filter.ts`)에는 이관되지 않음 — 필터의 로컬 `isUniqueViolation` 은 `instanceof QueryFailedError` 를 먼저 요구해 raw(`err.code`) 표면을 걸러내므로, 국소 처리가 안 되는 대다수 서비스에서 raw-surface unique violation 이 409 대신 500 이 될 수 있음. 이 PR 이 다른 자리에서 고치려던 결함과 동일한 형태가 가장 넓은 blast radius 를 가진 fallback 에 남음(파일이 이번 diff 목록 밖이라 범위 밖이지만 SoT 존재 이유와 직접 충돌) | `codebase/backend/src/common/filters/http-exception.filter.ts:17-22,78` | 후속 항목으로 등재 — 로컬 `isUniqueViolation` 을 `isPostgresUniqueViolation`(`pg-error.ts`)으로 교체, 최소한 `instanceof QueryFailedError` 요구 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 신규 방어선(구조·이름·JSDoc 3축)은 검출(테스트/리뷰 시점)이지 런타임 차단이 아님 — `User` 엔티티 자체엔 `select:false` 없음. CHANGELOG 가 이미 트레이드오프를 disclose | `user.entity.ts`, `CHANGELOG.md` | 조치 불요. `select:false`+공유 로더 재배선은 후속 planner 항목으로 유지 |
| 2 | Security | `WorkspacesService.listMembers` 는 가드의 구조 축이 못 보는 유일한 자리(수동 JS 매핑) — unit(`findUserSecretLeaks`)+e2e 카나리아로 부분 완화됨 | `workspaces.service.spec.ts`, `workspace-rbac.e2e-spec.ts` | 조치 불요. 장기적으로 TypeORM `select` 투영 전환 검토 |
| 3 | Performance | `user-entity-exposure-guard.ts` 안에서 같은 엔티티 파일 집합을 두 검출 함수가 독립적으로 재파싱(순회 로직은 이미 공유, 파싱 자체는 미공유) | `user-entity-exposure-guard.ts`(`collectUserRelationNames`/`findEagerUserRelations`) | 파싱을 1회로 줄이는 헬퍼 분리(현재 규모에선 체감 영향 없음) |
| 4 | Requirement | `spec/5-system/2-api-convention.md §5.4` 가 아직 신규 검출 축(3축)을 반영 안 함 — 이미 plan 에 정확한 후속 항목으로 등재됨(developer 는 spec 직접 수정 불가 규약 준수) | `spec/5-system/2-api-convention.md §5.4`, `plan/in-progress/spec-draft-nullable-notation-followups.md:383` | 조치 불요 — 다음 planner 턴 |
| 5 | Documentation | plan 완료 노트의 harness 테스트 카운트(1,124 pass)가 현재 실측(1,132)과 8건 차이 — 같은 날 여러 라운드로 테스트가 늘어난 자연스러운 드리프트 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1362` | 이 plan 항목을 닫는 시점에 수치 재실측 |
| 6 | Testing | `pgErrorConstraint` 의 "제약 이름 없음" 케이스가 `driverError` 표면만 명시적으로 이름 붙여 테스트되고, flat/top 표면은 다른 범용 테이블에 우연히만 커버됨(기능 갭 아님, 라벨-커버리지 불일치) | `common/db/pg-error.spec.ts` | `it.each` 로 두 표면 나란히 명시하거나 주석으로 의도 명시 |
| 7 | API Contract | `WorkflowVersionsService.findOne` 응답의 `creator` 가 전체 `User` → 3필드 투영으로 좁혀짐(이론상 breaking, 실질은 보안 결함 시정) | `workflow-versions.service.ts` | 조치 불요 — CHANGELOG 에 영향 고지 이미 있음 |
| 8 | API Contract | 프런트/백엔드에 동명 `WorkflowVersionDetail` 이 공유 패키지 없이 손 미러링, 이번 PR 로 한 단계 더 갈라짐(현재는 프런트가 더 넓어 안전) | `codebase/frontend/src/lib/api/workflows.ts`, backend `workflow-versions.service.ts` | 조치 불요 — 이미 plan 에 개명/공유 패키지화 등재됨 |
| 9 | Scope/User Guide Sync | `WorkspaceMemberDto.joinedAt` 추가는 additive, 실제로는 기존 런타임 동작을 뒤늦게 선언한 것 — 신규 UI 표면 없어 유저 가이드 갱신 대상 없음 | `workspace-response.dto.ts:81-93` | 조치 불요. `joinedAt` 이 실제 UI 노출될 때 `workspaces-and-members.mdx` 동반 갱신 필요하다는 점만 메모 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 검출 3축은 런타임 차단 아님(의도된 트레이드오프), `listMembers` 사각지대는 카나리아로 부분 완화 |
| performance | LOW | 두 검출 함수가 엔티티 파일을 중복 파싱(INFO). 프로덕션 경로는 오히려 성능 개선(`creator` 투영 축소) |
| requirement | LOW | dto-jsdoc-citation-guard bare 시각 검출 갭(WARNING), 나머지는 spec 대조·실행 검증 전부 일치 |
| scope | MEDIUM | harness 쓰기 권한 미문서화, CHANGELOG 제목 혼재, 트리거 계약 스코프 확산 — 3건 모두 투명히 기록되나 미완결 |
| side_effect | LOW | 에러 응답/반환 타입 변경 2건은 의도된 것으로 영향 범위 확인 완료. 전역 변수/파일시스템/네트워크 신규 부작용 없음 |
| maintainability | NONE | 이전 라운드 지적 전부 재발 없이 해소 확인. 신규 결함 없음 |
| testing | NONE | 라벨-커버리지 미묘한 불일치(INFO) 외 실질 결함 없음. 다층 회귀 테스트 확인 |
| documentation | LOW | plan 완료 노트 수치 드리프트(INFO) 외 문서화 품질 최상급 |
| api_contract | LOW | 에러 응답 shape 삼중화(WARNING), SoT 미이관 전역 필터(WARNING) — 둘 다 기존 갭의 재노출 |
| user_guide_sync | NONE | 매트릭스 22행 중 매칭 2건 모두 실질 갭 없음. 동반 갱신 누락 0건 |

## 발견 없는 에이전트

maintainability, testing, user_guide_sync — 신규 결함 없음(재확인/정보성 기록만).

## 권장 조치사항

1. `CLAUDE.md` Skill 표에 `.claude/**` harness 쓰기 권한을 반영해 `plan/in-progress/spec-draft-nullable-notation-followups.md:451` 체크박스를 실제로 닫는다(다음 planner 턴).
2. `http-exception.filter.ts` 의 로컬 `isUniqueViolation` 을 `pg-error.ts` 의 `isPostgresUniqueViolation` 으로 교체해 raw-surface unique violation 이 500 으로 새는 경로를 막는다(후속 항목 등재).
3. 도메인 conflict 에러 응답 shape 택일 기준을 `2-api-convention.md §5.3` 에 명문화하고 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 `3-error-handling.md §1` 카탈로그에 등재한다(이미 plan 등재 상태, 처리 확인만 남음).
4. `dto-jsdoc-citation-guard.ts` 의 bare 시각 패턴을 백틱 유무와 무관하게 매칭하도록 수정하거나, 백틱 요구가 의도라면 그 근거를 명문화한다.
5. CHANGELOG "검출 3축" 제목을 관심사별로 분리한다(User 컬럼 검출 vs DTO JSDoc 위생).
6. (경미) `pg-error.spec.ts` 의 "제약 이름 없음" 테스트를 두 표면(`driverError`/top) 명시적으로 나란히 두어 라벨-커버리지 불일치를 해소한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 아키텍처 구조 변경 없음(router 판단) |
  | dependency | 의존성 변경 없음(router 판단) |
  | database | 스키마/마이그레이션 변경 없음(router 판단, `pg-error.ts`/트리거 인덱스는 기존 인덱스 재사용) |
  | concurrency | 신규 동시성 로직 없음(router 판단) |