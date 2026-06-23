import { AssistantFinishGuard } from './assistant-finish-guard.service';
import type { FinishGuardState } from './assistant-finish-guard.service';
import { ShadowWorkflow } from './shadow-workflow';
import {
  AssistantPlanRecord,
  AssistantToolCallRecord,
} from '../entities/workflow-assistant-message.entity';

// M-3 2단계: WorkflowAssistantStreamService.streamMessage 에서 분리된 finish/
// review 가드의 상태기계(spec 3-workflow-editor §10) 를 가드 객체 단위로 직접
// 고정한다. blocking/verify checklist 의 양성 경로는 무거운 shadow·registry
// fixture 가 필요해 통합 테스트(workflow-assistant-stream.service.spec.ts)에서
// 커버하고, 여기서는 (a) evaluateFinishGuard 의 전 분기와 (b) evaluateReviewGuard
// 의 skip 판정(shouldSkipReview) 을 가벼운 fixture 로 못박는다.

function freshState(over: Partial<FinishGuardState> = {}): FinishGuardState {
  return {
    finishBlockCount: 0,
    editsSinceLastFinishBlock: 0,
    planClearedThisTurn: false,
    reviewCompleted: false,
    reviewRoundCount: 0,
    verifyFiredOnce: false,
    ...over,
  };
}

function plan(over: Partial<AssistantPlanRecord> = {}): AssistantPlanRecord {
  return {
    title: 'P',
    summary: '',
    approvedAt: '2026-01-01T00:00:00.000Z',
    steps: [
      { id: 's1', action: 'add_node', description: 'add node 1' },
      { id: 's2', action: 'add_node', description: 'add node 2' },
    ],
    ...over,
  };
}

function okEdit(planStepId?: string): AssistantToolCallRecord {
  return {
    id: `tc-${planStepId ?? 'x'}`,
    name: 'add_node',
    arguments: {},
    kind: 'edit',
    result: { ok: true },
    ...(planStepId ? { planStepId } : {}),
  };
}

// shouldSkipReview 만 검증하는 경로에서는 snapshot().nodes 의 category 만
// 필요하다. nodeRegistry/candidateLookup 은 skip 분기에서 호출되지 않는다.
function fakeShadow(
  nodes: Array<{ id: string; type: string; category: string }>,
): ShadowWorkflow {
  return {
    snapshot: () => ({ nodes, edges: [] }),
  } as unknown as ShadowWorkflow;
}

function makeGuard(): AssistantFinishGuard {
  const nodeRegistry = {
    listDefinitions: jest.fn(() => []),
    getComponent: jest.fn(() => undefined),
  };
  const candidateLookup = {
    fillCandidates: jest.fn(async (_ws, _wf, p: unknown[]) => p),
  };
  return new AssistantFinishGuard(
    nodeRegistry as never,
    candidateLookup as never,
  );
}

const REQUEST = 'build me a workflow';

