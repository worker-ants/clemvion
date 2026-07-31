# Testing Review — harness-review-gate-fixes (4R, `d19e01880` "3R 리뷰 반영" 커밋 대상)

## 검증 방법

정적 리뷰에 더해 다음을 직접 수행했다:
1. `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 전체 스위트를 **2회 독립 실행**
   (사이 편집 없이 연속 실행).
2. 핵심 변경 3곳에 실제 뮤테이션 주입 → 실행 → `cp` 로 원본 복원(커밋 상태와 `git diff --stat` 로
   원복 확인): (a) `code_review_orchestrator.build_files_section` 의 집계 생략-안내 폴백 분기 제거,
   (b) `collect_change_infos` 의 `--staged` 예외 제거, (c) `consistency_orchestrator.
   _branch_changed_rels` 를 `return set()` 로 대체.
3. `cProfile` 로 신규 n=1200 테스트 픽스처의 실제 시간 분포 측정.

## 발견사항

- **[CRITICAL]** 신규 테스트가 실제 프로덕션 로직과 무관한 이유로 문서화된 표준 실행 커맨드에서
  **재현 가능하게 타임아웃 실패**한다
  - 위치: `.claude/tests/test_prompt_omission_notice.py:176`
    (`test_many_files_collapse_to_one_notice_and_still_fit`, fixture `:190`,
    helper `change_info` `:52-55`, subprocess `timeout=30.0` `:77`). 근본 원인은
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1043`
    (`code = diff_content or ""`) + `:1053` (`if not code and full_file_content:`)
    → `:937` `get_git_diff_content`.
  - 상세: 이 테스트는 n=1,200 개 파일 픽스처로 "집계 생략 안내" 폴백을 검증한다(3R 신규,
    커밋 메시지의 "n=1200 → 192,087 (1.36배)" 실측치를 회귀 고정한 좋은 테스트). 그런데 픽스처
    빌더 `change_info()` 가 `orch.build_cli_change_info(path, diff_content="", file_content=body)`
    로 호출하고, `build_cli_change_info` 는 `diff_content=""` 를 `None` 과 동일하게 falsy 취급해
    (`code = diff_content or ""` → `""`) `if not code and full_file_content:` 분기로 빠져
    **실제 `get_git_diff_content(file_path)` 를 호출한다** — 이 함수는 존재하지도 않는 가짜 경로
    (`f0000.py`~`f1199.py`) 각각에 대해 `git diff --cached --` 와 `git diff --` 를 **실제로 이
    저장소(cwd=REPO_ROOT) 에서** 두 번씩 subprocess 실행한다(파일당 2회 × 1,200 = 2,400회).
    `cProfile` 로 분리 측정한 결과: `build_cli_change_info` x1200 호출 = **29.35초**, 정작 테스트
    대상인 `build_files_section` 자체는 **0.166초**(78,176 bytes 산출, 정상). 즉 테스트 총
    실행시간의 99% 이상이 테스트가 검증하려는 로직과 무관한, 의도치 않은 실제 git subprocess
    폭주다. 이 값은 파일 자체의 30초 subprocess 타임아웃(다른 자매 스위트와 공유하는 "hang 방지"
    상수, 애초에 성능 예산이 아니다)에 여유 3% 이내로 근접한다(고립 실행 시 29.10~31.31초 실측,
    2회 측정 모두).
    **실제로 재현됨**: 편집 없이 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
    를 연속 2회 실행했더니 **2회 모두** 정확히 이 테스트에서
    `subprocess.TimeoutExpired: ... timed out after 30.0 seconds` → `AssertionError` 로
    실패했다(파일 단독 실행 시엔 29.10~31.31초로 통과). 이 커맨드는 `.claude/tests/README.md`
    가 명시하는 표준 실행법이자, 이 저장소 자신의 워크플로가 매 fix 이후 강제하는
    "TEST WORKFLOW 재수행" 단계 그 자체다 — 즉 이 결함은 **이 저장소가 스스로 강제하는 게이트를
    본인 스위트가 이따금 거짓 RED 로 걷어차는** 상태다. 과거 이 팀이 반복 지적한 "flaky spec →
    회귀 아님을 확인 후 기록" 교훈과 같은 클래스이지만, 이번엔 원인이 100% 특정되고 재현도
    100%(2/2)다.
  - 제안: `build_cli_change_info` 를 1,200회 호출하는 대신, 이 테스트의 프리앰블에서
    `orch.get_git_diff_content = lambda p: ""` (또는 `orch._git`) 를 스텁 처리한다 — 같은 파일의
    자매 스위트(`test_review_changeset_warning.py`)가 이미 `orch._default_branch_ref = lambda: ...`
    /`orch._git = boom` 패턴으로 정확히 이 방식을 쓰고 있어 기존 관례에 부합한다. 대안으로
    `build_cli_change_info` 자체가 `diff_content=""` (명시적 "diff 없음") 과 `diff_content=None`
    (계산 위임) 을 구분하도록 고칠 수도 있으나, 그러면 프로덕션 콜사이트(`code_review_orchestrator.
    py:1358`) 의 의미도 같이 바뀌므로 테스트 쪽 스텁이 더 안전한 최소 수정이다.

