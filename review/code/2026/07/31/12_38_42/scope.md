# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 서로 독립적인 5개 결함 수정이 한 브랜치/리뷰 라운드에 번들됨
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:9`, `plan/in-progress/harness-review-gate-ci-backstop.md:9` (두 plan 문서의 "2026-07-31 종결/진행" 배너)
  - 상세: 이 브랜치(`harness-review-gate-fixes-1bd6aa`)는 (1) consistency-summary Critical 하향 금지 + planner 인계 경로, (2) consistency 번들 우선순위 재배열(8회 재발 결함), (3) code-review 쪽 `build_files_section` 무표시 파일 누락 수정, (4) `evaluate_review` in-flight 억제의 Stop-only 스코프 축소, (5) 기본 `--prepare` changeset 누락 경고 — 근본 원인이 서로 다른 5개 결함을 함께 수정했다. 각각 plan 항목·전용 테스트 파일·설명이 있어 "은폐된" 확장은 아니지만, 리뷰 단위가 원자적이지 않다.
  - 제안: 조치 불요. 각 변경이 `git diff origin/main...HEAD` 전체와 두 plan 문서 서술 사이에 1:1 대응되고, 사전에 plan 에 등재돼 있던 항목(§관측/§재발 관측)이 이번에 함께 처리된 것으로 확인됨. 향후 유사 브랜치는 결함별 PR 분리를 고려할 수 있으나 이번 건은 문제 없음.

- **[INFO]** `consistency_orchestrator.collect_context` 내 `diff_base` 계산 위치 이동
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:443` (`diff_base = args.diff_base or "origin/main"` — 기존엔 `--impl-done` 분기 내부에만 있었고, 이번에 함수 최상단으로 이동)
  - 상세: 신규 기능(`prioritize_bundle_files` 의 branch-changed 판정)이 전 모드 공통으로 `diff_base` 를 필요로 하여 발생한 최소 이동. `--impl-done` 자체의 diff 산출 값·타이밍은 그대로이며 drive-by 리팩터가 아니다.
  - 제안: 조치 불요.

- **[INFO]** `_default_branch_ref()` 신설이 "origin 기본 브랜치 해석" 로직의 4번째 독립 구현
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1168` (신설). 기존 구현: `.claude/hooks/_lib/branch_guard.py:73` (`_origin_default_branch`, 정본), `.claude/hooks/_lib/review_guard.py:201` (`_default_branch`).
  - 상세: DRY 관점에서는 중복이지만, 통합에는 hooks/skills 간 `_lib` 네임스페이스 충돌 해소가 선행돼야 한다는 점이 `plan/in-progress/harness-review-gate-ci-backstop.md` 상단 "신규 후속 (defer)" 섹션에 이미 명시적으로 인지·defer 처리돼 있다 — 은폐된 부채가 아니라 공개 기록된 부채.
  - 제안: 조치 불요. 이미 별도 plan 항목으로 defer 명시됨.

## 요약

전체 diff(`origin/main...HEAD`, `.claude/**`+`plan/**` 15개 파일, +1,245/-39)를 대조 검증한 결과, 모든 변경 hunk 이 두 plan 문서(`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`)에 사전·사후로 명시된 5개 결함 수정 중 정확히 하나로 추적되며, 무관한 파일·설정(`.claude/settings.json`/`.claude.project.json` 등 무변경)·포맷팅·불필요 import·주석 변경은 발견되지 않았다(`git diff -w` 결과가 일반 diff 와 동일 — 공백만 다른 hunk 0건, 새 import 는 모두 신규 테스트 파일 자체 것). 신규 테스트 3개 파일(`test_consistency_bundle_priority.py`/`test_prompt_omission_notice.py`/`test_review_changeset_warning.py`)은 순수 추가(삭제 0줄, `/dev/null` 헤더 제외)이고, 기존 테스트 4개 파일 수정은 `evaluate_review(in_flight_ok=...)` 시그니처 변경에 필수적으로 종속된 것으로 확인됐다. 유일하게 짚을 만한 점은 서로 독립된 5개 결함이 한 브랜치에 번들된 것과 그로부터 파생된 사소한 리팩터(diff_base 호이스팅) 1건, 기존 중복 헬퍼 1건인데, 셋 다 plan 문서에 사전 계획되거나 사후 정직하게 기록·defer 처리되어 있어 "의도 이상의 은폐된 확장"으로 보기 어렵다. 특히 code-review 쪽 `build_files_section` 누락 수정은 이 PR 자신의 리뷰 세션에서 실제로 발현한 결함이라는 근거(`review/code/2026/07/31/11_07_48`, 14개 프롬프트 전원에서 핵심 파일 2개가 31바이트로 누락)를 명시하며 같은 PR 에 포함한 이유를 밝히고 있어, 임의 확장이 아니라 근거 있는 예외로 판단된다.

## 위험도

NONE
