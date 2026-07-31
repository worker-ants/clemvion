# Security Review

## 발견사항

- **[INFO]** 이전 리뷰 게이트 access-control 우회 결함이 이번 diff 로 정확히 닫혔음 — 배선까지 소스 추적으로 확인
  - 위치: `.claude/hooks/_lib/review_guard.py:862-878`(`evaluate_review` 시그니처에 `in_flight_ok` opt-in 추가), `:901`(`if in_flight_ok and _code_review_in_flight(...)` 게이팅) / `.claude/hooks/guard_review_before_stop.py:344`(Stop 훅이 `evaluate_review(in_flight_ok=True)` 호출 — 리포 전체에서 이 kwarg 를 True 로 넘기는 **유일한** 호출부) / `.claude/hooks/guard_review_before_push.py:811`,`:845-853`(push 훅은 `evaluate(target)` 로 위치 인자 1개만 전달 → `in_flight_ok` 는 항상 기본값 `False`)
  - 상세: 수정 전에는 "리뷰 세션 디렉터리(`meta.json`)만 만들고 `SUMMARY.md` 를 아직 안 쓴" 상태의 억제가 `evaluate_review()` 내부에서 무조건 적용됐다. 이 함수는 push 하드 게이트(`guard_review_before_push.py`)와 Stop 넛지(`guard_review_before_stop.py`)가 공유하므로, 실질적으로 **빈 세션 디렉터리만 만들면 `_IN_FLIGHT_TTL_SECONDS`(1800초=30분) 동안 push 가드까지 통과**되는 access-control 우회였다(`plan/in-progress/harness-review-gate-ci-backstop.md` §(2) 에 실측 기록: `blocked: False, reason: "... SUMMARY pending) — allowed"`). 코드 주석/docstring 은 그동안 "the push guard still hard-gates" 라고 적어 뒀지만 억제가 무조건인 동안 그 문장 자체가 거짓이었다.
    이번 diff 는 opt-in 파라미터화(`in_flight_ok: bool = False`)로 스코프를 좁혔다. `.claude/hooks/` 전체를 grep 한 결과 `in_flight_ok=True` 를 넘기는 곳은 Stop 훅 한 곳뿐이고, push 훅의 `_evaluate_over_targets` → `evaluate(target) if scoped else evaluate()` 호출부는 여전히 위치 인자만 넘기므로 push 경로는 실제로 다시 hard-gate 상태다.
    회귀 방지가 이중으로 걸려 있다: `test_review_guard_hardening.py::EvaluateInFlightShortCircuitTest`(push 경로=계속 block / Stop 경로=allow, 양방향 고정) + `test_stop_guard_failopen.py::test_stop_passes_in_flight_opt_in`·`test_guard_review_before_push_main.py::test_push_never_opts_into_the_in_flight_concession`(둘 다 mock 반환값이 아니라 실제 서브프로세스가 넘긴 kwarg 값을 파일에 기록해 단언 — 시그니처 회귀가 조용히 통과할 수 없음).
  - 제안: 조치 불요 — 이 diff 자체가 수정이다. 위 3개 회귀 테스트가 향후에도 필수 테스트 스위트에 남아 있는지만 유지할 것.

