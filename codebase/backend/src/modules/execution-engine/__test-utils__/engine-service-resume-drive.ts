import { ExecutionStatus } from '../../executions/entities/execution.entity';
import { NodeExecutionStatus } from '../../node-executions/entities/node-execution.entity';
import type { Node } from '../../nodes/entities/node.entity';
import {
  type EngineServiceHarness,
  executionId,
  workflowId,
} from './engine-service-harness';

/**
 * exec-park D6 full B3 — fresh top-level form/button park 은 durable persist +
 * WAITING 전이로 완결하며 in-memory resolver/coroutine 잔류가 없다(PARK_RELEASED).
 * resume(continue*)은 항상 §7.5 slow-path(applyContinuation → rehydrateAndResume
 * → rehydrateContext 로 context 재구성 → awaited driveResumeAwaited)로 일원화됐다.
 * 이 헬퍼는 그 slow-path 가 통과하는 DB
 * lookup mock 을 무장한다 (Phase 2.7 통합 테스트 패턴의 재사용 추출):
 *   - mockExecutionRepo.findOneBy → WAITING_FOR_INPUT execution
 *   - mockNodeExecutionRepo.find → resolveWaitingNodeExecutionId 의 단일 WAITING row
 *   - mockNodeExecutionRepo.findOneBy → rehydrateAndResume 의 NodeExecution lookup
 *   - mockNodeRepo.findOneBy → Node 정의 lookup
 * workflowRepo.findOne / executionNodeLogRepo.find 는 기본 mock(workspace 동봉
 * workflow / 빈 log) 으로 rehydrateContext 가 자족한다.
 *
 * 무장한 뒤에는 `await service.continueX(...)` 로 드라이브 끝까지 기다린다. 하네스의
 * ContinuationBus mock 은 `publish` 안에서 `applyContinuation` 을 await 하고, 그 안에서
 * `rehydrateAndResume` 이 `driveResumeAwaited` 를 await 하므로 continue* 의 promise 는
 * 드라이브가 끝나야 풀린다. 옛 `flushResumeDrive`(실제 타이머 200ms)는 이 사실을 쓰지 않고
 * 시간으로 기다려 CI 고부하에서 흔들릴 수 있었다(CLE-T-YEDCJK).
 *
 * 엔진 spec 분할 뒤 Form · Button · AI 스펙이 함께 써서 하네스 `h` 를 받는 함수로 옮겼다(CLE-T-YEDCJK).
 */
export function armSlowPathResume(
  h: Pick<
    EngineServiceHarness,
    | 'mockExecutionRepo'
    | 'mockNodeExecutionRepo'
    | 'mockNodeRepo'
    | 'waitingRawRows'
  >,
  waitingNodeId: string,
  nodeDef: Partial<Node>,
): void {
  const neId = `ne-${waitingNodeId}`;
  const saveCalls = h.mockNodeExecutionRepo.save.mock.calls as unknown[][];
  const waitingSave = saveCalls.find(
    (c: unknown[]) =>
      (c[0] as { status?: string; nodeId?: string })?.status ===
        NodeExecutionStatus.WAITING_FOR_INPUT &&
      (c[0] as { nodeId?: string })?.nodeId === waitingNodeId,
  );
  const rawPersisted =
    ((waitingSave?.[0] as { outputData?: Record<string, unknown> }) ?? {})
      .outputData ?? {};
  // rehydrateContext 는 waiting node 의 outputData 를 flat nodeOutputCache 로만
  // 복원한다(structuredOutputCache 미복원). 따라서 button 노드의 buttonConfig
  // 처럼 `.output` 하위에 중첩된 필드를 waitForButtonInteraction 의 flat lookup
  // (`flatNodeOutput.buttonConfig`)이 읽을 수 있도록, 영속 envelope 의 `.output`
  // 을 top-level 로 펼친 flat 표현(엔진 toEngineFlatShape 와 동형 — 즉
  // nodeOutputCache 가 보유하는 flat shape)을 findOneBy 가 반환하게 한다.
  const nestedOutput = rawPersisted.output as
    Record<string, unknown> | undefined;
  const persistedOutput: Record<string, unknown> =
    nestedOutput && typeof nestedOutput === 'object'
      ? { ...rawPersisted, ...nestedOutput }
      : rawPersisted;

  // Execution 은 WAITING_FOR_INPUT (rehydrateAndResume 의 invariant 검증 통과).
  h.mockExecutionRepo.findOneBy.mockResolvedValueOnce({
    id: executionId,
    workflowId,
    status: ExecutionStatus.WAITING_FOR_INPUT,
    startedAt: new Date(),
    recursionDepth: 0,
  });
  // resolveWaitingNodeExecutionId 의 단일 JOIN 쿼리 → WAITING row 1건.
  // meta/flat interactionType 은 park 이 실제로 영속한 envelope 에서 뽑는다
  // (하드코딩 아님) — 프로덕션의 두 JSONB path 투영과 동형이라 form/buttons/ai
  // 세 표면을 비-vacuous 하게 커버한다. precedence 결합은 프로덕션과 동일하게
  // `coalesceInteractionType` 이 수행한다.
  const meta = rawPersisted.meta as Record<string, unknown> | undefined;
  h.waitingRawRows = [
    {
      id: neId,
      nodeId: waitingNodeId,
      nodeType: nodeDef.type,
      metaInteractionType:
        typeof meta?.interactionType === 'string' ? meta.interactionType : null,
      flatInteractionType:
        typeof rawPersisted.interactionType === 'string'
          ? rawPersisted.interactionType
          : null,
    },
  ];
  // rehydrateAndResume 의 NodeExecution lookup (findOneBy by id).
  h.mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
    id: neId,
    executionId,
    nodeId: waitingNodeId,
    status: NodeExecutionStatus.WAITING_FOR_INPUT,
    outputData: persistedOutput,
    startedAt: new Date(),
  });
  // rehydrateAndResume 의 Node 정의 lookup (findOneBy by id).
  h.mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(nodeDef);
}
