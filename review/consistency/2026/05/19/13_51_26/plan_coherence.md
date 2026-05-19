# Plan 정합성 검토 — spec-draft-conversation-ui-contract.md

검토 일시: 2026-05-19
대상: `plan/in-progress/spec-draft-conversation-ui-contract.md` (worktree: `spec-conversation-ui-contract`)
검토 범위: `plan/in-progress/**` 진행 중 작업과의 정합성 5개 관점

---

## 발견사항

### [CRITICAL] toolcall-tree-rendering worktree 가 target spec 의 핵심 구현을 이미 완료

- **target 위치**: §9.6 (tool-call 그룹 시각 정책), §9.7 (WS 이벤트 → store 변환 계약), §9.8 (`isAssistantContentBlank`), §9.A (`mergeOrphanToolItems`)
- **관련 worktree**: `worktree-toolcall-tree-rendering` (branch `worktree-toolcall-tree-rendering`, commit `6fe8809d` — 아직 main 미머지)
- **상세**:
  `toolcall-tree-rendering` worktree 는 target spec draft 가 spec 으로 정립하려는 영역의 구현을 이미 완료했다. 동일 파일에 대한 양방향 수정이 병렬로 진행 중이다.

  | spec draft 절 | toolcall-tree-rendering 기존 구현 위치 |
  |---|---|
  | §9.6 tool-call 그룹 시각 정책 | `conversation-inspector.tsx:759–907` — `isToolCallGroupParent` 분기 + `childrenByParent` map 완전 구현 |
  | §9.7 `waiting_for_input` MERGE orphan tools | `use-execution-events.ts:273–290` — `mergeOrphanToolItems(threadItems, prev)` 호출 구현 완료 |
  | §9.8 `isAssistantContentBlank` | `conversation-inspector.tsx:63–65` — 동일 시그니처 함수 이미 존재 (`typeof content !== "string" \|\| content.trim() === ""`) |
  | §9.A `mergeOrphanToolItems` | `conversation-utils.ts:537–651` — 전체 함수 구현 완료 (JSDoc 포함) |

  spec draft 가 정의하는 대부분의 계약은 구현이 먼저 완료된 상태다. spec 을 구현과 다르게 작성하면 즉각 불일치가 발생한다.

  추가로 `preserve-live-tool-items` worktree (commit `c851c9ef`) 도 `conversation-utils.ts` / `use-execution-events.ts` 를 수정한 PR 이 이미 main 에 머지됐다 (PR #208). `collapse-empty-toolcall-bubble` worktree (commit `e34d4bef`) 도 `conversation-inspector.tsx` 를 수정한 PR #210 이 이미 main 에 머지됐다. `toolcall-tree-rendering` 만이 아직 PR 미머지 상태.

- **제안**:
  1. spec-draft 작성 전에 `toolcall-tree-rendering` 의 구현 (commit `6fe8809d`) 을 먼저 리뷰해 spec 의 계약 정의가 기존 구현과 일치하는지 검증해야 한다.
  2. spec 작성은 구현에서 역으로 추출(reverse-spec)하는 방식으로 진행하거나, 구현이 spec draft 를 어기는 부분을 찾아 구현 수정을 선행해야 한다.
  3. `toolcall-tree-rendering` 의 PR 이 먼저 main 에 머지된 후 spec draft 를 완성하는 직렬 순서가 안전하다.

---

### [CRITICAL] `isAssistantContentBlank` 함수의 위치 불일치 — 구현 vs spec 정의

- **target 위치**: §9.8 — `isAssistantContentBlank` 를 conversation 계약의 단일 결정 함수로 정의
- **관련 worktree**: `toolcall-tree-rendering` (현재 구현: `conversation-inspector.tsx:63`)
- **상세**:
  spec draft §9.8 은 `isAssistantContentBlank` 가 사용처가 3곳 (§9.6 그룹 분류, SelectedItemDetail 헤더 라벨, placeholder) 임을 명시하며 단일 결정 함수로 SoT 화 한다. 그러나 현 구현에서 이 함수는 `conversation-inspector.tsx` 에 정의돼 `conversation-utils.ts` 에는 없다.

  §9.10 의 테스트 경로 `conversation-utils.test.ts` 에서 `isAssistantContentBlank` 를 검증하는 시나리오 S1 이 참조하는 것으로 보면, spec draft 는 이 함수를 `conversation-utils.ts` 로 이동시키는 것을 전제하는 것으로 보이나 이 리팩토링 작업이 plan 어디에도 명시되지 않았다.

- **제안**:
  - target plan 의 §5 "부가 산출물" 또는 별도 작업 항목에 "함수를 `conversation-utils.ts` 로 이동" 을 추가하거나, 테스트 경로 참조를 현재 구현 위치 (`conversation-inspector.test.tsx` 에서의 검증) 에 맞게 수정해야 한다.

---

### [WARNING] `ai-agent-tool-connection-rewrite.md` 의 순서 의존성 — stale worktree 참조

- **target 위치**: plan §4 "영향 받는 다른 spec" 테이블 하단 — "충돌 없음, 본 spec 변경 이후 작업 시 §9.10 의무 적용"
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` — §"의존성·리스크" `순서 의존성`
- **상세**:
  `ai-agent-tool-connection-rewrite.md` 는 "worktree: `conversation-thread-e509c5`" 가 `spec/4-nodes/3-ai/1-ai-agent.md §1` 표를 개정해야 본 plan 의 §3 spec 작성이 가능하다고 명시한다. 그러나 현재 git worktree 목록에 `conversation-thread-e509c5` 는 존재하지 않는다 (활성 worktree: `spec-conversation-ui-contract`, `toolcall-tree-rendering` 등).

  또한 `conversation-thread.md` plan 이 `plan/complete/conversation-thread.md` 로 이미 완료 처리됐고, 본 target spec draft 가 conversation-thread spec 의 §9 확장을 다루므로, `ai-agent-tool-connection-rewrite.md` 의 순서 의존성 선행 조건이 target spec 과 어떻게 연결되는지 재정립이 필요하다.

- **제안**:
  - target plan 에서 `ai-agent-tool-connection-rewrite.md` 와의 관계를 "충돌 없음" 으로만 기술하는 것은 부족하다. `ai-agent-tool-connection-rewrite.md` 의 `tool_*` source 결정 (§"conversation-thread 와의 정책 의존") 이 §9.7 의 WS 이벤트 store 변환 계약에 영향을 줄 수 있으므로, target plan 의 §4 테이블에 "tool_*` source 정책 미결 — §9.7 의 `tool_call` source 신설 가능성" 을 INFO 로 기재해야 한다.
  - `ai-agent-tool-connection-rewrite.md` 의 stale 한 worktree 참조 (`conversation-thread-e509c5`) 를 갱신 또는 삭제해야 한다.

---

### [WARNING] §9.10 테스트 경로가 toolcall-tree-rendering 기존 테스트와 중복될 가능성

- **target 위치**: §9.10 — 회귀 차단 시나리오 S1~S7 및 테스트 경로
- **관련 worktree**: `toolcall-tree-rendering` — `conversation-inspector.test.tsx` / `conversation-utils.test.ts` / `use-execution-events.test.ts` 를 이미 수정 (commit `6fe8809d` diff 에 포함)
- **상세**:
  target spec draft §9.10 은 S1~S7 시나리오를 이미 언급된 테스트 파일에서 검증해야 한다고 명시한다. 그런데 `toolcall-tree-rendering` 은 동일 파일들을 이미 수정해 일부 시나리오 (S2: `includeToolTurns:false` + 1 tool, S3: multi-LLM-call × N tools) 의 테스트를 작성했을 가능성이 높다.

  S1~S7 테스트 중 이미 `toolcall-tree-rendering` 에 구현된 것과 target spec draft 가 추가하려는 테스트가 중복될 경우, 병합 시 충돌 또는 중복 테스트가 발생한다.

- **제안**:
  - `toolcall-tree-rendering` 이 main 에 머지된 후 실제로 추가된 테스트 케이스를 확인하고, §9.10 테이블에서 이미 구현된 시나리오를 "기존 테스트로 충족" 으로 표시하거나 누락된 케이스만 추가 작업으로 남겨야 한다.

---

### [INFO] §9 prologue 라이프사이클 다이어그램과 기존 §9.3 데이터 소스 선택의 cross-ref 필요

- **target 위치**: §9 prologue 신설 mermaid 다이어그램
- **관련 plan**: 없음 (spec 본문 내부 정합성 사안)
- **상세**:
  현재 spec §9.3 "데이터 소스 선택" 은 `conversationThread` snapshot 을 1차 소스로, `ai_message.messages` 를 2차 소스로 사용하는 정책을 명시한다. target spec draft §9.6~§9.A 신설 이후 §9.3 의 "1차 소스 → `waiting_for_input` 적용 시 §9.7 MERGE 정책 따름" 이라는 cross-link 가 없으면 §9.3 과 §9.7 이 독립적으로 읽힌다.
- **제안**: spec 작성 시 §9.3 에 §9.7 로의 cross-link 를 추가한다.

---

### [INFO] `0-unimplemented-overview.md` plan 목록 갱신 필요

- **target 위치**: target plan 자체 (spec-draft-conversation-ui-contract.md)
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` — `plan/in-progress/` 목록 인덱스
- **상세**:
  `0-unimplemented-overview.md` 의 `plan/in-progress/` 목록 트리에 `spec-draft-conversation-ui-contract.md` 가 포함되지 않는다. target plan 이 in-progress 로 확정되면 인덱스 갱신이 필요하다.
- **제안**: target plan commit 시 `0-unimplemented-overview.md` 의 plan 목록 트리에 `spec-draft-conversation-ui-contract.md` 항목을 추가한다.

---

## 요약

Plan 정합성 관점의 가장 큰 위험은 **`toolcall-tree-rendering` worktree 와의 직접 worktree 충돌**이다. 이 worktree 는 target spec draft 가 spec 으로 정립하려는 §9.6 (parent-child tree 렌더), §9.7 (mergeOrphanToolItems 호출), §9.8 (`isAssistantContentBlank`), §9.A (`mergeOrphanToolItems` 함수 본체) 의 구현을 모두 완료했으며 아직 main 에 미머지 상태다. spec-first 원칙(SDD) 상 spec 이 먼저여야 하지만, 이 경우에는 구현이 선행됐으므로 spec draft 는 기존 구현을 역방향으로 추출·정합화하는 방식으로 완성돼야 한다. 또한 `isAssistantContentBlank` 의 위치(현재 `conversation-inspector.tsx`, spec draft 는 `conversation-utils.ts` 테스트를 가정)가 일치하지 않아 별도 리팩토링 작업이 필요하다. `ai-agent-tool-connection-rewrite.md` 의 stale worktree 참조 및 `tool_*` source 정책 미결도 §9.7 에 잠재적 영향을 준다.

## 위험도

HIGH
