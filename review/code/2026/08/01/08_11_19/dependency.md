# 의존성(Dependency) Review — 2026/08/01/08_11_19

검토 방법: 프롬프트에 전체가 실린 12개 파일은 게이트 숫자를 그대로 인용했고, 프롬프트 크기 제한으로
잘린 5개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`,
`consistency_orchestrator.py`, `test_block_integrity.py`)은 `Read` 로 직접 열어 import 절과 핵심
섹션을 확인했다 — 이 경우 인용 줄 번호는 `Read` 가 반환한 실제 소스 줄 번호다. 추가로 `_shared/`
디렉터리 구조·`__init__.py`를 `ls`/`Read`로 확인했고, `git diff --stat origin/main...HEAD`로 의존성
매니페스트 변경 여부를, `grep`으로 서드파티 import 패턴 유무를 전수 확인했다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 17개 리뷰 대상 파일 전량이 표준 라이브러리 또는 내부 harness
  모듈만 import
  - 위치: `.claude/tests/README.md:14-17`
  - 상세: 16개 Python/Markdown 파일의 import 문을 전수 grep 했다
    (`requests|yaml|pyyaml|click|numpy|pandas|flask|django|boto3|pytest` 패턴 매칭 0건, `pip
    install`/`npm install`/`package.json`/`requirements.txt` 언급도 `.claude/tests/README.md`의
    컨벤션 문구 자체와 무관한 기존 테스트(`test_dependabot_npm_coverage.py`) 설명뿐). 실제 코드가
    쓰는 것은 `os, re, json, sys, subprocess, datetime, hashlib, traceback, time, dataclasses,
    inspect, argparse` — 전부 stdlib. `.claude/tests/README.md:14-17`가 "이 스위트는 표준
    라이브러리만 쓰고, 하네스 Python 전체가 서드파티 의존성 0개인 컨벤션을 따른다 — `pytest`/
    `requirements.txt` 도입 전에 그 컨벤션부터 재검토하라"고 명시하며, 신규 테스트
    `test_block_integrity.py`/`test_consistency_orchestrator_state.py`/
    `test_retry_state_shared.py`도 이 규약을 준수한다(`unittest`, `unittest.mock`, 내부
    `_harness` 헬퍼만 사용).
  - 제안: 없음 — 컨벤션 준수 확인.

- **[INFO]** 신규 내부 공유 의존성(`_shared/block_integrity.py`, `_shared/retry_state.py`)의
  레이어링이 건전함 — 순환 의존 없음
  - 위치: `.claude/_shared/block_integrity.py:29-32`(import `os`, `re`만), `.claude/_shared/retry_state.py:31-38`(stdlib +
    `from . import report_paths` 상대 import), 참고로 `.claude/_shared/__init__.py:1-12`(리뷰 대상
    목록엔 없으나 아키텍처 근거 확인을 위해 직접 Read)
  - 상세: 두 신규 모듈 모두 leaf 의존성이다 — `hooks/_lib`나 `skills/_lib`로 역참조하지 않는다.
    `_shared/__init__.py`가 "왜 세 번째 `_lib`가 아니라 별도 top-level 패키지인가"를 명시한다:
    `.claude/hooks/_lib`와 `.claude/skills/_lib`는 둘 다 import하는 인터프리터(테스트 프로세스)에서
    서로 shadow하므로, 세 번째 `_lib`는 그 모호성을 심화시킬 뿐이라는 것. Fan-in도 확인했다 —
    `block_integrity`는 `.claude/hooks/_lib/review_guard.py:141-142`와
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:44,53`(`ALL_CHECKERS`를
    재서술하지 않고 `list(_block_integrity.ALL_CHECKERS)`로 파생 — 단일 진실 원천 패턴)이 쓰고,
    `retry_state`는 세 orchestrator(`code_review_orchestrator.py:47-48`,
    `consistency_orchestrator.py:44-45`, `merge_coordinator_orchestrator.py:44`) 전부가 쓴다.
    `.claude/hooks/guard_review_before_stop.py:76-85`가 `review_guard`에서 밑줄 접두 이름
    (`_resolution_in_flight`, `_repo_root`, `_iter_summaries`)을 직접 import하는 것도 확인했다 —
    세 이름 모두 `review_guard.py:212`, `:400`, `:852`에 정확히 존재해 현재는 계약이 유효하지만,
    "private" 명명 규약을 넘어선 모듈 간 의존이라 향후 `review_guard.py`에서 이름을 바꾸면(이미
    try/except로 감싸여 있어 크래시는 안 나지만) resolution-in-flight 억제와 review-done 문구
    분기가 조용히 비활성화될 수 있다.
  - 제안: 없음 — 현재 유효. 다만 세 이름을 export 계약으로 취급해 이름 변경 시
    `guard_review_before_stop.py`의 fallback(None) 경로가 실제로 발동하는지 회귀 테스트로
    고정해두면 이 fragile-import 표면이 완전히 닫힌다.

