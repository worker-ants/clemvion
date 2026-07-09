# RESOLUTION — resume-llm-usage-attribution (post-rebase ai-review)

대상 SUMMARY: `review/code/2026/07/10/01_46_28/SUMMARY.md` (LOW, Critical 0, WARNING 0, INFO 13). 차단 사유 없음 — 고가치 INFO 3건 fix.

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit |
|---|---|---|---|
| INFO 11 (documentation) | §1.3 콜아웃 Text Classifier(단발) resume 서술 모호 | 콜아웃을 "AI Agent/IE 는 첫 턴·resume 턴 모두, Text Classifier(단발 — resume 없음)는 호출 시점" 으로 분리 | (review-fix) |
| INFO 3 (testing) | tool-loop 2번째 chat 호출 llmContext 간접 커버 | `ai-turn-executor.spec` 2-call 테스트에 `calls[1][2]` 가 row PK·workflowId·executionId 담는지 직접 단언 추가 | (review-fix) |
| INFO 12 (documentation) + consistency plan_coherence WARNING | follow-up 4건이 로컬 backup 브랜치만 참조 | `resume-llm-usage-attribution.md` "잔여 follow-up" 에 대상 파일:line + 정정 문구 + backup SHA(`7a270a923`) 인라인 | (review-fix) |
| consistency rationale_continuity WARNING | `4-execution-engine §7.4`/`1-ai-agent §7.4` 재구성 3분류 문구 미반영 | follow-up 목록에 편입(별도 project-planner 트랙, 비차단) | (plan) |
| INFO 1,2,4,6,7,8,9,10,13 | security/requirement/testing/side_effect/maintainability/scope | 기존 관례·의도된 동작·과도기 in-flight·선택적 후속 리팩터 — 조치 불요/defer (SUMMARY 처분표) | — |

## TEST 결과
- lint: 통과 (`_test_logs/lint-20260710-020435.log`)
- unit: 통과 (`unit-20260710-020510.log`; ai-turn-executor 31 tests 신규 assertion 포함)
- build: 통과 (rebase 후 `build-20260710-014358.log`)
- e2e: 통과 (rebase 후 247 tests, `e2e-20260710-014628.log`). review-fix 는 런타임 코드 무변경(spec/test/plan)이라 e2e 결과 불변 → 재수행 불요.

## 보류·후속 항목
- **stale-base rebase**: 최초 /ai-review 가 브랜치 3-commit stale + #877 중복 구현(Critical)을 발견 → `git rebase`(reset onto origin/main + genuine 증분 재적용)로 해소. 현재 브랜치는 origin/main(#877) + `c2bad9112`(genuine) + review-fix. #876/#877 보존 확인, backup 브랜치 `backup-pre-rebase-elastic-shannon` 보관.
- **인접 문서 spec 정정 4건**: 별도 project-planner 트랙 (plan follow-up 인라인, 본 PR 범위 밖).
