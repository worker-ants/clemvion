### 발견사항

- **[WARNING]** `web-chat-preview-improvements.md` 의 "AI render_* 와 동일 envelope 계약" 주장과 target 의 root cause 상충
  - target 위치: `plan/in-progress/web-chat-ai-presentation-render.md` §Root cause — "AI `render_*` 도구(`ai_message.presentations[]`): `PresentationPayload { type, toolCallId, renderedAt, payload }` — 데이터가 `.payload` 에 중첩"
  - 관련 plan: `plan/in-progress/web-chat-preview-improvements.md` §핵심 단순화 (L44-53) — "위젯 presentation 렌더러는 모두 **flat `{ config, output }` envelope** 를 읽는다 … (AI render_* 의 ai_message.presentations 와 동일 envelope 계약.)"
  - 상세: `web-chat-preview-improvements.md` 는 AI render_* 의 ai_message.presentations 가 `{ config, output }` flat envelope 와 "동일 계약"이라고 주장했다. 그러나 이는 사실 오류다. `plan/complete/ai-presentation-tools.md` §2 항목 14 는 `PresentationPayload` 를 `{ type, payload, toolCallId, renderedAt, ... }` 로 명확히 정의했으며(PR #271 완료), spec `4-nodes/3-ai/1-ai-agent.md §7.10` 에도 단일 진실로 확정되어 있다. `web-chat-preview-improvements` 는 `presentation.ts` 를 수정하지 않았으므로 코드 상 결정을 내린 것은 아니지만, in-progress 상태인 이 plan 문서의 해당 주장이 target 과 충돌한다. target 의 root cause 분석이 코드·spec 모두와 일치한다.
  - 제안: `web-chat-preview-improvements.md` §핵심 단순화 의 "(AI render_* 의 ai_message.presentations 와 동일 envelope 계약.)" 문구를 "(AI render_* 의 ai_message.presentations 는 `PresentationPayload` 로 별도 shape — 이번 PR 의 `execution.message` 는 flat `{config,output}` 계약)" 으로 정정. 또는 해당 plan 이 이미 PR #703 으로 머지됐으므로 plan 을 `complete/` 로 이동 처리하면 해당 in-progress 충돌이 자동 해소된다.

- **[INFO]** `web-chat-preview-improvements.md` 가 PR #703 으로 머지됐으나 plan 이 `in-progress/` 에 잔류
  - target 위치: `plan/in-progress/web-chat-ai-presentation-render.md` frontmatter `related_plans: plan/complete/web-chat-preview-improvements.md`
  - 관련 plan: `plan/in-progress/web-chat-preview-improvements.md` — status: in-progress (PR #703 `9648d485` 2026-06-25 머지)
  - 상세: target 의 `related_plans` 가 `plan/complete/web-chat-preview-improvements.md` 를 가리키지만 실제로는 `plan/in-progress/web-chat-preview-improvements.md` 로 존재한다. plan-lifecycle 규칙 상 PR 머지 후 `complete/` 이동이 필요하나 미이동 상태다. plan-lifecycle 규칙 위반이며, target 의 `related_plans` 경로도 현재 존재하지 않는다.
  - 제안: `web-chat-preview-improvements.md` 를 `plan/complete/` 로 이동(git mv). target 의 `related_plans` 경로는 이미 `plan/complete/...` 를 가리키므로 이동 후 일치한다. developer 가 처리 가능.

- **[INFO]** `fix-webchat-sse-field-map.md` 의 `eia-types.ts` 변경과 target 의 파일 수정 접점 — 충돌 없음 확인
  - target 위치: `plan/in-progress/web-chat-ai-presentation-render.md` §수정 — `presentation.ts` 단독 수정, `eia-types.ts` 미수정
  - 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md` — `eia-types.ts` WaitingForInputEvent/AiMessageEvent wire shape 교정 완료
  - 상세: `fix-webchat-sse-field-map.md` 는 `eia-types.ts` 를 이미 수정·완료했고(모든 체크박스 완료), target 은 `presentation.ts` 만 수정한다. 파일 접점 없음. 단 `fix-webchat-sse-field-map.md` 가 `in-progress` 에 잔류 중(plan complete 이동 미완, "비차단 followup 잔여") — 이는 target 과 독립.
  - 제안: 별도 조치 불요. 단 `fix-webchat-sse-field-map.md` 의 `plan complete 이동` 체크박스가 여전히 미완이므로 해당 plan 담당자가 follow-up 필요.

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미결정 도구 등록 모델 — target 과 직교
  - target 위치: `plan/in-progress/web-chat-ai-presentation-render.md` — `render_*` 도구의 위젯 렌더 버그 수정
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 — 도구 등록 모델(a/b/c) TBD
  - 상세: `ai-agent-tool-connection-rewrite.md` 는 `tool_*` 일반 도구 연결 모델을 미결정 상태로 두고 있다. target 의 `render_*` 수정은 이미 확정된 `PresentationPayload` shape 의 위젯 렌더 버그 수정이며, tool 등록 모델 결정과 독립(prefix 다름). 충돌 없음.
  - 제안: 별도 조치 불요.

### 요약

target `web-chat-ai-presentation-render.md` 는 이미 완료된 `ai-presentation-tools` plan(PR #271)의 `PresentationPayload` 계약을 기반으로 위젯의 렌더 누락 버그를 수정하는 올바른 접근이다. 미해결 결정을 우회하거나 선행 조건을 무시하는 CRITICAL 항목은 없다. 다만 `web-chat-preview-improvements.md`(in-progress, PR #703 이미 머지)가 "AI render_* 와 동일 envelope 계약"이라는 사실 오류를 포함하며 이것이 target 의 root cause 서술과 충돌한다(WARNING). 해당 plan 의 `complete/` 이동 처리 및 문구 정정이 권장된다. target 자체의 수정 방향(asEnvelope 헬퍼 + classifyPresentation PresentationPayload 경로)은 spec 및 기존 plan 과 완전히 정합한다.

### 위험도

LOW
