# 테스트(Testing) 리뷰

## 검증 방법

리뷰 대상 diff 는 이미 2회의 리뷰 라운드(`20_02_29`, `20_33_56`)를 거쳤고 각 라운드의 RESOLUTION.md 가 상세하다. 이번 라운드에서는 서술을 그대로 신뢰하지 않고 실제로 재현했다:

- `.claude/tests/test_guard_default_branch_bash_mutating.py` 를 `python3 -m unittest discover` 로 직접 실행 → **13/13 PASS** (RESOLUTION 3R 의 "신규 분류기 테스트 13건" 과 일치, 2R 의 "12건" 은 그 시점 커밋 기준으로는 정확했던 스냅샷).
- `.claude/tests/test_line_anchors.py` 전체 실행 → **34/34 PASS** (13.87s). 3R 의 W3 회귀(`test_diff_blocks_are_annotated_and_correct`: `13 not greater than 20`)가 `_pick_commit_fixture()` 도입으로 실제로 해소됐음을 직접 확인.
- `.claude/tests/test_push_guard_allowlist.py` 전체 실행 → **36/36 PASS**. `guard_review_before_push.py` 의 comment-only 변경(§J 주석 추가/이동)이 byte-for-byte 고정 패턴·차등 코퍼스를 건드리지 않았음을 확인.
- `guard_default_branch_bash.py` 소스와 테스트를 대조해 문서(모듈 docstring, 인라인 주석, `worktree-policy.md`, README)의 서술이 실제 정규식·분리자 목록과 일치하는지 확인 — 단일 `&` 포함 6종 구분자가 코드·테스트·정책문서 세 곳 모두에서 일관됨을 확인(3R W1 SPEC-DRIFT 가 실제로 해소됨).

## 발견사항

### [WARNING] §J(리뷰-전-push 게이트 완전 우회) 결함에 대해 어떤 회귀 테스트도 없음

- 위치: `.claude/hooks/guard_review_before_push.py:96-109`(`_GIT_PUSH`, 결함 지점 — 신규 주석만 추가됨); 테스트 갭: `.claude/tests/test_push_guard_allowlist.py` 전체(관련 케이스 0건)
- 상세: 이번 diff 를 만드는 과정에서 발견·문서화된 §J(`GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main` 형태가 `_GIT_PUSH` 에서 전혀 매치되지 않아 `main()` 이 즉시 `return 0` 하고 review/plan 게이트를 완전히 건너뜀)는 3개 파일의 주석과 plan `§J` 섹션에 상세히 기록됐고, 3R 리뷰는 이를 Critical 로 승격까지 시켰다. 그런데 `grep -n "SSH_COMMAND\|§J" .claude/tests/test_push_guard_allowlist.py` 결과가 0건 — 이 CRITICAL 등급 게이트 우회를 관측하는 자동 테스트가 **전혀 없다**. `guard_default_branch_bash.py` 쪽은 자신의 잔여 갭(빈 값·닫히지 않은 따옴표)조차 `test_malformed_env_values_stay_unmatched` 로 명시적으로 pin 했는데, 더 심각한 §J 쪽은 pin 이 없다. `_GIT_PUSH` 패턴 자체를 고치는 것과(별 PR, byte-for-byte 핀 갱신 필요, 타당한 연기 판단) **현재의 버그 동작을 관측만 하는 테스트를 추가하는 것**은 별개다 — 후자는 `_GIT_PUSH` 문자열이나 차등 코퍼스를 전혀 건드리지 않으므로 "핀 갱신 + 코퍼스 확장 + 뮤테이션까지 별 PR" 이라는 연기 사유와 충돌하지 않는다. 지금 상태로는 (a) 이 hot-path 근처를 건드리는 무관한 리팩터가 우회를 더 넓히거나 좁혀도 스위트가 알려줄 수 없고, (b) 별 PR 에서 실제 수정이 들어갈 때 "고쳐졌다" 를 검증할 기존 RED 테스트가 없어 검증이 전부 수작업에 의존한다.
- 제안: `test_push_guard_allowlist.py` (또는 별도 파일)에 `KnownGapTest` 류로 `self.assertFalse(guard._is_git_push('GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main'))` 를 §J 참조 주석과 함께 추가 — 오늘의 버그 동작을 캐너리로 고정해, §J 수정 PR 이 착수될 때 이 assertion 을 뒤집는 것으로 "고쳐졌음"을 테스트가 직접 증명하게 한다.

### [INFO] `guard_default_branch_bash.py` 의 오케스트레이션 경로는 여전히 0건 (기존 갭, 이번 PR 범위 밖으로 명시적 연기됨)

