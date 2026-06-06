# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `.claude/hooks/_lib/branch_guard.py`

- **[INFO]** 타임아웃 상수 인라인 하드코딩
  - 위치: line 38 (`timeout=2.0`)
  - 상세: `_run_git` 기본값(5.0)과 `_origin_default_branch` 의 네트워크 타임아웃(2.0)이 서로 다른 맥락에서 나타난다. 변경 diff의 코멘트("keep the worst-case stall small")는 의도를 잘 설명하지만, 숫자 자체는 모듈 상수 없이 콜사이트에만 존재한다. `review_guard.py`는 유사 상수(`_IN_FLIGHT_TTL_SECONDS`)를 모듈 레벨 상수로 선언하는 패턴을 사용한다.
  - 제안: `_REMOTE_SHOW_TIMEOUT = 2.0` 상수를 모듈 레벨에 선언하고 사용하면 두 파일 간 패턴 일관성이 높아진다. 현재 규모에서는 낮은 우선순위지만, 타임아웃 튜닝 시 찾기 쉬워진다.

---

### 파일 2: `.claude/hooks/_lib/review_guard.py`

- **[INFO]** `_newest_code_mtime` 백워드 컴패티빌리티 래퍼의 위치
  - 위치: lines 835–836
  - 상세: `_newest_code_mtime`은 실제 로직이 `_authoritative_code_time`으로 이전된 후 thin 래퍼로 남아 있다. 코멘트("Back-compat name retained as the seam evaluate_review/tests reference")가 존재 이유를 설명하나, 이 래퍼가 public API로 의도된 것인지 임시 shim인지 명확하지 않다. 장기적으로는 호출 지점을 `_authoritative_code_time`으로 직접 마이그레이션하고 래퍼를 제거하는 것이 코드 추적성을 높인다.
  - 제안: 코멘트에 "TODO: caller 직접 마이그레이션 후 제거" 한 줄을 추가하거나, `evaluate_review` 내부 호출을 직접 `_authoritative_code_time`으로 교체하고 래퍼를 제거한다.

- **[INFO]** `_path_session_time`의 `datetime` import 위치
  - 위치: line 645 (파일 상단 import), lines 849–853 (사용 지점)
  - 상세: `datetime`은 파일 상단에 임포트되어 있고 `_path_session_time` 한 곳에서만 사용된다. 테스트 파일(`test_review_guard_hardening.py`)에서는 `from datetime import datetime`을 지역 임포트로 사용하는 패턴이 섞여 있어 스타일이 불일치한다.
  - 제안: 테스트 파일의 지역 import를 파일 상단으로 올려 일관성을 유지한다.

- **[INFO]** `_dirty_set`이 `_newest_resolved_review_mtime`과 `_newest_resolved_impl_done_mtime` 양쪽에서 독립적으로 호출됨
  - 위치: lines 947, 1128
  - 상세: `evaluate_review`가 두 함수를 순차 호출하면 `git status --porcelain`이 두 번 실행된다. 현재 규모(hook 호출당 1회)에서 실용적 문제는 없으나, 호출 경로를 따라갈 때 "왜 git status가 두 번?"이라는 의문이 생길 수 있다.
  - 제안: `evaluate_review` 수준에서 `dirty = _dirty_set(repo_root)`를 한 번 계산하고 두 함수에 주입하는 시그니처 확장을 고려한다. `_authoritative_code_time`이 이미 `dirty` 매개변수를 지원하는 패턴과 일치한다.