- **[WARNING]** `merge_coordinator_orchestrator.py`의 `_shared/retry_state.py` 도입이 나머지 두
  소비자와 비대칭 — `reconcile_state_with_disk` 위임이 없음
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:87-113`(주석
    + `_load_state`/`_save_state`/`_apply_status_update` 3개만 위임, `_reconcile_state_with_disk`
    없음). 교차확인: `plan/in-progress/harness-review-gate-ci-backstop.md:76-83`(9번 항목에 동일
    갭이 이미 등재·defer 표시)
  - 상세: `code_review_orchestrator.py`와 `consistency_orchestrator.py`는 5개 함수 전부(자기치유
    `reconcile_state_with_disk` 포함)를 `_shared/retry_state.py`에 위임하지만,
    `merge_coordinator_orchestrator.py`는 3개만 위임하고 `reconcile_state_with_disk` 호출부 자체가
    없다 — `grep -n "reconcile" merge_coordinator_orchestrator.py` 결과 그 사실을 인정하는 주석
    한 줄(96번째 줄)만 나오고 실제 위임 코드는 없음을 직접 확인했다. 결과적으로 Agent tool로 직접
    fan-out한 merge-coordinator 세션은 `_retry_state.json`이 prepare 시점 스냅샷에 멈춘 채
    SUMMARY가 실제 성공을 보고하는 모순 상태를 그대로 겪는다 — `retry_state.py`
    자체의 독스트링(`.claude/_shared/retry_state.py:1-29`)이 "이 추출이 존재하는 이유"로 명시한
    바로 그 실패 양상이 세 소비자 중 하나에서는 아직 해소되지 않은 것이다. 이미 별도 PR로
    분리한다는 근거(다른 skill의 동작 변경)와 함께 plan에 등재돼 있어 "놓친" 항목은 아니지만,
    공유 의존성의 세 소비자 중 하나가 그 의존성이 제공하는 핵심 속성(디스크 자가 정합)을 아직 얻지
    못한 채 이 diff에 포함돼 있다는 사실 자체는 Dependency 관점에서 현재 상태의 실질적 리스크다.
  - 제안: 이미 plan에 후속 항목으로 등재돼 있으므로 새 조치를 요구하지는 않되, 병합 전 이 WARNING이
    "알려진 채무"로 명시적으로 승인됐는지만 재확인할 것. 후속 PR에서 `_reconcile_state_with_disk`
    위임을 추가하는 것이 3개 오케스트레이터의 의존성 표면을 완전히 대칭화한다.

- **[INFO]** 기본 브랜치(default branch) 해석 로직이 harness 전역에 4곳 독립 구현 — 이번 diff가
  새 4번째 사본을 추가
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1128-1149`
    (`_default_branch_ref` 신설, 이번 diff), `.claude/hooks/_lib/review_guard.py:219-232`
    (`_default_branch`, 기존), 교차확인 `plan/in-progress/harness-review-gate-ci-backstop.md:130-136`
    ("신규 후속 (defer)" — 4곳 중복 인지 서술)
  - 상세: `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` ·
    이번에 신설된 `code_review_orchestrator._default_branch_ref()` ·
    `consistency_orchestrator`의 `args.diff_base or "origin/main"` 리터럴, 총 4개의 독립 구현이
    존재함을 plan 문서가 이미 정확히 지적하고 있고 코드로도 확인된다. `_default_branch_ref()`는
    `review_guard.py`가 이미 갖고 있는 `_default_branch()`(더 나아가 그 안에서 우선 사용하는
    `branch_guard._origin_default_branch()`)를 재사용하는 대신 처음부터 새로 구현한 것 —
    "불필요한 의존성"이라기보다는 "기존 내부 의존성으로 대체 가능한데 새로 만든" 사례다. 반환 계약이
    다르다는 것(로컬 `main` vs `origin/main`)과 `hooks/_lib`·`skills/_lib` 네임스페이스 충돌 해소가
    선행돼야 한다는 것이 plan에 근거로 이미 기록돼 있어, 이번 diff에서 통합하지 않은 판단 자체는
    합리적이다.
  - 제안: 새 조치 불요 — 이미 추적됨. 다만 이 diff가 그 개수를 3에서 4로 늘렸으므로, 다음에 비슷한
    필요가 생겼을 때 5번째 사본을 또 만들기보다 이 plan 항목을 먼저 참조하도록 발견사항으로만
    남겨둔다.

