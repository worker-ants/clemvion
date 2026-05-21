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
