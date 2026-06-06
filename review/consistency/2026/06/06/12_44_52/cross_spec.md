# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/17-agent-memory.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-06

---

## 발견사항

### [INFO] `LlmService.embed` 호출 표기 방식 — 위치 인자 순서 일치, 추가 확인 불필요

- target 위치: §4 비대칭 입력(inputType) callout
- 충돌 대상: `spec/5-system/7-llm-client.md §8.3`
- 상세: target은 회수 경로를 `LlmService.embed(config, texts, model?, opts?, 'query')`, 저장 경로를 `inputType:'document'` 로 호출한다고 기술한다. LLM 클라이언트 §8.3의 실제 서비스 시그니처 `embed(config, texts, model?, opts?, inputType?)` 및 호출 예시 `embed(config, texts, model, undefined, 'query')` 와 위치 인자 순서가 정확히 일치한다.
- 제안: 모순 없음. 동기화 확인 완료.

### [INFO] `information_extractor`의 `memoryStrategy` enum 값 범위 — target과 IE spec 간 명시적 일치

- target 위치: §Overview (둘째 문단) 및 producer/consumer 노드 callout
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §7`, `spec/4-nodes/3-ai/1-ai-agent.md §1`
- 상세: target §Overview는 `information_extractor`가 `summary_buffer` 없이 회수+추출 레이어만 적용한다고 기술한다. IE spec §1의 `memoryStrategy` 필드 정의는 `manual / persistent` 두 값만 허용하고 `summary_buffer`를 명시 제외하며, §Rationale 9.1에서 그 근거를 상세히 기술한다. AI Agent spec §1에서는 `manual / summary_buffer / persistent` 세 값을 허용한다. 세 문서의 enum 값 범위가 노드 특성에 따라 의도적으로 다르게 정의되어 있고, target이 그 차이를 명시적으로 설명하고 있다.
- 제안: 모순 없음. 의도된 차이로 확인됨.

### [INFO] 관리 API RBAC (viewer+/editor+) — 세 문서 간 일치

- target 위치: §6 메모리 관리 API 표 및 격리 절
- 충돌 대상: `spec/2-navigation/16-agent-memory.md`, `spec/2-navigation/_product-overview.md §3.13`
- 상세: target §6은 `GET /agent-memories/scopes`와 `GET /agent-memories`에 viewer+, `DELETE /agent-memories/:id`와 `DELETE /agent-memories?scopeKey=`에 editor+를 요구한다. 네비게이션 spec §2에서 "읽기 권한: 화면 진입·조회는 워크스페이스 멤버(viewer+). 삭제 액션은 editor+ (RoleGate)" 로 동일하게 명시하고, NAV-AM-06도 이를 요구사항으로 확정한다.
- 제안: 모순 없음.

### [INFO] `agent_memory` 인덱스 목록 — target과 데이터 모델 §3 간 완전 일치

- target 위치: §1 인덱스 문단 (V073, V080, V086 언급)
- 충돌 대상: `spec/1-data-model.md §3 인덱스 전략` (AgentMemory 행)
- 상세: target §1이 정의하는 네 인덱스 `(workspace_id, scope_key, created_at)`, `pgvector partial HNSW/IVFFlat`, `expires_at partial WHERE IS NOT NULL`, `(workspace_id, scope_key, updated_at)`가 데이터 모델 §3의 AgentMemory 인덱스 목록과 마이그레이션 버전(V073, V080, V086)까지 동일하게 기재되어 있다.
- 제안: 모순 없음.

### [INFO] `agent_memory` 엔티티 필드 정의 — target과 데이터 모델 §2.23 간 일치

- target 위치: §1 데이터 모델 표
- 충돌 대상: `spec/1-data-model.md §2.23 AgentMemory`
- 상세: target §1의 7개 컬럼 (`id`, `workspace_id`, `scope_key`, `content`, `embedding`, `metadata`, `created_at`, `updated_at`, `expires_at`)이 데이터 모델 §2.23의 정의와 타입·설명이 모두 일치한다. `metadata.kind` 분류값(`fact/preference/entity`)도 일치. forgetting 정책(FIFO/LRU, `AGENT_MEMORY_MAX_PER_SCOPE=1000`)도 동일하게 기재되어 있다.
- 제안: 모순 없음.

### [INFO] AGM 요구사항 ID 충돌 없음

- target 위치: 각 §의 요구사항 블록 (`AGM-01`~`AGM-13`)
- 충돌 대상: spec 전역
- 상세: `AGM-01`~`AGM-13` ID를 spec 전역에서 검색한 결과 `spec/5-system/17-agent-memory.md` 외에서는 사용되지 않는다. 다른 영역의 요구사항 ID 체계(`NAV-AM-*`, `ND-*`, `ED-*` 등)와 중복 없음.
- 제안: 모순 없음.

### [INFO] `text_classifier` 메모리 대상 제외 — 세 문서 간 일치

- target 위치: §Overview producer/consumer 노드 callout 마지막 문장
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §Rationale 9.2`
- 상세: target은 "`text_classifier` 는 single-turn·상태없음으로 메모리 대상 아님"이라 기술한다. IE spec §Rationale 9.2도 동일하게 "text_classifier 는 single-turn·상태없는 분류기로 persistent 메모리 대상에서 제외"라 기술하여 정합하다.
- 제안: 모순 없음.

