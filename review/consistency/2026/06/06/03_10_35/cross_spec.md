# Cross-Spec 일관성 검토 결과

검토 대상: `spec/conventions/rag-evaluation.md` + `spec/5-system/9-rag-search.md`
검토 모드: `--impl-done` (구현 완료 후 재검증, diff-base=origin/main)

---

## 발견사항

충돌·모순에 해당하는 항목 없음. 아래는 INFO 수준 동기화 관찰이다.

- **[INFO]** `spec/5-system/9-rag-search.md` `pending_plans` 에 `rag-eval-harness.md` 잔존
  - target 위치: `spec/5-system/9-rag-search.md` frontmatter `pending_plans` 2번째 항목
  - 충돌 대상: `plan/in-progress/rag-eval-harness.md` (파일은 존재함)
  - 상세: 구현이 완료(`status: implemented`)된 `spec/conventions/rag-evaluation.md` 와 달리, `9-rag-search.md` frontmatter 의 `pending_plans` 에는 여전히 `plan/in-progress/rag-eval-harness.md` 가 남아 있다. 플랜 완료 이동 규칙(`plan/complete/`) 이 실행되면 dead link 가 된다. 모순은 아니지만 동기화 권장.
  - 제안: 플랜 파일이 `plan/complete/` 로 이동될 때 `9-rag-search.md` frontmatter 에서 해당 행 제거.

- **[INFO]** `eval-retrieval.ts` 의 `searchWithMeta` 호출 signature 는 실제 서비스와 일치
  - target 위치: `codebase/backend/src/scripts/eval-retrieval.ts` L1397
  - 충돌 대상: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`
  - 상세: 구현이 `searchWithMeta(query, [kbId], workspaceId, { topK, threshold })` 로 호출하며, 실제 메서드 시그니처 `(query, knowledgeBaseIds, workspaceId, options?)` 와 일치. 반환 `results[].chunkId` 필드도 `SearchResult.chunkId` 와 일치. 모순 없음.

- **[INFO]** `spec/conventions/rag-evaluation.md` 의 `status: implemented` 와 `9-rag-search.md` `status: partial` 공존
  - target 위치: `spec/conventions/rag-evaluation.md` frontmatter `status`
  - 충돌 대상: `spec/5-system/9-rag-search.md` frontmatter `status: partial`
  - 상세: 두 문서는 별도 spec 이므로 각자의 구현 상태를 독립 기술하는 것이 맞다. `rag-evaluation.md` 는 평가 하베스 구현 완료, `9-rag-search.md` 는 RAG 검색 자체 spec 으로 후속 플랜이 잔존. 모순 아님.

---

## 요약

이번 구현(RAG 평가 하베스 P0 Phase 0+1)은 `spec/conventions/rag-evaluation.md` 를 SoT 로 선언하고 모든 코드 경로(`golden-set.types.ts`, `retrieval-metrics.ts`, `eval-cli.module.ts`, `generate-golden-set.ts`, `eval-retrieval.ts`)가 spec 정의와 일치하게 작성됐다. 데이터 모델(GoldenEntry 필드), 지표 정의(Recall/Precision/hit-rate/MRR/nDCG 공식), 결정성 규칙(동점 chunkId 사전순 tie-break), 집계 방식(positive macro / negatives 분리), 커밋 정책(.gitignore), 부트스트랩 격리(EvalCliModule) 모두 spec 기술과 충돌이 없다. `RagSearchService.searchWithMeta` 호출 계약도 실제 구현체와 일치한다. 다른 spec 영역(데이터 모델, RBAC, 실행 엔진, API 계약, 상태 머신)과의 직접 모순도 발견되지 않았다. 유일한 관찰은 플랜 완료 이동 시 `9-rag-search.md` frontmatter 동기화 필요라는 INFO 수준 사항이다.

---

## 위험도

NONE