- **[WARNING]** `_summary_is_resolved` 내부 `probe is not ln` 동일성 비교
  - 위치: lines 902, 910
  - 상세: `for probe in lines[i:]` 루프에서 첫 번째 줄(헤딩 자체)을 건너뛰기 위해 `probe is not ln`(object identity)를 사용한다. 이는 CPython의 소형 문자열 인턴(interning) 동작에 의존하는 암묵적 가정이다. 두 문자열이 내용은 같지만 서로 다른 객체인 경우(예: 슬라이싱 후 일부 Python 구현)에서 의도대로 동작하지 않을 수 있다. 동일 인덱스를 `i+1`로 시작하는 방식이 명시적이다.
  - 제안: `for probe in lines[i:]` + `if probe is not ln` 대신 `for probe in lines[i+1:]`로 변경하고, 이전 줄(헤딩)도 함께 검사해야 한다면 `lines[i:]`를 유지하되 인덱스 오프셋(`j = 0; for probe ...` + `if j > 0`)으로 교체한다. 현재 가장 단순한 수정: `for probe in lines[i + 1:]` 로 시작하고, 헤딩 자체에서 위험도 토큰이 있을 수 있으면 `lines[i:i+1]`을 먼저 체크한다.

- **[INFO]** `_section_has_rows`의 `heading_token` 파라미터가 한국어/영어 혼재
  - 위치: lines 911–912 (`"Critical"`, `"경고"`)
  - 상세: 두 섹션 토큰이 각기 영어·한국어로 하드코딩되어 있다. 리뷰 출력 포맷이 변경될 경우 이 두 곳을 모두 찾아서 변경해야 한다. 상수로 분리하면 탐색이 용이하다.
  - 제안: `_CRITICAL_SECTION_TOKEN = "Critical"`, `_WARNING_SECTION_TOKEN = "경고"` 모듈 상수로 분리.

- **[INFO]** `_glob_to_regex` 내부 변수명 `out`이 `_run_git` 반환 `out`과 혼동 가능
  - 위치: line 976 (`out: list[str] = []`)
  - 상세: 같은 파일의 다른 함수들에서 `out`은 git 명령의 stdout 문자열을 의미한다. `_glob_to_regex`에서는 regex 파트 리스트를 의미한다. 함수 스코프 내에서만 사용되므로 실질적 혼란은 없으나, `parts` 같은 더 명확한 이름이 의도를 즉시 전달한다.
  - 제안: `out` → `parts` 또는 `regex_parts`로 변경.

---

### 파일 3: `.claude/hooks/guard_review_before_stop.py`

- **[INFO]** `_throttle_token`이 두 번의 `subprocess.run` 호출을 순차 실행
  - 위치: lines 1444–1458
  - 상세: 브랜치 이름 조회 실패 시 SHA 조회로 폴백하는 로직이 자연스럽고 의도가 명확하다. 그러나 두 subprocess 호출이 예외 공유 없이 독립 try 블록 없이 하나의 try 안에 인라인되어 있어, 첫 번째 성공 후 두 번째 호출의 `FileNotFoundError`(git 없음)가 마스킹될 수 있다. 현재 로직 흐름으로는 첫 번째가 성공하면 두 번째에 도달하지 않아 실질적 문제는 없지만, 읽는 사람이 "왜 단일 try인가"를 재분석해야 한다.
  - 제안: 헬퍼 `_git_abbrev_ref()` / `_git_short_sha()` 내부 함수로 각각 분리하거나, 인라인을 유지하되 두 번째 fallback 블록에 짧은 코멘트("git is available since the first call succeeded")를 추가.

- **[INFO]** `_allow()` 함수가 단순히 `return 0`만 반환
  - 위치: lines 1491–1493
  - 상세: `_allow()`는 가독성을 높이는 named return 패턴으로 유효하다. 다만 동일 파일의 모든 ALLOW 경로가 이를 통과하는지 일관성을 확인해야 한다 — `evaluate_review`가 `False`를 반환할 때도 `_allow()`를 사용하고 있어 일관성은 유지된다.
  - 제안: 현행 유지. 패턴이 명확하다.

---

### 파일 4: `.claude/hooks/lint_mermaid_posttooluse.py`

