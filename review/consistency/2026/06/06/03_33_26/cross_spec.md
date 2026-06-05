# Cross-Spec 일관성 검토 결과

검토 대상: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md`
검토 모드: 구현 완료 후 최종 정합 검증 (diff-base=origin/main)
검토 일시: 2026-06-06

---

## 발견사항

충돌 발견 없음 — 6가지 점검 관점 모두 이상 없음.

---

## 관점별 상세 확인

### 1. 데이터 모델 충돌

`golden-set.types.ts` 의 `GoldenEntry` 필드(`knowledgeBaseId`, `goldChunkIds`)는 spec/conventions/rag-evaluation.md §1 골든셋 스키마 테이블과 일치한다. `eval-retrieval.ts` 가 raw SQL 로 조회하는 `knowledge_base.workspace_id` 는 spec/1-data-model.md §2.11 KnowledgeBase 정의와 일치한다. `generate-golden-set.ts` 가 `document_chunk` 에서 조회하는 `id`, `document_id`, `content` 컬럼은 spec/1-data-model.md §2.12.1 DocumentChunk 정의와 일치한다.

**결론: 신규 데이터 모델 충돌 없음.**

### 2. API 계약 충돌

`eval-retrieval.ts` 가 호출하는 `RagSearchService.searchWithMeta(query, [kbId], workspaceId, { topK, threshold })` 시그니처는 구현 코드(`rag-search.service.ts` L91~L100)와 완전히 일치한다. spec/5-system/9-rag-search.md §3.1 의 `threshold` 이중 해석 규칙(`rerank_mode = off` → cosine 임계, `≠ off` → rerank 점수 임계)이 rag-evaluation.md §3 의 `--threshold` 설명과 완전히 일치한다.

**결론: API 계약 충돌 없음.**

### 3. 요구사항 ID 충돌

rag-evaluation.md Rationale 의 결정 ID(`D-E1`~`D-E6`)는 다른 spec 영역에서 사용되지 않는 고유 prefix 이다.

**결론: 요구사항 ID 충돌 없음.**

### 4. 상태 전이 충돌

평가 하베스는 읽기 전용 경로로, Document/KnowledgeBase 의 상태 머신을 변경하지 않는다. `EvalCliModule` 은 `synchronize: false` 로 부팅해 스키마를 변경하지 않는다.

**결론: 상태 전이 충돌 없음.**

### 5. 권한·RBAC 모델 충돌

평가 CLI 는 서버 프로세스 밖 로컬 스크립트이며 제품의 RBAC 레이어를 거치지 않는다. 기존 CLI 스크립트(`cleanup-invalid-queue-jobs` 등)와 동일 패턴으로 새 권한 구조나 RBAC 규칙을 추가하지 않는다.

**결론: 권한·RBAC 충돌 없음.**

### 6. 계층 책임 충돌

`ROOT_ENTITIES` 를 `app.module.ts` 에서 `src/database/root-entities.ts` 로 분리·re-export 한 리팩터링은 기존 `ROOT_ENTITIES` import 사이트 호환을 유지하며 경량 CLI 모듈 격리 원칙을 준수한다. `EvalCliModule` 이 BullMQ 큐·프로세서를 제외하고 검색 경로만 구성하는 것은 rag-evaluation.md §3 "부트스트랩 격리" 명세 및 spec/5-system/9-rag-search.md §3.3 의 "운영 워커 미기동" 원칙과 일치한다.

**결론: 계층 책임 충돌 없음.**

---

## 요약

`spec/conventions/rag-evaluation.md` 와 `spec/5-system/9-rag-search.md` 의 2차 수정 후 최종 상태는 6가지 cross-spec 점검 관점 모두에서 기존 spec 영역과 충돌이 없다. 골든셋 스키마·검색 지표 정의·`searchWithMeta` API 시그니처·`--threshold` 이중 해석 정책·`ROOT_ENTITIES` 분리 리팩터링·`EvalCliModule` 부트스트랩 격리 모두 spec/1-data-model.md, spec/5-system/9-rag-search.md, spec/5-system/8-embedding-pipeline.md 와 일관된다. 신규 충돌 또는 잠재 모순이 발견되지 않았다.

---

## 위험도

NONE
