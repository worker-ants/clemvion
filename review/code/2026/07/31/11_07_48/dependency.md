# 의존성(Dependency) 리뷰 보고서

## 스코프 확인

`git diff origin/main...HEAD --stat` 로 실제 변경분을 직접 대조했다 (프롬프트의 파일 1·3 은
diff/컨텍스트 본문이 비어 있어 게이트 인용이 불가능했으므로, 해당 두 파일은 저장소에서 직접
`git diff` 를 떠서 확인함):

```
.claude/hooks/_lib/review_guard.py                                       |  46 +++-
.claude/hooks/guard_review_before_stop.py                                |   6 +-
.claude/skills/code-review-agents/scripts/code_review_orchestrator.py    |  53 +++++
.claude/skills/consistency-checker/scripts/consistency_orchestrator.py   |  97 +++++++++
.claude/tests/README.md                                                 |   2 +
.claude/tests/test_consistency_bundle_priority.py                       | 238 ++++++++
.claude/tests/test_review_changeset_warning.py                          | 168 ++++++
.claude/tests/test_review_guard_hardening.py                            |  22 +-
.claude/tests/test_stop_guard_failopen.py                               |  28 ++-
plan/in-progress/harness-consistency-summary-downgrade-rule.md          |  31 ++-
plan/in-progress/harness-review-gate-ci-backstop.md                     |  50 ++++-
11 files changed, 715 insertions(+), 26 deletions(-)
```

전부 `.claude/**`(하네스 자체 Python 훅/오케스트레이터·테스트)와 `plan/**`(문서)이다.
`codebase/**`, `package.json`, `requirements.txt`, `pyproject.toml`, lockfile 은 이 변경에
포함되지 않는다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 하네스 stdlib-only 관례 유지
  - 위치: `.claude/tests/README.md:14-17`
  - 상세: 변경된 5개 Python 파일(`review_guard.py`, `guard_review_before_stop.py`,
    `code_review_orchestrator.py`, `consistency_orchestrator.py`, 및 신규/수정 테스트
    3건)의 diff 를 직접 열람해 import 구문을 전수 대조했다. 신규로 추가된 함수
    (`warn_if_committed_work_is_missing`/`_default_branch_ref` — code_review_orchestrator.py,
    `prioritize_bundle_files`/`_branch_changed_rels`/`_is_catalog_bulk` — consistency_orchestrator.py)
    는 전부 각 파일에 이미 있던 `os`/`re`/`subprocess`/`sys` stdlib import 와 기존 헬퍼
    (`_git`, `get_git_branch_diff_files`, `debug_log`)만 사용한다. 신규 테스트 2개
    (`test_consistency_bundle_priority.py`, `test_review_changeset_warning.py`)도
    `json`/`subprocess`/`sys`/`textwrap`/`unittest` + 내부 `_harness` 모듈만 import한다.
    `.claude/tests/README.md` 가 명시하는 "하네스 Python 은 third-party 의존성 0" 관례
    (17행: `pytest`/`requirements.txt` 도입 금지 경고)가 이번 변경에서도 그대로 지켜졌다.
  - 제안: 없음 — 현 상태 유지 권장.

- **[INFO]** 내부 API 표면 변경 — `evaluate_review()` 시그니처 확장 (하위 호환)
  - 위치: `.claude/hooks/_lib/review_guard.py` 함수 `evaluate_review` (키워드 전용 인자
    `in_flight_ok: bool = False` 추가) / 호출부 `.claude/hooks/guard_review_before_stop.py`
    함수 `_run` (`evaluate_review(in_flight_ok=True)` 로 변경)
  - 상세: push 가드(`guard_review_before_push.py`)와 stop 가드가 같은
    `review_guard.evaluate_review()` 를 공유하는 내부 의존 관계는 이전부터 존재했다.
    이번 변경은 그 공유 함수에 opt-in 키워드 인자를 추가해 두 호출자의 동작을 분리했다
    (기본값 `False` 이므로 push 가드 호출부는 무변경으로 이전 동작 유지). 시그니처를 넓히는
    변경이라 하위 호환이며, `EvaluateInFlightShortCircuitTest`(양방향)와
    `test_stop_passes_in_flight_opt_in`(seam 자체가 kwarg 를 실제로 넘기는지)로
    회귀가 막혀 있다. 순수 내부 모듈 간 의존 조정이고 외부 계약(패키지 인터페이스) 변경은 아니다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** 추가 서브프로세스 호출 — 기존 git 의존성 재사용, 신규 외부 도구 아님
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 함수
    `_branch_changed_rels` (내부에서 `git diff --no-renames --name-only` 실행) /
    `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `_default_branch_ref` (`git symbolic-ref`, `git rev-parse` 실행)
  - 상세: 두 오케스트레이터는 이미 같은 파일 안에서 `git diff`/`git rev-parse` 를 여러 차례
    셸아웃하고 있었다(`_collect_code_diff`, 기존 `_git` 헬퍼 등). 이번 diff 로 각 오케스트레이터
    호출당 git 서브프로세스 호출이 소폭(1~2회) 늘었지만, git 자체는 이 하네스 전반의 hard
    dependency 이므로 "새 의존성"이 아니다. 타임아웃(`timeout=30.0`/`timeout=5.0` 등)과
    실패 시 조용히 빈 결과/조기 리턴하는 fail-soft 경로도 기존 패턴과 동일하게 갖춰져 있다.
    번들 크기·빌드 시간에 미치는 영향은 무시할 수준(단일 로컬 git 프로세스, CI 빌드 파이프라인과
    무관한 개발자/리뷰 워크플로 전용 스크립트)이다.
  - 제안: 없음 — 성능 영향이 우려되면 성능(Performance) 리뷰어 관점에서 별도 확인 권장.

- **[INFO]** 라이선스/버전 고정/취약점 — 해당 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD --stat` 상 11개 파일)
  - 상세: 신규 패키지 매니페스트 변경(`package.json`/`pnpm-lock.yaml`/`requirements.txt`
    등)이 diff 에 전혀 없으므로 라이선스 호환성·버전 고정·알려진 CVE 벡터가 발생하지 않는다.
    `.claude/tests/README.md` 에 문서화된 `test_dependabot_npm_coverage.py`(pnpm 워크스페이스
    바깥 npm 트리의 dependabot 등록 감시)와 `test_bootstrap_mermaid_install.py`(lockfile
    해시 바인딩) 등 기존 취약점 커버리지 가드도 이번 diff 로 인해 영향받지 않는다.
  - 제안: 없음.

## 요약

이번 변경분(11개 파일, `.claude/hooks/**`·`.claude/skills/*/scripts/**`·`.claude/tests/**`·
`plan/in-progress/**`)은 하네스 자체 리뷰/일관성 게이트 로직에 대한 내부 수정으로,
`codebase/**`·패키지 매니페스트·lockfile 은 전혀 건드리지 않는다. `git diff` 로 각 Python
파일의 import 문을 전수 대조한 결과 새 외부 패키지 도입이 없고, `.claude/tests/README.md`
가 명시하는 "하네스 Python 은 표준 라이브러리만 사용" 관례가 그대로 유지됐다. 유일한 변화는
(1) `evaluate_review()` 에 키워드 전용 opt-in 인자를 추가한 내부 API 확장(하위 호환, 테스트로
고정)과 (2) 두 오케스트레이터가 기존에도 사용하던 git CLI 를 몇 차례 더 서브프로세스로 호출하는
것뿐이며, 둘 다 프로젝트 컨벤션과 충돌하지 않는다. 의존성 관점에서 조치가 필요한 항목은 없다.

## 위험도

NONE
