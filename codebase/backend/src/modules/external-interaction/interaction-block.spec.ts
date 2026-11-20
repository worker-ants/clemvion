import {
  buildInteractionBlock,
  buildInteractionEndpoints,
  expectedCommandsFor,
} from './interaction-block';

/**
 * 인터랙션 블록 빌더 — 웹훅 202 응답(REQ-EIA-002 · 003)과 알림 웹훅(REQ-EIANOTI-033)이 같이 쓴다.
 */

function tokenServiceStub() {
  return {
    issuePerExecution: jest.fn().mockResolvedValue({
      token: 'iext_jwt',
      expiresAt: '2026-11-20T15:00:00.000Z',
      jti: 'jti-1',
    }),
  };
}

describe('buildInteractionEndpoints', () => {
  it('다섯 엔드포인트를 상대 경로로 만든다', () => {
    expect(buildInteractionEndpoints('exec-1')).toEqual({
      stream: '/api/external/executions/exec-1/stream',
      submit: '/api/external/executions/exec-1/interact',
      status: '/api/external/executions/exec-1',
      cancel: '/api/external/executions/exec-1/cancel',
      refresh: '/api/external/executions/exec-1/refresh-token',
    });
  });
});

describe('buildInteractionBlock', () => {
  it.each([
    ['interaction 없음', {}],
    ['interaction 이 객체가 아님', { interaction: 'on' }],
    ['enabled 가 true 가 아님', { interaction: { enabled: 'true' } }],
    ['enabled false', { interaction: { enabled: false } }],
  ])('%s → null 이고 토큰을 발급하지 않는다', async (_label, config) => {
    const tokenService = tokenServiceStub();
    await expect(
      buildInteractionBlock(config, 'exec-1', tokenService),
    ).resolves.toBeNull();
    expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
  });

  it('tokenStrategy 가 없으면 per_execution 으로 보고 새 토큰과 만료 시각을 싣는다', async () => {
    const tokenService = tokenServiceStub();
    const block = await buildInteractionBlock(
      { interaction: { enabled: true } },
      'exec-1',
      tokenService,
    );
    expect(tokenService.issuePerExecution).toHaveBeenCalledWith('exec-1');
    expect(block).toEqual({
      token: 'iext_jwt',
      expiresAt: '2026-11-20T15:00:00.000Z',
      endpoints: buildInteractionEndpoints('exec-1'),
    });
    // jti 는 서버 안에서만 쓴다. 블록에 싣지 않는다.
    expect(block).not.toHaveProperty('jti');
  });

  it('부를 때마다 새 토큰을 발급한다(알림마다 발급)', async () => {
    const tokenService = tokenServiceStub();
    const config = {
      interaction: { enabled: true, tokenStrategy: 'per_execution' },
    };
    await buildInteractionBlock(config, 'exec-1', tokenService);
    await buildInteractionBlock(config, 'exec-1', tokenService);
    expect(tokenService.issuePerExecution).toHaveBeenCalledTimes(2);
  });

  it('per_trigger 면 token · expiresAt 키를 싣지 않고 엔드포인트만 싣는다', async () => {
    const tokenService = tokenServiceStub();
    const block = await buildInteractionBlock(
      { interaction: { enabled: true, tokenStrategy: 'per_trigger' } },
      'exec-1',
      tokenService,
    );
    expect(tokenService.issuePerExecution).not.toHaveBeenCalled();
    expect(block).toEqual({ endpoints: buildInteractionEndpoints('exec-1') });
    expect(block).not.toHaveProperty('token');
    expect(block).not.toHaveProperty('expiresAt');
  });

  it('토큰 발급이 실패하면 그 오류를 그대로 던진다(처리는 호출자가 정한다)', async () => {
    const tokenService = {
      issuePerExecution: jest.fn().mockRejectedValue(new Error('sign failed')),
    };
    await expect(
      buildInteractionBlock(
        { interaction: { enabled: true } },
        'exec-1',
        tokenService,
      ),
    ).rejects.toThrow('sign failed');
  });
});

describe('expectedCommandsFor', () => {
  it.each([
    ['form', ['submit_form']],
    ['buttons', ['click_button']],
    ['ai_conversation', ['submit_message', 'end_conversation']],
    // EIA 외부 계약은 ai_form_render 를 ai_conversation 에 합친다(CLE-IX-TYPES).
    ['ai_form_render', ['submit_message', 'end_conversation']],
  ])('%s → %j', (interactionType, expected) => {
    expect(expectedCommandsFor(interactionType)).toEqual(expected);
  });

  it.each([undefined, null, 42, 'unknown', 'toString', '__proto__'])(
    '모르는 값(%p)이면 빈 배열이다',
    (interactionType) => {
      expect(expectedCommandsFor(interactionType)).toEqual([]);
    },
  );

  it('돌려준 배열을 고쳐도 다음 결과에 번지지 않는다', () => {
    const first = expectedCommandsFor('form');
    first.push('cancel');
    expect(expectedCommandsFor('form')).toEqual(['submit_form']);
  });
});
