# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [INFO] `graphTraversal` — API 응답 필드명과 내부 서비스 private 필드 이름 중복

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §4.3` 에서 정의한 RAG 검색 응답 JSON 최상위 필드 `graphTraversal` (타입 `GraphTraversalSummary`)
- **기존 사용처**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:845` — `ExecutionEngineService` 의 private 필드 `private readonly graphTraversal: GraphTraversalService` (워크플로 그래프 순회 서비스 인스턴스)
- **상세**: 두 식별자는 서로 다른 도메인(KB RAG 검색 응답 payload vs 실행 엔진 내부 서비스)에 위치해 실제 런타임 충돌은 없다. 그러나 이름 독해 시 혼동이 생길 수 있고, 코드베이스 자체도 `execution-engine.service.ts:593` 주석에서 이 모호성을 인식해 별도 명시하고 있다 (`GraphTraversalSummary (knowledge-base RAG) 와 의미 분리 — 본 타입은 execution-engine 의 워크플로 graph 재구축 결과만 담는다`). spec 에는 해당 disambiguation 이 없어 spec 독자 입장에서 혼동 가능성이 남는다.
- **제안**: `spec/5-system/10-graph-rag.md §4.3` 또는 해당 타입 정의 위치(`search-result.interface.ts`)에 "본 `graphTraversal` 필드 / `GraphTraversalSummary` 는 KB RAG 검색 응답 전용이며 `execution-engine/graph/graph-traversal.service.ts` 의 `GraphTraversalService` 와 관계없다"는 disambiguation 한 줄을 추가.

---

### [INFO] `GraphExtractionService` vs `GraphExtractionProcessor` — spec 내 명칭 불일치

- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §3.2` 섹션 제목 및 Overview 행은 `GraphExtractionProcessor` 를 사용하지만, 같은 파일 §2 Overview 표 ("그래프 추출 파이프라인" 셀)에서 `GraphExtractionService` 를 호출하는 주체로 명시
- **기존 사용처**: 코드베이스에서 두 클래스 모두 실제로 존재 — `GraphExtractionProcessor` (`knowledge-base/queues/graph-extraction.processor.ts:34`: BullMQ worker host) 와 `GraphExtractionService` (`knowledge-base/graph/graph-extraction.service.ts:81`: 실제 추출 로직). spec §3.2 헤딩은 Processor 이름이지만 내부 설명은 Service 수준 동작을 서술한다.
- **상세**: 충돌 수준의 문제는 아니고, spec 이 두 클래스를 혼용해 서술하는 일관성 문제다. 독자가 "§3.2 GraphExtractionProcessor" 를 읽으며 Service 동작 설명을 보면 어느 클래스를 가리키는지 불명확하다.
- **제안**: spec §3.2 섹션 헤딩을 `GraphExtractionProcessor / Service 흐름` 으로 수정하거나, 헤딩은 `GraphExtractionProcessor` 를 유지하면서 본문 첫 줄에 "Processor 가 `GraphExtractionService.extractDocument` 를 호출한다" 는 관계를 명시.

---

### [INFO] `model_config.*` Planned 감사 액션 — 구 `llm_config.*` / `rerank_config.*` 잔존

- **target 신규 식별자**: `spec/5-system/1-auth.md §4.1` Planned 표의 `model_config.*` (create/update/delete/set-default) — 통합 전 `llm_config.*` / `rerank_config.*` 를 대체하는 미래 액션
- **기존 사용처**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:15` 주석이 `llm_config.*` · `rerank_config.*` 를 미구현으로 명시. `spec/data-flow/1-audit.md:69` 도 동일하게 `llm_config.*`/`rerank_config.*` 를 언급
- **상세**: spec 에서 `model_config.*` 로 통합한다고 선언했지만, DB 에 이미 적재된 `llm_config.*` / `rerank_config.*` row 가 있을 경우 쿼리 시 OR 결합이 필요하다는 점이 `1-auth.md §4.1` 각주에만 기술되고 `audit-action.const.ts` 코멘트와 `data-flow/1-audit.md` 에서는 구 이름이 "미구현 Planned" 으로 혼재한다. 이로 인해 구현 시점에 어느 action 이름을 써야 하는지 const 파일에서 바로 확인하기 어렵다.
- **제안**: 현재 INFO 수준으로 차단 필요 없음. 구현 시점에 `AUDIT_ACTIONS` 에 `MODEL_CONFIG_*` 키를 추가하면서 `audit-action.const.ts` 주석도 `model_config.*` 로 갱신하는 것을 권장. spec `1-auth.md §4.1` 의 통합 근거 각주가 이미 충분히 설명하고 있으므로 spec 변경 불필요.

---

## 요약

`spec/5-system` 이 도입하는 신규 식별자(WebAuthn 에러 코드, MCP 환경변수, Graph RAG 엔드포인트/이벤트/데이터 타입, 감사 액션 상수 등)는 기존 영역과 동일한 값으로 다른 의미를 가지는 CRITICAL 수준 충돌이 없다. 발견된 세 항목은 모두 INFO 수준이다: `graphTraversal` 이름이 KB RAG 응답 필드(spec 신규)와 실행 엔진 내부 서비스 변수(기존 코드)에서 동시에 사용되나 도메인이 분리돼 런타임 충돌이 없고, spec §3.2 에서 `GraphExtractionProcessor`·`GraphExtractionService` 명칭이 혼용되나 실제 클래스와 대응이 가능하며, Planned 감사 액션 `model_config.*` 의 구 이름(`llm_config.*`/`rerank_config.*`) 잔존은 구현 시점에 정리하면 되는 수준이다.

## 위험도

LOW
