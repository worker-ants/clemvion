# 아키텍처(Architecture) Review — round 12

## 스코프 확인

`git log`/`git diff HEAD~1 HEAD` 로 이번 라운드(12R, 커밋 `9c270100f`)의 실제 diff 를 확인했다:
`.claude/tests/test_plan_guard.py` · `.claude/tests/test_review_gate_ci.py` ·
`.claude/tests/test_review_guard_hardening.py` 세 테스트 픽스처의 `_git` 헬퍼 경화(`-C` +
`GIT_CEILING_DIRECTORIES` + realpath 단언) + `plan/in-progress/harness-review-gate-ci-backstop.md`
문서 갱신. 프로덕션 판정 코드(`git_probe.py`/`review_guard.py`/`plan_guard.py`/`branch_guard.py`/
`review-gate.yml`/`check-review-gate.py`)는 이번 라운드에서 변경되지 않았다(전부 번들에는
"Review" 컨텍스트로 실려 있으나 `git diff HEAD~1 HEAD` 기준 무변경). 아래는 이번 diff 자체와,
필요한 경우 그것이 기대는 주변 구조를 대상으로 한다.

## 발견사항

- **[WARNING]** 이번 라운드가 고치려던 "손-복제 유틸리티" 패턴이, 정확히 같은 형태로 테스트
  하네스 계층에 남아 있다 — 그것도 이번에 편집한 바로 그 파일 안에.
  - 위치: `.claude/tests/test_review_guard_hardening.py:275` (`RebaseAuthorDateTest._git`),
    `.claude/tests/test_review_guard_hardening.py:588`
    (`NotesReachThePublicEntryPointTest._git`),
    `.claude/tests/test_review_guard_hardening.py:677`
    (`UnstagedModificationKeepsItsPathTest._git`) — 이 세 곳은 이번 라운드가 손대지 않았다.
    대조: 같은 파일의 네 번째 사본 `.claude/tests/test_review_guard_hardening.py:851`
    (`ActionsCheckoutTopologyTest._git`)만 `-C`/`GIT_CEILING_DIRECTORIES`/realpath 단언으로
    경화됐다(이번 diff, `subprocess.run(["git", "-C", resolved, *args], ...)`).
  - 상세: `grep -c '^    def _git(self' .claude/tests/*.py` 로 실측하면 하네스 스위트 전체에
    독립적으로 손으로 짠 `_git()` 헬퍼가 **10개**(`test_bootstrap_mermaid_install.py` ·
    `test_mermaid_lint_ready.py` · `test_plan_guard.py` · `test_reap_merged_worktrees.py` ·
    `test_review_gate_ci.py`×2 · `test_review_guard_hardening.py`×4) 있고, 이번 라운드는 그중
    4개(`test_plan_guard.py:292`, `test_review_gate_ci.py:58`, `test_review_gate_ci.py:697`,
    `test_review_guard_hardening.py:851`)만 경화했다. 이번 브랜치가 직접 편집한
    `test_review_guard_hardening.py` 한 파일 안에만도 나머지 3개 사본이 그대로
    `subprocess.run(["git", *args], cwd=self.root, ...)` 형태로 남아 있다 — `-C` 도,
    `GIT_CEILING_DIRECTORIES` 도, 트리 이탈을 잡는 단언도 없다.
    이 세 사본은 오늘은 `init`/`add`/`commit`/`checkout -b` 만 호출해 `remote add` 를 쓰지
    않으므로 이번 사고(공유 `.git/config` 오염)를 그대로 재현하지는 않는다. 하지만 이번
    사고의 발단도 "무해해 보이는 `_git` 헬퍼에 나중에 `remote add origin` 한 줄이 더해지며"
    생겼다 — 그 헬퍼가 셋이나 같은 파일에 이미 있고 앞으로 그중 하나가 확장될 가능성을
    막을 장치가 없다.
  - 이 프로젝트 자신의 이력과 정확히 같은 결함 클래스다: 프로덕션 쪽 `_run_git`/`_repo_root`/
    `_default_branch`/`_merge_base`/`_porcelain_path`/`_current_branch` 가 세 guard 모듈에
    손으로 복제돼 있던 것을 9R~10R 이 `_shared/git_probe.py` 로 통합했고(`git_probe.py` 의
    모듈 docstring 이 그 이력을 그대로 서술한다), 10R 은 더 나아가 "가드를 열거에서 도출로"
    바꿨다(`test_review_gate_ci.py::GitProbesAreNotReDuplicatedTest` 가 세 모듈의 AST 를
    비교해 본문이 동일한 함수가 남아 있으면 자동으로 실패시킨다 — 사람이 목록을 적지 않는다).
    이번 12R 의 plan 문서 갱신 자체도 "잔여: 같은 노출이 pre-existing 4곳에 있다" 며 손으로 쓴
    파일 목록(`test_consistency_bundle_priority.py` 등)을 등재하는데, 그 손-목록이 바로 이번에
    **자신이 수정한 파일 안의 형제 사본 3개를 빠뜨렸다** — "손으로 쓴 목록은 빠뜨린다"는 9R→10R
    교훈이 이번엔 테스트 하네스 계층에서 그대로 재연된 것이다.
  - 제안: 프로덕션 쪽에 적용한 처방을 테스트 쪽에도 대칭적으로 적용한다. plan 문서가 이미
    이름까지 지어둔 `_harness.py::make_temp_git_repo()` (또는 `_git_in()`)를 실제로 만들어
    `-C` + `GIT_CEILING_DIRECTORIES` + realpath 단언을 한 곳에만 넣고, 10개 사본을 그 호출로
    교체한다. 그 뒤에는 (선택) `GitProbesAreNotReDuplicatedTest` 와 같은 방식으로 "테스트
    파일들 사이에 본문이 동일한 `_git` 함수가 남아 있으면 실패"하는 파생적 가드를 붙이면,
    "3개만 고쳤다" 류의 부분 경화가 다시 조용히 통과하는 것을 원천적으로 막는다.

