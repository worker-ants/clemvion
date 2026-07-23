# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope (3차, 18_06_41)

이번 라운드의 실질 신규 diff 는 직전 라운드(`17_51_28`, WARNING 2건 반영 커밋 `942412ea3`)에서
발생한 것뿐이다: `_run_gate` 의 미사용 파라미터 `base_cwd` 제거(포지셔널 → `is_blocked=`/`render=`
키워드 전용 전환) + `_REVIEW_STUB` 에 `STUB_RAISE_PATHS` 추가 + 신규 테스트
`test_per_target_fail_open_still_checks_remaining_targets`. `.claude/hooks/guard_review_before_push.py`
전체와 `_lib/review_guard.py`/`_lib/plan_guard.py`(diff 밖이지만 `cwd` 인자 소비 여부 확인 위해
직접 열람)를 재확인했고, 1·2차 리뷰(`review/code/2026/07/23/17_28_02/side_effect.md`,
`17_51_28/side_effect.md`)가 이미 검증한 부작용 프로파일과 달라진 것이 없음을 교차 확인했다.

## 발견사항

- **[INFO]** `_run_gate` 시그니처가 `base_cwd` positional → `*, is_blocked, render` 키워드 전용으로 변경(직전 라운드에서 반영, 이번 라운드 diff 에 포함)
  - 위치: `.claude/hooks/guard_review_before_push.py:494`(`def _run_gate(evaluate, bypass_env, targets, *, is_blocked, render) -> bool:`), 호출부 542-549행·552-561행
  - 상세: `_run_gate` 는 모듈 내부에서만 쓰이는 `_`-prefixed private 헬퍼다. `grep -rn "_run_gate("` 결과 정의 1곳 + `main()` 호출 2곳뿐이며 둘 다 같은 커밋에서 함께 갱신됐다 — 외부 호출자가 없어 시그니처 변경의 파급 범위는 이 파일 안으로 완전히 닫혀 있다. 이전 시그니처의 `base_cwd` 파라미터는 본문에서 한 번도 참조되지 않는 죽은 매개변수였음(2차 리뷰가 지적)을 직접 대조해 재확인했다 — 제거는 순수 정리이며 동작 변화 없음.
  - 제안: 조치 불요.

