import { BackgroundExecutionJob } from './queues/background-execution.queue';
import { createEmptyConversationThread } from '../../shared/conversation-thread/conversation-thread.types';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import {
  ExecutionContext,
  NodeHandler,
} from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
import {
  type EngineServiceHarness,
  createEngineServiceHarness,
  executionId,
  flushPromises,
  mockWorkflow,
  withWorkspace,
  workflowId,
} from './__test-utils__/engine-service-harness';
import { ForEachHandler } from '../../nodes/logic/foreach/foreach.handler';
import { LoopHandler } from '../../nodes/logic/loop/loop.handler';
import { MapHandler } from '../../nodes/logic/map/map.handler';
import { BackgroundHandler } from '../../nodes/logic/background/background.handler';
import { findExecutionStatusUpdate } from './__test-utils__/raw-update-params';

/**
 * ExecutionEngineService 단위 테스트: 컨테이너 본문 안 중첩 컨테이너 · Background · 엔진 덮어쓰기 완료 기록.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
describe('ExecutionEngineService', () => {
  let h: EngineServiceHarness;
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: EngineServiceHarness['mockWebsocketService'];

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;
  // 테스트가 다시 대입하는 `dbExecutionStatus` · `waitingRawRows` ·
  // `waitingQueryError` 는 mock 클로저가 읽는 하네스 필드라 `h.` 로 대입한다.

  // 서비스 구성 · mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스.
  beforeEach(async () => {
    h = await createEngineServiceHarness();
    ({
      service,
      handlerRegistry,
      mockWebsocketService,
      mockExecutionRepo,
      mockNodeExecutionRepo,
      mockNodeRepo,
      mockEdgeRepo,
      mockWorkflowRepo,
      mockExecutionNodeLogRepo,
    } = h);
  });

  describe('Container runtime', () => {
    beforeEach(() => {
      // Test modules don't invoke onModuleInit, so register real container
      // handlers used by the pointer loop here.
      // PR-G — metadata 동봉. 엔진의 dispatch 가 `kind === 'container'` 로
      // 식별하므로 NodeComponentRegistry 부팅을 우회하는 테스트는 직접 명시.
      handlerRegistry.register('foreach', new ForEachHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('loop', new LoopHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('map', new MapHandler(), { kind: 'container' });
    });

    // CLE-T-MR6ZH3 — 컨테이너 본문 루프(`executeContainerBody`)도 메인 루프 · 병렬 분기
    // 루프와 같은 규칙으로 노드를 실행 경로에 넘긴다. 본문 안 Loop · ForEach · Map 은
    // `runContainer`, Background 는 `scheduleBackgroundBody` 로 간다.
    describe('본문 안 중첩 컨테이너 · Background (CLE-T-MR6ZH3)', () => {
      const cNode = (
        id: string,
        type: string,
        containerId: string | null,
        config: Record<string, unknown> = {},
      ): Partial<Node> => ({
        id,
        workflowId,
        type,
        category:
          type === 'test_node' ? NodeCategory.TRIGGER : NodeCategory.LOGIC,
        label: id,
        config,
        isDisabled: false,
        containerId,
        toolOwnerId: null,
      });
      const cEdge = (
        source: string,
        sourcePort: string,
        target: string,
        targetPort = 'in',
      ): Partial<Edge> => ({
        id: `${source}.${sourcePort}->${target}.${targetPort}`,
        workflowId,
        sourceNodeId: source,
        sourcePort,
        targetNodeId: target,
        targetPort,
        type: EdgeType.DATA,
      });
      const recordingHandler = (
        type: string,
        output: (input: unknown, context: ExecutionContext) => unknown,
      ) => {
        const calls: { input: unknown; context: ExecutionContext }[] = [];
        const handler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(
            async (
              input: unknown,
              _config: unknown,
              context: ExecutionContext,
            ) => {
              calls.push({ input, context });
              return mockOutput(output(input, context));
            },
          ) as NodeHandler['execute'],
        };
        handlerRegistry.register(type, handler);
        return calls;
      };
      const runGraph = async (
        nodes: Partial<Node>[],
        edges: Partial<Edge>[],
      ) => {
        mockNodeRepo.findBy.mockResolvedValue(nodes);
        mockEdgeRepo.findBy.mockResolvedValue(edges);
        await service.execute(workflowId, {}, { workspaceId: 'ws-1' });
        await flushPromises();
      };
      const backgroundQueueAdd = () =>
        (service as unknown as { backgroundQueue: { add: jest.Mock } })
          .backgroundQueue.add;

      it('ForEach 본문 안 ForEach 가 바깥 회차마다 자기 본문을 항목 수만큼 실행하고 완료 출력을 다음 본문 노드에 넘긴다', async () => {
        recordingHandler('test_node', () => ({
          groups: [{ list: [1, 2] }, { list: [3] }],
        }));
        const leafCalls = recordingHandler('leaf_node', (input, ctx) => ({
          value: input,
          outerIndex: ctx.itemContext?.index,
        }));
        const collectCalls = recordingHandler('collect_node', (input) => ({
          inner: input,
        }));
        const sinkCalls = recordingHandler('sink_node', (input) => input);

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('outer', 'foreach', null, { arrayField: 'groups' }),
            cNode('inner', 'foreach', 'outer', { arrayField: 'list' }),
            cNode('leaf', 'leaf_node', 'inner'),
            cNode('collect', 'collect_node', 'outer'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'outer'),
            cEdge('outer', 'body', 'inner'),
            cEdge('inner', 'body', 'leaf'),
            cEdge('leaf', 'out', 'inner', 'emit'),
            cEdge('inner', 'done', 'collect'),
            cEdge('collect', 'out', 'outer', 'emit'),
            cEdge('outer', 'done', 'sink'),
          ],
        );

        // 안쪽 본문은 바깥 회차마다 그 회차 항목의 `list` 길이만큼 돈다.
        expect(leafCalls.map((c) => c.input)).toEqual([1, 2, 3]);
        // 안쪽 본문 노드는 안쪽 ForEach 의 반복 변수를 본다(가림 규칙).
        expect(leafCalls.map((c) => c.context.itemContext?.index)).toEqual([
          0, 1, 0,
        ]);
        // `done` 뒤 본문 노드는 안쪽 ForEach 의 완료 출력을 받는다.
        expect(collectCalls.map((c) => c.input)).toEqual([
          {
            items: [
              { value: 1, outerIndex: 0 },
              { value: 2, outerIndex: 1 },
            ],
            count: 2,
          },
          { items: [{ value: 3, outerIndex: 0 }], count: 1 },
        ]);
        expect(sinkCalls).toHaveLength(1);
        expect(sinkCalls[0].input).toEqual({
          items: [
            {
              inner: {
                items: [
                  { value: 1, outerIndex: 0 },
                  { value: 2, outerIndex: 1 },
                ],
                count: 2,
              },
            },
            { inner: { items: [{ value: 3, outerIndex: 0 }], count: 1 } },
          ],
          count: 2,
        });
      });

      it('ForEach 본문 안 Loop 가 회차마다 count 만큼 본문을 실행하고 본문 노드가 바깥 $item 과 안쪽 $loop 를 함께 본다', async () => {
        recordingHandler('test_node', () => ({ items: ['a', 'b'] }));
        const tickCalls = recordingHandler('tick_node', (_input, ctx) => ({
          item: ctx.itemContext?.item,
          loopIndex: ctx.loopContext?.index,
        }));
        const sinkCalls = recordingHandler('sink_node', (input) => input);

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('fe', 'foreach', null, { arrayField: 'items' }),
            cNode('lp', 'loop', 'fe', { count: 2 }),
            cNode('tick', 'tick_node', 'lp'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'fe'),
            cEdge('fe', 'body', 'lp'),
            cEdge('lp', 'body', 'tick'),
            cEdge('tick', 'out', 'lp', 'emit'),
            cEdge('lp', 'out', 'fe', 'emit'),
            cEdge('fe', 'done', 'sink'),
          ],
        );

        expect(
          tickCalls.map((c) => [
            c.context.itemContext?.item,
            c.context.loopContext?.index,
          ]),
        ).toEqual([
          ['a', 0],
          ['a', 1],
          ['b', 0],
          ['b', 1],
        ]);
        expect(sinkCalls).toHaveLength(1);
        expect(sinkCalls[0].input).toEqual({
          items: [
            {
              iterations: [
                { item: 'a', loopIndex: 0 },
                { item: 'a', loopIndex: 1 },
              ],
              count: 2,
            },
            {
              iterations: [
                { item: 'b', loopIndex: 0 },
                { item: 'b', loopIndex: 1 },
              ],
              count: 2,
            },
          ],
          count: 2,
        });
      });

      it('ForEach 본문 안 Background 가 회차마다 본문을 큐에 넣고 본문 노드는 회차 루프에서 실행하지 않는다', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        recordingHandler('test_node', () => ({ items: [{ n: 1 }, { n: 2 }] }));
        // Background 앞에 노드를 하나 두어 회차 입력과 Background 의 입력을 가른다.
        recordingHandler('pre_node', (input) => ({ pre: input }));
        const afterCalls = recordingHandler('after_node', (input) => input);
        const bgBodyCalls = recordingHandler('bg_body_node', (input) => input);
        recordingHandler('sink_node', (input) => input);
        backgroundQueueAdd().mockClear();

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('fe', 'foreach', null, { arrayField: 'items' }),
            cNode('pre', 'pre_node', 'fe'),
            cNode('bg', 'background', 'fe'),
            cNode('after', 'after_node', 'fe'),
            // 에디터의 소속 전파(연결선 체인 규칙)가 Background 뒤 노드에도 같은
            // 컨테이너 소속을 준다.
            cNode('bgBody', 'bg_body_node', 'fe'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'fe'),
            cEdge('fe', 'body', 'pre'),
            cEdge('pre', 'out', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
            cEdge('after', 'out', 'fe', 'emit'),
            cEdge('fe', 'done', 'sink'),
          ],
        );

        // 본문은 큐로만 간다(워커가 실행한다).
        expect(bgBodyCalls).toHaveLength(0);
        expect(afterCalls.map((c) => c.input)).toEqual([
          { pre: { n: 1 } },
          { pre: { n: 2 } },
        ]);
        const jobs = backgroundQueueAdd().mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(jobs).toHaveLength(2);
        expect(jobs.map((job) => job.bodyEntryNodeIds)).toEqual([
          ['bgBody'],
          ['bgBody'],
        ]);
        // 본문 진입 입력은 Background 노드가 그 회차에 받은 입력이다
        // (CLE-NODE-BACKGROUND 의 진입 입력 표). 회차 입력({ n })이 아니다.
        expect(jobs.map((job) => job.input)).toEqual([
          { pre: { n: 1 } },
          { pre: { n: 2 } },
        ]);
        // 워커가 Background 와 같은 컨테이너 단계의 노드로 본문을 실행하도록
        // 컨테이너 ID 를 싣는다.
        expect(jobs.map((job) => job.containerScopeId)).toEqual(['fe', 'fe']);
      });

      // 질문 01a1cd70 답 A — 스냅샷에 큐에 넣은 회차의 반복 변수를 함께 싣는다.
      // 병렬 분기가 바깥 반복 변수를 이어받는 규칙(REQ-PARALLEL-009)과 같다.
      it('ForEach 본문 안 Background 는 큐에 넣은 회차의 반복 변수($item)를 작업 스냅샷에 싣는다', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        recordingHandler('test_node', () => ({ items: ['a', 'b'] }));
        recordingHandler('after_node', (input) => input);
        recordingHandler('bg_body_node', (input) => input);
        backgroundQueueAdd().mockClear();

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('fe', 'foreach', null, { arrayField: 'items' }),
            cNode('bg', 'background', 'fe'),
            cNode('after', 'after_node', 'fe'),
            cNode('bgBody', 'bg_body_node', 'fe'),
          ],
          [
            cEdge('src', 'out', 'fe'),
            cEdge('fe', 'body', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
            cEdge('after', 'out', 'fe', 'emit'),
          ],
        );

        const jobs = backgroundQueueAdd().mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(jobs.map((job) => job.itemContext)).toEqual([
          { item: 'a', index: 0, isFirst: true, isLast: false },
          { item: 'b', index: 1, isFirst: false, isLast: true },
        ]);
        // Loop 밖이라 $loop 는 싣지 않는다.
        expect(jobs.every((job) => !('loopContext' in job))).toBe(true);
      });

      // CLE-T-Y2F1NG — dry-run 실행의 Background 본문도 dry-run 으로 돈다. 큐 작업
      // 스냅샷이 `context.variables` 를 통째로 복사하므로 `__dryRun` 이 실린다. 이 연결이
      // 끊기면 본문 안 부수효과 노드가 dry-run 실행에서 실제로 돈다.
      it.each([
        ['true', true],
        ['false', false],
      ])(
        'dry-run=%s 실행의 Background 는 작업 스냅샷 variables 에 같은 __dryRun 을 싣는다',
        async (_label, dryRun) => {
          handlerRegistry.register('background', new BackgroundHandler(), {
            kind: 'background',
          });
          recordingHandler('test_node', () => ({ v: 1 }));
          recordingHandler('after_node', (input) => input);
          recordingHandler('bg_body_node', (input) => input);
          backgroundQueueAdd().mockClear();
          // 기본 create mock 은 입력과 무관한 고정 row 를 돌려준다. dryRun 이 row 에
          // 실려야 runExecution 이 그 값을 `__dryRun` 으로 읽는다.
          const base = mockExecutionRepo.create() as Partial<Execution>;
          mockExecutionRepo.create.mockImplementationOnce(
            (entity: Partial<Execution>) => ({ ...base, ...entity }),
          );
          mockNodeRepo.findBy.mockResolvedValue([
            cNode('src', 'test_node', null),
            cNode('bg', 'background', null),
            cNode('after', 'after_node', null),
            cNode('bgBody', 'bg_body_node', null),
          ]);
          mockEdgeRepo.findBy.mockResolvedValue([
            cEdge('src', 'out', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
          ]);

          await service.execute(
            workflowId,
            {},
            { workspaceId: 'ws-1', dryRun },
          );
          await flushPromises();

          const jobs = backgroundQueueAdd().mock.calls.map(
            (call: unknown[]) => call[1] as BackgroundExecutionJob,
          );
          expect(jobs).toHaveLength(1);
          expect(jobs[0].variables['__dryRun']).toBe(dryRun);
        },
      );

      it('ForEach 본문 안 Loop 본문의 Background 는 바깥 $item 과 안쪽 $loop 를 함께 싣는다', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        recordingHandler('test_node', () => ({ items: ['a', 'b'] }));
        recordingHandler('after_node', (input) => input);
        recordingHandler('bg_body_node', (input) => input);
        backgroundQueueAdd().mockClear();

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('fe', 'foreach', null, { arrayField: 'items' }),
            cNode('lp', 'loop', 'fe', { count: 2 }),
            cNode('bg', 'background', 'lp'),
            cNode('after', 'after_node', 'lp'),
            cNode('bgBody', 'bg_body_node', 'lp'),
          ],
          [
            cEdge('src', 'out', 'fe'),
            cEdge('fe', 'body', 'lp'),
            cEdge('lp', 'body', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
            cEdge('after', 'out', 'lp', 'emit'),
            cEdge('lp', 'out', 'fe', 'emit'),
          ],
        );

        const jobs = backgroundQueueAdd().mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(
          jobs.map((job) => [
            job.containerScopeId,
            job.itemContext?.item,
            job.loopContext?.index,
          ]),
        ).toEqual([
          ['lp', 'a', 0],
          ['lp', 'a', 1],
          ['lp', 'b', 0],
          ['lp', 'b', 1],
        ]);
        expect(jobs[3].loopContext).toEqual({
          index: 1,
          count: 2,
          isFirst: false,
          isLast: true,
        });
      });

      it('Map 본문 안 Background 도 회차마다 본문을 큐에 넣고 작업에 Map 의 컨테이너 ID 와 그 회차의 반복 변수를 싣는다 (REQ-BGRUN-027 · 028)', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        handlerRegistry.register('map', new MapHandler(), {
          kind: 'container',
        });
        recordingHandler('test_node', () => ({ list: [10, 20] }));
        recordingHandler('after_node', (input) => input);
        const bgBodyCalls = recordingHandler('bg_body_node', (input) => input);
        backgroundQueueAdd().mockClear();

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('mp', 'map', null, { inputField: 'list' }),
            cNode('bg', 'background', 'mp'),
            cNode('after', 'after_node', 'mp'),
            cNode('bgBody', 'bg_body_node', 'mp'),
          ],
          [
            cEdge('src', 'out', 'mp'),
            cEdge('mp', 'body', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
            cEdge('after', 'out', 'mp', 'emit'),
          ],
        );

        // 본문은 큐로만 간다(워커가 실행한다).
        expect(bgBodyCalls).toHaveLength(0);
        const jobs = backgroundQueueAdd().mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(
          jobs.map((job) => [
            job.containerScopeId,
            job.bodyEntryNodeIds,
            job.itemContext,
          ]),
        ).toEqual([
          [
            'mp',
            ['bgBody'],
            { item: 10, index: 0, isFirst: true, isLast: false },
          ],
          [
            'mp',
            ['bgBody'],
            { item: 20, index: 1, isFirst: false, isLast: true },
          ],
        ]);
      });

      it('맨 바깥 Background 작업에는 반복 변수 필드를 싣지 않는다', async () => {
        handlerRegistry.register('background', new BackgroundHandler(), {
          kind: 'background',
        });
        recordingHandler('test_node', () => ({}));
        recordingHandler('after_node', (input) => input);
        recordingHandler('bg_body_node', (input) => input);
        backgroundQueueAdd().mockClear();

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('bg', 'background', null),
            cNode('after', 'after_node', null),
            cNode('bgBody', 'bg_body_node', null),
          ],
          [
            cEdge('src', 'out', 'bg'),
            cEdge('bg', 'main', 'after'),
            cEdge('bg', 'background', 'bgBody'),
          ],
        );

        const jobs = backgroundQueueAdd().mock.calls.map(
          (call: unknown[]) => call[1] as BackgroundExecutionJob,
        );
        expect(jobs).toHaveLength(1);
        expect(jobs[0]).not.toHaveProperty('itemContext');
        expect(jobs[0]).not.toHaveProperty('loopContext');
      });

      it('ForEach 본문 안 Map 이 회차마다 결과 배열을 만들어 done 뒤 본문 노드에 넘긴다', async () => {
        handlerRegistry.register('map', new MapHandler(), {
          kind: 'container',
        });
        recordingHandler('test_node', () => ({
          groups: [{ list: [1, 2] }, { list: [3] }],
        }));
        recordingHandler('leaf_node', (input) => ({ v: input }));
        const collectCalls = recordingHandler('collect_node', (input) => input);
        recordingHandler('sink_node', (input) => input);

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('outer', 'foreach', null, { arrayField: 'groups' }),
            cNode('inner', 'map', 'outer', { inputField: 'list' }),
            cNode('leaf', 'leaf_node', 'inner'),
            cNode('collect', 'collect_node', 'outer'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'outer'),
            cEdge('outer', 'body', 'inner'),
            cEdge('inner', 'body', 'leaf'),
            cEdge('leaf', 'out', 'inner', 'emit'),
            cEdge('inner', 'done', 'collect'),
            cEdge('collect', 'out', 'outer', 'emit'),
            cEdge('outer', 'done', 'sink'),
          ],
        );

        // Map 의 완료 출력은 `{ mapped, count }` 이다.
        expect(collectCalls.map((c) => c.input)).toEqual([
          { mapped: [{ v: 1 }, { v: 2 }], count: 2 },
          { mapped: [{ v: 3 }], count: 1 },
        ]);
      });

      it('안쪽 컨테이너 입력 배열이 비면 본문은 0회 실행하고 done 뒤 노드는 빈 완료 출력으로 실행한다', async () => {
        recordingHandler('test_node', () => ({
          groups: [{ list: [] }, { list: [7] }],
        }));
        const leafCalls = recordingHandler('leaf_node', (input) => input);
        const collectCalls = recordingHandler('collect_node', (input) => input);
        recordingHandler('sink_node', (input) => input);

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('outer', 'foreach', null, { arrayField: 'groups' }),
            cNode('inner', 'foreach', 'outer', { arrayField: 'list' }),
            cNode('leaf', 'leaf_node', 'inner'),
            cNode('collect', 'collect_node', 'outer'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'outer'),
            cEdge('outer', 'body', 'inner'),
            cEdge('inner', 'body', 'leaf'),
            cEdge('leaf', 'out', 'inner', 'emit'),
            cEdge('inner', 'done', 'collect'),
            cEdge('collect', 'out', 'outer', 'emit'),
            cEdge('outer', 'done', 'sink'),
          ],
        );

        expect(leafCalls.map((c) => c.input)).toEqual([7]);
        expect(collectCalls.map((c) => c.input)).toEqual([
          { items: [], count: 0 },
          { items: [7], count: 1 },
        ]);
      });

      it('안쪽 컨테이너 본문 노드가 실패하면 done 뒤 노드와 바깥 done 뒤 노드를 실행하지 않고 실행을 실패로 마감한다', async () => {
        recordingHandler('test_node', () => ({
          groups: [{ list: [1] }, { list: [2] }],
        }));
        const failHandler: NodeHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => {
            throw new Error('inner body boom');
          }) as NodeHandler['execute'],
        };
        handlerRegistry.register('fail_node', failHandler);
        const collectCalls = recordingHandler('collect_node', (input) => input);
        const sinkCalls = recordingHandler('sink_node', (input) => input);

        await runGraph(
          [
            cNode('src', 'test_node', null),
            cNode('outer', 'foreach', null, { arrayField: 'groups' }),
            cNode('inner', 'foreach', 'outer', { arrayField: 'list' }),
            cNode('leaf', 'fail_node', 'inner'),
            cNode('collect', 'collect_node', 'outer'),
            cNode('sink', 'sink_node', null),
          ],
          [
            cEdge('src', 'out', 'outer'),
            cEdge('outer', 'body', 'inner'),
            cEdge('inner', 'body', 'leaf'),
            cEdge('leaf', 'out', 'inner', 'emit'),
            cEdge('inner', 'done', 'collect'),
            cEdge('collect', 'out', 'outer', 'emit'),
            cEdge('outer', 'done', 'sink'),
          ],
        );

        expect(failHandler.execute).toHaveBeenCalledTimes(1);
        expect(collectCalls).toHaveLength(0);
        expect(sinkCalls).toHaveLength(0);
        expect(mockExecutionRepo.query).toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE execution/),
          expect.arrayContaining([ExecutionStatus.FAILED]),
        );
        expect(mockExecutionRepo.query).not.toHaveBeenCalledWith(
          expect.stringMatching(/UPDATE execution/),
          expect.arrayContaining([ExecutionStatus.COMPLETED]),
        );
        // 실패 원인이 안쪽 본문 노드의 오류이고, 그 메시지가 execution.error 로 저장된다.
        const failedUpdate = findExecutionStatusUpdate(
          mockExecutionRepo.query.mock.calls,
          ExecutionStatus.FAILED,
        );
        expect(failedUpdate).toBeDefined();
        expect(failedUpdate!.error).toEqual(
          expect.stringContaining('inner body boom'),
        );
      });

      // 워커 쪽: 큐에서 꺼낸 작업을 실제 executeInline 으로 돌린다.
      const bgWorkerJob = (
        over: Partial<BackgroundExecutionJob> = {},
      ): BackgroundExecutionJob => ({
        executionId,
        parentNodeExecutionId: 'bg-row-1',
        backgroundRunId: 'bg-run-mr6zh3',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['bgBody'],
        input: { n: 1 },
        variables: { __workspaceId: 'ws-1' },
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
        config: { notifyOnFailure: false, maxDurationMs: 0 },
        ...over,
      });

      it('워커는 containerScopeId 가 가리키는 컨테이너의 본문 노드로 그래프를 만들어 Background 본문을 끝까지 실행한다', async () => {
        const bgBodyCalls = recordingHandler('bg_body_node', (input) => ({
          step1: input,
        }));
        const bgTailCalls = recordingHandler('bg_tail_node', (input) => input);
        const afterCalls = recordingHandler('after_node', (input) => input);
        const srcCalls = recordingHandler('test_node', () => ({}));
        mockNodeRepo.findBy.mockResolvedValue([
          cNode('src', 'test_node', null),
          cNode('fe', 'foreach', null, { arrayField: 'items' }),
          cNode('bg', 'background', 'fe'),
          cNode('after', 'after_node', 'fe'),
          cNode('bgBody', 'bg_body_node', 'fe'),
          cNode('bgTail', 'bg_tail_node', 'fe'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          cEdge('src', 'out', 'fe'),
          cEdge('fe', 'body', 'bg'),
          cEdge('bg', 'main', 'after'),
          cEdge('bg', 'background', 'bgBody'),
          cEdge('bgBody', 'out', 'bgTail'),
          cEdge('after', 'out', 'fe', 'emit'),
        ]);

        await service.executeBackgroundSubgraph(
          bgWorkerJob({ containerScopeId: 'fe' }),
        );

        expect(bgBodyCalls.map((c) => c.input)).toEqual([{ n: 1 }]);
        expect(bgTailCalls.map((c) => c.input)).toEqual([{ step1: { n: 1 } }]);
        // 진입점에서 닿지 않는 같은 단계 노드와 바깥 노드는 실행하지 않는다.
        expect(afterCalls).toHaveLength(0);
        expect(srcCalls).toHaveLength(0);
      });

      it('containerScopeId 가 없는 작업(맨 바깥 Background · 옛 작업)은 맨 바깥 그래프로 본문을 실행한다', async () => {
        const bgBodyCalls = recordingHandler('bg_body_node', (input) => input);
        const scopedCalls = recordingHandler('scoped_node', (input) => input);
        mockNodeRepo.findBy.mockResolvedValue([
          cNode('bg', 'background', null),
          cNode('bgBody', 'bg_body_node', null),
          // 다른 컨테이너 소속 노드는 진입점으로 지정돼도 맨 바깥 그래프에 없다.
          cNode('scoped', 'scoped_node', 'fe'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          cEdge('bg', 'background', 'bgBody'),
        ]);

        await service.executeBackgroundSubgraph(
          bgWorkerJob({ bodyEntryNodeIds: ['bgBody', 'scoped'] }),
        );

        expect(bgBodyCalls.map((c) => c.input)).toEqual([{ n: 1 }]);
        expect(scopedCalls).toHaveLength(0);
      });

      it('워커에 없는 컨테이너를 가리키는 containerScopeId 가 오면 그래프가 비어 본문을 실행하지 않고 오류 없이 끝난다', async () => {
        const bgBodyCalls = recordingHandler('bg_body_node', (input) => input);
        mockNodeRepo.findBy.mockResolvedValue([
          cNode('fe', 'foreach', null, { arrayField: 'items' }),
          cNode('bg', 'background', 'fe'),
          cNode('bgBody', 'bg_body_node', 'fe'),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          cEdge('bg', 'background', 'bgBody'),
        ]);

        await expect(
          service.executeBackgroundSubgraph(
            bgWorkerJob({ containerScopeId: 'deleted-container' }),
          ),
        ).resolves.toBeUndefined();

        expect(bgBodyCalls).toHaveLength(0);
      });

      it('워커는 작업 스냅샷의 반복 변수를 본문 실행 컨텍스트에 되살려 본문 노드 식이 그 회차의 $item · $itemIndex · $itemIsFirst · $itemIsLast · $loop 를 읽는다 (REQ-BGRUN-028)', async () => {
        const bodyConfigs: unknown[] = [];
        const bodyCtx: ExecutionContext[] = [];
        handlerRegistry.register('bg_expr_node', {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(
            async (
              _input: unknown,
              config: unknown,
              context: ExecutionContext,
            ) => {
              bodyConfigs.push(config);
              bodyCtx.push(context);
              return mockOutput({});
            },
          ) as NodeHandler['execute'],
        });
        mockNodeRepo.findBy.mockResolvedValue([
          cNode('fe', 'foreach', null, { arrayField: 'items' }),
          cNode('bg', 'background', 'fe'),
          cNode('bgBody', 'bg_expr_node', 'fe', {
            item: '{{ $item.n }}',
            itemIndex: '{{ $itemIndex }}',
            itemIsFirst: '{{ $itemIsFirst }}',
            itemIsLast: '{{ $itemIsLast }}',
            loopIndex: '{{ $loop.index }}',
          }),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          cEdge('bg', 'background', 'bgBody'),
        ]);

        await service.executeBackgroundSubgraph(
          bgWorkerJob({
            containerScopeId: 'fe',
            itemContext: {
              item: { n: 7 },
              index: 1,
              isFirst: false,
              isLast: true,
            },
            loopContext: { index: 2, count: 3, isFirst: false, isLast: true },
          }),
        );

        expect(bodyCtx).toHaveLength(1);
        expect(bodyCtx[0].itemContext).toEqual({
          item: { n: 7 },
          index: 1,
          isFirst: false,
          isLast: true,
        });
        expect(bodyCtx[0].loopContext).toEqual({
          index: 2,
          count: 3,
          isFirst: false,
          isLast: true,
        });
        expect(bodyConfigs[0]).toEqual({
          item: 7,
          itemIndex: 1,
          itemIsFirst: false,
          itemIsLast: true,
          loopIndex: 2,
        });
      });

      it('반복 변수가 없는 작업(맨 바깥 Background · 옛 작업)은 본문에서 반복 변수가 비어 있다', async () => {
        const bodyCtx: ExecutionContext[] = [];
        recordingHandler('bg_body_node', (_input, ctx) => {
          bodyCtx.push(ctx);
          return {};
        });
        mockNodeRepo.findBy.mockResolvedValue([
          cNode('bg', 'background', null),
          cNode('bgBody', 'bg_body_node', null),
        ]);
        mockEdgeRepo.findBy.mockResolvedValue([
          cEdge('bg', 'background', 'bgBody'),
        ]);

        await service.executeBackgroundSubgraph(bgWorkerJob());

        expect(bodyCtx).toHaveLength(1);
        expect(bodyCtx[0].itemContext).toBeUndefined();
        expect(bodyCtx[0].loopContext).toBeUndefined();
      });

      // CLE-T-TDAV1G — 질문 01a1cef7 답 A. 맨 바깥 실행 · 서브 워크플로우(`executeInline`)도
      // 컨테이너 본문 루프처럼 Background 노드가 받은 입력으로 본문을 큐에 넣는다
      // (CLE-NODE-BACKGROUND 의 진입 입력 표). 재개 경로는 「Form node blocking」, 병렬 분기
      // 루프는 「done 포트 완료 출력」 describe 에 있다.
      describe('Background 본문 진입 입력 (CLE-T-TDAV1G)', () => {
        const preOutput = { marker: 'pre-output' };
        const triggerOutput = { marker: 'trigger-output' };
        // src → pre → bg, bg.main → after, bg.background → bgBody. 앞 노드 pre 를 두어
        // 실행 범위의 입력과 Background 노드의 입력을 가른다.
        const backgroundAfterPre = () => {
          handlerRegistry.register('background', new BackgroundHandler(), {
            kind: 'background',
          });
          recordingHandler('test_node', () => triggerOutput);
          recordingHandler('pre_node', () => preOutput);
          recordingHandler('after_node', (input) => input);
          recordingHandler('bg_body_node', (input) => input);
          backgroundQueueAdd().mockClear();
          return {
            nodes: [
              cNode('src', 'test_node', null),
              cNode('pre', 'pre_node', null),
              cNode('bg', 'background', null),
              cNode('after', 'after_node', null),
              cNode('bgBody', 'bg_body_node', null),
            ],
            edges: [
              cEdge('src', 'out', 'pre'),
              cEdge('pre', 'out', 'bg'),
              cEdge('bg', 'main', 'after'),
              cEdge('bg', 'background', 'bgBody'),
            ],
          };
        };
        const queuedInputs = () =>
          backgroundQueueAdd().mock.calls.map(
            (call: unknown[]) => (call[1] as BackgroundExecutionJob).input,
          );

        it('맨 바깥 실행은 실행 입력이 아니라 Background 노드가 받은 입력(앞 노드 출력)으로 본문을 큐에 넣는다', async () => {
          const g = backgroundAfterPre();

          await runGraph(g.nodes, g.edges);

          expect(queuedInputs()).toEqual([preOutput]);
        });

        it('트리거 바로 뒤 Background 는 트리거 출력으로 본문을 큐에 넣는다', async () => {
          const g = backgroundAfterPre();

          await runGraph(
            g.nodes.filter((node) => node.id !== 'pre'),
            [
              cEdge('src', 'out', 'bg'),
              ...g.edges.filter((edge) => edge.sourceNodeId === 'bg'),
            ],
          );

          expect(queuedInputs()).toEqual([triggerOutput]);
        });

        it('서브 워크플로우 인라인 실행(executeInline)도 그 실행의 입력이 아니라 Background 노드가 받은 입력으로 본문을 큐에 넣는다', async () => {
          const g = backgroundAfterPre();
          // 서브 워크플로우 진입점은 manual_trigger 만 허용되므로 트리거를 빼고 pre 가
          // 그 실행의 입력을 받는 진입 노드가 된다.
          mockNodeRepo.findBy.mockResolvedValue(
            g.nodes.filter((node) => node.id !== 'src'),
          );
          mockEdgeRepo.findBy.mockResolvedValue(
            g.edges.filter((edge) => edge.sourceNodeId !== 'src'),
          );
          const contextService = (
            service as unknown as { contextService: ExecutionContextService }
          ).contextService;

          await service.executeInline(
            workflowId,
            { marker: 'inline-input' },
            {
              executionId,
              context: withWorkspace(
                contextService.createContext(executionId, workflowId),
              ),
              executedNodes: new Set<string>(),
              recursionDepth: 1,
            },
          );
          await flushPromises();

          expect(queuedInputs()).toEqual([preOutput]);
        });
      });

      // CLE-T-6V9957 — 핸들러는 큐를 몰라 `meta.jobId` 를 내지 않는다. 엔진이 큐에 넣은 뒤
      // `add()` 가 돌려준 작업 ID 를 이미 COMPLETED 인 행의 `output_data.meta.jobId` 와
      // 구조화 출력 캐시의 `meta` 에 넣는다. 큐 넣기나 스탬프가 실패해도 메인 흐름은 이어진다.
      describe('Background 큐 작업 ID 스탬프 (CLE-T-6V9957)', () => {
        const nodeExecutionQuery = () => {
          const query = jest.fn().mockResolvedValue([]);
          mockNodeExecutionRepo.query = query;
          return query;
        };
        // bg 뒤 after 노드가 실행될 때 본 bg 의 구조화 출력 meta 를 남긴다.
        const runBackgroundGraph = async () => {
          handlerRegistry.register('background', new BackgroundHandler(), {
            kind: 'background',
          });
          recordingHandler('test_node', () => ({ marker: 'trigger-output' }));
          const seenMeta: Record<string, unknown>[] = [];
          const afterCalls = recordingHandler('after_node', (input, ctx) => {
            seenMeta.push({ ...(ctx.structuredOutputCache.bg?.meta ?? {}) });
            return input;
          });
          recordingHandler('bg_body_node', (input) => input);
          await runGraph(
            [
              cNode('src', 'test_node', null),
              cNode('bg', 'background', null),
              cNode('after', 'after_node', null),
              cNode('bgBody', 'bg_body_node', null),
            ],
            [
              cEdge('src', 'out', 'bg'),
              cEdge('bg', 'main', 'after'),
              cEdge('bg', 'background', 'bgBody'),
            ],
          );
          return { afterCalls, seenMeta };
        };
        const stampCalls = (query: jest.Mock) =>
          query.mock.calls.filter(
            (call: unknown[]) =>
              typeof call[0] === 'string' &&
              call[0].includes('UPDATE node_execution'),
          );

        beforeEach(() => {
          backgroundQueueAdd().mockClear();
        });

        it('add() 가 돌려준 작업 ID 를 COMPLETED 행의 output_data.meta.jobId 와 구조화 출력 meta 에 넣는다', async () => {
          const query = nodeExecutionQuery();
          backgroundQueueAdd().mockResolvedValueOnce({ id: 'job-7' });

          const { afterCalls, seenMeta } = await runBackgroundGraph();

          expect(backgroundQueueAdd()).toHaveBeenCalledTimes(1);
          const calls = stampCalls(query);
          expect(calls).toHaveLength(1);
          const [sql, params] = calls[0] as [string, unknown[]];
          // 완료된 행만 바꾸고 meta 의 다른 키는 그대로 둔다.
          expect(sql).toContain('jsonb_set');
          expect(sql).toContain("jsonb_build_object('jobId'");
          expect(params).toEqual([
            'ne-bg',
            'job-7',
            NodeExecutionStatus.COMPLETED,
          ]);
          // 뒤 노드의 `$node["bg"].meta` 에도 보인다. 핸들러가 낸 meta 는 그대로다.
          expect(afterCalls).toHaveLength(1);
          expect(seenMeta).toEqual([
            expect.objectContaining({
              jobId: 'job-7',
              backgroundRunId: expect.any(String),
              forkedAt: expect.any(String),
            }),
          ]);
          // 큐에 넣은 스냅샷은 스탬프 전에 만들어 작업 ID 가 없다.
          const job = backgroundQueueAdd().mock
            .calls[0][1] as BackgroundExecutionJob;
          expect(job.structuredOutputCache?.bg?.meta).not.toHaveProperty(
            'jobId',
          );
        });

        it('add() 가 작업 ID 를 돌려주지 않으면 스탬프하지 않는다', async () => {
          const query = nodeExecutionQuery();
          backgroundQueueAdd().mockResolvedValueOnce(undefined);

          const { afterCalls, seenMeta } = await runBackgroundGraph();

          expect(stampCalls(query)).toHaveLength(0);
          expect(afterCalls).toHaveLength(1);
          expect(seenMeta[0]).not.toHaveProperty('jobId');
        });

        it('스탬프 UPDATE 가 실패해도 메인 흐름은 다음 노드로 이어지고 캐시 meta 에는 작업 ID 가 남는다', async () => {
          const query = nodeExecutionQuery();
          query.mockRejectedValue(new Error('db down'));
          backgroundQueueAdd().mockResolvedValueOnce({ id: 'job-8' });

          const { afterCalls, seenMeta } = await runBackgroundGraph();

          expect(stampCalls(query)).toHaveLength(1);
          expect(afterCalls).toHaveLength(1);
          expect(seenMeta[0]).toEqual(
            expect.objectContaining({ jobId: 'job-8' }),
          );
        });

        it('큐 넣기가 실패해도 메인 흐름은 다음 노드로 이어지고 스탬프하지 않는다', async () => {
          const query = nodeExecutionQuery();
          backgroundQueueAdd().mockRejectedValueOnce(new Error('redis down'));

          const { afterCalls, seenMeta } = await runBackgroundGraph();

          expect(backgroundQueueAdd()).toHaveBeenCalledTimes(1);
          expect(stampCalls(query)).toHaveLength(0);
          expect(afterCalls).toHaveLength(1);
          expect(seenMeta[0]).not.toHaveProperty('jobId');
        });

        // Background 노드는 병렬 분기 안에도 놓일 수 있다. 그때 `context` 는 분기 사본이라
        // 등록된 루트 컨텍스트의 캐시와 다른 객체다. 두 캐시의 `meta.jobId` 가 같아야 분기
        // 안 뒤 노드와 분기 뒤 노드가 같은 값을 본다.
        it('병렬 분기 사본 컨텍스트면 등록된 루트 컨텍스트의 구조화 출력 meta 에도 작업 ID 를 넣는다', () => {
          const ctxService = (
            service as unknown as { contextService: ExecutionContextService }
          ).contextService;
          const root = ctxService.createContext('exec-branch', 'wf-branch');
          try {
            root.structuredOutputCache.bg = {
              config: {},
              output: { k: 1 },
              meta: { forkedAt: 'x' },
            };
            const branchCopy = {
              ...root,
              structuredOutputCache: { ...root.structuredOutputCache },
            };

            (
              service as unknown as {
                stampStructuredMetaJobId: (
                  c: unknown,
                  nodeId: string,
                  jobId: string,
                ) => void;
              }
            ).stampStructuredMetaJobId(branchCopy, 'bg', 'job-p');

            expect(branchCopy.structuredOutputCache.bg.meta).toEqual({
              forkedAt: 'x',
              jobId: 'job-p',
            });
            expect(root.structuredOutputCache.bg.meta).toEqual({
              forkedAt: 'x',
              jobId: 'job-p',
            });
            expect(root.structuredOutputCache.bg.output).toEqual({ k: 1 });
          } finally {
            ctxService.deleteContext('exec-branch');
          }
        });
      });
    });

    // CLE-T-JXD0W5 — 컨테이너는 본문을 다 돈 뒤 출력을 완료 출력으로 덮어쓴다. 노드 실행 행과
    // `execution.node.completed` 도 그 완료 출력 · 노드 전체 실행 시간으로 한 번만 남아야
    // 재개 · 재구동의 rehydration 과 실행 이력이 시작 시점 값을 보지 않는다.
    describe('엔진 덮어쓰기 완료 기록 (CLE-T-JXD0W5)', () => {
      type SavedRow = Partial<NodeExecution>;
      let savedRows: SavedRow[];
      let bodyDoneAt: number;

      beforeEach(() => {
        savedRows = [];
        bodyDoneAt = 0;
        // save 는 같은 엔티티를 고쳐 다시 저장하므로 호출 시점 값을 복사해 둔다.
        mockNodeExecutionRepo.save.mockImplementation(
          (entity: Partial<NodeExecution>) => {
            savedRows.push({ ...entity });
            return Promise.resolve(entity);
          },
        );
      });

      const rowsOf = (nodeId: string, status?: NodeExecutionStatus) =>
        savedRows.filter(
          (r) => r.nodeId === nodeId && (!status || r.status === status),
        );
      const nodeEventsOf = (nodeId: string, eventType: string) =>
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (c) => c[1] === nodeId && c[2] === eventType,
        );
      const lastEventIndex = (nodeId: string, eventType: string) =>
        mockWebsocketService.emitNodeEvent.mock.calls.reduce(
          (acc: number, c, i) =>
            c[1] === nodeId && c[2] === eventType ? i : acc,
          -1,
        );

      const registerBody = (
        type: string,
        execute: (input: unknown) => Promise<unknown>,
      ) => {
        handlerRegistry.register(type, {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(execute),
        } as NodeHandler);
      };

      // 시계는 Date 만 가짜로 돌린다(setImmediate · 마이크로태스크는 그대로라 flushPromises 가
      // 동작한다). 본문 노드가 시계를 1초씩 밀어서 컨테이너 행의 끝 시각이 본문 뒤인지를
      // 실제 시간과 무관하게 정확한 값으로 가른다.
      const CLOCK_START = Date.UTC(2026, 10, 15, 0, 0, 0);
      const BODY_STEP_MS = 1000;
      beforeEach(() => {
        jest.useFakeTimers({
          now: CLOCK_START,
          doNotFake: [
            'hrtime',
            'nextTick',
            'performance',
            'queueMicrotask',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'requestIdleCallback',
            'cancelIdleCallback',
            'setImmediate',
            'clearImmediate',
            'setInterval',
            'clearInterval',
            'setTimeout',
            'clearTimeout',
          ],
        });
      });
      afterEach(() => {
        jest.useRealTimers();
      });
      const busyBody = (input: unknown) => {
        jest.setSystemTime(Date.now() + BODY_STEP_MS);
        bodyDoneAt = Date.now();
        return Promise.resolve(mockOutput({ seen: input ?? null }));
      };

      const containerGraph = (
        containerType: 'foreach' | 'map' | 'loop',
        config: Record<string, unknown>,
        bodyType: string,
      ) => {
        const nodes: Partial<Node>[] = [
          {
            id: containerType,
            workflowId,
            type: containerType,
            category: NodeCategory.LOGIC,
            label: containerType,
            config,
            isDisabled: false,
            containerId: null,
            toolOwnerId: null,
          },
          {
            id: 'body',
            workflowId,
            type: bodyType,
            category: NodeCategory.LOGIC,
            label: 'body',
            config: {},
            isDisabled: false,
            containerId: containerType,
            toolOwnerId: null,
          },
        ];
        const edges: Partial<Edge>[] = [
          {
            id: 'e-c-body',
            workflowId,
            sourceNodeId: containerType,
            sourcePort: 'body',
            targetNodeId: 'body',
            targetPort: 'in',
            type: EdgeType.DATA,
          },
          {
            id: 'e-body-emit',
            workflowId,
            sourceNodeId: 'body',
            sourcePort: 'out',
            targetNodeId: containerType,
            targetPort: 'emit',
            type: EdgeType.DATA,
          },
        ];
        mockNodeRepo.findBy.mockResolvedValue(nodes);
        mockEdgeRepo.findBy.mockResolvedValue(edges);
      };

      it.each([
        {
          containerType: 'foreach' as const,
          config: { arrayField: 'items' },
          outputKey: 'items',
        },
        {
          containerType: 'map' as const,
          config: { inputField: 'items' },
          outputKey: 'mapped',
        },
        {
          containerType: 'loop' as const,
          config: { count: 3 },
          outputKey: 'iterations',
        },
      ])(
        '$containerType 행은 완료 출력 · 전체 실행 시간으로 COMPLETED 를 한 번 저장하고 completed 이벤트를 본문 뒤에 한 번 보낸다',
        async ({ containerType, config, outputKey }) => {
          const bodyType = `body_jxd0w5_${containerType}`;
          registerBody(bodyType, busyBody);
          containerGraph(containerType, config, bodyType);

          await service.execute(
            workflowId,
            { items: [1, 2, 3] },
            { workspaceId: 'ws-1' },
          );
          await flushPromises();
          await flushPromises();

          const completedRows = rowsOf(
            containerType,
            NodeExecutionStatus.COMPLETED,
          );
          expect(completedRows).toHaveLength(1);
          const row = completedRows[0];
          const output = (
            row.outputData as { output?: Record<string, unknown> }
          ).output;
          // 시작 시점 핸들러 출력(`[]` 시드)이 아니라 완료 출력 `{ <key>, count }` 다.
          expect(output?.count).toBe(3);
          expect(output?.[outputKey]).toHaveLength(3);
          expect(row.outputData).toEqual(
            expect.objectContaining({ config: expect.any(Object) }),
          );
          // 끝 시각 · 실행 시간은 본문이 끝난 뒤에 잰다. 시작 시점에 쟀다면 0 이다.
          expect(row.startedAt!.getTime()).toBe(CLOCK_START);
          expect(row.finishedAt!.getTime()).toBe(bodyDoneAt);
          expect(row.durationMs).toBe(bodyDoneAt - CLOCK_START);
          expect(row.durationMs).toBeGreaterThanOrEqual(BODY_STEP_MS);

          // completed 이벤트는 한 번, 마지막 본문 이벤트 뒤에 행과 같은 값으로 나간다.
          const completedEvents = nodeEventsOf(
            containerType,
            'execution.node.completed',
          );
          expect(completedEvents).toHaveLength(1);
          expect(
            lastEventIndex(containerType, 'execution.node.completed'),
          ).toBeGreaterThan(lastEventIndex('body', 'execution.node.completed'));
          expect(completedEvents[0][3]).toEqual(
            expect.objectContaining({
              status: NodeExecutionStatus.COMPLETED,
              output: row.outputData,
              duration: row.durationMs,
            }),
          );
        },
      );

      it('ForEach 행의 완료 출력을 rehydration 이 그대로 복원한다', async () => {
        registerBody('body_jxd0w5_rehydrate', async (input) =>
          mockOutput({ doubled: (input as number) * 2 }),
        );
        containerGraph(
          'foreach',
          { arrayField: 'items' },
          'body_jxd0w5_rehydrate',
        );

        await service.execute(
          workflowId,
          { items: [1, 2, 3] },
          { workspaceId: 'ws-1' },
        );
        await flushPromises();
        await flushPromises();

        const row = rowsOf('foreach', NodeExecutionStatus.COMPLETED)[0];
        expect(row).toBeDefined();

        const rehydrateId = 'exec-jxd0w5-rehydrate';
        const internals = service as unknown as {
          contextService: ExecutionContextService;
        };
        internals.contextService.deleteContext(rehydrateId);
        mockWorkflowRepo.findOne.mockResolvedValue({
          ...mockWorkflow,
          workspaceId: 'ws-1',
          workspace: { id: 'ws-1', name: 'WS', settings: {} },
        });
        mockExecutionNodeLogRepo.find.mockResolvedValue([
          { id: '1', nodeId: 'foreach' },
        ]);
        mockNodeExecutionRepo.find.mockResolvedValue([
          { ...row, executionId: rehydrateId },
        ]);

        const ctx = await service.rehydrateContext(
          {
            id: rehydrateId,
            workflowId,
            status: ExecutionStatus.RUNNING,
            recursionDepth: 0,
            dryRun: false,
          } as unknown as Execution,
          null,
        );

        expect(ctx.structuredOutputCache?.['foreach']?.output).toEqual({
          items: [{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }],
          count: 3,
        });
        internals.contextService.deleteContext(rehydrateId);
      });

      it('본문 실패면 ForEach 행을 FAILED 로 마감하고 completed 이벤트를 보내지 않는다', async () => {
        registerBody('body_jxd0w5_fail', async () => {
          throw new Error('body-boom');
        });
        containerGraph('foreach', { arrayField: 'items' }, 'body_jxd0w5_fail');

        await service.execute(
          workflowId,
          { items: [1, 2] },
          { workspaceId: 'ws-1' },
        );
        await flushPromises();
        await flushPromises();

        expect(rowsOf('foreach', NodeExecutionStatus.COMPLETED)).toHaveLength(
          0,
        );
        const failedRows = rowsOf('foreach', NodeExecutionStatus.FAILED);
        expect(failedRows).toHaveLength(1);
        expect(failedRows[0].id).toBe('ne-foreach');
        expect(failedRows[0].error).toEqual({ message: 'body-boom' });
        expect(
          nodeEventsOf('foreach', 'execution.node.completed'),
        ).toHaveLength(0);
        expect(nodeEventsOf('foreach', 'execution.node.failed')).toHaveLength(
          1,
        );
      });

      it.each([
        {
          containerType: 'loop' as const,
          config: { count: 2 },
        },
        {
          containerType: 'map' as const,
          config: { inputField: 'items' },
        },
      ])(
        '본문 실패면 $containerType 행을 FAILED 로 마감하고 completed 이벤트를 보내지 않는다',
        async ({ containerType, config }) => {
          const bodyType = `body_jxd0w5_fail_${containerType}`;
          registerBody(bodyType, () => Promise.reject(new Error('body-boom')));
          containerGraph(containerType, config, bodyType);

          await service.execute(
            workflowId,
            { items: [1, 2] },
            { workspaceId: 'ws-1' },
          );
          await flushPromises();
          await flushPromises();

          expect(
            rowsOf(containerType, NodeExecutionStatus.COMPLETED),
          ).toHaveLength(0);
          const failedRows = rowsOf(containerType, NodeExecutionStatus.FAILED);
          expect(failedRows).toHaveLength(1);
          expect(failedRows[0].id).toBe(`ne-${containerType}`);
          expect(failedRows[0].error).toEqual({ message: 'body-boom' });
          expect(
            nodeEventsOf(containerType, 'execution.node.completed'),
          ).toHaveLength(0);
          expect(
            nodeEventsOf(containerType, 'execution.node.failed'),
          ).toHaveLength(1);
        },
      );

      it('단일 노드 실행은 완료를 미루지 않는다 — 핸들러 반환값으로 COMPLETED 를 한 번 저장하고 completed 이벤트를 한 번 보낸다', async () => {
        mockExecutionRepo.create.mockImplementation(
          (d: Partial<Execution>) => ({
            id: executionId,
            workflowId,
            status: ExecutionStatus.PENDING,
            startedAt: new Date(),
            inputData: {},
            ...d,
          }),
        );
        const bodyExecute = jest.fn(busyBody);
        registerBody('body_jxd0w5_single', bodyExecute);
        containerGraph(
          'foreach',
          { arrayField: 'items' },
          'body_jxd0w5_single',
        );

        await service.execute(
          workflowId,
          { items: [1, 2, 3] },
          { workspaceId: 'ws-1', executedBy: 'u1', singleNodeId: 'foreach' },
        );
        await flushPromises();
        await flushPromises();

        // 본문을 돌리지 않으므로 완료 출력을 덮어쓸 기회가 없다. 시작 시점 값 그대로 마감한다.
        expect(bodyExecute).not.toHaveBeenCalled();
        const completedRows = rowsOf('foreach', NodeExecutionStatus.COMPLETED);
        expect(completedRows).toHaveLength(1);
        expect(completedRows[0].durationMs).toBe(0);
        expect(
          nodeEventsOf('foreach', 'execution.node.completed'),
        ).toHaveLength(1);
        expect(nodeEventsOf('foreach', 'execution.node.failed')).toHaveLength(
          0,
        );
      });

      it('아이템 경계 외부 취소면 ForEach 행을 CANCELLED 로 마감하고 cancelled 이벤트를 보낸다', async () => {
        let bodyCalls = 0;
        let simulatedNow = Date.now();
        const nowSpy = jest
          .spyOn(Date, 'now')
          .mockImplementation(() => simulatedNow);
        registerBody('body_jxd0w5_cancel', async () => {
          bodyCalls++;
          if (bodyCalls === 1) {
            mockExecutionRepo.findOneBy.mockImplementation(() =>
              Promise.resolve({
                id: executionId,
                workflowId,
                status: ExecutionStatus.CANCELLED,
                startedAt: new Date(),
              }),
            );
            // 아이템 경계 가드의 스로틀 창(250ms)을 넘긴다(위 C3 테스트와 같은 이유).
            simulatedNow += 300;
          }
          return mockOutput({ ok: true });
        });
        containerGraph(
          'foreach',
          { arrayField: 'items' },
          'body_jxd0w5_cancel',
        );

        try {
          await service.execute(
            workflowId,
            { items: [1, 2, 3] },
            { workspaceId: 'ws-1' },
          );
          await flushPromises();
          await flushPromises();
        } finally {
          nowSpy.mockRestore();
        }

        expect(bodyCalls).toBe(1);
        expect(rowsOf('foreach', NodeExecutionStatus.COMPLETED)).toHaveLength(
          0,
        );
        expect(rowsOf('foreach', NodeExecutionStatus.FAILED)).toHaveLength(0);
        expect(rowsOf('foreach', NodeExecutionStatus.CANCELLED)).toHaveLength(
          1,
        );
        expect(
          nodeEventsOf('foreach', 'execution.node.cancelled'),
        ).toHaveLength(1);
        expect(
          nodeEventsOf('foreach', 'execution.node.completed'),
        ).toHaveLength(0);
      });
    });
  });
});
