/**
 * 순수-TS 검색(retrieval) 지표 — LLM 비용 0, 결정적.
 *
 * SoT: spec/conventions/rag-evaluation.md.
 *
 * 모든 함수는 부수효과·난수 없이 입력만으로 결과를 정한다. 동점 score 는
 * `chunkId` 사전순 2차 정렬로 tie-break 하여 순위가 항상 재현되게 한다.
 *
 * 해석 주의: 자동 합성 골든셋(silver)에서 산출한 절대값은 신뢰하지 말고,
 * 변경 전후 **상대 회귀 비교**(off vs cross_encoder, PR 전후)로만 사용한다.
 */
import { GoldenEntry, GoldenLanguage, GoldenSet } from './golden-set.types';

export interface RetrievedChunk {
  chunkId: string;
  score: number;
}

/** score 내림차순, 동점은 chunkId 오름차순(결정적). */
export function orderRetrieved(retrieved: RetrievedChunk[]): string[] {
  return [...retrieved]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.chunkId < b.chunkId) return -1;
      if (a.chunkId > b.chunkId) return 1;
      return 0;
    })
    .map((r) => r.chunkId);
}

function countHits(top: string[], gold: Set<string>): number {
  let hit = 0;
  for (const id of top) if (gold.has(id)) hit += 1;
  return hit;
}

/** Recall@k = |gold ∩ top-k| / |gold|. gold 가 비면 NaN(평가 제외 신호). */
export function recallAtK(
  ranked: string[],
  gold: Set<string>,
  k: number,
): number {
  if (gold.size === 0) return NaN;
  return countHits(ranked.slice(0, k), gold) / gold.size;
}

/**
 * Precision@k = |gold ∩ top-k| / k. 분모는 표준 정의대로 **k 고정**
 * (회수 결과가 k 미만이어도 k 로 나눔). gold 가 비면 NaN.
 */
export function precisionAtK(
  ranked: string[],
  gold: Set<string>,
  k: number,
): number {
  if (gold.size === 0) return NaN;
  if (k <= 0) return 0;
  return countHits(ranked.slice(0, k), gold) / k;
}

/** Hit-rate@k = top-k 안에 gold 가 1개라도 있으면 1, 아니면 0. */
export function hitRateAtK(
  ranked: string[],
  gold: Set<string>,
  k: number,
): number {
  if (gold.size === 0) return NaN;
  return countHits(ranked.slice(0, k), gold) > 0 ? 1 : 0;
}

/** 1-based first relevant rank within top-k, 없으면 null. */
export function firstRelevantRank(
  ranked: string[],
  gold: Set<string>,
  k: number,
): number | null {
  const limit = Math.min(k, ranked.length);
  for (let i = 0; i < limit; i += 1) {
    if (gold.has(ranked[i])) return i + 1;
  }
  return null;
}

/** MRR@k = first relevant rank 의 역수, 없으면 0. gold 가 비면 NaN. */
export function mrrAtK(ranked: string[], gold: Set<string>, k: number): number {
  if (gold.size === 0) return NaN;
  const rank = firstRelevantRank(ranked, gold, k);
  return rank === null ? 0 : 1 / rank;
}

/**
 * nDCG@k (binary relevance). DCG = Σ rel_i / log2(i+1) (i: 1-based 위치),
 * IDCG = 이상적 정렬의 DCG. gold 가 비면 NaN.
 */
