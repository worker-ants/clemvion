# 부작용(Side Effect) 리뷰 — push-guard-worktree-scope (2차, 17_51_28)

이번 라운드는 1차 리뷰(`review/code/2026/07/23/17_28_02/side_effect.md`, 위험도 LOW·전원 INFO)의
WARNING 반영판(`_run_gate` 추출, PLAN 스코핑 테스트, fail-open 폴백 테스트, 길이 상한 truncation,
top-level import 정리, legacy fallback 표시 정정)을 포함한 전체 diff를 대상으로 재검토했다. 핵심
로직(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`, REVIEW/PLAN 게이트
호출 방식)은 1차 리뷰 시점과 동일하며, 라운드-1에서 반영된 항목들은 전부 **동작 보존적(behaviour
-preserving) 리팩터 또는 테스트 전용 추가**임을 직접 확인했다(아래 검증 내역).

## 발견사항

- **[INFO]** `_run_gate` 의 `base_cwd` 파라미터가 함수 본문에서 실제로 소비되지 않음(죽은 매개변수)
  - 위치: `.claude/hooks/guard_review_before_push.py` 494행(`def _run_gate(evaluate, bypass_env, targets, base_cwd, is_blocked, render) -> bool:`), 546·557행(호출부에서 `base_cwd` 전달)
  - 상세: `_run_gate` 본문(506-520행)에서 `base_cwd` 는 어디에도 참조되지 않는다 — 510행 주석("Unscoped legacy fallback … report that as the worktree rather than `base_cwd` … which it never consulted")이 정확히 이 사실을 설명하고 있어 **의도된 상태**임은 명확하다(1차 리뷰 INFO-3 "legacy fallback 의 `worktree:` 표시를 `os.getcwd()` 로 정정" 반영의 부산물로 보인다 — 정정 전에는 `base_cwd` 가 unscoped 분기의 render 인자로 쓰였을 가능성이 높다). 기능적 부작용은 없다(사용되지 않을 뿐 잘못된 값이 새어나가지도 않는다). 다만 시그니처만 보면 "gate 평가가 base_cwd 에 의존한다"는 인상을 줄 수 있어, 향후 이 함수를 수정하는 사람이 `base_cwd` 를 실제로 소비하는 로직을 추가하려다 이미 있는 매개변수를 오해하고 재사용할 위험이 낮게 존재한다.
  - 제안: 정정 조치 불요(동작 없음). 유지보수성 관점에서 제거를 고려할 수 있으나 side-effect 관점의 실질 위험은 없음.

- **[INFO]** REVIEW/PLAN 게이트 함수가 push 1회당 target 수만큼 반복 호출되는 변경이 `_run_gate` 추출 후에도 그대로 보존됨 — 재확인, 신규 아님
  - 위치: `.claude/hooks/guard_review_before_push.py` 511-519행(`_run_gate` 내부 `for target in targets ...` 루프), 542-561행(`main()` 의 두 `_run_gate(...)` 호출)
  - 상세: 1차 리뷰(side_effect.md INFO#2)에서 지적한 "target 수만큼 `evaluate_review`/`evaluate_plan` 반복 호출" 은 이번 라운드에서 로직 위치만 `main()` → `_run_gate()` 헬퍼로 이동했을 뿐 호출 횟수·순서·fail-open 방향은 동일하다. `_lib/review_guard.py`/`_lib/plan_guard.py` 를 직접 열어 확인한 결과 두 모듈 모두 `open(..., "r", ...)` 읽기 전용 호출과 `subprocess.run(["git", ...])` (로컬 read-only git 서브커맨드: `rev-parse`, 그 외 log/status/diff 계열로 추정) 만 사용하며 **파일 쓰기·삭제·`gh` CLI(네트워크) 호출은 없음**을 grep 으로 교차 확인했다. 따라서 반복 호출이 늘어나도 새로운 파일시스템 쓰기나 네트워크 부작용은 발생하지 않는다.
  - 제안: 조치 불요 — 확인 목적의 재기록.

- **[INFO]** `subprocess`/`inspect` import 가 함수 지역에서 모듈 top-level 로 이동(1차 리뷰 INFO#7 반영) — 모든 Bash 호출마다 무조건 로드됨
  - 위치: `.claude/hooks/guard_review_before_push.py` 28행(`import inspect`), 32행(`import subprocess`)
  - 상세: 이 훅은 `Bash` 매처에 등록되어 **push 여부와 무관하게 모든 Bash 툴 호출마다 모듈이 로드**된다(528행 `_is_git_push` 검사는 import 이후에 실행됨). 이전(라운드-0, 함수 내부 지역 import)에는 `_worktree_branches`/`_accepts_cwd` 가 실제로 호출되는 push 경로에서만 두 모듈이 로드됐지만, 지금은 push 가 아닌 모든 Bash 호출에서도 로드 비용을 지불한다. 둘 다 표준 라이브러리이고 CPython 은 최초 1회만 실제로 컴파일/초기화하므로 실측상 무시 가능한 수준이나(이미 `json/os/re/sys/traceback` 도 top-level import), "매 Bash 호출마다 실행되는 훅"이라는 이 파일의 성능 민감성을 감안하면 완전한 무영향은 아니라는 점을 기록해 둔다.
  - 제안: 조치 불요 — 파일의 기존 import 컨벤션과 일치시키기 위한 의도된 트레이드오프(1차 리뷰 INFO#7 제안 그대로 반영됨).

## 검증한 항목 (문제 없음)

- `_push_targets` 의 `command = command[:_MAX_REDACTION_INPUT]` truncation(439행)은 순수 함수 내부 지역 변수 재바인딩이며, 인자로 받은 원본 `command` 문자열 객체나 호출자 쪽 상태를 변경하지 않는다(Python 문자열은 불변). 호출자(`main()` 536행)의 `command` 변수는 영향받지 않음.
- `_worktree_branches`(357-371행)의 `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, timeout=5.0)` 는 로컬 read-only 메타데이터 조회이며 리스트 인자(`shell=True` 미사용)라 인젝션 표면이 없다. 실패 시 `except Exception: return []` 로 fail-open — 새 전역 상태·환경변수·파일을 남기지 않음.
- `main()` 이 새로 읽는 `payload.get("cwd")`(534행)는 부재 시 `os.getcwd()` 로 폴백해 하위 호환 유지. 동일 패턴이 `.claude/hooks/normalize_worktree_branch.py:52` 에도 존재함을 재확인(교차 검증).
- `_REVIEW_MSG`/`_PLAN_MSG` 에 추가된 `worktree` 포맷 키(455·478행)는 이 파일 내부에서만 `.format()` 소비되며, `grep -rl "BLOCKED by .claude/hooks/guard_review_before_push"` 결과 이 파일 1건뿐 — 외부 소비자(다른 훅·스크립트가 stderr 텍스트를 파싱하는 경우)는 없음.
- `evaluate_review`/`evaluate_plan` 의 `cwd: str | None = None` 시그니처는 이번 diff 이전에 이미 존재했고(`_lib/review_guard.py:836`, `_lib/plan_guard.py:291`), `_accepts_cwd()` 는 순수 `inspect.signature` 조회만 수행 — 대상 함수를 호출하거나 상태를 바꾸지 않는 순수 판별.
- 신규 테스트(`test_push_guard_worktree_scope.py`)의 부작용은 `tempfile.mkdtemp()` 로 격리된 디렉터리에 한정되고 `self.addCleanup(shutil.rmtree, ...)` 로 정리됨. 서브프로세스에 넘기는 `env=dict(os.environ)` 은 복사본이라 테스트 프로세스 자신의 `os.environ` 을 변경하지 않음(`env_run` 케이스의 `BYPASS_REVIEW_GUARD` 도 서브프로세스 전용 dict 안에서만 설정됨).
- `_run_gate` 의 게이트 격리(한 게이트의 예외/미존재가 다른 게이트를 막지 않음)·target 단위 fail-open(한 worktree 오류가 나머지 target 검사를 막지 않음) 두 불변식은 리팩터 전후 로직을 직접 대조해 동일함을 확인 — 새로운 부작용 경로 없음.
- `.claude/tests/README.md`(카탈로그 1행 추가)·`plan/in-progress/push-guard-worktree-scope.md`(신규 plan 문서)는 순수 문서 파일이며 코드 실행 경로에 관여하지 않음. `review/code/2026/07/23/17_28_02/*`(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·per-agent `*.md`)는 이전 리뷰 라운드의 감사 산출물로, 관례(review 산출물도 커밋)에 따라 diff 에 포함된 정적 기록일 뿐 실행 코드가 아니므로 side-effect 분석 대상 밖.

## 요약

이번 라운드의 실질 코드 변경(round-1 WARNING 반영)은 `_run_gate()` 추출(behaviour-preserving 리팩터), 길이 상한 truncation 추가, import 위치 정리, legacy fallback 표시 정정으로 구성되며, 전부 1차 리뷰가 이미 확인한 부작용 프로파일(로컬 read-only git subprocess 1회 추가, 게이트 함수의 target 수만큼 반복 호출, payload 의 새 `cwd` 필드 하위 호환 소비)을 그대로 유지한다. `_lib/review_guard.py`/`_lib/plan_guard.py` 를 직접 열어 파일 쓰기·`gh`(네트워크) 호출이 없음을 이번 라운드에서 재확인했다. 새로 발견된 것은 `_run_gate` 의 죽은 매개변수(`base_cwd`) 1건뿐이며 기능적 영향은 없다. 전역 변수 신설·시그니처가 있는 공개 인터페이스 변경·예상치 못한 파일시스템 쓰기·환경변수 쓰기·네트워크 호출·이벤트/콜백 오발생은 발견되지 않았다.

## 위험도

LOW
