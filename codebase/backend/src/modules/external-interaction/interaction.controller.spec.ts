import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InteractionController } from './interaction.controller';
import { InteractionService } from './interaction.service';
import { InteractionGuard } from './interaction.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { InteractionTokenService } from './interaction-token.service';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import type { InteractionRequestContext } from './interaction.guard';
import type { InteractAckDto } from './dto/responses.dto';

/**
 * NestJS 통합 spec — controller 의 routing / guard 바인딩 / service 위임을 검증.
 *
 * [ai-review W5] 의 fix. Service 단위 spec (`interaction.service.spec.ts`) 는 별개 — 본 spec 은
 * controller 가 service / guard 를 올바르게 wire 하는지에 집중.
 */
describe('InteractionController (integration)', () => {
  const ctx: InteractionRequestContext = {
    executionId: 'exec-1',
    tokenFamily: 'iext',
  };
  const ack: InteractAckDto = {
    executionId: 'exec-1',
    accepted: true,
    currentStatus: 'running',
  };

  async function makeController(serviceMock: Partial<InteractionService>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [InteractionController],
      providers: [
        { provide: InteractionService, useValue: serviceMock },
        // Guard / Interceptor 는 컨트롤러 메타데이터로만 검증 — 실제 실행은 e2e 가 검증.
        // 본 spec 의 controller 메서드 호출에서는 req.interaction 을 명시 주입한다.
        { provide: Reflector, useValue: new Reflector() },
        // Guard / Interceptor 의 DI dependency 도 NestJS 가 모듈 빌드 시점에 resolve 한다 —
        // 실 객체는 사용하지 않더라도 provider 등록은 필요.
        { provide: InteractionTokenService, useValue: {} },
        { provide: getRepositoryToken(Trigger), useValue: {} },
        { provide: getRepositoryToken(Execution), useValue: {} },
        InteractionGuard,
        IdempotencyInterceptor,
      ],
    }).compile();
    return moduleRef.get(InteractionController);
  }

  function mockRequest(): {
    interaction: InteractionRequestContext;
    headers: Record<string, string>;
    query: Record<string, string>;
  } {
    return {
      interaction: ctx,
      headers: { authorization: 'Bearer iext_xxx' },
      query: {},
    };
  }

  it('POST :id/interact — InteractionService.interact 위임 + 응답 그대로 반환', async () => {
    const interact = jest.fn().mockResolvedValue(ack);
    const controller = await makeController({ interact } as never);
    const res = await controller.interact(
      'exec-1',
      { command: 'cancel' },
      mockRequest() as never,
    );
    expect(interact).toHaveBeenCalledWith(ctx, { command: 'cancel' });
    expect(res).toBe(ack);
  });

  it('POST :id/interact — req.interaction 미설정 시 throw (Guard 미적용 가정)', async () => {
    const controller = await makeController({ interact: jest.fn() } as never);
    const req = { headers: {}, query: {} } as never;
    await expect(
      controller.interact('exec-1', { command: 'cancel' }, req),
    ).rejects.toThrow(/interaction context missing/);
  });

  it('POST :id/cancel — InteractionService.cancel 위임', async () => {
    const cancel = jest.fn().mockResolvedValue({
      ...ack,
      currentStatus: 'cancelled' as const,
    });
    const controller = await makeController({ cancel } as never);
    const res = await controller.cancel(
      'exec-1',
      { reason: 'user_aborted' },
      mockRequest() as never,
    );
    expect(cancel).toHaveBeenCalledWith(ctx);
    expect(res.currentStatus).toBe('cancelled');
  });

  it('POST :id/refresh-token — Authorization 헤더에서 bearer 추출 후 service 호출', async () => {
    const refreshToken = jest.fn().mockResolvedValue({
      token: 'iext_new',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    const controller = await makeController({ refreshToken } as never);
    const res = await controller.refreshToken('exec-1', mockRequest() as never);
    expect(refreshToken).toHaveBeenCalledWith(ctx, 'iext_xxx');
    expect(res.token).toBe('iext_new');
  });

  it('POST :id/refresh-token — Authorization 헤더 없으면 ?token query 사용', async () => {
    const refreshToken = jest.fn().mockResolvedValue({
      token: 'iext_new',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    const controller = await makeController({ refreshToken } as never);
    const req = {
      interaction: ctx,
      headers: {},
      query: { token: 'iext_from_query' },
    } as never;
    await controller.refreshToken('exec-1', req);
    expect(refreshToken).toHaveBeenCalledWith(ctx, 'iext_from_query');
  });

  it('GET :id — InteractionService.getStatus 위임', async () => {
    const getStatus = jest.fn().mockResolvedValue({
      id: 'exec-1',
      workflowId: 'wf-1',
      status: 'completed' as const,
      seq: 42,
      updatedAt: '2099-01-01T00:00:00Z',
    });
    const controller = await makeController({ getStatus } as never);
    const res = await controller.getStatus('exec-1', mockRequest() as never);
    expect(getStatus).toHaveBeenCalledWith(ctx);
    expect(res.status).toBe('completed');
  });

  describe('controller 메타데이터 — Guard / @Public / @ApiBearerAuth 바인딩', () => {
    it('class-level UseGuards 에 InteractionGuard 등록', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        InteractionController,
      ) as unknown[];
      expect(guards).toBeDefined();
      expect(guards.some((g) => g === InteractionGuard)).toBe(true);
    });

    it('interact / cancel method 에 @Public() 데코레이터 적용 (글로벌 JWT guard 우회)', () => {
      // public.decorator 가 isPublic = true 메타데이터를 method 레벨에 세팅.
      const interactIsPublic = Reflect.getMetadata(
        'isPublic',
        InteractionController.prototype.interact,
      ) as boolean | undefined;
      const cancelIsPublic = Reflect.getMetadata(
        'isPublic',
        InteractionController.prototype.cancel,
      ) as boolean | undefined;
      const refreshIsPublic = Reflect.getMetadata(
        'isPublic',
        InteractionController.prototype.refreshToken,
      ) as boolean | undefined;
      const getStatusIsPublic = Reflect.getMetadata(
        'isPublic',
        InteractionController.prototype.getStatus,
      ) as boolean | undefined;
      expect(interactIsPublic).toBe(true);
      expect(cancelIsPublic).toBe(true);
      expect(refreshIsPublic).toBe(true);
      expect(getStatusIsPublic).toBe(true);
    });

    it('interact / cancel method 에 IdempotencyInterceptor 적용', () => {
      const interactInterceptors = Reflect.getMetadata(
        '__interceptors__',
        InteractionController.prototype.interact,
      ) as unknown[] | undefined;
      const cancelInterceptors = Reflect.getMetadata(
        '__interceptors__',
        InteractionController.prototype.cancel,
      ) as unknown[] | undefined;
      expect(
        interactInterceptors?.some((i) => i === IdempotencyInterceptor),
      ).toBe(true);
      expect(
        cancelInterceptors?.some((i) => i === IdempotencyInterceptor),
      ).toBe(true);
    });

    it('refresh-token / status method 에 IdempotencyInterceptor 미적용 (멱등 불필요)', () => {
      const refreshInterceptors = Reflect.getMetadata(
        '__interceptors__',
        InteractionController.prototype.refreshToken,
      ) as unknown[] | undefined;
      const statusInterceptors = Reflect.getMetadata(
        '__interceptors__',
        InteractionController.prototype.getStatus,
      ) as unknown[] | undefined;
      expect(
        refreshInterceptors?.some((i) => i === IdempotencyInterceptor),
      ).toBeFalsy();
      expect(
        statusInterceptors?.some((i) => i === IdempotencyInterceptor),
      ).toBeFalsy();
    });
  });
});
