---
worktree: (unstarted)
started: 2026-06-20
owner: project-planner
---

# Spec Update Draft — node-cancellation §6 구현 현황 표에 AI 노드 signal 단위 테스트 반영

## 분류
SPEC-DRIFT (구현이 spec 을 앞지름 — 코드 옳음, spec 갱신 누락). 출처: ai-review `review/code/2026/06/20/15_55_44` WARNING#1 (및 15_43_17 INFO).

## 발견
`PR(3 regression 테스트 추가)` 에서 AI 노드 signal 전파 단위 테스트가 신설됐다:
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — **single-turn** 경로의 `context.abortSignal` → `llmService.chat` 전파 검증.
- `codebase/backend/src/nodes/ai/text-classifier/text-classifier.handler.spec.ts` — `context.abortSignal` → `llmService.chat` opts.signal 전파 검증.

그러나 `spec/conventions/node-cancellation.md §6`(구현 현황 표 "AI 노드 signal 전파") 가 이 단위 테스트 커버리지를 반영하지 않는다.

## 제안 변경
`spec/conventions/node-cancellation.md §6` 표에 AI 노드 signal **단위 테스트** 커버리지 행/주석 추가 — 예:

> AI 노드 signal 단위 테스트 — `information-extractor.handler.spec.ts`(single-turn), `text-classifier.handler.spec.ts`. (멀티턴 IE 는 W4 로 기존 검증, AI Agent 는 SUMMARY#16.)

## 비고
- 코드 revert 불필요 (구현 옳음).
- developer 는 `spec/` read-only → 본 draft 로 project-planner 에 handoff. planner 가 `/consistency-check --spec` 통과 후 §6 반영.
- 관련 런타임 가드 spec: `spec/conventions/node-cancellation.md`. plan: [[node-cancellation-infrastructure]] · [[parallel-p2-followups]].