- **[CRITICAL]** 이번 커밋이 프로덕션 스크립트 디렉터리에 **완전히 미검증인 1,304줄짜리 orphan
  듀플리케이트 파일**을 실수로 커밋했다
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (전체 파일 — 프롬프트
    생략 대상이라 게이트 없음. 파일 자체가 발견 위치다.)
  - 상세: 이 파일은 이번 리뷰가 검토 중인 바로 그 커밋(`d19e0188 "fix(harness): 3R 리뷰 반영"`)
    에서 신규 추가됐는데, 그 커밋 메시지 어디에도 이 파일에 대한 언급이 없다. `diff` 로 직접
    대조한 결과 **직전 커밋(`426f8bd4`, "2R 리뷰 반영") 시점의 `code_review_orchestrator.py`
    와 바이트 단위로 정확히 일치**한다 — 즉 이번 3R 수정이 도입한
    `_omitted_content_note`/`_aggregate_omission_note`/`warn_if_committed_work_is_missing`/
    `_default_branch_ref` 전부가 빠진, **한 라운드 전의 스냅샷**이다. `#!/usr/bin/env python3` +
    `if __name__ == "__main__": main()` 을 그대로 갖춘 완전히 실행 가능한 standalone 스크립트이고,
    저장소 전체에서 이 파일을 참조/import 하는 코드·문서·테스트가 **단 하나도 없다**(SKILL.md,
    orchestrator, 테스트 스위트 전수 grep 확인). 이름(`_probe_main`)과 정확히 "고쳐지기 직전
    스냅샷" 이라는 내용상 특징은, 이 PR 이 스스로 겪은 CRITICAL 버그(리뷰 프롬프트가 대용량
    파일을 31바이트로 자르던 결함)를 수동으로 재현/조사하려고 `cp` 로 떠 둔 뒤 정리(삭제)를
    빠뜨린 흔적과 정확히 일치한다(사용자 메모리에 기록된 "가드 mutation 원복은 cp+절대경로"
    류 작업 패턴과 같은 실패 모드). 테스트 관점에서 이 파일의 커버리지는 **0%** 다 — 그리고
    단순히 "커버리지가 없는 신규 코드" 가 아니라, **이번 PR 이 고친 CRITICAL 버그의 재발 버전이
    조용히 저장소에 상주**하는 상태다. 향후 누군가 이 파일을 (경로 자동완성·stale 참조·혼동 등으로)
    직접 실행하면 이미 고친 버그가 아무 경고 없이 재현된다. 이 저장소는 유사한 drift 를 잡기 위한
    위생 테스트 전례가 이미 있다(`test_tests_readme_catalog.py` 가 테스트 디렉터리의 미등록 파일을
    잡고, `test_agent_consistency.py` 가 에이전트 4곳 정의 drift 를 잡는다) — 그러나 스크립트
    디렉터리의 orphan/duplicate 파일을 잡는 동등한 가드는 없다. 즉 이번에 실제로 발생한 이 실패
    클래스(뮤테이션/probe 정리 누락)에 대한 회귀 방지 테스트가 이 저장소에 전혀 없다.
  - 제안: 이 파일은 삭제가 정답이다(테스트를 새로 짜서 "보존" 할 이유가 없는, 순수 실수 아티팩트).
    삭제 후 재발 방지가 필요하면 `.claude/skills/*/scripts/` 아래 SKILL.md/README 에서 참조되지
    않는 `.py` 파일이 없는지 확인하는 가벼운 위생 테스트(`test_tests_readme_catalog.py` 와 같은
    패턴)를 검토할 것.

