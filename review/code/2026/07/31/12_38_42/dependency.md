# 의존성(Dependency) 리뷰 보고서

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 실제 변경분을 직접 대조했다 (프롬프트 파일 2·4·6·7 은
크기 제한으로 본문이 실리지 않아 `Read`/`git diff` 로 직접 원본을 열람):

```
.claude/agents/consistency-summary.md                                   |  23 +-
.claude/hooks/_lib/review_guard.py                                      |  54 +++-
.claude/hooks/guard_review_before_stop.py                               |   6 +-
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py   | 151 ++++++++-
.claude/skills/consistency-checker/SKILL.md                             |  15 +-
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py  | 127 ++++++++-
.claude/tests/README.md                                                 |   3 +
.claude/tests/test_consistency_bundle_priority.py                       | 271 ++++++++++++
.claude/tests/test_guard_review_before_push_main.py                     |  36 ++-
.claude/tests/test_prompt_omission_notice.py                            | 216 +++++++++
.claude/tests/test_review_changeset_warning.py                          | 198 +++++++++
.claude/tests/test_review_guard_hardening.py                            |  22 +-
.claude/tests/test_stop_guard_failopen.py                               |  28 ++-
13 files changed, 1122 insertions(+), 28 deletions(-)
```

전부 `.claude/**`(하네스 자체 Python 훅/오케스트레이터/에이전트 정의/테스트)다.
`codebase/**`, `package.json`, `pnpm-lock.yaml`, `requirements.txt`, `pyproject.toml`,
그 밖의 어떤 lockfile 도 이 diff 에 포함되지 않는다 (`git diff --stat` 로 매니페스트 패턴
전수 조회 결과 0건).

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 하네스 stdlib-only 관례 유지
  - 위치: `.claude/tests/README.md:15-16` (관례 선언: "그 Python 은 표준 라이브러리만 사용 …
    hooks must run on a bare `python3`. Do not introduce `pytest`/`requirements.txt`")
  - 상세: 변경된 4개 Python 모듈(`review_guard.py`, `guard_review_before_stop.py`,
    `code_review_orchestrator.py`, `consistency_orchestrator.py`)과 신규/수정 테스트
    5건(`test_consistency_bundle_priority.py`, `test_prompt_omission_notice.py`,
    `test_review_changeset_warning.py`, `test_guard_review_before_push_main.py`,
    `test_stop_guard_failopen.py`)의 import 문을 전수 대조했다. 신규 함수
    (`code_review_orchestrator._default_branch_ref`/`warn_if_committed_work_is_missing`/
    `_omitted_content_note`, `consistency_orchestrator.prioritize_bundle_files`/
    `_branch_changed_rels`/`_is_catalog_bulk`)는 전부 각 파일에 이미 있던 `os`/`re`/
    `subprocess`/`sys`/`json` stdlib 와 기존 헬퍼(`_git`, `get_git_branch_diff_files`,
    `debug_log`, `line_anchors.truncate_to_line_boundary`, `FULL_CONTEXT_HEADING`)만
    사용한다. 신규 테스트 3개도 `json`/`subprocess`/`sys`/`textwrap`/`unittest` + 내부
    `_harness` 모듈만 import한다. 새 패키지 매니페스트 변경이 diff 에 전혀 없으므로 버전
    고정·라이선스 호환성·신규 CVE 벡터 항목은 해당 사항 없음(N/A).
  - 제안: 없음 — 현 상태 유지 권장.

- **[INFO]** 내부 API 시그니처 확장 — `evaluate_review()` 에 opt-in kwarg 추가 (하위 호환)
  - 위치: `.claude/hooks/_lib/review_guard.py:862` 함수 `evaluate_review`
    (키워드 전용 `in_flight_ok: bool = False` 신설) / 호출부
    `.claude/hooks/guard_review_before_stop.py:344`
    (`evaluate_review(in_flight_ok=True)`)
  - 상세: push 가드(`guard_review_before_push.py`)와 stop 가드가 같은
    `review_guard.evaluate_review()` 를 공유하는 내부 의존 관계는 이전부터 있었다. 이번
    변경은 그 공유 함수에 opt-in 키워드 인자를 추가해 두 호출자의 동작을 분리했을 뿐,
    push 가드 호출부(`guard_review_before_push.py` 의 `_evaluate_over_targets` →
    `evaluate(target)`)는 여전히 위치 인자 `cwd` 하나만 넘기므로 기본값 `False` 로 이전
    동작이 그대로 유지된다 — 직접 grep 으로 호출부 전수 확인, 시그니처 파손 없음.
    `EvaluateInFlightShortCircuitTest`(양방향)와 `test_stop_passes_in_flight_opt_in`
    (seam 자체가 kwarg 를 실제로 넘기는지)로 회귀도 막혀 있다. 순수 내부 모듈 간 의존
    조정이며 외부 패키지 인터페이스 변경은 아니다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** 내부 의존성 중복 — "origin 기본 브랜치 해석" 로직이 이번 diff 로 3번째 독립 구현
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1168`
    함수 `_default_branch_ref` (신설) — 기존 `branch_guard._origin_default_branch()`(정본),
    `review_guard._default_branch()` 와 사실상 같은 일(“origin 기본 브랜치 ref 해석”)을
    각기 다른 메커니즘(`symbolic-ref` vs `rev-parse --verify` fallback 순서)으로 재구현.
    `consistency_orchestrator.py` 의 `args.diff_base or "origin/main"` 리터럴(기존 코드,
    이번 diff 로 변경 없음)까지 합치면 동일 개념의 구현이 4곳으로 늘었다.
  - 상세: 이 중복은 이번 리뷰에서 처음 발견된 게 아니라 이미
    `plan/in-progress/harness-review-gate-ci-backstop.md:48` "신규 후속 (defer)" 항목에
    "실제 코드 공유엔 hooks/skills 의 `_lib` 네임스페이스 충돌 해소가 선행" 이라는 사유로
    명시적으로 defer 기록돼 있다. 즉 인지된 채 의도적으로 지연된 부채이며, 반환 계약도
    서로 달라(로컬 `main` vs `origin/main`) 단순 통합은 아직 불가하다는 근거도 함께 있다.
    기능적으로는 각 구현이 독립적으로 정확히 동작하고 회귀 위험은 없으나, 4곳 중 하나가
    "기본 브랜치 정책"을 바꾸면 나머지 3곳이 조용히 drift 할 수 있는 구조는 여전히 남는다.
  - 제안: 새로 착수할 필요는 없음(이미 추적·defer 확정) — 향후 `_lib` 네임스페이스 정리
    작업 때 4곳을 함께 통합 대상으로 포함.

- **[INFO]** 추가 서브프로세스(git) 호출 — 기존 하드 디펜던시 재사용, 신규 외부 도구 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:249`
    함수 `_branch_changed_rels` (`git diff --no-renames --name-only <base>...HEAD` 실행) /
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1168`
    함수 `_default_branch_ref` (`git symbolic-ref`, `git rev-parse` 실행)
  - 상세: 두 오케스트레이터는 이미 같은 파일 안에서 `git diff`/`git rev-parse` 를 여러 차례
    셸아웃하고 있었다(`_git` 헬퍼, `_collect_code_diff` 등 — 리스트 인자 형태라 `shell=True`
    injection 벡터도 아님). 이번 diff 로 호출 1~2회가 늘었지만 git 자체는 이 하네스 전반의
    hard dependency 이므로 "새 의존성"이 아니며, 실패 시 `debug_log` 후 빈 결과/`None` 반환하는
    fail-soft 경로도 기존 패턴과 동일하다(`timeout=30.0`/`5.0`). 번들 크기·빌드 시간 영향은
    없음 — CI 빌드 파이프라인과 무관한 로컬 개발/리뷰 워크플로 전용 스크립트.
  - 제안: 없음.

- **[INFO]** 테스트 보일러플레이트 중복(신규 3파일 추가로 누적) — 이미 별도 후속으로 추적됨
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:34-53`,
    `.claude/tests/test_prompt_omission_notice.py:41-66`,
    `.claude/tests/test_review_changeset_warning.py:44-57`
    (`_PREAMBLE`/`run_in_orchestrator` fresh-interpreter 우회 패턴이 세 파일에 거의
    동일하게 반복)
  - 상세: 세 파일 모두 "in-process import 가 `_lib` 네임스페이스에서 충돌"하는 동일한
    제약 때문에 서브프로세스로 오케스트레이터를 fresh interpreter 에 로드하는 동일 패턴을
    복제한다. 이 역시 `plan/in-progress/harness-review-gate-ci-backstop.md` "신규 후속 3건"
    항목 3에 "`_harness.py` 로 추출하면 한 곳만 고치면 된다"로 이미 식별·defer 돼 있다.
    외부 패키지 문제는 아니고 harness 내부 테스트 유틸리티 재사용성 문제라 우선순위는 낮다.
  - 제안: 없음(신규 조치 불요) — 다음에 이 패턴을 네 번째로 복제해야 하는 파일이 생기면
    그때는 추출을 미루지 말 것을 권고.

## 요약

이번 변경분(13개 파일, `.claude/hooks/**` · `.claude/agents/**` · `.claude/skills/*/scripts/**` ·
`.claude/skills/consistency-checker/SKILL.md` · `.claude/tests/**`)은 리뷰/일관성 게이트 하네스
자체의 내부 로직·문서 수정이며 `codebase/**`·패키지 매니페스트·lockfile 은 전혀 건드리지 않는다.
전 Python 파일의 import 문을 diff 기준으로 전수 대조한 결과 새 외부 패키지 도입이 없고,
`.claude/tests/README.md` 가 명시하는 "하네스 Python 은 표준 라이브러리만 사용" 관례가 그대로
유지됐다. 유일한 구조적 변화는 (1) `evaluate_review()` 에 하위 호환 opt-in kwarg 를 추가한
내부 API 확장(회귀 테스트로 고정, 호출부 파손 없음 확인)과 (2) 두 오케스트레이터가 기존에도
사용하던 git CLI 를 몇 차례 더 서브프로세스로 호출하는 것뿐이다. "origin 기본 브랜치 해석" 로직이
이번 diff 로 3번째(전체 4곳) 독립 구현되는 내부 의존성 중복이 관측되나, 이는 `_lib` 네임스페이스
충돌이라는 별도 제약을 이유로 plan 문서에 이미 인지·defer 기록돼 있어 새로운 결함이 아니다.
의존성 관점에서 이번 diff 자체에 조치가 필요한 신규 항목은 없다.

## 위험도

NONE
