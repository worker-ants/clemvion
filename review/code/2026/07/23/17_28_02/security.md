# 보안(Security) 리뷰 — push-guard-worktree-scope

대상: `.claude/hooks/guard_review_before_push.py` (worktree 스코프 확장), `.claude/tests/test_push_guard_worktree_scope.py` (신규), `.claude/tests/README.md`, `plan/in-progress/push-guard-worktree-scope.md`

이 변경은 웹앱이 아니라 **push 이전 코드 리뷰를 강제하는 내부 harness 게이트**를 다룬다. 위협 모델은 "외부 공격자"가 아니라 "게이트를 (의도치 않게 또는 의도적으로) 우회하려는 에이전트/커맨드" 이며, 이번 diff 자체가 기존의 false-ALLOW(리뷰 우회) 결함을 닫는 정합성 수정이다.

### 발견사항

- **[WARNING]** `_mentions_branch` 에 길이 상한이 없어 대형 커맨드 입력 시 알고리즘적 DoS(세션 행)로 이어질 수 있다
  - 위치: `.claude/hooks/guard_review_before_push.py` `_mentions_branch` (382-399행), `_push_targets` (429-441행), 호출부 `main()` 499행(`targets = _push_targets(command, base_cwd)`)
  - 상세: `_is_git_push`(284-311행)에는 `_MAX_REDACTION_INPUT = 16_384`(127행) 길이 상한이 있어 그 이상은 즉시 block 하고 무거운 스캔을 건너뛴다. 반면 `_is_git_push`가 "너무 커서 분석 불가 → block"(295-297행, `return True`)을 반환해도 `main()`은 그대로 진행해 `_push_targets(command, base_cwd)`를 호출한다(499행) — 즉 **길이 상한을 넘긴, 임의 길이의 커맨드 문자열**이 아무 캡 없이 `_mentions_branch`로 흘러간다. `_mentions_branch`는 `command.find(branch, start)`를 매치마다 `start = i + 1`로 1칸씩만 전진시키며 반복 호출하는데(387-399행), branch 문자열과 겹치는 패턴을 가진 입력(예: 반복되는 문자 시퀀스가 포함된 대형 커밋 메시지/heredoc 본문 뒤에 `&& git push`)에 대해서는 총 비용이 O(n²)로 커질 수 있다. 이는 `_worktree_branches`가 열거하는 **체크아웃된 branch 개수만큼** 반복된다(현재 이 저장소만 해도 plan 문서 기준 15개 worktree, 434행 `for path, branch in _worktree_branches(cwd):`). 이 파일의 나머지 부분(예: 100-127행, 240-271행, 146-164행)은 정확히 이런 종류의 O(n²)/ReDoS 를 세 차례의 리뷰 라운드에서 각각 발견·수정한 전례가 있고("28KB 입력 0.64s, 84KB ~6s" 등 실측까지 남겨둠) — 이 훅은 **모든 Bash 호출을 동기적으로 게이팅**하므로 그 등급의 버그는 곧 세션 행(hang)이다. 이번에 추가된 스코프 확장 경로는 그 선례가 다루던 캡을 재사용하지 않는다.
  - 제안: `_push_targets`(또는 `main()`에서 그것을 호출하기 전)에 `_MAX_REDACTION_INPUT`과 동일한(혹은 별도의, 그러나 명시적인) 길이 상한을 적용해 초과 시 branch 스캔을 생략하고 cwd만 평가하도록 fail-safe 처리할 것. 최소한 `_mentions_branch` 자체에 커맨드 길이 상한 가드를 추가.

