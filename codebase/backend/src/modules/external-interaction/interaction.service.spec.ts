import { InteractionService } from './interaction.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import { InteractDto } from './dto/interact.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import type { InteractionRequestContext } from './interaction.guard';
import { InvalidExecutionStateError } from '../execution-engine/workflow-errors';

type Mock = jest.Mock;

interface ExecutionEngineMocks {
  continueExecution: Mock;
  continueButtonClick: Mock;
  continueAiConversation: Mock;
  endAiConversation: Mock;
}

interface ExecutionsServiceMocks {
  stop: Mock;
}

interface TokenServiceMocks {
  refreshPerExecution: Mock;
}

interface ExecRepoMocks {
  findOne: Mock;
}

function makeMocks() {
  const repo: ExecRepoMocks = { findOne: jest.fn() };
  const engine: ExecutionEngineMocks = {
    continueExecution: jest.fn(),
    continueButtonClick: jest.fn(),
    continueAiConversation: jest.fn(),
    endAiConversation: jest.fn(),
  };
  const executions: ExecutionsServiceMocks = { stop: jest.fn() };
  const token: TokenServiceMocks = {
    refreshPerExecution: jest.fn(),
  };
  const service = new InteractionService(
    repo as never,
    engine as never,
    executions as never,
    token as never,
  );
  return { service, repo, engine, executions, token };
}

const IEXT_CTX: InteractionRequestContext = {
  executionId: 'exec-1',
  tokenFamily: 'iext',
};

const ITK_CTX: InteractionRequestContext = {
  executionId: 'exec-2',
  tokenFamily: 'itk',
  triggerId: 'trg-1',
};

function makeExecution(
  overrides: Partial<Execution> = {},
): Pick<
  Execution,
  'id' | 'status' | 'workflowId' | 'outputData' | 'startedAt' | 'finishedAt'
> {
  return {
    id: 'exec-1',
    status: ExecutionStatus.WAITING_FOR_INPUT,
    workflowId: 'wf-1',
    outputData: { foo: 'bar' },
    startedAt: new Date('2026-05-21T00:00:00Z'),
    finishedAt: null as never,
    ...overrides,
  } as never;
}

describe('InteractionService.interact', () => {
  it('submit_form — engine.continueExecution 호출 + 202 currentStatus', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution()) // loadAndAssertAlive
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.RUNNING }),
      ); // refreshed
    const dto: InteractDto = {
      command: 'submit_form',
      nodeId: '550e8400-e29b-41d4-a716-446655440000',
      data: { field1: 'a' },
    };
    const result = await service.interact(IEXT_CTX, dto);
    expect(engine.continueExecution).toHaveBeenCalledWith('exec-1', {
      field1: 'a',
    });
    expect(result).toEqual({
      executionId: 'exec-1',
      accepted: true,
      currentStatus: 'running',
    });
  });

  it('변경 2.3 — assertWaiting 통과 후 engine 이 InvalidExecutionStateError 면 STATE_MISMATCH(409) 로 매핑 (race window)', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution()); // loadAndAssertAlive — waiting
    engine.continueExecution.mockRejectedValueOnce(
      new InvalidExecutionStateError('no waiting NodeExecution'),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_form',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        data: { field1: 'a' },
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'STATE_MISMATCH' } },
    });
  });

  it('변경 2.3 — click_button: engine InvalidExecutionStateError → STATE_MISMATCH(409) (W-2)', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution());
    engine.continueButtonClick.mockRejectedValueOnce(
      new InvalidExecutionStateError('detail'),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'click_button',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        buttonId: 'btn-1',
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'STATE_MISMATCH' } },
    });
  });

  it('변경 2.3 — submit_message: engine InvalidExecutionStateError → STATE_MISMATCH(409) (W-2)', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution());
    engine.continueAiConversation.mockRejectedValueOnce(
      new InvalidExecutionStateError('detail'),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_message',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'hi',
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'STATE_MISMATCH' } },
    });
  });

  it('변경 2.3 — end_conversation: engine InvalidExecutionStateError → STATE_MISMATCH(409) (W-2)', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution());
    engine.endAiConversation.mockRejectedValueOnce(
      new InvalidExecutionStateError('detail'),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'end_conversation',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'STATE_MISMATCH' } },
    });
  });

  it('submit_form — data 없으면 INVALID_COMMAND', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValue(makeExecution());
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_form',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(engine.continueExecution).not.toHaveBeenCalled();
  });

  it('submit_form — nodeId 없으면 INVALID_COMMAND', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(makeExecution());
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_form',
        data: { x: 1 },
      } as InteractDto),
    ).rejects.toMatchObject({
      response: { error: { code: 'INVALID_COMMAND' } },
    });
  });

  it('submit_form — execution 이 waiting_for_input 아니면 STATE_MISMATCH', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.RUNNING }),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_form',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        data: { x: 1 },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(engine.continueExecution).not.toHaveBeenCalled();
  });

  it('click_button — engine.continueButtonClick 호출', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution())
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.RUNNING }),
      );
    await service.interact(IEXT_CTX, {
      command: 'click_button',
      nodeId: '550e8400-e29b-41d4-a716-446655440000',
      buttonId: 'btn-1',
    });
    expect(engine.continueButtonClick).toHaveBeenCalledWith('exec-1', 'btn-1');
  });

  it('click_button — buttonId 없으면 INVALID_COMMAND', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(makeExecution());
    await expect(
      service.interact(IEXT_CTX, {
        command: 'click_button',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'INVALID_COMMAND' } },
    });
  });

  it('submit_message — engine.continueAiConversation 호출', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution())
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
      );
    await service.interact(IEXT_CTX, {
      command: 'submit_message',
      nodeId: '550e8400-e29b-41d4-a716-446655440000',
      message: '안녕하세요',
    });
    expect(engine.continueAiConversation).toHaveBeenCalledWith(
      'exec-1',
      '안녕하세요',
    );
  });

  it('submit_message — message 없거나 빈 문자열이면 INVALID_COMMAND', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(makeExecution());
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_message',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        message: '',
      }),
    ).rejects.toMatchObject({
      response: { error: { code: 'INVALID_COMMAND' } },
    });
  });

  it('end_conversation — engine.endAiConversation 호출', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution())
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.COMPLETED }),
      );
    await service.interact(IEXT_CTX, {
      command: 'end_conversation',
      nodeId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(engine.endAiConversation).toHaveBeenCalledWith('exec-1');
  });

  it('cancel — executionsService.stop 호출 + waiting 아니어도 허용', async () => {
    const { service, repo, executions } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution({ status: ExecutionStatus.RUNNING }))
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.CANCELLED }),
      );
    executions.stop.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.CANCELLED }),
    );
    const result = await service.interact(IEXT_CTX, { command: 'cancel' });
    expect(executions.stop).toHaveBeenCalledWith('exec-1');
    expect(result).toEqual({
      executionId: 'exec-1',
      accepted: true,
      currentStatus: 'cancelled',
    });
  });

  it('terminal execution 에는 410 Gone', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.COMPLETED }),
    );
    await expect(
      service.interact(IEXT_CTX, { command: 'cancel' }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(engine.continueExecution).not.toHaveBeenCalled();
  });

  it('execution 없으면 404', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(null);
    await expect(
      service.interact(IEXT_CTX, { command: 'cancel' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('InteractionService.cancel (alias endpoint)', () => {
  it('정상 — stop 호출 + currentStatus="cancelled" 즉시 반환', async () => {
    const { service, repo, executions } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.RUNNING }),
    );
    executions.stop.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.CANCELLED }),
    );
    const r = await service.cancel(IEXT_CTX);
    expect(executions.stop).toHaveBeenCalledWith('exec-1');
    expect(r.currentStatus).toBe('cancelled');
  });
});

