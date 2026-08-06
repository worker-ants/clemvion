# User Guide Sync Review — round 11 (harness CI backstop)

## 절차

1. SSOT 적재: `.claude/config/doc-sync-matrix.json` (22 rows) Read 완료. 모든 glob trigger 는
   `codebase/backend/**`, `codebase/frontend/**`, `codebase/channel-web-chat/**`,
   `codebase/packages/expression-engine/**`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**` 아래를
   가리킨다. semantic trigger 들(auth-session-flow, expression-language, run-debug-flow,
   env-runtime, integration-provider 등)도 전부 `codebase/**` 또는 `spec/**` 변경을 전제로 한다.
2. 변경 파일 식별: prompt 의 15개 파일 섹션 헤더를 전수 확인 + `git diff --name-only origin/main...HEAD`
   로 교차검증.

   ```
   grep -n "^### 파일" _prompts/user_guide_sync.md
   ```
   결과 15건 전부:
   `.claude/_shared/git_probe.py`, `.claude/hooks/_lib/branch_guard.py`,
   `.claude/hooks/_lib/plan_guard.py`, `.claude/hooks/_lib/review_guard.py`,
   `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
   `.claude/tests/test_plan_guard.py`, `.claude/tests/test_review_gate_ci.py`,
   `.claude/tests/test_review_guard_hardening.py`, `.claude/tests/test_stop_guard_failopen.py`,
   `.claude/tests/test_workflow_yaml_structure.py`, `.github/workflows/harness-checks.yml`,
   `.github/workflows/review-gate.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`,
   `scripts/check-review-gate.py`.

   `git diff --name-only origin/main...HEAD` (source 파일만 필터링, `review/**` 산출물 제외)
   가 정확히 위 15개와 일치한다.
3. trigger 매칭: 15개 파일 전부 `.claude/`, `.github/workflows/`, `plan/in-progress/`,
   `scripts/` 하위 — 매트릭스의 어떤 glob(`codebase/**`, `spec/**`)에도 매칭되지 않는다.
   semantic trigger(auth-session-flow-change 는 `codebase/backend/src/modules/auth/**` 를
   지목 — 이번 변경의 "guard"·"인증" 이라는 표면적 키워드 유사성에도 불구하고 이 변경은
   프로젝트 자체의 git-push 하네스(review/plan/branch guard)이지 제품의 인증·권한·세션
   모듈이 아니다)도 매칭되지 않는다.
4. 이 변경 set 은 이 프로젝트를 개발하는 harness/CI 도구 자체(리뷰 게이트의 훅-독립 CI
   백스톱)에 대한 것이며, 최종 사용자에게 노출되는 노드·UI 문자열·통합·문서·표현식 언어·
   실행/디버깅 흐름·인증 흐름 어느 것도 건드리지 않는다. 매트릭스는 명시적으로
   `codebase/**`/`spec/**` 변경만을 다루므로 본 리뷰어의 영역과 무관하다.

## 발견사항

없음.

## 요약

매트릭스 22개 trigger 중 이번 diff(15개 파일, 전부 `.claude/`·`.github/workflows/`·
`plan/in-progress/`·`scripts/` 하위 — 리뷰 게이트 CI 백스톱 하네스 자체 코드/테스트/워크플로)
에 매칭되는 항목은 0개. `codebase/**`/`spec/**` 변경이 전혀 없어 노드·i18n dict·
backend-labels·docs MDX·섹션 locale·표현식 언어·인증 흐름 문서 어느 것도 동반 갱신
대상이 아니다. 해당 없음.

## 위험도

NONE