export function ndcgAtK(
  ranked: string[],
  gold: Set<string>,
  k: number,
): number {
  if (gold.size === 0) return NaN;
  let dcg = 0;
  const limit = Math.min(k, ranked.length);
  for (let i = 0; i < limit; i += 1) {
    if (gold.has(ranked[i])) dcg += 1 / Math.log2(i + 2);
  }
  const idealHits = Math.min(gold.size, k);
  let idcg = 0;
  for (let j = 0; j < idealHits; j += 1) idcg += 1 / Math.log2(j + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

// ─────────────────────────────────────────────────────────────────────────
// 집계
// ─────────────────────────────────────────────────────────────────────────

export interface EntryEval {
  entryId: string;
  language: GoldenLanguage;
  shouldRetrieve: boolean;
  goldCount: number;
  retrievedCount: number;
  recall: Record<number, number>;
  precision: Record<number, number>;
  hitRate: Record<number, number>;
  ndcg: Record<number, number>;
  /** MRR@maxK */
  mrr: number;
  firstRelevantRank: number | null;
}

export interface AggregateMetrics {
  /** macro 평균 대상 entry 수(shouldRetrieve=true). */
  count: number;
  recall: Record<number, number>;
  precision: Record<number, number>;
  hitRate: Record<number, number>;
  ndcg: Record<number, number>;
  mrr: number;
}

export interface NegativeCaseStats {
  count: number;
  /**
   * shouldRetrieve=false entry 중 1건이라도 회수된 비율. gold negative 라벨이
   * 없어 정/오 판정은 보류 — 임계 튜닝 참고용 정보 지표.
   */
  retrievedAnyRate: number;
}

export interface EvalReport {
  ks: number[];
  maxK: number;
  totalEntries: number;
  /** shouldRetrieve=true 전체 macro */
  overall: AggregateMetrics;
  /** 언어별 macro(KO/EN 격차 관찰) */
  byLanguage: Partial<Record<GoldenLanguage, AggregateMetrics>>;
  negatives: NegativeCaseStats;
  perEntry: EntryEval[];
}

function emptyMetricMap(ks: number[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const k of ks) m[k] = 0;
  return m;
}

function evaluateEntry(
  entry: GoldenEntry,
  retrieved: RetrievedChunk[],
  ks: number[],
  maxK: number,
): EntryEval {
  const ranked = orderRetrieved(retrieved);
  const gold = new Set(entry.goldChunkIds);
  const recall = emptyMetricMap(ks);
  const precision = emptyMetricMap(ks);
  const hitRate = emptyMetricMap(ks);
  const ndcg = emptyMetricMap(ks);
  for (const k of ks) {
    recall[k] = recallAtK(ranked, gold, k);
    precision[k] = precisionAtK(ranked, gold, k);
    hitRate[k] = hitRateAtK(ranked, gold, k);
    ndcg[k] = ndcgAtK(ranked, gold, k);
  }
  return {
    entryId: entry.id,
    language: entry.language,
    shouldRetrieve: entry.shouldRetrieve,
    goldCount: gold.size,
    retrievedCount: ranked.length,
    recall,
    precision,
    hitRate,
    ndcg,
    mrr: mrrAtK(ranked, gold, maxK),
    firstRelevantRank: firstRelevantRank(ranked, gold, maxK),
  };
}

function macroAverage(entries: EntryEval[], ks: number[]): AggregateMetrics {
  const recall = emptyMetricMap(ks);
  const precision = emptyMetricMap(ks);
  const hitRate = emptyMetricMap(ks);
  const ndcg = emptyMetricMap(ks);
  let mrrSum = 0;
  for (const e of entries) {
    for (const k of ks) {
      // NaN guard: gold-empty entry 는 NaN 을 반환하므로 집계에서 제외.
      if (!Number.isNaN(e.recall[k])) recall[k] += e.recall[k];
      if (!Number.isNaN(e.precision[k])) precision[k] += e.precision[k];
      if (!Number.isNaN(e.hitRate[k])) hitRate[k] += e.hitRate[k];
      if (!Number.isNaN(e.ndcg[k])) ndcg[k] += e.ndcg[k];
    }
    if (!Number.isNaN(e.mrr)) mrrSum += e.mrr;
  }
  const n = entries.length;
  if (n > 0) {
    for (const k of ks) {
      recall[k] /= n;
      precision[k] /= n;
      hitRate[k] /= n;
      ndcg[k] /= n;
    }
  }
  return {
    count: n,
    recall,
    precision,
    hitRate,
    ndcg,
    mrr: n > 0 ? mrrSum / n : 0,
  };
}

/**
 * 골든셋 전체에 대해 entry 별 + macro 지표를 산출한다.
 *
 * @param retrievedByEntryId entry.id → 회수 청크(순서 무관, 함수가 결정적 정렬).
 *        누락된 entry 는 빈 회수로 간주.
 * @param ks 기본 [1,3,5,10]. 오름차순 정렬·중복 제거되어 사용.
 */
export function evaluateRetrieval(
  goldenSet: GoldenSet,
  retrievedByEntryId: Record<string, RetrievedChunk[]>,
  ks: number[] = [1, 3, 5, 10],
): EvalReport {
  const sortedKs = Array.from(new Set(ks)).sort((a, b) => a - b);
  const maxK = sortedKs.length > 0 ? sortedKs[sortedKs.length - 1] : 0;

  const perEntry: EntryEval[] = [];
  const positives: EntryEval[] = [];
  const byLangPos: Partial<Record<GoldenLanguage, EntryEval[]>> = {};
  let negCount = 0;
  let negRetrievedAny = 0;

  for (const entry of goldenSet.entries) {
    const retrieved = retrievedByEntryId[entry.id] ?? [];
    const ev = evaluateEntry(entry, retrieved, sortedKs, maxK);
    perEntry.push(ev);

    if (entry.shouldRetrieve && entry.goldChunkIds.length > 0) {
      positives.push(ev);
      (byLangPos[entry.language] ??= []).push(ev);
    } else {
      negCount += 1;
      if (ev.retrievedCount > 0) negRetrievedAny += 1;
    }
  }

  const byLanguage: Partial<Record<GoldenLanguage, AggregateMetrics>> = {};
  for (const lang of Object.keys(byLangPos) as GoldenLanguage[]) {
    byLanguage[lang] = macroAverage(byLangPos[lang] as EntryEval[], sortedKs);
  }

  return {
    ks: sortedKs,
    maxK,
    totalEntries: goldenSet.entries.length,
    overall: macroAverage(positives, sortedKs),
    byLanguage,
    negatives: {
      count: negCount,
      retrievedAnyRate: negCount > 0 ? negRetrievedAny / negCount : 0,
    },
    perEntry,
  };
}
