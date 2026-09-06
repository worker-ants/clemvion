# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan 완료 노트의 harness 테스트 카운트가 현재 실측과 소폭 어긋난다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1362` (`> harness 스위트 1,124 pass + 1,254 subtest.` — 이 파일은 프롬프트에서 diff 가 "생략"돼 게이트 번호가 없어, 직접 `Read`/`grep` 으로 확인한 실제 소스 줄 번호를 적는다)
  - 상세: `.claude/tests/test_review_guard.py` 를 포함한 `.claude/tests` 전체를 `python3 -m unittest discover -s .claude/tests -p "test_*.py"` 로 직접 실행하면 `Ran 1132 tests in 130.658s` — `OK` 로, 완료 노트가 적은 "1,124 pass" 와 8건 차이가 난다("1,254 subtest" 는 `unittest` 표준 출력에 그 단위가 없어 다른 도구/집계 기준으로 보이며 직접 대조는 어려웠다). 이 저장소 자신의 메모리 규약("PR 안의 정량 기록은 PR 이 닫히는 시점의 값 — 나중 커밋이 실측을 무효로 만든다")이 정확히 이런 케이스를 지목한다 — 같은 날 여러 라운드가 이어지며 harness 테스트가 계속 추가돼(`test_review_guard.py` 자체에 이번 PR 이 신규 회귀 테스트 9건을 추가) 기록 시점 이후 카운트가 자연스럽게 늘었을 가능성이 높다.
  - 제안: 기능적 결함은 아니다(파서 자체는 정상 동작 확인됨). 다만 이 plan 이 아직 `in-progress` 이고 마지막 체크박스(`--impl-done 재실행으로 Critical 해소 확인`)도 미완료 상태이므로, 이 항목을 닫는 시점에 `pass`/`subtest` 수치를 그 시점 실측치로 다시 찍기를 권한다. Critical/Warning 은 아니므로 이번 라운드에서 반드시 고칠 필요는 없다.

- **[INFO]** 이전 라운드에서 지적됐던 문서화 결함들이 이번 상태에서 모두 해소됨을 확인 (재발 없음, 조치 불요)
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`findEagerUserRelations`/`collectUserRelationNames` 각각의 JSDoc), `codebase/backend/test/workspace-rbac.e2e-spec.ts` / `codebase/backend/test/workflow-crud.e2e-spec.ts` (시나리오 레이블), `spec/conventions/review-citations.md` / `spec/conventions/spec-impl-evidence.md` (Rationale 정정)
  - 상세: 직전 라운드(`review/code/2026/09/06/11_55_36/documentation.md`)가 지적한 "JSDoc 블록이 `findEagerUserRelations` 앞에 남고 `collectUserRelationNames` 는 무주석" 문제를 직접 파일을 열어 재확인한 결과, 현재는 두 함수 각각 자신을 정확히 설명하는 JSDoc 을 갖고 있다. 같은 라운드가 지적한 e2e 레이블 중복(`F.` 두 개)도 `workspace-rbac.e2e-spec.ts` 에서 `J.` 로, `workflow-crud.e2e-spec.ts` 의 신규 `H.` 도 기존 A~G 와 충돌 없이 이어진다(직접 grep 대조). `review-citations.md`/`spec-impl-evidence.md` 의 "시행 코드가 없다" 는 반증된 전제도 `CLAUDE.md` 의 자기-반증형 소정정 5조건 중 1번(그 문장을 developer 자신이 쓰지 않음, `git log -S` 로 planner 턴 확인 가능)이 깨진다는 점을 스스로 인지해 planner 턴으로 우회 없이 처리했고, 취소선 + 축 단위 정정 + 선례 인용 재조정까지 CLAUDE.md 규약을 문자 그대로 따랐다.
  - 제안: 조치 불요 — 새로 지적할 결함이 아니라 이전 지적이 이번 diff 안에서 실제로 해소됐음을 확인차 기록한다.

## 요약

이번 diff(`User` 엔티티 민감 컬럼 노출 검출 3축 신설, `WorkflowVersionsService.findOne`/`triggers.service.ts` 실유출·계약 미스매치 수정, `review_guard._parse_frontmatter_code` YAML 파서 정정, 그에 따른 `CHANGELOG.md`·`spec/conventions/*.md`·`plan/in-progress/*.md` 갱신)의 문서화 품질은 이 리뷰가 검토한 범위 중 최상급이다. 새로 도입된 모든 공개 함수·타입·상수(`findEagerUserRelations`, `collectUserRelationNames`, `findUserRelationLoads`, `findDtoJsDocCitations`, `pgErrorConstraint`, `isEndpointPathUniqueViolation`, `CREATOR_PROJECTION`, `ProjectedCreator`, `USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`, `makePgError`/`makePgUniqueViolation` 등)가 예외 없이 "무엇을 하는가" 뿐 아니라 "왜 이 형태인가"·"어떤 대안을 기각했는가"·"실측 수치"·"이전 라운드에서 이 자리가 어떻게 좁았고 어떻게 넓혔는가"를 구체적 리뷰 인용과 함께 남긴다. 기존 주석이 변경된 코드와 어긋나는 자리(오래된 주석)를 다수 파일에서 직접 대조했으나 발견되지 않았고(`WorkspaceMemberDto.joinedAt` 주석의 "네 자리" 실측도 코드와 정확히 일치), 오히려 `WorkflowVersionsService`/`WorkflowVersionDetail`/`workflows.ts` 처럼 이름이 같은 별도 선언이 있는 자리마다 상호 참조 주석을 남겨 "여긴 SoT 가 아니다" 를 명시하는 등 일반적인 수준을 넘는다. CHANGELOG 는 이번 변경(검출 방어선 신설, 실유출 수정, harness 파서 회귀, spec Rationale 반증)을 빠짐없이 서술하고 있으며, plan 체크박스는 실제 완료 상태와 정확히 일치한다(직접 대조). DTO JSDoc 이 공개 OpenAPI description 이 된다는 규약(`review-citations.md §3`)을 준수해 내부 서사를 `//` 로 옮기는 관례도 신규 코드 전체에서 일관되게 지켜졌다. 유일하게 짚을 만한 것은 plan 완료 노트에 적힌 harness 테스트 통과 건수(1,124)가 지금 실행한 실측(1,132)과 8건 차이가 나는 정도이며, 이는 같은 날 여러 라운드가 이어지며 테스트가 늘어난 자연스러운 드리프트로 보이고 그 plan 항목이 아직 열려 있어 종결 시점에 다시 재는 것으로 충분하다.

## 위험도

LOW
