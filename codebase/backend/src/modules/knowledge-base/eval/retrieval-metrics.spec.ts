import { detectLanguage } from './lang-detect';
import {
  evaluateRetrieval,
  hitRateAtK,
  mrrAtK,
  ndcgAtK,
  orderRetrieved,
  precisionAtK,
  recallAtK,
  RetrievedChunk,
} from './retrieval-metrics';
import { GoldenEntry, GoldenSet } from './golden-set.types';

const ID_LOG2_2 = 1 / Math.log2(2); // 1.0
const LOG2_3 = Math.log2(3);

function entry(over: Partial<GoldenEntry>): GoldenEntry {
  return {
    id: 'e1',
    query: 'q',
    language: 'ko',
    knowledgeBaseId: 'kb1',
    goldChunkIds: ['c1'],
    shouldRetrieve: true,
    source: 'synthetic',
    reviewed: false,
    difficulty: 'single',
    ...over,
  };
}

describe('orderRetrieved (결정적 tie-break)', () => {
  it('score 내림차순 정렬', () => {
    const r: RetrievedChunk[] = [
      { chunkId: 'a', score: 0.2 },
      { chunkId: 'b', score: 0.9 },
      { chunkId: 'c', score: 0.5 },
    ];
    expect(orderRetrieved(r)).toEqual(['b', 'c', 'a']);
  });

  it('동점 score 는 chunkId 오름차순으로 결정적 정렬', () => {
    const r: RetrievedChunk[] = [
      { chunkId: 'z', score: 0.5 },
      { chunkId: 'a', score: 0.5 },
      { chunkId: 'm', score: 0.5 },
    ];
    expect(orderRetrieved(r)).toEqual(['a', 'm', 'z']);
  });

  it('입력 배열을 변형하지 않음', () => {
    const r: RetrievedChunk[] = [
      { chunkId: 'a', score: 0.2 },
      { chunkId: 'b', score: 0.9 },
    ];
    orderRetrieved(r);
    expect(r[0].chunkId).toBe('a');
  });
});

describe('단일 지표', () => {
  const ranked = ['c1', 'c2', 'c3', 'c4', 'c5'];

  it('recall@k', () => {
    const gold = new Set(['c2', 'c9']); // c9 는 회수 안 됨
    expect(recallAtK(ranked, gold, 1)).toBe(0);
    expect(recallAtK(ranked, gold, 3)).toBe(0.5); // c2 hit, c9 miss
    expect(recallAtK(ranked, gold, 5)).toBe(0.5);
  });

  it('precision@k 분모는 k 고정', () => {
    const gold = new Set(['c1', 'c2']);
    expect(precisionAtK(ranked, gold, 1)).toBe(1); // 1/1
    expect(precisionAtK(ranked, gold, 2)).toBe(1); // 2/2
    expect(precisionAtK(ranked, gold, 4)).toBe(0.5); // 2/4
  });

  it('precision@k: 회수 < k 이어도 k 로 나눔', () => {
    const gold = new Set(['x1']);
    expect(precisionAtK(['x1'], gold, 5)).toBe(0.2); // 1/5
  });

  it('hitRate@k', () => {
    const gold = new Set(['c3']);
    expect(hitRateAtK(ranked, gold, 2)).toBe(0);
    expect(hitRateAtK(ranked, gold, 3)).toBe(1);
  });

  it('mrr@k = first relevant rank 역수', () => {
    expect(mrrAtK(ranked, new Set(['c1']), 5)).toBe(1);
    expect(mrrAtK(ranked, new Set(['c3']), 5)).toBeCloseTo(1 / 3, 10);
    expect(mrrAtK(ranked, new Set(['c3']), 2)).toBe(0); // top-2 밖
    expect(mrrAtK(ranked, new Set(['zzz']), 5)).toBe(0);
  });

  it('ndcg@k: 완전 정렬이면 1', () => {
    const gold = new Set(['c1', 'c2']);
    expect(ndcgAtK(['c1', 'c2', 'c3'], gold, 3)).toBeCloseTo(1, 10);
  });

  it('ndcg@k: 순위 어긋나면 < 1, IDCG 정규화 확인', () => {
    const gold = new Set(['c2']); // 2번째 위치
    // DCG = 1/log2(3), IDCG = 1/log2(2) = 1
    expect(ndcgAtK(['c1', 'c2', 'c3'], gold, 3)).toBeCloseTo(
      ID_LOG2_2 / LOG2_3,
      10,
    );
  });

  it('gold 가 비면 모든 지표 NaN', () => {
    const empty = new Set<string>();
    expect(recallAtK(ranked, empty, 3)).toBeNaN();
    expect(precisionAtK(ranked, empty, 3)).toBeNaN();
    expect(hitRateAtK(ranked, empty, 3)).toBeNaN();
    expect(mrrAtK(ranked, empty, 3)).toBeNaN();
    expect(ndcgAtK(ranked, empty, 3)).toBeNaN();
  });

  it('k > 회수수 경계', () => {
    const gold = new Set(['c1']);
    expect(recallAtK(['c1'], gold, 10)).toBe(1);
    expect(hitRateAtK(['c1'], gold, 10)).toBe(1);
    expect(ndcgAtK(['c1'], gold, 10)).toBeCloseTo(1, 10);
  });
});