- **[INFO]** 워크트리별 fail-open 반복 루프가 표면적을 넓힌다 (설계상 트레이드오프, 신규 결함은 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py` 505-520행(REVIEW gate), 523-540행(PLAN gate) — 특히 `except Exception: continue  # fail open on internal error — check the next target`
  - 상세: 개별 target 에 대해 `evaluate_review(target)`/`evaluate_plan(target)`이 예외를 던지면 그 target 은 조용히 건너뛰고 다음 target 으로 넘어간다. 파일 전체의 철학("훅 오류로 세션을 멈추지 않는다")과 일관되지만, 이제는 target 이 여러 개이므로 "실제로 clean" 인지 "에러가 나서 스킵됐다" 인지 로그상 구분 없이 동일하게 통과된다. 특정 worktree(예: 깨진 심볼릭 링크·손상된 `.git` 상태)에서만 `evaluate_review`가 예외를 던지도록 만들 수 있다면, 그 worktree 만 조용히 미검사로 남고 다른 target 은 정상 통과해 전체적으로 block 없이 넘어갈 수 있다.
  - 제안: 필수는 아니지만, 어떤 target 이 예외로 스킵됐는지 stderr 에 남기면(예: `traceback.print_exc` 앞뒤로 target 경로를 표시) 사후 진단이 쉬워진다. 현재도 `traceback.print_exc(file=sys.stderr)`가 호출되지만 어느 target 에서 실패했는지는 트레이스백 본문에서 추론해야 한다.

- **[INFO]** `evaluate_review`/`evaluate_plan` 의 실제 구현(`_lib/review_guard.py`, `_lib/plan_guard.py`)이 이번 diff 에 포함되어 있지 않음
  - 위치: N/A (리뷰 대상 파일 목록에 두 모듈이 없음)
  - 상세: `_accepts_cwd()`(402-426행)는 오직 **시그니처**만 검사한다(`cwd` 를 받는 파라미터가 있는지). 만약 실제 `evaluate_review(cwd=None)`가 인자를 받기는 하지만 내부적으로 여전히 `os.getcwd()`나 프로세스 전역 상태를 사용해 `cwd` 파라미터를 실질적으로 무시한다면, `_accepts_cwd`는 True를 반환하고 훅은 "스코프가 적용됐다"고 믿지만 실제로는 이번 PR이 닫으려던 false-ALLOW 구멍이 그대로 남는다. 이 리뷰에 제공된 신규 테스트(`test_push_guard_worktree_scope.py`)는 stub 게이트로 훅의 **배선**(target 을 evaluate_*에 올바르게 전달하는지)만 검증하며, 실제 `review_guard.py`/`plan_guard.py`가 `cwd` 를 올바르게 소비하는지는 별도 검증이 필요하다.
  - 제안: 리뷰 스코프에 `_lib/review_guard.py`/`_lib/plan_guard.py`의 diff(및 그쪽 유닛 테스트)를 포함해 실제로 `cwd` 인자를 기준으로 git 상태를 조회하는지 확인할 것. (본 에이전트에게 제공된 파일 목록에는 없어 직접 확인 불가.)

- **[INFO]** `traceback.print_exc(file=sys.stderr)` — 로컬 파일 경로가 포함된 스택 트레이스를 stderr 로 노출 (기존 패턴, 신규 아님)
  - 위치: `.claude/hooks/guard_review_before_push.py` 42, 511, 529행
  - 상세: 노출되는 정보는 로컬 워크트리 파일 경로 수준으로 민감도가 낮고, 이 훅을 보는 것은 훅을 실행한 본인(에이전트/개발자) 뿐이라 실질적 위험은 낮다. 다만 완전성을 위해 기록.
  - 제안: 조치 불요(낮은 민감도, 로컬 전용 도구).

### 인젝션/시크릿/인증/암호화 관련

- 커맨드 인젝션: `subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=cwd, ...)`(357-363행)는 리스트 인자 + `shell=True` 미사용이라 셸 인젝션 경로가 없다. `cwd` 값은 존재하지 않는 경로여도 `FileNotFoundError`로 끝나고 `except Exception: return []`(366-367행)로 안전하게 흡수된다.
- 경로 탐색: `os.path.realpath()` 비교(433-436행)는 심볼릭 링크 정규화 목적의 중복 제거일 뿐 접근 제어 결정에 사용되지 않는다.
- 하드코딩된 시크릿: 없음.
- 인증/인가: 이 파일 자체가 "리뷰 안 된 push 차단"이라는 사내 컴플라이언스 게이트이며, 이번 diff 는 그 게이트의 커버리지 구멍(다른 worktree에서 push 시 미검사)을 닫는 방향의 수정이다. classic 인증 우회는 해당 없음.
- 정규식: `_BRANCH_CHAR = re.compile(r"[A-Za-z0-9._/-]")` 단일 문자 클래스로 ReDoS 위험 없음.
- 테스트 파일(`test_push_guard_worktree_scope.py`): 임시 디렉터리에서 실 git 저장소를 만들어 서브프로세스로 훅을 실행하는 구조. 시크릿·하드코딩된 자격증명 없음. `env=dict(os.environ)`을 그대로 서브프로세스에 전달하지만 이는 테스트 실행 환경 자체이고 테스트가 그 값을 로그/파일에 쓰지 않는다.
- 의존성 보안: 표준 라이브러리(`subprocess`, `inspect`, `os`, `re`)만 사용, 신규 서드파티 의존성 없음 — 이 harness의 "훅은 순수 stdlib" 컨벤션과 일치.

### 요약

이번 변경은 웹 애플리케이션 취약점(SQLi/XSS/커맨드 인젝션/시크릿 하드코딩/인증 우회) 범주에서는 문제가 없다. 핵심은 push 리뷰 게이트 자체의 견고성인데, diff 는 실제로 존재했던 false-ALLOW(리뷰 우회) 결함을 닫는 정합성 수정이며 그 자체로 방향이 맞다. 다만 새로 추가된 `_mentions_branch`/`_push_targets` 경로가 이 파일의 다른 부분과 달리 커맨드 길이 상한(`_MAX_REDACTION_INPUT`)을 재사용하지 않아, 대형 커맨드 문자열 + 다수의 체크아웃 branch 조합에서 알고리즘적 O(n²) 지연(이 파일이 과거 세 차례 실측까지 남기며 심각하게 다룬 것과 동일한 버그 클래스)이 재발할 여지가 있다 — 이 훅은 모든 Bash 호출을 동기 게이팅하므로 이는 가용성(DoS) 문제로 이어진다. 그 외 fail-open-per-target 루프와 `cwd` 인자를 실제로 소비하는지 확인 불가한 `review_guard.py`/`plan_guard.py`의 부재는 설계상 트레이드오프 내지 리뷰 범위 밖의 참고사항으로, 신규 결함이라기보다 후속 확인 권고에 가깝다.

### 위험도

LOW
