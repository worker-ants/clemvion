# Cross-Spec 일관성 검토 결과

대상: `spec/4-nodes/3-ai/` (impl-done, diff-base `origin/main`)
실제 diff 범위: `spec/4-nodes/3-ai/1-ai-agent.md` (§11 도구 payload 예산 경고 문구 정정 + 신규 §12.16 "LLM chat 호출 app-level 타임아웃"), 연계 파일 `spec/conventions/node-cancellation.md`(§표 갱신) · `spec/conventions/cross-node-warning-rules.md`(status→implemented, 표 문구 정정). `spec/5-system/15-chat-channel.md`/`spec/conventions/chat-channel-adapter.md` 변경은 본 target 스코프(AI 노드) 밖의 별개 diff라 리뷰 대상에서 제외.

코드 검증(HEAD 워킹트리 절대경로 기준): §12.16·§11 갱신 문구가 가리키는 `llm-call-timeout.ts` / `tool-payload-save-warning.ts` / `WorkflowsService.getGraphWarnings` / `AiTurnOrchestrator.classifyLlmError` / `LlmService.chat opts.timeoutMs` 모두 실재하며 spec 서술과 일치함을 확인. `text-classifier`/`information-extractor` 핸들러는 `timeoutMs` 를 전달하지 않아 "ai_agent 전용 스코프" 주장과도 부합.

## 발견사항

- **[WARNING]** 신규 §12.16 의 `LLM_TIMEOUT` 귀속 주장이 `spec/5-system/3-error-handling.md` §2.2 예시와 정면 충돌
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 (라인 1359) — "`codebase/backend/src/nodes/core/error-codes.ts` 의 별도 코드 `LLM_TIMEOUT` 은 **Workflow AI Assistant 전용** taxonomy 로 ai_agent 노드 실행 경로는 사용하지 않는다."
  - 충돌 대상: `spec/5-system/3-error-handling.md` §2.2 "실행 에러 형식" 예시(라인 233-248) — `{"code": "LLM_TIMEOUT", "nodeId": "...", "nodeName": "AI Agent", "nodeType": "ai_agent", ...}`. 같은 문서 §1.4(라인 108-115)도 `LLM_TIMEOUT` 을 "LLM" 카테고리의 일반 노드-레벨 `output.error.code` 로 스코프 제한 없이 등재.
  - 상세: 신규 §12.16 은 "`ai_agent` 노드는 `LLM_TIMEOUT` 을 절대 발행하지 않는다"고 명시적으로 단언하는데, `error-handling.md` §2.2 는 바로 그 조합(`nodeType: "ai_agent"`, `nodeName: "AI Agent"`, `code: "LLM_TIMEOUT"`)을 대표 예시로 제시한다. `1-ai-agent.md` §10 "에러 코드" 표(라인 1113-1127, 본 diff 로 미변경 — 기존 SoT)도 `LLM_TIMEOUT` 을 포함하지 않고 `LLM_CALL_FAILED`/`LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID` 만 나열한다. 코드 검증(`grep -rln LLM_TIMEOUT codebase/backend/src`) 결과 `ai_agent`/`text_classifier`/`information_extractor` 핸들러 어디서도 `LLM_TIMEOUT` 을 throw 하지 않으며, `Workflow AI Assistant`(`workflow-assistant` 모듈) 코드에도 실제로는 미구현(spec 상 계획만 존재) — 즉 이 코드는 현재 어디서도 발행되지 않는 사실상 미사용 enum 값인데, 두 문서가 서로 다른(그리고 상호 배제하는) "귀속 주체" 주장을 하는 상태. §12.16 신설로 이 모순이 이전보다 더 명시적으로 드러남.
  - 제안: `error-handling.md` §2.2 예시의 `nodeType`/`nodeName`/`code` 조합을 실제 관측 가능한 코드(`LLM_CALL_FAILED` 등)로 교체하거나, `LLM_TIMEOUT` 이 왜 예시에 등장하는지(순수 예시용 placeholder임을 명시) 각주를 추가. 동시에 §1.4 의 "LLM" 카테고리 표에 `LLM_TIMEOUT` 이 어느 노드/기능(Workflow AI Assistant, 미구현 상태 포함)에 스코프되는지 명시해 `1-ai-agent.md §12.16`·`§10`·`3-workflow-editor/4-ai-assistant.md §7` 와 정합시킬 것.

- **[INFO]** `LLM_TIMEOUT` 이 `Workflow AI Assistant` 스펙(§7)에도 아직 미구현 상태
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 disambiguation 문구
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §7 (라인 618-629) `LLM_TIMEOUT` 행 — "120초 타임아웃"
  - 상세: §12.16 은 `LLM_TIMEOUT` 의 귀속을 "Workflow AI Assistant 전용"이라고 단정하지만, 코드 검증 결과 `workflow-assistant` 모듈에도 `LLM_TIMEOUT` 을 실제로 throw 하는 경로가 없다(모듈 내 grep 무결과 — 관측된 실패 코드는 `ASSISTANT_STREAM_FAILED` 뿐). 즉 "Workflow AI Assistant 전용"이라는 귀속 자체가 두 스펙 모두에서 아직 미구현(Planned) 상태를 가리키는 것으로, 독자가 §12.16 만 보면 이미 그쪽에서 쓰이고 있다고 오인할 소지가 있다.
  - 제안: §12.16 문구에 "(Workflow AI Assistant 측도 현재 미구현·Planned)" 정도의 주석을 추가하거나, 두 위치의 구현 현황 표기를 동기화.

## 요약

이번 diff 는 `spec/4-nodes/3-ai/1-ai-agent.md` 에 `AI_AGENT_LLM_CALL_TIMEOUT_MS` 기반 app-level LLM 타임아웃(§12.16)과 tool-payload 예산 저장 경고(§11)의 구현완료 상태 반영을 추가한 것으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 축에서는 코드(HEAD 워킹트리)와 정확히 정합하고 `node-cancellation.md`/`cross-node-warning-rules.md` 등 연계 문서도 함께 갱신되어 있다. 다만 신규 §12.16 의 `LLM_CALL_FAILED` vs `LLM_TIMEOUT` disambiguation 서술이 `spec/5-system/3-error-handling.md` §2.2 의 기존 예시(`ai_agent`/`LLM_TIMEOUT` 조합)와 정면으로 모순되며, 이는 사전에 존재하던 문서 drift가 이번 diff 로 더 뚜렷하게 노출된 경우다. 그 외 데이터 모델(Integration `service_type`)·계층 분리(`LlmService.chat opts.timeoutMs` 가 ai_agent 전용으로만 wiring)·경고 규칙 카탈로그(`cross-node-warning-rules.md §8`) 등은 모두 일관됨을 확인했다.

## 위험도

LOW
