### 발견사항

- **[INFO]** `RAG_INJECT_TOKEN_BUDGET`(8000) vs `DEFAULT_MEMORY_TOKEN_BUDGET`(8000) — 값 동일, 의미 상이
  - target 신규 식별자: `RAG_INJECT_TOKEN_BUDGET` (`dynamic-cut.util.ts`)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/codebase/backend/src/nodes/ai/shared/agent-memory-schema.ts:29` — `DEFAULT_MEMORY_TOKEN_BUDGET = 8000`, `ai-agent.schema.ts:55` 에서 re-export
  - 상세: 두 상수 모두 값이 8000이나 쓰임새가 다르다 — `RAG_INJECT_TOKEN_BUDGET`은 KB 주입 상한이고 `DEFAULT_MEMORY_TOKEN_BUDGET`은 working-memory 압축 예산이다. `dynamic-cut.util.ts` 주석 및 `spec/5-system/9-rag-search.md §3.4` 모두 이 의도적 분리를 명시하고 있어 실제 혼선 가능성은 낮다. 단 값이 같아 미래에 한쪽만 변경될 경우 다른 쪽과 의도치 않게 달라질 수 있다.
  - 제안: 현 상태 유지 가능. 향후 값이 달라질 때를 대비해 spec 의 "별개 상수" 주석이 코드 주석에도 명확히 남아 있으면 충분하다 (이미 반영돼 있음).

- **[INFO]** `RAG_RECALL_K`(50) vs `rerank_candidate_k` 기본값(50) — 값 동일, 독립 코드패스
  - target 신규 식별자: `RAG_RECALL_K = 50` (`dynamic-cut.util.ts:9`)
  - 기존 사용처: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts:102` — DB 컬럼 `rerank_candidate_k` (기본 50), `rag-search.service.ts:138` 에서 `rerankCandidateK` 로 조회
  - 상세: `RAG_RECALL_K`는 rerank_mode=off 경로의 모듈-레벨 상수이고, `rerank_candidate_k`는 rerank_mode≠off 경로의 KB 엔티티 필드다. 두 경로는 코드 분기점이 다르며 spec 이 독립 코드패스임을 명시하고 있다. 충돌 없음.
  - 제안: 현 상태 유지 가능.

- **[INFO]** `tokenBudget` 필드명 — `RerankParams`(신규) vs `agent-memory-injection` 기존 파라미터
  - target 신규 식별자: `RerankParams.tokenBudget` (`rerank.service.ts:60`)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/rag-dynamic-cut-12fac1/codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts:272` — 메모리 주입 함수의 `tokenBudget: number` 파라미터 (`ai-agent.handler.ts:739` 에서 `DEFAULT_MEMORY_TOKEN_BUDGET` 기반 값으로 사용)
  - 상세: 같은 필드명이 두 도메인(KB 주입 컷 / working-memory 압축)에서 각각 독립 사용된다. 두 타입(`RerankParams`, `agent-memory-injection` 함수 파라미터)은 서로 다른 모듈 경계 안에 있어 TypeScript 타입 충돌은 없다. 그러나 ai-agent.handler 같은 파일에서 두 변수가 공존(`tokenBudget` 로컬 변수 = 메모리 예산, `RerankParams` 의 `tokenBudget` = RAG 주입 예산)하면 코드 독해 시 혼동 여지가 있다.
  - 제안: 단기적으로는 문제 없음. 장기적으로 `RerankParams.tokenBudget`을 `injectTokenBudget`으로 명명하면 구별이 더 명확해진다 — 그러나 spec이 `token-budget`이라는 용어를 명시하므로 현재 naming도 spec 일관성이 있다.

- **[INFO]** `"RAG Top-K (default)"` 레이블 키 제거 → `"RAG Top-K (cap)"` 로 교체
  - target 신규 식별자: i18n 레이블 키 `"RAG Top-K (cap)"` (`backend-labels.ts:133`)
  - 기존 사용처: 이전 키 `"RAG Top-K (default)"` — diff 에서 삭제됨. 현재 코드베이스 검색 결과 더 이상 잔존하지 않음.
  - 상세: 기존 키가 완전히 교체됐으며 잔존 참조 없음. 충돌 없음.
  - 제안: 현 상태 유지 가능.

### 요약

이번 변경이 도입한 신규 식별자(`RAG_RECALL_K`, `RAG_INJECT_TOKEN_BUDGET`, `RAG_MAX_INJECT_COUNT`, `DynamicCutOptions`, `DynamicCutResult`, `applyDynamicCut`, `SearchWithMetaResult`, `gradingNoGrounding`, `injectCap`, `ESCALATE_TOP_SCORE_FLOOR`, `ESCALATE_FLAT_REL_GAP`, `explicitTopK`, `"grounding": "none"`)는 기존 식별자와 실질적 충돌이 없다. 주목할 만한 잠재적 혼동 가능성은 `RAG_INJECT_TOKEN_BUDGET`과 `DEFAULT_MEMORY_TOKEN_BUDGET`이 값(8000)만 같고 의미가 다른 별개 상수라는 점과 `tokenBudget` 필드명이 두 도메인에서 독립적으로 사용된다는 점이나, spec과 코드 주석 모두 이 의도적 분리를 명시하고 있어 실제 혼선 위험은 낮다. 의미 차이가 있는 동일 식별자 사용(CRITICAL 기준)은 발견되지 않았다.

### 위험도

LOW
