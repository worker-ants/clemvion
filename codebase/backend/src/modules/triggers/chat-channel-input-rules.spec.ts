import { BadRequestException } from '@nestjs/common';

import {
  assertChatChannelAlreadySetUp,
  assertChatChannelInputSafe,
  assertInboundSigningPlaintextByProvider,
  assertPatchCarriesNoSecrets,
  stripChatChannelPlaintext,
  translateSetupChannelError,
} from './chat-channel-input-rules';
import { CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES } from './chat-channel-rejection-messages.const';
import type { ChatChannelConfigDto } from './dto/chat-channel-config.dto';
import type { Trigger } from './entities/trigger.entity';

/**
 * **이 파일이 이 추출의 두 번째 동기다.**
 *
 * 이 규칙들이 `TriggersService` private 메서드였을 때는 **서비스를 통해서만** 닿을 수 있었다 —
 * repo·registry·secret store 를 mock 한 `Test.createTestingModule` 을 세우고 `update()` 를
 * 태워야 가드 하나를 건드렸다. 지금은 의존이 0이라 **mock 없이 직접 호출**한다.
 *
 * 이동 자체의 증거는 `triggers.service.spec.ts` 다(테스트 무편집 통과). 이 파일은 그 위에
 * **새로 얻은 것**을 쓴다 — 특히 서비스 경유로는 비싸서 아무도 안 썼던 자리들
 * (`translateSetupChannelError` 는 이동 전 테스트가 **0건**이었다).
 */
const cfg = (over: Record<string, unknown> = {}) =>
  ({ provider: 'telegram', ...over }) as unknown as ChatChannelConfigDto;

const thrown = (fn: () => void) => {
  try {
    fn();
    return null;
  } catch (err) {
    return (err as BadRequestException).getResponse() as {
      code: string;
      message: string;
      details: { field: string; code: string };
    };
  }
};

describe('chat-channel-input-rules — 내부 필드 차단 (R-CC-21)', () => {
  it.each([
    ['botTokenRef', { botTokenRef: 'secret://x' }],
    ['inboundSigningRef', { inboundSigningRef: 'secret://y' }],
    ['inboundSigning', { inboundSigning: 'z'.repeat(40) }],
  ] as const)('%s 는 생성 경로에서도 거부된다', (field, payload) => {
    const res = thrown(() =>
      assertChatChannelInputSafe(cfg(payload), 'create'),
    );
    expect(res).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES[field],
    });
    expect(res?.details).toEqual({ field, code: 'INVALID_FIELD' });
  });

  it('PATCH 는 값 필드(botToken)도 거부한다 — create 는 받는다', () => {
    expect(
      thrown(() => assertPatchCarriesNoSecrets(cfg({ botToken: '1:a' }))),
    ).toMatchObject({
      details: { field: 'botToken', code: 'INVALID_FIELD' },
    });
    // 생성 경로에는 이 가드가 걸리지 않는다 — 두 경로의 요구가 정반대라는 것이 R-CC-21 이다.
    //
    // **provider 를 slack 으로 둔다**: telegram 은 `inboundSigningPlaintext` 를 *금지*하므로
    // 그대로 쓰면 이 케이스가 **다른 이유로** 던져 대조군이 조용히 흡수된다(첫 판본이 그랬다).
    // slack 은 그 필드를 *요구*하므로 "생성은 값 필드를 받는다" 만 남는다.
    expect(
      thrown(() =>
        assertChatChannelInputSafe(
          cfg({
            provider: 'slack',
            botToken: 'xoxb-a',
            inboundSigningPlaintext: 'a'.repeat(32),
          }),
          'create',
        ),
      ),
    ).toBeNull();
  });
});

