# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 문서 구조 및 dead-declared 이벤트 비대칭에 대한 경고 2건, 데이터 정합성 INFO 수준 이슈 다수. 기능 동작 차단 수준의 결함 없음.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `## Overview` 섹션이 요구사항·도입 계획·의존성·미결 사항까지 포함해 "Overview / 본문 / Rationale 3섹션" 권장 구조 위반 | `spec/5-system/10-graph-rag.md` — `## Overview (제품 정의)` 하위 `### 3. 요구사항` ~ `### 8. 미결 / 후속 검토` | CLAUDE.md "정보 저장 위치" 규약 (`## Overview` = 제품 정의·요구사항 진입; 기술 명세는 본문 섹션) | `### 3. 요구사항` ~ `### 8. 미결 / 후속 검토` 를 최상위 `##` 섹션(본문)으로 분리하거나 기존 `## 1. 개요` ~ `## 8. 비-목표` 와 통합해 Overview 를 제품 정의·목표·범위로만 제한 |
| 2 | Naming Collision | `document:graph_error` 가 타입 union 에만 dead-declared 되어 실제 emit 없음 — `document:embedding_error` (실제 emit)와 비대칭 | `spec/5-system/10-graph-rag.md` §3.2 KB-GR-OB-02, §6 이벤트 표 | `spec/5-system/8-embedding-pipeline.md §8.1` (`document:embedding_error` 실 emit 정의) | `document:graph_error` 를 타입 union 에서 제거하거나 실제 emit 로 전환. 최소한 `spec/5-system/6-websocket-protocol.md §8.2` 그래프 이벤트 참조에 dead-declared 사실 동기화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/10-graph-rag.md §2.1` KnowledgeBase 추가 컬럼 표에서 `reextract_status` 누락 — §7 에러 처리가 동일 컬럼을 참조해 문서 내 자기 모순 발생 | `§2.1` 컬럼 표 vs `§7` 에러 처리 표, `spec/1-data-model.md §2.11`, `spec/data-flow/6-knowledge-base.md` | `§2.1` 표에 `reextract_status \| Enum \| KB 전체 그래프 재추출 잠금: idle / in_progress (default: idle). vector 모드에서는 사용 안 함` 행 추가 |
| 2 | Cross-Spec | `§4.3` `ragSources[]` 예시 JSON 의 키 순서가 `spec/5-system/9-rag-search.md §4.1` 정의 순서와 불일치 (`chunkId→documentId→...` vs `documentId→documentName→chunkId→...`) | `spec/5-system/10-graph-rag.md §4.3` 예시 JSON | `§4.3` 예시 JSON 키 순서를 `9-rag-search.md §4.1` 정의 순서와 일치시키거나 SoT 주석을 더 두드러지게 유지 |
| 3 | Rationale Continuity | `"chunk"` 필드명 → `"content"` 교정 및 SoT 교차 참조 추가는 Rationale 원칙을 오히려 강화하는 변경 — 추가 조치 불필요 | `spec/5-system/10-graph-rag.md §4.3` | 없음 |
| 4 | Convention Compliance | 관련 문서 링크 `[PRD Graph RAG](./10-graph-rag.md)` 가 자기 파일을 가리키는 self-link | 문서 상단 "관련 문서" 블록 | PRD 가 별도 파일로 존재하지 않으면 자기 참조 항목 삭제 |
| 5 | Convention Compliance | `## Overview (제품 정의)` — 표제어에 부제 병기, 다른 spec 문서는 `## Overview` 만 사용 | `spec/5-system/10-graph-rag.md` line 51 | `## Overview` 로 단순화 |
| 6 | Plan Coherence | `rag-dynamic-cut`·`rag-followup-efsearch` 두 plan 이 `10-graph-rag.md` 를 `spec_impact` 로 등록했으나 각각 PR #500·#503 으로 MERGED. target 변경과 직교(무충돌) | `plan/in-progress/rag-dynamic-cut.md`, `plan/in-progress/rag-followup-efsearch.md` | 두 plan 을 `plan/complete/` 로 이동 검토 |
| 7 | Naming Collision | `Entity`/`Relation`/`ChunkEntity` 스키마가 `spec/1-data-model.md §2.12.2~§2.12.4` 와 이중 정의 | `spec/5-system/10-graph-rag.md §2.3~§2.5` | 향후 spec 갱신 시 `§2.3~§2.5` 를 요약 참조형으로 전환해 단일 진실 원칙 유지 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `reextract_status` 컬럼 누락(문서 내 자기 모순 + data-model 불일치), `ragSources` 예시 키 순서 불일치 — 모두 INFO |
| Rationale Continuity | NONE | `"chunk"` → `"content"` 교정 및 SoT 주석 추가가 Rationale 원칙과 완전 정합. 기각 대안 재도입·합의 원칙 위반 없음 |
| Convention Compliance | LOW | Overview 섹션 비대 구조(WARNING), self-link 및 표제어 부제 병기(INFO) |
| Plan Coherence | NONE | 진행 중 plan 과 충돌 없음. MERGED plan 2건 cleanup 권장 |
| Naming Collision | LOW | `document:graph_error` dead-declared 비대칭(WARNING), `Entity`/`Relation`/`ChunkEntity` 이중 정의(INFO) |

## 권장 조치사항

1. **(WARNING 해소 — 문서 구조)** `spec/5-system/10-graph-rag.md` 의 `## Overview (제품 정의)` 아래 `### 3. 요구사항` ~ `### 8. 미결 / 후속 검토` 를 최상위 `##` 본문 섹션으로 분리하고, 표제어를 `## Overview` 로 단순화.
2. **(WARNING 해소 — dead-declared 이벤트)** `document:graph_error` 처리 방향을 결정: 타입 union 에서 제거하거나 실제 emit 로 전환. 결정 내용을 `spec/5-system/6-websocket-protocol.md` 그래프 이벤트 참조에 동기화.
3. **(INFO — 내부 모순 해소)** `§2.1` KnowledgeBase 추가 컬럼 표에 `reextract_status` 행 추가해 `spec/1-data-model.md §2.11` 및 `spec/data-flow/6-knowledge-base.md` 와 동기화.
4. **(INFO — 예시 정합)** `§4.3` `ragSources[]` 예시 JSON 키 순서를 `9-rag-search.md §4.1` 정의 순서와 일치.
5. **(INFO — 문서 정리)** 관련 문서 블록의 self-link `[PRD Graph RAG](./10-graph-rag.md)` 삭제.
6. **(INFO — plan 정리)** `plan/in-progress/rag-dynamic-cut.md`, `plan/in-progress/rag-followup-efsearch.md` 를 `plan/complete/` 로 이동.
7. **(INFO — 장기)** `§2.3~§2.5` Entity/Relation/ChunkEntity 정의를 요약 참조형으로 전환해 `spec/1-data-model.md §2.12` 를 단일 SoT 로 유지.