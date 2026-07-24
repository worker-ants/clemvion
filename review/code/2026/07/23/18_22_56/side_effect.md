# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope (4차, 18_22_56)

대상: branch `claude/push-guard-worktree-scope-20044c` (base `origin/main`), 커밋 `89c3870b4`.

이번 라운드의 실질 신규 diff는 직전 라운드(`18_06_41`, 커밋 `942412ea3`) 이후 추가된 커밋
`89c3870b4` 뿐이다. 이 커밋은 `.claude/hooks/guard_review_before_push.py` **본체를 전혀 건드리지
않는다** — `git show --stat 89c3870b4`로 확인한 결과 변경 파일은 `.claude/tests/test_push_guard_worktree_scope.py`
(신규 테스트 `test_push_targets_crash_falls_back_to_cwd` 1건 + 기존 테스트 docstring 정정),
`plan/in-progress/push-guard-worktree-scope.md`(2·3차 반영 섹션 추가), 그리고 `17_28_02/RESOLUTION.md`
1줄 정정과 `18_06_41/` 리뷰 산출물(감사 기록, 정적 문서)뿐이다. 따라서 훅 코드 자체의 부작용
프로파일(로컬 read-only `git worktree list` subprocess 1회 추가, `evaluate_review`/`evaluate_plan`
target 수만큼 반복 호출, 예외 처리가 게이트 단위→target 단위로 세분화, 차단 메시지에 `worktree:`
라인 추가, payload의 신규 `cwd` 필드 소비)는 1~3차 리뷰(`17_28_02`/`17_51_28`/`18_06_41`의
`side_effect.md`)가 이미 상세 분석했고 이번 라운드에서 달라진 것이 없음을 재확인했다.

## 발견사항

