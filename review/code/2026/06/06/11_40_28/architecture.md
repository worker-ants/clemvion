### 발견사항

- **[INFO]** `review_guard.py` 가 `branch_guard.py` 의 private helper `_origin_default_branch` 를 직접 import
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/harden-review-hooks-cb1c84/.claude/hooks/_lib/review_guard.py` L652–654
  - 상세: `from branch_guard import _origin_default_branch` — 언더스코어 prefix 는 Python 관례상 모듈 내부 구현 세부 사항임을 표시한다. 이 심볼을 외부 모듈이 직접 의존하면 `branch_guard` 리팩터링 시 `review_guard` 를 함께 변경해야 하는 암묵적 결합이 생긴다. 현재 코드는 `try/except` 로 import 실패를 흡수하므로 런타임 파괴 위험은 없지만, 공개 인터페이스가 없는 내부 함수에 대한 구조적 의존이 계속 존재한다.
  - 제안: `branch_guard` 에 `get_origin_default_branch(cwd)` 같은 공개 함수를 노출하거나, 두 모듈이 공유하는 `_git_utils.py` 레이어를 추가해 공통 로직을 올바른 공개 경계 뒤에 두는 것을 검토한다.

- **[INFO]** `review_guard.py` 와 `guard_review_before_stop.py` 에 `_run_git` / `_repo_root` 같은 git 래퍼가 중복 구현됨
  - 위치: `review_guard.py` L688–706, `guard_review_before_stop.py` 에는 없지만 `_throttle_token` 안에서 `subprocess.run` 을 직접 호출 (L1444–1460)
  - 상세: `branch_guard`, `review_guard` 모두 동일 패턴의 `_run_git(args, cwd, timeout)` 를 각자 보유한다. git subprocess 래퍼가 `_lib/` 레이어에 분산·중복되어 있는 것은 단일 책임 원칙의 약한 위반이다. 이번 변경에서 새로 추가된 코드는 이 패턴을 더 확산시키지 않으므로 이번 PR 범위 내에서의 추가 악화는 없다.
  - 제안: 중기적으로 `_lib/_git.py` 에 공통 git 유틸리티를 모으고 양 모듈이 이를 import 하도록 리팩터링한다. 단, 이번 하드닝 PR 의 범위를 벗어나므로 별도 이슈로 추적하는 것이 적절하다.

- **[INFO]** `_path_session_time` 이 `datetime.timestamp()` 를 로컬 시계 기준으로 해석
  - 위치: `review_guard.py` L848–855, 테스트 `PathSessionTimeTest.test_parses_session_dir_timestamp` L1812–1814
  - 상세: `datetime(Y, m, d, H, M, S)` 는 tzinfo 없이 생성되면 시스템 로컬 타임존을 쓴다. 세션 디렉터리 이름이 UTC 로 생성된 환경에서 이 함수를 다른 타임존 머신에서 실행하면 비교 기준이 어긋난다. 현재 사용 방식("코드 파일 시간 vs 리뷰 세션 시간" 비교)은 동일 머신에서 생성·비교하므로 실용적으로는 무해하다. 테스트도 로컬 타임 라운드트립을 검증한다.
  - 제안: 이 함수가 "checkout-immune clock" 임을 문서에 더 명확히 기술하고, 장기적으로 세션 디렉터리 이름을 UTC 로 표준화하거나 `datetime.fromisoformat` + `timezone.utc` 를 사용하는 것을 검토한다.

- **[INFO]** `_code_review_in_flight` 가 `os.walk` 전체를 순회 — 파일 수 증가 시 성능 고려 필요
  - 위치: `review_guard.py` L1160–1166
  - 상세: 리뷰 세션이 누적될수록 `os.walk(review/code)` 는 모든 과거 디렉터리를 탐색한다. 현재 데이터 규모에서는 문제가 없지만, 이 함수는 Stop hook(매 턴 실행) 경로에 놓여 있다. `SUMMARY.md` 가 있는 완료된 세션은 조기 필터링(`files` 체크가 `os.walk` 의 `topdown=True` 특성으로 디렉터리 진입 전에 수행됨)되어 실제 I/O 는 최소화된다. 설계상 허용 범위이나 기록으로 남긴다.
  - 제안: 세션이 수백 개 이상 쌓이면 `review/code/**/meta.json` 의 glob 또는 세션 디렉터리 인덱스 파일을 도입하는 것을 검토한다.

- **[INFO]** `guard_review_before_stop.py` 의 `_throttle_token` 이 `subprocess.run` 을 직접 두 번 호출
  - 위치: `guard_review_before_stop.py` L1444–1460
  - 상세: 파일 내부 함수이므로 레이어 경계 위반은 아니나, `_run_git` 추상화를 사용하지 않고 `subprocess.run` 을 직접 호출하는 패턴이 혼재한다. 이 파일에는 `_run_git` 헬퍼가 없고 `review_guard` 가 import 되지 않으므로 구조적으로는 자기완결적이다.
  - 제안: `_lib/_git.py` 공통화 시 이 함수도 포함한다.

### 요약

이번 변경은 hook 강화를 위한 수렴적(bugfix-driven) 리팩터링으로 아키텍처 관점의 심각한 문제는 없다. 모듈 경계는 `_lib/` (순수 로직) / `hooks/` (진입점) 의 2계층으로 일관되게 유지되며, 각 파일의 책임 범위가 명확하다. 주요 구조적 관찰은 `review_guard` 가 `branch_guard` 의 private symbol 에 직접 의존하는 점과, `_run_git` 래퍼가 모듈별로 중복 구현된 점이지만 두 가지 모두 기존 코드베이스에서 이어진 패턴이며 이번 변경이 새롭게 도입한 것이 아니다. 새로 추가된 `_porcelain_path`, `_authoritative_code_time`, `_code_review_in_flight`, `_path_session_time` 은 모두 단일 책임을 가지며, 변경 규모에 비해 테스트 커버리지가 충분히 확보되어 있다. `_summary_is_resolved` 의 위험도 파싱 로직 개선과 Stop hook throttle 의 branch-keyed 전환은 설계 의도와 구현이 일치하며 확장성에도 유리하다.

### 위험도

LOW
