# Security Review

## 발견사항

- **[INFO]** 이전 리뷰 게이트 우회(access-control) 결함이 이번 diff 로 정상 해소됨 — 배선까지 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:858` (`evaluate_review` 시그니처), `.claude/hooks/_lib/review_guard.py:897` (`in_flight_ok` 게이팅), `.claude/hooks/guard_review_before_stop.py:344` (Stop 훅 호출부), `.claude/hooks/guard_review_before_push.py:845-853`·`:788-811` (push 훅 `_evaluate_over_targets`/`evaluate(target)` 호출부)
  - 상세: 수정 전에는 `_code_review_in_flight()` 의 "시작됐지만 SUMMARY.md 미작성" 억제가 `evaluate_review()` 내부에서 **무조건** 적용됐다. `evaluate_review()` 는 push 가드(`guard_review_before_push.py`)와 Stop 넛지(`guard_review_before_stop.py`)가 공유하는 함수이므로, 실질적으로 "리뷰 세션 디렉터리(`meta.json`)만 만들고 `SUMMARY.md` 를 쓰지 않으면 `_IN_FLIGHT_TTL_SECONDS`(1800초=30분) 동안 push 가드까지 통과된다"는 access-control 우회였다(plan 문서 `plan/in-progress/harness-review-gate-ci-backstop.md` §(2)에 실측 기록: `blocked: False, reason: "... SUMMARY pending) — allowed"`). 코드 주석·docstring 은 "the push guard still hard-gates" 라고 적어 두었지만 억제가 무조건인 동안 그 문장 자체가 거짓이었다.
    이번 diff 는 `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 파라미터화하고, `if in_flight_ok and _code_review_in_flight(repo_root):` 로 게이팅했다(`review_guard.py:897`). 호출부를 프로젝트 전역에서 grep 한 결과 `in_flight_ok=True` 를 넘기는 곳은 `guard_review_before_stop.py:344` **단 한 곳**이며, push 경로(`guard_review_before_push.py:811` `evaluate(target) if scoped else evaluate()`)는 위치 인자 1개(`cwd`)만 전달하므로 `in_flight_ok` 는 항상 기본값 `False` 로 남는다. 즉 push 가드는 실제로 다시 hard-gate 상태로 복원됐다 — 코드 추적으로 직접 확인.
    회귀 방지도 이중으로 걸려 있다: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest` 가 "push 경로(옵트인 없음)는 여전히 block" / "Stop 경로(`in_flight_ok=True`)만 allow" 양방향을 고정하고, `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in` 이 실제 서브프로세스 seam 을 통해 Stop 훅이 `in_flight_ok=True` 를 정말 전달하는지(단순 mock 반환값 비교가 아니라 kwarg 자체를 파일에 기록해 검증) 단언한다.
  - 제안: 조치 불요 — 이번 diff 자체가 수정이며 배선·테스트 모두 확인됨. 다만 향후 `evaluate_review` 호출부가 추가될 때 이 회귀 테스트들이 CI 에 포함돼 있는지만 계속 유지할 것.

- **[INFO]** 신규 `_branch_changed_rels()` 의 `diff_base` 문자열이 `git diff` revision 인자로 그대로 보간됨 — 기존 관행과 동일, 이번 diff 가 새로 만든 위험은 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:254` (`_branch_changed_rels`, `cmd = ["git", "diff", "--no-renames", "--name-only", f"{diff_base}...HEAD", "--"]`)
  - 상세: `diff_base` 가 `-` 로 시작하는 값이면 이론상 `git diff` 옵션으로 오인될 여지가 있는 문자열 보간 패턴이다. 다만 (1) `subprocess.run` 이 리스트 인자를 사용하므로 셸 인젝션 경로 자체가 없고, (2) `diff_base` 는 `args.diff_base or "origin/main"`(consistency_orchestrator.py:427)로, 로컬에서 오케스트레이터를 구동하는 개발자/에이전트가 넘기는 CLI 플래그이거나 하드코드 기본값이지 원격/미신뢰 입력이 아니며, (3) 같은 파일의 기존 `_collect_code_diff()`(consistency_orchestrator.py:332)가 이미 동일 패턴(`f"{diff_base}...HEAD"`)을 쓰고 있어 이번 diff 가 새로 도입한 위험이 아니다. `returncode != 0`/예외 시 빈 `set()` 만 반환하므로(consistency_orchestrator.py:257-264) 실패해도 조용히 무해하게 저하될 뿐, 악용 가능한 실패 모드가 아니다.
  - 제안: 우선순위 낮음. 방어적 차원에서 원한다면 `diff_base` 가 `-` prefix 인지 사전 검증하거나 `git rev-parse --verify` 로 유효 ref 여부를 먼저 확인할 수 있으나 현재 trust boundary 상 필수는 아니다.

그 외 점검한 항목 — 특이사항 없음:
- 하드코딩된 시크릿/API 키/토큰: 4개 변경 대상 `.py` 파일 전체에서 `eval(`/`exec(`/`pickle`/`yaml.load(`/`os.system(`/`shell=True`/`md5`/`sha1`/`password`/`secret=`/`api_key` 패턴 grep — 매치 0건(주석 중 "secret-store.md" 파일명 언급 1건 제외).
- 커맨드 인젝션: 신규 `subprocess.run` 호출(`_branch_changed_rels`, `_default_branch_ref`, `warn_if_committed_work_is_missing`→`get_git_branch_diff_files`)은 전부 리스트 인자 + `shell=False`(기본값) + `timeout` 지정.
- 경로 탐색: `guard_review_before_stop.py` 의 마커 파일명 sanitizer(`_sanitize_component`/`_MARKER_SAFE`)는 이번 diff 로 변경되지 않았고 `/` 를 전부 `_` 로 치환해 상태 디렉터리 이탈이 불가함을 기존 테스트(`test_marker_path_sanitizes_path_traversal`)가 고정.
- 에러 처리: `warn_if_committed_work_is_missing`/`_branch_changed_rels` 모두 git 실패 시 조용히 폴백(빈 리스트/무경고)하고 stack trace 나 내부 경로를 노출하지 않음.
- 정규식 서비스거부(ReDoS): 신규 `_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/")` — 중첩 정량자 없는 선형 패턴, 재앙적 백트래킹 여지 없음.

## 요약

이번 변경의 핵심은 harness 리뷰 게이트(`review_guard.evaluate_review`)에 존재하던 실질적 access-control 결함 — "리뷰 세션 디렉터리만 만들면 최대 30분간 push 가드까지 우회된다" — 를 `in_flight_ok` opt-in 파라미터로 스코프를 좁혀 닫은 보안 개선이며, 프로젝트 전역 호출부를 grep 으로 전수 확인한 결과 push 경로는 항상 opt-in 이 꺼진 상태로 호출돼 수정이 올바르게 배선돼 있고 양방향 회귀 테스트도 갖춰져 있다. 나머지 변경(`code_review_orchestrator.py` 의 커밋 누락 경고, `consistency_orchestrator.py` 의 번들 우선순위 재정렬)은 리뷰/검증 커버리지를 개선하는 순수 advisory 로직으로, 하드코딩된 시크릿, 인젝션 가능 sink, 인증 우회, 안전하지 않은 암호화, 민감정보 노출은 발견되지 않았다. 유일하게 주목할 점은 `diff_base` 문자열을 `git diff` revision 인자로 보간하는 기존 관행이 새 함수에도 반복된 것인데, 로컬 신뢰 경계(원격/미신뢰 입력 아님)와 안전한 실패 모드(조용한 빈 결과)를 고려하면 실질 위험은 낮다.

## 위험도

LOW
