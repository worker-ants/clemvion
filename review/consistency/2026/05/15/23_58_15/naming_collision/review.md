# 신규 식별자 충돌 검토 (naming_collision)

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`

---

## 발견사항

### 1. [INFO] `Document.embedding_error_message` — 대응 컬럼 `graph_error_message` 와 명명 비대칭

- **target 신규 식별자**: `Document.embedding_error_message` (8-embedding-pipeline.md §2 변경)
- **기존 사용처**: `spec/1-data-model.md §2.12 Document` 표 — `graph_error_message Text?` 컬럼이 이미 정의되어 있고, target 이 변경하는 컬럼 `embedding_error_message` 도 동일 §2.12 에 이미 존재함 (`spec/1-data-model.md` line 827)
- **상세**: 충돌은 없다. 두 컬럼 모두 `spec/1-data-model.md` §2.12 에 이미 선언되어 있다. target 은 8-embedding-pipeline.md §2 본문의 옛 "Document.metadata 에러 저장" 표현을 "Document.embedding_error_message" 로 교체하는 것이며, 데이터 모델 정의 자체를 변경하는 것은 아니다. 다만 8-embedding-pipeline.md 는 embedding 에러만 언급하고 graph 에러 컬럼(`graph_error_message`)은 언급하지 않는다 — 독자 관점에서 두 컬럼이 대칭임을 8-embedding-pipeline.md 에서 확인하기 어렵다.
- **제안**: 정보 손실은 없으나, §2 변경 시 "그래프 추출 오류는 `Document.graph_error_message` 에 저장 (§10-graph-rag.md 참조)" 한 줄을 footnote 로 추가하면 독자 혼선을 줄일 수 있다.

---

### 2. [INFO] `entityCount` / `relationCount` — WebSocket payload 필드명과 DB 컬럼명의 케이스 불일치

- **target 신규 식별자**: `entityCount`, `relationCount` — `document:graph_completed` payload 의 camelCase 필드 (10-graph-rag.md §2.3 / §4.2 변경)
- **기존 사용처**: `spec/1-data-model.md §2.11 KnowledgeBase` 표 — `entity_count Integer`, `relation_count Integer` (snake_case DB 컬럼, line 808-809)
- **상세**: 충돌은 없다. WebSocket payload 는 camelCase(JS 관례), DB 컬럼은 snake_case(SQL 관례) 로 두 레이어가 서로 다른 케이스 컨벤션을 따른다. 단, spec 독자가 `entityCount` (payload) ↔ `entity_count` (DB) 의 대응 관계를 파악하기 위해서는 별도로 유추해야 한다. `kb:graph_stats_updated` 이벤트 제거 후 이 payload 필드가 통계 업데이트의 **유일한 WebSocket 전달 경로**가 되므로 명시적 언급이 중요해진다.
- **제안**: 10-graph-rag.md §2.3 교체 문구("그래프 통계 카운트는 `document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회")에 "DB 컬럼 `entity_count` / `relation_count` 와 동일 값" 한 줄을 추가하면 매핑이 명확해진다.

---

### 3. [INFO] `document:graph_completed` — `spec/2-navigation/5-knowledge-base.md §2.7.1` 에서 기존 4개 이벤트로 부분 언급된 상태에서 `_retry` / `_failed` 2개를 추가함

- **target 신규 식별자**: `document:graph_retry`, `document:graph_failed` — 5-knowledge-base.md §2.7.1 에 신규 추가
- **기존 사용처**: 5-knowledge-base.md §2.7.1 line 139 에 이미 `document:graph_started/progress/completed/error` 4개가 존재하며, `document:graph_extracted` 도 언급됨
- **상세**: 충돌은 없다. target 은 4개를 6개로 확장하는 것이며, 기존 이벤트명과 겹치지 않는다. 다만 `document:graph_extracted` 를 `document:graph_completed` 로 변경하는 것은 backend `KbEventType` union 의 `document:graph_completed` 와 정렬되는 수정이다. `document:graph_extracted` 는 코드에 존재하지 않는 식별자이므로 제거해도 충돌 위험 없음.
- **제안**: 이슈 없음. 단, `document:graph_extracted` 가 혹시 다른 spec 파일에 남아있지 않은지 PR 시 grep으로 확인 권장.

---

### 4. [INFO] `scope: 'all'` — 기존 API 파라미터에 새 값 추가 시 backend 구현 정합 확인 필요

- **target 신규 식별자**: `scope: 'all'` — `POST /api/knowledge-bases/:id/retry-failed` body 의 새 값 (5-knowledge-base.md §2.4.1 변경)
- **기존 사용처**: 5-knowledge-base.md §2.4.1 line 105 에 `scope: 'embedding' | 'graph'` 가 이미 정의됨. 8-embedding-pipeline.md §9.4 에도 `scope: 'embedding' | 'graph' | 'all'` 로 3개 값이 이미 명시됨
- **상세**: 충돌은 없다. 8-embedding-pipeline.md §9.4 는 이미 `'all'` 을 포함하고 있으며, target 은 5-knowledge-base.md 에 누락된 `'all'` 을 추가해 두 파일을 정합화하는 것이다. 단, backend 코드에서 `scope === 'all'` 처리 경로가 실제로 구현되어 있는지 spec 코퍼스에서 확인할 수 없다. spec 정비 후 구현 확인이 필요하다.
- **제안**: spec 변경 자체는 이슈 없음. PR description 또는 후속 `--impl-prep` consistency check 에서 backend handler 가 `'all'` 을 처리하는지 확인.

