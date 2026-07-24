# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope

## 발견사항

- **[WARNING]** 신규 테스트의 `setUp()` 가 `sys.path` 를 매 테스트 메서드마다 무조건(unguarded) `insert` — 프로세스 전역 상태가 누적 오염됨
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:414`(`MentionsBranchTest.setUp`), `:451`~`:452`(`AcceptsCwdContractTest.setUp`)
  - 상세: 이 저장소의 공유 헬퍼 `.claude/tests/_harness.py:32-33` 는 `if str(HOOKS_DIR) not in sys.path: sys.path.insert(0, str(HOOKS_DIR))` 로 **모듈 import 시점에 1회, 멱등하게** 경로를 추가하는 관례를 세워두고 있다(바로 그 파일의 docstring 이 "두 개의 `_lib` 패키지(`.claude/hooks/_lib` vs `.claude/skills/_lib`)가 sys.path 로 섞이면 충돌한다" 는 위험을 명시적으로 경고한다). 반면 신설된 `MentionsBranchTest.setUp`(line 414)과 `AcceptsCwdContractTest.setUp`(line 451-452)는 멤버십 검사 없이 매 테스트 메서드 실행마다(각 클래스 3개 메서드) `sys.path.insert(0, ...)` 를 반복 호출한다. `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 는 전체 테스트 파일을 **단일 프로세스**에서 순차 실행하므로, 이 중복 삽입은 이 테스트 파일 자신의 스코프를 벗어나 이후 실행되는 다른 테스트 모듈의 import 해석 순서까지 그대로 이어받는다. `AcceptsCwdContractTest` 는 특히 `HOOKS_DIR / "_lib"` 자체를 `sys.path[0]` 에 직접 얹어 `review_guard`/`plan_guard` 를 (패키지 한정자 없는) **최상위 모듈명**으로 `sys.modules` 에 캐싱한다(line 456-457) — 바로 `_harness.py` 가 경고하는 종류의 `_lib` 네임스페이스 충돌 표면이다. 실측 결과 다른 테스트 파일들(`test_review_guard.py` 등)은 전부 `from _lib import review_guard as rg` 식으로 패키지 한정 임포트를 쓰고 있어 오늘 당장 캐시 충돌로 이어지진 않지만(`sys.modules["review_guard"]` vs `sys.modules["_lib.review_guard"]` 로 키가 다름), 멱등성 가드 없이 반복 삽입한다는 점 자체가 이 프로젝트가 이미 한 번 명문화한 관례에서 벗어난 상태 변경이다.
  - 제안: `_harness.py` 의 관례와 동일하게 모듈 top-level(또는 클래스 레벨 `setUpClass`)에서 `if ... not in sys.path:` 가드를 두고 1회만 삽입하도록 통일. 최소한 `addCleanup(lambda: sys.path.remove(...))` 로 테스트 종료 시 되돌리는 방법도 가능.

- **[INFO]** push 마다 신규 서브프로세스(`git worktree list --porcelain`)가 추가로 스폰됨 — 읽기 전용이지만 새로운 외부 프로세스 호출 표면
  - 위치: `.claude/hooks/guard_review_before_push.py:380-411`(`_worktree_branches`), 호출부 `:706-710`(`main`)
  - 상세: `_is_git_push()` 가 True 인 모든 `git push` Bash 호출마다 `main()` 이 `_push_targets` → `_worktree_branches` 를 거쳐 `subprocess.run(["git","worktree","list","--porcelain"], cwd=cwd, timeout=5.0)` 를 새로 실행한다(수정 전에는 이 훅이 이 커맨드를 실행하지 않았음). 순수 읽기 전용 git 메타데이터 조회이고 `try/except: return []` 로 fail-open 처리되어 상태 변경은 없지만, PreToolUse 훅이 매 push 마다 동기적으로 새 외부 프로세스를 스폰한다는 점에서 부작용 표면이 하나 늘었다. (성능 관점은 performance.md 가 이미 다룸 — 여기서는 "새 프로세스 호출"이라는 부작용 종류로만 기록.)
  - 제안: 별도 조치 불요 — 정합성 수정에 필요한 의도된 트레이드오프이며 실패 시 안전하게 저하(빈 리스트)됨.

- **[INFO]** `evaluate_review`/`evaluate_plan` 이 push 1회당 정확히 1회 → target(worktree) 개수만큼 반복 호출되도록 호출 빈도가 바뀜
  - 위치: `.claude/hooks/guard_review_before_push.py:598-636`(`_evaluate_over_targets`), 특히 line 621 `result = evaluate(target) if scoped else evaluate()`
  - 상세: 두 게이트 함수 자체의 시그니처(`cwd: str | None = None`)는 이번 diff 이전부터 이미 존재했고(`git diff origin/main...HEAD -- .claude/hooks/_lib/review_guard.py .claude/hooks/_lib/plan_guard.py` 결과 무변경 확인) 이번 diff 는 그 함수를 **몇 번, 어떤 인자로** 부르는지만 바꾼다. `_lib/review_guard.py`·`_lib/plan_guard.py` 전체를 grep 한 결과 두 파일 어디에도 `open(..., "w")` 가 없고(읽기 전용 `open(path, "r", ...)` 뿐), `os.chdir`/`os.environ[...] =` 같은 전역 상태 변경도 없어 — 반복 호출 자체가 새로운 파일 쓰기·프로세스 전역 오염을 유발하진 않는다. 다만 두 함수 내부의 `subprocess.run(["git", ...])` 호출도 target 수만큼 비례해서 늘어난다(이미 target 은 realpath 로 dedup 되어 있어 동일 worktree 중복 호출은 없음 — line 469, 471-472). 이 훅의 자매 훅인 `.claude/hooks/guard_review_before_stop.py`(Stop 훅, 이번 diff 미변경 확인)는 여전히 `evaluate_review()`/`evaluate_plan()` 을 무인자로 1회만 호출하므로, 이 호출-빈도 변경은 push 훅 국소적이고 다른 소비자에 전파되지 않는다.
  - 제안: 별도 조치 불요 — 확인 목적의 기록.

