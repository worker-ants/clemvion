# API 계약(API Contract) 리뷰

## 대상 검토

이번 변경(round 11, CI 백스톱 도입)의 파일 15건을 모두 확인했다:

- `.claude/_shared/git_probe.py`, `.claude/hooks/_lib/{branch_guard,plan_guard,review_guard}.py`
- `.claude/tests/{README.md,test_block_integrity.py,test_plan_guard.py,test_review_gate_ci.py,test_review_guard_hardening.py,test_stop_guard_failopen.py,test_workflow_yaml_structure.py}`
- `.github/workflows/{harness-checks.yml,review-gate.yml}`
- `plan/in-progress/harness-review-gate-ci-backstop.md`
- `scripts/check-review-gate.py`

전부 저장소 내부 harness(로컬 git hook + GitHub Actions CI 백스톱) 판정 로직·테스트·워크플로 정의이며, HTTP/REST 엔드포인트, 요청/응답 스키마, 클라이언트-서버 계약이 존재하지 않는다. `scripts/check-review-gate.py` 는 `review_guard.evaluate_review()` 를 in-process 로 호출하는 CLI 스크립트이고, `.github/workflows/review-gate.yml` 은 GitHub Actions 워크플로 정의(YAML)로 `actions/checkout@v7`, `actions/setup-python@v7` 같은 서드파티 액션의 표준 사용법을 따를 뿐 자체 API 노출이 없다. `codebase/backend`, `codebase/frontend` 등 실제 API 계층 코드는 이번 변경셋에 포함되지 않았다.

## 발견사항

없음.

## 요약

이번 변경은 리뷰 커버리지 게이트의 훅-독립 CI 백스톱(GitHub Actions 워크플로 + 판정 위임 스크립트)과 그에 딸린 git 프로브 공유/테스트 정비로, HTTP API·요청/응답 스키마·엔드포인트·인증/인가·페이지네이션 등 API 계약 관점의 관심사가 전혀 없다. 해당 없음.

## 위험도

NONE
