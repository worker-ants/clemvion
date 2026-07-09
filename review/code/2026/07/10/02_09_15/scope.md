# 변경 범위(Scope) 리뷰

대상: 멀티턴 resume 턴 `llm_usage_log` attribution 수정 (Information Extractor `node_execution_id` 오적재 + AI Agent resume 메인 chat `LlmCallContext` 미배선) — 28개 파일. 본 세션(02_09_15)은 이전 리뷰 라운드(01_46_28, `/ai-review` + `/consistency-check`)의 산출물과 그 review-fix 커밋까지 포함된 전체 diff 를 대상으로 한다.

## 발견사항

- **[INFO]** diff 28개 파일 중 17개가 `review/code/2026/07/10/01_46_28/**` + `review/consistency/2026/07/10/01_46_28/**` 하위의 이전 리뷰/일관성 검토 라운드 산출물(SUMMARY.md·RESOLUTION.md·meta.json·_retry_state.json·개별 reviewer/checker `.md`)이다.
  - 위치: `review/code/2026/07/10/01_46_28/*`(11개), `review/consistency/2026/07/10/01_46_28/*`(8개)
  - 상세: CLAUDE.md 폴더 구조표가 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`·`review/consistency/...`를 코드 리뷰·일관성 검토 산출물의 정식 저장 위치로 명시하고, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"라고 규정한다. 즉 이 파일들은 요청 밖의 부수 변경이 아니라 프로젝트가 강제하는 워크플로 단계(developer SKILL §REVIEW WORKFLOW)의 산출물이며, 같은 PR 에 함께 커밋되는 것이 확립된 관례다(과거 plan 히스토리의 "review-fix 커밋 배치" 패턴과 일치). 실질 로직 변경(코드 소스 6개 파일)에 비해 diff 표면적을 크게 부풀리지만 범위 위반은 아니다.
  - 제안: 조치 불필요 — 참고용 표기. 다만 리뷰어가 diff 파일 수(28)만 보고 "코드 변경이 광범위하다"고 오인하지 않도록 유의.

- **[INFO]** `spec/data-flow/7-llm-usage.md` 의 §1.3 표·§4 외부 의존 표·Rationale 재작성 분량이 실제 코드 diff(소비 사이트 2곳) 대비 상대적으로 크다.
  - 위치: `spec/data-flow/7-llm-usage.md` (표 3곳 + Rationale "`llm_usage_log` 의 nullable context 컬럼들" 문단 전체 재작성)
  - 상세: "AI 노드 attribution 이 전부 NULL"이라는 기존 서술이 이번 코드 수정으로 사실과 어긋나게 됐기 때문에, 동일한 "현재 무엇이 채워지는가"라는 사실을 서술하는 여러 위치(캐탈로그 표·콜아웃·외부 의존 표·Rationale)를 함께 정정해야 했던 것으로, 새 정책·새 개념 도입이 아니라 기존 서술의 사실 동기화다. `plan/in-progress/resume-llm-usage-attribution.md` 가 "잔여 follow-up 4건은 별도 project-planner 트랙, 본 PR 범위 밖"이라고 명시적으로 선을 그어 두어, 이 정정이 인접 미해결 문서 갭(6-knowledge-base.md/13-agent-memory.md 의 stale "모든 LLM 호출 적재" 문구 등)까지 확장 흡수하지 않았음도 plan 문서 자체가 스스로 경계 짓고 있다.
  - 제안: 조치 불필요.

- **[INFO]** `ai-turn-executor.ts` 의 `chat(a, b)` → `chat(a, b, llmContext)` 변경으로 두 호출 사이트가 단일행에서 멀티라인으로 재포맷됐다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (diff 라인 ~2591-2603, ~2743-2757)
  - 상세: 인자가 2개에서 3개로 늘어나며 prettier/formatter 규칙상 필연적으로 줄바꿈이 재구성된 것으로, 로직 변경에 종속된 필연적 포맷팅이지 별도 스타일 정리(예: 관련 없는 다른 호출부의 재포맷)는 아니다. 인접 코드 전체를 훑어도 이 두 호출부 밖에서는 포맷팅 변경이 없다.
  - 제안: 조치 불필요.

## 요약

핵심 로직 변경은 정확히 "Information Extractor resume 턴의 `node_execution_id` 오적재 교정"과 "AI Agent resume 메인 chat 2곳에 `LlmCallContext` 배선"이라는 단일 버그 수정 의도에 국한된다 — `information-extractor.handler.ts`(`MultiTurnState` 필드 2개 추가 + `hydrateState` 역직렬화 + resume `llmContext` 소비 교정)와 `ai-turn-executor.ts`(신규 `llmContext` const + 두 `chat()` 호출부 3번째 인자 전달)로 국소화되어 있고, `execution-engine.service.ts` 는 로직 변경 없이 관련 주석 2줄만 추가한다. 두 스펙 파일(spec 파일)의 프로즈 정정과 CHANGELOG·plan 문서는 이 코드 수정이 실제로 바꾼 "attribution 채움 현황"을 동기화하는 것으로 코드 변경 범위를 벗어나지 않으며, plan 문서가 인접 미해결 spec 갭 4건을 "본 PR 범위 밖" 별도 트랙으로 명시적으로 분리해 둔 점도 범위 관리가 잘 되어 있음을 보여준다. diff 28개 파일 중 17개는 이전 `/ai-review` + `/consistency-check` 라운드의 산출물(review/code/**, review/consistency/**)로, CLAUDE.md 가 규정한 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 워크플로 산출물이며 요청 밖의 부수 변경이 아니다. 요청되지 않은 기능 추가, 관련 없는 리팩토링, 무관한 파일/설정 수정, 불필요한 임포트 정리, 의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

NONE
