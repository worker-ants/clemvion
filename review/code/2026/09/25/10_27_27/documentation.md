# 문서화(Documentation) 리뷰 — harness-probe-isolation

## 발견사항

- **[INFO]** 커밋된 사전 일관성 검토 산출물이 이름 변경 전 식별자(`make_probe_repo`)를 그대로 담고 있다
  - 위치: `review/consistency/2026/09/25/09_56_00/naming_collision.md`(전체), `SUMMARY.md:22-23,33,47,50`, `convention_compliance.md:43`
  - 상세: `plan/in-progress/harness-probe-isolation.md` §G 에 따르면 사전 검토(WARNING W2)를 받아
    실제 코드는 `make_probe_repo` → **`make_temp_repo_copy`** 로 개명되고 `make_temp_git_repo` 에
    위임하도록 구현됐다(`.claude/tests/_harness.py:138` 확인). 그런데 그 검토를 만든 세션 산출물
    (`09_56_00/` 하위 5개 파일)은 개명 이전 시점 스냅샷이라 여전히 `make_probe_repo` 를 식별자로
    인용한다. 향후 누군가 `review/consistency/**` 에서 `make_probe_repo` 를 grep 해 "존재하는 것으로
    문서화된 함수인데 코드에는 없다"고 오인할 여지가 있다.
  - 제안: 조치 불요 — 리뷰 산출물은 프로젝트 관례상 시점 스냅샷(불변 이력)이며, 개명 근거와 최종
    이름은 target 문서(`harness-probe-isolation.md` §G)와 코드 docstring에 이미 정확히 남아 있다.
    실제로 이 개명 자체가 그 세션의 WARNING 을 반영한 결과이므로 재작업 대상이 아니라는 점만 참고로
    남긴다.

- **[INFO]** `harness-review-gate-followups.md` §13 "pre-existing 4곳" 목록의 정정 보류가 plan 에 명시적으로 기록됨
  - 위치: `plan/in-progress/harness-probe-isolation.md` §G INFO4 행
  - 상세: `test_consistency_bundle_priority.py` 의 git 호출이 이 PR 이전부터 이미 전부
    `_harness.git_in` 경유였다는 사실(실측: `grep` 2곳, `_harness.git_in` 호출은 409행·776행)을
    developer 가 확인했으나, `harness-review-gate-followups.md` §13 목록 자체의 정정은 "이 PR 의
    축이 아니라 두지 않는다"고 의도적으로 유보했다. 실측·근거가 plan 문서에 남아 있어 "유예 근거는
    실측해야 한다" 관례를 충족하므로 결함은 아니고, 해당 §13 항목이 여전히 stale 한 상태로 남아
    있다는 사실만 기록해 둔다.

- **[INFO]** README 신규 규약 문구와 헬퍼 docstring·CHANGELOG·plan 문서 간 수치·서술이 전부 일치함(정합성 확인, 조치 불요)
  - 위치: `.claude/tests/README.md:109-118`, `.claude/tests/_harness.py:138-157`(`make_temp_repo_copy` docstring), `CHANGELOG.md:3-19`, `plan/in-progress/harness-probe-isolation.md` §A~§E
  - 상세: "2026-09-25 four concurrent runs left `<!-- uncommitted probe -->` lines … in 5 of 6
    rounds"(README) / "pytest 4개 동시 실행 6라운드 중 5라운드"(CHANGELOG, plan §B) / "97 → 0"
    (CHANGELOG, plan §E) 수치가 모두 교차 일치했고, 고친 뒤 재현(0/6·0/24)도 동일하게 인용됐다.
    커밋 로그도 plan 이 인용한 해시(`128cc9746`, `84782583e`)와 실제 `git log` 를 대조해 확인했다.
    별도 조치 필요 없음 — 이 변경군의 문서·주석·CHANGELOG 정합성은 높은 수준이라는 점을 결과로
    남긴다.

## 요약

이번 변경은 하네스 pytest 4개가 실제 저장소 트리(체크아웃)에 프로브를 남기던 문제를 임시 git 사본
격리로 고치면서, `.claude/tests/README.md` 규약 갱신·`_harness.make_temp_repo_copy` 의 근거가 상세한
docstring·`CHANGELOG.md` 항목·`plan/in-progress/harness-probe-isolation.md` 의 전수/재현/뮤턴트/전후
census 기록·연관 트래커(`harness-review-gate-followups.md`)로의 상호 참조 추가까지, 문서화 관점에서
요구되는 항목을 빠짐없이 갖췄다. 기존 주석 중 사실관계가 바뀐 것(예: "저장소 상대경로" → "cwd 상대")도
정확히 갱신됐고, 새로 추가된 테스트 클래스(`TheRepoCopyFixtureTest`)와 이름이 바뀐 테스트
(`test_the_probe_runs_outside_this_checkout`)의 docstring 도 실제 동작·실측과 어긋나지 않는다. 유일하게
남는 것은 이름 변경 이전 시점에 커밋된 `review/consistency/2026/09/25/09_56_00/**` 산출물이 옛 식별자
`make_probe_repo` 를 인용하는 점인데, 이는 프로젝트 관례상 불변 이력 스냅샷이라 결함으로 보지 않는다.
Critical·Warning 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
