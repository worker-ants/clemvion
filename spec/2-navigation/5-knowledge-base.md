# Spec: 지식 저장소 화면

> 관련 문서: [PRD 내비게이션](../../prd/1-navigation.md#35-knowledge-base) · [PRD 통합/연동](../../prd/4-integration.md#3-knowledge-base) · [PRD Graph RAG](../../prd/9-graph-rag.md) · [Spec 레이아웃](./0-layout.md) · [Spec Graph RAG](../5-system/10-graph-rag.md) · [데이터 모델 - KnowledgeBase](../1-data-model.md#211-knowledgebase)

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
| 임베딩 상태 | Ready(✅) / Processing(🔄 + 진행률) / Error(❌) |
| 더보기(⋮) | 설정, 삭제 |

### 2.2 컬렉션 생성

| 필드 | 설명 |
|------|------|
| 이름 | 컬렉션 이름 (필수) |
| 설명 | 컬렉션 설명 (선택) |
| 검색 모드 | `vector` (기본) / `graph` 중 선택. **생성 시에만 결정, 사후 변경 불가** |
| 임베딩 모델 | 사용할 임베딩 모델 선택 (LLMConfig 연동) |
| 추출 LLM | `graph` 모드 일 때만 표시. 그래프 추출에 사용할 LLMConfig 의 chat 모델. 미지정 시 워크스페이스 default |
| 청크 크기 | 문서 분할 청크 크기 (기본: 1000 토큰) |
| 청크 오버랩 | 청크 간 오버랩 (기본: 200 토큰) |
| 그래프 검색 파라미터 | `graph` 모드 일 때만 표시. `maxHops` (1/2, 기본 1), `vectorSeedTopK` (기본 5), `expandedChunkLimit` (기본 15) |

> 모드별 도움말은 폼에 인라인 안내로 표시: vector 는 "유사도 기반 단순 검색", graph 는 "entity·relation 추출 후 그래프 탐색을 결합 — 추출 LLM 호출이 추가 비용으로 발생".

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
| 임베딩 상태 | Ready / Processing / Error |
| 더보기(⋮) | 미리보기, 재임베딩, 삭제 |

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

- WebSocket 이벤트 (`document:graph_started/progress/completed/error`, `kb:graph_stats_updated`) 로 실시간 갱신
- "Re-extract entire KB" 액션은 `POST /api/knowledge-bases/:kbId/re-extract` 호출 (확인 모달)

#### 2.7.2 P1: Entity / Relation 목록 화면

| 화면 | 설명 |
|------|------|
| Entity 목록 | 이름·타입·등장 횟수 컬럼, 검색·정렬, 개별 삭제. `(name, type)` 클릭 시 등장 chunk 목록 모달 |
| Relation 목록 | head · predicate · tail · weight, 검색, 개별 삭제. evidence chunk 클릭 시 미리보기 모달 |
| 문서 상세 미리보기 | 청크별 entity 목록을 칩으로 노출 |

#### 2.7.3 P2: 그래프 시각화 (선택)

react-flow 등으로 노드/엣지 렌더링. 줌·드래그·노드 호버 시 등장 chunk 미리보기.

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
