# 아키텍처(Architecture) 리뷰

리뷰 대상: `ai-context-memory` 변경 세트
- `spec/0-overview.md`, `spec/1-data-model.md`
- `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `_product-overview.md`
- `spec/4-nodes/_product-overview.md`
- `spec/5-system/17-agent-memory.md` (신규)
- `review/consistency/2026/06/03/21_38_47/` (일관성 검토 산출물)

---

## 발견사항

### [CRITICAL] `spec/5-system/17-agent-memory.md` 미작성 상태에서 참조 의존성 구성
- 위치: `spec/4-nodes/3-ai/0-common.md §10`, `1-ai-agent.md §1·§6.1`, `spec/1-data-model.md §2.23`
- 상세: 세 문서가 `spec/5-system/17-agent-memory.md` 를 스코프 키 네임스페이스, top-k 회수 파라미터, 비동기 추출 격리 invariant, FIFO eviction 정책의 **단일 진실 공급원**으로 열거 참조한다. 그러나 해당 파일이 실제로 제공하는 내용은 108줄 초안 수준으로, 리뷰 페이로드에서 캡처된 시점에는 아예 존재하지 않았다. 이 상태에서 `1-ai-agent.md §6.1` 이 메모리 회수/추출/forgetting 동작을 기술하면 — 구현자가 spec 없이 코드로 계약을 결정하는 **데이터 레이어 SoT 역전**이 발생한다. 의존성 역전 원칙(DIP)에서 상위 레이어(노드 spec)가 하위 레이어(메모리 시스템 spec)를 인터페이스(문서 §)로 참조해야 하는데, 그 인터페이스 계약 자체가 미확정이다.
- 제안: `17-agent-memory.md` 를 §스코프 키, §회수, §추출, §forgetting, §Rationale 전 섹션 완성 후 구현 착수. 미완성 spec 을 SoT 로 호출하는 dangling link 는 build-time 가드(`spec-pending-plan-existence.test.ts`)가 잡을 수 없으므로 별도 링크 유효성 검사 고려.

### [WARNING] `memoryStrategy` 필드의 "두 축 분리" 설계 — 필드 간 무효화 규칙이 레이어 경계를 넘어 분산
- 위치: `0-common.md §10` 공통 표, `1-ai-agent.md §1` 설정 표, `1-ai-agent.md §6.1` 실행 로직
- 상세: `memoryStrategy ≠ manual` 시 `contextScope`/`contextScopeN`/`contextInjectionMode`/`includeToolTurns` 4필드가 무효화된다는 규칙이 (a) `0-common.md §10` blockquote, (b) `1-ai-agent.md §1` 각 필드 비고, (c) `1-ai-agent.md §6.1` 단계 1.5 분기 설명, (d) `1-ai-agent.md §2` UI `visibleWhen` 설명에 반복 기술된다. 단일 책임 원칙(SRP) 관점에서 "무효화 규칙의 정의"가 한 섹션(예: `0-common.md §10`)에만 있어야 하고 나머지는 참조만 해야 하는데, 현재는 동일 규칙이 4곳에 산재해 한 곳을 수정 시 나머지 3곳이 drift 할 위험이 있다. `1-ai-agent.md §12.9 Rationale` 이 좋은 결정 근거를 제공하나, 규칙 선언 자체의 SoT 위치가 명확하지 않다.
- 제안: 무효화 규칙의 선언 SoT 를 `0-common.md §10` 로 명시하고, `1-ai-agent.md §1` 의 각 필드 비고에는 `[공통 §10 참조]` 인라인 링크만 두어 중복 선언을 제거한다.

### [WARNING] `AgentMemory` 엔티티가 `DocumentChunk` 인프라를 재사용하면서 서비스 레이어 경계가 불명확
- 위치: `spec/1-data-model.md §2.23`, `spec/5-system/17-agent-memory.md`
- 상세: `AgentMemory.embedding` 이 `DocumentChunk.embedding` 과 "동일 확장·차원 정책"을 사용하지만 **별도 테이블**이다. 이는 `RagSearchService` 가 KB 검색(DocumentChunk)과 메모리 회수(AgentMemory)를 동일 pgvector 연산으로 처리하는지, 아니면 `AgentMemoryService` 가 독립된 서비스 레이어를 갖는지가 spec 에서 결정되지 않았다. 만약 `RagSearchService` 가 두 도메인을 모두 처리하면 단일 책임 원칙(SRP) 위반 + 결합도 상승이고, 별도 서비스를 만들면 pgvector 유사도 검색 로직 중복이 발생한다. `17-agent-memory.md` 에서 이 경계가 명확히 정의되지 않아 구현 단계에서 레이어 책임 혼재가 발생할 수 있다.
- 제안: `17-agent-memory.md §회수` 섹션에서 `AgentMemoryService` 가 독립 서비스인지, `RagSearchService` 의 오버로드 메서드를 사용하는지를 명시. 공유 pgvector 유틸리티 레이어(예: `VectorSearchUtil`)를 별도 추상화로 추출하는 안을 검토.

### [WARNING] `summary_buffer` 전략에서 `runningSummary`/`summarizedUpToSeq` 의 저장 레이어가 Redis 에만 한정
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1·§12.10`, `spec/conventions/conversation-thread.md §4 (참조)`
- 상세: `runningSummary`/`summarizedUpToSeq` 가 Redis `ExecutionContext` 직렬화에만 보관되고 "신규 DB 컬럼을 만들지 않는다"는 결정은 `conversation-thread §4` 의 "v1 신규 DB 컬럼 없음" 조항 유지와 일관성이 있다. 그러나 이 결정은 실행 도중 Redis 장애 또는 TTL 만료 시 **rolling summary 가 유실**되어 multi-turn 세션이 context 없이 재개되는 데이터 내구성 결함을 내포한다. 데이터 레이어의 영속성 보장 원칙에서 Redis 는 캐시이지 영속 저장소가 아니다. `§12.10 Rationale` 에서 이 trade-off 를 인식했는지 여부가 불명확하다.
- 제안: `17-agent-memory.md` 또는 `1-ai-agent.md §12.10` 에 "Redis TTL 만료 시 runningSummary 유실 처리 정책 (예: 재요약 없이 원문 재구성 fallback)" 을 명시. 또는 `ConversationThread.runningSummary` 를 `Execution.context jsonb` 컬럼에 포함시켜 DB 체크포인트 정책을 확립할 것을 권고.

