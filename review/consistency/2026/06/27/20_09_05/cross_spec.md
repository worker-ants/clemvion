# Cross-Spec 일관성 검토 — graph-rag-doc-fix

**대상**: `plan/in-progress/graph-rag-doc-fix.md` (spec draft)
**실제 변경 파일**: `spec/5-system/10-graph-rag.md` (line 25 관련 문서 링크 교체, `## 1. 개요` 헤딩 무변경)
**검토 모드**: `--spec`

---

## 발견사항

발견된 충돌 없음.

---

## 확인 사항 (충돌 없음 근거)

### 1. 데이터 모델 충돌
변경 없음. `10-graph-rag.md` 의 엔티티·필드 정의 (`Entity`, `Relation`, `ChunkEntity`, `KnowledgeBase.rag_mode` 등)는 `spec/1-data-model.md §2.12.2–§2.12.4` 및 `§2.11` 과 모순 없음. 이번 변경이 데이터 모델에 관여하지 않는다.

### 2. API 계약 충돌
변경 없음. 엔드포인트·메서드·request/response shape 수정 없음.

### 3. 요구사항 ID 충돌
새 요구사항 ID 부여 없음.

### 4. 상태 전이 충돌
상태 머신 변경 없음.

### 5. 권한·RBAC 모델 충돌
권한 구조 변경 없음.

### 6. 계층 책임 충돌
계층 책임 변경 없음.

### 7. 링크 교체의 양방향 정합성

**교체 전**: `[PRD Graph RAG](./10-graph-rag.md)` — self-link (파일이 자기 자신을 가리킴).

**교체 후**: `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)`

- 대상 파일 `spec/4-nodes/3-ai/_product-overview.md` 실재 확인됨 (`# PRD: AI & 지식 저장소` 시작, Graph RAG 를 `10-graph-rag.md` 로 위임 명시 — `Graph RAG 검색 모드는 [PRD 9 Graph RAG](../../5-system/10-graph-rag.md) 에 별도 정의.`).
- 형제 spec `spec/5-system/8-embedding-pipeline.md` (line 15) 과 `spec/5-system/9-rag-search.md` (line 16) 모두 동일 `[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)` 패턴을 이미 사용 중 — 교체 후 세 파일 관련문서 블록이 동일 컨벤션으로 통일됨.
- `## 1. 개요` 헤딩 유지: 형제 8·9 가 `## 1. 개요` 를 공통으로 사용하고 있어 컨벤션 일치.

### 8. 외부 참조 무결성

`10-graph-rag.md` 를 가리키는 다른 spec 들 (`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/_product-overview.md`, `spec/4-nodes/4-integration/_product-overview.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/data-flow/6-knowledge-base.md`, `spec/5-system/13-replay-rerun.md`)의 참조는 파일 경로·섹션 앵커를 가리키며, 이번 변경(관련문서 블록 내부 링크 교체 + 헤딩 유지)은 그 어느 외부 참조도 무효화하지 않는다.

---

## 요약

이번 변경은 `spec/5-system/10-graph-rag.md` 내 관련문서 블록의 self-referential 링크(`[PRD Graph RAG](./10-graph-rag.md)`) 를 형제 spec(8·9)과 동일한 공유 PRD 링크(`[PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md)`)로 교체하는 단순 문서 정합 수정이다. 데이터 모델·API 계약·요구사항 ID·상태 전이·권한·계층 책임 중 어느 하나도 변경되지 않으며, 기존 spec 어느 영역과도 충돌하지 않는다. 오히려 self-link anomaly 를 제거하고 컨벤션을 통일해 일관성을 향상시킨다.

---

## 위험도

NONE
