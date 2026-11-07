import type { Logger } from '@nestjs/common';
import type { NodeExecution } from '../node-executions/entities/node-execution.entity';
import type { Node } from '../nodes/entities/node.entity';
import type { ExecutionContext } from '../../nodes/core/node-handler.interface';
import type { InteractionEngineDriver } from './engine-driver.interface';
import {
  ExecutionCancelledError,
  NodeCancelMarkingError,
} from './workflow-errors';

/** 헬퍼가 쓰는 의존성. 각 서비스가 자기 `ENGINE_DRIVER` 주입분과 logger 를 넘긴다. */
export interface LinkedTransitionGuardDeps {
  readonly driver: Pick<InteractionEngineDriver, 'markNodeCancelled'>;
  readonly logger: Pick<Logger, 'error'>;
}

/** 한 소비처에서 관측한 짝 전이 결과. */
export interface LinkedTransitionObservation {
  /**
   * 동시 Stop 이 Execution 을 terminal 로 먼저 마감하지 않아서 짝 전이 · save 를 그대로
   * 진행해도 되는가. 호출부는 DB 가드를 통과한 원자적 관측값을 그대로 넘긴다.
   * `updateExecutionStatus`(짝 전이 choke point, `FOR UPDATE`)나
   * `tryLockActiveExecutionAndSaveNodeExec`(같은 행 잠금 안의 관측 + save)의 반환값이다.
   * 로컬에서 계산한 플래그를 넘기지 않는다.
   */
  readonly shouldProceed: boolean;
  /** 짝이었던 NodeExecution. 없으면 마킹을 건너뛰고 취소만 넘긴다. */
  readonly nodeExec: NodeExecution | null;
  readonly node: Node;
  readonly context: ExecutionContext;
  readonly executionId: string;
  /** 취소 메시지 접미사와 로그에 싣는 소비처 이름(예: `form park`). */
  readonly phase: string;
}

/**
 * 짝 전이 종결 가드. CLE-EXEC-STATE §원자성 보장 5 의 호출부 의무를 한곳에서 지킨다.
 *
 * `shouldProceed === false` 는 동시 Stop 이 Execution 을 이미 terminal 로 마감한 경우다.
 * 이때 호출부는 park · 재개 · terminal 이벤트를 내지 않아야 하고, 이 헬퍼가 나머지를 한다.
 *   1. 짝 NodeExecution 이 있으면 `markNodeCancelled` 로 CANCELLED 마킹과 `NODE_CANCELLED`
 *      발행을 한다. 방치하면 행이 non-terminal 로 영구히 남는다. 성공 · 대기 · 실패 payload 를
 *      비우는 일은 `markNodeCancelled` 가 직접 한다(호출부가 미리 비우지 않는다).
 *   2. `ExecutionCancelledError` 를 던져 상위의 기존 취소 마감 경로로 넘긴다. 그대로 진행하면
 *      취소된 실행이 정상 park · 완료처럼 보인다. 메시지 접미사는 `phase` 하나로만 만든다.
 *
 * 마킹이 실패해도 취소 분류는 유지한다(C-4). 실패를 그대로 전파하면 2번이 실행되지 않아
 * 상위가 취소를 FAILED 로 오분류한다. 실패는 로그로만 남기고, `NodeCancelMarkingError` 의
 * 단계로 문구를 나눈다. save 실패만 행이 non-terminal 로 남을 수 있다고 적는다.
 *
 * 소비처는 AI turn 오케스트레이터와 form · button 상호작용 서비스다. 개수는 여기 적지 않는다.
 * 정확한 목록은 이 함수의 호출부를 찾아본다(예전에 JSDoc 의 소비처 개수가 두 라운드 동안
 * 낡은 채 남았던 이력이 있다).
 *
 * `shouldProceed === true` 면 아무것도 하지 않는다(정상 경로).
 *
 * @throws {ExecutionCancelledError} `shouldProceed === false` 일 때 항상.
 */
export async function assertLinkedTransitionApplied(
  deps: LinkedTransitionGuardDeps,
  observation: LinkedTransitionObservation,
): Promise<void> {
  const { shouldProceed, nodeExec, node, context, executionId, phase } =
    observation;
  if (shouldProceed) return;
  if (nodeExec) {
    try {
      await deps.driver.markNodeCancelled(nodeExec, node, context, executionId);
    } catch (err) {
      deps.logger.error(
        `assertLinkedTransitionApplied(${executionId}): ` +
          describeMarkingFailure(nodeExec.id, err) +
          ` 취소 분류는 유지한다. phase=${phase} ` +
          `error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  throw new ExecutionCancelledError(
    `Execution ${executionId} cancelled during ${phase}`,
  );
}

/** 마킹 실패 단계별 진단 문구. 조사 시작점이 갈리므로 단계를 섞어 적지 않는다. */
function describeMarkingFailure(nodeExecutionId: string, err: unknown): string {
  if (err instanceof NodeCancelMarkingError) {
    if (err.stage === 'save') {
      return (
        `짝 NodeExecution ${nodeExecutionId} 를 CANCELLED 로 저장하지 못했다. ` +
        `행이 non-terminal 로 남을 수 있다.`
      );
    }
    return (
      `짝 NodeExecution ${nodeExecutionId} 는 CANCELLED 로 저장했지만 NODE_CANCELLED 를 내지 못했다. ` +
      `클라이언트 타임라인만 갱신되지 않는다.`
    );
  }
  return `짝 NodeExecution ${nodeExecutionId} 마킹이 실패했다(단계 미상).`;
}