---

### 5. [WARNING] `GET /:id/graph/stats` — spec 코퍼스에 정식 정의 없는 REST 엔드포인트를 대안 경로로 제시함

- **target 신규 식별자**: `GET /:id/graph/stats` — 10-graph-rag.md §2.3 교체 문구에서 "`document:graph_completed` payload 의 `entityCount` / `relationCount` 또는 REST `GET /:id/graph/stats` 폴링으로 조회"로 언급
- **기존 사용처**: 코퍼스 내 제공된 spec 파일(0-overview.md, 1-data-model.md, 2-navigation/*, conventions/*)에 `GET /:id/graph/stats` 엔드포인트가 등장하지 않음. 10-graph-rag.md 본문의 기존 API 섹션에서도 확인 불가 (코퍼스에 10-graph-rag.md 원문이 포함되지 않음)
- **상세**: `GET /:id/graph/stats` 는 신규 도입되는 이름이 아니라 기존 10-graph-rag.md 에 이미 정의되어 있을 가능성이 높다. 그러나 코퍼스에 10-graph-rag.md 원문이 포함되지 않아 충돌 여부를 직접 확인하기 어렵다. 만약 이 엔드포인트가 10-graph-rag.md 에 없거나 path 형식이 다르다면(예: `GET /api/knowledge-bases/:id/graph/stats`), spec 에서 미정의 엔드포인트를 참조하는 상황이 된다.
- **제안**: PR 작업 시 10-graph-rag.md 에서 해당 엔드포인트가 정식으로 정의되어 있음을 확인하고, full path(`/api/knowledge-bases/:id/graph/stats`) 형태로 명시 권장. 미정의라면 target 문구를 WebSocket payload 경로만 언급하도록 축소하거나, 엔드포인트 정의를 함께 추가.

---

### 6. [INFO] 신규 plan 파일 경로 `plan/in-progress/kb-graph-stats-dead-path.md` — 명명 컨벤션 적합

- **target 신규 식별자**: `plan/in-progress/kb-graph-stats-dead-path.md` — 후속 작업 분리 plan 경로
- **기존 사용처**: `plan/in-progress/` 에 이미 20개 파일이 존재하며, 동일 파일명은 없음 (실제 파일 트리 확인)
- **상세**: 충돌 없음. 파일명은 kebab-case + 의미 있는 단어 구성으로 프로젝트 명명 컨벤션을 준수한다. 아직 생성되지 않은 파일이므로 생성 시점에 중복 충돌은 발생하지 않는다.
- **제안**: 이슈 없음.

---

### 7. [INFO] `V022` / `V023` 마이그레이션 번호 참조 — spec 에서 코드 권위 식별자 인용

- **target 신규 식별자**: `V022 vector + V023 halfvec` — 8-embedding-pipeline.md §6.2 및 1-data-model.md §2.12.1 변경 문구에 인용
- **기존 사용처**: `spec/conventions/migrations.md` — V번호는 단조 증가 정수 식별자임. `V033__embedding_hnsw_1024.sql` 예시 언급(line 3298). V022/V023 이 실제 마이그레이션 번호인지 코퍼스에서 직접 확인 불가. `spec/data-flow/knowledge-base.md §2.3` 에 마이그레이션 목록이 있다고 언급됨
- **상세**: V022/V023/V030~V033 번호는 spec 에서 코드 권위(backend/migrations)를 직접 인용하는 것으로, 번호가 올바른 경우 충돌 없음. 번호가 실제 마이그레이션 파일과 다르면 독자 혼선이 생기나, 이는 명명 충돌이 아닌 정확성 문제다.
- **제안**: PR 시 `ls backend/migrations | grep "V022\|V023"` 로 번호 검증 권장.

---

## 요약

target 문서(`spec-draft-embedding-pipeline-consistency.md`)가 도입하는 신규 식별자 — 채널명 `kb:{documentId}`, 12개 WebSocket 이벤트(`document:embedding_*` / `document:graph_*`), 필드명 `embedding_error_message`, API 파라미터 값 `'all'`, payload 필드 `entityCount` / `relationCount` — 중에서 기존 사용처와 의미 충돌을 일으키는 CRITICAL 또는 WARNING(단 하나 제외) 건은 없다. 대부분의 변경은 코드 권위(backend WebSocket 구현)와 spec 을 정렬하는 단순 교체/보완이며, 새 식별자가 기존 영역에서 다른 의미로 이미 사용 중인 경우는 발견되지 않았다. WARNING 1건(`GET /:id/graph/stats` 엔드포인트 정식 정의 미확인)은 10-graph-rag.md 본문이 코퍼스에 포함되지 않아 검증이 불가능한 제약에서 기인하며, 실제 spec 에 이미 정의되어 있다면 즉시 해소된다. INFO 6건은 모두 명확성 강화를 위한 보완 제안이며, 충돌 자체는 없다.

---

## 위험도

LOW
