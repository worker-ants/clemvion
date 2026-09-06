# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(회귀 방지망의 이론적 사각, 실제 유출 사례 없음). 핵심 목표(`User` 엔티티 민감 컬럼 노출 검출망 구축 + 이미 발견된 Critical 1건 수정)는 코드 직접 확인으로 완전히 충족돼 있다. forced(router_safety) 7개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | JSDoc 인용 가드가 스스로 선언한 "세 형태"(전체 경로·날짜+시각·bare 시각) 중 **날짜+시각** 형태를 양성 검증하는 fixture 가 없음 — 그 정규식(`CITATION_PATTERNS[1]`)을 완전히 제거해도 기존 위반 fixture 3건이 모두 그대로 잡혀 스위트가 초록이다(직접 뮤테이션으로 확인) | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(`CITATION_PATTERNS`), `dto-jsdoc-citation.spec.ts`, `fixtures/dto/responses/jsdoc-citation.fixture.ts` | `jsdoc-citation.fixture.ts` 에 날짜+시각 형태(예: `2026-09-05 23_30_01`) 위반 케이스 1건 추가하고 spec `owners` 기대값에 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신규 검출 가드 2종(구조 축/이름 축)이 spec `§5.4` 「검증 층」 및 관련 문서 `code:` frontmatter에 아직 미등재 | `user-entity-exposure-guard.ts`, `user-secret-absence.ts` (spec 델타 없음) | 조치 불요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:375` 에 planner 후속 항목으로 등재됨. 해당 planner 턴에서 §5.4 표 + `code:` 갱신 |
| 2 | security | `USER_SECRET_KEYS`(7컬럼, 자격증명·토큰류)가 계정 탈취 보조 정보(`pendingEmail`, `oauthProviderId`)는 대상 밖 | `user-secret-absence.ts`(`USER_SECRET_KEYS`) vs `user.entity.ts` | 조치 불요(의도적 스코프). 향후 이 필드들이 응답에 노출되는 경로가 발견되면 목록 추가 재검토 |
| 3 | requirement | `hasProjectionFor` 가 중첩 `relations`/`select` 조합에서는 안전한 방향(false positive)으로만 어긋남 — 저장소 내 해당 조합 0건(grep 확인) | `user-entity-exposure-guard.ts`(`hasProjectionFor`) | 급하지 않음 — 중첩 `User` 관계에 중첩 투영을 쓰는 자리가 생기면 재귀 확장 + fixture 추가 |
| 4 | scope | `WorkspaceMemberDto.joinedAt` 추가는 핵심 목표(User 컬럼 방어) 밖 파생 갭이나, 최초 커밋 이후 재발·확대 없이 5차례째 재확인됨. fix 커밋들이 리뷰 산출물을 코드와 동반 커밋하는 것과 신규 fixture 의 `strictRepo` 로컬 선언도 저장소 기존 관례 그대로 | `workspace-response.dto.ts`(`joinedAt`), `review/code\|consistency/**`, `fixtures/user-relation-load.fixture.ts` | 조치 불요 |
| 5 | side_effect / api_contract / database | `WorkflowVersionsService.findOne` 응답의 `creator` 필드가 `User` 전체 → `{id,name,email}` 3필드로 축소. 이미 OpenAPI 로 선언돼 있던 계약(`WorkflowVersionCreatorDto`)에 런타임을 맞춘 것이라 breaking change 아님. 유일한 내부 소비처(`restoreVersion`)는 영향받지 않는 필드만 사용, `CREATOR_PROJECTION` 상수를 DTO 스키마와 대조하는 회귀 테스트 신설로 재발 방지 | `workflow-versions.service.ts:69-73,124-156`, `workflow-versions.service.spec.ts` | 조치 불요(완료된 조치). 이 패턴(공유 투영 상수 + DTO 스키마 대조 테스트)을 `User` 를 싣는 다른 자리에도 재사용 권장 |
| 6 | side_effect | `WorkflowVersionsService` 모듈의 공개 export 표면 확대(`CREATOR_PROJECTION`, `ProjectedCreator` 등 타입 3종) — `Object.freeze` 로 불변, 소비처는 동일 파일 `.spec.ts` 1건뿐 | `workflow-versions.service.ts:21-73` | 조치 불요 |
| 7 | side_effect | 신규 가드/헬퍼 3종(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`)은 순수 읽기 전용(`fs.readFileSync`)이며 `tsconfig.build.json` exclude 로 프로덕션 dist 미포함 확인 | 해당 3파일, `tsconfig.build.json` | 조치 불요(확인 기록) |
| 8 | side_effect | e2e 신규 케이스(워크스페이스/워크플로우/버전 데이터)가 teardown 없이 남음 — 기존 e2e 관례와 동일, 신규 부작용 아님 | `workspace-rbac.e2e-spec.ts`(J.), `workflow-crud.e2e-spec.ts`(H.) | 조치 불요 |
| 9 | maintainability | `findCitation` 이 노드당 첫 매치 하나만 반환 — 위반 존재 판정 자체는 정확하나, 같은 JSDoc 에 두 형태가 섞여 있으면 진단 메시지가 하나만 보여줌(기능적 검출력엔 영향 없음) | `dto-jsdoc-citation-guard.ts`(`findCitation`) | `findAllCitations` 로 전체 매치를 담거나, 의도적 설계라면 함수 JSDoc 에 한 줄 명시 |
| 10 | maintainability | 신규 가드 3파일의 함수별 JSDoc 이 리뷰 라운드 타임스탬프를 반복 인용해 다소 장황 — 저장소 전체가 채택한 `review-citations.md` 관례 범위 내, 결함 아님 | `dto-jsdoc-citation-guard.ts`, `dto-jsdoc-citation.spec.ts` 헤더 | 조치 불요. 다음에 만질 때 계약(무엇을·왜)과 회고성 서술(spec 헤더)을 더 분리하면 가독성 개선 |
| 11 | testing | `hasProjectionFor` 의 `select` 값에 대한 `unwrap` 분기가 캐스트 포함 형태로 fixture 검증 안 됨(`relations` 쪽만 캐스트 2형태 검증됨) | `user-entity-exposure-guard.ts`(`hasProjectionFor`), `fixtures/user-relation-load.fixture.ts` | 낮은 우선순위 — 여유 있으면 `select` 값 캐스트 위반 케이스 1건 추가 |
| 12 | testing | `enclosingName` 의 `'<module>'` 폴백 분기가 어떤 fixture 로도 실행되지 않음(모듈 최상위 호출 형태 fixture 부재) | `user-entity-exposure-guard.ts`(`enclosingName`) | 조치 불요 — 향후 가드 확장 시 함께 채우면 완전한 분기 커버리지 |
| 13 | documentation | plan 완료 노트의 번호 매김 목록이 원문 순서상 `1.`→`3.`→`2.` 로 어긋남(CommonMark 렌더링·의미엔 영향 없음, `CHANGELOG.md` 순서와는 일치) | `plan/in-progress/spec-draft-nullable-notation-followups.md:343,354,357` | 세 항목 번호를 등장 순서대로 `1.`·`2.`·`3.` 으로 정정 |
| 14 | database / security | `WorkspacesService.listMembers` 가 여전히 `relations:['user']`+무투영으로 `User` 전 컬럼을 SQL 레벨에서 오버페치(응답 노출은 `.map()` 재투영으로 없음, DB→앱 전송 낭비만). 이번 PR 의 가드는 이 자리를 "준수 상태로 통과"하도록 화이트리스트에 올려 동결만 함 | `workspaces.service.ts`(`listMembers`) | PR 범위 밖 후속 과제 — `findOne`/`findByWorkflow` 와 같은 `relations`+`select` 투영 적용 검토 |
| 15 | database | `User` 엔티티에 `select:false` 컬럼 수준 DB 방어가 여전히 없음 — CHANGELOG 가 트레이드오프(민감 7컬럼이 19곳 공유 로더를 지나 `select:false` 도입 시 `addSelect` 누락이 인증 조용한 실패로 이어질 위험)를 실측과 함께 명시한 의도적 판단 | `user.entity.ts`(7개 민감 컬럼) | 조치 불요(범위 밖) — 19곳 로더 재배선 전제조건이 plan 트래커에 명시돼 있는지만 확인 권장 |
| 16 | database | `findByWorkflow` 가 페이지네이션 없이 워크플로당 버전 전체 조회 — 사전 존재 동작, 이번 diff 는 `select`/`relations` 절만 변경 | `workflow-versions.service.ts:107-122` | PR 범위 밖 — 버전 이력 무제한 증가가 실측되면 `take`/`skip` 또는 커서 기반 페이지네이션 고려 |
| 17 | api_contract | `WorkspaceMemberDto.joinedAt` 추가는 이미 wire 로 나가던 필드를 사후 선언한 순수 additive 변경이며 `nullable:true`+필수 표현이 `§5.4` "상시 존재→null 기본형" 규약과 일치 | `workspace-response.dto.ts`(`WorkspaceMemberDto.joinedAt`) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | Critical(투영 없는 User 유출)은 이미 수정 확인. spec §5.4 미등재(추적 중), USER_SECRET_KEYS 범위의 경계(INFO) |
| requirement | LOW | 요구사항 완전 충족 확인(fixture·스키마 대조 재검증). hasProjectionFor 중첩 select 이론적 사각(안전 방향, INFO) |
| scope | NONE | 마지막 커밋이 직전 라운드 지적 6건과 1:1 일치. 범위 이탈 없음. 파생 갭(joinedAt) 재확인, 확대 없음 |
| side_effect | NONE | 유일한 런타임 부작용(findOne creator 축소)은 의도된 보안 수정. 새 가드는 읽기 전용, dist 미포함 |
| maintainability | LOW | findCitation 첫 매치만 반환(진단 완전성, INFO), 신규 가드 구조·네이밍은 형제 가드와 일관 |
| testing | LOW | JSDoc 인용 가드 "날짜+시각" 형태 fixture 누락(**WARNING**, 뮤테이션으로 확인), 분기 커버리지 INFO 2건. 핵심 회귀 방지망(38/38)은 정상 작동 |
| documentation | LOW | 이전 5라운드 지적 문서 결함 전부 재발 없음 확인. plan 번호 목록 사소한 정정 필요(INFO) |
| database | LOW | creator 투영이 SQL 레벨로 완료됨을 확인. listMembers 오버페치·User select:false 부재는 의도적 범위 밖(INFO) |
| api_contract | LOW | findOne 축소는 계약 준수 방향(breaking 아님), joinedAt 은 순수 additive. 나머지 API 표면 불변 |

## 발견 없는 에이전트

없음 — 실행된 9개 reviewer 전원이 최소 INFO 이상을 보고했다(Critical/Warning 없이 "문제 없음"만 보고한 에이전트는 없으나, scope·side_effect 는 위험도 NONE 판정).

## 권장 조치사항

1. (WARNING) `dto-jsdoc-citation.fixture.ts` 에 "날짜+시각" 형태 위반 케이스를 추가하고 `dto-jsdoc-citation.spec.ts` 의 `owners` 기대값에 반영 — 세 정규식 모두 최소 1개 양성 fixture로 관측되게 한다. (testing #1)
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 완료 노트의 번호 목록을 등장 순서대로 `1.`·`2.`·`3.` 으로 정정. (documentation #13)
3. (선택, 낮은 우선순위) `findCitation` 을 전체 매치를 담는 형태로 바꾸거나, 첫 매치만 보는 것이 의도적 설계임을 함수 JSDoc 에 명시. (maintainability #9)
4. (이미 추적 중, 확인만) spec `§5.4` 검증 층 + 관련 문서 `code:` frontmatter 에 신규 가드 2종(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`) 등재 — planner 턴에서 처리. (security #1)
5. (PR 범위 밖 후속) `WorkspacesService.listMembers` 에 `findOne`/`findByWorkflow` 와 동일한 `relations`+`select` 투영 적용 검토. (database #14, security 교차 확인)
6. (PR 범위 밖 후속, 확인만) `User` 엔티티 `select:false` 전환의 전제조건(19곳 공유 로더 재배선)이 plan 트래커에 명시돼 있는지 확인. (database #15)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `api_contract` (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 프롬프트에 세부 사유 미기재 — router 가 이번 diff(정적 가드/투영/DTO 신설 중심, 성능 민감 경로 변경 없음) 특성상 관련성 낮다고 판단한 것으로 추정 |
  | architecture | 상동 — 신규 모듈/레이어 경계 변경 없음 |
  | dependency | 상동 — 신규 외부 패키지 의존성 변경 없음 |
  | concurrency | 상동 — 락/트랜잭션 로직 변경 없음(database reviewer 가 교차 확인: `createVersion` 의 `pessimistic_write` 트랜잭션 로직 불변) |
  | user_guide_sync | 상동 — 사용자 대면 UI/가이드 변경 없음(백엔드 전용 diff) |
