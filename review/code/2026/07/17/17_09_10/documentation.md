# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan 문서의 "구현 결과" 서술과 실제 diff 의 테스트 개수가 문자 그대로는 어긋남
  - 위치: `plan/in-progress/harness-session-anchor-guards.md` (①번 항목 "구현 결과" 문단), 대응 코드는 `.claude/tests/test_reap_merged_worktrees.py`
  - 상세: plan 은 "테스트는 `.claude/tests/test_reap_merged_worktrees.py` 에 **8건** 추가" 라고 적었지만, 실제 diff 에는 `def test_` 신규 정의가 **9건**이다(`test_keep_protects_anchor_when_cwd_is_a_different_worktree`, `test_keep_does_not_shield_other_merged_worktrees`, `test_keep_matches_whole_path_not_prefix`, `test_keep_when_cwd_equals_anchor_is_harmless`, `test_dry_run_does_not_plan_to_remove_a_kept_worktree`, `test_keep_requires_a_value`, `test_unknown_argument_still_rejected`, `test_bootstrap_keeps_the_worktree_it_was_invoked_from`, `test_bootstrap_still_reaps_unrelated_merged_worktrees`). `git diff origin/main -- .claude/tests/test_reap_merged_worktrees.py | grep -F '+    def test_' | wc -l` → `9` 로 실측 확인. 뒤이은 "전체 8건이 fix 이전 코드에서 실패함을 확인(6건 실패 + `--keep` 인자 검증 2건은 구 파서의 unknown-arg exit 2 로 통과)" 문장과 대조해보면, `test_unknown_argument_still_rejected`(기존 `--bogus` 미지 인자 거부 회귀 보호, `--keep` 기능과 무관하고 신·구 파서 모두 동일하게 exit 2)만 "8건" 집계에서 빠진 것으로 보여 **의도적으로 --keep 관련 8건만 센 것**일 가능성이 높다 — 그렇다면 오기라기보다 불명확한 표현이다. 다만 plan 문서 자체에는 이 구분이 명시돼 있지 않아, 문자 그대로 diff 와 대조하면 개수가 안 맞는 것처�4렴 읽힌다.
  - 제안: "8건 추가" 를 "9건 추가(그중 8건이 `--keep`/앵커 가드 관련, 1건은 기존 unknown-arg 파서 회귀 보호용 동반 테스트)" 로 명확히 하면 이후 이 plan 을 `plan/complete/` 로 옮긴 뒤 근거 자료로 다시 읽는 사람이 diff 와 대조할 때 혼선이 없다. (본 프로젝트는 "plan 체크박스/서술 = 실제 상태" 규율을 중시하므로 사소하지만 교정 가치가 있다.)

- **[INFO]** 테스트 파일 내부에서 정의되지 않은 외부 레이블("B-case")을 인라인 주석이 참조
  - 위치: `.claude/tests/test_push_detection.py` — `test_quoted_pipe_is_not_a_segment_separator` 의 docstring `"""The B-case root cause, pinned directly."""`
  - 상세: "A–E" 케이스 문자 체계는 `plan/in-progress/harness-session-anchor-guards.md` (②번 항목 "증상" 표: `BLOCK A. 진짜 push`, `BLOCK B. grep 으로 문자열 찾기`, `BLOCK C. 커밋 메시지에 push 단어`, …) 에서만 정의된다. `test_push_detection.py` 자체의 모듈 docstring 은 같은 버그를 산문으로는 설명하지만("read a `\|` inside a quoted grep pattern as a pipe") 알파벳 레이블을 전혀 부여하지 않는다. 따라서 이 테스트 파일만 단독으로 읽는 독자(예: plan 이 나중에 `plan/complete/archive/` 로 이동한 뒤 diff-blame 없이 이 파일만 보는 경우)는 "B-case" 가 무엇을 가리키는지 파일 내부 정보만으로 알 수 없다.
  - 제안: docstring 을 `"""The quoted-pipe bug (plan's case B), pinned directly."""` 처럼 케이스 문자와 함께 무엇을 가리키는지 한 구절 덧붙이거나, plan 참조 없이도 자립하도록 "the quoted-pipe root cause" 로만 표현해도 충분하다.

## 강점 (참고)

- 신설 함수(`_tokenize`/`_git_subcommand`/`_is_git_push`, `is_kept`)마다 "왜 이렇게 짰는지"까지 설명하는 docstring/주석이 달려 있고(예: `shlex.split` vs `shlex.shlex(punctuation_chars=True)` 차이, `commenters` 를 비워야 하는 이유), 실측으로 검증됨(`shlex.split('git add -A;git push')` 실행 결과가 docstring 의 예시와 일치).
- 동작이 바뀐 CLI(`reap-merged-worktrees.sh --keep`)는 스크립트 자체 헤더 주석(=`--help` 출력에 그대로 반영됨, 실행 확인 완료) · `worktree-policy.md §7` · plan 문서 세 곳에서 서로 어긋남 없이 일관되게 문서화됐다.
- `worktree-policy.md` 의 갱신은 단순 반영이 아니라 기존 불변식 서술("현재 세션 worktree 제외")이 실제로는 대리 지표(셸 cwd)만 가리키고 있었다는 근본 원인까지 정정해, 코드와 문서의 개념적 정합성을 회복했다.
- `.claude/tests/README.md` 에 신규 테스트 파일 행이 정확한 설명과 함께 추가됐고, 표의 다른 행과 형식이 일관된다.
- 이 변경분은 `.claude/**` + `plan/**` 스코프로, `codebase/`·`spec/` 를 건드리지 않아 CHANGELOG.md(제품 변경 전용, 전량 `spec/` SoT 참조) 와 `doc-sync-matrix.json`(제품 코드 ↔ spec ↔ 유저가이드 매핑, `.claude/` 트리거 없음) 갱신 대상이 아님을 확인함 — 관련 문서 미갱신은 갭이 아니라 스코프상 정상.
- plan 의 Rationale 에 "진단 정정 기록"(최초 오진단 → 재현 후 정정) 을 남겨, 이 프로젝트가 요구하는 "기각된 대안/오판은 실제 이력으로 남긴다" 관례를 충실히 따름.

## 요약

문서화 관점에서 이번 변경은 표본적으로 우수하다. 새 함수마다 "무엇을/왜" 를 모두 설명하는 docstring 이 있고, CLI 플래그(`--keep`) 는 스크립트 헤더·`--help` 출력·정책 문서·plan 세 곳이 서로 어긋나지 않게 동기화됐으며, 기존에 코드와 어긋나 있던 정책 문서의 서술(대리 지표 vs 진짜 대상)까지 근본적으로 정정했다. 발견된 두 건은 모두 INFO 등급으로, plan 문서의 테스트 개수 서술이 diff 와 문자 그대로는 안 맞는 점(합리적 해석은 가능하나 명시적이지 않음)과, 신규 테스트 파일이 plan 에만 정의된 "B-case" 레이블을 자기완결적 설명 없이 인용한 점이다. 둘 다 병합을 막을 사안이 아니며 향후 가독성·정밀도 개선 권고 수준이다.

## 위험도

LOW
