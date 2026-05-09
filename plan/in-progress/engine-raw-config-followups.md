# Engine Raw Config Exposure — Follow-ups

`plan/complete/engine-raw-config-exposure.md` 의 7단계 phase 가 모두 종료된 후에도 회귀 위험을 분리해 별도로 진행하는 후속 작업 모음.

## 배경

본 PR (raw config exposure) 의 25개 핸들러 마이그레이션 (Phase 3) 에서 다음 두 항목은 회귀 위험·범위 한정성 때문에 follow-up 으로 분리됐다.

## Follow-up 1 — AI Agent multi-turn helper rawConfig plumbing

**현황** (2026-05-09 재확인):
- `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 의 `buildMultiTurnFinalOutput` (L1265) / `buildConditionOutput` (L1320) 가 `config: { mode, model }` 만 echo. 다른 echo 지점 (line 735 single-turn / line 855 initial waiting / line 1188 resumed) 은 이미 `state.rawConfig` 또는 `context.rawConfig` 에서 systemPrompt / userPrompt / maxTurns / conditions / knowledgeBases 등 raw 전체 echo. **호출자 사이트 4 곳** (`buildMultiTurnFinalOutput` 2 + `buildConditionOutput` 2).
- `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:813` 부근의 `multiTurnConfigEcho` 가 `state.{model, outputSchema, instructions, examples, maxTurns, maxCollectionRetries}` 를 echo — state 안의 평가된 필드 사용. raw 가 아님.

**왜 follow-up 인가**:
- helper 시그니처에 `rawConfig` plumbing 시 multi-turn waiting → resumed → ended 의 nodeOutputCache 라이프사이클이 어느 시점의 echo 를 expose 하는지 분석 필요.
- 첫 turn waiting 의 outputData 가 raw 를 echo 하더라도 ended turn 이 cache 를 덮어쓰면 후속 노드의 `$node["AI_Agent"].config.systemPrompt` 가 수명 동안 raw 인지 evaluated 인지 시점별로 달라질 수 있다. 회귀 영향 분석 + 테스트 보강 필요.

**작업 범위**:
1. `state.rawConfig` 의 라이프사이클 정리 (engine 의 multi-turn cache flush 시점 spec 점검).
2. `buildMultiTurnFinalOutput` / `buildConditionOutput` / `multiTurnConfigEcho` 시그니처에 raw 인자 추가 + 호출자 4~6 곳 수정.
3. multi-turn ended 시점의 outputData echo 를 raw 로 통일.
4. 단위 테스트 + ai-agent / information-extractor handler.spec 보강.
5. spec/4-nodes/3-ai/1-ai-agent.md 와 3-information-extractor.md 의 config 예시에 raw 패턴 명시.

**완료 기준**: 4 개 echo 지점 (single-turn + multi-turn initial + multi-turn ended + condition-trigger) 모두 raw 전체 echo, backend lint·unit·build green, ai-review 1회.

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
