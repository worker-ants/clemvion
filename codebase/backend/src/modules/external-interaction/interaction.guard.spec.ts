import {
  InteractionGuard,
  REFRESH_TOKEN_URL_HEADER,
} from './interaction.guard';
import { InteractionTokenService } from './interaction-token.service';
import { UnauthorizedException } from '@nestjs/common';

type Mock = jest.Mock;

function makeContext(
  params: Record<string, string>,
  headers: Record<string, string> = {},
  query: Record<string, string> = {},
) {
  const setHeader = jest.fn();
  const req: Record<string, unknown> = {
    params,
    headers,
    query,
    res: { setHeader },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
    req,
    setHeader,
  };
}

function makeGuard(opts: {
  verifyPerExecution?: Mock;
  verifyPerTrigger?: Mock;
  triggerFindOne?: Mock;
  executionFindOne?: Mock;
}) {
  const tokenService = {
    verifyPerExecution: opts.verifyPerExecution ?? jest.fn(),
    verifyPerTrigger: opts.verifyPerTrigger ?? jest.fn(),
  } as unknown as InteractionTokenService;
  const triggerRepo = { findOne: opts.triggerFindOne ?? jest.fn() };
  const execRepo = { findOne: opts.executionFindOne ?? jest.fn() };
  const guard = new InteractionGuard(
    tokenService,
    triggerRepo as never,
    execRepo as never,
  );
  return { guard, tokenService, triggerRepo, execRepo };
}

