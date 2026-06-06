# RESOLUTION — 16_08_38 (최종 ai-review, 최종 HEAD)

> 15_47_11 리뷰의 코드 fix(affb8144) 반영 후 최종 HEAD 전체를 재리뷰. 전체 위험도 MEDIUM, Critical 0 / Warning 4. 모든 WARNING 은 FP·moot·비차단으로 disposition (수동 처리 — developer SKILL §REVIEW WORKFLOW 5). 코드 변경 없음.

## 조치 항목

| SUMMARY # | 분류 | disposition | 근거 |
|-----------|------|-------------|------|
| W1 (pending_plans 미등록) | **FP / 부적합 제안** | 변경 안 함 | 편집된 4개 spec 중 partial(1-ai-agent/0-common/17-agent-memory)은 **각자 고유 미구현 surface 용 pending_plans 를 이미 보유**(build 의 spec-pending-plan-existence·spec-status-lifecycle 가드 통과 확인). 본 PR 의 ragTopK 변경은 이들 spec 에서 **완결**됐으므로 rag-dynamic-cut.md 를 pending_plans 에 넣으면 안 된다 — 미구현 surface 를 거짓 표기하고, rag-dynamic-cut.md 가 complete/ 로 이동(step 10)하는 순간 spec-pending-plan-existence(in-progress 실존 요구)가 깨진다. 10-graph-rag 는 implemented. |
| W2 (graph-rag status:implemented 근거 미문서) | 비차단 | 변경 안 함 | 10-graph-rag 편집은 ragTopK→동적 컷 **설명 교체**로 동작 변경 없음 → status:implemented 유지 정당. build 의 spec-status-lifecycle 통과. 인라인 노트는 nice-to-have. |
| W3 (spec-draft §A8 텍스트가 지시형) | **moot** | 변경 안 함 | spec-draft 는 작업 보조 문서일 뿐, 실제 spec 본문(9-rag-search §3.3.1·§3.3.2·Rationale)에는 **확정 텍스트가 이미 반영**됨(commit 2da971eb — byte-identical 폐기 선언·D2 출처 3곳 인용 포함). draft 는 plan 정리 시 제거 예정. |
| W4 (byte-identical Rationale 잔존 가능성) | **FP** | 변경 안 함 | 9-rag-search Rationale "왜 완전 선택적(off 기본)인가" 의 byte-identical 조항은 commit 2da971eb 에서 **이미 폐기 선언**으로 교체됨(`git show HEAD:spec/5-system/9-rag-search.md` 로 반증). §3.3.1 off 행도 동적 컷으로 갱신 완료. |
| I1 (pgvector ANN 파라미터 follow-up 추적) | **반영** | rag-quality-improvement.md §7.E 에 추적 항목 추가 | wide 회수(RAG_RECALL_K=50) 도입의 hnsw.ef_search/ivfflat.probes 조정 follow-up. |
| I3/I4 (ragTopK fallback·graph $5 바인딩 코드 확인) | 확인 완료 | 변경 안 함 | I3: kb-tool-provider·handler 의 `||5` 제거(undefined 보존) 이미 구현+테스트. I4: graph SQL `$5`(코드상 `$7`)는 `seedTopK+expandLimit` 회수폭이 맞음(rag-search.service.ts 확인), 최종 주입은 app-layer 동적 컷 — spec 주석과 정합. |
| I5 (ragTopK optional override 예시) | 비차단 defer | — | 예시 JSON 의 optional override 블록은 nice-to-have. config 표(§1)·hint 가 의미를 충분히 전달. |
| I7/I8/I9 (review 산출물 운영 개선) | 본 PR 범위 밖 | — | review 도구 템플릿/.gitignore 개선은 별도 하네스 작업. |

## TEST 결과

- 코드 변경 없음 (본 리뷰 disposition 은 spec/plan 문서 + RESOLUTION 만). 마지막 코드 commit(affb8144) 직후 TEST WORKFLOW 전체 통과(lint·unit·build·e2e 175) 이미 기록(RESOLUTION 15_47_11).
- lint  : 통과 (직전 통과, 코드 무변경)
- unit  : 통과 (직전 통과, 코드 무변경)
- build : 통과 (spec-pending-plan-existence·spec-status-lifecycle 포함, 직전 통과)
- e2e   : 통과 (175/175, affb8144 직후) — 이후 코드 변경 없음(spec/plan/review docs 만, e2e 면제 화이트리스트 부분집합)

## 보류·후속 항목

- I1: `rag-quality-improvement.md §7.E` pgvector ANN 파라미터 조정 항목으로 이관(추적).
- I5/I7/I8/I9: 비차단 — 본 PR 범위 밖 또는 nice-to-have.
