import { estimateTokens } from '../chunking/text-chunker';

/**
 * RAG 생성 주입 동적 점수 컷 상수 (spec/5-system/9-rag-search.md §3.4).
 *
 * 모두 module-level 상수(환경변수 미노출). v1 은 상수로 시작하고, 튜닝 수요가
 * 측정되면 후속에 KB 필드로 승격한다 (신규 config 필드 증식 회피 — Rationale).
 */
// off(vector) 경로의 wide 회수 폭. rerank_candidate_k 기본값(50)과 수치만 같고
// 독립 코드패스(KB 필드 아님).
export const RAG_RECALL_K = 50;
// 생성 주입 토큰 예산. working-memory 압축 예산 DEFAULT_MEMORY_TOKEN_BUDGET(8000)과
// 값은 같으나 쓰임새(KB 주입 상한 vs working-memory 압축)가 다른 별개 상수.
export const RAG_INJECT_TOKEN_BUDGET = 8000;
// 생성 주입 청크 수 ceiling. 명시 top_k(노드 ragTopK 또는 LLM arg) 미지정 시 적용.
export const RAG_MAX_INJECT_COUNT = 12;

// pgvector HNSW ef_search 기본값(40)·상한(1000). recall@LIMIT 보전을 위해 ef_search ≥ LIMIT
// 가 필요하며(미만이면 recall 저하), wide 회수(RAG_RECALL_K=50)·rerank candidateK(≤200)는
// 기본 40 을 초과한다. (spec/5-system/9-rag-search.md §3.4)
export const HNSW_EF_SEARCH_DEFAULT = 40;
export const HNSW_EF_SEARCH_MAX = 1000;

/**
 * 회수 LIMIT 에 맞춘 HNSW `ef_search` 값. `ef_search ≥ LIMIT` 정설에 2× 헤드룸을 주되
 * pgvector 기본(40) 하한·상한(1000) 안으로 clamp. SET LOCAL 로 트랜잭션 스코프 적용.
 *
 * 반환값은 **항상 [40, 1000] 정수** — SET LOCAL GUC 는 파라미터 바인딩이 안 돼 SQL 에
 * 직접 보간되므로(`SET LOCAL hnsw.ef_search = <n>`) 정수·범위 보장이 안전성의 근거다.
 * `Math.ceil` 은 비정수 limit, 가드는 비유한(NaN/Infinity) limit 에 대한 방어.
 */
export function hnswEfSearchFor(limit: number): number {
  if (!Number.isFinite(limit)) return HNSW_EF_SEARCH_DEFAULT;
  return Math.min(
    HNSW_EF_SEARCH_MAX,
    Math.max(HNSW_EF_SEARCH_DEFAULT, Math.ceil(limit) * 2),
  );
}

/** RAG 동적 점수 컷 옵션 (spec/5-system/9-rag-search.md §3.4). */
export interface DynamicCutOptions {
  // 누적 토큰 추정이 이 값을 초과하면 중단 (단 최소 1개 보장).
  tokenBudget: number;
  // 주입 청크 수 hard ceiling.
  maxCount: number;
}

/** RAG 동적 점수 컷 결과 (spec/5-system/9-rag-search.md §3.4). */
export interface DynamicCutResult<T> {
  kept: T[];
  // budget 또는 cap 으로 후보를 하나라도 떨어뜨렸으면 true.
  cutoffApplied: boolean;
}

/**
 * 점수 기반 동적 컷 (spec/5-system/9-rag-search.md §3.4).
 *
 * **점수 내림차순으로 이미 정렬된** 후보 위에서, token-budget 과 inject-cap(maxCount)
 * 으로 생성 주입 청크 집합을 결정한다. θ(관련성) 게이트는 상위 단계(off=cosine SQL /
 * ≠off=rerank score threshold)에서 이미 적용된 상태를 전제하므로 여기서는 적용하지
 * 않는다 — 본 컷이 고치는 대상은 고정 COUNT 선차단(LIMIT topK)이다.
 *
 * - 누적 토큰이 budget 을 넘으면 중단하되 **최소 1개는 보장**한다 (단일 큰 청크가
 *   budget 을 초과해도 빈 컨텍스트를 반환하지 않게).
 * - 토큰 추정은 KB 청킹과 동일한 char/3 휴리스틱(`text-chunker.estimateTokens`).
 * - 순수 함수(부수효과 없음). 빈 입력 → `{ kept: [], cutoffApplied: false }`.
 */
export function applyDynamicCut<T extends { content: string }>(
  sorted: T[],
  opts: DynamicCutOptions,
): DynamicCutResult<T> {
  const { tokenBudget, maxCount } = opts;
  const kept: T[] = [];
  let usedTokens = 0;

  for (const candidate of sorted) {
    if (kept.length >= maxCount) break;
    const tokens = estimateTokens(candidate.content ?? '');
    // 최소 1개는 budget 무관 보장. 그 외에는 budget 초과 시 중단.
    if (kept.length > 0 && usedTokens + tokens > tokenBudget) break;
    kept.push(candidate);
    usedTokens += tokens;
  }

  return { kept, cutoffApplied: kept.length < sorted.length };
}