- **[INFO]** 애플리케이션 레벨 의존성 매니페스트 변경 없음 — 확인됨
  - 위치: (해당 없음 — 검증 방법 기술)
  - 상세: `git diff --stat origin/main...HEAD -- '*.json' '*.txt' '*.toml' '*.lock' '*.cfg'
    'package.json' 'requirements*.txt'` 를 직접 실행해 확인했다. 매칭된 14개 파일 전부
    `review/code/2026/07-08/**/_retry_state.json`·`meta.json`(리뷰 세션 산출물)이며,
    `package.json`/`pnpm-lock.yaml`/`requirements.txt`/`go.mod` 등 실제 의존성 매니페스트는 이
    브랜치 diff에 전혀 없다. 이번 변경 전체가 `.claude/` 하네스 내부 리팩터(중복 코드의 공유 모듈
    추출)이며 애플리케이션(`codebase/**`) 의존성 표면에는 영향이 없음을 확정할 수 있다.
  - 제안: 없음.

- **[INFO]** 잠금 없는 공유 상태 파일 동시 접근 — 이미 문서화된 accepted risk, 이번 통합으로
  악화되지 않음
  - 위치: `.claude/_shared/retry_state.py:50-79`(`save_state` 독스트링의 lost-update 서술),
    `plan/in-progress/harness-review-gate-ci-backstop.md:84-93`(10번 항목)
  - 상세: `apply_status_update`(read-modify-write)에 파일 잠금이 없어 동시 `--update` 호출 시
    `agents_fatal`/`agent_history`/`rate_limit_episodes` 등이 유실될 수 있다는 것을
    `retry_state.py` 자신의 독스트링이 상세히 인정하고, plan 문서도 별도 설계(`.fatal` sentinel
    파일)로 후속 등재해뒀다. 이 리스크는 세 orchestrator가 각자 사본을 갖고 있던 리팩터 이전부터
    동일했으므로 이번 통합이 새로 만든 것은 아니다 — 오히려 세 곳에 흩어져 있던 동일 결함을 한
    곳으로 모아, 나중에 락을 추가할 때 한 파일만 고치면 되게 만든 점은 내부 의존성 위생 관점에서
    긍정적이다.
  - 제안: 없음(이미 후속 등재됨) — 그 등재가 살아있는지만 병합 전 재확인.

- **[INFO]** LLM 호출 경로가 CLAUDE.md의 "외부 LLM 호출 정책"을 준수 — `claude -p`/SDK 직접 호출
  없음
  - 위치: `.claude/skills/consistency-checker/SKILL.md:62`("Workflow 의 `agent()` 는 plan-metered
    harness 경로라 빌링 정책 부합")
  - 상세: `consistency_orchestrator.py`/`code_review_orchestrator.py`/
    `merge_coordinator_orchestrator.py` 세 스크립트 모두 `subprocess`는 `git`/`gh` 호출에만
    쓰고(grep으로 확인, `claude`/anthropic SDK 관련 문자열 0건) 모델 호출은 main Claude가 `Agent`
    또는 `Workflow` tool로 수행한다고 SKILL.md가 명시한다 — CLAUDE.md §외부 LLM 호출 정책이 요구하는
    "plan-metered harness 경로만 허용" 원칙과 일치한다.
  - 제안: 없음 — 정책 준수 확인.

## 요약

이번 diff는 세 orchestrator(`code_review_orchestrator.py`/`consistency_orchestrator.py`/
`merge_coordinator_orchestrator.py`)와 두 훅(`guard_review_before_push.py`/
`guard_review_before_stop.py`)에 흩어져 있던 중복 로직을 `.claude/_shared/block_integrity.py`·
`.claude/_shared/retry_state.py` 두 신규 내부 공유 모듈로 추출하는 순수 harness 리팩터다. 17개
리뷰 대상 파일(및 프롬프트에서 잘려 직접 `Read`로 확인한 5개 파일) 전수에서 서드파티 import·의존성
매니페스트 변경은 0건이었고(`git diff --stat`으로 확인), 두 신규 공유 모듈은 stdlib와 서로만
의존하는 leaf 레이어로 설계돼 `hooks/_lib`·`skills/_lib` 간 기존 네임스페이스 충돌을 악화시키지
않는다. 유일한 실질 리스크는 세 orchestrator 중 `merge_coordinator_orchestrator.py`만
`reconcile_state_with_disk` 위임이 빠져 신규 공유 의존성의 핵심 이점(디스크 자가 정합)을 아직 못
받는다는 점인데, 이는 plan 문서에 이미 별도 PR 후속으로 명시 등재돼 있다. 기본 브랜치 해석 로직의
4중 중복(이번 diff가 3→4로 증가)과 상태 파일의 락-프리 동시 접근도 마찬가지로 이미 추적·defer된
항목이며 이번 통합으로 악화되지 않았다.

## 위험도

LOW
