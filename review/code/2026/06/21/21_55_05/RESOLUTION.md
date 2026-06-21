# Resolution — ai-review 2026/06/21 21_55_05 (M-1 2단계 수렴 확인)

직전 21_43_55 의 testing WARNING #1·#2·#3 fix(테스트 3건 추가)를 커버하는 fresh review.
결과: **Critical 0 / Warning 1 / 위험도 LOW**.

## 수렴 판정 — developer-actionable WARNING 0

- testing reviewer 가 직전 WARNING #1·#2·#3 **모두 해소 확인**(위험도 NONE).
- 잔존 **WARNING #1 (SPEC-DRIFT)** = `1-ai-agent.md` frontmatter `code:` 에
  `ai-memory-manager.ts` 미등재. 리뷰어가 명시적으로 **"developer 해소 불가(spec 쓰기
  권한 없음)"** + **"M-1 전체 완료 후 planner 일괄 처리"** + **"비차단 잔존"** 으로 분류.
  → **developer 가 이 PR 에서 해소 불가능한 planner-only 사안**이며, #665(M-1 1단계)도
  `ai-condition-evaluator.ts` 미등재로 동일하게 착지한 **확립된 비차단 패턴**.
  plan "보류 중 별건(M-1 SPEC-DRIFT 누적)" 에 추적 중.
- 따라서 **이 라운드가 developer-scoped 수렴점**이다. 더 이상의 fresh review 는
  test-style INFO 나ит픽(아래)만 반복 surface 하며 차단 사안을 만들지 않는다.

## INFO (비차단 — 미반영 근거)

직전 RESOLUTION 들과 동일 판정. 전부 test 품질 style 나ит픽 또는 verbatim 이동 패턴:
- **#1 (SPEC-DRIFT tailMode/keepUserExchanges/queryText)**: planner 위임(WARNING #1 과 동일).
- **#2 (`_retry_state.json` 절대 경로)**: review/ 산출물 기존 형식. `.gitignore` 위생은 별도 작업.
- **#3 (system_text 긍정 단언)·#4 (toHaveBeenCalledWith vs mock.calls)·#5 (shared mgr
  인스턴스)·#6~#10 (픽스처 캐스팅·파라미터명·JSDoc)**: 테스트 품질 style 개선 제안.
  현재 17 케이스가 매니저의 모든 핵심 분기(전략 해석·회수 graceful/성공·scopeKey 변환·
  요약 모델 디커플·system_text/system-only/messages 모드·watermark)를 고정하고 있어
  **회귀 격리 목적은 달성**. 과도한 픽스처 추상화·중복 단언은 가독성 대비 실익이 낮아
  현행 유지. 중장기 test 리팩터링 후보로만 기록.

## 최종 검증 상태
- lint 0 errors · unit 369 suites/7259 PASS(신규 spec 17/17) · build PASS · e2e 205 PASS
  (production 로직은 3369fcef 이후 무변경 — e904c5c5·960968b4 는 test+주석만).
- ai-review 3회 수렴: 21_26_26(W6) → 21_43_55(W4) → **21_55_05(W1, planner-only SPEC-DRIFT)**.