describe('AssistantFinishGuard.evaluateFinishGuard', () => {
  it('clear_plan 이 이번 턴에 호출되면(planClearedThisTurn) 가드 비활성 → null', () => {
    const g = makeGuard();
    const block = g.evaluateFinishGuard(
      [],
      plan(),
      [okEdit('s1')],
      freshState({ planClearedThisTurn: true }),
      REQUEST,
    );
    expect(block).toBeNull();
  });

  it('plan 이 승인 전(approvedAt 없음)이면 PAA 차단과 충돌하므로 → null', () => {
    const g = makeGuard();
    const block = g.evaluateFinishGuard(
      [],
      plan({ approvedAt: undefined }),
      [okEdit('s1')],
      freshState(),
      REQUEST,
    );
    expect(block).toBeNull();
  });

  it('block 후 진척 0(stuck)이면 무한 루프 방지로 탈출 → null', () => {
    const g = makeGuard();
    const block = g.evaluateFinishGuard(
      [],
      plan(),
      [okEdit('s1')],
      freshState({ finishBlockCount: 1, editsSinceLastFinishBlock: 0 }),
      REQUEST,
    );
    expect(block).toBeNull();
  });

  it('이번 턴 성공 edit 이 하나도 없으면(질문·plan-only) → null', () => {
    const g = makeGuard();
    const failedEdit: AssistantToolCallRecord = {
      id: 'tc-fail',
      name: 'add_node',
      arguments: {},
      kind: 'edit',
      result: { ok: false, error: 'BOOM' },
    };
    const block = g.evaluateFinishGuard(
      [],
      plan(),
      [failedEdit],
      freshState(),
      REQUEST,
    );
    expect(block).toBeNull();
  });

  it('active plan 에 미완 step 이 남으면 PLAN_NOT_COMPLETE(남은 step 나열)', () => {
    const g = makeGuard();
    // s1 만 완료 → s2 미완.
    const block = g.evaluateFinishGuard(
      [],
      plan(),
      [okEdit('s1')],
      freshState(),
      REQUEST,
    );
    expect(block).not.toBeNull();
    expect(block?.error).toBe('PLAN_NOT_COMPLETE');
    if (block?.error === 'PLAN_NOT_COMPLETE') {
      expect(block.pendingSteps.map((s) => s.id)).toEqual(['s2']);
      expect(block.openQuestions).toEqual([]);
    }
  });

  it('모든 step 완료 + openQuestions 없음이면 completed → null(통과)', () => {
    const g = makeGuard();
    const block = g.evaluateFinishGuard(
      [],
      plan(),
      [okEdit('s1'), okEdit('s2')],
      freshState(),
      REQUEST,
    );
    expect(block).toBeNull();
  });

  it('step 은 다 끝났어도 openQuestions 가 남으면 PLAN_NOT_COMPLETE', () => {
    const g = makeGuard();
    const block = g.evaluateFinishGuard(
      [],
      plan({ openQuestions: ['어떤 채널로 알림을 보낼까요?'] }),
      [okEdit('s1'), okEdit('s2')],
      freshState(),
      REQUEST,
    );
    expect(block?.error).toBe('PLAN_NOT_COMPLETE');
    if (block?.error === 'PLAN_NOT_COMPLETE') {
      expect(block.pendingSteps).toEqual([]);
      expect(block.openQuestions).toEqual(['어떤 채널로 알림을 보낼까요?']);
    }
  });
});

describe('AssistantFinishGuard.evaluateReviewGuard — shouldSkipReview 판정', () => {
  const shadow2 = fakeShadow([
    { id: 'n0', type: 'manual_trigger', category: 'trigger' },
    { id: 'n1', type: 'send_email', category: 'action' },
    { id: 'n2', type: 'http_request', category: 'action' },
  ]);

  async function review(
    state: FinishGuardState,
    pendingToolCalls: AssistantToolCallRecord[],
    shadow = shadow2,
  ) {
    return makeGuard().evaluateReviewGuard(
      [],
      null,
      pendingToolCalls,
      state,
      REQUEST,
      '',
      shadow,
      'ws-1',
      'wf-1',
    );
  }

  it('reviewCompleted 면 skip → null', async () => {
    expect(
      await review(freshState({ reviewCompleted: true }), [okEdit()]),
    ).toBeNull();
  });

  it('reviewRoundCount 가 상한(2) 도달이면 skip → null', async () => {
    expect(
      await review(freshState({ reviewRoundCount: 2 }), [okEdit()]),
    ).toBeNull();
  });

  it('planClearedThisTurn 이면 skip → null', async () => {
    expect(
      await review(freshState({ planClearedThisTurn: true }), [okEdit()]),
    ).toBeNull();
  });

  it('이번 턴 성공 edit 이 없으면 skip → null', async () => {
    const failed: AssistantToolCallRecord = {
      id: 'tc-fail',
      name: 'add_node',
      arguments: {},
      kind: 'edit',
      result: { ok: false },
    };
    expect(await review(freshState(), [failed])).toBeNull();
  });

  it('non-trigger 노드 ≤ 1 인 trivial 편집은 skip → null', async () => {
    const tinyShadow = fakeShadow([
      { id: 'n0', type: 'manual_trigger', category: 'trigger' },
      { id: 'n1', type: 'send_email', category: 'action' },
    ]);
    expect(await review(freshState(), [okEdit()], tinyShadow)).toBeNull();
  });
});
