import {
  ConversationTurn,
  DEFAULT_THREAD_ID,
  createEmptyConversationThread,
  rehydrateConversationThread,
} from './conversation-thread.types';

function makeTurn(overrides: Partial<ConversationTurn> = {}): ConversationTurn {
  return {
    seq: 0,
    nodeId: 'node-1',
    nodeLabel: 'Form',
    nodeType: 'form',
    timestamp: '2026-06-05T10:00:00.000Z',
    source: 'presentation_user',
    text: '',
    ...overrides,
  };
}

// spec: conversation-thread.md §4·§8.4 (durable park resume), 4-execution-engine
// §7.5 (rehydration). 본 함수는 `Execution.conversation_thread` jsonb 스냅샷에서
// 로드한 raw 값을 안전한 MutableConversationThread 로 정규화하는 rehydration 진입점.
describe('rehydrateConversationThread', () => {
  it('returns an empty thread for null/undefined (park 이력 없음 / 배포 이전 row)', () => {
    expect(rehydrateConversationThread(null)).toEqual(
      createEmptyConversationThread(),
    );
    expect(rehydrateConversationThread(undefined)).toEqual(
      createEmptyConversationThread(),
    );
  });

  it('returns an empty thread for non-object raw (손상 graceful)', () => {
    expect(rehydrateConversationThread('garbage')).toEqual(
      createEmptyConversationThread(),
    );
    expect(rehydrateConversationThread(42)).toEqual(
      createEmptyConversationThread(),
    );
  });

  it('restores a well-formed thread losslessly (turns/nextSeq/totalChars)', () => {
    const turns = [
      makeTurn({ seq: 0, text: 'hello', source: 'presentation_user' }),
      makeTurn({ seq: 1, text: 'hi there', source: 'ai_assistant' }),
    ];
    const raw = {
      id: DEFAULT_THREAD_ID,
      nextSeq: 2,
      turns,
      totalChars: 13,
    };

    const restored = rehydrateConversationThread(raw);

    expect(restored.id).toBe(DEFAULT_THREAD_ID);
    expect(restored.nextSeq).toBe(2);
    expect(restored.totalChars).toBe(13);
    expect(restored.turns).toEqual(turns);
  });

  it('preserves runningSummary / summarizedUpToSeq (summary_buffer/persistent 전략)', () => {
    const raw = {
      id: DEFAULT_THREAD_ID,
      nextSeq: 1,
      turns: [makeTurn({ seq: 0, text: 'x' })],
      totalChars: 1,
      runningSummary: '사용자는 환불을 요청했다.',
      summarizedUpToSeq: 0,
    };

    const restored = rehydrateConversationThread(raw);

    expect(restored.runningSummary).toBe('사용자는 환불을 요청했다.');
    expect(restored.summarizedUpToSeq).toBe(0);
  });

  it('omits runningSummary / summarizedUpToSeq when absent (manual 전략)', () => {
    const restored = rehydrateConversationThread({
      id: DEFAULT_THREAD_ID,
      nextSeq: 0,
      turns: [],
      totalChars: 0,
    });

    expect(restored.runningSummary).toBeUndefined();
    expect(restored.summarizedUpToSeq).toBeUndefined();
  });

  it('copies turns into a fresh array (영속본 참조와 분리 — 이후 append 가 스냅샷 오염 X)', () => {
    const turns = [makeTurn({ seq: 0, text: 'a' })];
    const raw = { id: DEFAULT_THREAD_ID, nextSeq: 1, turns, totalChars: 1 };

    const restored = rehydrateConversationThread(raw);
    restored.turns.push(makeTurn({ seq: 1, text: 'b' }));

    expect(turns).toHaveLength(1); // 원본 배열 불변
  });

  describe('append 불변량 보존 — eviction-aware 보강', () => {
    it('preserves nextSeq above turns.length (eviction 후 monotonic 카운터 보존 → seq 재사용 방지)', () => {
      // §STORAGE_MAX_TURNS eviction 후: turns 는 drop 됐어도 nextSeq 는 유지된다.
      const restored = rehydrateConversationThread({
        id: DEFAULT_THREAD_ID,
        nextSeq: 5,
        turns: [makeTurn({ seq: 3 }), makeTurn({ seq: 4 })],
        totalChars: 0,
      });
      expect(restored.nextSeq).toBe(5);
    });

    it('rederives nextSeq to turns.length when stored is below it (손상 — seq 재사용 위험)', () => {
      const restored = rehydrateConversationThread({
        id: DEFAULT_THREAD_ID,
        nextSeq: 1, // turns.length(3) 미만 → 손상
        turns: [
          makeTurn({ seq: 0 }),
          makeTurn({ seq: 1 }),
          makeTurn({ seq: 2 }),
        ],
        totalChars: 0,
      });
      expect(restored.nextSeq).toBe(3);
    });

    it('rederives nextSeq when stored value is non-numeric', () => {
      const restored = rehydrateConversationThread({
        id: DEFAULT_THREAD_ID,
        nextSeq: 'bad',
        turns: [makeTurn({ seq: 0 })],
        totalChars: 0,
      });
      expect(restored.nextSeq).toBe(1);
    });

    it('recomputes totalChars from turn text (stale 캐시 / eviction drift 제거)', () => {
      const restored = rehydrateConversationThread({
        id: DEFAULT_THREAD_ID,
        nextSeq: 2,
        turns: [
          makeTurn({ seq: 0, text: 'abc' }),
          makeTurn({ seq: 1, text: 'de' }),
        ],
        totalChars: 999, // stale — 무시하고 turns 에서 재계산
      });
      expect(restored.totalChars).toBe(5);
    });

    it('returns an empty thread when raw.turns is not an array (손상 — 전체 리셋)', () => {
      const restored = rehydrateConversationThread({
        id: DEFAULT_THREAD_ID,
        nextSeq: 5,
        turns: 'not-an-array',
        totalChars: 10,
      });
      expect(restored).toEqual(createEmptyConversationThread());
    });

    it('falls back to DEFAULT_THREAD_ID when id is missing', () => {
      const restored = rehydrateConversationThread({
        nextSeq: 0,
        turns: [],
        totalChars: 0,
      });
      expect(restored.id).toBe(DEFAULT_THREAD_ID);
    });
  });
});
