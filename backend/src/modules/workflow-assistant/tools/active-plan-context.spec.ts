import {
  findActivePlanContext,
  isExplicitFailure,
} from './active-plan-context';
import type {
  AssistantPlanRecord,
  AssistantToolCallRecord,
  WorkflowAssistantMessage,
} from '../entities/workflow-assistant-message.entity';

/**
 * findActivePlanContext 는 매 턴 실행되는 "장기 컨텍스트" derive 로직이다.
 * 정합성이 핵심이라 다음 경로를 전부 고정한다:
 *   - 이번 턴 planForTurn 우선
 *   - history 최신 plan + clear_plan 이후면 null
 *   - history 최신 plan + 완료된 step 집계 (this turn + prior turns)
 *   - note step 제외 완료 판정
 *   - openQuestions 남으면 active, 모두 비면 completed
 */
const baseStep = {
  id: 's1',
  action: 'add_node' as const,
  description: 'add http',
};

function samplePlan(
  overrides: Partial<AssistantPlanRecord> = {},
): AssistantPlanRecord {
  return {
    title: 'sample',
    summary: '',
    steps: [baseStep],
    openQuestions: undefined,
    ...overrides,
  };
}

function userMsg(content: string): WorkflowAssistantMessage {
  return {
    role: 'user',
    content,
    toolCalls: null,
  } as WorkflowAssistantMessage;
}

function assistantMsg(
  overrides: Partial<WorkflowAssistantMessage>,
): WorkflowAssistantMessage {
  return {
    role: 'assistant',
    content: '',
    toolCalls: null,
    plan: null,
    ...overrides,
  } as WorkflowAssistantMessage;
}