- **[INFO]** 신규 `diff_base` 문자열이 `git diff` revision 인자로 그대로 보간됨 — 기존 관행과 동일 패턴, 이번 diff 가 새로 만든 공격 표면은 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`(`_branch_changed_rels`, `cmd = ["git", "diff", "--no-renames", "--name-only", f"{diff_base}...HEAD", "--"]`), 호출부 `:432`(`diff_base = args.diff_base or "origin/main"`, `collect_context`) / 동일 패턴이 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1126`(`_default_branch_ref`)·`:1150`(`warn_if_committed_work_is_missing`, `get_git_branch_diff_files` 경유)에도 존재
  - 상세: `subprocess.run` 이 항상 리스트 인자(`shell=False` 기본값)로 호출되므로 셸 인젝션 경로 자체가 없다. `diff_base` 는 로컬에서 오케스트레이터를 구동하는 개발자/에이전트가 넘기는 `--diff-base` CLI 플래그이거나 하드코드 기본값(`"origin/main"`)이지 원격/미신뢰 입력이 아니다. `-` 로 시작하는 값이 이론상 `git diff` 옵션으로 오인될 여지(고전적 "argument injection")는 있으나, 이 harness 에는 그 값을 신뢰 경계 밖에서 받는 경로가 없고, 실패 시에도 `_branch_changed_rels`/`_default_branch_ref` 모두 광범위 `except` 로 흡수해 빈 `set()`/`None` 을 반환할 뿐 악용 가능한 부작용으로 이어지지 않는다.
  - 제안: 우선순위 낮음. 방어적으로 원한다면 `-` prefix 사전 검증 또는 `git rev-parse --verify` 로 유효 ref 확인을 추가할 수 있으나 현재 신뢰 경계상 필수는 아니다.

- **[INFO]** 게이트의 fail-open 설계(이번 diff 가 도입한 것이 아니라 기존 아키텍처이며, 이번 diff 는 오히려 그 위에 관측성을 더함) — 극단적 환경 저하 시 리뷰 없이 push/턴종료가 허용될 수 있음은 여전
  - 위치: `.claude/hooks/_lib/review_guard.py` 모듈 docstring 전반(fail-open 계약 명시), `.claude/hooks/guard_review_before_stop.py:308-320`(`main()` 최상위 `except Exception` → `_allow()`)
  - 상세: "가드는 세션을 절대 wedge 시키면 안 된다"는 이 프로젝트의 오래되고 광범위하게 문서화된 의도적 트레이드오프이며, 이번 PR 은 여기에 실패-공개 관측성(streak 카운터·CI 백스톱 논의)을 오히려 강화하는 방향으로 기여한다. 다만 `git` 바이너리 부재, `_lib` import 손상 같은 심각한 환경 저하가 겹치면 여전히 하드 블록 없이 코드가 push 될 수 있다는 사실 자체는 남아 있다. 이 잔여 갭은 이번 diff 에 포함된 `plan/in-progress/harness-review-gate-ci-backstop.md` 가 "CI 백스톱" 이라는 이름으로 이미 추적 중이며 설계 결정 대기 상태임을 문서 스스로 명시한다.
  - 제안: 이번 PR 범위에서 조치 불요 — CI 백스톱 plan 문서가 후속을 소유.

