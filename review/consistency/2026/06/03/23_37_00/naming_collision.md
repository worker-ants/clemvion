# 신규 식별자 충돌 Check 결과

검토 범위: `spec/4-nodes/3-ai/` (diff-base: origin/main)  
검토 일시: 2026-06-03

---

## 발견사항

충돌로 판정되는 항목 없음. 아래는 점검한 주요 신규 식별자 전수와 INFO 수준 관찰이다.

---

### 점검 결과

#### 요구사항 ID

신규 도입: `ND-AG-27`, `ND-AG-28`, `ND-AG-29`, `ND-AG-30` (`spec/4-nodes/3-ai/_product-overview.md` + `spec/4-nodes/_product-overview.md`)  
이전 최고 번호: `ND-AG-26` (origin/main 기준)  
결과: 순차 부여, 양쪽 overview 동시 추가, 충돌 없음.

신규 도입: `AGM-01` ~ `AGM-07` (`spec/5-system/17-agent-memory.md`)  
동일 prefix `AGM-` 는 이전에 어느 spec 파일에도 존재하지 않았음. 충돌 없음.

#### 엔티티/타입명

- **`AgentMemory`** (`spec/1-data-model.md §2.23`, 신규 섹션): 기존 `spec/1-data-model.md` 에 `§2.22 AssistantMessage` 가 마지막 섹션이었고 `AgentMemory` 명칭은 어떤 섹션에도 존재하지 않았음. 코드베이스 `codebase/backend/src/modules/agent-memory/entities/agent-memory.entity.ts` 에 이미 구현된 클래스(`AgentMemory`)가 있으나 spec 에는 미반영된 상태였으므로, 본 diff 는 spec 소급 반영이다. 동일 이름이 다른 의미로 쓰이지 않음.
- **`memoryStrategy`** (새 config 필드): `spec/` 전체에서 `memoryStrategy` 는 `spec/4-nodes/3-ai/`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md`, `spec/4-nodes/_product-overview.md` 외 사용처 없음. `manual` 값이 `meta.source: 'manual'` (Trigger) 및 `redirect: 'manual'` (HTTP Request) 과 표면상 동음이의이지만, 각각 별개 필드(`memoryStrategy` vs `meta.source` vs fetch 옵션)에 속하므로 namespace 충돌 아님.
- **`memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`** (새 config 필드): spec 전체에서 위 파일들 외 사용처 없음. `memoryTopK` / `memoryThreshold` 가 기존 `ragTopK` / `ragThreshold` 와 네이밍 패턴이 유사하지만 spec 자체에서 명시적으로 "독립" 임을 선언하고 있음. 충돌 없음.
- **`PresentationToolDef`, `PresentationPayload`** (`spec/4-nodes/3-ai/1-ai-agent.md §7.10`): 이미 origin/main 에 존재했던 식별자이며 이번 diff 에서 신규 도입된 것이 아님. 충돌 대상 아님.

#### meta 필드

- **`meta.memory`** 신규 도입 (`spec/4-nodes/3-ai/1-ai-agent.md §7.1`): spec 전체에서 `meta.memory` 는 본 target 문서 외 어디에도 정의되지 않음. Information Extractor, Text Classifier 의 meta 필드군과 겹치는 이름 없음. 충돌 없음.

#### API endpoint / WebSocket 이벤트

이번 diff 는 새 HTTP endpoint 또는 WebSocket 이벤트 이름을 도입하지 않음.

#### 환경변수 / 설정키

내부 상수 `DEFAULT_MEMORY_TOKEN_BUDGET`, `DEFAULT_MEMORY_TOP_K`, `DEFAULT_MEMORY_THRESHOLD` 는 코드 상수이며 process-level ENV var 이름이 아님. 환경변수 충돌 없음.

#### 파일 경로

- `spec/5-system/17-agent-memory.md` (신규): 직전 파일 `16-system-status-api.md` 에서 순차 번호 할당. 명명 컨벤션(`N-name.md`) 준수. 충돌 없음.

---

### [INFO] `memoryTopK` / `memoryThreshold` 이름 패턴이 `ragTopK` / `ragThreshold` 와 유사

- target 신규 식별자: `memoryTopK`, `memoryThreshold` (`spec/4-nodes/3-ai/1-ai-agent.md §1`)
- 기존 사용처: `ragTopK`, `ragThreshold` 동일 config 테이블 안 기존 필드
- 상세: 이름 패턴이 동형이어서 처음 보는 빌더가 혼동할 여지가 있다. 다만 spec 자체에서 "persistent 메모리 회수 전용 — KB 검색용 `ragTopK`/`ragThreshold` 와 독립 (검색 대상: agent_memory vs KnowledgeBase)" 를 명시하고 있어 의미 분리는 문서화되어 있음. 기능 충돌 아님.
- 제안: 특별한 변경 불필요. UI 레이블에서 "Memory Top-K (회수)" vs "RAG Top-K (KB 검색)" 으로 구분해주면 혼선 예방에 충분.

---

## 요약

`spec/4-nodes/3-ai/` 가 이번 diff 에서 도입한 신규 식별자들 (`ND-AG-27~30`, `AGM-01~07`, `memoryStrategy`, `memoryTokenBudget`, `memoryKey`, `memoryTopK`, `memoryThreshold`, `meta.memory`, `AgentMemory` 엔티티, `spec/5-system/17-agent-memory.md`) 은 기존 spec 어디에서도 다른 의미로 사용되지 않는다. `AgentMemory` 는 코드베이스에 이미 구현된 엔티티를 소급 spec 반영한 것이며 명칭 충돌이 아니다. `memoryTopK`/`memoryThreshold` 가 `ragTopK`/`ragThreshold` 와 이름 패턴이 유사하지만 동일 config 블록 안에서 명확히 구분 서술되어 있어 실질적 혼선 위험은 낮다. 전체 식별자 충돌 위험은 NONE 이다.

## 위험도

NONE