describe('InteractionGuard', () => {
  it('reject — Authorization 헤더와 ?token 둘 다 없음 → TOKEN_MISSING 401', async () => {
    const { guard } = makeGuard({});
    const ctx = makeContext({ executionId: 'exec-1' });
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('reject — executionId 파라미터 없음 → 401', async () => {
    const { guard } = makeGuard({});
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refresh-token URL 헤더가 401 응답에 첨부', async () => {
    const verifyPerExecution = jest.fn().mockResolvedValue({
      valid: false,
      reason: 'expired',
    });
    const { guard } = makeGuard({ verifyPerExecution });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer iext_xxx' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(ctx.setHeader).toHaveBeenCalledWith(
      REFRESH_TOKEN_URL_HEADER,
      '/api/external/executions/exec-1/refresh-token',
    );
  });

  it('iext family — verifyPerExecution 통과 + req.interaction 세팅', async () => {
    const verifyPerExecution = jest
      .fn()
      .mockResolvedValue({ valid: true, executionId: 'exec-1', jti: 'j1' });
    const { guard } = makeGuard({ verifyPerExecution });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer iext_xxx' },
    );
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
    expect(verifyPerExecution).toHaveBeenCalledWith('iext_xxx', 'exec-1');
    expect((ctx.req as { interaction?: unknown }).interaction).toEqual({
      executionId: 'exec-1',
      tokenFamily: 'iext',
    });
  });

  it('iext family — scope mismatch reason 매핑', async () => {
    const verifyPerExecution = jest.fn().mockResolvedValue({
      valid: false,
      reason: 'scope_mismatch',
    });
    const { guard } = makeGuard({ verifyPerExecution });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer iext_xxx' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_SCOPE_MISMATCH' } },
    });
  });

  it('iext family — blacklisted (terminal revoke) reason → TOKEN_REVOKED 401 [EIA-AU-04]', async () => {
    const verifyPerExecution = jest.fn().mockResolvedValue({
      valid: false,
      reason: 'blacklisted',
    });
    const { guard } = makeGuard({ verifyPerExecution });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer iext_revoked' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_REVOKED' } },
    });
    // 갱신 경로 안내 헤더도 동봉 (만료/무효와 동일).
    expect(ctx.setHeader).toHaveBeenCalledWith(
      REFRESH_TOKEN_URL_HEADER,
      '/api/external/executions/exec-1/refresh-token',
    );
  });

  it('itk family — execution.triggerId 매칭 후 verifyPerTrigger 통과', async () => {
    const verifyPerTrigger = jest.fn().mockReturnValue(true);
    const triggerFindOne = jest.fn().mockResolvedValue({
      id: 'trg-1',
      config: {
        interaction: {
          enabled: true,
          tokenStrategy: 'per_trigger',
          triggerToken: 'itk_secret',
        },
      },
    });
    const executionFindOne = jest.fn().mockResolvedValue({
      id: 'exec-1',
      triggerId: 'trg-1',
    });
    const { guard } = makeGuard({
      verifyPerTrigger,
      triggerFindOne,
      executionFindOne,
    });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer itk_secret' },
    );
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
    expect(verifyPerTrigger).toHaveBeenCalledWith('itk_secret', 'itk_secret');
    expect((ctx.req as { interaction?: unknown }).interaction).toEqual({
      executionId: 'exec-1',
      tokenFamily: 'itk',
      triggerId: 'trg-1',
    });
  });

  it('itk family — execution.triggerId 없으면 EXECUTION_NOT_FOUND', async () => {
    const { guard } = makeGuard({
      executionFindOne: jest.fn().mockResolvedValue({
        id: 'exec-1',
        triggerId: null,
      }),
    });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer itk_secret' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'EXECUTION_NOT_FOUND' } },
    });
  });

  it('itk family — trigger.config.interaction 미설정 → TOKEN_INVALID', async () => {
    const { guard } = makeGuard({
      executionFindOne: jest.fn().mockResolvedValue({
        id: 'exec-1',
        triggerId: 'trg-1',
      }),
      triggerFindOne: jest.fn().mockResolvedValue({
        id: 'trg-1',
        config: {},
      }),
    });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer itk_secret' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_INVALID' } },
    });
  });

  it('itk family — verifyPerTrigger false → TOKEN_INVALID', async () => {
    const { guard } = makeGuard({
      verifyPerTrigger: jest.fn().mockReturnValue(false),
      executionFindOne: jest.fn().mockResolvedValue({
        id: 'exec-1',
        triggerId: 'trg-1',
      }),
      triggerFindOne: jest.fn().mockResolvedValue({
        id: 'trg-1',
        config: {
          interaction: {
            enabled: true,
            tokenStrategy: 'per_trigger',
            triggerToken: 'itk_correct',
          },
        },
      }),
    });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer itk_wrong' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_INVALID' } },
    });
  });

  // 인터랙션을 끈 트리거는 저장된 `itk_*` 가 맞아도 거부한다. 다시 켜면 같은 토큰이 다시 통한다
  // (CLE-T-M6PERB 결정 기록, 2026-10-09 사용자 결정).
  it.each([
    ['enabled:false', { enabled: false }],
    ['enabled 없음', {}],
  ])(
    'itk family — 인터랙션이 꺼진 트리거(%s)면 토큰이 맞아도 TOKEN_INVALID',
    async (_label, enabledPart) => {
      const verifyPerTrigger = jest.fn().mockReturnValue(true);
      const { guard } = makeGuard({
        verifyPerTrigger,
        executionFindOne: jest.fn().mockResolvedValue({
          id: 'exec-1',
          triggerId: 'trg-1',
        }),
        triggerFindOne: jest.fn().mockResolvedValue({
          id: 'trg-1',
          config: {
            interaction: {
              ...enabledPart,
              tokenStrategy: 'per_trigger',
              triggerToken: 'itk_secret',
            },
          },
        }),
      });
      const ctx = makeContext(
        { executionId: 'exec-1' },
        { authorization: 'Bearer itk_secret' },
      );
      await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
        response: { error: { code: 'TOKEN_INVALID' } },
      });
      expect(verifyPerTrigger).not.toHaveBeenCalled();
    },
  );

  it('Unknown family prefix → TOKEN_INVALID', async () => {
    const { guard } = makeGuard({});
    const ctx = makeContext(
      { executionId: 'exec-1' },
      { authorization: 'Bearer foo_xxx' },
    );
    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_INVALID' } },
    });
  });

  it('?token query 도 인식 (SSE 호환)', async () => {
    const verifyPerExecution = jest
      .fn()
      .mockResolvedValue({ valid: true, executionId: 'exec-1', jti: 'j1' });
    const { guard } = makeGuard({ verifyPerExecution });
    const ctx = makeContext(
      { executionId: 'exec-1' },
      {},
      { token: 'iext_from_query' },
    );
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
    expect(verifyPerExecution).toHaveBeenCalledWith(
      'iext_from_query',
      'exec-1',
    );
  });
});