### [INFO] scope key 해석 — target과 AI Agent spec, IE spec 간 동일 규약

- target 위치: §2 스코프 키
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §1`, `spec/4-nodes/3-ai/3-information-extractor.md §7.1`
- 상세: target은 `resolveScopeKey(memoryKey, executionId)` 규칙을 정의한다. AI Agent spec §6.1과 IE spec §7.1 모두 동일한 `scopeKey = resolveScopeKey(memoryKey, executionId)` 표현식을 사용하고, 미설정 시 `executionId` fallback을 일치시킨다.
- 제안: 모순 없음.

### [INFO] 임베딩 모델 폴백 체인 — target과 AI Agent spec 간 일치

- target 위치: §1 (임베딩 차원·모델 단락), §3 (임베딩 출처 단락)
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §1 embeddingModel 필드`
- 상세: target은 `embeddingModel` 우선순위를 `노드 config embeddingModel → 워크스페이스 기본 LLMConfig → 하드코딩 기본(text-embedding-3-small)`으로 정의한다. AI Agent spec §1의 `embeddingModel` 필드 설명도 "미설정 시 워크스페이스 기본 LLMConfig 임베딩 모델 → 최후 하드코딩 기본(`text-embedding-3-small`)으로 폴백"으로 동일하다.
- 제안: 모순 없음.

### [INFO] dedup UPDATE 시 `expires_at` 재설정 정책 — target과 데이터 모델 §2.23 간 세부 동기화 권장

- target 위치: §4 의미기반 dedup/갱신 단락 (`ttlDays` 제공 시에만 재설정)
- 충돌 대상: `spec/1-data-model.md §2.23 AgentMemory` 의미 dedup/갱신 설명
- 상세: target §4는 dedup UPDATE 시 `expires_at`을 "`ttlDays`(노드 `memoryTtlDays`)가 제공된 경우에만 `now() + ttlDays`로 재설정, 미제공 시 기존 `expires_at`을 보존"이라고 세밀하게 정의한다. 데이터 모델 §2.23의 dedup/갱신 설명은 "content/embedding/metadata/`updated_at=now()`"만 열거하고 `expires_at` 재설정 조건을 기술하지 않아, 이 세부 정책이 누락되어 있다. 직접 모순은 아니지만 §2.23에서 이 조건을 읽는 독자는 `expires_at`이 항상 리셋될 수 있다고 오해할 수 있다.
- 제안: `spec/1-data-model.md §2.23`의 "의미 dedup/갱신" 설명에 `ttlDays` 제공 여부에 따른 `expires_at` 처리 조건을 한 문장 추가하거나, target §4를 SoT로 참조하도록 링크를 추가한다.

---

## 요약

`spec/5-system/17-agent-memory.md`는 데이터 모델(`spec/1-data-model.md §2.23`), AI Agent 노드 spec(`spec/4-nodes/3-ai/1-ai-agent.md`), Information Extractor spec(`spec/4-nodes/3-ai/3-information-extractor.md §7`), LLM 클라이언트 spec(`spec/5-system/7-llm-client.md §8.3`), 임베딩 파이프라인 spec(`spec/5-system/8-embedding-pipeline.md §5.4`), 네비게이션 spec(`spec/2-navigation/16-agent-memory.md`) 과의 교차 검토에서 CRITICAL 또는 WARNING 수준의 모순이 발견되지 않았다. 요구사항 ID(AGM-01~13)는 spec 전역에서 중복 없이 단독 사용된다. RBAC(viewer+/editor+), 스코프 키 규약, 임베딩 모델 폴백 체인, 인덱스 목록, 엔티티 필드 정의 모두 관련 spec과 일치한다. 유일한 개선 여지는 `spec/1-data-model.md §2.23`의 dedup UPDATE 설명에 `expires_at` 재설정 조건(`ttlDays` 유무)이 누락된 INFO 수준 사항으로, 그 자체가 시스템 작동을 깨지는 않는다.

---

## 위험도

NONE

STATUS: OK
