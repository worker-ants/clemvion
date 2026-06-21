# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target 영역: `spec/4-nodes/3-ai` (diff-base=origin/main)
실제 변경 핵심: `AiConditionEvaluator` 추출 (refactor 02-architecture M-1 1단계)

---

## 발견사항

- **[INFO]** spec §6.1 step 3a 구현 참조 갱신 누락 (planner 후속 비차단)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a — "구현: `ai-agent.handler.ts` `classifyToolCalls`" 문구
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-1 체크박스 갱신분 — "planner 후속(비차단 SPEC-DRIFT): §6.1 step 3a 구현 참조(`ai-agent.handler.ts classifyToolCalls` → evaluator) 갱신 + `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts` 등재"
  - 상세: `classifyToolCalls` 가 이제 `ai-condition-evaluator.ts` 의 `AiConditionEvaluator` 로 이전됐으나 spec §6.1 step 3a 의 "(구현: `ai-agent.handler.ts` `classifyToolCalls`)" 주석과 frontmatter `code:` 목록에 `ai-condition-evaluator.ts` 가 미등재다. spec 자체는 developer read-only 이므로 즉시 수정 불가 — plan 이 비차단 후속(planner 위임)으로 이미 명시.
  - 제안: 현재 plan 이 이미 "비차단 SPEC-DRIFT" 으로 planner 후속 과제 등재 완료. 추가 조치 불요. 단 planner 가 해당 후속을 수행하기 전까지 spec 과 코드 사이 참조 드리프트가 유지되므로, planner 위임 작업을 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter 갱신 + §6.1 step 3a 주석 갱신으로 scope 명확히 할 것.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` §3 spec 작성 과제와의 관계 명시 불요 (충돌 없음)
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a dispatcher 분류 순서 표
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — "`tool_*` 모델 확정 시 본 plan §3 spec 작성 단계에서 `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 step 3a 의 dispatcher 분류 순서 표 갱신"
  - 상세: `ai-agent-tool-connection-rewrite.md` 는 `tool_*` 모델이 확정될 때 §6.1 step 3a 의 dispatcher 분류 순서 표를 갱신해야 한다고 명시하고 있다. 본 M-1 구현이 `classifyToolCalls` 를 `AiConditionEvaluator` 로 이전했으나 dispatcher 분기 로직 자체(cond/kb/mcp/render/tool 5분류)는 보존됐다. `tool_*` 연결 재설계 결정(TBD 5항목)을 건드리지 않았고, spec §6.1 dispatcher 표의 분기 순서·의미도 변경되지 않았다. 충돌 없음.
  - 제안: 특별 조치 불요. `ai-agent-tool-connection-rewrite.md` 의 §3 spec 단계는 `tool_*` 모델 결정이 선행돼야 하며 본 refactor 는 그 결정을 건드리지 않았다.

---

## 요약

`refactor-m1-condition-evaluator` 의 M-1 1단계(`AiConditionEvaluator` 추출)는 `plan/in-progress/refactor/02-architecture.md` M-1 의 Option A 권장 방향과 정확히 일치하며, 미해결 결정(TBD)을 우회하거나 선행 plan 의 미해소 조건을 가정하지 않는다. `ai-agent-tool-connection-rewrite.md` 의 5개 TBD 결정(도구 등록 모델·시그니처 위치·실행 컨텍스트·라우팅·ND-AG-21)은 본 구현과 직교하며, `processMultiTurnMessage` polymorphic 시그니처(`exec-park-durable-resume.md` 의존)도 핸들러에 잔류해 계약이 보존됐다. 유일한 비차단 후속은 plan 자체가 이미 "planner 후속(비차단 SPEC-DRIFT)" 으로 명시한 `1-ai-agent.md` frontmatter `code:` 등재 및 §6.1 구현 참조 갱신이다. 신규 plan 생성이나 기존 plan 수정이 즉시 필요한 사항은 없다.

## 위험도

NONE