// 근거: [EIA 데이터와 흐름 「트리거 단위 토큰」](CLE-EIA-DATA#트리거-단위-토큰), NERV Task `CLE-T-EQDYC1` — SSE 구독을
// 등록한 뒤 트리거 단위 토큰을 다시 확인한다. 가드를 통과한 뒤 등록하기 전에 무효가 된 토큰을 거른다.
describe('InteractionGuard.reverifyTriggerToken', () => {
  const ITK_CONFIG = {
    interaction: {
      enabled: true,
      tokenStrategy: 'per_trigger',
      triggerToken: 'itk_secret',
    },
  };
  const ITK_INTERACTION = {
    executionId: 'exec-1',
    tokenFamily: 'itk',
    triggerId: 'trg-1',
  };

  function makeReq(
    interaction: Record<string, unknown> | undefined,
    authorization = 'Bearer itk_secret',
  ) {
    const ctx = makeContext({ executionId: 'exec-1' }, { authorization });
    ctx.req.interaction = interaction;
    return ctx;
  }

  it('트리거의 지금 설정으로 토큰이 맞으면 통과한다', async () => {
    const triggerFindOne = jest
      .fn()
      .mockResolvedValue({ id: 'trg-1', config: ITK_CONFIG });
    const verifyPerTrigger = jest.fn().mockReturnValue(true);
    const { guard } = makeGuard({ triggerFindOne, verifyPerTrigger });
    const ctx = makeReq(ITK_INTERACTION);
    await expect(
      guard.reverifyTriggerToken(ctx.req as never),
    ).resolves.toBeUndefined();
    expect(triggerFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'trg-1' } }),
    );
    expect(verifyPerTrigger).toHaveBeenCalledWith('itk_secret', 'itk_secret');
  });

  it('재발급으로 토큰이 바뀌었으면 TOKEN_INVALID 401 과 refresh 헤더', async () => {
    const { guard } = makeGuard({
      triggerFindOne: jest.fn().mockResolvedValue({
        id: 'trg-1',
        config: {
          interaction: { ...ITK_CONFIG.interaction, triggerToken: 'itk_new' },
        },
      }),
      verifyPerTrigger: jest.fn().mockReturnValue(false),
    });
    const ctx = makeReq(ITK_INTERACTION);
    await expect(
      guard.reverifyTriggerToken(ctx.req as never),
    ).rejects.toMatchObject({
      status: 401,
      response: { error: { code: 'TOKEN_INVALID', message: 'Token rejected' } },
    });
    expect(ctx.setHeader).toHaveBeenCalledWith(
      REFRESH_TOKEN_URL_HEADER,
      '/api/external/executions/exec-1/refresh-token',
    );
  });

  it.each([
    [
      '인터랙션을 껐다',
      {
        id: 'trg-1',
        config: { interaction: { ...ITK_CONFIG.interaction, enabled: false } },
      },
    ],
    [
      '전략을 바꿔 토큰을 지웠다',
      {
        id: 'trg-1',
        config: {
          interaction: { enabled: true, tokenStrategy: 'per_execution' },
        },
      },
    ],
    ['트리거를 지웠다', null],
  ])('%s → TOKEN_INVALID 401', async (_label, trigger) => {
    const verifyPerTrigger = jest.fn().mockReturnValue(true);
    const { guard } = makeGuard({
      triggerFindOne: jest.fn().mockResolvedValue(trigger),
      verifyPerTrigger,
    });
    const ctx = makeReq(ITK_INTERACTION);
    await expect(
      guard.reverifyTriggerToken(ctx.req as never),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        error: {
          code: 'TOKEN_INVALID',
          message: 'Trigger has no per-trigger token',
        },
      },
    });
    expect(verifyPerTrigger).not.toHaveBeenCalled();
  });

  it.each([
    ['가드 컨텍스트 없음', undefined, 'Bearer itk_secret'],
    [
      'triggerId 없음',
      { ...ITK_INTERACTION, triggerId: null },
      'Bearer itk_secret',
    ],
    ['실행 단위 토큰', ITK_INTERACTION, 'Bearer iext_xxx'],
    ['토큰 없음', ITK_INTERACTION, ''],
  ])(
    '%s → DB 를 읽지 않고 TOKEN_INVALID 401',
    async (_label, interaction, authorization) => {
      const triggerFindOne = jest.fn();
      const { guard } = makeGuard({ triggerFindOne });
      const ctx = makeReq(interaction, authorization);
      await expect(
        guard.reverifyTriggerToken(ctx.req as never),
      ).rejects.toMatchObject({
        status: 401,
        response: { error: { code: 'TOKEN_INVALID' } },
      });
      expect(triggerFindOne).not.toHaveBeenCalled();
    },
  );

  it('rejectTriggerToken 은 같은 401 을 던진다', () => {
    const { guard } = makeGuard({});
    const ctx = makeReq(ITK_INTERACTION);
    let thrown: unknown;
    try {
      guard.rejectTriggerToken(ctx.req as never);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(UnauthorizedException);
    expect(thrown).toMatchObject({
      response: { error: { code: 'TOKEN_INVALID', message: 'Token rejected' } },
    });
    expect(ctx.setHeader).toHaveBeenCalledWith(
      REFRESH_TOKEN_URL_HEADER,
      '/api/external/executions/exec-1/refresh-token',
    );
  });
});
