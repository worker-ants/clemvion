import { describe, it, expect } from '@jest/globals';
import { StubLlmClient, STUB_MAX_DELAY_MS } from './stub.client';
import type { ChatMessage } from '../interfaces/llm-client.interface';

/**
 * StubLlmClient 단위 테스트 (review W2) — 결정적 stub 의 핵심 계약을 고정한다:
 * 마지막 user 메시지 echo, 200자 슬라이싱, tool call 부재(멀티턴 waits 보장),
 * embed/listModels/testConnection 형태.
 */
describe('StubLlmClient', () => {
  const client = new StubLlmClient();
  const msg = (role: ChatMessage['role'], content: string): ChatMessage => ({
    role,
    content,
  });

  describe('chat', () => {
    it('마지막 user 메시지를 echo 하고 tool call 을 만들지 않는다 (멀티턴 waits)', async () => {
      const res = await client.chat({
        model: 'm',
        messages: [
          msg('system', 'sys'),
          msg('user', 'first'),
          msg('assistant', '[stub] received: first'),
          msg('user', 'second'),
        ],
      });
      expect(res.content).toBe('[stub] received: second');
      expect(res.toolCalls).toEqual([]);
      expect(res.finishReason).toBe('stop');
      expect(res.model).toBe('m');
      expect(res.usage.totalTokens).toBeGreaterThan(0);
    });

    it('user 메시지가 없으면 빈 echo (크래시 없음)', async () => {
      const res = await client.chat({
        model: 'm',
        messages: [msg('system', 'sys')],
      });
      expect(res.content).toBe('[stub] received: ');
    });

    it('user 메시지를 200자로 슬라이싱한다', async () => {
      const long = 'x'.repeat(500);
      const res = await client.chat({
        model: 'm',
        messages: [msg('user', long)],
      });
      expect(res.content).toBe(`[stub] received: ${'x'.repeat(200)}`);
    });

    it('model 미지정 시 stub-model 로 fallback', async () => {
      const res = await client.chat({
        model: '',
        messages: [msg('user', 'q')],
      });
      expect(res.model).toBe('stub-model');
    });

    // ai-review WARNING #6 (2026-07-26) — e2e 가 "턴 진행 중 Stop" 레이스를
    // 관측하려면 실제로 대기 가능한 RUNNING 윈도우가 필요하다. `__e2e_delay_ms:<n>`
    // 마커가 그 윈도우를 만든다.
    describe('__e2e_delay_ms 마커 (WARNING #6 — e2e RUNNING 윈도우)', () => {
      it('마커가 있으면 지정된 ms 만큼 실제로 지연한 뒤 응답하고, echo 에서 마커를 제거한다', async () => {
        const start = Date.now();
        const res = await client.chat({
          model: 'm',
          messages: [msg('user', '__e2e_delay_ms:30 payload-after-marker')],
        });
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(25); // 약간의 여유(CI jitter)
        expect(res.content).toBe('[stub] received: payload-after-marker');
      });

      it('마커가 없으면 지연 없이 즉시 응답한다(기존 동작 보존)', async () => {
        const res = await client.chat({
          model: 'm',
          messages: [msg('user', 'no-marker-here')],
        });
        expect(res.content).toBe('[stub] received: no-marker-here');
      });

      it('지연 요청이 상한(STUB_MAX_DELAY_MS)을 넘으면 캡되어 그 이상 대기하지 않는다(무한 e2e hang 방지)', async () => {
        jest.useFakeTimers();
        try {
          const requested = STUB_MAX_DELAY_MS + 10_000;
          const resultPromise = client.chat({
            model: 'm',
            messages: [msg('user', `__e2e_delay_ms:${requested} capped`)],
          });
          // 요청한 지연(상한 + 10s)이 아니라 상한만큼만 진행해도 resolve 돼야 한다.
          await jest.advanceTimersByTimeAsync(STUB_MAX_DELAY_MS);
          const res = await resultPromise;
          expect(res.content).toBe('[stub] received: capped');
        } finally {
          jest.useRealTimers();
        }
      });
    });
  });

  it('embed 는 입력 수만큼 결정적 벡터를 반환한다', async () => {
    const out = await client.embed(['a', 'b']);
    expect(out).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('listModels 는 chat 타입 stub 모델을 반환한다', async () => {
    const models = await client.listModels();
    expect(models).toEqual([
      { id: 'stub-model', name: 'Stub Model', type: 'chat' },
    ]);
  });

  it('testConnection 은 true', async () => {
    await expect(client.testConnection()).resolves.toBe(true);
  });
});