- **[INFO]** 타임아웃 값 `20.0`이 에러 메시지와 코드에 중복 기재
  - 위치: lines 1568, 1575 (`timeout=20.0`, `"linter timed out after 20s"`)
  - 상세: 타임아웃 값이 코드(`timeout=20.0`)와 사용자용 메시지(`"after 20s"`) 두 곳에 중복된다. 값 변경 시 메시지를 별도로 업데이트해야 한다.
  - 제안: `_NODE_TIMEOUT = 20.0` 상수 선언 후 `f"linter timed out after {int(_NODE_TIMEOUT)}s"` 형식으로 단일 소스화.

---

### 파일 5: `.claude/tests/test_review_guard_hardening.py`

- **[INFO]** `RiskLevelWindowTest`에서 tempdir 정리 누락
  - 위치: lines 1902–1910
  - 상세: `tempfile.mkdtemp()`를 사용하지만 `addCleanup`이나 `with tempfile.TemporaryDirectory()` 컨텍스트 매니저를 사용하지 않는다. 동일 파일의 다른 테스트(`CodeReviewInFlightTest`)는 `with tempfile.TemporaryDirectory() as root:` 패턴을 올바르게 사용한다.
  - 제안: `mkdtemp()` 호출 직후 `self.addCleanup(shutil.rmtree, d, ignore_errors=True)` 추가하거나, `with tempfile.TemporaryDirectory() as d:` 패턴으로 통일.

- **[INFO]** `PathSessionTimeTest.test_parses_session_dir_timestamp`의 지역 import
  - 위치: line 2013 (`from datetime import datetime`)
  - 상세: 파일 상단 import 섹션 대신 테스트 메서드 내부에 `from datetime import datetime`이 위치한다. 파일 내 다른 코드와 일관성이 없다.
  - 제안: 파일 상단의 `import` 블록으로 이동.

- **[INFO]** `_session` 헬퍼 메서드 반환값 미사용
  - 위치: lines 1851–1858 (`return d`)
  - 상세: `_session` 헬퍼가 `d`를 반환하나 호출 지점에서 반환값을 사용하지 않는다. 반환값이 미래 테스트 확장을 위한 것이라면 의도 코멘트가 있으면 좋다.
  - 제안: 현재 미사용이면 반환을 제거하거나 코멘트 추가.

---

### 파일 6: `.claude/tools/bootstrap-session.sh`

- **[INFO]** GC 대상 `state_dir` 목록이 하드코딩
  - 위치: lines 2208–2210
  - 상세: `review_stop_nudged`, `main_worktree_bash_warned` 두 디렉터리가 명시적으로 열거된다. 새 guard가 추가될 때 이 목록을 기억하고 업데이트해야 한다. 현재 규모에서는 허용 가능하지만, `state/` 전체를 스캔하는 방식(예: `find "$main_root/.claude/state" -mindepth 1 -maxdepth 1 -type d`)이 자동으로 커버한다.
  - 제안: 현재 패턴 유지(명시적이고 안전함). 단, 새 state dir 추가 시 이 목록을 갱신해야 함을 script 코멘트에 명시한다.

---

## 요약

전반적으로 이 변경 세트는 가독성이 높고, 함수가 단일 책임 원칙을 잘 따르며, 복잡한 로직마다 의도를 설명하는 docstring/코멘트가 충실히 작성되어 있다. 네이밍도 도메인 개념을 잘 반영한다(`_authoritative_code_time`, `_code_review_in_flight`, `_throttle_token`). 주요 관심사는 `_summary_is_resolved`의 `probe is not ln` 동일성 비교(Python 인터닝 의존)와 테스트 파일의 tempdir 정리 누락이며, 나머지는 상수 중복, 래퍼 수명, 스타일 일관성 수준의 경미한 사항이다. `_dirty_set`이 `evaluate_review` 경로에서 이중 호출되는 점은 성능보다는 코드 추적성 측면의 개선 여지다.

## 위험도

LOW
