---
worktree: ai-context-memory-9c7e6e
started: 2026-06-03
owner: planner/developer
related_plan: plan/in-progress/ai-context-memory-auto.md
---

# AI Agent 자동 컨텍스트 메모리 — v2 후속 surface

`ai-context-memory-auto.md` (Phase B~G) 가 구현하는 summary_buffer + persistent 의
**남은 v2 surface**. 본 plan 이 in-progress 인 동안 관련 spec 들은 `status: partial`
을 유지한다 (`1-ai-agent.md` / `0-common.md` / `conversation-thread.md` /
`5-system/17-agent-memory.md` 의 `pending_plans:` 가 본 plan 을 가리킴).

## 미구현 surface (v2)

- [ ] **멀티턴 누적 messages 물리 축소**: 현재 summary_buffer 는 요약 블록을 system 안정
      프리픽스에 additive 로 추가하나, multi-turn 누적 `state.messages` 의 오래된 turn 을
      물리적으로 제거하진 않는다 (tool_use↔tool_result 페어링 무결성 보존 위해). 토큰
      절감 효과가 multi-turn 에서 부분적. 페어링 안전한 압축 전략 필요.
- [ ] **persistent 증분 추출 + 구조화 dedup**: 현재 매 turn 전체 thread 스냅샷 추출 +
      정확일치 dedup (FIFO 1000 으로 흡수). 직전 N turn 만 증분 추출 + 의미 기반 dedup/
      갱신(Mem0 식 fact 최신화). spec `17-agent-memory.md §6`.
- [ ] **persistent TTL 만료**: 현재 scope 당 최신 1000 FIFO/LRU. 시간 기반 만료 옵션.
- [ ] **추출 분류 깊이**: fact / preference / entity 구조화 (`metadata.kind`).
- [ ] **메모리 가시화 UI**: workspace 어드민이 scope 별 누적 메모리 조회/삭제.
- [ ] **text_classifier / information_extractor 자동 주입(contextScope/memoryStrategy) 확장**:
      현재 자동 주입은 ai_agent 한정 (push 는 세 노드 모두 출하). `0-common.md §10`,
      `conversation-thread.md §2.3` 로드맵.
- [ ] **provider tokenizer-exact 토큰 카운트**: 현재 char/4 근사. 모델별 정확 토큰화.
- [ ] **요약/추출 전용 저비용 모델 옵션**: 현재 노드 `model` 재사용. 별도 모델 필드 검토.

> 위 항목들은 본 PR(`ai-context-memory-auto.md`) 범위 밖. 우선순위·picking 후 개별 착수.

## spec 정밀화 백로그 (코드 리뷰 도출, 경미)

- [ ] `0-common.md §10` memoryStrategy 행에 `[AI Agent §12.9]` 근거 링크(W-11), `includeToolTurns`
      행에 push/inject 분리 한 줄(W-12).
- [ ] `1-ai-agent.md §7` Config echo 열거에 memory 5필드 추가(impl-done W-3).
- [ ] `0-common.md §10` 첫 단락 "v1 세 노드 모두 push 출하, ai_agent 만 inject" 로 정밀화(W-7).
- [ ] `1-ai-agent.md §6.1 d.5` summary_buffer(1.5만) vs persistent(1.3+1.5+2.7) 분기 명시(W-8).
- [ ] `5-system/_product-overview.md` 에 AGM-01~07 등재(W-10).
- [ ] `conversation-thread.md §7` Token-aware cap 에 "tokenizer-exact 는 v3 잔존" 명시(SPEC-DRIFT I-11).
- [ ] `1-ai-agent.md §12.10/12.11` 에 요약 LLM 모델 재사용(별도 필드 없음) Rationale 소항(I-6).
- [ ] Redis TTL 만료 시 runningSummary 유실 fallback 정책 명시(W-6).