- **[INFO]** 차단 메시지 템플릿에 신규 `worktree:` 줄 추가 — Claude/사용자에게 노출되는 출력 텍스트의 관측 가능한 변경
  - 위치: `.claude/hooks/guard_review_before_push.py:480-519`(`_REVIEW_MSG`/`_PLAN_MSG` 정의, `worktree:  {worktree}` 줄), 렌더 호출부 `:655-657`, `:677-679`
  - 상세: `main()` 이 exit 2 로 반환할 때 stderr 로 출력되는 리팩터 메시지 포맷에 줄이 하나 늘었다. `.claude/tests/*.py` 전체를 grep 한 결과 이 메시지 본문을 줄 수/정확한 포맷으로 파싱하는 다른 테스트나 도구는 없음(신규 테스트 자신은 `assertIn(self.side_wt, r.stderr)` 처럼 부분 문자열만 검사) — 하위 호환 파서가 깨질 위험은 확인되지 않았다.
  - 제안: 별도 조치 불요.

## 점검 결과 상세 (문제 없음으로 확인)

- **파일시스템 쓰기**: `_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets` 4개 신규 함수 전부 순수 읽기 전용(디스크 쓰기 없음). `_lib/review_guard.py`/`_lib/plan_guard.py` 도 `open(...,'w')` 가 전무함을 직접 grep 으로 확인.
- **e2e 테스트 격리**: `PushGuardWorktreeScopeTest.setUp` 은 `tempfile.mkdtemp()` + `self.addCleanup(shutil.rmtree, ..., ignore_errors=True)` 로 실제 git repo/worktree 를 임시 디렉토리에서만 생성·삭제 — 현재 프로젝트 저장소를 건드리지 않음.
- **`push_guard_failopen.json` 상태 파일 오염 여부**: `test_degradation_is_counted_once_per_gate_not_per_target` 만 실제 `failopen_state.py` 를 복사해 사용하며, 이 테스트는 `env["CLAUDE_PROJECT_DIR"] = self.tmp` 로 상태 파일 경로를 격리한다(line 285). 나머지 e2e 테스트들은 `env = dict(os.environ)` 로 실제 `CLAUDE_PROJECT_DIR` 를 상속하지만, 이들이 복사한 `_lib/` 디렉토리에는 `failopen_state.py` 가 없어(`setUp` 에서 `review_guard.py`/`plan_guard.py` 스텁만 기록) 훅 내부의 `import failopen_state` 가 실패 → `failopen_state = None` → `_report_fail_open` 이 "저하 모드(파일 쓰기 없이 print 만)" 분기(line 559-570)로 빠져 실제 `.claude/state/push_guard_failopen.json` 을 절대 건드리지 않는다. 실제 실행으로 상태 오염 경로가 없음을 코드 대조로 확인.
- **시그니처/인터페이스 하위호환**: `git diff origin/main...HEAD -- .claude/tests/test_guard_review_before_push_main.py .claude/hooks/guard_review_before_stop.py .claude/hooks/_lib/plan_guard.py .claude/hooks/_lib/review_guard.py` 결과 4개 파일 모두 무변경 — 기존 소비자(Stop 훅, main() 엔트리포인트 테스트)에 대한 시그니처/동작 영향 없음.
- **환경 변수**: 신규 함수(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`) 어디에도 `os.environ` 읽기/쓰기 없음(grep 으로 확인). `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`/`CLAUDE_PROJECT_DIR` 는 기존 계약 그대로 소비될 뿐 신규 도입 없음.
- **네트워크 호출**: 없음. 모든 신규 subprocess 는 로컬 `git` 명령(`git worktree list --porcelain`)이며 외부 서비스 접근 없음.

## 요약

이번 변경(교차-worktree push 가드 스코핑)이 도입하는 실질적 부작용은 두 가지 — (1) push 마다 `git worktree list` 서브프로세스 1회 추가, (2) `evaluate_review`/`evaluate_plan` 이 target(worktree) 수만큼 반복 호출 — 이며 둘 다 정합성 수정을 위한 의도된 트레이드오프이고, 두 게이트 함수·신규 헬퍼 4개 모두 grep/코드 대조로 순수 읽기 전용임을 직접 확인했다. 기존 함수 시그니처·Stop 훅·main() 엔트리포인트 계약은 diff 로 전혀 손대지 않아 하위 호환이 유지된다. e2e 테스트는 임시 디렉토리에 격리되어 실제 저장소나 프로젝트 상태 파일(`push_guard_failopen.json`)을 오염시키지 않음을 코드 경로로 확인했다. 유일하게 실질적인(비록 테스트 전용이지만) 이슈는 신규 테스트의 `setUp()` 이 프로젝트 자체가 세워둔 "sys.path 삽입은 멱등하게, import 시점 1회" 관례를 어기고 매 테스트 메서드마다 무가드로 `sys.path.insert` 를 반복해 공유 unittest 프로세스의 전역 상태를 누적 오염시키는 점으로, 오늘 당장 다른 테스트를 깨뜨리는 증거는 없지만 프로젝트 자신의 `_harness.py` 가 명시적으로 경고하는 충돌 클래스에 해당해 WARNING 으로 남긴다.

## 위험도

LOW
