---
title: information_extractor persistent 메모리 (recall+extract, multi-turn thread push) — memoryStrategy 확장 v2
status: complete
worktree: memory-strategy-extend-ad5987
branch: claude/memory-strategy-extend-ad5987
started: 2026-06-05
owner: developer
spec_impact:
  - spec/4-nodes/3-ai/3-information-extractor.md
  - spec/4-nodes/3-ai/0-common.md
  - spec/conventions/conversation-thread.md
  - spec/5-system/17-agent-memory.md
spec:
  - spec/4-nodes/3-ai/3-information-extractor.md
  - spec/4-nodes/3-ai/0-common.md
  - spec/conventions/conversation-thread.md
  - spec/5-system/17-agent-memory.md
code:
  - codebase/backend/src/nodes/ai/information-extractor/**
---

# information_extractor persistent 메모리 (memoryStrategy 확장 v2)

A2 후속(followup-v2 "memoryStrategy 두 노드 확장 v2"). 설계 분석 결과 **information_extractor 한정**
persistent(recall+extract) 만 확장한다 (text_classifier=single-turn 부적합 제외, summary_buffer=N/A 제외).
사용자 결정: "IE 추출+회수 풀" (multi-turn thread push 선구현 포함).

## 설계 결정
- IE `memoryStrategy: manual | persistent` (ai_agent 의 summary_buffer 는 제외 — 추출 노드에 working-memory 압축 부적합). manual=기존 동작.
- **persistent recall**: 추출 LLM 콜 전 `AgentMemoryService.recall()` 로 이전 세션 사실 회수→안정 프리픽스 주입. scope `memoryKey ?? execution_id`. single+multi-turn 공통.
- **persistent extraction**: 턴(들) 후 `scheduleExtraction()` 로 추출. multi-turn watermark(`lastExtractionTurnSeq` in MultiTurnState) 증분. single-turn 결과 추출.
- **multi-turn thread push 선구현**: `buildMultiTurnFinalOutput` 종결 경로에서 thread push (현 v2 limitation 해소) — 추출 source + 가시성.
- recall/extract 는 `AgentMemoryService` 직접 호출(ai_agent 패턴 모방). ai_agent 의 injectMemoryContext 전체 추출 안 함(과결합).

## Phase
- A spec: 3-information-extractor(persistent 절+config), 0-common §10(memoryStrategy=ai_agent+IE), conversation-thread §2.3/§5, 17-agent-memory(IE producer/consumer), Rationale(IE persistent O, summary_buffer X, text_classifier 제외).
- B backend: IE schema 필드, recall 주입, extraction 스케줄(watermark), multi-turn push, 테스트(멀티턴 state 정확성·격리·회귀0).
- C frontend: i18n(ai_agent 라벨 재사용), node config, 유저 가이드.
- D review+consistency+gates+PR.
