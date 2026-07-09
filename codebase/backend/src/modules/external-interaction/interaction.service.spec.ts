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
import {
  InvalidExecutionStateError,
  MessageTooLongError,
  FormValidationError,
} from '../execution-engine/workflow-errors';

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
  // getStatus 가 waiting_for_input 표면 복원 시 조회하는 NodeExecution repo.
  const nodeRepo: ExecRepoMocks = { findOne: jest.fn() };
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
    nodeRepo as never,
    engine as never,
    executions as never,
    token as never,
  );
  return { service, repo, nodeRepo, engine, executions, token };
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

  it('I-5 — submit_message: engine MessageTooLongError → 400 MESSAGE_TOO_LONG (내부 길이 수치 미노출)', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution());
    engine.continueAiConversation.mockRejectedValueOnce(
      new MessageTooLongError(10_000, 123_456),
    );
    // 400 BadRequestException + MESSAGE_TOO_LONG, 고정 client-safe message.
    // 누출 차단: 내부 길이 수치(10000/123456)는 응답 message 에 포함되지 않는다 (serverDetail 전용).
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_message',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'x',
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: 'Message exceeds the maximum allowed length.',
        },
      },
    });
  });

  it('submit_form: engine FormValidationError → 400 VALIDATION_ERROR + details[{field,message,code}]', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne.mockResolvedValueOnce(makeExecution());
    engine.continueExecution.mockRejectedValueOnce(
      new FormValidationError('email', '올바른 이메일 형식이 아닙니다.'),
    );
    await expect(
      service.interact(IEXT_CTX, {
        command: 'submit_form',
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        data: { email: 'bad' },
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
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
      },
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

  it('waiting_for_input — buttons 노드 표면을 SSE wire 형식 context 로 복원', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Carousel' },
      outputData: {
        meta: { interactionType: 'buttons' },
        config: { buttonConfig: { buttons: [{ id: 'b1', label: '문의' }] } },
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    expect(r.currentNode).toMatchObject({
      id: 'n1',
      type: 'Carousel',
      interactionType: 'buttons',
    });
    expect(r.context).toMatchObject({
      interactionType: 'buttons',
      waitingNodeId: 'n1',
      buttonConfig: { buttons: [{ id: 'b1', label: '문의' }] },
    });
  });

  it('waiting_for_input — 대기 NodeExecution 없으면 currentNode/context null', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue(null);
    const r = await service.getStatus(IEXT_CTX);
    expect(r.currentNode).toBeNull();
    expect(r.context).toBeNull();
  });

  // EIA §R17 재조정(2026-07-09): waiting_for_input 시 durable conversation_thread 를
  // context.conversationThread 로 동봉해 위젯 새로고침 히스토리 복원을 지원한다.
  const DURABLE_THREAD = {
    id: 'default',
    nextSeq: 2,
    turns: [
      {
        seq: 0,
        nodeId: 'n1',
        nodeType: 'ai_agent',
        source: 'ai_user',
        text: '안녕',
        timestamp: 't0',
      },
      {
        seq: 1,
        nodeId: 'n1',
        nodeType: 'ai_agent',
        source: 'ai_assistant',
        text: '반갑습니다',
        timestamp: 't1',
      },
    ],
    totalChars: 7,
  };

  it('waiting_for_input(ai_conversation) — durable conversationThread 를 context 에 동봉 (히스토리 복원)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.WAITING_FOR_INPUT,
        conversationThread: DURABLE_THREAD as never,
      }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'ai_agent' },
      outputData: {
        meta: { interactionType: 'ai_conversation' },
        conversationConfig: { placeholder: '메시지 입력' },
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    expect(r.context).toMatchObject({
      interactionType: 'ai_conversation',
      waitingNodeId: 'n1',
      conversationThread: DURABLE_THREAD,
    });
  });

  it('waiting_for_input(buttons) — durable conversationThread 도 동봉', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.WAITING_FOR_INPUT,
        conversationThread: DURABLE_THREAD as never,
      }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Carousel' },
      outputData: {
        meta: { interactionType: 'buttons' },
        config: { buttonConfig: { buttons: [{ id: 'b1', label: '문의' }] } },
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    expect(r.context).toMatchObject({
      interactionType: 'buttons',
      waitingNodeId: 'n1',
      conversationThread: DURABLE_THREAD,
    });
  });

  it('waiting_for_input — durable thread turn 텍스트의 secret 은 egress 시 마스킹 (EIA §R17)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    const threadWithSecret = {
      id: 'default',
      nextSeq: 1,
      turns: [
        {
          seq: 0,
          nodeId: 'n1',
          nodeType: 'ai_agent',
          source: 'ai_tool',
          text: 'API replied Authorization: Bearer sk-live-LEAKED-9988',
          timestamp: 't0',
        },
      ],
      totalChars: 52,
    };
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.WAITING_FOR_INPUT,
        conversationThread: threadWithSecret as never,
      }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'ai_agent' },
      outputData: { meta: { interactionType: 'ai_conversation' } },
    });
    const r = await service.getStatus(IEXT_CTX);
    const ctx = r.context as {
      conversationThread: { turns: { text: string }[] };
    };
    expect(ctx.conversationThread.turns[0].text).not.toContain(
      'sk-live-LEAKED-9988',
    );
    expect(ctx.conversationThread.turns[0].text).toContain('***');
  });

  it('종료(COMPLETED) execution 은 conversationThread 를 노출하지 않는다 (context null — 회귀 가드)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    // durable thread 가 있어도 waiting 이 아니면 context 자체가 null 이어야 한다.
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        conversationThread: DURABLE_THREAD as never,
        outputData: { final: 'value' },
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r.context).toBeNull();
    // waiting 이 아니므로 대기 NodeExecution 조회도 하지 않는다.
    expect(nodeRepo.findOne).not.toHaveBeenCalled();
  });

  it('waiting_for_input — conversation_thread 가 null(배포 이전 row)이면 conversationThread 키 미동봉', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.WAITING_FOR_INPUT,
        conversationThread: null as never,
      }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'ai_agent' },
      outputData: { meta: { interactionType: 'ai_conversation' } },
    });
    const r = await service.getStatus(IEXT_CTX);
    expect(r.context).toMatchObject({
      interactionType: 'ai_conversation',
      waitingNodeId: 'n1',
    });
    expect(r.context).not.toHaveProperty('conversationThread');
  });
});