- 위치: `.claude/hooks/guard_default_branch_bash.py:186-227`(`main()`), `:160-183`(`_state_dir`/`_already_warned`/`_mark_warned`)
- 상세: 이번 PR 은 `_is_mutating` 분류기에 13건의 테스트를 신규로 채웠지만(0→13, 훌륭함), 세션당 1회 dedup 로직·payload 파싱·`BYPASS_DEFAULT_BRANCH_GUARD` 처리를 담은 `main()` 자체는 여전히 테스트가 없다. 2R 테스팅 리뷰어가 이미 INFO#4 로 지적했고 3R RESOLUTION 은 "이 PR 스코프는 분류기다"로 명시적으로 연기했다 — 타당한 스코프 판단이라 이번 라운드에서 새로 막을 사유는 아니지만, 세션 dedup 회귀(예: 세션당 1회가 아니라 매번 발화하거나 반대로 영구 침묵)는 여전히 무방비 상태로 남아 있다는 점은 다음에 이 파일을 건드릴 담당자를 위해 다시 적어둔다.
- 제안: 별건으로 `test_guard_review_before_push_main.py` 와 같은 패턴의 `main()` 레벨 테스트(실프로세스 + 스텁 stdin) 추가를 백로그에 유지.

### [INFO] `_pick_commit_fixture` 의 40커밋 탐색 윈도우는 `fetch-depth: 1` 얕은 클론에서는 사실상 무력화됨 (회귀는 아님)

- 위치: `.claude/tests/test_line_anchors.py:332-359`(`_pick_commit_fixture`)
- 상세: 직접 `git clone --depth 1`로 확인한 결과, 얕은 클론에는 커밋이 1개만 존재해 `git log -n 40` 이 그 1개만 반환한다. `harness-checks.yml` 은 `actions/checkout@v7` 을 `fetch-depth` 명시 없이 사용하므로(다른 두 워크플로만 `fetch-depth: 0` 명시) CI 에서는 이 탐색 로직이 사실상 "커밋 1개만 본다"로 축소된다. 다만 이는 **회귀가 아니다** — 이전 코드도 어차피 `HEAD` 만 썼으므로 얕은 클론에서 동일한 단일 커밋을 대상으로 했고, 그 shallow-root 커밋은 부모가 없어 저장소 전체가 "전부 추가된 diff" 로 취급되어(numstat 총합이 임계값 80을 가볍게 넘음) 실제로는 문제없이 통과한다. 즉 이번 fix 의 진짜 효과(사이즈가 작은 커밋을 건너뛰고 뒤로 검색)는 로컬/풀 히스토리 환경에서만 발동하고 CI 에서는 발동하지 않는다는 뉘앙스 차이일 뿐이다.
- 제안: 조치 불요. 다음에 이 로직을 디버깅할 사람을 위해 docstring 에 "CI(shallow clone)에서는 이 탐색이 단일 커밋으로 축소된다" 한 줄만 남기면 향후 혼란을 줄일 수 있음(낮은 우선순위).

## 회귀 확인 (긍정 발견)

- `_is_mutating` 의 시그니처·리턴 타입은 변경되지 않았고(`bool`), 기존 호출부(`main()`)는 diff 밖에서 그대로다 — 함수 교체가 호출자와의 계약을 깨지 않음을 실행으로 확인.
- `NoFalsePositiveClassTest`/`OutOfScopeTest` 는 리팩터 이전부터 있던 불변식(인용문 무시, 간접실행 미분류)을 그대로 pin 하고 있어 이번 세그먼트 분할 확장이 기존 보장을 깨지 않았음을 코드가 아니라 테스트로 증명한다.
- `EnvPrefixTest.test_env_prefix_does_not_promote_a_read_only_command` 는 "env 접두 스킵 확장이 read-only 명령을 실수로 mutating 으로 승격시키지 않는가" 라는, 놓치기 쉬운 반대 방향 엣지케이스를 정확히 짚고 있다 — 테스트 가독성·의도 표현이 우수한 사례.
- `BacktrackingTest` 는 in-process 타이밍 단언이 아니라 서브프로세스+timeout 방식을 사용해 "C-level `re` 는 시그널로 못 끊는다"는 올바른 이유로 설계되어 있고, 직접 실행해 통과를 확인했다(20초 타임아웃 내 완료).

## 요약

핵심 변경 대상(`guard_default_branch_bash.py::_is_mutating`)에 대한 테스트는 0건에서 13건으로 확장되었고, 엣지 케이스(따옴표 env 값, 빈 값, 닫히지 않은 따옴표, 단일 `&`, heredoc 오탐, 인용된 구분자 오탐, ReDoS 선형성) 커버리지가 매우 촘촘하며 전부 직접 실행해 통과를 확인했다. 이전 라운드가 만든 회귀(`test_line_anchors.py` 의 HEAD-크기 결속)도 `_pick_commit_fixture` 로 뮤테이션 검증까지 거쳐 해소됐다. 유일하게 실질적인 갭은 이번 작업 도중 발견된 별건 CRITICAL 결함(§J, push 게이트 완전 우회)에 대해 "고치지 않고 별 PR 로 미룬다"는 판단은 타당하지만 그 현재 버그 동작조차 관측하는 최소 캐너리 테스트가 없다는 점이다 — 수정 자체를 미루는 것과 그 상태를 pin 하는 것은 다른 문제이며, 후자는 이번 diff 가 지키던 byte-for-byte 핀 제약과 충돌하지 않는다. 그 외에는 `main()` 오케스트레이션 경로 미테스트(기존 갭, 스코프상 정당한 연기)와 CI 얕은 클론에서 신규 탐색 로직이 사실상 비활성이라는 사소한 뉘앙스만 낮은 우선순위로 남는다.

## 위험도
LOW