- **[INFO]** `.claude/hooks/_lib/review_guard.py` (1,007줄, 이번 라운드 무변경)가 서로 다른
  네 가지 관심사 — (a) git 프로브 위임, (b) 코드-리뷰 신선도 clock (`_newest_code_mtime`/
  `_newest_resolved_review_mtime`/`_summary_is_resolved`), (c) spec `code:` glob 매칭
  (`_glob_to_regex`/`_spec_linked_changes`), (d) in-flight/resolution-in-flight 억제
  (`_code_review_in_flight`/`_resolution_in_flight`) — 를 한 모듈에 담고 있다.
  - 위치: `.claude/hooks/_lib/review_guard.py` 전체(예: §SPEC-CONSISTENCY 섹션은 531행부터,
    §RESOLUTION-IN-FLIGHT 섹션은 805행부터 — 모듈 자체 주석이 이미 절을 나눠 표시한다).
  - 상세: 각 절 내부의 함수 분해와 문서화 수준은 높고(`dirty` 셋을 한 번만 계산해 여러
    freshness 질의에 주입하는 등 응집도 있는 설계도 보인다), 결합도 자체는 낮다 — 문제는
    "한 파일"이라는 경계뿐이다. 이 시리즈의 12라운드 각각이 이 파일에 새 절을 추가해 왔고
    (Gate 2 spec-consistency, in-flight 억제, resolution-in-flight 억제 모두 후속 라운드에서
    붙었다), 그 결과 서로 무관한 관심사를 고치는 편집이 같은 파일·같은 import 표면을 공유해
    diff 가 커지고 리뷰 범위가 넓어지는 경향이 쌓이고 있다. 지금 당장 결함을 유발하지는
    않으므로 CRITICAL/WARNING 이 아니라 INFO — 다음에 이 파일에 다섯 번째 관심사가 붙기 전에
    `_freshness.py`/`_spec_glob.py`/`_inflight.py` 급으로 쪼개는 것을 고려할 시점이라는 관찰만
    남긴다.

## 좋은 방향으로 유지되고 있는 것 (참고용, 새 발견 아님)

`_shared/git_probe.py` 는 `hooks/_lib` 를 되돌아 참조하지 않는다(`grep` 로 확인 — import 는
`os`/`subprocess` 뿐이고 `hooks/_lib` 문자열은 주석에만 등장). `scripts/check-review-gate.py`
→ `hooks/_lib/review_guard.py` → `_shared/git_probe.py` 는 단방향 계층이고 순환 의존이 없다.
프로덕션 코드에서는 "정본 하나, 위임 여럿"이 실제로 지켜지고 있다 — 위 WARNING 은 정확히 그
동일한 원칙이 테스트 하네스에는 아직 미적용이라는 지적이다.

## 요약

이번 12R 자체의 diff(테스트 픽스처 3개 경화 + plan 문서)는 작고 목적이 분명하며, 프로덕션 판정
경로에는 손을 대지 않았다. 다만 그 경화 방식 — 사고를 일으킨 픽스처 각각을 개별적으로 패치 —
가 프로젝트가 9~10라운드에 걸쳐 프로덕션 코드에서 이미 반증한 접근(손-복제 유틸리티를 하나씩
땜질)을 테스트 계층에서 반복하고 있고, 그 결과 이번에 편집한 파일 안에서조차 형제 사본 3개가
그대로 남았다. 이는 판정 자체를 바꾸는 결함은 아니지만, "부분 집합만 고치면 다음 라운드가
나머지를 찾는다"는 이 티켓의 반복된 패턴과 정확히 같은 모양이라 WARNING 으로 기록한다.
`review_guard.py` 의 다관심사 누적은 별개의, 더 장기적인 관찰이다.

## 위험도

LOW