- **[INFO]** `warn_if_committed_work_is_missing` 은 advisory-only(비차단) — 기본 `--prepare` 가 커밋된 브랜치 작업을 빼먹고도 "Critical 0" 을 낼 수 있는 근본 갭은 경고로만 완화됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1150-1177`(`warn_if_committed_work_is_missing`), 호출부 `:1225`(`collect_change_infos` 내부)
  - 상세: 기본 경로(`--prepare` 인자 없음)는 staged+unstaged+untracked, 즉 "아직 커밋 안 된 것" 만 모은다. 리뷰 워크플로는 커밋을 먼저 하므로 이 집합은 비거나 한두 개뿐일 수 있는데, 그래도 리뷰 세션은 정상 완주해 "Critical 0" 을 낸다 — push 게이트는 이를 "신선하고 해결된 리뷰"로 인정한다. 이번 diff 는 이 상황을 stderr 경고로 알리지만 changeset 자체를 넓히지 않는다(의도적 설계 — 조용히 넓히면 호출자가 요청 안 한 파일까지 리뷰하게 됨). 즉 호출자가 경고를 무시(또는 stderr 를 버림)하면 여전히 미검토 코드가 "리뷰됨" 으로 통과할 수 있다. 이는 이번 PR 이 만든 결함이 아니라 같은 diff 에 포함된 `harness-review-gate-ci-backstop.md` 가 이미 추적 중인, 설계상 의도적으로 남긴 잔여 갭이다.
  - 제안: 이번 PR 범위에서 조치 불요 — 이미 별도 plan 으로 추적됨.

그 외 점검했으나 특이사항 없음 (변경된 `.py`/`.md` 파일 전체 대상):
- **하드코딩된 시크릿/API 키/토큰**: 전체 diff 를 `password|api[_-]?key|secret[_-]?key|private[_-]?key|BEGIN (RSA|PRIVATE|OPENSSH)|AKIA[0-9A-Z]{16}|token\s*[:=]\s*['"]` 로 grep — 매치 0건(변수명 `_IMPL_DONE_MODE_TOKEN` 오탐 1건 제외).
- **커맨드 인젝션**: 신규/변경된 `subprocess.run` 호출 전부 리스트 인자 + `shell=True` 미사용(전체 대상 4개 파일에서 `shell=True` grep 0건) + `timeout` 지정.
- **경로 탐색**: Stop 훅의 마커 파일명 sanitizer(`_sanitize_component`/`_MARKER_SAFE`, `guard_review_before_stop.py:44,47-48`)는 이번 diff 로 변경되지 않았고 기존 회귀 테스트(`test_marker_path_sanitizes_path_traversal`)로 고정돼 있음.
- **인증/인가**: 이번 diff 의 핵심이 바로 access-control 게이트 강화(위 1번 항목)이며 역방향 완화(권한 축소·바이패스 확대)는 발견되지 않음. `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` env 스킵 경로는 기존 그대로이고 이번 diff 가 그 조건을 넓히지 않음.
- **에러 처리**: `warn_if_committed_work_is_missing`/`_branch_changed_rels`/`_default_branch_ref` 모두 git 실패 시 조용히 폴백(빈 리스트/`None`)하고 스택 트레이스나 내부 절대경로를 사용자 대면 출력에 노출하지 않음. `debug_log` 는 로컬 gitignored 상태 파일에만 기록.
- **ReDoS**: 신규 `_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/")` — 중첩 정량자 없는 선형 패턴으로 재앙적 백트래킹 여지 없음.
- **암호화**: 이번 diff 는 해시/암호화 로직을 다루지 않음(해당 없음).

## 요약

이번 변경은 harness 코드 리뷰/일관성 검토 게이트 자체를 다루는 self-hosting PR로, 핵심은 `evaluate_review()` 의 in-flight 억제가 무조건 적용돼 "빈 리뷰 세션 디렉터리만 만들면 최대 30분간 push 하드 게이트까지 우회된다"는 실질적 access-control 결함을 `in_flight_ok` opt-in 파라미터로 정확히 닫은 것이다. 소스 추적(전체 `.claude/hooks/` grep)으로 push 경로가 항상 opt-in 없이 호출됨을 확인했고, 양방향 unit 테스트 + 실제 kwarg 를 파일에 기록하는 서브프로세스 seam 테스트까지 갖춰 회귀에도 견고하다. 나머지 변경(리뷰 프롬프트가 예산 초과로 파일을 무표시 누락하던 결함에 생략 안내 추가, consistency 번들 우선순위 재정렬, 커밋된 브랜치 작업이 기본 changeset 에서 빠지는 경우의 stderr 경고)은 전부 리뷰/검증 커버리지를 강화하는 advisory 성격 개선이며, 새로운 인젝션 벤터·하드코딩 시크릿·인증 우회·안전하지 않은 암호화·민감정보 노출은 도입하지 않았다. `git diff` revision 인자에 `diff_base` 문자열을 보간하는 기존 패턴이 신규 함수 두 곳에도 반복됐지만 리스트 기반 `subprocess.run`(shell=False)과 로컬 신뢰 경계(원격/미신뢰 입력 아님)를 고려하면 실질 위험은 낮다. 게이트의 fail-open 설계와 `warn_if_committed_work_is_missing` 의 advisory-only 성격은 이 PR 이 만든 결함이 아니라, 같은 diff 에 포함된 `plan/in-progress/harness-review-gate-ci-backstop.md` 가 "CI 백스톱" 이라는 이름으로 이미 추적 중인 의도적 잔여 갭이다.

## 위험도

LOW
