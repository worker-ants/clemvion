---
id: knowledge-base
status: implemented
code:
  - codebase/frontend/src/app/(main)/knowledge-bases/page.tsx
  - codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx
  - codebase/frontend/src/components/knowledge-base/*.tsx
---

# Spec: 지식 저장소 화면

> 관련 문서: [PRD 내비게이션](./_product-overview.md#35-knowledge-base-지식-저장소) · [PRD 통합/연동](../4-nodes/4-integration/_product-overview.md#3-knowledge-base-지식-저장소) · [PRD Graph RAG](../5-system/10-graph-rag.md) · [Spec 레이아웃](./_layout.md) · [Spec Graph RAG](../5-system/10-graph-rag.md) · [데이터 모델 - KnowledgeBase](../1-data-model.md#211-knowledgebase)

---

## 1. 화면 구조

```
┌──────────────────────────────────────────────────────────────┐
│  Knowledge Base                   [+ New Collection]        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📚 Customer Support FAQ                                  ││
│  │    12 documents · 2,340 chunks · ✅ Ready         ⋮     ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 📚 Product Manual                                        ││
│  │    5 documents · 890 chunks · 🔄 Processing (2/5) ⋮     ││
│  ├──────────────────────────────────────────────────────────┤│
│  │ 📚 Internal Policies                                     ││
│  │    3 documents · 450 chunks · ✅ Ready             ⋮     ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 기능 상세

### 2.1 컬렉션 목록

| 요소 | 설명 |
|------|------|
| 컬렉션 이름 | 클릭 시 컬렉션 상세 화면으로 이동 |
| 문서 수 | 포함된 문서 개수 |
| 청크 수 | 생성된 벡터 청크 총 개수 |
| 임베딩 상태 | Ready(✅) / Processing(🔄) / Retrying(🔄 회전·warning, 자동 재시도 중) / Failed(❌, 최종 실패 — 재시도 버튼 필요) |
| 더보기(⋮) | 설정, 삭제 |

### 2.2 컬렉션 생성

| 필드 | 설명 |
|------|------|
| 이름 | 컬렉션 이름 (필수) |
| 설명 | 컬렉션 설명 (선택) |
| 검색 모드 | `vector` (기본) / `graph` 중 선택. **생성 시에만 결정, 사후 변경 불가** |
| 임베딩 모델 | 지정된 LLMConfig (미지정 시 워크스페이스 default) 의 임베딩 모델 목록을 "모델 불러오기" 버튼으로 조회한 뒤 select 로 선택. 자유 텍스트 입력은 허용하지 않는다. 미로드 / 조회 실패 시 select 비활성, 에러 메시지만 표시 ([설정 화면 §B.2 Rationale R-1](./6-config.md#r-1-기본-모델-선택을-select-only-로-한정) 의 결정을 그대로 적용) |
| 추출 LLM | `graph` 모드 일 때만 표시. 그래프 추출에 사용할 LLMConfig 의 chat 모델. 미지정 시 워크스페이스 default |
| 청크 크기 | 문서 분할 청크 크기 (기본: 1000 토큰) |
| 청크 오버랩 | 청크 간 오버랩 (기본: 200 토큰) |
| 그래프 검색 파라미터 | `graph` 모드 일 때만 표시. `maxHops` (1/2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) |
| 리랭킹 (Reranking) | (Planned, 선택) 검색 후처리 정밀화. `Off` (기본) / `Cross-encoder` / `Cross-encoder + LLM`. **사후 변경 가능** (검색 시점 적용, 재임베딩 불요). `Off` 아닐 때만 하위 필드 노출 — Reranker(RerankConfig 선택), Candidate pool (기본 50), Score cutoff (비우면 컷 없음), Grading LLM (`Cross-encoder + LLM` 시). 상세: [Spec RAG 검색 §3.3](../5-system/9-rag-search.md#33-검색-후처리--리랭킹-선택적) |

> 모드별 도움말은 폼에 인라인 안내로 표시: vector 는 "유사도 기반 단순 검색", graph 는 "entity·relation 추출 후 그래프 탐색을 결합 — 추출 LLM 호출이 추가 비용으로 발생". 리랭킹은 "Off(기본)면 동작 변화 없음 — 리랭커 설정 시에만 검색 정밀화. 셀프호스팅(TEI) 또는 외부 API(Cohere/Jina 등) 사용".

> **리랭커 provider 설정(RerankConfig)** 은 워크스페이스 설정 화면에서 LLMConfig 와 동일 패턴으로 관리한다 (provider·endpoint·모델·API Key). KB 폼의 "Reranker" select 는 워크스페이스 RerankConfig 목록에서 선택한다. 엔티티: [Spec 데이터 모델 §2.16.1](../1-data-model.md#2161-rerankconfig-planned).

### 2.2.1 컬렉션 카드 (목록)

`vector` / `graph` 모드 배지를 카드 우측 상단에 표시. graph 모드 카드는 entity / relation 카운트도 함께 노출.

```
┌──────────────────────────────────────────────────────────┐
│ 📚 Customer Support FAQ                       [vector]   │
│    12 documents · 2,340 chunks · ✅ Ready          ⋮     │
├──────────────────────────────────────────────────────────┤
│ 📚 Product Knowledge Graph                    [graph]    │
│    5 docs · 890 chunks · 1,240 entities · 3,802 rels    │
│    🔄 Processing graph (2/5)                       ⋮     │
└──────────────────────────────────────────────────────────┘
```

### 2.3 컬렉션 상세 화면 (문서 관리)

```
┌──────────────────────────────────────────────────────────────┐
│  ← Knowledge Base / Customer Support FAQ                     │
│                                          [Upload Documents]  │
│                                                              │
│  ┌──────────────────┐                                        │
│  │ 🔍 Search docs.. │                                        │
│  └──────────────────┘                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📄 faq-general.md          MD    45KB   ✅ Ready     ⋮  ││
│  │ 📄 faq-billing.pdf         PDF   1.2MB  ✅ Ready     ⋮  ││
│  │ 📄 faq-technical.txt       TXT   23KB   🔄 Processing⋮  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 2.4 문서 항목

| 요소 | 설명 |
|------|------|
| 파일 아이콘 | 파일 유형별 아이콘 |
| 파일 이름 | 클릭 시 미리보기 패널 |
| 파일 유형 | MD / PDF / TXT / CSV |
| 파일 크기 | 표시 |
| 임베딩 상태 | Ready / Processing / Retrying (in-flight 자동 재시도) / Failed (최종 실패). `embedding_retry_count > 0` 일 때 hover tooltip 으로 `embedding_error_message` + 재시도 카운트 노출 |
| 그래프 추출 상태 | graph 모드 KB 일 때만 추가 표시. 의미는 임베딩과 동일 |
| 더보기(⋮) | 미리보기, 재임베딩, 삭제 |

### 2.4.1 진행 박스 (KB 상세 상단)

- **임베딩 진행 박스** (vector / graph 무관): "완료 {completed} / 전체 {total}" + 실패가 있으면 "{failed} 실패" + RoleGate(editor) 의 [실패 문서 재시도] 버튼. 5s polling (진행 중) / 1분 polling (완료된 상태).
- **그래프 추출 박스** (graph 모드 KB 만): "{extracted}개 문서 추출 완료 / {total}" + "{failed} 실패" + [실패 문서 재시도] 버튼 + entity/relation 카운트. 동일 polling 정책.
- 버튼 클릭 → ConfirmModal → `POST /api/knowledge-bases/:id/retry-failed { scope: 'embedding' | 'graph' | 'all' }`. 응답 시 toast 로 "{embedding}개 임베딩 · {graph}개 그래프 추출을 재시도해요". UI 는 vector / graph 두 분리 버튼이라 `scope: 'embedding'` 또는 `'graph'` 만 전송, `'all'` 은 운영/스크립트용.
- 백엔드의 `document:embedding_retry`·`graph_retry`·`*_failed`·`*_completed` 이벤트를 `useKbEvents` 가 수신해 즉시 React Query 캐시 invalidate. WS 단절 시 polling fallback.

### 2.5 문서 업로드

- "**Upload Documents**" 버튼 또는 드래그 앤 드롭
- 지원 형식: .txt, .md, .pdf, .csv
- 다중 파일 동시 업로드 지원
- 업로드 후 자동으로 벡터 임베딩 시작
- 업로드 진행률 표시

### 2.6 문서 미리보기

- 우측 슬라이드 패널로 문서 내용 표시
- PDF: 페이지별 렌더링
- 텍스트/Markdown: 렌더링된 내용 표시
- 생성된 청크 목록 확인 (청크별 내용 미리보기)
- `graph` 모드 KB 의 문서 미리보기에서는 청크별로 추출된 entity 목록을 같이 표시 (P1)

### 2.7 그래프 패널 (`graph` 모드 KB 전용)

KB 상세 화면에 그래프 통계/탐색 영역을 추가한다.

#### 2.7.1 P0: 추출 진행 상태 + 통계 카드

```
┌──────────────────────────────────────────────────────────┐
│ Graph Build Status                                       │
│   ✅ 5/5 documents extracted                             │
│   📊 1,240 entities · 3,802 relations                    │
│   🔁 [Re-extract entire KB]                              │
└──────────────────────────────────────────────────────────┘
```

- WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신. KB 단위 통계는 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회
- "Re-extract entire KB" 액션은 `POST /api/knowledge-bases/:kbId/re-extract` 호출 (확인 모달)

#### 2.7.2 P1: Entity / Relation 목록 화면

| 화면 | 설명 |
|------|------|
| Entity 목록 | 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제. `(name, type)` 클릭 시 등장 chunk 목록 모달 |
| Relation 목록 | head · predicate · tail · weight, 검색, 개별 삭제. evidence chunk 클릭 시 미리보기 모달 |
| 문서 상세 미리보기 | 청크별 entity 목록을 칩으로 노출 |

#### 2.7.3 P2: 그래프 시각화 (선택)

3D force-directed 그래프로 노드/엣지를 렌더링한다 (`react-force-graph-3d` + `three.js`). 마우스 드래그로 자유 회전, 휠로 줌, 노드 색상은 entity type 별 (person/organization/concept/location/event/other), 노드 크기는 mention_count 비례. 라벨은 `three-spritetext` 의 카메라-페이싱 sprite. 200개 한도를 초과하면 상위 mention_count 기준으로 truncated.

> 초기 구현은 단순 원형 배치 (2D React Flow) 였으나 노드 200+ 규모에서 라벨이 다닥다닥 겹쳐 가독성이 떨어졌다. 3D force layout 은 같은 정보량도 회전·줌으로 밀도를 분산해 유사한 entity 가 자연스럽게 군집을 형성한다.

---

## 3. API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/knowledge-bases | 컬렉션 목록 조회 (쿼리: page, limit, sort, order, search). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
| POST | /api/knowledge-bases | 컬렉션 생성 |
| GET | /api/knowledge-bases/:id | 컬렉션 상세 조회 |
| PATCH | /api/knowledge-bases/:id | 컬렉션 설정 수정 |
| DELETE | /api/knowledge-bases/:id | 컬렉션 삭제 |
| GET | /api/knowledge-bases/:id/documents | 문서 목록 조회 |
| POST | /api/knowledge-bases/:id/documents | 문서 업로드 (multipart) |
| GET | /api/knowledge-bases/:id/documents/:docId | 문서 상세/미리보기 |
| DELETE | /api/knowledge-bases/:id/documents/:docId | 문서 삭제 |
| POST | /api/knowledge-bases/:id/documents/:docId/re-embed | 문서 단건 재임베딩 요청 |
| POST | /api/knowledge-bases/:id/re-embed | KB 전체 재임베딩 요청 (모든 문서 청크 삭제 후 재처리). `reembed_status` 가 `idle` 일 때만 진입, 진행 중이면 409 `KB_REEMBED_IN_PROGRESS` |
| POST | /api/knowledge-bases/:id/documents/:docId/re-extract | (graph 모드) 문서 단건 그래프 재추출 |
| POST | /api/knowledge-bases/:id/re-extract | (graph 모드) KB 전체 그래프 재추출. `reextract_status` atomic 잠금, 진행 중이면 409 `KB_REEXTRACT_IN_PROGRESS` |
| GET | /api/knowledge-bases/:id/graph/stats | (graph 모드) entity/relation 카운트 + 추출 진행 요약 |
| GET | /api/knowledge-bases/:id/graph/visualization | (graph 모드, P2) 상위 mention_count entity + relation. 시각화 페이로드 |
| GET | /api/knowledge-bases/:id/entities | (graph 모드, P1) entity 목록 (페이지네이션, 검색, 타입 필터) |
| GET | /api/knowledge-bases/:id/entities/:entityId | (graph 모드, P1) entity 상세 + 등장 chunk 목록 |
| DELETE | /api/knowledge-bases/:id/entities/:entityId | (graph 모드, P1) entity 삭제 (관련 relation, chunk_entity CASCADE) |
| GET | /api/knowledge-bases/:id/relations | (graph 모드, P1) relation 목록 |
| DELETE | /api/knowledge-bases/:id/relations/:relationId | (graph 모드, P1) relation 삭제 |

---

## Rationale

### R-1. 임베딩 모델 선택을 select-only 로 한정

KB 생성·설정 폼의 임베딩 모델 입력은 §2.2 표에 명시한 대로 select-only 로 강제한다. 근거는 [설정 화면 §B.2 Rationale R-1](./6-config.md#r-1-기본-모델-선택을-select-only-로-한정) 과 동일하므로 본 문서에서는 추가 기술 없이 cross-reference 한다. 임베딩 모델은 모델별 차원(`dimension`) 이 달라 잘못된 ID 가 저장되면 KB 임베딩이 통째로 손상되므로, select 강제의 보호 효과가 chat 모델보다 더 크다.

운영상 고려:
- **Local (Ollama) 프로바이더 다운 시**: 모델 조회가 실패해도 사용자가 ID 를 직접 입력해 우회하는 경로는 제공하지 않는다. Ollama 가 잠시 내려간 상황에서는 일시적으로 KB 생성·설정 변경이 불가하다 — 그러나 임베딩 자체가 Ollama 호출이라 ID 를 적어 저장해도 후속 임베딩이 동일 사유로 실패할 뿐이라 사용자 입장에서 손해가 없다. Ollama 복구 후 정상 조회/저장이 가능하다.
- **자동 vs 버튼 트리거**: LLMConfig 변경 시 select 의 현재 값은 초기화되며, 사용자가 명시적으로 "모델 불러오기" 버튼을 누른 시점에만 목록을 조회한다 (LLMConfig 화면과 동일 정책). 자동 prefetch 는 KB 폼이 LLMConfig select 와 동일 화면에 있어 변경 의도를 충분히 표현할 수 있다는 가정 아래 채택하지 않는다.
