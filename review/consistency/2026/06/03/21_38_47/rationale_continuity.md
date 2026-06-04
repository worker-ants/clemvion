# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 영역: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md)
검토 기준 Rationale: spec/4-nodes/3-ai/1-ai-agent.md §12, spec/conventions/conversation-thread.md §7·§8, spec/5-system/17-agent-memory.md Rationale

---

## 발견사항

### INFO-1: v1/v2 경계 표현 — 공통 §10 설명과 conversation-thread §2.3 의 현재 상태 사이 미묘한 뉘앙스 차이

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` 첫 단락
  - "v1 은 `ai_agent` 만 push + 자동 주입을 구현하고, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 push hook (final assistant turn) + 자동 주입이 함께 추가된다"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md §2.3`
  - 실제 현황: "세 노드 모두 push 가 출하됐다 (`pushClassifierTurn` / `pushExtractorTurn` 가 `appendAiAssistantMessage` 호출)". push 는 이미 v1 에서 세 노드 모두 출하된 상태.
- **상세**: target 문서 `0-common.md §10` 은 "v1 은 ai_agent 만 push" 라고 표현하지만, conversation-thread SoT 에서는 text_classifier / information_extractor 의 push 도 이미 v1 에서 출하된 것으로 확인된다. 기각된 대안의 재도입은 아니나, 현재 구현 상태와 target 기술이 "push 미출하" 처럼 읽힐 수 있어 혼동 여지가 있다. 자동 inject (contextScope 확장)만 v2 로드맵에 남아 있는 상황.
- **제안**: `0-common.md §10` 첫 단락을 "v1 은 세 노드 모두 push 가 출하된 상태. `ai_agent` 만 자동 주입(inject/contextScope)을 구현하며, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 자동 주입이 추가된다" 로 명확화. conversation-thread §2.3 및 §7 v2 로드맵과 정합 유지.

### INFO-2: `memoryStrategy` 가 공통 §10 에서 "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 로 표기되나, 이것이 이미 합의된 결정임을 명시 근거 없이 기술

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` 표의 `memoryStrategy` 행
  - "AI Agent 한정 (text_classifier/information_extractor 는 v2)"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12.9`, `spec/conventions/conversation-thread.md §7 v2 로드맵`
- **상세**: 이 제한은 기각된 대안의 재도입이 아니며, §12.9 의 결정("별도 필드로 도입, manual 이 기본") 과 conversation-thread v2 로드맵("text_classifier / information_extractor 자동 주입 확장은 v2 로드맵")에 의해 충분히 뒷받침되어 있다. 다만 `0-common.md §10` 의 해당 행 비고에 직접 근거 링크가 없어 독자가 단순 제약인지 의도된 설계인지 파악하기 어렵다.
- **제안**: `memoryStrategy` 행 비고에 `[AI Agent §12.9](./1-ai-agent.md#129-memorystrategy-를-contextscope-enum-확장이-아닌-별도-필드로-둔-근거)` 참조를 추가해 결정 근거를 명시.

### INFO-3: `includeToolTurns` 의 `memoryStrategy ≠ manual` 시 동작 설명이 두 위치에서 미묘하게 다름

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` 표 `includeToolTurns` 행, `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표 `includeToolTurns` 행
- **과거 결정 출처**: conversation-thread 의 합의된 invariant: push(thread 누적)와 inject(자동 주입)의 분리
- **상세**: 0-common.md §10 은 `includeToolTurns` 에 대한 `memoryStrategy` 제한을 기술하지 않는다. 1-ai-agent.md §1 에서는 "`memoryStrategy ≠ manual` 시 자동 주입 측면에서는 무효 (push 자체는 thread 누적 컨트랙트라 유지)"로 명시하여 push/inject 분리 원칙을 잘 기술하고 있다. 그러나 공통 §10 에서 이 내용이 누락되어 단순히 §1 을 cross-reference 해야만 파악 가능하다.
- **제안**: 0-common.md §10 의 `includeToolTurns` 행 설명에 push 와 inject 분리 원칙을 한 줄 추가: "`memoryStrategy ≠ manual` 시 자동 주입 측면에서 무효 — push (thread 누적) 자체는 전략과 독립 유지". 기각된 결정 재도입 수준은 아니므로 INFO 등급.

---

## 요약

`spec/4-nodes/3-ai/` 대상 범위(0-common.md, 1-ai-agent.md)는 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계를 담고 있지 않다. `memoryStrategy` 를 contextScope enum 확장이 아닌 별도 필드로 둔 결정(§12.9), v1/v2 경계 번복의 근거 명문화(§12.10), 요약·회수 블록의 안정 프리픽스 배치(§12.11), persistent 메모리를 별도 `agent_memory` 테이블로 분리해 conversation-thread "신규 DB 컬럼 없음" 조항을 유지한 결정, 기각된 대안들(`contextScope` enum 에 `auto` 추가, `rendered: false` 가드 필드, downstream 차단 retry 등)이 모두 신규 spec 에서 재도입되지 않았다. 발견된 세 건은 모두 INFO 수준으로, 기존 Rationale 과의 충돌이 아니라 일관성·명확성 보완 제안이다.

## 위험도

LOW
