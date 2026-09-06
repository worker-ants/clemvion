# 변경 범위(Scope) 리뷰

## 개요

`git diff origin/main...HEAD` 는 30개 코드/스펙/plan 파일(+ `review/**` 하위 산출물 다수)을 바꾼다. 워크트리명·plan 완료 노트가 가리키는 주 목적은 **"`User` 엔티티 컬럼 수준 노출 방어(검출)"** 다 — 구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts` 신설, 그 배선(e2e 2건), 그리고 그 스캔이 실제로 찾아낸 유출(`WorkflowVersionsService.findOne` 의 `creator` 미투영) 수정이 여기 해당한다. 이 핵심 부분은 명확히 의도된 범위이고 무관한 리팩토링·포맷팅·불필요한 임포트는 발견되지 않았다.

그러나 브랜치의 16개 커밋을 추적하면, 이 주 목적에서 **인과적으로는 연결되지만 주제상 독립적인 관심사 셋**이 같은 브랜치/PR 에 함께 실려 있다. 전부 CHANGELOG·plan·커밋 메시지에 실측 근거와 함께 투명하게 disclose 되어 있어 은폐된 확장은 아니지만, "Scope" 관점의 사실로서는 여전히 유효하다.

## 발견사항

- **[WARNING]** 주 목적("User 컬럼 방어")과 무관한 harness 파서 수정이 그 자체로 촉발한 트리거 API 계약 구현이 같은 브랜치에 실려 있다
  - 위치: `.claude/hooks/_lib/review_guard.py:600`(`_parse_frontmatter_code`)·`:626`(신규 `_strip_comment`)·`:650`(`_clean` 변경), `.claude/tests/test_review_guard.py`(신규 회귀 테스트 149줄) / `codebase/backend/src/modules/triggers/triggers.controller.ts:23`(`ApiConflictResponse` import)·`:98-101`·`:127-130`(데코레이터 추가) / `codebase/backend/src/modules/triggers/triggers.service.ts:17-18`(`isPostgresUniqueViolation`/`pgErrorConstraint` import)·`:222-226`(`isEndpointPathUniqueViolation` 신설)·`:426`·`:512`(`.catch` 배선)·`:1607-1608`(`rethrowEndpointPathConflict` 신설) / `codebase/backend/src/common/db/pg-error.ts:43`(`pgErrorConstraint` 신설, `PgLikeError` 인터페이스에 `constraint` 필드 추가) + 신규 `pg-error.spec.ts`·`pg-error-fixtures.ts`
  - 상세: `CHANGELOG.md:1-53`(특히 `CHANGELOG.md` 하단 트리거 관련 절)이 스스로 인과관계를 기록한다 — (1) DTO JSDoc 인용 가드를 세우려고 spec frontmatter `code:` 에 YAML 범주 주석을 넣음 → (2) 그 주석이 `review_guard._parse_frontmatter_code` 의 블록 리스트 파서를 깨뜨려 spec 387개 중 41개 `code:` entry 가 조용히 유실 중이었음을 발견 → (3) 파서를 고쳐 게이트 커버리지가 넓어짐 → (4) 넓어진 범위가 `spec/2-navigation/2-trigger-list.md §3` 이 문서화했지만 구현되지 않았던 `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 계약 갭을 새로 검출 → (5) 그 계약을 실제로 구현하며 `pg-error.ts` 를 공용 SoT 로 추출. 각 단계는 논리적으로 이어지고 실측 근거를 동반하지만, 최종 산출물은 "User 엔티티 컬럼 방어" 라는 이름의 PR 에 **harness YAML 파서 버그 수정**과 **트리거 엔드포인트 충돌 API 계약 신규 구현**이 함께 들어간 상태다. 둘 다 그 자체로는 정당하나 "User 컬럼 노출 방어"와는 무관한 별개 관심사이며, 별도 PR 로 분리했다면 리뷰·롤백 단위가 더 명확했을 것이다.
  - 제안: 조치 불요할 수 있음 — 인과관계가 CHANGELOG·커밋 메시지에 상세히 disclose 되어 있고, 각 단계가 `--impl-done` 게이트의 Critical 발견에서 파생된 강제 처리(프로젝트 컨벤션상 Critical 은 같은 턴에 해소해야 함)다. 다만 향후 유사 상황에서는 harness 파서 수정과 그로 인해 드러난 무관 계약 구현을 별도 커밋(가능하면 별도 PR)으로 분리하는 편이 리뷰 단위를 명확히 한다.

