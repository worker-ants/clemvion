# Engine Raw Config Exposure — Follow-ups

`plan/complete/engine-raw-config-exposure.md` 의 7단계 phase 가 모두 종료된 후에도 회귀 위험을 분리해 별도로 진행하는 후속 작업 모음.

## 배경

본 PR (raw config exposure) 의 25개 핸들러 마이그레이션 (Phase 3) 에서 다음 두 항목은 회귀 위험·범위 한정성 때문에 follow-up 으로 분리됐다.

## Follow-up 1 — AI Agent multi-turn helper rawConfig plumbing — ✅ 완료 (2026-05-09)

**현황** (2026-05-09 재확인 → 조치 완료):
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 의 `buildMultiTurnFinalOutput` / `buildConditionOutput` 에 `rawConfig?: Record<string, unknown>` 파라미터 추가, 새 private helper `buildMultiTurnConfigEcho` 가 mode/model 외 systemPrompt·userPrompt·maxTurns·maxToolCalls·responseFormat·knowledgeBases·conditions 를 raw 그대로 echo. 호출자 4 곳 (line 595/1034 buildConditionOutput, line 1159 buildMultiTurnFinalOutput, line 1246 endMultiTurnConversation) 모두 `context.rawConfig` 또는 `state.rawConfig` 를 전달.
- `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` 의 `MultiTurnState` 에 `rawConfig?` 필드 추가, `executeMultiTurn` 의 stateBase 에 `context.rawConfig ?? config` 저장, `hydrateState` 가 raw.rawConfig 를 hydrate. `multiTurnConfigEcho` 가 raw 의 model·outputSchema·instructions·examples·inputField·maxTurns·maxCollectionRetries 를 우선 echo (state 평가값은 fallback).
- 엔진 `execution-engine.service.ts:1838` 가 첫 waiting tick 에 node.config 를 frozen snapshot 으로 resumeState 에 자동 merge — 라이프사이클상 multi-turn waiting → resumed → ended 모두 동일한 raw snapshot 을 본다 (handler 가 명시 설정한 rawConfig 가 있으면 존중).

**테스트 보강**:
- `ai-agent.handler.spec.ts` — `buildMultiTurnFinalOutput` 에 raw echo 통과 + fallback 케이스 2 건, condition-triggered execute() 의 `output.config` 가 `context.rawConfig` 의 systemPrompt/conditions 를 echo 하는지 검증 1 건.
- `information-extractor.handler.spec.ts` — `buildMultiTurnFinalOutput` 의 raw echo (template 보존) + 평가값 fallback 케이스 2 건.
- TEST WORKFLOW: backend lint clean, 2908 unit tests green, build green.

**Spec 갱신**:
- `spec/4-nodes/3-ai/1-ai-agent.md` §7 머리 — Principle 7 raw echo 정책 명시.
- `spec/4-nodes/3-ai/3-information-extractor.md` §5 머리 — single/multi-turn waiting/ended 모두 raw echo 명시.

## Follow-up 2 — Carousel / Table output 256KB cap

**현황** (2026-05-09 재확인):
- `backend/src/nodes/integration/_base/truncate-body.util.ts:38` 의 `truncateBodyForOutput(value, maxBytes = 256 * 1024)` 헬퍼가 Send Email (`send-email.handler.ts:106`) · HTTP Request (`http-request.handler.ts:160`) 에 적용됨 (Phase 2). 그 외 호출처 없음.
- Carousel / Table 핸들러는 cap 미적용 — 거대한 items / rows 가 그대로 echo 될 수 있다 (확인됨).

**왜 follow-up 인가**:
- 현재 cap 미적용 상태에서도 동작 영향 없음 (NodeExecution.outputData JSONB 크기 한계 도달 전엔 무해).
- 256KB cap 정책 자체가 Send Email · HTTP Request 의 wire-body 보호 목적으로 설계됨 — Presentation 노드에 그대로 적용할지는 별도 정책 결정 필요 (cap 시 사용자 경험 — items 가 잘리는 게 적절한가? bodyTruncated 표시는 Presentation UI 의 어디에?).

**작업 범위**:
1. Carousel / Table 의 output cap 정책 결정 (256KB 동일? 더 큰 한계? 안 적용?).
2. 결정 시 `truncateBodyForOutput` 재사용해 적용 + UI 안내 (bodyTruncated 또는 items count vs rendered count 차이 표기).
3. spec/4-nodes/6-presentation/* 갱신.

**완료 기준**: cap 정책 결정 → 적용 (또는 명시적 미적용 spec 한 줄), 회귀 0.

## 우선순위

| Follow-up | 우선순위 | 추정 |
| --- | --- | --- |
| #1 AI Agent helper plumbing | 중 — 일관성 향상, 회귀 위험 중 | 별도 PR 1건 |
| #2 Carousel/Table cap | 저 — 정책 결정 선행 | 별도 PR 1건 또는 spec-only 결정 |
