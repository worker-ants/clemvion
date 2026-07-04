import {
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { ExecutionsController } from './executions.controller';
import {
  InvalidExecutionStateError,
  FormValidationError,
} from '../execution-engine/workflow-errors';

describe('ExecutionsController', () => {
  let controller: ExecutionsController;
  let mockExecutionsService: Record<string, jest.Mock>;
  let mockExecutionEngineService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockExecutionsService = {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'exec-1', status: 'running' }),
      findByWorkflow: jest.fn().mockResolvedValue({ data: [], totalItems: 0 }),
      stop: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'stopped' }),
      // CRIT #1 — IDOR 차단을 위해 controller 가 verifyOwnership 호출.
      verifyOwnership: jest.fn().mockResolvedValue(undefined),
      reRun: jest.fn().mockResolvedValue({ id: 'new-exec', reRunOf: 'exec-1' }),
      getChain: jest.fn().mockResolvedValue([{ id: 'exec-1' }]),
    };

    mockExecutionEngineService = {
      continueExecution: jest.fn(),
      runStuckRecoveryScan: jest.fn().mockResolvedValue(undefined),
      runExecutionFromQueue: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ExecutionsController(
      mockExecutionsService as never,
      mockExecutionEngineService as never,
    );
  });

  describe('continueExecution', () => {
    it('should verify ownership and call executionEngineService', async () => {
      const result = await controller.continueExecution(
        'exec-1',
        'workspace-1',
        { formData: { field: 'value' } },
      );

      expect(mockExecutionsService.verifyOwnership).toHaveBeenCalledWith(
        'exec-1',
        'workspace-1',
      );
      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        { field: 'value' },
      );
      expect(result).toEqual({ success: true });
    });

    it('should reject when ownership verification fails (IDOR guard)', async () => {
      mockExecutionsService.verifyOwnership.mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      await expect(
        controller.continueExecution('exec-victim', 'workspace-attacker'),
      ).rejects.toThrow('Execution not found');
      expect(
        mockExecutionEngineService.continueExecution,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from executionEngineService', async () => {
      mockExecutionEngineService.continueExecution.mockImplementation(() => {
        throw new Error('Execution not found');
      });

      await expect(
        controller.continueExecution('exec-1', 'workspace-1'),
      ).rejects.toThrow('Execution not found');
    });

    it('변경 2.3 — InvalidExecutionStateError 면 422 INVALID_STATE 로 변환 (spec §7.5.1)', async () => {
      mockExecutionEngineService.continueExecution.mockRejectedValueOnce(
        new InvalidExecutionStateError('not waiting'),
      );

      await expect(
        controller.continueExecution('exec-1', 'workspace-1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      mockExecutionEngineService.continueExecution.mockRejectedValueOnce(
        new InvalidExecutionStateError('detail kept server-side'),
      );
      const rejection = controller
        .continueExecution('exec-1', 'workspace-1')
        .catch((err_: unknown) => err_);
      const err = (await rejection) as UnprocessableEntityException;
      // review W-5 — client 응답 메시지는 고정 문자열(내부 detail 미노출).
      expect(err.getResponse()).toEqual({
        error: {
          code: 'INVALID_STATE',
          message: 'Execution is not waiting for input.',
        },
      });
    });

    it('should handle missing body', async () => {
      const result = await controller.continueExecution(
        'exec-1',
        'workspace-1',
      );

      expect(mockExecutionEngineService.continueExecution).toHaveBeenCalledWith(
        'exec-1',
        undefined,
      );
      expect(result).toEqual({ success: true });
    });

    it('W-2 — FormValidationError → 400 BadRequestException + VALIDATION_ERROR + details[] (spec form §4·§6.2)', async () => {
      // publisher 측 field 검증 실패 → 400, execution 은 waiting 유지(재제출 가능).
      mockExecutionEngineService.continueExecution.mockRejectedValueOnce(
        new FormValidationError('email', '올바른 이메일 형식이 아닙니다.'),
      );

      await expect(
        controller.continueExecution('exec-1', 'workspace-1', {
          formData: { email: 'not-an-email' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      mockExecutionEngineService.continueExecution.mockRejectedValueOnce(
        new FormValidationError('email', '올바른 이메일 형식이 아닙니다.'),
      );
      const err = await controller
        .continueExecution('exec-1', 'workspace-1', {
          formData: { email: 'not-an-email' },
        })
        .catch((err_: unknown) => err_);

      expect((err as BadRequestException).getResponse()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: '올바른 이메일 형식이 아닙니다.',
          details: [
            {
              field: 'email',
              message: '올바른 이메일 형식이 아닙니다.',
              code: 'INVALID_FIELD',
            },
          ],
        },
      });
    });
  });

  // PR3 (§7.5 case B) — e2e 전용 recover-stuck backdoor 의 프로덕션 차단 계약.
  // 핵심 안전장치(NODE_ENV==='test' && E2E_TEST_HOOKS==='1' 아니면 404)는 e2e 가
  // 항상 test 모드라 "정상 경로"만 타므로, 게이트 실패 시 404 는 unit 으로 가드한다.
  describe('triggerStuckRecoveryForTest (test-only gating)', () => {
    const orig = {
      NODE_ENV: process.env.NODE_ENV,
      E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS,
    };
    afterEach(() => {
      process.env.NODE_ENV = orig.NODE_ENV;
      process.env.E2E_TEST_HOOKS = orig.E2E_TEST_HOOKS;
    });

    it('NODE_ENV=test + E2E_TEST_HOOKS=1 이면 recovery 스캔을 트리거한다', async () => {
      process.env.NODE_ENV = 'test';
      process.env.E2E_TEST_HOOKS = '1';
      const res = await controller.triggerStuckRecoveryForTest();
      expect(
        mockExecutionEngineService.runStuckRecoveryScan,
      ).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ success: true });
    });

    it('NODE_ENV 이 test 가 아니면 404 (프로덕션 은닉)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.E2E_TEST_HOOKS = '1';
      await expect(
        controller.triggerStuckRecoveryForTest(),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        mockExecutionEngineService.runStuckRecoveryScan,
      ).not.toHaveBeenCalled();
    });

    it('E2E_TEST_HOOKS 플래그가 없으면 404 (단일 env 오설정 방어)', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.E2E_TEST_HOOKS;
      await expect(
        controller.triggerStuckRecoveryForTest(),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        mockExecutionEngineService.runStuckRecoveryScan,
      ).not.toHaveBeenCalled();
    });
  });

  // PR4 (§7.1/§7.5 case B) — e2e 전용 simulate-execution-run-redelivery backdoor.
  // 게이팅(NODE_ENV/E2E_TEST_HOOKS) + `:id` 라우트 소유권 검증(cross-workspace IDOR
  // 차단)을 unit 으로 가드한다 (e2e 는 정상 경로만 타므로).
  describe('simulateExecutionRunRedeliveryForTest (test-only gating + ownership)', () => {
    const WS = 'ws-1';
    const EXEC = 'exec-1';
    const orig = {
      NODE_ENV: process.env.NODE_ENV,
      E2E_TEST_HOOKS: process.env.E2E_TEST_HOOKS,
    };
    afterEach(() => {
      process.env.NODE_ENV = orig.NODE_ENV;
      process.env.E2E_TEST_HOOKS = orig.E2E_TEST_HOOKS;
    });

    it('NODE_ENV=test + E2E_TEST_HOOKS=1 이면 소유권 검증 후 재배달을 시뮬한다', async () => {
      process.env.NODE_ENV = 'test';
      process.env.E2E_TEST_HOOKS = '1';
      const res = await controller.simulateExecutionRunRedeliveryForTest(
        EXEC,
        WS,
      );
      expect(mockExecutionsService.verifyOwnership).toHaveBeenCalledWith(
        EXEC,
        WS,
      );
      expect(
        mockExecutionEngineService.runExecutionFromQueue,
      ).toHaveBeenCalledWith(EXEC, {});
      expect(res).toEqual({ success: true });
    });

    it('소유권 검증 실패(cross-workspace)면 재배달을 트리거하지 않고 전파한다', async () => {
      process.env.NODE_ENV = 'test';
      process.env.E2E_TEST_HOOKS = '1';
      mockExecutionsService.verifyOwnership.mockRejectedValueOnce(
        new NotFoundException(),
      );
      await expect(
        controller.simulateExecutionRunRedeliveryForTest(EXEC, WS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        mockExecutionEngineService.runExecutionFromQueue,
      ).not.toHaveBeenCalled();
    });

    it('NODE_ENV 이 test 가 아니면 404 (소유권 검증 이전에 은닉)', async () => {
      process.env.NODE_ENV = 'production';
      process.env.E2E_TEST_HOOKS = '1';
      await expect(
        controller.simulateExecutionRunRedeliveryForTest(EXEC, WS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockExecutionsService.verifyOwnership).not.toHaveBeenCalled();
      expect(
        mockExecutionEngineService.runExecutionFromQueue,
      ).not.toHaveBeenCalled();
    });

    it('E2E_TEST_HOOKS 플래그가 없으면 404 (단일 env 오설정 방어)', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.E2E_TEST_HOOKS;
      await expect(
        controller.simulateExecutionRunRedeliveryForTest(EXEC, WS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        mockExecutionEngineService.runExecutionFromQueue,
      ).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should verify ownership and call stop', async () => {
      const result = await controller.stop('exec-1', 'workspace-1');

      expect(mockExecutionsService.verifyOwnership).toHaveBeenCalledWith(
        'exec-1',
        'workspace-1',
      );
      expect(mockExecutionsService.stop).toHaveBeenCalledWith('exec-1');
      expect(result).toEqual({ id: 'exec-1', status: 'stopped' });
    });

    it('should reject when ownership verification fails', async () => {
      mockExecutionsService.verifyOwnership.mockRejectedValueOnce(
        new Error('Execution not found'),
      );

      await expect(
        controller.stop('exec-victim', 'workspace-attacker'),
      ).rejects.toThrow('Execution not found');
      expect(mockExecutionsService.stop).not.toHaveBeenCalled();
    });
  });

  describe('reRun (decision F2)', () => {
    const user = {
      sub: 'user-1',
      email: 'u@e.com',
      workspaceId: 'ws-1',
      role: 'editor',
    };

    it('forwards id / workspaceId / user / dto to the service', async () => {
      const dto = { useOriginalInput: true };
      const result = await controller.reRun(
        'exec-1',
        'ws-1',
        user as never,
        dto,
      );
      expect(mockExecutionsService.reRun).toHaveBeenCalledWith(
        'exec-1',
        'ws-1',
        user,
        dto,
      );
      expect(result).toEqual({ id: 'new-exec', reRunOf: 'exec-1' });
    });
  });

  describe('getChain (decision F2)', () => {
    const user = {
      sub: 'user-1',
      email: 'u@e.com',
      workspaceId: 'ws-1',
      role: 'editor',
    };

    it('forwards id / workspaceId / user to the service', async () => {
      const result = await controller.getChain('exec-1', 'ws-1', user as never);
      expect(mockExecutionsService.getChain).toHaveBeenCalledWith(
        'exec-1',
        'ws-1',
        user,
      );
      expect(result).toEqual([{ id: 'exec-1' }]);
    });
  });
});
