import {
  appendStablePrefix,
  buildRecallBlock,
  buildSummaryBlock,
  buildSummaryBufferUpdate,
  estimateWorkingMemoryTokens,
  selectVolatileTail,
  stripMemoryBlocks,
} from './agent-memory-injection';
import type { ConversationTurn } from '../../../shared/conversation-thread/conversation-thread.types';
import type { LlmService } from '../../../modules/llm/llm.service';
import type { LlmConfig } from '../../../modules/llm-config/entities/llm-config.entity';

function turn(seq: number, text: string): ConversationTurn {
  return {
    seq,
    nodeId: 'n1',
    nodeLabel: 'Agent',
    nodeType: 'ai_agent',
    timestamp: '2026-06-03T00:00:00.000Z',
    source: seq % 2 === 0 ? 'ai_user' : 'ai_assistant',
    text,
  };
}

const llmConfig = { id: 'cfg', defaultModel: 'gpt-4o' } as unknown as LlmConfig;

function makeLlmServiceMock(content = 'COMPRESSED SUMMARY') {
  const chat = jest.fn().mockResolvedValue({
    content,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    model: 'gpt-4o',
    finishReason: 'stop',
  });
  return { chat } as unknown as LlmService & { chat: jest.Mock };
}

describe('agent-memory-injection blocks', () => {
  it('buildRecallBlock renders recalled facts as a bullet list', () => {
    const block = buildRecallBlock([
      { content: 'User prefers email', score: 0.9 },
      { content: 'Timezone is KST', score: 0.8 },
    ]);
    expect(block).toContain('User prefers email');
    expect(block).toContain('Timezone is KST');
    expect(buildRecallBlock([])).toBe('');
  });

  it('buildSummaryBlock wraps the running summary in stable markers', () => {
    expect(buildSummaryBlock(undefined)).toBe('');
    expect(buildSummaryBlock('  ')).toBe('');
    const block = buildSummaryBlock('Earlier the user asked about refunds.');
    expect(block).toContain('Earlier the user asked about refunds.');
  });

  it('appendStablePrefix appends both blocks after the system prompt', () => {
    const out = appendStablePrefix('SYS', 'RECALL', 'SUMMARY');
    expect(out.startsWith('SYS')).toBe(true);
    expect(out).toContain('RECALL');
    expect(out).toContain('SUMMARY');
    // 빈 블록이면 변경 없음.
    expect(appendStablePrefix('SYS', '', '')).toBe('SYS');
  });

  it('stripMemoryBlocks removes previously appended recall/summary blocks', () => {
    const base = 'SYSTEM PROMPT';
    const withBlocks = appendStablePrefix(
      base,
      buildRecallBlock([{ content: 'fact A', score: 1 }]),
      buildSummaryBlock('prior summary'),
    );
    expect(withBlocks).toContain('fact A');
    expect(stripMemoryBlocks(withBlocks)).toBe(base);
  });

  it('selectVolatileTail keeps only turns after summarizedUpToSeq', () => {
    const turns = [turn(0, 'a'), turn(1, 'b'), turn(2, 'c'), turn(3, 'd')];
    expect(selectVolatileTail(turns, undefined)).toHaveLength(4);
    expect(selectVolatileTail(turns, 1).map((t) => t.seq)).toEqual([2, 3]);
  });
});

