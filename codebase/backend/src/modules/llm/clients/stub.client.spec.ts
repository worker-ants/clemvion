import { describe, it, expect } from '@jest/globals';
import { StubLlmClient } from './stub.client';
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
      const res = await client.chat({ model: '', messages: [msg('user', 'q')] });
      expect(res.model).toBe('stub-model');
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
