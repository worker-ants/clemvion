# Cross-Spec 일관성 검토 결과

- **대상**: `spec/4-nodes/3-ai/` (0-common.md §10 Conversation Context + §11 System Context Prefix, 1-ai-agent.md 신규 필드 포함)
- **검토 모드**: `--impl-done`, scope=spec/4-nodes/3-ai/, diff-base=origin/main

---

## 발견사항

### INFO-1: `0-common.md` §10 — `excludeFromConversationThread` 3 노드 공통 선언 vs. `2-text-classifier.md` / `3-information-extractor.md` 개별 config 표 미반영

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` — Conversation Context 표에 `excludeFromConversationThread` 필드가 "3 노드 공통 규약"으로 선언됨
- **충돌 대상**: `spec/4-nodes/3-ai/2-text-classifier.md §1 설정(config)` / `spec/4-nodes/3-ai/3-information-extractor.md §1 설정(config)` — 두 파일 모두 `excludeFromConversationThread` 필드 항목 없음
- **상세**: `spec/conventions/conversation-thread.md §2.4` 가 "각 노드에 공통 boolean config: `excludeFromConversationThread`" 라고 선언하고 ai-agent.schema.ts 를 SoT 로 적시한다. 그러나 text-classifier / information-extractor 개별 spec 의 config 표에는 이 필드가 열거되어 있지 않아, 독자가 두 노드의 config 표만 보면 이 필드가 없다고 오독할 수 있다.
- **제안**: `2-text-classifier.md §1` 과 `3-information-extractor.md §1` config 표에 `excludeFromConversationThread` 행을 추가하여 공통 §10 과 동기화. (conversation-thread.md §2.4 의 현행 선언이 cross-cutting SoT 이므로 개별 파일 추가는 drift 방지 목적)

---

### INFO-2: `0-common.md` §10 — `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `memoryStrategy` 는 "공통 규약" 표에 있으나 `text_classifier` / `information_extractor` 적용 범위가 불명확

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` Conversation Context 표
- **충돌 대상**: `spec/conventions/conversation-thread.md §2.3` — "자동 주입(inject) `contextScope` 활성화는 `ai_agent` 만 / `text_classifier` · `information_extractor` 는 v2 로드맵" 으로 명시
- **상세**: `0-common.md §10` 표 제목은 "AI 카테고리 3 노드 공통 규약"이고 표 안 필드들이 모두 3 노드에 적용되는 것처럼 보인다. 그러나 `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `memoryStrategy` 5개 필드는 현재 `ai_agent` 전용이다(`conversation-thread.md §2.3` 로드맵 명시). 본문 후반부에 주석으로 이를 설명하고 있으나, 표 행 자체에 "AI Agent 한정" 표기가 없어 drift 위험이 있다.
- **제안**: `0-common.md §10` 표의 해당 필드 행에 적용 범위를 명시하는 주석 또는 각주를 추가하거나, 표를 "3 노드 공통"과 "AI Agent 한정" 두 절로 분리. (conversation-thread.md §2.3 의 기술과 정합)

---

### INFO-3: `0-common.md` frontmatter `status: partial` vs. 현재 live 파일 `status: implemented`

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter `status: partial`, `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]`
- **충돌 대상**: 현재 HEAD `spec/4-nodes/3-ai/0-common.md` frontmatter `status: implemented`, pending_plans 없음
- **상세**: target 이 `status: partial` 로 선언함은 §11 System Context Prefix 및 §10 Conversation Context 의 일부 기능(text_classifier / information_extractor 의 inject v2)이 미완임을 반영한다. 이는 live 파일과의 diff 로서 merge 전 검토 목적으로 적절하며 다른 spec 과의 직접 모순은 아니다. `1-ai-agent.md` 와 `2-text-classifier.md` / `3-information-extractor.md` 의 frontmatter status 가 상호 정합하는지 merge 시 재확인 권장.
- **제안**: merge 시 개별 노드 spec 의 frontmatter `status` 와 `pending_plans` 도 동일하게 일관 갱신.

---

### INFO-4: `1-ai-agent.md §1` `memoryStrategy` 관련 필드 — `1-data-model.md §2.23 AgentMemory` 와의 필드명 일관성 확인

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` — `memoryKey`, `memoryTopK`, `memoryThreshold`, `memoryTokenBudget`
- **충돌 대상**: `spec/1-data-model.md §2.23 AgentMemory` — `scope_key` (DB 컬럼명) / `spec/5-system/17-agent-memory.md` (참조됨)
- **상세**: AI Agent config 의 `memoryKey` (camelCase Expression 평가값) 가 AgentMemory 테이블의 `scope_key` DB 컬럼에 매핑됨. 이 명명 비대칭은 데이터 모델 §2.23 에서 `scope_key`에 대해 "AI Agent 노드의 `memoryKey` (Expression 평가값)" 라고 명시적으로 기술하고 있어 의도된 구분이다. 모순은 아니나 독자 혼선 방지 차원의 cross-reference 가 현행대로 유지되어야 한다.
- **제안**: 현행 cross-reference 명기 유지. spec-impl 검토 시 `ai-agent.schema.ts` 의 `memoryKey` ↔ `AgentMemory.scope_key` 매핑 검증 권장.

---

### INFO-5: `0-common.md §11.3 Timezone SoT` vs. `1-data-model.md §2.2 Workspace.settings`

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §11.3` — `Workspace.settings.timezone` (IANA, NAV-SC-06) precedence 1
- **충돌 대상**: `spec/1-data-model.md §2.2 Workspace.settings` — "알려진 키: `timezone: string?` (IANA, NAV-SC-06 — 미설정 시 서버 default `process.env.TZ` → `UTC`. AI 노드의 System Context Prefix ([Spec AI 공통 §11.3]) 와 Schedule 의 default timezone 이 본 값을 참조)"
- **상세**: 두 spec 이 동일 precedence 규칙을 기술하며 서로를 상호 참조하고 있다. 모순 없음. `1-data-model.md §2.2` 의 cross-ref 가 정확히 `[Spec AI 공통 §11.3]` 을 가리키고 있어 단일 진실 구조가 유지된다.
- **제안**: 현행 상호 참조 구조 유지. 변경 시 두 문서 동시 갱신 필요.

---

## 요약

`spec/4-nodes/3-ai/` 의 신규 §10 Conversation Context + §11 System Context Prefix 추가는 다른 spec 영역(`spec/1-data-model.md`, `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/5-system/17-agent-memory.md`)과 직접적인 데이터 모델 충돌·API 계약 충돌·상태 전이 충돌·RBAC 충돌이 없다. 주요 cross-spec 단일 진실 (`AgentMemory §2.23`, `conversation-thread.md §2.3`, `Workspace.settings.timezone §2.2`) 과의 상호 참조도 정합하게 유지되어 있다. 다만 `0-common.md §10` 의 표가 "3 노드 공통"으로 기술하면서 실제 일부 필드는 `ai_agent` 전용(`contextScope` 계열·`memoryStrategy`)임이 본문 주석으로만 언급되는 점, 그리고 `text_classifier` / `information_extractor` 개별 spec 의 config 표에 `excludeFromConversationThread` 가 누락된 점이 향후 drift 위험 요소다. 두 모두 INFO 등급의 명명·동기화 이슈이며 채택 차단 사유는 아니다.

---

## 위험도

LOW
