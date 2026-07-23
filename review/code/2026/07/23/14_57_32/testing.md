# 테스트(Testing) 리뷰 — push guard allowlist CRITICAL 3건 수정 (② 리뷰 반영, 2026-07-23 14_57_32)

대상: `.claude/hooks/guard_review_before_push.py`, `.claude/tests/test_push_guard_allowlist.py`,
`plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
`review/code/2026/07/23/14_23_23/*`(직전 라운드 리뷰 산출물 — 코드 아님, 참고용)

이번 라운드는 직전 리뷰(`review/code/2026/07/23/14_23_23`)에서 나온 CRITICAL 3건(C1 홑따옴표
이스케이프 오판정, C2 ReDoS, C3 메시지 blanking 이 살아있는 확장을 드러냄 — C3는 본인(testing)이
직전 라운드에 CRITICAL 로 낸 항목과 동일 결함)의 수정이다. 코드(`guard_review_before_push.py`)와
`.claude/tests/test_push_guard_allowlist.py`(25건)를 실제로 읽고, worktree 에서 직접 스위트를
실행하고, 3종의 독립 뮤테이션(코드를 임시로 되돌려 테스트가 실제로 실패하는지 확인 후 원복)으로
비-vacuity 를 재검증했다.

## 실행 검증 (직접 수행)

- `python3 -m unittest test_push_guard_allowlist -v` → **25/25 OK** (`_HOOK_PATH`, `guard` 모듈 로드 정상).
- `python3 -m unittest discover -s .claude/tests -p "test_*.py"` → **367/367 OK** — plan/RESOLUTION 이
  주장한 "전체 하네스 스위트 367건" 과 정확히 일치.
- 독립 뮤테이션 1 (C3 되돌리기): `_is_git_push` 의 "whole-command inert 검사" 블록(`if not
  _is_inert(command): return True`)을 제거 → **4건 실패**(`test_message_beside_any_expansion_is_
  conservatively_blocked`, `test_message_blanking_does_not_unmask_a_live_expansion` 등). RESOLUTION 의
  "확장 검사 제거 6 실패" 주장과 정확히 같은 수는 아니지만(부분 뮤턴트라 예상됨), **회귀 테스트가
  실제로 C3 를 감시하고 있음을 직접 확인**.
- 독립 뮤테이션 2 (C1 되돌리기): `_MESSAGE_ARG` 의 홑따옴표 본문을 겹따옴표 방식 이스케이프
  (`(?:\\.|[^'\\])*`)으로 바꿈 → **3건 실패**(`test_no_new_false_negatives`,
  `test_single_quoted_trailing_backslash_does_not_swallow_a_real_push` 등, PoC 정확히 재현). RESOLUTION
  의 "인용 종류별 분리 되돌림 → 3 failures" 주장과 **정확히 일치**.
- 두 뮤테이션 모두 `cp` 백업 → 원복 후 `git status --short` 로 clean 확인, 재실행 25/25 OK.
- 이 재현으로 직전 라운드(review 14_23_23)의 CRITICAL C1/C3 및 그 회귀 테스트가 **거짓이 아님**을
  독립적으로 재확인했다. C2(ReDoS)는 `BacktrackingTest` 가 서브프로세스+하드 타임아웃으로 이미
  프로세스 레벨 재현을 포함하므로 별도 뮤테이션 없이 코드 리뷰로 충분히 확인(겹치는 alternation
  제거가 실제로 적용됨: `(?:\\.|[^"\\])*`, 두 대안이 서로소).

## 발견사항

- **[INFO]** `_COMMIT_STDIN_CMD` 의 env-assignment 접두(`(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*`) 분기가
  완전히 미검증 — 뮤테이션으로 확인
  - 위치: `.claude/hooks/guard_review_before_push.py:96`(`_COMMIT_STDIN_CMD` 정규식) /
    `.claude/tests/test_push_guard_allowlist.py`(CORPUS 전체)
  - 상세: `_COMMIT_STDIN_CMD` 는 `GIT_AUTHOR_DATE=... git commit -F - <<EOF` 처럼 heredoc 을 소유하는
    세그먼트 앞에 환경변수 대입이 와도 인식하도록 명시적으로 설계돼 있다(정규식 자체가 그 분기를
    갖고 있음). 그런데 `CORPUS`/전용 테스트 어디에도 "heredoc 을 소유하는 `git commit`/`git tag`
    앞에 env 대입이 붙은" 케이스가 없다. 직접 뮤테이션으로 확인: 이 분기(`(?:[A-Za-z_]
    [A-Za-z0-9_]*=\S+\s+)*`)를 정규식에서 제거해도 **25건 전부 통과**(0 실패) — 이 코드 경로는
    현재 테스트 스위트에 대해 사실상 dead branch 다. (참고: `_GIT_PUSH`(1차 blind 패턴) 쪽의
    env-assignment 지원은 `"GIT_SSH=x git push"` 케이스로 이미 커버되어 있음 — 이건 그 패턴과는
    다른, `_COMMIT_STDIN_CMD` 자신의 env-assignment 분기다.)
  - 왜 문제인가: 이 프로젝트의 자체 안전 원칙("규칙이 좁게 실패하면 안전, 넓게 성공해야만 위험")에
    따르면 이 분기는 방향이 RELEASE(해제) 쪽이라 실측 안전 논증이 필요한 대상인데, 지금은 안전
    논증도 회귀 테스트도 없이 코드에만 존재한다. 오늘 당장 잘못될 확률은 낮지만(구조가 단순해
    사고 표면이 작음), 향후 `_COMMIT_STDIN_CMD` 를 리팩터링(예: 항목 C `_lib/` 추출)할 때 이 분기가
    조용히 깨지거나 과확장돼도 어떤 테스트도 잡지 못한다.
  - 제안: `CORPUS`에 `"GIT_AUTHOR_DATE=2024-01-01 git commit -F - <<'EOF'\nadd push flow\nEOF"` 류
    1건을 해제 케이스로 추가하고, 필요하면 "env 대입 + 소유 세그먼트 위장" 대칭 케이스도 추가.

- **[WARNING]** 이 diff 가 정확히 채우는 커버리지 갭을, 커밋되지 않는 인접 테스트 파일의
  docstring 이 여전히 "없다" 고 잘못 선언
  - 위치: `.claude/tests/test_guard_review_before_push_main.py:10-17`(모듈 docstring, 이번 diff 밖
    — 변경되지 않는 기존 파일)
  - 상세: 해당 파일 docstring 은 "`_is_git_push`'s own detection logic. It has no dedicated unit
    tests at all — the 44-case `test_push_detection.py` suite ... were both withdrawn ... That gap
    is real and tracked as backlog item ② ... must not be read as evidence that detection is
    covered." 라고 명시한다. 그런데 바로 이번 diff 가 그 backlog item ②(
    `plan/in-progress/harness-push-guard-subcommand-detection.md`, 이번 diff 에서 체크리스트 전항목
    `[x]` 완료로 표시됨)를 정확히 구현하고, `test_push_guard_allowlist.py`(25건)로 `_is_git_push`
    에 대한 전용 유닛 테스트를 갖췄다. 즉 이 diff 가 머지되는 순간 `test_guard_review_before_push_
    main.py` 의 위 서술은 **사실과 어긋난다** — 코드는 바뀌지 않았지만 그 코드가 서술하는 세계
    상태가 바뀌었다. 직접 확인: 현재(이 diff 적용 상태) `_is_git_push` 는 25건의 전용 유닛 테스트를
    갖고 있다.
  - 왜 문제인가: 향후 유지보수자가 `test_guard_review_before_push_main.py` 만 보고 "detection 로직은
    여전히 무테스트" 라고 오판해 불필요하게 중복 테스트를 추가하거나, 반대로 이 파일의 서술을
    신뢰해 `test_push_guard_allowlist.py` 의 존재를 놓칠 수 있다. 이번 diff 의 변경 파일 목록에는
    없지만, 이 diff 가 유발한 "이제 거짓이 된 문서" 이므로 같은 PR 에서 갱신하는 것이 자연스럽다.
  - 제안: `test_guard_review_before_push_main.py` docstring 의 "It has no dedicated unit tests at
    all" 단락을 "이제 `test_push_guard_allowlist.py` 가 `_is_git_push` 전용 커버리지를 제공한다"로
    갱신(backlog ② 완료 반영). 이 파일 자체는 여전히 `main()` 오케스트레이션만 다루는 것이 맞으므로
    스코프 변경은 불필요.

- **[INFO]** `_is_git_push` 유닛 테스트(25건)와 `main()` e2e 테스트(`test_guard_review_before_push_
  main.py`, 20건) 사이에 "release 경로가 `main()` 을 통해 실제로 exit 0 을 내는가" 를 검증하는
  통합 지점 테스트가 없음
  - 위치: `.claude/hooks/guard_review_before_push.py:280-286`(`main()` 이 `_is_git_push(command)` 를
    직접 호출해 분기)
  - 상세: `test_push_guard_allowlist.py` 는 `_is_git_push()` 를 직접 호출하는 순수 유닛 테스트이고,
    `test_guard_review_before_push_main.py` 는 자신의 docstring 대로 "unambiguous commands(bare
    `git push` / `git status`)" 만 써서 `main()` 오케스트레이션(BYPASS, fail-open 등)을 검증한다.
    그 사이에 낀 "release 로 판정된(예: `git commit -m 'add push notification'`) 명령이 실제로
    하네스 subprocess 를 통해 exit 0 을 받는가" 는 어느 파일도 검증하지 않는다. `main()` 의 분기가
    현재는 단순한 `if not _is_git_push(command): return 0`(요약) 이라 위험은 낮지만, 이 hook 은
    "미검토 코드 push 를 막는 유일한 hard gate" 로 자체 문서화된 만큼, 유닛 레벨 정확성과 프로세스
    레벨 배선(wiring) 사이의 이음매(seam)에 최소 1건의 e2e 스모크 테스트가 있으면 향후 `main()`
    리팩터링 시 부호 반전 같은 배선 실수를 즉시 잡는다.
  - 제안: `test_guard_review_before_push_main.py` 에 "release 되는 커밋 메시지(예: `git commit -m
    "add push notification"`)가 STUB_REVIEW=blocked 상태에서도 리뷰 게이트를 타지 않고 exit 0" 인
    케이스 1건 추가. 필수는 아니며 우선순위는 낮음(현재 두 스위트가 각각의 책임을 명확히 분리해
    다루고 있어 회귀 위험 자체는 낮음).

## 회귀·격리·가독성 확인

- 회귀: 직전 라운드의 3 CRITICAL 은 전부 해당 결함을 그대로 재현하는 회귀 테스트로 고정됐고,
  본인이 직접 재현 뮤테이션으로 재확인함(위 "실행 검증" 참고). `KnownRemainingFalsePositiveTest` 는
  의도적으로 남긴 갭(플래그 값 오탐, 확장 병존 시 보수적 차단 비용)을 "놀람이 아닌 보이는 갭"으로
  정직하게 고정 — 좋은 패턴.
- 격리: `guard = _harness.load_module_by_path("guard_review_before_push", _HOOK_PATH)` 로 모듈
  레벨에서 1회 로드하고 이후 모든 테스트가 순수 함수(`_is_git_push`, `_GIT_PUSH.pattern`)만 호출·
  비교한다 — 모듈 상태를 변경하는 테스트가 없어 순서 의존성 없음. `BacktrackingTest` 만 실제
  서브프로세스를 새로 띄워(catastrophic backtracking 이 시그널을 무시하는 문제를 올바르게 피함)
  다른 테스트와 완전히 독립적으로 실행됨.
- 가독성: `CORPUS`(command, note, release_reason) 3-필드 단일 리스트에서 `RELEASED` 를 파생시켜
  리터럴 이중 관리를 없앤 구조(직전 WARNING #2 반영)가 실제로 코드에 반영돼 있고(`RELEASED = {cmd:
  reason for cmd, _n, reason in CORPUS if reason is not None}`), `subTest(note=..., command=...)`
  로 코퍼스 파라미터화 실패 시 어느 케이스인지 즉시 드러난다. 각 CRITICAL 회귀 테스트의 docstring
  이 "무엇이 왜 깨졌었는지" 를 PoC 와 함께 서술해 실패 시 원인 추적이 빠르다 — 테스트 가독성이
  전반적으로 높다.
- `test_no_new_blocks`/`test_every_enumerated_release_actually_releases`/`test_every_non_release_
  entry_stays_blocked` 3종이 차등 테스트를 "항진명제화"되지 않도록 서로 다른 방향에서 죄고 있는
  구조는 테스트 스위트 설계상 견고하다(직전 리뷰의 WARNING 을 넘어서는 선제적 방어).

## 요약

직전 라운드의 CRITICAL 3건(C1 홑따옴표 우회, C2 ReDoS, C3 확장 unmask)은 코드·테스트 양쪽에서
실제로 수정됐음을 직접 실행(25/25, 367/367)과 3종의 독립 뮤테이션 재현(코드를 되돌려 테스트가
정말로 실패하는지 확인 후 원복)으로 확인했다. 테스트 설계 방법론(동결 테스트 + 차등 테스트 +
해제-사유 stale 방지 테스트 + 서브프로세스 하드 타임아웃 ReDoS 테스트)은 여전히 탄탄하고, 직전
WARNING(태그 heredoc 무테스트, CORPUS/RELEASED 이중 SoT)도 이번 diff 에서 실제로 해소됐다. 새로
발견한 갭은 심각도가 낮다 — `_COMMIT_STDIN_CMD` 의 env-assignment 분기가 뮤테이션으로 확인된
dead-for-tests 코드라는 점(INFO), `main()` 과 `_is_git_push` 유닛 테스트 사이의 통합 이음매에
release 경로 e2e 스모크가 없다는 점(INFO), 그리고 이번 diff 가 채운 backlog ② 갭을 인접
`test_guard_review_before_push_main.py` 의 docstring 이 여전히 "무테스트" 라고 잘못 서술해 문서-
현실 drift 가 생겼다는 점(WARNING, 이 diff 의 변경 파일 목록 밖이라 놓치기 쉬움)이다. Critical/
Warning 급 신규 결함은 발견하지 못했다.

## 위험도

LOW