### [INFO] `contextInjectionMode` 의 `summary_buffer`/`persistent` 분기 설명이 다중 추상화 레벨 혼재
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` `contextInjectionMode` 행
- 상세: 해당 행의 설명이 "주입 형식 선택" (Config 레벨 추상화)와 "memoryStrategy ∈ {summary_buffer, persistent} 시에는 최근 원문 turn 의 주입 형식으로만 의미를 갖고..." (실행 로직 레벨 구현 상세)를 하나의 셀에 혼합한다. Config 표는 사용자 설정 추상화를 기술해야 하고, 실행 로직 상세는 `§6.1` 에 있어야 한다. 두 레벨의 혼재는 향후 이 필드의 의미를 변경할 때 변경 범위를 모호하게 만든다.
- 제안: `§1` 표의 `contextInjectionMode` 비고를 "주입 형식. `memoryStrategy ≠ manual` 시 적용 범위 제한 — [§6.1 참조]" 로 단순화하고, 상세 조건은 `§6.1` 단계 1.5 에만 두어 Config 레이어와 실행 레이어를 분리.

### [INFO] `persistent` 메모리 추출의 비동기 격리 invariant 가 spec 에서 단일 위치에 정의되지 않음
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 2.7, `spec/5-system/17-agent-memory.md §추출`
- 상세: "background 격리는 `scheduleBackgroundBody` 의 turns snapshot shallow-copy 격리 invariant 를 준수한다" 는 기술이 `1-ai-agent.md §6.1` 에 있고, `17-agent-memory.md §추출` 도 동일 invariant 를 다룰 것으로 예상된다. Invariant 의 정의 SoT 가 두 곳에 분산되면 구현 시 어느 계약이 권위인지 불명확하다. 이는 모듈 경계(AI Agent 핸들러 vs AgentMemoryService) 를 가로지르는 계약이므로 인터페이스 분리 원칙(ISP) 측면에서 명확한 경계가 필요하다.
- 제안: background 격리 invariant 의 SoT 를 `17-agent-memory.md §추출` 로 확정하고, `1-ai-agent.md §6.1` 에서는 해당 섹션 링크 참조만 유지.

### [INFO] `systemContextSections` 허용 값 목록이 `0-common.md §11.1` 과 `1-ai-agent.md §1` 두 곳에 기술
- 위치: `spec/4-nodes/3-ai/0-common.md §11.1`, `spec/4-nodes/3-ai/1-ai-agent.md §1`
- 상세: `cross_spec.md` 일관성 검토에서도 동일 지적이 있었다. 현재는 값 목록이 동일하나, 개방-폐쇄 원칙(OCP) 관점에서 새 섹션 값 추가 시 두 곳을 수정해야 하는 구조는 확장에 폐쇄적이다.
- 제안: `1-ai-agent.md §1` 의 `systemContextSections` 행에서 허용 값 목록을 제거하고 `[공통 §11.1 참조](./0-common.md#111-설정-필드-3-노드-공통)` 로 교체.

---

## 요약

이번 변경은 AI Agent 에 `memoryStrategy` (manual / summary_buffer / persistent) 3단계 메모리 관리 전략을 추가하는 spec 정의 작업이다. 전반적인 아키텍처 방향성 — (1) `memoryStrategy` 를 `contextScope` enum 확장이 아닌 별도 직교 필드로 분리해 하위호환성 보존, (2) rolling summary 와 pgvector 회수 블록을 system_text 안정 프리픽스에 배치해 prompt cache 효율 극대화, (3) persistent 메모리를 `agent_memory` 별도 테이블로 격리해 conversation-thread "신규 DB 컬럼 없음" 조항 유지 — 은 SOLID 원칙과 레이어 책임 분리 측면에서 올바른 설계 결정이다. 그러나 가장 중대한 아키텍처 리스크는 `spec/5-system/17-agent-memory.md` 가 아직 완성되지 않은 상태에서 상위 노드 spec 들이 이를 SoT 로 참조한다는 점이다 — 이 역방향 의존성이 해소되지 않으면 구현자가 spec 공백을 코드로 채우게 되어 사후 drift 검증이 불가능해진다. 또한 무효화 규칙이 4개 위치에 분산 선언되고, `AgentMemoryService` 와 `RagSearchService` 간 서비스 경계가 미정이며, Redis-only rolling summary 의 내구성 정책이 누락된 점이 구현 단계 설계 표류의 씨앗이 될 수 있다.

---

## 위험도

HIGH

> 근거: `spec/5-system/17-agent-memory.md` 가 108줄 초안이지만 다수의 상위 spec 이 이를 "단일 진실"로 참조하는 구조적 역전(CRITICAL)이 해소되지 않으면, 구현 완료 후 spec 을 역추적 기술해야 하는 상황이 발생한다. 나머지 WARNING/INFO 는 단독으로는 MEDIUM 이하이나 CRITICAL 과 복합 시 설계 표류가 가속된다.
