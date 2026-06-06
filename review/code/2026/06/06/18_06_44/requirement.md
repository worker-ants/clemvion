# 요구사항(Requirement) Review

## 리뷰 대상

이 PR 은 두 가지 독립적 기능 묶음을 포함한다.

1. **ef_search recall 보전 (#3)**: `hnswEfSearchFor` 유틸 + `searchVectorGroup` 에 `SET LOCAL hnsw.ef_search` 트랜잭션 적용 (파일 1~4)
2. **exec-park B2a follow-up**: e2e ENCRYPTION_KEY 교정 + `POST /api/llm-configs` 정식 경로 + spec doc-sync 다수 (파일 5~45)

---

## 발견사항

### [INFO] ef_search 기능 완전성 — spec §3.4 "follow-up" 항목이 완전히 구현됨

- 위치: `spec/5-system/9-rag-search.md` §3.4 (변경 후); `dynamic-cut.util.ts`; `rag-search.service.ts` L427
- 상세: spec §3.4 구판은 `hnsw.ef_search` 조정을 "(follow-up)" 미결 항목으로 열거했다. 이 PR 의 spec diff 는 "recall 보전 구현됨" 으로 서술을 갱신하고, 코드는 `hnswEfSearchFor(topK)` → `SET LOCAL hnsw.ef_search = ${efSearch}` 를 `searchVectorGroup` 내 트랜잭션으로 묶어 실제로 구현했다. 기능 완전성 측면에서 일치.
- 제안: 없음.

### [INFO] 엣지 케이스 처리 충분 — `hnswEfSearchFor`

- 위치: `dynamic-cut.util.ts` L32-38; `dynamic-cut.util.spec.ts` L44-58
- 상세: `NaN`, `Infinity`, 비정수(5.5, 25.1, 33.7), 하한 경계(5→40), 상한 경계(600→1000), 정상값(RAG_RECALL_K=50→100), rerank candidateK 최대(200→400) 을 모두 테스트가 커버한다. `Math.ceil` + `Number.isFinite` 조합으로 비유한 입력에서 기본값 반환이 올바르게 구현됐다.
- 제안: 없음.

### [INFO] graph seed ef_search 미적용 — 의도적 설계, 코드·spec·테스트 삼자 일치

- 위치: `rag-search.service.ts` L511-514 (주석); `rag-search.service.spec.ts` L452-453; `spec/5-system/9-rag-search.md` §3.4
- 상세: graph seed `seedTopK`(기본 5) < `HNSW_EF_SEARCH_DEFAULT`(40) 이므로 기본 `ef_search` 로 충분하다는 설계가 코드 주석, 테스트 단언(`mockDataSource.transaction` 미호출), spec §3.4 서술 세 곳에 일치한다. 엣지 케이스 — `seedTopK > 40` 시 재검토 필요성도 주석에 명기돼 있어 미래 확장 가이드까지 기록됨.
- 제안: 없음.

### [INFO] `[SPEC-DRIFT]` spec §3.4 "follow-up" → "구현됨" 갱신 — 코드가 선행, spec 이 이번 PR 에서 동기화

- 위치: `spec/5-system/9-rag-search.md` §3.4 diff (L2485→L2486)
- 상세: 코드 변경이 spec 의 "(follow-up)" 텍스트를 실제 구현 내용으로 대체했다. 이는 의도적 spec doc-sync 이며 코드가 옳고 spec 이 코드를 뒤따른 것. 이 PR 에서 spec 갱신이 함께 포함되어 있으므로 SPEC-DRIFT 는 이 PR 로 해소됨.
- 제안: 코드 유지 + 이 PR 의 spec diff 가 이미 반영.

### [WARNING] `SET LOCAL` SQL 직접 보간 — 정수·범위 보장으로 인젝션 안전성 확보되나, 음수 입력 처리 미명시

- 위치: `rag-search.service.ts` L428; `dynamic-cut.util.ts` L32-38
- 상세: `SET LOCAL hnsw.ef_search = ${efSearch}` 는 SQL 파라미터 바인딩이 불가한 GUC 문이라 직접 보간이 불가피하다. `hnswEfSearchFor` 가 [40, 1000] 정수를 항상 반환한다는 설계 근거가 주석에 명시됐다. 그러나 **음수 입력** (`limit < 0`) 에 대한 처리가 함수 명세와 테스트에 없다: `Math.ceil(-1) * 2 = -2`, `Math.max(40, -2) = 40` 으로 결과적으로 하한 40 이 반환되어 SQL 보간은 안전하지만, 이 동작이 명시적으로 보장된 계약인지 불명확하다. 음수 LIMIT 가 호출 경로에서 실제로 발생할 가능성은 낮으나, 함수 계약 완전성 관점에서 명시적 처리 또는 테스트가 없다.
- 제안: `hnswEfSearchFor` 에 음수 입력 케이스 테스트 1건 추가(`hnswEfSearchFor(-5)` → `40`) 하여 계약을 명시화. 코드 자체는 안전하므로 선택적 개선.

### [INFO] e2e 테스트 — `POST /api/llm-configs` 정식 경로 교체 기능 완전성

- 위치: `execution-park-resume.e2e-spec.ts` L327-340
- 상세: `expect(llmCreateRes.status).toBe(201)` + `const llmConfigId = (llmCreateRes.body.data as { id: string }).id` + `expect(llmConfigId).toBeDefined()` 로 API 응답 검증이 올바르게 수행된다. plan §④(b) 의 "DB-insert 우회 → 정식 API 경로" 요구사항을 완전히 충족한다.
- 제안: 없음.

### [INFO] `docker-compose.e2e.yml` ENCRYPTION_KEY 교정 — 기능 요구사항 충족

- 위치: `docker-compose.e2e.yml` L369
- 상세: `crypto.util.ts` 의 AES-256-GCM 경로가 `Buffer.from(key, 'hex')` 로 32byte 를 요구하는데, 기존 32-char(16byte) 값이 그 불일치를 유발했다. 64-hex(32byte) 교정으로 `POST /api/llm-configs` 가 정상 동작하고 e2e 176 pass 확인됨. 요구사항 충족.
- 제안: 없음.

### [INFO] spec §3.4 참조 일치 — `hnswEfSearchFor` 주석과 spec 경로 일치

- 위치: `dynamic-cut.util.ts` L20 (`(spec/5-system/9-rag-search.md §3.4)`)
- 상세: 코드 주석의 spec 경로가 실제 spec §3.4 의 ef_search 서술과 일치한다.

### [INFO] rerank `candidateK=200 → ef_search=400` 단언 — spec §3.4 `clamp(LIMIT×2, 40, 1000)` 수식과 일치

- 위치: `rag-search.service.spec.ts` L186-216; `spec/5-system/9-rag-search.md` §3.4 diff
- 상세: spec §3.4 변경 후 서술 "클램프(LIMIT×2, 40, 1000)" 를 테스트가 candidateK=200→400, RAG_RECALL_K=50→100 두 케이스로 검증한다. spec ↔ 테스트 수식 일치.

### [INFO] `spec/4-nodes/4-integration/_product-overview.md` KB-AG-04 갱신 — ragTopK optional 명시

- 위치: `spec/4-nodes/4-integration/_product-overview.md` L2346
- 상세: KB-AG-04 에 "ragTopK 는 optional — 미지정 시 §3.4 동적 컷이 주입 수 결정, 명시 시 상한 override" 추가. `spec/5-system/9-rag-search.md §2.1` 의 "미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정" 서술과 일치.

### [INFO] `spec/5-system/10-graph-rag.md` KB-GR-SR-05 갱신 — "고정 topK" 제거, 동적 컷 명시

- 위치: `spec/5-system/10-graph-rag.md` L2370
- 상세: 구판의 "상위 topK 반환" 표현을 "동적 점수 컷이 결정" 으로 갱신. `rag-search.service.ts` 의 graph 경로에서도 `applyDynamicCut` 이 공통 적용된다는 구현 사실과 일치. 요구사항 ID KB-GR-SR-05 가 코드 동작과 정합하게 갱신됨.

### [INFO] `spec/5-system/9-rag-search.md` §6 에러 테이블 — `gradingNoGrounding` 정상 케이스 신설

- 위치: `spec/5-system/9-rag-search.md` diff L2494
- 상세: grading 이 모든 후보를 무관으로 판정한 경우 `error=null` + `gradingNoGrounding=true` 로 정상 처리된다는 행이 에러 테이블에 추가됨. 기존 서술(`§4.2`, `§3.3.2`)과 완전히 일치하는 정리이며, `RERANK_LLM_GRADING_FAILED`(parse 실패)와 명확히 구분된다.

### [INFO] TODO/FIXME 없음

- 위치: 전체 변경 파일
- 상세: 코드 파일 내 `TODO`, `FIXME`, `HACK`, `XXX` 주석 없음.

---

## 요약

이 PR 의 핵심 기능인 **HNSW ef_search recall 보전** (`hnswEfSearchFor` 유틸 + `SET LOCAL` 트랜잭션 적용)은 spec §3.4 의 "(follow-up)" 요구사항을 완전히 구현하며, 경계값·비유한 입력·graph seed 미적용 등 엣지 케이스가 코드·테스트·spec 삼자에서 일관되게 다뤄진다. SQL 직접 보간은 [40, 1000] 정수 clamp 보장으로 인젝션 안전성이 확보된다. 음수 입력이 묵시적으로 하한 40 으로 처리되는 동작이 명시된 계약으로 테스트되지 않은 것이 유일한 개선 여지다(WARNING). **exec-park B2a follow-up** 묶음(spec doc-sync + e2e 경로 교정)은 plan §①~④ 를 모두 충족하며, 기능 완전성·에러 처리·비즈니스 로직 정합 모두 양호하다.

---

## 위험도

LOW
