# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md)
검토 기준 diff: worktree(`ai-context-memory-9c7e6e`) vs `origin/main`

---

## 발견사항

### [WARNING] `0-common.md §10` 에 `memoryStrategy` 행 추가 — "3 노드 공통 규약" 테이블과 실제 적용 범위 불일치

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §10 Conversation Context 필드 표, 새로 추가된 행 `memoryStrategy | 'manual'/'summary_buffer'/'persistent' | …`
- **충돌 대상**: `spec/conventions/conversation-thread.md §2.3` "자동 주입(inject) 은 `ai_agent` 만" + `spec/4-nodes/3-ai/2-text-classifier.md` / `3-information-extractor.md` (두 파일에 `memoryStrategy` 필드 없음)
- **상세**: `0-common.md §10` 도입부는 "AI 카테고리 3 노드 공통 규약"이라고 선언하지만, 추가된 `memoryStrategy` 행 설명란에 "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 을 괄호 안에 명기한다. 즉 실제로는 **단일 노드 전용 필드**가 "3 노드 공통" 테이블에 섞여 있다. `text_classifier` 와 `information_extractor` spec 의 config 표에는 이 필드가 없어 각 노드 문서와 `0-common.md §10` 사이에 visible/hidden 불일치가 생긴다. 독자가 3 노드 모두 `memoryStrategy` 를 설정할 수 있다고 혼동할 수 있다.
- **제안**: `0-common.md §10` 에서 `memoryStrategy` 행을 분리해 "AI Agent 전용 확장 필드" 별도 소절(또는 각주 블록)로 이동하거나, 행 앞에 "`ai_agent` 전용" 컬럼을 추가한다. 또는 `1-ai-agent.md §1` config 표에만 위치시키고 `0-common.md §10` 에서는 제거한다.

---

