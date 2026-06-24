import {
  AssistantTurnPersistenceService,
  makeResumeMeta,
} from './assistant-turn-persistence.service';
import type {
  AssistantPlanRecord,
  AssistantToolCallRecord,
} from '../entities/workflow-assistant-message.entity';

/**
 * M-3 3단계로 `WorkflowAssistantStreamService` 에서 분리한 무상태 영속
 * collaborator 의 단위 테스트. 통합 동작(스트림 루프 경유 persist 단언)은
 * `workflow-assistant-stream.service.spec.ts` 가 계속 커버하고, 여기서는
 * 이동한 메서드/헬퍼의 입출력 계약을 격리 검증한다.
 */

function makeSessionMock() {
  return {
    appendMessage: jest.fn().mockResolvedValue({}),
    setTitleIfEmpty: jest.fn().mockResolvedValue(undefined),
  };
}

function makeService() {
  const sessionService = makeSessionMock();
  const service = new AssistantTurnPersistenceService(sessionService as never);
  return { service, sessionService };
}

describe('makeResumeMeta', () => {
  it('returns the non-resumed default meta when stallRounds <= 0', () => {
    expect(makeResumeMeta(0)).toEqual({
      autoResumed: false,
      autoResumeReason: null,
      autoResumeAttempt: null,
    });
    // 음수도 정상 턴으로 취급 (방어적).
    expect(makeResumeMeta(-1)).toEqual({
      autoResumed: false,
      autoResumeReason: null,
      autoResumeAttempt: null,
    });
  });

  it('flags autoResumed with the stall attempt when stallRounds > 0', () => {
    expect(makeResumeMeta(1)).toEqual({
      autoResumed: true,
      autoResumeReason: 'stall_pending_steps',
      autoResumeAttempt: 1,
    });
    expect(makeResumeMeta(2)).toEqual({
      autoResumed: true,
      autoResumeReason: 'stall_pending_steps',
      autoResumeAttempt: 2,
    });
  });
});

describe('AssistantTurnPersistenceService.persistUserTurn', () => {
  it('appends the user message', async () => {
    const { service, sessionService } = makeService();
    await service.persistUserTurn('sess-1', 'hello world', null);
    expect(sessionService.appendMessage).toHaveBeenCalledWith('sess-1', {
      role: 'user',
      content: 'hello world',
    });
  });

  it('derives a session title from the first user content when title is empty', async () => {
    const { service, sessionService } = makeService();
    const content = 'Build me an onboarding workflow with email + slack';
    await service.persistUserTurn('sess-1', content, null);
    // 앞 40자로 잘라 title derive.
    expect(sessionService.setTitleIfEmpty).toHaveBeenCalledWith(
      'sess-1',
      content.slice(0, 40),
    );
  });

  it('does not set a title when the session already has one', async () => {
    const { service, sessionService } = makeService();
    await service.persistUserTurn('sess-1', 'hello', 'Existing title');
    expect(sessionService.setTitleIfEmpty).not.toHaveBeenCalled();
    // user 메시지 append 자체는 여전히 일어난다.
    expect(sessionService.appendMessage).toHaveBeenCalledTimes(1);
  });

  it('does not set a title when the derived title would be empty (whitespace-only)', async () => {
    const { service, sessionService } = makeService();
    await service.persistUserTurn('sess-1', '   \n\t  ', null);
    expect(sessionService.setTitleIfEmpty).not.toHaveBeenCalled();
    // title 은 건너뛰지만 user 메시지 append 자체는 원문 그대로 일어난다.
    expect(sessionService.appendMessage).toHaveBeenCalledWith('sess-1', {
      role: 'user',
      content: '   \n\t  ',
    });
  });
});

describe('AssistantTurnPersistenceService.persistAssistantTurn', () => {
  const toolCalls: AssistantToolCallRecord[] = [
    { id: 'tc-1', name: 'add_node', arguments: {}, kind: 'edit' },
  ];
  const plan: AssistantPlanRecord = {
    title: 'Plan',
    summary: '',
    steps: [],
  };

  it('appends an assistant row with the default (non-resumed) meta', async () => {
    const { service, sessionService } = makeService();
    await service.persistAssistantTurn(
      'sess-1',
      'final text',
      toolCalls,
      plan,
      null,
      'stop',
    );
    expect(sessionService.appendMessage).toHaveBeenCalledWith('sess-1', {
      role: 'assistant',
      content: 'final text',
      toolCalls,
      plan,
      usage: null,
      finishReason: 'stop',
      autoResumed: false,
      autoResumeReason: null,
      autoResumeAttempt: null,
    });
  });

  it('normalizes empty content to null and empty toolCalls to null', async () => {
    const { service, sessionService } = makeService();
    await service.persistAssistantTurn('sess-1', '', [], null, null, 'stop');
    const row = sessionService.appendMessage.mock.calls[0][1];
    expect(row.content).toBeNull();
    expect(row.toolCalls).toBeNull();
  });

  it('passes through an explicit stall-recovery resumeMeta', async () => {
    const { service, sessionService } = makeService();
    await service.persistAssistantTurn(
      'sess-1',
      'segment text',
      toolCalls,
      null,
      null,
      'auto_resume_pending',
      makeResumeMeta(2),
    );
    const row = sessionService.appendMessage.mock.calls[0][1];
    expect(row.autoResumed).toBe(true);
    expect(row.autoResumeReason).toBe('stall_pending_steps');
    expect(row.autoResumeAttempt).toBe(2);
  });

  it('records the usage snapshot when provided', async () => {
    const { service, sessionService } = makeService();
    const usage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      model: 'gpt-4o',
    };
    await service.persistAssistantTurn(
      'sess-1',
      'text',
      [],
      null,
      usage,
      'stop',
    );
    const row = sessionService.appendMessage.mock.calls[0][1];
    expect(row.usage).toEqual(usage);
  });

  it('preserves the optional thinkingTokens field on the usage snapshot', async () => {
    const { service, sessionService } = makeService();
    const usage = {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      thinkingTokens: 5,
      model: 'gpt-4o',
    };
    await service.persistAssistantTurn(
      'sess-1',
      'text',
      [],
      null,
      usage,
      'stop',
    );
    const row = sessionService.appendMessage.mock.calls[0][1];
    expect(row.usage).toEqual(usage);
    expect(row.usage.thinkingTokens).toBe(5);
  });

  it('passes through provider-opaque finishReason values (e.g. length) unchanged', async () => {
    // finishReason 은 strict union 이 아니라 string — provider 원본
    // (`'length'`/`'content_filter'`/`'aborted'`)이 그대로 흘러야 한다.
    const { service, sessionService } = makeService();
    await service.persistAssistantTurn(
      'sess-1',
      'text',
      [],
      null,
      null,
      'length',
    );
    const row = sessionService.appendMessage.mock.calls[0][1];
    expect(row.finishReason).toBe('length');
  });
});