describe('evaluateRetrieval 집계', () => {
  const goldenSet: GoldenSet = {
    meta: { version: 1 },
    entries: [
      entry({ id: 'p-ko', language: 'ko', goldChunkIds: ['c1'] }),
      entry({ id: 'p-en', language: 'en', goldChunkIds: ['d2'] }),
      entry({
        id: 'neg',
        language: 'ko',
        goldChunkIds: [],
        shouldRetrieve: false,
      }),
    ],
  };

  it('positive entry 만 macro 평균, negative 는 분리 집계', () => {
    const report = evaluateRetrieval(
      goldenSet,
      {
        'p-ko': [
          { chunkId: 'c1', score: 0.9 },
          { chunkId: 'x', score: 0.5 },
        ],
        'p-en': [
          { chunkId: 'z', score: 0.9 },
          { chunkId: 'd2', score: 0.4 },
        ],
        neg: [{ chunkId: 'whatever', score: 0.9 }],
      },
      [1, 3],
    );

    expect(report.overall.count).toBe(2);
    // p-ko hit@1, p-en miss@1 → macro hitRate@1 = 0.5
    expect(report.overall.hitRate[1]).toBe(0.5);
    expect(report.overall.hitRate[3]).toBe(1); // 둘 다 top-3 안
    // MRR: p-ko=1, p-en=1/2 → 0.75
    expect(report.overall.mrr).toBeCloseTo(0.75, 10);

    expect(report.negatives.count).toBe(1);
    expect(report.negatives.retrievedAnyRate).toBe(1);
    expect(report.totalEntries).toBe(3);
  });

  it('언어별 macro 분리', () => {
    const report = evaluateRetrieval(
      goldenSet,
      {
        'p-ko': [{ chunkId: 'c1', score: 0.9 }],
        'p-en': [{ chunkId: 'nope', score: 0.9 }],
      },
      [1],
    );
    expect(report.byLanguage.ko?.hitRate[1]).toBe(1);
    expect(report.byLanguage.en?.hitRate[1]).toBe(0);
  });

  it('회수 누락 entry 는 빈 회수로 0점 처리', () => {
    const report = evaluateRetrieval(goldenSet, {}, [1]);
    expect(report.overall.hitRate[1]).toBe(0);
    const pko = report.perEntry.find((e) => e.entryId === 'p-ko');
    expect(pko?.retrievedCount).toBe(0);
  });

  it('ks 는 중복 제거·오름차순 정규화', () => {
    const report = evaluateRetrieval(goldenSet, {}, [5, 1, 5, 3]);
    expect(report.ks).toEqual([1, 3, 5]);
    expect(report.maxK).toBe(5);
  });
});

describe('detectLanguage', () => {
  it('한국어 문장 → ko', () => {
    expect(detectLanguage('환불 정책은 어떻게 되나요?')).toBe('ko');
  });
  it('영문 문장 → en', () => {
    expect(detectLanguage('What is the refund policy?')).toBe('en');
  });
  it('영문 식별자 섞인 한국어 → ko', () => {
    expect(detectLanguage('SKU-12345 상품의 재고는 몇 개인가요?')).toBe('ko');
  });
  it('숫자·기호만 → en(기본)', () => {
    expect(detectLanguage('12345 !!! ???')).toBe('en');
  });
});
