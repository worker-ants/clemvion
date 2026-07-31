# 유저 가이드 동반 갱신(User Guide Sync) Review

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 총 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(표 20행 + "자주 누락되는 항목" prose)을 SoT 로 적재했다.

## 변경 파일 컨텍스트
`git diff --name-only origin/main...HEAD` 로 실측한 전체 변경 set (prompt 의 5개 파일과 일치):

- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/tests/test_consistency_bundle_priority.py`
- `.claude/tests/test_consistency_context_budget.py`
- `plan/in-progress/harness-consistency-summary-downgrade-rule.md`

## 매칭 분석
매트릭스 20행의 trigger(glob 15행 + semantic 5행) 를 위 5개 변경 파일에 전수 대조했다.

- Glob trigger 전부 불일치: 변경 파일 중 `codebase/**` 또는 `spec/**` 하위는 **0건**이다. `codebase/backend/src/nodes/**`(new-node/node-schema-change), `codebase/frontend/src/**/*.tsx`(new-ui-string), `codebase/channel-web-chat/src/**/*.tsx`(new-widget-chrome-string), `codebase/frontend/src/content/docs/*/`(new-userguide-section-dir), `codebase/backend/src/**/*.controller.ts` / `dto/**`(backend-api-change), `codebase/backend/src/modules/system-status/system-status.constants.ts`(new-bullmq-queue), `codebase/backend/src/nodes/core/error-codes.ts`(new-error-code), `spec/{2,3,4,5}-*/**` + `spec/conventions/**`(spec-major-change) — 어느 glob 도 위 5개 경로에 매치되지 않는다.
- Semantic trigger 전부 의미상 불일치: 인증·권한·세션 흐름 변경(`codebase/backend/src/modules/auth/**` 대상), 표현식 언어 변경(`codebase/packages/expression-engine/**` 대상), 통합/제공자 변경, 신규 warningCode/errorCode 발행, cross-cutting enum, backend zod ui.label 신규 값, handler output field, AuthConfig enum, 실행·디버깅 흐름 변경(제품의 실행 엔진/디버그 로깅), 환경 변수·런타임 변경, user-guide GUI 흐름 절, spec 결함 — 이 중 어느 것도 실제 변경 내용과 대응하지 않는다.

변경 내용 자체는 다음 두 결함의 수정이다: (1) `code_review_orchestrator.py` 의 `build_files_section` — whole-file 예산이 소진됐을 때 특정 파일이 헤더만 있고 본문이 완전히 누락되는데도 아무 표시가 없던 결함(`_omitted_content_note` 신설로 수정), (2) `consistency_orchestrator.py` 의 `prioritize_bundle_files` — 번들 정렬이 알파벳순이라 브랜치가 실제로 변경한 spec 파일이 예산 밖으로 밀려나던 결함(tier 기반 재정렬로 수정). 둘 다 **AI 리뷰/일관성 검토 harness 자체의 내부 프롬프트 조립 로직**이며, 대상은 `.claude/` 아래의 sub-agent 오케스트레이션 스크립트·그 테스트·진행 상황 plan 문서다. `codebase/`(제품 코드)·`spec/`(제품 명세) 그 어디도 건드리지 않았으므로 최종 사용자가 보는 노드·문서·i18n·에러 라벨·인증 흐름·표현식 언어에 어떤 영향도 없다.

## 발견사항
없음 — 매트릭스 20개 trigger(glob 15 + semantic 5) 중 매칭되는 항목이 0건이다.

## 요약
리뷰 대상 5개 파일은 전부 `.claude/`(code-review-agents·consistency-checker 오케스트레이터 스크립트 + 테스트) 와 `plan/in-progress/`(harness 결함 추적 plan) 에 위치하며, `codebase/**`·`spec/**` 변경이 전무하다. `doc-sync-matrix.json` 의 20개 trigger(glob 매칭 15행 + semantic 판단 5행) 를 전수 대조한 결과 매칭 0건, 따라서 동반 갱신 누락 0건이다. 유저 가이드 동반 갱신(User Guide Sync) 리뷰 관점에서는 본 변경이 완전히 "해당 없음" 영역이다.

## 위험도
NONE
