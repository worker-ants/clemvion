# 문서화(Documentation) 리뷰 — harness-probe-isolation (2라운드, `10_45_12`)

## 발견사항

- **[INFO]** 커밋된 사전 consistency-check 산출물이 개명 전 식별자(`make_probe_repo`)를 그대로 인용
  - 위치: `review/consistency/2026/09/25/09_56_00/naming_collision.md`(전체), `SUMMARY.md`, `convention_compliance.md`
  - 상세: 실제 코드는 그 검토의 W2 를 반영해 `make_probe_repo` → `make_temp_repo_copy` 로 개명되고
    `make_temp_git_repo` 에 위임하도록 구현됐다(`.claude/tests/_harness.py:138` 확인). 검토 산출물은
    개명 이전 스냅샷이라 옛 이름을 그대로 담고 있다. 이 항목은 직전 라운드(`10_27_27`)의
    documentation 리뷰가 이미 발견해 "조치 불요(리뷰 산출물은 시점 스냅샷 관례)"로 처분한 것과 동일
    사안이다 — 이번 라운드에서 새로 추가된 것이 아니라 재확인일 뿐이다.
  - 제안: 조치 불요(기존 처분 유지). 최종 이름은 `harness-probe-isolation.md` §G 와 코드 docstring 에
    정확히 남아 있어 실제 혼동 위험은 낮다.

- **[INFO]** `make_temp_repo_copy` docstring 이 `subtrees` 간 경로 중첩(예: `("spec", "spec/5-system")`) 시
  `shutil.copytree` 가 `FileExistsError` 로 실패하는 경계를 언급하지 않는다
  - 위치: `.claude/tests/_harness.py` `make_temp_repo_copy` 함수 (정의부 docstring)
  - 상세: 현재 5개 호출부는 모두 `"spec/5-system"` 단일·비중첩 subtree 만 사용해 트리거되지 않는다.
    이 지적은 직전 라운드 SUMMARY 의 INFO 3 과 동일 사안이며 그때도 "현재 호출부 무해, 조치 불요"로
    처분됐다 — 재발이 아니라 확인.
  - 제안: 조치 불요. 다중/중첩 subtree 호출부가 생기는 시점에 docstring 보강을 재검토.

- **[INFO]** `RouterPromptStatesCompositionTest._prepare_over` 에 새로 추가된 `cwd` 파라미터에 독스트링이 없다
  - 위치: `.claude/tests/test_router_decision_trust.py` `_prepare_over` 메서드
  - 상세: 이 파일의 다른 private 테스트 헬퍼들도 대체로 독스트링이 없는 기존 스타일과 일관되고,
    호출부(`test_long_source_list_is_truncated_with_an_accurate_remainder`)에 `cwd` 의 목적을 설명하는
    인라인 주석이 바로 붙어 있어 실질적 이해에 지장은 없다.
  - 제안: 조치 불요(우선순위 최하). 필요하면 "특정 cwd 에서 `--prepare` 를 구동한다" 한 줄 추가.

- **[INFO]** 독스트링·주석·README·CHANGELOG·plan 간 수치·서술이 실제 코드/구현과 교차 일치함을 재확인
  - 위치: `.claude/tests/README.md`(신규 규약 문단), `.claude/tests/_harness.py`(`make_temp_repo_copy`
    docstring), `CHANGELOG.md`(Unreleased 항목), `plan/in-progress/harness-probe-isolation.md`(§A~§E)
  - 상세: 다음을 직접 코드로 대조해 확인했다 — `consistency_orchestrator.repo_root()` 가 실제로
    `os.getcwd()` 를 반환함(주석 및 CHANGELOG 서술과 일치), `output_dir` 기본값이 실제로
    `os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency")` 로 cwd 상대임(README·주석과
    일치), `make_temp_repo_copy` 가 `--allow-empty` 를 실제로 사용해 무-subtree 호출도 성공함(RESOLUTION.md
    W1 조치와 코드 일치), `five_system_copy` 헬퍼가 정확히 5곳에서 재사용됨(README·plan 이 말하는
    "다섯 스니펫"과 일치), `test_no_subtrees_is_an_empty_copy_not_an_error` 의 `tracked == [".gitkeep"]`
    단언이 `make_temp_git_repo` 의 초기 커밋 동작과 일치. Critical/Warning 급 불일치는 발견되지 않았다.
  - 제안: 조치 불요.

## 요약

이번 2라운드 diff(누적: harness 코드 6개 파일 + `CHANGELOG.md` + plan 3개 + 이전 라운드(`10_27_27`)의 리뷰
산출물 커밋 + 개명 반영)는 1라운드에서 지적된 documentation 관점 이슈가 전혀 없었던 상태(`documentation:
NONE`)에서 출발해, W1(빈 `subtrees` 호출 시 `CalledProcessError`)과 W2(다섯 곳 보일러플레이트 중복)를
각각 `--allow-empty` + 경계 테스트, `orchestrator_preamble(extra=...)` 를 통한 `five_system_copy` 단일화로
해소하면서 docstring·CHANGELOG·plan·`.claude/tests/README.md`·연관 트래커(`harness-review-gate-followups.md`,
`spec-draft-nullable-notation-followups.md`)까지 일관되게 갱신했다. 코드로 직접 대조한 결과 `repo_root()`,
`CONSISTENCY_OUTPUT_DIR` 기본값, `--allow-empty` 커밋, `five_system_copy` 재사용 횟수 등 문서가 주장하는
동작이 실제 구현과 정확히 일치한다. 남는 항목은 전부 이미 이전 라운드에서 발견·처분된 INFO 의 재확인이거나
현재 호출부에서 트리거되지 않는 엣지 케이스에 대한 최하위 우선순위 제안뿐이며, 병합을 막을 문서화 결함은
없다.

## 위험도

NONE