describe('chat-channel-input-rules — provider 분기 (생성 전용)', () => {
  it('slack 은 hex32 를 요구한다', () => {
    expect(
      thrown(() =>
        assertInboundSigningPlaintextByProvider(
          cfg({ provider: 'slack', inboundSigningPlaintext: 'Z'.repeat(32) }),
        ),
      ),
    ).toMatchObject({
      details: { field: 'inboundSigningPlaintext', code: 'INVALID_FIELD' },
    });
    expect(
      thrown(() =>
        assertInboundSigningPlaintextByProvider(
          cfg({ provider: 'slack', inboundSigningPlaintext: 'a'.repeat(32) }),
        ),
      ),
    ).toBeNull();
  });

  it('telegram 은 그 필드 자체를 금지한다 (server-issued)', () => {
    expect(
      thrown(() =>
        assertInboundSigningPlaintextByProvider(
          cfg({ inboundSigningPlaintext: 'a'.repeat(32) }),
        ),
      ),
    ).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('chat-channel-input-rules — 정화·존재성', () => {
  it('plaintext 두 필드를 제거한다 (SS-SE-01)', () => {
    const out = stripChatChannelPlaintext(
      cfg({ botToken: '1:a', inboundSigningPlaintext: 'a'.repeat(32) }),
    ) as unknown as Record<string, unknown>;
    expect(out).not.toHaveProperty('botToken');
    expect(out).not.toHaveProperty('inboundSigningPlaintext');
    expect(out.provider).toBe('telegram');
  });

  it('chatChannel 이 없는 트리거에 PATCH 로 사후 부착하면 거부한다', () => {
    const bare = { config: {} } as unknown as Trigger;
    expect(
      thrown(() => assertChatChannelAlreadySetUp(bare, cfg())),
    ).toMatchObject({
      details: { field: 'chatChannel', code: 'INVALID_FIELD' },
    });
  });

  it('provider 전환도 거부한다', () => {
    const existing = {
      config: { chatChannel: { provider: 'telegram' } },
    } as unknown as Trigger;
    expect(
      thrown(() =>
        assertChatChannelAlreadySetUp(existing, cfg({ provider: 'slack' })),
      ),
    ).toMatchObject({ details: { field: 'provider', code: 'INVALID_FIELD' } });
  });
});

describe('translateSetupChannelError — 이동 전 테스트가 0건이던 자리', () => {
  const res = (message: string) =>
    translateSetupChannelError(new Error(message)).getResponse() as {
      code: string;
    };

  it('메시지에 401/403 이 있으면 400 BOT_TOKEN_INVALID 로 옮긴다', () => {
    expect(res('Slack auth.test failed: 401').code).toBe('BOT_TOKEN_INVALID');
    expect(res('Discord getApplicationMe failed: 403').code).toBe(
      'BOT_TOKEN_INVALID',
    );
  });

  it('그 외는 502 CHAT_CHANNEL_SETUP_FAILED 로 떨어진다', () => {
    expect(res('ECONNRESET').code).toBe('CHAT_CHANNEL_SETUP_FAILED');
  });

  /**
   * **캐너리 — 현재 동작이 의도와 다르다.** 고치면 이 테스트가 RED 가 된다.
   *
   * `discord.adapter.ts` 는 verify_key 불일치에 `'BOT_TOKEN_INVALID: Discord verify_key 가
   * 등록된 public key 와 불일치'` 를 던진다 — **숫자가 없어서** 위 판별식 `/\b(401|403)\b/` 에
   * 걸리지 않고 fallback 으로 간다. 즉 사용자는 **400 대신 502** 를 받는다.
   *
   * **이 PR 이 만든 회귀가 아니다** — 이동 전부터 그랬고 테스트가 0건이라 아무도 몰랐다.
   * 이 PR 의 주장은 **동작 보존**이므로 여기서 고치지 않는다. 현재 동작을 고정해 두면
   * 처방이 정해졌을 때 그 변경이 **의도된 것임이 diff 에서 보인다**.
   *
   * 추적: `plan/in-progress/spec-draft-nullable-notation-followups.md`
   * (`/ai-review` `review/code/2026/09/11/15_31_54` W3 — 근본 처방은 adapter 가 status 를
   * 메시지에 싣게 통일하는 쪽이다. 판별식이 문자열을 추측하는 구조가 원인이다).
   */
  it('[캐너리] discord verify_key 불일치는 **지금은** 502 로 떨어진다 (의도는 400)', () => {
    expect(
      res(
        'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치',
      ).code,
    ).toBe('CHAT_CHANNEL_SETUP_FAILED');
  });
});
