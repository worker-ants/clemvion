import {
  applyDynamicCut,
  RAG_MAX_INJECT_COUNT,
  RAG_INJECT_TOKEN_BUDGET,
  RAG_RECALL_K,
} from './dynamic-cut.util';

// estimateTokens = ceil(len/3). 길이 30 → 10 토큰.
function chunk(id: string, len: number) {
  return { id, content: 'x'.repeat(len), score: 1 };
}

describe('applyDynamicCut', () => {
  it('빈 입력 → kept 빈 배열, cutoffApplied=false', () => {
    expect(applyDynamicCut([], { tokenBudget: 8000, maxCount: 12 })).toEqual({
      kept: [],
      cutoffApplied: false,
    });
  });

  it('maxCount(inject-cap) ceiling 으로 초과분 drop', () => {
    const items = Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, 30));
    const { kept, cutoffApplied } = applyDynamicCut(items, {
      tokenBudget: 100000,
      maxCount: 12,
    });
    expect(kept).toHaveLength(12);
    expect(cutoffApplied).toBe(true);
    // 정렬 순서 보존 — 앞 12개.
    expect(kept.map((k) => k.id)).toEqual(items.slice(0, 12).map((k) => k.id));
  });

  it('token-budget 초과 시 중단 (정렬 순서 누적)', () => {
    // 각 30자 = 10토큰. budget 35 → 3개(30토큰) 누적 후 4번째(40>35) 중단.
    const items = Array.from({ length: 10 }, (_, i) => chunk(`c${i}`, 30));
    const { kept, cutoffApplied } = applyDynamicCut(items, {
      tokenBudget: 35,
      maxCount: 12,
    });
    expect(kept).toHaveLength(3);
    expect(cutoffApplied).toBe(true);
  });

  it('단일 청크가 budget 초과해도 최소 1개 보장', () => {
    const items = [chunk('big', 9000)]; // 3000토큰 > budget 8
    const { kept, cutoffApplied } = applyDynamicCut(items, {
      tokenBudget: 8,
      maxCount: 12,
    });
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe('big');
    expect(cutoffApplied).toBe(false);
  });

  it('budget·cap 둘 다 여유면 전부 유지, cutoffApplied=false', () => {
    const items = [chunk('a', 30), chunk('b', 30)];
    const { kept, cutoffApplied } = applyDynamicCut(items, {
      tokenBudget: 8000,
      maxCount: 12,
    });
    expect(kept).toHaveLength(2);
    expect(cutoffApplied).toBe(false);
  });

  it('상수 기본값 노출', () => {
    expect(RAG_RECALL_K).toBe(50);
    expect(RAG_INJECT_TOKEN_BUDGET).toBe(8000);
    expect(RAG_MAX_INJECT_COUNT).toBe(12);
  });
});
