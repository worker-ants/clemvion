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
  | 'id'
  | 'status'
  | 'workflowId'
  | 'outputData'
  | 'startedAt'
  | 'finishedAt'
  | 'durationMs'
> {
  return {
    id: 'exec-1',
    status: ExecutionStatus.WAITING_FOR_INPUT,
    workflowId: 'wf-1',
    outputData: { foo: 'bar' },
    startedAt: new Date('2026-05-21T00:00:00Z'),
    // 엔티티는 `finishedAt: Date` / `durationMs: number` 로 선언하지만 두 컬럼 모두
    // `nullable: true` 다 — 타입이 DB 를 정확히 말하지 않는다. 기존 `finishedAt` 관용구를
    // 그대로 따른다. 엔티티 정정은 이 PR 범위 밖이고
    // `plan/in-progress/eia-db-wire-invariant.md` §범위 밖 에 등재돼 있다.
    finishedAt: null as never,
    durationMs: null as never,
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
    expect(engine.continueExecution).toHaveBeenCalledWith(
      'exec-1',
      { field1: 'a' },
      // F-1 — 외부 scope 는 dto.nodeId 를 expectedNodeId 로 전달 (publisher 가 대기 노드와 대조).
      '550e8400-e29b-41d4-a716-446655440000',
    );
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

  // F-1 (plan eia-command-waiting-surface-guard) — in_process_trusted(chat-channel)는 scope 단위로
  // nodeId 요구·일치 검사에서 면제된다 (§7.5.1 exemption, nodeId 가용 여부 무관). 외부 scope 는
  // dto.nodeId 를 expectedNodeId 로 전달해 publisher 가 실제 대기 노드와 대조한다.
  it('F-1 — in_process_trusted 는 nodeId 없어도 수용 + expectedNodeId=undefined 로 전달', async () => {
    const { service, repo, engine } = makeMocks();
    repo.findOne
      .mockResolvedValueOnce(makeExecution())
      .mockResolvedValueOnce(
        makeExecution({ status: ExecutionStatus.RUNNING }),
      );
    const INTERNAL_CTX: InteractionRequestContext = {
      executionId: 'exec-1',
      triggerId: 'trg-1',
      scope: 'in_process_trusted',
    };
    await service.interact(INTERNAL_CTX, {
      command: 'submit_message',
      message: '안녕하세요',
    } as InteractDto);
    // nodeId 없이도 INVALID_COMMAND 던지지 않고, publisher 에는 expectedNodeId=undefined.
    expect(engine.continueAiConversation).toHaveBeenCalledWith(
      'exec-1',
      '안녕하세요',
      undefined,
    );
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
    expect(engine.continueButtonClick).toHaveBeenCalledWith(
      'exec-1',
      'btn-1',
      '550e8400-e29b-41d4-a716-446655440000',
    );
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
      '550e8400-e29b-41d4-a716-446655440000',
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
    expect(engine.endAiConversation).toHaveBeenCalledWith(
      'exec-1',
      '550e8400-e29b-41d4-a716-446655440000',
    );
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

  // push 계열(webhook/SSE/WS)은 종결 시 `durationMs` 를 싣는데 REST 재조회에는 필드
  // 자체가 없었다 — **이벤트 유실 후 재조회로 복구하는** 클라이언트 패턴에서 값이
  // 사라진다. 계산하지 않고 **영속 컬럼을 그대로** 싣는다(DB = wire).
  it('종결 실행은 영속된 durationMs 를 그대로 싣는다 (재계산하지 않는다)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        outputData: { final: 'value' },
        // 타임스탬프로 재계산하면 다른 값이 나오는 fixture — 둘을 가른다.
        startedAt: new Date('2026-08-15T00:00:00.000Z'),
        finishedAt: new Date('2026-08-15T00:10:00.000Z'),
        durationMs: 4242,
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r.durationMs).toBe(4242);
  });

  it('durationMs 0 을 null 로 뭉개지 않는다 (`??` 를 `||` 로 바꾸면 사라진다)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.COMPLETED, durationMs: 0 }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r.durationMs).toBe(0);
  });

  it('아직 종결되지 않은 실행은 durationMs 가 null (키는 존재)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.RUNNING }),
    );
    const r = await service.getStatus(IEXT_CTX);
    expect(r).toHaveProperty('durationMs');
    expect(r.durationMs).toBeNull();
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

  // buttons 분기는 `{ buttons, nodeOutput }` 로 다시 감싼다 — 지금은 form 과 같은 `out`
  // 참조를 재사용해 사실상 안전하지만, 분기가 독립적으로 재가공되면 회귀를 못 잡는다
  // (`19_00_23` testing INFO 4).
  it('[캐너리] buttons 분기의 `buttonConfig.nodeOutput` 도 allowlist 를 지난다', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Carousel' },
      outputData: {
        meta: { interactionType: 'buttons' },
        buttonConfig: { buttons: [{ id: 'b1', label: '문의' }] },
        _retryState: { attempt: 1 },
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    const bc = (r.context as unknown as Record<string, unknown>)
      .buttonConfig as Record<string, unknown>;
    const nested = bc.nodeOutput as Record<string, unknown>;
    expect(nested._retryState).toBeUndefined();
    // 대조군 — 버튼 자체는 살아 있어야 한다.
    expect(bc.buttons).toEqual([{ id: 'b1', label: '문의' }]);
  });

  // 설계 경계를 **의도 명시**로 못박는다 — 지금은 무관 테스트의 부수 효과로만 덮인다
  // (`19_00_23` testing INFO 5). terminal `result` 는 `Execution.outputData` = 작성자가
  // 정의한 워크플로 출력이라 allowlist 를 걸면 정상 데이터가 잘린다.
  it('[캐너리] terminal `result` 는 nodeOutput allowlist 를 받지 **않는다** (의도)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        outputData: { 작성자가정한임의키: 'keep', total: 42 },
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    const result = r.result as Record<string, unknown>;
    // allowlist 였다면 둘 다 사라졌을 것이다.
    expect(result.작성자가정한임의키).toBe('keep');
    expect(result.total).toBe(42);
  });

  // `error` 출구는 `result` 와 코드가 완전 대칭인데 캐너리는 한쪽에만 있었다
  // (`19_24_24` testing INFO 3). 두 출구를 통합 리팩터링할 때 한쪽만 바뀌는 걸 막는다.
  it('[캐너리] terminal `error` 도 nodeOutput allowlist 를 받지 **않는다** (의도)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.FAILED,
        // 두 terminal 출구는 **둘 다 `execution.outputData`** 를 읽는다(`error` 컬럼 아님).
        outputData: { 임의진단키: 'keep', code: 'BOOM' },
      }),
    );
    const r = await service.getStatus(IEXT_CTX);
    const err = r.error as unknown as Record<string, unknown>;
    expect(err.임의진단키).toBe('keep');
    expect(err.code).toBe('BOOM');
  });

  // 배선 캐너리 — 헬퍼 자체는 `strip-external-only-fields.spec.ts` 가 고정한다. 여기서는
  // **`getStatus` 가 실제로 그 헬퍼를 지나는지**만 본다. 이 시리즈가 반복해 겪은 형태:
  // 헬퍼는 초록인데 호출부에 안 걸려 있었다.
  it('[캐너리] waiting nodeOutput 이 엔진 내부 `_retryState` 를 싣지 않는다 (EIA §R17)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Form' },
      // `_retryState` 는 실제로 이 컬럼에 저장된다(`retry-turn.service.ts`).
      // deny-list(`llmCalls` 한 칸)만 있던 시절엔 그대로 외부로 나갔다.
      outputData: {
        config: { fields: [] },
        output: {},
        meta: { interactionType: 'form' },
        _retryState: { attempt: 2 },
        __unknownFutureKey: 'leak',
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    const out = (r.context as unknown as Record<string, unknown>)
      .nodeOutput as Record<string, unknown>;
    expect(out._retryState).toBeUndefined();
    expect(out.__unknownFutureKey).toBeUndefined();
    // 폼 폴백이 쓰는 셋은 살아 있어야 한다 — 위젯이 nodeOutput 자체를 폼 선언으로 쓴다.
    expect(Object.keys(out).sort()).toEqual(['config', 'meta', 'output']);
  });

  // interactionType 이 sound discriminator 가 아님을 고정하는 가드 — buttons 인데
  // buttonConfig 복원에 실패하면 nodeOutput 변형으로 fallthrough 한다. 이 케이스가
  // 있기 때문에 OpenAPI 스키마에 discriminator 를 선언할 수 없다 (Swagger 규약 §1-4).
  it('waiting_for_input — buttons 인데 buttonConfig 부재면 nodeOutput 변형으로 fallthrough', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Carousel' },
      // meta.interactionType 은 buttons 인데 config.buttonConfig / buttonConfig 둘 다 없음.
      outputData: { meta: { interactionType: 'buttons' } },
    });
    const r = await service.getStatus(IEXT_CTX);
    const ctx = r.context as Record<string, unknown>;
    expect(ctx.interactionType).toBe('buttons');
    // 판별은 interactionType 이 아니라 키 존재로 한다.
    expect('nodeOutput' in ctx).toBe(true);
    expect('buttonConfig' in ctx).toBe(false);
  });

  // API 규약 §5.4 — conversationThread 는 present-when-available(키 생략), 형제는 null.
  // ai_conversation + thread 부재는 아래 별 테스트가 이미 커버하므로, 여기서는 미커버 조합인
  // buttons variant + thread 부재를 검증한다 (버튼 노드도 durable thread 없이 대기할 수 있다).
  it('waiting_for_input(buttons) — durable thread 부재 시 conversationThread 키 자체를 생략 (null 아님)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.WAITING_FOR_INPUT,
        conversationThread: null as never,
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
    const ctx = r.context as Record<string, unknown>;
    expect('buttonConfig' in ctx).toBe(true);
    expect(Object.keys(ctx)).not.toContain('conversationThread');
    expect(ctx.conversationThread).toBeUndefined();
  });

  /**
   * **REST 스냅샷도 fanout 과 같은 수준으로 `llmCalls` 를 막아야 한다.**
   *
   * `stripExternalOnlyFields`(`shared/utils/strip-external-only-fields.ts`)는
   * SSE·webhook·chat-channel fanout 에서 `llmCalls` 를 깊이 무관으로 지운다. 그런데
   * `getStatus` 는 **같은 `iext_*`/`itk_*` 토큰으로 접근하는 같은 데이터**를
   * `deepRedactSecrets` 만 거쳐 **돌려주고 있었다** — 그건 **값 마스킹**이지 필드 제거가
   * 아니라 `nodeOutput.meta.turnDebug[].llmCalls[]` 의 raw `requestPayload`
   * (시스템 프롬프트·대화 이력)가 그대로 나갔다 (`12_06_21` cross_spec CRITICAL 1).
   *
   * fanout 쪽만 고치고 이 표면을 안 물은 것이 이 PR 의 처음 실수였다 — **같은 데이터의
   * 다른 출구**를 세지 않았다.
   */
  it('waiting_for_input — nodeOutput 의 raw llmCalls 가 REST 응답에 실리지 않는다', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'AI Agent' },
      outputData: {
        meta: {
          interactionType: 'ai_conversation',
          // WS §4.4:449 정본 shape — 영속된 outputData.meta 도 같은 구조다.
          turnDebug: [
            {
              turnIndex: 0,
              llmCalls: [
                { requestPayload: { system: 'SECRET PROMPT VIA REST' } },
              ],
            },
          ],
        },
        conversationConfig: { greeting: '안녕하세요' },
      },
    });

    const r = await service.getStatus(IEXT_CTX);

    expect(JSON.stringify(r)).not.toContain('SECRET PROMPT VIA REST');
    // 대조군 — 정상 필드는 그대로 나가야 한다(통째로 날려서 통과하는 것 방지).
    expect(JSON.stringify(r)).toContain('안녕하세요');
  });

  /**
   * **terminal 분기도 waiting 분기와 대칭이어야 한다** (`14_30_36` CRITICAL 1).
   *
   * 같은 함수 안에서 `nodeOutput`(waiting)만 strip 을 받고 `result`/`error`(terminal)는
   * `deepRedactSecrets` 단독이었다. 체커는 "`Execution.outputData` 구조상 `.meta` 를
   * 못 가져서 우연히 안전" 이라 했는데 그건 **문서화되지 않은 전제**다 — 전제가 참이든
   * 아니든 방어를 비대칭으로 두면 다음 사람이 그 구조를 바꾸는 순간 조용히 열린다.
   *
   * AI Agent 가 마지막 노드인 워크플로가 종료되면 이 경로로 나간다.
   */
  it.each([
    ['completed', ExecutionStatus.COMPLETED, 'result'],
    ['failed', ExecutionStatus.FAILED, 'error'],
  ])(
    '%s — terminal outputData 의 raw llmCalls 도 REST 응답에 실리지 않는다',
    async (_label, status, field) => {
      const { service, repo } = makeMocks();
      repo.findOne.mockResolvedValue(
        makeExecution({
          status,
          outputData: {
            answer: '최종 답변',
            meta: {
              turnDebug: [
                {
                  turnIndex: 0,
                  llmCalls: [
                    { requestPayload: { system: 'SECRET PROMPT TERMINAL' } },
                  ],
                },
              ],
            },
          },
        }),
      );

      const r = await service.getStatus(IEXT_CTX);

      expect(JSON.stringify(r)).not.toContain('SECRET PROMPT TERMINAL');
      // 대조군 — 정상 결과는 그대로 나가야 한다.
      expect(JSON.stringify(r[field as 'result' | 'error'])).toContain(
        '최종 답변',
      );
    },
  );

  /**
   * `stripAndRedact` 의 **null 분기** 회귀 고정 (`15_58_26` testing W3).
   *
   * null 가드는 원래 호출부 3곳에 각각 있었는데 헬퍼 1곳으로 접었다. 두 컬럼 모두
   * `nullable: true` 라 런타임에 실제로 null 이 온다. 동작 보존은 코드 추적으로만
   * 확인됐고 이 경로를 태우는 테스트가 없었다 — 헬퍼가 `null` 대신 `{}` 를 돌려주면
   * waiting 은 `?? {}` 가 삼켜 무증상이지만 terminal 은 `result: {}` 로 새어
   * "결과 없음" 과 "빈 결과" 가 구분되지 않는다.
   */
  // 튜플 순서가 `[label, field, status]` 인 것은 의도다 — jest 의 it.each 타이틀은
  // 남는 인자를 버리므로(`util.format` 과 다르다) `%s` 두 개는 **앞의 두 원소**를 받는다.
  // 타이틀에 띄우고 싶은 것이 label 과 field 라 그 둘을 앞에 둔다.
  it.each([
    ['completed', 'result', ExecutionStatus.COMPLETED],
    ['failed', 'error', ExecutionStatus.FAILED],
  ])(
    '%s — outputData 가 null 이면 %s 는 {} 가 아니라 null',
    async (_label, field, status) => {
      const { service, repo } = makeMocks();
      repo.findOne.mockResolvedValue(
        makeExecution({ status, outputData: null as never }),
      );

      const r = await service.getStatus(IEXT_CTX);

      expect(r[field as 'result' | 'error']).toBeNull();
    },
  );

  it('waiting_for_input — nodeOutput 이 null 이어도 context 조립이 깨지지 않는다', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'Carousel' },
      outputData: null,
    });

    const r = await service.getStatus(IEXT_CTX);

    // `?? {}` 가 받아 준다 — 대기 노드 자체는 존재하므로 currentNode 는 살아 있다.
    // `interactionType` 은 out.meta 가 비어 null 로 떨어지고, 그 때문에 `context` 는
    // 조립되지 않는다(아래 단언이 그 결과를 고정한다) — 크래시 없이 graceful.
    expect(r.currentNode).toEqual({
      id: 'n1',
      type: 'Carousel',
      interactionType: null,
    });
    expect(r.context).toBeNull();
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
  //
  // 주의 — 아래 waiting 테스트들은 `mockResolvedValue` 로 **모든** findOne 호출에 같은 객체를
  // 돌려주므로 getStatus 의 1단계/2단계를 구분하지 못한다(구현이 2단계 분리를 되돌려도 green).
  // 여기서 검증하는 건 wire 형식뿐이고, 2단계 조회 자체와 thread 의 마스킹 배선은 아래
  // `describe('... 컬럼 projection (2단계 조회)')` 가 select 분기 mock 으로 가드한다.
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

  it('waiting_for_input — nodeOutput.conversationConfig 의 secret 도 마스킹 (bypass 차단, EIA §R17)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'ai_agent' },
      outputData: {
        meta: { interactionType: 'ai_conversation' },
        conversationConfig: {
          placeholder: '메시지 입력',
          message: 'reply Authorization: Bearer sk-NODEOUT-LEAK',
          headers: { api_key: 'AKIA-NODEOUT-2' },
        },
      },
    });
    const r = await service.getStatus(IEXT_CTX);
    const nodeOutput = (r.context as { nodeOutput: Record<string, unknown> })
      .nodeOutput;
    const blob = JSON.stringify(nodeOutput);
    expect(blob).not.toContain('sk-NODEOUT-LEAK');
    expect(blob).not.toContain('AKIA-NODEOUT-2');
    expect(blob).toContain('***');
    // 비-secret 필드는 보존.
    expect(blob).toContain('메시지 입력');
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

  it('COMPLETED result / FAILED error 의 outputData secret 도 마스킹 (EIA §R17)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValueOnce(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        outputData: {
          summary: 'ok',
          headers: { authorization: 'Bearer sk-RESULT-LEAK' },
        } as never,
      }),
    );
    const completed = await service.getStatus(IEXT_CTX);
    const rblob = JSON.stringify(completed.result);
    expect(rblob).not.toContain('sk-RESULT-LEAK');
    expect(rblob).toContain('***');
    expect(rblob).toContain('ok'); // 정상 결과 데이터 보존

    repo.findOne.mockResolvedValueOnce(
      makeExecution({
        status: ExecutionStatus.FAILED,
        outputData: { message: 'boom', api_key: 'AKIA-ERR-LEAK' } as never,
      }),
    );
    const failed = await service.getStatus(IEXT_CTX);
    const eblob = JSON.stringify(failed.error);
    expect(eblob).not.toContain('AKIA-ERR-LEAK');
    expect(eblob).toContain('***');
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

