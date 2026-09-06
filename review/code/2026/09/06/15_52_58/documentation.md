# 문서화(Documentation) 리뷰

## 참고 — 이번 라운드의 대상 범위

`origin/main...HEAD` 는 267개 파일·+25,571/-28 이지만, 그중 약 240개는 이 브랜치 자신이
과거에 생성한 `review/code/**`·`review/consistency/**` 라운드 산출물(11회의 `/ai-review`
+ `/consistency-check` 반복이 남긴 이력)이다. 실제 "지금 리뷰해야 할 변경"은 다음
27개 파일로 좁혀진다: `.claude/hooks/_lib/review_guard.py`, `.claude/tests/test_review_guard.py`,
`CHANGELOG.md`, `codebase/backend/src/common/db/pg-error.{ts,spec.ts}`,
`codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}`,
`codebase/backend/src/modules/workflow-versions/workflow-versions.service.{ts,spec.ts}`,
`codebase/backend/src/modules/workspaces/**`, `codebase/backend/src/repo-guards/__tests__/**`
(신규 가드 3종 + fixture), `codebase/backend/src/shared/testing/user-secret-absence.{ts,spec.ts}`,
`codebase/backend/test/*.e2e-spec.ts` 3건, `plan/in-progress/spec-draft-*.md` 2건,
`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`.
아래 발견사항은 이 실제 diff 를 `git diff origin/main...HEAD -- codebase .claude plan spec
CHANGELOG.md` 로 좁혀 직접 읽고 작성했다(프롬프트에 diff 가 생략된 파일들도 `Read`/`grep`
으로 전문을 확인).

## 발견사항

이번 diff 는 이미 11회의 `/ai-review`+`/consistency-check` 라운드를 거치며 문서화 결함이
반복적으로 지적·수정된 최종 상태다. 직접 코드·주석·수치를 대조해 재확인했고, **새로
지적할 실질적 문서화 결함을 찾지 못했다.**

과거 라운드가 지적했던 항목들이 현재 상태에서 실제로 해소돼 있음을 아래와 같이 확인했다:

- `user-entity-exposure-guard.ts` — `findEagerUserRelations`/`collectUserRelationNames`
  의 JSDoc 이 각각 올바른 함수 위에 붙어 있다(`review/code/2026/09/06/11_55_36` W1 이
  지적한 orphan JSDoc 재발 없음).
- `dto-jsdoc-citation.spec.ts` — fixture 경로가 `CITATION_FIXTURE` 상수 하나로 통합돼
  있다(`review/code/2026/09/06/13_39_20` WARNING 이 지적한 3곳 인라인 중복 재발 없음).
- `workspace-rbac.e2e-spec.ts`/`workflow-crud.e2e-spec.ts` — 신규 케이스 라벨이 각각
  `J.`/`H.` 로 유일하며 기존 A~I 순서와 충돌하지 않는다(`10_13_22` WARNING 재발 없음).
- `.claude/hooks/_lib/review_guard.py::_strip_comment` — 도입 직후 한 번 어긋났던
  docstring("따옴표 없는 스칼라의…")이 현재는 인용/비인용 두 분기를 모두 서술하도록
  정정돼 있다(`review/code/2026/09/06/15_30_59` W3 재발 없음).
- 다음 실측 수치들을 코드와 직접 대조해 정확함을 확인했다: `WorkflowVersionsService`
  `CREATOR_PROJECTION` 3필드, `WorkspacesService.listMembers` 반환 6키,
  `workspace_member.joined_at` 컬럼이 `V001__initial_schema.sql:57` 에서 `NOT NULL`
  없이 선언된 것, `joinedAt: new Date()` 를 쓰는 4자리(`workspace-invitations.service.ts`
  1곳 + `workspaces.service.ts` 3곳), 프런트엔드 `lib/api/workflows.ts:109` 의
  `WorkflowVersionDetail`/`creator?: {...} | null` 손-미러 서술.
- `spec/conventions/review-citations.md`/`spec-impl-evidence.md` 의 자기-반증형 소정정은
  CLAUDE.md 가 요구하는 형식(취소선으로 원문 보존 + 날짜 있는 정정 콜아웃 + 축 단위로
  범위 한정)을 그대로 따른다.

새로 찾은 결함은 없으나, 문서화 관점에서 참고할 만한 미세한 관찰 하나를 남긴다(조치
불요, INFO 미만이라 별도 항목화하지 않음): `dto-jsdoc-citation-guard.ts` 의
`JsDocCitation.citations` 필드 JSDoc 은 "매치된 텍스트 **전부**" 라고만 적어, 같은 파일의
`findCitations` 함수 JSDoc("형태당 첫 매치 하나씩")과 나란히 읽지 않으면 "모든 occurrence"
로 오독될 여지가 아주 미세하게 있다. 두 JSDoc 이 물리적으로 30줄 이내에 있고 함수 이름도
바로 이어 나와 실제 오독 가능성은 낮다고 판단해 별도 발견사항으로 올리지 않았다.

## 요약

`User` 엔티티 컬럼 노출 방어 3축(구조/이름/JSDoc 인용) 신설 + 두 개의 실유출 수정
(`WorkflowVersionsService.findOne`, 감사 로그) + 하네스 파서 회귀 수정 + spec 자기-반증형
정정으로 구성된 최종 diff의 문서화 품질은 이례적으로 높다. CHANGELOG·plan 완료 노트·각
가드 파일 헤더 JSDoc이 "왜 이 방식을 택했는가"·"왜 기각했는가"를 실측 수치와 함께 일관되게
남기고, 그 수치들을 이번 라운드에서 직접 재검증한 결과 서술과 실제 코드가 정확히 일치했다.
11회의 선행 리뷰 라운드가 지적한 문서화 결함(orphan JSDoc, fixture 경로 중복, e2e 라벨
충돌, docstring 자기모순, YAML 주석 파서 회귀 등)은 전부 최종 상태에서 해소가 확인됐고
재발이 없다. 이번 라운드에서 새로 제기할 Critical/Warning 은 없다.

## 위험도

NONE
