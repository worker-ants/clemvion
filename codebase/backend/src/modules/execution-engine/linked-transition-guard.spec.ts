import { assertLinkedTransitionApplied } from './linked-transition-guard';
import {
  ExecutionCancelledError,
  NodeCancelMarkingError,
} from './workflow-errors';
import type { NodeExecution } from '../node-executions/entities/node-execution.entity';
import type { Node } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';

// ────────────────────────────────────────────────────────────────────────────
// 짝 전이 종결 가드 — AI · form · button 이 함께 쓰는 헬퍼(CLE-T-J6GRJ9).
//
// 소비처별 배선(어느 phase 에서 부르는가, 이벤트를 건너뛰는가)은 각 서비스 spec 이 본다.
// 여기서는 헬퍼 자체의 계약만 본다: 진행 · 마킹 · 취소 분류 유지 · 실패 단계별 로그.
// ────────────────────────────────────────────────────────────────────────────

describe('assertLinkedTransitionApplied', () => {
  const executionId = 'exec-guard';
  const node = { id: 'node-guard', type: 'form' } as unknown as Node;
  const context = { executionId } as unknown as ExecutionContext;

  let markNodeCancelled: jest.Mock;
  let logError: jest.Mock;

  beforeEach(() => {
    markNodeCancelled = jest.fn().mockResolvedValue(undefined);
    logError = jest.fn();
  });

  const run = (
    shouldProceed: boolean,
    nodeExec: NodeExecution | null,
    phase = 'form park',
  ) =>
    assertLinkedTransitionApplied(
      { driver: { markNodeCancelled }, logger: { error: logError } },
      { shouldProceed, nodeExec, node, context, executionId, phase },
    );

  const nodeExec = () =>
    ({ id: 'ne-guard', startedAt: new Date() }) as unknown as NodeExecution;

  it('짝 전이가 적용됐으면(true) 아무것도 하지 않는다', async () => {
    await expect(run(true, nodeExec())).resolves.toBeUndefined();
    expect(markNodeCancelled).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('선점당했으면(false) 짝 행을 마킹하고 phase 를 실은 취소로 끝낸다', async () => {
    const ne = nodeExec();
    const promise = run(false, ne, 'buttons park');

    await expect(promise).rejects.toBeInstanceOf(ExecutionCancelledError);
    await expect(promise).rejects.toThrow(
      `Execution ${executionId} cancelled during buttons park`,
    );
    expect(markNodeCancelled).toHaveBeenCalledWith(
      ne,
      node,
      context,
      executionId,
    );
  });

  it('짝 행이 없으면 마킹 없이 취소로 끝낸다', async () => {
    await expect(run(false, null)).rejects.toBeInstanceOf(
      ExecutionCancelledError,
    );
    expect(markNodeCancelled).not.toHaveBeenCalled();
  });

  // C-4 — 마킹 실패가 취소 분류를 바꾸면 안 된다. 상위가 일반 예외로 보고 FAILED 로
  // 오분류한다. 실패는 로그로만 남기고, 로그는 어느 단계가 실패했는지에 따라 다르게 쓴다.
  describe('마킹이 실패해도 취소로 끝내고 단계별로 로그를 남긴다', () => {
    const lastLog = (): string => logError.mock.calls.at(-1)?.[0] as string;

    it('save 실패 — 행이 non-terminal 로 남을 수 있다고 적는다', async () => {
      markNodeCancelled.mockRejectedValueOnce(
        new NodeCancelMarkingError(
          'save',
          'ne-guard',
          new Error('DB write failed'),
        ),
      );

      await expect(run(false, nodeExec())).rejects.toBeInstanceOf(
        ExecutionCancelledError,
      );
      const log = lastLog();
      expect(log).toContain('ne-guard');
      expect(log).toContain('DB write failed');
      expect(log).toContain('phase=form park');
      expect(log).toContain('CANCELLED 로 저장하지 못했다');
      expect(log).toContain('non-terminal');
    });

    it('emit 실패 — 행은 CANCELLED 로 저장됐다고 적고 non-terminal 잔류를 말하지 않는다', async () => {
      markNodeCancelled.mockRejectedValueOnce(
        new NodeCancelMarkingError(
          'emit',
          'ne-guard',
          new Error('ws publish failed'),
        ),
      );

      await expect(run(false, nodeExec())).rejects.toBeInstanceOf(
        ExecutionCancelledError,
      );
      const log = lastLog();
      expect(log).toContain('ne-guard');
      expect(log).toContain('ws publish failed');
      expect(log).toContain(
        'CANCELLED 로 저장했지만 NODE_CANCELLED 를 내지 못했다',
      );
      expect(log).not.toContain('non-terminal');
    });

    it('단계를 모르는 실패 — 단계 미상으로 적고 원본 메시지를 남긴다', async () => {
      markNodeCancelled.mockRejectedValueOnce(new Error('boom'));

      await expect(run(false, nodeExec())).rejects.toBeInstanceOf(
        ExecutionCancelledError,
      );
      const log = lastLog();
      expect(log).toContain('ne-guard');
      expect(log).toContain('boom');
      expect(log).toContain('단계 미상');
    });
  });
});
