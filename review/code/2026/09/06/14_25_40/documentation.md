# 문서화(Documentation) 리뷰

## 개요

이 diff(`origin/main...HEAD`, 8개 커밋)는 `User` 엔티티 컬럼 노출을 검출하는 3축 가드
(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축,
`dto-jsdoc-citation-guard.ts` JSDoc 인용 축), `WorkflowVersionsService.findOne` 의 실유출
수정(`CREATOR_PROJECTION`), `WorkspaceMemberDto.joinedAt` 필드 추가, 그리고 harness 파서
결함 수정(`review_guard._parse_frontmatter_code`)으로 구성된다. 같은 브랜치 계열에서 이미
7차례의 `/ai-review`+`/consistency-check` 라운드(`10_13_22`→`13_52_23`)를 거쳤고, 이번
라운드에서 실제 코드·CHANGELOG·plan 완료 노트·spec Rationale 정정을 직접 열어 대조한 결과,
과거 라운드가 지적한 문서화 결함(JSDoc orphan 블록, e2e 라벨 중복, `line` 필드 미사용,
fixture 경로 중복 선언, stale count)은 전부 실제로 해소돼 있었다 — 재발 없음.

## 발견사항

- **[INFO]** `_parse_frontmatter_code` 의 함수 docstring 이 이번에 추가된 "블록 리스트가
  빈 줄·`#` 주석을 건너뛴다" 는 새 동작을 요약하지 않는다
  - 위치: `.claude/hooks/_lib/review_guard.py` 함수 `_parse_frontmatter_code` 최상단
    docstring(`"""Extract the \`code:\` glob list ... Returns [] when there is no
    frontmatter or no \`code:\` field."""`)
  - 상세: 이번 diff 가 블록 리스트 루프에 빈 줄·`#` 주석 skip 로직과 그 근거를 설명하는
    풍부한 인라인 주석(한국어, 로직 바로 위)을 추가했지만, 함수 계약을 요약하는 최상단
    docstring 자체는 "inline / single-value / block-list 세 형태를 처리한다" 는 종전 문장
    그대로다. 인라인 주석을 읽으면 정확히 알 수 있지만, 함수 시그니처·docstring 만 보고
    호출하는 다음 사람(예: 다른 스크립트에서 이 함수를 재사용할 때)은 "block-list 안에
    주석·빈 줄이 섞여도 안전하게 건너뛴다" 는, 이번에 새로 보장된 계약을 docstring
    수준에서는 알 수 없다. 기능적 결함은 아니고 인라인 주석이 상세 근거를 충분히 남기고
    있어 영향은 작다.
  - 제안: docstring 마지막 문장에 한 구절만 추가 — 예:
    `"Block-list entries skip blank lines and \`#\` comments; a non-\`- \` line still
    ends the list."`

- **[INFO]** (검증 완료, 조치 불요) 과거 라운드가 지적한 문서화 결함이 이번 최종 상태에서
  전부 해소되어 있음을 직접 코드를 열어 재확인
  - `user-entity-exposure-guard.ts`: `findEagerUserRelations` JSDoc(83~102행)과
    `collectUserRelationNames` JSDoc(143~157행)이 각각 올바른 함수를 설명한다 —
    `review/code/2026/09/06/11_55_36` 이 지적한 orphan JSDoc 블록은 재발하지 않았다.
    `UserRelationLoad` 인터페이스(23~30행)에도 미사용 `line` 필드가 없다 —
    `review/code/2026/09/06/10_13_22`(maintainability) 지적이 해소됐다.
  - `dto-jsdoc-citation.spec.ts`: `CITATION_FIXTURE` 경로 상수가 모듈 최상위에 한 번만
    선언되어 세 `it()` 이 재사용한다(56~62행) — `review/code/2026/09/06/13_39_20`
    (maintainability WARNING)이 지적한 3곳 인라인 중복이 해소됐다.
  - `codebase/backend/test/workflow-crud.e2e-spec.ts`(`H.`)·
    `codebase/backend/test/workspace-rbac.e2e-spec.ts`(`J.`) 모두 라벨이 유일하고
    알파벳 순서를 지킨다 — `review/code/2026/09/06/10_13_22`(scope/maintainability)가
    지적한 `F.` 라벨 중복이 해소됐다.
  - `CHANGELOG.md`(19곳·46곳·4곳 등 실측치), plan 완료 노트, `dto-jsdoc-citation.spec.ts`
    상단 JSDoc 의 수치가 서로 일치하며 코드 실체와도 부합한다.
  - 새로 지적할 결함이 아니라, 다회 리뷰 라운드의 반영 상태를 확인한 기록.

## 요약

이 diff 의 문서화 품질은 이례적으로 높다. `CREATOR_PROJECTION`/`ProjectedCreator`/
`USER_SECRET_KEYS`/`findEagerUserRelations`/`collectUserRelationNames` 등 신규 공개
함수·타입·상수 전부가 "왜 이 방식인가"·"왜 다른 대안을 기각했는가"를 실측 수치와 함께
남기고, `CHANGELOG.md` 신규 절과 `plan/in-progress/spec-draft-nullable-notation-followups.md`
완료 노트가 코드와 정확히 대응한다. 특히 두 건이 CLAUDE.md 의 자기-반증형 소정정 규약을
모범적으로 따른다 — `spec/conventions/review-citations.md`·`spec-impl-evidence.md` 의
"이 규약에는 시행 코드가 없다" 라는 예고 문장을, developer 가 아니라 **planner 턴**
(`plan/in-progress/spec-draft-review-citations-enforcement.md`)을 열어 취소선 보존 +
축 단위 정정으로 고쳤고("§3 은 응답 DTO 축만 강제, 컨트롤러 축은 미강제"), 그 정정의
결과로 게이트 파서 자체가 조용히 깨졌던 것(주석 뒤 41개 entry 유실, 그중 1개가 이 PR
자신의 수정 파일을 덮던 것)까지 harness 코드 수정 + 회귀 테스트 3건 + CHANGELOG 서술로
투명하게 남겼다. 오래된 주석과 코드의 불일치, README 누락(이 저장소의 `repo-guards/`
디렉터리는 애초에 README 없이 파일 헤더 JSDoc 관례를 따르므로 해당 없음), 설정/환경변수
문서화 갭도 발견되지 않았다. `spec/5-system/2-api-convention.md`·`swagger.md §5-1` 의
"두 검증자" 서술이 3축 신설로 낡은 것은 이 diff 가 그 파일들을 건드리지 않고(`git diff
--stat` 로 확인) plan 에 planner 후속 항목으로 명시 등재돼 있어 이 diff 자체의 결함이
아니다. 새로 찾은 것은 harness 파서 함수의 docstring 이 새 skip 동작을 요약하지 않는
사소한 INFO 한 건뿐이며, 렌더링·판정 결과에는 영향이 없다.

## 위험도

NONE
