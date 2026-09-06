# 변경 범위(Scope) 리뷰

## 개요

`git diff origin/main...HEAD` 는 31개 코드/스펙/plan 파일(+ 다수의 `review/**` 리뷰 산출물)을 바꾼다. 워크트리 이름과 plan 완료 노트(`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 가리키는 주 목적은 **"`User` 엔티티 컬럼 수준 노출 방어(검출)"** 다 — 구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts` 신설과 그 배선(e2e 2건), 그리고 그 스캔이 찾아낸 실제 유출(`WorkflowVersionsService.findOne` 의 `creator` 미투영) 수정이 여기 해당한다. 이 부분은 명확히 의도된 범위다.

그러나 같은 브랜치의 10개 커밋을 추적해 보면, 이 주 목적에서 파생된 **최소 3개의 인과적으로 연결되었지만 주제상 별개인 관심사**가 함께 실려 있다 — 전부 CHANGELOG·plan·커밋 메시지에 투명하게 disclose 되어 있고 은폐된 것은 없지만, "Scope" 관점에서는 하나의 PR/브랜치가 다루는 관심사의 수가 이례적으로 많다.

## 발견사항

- **[WARNING]** 주 목적("User 컬럼 방어")과 무관한 harness 파서 수정 + 그로 인해 촉발된 API 계약 구현이 같은 브랜치에 실려 있다
  - 위치: `.claude/hooks/_lib/review_guard.py:600`(`_parse_frontmatter_code`)·`:626`(`_strip_comment`)·`:650`(`_clean`), `.claude/tests/test_review_guard.py`(신규 149줄), `codebase/backend/src/modules/triggers/triggers.controller.ts:23,98-101,127-130`(`ApiConflictResponse` 추가), `codebase/backend/src/modules/triggers/triggers.service.ts:19,213,216,222,225,426,512,1607-1608`(`isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict` 신설), `codebase/backend/src/common/db/pg-error.ts`(`pgErrorConstraint` 신설) + `pg-error.spec.ts`/`pg-error-fixtures.ts`(신규)
  - 상세: CHANGELOG.md:1~53 서술을 그대로 따라가면 인과관계는 이렇다 — (1) DTO JSDoc 인용 가드를 새로 세우려고 spec frontmatter `code:` 에 YAML 범주 주석을 넣음 → (2) 그 주석이 `review_guard._parse_frontmatter_code` 의 블록 리스트 파서를 깨뜨려 spec 387개 중 41개 entry 가 조용히 유실 중이었음을 발견 → (3) 파서를 고쳐 게이트 범위가 넓어짐 → (4) 넓어진 범위가 `2-trigger-list.md §3` 이 문서화했지만 구현되지 않았던 `(workspace_id, endpoint_path)` UNIQUE 위반 시 409 계약 갭을 새로 검출 → (5) 그 계약을 실제로 구현(`triggers.controller.ts`/`triggers.service.ts`)하며 `pg-error.ts` 를 공용 SoT 로 추출. 이 다섯 단계 각각은 논리적으로 이어져 있고 전부 문서화돼 있지만, 최종 산출물은 **"User 엔티티 컬럼 방어"라는 이름의 브랜치/PR 에 harness YAML 파서 버그 수정과 트리거 엔드포인트 충돌 API 계약 구현이 함께 들어간** 상태다. 두 산출물은 그 자체로는 정당한 수정이지만 주제상 "User 컬럼 노출 방어"와 무관하며, 별도 PR 로 분리했다면 각각 독립적으로 리뷰·되돌리기가 가능했을 것이다.
  - 제안: 조치 불요할 수 있음(이미 인과관계가 CHANGELOG·plan·커밋 메시지에 상세히 disclose 됨, 각 단계가 실측 근거를 동반). 다만 향후 유사 상황에서는 harness 파서 수정과 그로 인해 드러난 무관 계약 구현을 별도 커밋/PR 로 분리하는 편이 리뷰·롤백 단위를 명확히 한다.

- **[INFO]** `dto-jsdoc-citation-guard.ts` 축은 저자 스스로 "User 컬럼과 무관"이라 명명한 곁가지
  - 위치: `CHANGELOG.md:61`(`### 곁가지 — DTO JSDoc 주석 위생 (User 컬럼과 무관)`), `CHANGELOG.md:58`(`이 두 축이 \`User\` 컬럼 방어의 전부다. 아래 JSDoc 인용 가드는 별개 관심사이고,`)
  - 상세: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts`/`fixtures/dto/responses/jsdoc-citation.fixture.ts` 신설 + `spec/conventions/review-citations.md`·`spec/conventions/spec-impl-evidence.md` 정정 + `plan/in-progress/spec-draft-review-citations-enforcement.md` 신설(138줄)은 리뷰 인용 문구가 공개 OpenAPI DTO JSDoc 에 새는 것을 막는 별개 가드다. 이미 이전 라운드(`review/code/2026/09/06/16_58_14` W2)가 "두 관심사를 한 제목으로 묶지 말라"고 지적했고, 이번 diff 는 그 지적을 받아들여 CHANGELOG 제목과 절을 분리했다 — 즉 이 스코프 이탈은 **이미 인지·disclose 된 상태**다. 새로 지적할 것은 없고, 그 disclose 가 실제로 이번 diff 에 반영되어 있음을 확인차 기록한다.
  - 제안: 조치 불요.

- **[INFO]** 다른 worktree 소유 plan 항목의 상태만 뒤집어 이번 브랜치가 완료 처리했다
  - 위치: `plan/complete/spec-draft-api-convention-verifier-registration.md:3`(`worktree: spec-api-convention-code-and-overview-d81cd6`)·`:6`(`status: complete`) — 원본 `plan/in-progress/spec-draft-api-convention-verifier-registration.md`(origin/main 상 `status: in-progress`) 와 diff 하면 **YAML `status` 필드 한 줄**만 다르고 본문은 100% 동일.
  - 상세: 이 plan 문서는 `worktree: spec-api-convention-code-and-overview-d81cd6` 라는, 이번 작업과 무관한 다른 워크트리 소속으로 등재돼 있다. 이번 브랜치(`user-entity-column-defense`)의 커밋 `e008dd009` 메시지가 "자매 plan `…verifier-registration.md` 를 `plan/complete/` 로 (열린 체크박스 0, `origin/main` 에 #1289(983fd0ade) 머지 확인) (consistency W2)" 라고 명시적으로 근거를 남겼다 — 즉 실제 작업 내용은 이미 `origin/main` 에 별도 PR(#1289)로 머지돼 있었고, 그 PR 이 in-progress 파일의 status 플립을 빠뜨린 것을 이번 브랜치가 consistency-check WARNING 을 받아 정정한 것이다. 기계적이고 내용 변경이 없는 lifecycle 정리이므로 실질 위험은 없지만, "User 컬럼 방어" 범위와는 무관한 파일을 건드린 것은 사실이다.
  - 제안: 조치 불요(근거가 커밋 메시지에 명시돼 있고 내용 변경이 없어 검증 가능).

## 요약

핵심 산출물(구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`, 그리고 그 스캔이 찾아낸 `WorkflowVersionsService.findOne` 실유출 수정)은 워크트리가 명시한 목적에 정확히 대응하며 무관한 리팩토링·포맷팅·불필요한 임포트는 발견되지 않았다. 다만 같은 브랜치에는 이 목적에서 파생된 harness YAML 파서 버그 수정(`review_guard.py`), 그로 인해 게이트 범위가 넓어지며 드러난 트리거 `endpointPath` 충돌 409 계약 구현(`triggers.controller.ts`/`triggers.service.ts` + `pg-error.ts` 공용 헬퍼 추출), DTO JSDoc 인용 가드(저자 스스로 "User 컬럼과 무관"이라 명명), 그리고 다른 워크트리 소유 plan 항목의 lifecycle 정리까지 함께 실려 있다. 이들은 전부 CHANGELOG·plan·커밋 메시지에 상세한 실측 근거와 함께 투명하게 disclose 되어 있어 은폐된 스코프 확장은 아니지만, 하나의 브랜치가 다루는 관심사의 수(User 컬럼 방어 · harness 파서 결함 · 트리거 API 계약 갭 · JSDoc 인용 위생 · spec convention 자기정정)가 이례적으로 많아 리뷰·롤백 단위가 흐려진다는 점은 구조적으로 지적할 만하다.

## 위험도

MEDIUM