### [WARNING] `text_classifier` / `information_extractor` — `retryable` 필드 구현 상태 불일치

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` 출력 구조 §5.3 error 표 / `spec/4-nodes/3-ai/3-information-extractor.md` 출력 구조 error 표
- **충돌 대상**: `spec/conventions/node-output.md §3.2.1` "LLM 계열 노드(`ai_agent`/`text_classifier`/`information_extractor`)에서 `output.error.details.retryable` 필수"
- **상세**: worktree 의 두 노드 spec 은 `retryable` / `retryAfterSec` 행을 "🚧 미구현(Planned)"으로 표기하면서 현재 핸들러가 채우지 않는다고 명시한다. `node-output.md §3.2.1` 은 LLM 계열 3 노드 모두에 이 필드를 "필수(mandatory)"로 규정한다. 따라서 두 노드가 spec-required 필드를 의도적으로 미구현인 채로 `status: partial` 만 표기한 상태는 convention-compliance checker 가 SPEC-DRIFT 로 잡을 수 있는 모순이다. `ai_agent` 는 충전 완료, 다른 두 노드는 미충전 — 같은 규약의 같은 의무가 3 노드간 불일치한다.
- **제안**: `node-output.md §3.2.1` 하단 또는 별도 표에 구현 상태 주석("text_classifier / information_extractor: Planned")을 추가하거나, 미구현 상태를 명시적으로 허용하는 예외 사유를 기재해 convention spec 과 노드 spec 간 미충전 근거를 정렬한다. 또는 구현을 완료해 불일치를 해소한다.

---

### [INFO] `spec/1-data-model.md §2` — `AgentMemory` 엔티티 신규 추가, 기존 ER 다이어그램·인덱스 표 연동 필요

- **target 위치**: `spec/1-data-model.md §2.23 AgentMemory`, §3 인덱스 표 두 행, §1 ER 다이어그램 `AgentMemory (1:N)` 라인
- **충돌 대상**: `spec/0-overview.md §6.1` "구현 완료 ✅" 목록 — `AgentMemory` / `memoryStrategy: 'persistent'` 가 §6.1 에 미등재
- **상세**: 데이터 모델과 AI Agent spec 에 `AgentMemory` 엔티티·인덱스·참조가 추가됐으나, `spec/0-overview.md §6.1` 의 "AI 플랫폼" 구현 완료 목록에는 아직 `Agent Memory (persistent)` 항목이 없다. `spec/5-system/17-agent-memory.md` 도 신규 추가된 파일이다. 기능이 구현 완료 상태라면 §6.1 에 항목을 추가해야 아키텍처 개요 문서와 데이터 모델 spec 의 정합성이 유지된다. 미구현이라면 §6.3 로드맵에 명시가 필요하다.
- **제안**: `spec/0-overview.md §6.1` AI 플랫폼 행에 `Agent Memory (persistent — memoryStrategy: 'persistent', AgentMemory 테이블, 세션 간 사실·선호 추출·의미검색 회수)` 항목 추가. 또는 미완성이면 §6.2/§6.3 에 분류.

---

### [INFO] `spec/conventions/conversation-thread.md §1.3` — `runningSummary`/`summarizedUpToSeq` 신규 필드, `spec/1-data-model.md` ConversationThread 영속 정책과의 교차 확인

- **target 위치**: `spec/conventions/conversation-thread.md §1.3` ConversationThread 엔티티 표에 `runningSummary?`/`summarizedUpToSeq?` 두 필드 추가
- **충돌 대상**: 동 문서 §3.2 "v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음" 조항
- **상세**: 새 두 필드는 DB 컬럼이 아니라 `ExecutionContext` (Redis 직렬화) 에 thread 일부로 포함된다는 설명이 worktree 수정에 명기되어 있다. 이는 "신규 DB 컬럼 없음" 조항과 모순되지 않으나, 주석이 `§3.2` 의 정책 텍스트를 "ConversationThread 본문 한정 유지"로 좁히는 방식으로 기술돼 있어 독자에게 혼동을 줄 수 있다. 또한 `spec/5-system/4-execution-engine.md` 의 `ExecutionContext` 구조가 `runningSummary`/`summarizedUpToSeq` 를 포함한다는 보장이 target 내에서 cross-ref 되지 않는다.
- **제안**: `spec/5-system/4-execution-engine.md §ExecutionContext` 또는 관련 절에 `runningSummary`/`summarizedUpToSeq` 가 직렬화 포함 대상임을 명기하거나, `conversation-thread.md §1.3` 의 두 필드 설명에 "serialized in `ExecutionContext.thread` — no separate DB column" 을 명확히 기재한다.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md §11.4` ordering 변경 — `[5]` → `[5a]/[5b]/[5c]/[6]` 으로 재구조화

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §11.4` System Context ordering 목록 step 5
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` (단일 진실 소비처), `spec/4-nodes/3-ai/3-information-extractor.md §5 실행 로직` (소비처)
- **상세**: `0-common.md §11.4` 는 "본 §11.4 가 ordering 의 단일 SoT" 라고 선언하며, `1-ai-agent.md §6.1` 과 `3-information-extractor.md §5` 는 이를 참조한다. 변경 내용은 비파괴적(기존 [5]의 의미가 [5c]로 이관)이나, `3-information-extractor.md` 는 `memoryStrategy` 필드를 갖지 않으므로 [5a]/[5b] 단계가 정보 추출기 실행 로직에 묵시적으로 포함된 것처럼 보일 수 있다. 정보 추출기 spec 의 실행 로직 step 0.5 ~ step 5 ordering 설명이 `0-common.md §11.4` 변경과 동기화됐는지 확인이 필요하다.
- **제안**: `3-information-extractor.md` 의 실행 로직 ordering 참조 설명에 "[5a]/[5b] 는 `ai_agent` 전용 (`memoryStrategy ≠ manual`)" 을 명기해 `0-common.md §11.4` 에서 독자가 연유를 알 수 있게 한다. 이미 처리됐다면 현황 확인으로 충분.

---

## 요약

target(`spec/4-nodes/3-ai/` 전 파일 + `spec/1-data-model.md` + `spec/conventions/conversation-thread.md`)은 AI Agent 의 `memoryStrategy` (summary_buffer/persistent) 및 System Context Prefix(`§11`) 를 공통 spec 에 통합한 변경이다. 전체적으로 내부 일관성은 잘 유지되어 있으며, CRITICAL 수준의 직접 모순은 발견되지 않았다. 다만 두 가지 WARNING 이 있다. 첫째, `0-common.md §10` "3 노드 공통" 테이블에 `ai_agent` 전용인 `memoryStrategy` 행이 섞여 들어가 `text_classifier`/`information_extractor` 문서와 가시적 불일치가 생긴다. 둘째, `node-output.md §3.2.1` 이 LLM 계열 3 노드 모두에 `retryable` 을 "필수"로 규정하지만 두 노드 핸들러는 현재 미충전 상태를 "Planned" 로만 표기해 convention 위반 상태가 지속된다. 두 INFO 항목은 `spec/0-overview.md` 의 구현 목록 미갱신 및 `ExecutionContext` 영속 cross-ref 미완성이다.

---

## 위험도

MEDIUM