- **[INFO]** 신규 테스트가 실 소스가 아닌 **격리된 임시 복사본**에 대해서만 소스 문자열 패치를 수행 — 저장소에 부작용 없음
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:280-320` (`test_push_targets_crash_falls_back_to_cwd`)
  - 상세: 이 테스트는 `self.hook`(`setUp`에서 `shutil.copy(HOOK_SRC, self.hook)`로 `self.tmp` 하위에 만든 복사본)의 소스 텍스트를 읽어 `_push_targets` 정의 직후에 `raise RuntimeError(...)`를 문자열 치환으로 주입하고, 그 결과를 `self.hooks_dir`(역시 `self.tmp` 하위) 안의 새 파일 `hook_crashing_targets.py`로 쓴 뒤 별도 서브프로세스로 실행한다. 실제 저장소의 `.claude/hooks/guard_review_before_push.py`나 `.claude/hooks/_lib/*.py`는 전혀 열리지 않는다(둘 다 `setUp`에서 스텁 `_REVIEW_STUB`/`_PLAN_STUB` 텍스트로 새로 작성됨). 생성되는 모든 파일은 `self.tmp` 하위이고 `setUp`의 `self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)`가 테스트 성패와 무관하게 정리하므로, 이 테스트가 남기는 파일시스템 잔재는 없다.
  - 제안: 조치 불요. (참고용 — "소스를 패치해 예외를 강제로 일으킨다"는 기법 자체가 프로덕션 파일을 건드리는 것으로 오인될 수 있어 명시적으로 확인함.)

- **[INFO]** 새 테스트의 서브프로세스 env도 기존 관례(`dict(os.environ)` 복사본에만 대입)를 그대로 따름 — 테스트 프로세스 자신의 환경변수 불변
  - 위치: `.claude/tests/test_push_guard_worktree_scope.py:301-306`
  - 상세: `env = dict(os.environ)`로 얕은 복사 후 `STUB_BLOCKED_PATHS`/`STUB_PLAN_BLOCKED_PATHS`/`STUB_RAISE_PATHS`를 그 복사본에만 설정하고 `BYPASS_*`를 `env.pop(...)`으로 복사본에서만 제거한다. `subprocess.run(..., env=env)`로 자식 프로세스에만 전달되며, 자식은 실행 후 종료되어 세션 전역에 남는 환경변수 상태가 없다. 3차 리뷰가 확인한 `STUB_RAISE_PATHS` 도입 시점의 패턴과 동일하다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 신규 아님) 훅 본체의 부작용 프로파일은 이번 라운드에서 변경 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` 전체 — `git diff 942412ea3..89c3870b4 -- .claude/hooks/guard_review_before_push.py`가 빈 diff임을 확인
  - 상세: `_worktree_branches`의 `git worktree list --porcelain` subprocess(로컬 read-only, `timeout=5.0` + `except Exception: return []` fail-open), `_run_gate`가 target 수만큼 `evaluate_review`/`evaluate_plan`을 반복 호출하는 것(둘 다 diff 범위 밖의 `_lib/review_guard.py`/`_lib/plan_guard.py`이며 파일 쓰기 없음, 1~3차 리뷰가 grep으로 재확인), `main()`이 `payload["cwd"]`를 신규로 읽되 부재 시 `os.getcwd()`로 폴백하는 것, `_REVIEW_MSG`/`_PLAN_MSG`에 `worktree:` 포맷 키가 추가됐지만 이 파일 내부에서만 소비되는 것 — 전부 이전 라운드 판정(LOW)에서 변화가 없다.
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음)

- `os.chdir`/`os.environ[...] =` 형태의 프로세스 전역 상태 쓰기는 훅·테스트 어디에도 없음(grep 0건, 1~3차 리뷰와 동일 결과 재확인).
- 신규 테스트가 만드는 파일(`hook_crashing_targets.py`)은 실행 가능한 스크립트지만 `self.tmp` 안에 격리되어 있고, `sys.executable <path>`로 별도 프로세스에서 실행되므로 테스트 러너(`unittest`) 프로세스의 `sys.modules`/전역 상태에도 영향이 없다.
- `plan/in-progress/push-guard-worktree-scope.md`, `review/code/2026/07/23/17_28_02/RESOLUTION.md`(1줄 정정), `review/code/2026/07/23/18_06_41/*`(신규 정적 산출물)는 순수 문서로 실행 경로에 관여하지 않는다.
- 공개 시그니처·인터페이스 변경 없음 — `main()`의 외부 계약(stdin JSON, exit code 0/2)은 이번 커밋에서 그대로이며, `_push_targets`/`_run_gate` 등 내부 헬퍼도 이번 커밋에서 시그니처가 바뀌지 않았다(테스트만 추가).

## 요약

이번(4차) 라운드에서 실제로 추가된 코드는 테스트 파일 하나(`test_push_guard_worktree_scope.py`)에 신규 테스트 1건과 기존 테스트 docstring 정정뿐이며, `.claude/hooks/guard_review_before_push.py` 본체는 이 커밋에서 전혀 변경되지 않았다. 신규 테스트는 실 소스가 아닌 임시 디렉터리 안의 복사본에만 소스 문자열 패치를 가하고, 격리된 서브프로세스로 실행하며, `addCleanup`으로 확실히 정리되어 파일시스템·환경변수·전역 상태에 잔재를 남기지 않는다. 1~3차 리뷰가 이미 확인한 훅 본체의 부작용 프로파일(로컬 read-only subprocess 1회 추가, target 수만큼의 게이트 반복 호출, 메시지 포맷 키 추가, payload `cwd` 필드의 폴백 있는 소비, 게이트 단위→target 단위 fail-open 세분화)은 이번 커밋에서 달라지지 않았다. 전역 변수 신설, 공개 시그니처/인터페이스 파손, 예상치 못한 파일시스템 쓰기, 환경변수 영구 변경, 네트워크 호출, 이벤트/콜백 오발생은 이번 라운드에서도 발견되지 않았다.

## 위험도

LOW
