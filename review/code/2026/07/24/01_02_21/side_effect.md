# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope (01_02_21)

## 검증 방법

본 프롬프트가 담고 있는 diff 는 `review/code/2026/07/24/00_34_09/*.md`, `*.json` 12개
리뷰 산출물 파일뿐이다(코드 파일 없음). 그런데 실제 `git diff origin/main...HEAD --stat` (HEAD=
`3dc3a160a`) 로 직접 대조한 결과, 이 라운드가 검토해야 할 진짜 diff 에는
`.claude/hooks/guard_review_before_push.py`(+286/-…), `.claude/tests/test_push_guard_worktree_scope.py`
(+565/-…), `.claude/tests/README.md`(+1) 도 포함돼 있다 — 즉 이번 프롬프트 payload 는 실제 코드 변경분을
누락하고 있다. 그래서 (a) 이 payload 안의 12개 문서/JSON 파일과 (b) `Read`/`Bash` 로 직접 연 실제 소스
(`guard_review_before_push.py`, `test_push_guard_worktree_scope.py`) 양쪽을 함께 분석했다.

## 발견사항

- **[WARNING]** 이번 라운드(01_02_21)의 리뷰 payload/라우팅이 실제 프로덕션 코드 diff 를 빠뜨림 — 부작용 리뷰가 "빈 diff" 위에서 수행될 위험
  - 위치: `review/code/2026/07/24/01_02_21/meta.json` (`agents_forced: ["documentation"]`, `files` 목록에 `.claude/hooks/guard_review_before_push.py`/`test_push_guard_worktree_scope.py`/`README.md` 부재) — 동일 gap 이 `_prompts/_router.md` 를 포함한 이번 라운드의 모든 forced-reviewer 프롬프트에 공통
  - 상세: 이 세션의 HEAD 커밋(`3dc3a160a`)은 리뷰 산출물(00_34_09/*)뿐 아니라 직전 라운드 WARNING 6건을 반영한 실제 코드 변경(`_push_targets` worktree-path 매칭 확장, `main()` 의 `TARGET_SELECTION` degraded 기록, 모듈 docstring 복원, `_ensure_on_path()` 도입)을 함께 담고 있다(`git show --stat 3dc3a160a` 로 확인). 그런데 이번 라운드의 diff/라우팅 계산은 `origin/main...HEAD` 기준 실제로 존재하는 286/565/1줄짜리 `.py`/`.md` 변경분을 완전히 빼먹고, 새로 추가된 리뷰 산출물 파일(문서/JSON)만 남겼다. 그 결과 `agents_forced` 도 `documentation` 하나로 좁혀졌다(00_34_09 라운드에서는 `.py` 변경이 있었기에 documentation·maintainability·requirement·scope·security·**side_effect**·testing 7개가 강제됐던 것과 대조적). RESOLUTION.md(00_34_09) 자신이 "다음 라운드는 코드가 실질 변경됐으므로 fresh 리뷰 1회"라고 명시했음에도, 그 fresh 리뷰가 실제로 받아야 할 코드는 이번 side_effect 리뷰어(그리고 다른 forced reviewer 들)에게 전달되지 않았다. 이는 이 프로젝트 메모리에 이미 기록된 "리뷰 changeset 이 직전 검토 코드 제외"·"disk-write gap = summary WARNING=0 거짓 음성" 과 같은 계열의 harness 갭이며, 이번엔 side_effect 관점에서 실제로 새로 생긴 부작용(아래 "직접 검증" 항목 참고)이 이 라운드의 공식 검토 없이 넘어갈 뻔했다.
  - 제안: harness 의 diff/라우팅 산출 단계가 `git diff <base>...HEAD` 전체 파일 목록과 실제로 일치하는지 사전 assert 하는 self-check 를 추가할 것(예: `meta.json.files` 개수/경로 집합을 `git diff --name-only` 결과와 대조). 최소한 이번 라운드는 `.claude/hooks/guard_review_before_push.py` / `.claude/tests/test_push_guard_worktree_scope.py` / `.claude/tests/README.md` 를 대상으로 한 fresh 리뷰를 별도로 한 번 더 돌릴 것을 권고.

## 직접 검증 (payload 밖, 실제 소스를 열어 확인 — 문제 없음)

payload 갭을 보완하기 위해 현재 `.claude/hooks/guard_review_before_push.py`(762줄)·
`.claude/tests/test_push_guard_worktree_scope.py`(565줄)를 직접 `Read`/`grep` 하여
RESOLUTION.md(00_34_09)가 주장한 WARNING 반영 내용과 실측 대조했다. 새로 도입된 부작용 표면은
아래 하나뿐이며, 기존 §E 관측 규약과 정합됨을 확인했다:

- `main()`(688-758행 부근)의 `_push_targets(...)` 예외 처리 블록이 신규로 `outcome.degraded.append(("TARGET_SELECTION", f"{type(exc).__name__}: {exc}"))` 를 호출한다(WARNING 2 반영분, 코드로 확인). `_ALL_GATES = frozenset({"REVIEW", "PLAN"})` 이라 `"TARGET_SELECTION"` 은 그 집합 밖의 게이트 이름이지만, `_lib/failopen_state.py::report()` 의 리셋 판정은 `set(outcome.answered) != all_gates` 만 보고 `degraded` 리스트의 게이트 이름 종류는 검사하지 않으므로 로직상 문제는 없다 — 다만 이는 REVIEW/PLAN 게이트 자체의 실패와 "worktree 탐지" 실패를 같은 연속-fail-open streak/상태파일(`push_guard_failopen.json`)에 합산한다는 뜻이다(예: `_push_targets` 가 3회 연속 예외를 던지면 REVIEW/PLAN 이 완전히 건강해도 "게이트가 사실상 꺼져 있다" 배너가 뜬다). 코드 주석이 "Symmetric with the DETECTION failure the outer handler records"라고 명시하듯, 기존에 이미 있던 `"DETECTION"` 게이트 이름(747-756행, `main()` 바깥 `except`)과 동일한 선례를 따른 것이라 새로운 설계는 아니다 — 의도된 확장으로 판단, 조치 불요.
- `_push_targets`(475-496행)의 신규 `_mentions_branch(command, path)` 호출은 이전 라운드 side_effect.md(00_34_09)가 이미 검증한 "읽기 전용·fail-open·과다매칭은 게이트를 강화만 함(약화 없음)" 성질을 그대로 상속한다(경계문자 판정 로직 자체는 변경 없음, `path` 인자만 추가). 새로운 파일쓰기·전역상태·네트워크·시그니처 변경 없음.
- `.claude/tests/test_push_guard_worktree_scope.py`(414행, 495-496행, 533-534행)의 `_ensure_on_path()` 헬퍼가 `if entry not in sys.path: sys.path.insert(0, entry)` 로 멱등 가드를 두고 있음을 직접 확인 — 00_34_09 라운드 side_effect WARNING("`sys.path.insert` 무가드 반복 삽입")이 실제로 해소됐다.
- 모듈 docstring(`guard_review_before_push.py:14-24`)에 "Each gate evaluates not just the hook's own cwd but also any other checked-out worktree the command names (by branch or by path)" 문장이 복원돼 있음을 확인 — documentation WARNING 반영 주장과 실측 일치.
- 기존 소비자 시그니처(`evaluate_review`/`evaluate_plan`, Stop 훅)에 대한 변경 없음 — `_evaluate_over_targets`(617-661행)는 콜백 인자 개수·순서 그대로.

## 이번 payload(리뷰 산출물 문서) 자체의 부작용 — 없음

- 대상 12개 파일은 전부 `.md`/`.json` 리뷰 리포트로, 실행되는 코드가 아니다. 상태 변경·전역 변수·시그니처·인터페이스·환경변수·네트워크·이벤트/콜백 어느 관점에서도 해당 사항 없음.
- `review/code/2026/07/24/00_34_09/_retry_state.json`(파일 3)·`meta.json`(파일 7)에 로컬 머신의 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/push-guard-worktree-scope-20044c/...`)가 git 이력에 그대로 커밋된다 — 다만 이는 이 프로젝트가 이미 확립한 관례(`review/` 는 SUMMARY·RESOLUTION 포함 커밋 대상, 과거 17_28_02/17_51_28/18_06_41/18_22_56 라운드도 동일 패턴)이고 이번에 새로 도입된 문제가 아니므로 INFO 수준.

## 요약

이번 프롬프트가 준 diff 는 실제로는 진짜 부작용 표면(프로덕션 코드 변경)을 빠뜨린 "리뷰 산출물 문서만
남은" payload였다 — harness 의 diff/라우팅 계산이 origin/main...HEAD 실제 변경 파일 집합과 어긋나는
갭으로 판단되며, 이 라운드에서 side_effect 관점이 강제 대상에서 사실상 빠질 뻔했다(WARNING). 이를
보완하기 위해 실제 소스를 직접 열어 검증한 결과, 새로 도입된 부작용은 `TARGET_SELECTION` degraded
기록 하나뿐이고 이는 기존 `DETECTION` 선례와 동일한 설계(REVIEW/PLAN 게이트 실패와 같은 streak 로
합산)로 문제 없음을 확인했다. 직전 라운드 side_effect WARNING(`sys.path` 무가드 삽입)도 실제로
`_ensure_on_path()` 로 해소돼 있다. payload 로 제공된 문서 12건 자체는 비실행 리포트라 부작용
없음. 종합하면 코드 레벨 부작용 위험은 낮으나, 이번 라운드의 리뷰 스코프 자체가 실제 diff 를
누락했다는 프로세스 갭은 반드시 기록·후속 조치가 필요하다.

## 위험도

MEDIUM — 코드 자체의 부작용은 LOW 로 판정되나(직접 소스 검증 완료), 이번 라운드의 리뷰 payload 가
실제 코드 diff 를 통째로 누락한 harness 갭은 "리뷰했다는 사실이 실제로는 검토가 안 됐음을 가릴 수
있다"는 점에서 별도로 WARNING 처리·후속 조치가 필요해 MEDIUM 으로 올림.