- **[INFO]** (재확인, 변경 없음) 이전 라운드 INFO 3건은 여전히 낮은 우선순위로 열려 있다 — 새 관측
  아님, 조치 불필요
  - `_default_branch_ref` 의 `origin/HEAD → origin/main → origin/master` 우선순위 분기 자체를
    실행하는 테스트가 없다(전 테스트가 `orch._default_branch_ref = lambda: ...` 로 완전 대체,
    예외 전파 테스트만 실제 함수를 호출). `code_review_orchestrator.py:1192` 부근.
  - `_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/")` 의 `(^|/)` 중 `^` 분기(카탈로그가
    루트 바로 아래 오는 경로)를 태우는 fixture 가 없다 — 모든 fixture 가 `spec/conventions/
    cafe24-api-catalog/...` 형태라 `/` 분기만 거친다. `consistency_orchestrator.py:239`.
  - `DefaultPathIsWiredTest` 가 "경고 미발생" 을 `branch`/`range`/`staged` 세 모드만 검증하고
    `commit`/positional `files` 모드는 검증하지 않는다(구조상 안전 방향이 명백하므로 우선순위
    낮음). `test_review_changeset_warning.py:156` 이하.
  - "Critical 하향 금지" 정책은 여전히 prompt 지시일 뿐 기계적 backstop 이 없다 — 이미
    `plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 2번 항목으로 추적 중이고
    사용자가 defer 로 확정했으므로 새 조치 불필요.

## 강점 (참고)

- **이전 라운드 WARNING 이 실제로 해소됐음을 뮤테이션으로 직접 확인**: `_branch_changed_rels` 를
  `return set()` 로 대체했더니 신규 `BranchChangedRelsAgainstRealGitTest` 의
  `test_reports_edits_and_additions_relative_to_the_base`/`test_rename_reports_both_sides`
  가 정확히 FAIL 했다(3라운드 전 리뷰가 "이 뮤턴트가 전 스위트를 GREEN 으로 통과시킨다" 고 지적한
  바로 그 시나리오). 실제 임시 git repo 로 edit/add/rename(`--no-renames`) 케이스를 커버해 이번엔
  진짜로 잡힌다.
- **집계 생략-안내 폴백 뮤테이션 확인**: `_aggregate_omission_note` 분기를 우회시켰더니
  `test_many_files_collapse_to_one_notice_and_still_fit` 이 정확히 실측치(192,087 vs cap 141,557)
  로 FAIL — 커밋 메시지의 실측 수치와 완전히 일치, 픽스처가 실제 회귀를 정확히 겨냥하고 있음을
  재확인(성능 이슈는 위 CRITICAL 항목과 별개다).
- **`--staged` 예외 뮤테이션 확인**: `warn_if_committed_work_is_missing` 을 `--staged` 분기에도
  걸리게 되돌렸더니 `test_staged_is_an_explicit_scope_and_does_not_warn` 이 정확히 FAIL.
- **회귀 테스트 위생**: `EvaluateInFlightShortCircuitTest` 의 옛 테스트
  (`test_in_flight_allows_even_with_stale_review`, 무조건 억제라는 옛 동작을 고정)를 삭제하지
  않고 방치하는 대신 `test_push_path_still_blocks_while_in_flight`/`test_stop_path_opts_in_and_is_
  allowed` 양방향으로 정확히 대체했다 — 옛 테스트가 새 동작과 모순된 채 남는 흔한 실패 패턴을
  피했다. 저장소 전체에서 `evaluate_review(` 호출부를 grep 하면 `guard_review_before_stop.py`/
  `guard_review_before_push.py`/기존 `test_review_guard.py`(kwarg 없이 호출, 기본값 `False` 로
  하위호환) 뿐이며 전부 대응 커버리지가 있어 시그니처 변경에 따른 고아 호출부가 없다.
  push/stop 두 방향 모두 실제 kwarg **값**을 seam 파일로 기록해 단언한다(호출 여부가 아니라
  호출 인자 자체) — call-count 스파이가 속는 이 저장소의 반복된 vacuous-test 함정을 정확히
  피해간 설계.
- `test_guard_review_before_push_main.py` 의 `cwd=self.tmp` 추가는 "호출자의 실제 체크아웃을
  상속해 14회 중 1회 비재현 실패" 라는 실측 플레이키니스를 자매 스위트와 같은 패턴으로 고쳤다 —
  테스트 격리 관점에서 유효한 개선.

## 요약

핵심 프로덕션 로직 4건(in-flight 억제의 push/stop 스코프 분리, consistency 번들 우선순위,
리뷰 프롬프트 생략-안내 + 집계 폴백, 기본 changeset 누락 경고) 은 전부 뮤테이션으로 직접 검증했고
의도대로 RED 전환됐다 — 이전 라운드가 지적한 WARNING(`_branch_changed_rels` 실제 git 미검증,
`--staged` 오탐, push 테스트 cwd 누상속)도 이번 라운드에 실제 코드로 해소됐음을 재확인했다.
다만 이번 라운드 자체가 새로 도입한 두 가지가 CRITICAL 이다: (1) 신규 n=1,200 테스트가 검증
대상과 무관한 이유(픽스처 빌더가 의도와 달리 파일당 git subprocess 2회씩, 총 2,400회를
실제로 실행)로 자신의 30초 타임아웃에 여유 3% 이내로 근접해 있고, **문서화된 표준 전체 스위트
실행에서 2/2 재현되는 실패**로 직접 확인했다(원인은 cProfile 로 특정: 실제 대상 로직은 0.17초,
낭비된 subprocess 호출이 29초). (2) 이번 3R 커밋이 커밋 메시지에 언급 없이 프로덕션 스크립트
디렉터리에 1,304줄짜리, 참조·테스트 전무한 orphan 파일(`_probe_main.py`)을 추가했는데, 그 내용이
정확히 이 PR 이 고친 CRITICAL 버그의 **수정 이전 스냅샷**이다 — 커버리지 0%이자 고쳐진 결함의
생존 사본이라는 이중의 문제다. 둘 다 프로덕션 정합성을 당장 해치지는 않지만(핵심 로직 자체는
견고하게 테스트됨), 이 저장소가 스스로 강제하는 게이트(표준 테스트 실행, 리뷰 결과물의 완전성)의
신뢰도를 직접 훼손하는 종류의 결함이라 병합 전 처리를 권고한다. 나머지는 이전 라운드부터 이어지는
낮은 우선순위 INFO 3건뿐이며 변경 필요 없다.

## 위험도
CRITICAL