describe('findActivePlanContext', () => {
  it('prefers planForTurn over anything in history', () => {
    const ctx = findActivePlanContext(
      [userMsg('뭔가 이전 요청')],
      samplePlan({ title: 'brand new' }),
      [],
      '새 요청',
    );
    expect(ctx).not.toBeNull();
    expect(ctx!.plan.title).toBe('brand new');
    expect(ctx!.userRequest).toBe('새 요청');
    expect(ctx!.status).toBe('active');
  });

  it('returns null when no plan exists anywhere', () => {
    expect(findActivePlanContext([], null, [], '')).toBeNull();
  });

  it('picks the latest history plan and attaches the user request that preceded it', () => {
    const plan = samplePlan({
      title: '주문 취소 플로우',
      steps: [
        { id: 'a', action: 'add_node', description: '노드 A' },
        { id: 'b', action: 'add_node', description: '노드 B' },
      ],
    });
    const history = [
      userMsg('주문 취소 프로세스 추가해줘'),
      assistantMsg({
        plan,
        toolCalls: [
          {
            id: 'p1',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
      }),
    ];
    const ctx = findActivePlanContext(history, null, [], '계속');
    expect(ctx).not.toBeNull();
    expect(ctx!.plan.title).toBe('주문 취소 플로우');
    expect(ctx!.userRequest).toBe('주문 취소 프로세스 추가해줘');
    expect(ctx!.status).toBe('active');
  });

  it('returns null once clear_plan has been called after the plan', () => {
    const history = [
      userMsg('이전 요청'),
      assistantMsg({ plan: samplePlan() }),
      assistantMsg({
        toolCalls: [
          {
            id: 'c1',
            name: 'clear_plan',
            arguments: { reason: 'user changed topic' },
            kind: 'plan',
            result: { ok: true, cleared: true },
          },
        ],
      }),
    ];
    expect(findActivePlanContext(history, null, [], 'new topic')).toBeNull();
  });

  it('marks plan completed when all actionable steps are done and no openQuestions', () => {
    const plan = samplePlan({
      steps: [
        { id: 's1', action: 'add_node', description: 'a' },
        { id: 's2', action: 'add_node', description: 'b' },
        { id: 's_note', action: 'note', description: 'reminder' },
      ],
    });
    const history = [
      userMsg('시작'),
      assistantMsg({
        plan,
        toolCalls: [
          {
            id: 'p',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
        ],
      }),
      assistantMsg({
        toolCalls: [
          {
            id: 'e1',
            name: 'add_node',
            arguments: {},
            kind: 'edit',
            planStepId: 's1',
            result: { ok: true, id: 'n1' },
          },
          {
            id: 'e2',
            name: 'add_node',
            arguments: {},
            kind: 'edit',
            planStepId: 's2',
            result: { ok: true, id: 'n2' },
          },
        ],
      }),
    ];
    const ctx = findActivePlanContext(history, null, [], 'continue');
    expect(ctx).not.toBeNull();
    expect(ctx!.status).toBe('completed');
    expect(ctx!.completedStepIds.has('s1')).toBe(true);
    expect(ctx!.completedStepIds.has('s2')).toBe(true);
  });

  it('stays active when an openQuestion is unanswered even if steps are all done', () => {
    const plan = samplePlan({
      steps: [{ id: 's1', action: 'add_node', description: 'a' }],
      openQuestions: ['어떤 Provider?'],
    });
    const history = [
      userMsg('시작'),
      assistantMsg({ plan }),
      assistantMsg({
        toolCalls: [
          {
            id: 'e1',
            name: 'add_node',
            arguments: {},
            kind: 'edit',
            planStepId: 's1',
            result: { ok: true, id: 'n1' },
          },
        ],
      }),
    ];
    const ctx = findActivePlanContext(history, null, [], 'still thinking');
    expect(ctx!.status).toBe('active');
    expect(ctx!.plan.openQuestions).toEqual(['어떤 Provider?']);
  });

  it('includes this-turn pending tool calls when computing completion', () => {
    const plan = samplePlan({
      steps: [
        { id: 's1', action: 'add_node', description: 'a' },
        { id: 's2', action: 'add_node', description: 'b' },
      ],
    });
    const history = [userMsg('시작'), assistantMsg({ plan })];
    const pending: AssistantToolCallRecord[] = [
      {
        id: 'cur-1',
        name: 'add_node',
        arguments: {},
        kind: 'edit',
        planStepId: 's1',
        result: { ok: true, id: 'n1' },
      },
      {
        id: 'cur-2',
        name: 'add_node',
        arguments: {},
        kind: 'edit',
        planStepId: 's2',
        result: { ok: true, id: 'n2' },
      },
    ];
    const ctx = findActivePlanContext(history, null, pending, 'in-flight');
    expect(ctx!.status).toBe('completed');
  });

  it('treats same-turn clear_plan + propose_plan (planForTurn set) as the new active plan, not stale', () => {
    // Regression test for the slice-boundary bug: history 의 plan 메시지
    // 자체가 같은 턴에 clear_plan tool call 을 품고 있더라도, planForTurn 이
    // 세팅된 이번 턴에서는 새 plan 이 우선이어야 한다.
    const oldPlan = samplePlan({ title: 'old' });
    const newPlan = samplePlan({ title: 'new' });
    const history = [
      userMsg('이전 요청'),
      assistantMsg({
        plan: oldPlan,
        toolCalls: [
          {
            id: 'old_p',
            name: 'propose_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true },
          },
          {
            id: 'clear',
            name: 'clear_plan',
            arguments: {},
            kind: 'plan',
            result: { ok: true, cleared: true },
          },
        ],
      }),
    ];
    const ctx = findActivePlanContext(history, newPlan, [], '진행');
    expect(ctx).not.toBeNull();
    expect(ctx!.plan.title).toBe('new');
  });

  it('returns null when clear_plan is in pendingToolCalls (same turn with no new plan)', () => {
    const history = [
      userMsg('이전 요청'),
      assistantMsg({ plan: samplePlan() }),
    ];
    const pending: AssistantToolCallRecord[] = [
      {
        id: 'clear',
        name: 'clear_plan',
        arguments: { reason: '다른 주제' },
        kind: 'plan',
        result: { ok: true, cleared: true },
      },
    ];
    expect(findActivePlanContext(history, null, pending, '')).toBeNull();
  });

  describe('isExplicitFailure', () => {
    it('returns true only for { ok: false }', () => {
      expect(isExplicitFailure({ ok: false, error: 'LABEL_CONFLICT' })).toBe(
        true,
      );
    });
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['primitive number', 42],
      ['primitive string', 'done'],
      ['empty object', {}],
      ['ok: true', { ok: true, id: 'x' }],
    ])('returns false for %s (legacy/success interpretation)', (_, v) => {
      expect(isExplicitFailure(v)).toBe(false);
    });
  });

  it('does not count failed tool calls as completed steps', () => {
    const plan = samplePlan({
      steps: [
        { id: 's1', action: 'add_node', description: 'a' },
        { id: 's2', action: 'add_node', description: 'b' },
      ],
    });
    const history = [
      userMsg('시작'),
      assistantMsg({ plan }),
      assistantMsg({
        toolCalls: [
          {
            id: 'e1',
            name: 'add_node',
            arguments: {},
            kind: 'edit',
            planStepId: 's1',
            result: { ok: false, error: 'LABEL_CONFLICT' },
          },
        ],
      }),
    ];
    const ctx = findActivePlanContext(history, null, [], 'retry');
    expect(ctx!.status).toBe('active');
    expect(ctx!.completedStepIds.has('s1')).toBe(false);
  });
});