- **[INFO]** `dto-jsdoc-citation-guard.ts` 축은 저자 스스로 "User 컬럼과 무관"이라 명명하고 CHANGELOG 제목에서 분리한 곁가지
  - 위치: `CHANGELOG.md:58`("이 두 축이 `User` 컬럼 방어의 전부다. 아래 JSDoc 인용 가드는 **별개 관심사**이고,")·`CHANGELOG.md:61`(`### 곁가지 — DTO JSDoc 주석 위생 (User 컬럼과 무관)`) / 신규 `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`·`dto-jsdoc-citation.spec.ts`·`fixtures/dto/responses/jsdoc-citation.fixture.ts` / `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 정정 / 신규 `plan/in-progress/spec-draft-review-citations-enforcement.md`(138줄, `worktree: user-entity-column-defense` 로 자체 등재)
  - 상세: 이 가드는 리뷰 인용 문구가 공개 OpenAPI DTO JSDoc 으로 새는 것을 막는, "User 컬럼 노출"과는 판정 대상도 방어 원리도 다른 독립 기능이다. 직전 라운드(`review/code/2026/09/06/16_58_14` W2)가 "두 관심사를 한 제목으로 묶지 말라"고 이미 지적했고, 이번 diff 는 CHANGELOG 제목·절을 분리하고 별도 plan 문서(자체 종결 조건 포함)로 추적해 그 지적을 반영했다. 즉 이 스코프 이탈은 이미 인지·disclose·추적된 상태이며 새로 지적할 것은 없다.
  - 제안: 조치 불요. 다만 이 plan 문서가 `worktree: user-entity-column-defense` 를 자신의 소속으로 명시한 것 자체가, 하나의 워크트리/브랜치가 사실상 두 개의 독립된 plan 항목("User 컬럼 방어" + "review-citations 강제화")을 동시에 진행했음을 그대로 보여준다.

- **[INFO]** 다른 워크트리 소유 plan 항목의 상태만 뒤집어 이번 브랜치가 완료 처리했다 (범위 밖이지만 내용 변경 없음)
  - 위치: `plan/complete/spec-draft-api-convention-verifier-registration.md`(신규 이동, `status: complete` 로 1줄 변경) / `plan/in-progress/spec-draft-api-convention-verifier-registration.md`(삭제, `git mv`)
  - 상세: 이 문서는 원래 `worktree: spec-api-convention-code-and-overview-d81cd6` 소속으로 등재돼 있었다(본문은 100% 동일, `status` 필드 한 줄만 다름). `git log`(`e008dd009`) 메시지가 "해당 PR(#1289)이 `origin/main` 에 이미 머지됐고 열린 체크박스가 0인데 in-progress → complete 이동만 누락됐던 것을 consistency-check WARNING 을 받아 정정했다"는 근거를 명시한다. 기계적 lifecycle 정리이고 내용 변경이 없어 실질 위험은 없으나, "User 컬럼 방어" 범위와는 무관한 파일을 건드린 사실 자체는 남는다.
  - 제안: 조치 불요(근거가 커밋 메시지에 명시되어 있고 검증 가능).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 이번 신규 e2e 가 드러낸 파생 계약 갭 — 핵심 목표 밖이지만 그 신규 e2e 자체가 유발한 것이라 인과관계가 직접적
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-93`
  - 상세: 이번 PR 이 새로 추가한 `GET /:id/members` e2e 가 `assertMatchesContract` 를 배선하면서, 실제 응답에는 있지만 DTO 에 선언되지 않았던 `joinedAt` 이 드러나 함께 선언을 추가했다. 필드 JSDoc 에 §5.4 판단 근거(실측: `workspace_member` 를 만드는 4자리 전부 `joinedAt: new Date()` 로 즉시 채움)까지 남겨 투명하다. 핵심 방어 가드와는 별개 계약 정정이지만, "User 엔티티 노출 방어" e2e 자체가 직접 유발한 발견이라 앞의 두 항목보다 원 범위에 더 가깝다.
  - 제안: 조치 불요(이미 투명하게 문서화됨).

## 요약

핵심 산출물(구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`, 그리고 그 스캔이 찾아낸 `WorkflowVersionsService.findOne` 실유출 수정)은 워크트리가 명시한 목적에 정확히 대응하며, 무관한 리팩토링·포맷팅·불필요한 임포트·설정 변경은 발견되지 않았다. 다만 같은 브랜치에는 이 목적에서 파생된 harness YAML 파서 버그 수정(`review_guard.py`)과 그로 인해 게이트 범위가 넓어지며 드러난 트리거 `endpointPath` 충돌 409 계약의 신규 구현(`triggers.controller.ts`/`triggers.service.ts` + `pg-error.ts` 공용 헬퍼 추출)이 함께 실려 있다 — 이 둘은 "User 컬럼 방어"와 주제상 무관하다. 또한 저자 스스로 "User 컬럼과 무관"이라 명명한 `dto-jsdoc-citation-guard.ts` 축(자체 plan 문서로 별도 추적됨)과, 다른 워크트리 소유 plan 항목의 lifecycle 정리(`status` 필드 1줄)까지 포함되어, 하나의 브랜치가 다루는 독립적 관심사의 수(User 컬럼 방어·harness 파서 결함·트리거 API 계약 갭·JSDoc 인용 위생·plan lifecycle 정리)가 이례적으로 많다. 전부 CHANGELOG·plan·커밋 메시지에 실측 근거와 함께 투명하게 disclose 되어 있고, 대부분은 `--impl-done` 게이트가 발견한 Critical 을 같은 턴에 처리해야 한다는 프로젝트 컨벤션에서 파생된 강제 조치라 은폐된 확장은 아니다. 다만 리뷰·롤백 단위를 좁히려면 harness 파서 수정 + 트리거 API 계약 구현, JSDoc 인용 가드는 별도 PR 로 분리하는 편이 더 나았을 것이다.

## 위험도

MEDIUM
