# Scope Review — review-gate CI backstop (round 9)

검토 대상: `.claude/hooks/_lib/plan_guard.py`, `.claude/hooks/_lib/review_guard.py`,
`.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_plan_guard.py`, `.claude/tests/test_review_gate_ci.py`,
`.claude/tests/test_review_guard_hardening.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.claude/tests/test_workflow_yaml_structure.py`, `.github/workflows/harness-checks.yml`,
`.github/workflows/review-gate.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`,
`scripts/check-review-gate.py` (= `git diff origin/main...HEAD` 의 코드/워크플로/plan 파일
전량, 13개 — review/code/** 산출물은 별도 취급하지 않음).

## 발견사항

- **[INFO]** `plan_guard.py` 의 `_run_git` 수정은 이 브랜치의 표제 기능(리뷰-커버리지 게이트의
  CI 백스톱)과 무관한 **다른 게이트**(plan-coverage push 게이트)의 라이브 결함 수정이며, 그
  게이트를 소유하는 plan 문서 어디에도 기록되지 않았다.
  - 위치: `.claude/hooks/_lib/plan_guard.py:98-127` (`_run_git` 함수 전체 — 새 주석 블록 +
    `["git", "-c", "core.quotePath=false"] + args` 및 `p.stdout.rstrip()` 변경)
  - 상세: 이 브랜치의 SoT 인 `plan/in-progress/harness-review-gate-ci-backstop.md` 는 제목부터
    "리뷰 게이트의 훅-독립 CI 백스톱" 이고 다루는 게이트는 `review_guard.evaluate_review()` 하나다.
    `plan_guard.py` 는 별개 관심사(plan 갱신 여부를 강제하는 push 게이트)이고, 그 기능은
    `plan/complete/harness-plan-gate-worktree-gc.md` 등 **다른(이미 complete 인) plan** 소관이다.
    이번 수정은 review_guard.py 를 감사하다가 "같은 코드가 자매 훅에도 있다" 는 이유로 발견·수정된
    것으로(라운드 8 커밋 메시지에 근거 상세 기술, `git log -1 88ce9994d`), 코드 자체는 정확하고
    테스트(`test_plan_guard.py::PorcelainPathSurvivesOnARealRepoTest`)로 고정돼 있다. 다만
    (a) 이 브랜치의 plan 문서 본문에는 `plan_guard` 언급이 전혀 없어(grep 0건) 무엇이 왜 이
    PR 에 들어왔는지 그 문서만 봐서는 알 수 없고, (b) plan_guard 를 소유하는 completed plan 쪽에도
    이 수정에 대한 교차 참조가 없다 — 이 저장소 자신이 이미 "손-동기 쌍 drift"(report_paths,
    retry_state, doc-sync matrix)로 세 번 겪었다고 기록한 바로 그 실패 모드를, 정정하면서
    또 한 번 문서화 없이 반복했다.
  - 제안: 코드 변경 자체는 유지하되(정확·테스트됨·"발견 즉시 자매 파일 동기화" 는 이 프로젝트가
    이미 채택한 관행), 커밋 메시지 근거 외에 (1) 이 plan 문서에 "왜 plan_guard.py 도 건드렸는지"
    한 줄 교차 참조를 남기거나 (2) plan_guard 를 소유하는 completed plan 문서(또는 새 후속 항목)에
    이번 수정을 기록해 다음 사람이 "이 CI-백스톱 브랜치가 왜 무관한 게이트를 고쳤는가" 를 재추적할
    필요가 없게 한다.

## 요약

13개 파일 전량이 `.claude/`·`.github/workflows/`·`plan/`·`scripts/` 아래 harness 전용 경로에
머물러 있고 `codebase/**` 등 제품 코드는 전혀 건드리지 않았다. 새 파일(`review-gate.yml`,
`check-review-gate.py`, `test_review_gate_ci.py`)은 전부 CI 백스톱이라는 표제 기능 자체이고,
기존 파일 수정(README 카탈로그 갱신, `test_block_integrity.py` 의 스텁 검사 정밀화,
`test_stop_guard_failopen.py`/`test_workflow_yaml_structure.py` 하드닝, `harness-checks.yml`
paths 등재, `review_guard.py` 의 `_run_git` 방어)은 모두 이 브랜치 자신의 9라운드 리뷰가 낸
Critical/Warning 을 그 자리에서 처분한 결과로, 무관한 리팩터·기능 확장·포맷팅 뒤섞기·불필요한
import/주석 변경은 관찰되지 않았다. 유일하게 표제 범위를 벗어나는 항목은 `plan_guard.py` 의
라이브 결함 수정인데, 이는 review_guard.py 감사 중 발견된 자매 훅의 동일 결함을 그 자리에서
막은 것으로(코드·테스트 모두 건전) 프로젝트가 이미 채택한 "발견 즉시 동기화" 관행에 부합하지만,
어느 plan 문서에도 그 이유가 남지 않아 추적성만 약하다.

## 위험도

LOW