describe('buildSummaryBufferUpdate — token budget + cache-protection invariant', () => {
  it('does NOT call the LLM when under budget (no re-summarisation)', async () => {
    const llm = makeLlmServiceMock();
    const turns = [turn(0, 'short'), turn(1, 'also short')];
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: undefined,
      summarizedUpToSeq: undefined,
      tokenBudget: 100000, // huge — never exceeded
      systemPromptText: 'sys',
      llmConfig,
      model: 'gpt-4o',
      llmService: llm,
    });
    expect(llm.chat).not.toHaveBeenCalled();
    expect(update.summarized).toBe(false);
    expect(update.runningSummary).toBeUndefined();
    expect(update.summarizedUpToSeq).toBeUndefined();
  });

  it('compresses oldest turns and advances summarizedUpToSeq when over budget', async () => {
    const llm = makeLlmServiceMock('SUMMARY OF OLD TURNS');
    // 6 turns, each ~big. Tiny budget forces compression of the oldest ones,
    // keeping at least MIN_RECENT_RAW_TURNS (2) as the volatile tail.
    const big = 'x'.repeat(400);
    const turns = [0, 1, 2, 3, 4, 5].map((s) => turn(s, big));
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: undefined,
      summarizedUpToSeq: undefined,
      tokenBudget: 300, // ~300 tokens budget; each turn ≈133 tokens
      systemPromptText: 'sys',
      llmConfig,
      model: 'gpt-4o',
      llmService: llm,
    });
    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(update.summarized).toBe(true);
    expect(update.runningSummary).toBe('SUMMARY OF OLD TURNS');
    // 최소 2개 (MIN_RECENT_RAW_TURNS) 는 원문으로 남으므로 최대 seq 4 까지만 압축.
    expect(update.summarizedUpToSeq).toBeLessThanOrEqual(4);
    expect(update.summarizedUpToSeq).toBeGreaterThanOrEqual(0);
  });

  it('does NOT re-summarise turns already covered by summarizedUpToSeq (cache invariant)', async () => {
    const llm = makeLlmServiceMock();
    // Turns 0..3 already summarised (summarizedUpToSeq=3). Only seq 4,5 remain
    // uncompressed and they are small → under budget → no LLM call.
    const turns = [0, 1, 2, 3, 4, 5].map((s) => turn(s, 'x'.repeat(400)));
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: 'EXISTING SUMMARY',
      summarizedUpToSeq: 3,
      tokenBudget: 100000, // huge so the 2 remaining turns never trigger
      systemPromptText: 'sys',
      llmConfig,
      model: 'gpt-4o',
      llmService: llm,
    });
    // 이미 커버된 turn (0..3) 은 재요약하지 않는다 — uncompressed (4,5) 만 보고
    // 예산 미만이라 LLM 미호출.
    expect(llm.chat).not.toHaveBeenCalled();
    expect(update.summarized).toBe(false);
    expect(update.runningSummary).toBe('EXISTING SUMMARY');
    expect(update.summarizedUpToSeq).toBe(3);
  });

  it('accumulates onto a prior running summary when newly over budget', async () => {
    const llm = makeLlmServiceMock('MERGED SUMMARY');
    const big = 'y'.repeat(400);
    // seq 0..1 already summarised; seq 2..7 newly exceed budget.
    const turns = [0, 1, 2, 3, 4, 5, 6, 7].map((s) => turn(s, big));
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: 'OLD SUMMARY',
      summarizedUpToSeq: 1,
      tokenBudget: 300,
      systemPromptText: 'sys',
      llmConfig,
      model: 'gpt-4o',
      llmService: llm,
    });
    expect(llm.chat).toHaveBeenCalledTimes(1);
    // 요약 프롬프트에 기존 요약이 포함되어야 한다 (누적 압축).
    const callArgs = llm.chat.mock.calls[0][1] as {
      messages: { content: string }[];
    };
    expect(callArgs.messages[0].content).toContain('OLD SUMMARY');
    expect(update.summarized).toBe(true);
    expect(update.runningSummary).toBe('MERGED SUMMARY');
    expect(update.summarizedUpToSeq).toBeGreaterThan(1);
  });

  it('falls back to no-change when the summary LLM returns empty content', async () => {
    const llm = makeLlmServiceMock('');
    const big = 'z'.repeat(400);
    const turns = [0, 1, 2, 3, 4, 5].map((s) => turn(s, big));
    const update = await buildSummaryBufferUpdate({
      turns,
      runningSummary: undefined,
      summarizedUpToSeq: undefined,
      tokenBudget: 300,
      systemPromptText: 'sys',
      llmConfig,
      model: 'gpt-4o',
      llmService: llm,
    });
    expect(llm.chat).toHaveBeenCalledTimes(1);
    expect(update.summarized).toBe(false);
    expect(update.runningSummary).toBeUndefined();
  });
});

describe('estimateWorkingMemoryTokens', () => {
  it('sums turn text + extra texts', () => {
    const t = [turn(0, 'aaa'), turn(1, 'bbb')];
    const total = estimateWorkingMemoryTokens(t, 'cccc');
    expect(total).toBeGreaterThan(0);
  });
});