- **[INFO]** 새 `STUB_RAISE_PATHS` 는 테스트 전용 서브프로세스 env 에만 설정되며 프로세스 자신의 `os.environ` 은 불변
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:54-56`(스텁의 `_REVIEW_STUB` 내 `os.environ.get("STUB_RAISE_PATHS", ...)`), 125-139행(`_run()` 이 `env = dict(os.environ)` 복사본에만 대입해 `subprocess.run(..., env=env)` 로 전달)
  - 상세: `env = dict(os.environ)` 는 얕은 복사본이므로 이 값에 `env["STUB_RAISE_PATHS"] = ...` 를 대입해도 테스트 프로세스 자신의 `os.environ` 은 변하지 않는다. 자식 프로세스(진짜 훅)만 이 값을 읽고, 그 자식도 종료 후 소멸하므로 세션 전역에 남는 상태가 없다. `test_per_target_fail_open_still_checks_remaining_targets`(246-261행)가 `raise_paths=[self.main_wt]`, `blocked_paths=[self.side_wt]` 를 조합해 "cwd 평가에서 예외가 나도 두 번째 target 은 계속 검사된다"는 fail-open 세분화 불변식을 고정한다 — 1차 리뷰가 이미 관찰(behaviour-preserving)로 기록한 target 단위 fail-open 로직 자체의 변경은 없고, 그 불변식에 대한 회귀 핀이 새로 생겼을 뿐이다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 신규 아님) `_worktree_branches` 가 모든 `git push` Bash 호출마다 로컬 read-only `git worktree list --porcelain` subprocess 를 1회 추가로 spawn
  - 위치: `.claude/hooks/guard_review_before_push.py:352-383`
  - 상세: 1차 리뷰(`17_28_02/side_effect.md` INFO#1)가 이미 기록한 항목이며 이번 라운드에서 로직 변경 없음. `timeout=5.0` + `except Exception: return []` 로 fail-open 방어돼 있고, 네트워크 호출이 아닌 로컬 git 메타데이터 조회임을 재확인.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 신규 아님) `main()` 이 payload 의 신규 최상위 키 `cwd` 를 읽기 시작
  - 위치: `.claude/hooks/guard_review_before_push.py:534`(`base_cwd = payload.get("cwd") or os.getcwd()`)
  - 상세: 부재 시 `os.getcwd()` 로 폴백해 하위 호환 유지. 동일 패턴이 `.claude/hooks/normalize_worktree_branch.py:52` 에 기존재함을 재교차 확인 — Claude Code PreToolUse 훅 payload 계약에 이미 존재하는 필드에 대한 신규 소비이며, 근거 없는 가정이 아니다. `test_guard_review_before_push_main.py` 의 무인자 스텁 스위트(19건)는 payload 에 `cwd` 키를 넣지 않으므로 `os.getcwd()` 로 폴백하고, `_accepts_cwd(evaluate)` 가 무인자 시그니처를 감지해 legacy 단일 호출로 degrade — 기존 스위트와 충돌하지 않음을 실행 흐름으로 재확인.
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음, 이번 라운드 재확인)

- `_lib/review_guard.py`/`_lib/plan_guard.py` 는 이번 diff 범위 밖(변경 없음)이며, `evaluate_review(cwd=None)`(review_guard.py:836)·`evaluate_plan(cwd=None)`(plan_guard.py:291) 시그니처는 이 PR 이전부터 이미 `cwd: str | None = None` 을 받고 있었다. 두 모듈에 `open(..., "w")`/`os.remove`/`shutil.*` 류 쓰기·삭제 호출이 없음을 grep 으로 재확인(읽기 전용 `open(..., "r", ...)` 만 존재) — target 수만큼 반복 호출돼도 파일시스템 부작용은 없다.
- `.claude/hooks/guard_review_before_push.py`·`.claude/hooks/_lib/*.py` 어디에도 `os.chdir`/`os.environ[...] = ` 형태의 쓰기가 없음(grep 0건) — 이 훅은 프로세스 cwd 나 환경변수를 변경하지 않고, `cwd` 를 오로지 하위 함수 인자로만 전파한다.
- `_REVIEW_MSG`/`_PLAN_MSG` 의 `{worktree}` 포맷 키는 이 파일 내부에서만 소비되고(`grep -rl "BLOCKED by .claude/hooks/guard_review_before_push"` → 이 파일 1건), `_run_gate` 의 `render(result, target if scoped else os.getcwd())` 호출이 두 메시지 모두에 항상 `worktree=` 를 채워 넘겨 `KeyError` 경로가 없음을 호출부 대조로 확인.
- `test_push_guard_worktree_scope.py` 의 fs 부작용은 `tempfile.mkdtemp()` + `self.addCleanup(shutil.rmtree, ..., ignore_errors=True)` 로 격리·정리되며, 실제 훅 소스는 `shutil.copy` 로 복제해 스텁 `_lib/` 옆에 두므로 리포지토리 자체의 `.claude/hooks/_lib/review_guard.py`/`plan_guard.py` 를 건드리지 않는다.
- `.claude/tests/README.md`(카탈로그 1행), `plan/in-progress/push-guard-worktree-scope.md`(신규 plan 문서), `review/code/2026/07/23/17_28_02/{RESOLUTION,SUMMARY}.md`·`_retry_state.json` 은 순수 정적 문서/감사 산출물로 실행 코드 경로에 관여하지 않는다.
- `_run_gate` 의 두 불변식(게이트 격리: 한 게이트의 `None`/예외가 다른 게이트를 막지 않음 / target 단위 fail-open: 한 worktree 오류가 나머지 target 검사를 막지 않음)은 이전 라운드 대비 로직 변경이 없고, 이번 라운드에서 두 번째 불변식에 대한 회귀 테스트가 신설돼 오히려 더 촘촘히 고정됐다.

## 요약

이번(3차) 라운드의 실질 변경은 private 헬퍼 `_run_gate` 의 죽은 파라미터 제거(키워드 전용 전환, 외부 호출자 없음 확인)와 새 fail-open 회귀 테스트 추가뿐이며, 두 항목 모두 동작 보존적(behaviour-preserving)이다. 핵심 부작용 프로파일 — 로컬 read-only `git worktree list` subprocess 1회 추가, `evaluate_review`/`evaluate_plan` 이 target 수만큼 반복 호출(둘 다 read-only, 파일 쓰기 없음 재확인), payload 의 신규 `cwd` 필드를 폴백 있게 소비, 차단 메시지에 `worktree:` 라인 추가(외부 파서 없음) — 는 1·2차 리뷰가 이미 LOW 로 판정한 상태에서 변화가 없다. 전역 변수 신설, 공개 시그니처/인터페이스 파손, 예상치 못한 파일시스템 쓰기, 환경변수 쓰기, 네트워크 호출, 이벤트/콜백 오발생은 이번 라운드에서도 발견되지 않았다.

## 위험도

LOW