describe('InteractionService.refreshToken', () => {
  it('iext family — token.refreshPerExecution 성공 + execution alive → 새 토큰 반환', async () => {
    const { service, repo, token } = makeMocks();
    token.refreshPerExecution.mockResolvedValue({
      token: 'iext_new',
      expiresAt: '2026-05-22T00:00:00Z',
      jti: 'new-jti',
    });
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    const r = await service.refreshToken(IEXT_CTX, 'iext_old');
    expect(r).toEqual({ token: 'iext_new', expiresAt: '2026-05-22T00:00:00Z' });
  });

  it('iext family — not_in_window → 400', async () => {
    const { service, token } = makeMocks();
    token.refreshPerExecution.mockResolvedValue({
      valid: false,
      reason: 'not_in_window',
    });
    await expect(
      service.refreshToken(IEXT_CTX, 'iext_old'),
    ).rejects.toMatchObject({
      response: { error: { code: 'TOKEN_REFRESH_NOT_IN_WINDOW' } },
    });
  });

  it('iext family — execution 이 이미 terminated → 410', async () => {
    const { service, repo, token } = makeMocks();
    token.refreshPerExecution.mockResolvedValue({
      token: 'iext_new',
      expiresAt: '2026-05-22T00:00:00Z',
      jti: 'new-jti',
    });
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.CANCELLED }),
    );
    await expect(
      service.refreshToken(IEXT_CTX, 'iext_old'),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('itk family — refresh 거부 (TOKEN_REFRESH_FORBIDDEN)', async () => {
    const { service } = makeMocks();
    await expect(
      service.refreshToken(ITK_CTX, 'itk_xxx'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('InteractionService.getStatus', () => {
  it('execution 존재 시 핵심 필드만 반환 (V1 단발 응답 형식)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        outputData: { final: 'value' },
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r).toMatchObject({
      id: 'exec-1',
      workflowId: 'wf-1',
      status: 'completed',
      result: { final: 'value' },
      error: null,
      seq: 0,
    });
    expect(typeof r.updatedAt).toBe('string');
  });

  it('failed status 면 outputData 가 error 필드로', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.FAILED,
        outputData: { code: 'NODE_FAILED', message: 'x' },
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r.result).toBeNull();
    expect(r.error).toMatchObject({ code: 'NODE_FAILED' });
  });

  it('execution 없으면 404', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(null);
    await expect(service.getStatus(IEXT_CTX)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
