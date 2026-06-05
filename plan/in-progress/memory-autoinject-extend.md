---
title: contextScope 자동주입 text_classifier·information_extractor 확장 (A2)
status: in-progress
worktree: memory-autoinject-extend-e102af
branch: claude/memory-autoinject-extend-e102af
started: 2026-06-05
owner: planner/developer
spec:
  - spec/4-nodes/3-ai/0-common.md
  - spec/conventions/conversation-thread.md
  - spec/4-nodes/3-ai/2-text-classifier.md
  - spec/4-nodes/3-ai/3-information-extractor.md
code:
  - codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts
  - codebase/backend/src/nodes/ai/shared/conversation-context-schema.ts
  - codebase/backend/src/nodes/ai/text-classifier/**
  - codebase/backend/src/nodes/ai/information-extractor/**
  - codebase/backend/src/nodes/ai/ai-agent/**
---

# contextScope 자동주입 두 노드 확장 (A2)

`ConversationThread` 의 manual 자동주입(`contextScope` 기반 thread inject)을
`ai_agent` 한정에서 **`ai_agent` + `text_classifier` + `information_extractor`
세 노드**로 확장한다.

## 범위 경계 (엄수)

- 이번엔 **manual inject (`contextScope` 기반 thread 주입) 만** 두 노드로 확장.
- `memoryStrategy`(summary_buffer/persistent) 자동메모리 주입은 **ai_agent 전용
  으로 유지**(v2 로드맵 — 건드리지 않는다).
- push(turn 출하)는 이미 세 노드 공통이라 변경 없음.

## 왜 contextScope 만 확장하고 memoryStrategy 는 유지하나

`contextScope` 는 **stateless thread 주입** — 매 실행 시 thread snapshot 을 읽어
LLM 입력에 prepend/append 하는 순수 변환이라 노드 타입과 무관하다.
`memoryStrategy`(summary_buffer/persistent)는 **상태누적 메모리** — 롤링 요약
압축·cross-session 회수·증분 추출이 ai_agent 의 multi-turn 대화 라이프사이클
(turn 별 LLM 호출 전 동기 재적용)과 결합돼 있어 분류·추출 노드의 단발성/수집형
실행 모델과 맞지 않는다. 따라서 stateless 축만 먼저 확장한다.

## Phase A — spec
- `0-common.md §10` + `conversation-thread.md §2.3`: inject 적용 범위를
  ai_agent → 세 노드로 갱신. "현재 contextScope 주입은 ai_agent 한정" 정정.
  `memoryStrategy` inject 는 여전히 ai_agent 한정(v2)임을 명확히 구분.
- text_classifier / information_extractor 노드 spec: contextScope 4필드 동작 추가.

## Phase B — backend
- 공유 유틸 `shared/conversation-context-injection.ts` 추출 (노드무관 thread
  주입 순수 로직). ai_agent 는 그 함수를 호출하도록 리팩토링(동작 100% 불변).
- 공유 schema fragment `shared/conversation-context-schema.ts` —
  `buildConversationContextSchemaFields()`. ai_agent/text_classifier/
  information_extractor 가 공유.
- 두 노드 handler 의 LLM 호출 직전 inject 배선.

## Phase C — 테스트 (TDD)
- 공유 유틸 단위테스트.
- 두 노드 handler thread-inject 테스트(주입 + 미설정 시 불변).
- ai_agent 회귀 GREEN.

## 검증
lint → unit → build → e2e + docs/label 가드.