// getStatus 는 2단계 조회다: (1) 얇은 status projection, (2) `waiting_for_input` 일 때만
// `conversation_thread` 재조회. 응답 동봉은 waiting 한정인데 종전엔 DB fetch 가 상태 무관이라
// 상한 500 turn × 4000자(≒2MB) jsonb 를 폴링마다 실어 왔다.
describe('InteractionService.getStatus — 컬럼 projection (2단계 조회)', () => {
  /** 두 단계는 `select` 배열로 구분된다. */
  function selectOf(call: unknown): string[] {
    return ((call as { select?: string[] }).select ?? []).slice();
  }

  /** 구현의 리터럴을 import 하지 않고 독립 재기술한다 (black-box: 구현이 바뀌면 여기가 fail). */
  const BASE_COLUMNS = [
    'id',
    'status',
    'workflowId',
    'startedAt',
    'finishedAt',
    // 응답의 `durationMs` 는 **이 컬럼을 그대로** 싣는다(재계산 아님) — 빠지면
    // 종결 실행의 값이 조용히 `null` 이 된다.
    'durationMs',
    'outputData',
  ];

  function whereOf(call: unknown): unknown {
    return (call as { where?: unknown }).where;
  }

  const THREAD = {
    id: 'default',
    nextSeq: 1,
    turns: [
      {
        seq: 0,
        nodeId: 'n1',
        nodeType: 'ai_agent',
        source: 'ai_user',
        text: '안녕',
        timestamp: 't0',
      },
    ],
    totalChars: 2,
  };

  it('1단계는 응답 조립에 쓰이는 컬럼만 select — 초과·누락 모두 불가', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.RUNNING }),
    );
    await service.getStatus(IEXT_CTX);
    const select = selectOf(repo.findOne.mock.calls[0][0]);
    // 누락되면 응답 필드가 조용히 비거나 fallback 으로 대체된다 (특히 startedAt/finishedAt → updatedAt).
    // 초과되면 이 PR 의 목적(필요한 컬럼만)이 무너지므로 정확 집합 비교한다.
    expect(select.slice().sort()).toEqual(BASE_COLUMNS.slice().sort());
    expect(select).not.toContain('conversationThread');
  });

  it('비-waiting 상태는 Execution 을 1회만 조회 (thread 재조회 없음)', async () => {
    for (const status of [
      ExecutionStatus.RUNNING,
      ExecutionStatus.PENDING,
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED,
    ]) {
      const { service, repo, nodeRepo } = makeMocks();
      repo.findOne.mockResolvedValue(makeExecution({ status }));
      await service.getStatus(IEXT_CTX);
      expect(repo.findOne).toHaveBeenCalledTimes(1);
      expect(nodeRepo.findOne).not.toHaveBeenCalled();
    }
  });

  it('waiting_for_input 일 때만 2단계로 conversationThread 를 재조회', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue(null);
    await service.getStatus(IEXT_CTX);
    expect(repo.findOne).toHaveBeenCalledTimes(2);
    expect(selectOf(repo.findOne.mock.calls[1][0])).toContain(
      'conversationThread',
    );
  });

  // 인가 경계: EIA 토큰은 특정 executionId 로 scope 된다. 2단계 쿼리가 1단계와 다른 execution 을
  // 조회하면 남의 대화 히스토리가 새어나간다 — select 단언만으로는 이 클래스의 버그를 못 잡는다.
  it('2단계 조회는 1단계와 동일한 executionId 로 스코프된다 (인가 경계)', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
    );
    nodeRepo.findOne.mockResolvedValue(null);
    await service.getStatus(IEXT_CTX);
    expect(whereOf(repo.findOne.mock.calls[0][0])).toEqual({
      id: IEXT_CTX.executionId,
    });
    expect(whereOf(repo.findOne.mock.calls[1][0])).toEqual({
      id: IEXT_CTX.executionId,
    });
    expect(whereOf(nodeRepo.findOne.mock.calls[0][0])).toMatchObject({
      executionId: IEXT_CTX.executionId,
      status: 'waiting_for_input',
    });
  });

  // waiting 이면 thread 와 nodeExec 를 함께 띄우므로, 대기 노드를 못 찾으면 thread 는 조회됐지만
  // 버려진다(context 조립이 `if (nodeExec?.node)` 안에서만 일어남). 의도된 동작임을 고정한다.
  it('waiting + 대기 nodeExec 없음 — thread 가 있어도 context/currentNode 는 null', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockImplementation((opts: unknown) =>
      Promise.resolve(
        selectOf(opts).includes('conversationThread')
          ? { id: 'exec-1', conversationThread: THREAD }
          : makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
      ),
    );
    nodeRepo.findOne.mockResolvedValue(null);
    const r = await service.getStatus(IEXT_CTX);
    expect(r.currentNode).toBeNull();
    expect(r.context).toBeNull();
  });

  // EIA §R17 "표면 제약(보안)": REST getStatus 와 SSE waiting_for_input emit 이 공유하는
  // 단일 helper `redactThreadForPublic` 로 egress 마스킹한다. thread 를 별도 재조회 결과에서
  // 읽도록 바뀌어도 이 배선이 유지돼야 한다 — 1단계 row 에는 thread 가 아예 없음을 강제해
  // "2단계 결과를 마스킹해 동봉" 을 고정한다.
  it('2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과 (secret egress 가드)', async () => {
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
          text: 'API replied Authorization: Bearer sk-live-STAGE2-LEAK',
          timestamp: 't0',
        },
      ],
      totalChars: 52,
    };
    repo.findOne.mockImplementation((opts: unknown) =>
      Promise.resolve(
        selectOf(opts).includes('conversationThread')
          ? { id: 'exec-1', conversationThread: threadWithSecret }
          : // 1단계 row 에는 thread 가 실려 오지 않는다 (projection 제외).
            makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
      ),
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
      'sk-live-STAGE2-LEAK',
    );
    expect(ctx.conversationThread.turns[0].text).toContain('***');
  });

  it('2단계 재조회가 null(조회 간 row 소멸)이면 conversationThread 키 미동봉', async () => {
    const { service, repo, nodeRepo } = makeMocks();
    repo.findOne.mockImplementation((opts: unknown) =>
      Promise.resolve(
        selectOf(opts).includes('conversationThread')
          ? null
          : makeExecution({ status: ExecutionStatus.WAITING_FOR_INPUT }),
      ),
    );
    nodeRepo.findOne.mockResolvedValue({
      nodeId: 'n1',
      node: { type: 'ai_agent' },
      outputData: { meta: { interactionType: 'ai_conversation' } },
    });
    const r = await service.getStatus(IEXT_CTX);
    expect(r.context).toMatchObject({ waitingNodeId: 'n1' });
    expect(r.context).not.toHaveProperty('conversationThread');
  });

  // startedAt/finishedAt 이 projection 에서 빠지면 `finishedAt ?? startedAt ?? new Date()` 의
  // 마지막 fallback 이 먹어 "현재 시각" 이 조용히 반환된다. 형식(string) 단언만으론 못 잡는다.
  it('updatedAt — finishedAt 우선, 없으면 startedAt 의 실값 (fallback 침묵 회귀 가드)', async () => {
    const { service, repo } = makeMocks();
    repo.findOne.mockResolvedValue(
      makeExecution({
        status: ExecutionStatus.COMPLETED,
        finishedAt: new Date('2026-05-22T03:04:05Z'),
      }),
    );
    expect((await service.getStatus(IEXT_CTX)).updatedAt).toBe(
      '2026-05-22T03:04:05.000Z',
    );

    repo.findOne.mockResolvedValue(
      makeExecution({ status: ExecutionStatus.RUNNING }),
    );
    expect((await service.getStatus(IEXT_CTX)).updatedAt).toBe(
      '2026-05-21T00:00:00.000Z',
    );
  });
});
