import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { buildGraph, GraphEdge } from './graph/graph-builder';
import { topologicalSort } from './graph/topological-sort';
import { identifyBackEdges } from './graph/back-edge-identifier';
import { ForEachExecutor } from './containers/foreach-executor';
import { LoopExecutor } from './containers/loop-executor';
import {
  ParallelExecutor,
  ParallelErrorPolicy,
} from './containers/parallel-executor';
import { assertTransition } from './state/state-machine';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { ALL_NODE_COMPONENTS } from '../../nodes';
import { ExecutionContextService } from './context/execution-context.service';
import {
  ErrorPolicyHandler,
  ErrorPolicyConfig,
} from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import {
  WebsocketService,
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { LlmService } from '../llm/llm.service';
import {
  AI_LLM_PROVIDER_NODE_TYPES,
  AI_NO_LLM_PROVIDER_MESSAGE,
} from '../../nodes/ai/llm-provider-rule';
import { RagSearchService } from '../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { McpClientService } from '../mcp/mcp-client.service';
import {
  BACKGROUND_EXECUTION_QUEUE,
  BackgroundExecutionJob,
} from './queues/background-execution.queue';
import {
  adaptHandlerReturn,
  toEngineFlatShape,
} from './handler-output.adapter';
import { ButtonConfig } from '../../nodes/presentation/_shared/button.types';
import {
  WorkflowExecutor,
  SubWorkflowOptions,
  SubWorkflowResult,
  InlineExecutionOptions,
} from '../../nodes/core/workflow-executor.interface';

interface ContainerBodyPlan {
  childIds: Set<string>;
  bodyEntryNodeIds: Set<string>;
  emitSourceNodeId: string;
  internalEdges: GraphEdge[];
  sortedNodeIds: string[];
  outgoingEdgeMap: Map<string, GraphEdge[]>;
}

/**
 * Per-branch subgraph plan for the Parallel logic node.
 *
 * `bodyNodeIds` — nodes exclusive to this branch (reachable from this
 *   `branch_N` target but not from any other `branch_M`). Shared downstream
 *   nodes (typical Merge join points) live in {@link ParallelPlan.joinNodeIds}.
 * `sortedNodeIds` — forward-edge topological order of `bodyNodeIds`.
 * `entryNodeIds` — direct targets of `branch_N` edges; seed the reachability
 *   set for the sequential body traversal.
 * `exitNodeIds` — body nodes that have at least one outgoing edge to a node
 *   outside the body (join nodes or unrelated downstream). After the branch
 *   completes, propagation from these nodes re-activates the main loop's
 *   `reachable` set.
 */
interface ParallelBranchPlan {
  branchIndex: number;
  branchPort: string;
  bodyNodeIds: Set<string>;
  sortedNodeIds: string[];
  entryNodeIds: Set<string>;
  exitNodeIds: Set<string>;
  internalEdges: GraphEdge[];
  outgoingEdgeMap: Map<string, GraphEdge[]>;
}

interface ParallelPlan {
  branches: ParallelBranchPlan[];
  joinNodeIds: Set<string>;
  allBodyNodeIds: Set<string>;
}

class ExecutionCancelledError extends Error {
  constructor() {
    super('Execution cancelled while waiting for input');
    this.name = 'ExecutionCancelledError';
  }
}

/**
 * Conversation 노드가 진행 중일 때 frontend run-results UI 의 References /
 * LLM Usage / Meta 탭이 동작하도록 _resumeState 의 누적 통계와 turn 단위 RAG
 * delta 를 `meta.*` 로 펼쳐 노출한다. _resumeState 자체는 system prompt /
 * llmConfigId 등 internal 필드를 포함하므로 client 에 그대로 보내지 않는다.
 *
 * 첫 waiting (사용자 첫 메시지 전) 에서는 turnCount=0 이고 turnDebugHistory
 * 도 없으므로 turnDebug=[] / ragSources=[] 로 채워져 References 탭은 자동
 * 숨김 (`hasReferences=false`).
 */
export function buildConversationMetaFromResumeState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const inputTokens = (state.totalInputTokens as number) ?? 0;
  const outputTokens = (state.totalOutputTokens as number) ?? 0;
  return {
    interactionType: 'ai_conversation',
    model: state.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    thinkingTokens: (state.totalThinkingTokens as number) ?? 0,
    toolCalls: (state.toolCalls as number) ?? 0,
    ragSources: (state.ragSources as unknown[]) ?? [],
    ragDiagnostics: state.ragLastDiagnostics,
    turnDebug: (state.turnDebugHistory as unknown[]) ?? [],
  };
}

/**
 * Single LLM call trace (request / response / latency) — one entry per call
 * inside a turn. A turn produces multiple entries when tool loops occur.
 * Mirrors `LlmCallTrace` defined in the AI handlers.
 */
interface LlmCallRecord {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

/** One entry of `state.turnDebugHistory`. `totalDurationMs` is the wall-clock
 * sum across all LLM calls + tool calls in the turn; `durationMs` on each
 * `llmCalls[]` item is the per-call latency. */
interface TurnDebugEntry {
  turnIndex: number;
  llmCalls?: LlmCallRecord[];
  totalDurationMs?: number;
}

/**
 * Extract per-turn LLM debug payload from the last entry of
 * `state.turnDebugHistory`, for the `execution.ai_message` WebSocket event.
 * Both the waiting_for_input emit and the terminal emit use this so the two
 * branches stay in lockstep — the frontend's debug timeline (Response /
 * Request / LLM Usage tabs) can match assistant messages to their LLM calls
 * regardless of whether the conversation is still in flight.
 *
 * Field mapping:
 *  - `lastTurn.llmCalls` → `llmCalls` (shallow-copied so later turns mutating
 *    the resumeState array can't retroactively change a buffered emit)
 *  - `lastTurn.totalDurationMs` → top-level `durationMs` (turn total)
 *
 * Returns an object with optional fields so callers can spread it into
 * the event payload without emitting `llmCalls: undefined` keys when no
 * turns have run yet.
 */
export function buildAiMessageDebugFromResumeState(
  state: Record<string, unknown>,
): { llmCalls?: LlmCallRecord[]; durationMs?: number } {
  const turnDebugArray = Array.isArray(state.turnDebugHistory)
    ? (state.turnDebugHistory as TurnDebugEntry[])
    : [];
  const lastTurnDebug =
    turnDebugArray.length > 0
      ? turnDebugArray[turnDebugArray.length - 1]
      : undefined;
  const result: { llmCalls?: LlmCallRecord[]; durationMs?: number } = {};
  // Array.isArray rejects null / undefined / non-array values so `llmCalls:
  // null` in resumeState (defensive against legacy state shapes) doesn't
  // leak into the payload as a non-array value.
  if (Array.isArray(lastTurnDebug?.llmCalls)) {
    result.llmCalls = [...lastTurnDebug.llmCalls];
  }
  if (typeof lastTurnDebug?.totalDurationMs === 'number') {
    result.durationMs = lastTurnDebug.totalDurationMs;
  }
  return result;
}

/**
 * Build the WS-event `conversationConfig` block from a NodeHandlerOutput's
 * `output`. System messages are filtered out for client display.
 */
export function buildConversationConfigFromOutput(
  output: Record<string, unknown> | undefined,
): {
  message: string;
  turnCount: number;
  maxTurns?: number;
  messages: Array<Record<string, unknown>>;
  extracted?: Record<string, unknown>;
  missingFields?: string[];
  collectionRetryCount?: number;
} {
  const o = output ?? {};
  const partial = (o.partial as Record<string, unknown> | undefined) ?? {};
  const messagesAll =
    (o.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const result: {
    message: string;
    turnCount: number;
    maxTurns?: number;
    messages: Array<Record<string, unknown>>;
    extracted?: Record<string, unknown>;
    missingFields?: string[];
    collectionRetryCount?: number;
  } = {
    message: (o.message as string | undefined) ?? '',
    turnCount: (o.turnCount as number | undefined) ?? 0,
    messages: messagesAll.filter((m) => m.role !== 'system'),
  };
  const maxTurns = o.maxTurns as number | undefined;
  if (maxTurns !== undefined) result.maxTurns = maxTurns;
  if (partial.extracted !== undefined)
    result.extracted = partial.extracted as Record<string, unknown>;
  if (partial.missingFields !== undefined)
    result.missingFields = partial.missingFields as string[];
  if (partial.collectionRetryCount !== undefined)
    result.collectionRetryCount = partial.collectionRetryCount as number;
  return result;
}

@Injectable()
export class ExecutionEngineService implements OnModuleInit, WorkflowExecutor {
  private readonly logger = new Logger(ExecutionEngineService.name);

  /**
   * Stores pending continuation resolvers for Form nodes that are
   * waiting for user input. Key: executionId.
   */
  private readonly pendingContinuations = new Map<
    string,
    {
      nodeId: string;
      resolve: (data?: unknown) => void;
      reject: (err: Error) => void;
    }
  >();

  /**
   * Per-execution async mutex for the `executionPath` append write.
   *
   * Under ParallelExecutor (PARALLEL_ENGINE=v1), multiple branches may finish
   * around the same event-loop tick and race on the read-modify-write sequence
   * at the bottom of {@link executeNode}, causing a last-write-wins loss of
   * node ids from the recorded path. Serializing writes per execution keeps
   * the path ordered and complete.
   */
  private readonly executionPathChain = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    private readonly handlerRegistry: NodeHandlerRegistry,
    private readonly componentRegistry: NodeComponentRegistry,
    private readonly contextService: ExecutionContextService,
    private readonly errorPolicyHandler: ErrorPolicyHandler,
    private readonly expressionResolver: ExpressionResolverService,
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
    private readonly configService: ConfigService,
    private readonly llmService: LlmService,
    private readonly ragSearchService: RagSearchService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly integrationsService: IntegrationsService,
    private readonly mcpClientService: McpClientService,
    private readonly foreachExecutor: ForEachExecutor,
    private readonly loopExecutor: LoopExecutor,
    private readonly parallelExecutor: ParallelExecutor,
    @InjectQueue(BACKGROUND_EXECUTION_QUEUE)
    private readonly backgroundQueue: Queue<BackgroundExecutionJob>,
  ) {}

  async onModuleInit() {
    this.registerHandlers();
    await this.recoverStuckExecutions();
  }

  /**
   * On server restart, mark any executions stuck in WAITING_FOR_INPUT as FAILED
   * since their in-memory continuation Promises are lost.
   */
  private async recoverStuckExecutions(): Promise<void> {
    const stuck = await this.executionRepository.find({
      where: { status: ExecutionStatus.WAITING_FOR_INPUT },
    });
    if (stuck.length === 0) return;

    this.logger.warn(
      `Recovering ${stuck.length} execution(s) stuck in WAITING_FOR_INPUT`,
    );
    for (const execution of stuck) {
      execution.status = ExecutionStatus.FAILED;
      execution.error = {
        message:
          'Execution failed: server restarted while waiting for user input',
      };
      execution.finishedAt = new Date();
      if (execution.startedAt) {
        execution.durationMs =
          execution.finishedAt.getTime() - execution.startedAt.getTime();
      }
      await this.executionRepository.save(execution);
    }
  }

  private registerHandlers() {
    this.componentRegistry.bootstrap(ALL_NODE_COMPONENTS, {
      llmService: this.llmService,
      ragSearchService: this.ragSearchService,
      knowledgeBaseService: this.knowledgeBaseService,
      integrationsService: this.integrationsService,
      mcpClientService: this.mcpClientService,
      workflowExecutor: this,
      websocketService: this.websocketService,
    });
  }

  /**
   * Execute a workflow. Creates the execution record and starts execution
   * in the background so the caller gets the execution ID immediately.
   *
   * `options.executedBy` 는 수동 실행(사용자가 ▶ 누름)일 때, `options.triggerId`
   * 는 schedule/webhook 트리거 발화일 때 채운다. 두 값은 Execution 행에 저장되어
   * "최근 실행" 화면이 출처를 분류하는 데 쓰인다 (deriveExecutionTrigger).
   */
  async execute(
    workflowId: string,
    input?: unknown,
    options?: { executedBy?: string; triggerId?: string },
  ): Promise<string> {
    // 1. Validate workflow exists
    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // 2. Create Execution record
    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      executedBy: options?.executedBy ?? undefined,
      triggerId: options?.triggerId ?? undefined,
      executionPath: [],
    });
    const savedExecution = await this.executionRepository.save(execution);
    const executionId = savedExecution.id;

    // 3. Run execution in background (fire-and-forget)
    this.runExecution(savedExecution, input).catch((error: unknown) => {
      this.logger.error(
        `Background execution failed for ${executionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return executionId;
  }

  /**
   * Execute a sub-workflow inline within the parent execution.
   * Shares the same executionId, nodeOutputCache, and nodeMap so that
   * $node references work seamlessly and node executions appear in the
   * same history timeline.
   */
  async executeInline(
    workflowId: string,
    input: unknown,
    options: InlineExecutionOptions,
  ): Promise<unknown> {
    const {
      executionId,
      context,
      executedNodes,
      recursionDepth,
      parentNodeExecutionId,
    } = options;

    // Strip _selectedPort from input — this is parent execution metadata
    // that must not leak into the sub-workflow (it would cause all downstream
    // nodes to be port-routing-skipped).
    let cleanInput = input;
    if (
      input &&
      typeof input === 'object' &&
      '_selectedPort' in (input as Record<string, unknown>)
    ) {
      const { _selectedPort, ...rest } = input as Record<string, unknown>;
      void _selectedPort;
      cleanInput = rest;
    }

    this.logger.log(
      `[executeInline] Starting inline execution of workflow ${workflowId} within execution ${executionId}`,
    );

    // Load target workflow's nodes and edges
    const subNodes = await this.nodeRepository.findBy({ workflowId });
    const subEdges = await this.edgeRepository.findBy({ workflowId });

    if (subNodes.length === 0) {
      return cleanInput;
    }

    // Build graph for the sub-workflow
    const { graphNodes, graphEdges } = buildGraph(subNodes, subEdges);
    const { forwardEdges, backEdges } = identifyBackEdges(
      graphNodes,
      graphEdges,
    );
    const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

    if (sortedNodeIds.length === 0) {
      return cleanInput;
    }

    // Pre-compute sorted-index map for back-edge jumps
    const sortedIndexMap = new Map<string, number>();
    for (let i = 0; i < sortedNodeIds.length; i++) {
      sortedIndexMap.set(sortedNodeIds[i], i);
    }
    const backEdgeMap = new Map<
      string,
      Array<{ edge: GraphEdge; targetIndex: number }>
    >();
    for (const edge of backEdges) {
      const targetIndex = sortedIndexMap.get(edge.targetNodeId);
      if (targetIndex === undefined) continue;
      const list = backEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push({ edge, targetIndex });
      backEdgeMap.set(edge.sourceNodeId, list);
    }

    // Build outgoing-edge lookup for O(1) propagation
    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of graphEdges) {
      const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, list);
    }

    // Use target-only nodeMap for expression resolution.
    // $node references in the target workflow should resolve against the
    // target workflow's own nodes only, not the parent (source) workflow.
    const subNodeMap = new Map(subNodes.map((n) => [n.id, n]));

    // Debug: log node labels and execution order
    this.logger.log(
      `[executeInline] Target workflow nodes: ${subNodes.map((n) => `${n.label}(${n.type})`).join(', ')}`,
    );
    this.logger.log(
      `[executeInline] Sorted execution order (${sortedNodeIds.length} nodes): ${sortedNodeIds.map((id) => subNodeMap.get(id)?.label ?? id).join(' → ')}`,
    );

    // Update context recursionDepth for nested sub-workflow calls
    const prevDepth = context.recursionDepth;
    context.recursionDepth = recursionDepth;

    // Stamp parentNodeExecutionId so every NodeExecution created during this
    // inline run records the invoking Sub-Workflow row id. Restored in
    // the finally block so sibling nodes of the parent don't inherit it.
    const prevParentNodeExecutionId = context.parentNodeExecutionId;
    if (parentNodeExecutionId) {
      context.parentNodeExecutionId = parentNodeExecutionId;
    }

    const maxNodeIterations = this.configService.get<number>(
      'MAX_NODE_ITERATIONS',
      100,
    );
    const nodeExecutionCount = new Map<string, number>();
    // Seed reachability. The Background processor passes explicit entry ids
    // (the targets of `background`-port edges); otherwise we use the standard
    // trigger-first / no-incoming-edge fallback used for sub-workflows.
    const reachable = new Set<string>();
    const explicitEntryIds = options.entryNodeIds;
    if (explicitEntryIds && explicitEntryIds.length > 0) {
      for (const id of explicitEntryIds) {
        if (subNodeMap.has(id)) reachable.add(id);
      }
    } else {
      const nodesWithIncoming = new Set(
        forwardEdges.map((e) => e.targetNodeId),
      );
      for (const id of sortedNodeIds) {
        const node = subNodeMap.get(id);
        if (node?.category === NodeCategory.TRIGGER) reachable.add(id);
      }
      if (reachable.size === 0) {
        for (const id of sortedNodeIds) {
          if (!nodesWithIncoming.has(id)) reachable.add(id);
        }
      }
    }

    // Retrieve execution meta for expression context
    const execution = await this.executionRepository.findOneBy({
      id: executionId,
    });

    let lastOutput: unknown = cleanInput;
    let pointer = 0;

    try {
      while (pointer < sortedNodeIds.length) {
        const nodeId = sortedNodeIds[pointer];
        const node = subNodeMap.get(nodeId);
        if (!node) {
          pointer++;
          continue;
        }

        // Skip unreachable nodes (not on any activated branch)
        if (!reachable.has(nodeId)) {
          pointer++;
          continue;
        }

        // Max iteration guard
        const count = (nodeExecutionCount.get(nodeId) ?? 0) + 1;
        nodeExecutionCount.set(nodeId, count);
        if (maxNodeIterations > 0 && count > maxNodeIterations) {
          throw new Error(
            `Node "${node.label ?? node.type}" exceeded maximum iteration count (${maxNodeIterations}).`,
          );
        }

        // Skip disabled nodes (don't propagate reachability to downstream)
        if (node.isDisabled) {
          const skipped = await this.createNodeExecution(
            executionId,
            nodeId,
            NodeExecutionStatus.SKIPPED,
            context.parentNodeExecutionId,
          );
          this.websocketService.emitNodeEvent(
            executionId,
            nodeId,
            NodeEventType.NODE_SKIPPED,
            {
              nodeExecutionId: skipped.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.SKIPPED,
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
            },
          );
          executedNodes.add(nodeId);
          pointer++;
          continue;
        }

        // Skip trigger nodes in sub-workflows (they are entry points only)
        if (node.type === 'manual_trigger') {
          executedNodes.add(nodeId);
          // Pass clean input through trigger node's output slot
          this.contextService.setNodeOutput(executionId, nodeId, cleanInput);
          this.propagateReachability(
            nodeId,
            outgoingEdgeMap,
            context.nodeOutputCache,
            reachable,
          );
          pointer++;
          continue;
        }

        // Gather input from predecessor nodes within the sub-workflow graph
        const nodeInput = this.gatherNodeInput(
          nodeId,
          graphEdges,
          executedNodes,
          context.nodeOutputCache,
          cleanInput,
        );

        // Execute the node using the parent execution's context but
        // target-only nodeMap for $node expression resolution.
        this.logger.log(
          `[executeInline] Executing node "${node.label}" (type=${node.type}, id=${node.id})`,
        );
        await this.executeNode(
          executionId,
          node,
          nodeInput,
          context,
          executedNodes,
          subNodeMap,
          {
            startedAt: execution?.startedAt?.toISOString(),
            mode: 'manual',
          },
        );

        // Container dispatch for sub-workflow inline execution.
        if (
          node.type === 'foreach' ||
          node.type === 'loop' ||
          node.type === 'map'
        ) {
          await this.runContainer(
            node,
            subNodes,
            subEdges,
            context,
            executionId,
            executedNodes,
            {
              startedAt: execution?.startedAt?.toISOString(),
              mode: 'manual',
            },
          );
        }

        // Background dispatch — enqueue body subgraph and continue main flow.
        if (node.type === 'background') {
          await this.scheduleBackgroundBody(
            node,
            subEdges,
            context,
            executionId,
            cleanInput,
          );
        }

        // Debug: log $node keys available after this node executed
        const availableLabels = [...subNodeMap.entries()]
          .filter(([nid]) => context.nodeOutputCache[nid] !== undefined)
          .map(([, n]) => n.label);
        this.logger.log(
          `[executeInline] After "${node.label}": $node labels available = [${availableLabels.join(', ')}]`,
        );

        // Blocking nodes: pause execution until user interaction
        // (same logic as runExecution — Form, Button, AI Conversation)
        const nodeOutput = context.nodeOutputCache[node.id] as
          | Record<string, unknown>
          | undefined;
        const interactionType = this.getInteractionType(context, node.id);
        const statusForLog =
          typeof nodeOutput?.status === 'string' ? nodeOutput.status : 'none';
        this.logger.log(
          `[executeInline] Node "${node.label}" output status=${statusForLog}, execution=${execution ? 'found' : 'NULL'}`,
        );
        if (execution) {
          if (nodeOutput?.status === 'waiting_for_input') {
            this.logger.log(
              `[executeInline] BLOCKING: "${node.label}" is waiting_for_input (type=${node.type})`,
            );
            if (node.type === 'form') {
              await this.waitForFormSubmission(
                execution,
                executionId,
                node,
                context,
              );
            } else if (interactionType === 'buttons') {
              await this.waitForButtonInteraction(
                execution,
                executionId,
                node,
                context,
                graphEdges,
              );
            } else if (interactionType === 'ai_conversation') {
              await this.waitForAiConversation(
                execution,
                executionId,
                node,
                context,
              );
            }
          }
        }

        lastOutput = context.nodeOutputCache[node.id];

        // Propagate reachability to downstream nodes through activated edges
        this.propagateReachability(
          nodeId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );

        // Back-edge handling
        const backEdgesFromNode = backEdgeMap.get(nodeId);
        if (backEdgesFromNode?.length) {
          const activated = this.findActivatedBackEdge(
            nodeId,
            backEdgesFromNode,
            context.nodeOutputCache,
          );
          if (activated) {
            for (let i = activated.targetIndex; i <= pointer; i++) {
              reachable.delete(sortedNodeIds[i]);
            }
            reachable.add(sortedNodeIds[activated.targetIndex]);
            pointer = activated.targetIndex;
            continue;
          }
        }

        pointer++;
      }
    } finally {
      // Restore parent's recursion depth
      context.recursionDepth = prevDepth;
      context.parentNodeExecutionId = prevParentNodeExecutionId;
    }

    return lastOutput;
  }

  /**
   * Execute a sub-workflow synchronously (blocking).
   * Creates an Execution record, runs it inline, and returns the output.
   */
  async executeSync(
    workflowId: string,
    input?: unknown,
    options?: SubWorkflowOptions,
  ): Promise<SubWorkflowResult> {
    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      executionPath: [],
      parentExecutionId: options?.parentExecutionId ?? undefined,
      recursionDepth: options?.recursionDepth ?? 0,
    });
    const savedExecution = await this.executionRepository.save(execution);

    const timeoutMs = options?.timeoutMs ?? 300_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    // timeoutMs === 0 means "no timeout" per spec; skip Promise.race entirely.
    const timeoutPromise =
      timeoutMs > 0
        ? new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(
                new Error(
                  `Sub-workflow execution timed out after ${timeoutMs}ms`,
                ),
              );
            }, timeoutMs);
          })
        : null;

    try {
      if (timeoutPromise) {
        await Promise.race([
          this.runExecution(savedExecution, input),
          timeoutPromise,
        ]);
      } else {
        await this.runExecution(savedExecution, input);
      }
    } catch (error: unknown) {
      // On timeout, mark the sub-execution as failed
      const reloaded = await this.executionRepository.findOneBy({
        id: savedExecution.id,
      });
      if (
        reloaded &&
        reloaded.status !== ExecutionStatus.COMPLETED &&
        reloaded.status !== ExecutionStatus.FAILED
      ) {
        reloaded.status = ExecutionStatus.FAILED;
        reloaded.error = {
          message: error instanceof Error ? error.message : String(error),
        };
        reloaded.finishedAt = new Date();
        if (reloaded.startedAt) {
          reloaded.durationMs =
            reloaded.finishedAt.getTime() - reloaded.startedAt.getTime();
        }
        await this.executionRepository.save(reloaded);
      }
      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }

    const completed = await this.executionRepository.findOneBy({
      id: savedExecution.id,
    });

    if (completed?.status === ExecutionStatus.FAILED) {
      const errRecord = completed.error as Record<string, string> | null;
      const errMsg: string = errRecord?.message ?? 'Unknown error';
      throw new Error(`Sub-workflow execution failed: ${errMsg}`);
    }

    if (completed?.status === ExecutionStatus.CANCELLED) {
      throw new Error('Sub-workflow execution was cancelled');
    }

    return {
      executionId: savedExecution.id,
      output: completed?.outputData ?? {},
      status: completed?.status ?? ExecutionStatus.FAILED,
    };
  }

  /**
   * Execute a sub-workflow asynchronously (fire-and-forget).
   * Returns the execution ID immediately.
   */
  async executeAsync(
    workflowId: string,
    input?: unknown,
    options?: Omit<SubWorkflowOptions, 'timeoutMs'>,
  ): Promise<string> {
    const workflow = await this.workflowRepository.findOneBy({
      id: workflowId,
    });
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const execution = this.executionRepository.create({
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: (input as Record<string, unknown>) ?? {},
      executionPath: [],
      parentExecutionId: options?.parentExecutionId ?? undefined,
      recursionDepth: options?.recursionDepth ?? 0,
    });
    const savedExecution = await this.executionRepository.save(execution);
    const executionId = savedExecution.id;

    this.runExecution(savedExecution, input).catch((error: unknown) => {
      this.logger.error(
        `Background sub-workflow execution failed for ${executionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return executionId;
  }

  /**
   * Runs the actual execution logic. Called in background after execute()
   * returns the execution ID to the caller.
   */
  private async runExecution(
    savedExecution: Execution,
    input: unknown,
  ): Promise<void> {
    const executionId = savedExecution.id;
    const workflowId = savedExecution.workflowId;

    try {
      // 3. Transition to RUNNING
      await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);
      this.websocketService.emitExecutionEvent(
        executionId,
        ExecutionEventType.EXECUTION_STARTED,
        { status: ExecutionStatus.RUNNING },
      );

      // 4. Load nodes and edges
      const nodes = await this.nodeRepository.findBy({ workflowId });
      const edges = await this.edgeRepository.findBy({ workflowId });

      // 5. Build graph (filters container children & tool area nodes)
      const { graphNodes, graphEdges } = buildGraph(nodes, edges);

      // 6. Identify back-edges (edges that create cycles) and separate forward-edges
      const { forwardEdges, backEdges } = identifyBackEdges(
        graphNodes,
        graphEdges,
      );

      // 7. Topological sort on forward-edges-only graph (guaranteed DAG)
      const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

      // Pre-compute node-id → sorted-index map for O(1) lookup
      const sortedIndexMap = new Map<string, number>();
      for (let i = 0; i < sortedNodeIds.length; i++) {
        sortedIndexMap.set(sortedNodeIds[i], i);
      }

      // Build back-edge lookup: sourceNodeId -> [{ edge, targetIndex }]
      // Used at runtime to jump the execution pointer back when a back-edge is activated.
      const backEdgeMap = new Map<
        string,
        Array<{ edge: GraphEdge; targetIndex: number }>
      >();
      for (const edge of backEdges) {
        const targetIndex = sortedIndexMap.get(edge.targetNodeId);
        // Skip back-edges whose target is not in the sorted graph (defensive guard)
        if (targetIndex === undefined) continue;
        const list = backEdgeMap.get(edge.sourceNodeId) ?? [];
        list.push({ edge, targetIndex });
        backEdgeMap.set(edge.sourceNodeId, list);
      }

      // Build outgoing-edge lookup for O(1) propagation
      const outgoingEdgeMap = new Map<string, GraphEdge[]>();
      for (const edge of graphEdges) {
        const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
        list.push(edge);
        outgoingEdgeMap.set(edge.sourceNodeId, list);
      }

      // 8. Create execution context (inject workspaceId for AI handlers)
      const workflow = await this.workflowRepository.findOneBy({
        id: workflowId,
      });
      const context = this.contextService.createContext(
        executionId,
        workflowId,
        { __workspaceId: workflow?.workspaceId ?? '' },
        savedExecution.recursionDepth,
      );

      // 9. Build lookup maps
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      // 10. Execute nodes with pointer-based loop (supports back-edge jumps)
      // Inject runtime state into context for sub-workflow inline execution
      const maxNodeIterations = this.configService.get<number>(
        'MAX_NODE_ITERATIONS',
        100,
      );
      if (maxNodeIterations === 0 && backEdges.length > 0) {
        this.logger.warn(
          `MAX_NODE_ITERATIONS=0 (unlimited) with ${backEdges.length} back-edge(s). ` +
            `Cyclic workflows may run indefinitely if no exit condition is met.`,
        );
      }
      const nodeExecutionCount = new Map<string, number>();
      // NOTE: executedNodes is intentionally NOT cleared on back-edge jumps.
      // Re-executed nodes overwrite their output in nodeOutputCache, and
      // gatherNodeInput uses executedNodes to confirm predecessor completion.
      // Keeping them in the set ensures downstream nodes see predecessor output.
      const executedNodes = new Set<string>();
      context._executedNodes = executedNodes;
      // Track which nodes are reachable from the trigger through activated edges.
      // Only reachable nodes are executed; unreachable branches are silently skipped.
      // Seed with trigger nodes. If none exist, fall back to nodes with no incoming edges.
      const reachable = new Set<string>();
      const nodesWithIncoming = new Set(
        forwardEdges.map((e) => e.targetNodeId),
      );
      for (const id of sortedNodeIds) {
        const node = nodeMap.get(id);
        if (node?.category === NodeCategory.TRIGGER) reachable.add(id);
      }
      if (reachable.size === 0) {
        for (const id of sortedNodeIds) {
          if (!nodesWithIncoming.has(id)) reachable.add(id);
        }
      }

      let pointer = 0;
      while (pointer < sortedNodeIds.length) {
        const nodeId = sortedNodeIds[pointer];
        const node = nodeMap.get(nodeId);
        if (!node) {
          pointer++;
          continue;
        }

        // Skip unreachable nodes (not on any activated branch)
        if (!reachable.has(nodeId)) {
          pointer++;
          continue;
        }

        // Max iteration guard (0 = unlimited)
        const count = (nodeExecutionCount.get(nodeId) ?? 0) + 1;
        nodeExecutionCount.set(nodeId, count);
        if (maxNodeIterations > 0 && count > maxNodeIterations) {
          // noinspection ExceptionCaughtLocallyJS — intentional: delegates to the catch block's failure handling
          throw new Error(
            `Node "${node.label ?? node.type}" exceeded maximum iteration count (${maxNodeIterations}). ` +
              `Set MAX_NODE_ITERATIONS=0 for unlimited.`,
          );
        }

        // Skip disabled nodes (don't propagate reachability to downstream)
        if (node.isDisabled) {
          const skipped = await this.createNodeExecution(
            executionId,
            nodeId,
            NodeExecutionStatus.SKIPPED,
            context.parentNodeExecutionId,
          );
          this.websocketService.emitNodeEvent(
            executionId,
            nodeId,
            NodeEventType.NODE_SKIPPED,
            {
              nodeExecutionId: skipped.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.SKIPPED,
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
            },
          );
          executedNodes.add(nodeId);
          pointer++;
          continue;
        }

        // Gather input from predecessor nodes
        const nodeInput = this.gatherNodeInput(
          nodeId,
          graphEdges,
          executedNodes,
          context.nodeOutputCache,
          input,
        );

        // Execute the node
        await this.executeNode(
          executionId,
          node,
          nodeInput,
          context,
          executedNodes,
          nodeMap,
          {
            startedAt: savedExecution.startedAt?.toISOString(),
            mode: 'manual',
          },
        );

        // Container dispatch: after the handler runs (which resolves config),
        // iterate the body subgraph and overwrite container output with the
        // collected results so `done`-port edges see the right value.
        if (
          node.type === 'foreach' ||
          node.type === 'loop' ||
          node.type === 'map'
        ) {
          await this.runContainer(
            node,
            nodes,
            edges,
            context,
            executionId,
            executedNodes,
            {
              startedAt: savedExecution.startedAt?.toISOString(),
              mode: 'manual',
            },
          );
        }

        // Background dispatch — enqueue body subgraph and continue main flow.
        if (node.type === 'background') {
          await this.scheduleBackgroundBody(
            node,
            edges,
            context,
            executionId,
            input,
          );
        }

        // Parallel dispatch (PARALLEL_ENGINE=v1): run branch subgraphs
        // concurrently. In the default 'off' mode the Parallel handler's
        // `port: string[]` return value is handled by the legacy sequential
        // propagateReachability path below, preserving existing semantics.
        if (
          node.type === 'parallel' &&
          this.configService.get<string>('PARALLEL_ENGINE', 'off') === 'v1'
        ) {
          const nodeInput = this.gatherNodeInput(
            nodeId,
            graphEdges,
            executedNodes,
            context.nodeOutputCache,
            input,
          );
          await this.runParallel(
            node,
            nodes,
            edges,
            forwardEdges,
            backEdges,
            outgoingEdgeMap,
            context,
            executionId,
            executedNodes,
            {
              startedAt: savedExecution.startedAt?.toISOString(),
              mode: 'manual',
            },
            reachable,
            nodeInput,
          );
          // Skip downstream checks — runParallel already handled
          // branch bodies, reachability propagation, and neutralized
          // the Parallel node's _selectedPort sentinel so that the
          // default propagateReachability below is a harmless no-op.
          // However, we explicitly skip blocking/back-edge checks that
          // don't apply to the Parallel node itself.
          pointer++;
          continue;
        }

        // Blocking nodes: pause execution until user interaction
        const nodeOutput = context.nodeOutputCache[node.id] as
          | Record<string, unknown>
          | undefined;
        const interactionType = this.getInteractionType(context, node.id);
        if (nodeOutput?.status === 'waiting_for_input') {
          if (node.type === 'form') {
            await this.waitForFormSubmission(
              savedExecution,
              executionId,
              node,
              context,
            );
          } else if (interactionType === 'buttons') {
            await this.waitForButtonInteraction(
              savedExecution,
              executionId,
              node,
              context,
              graphEdges,
            );
          } else if (interactionType === 'ai_conversation') {
            await this.waitForAiConversation(
              savedExecution,
              executionId,
              node,
              context,
            );
          }
        }

        // Propagate reachability to downstream nodes through activated edges.
        // Must happen after blocking interactions which may set _selectedPort.
        this.propagateReachability(
          nodeId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );

        // Check for activated back-edges (cyclic workflow support)
        const backEdgesFromNode = backEdgeMap.get(nodeId);
        if (backEdgesFromNode?.length) {
          const activated = this.findActivatedBackEdge(
            nodeId,
            backEdgesFromNode,
            context.nodeOutputCache,
          );
          if (activated) {
            // Clear reachability for nodes in the re-execution range
            for (let i = activated.targetIndex; i <= pointer; i++) {
              reachable.delete(sortedNodeIds[i]);
            }
            // Re-add the back-edge target so it executes on the next pass
            reachable.add(sortedNodeIds[activated.targetIndex]);
            pointer = activated.targetIndex;
            continue;
          }
        }

        pointer++;
      }

      // 11. Mark execution as completed
      await this.updateExecutionStatus(
        savedExecution,
        ExecutionStatus.COMPLETED,
      );

      // Set output data from the last executed node
      const lastNodeId = sortedNodeIds[sortedNodeIds.length - 1];
      if (lastNodeId) {
        savedExecution.outputData =
          (context.nodeOutputCache[lastNodeId] as Record<string, unknown>) ??
          {};
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
        await this.executionRepository.save(savedExecution);
      }

      // Emit after all DB writes are complete
      this.websocketService.emitExecutionEvent(
        executionId,
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: ExecutionStatus.COMPLETED },
      );
    } catch (error: unknown) {
      // Cancelled while waiting for user input — mark as cancelled, not failed
      if (error instanceof ExecutionCancelledError) {
        savedExecution.status = ExecutionStatus.CANCELLED;
        savedExecution.finishedAt = new Date();
        savedExecution.durationMs =
          savedExecution.finishedAt.getTime() -
          savedExecution.startedAt.getTime();
        await this.executionRepository.save(savedExecution);
        this.websocketService.emitExecutionEvent(
          executionId,
          ExecutionEventType.EXECUTION_CANCELLED,
          { status: ExecutionStatus.CANCELLED },
        );
        return;
      }

      // Mark execution as failed
      savedExecution.status = ExecutionStatus.FAILED;
      savedExecution.error = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      };
      savedExecution.finishedAt = new Date();
      savedExecution.durationMs =
        savedExecution.finishedAt.getTime() -
        savedExecution.startedAt.getTime();
      await this.executionRepository.save(savedExecution);
      this.websocketService.emitExecutionEvent(
        executionId,
        ExecutionEventType.EXECUTION_FAILED,
        {
          status: ExecutionStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    } finally {
      // Drain the serialized executionPath queue before disposing in-memory
      // state, otherwise a pending append could outlive the execution record.
      const pending = this.executionPathChain.get(executionId);
      if (pending) {
        await pending.catch(() => undefined);
        this.executionPathChain.delete(executionId);
      }
      this.pendingContinuations.delete(executionId);
      this.contextService.deleteContext(executionId);
    }
  }

  /**
   * Serialize the `execution.executionPath` read-modify-write across
   * concurrent callers (ParallelExecutor branches) by chaining onto the
   * per-execution promise. Errors are caught locally so one failing append
   * cannot poison subsequent appends.
   */
  private appendExecutionPath(
    executionId: string,
    nodeId: string,
  ): Promise<void> {
    const prior = this.executionPathChain.get(executionId) ?? Promise.resolve();
    const next = prior.then(async () => {
      try {
        const execution = await this.executionRepository.findOneBy({
          id: executionId,
        });
        if (!execution) return;
        execution.executionPath = [...execution.executionPath, nodeId];
        await this.executionRepository.save(execution);
      } catch (error) {
        this.logger.warn(
          `Failed to append executionPath for ${executionId}/${nodeId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });
    this.executionPathChain.set(executionId, next);
    return next;
  }

  /**
   * Read the blocking node's interaction type, preferring the structured
   * cache (new NodeHandlerOutput shape: `meta.interactionType`) and falling
   * back to the legacy flat output root. Single source of truth for the two
   * callers (runExecution blocking dispatch and executeInline resume).
   */
  private getInteractionType(
    context: ExecutionContext,
    nodeId: string,
  ): string | undefined {
    const structuredMeta = context.structuredOutputCache?.[nodeId]?.meta;
    const structuredType = structuredMeta?.interactionType;
    if (typeof structuredType === 'string') return structuredType;
    const flat = context.nodeOutputCache[nodeId] as
      | Record<string, unknown>
      | undefined;
    const flatType = flat?.interactionType;
    return typeof flatType === 'string' ? flatType : undefined;
  }

  /**
   * Pause execution at a Form node and wait for the user to submit form data.
   * Transitions Execution → WAITING_FOR_INPUT, emits WS event, awaits Promise.
   * On resume: merges formData into node output, transitions back to RUNNING.
   */
  private async waitForFormSubmission(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<void> {
    // Update execution status to waiting
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
    );

    // Emit waiting event so frontend can render the form. Prefer the
    // structured cache entry (new NodeHandlerOutput shape) so the frontend
    // can read the form declaration from `.config`; fall back to the flat
    // cache for legacy handlers that still stash declarations at the root.
    const nodeOutput =
      context.structuredOutputCache?.[node.id] ??
      context.nodeOutputCache[node.id];

    // Update the node execution to waiting_for_input AND persist the output
    // shape so REST polling reconciliation stays consistent with WS —
    // otherwise polling would overwrite the WS-delivered outputData with
    // `null`, making the rendered form declaration disappear between polls.
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      nodeExec.outputData = nodeOutput as Record<string, unknown>;
      await this.nodeExecutionRepository.save(nodeExec);
    }
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        nodeExecutionId: nodeExec?.id,
        nodeOutput,
      },
    );

    // Await user submission indefinitely; external cancel is the only exit.
    const formData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, {
        nodeId: node.id,
        resolve,
        reject,
      });
    });

    // Merge submitted form data into the structured NodeHandlerOutput.
    // The form handler stored `{ config, output: {}, status:
    // 'waiting_for_input', meta }` on the initial execute; here we populate
    // `output.interaction.{type,data,receivedAt}` and flip `status` to the
    // unified `'resumed'` value (CONVENTIONS §4.4 / §4.5).
    const prevStructured = context.structuredOutputCache?.[node.id];
    const receivedAt = new Date().toISOString();
    const interactionData =
      formData === null ||
      formData === undefined ||
      typeof formData !== 'object'
        ? {}
        : (formData as Record<string, unknown>);
    const updatedStructured = {
      config: prevStructured?.config ?? node.config ?? {},
      output: {
        interaction: {
          type: 'form_submitted' as const,
          data: interactionData,
          receivedAt,
        },
      },
      status: 'resumed',
      port: 'out',
      ...(prevStructured?.meta !== undefined
        ? { meta: prevStructured.meta }
        : {}),
    };
    this.contextService.setStructuredOutput(
      executionId,
      node.id,
      updatedStructured,
    );
    this.contextService.setNodeOutput(
      executionId,
      node.id,
      toEngineFlatShape(updatedStructured),
    );
    // Keep `updatedOutput` alias for the rest of the function (DB save, emit).
    // Downstream consumers (frontend) receive the structured shape and can
    // unwrap via output-shape helper.
    const updatedOutput = updatedStructured;

    // Update node execution to completed with merged output
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      nodeExec.outputData = updatedOutput;
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
      await this.nodeExecutionRepository.save(nodeExec);
      this.websocketService.emitNodeEvent(
        executionId,
        node.id,
        NodeEventType.NODE_COMPLETED,
        {
          nodeExecutionId: nodeExec.id,
          parentNodeExecutionId: context.parentNodeExecutionId,
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExec.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExec.outputData,
          input: nodeExec.inputData,
          finishedAt: nodeExec.finishedAt?.toISOString?.(),
        },
      );
    }

    // Transition back to RUNNING (resumed from form, not a fresh start)
    await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  /**
   * Resume a paused execution by submitting form data.
   * Called from WebSocket handler or REST endpoint.
   */
  continueExecution(executionId: string, formData?: unknown): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) {
      throw new Error(`No pending continuation for execution: ${executionId}`);
    }
    this.pendingContinuations.delete(executionId);
    pending.resolve(formData);
  }

  /**
   * Cancel a waiting execution by rejecting the pending continuation.
   */
  cancelWaitingExecution(executionId: string): void {
    const pending = this.pendingContinuations.get(executionId);
    if (pending) {
      this.pendingContinuations.delete(executionId);
      pending.reject(new ExecutionCancelledError());
    }
  }

  /**
   * Resume a paused execution by clicking a button.
   * Called from WebSocket handler.
   */
  continueButtonClick(executionId: string, buttonId: string): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) {
      throw new Error(`No pending continuation for execution: ${executionId}`);
    }
    this.pendingContinuations.delete(executionId);
    pending.resolve({ type: 'button_click', buttonId });
  }

  /**
   * Submit a user message in a multi-turn AI conversation.
   */
  private static readonly MAX_MESSAGE_LENGTH = 10_000;

  continueAiConversation(executionId: string, message: string): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) {
      throw new Error(`No pending continuation for execution: ${executionId}`);
    }
    if (message.length > ExecutionEngineService.MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message exceeds maximum length of ${ExecutionEngineService.MAX_MESSAGE_LENGTH} characters`,
      );
    }
    this.pendingContinuations.delete(executionId);
    pending.resolve({ type: 'ai_message', message });
  }

  /**
   * End a multi-turn AI conversation.
   */
  endAiConversation(executionId: string): void {
    const pending = this.pendingContinuations.get(executionId);
    if (!pending) {
      throw new Error(`No pending continuation for execution: ${executionId}`);
    }
    this.pendingContinuations.delete(executionId);
    pending.resolve({ type: 'ai_end_conversation' });
  }

  /**
   * Pause execution at an AI Agent node in multi-turn mode.
   * Loops: emit AI response → wait for user message → process → repeat.
   * Exits when user ends conversation or maxTurns is reached.
   */
  private async waitForAiConversation(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,
  ): Promise<void> {
    const nodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    let resumeState = nodeOutput._resumeState as Record<string, unknown>;

    // Update execution status to waiting
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
    );

    // Source-of-truth for the waiting payload is `structuredOutputCache` —
    // the canonical NodeHandlerOutput populated when the handler returned.
    const structured = context.structuredOutputCache?.[node.id];
    const structuredOutput = structured?.output as
      | Record<string, unknown>
      | undefined;
    const structuredConfig = structured?.config ?? undefined;

    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      // Persist the canonical structured shape (config/output/meta/status/
      // _resumeState) so REST polling reconciliation surfaces a NodeHandler-
      // Output-compliant document. Falls back to the flat cache for legacy
      // in-flight rows.
      nodeExec.outputData = (structured ?? nodeOutput) as Record<
        string,
        unknown
      >;
      await this.nodeExecutionRepository.save(nodeExec);
    }

    const initialConv = buildConversationConfigFromOutput(structuredOutput);

    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        nodeExecutionId: nodeExec?.id,
        nodeOutput: {
          interactionType: 'ai_conversation',
          ...(structuredConfig && Object.keys(structuredConfig).length > 0
            ? { config: structuredConfig }
            : {}),
          conversationConfig: initialConv,
          // run-results UI 의 References / LLM Usage 탭이 진행 중에도 동작하도록
          // _resumeState 의 누적치를 meta.* 로 펼쳐 노출. _resumeState 자체는
          // system prompt / llmConfigId 등 internal 필드를 포함하므로 client 에
          // 그대로 보내지 않는다.
          meta: buildConversationMetaFromResumeState(resumeState),
        },
        // Include Turn 1 debug data for initial AI response
        turnDebug: {
          llmCalls:
            ((resumeState.turnDebugHistory as unknown[]) ?? [])[0] ?? undefined,
          metadata: {
            model: resumeState.model,
            inputTokens: resumeState.totalInputTokens,
            outputTokens: resumeState.totalOutputTokens,
          },
        },
      },
    );

    // Conversation loop
    let conversationEnded = false;
    while (!conversationEnded) {
      // Wait for user message or end signal (no timeout — external cancel only)
      const userData = await new Promise<unknown>((resolve, reject) => {
        this.pendingContinuations.set(executionId, {
          nodeId: node.id,
          resolve,
          reject,
        });
      });

      const action = userData as Record<string, unknown>;

      if (action.type === 'ai_end_conversation') {
        const endReason = 'user_ended';

        const handler = this.handlerRegistry.get(node.type) as unknown as {
          endMultiTurnConversation: (
            state: Record<string, unknown>,
            endReason: string,
          ) => unknown;
        };

        const finalOutput = handler.endMultiTurnConversation(
          resumeState,
          endReason,
        );

        // Normalize so that both the new NodeHandlerOutput shape (info
        // extractor post Stage 1, which carries its own port/meta) and the
        // legacy bare return (ai_agent) persist uniformly through the
        // structured cache + port selector path.
        const adaptedEnd = adaptHandlerReturn(finalOutput);
        this.contextService.setStructuredOutput(
          executionId,
          node.id,
          adaptedEnd,
        );
        const flatEnd = toEngineFlatShape(adaptedEnd);
        const routedEnd = this.applyPortSelection(flatEnd);
        this.contextService.setNodeOutput(executionId, node.id, routedEnd);
        conversationEnded = true;
      } else if (action.type === 'ai_message') {
        // Process user message via the node's own handler (so both ai_agent
        // and information_extractor can implement conversational extraction
        // with their own domain logic).
        const handler = this.handlerRegistry.get(node.type) as unknown as {
          processMultiTurnMessage: (
            userMessage: string,
            state: Record<string, unknown>,
          ) => Promise<unknown>;
        };
        const result = await handler.processMultiTurnMessage(
          action.message as string,
          resumeState,
        );

        const resultObj = result as Record<string, unknown>;

        if (resultObj.status === 'waiting_for_input') {
          // Run the canonical adapter once so production-strict validation
          // is enforced and the structured cache stays consistent for the
          // next emit cycle / REST polling reconciliation.
          const adaptedNext = adaptHandlerReturn(result);
          this.contextService.setStructuredOutput(
            executionId,
            node.id,
            adaptedNext,
          );
          const flatNext = this.applyPortSelection(
            toEngineFlatShape(adaptedNext),
          );
          this.contextService.setNodeOutput(executionId, node.id, flatNext);

          // Update state for next turn
          resumeState = adaptedNext._resumeState as Record<string, unknown>;

          const adaptedOutput = adaptedNext.output as
            | Record<string, unknown>
            | undefined;
          const adaptedConfig = (adaptedNext.config ?? undefined) as
            | Record<string, unknown>
            | undefined;
          const nextConv = buildConversationConfigFromOutput(adaptedOutput);

          // Emit AI response event (filter system prompts from client).
          // Shape mirrors the terminal-emit branch below so the frontend
          // debug timeline (Response / Request / LLM Usage tabs) can match
          // assistant messages to their LLM calls during live waiting too.
          // The earlier flat fields (lastTurnRequest / lastTurnResponse /
          // lastTurnDurationMs on resumeState) are intentionally not emitted —
          // turnDebugHistory's last entry already carries the same data and
          // additionally preserves the per-call sequence in tool loops.
          this.websocketService.emitExecutionEvent(
            executionId,
            ExecutionEventType.AI_MESSAGE,
            {
              nodeId: node.id,
              message: nextConv.message,
              turnCount: nextConv.turnCount,
              messages: nextConv.messages,
              metadata: {
                model: resumeState.model,
                inputTokens: resumeState.totalInputTokens,
                outputTokens: resumeState.totalOutputTokens,
              },
              ...buildAiMessageDebugFromResumeState(resumeState),
            },
          );

          // Emit waiting_for_input again
          this.websocketService.emitExecutionEvent(
            executionId,
            ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
            {
              status: ExecutionStatus.WAITING_FOR_INPUT,
              waitingNodeId: node.id,
              waitingNodeType: node.type,
              waitingNodeLabel: node.label ?? node.type,
              nodeExecutionId: nodeExec?.id,
              nodeOutput: {
                interactionType: 'ai_conversation',
                // Pass through handler's echoed node config so the Config
                // tab can render during the waiting state. Conversation
                // handlers (AI Agent / Info Extractor multi-turn) add this.
                ...(adaptedConfig && Object.keys(adaptedConfig).length > 0
                  ? { config: adaptedConfig }
                  : {}),
                conversationConfig: nextConv,
                // 진행 중에도 References / LLM Usage 탭이 동작하도록 누적
                // 상태를 meta.* 로 노출. (turn 단위 ragSources 는 turnDebug[]
                // 안에 들어 있어 References 탭이 메시지(턴)별로 그룹핑.)
                meta: buildConversationMetaFromResumeState(resumeState),
              },
            },
          );
        } else {
          // Terminal state — handlers always return canonical
          // `{ config, output, meta, port, status:'ended' }` (built via
          // buildMultiTurnFinalOutput / buildConditionOutput / buildErrorOutput).
          // Route to port and emit the final AI_MESSAGE event.
          const newOutput =
            (resultObj.output as Record<string, unknown> | undefined) ?? {};
          const newResult =
            (newOutput.result as Record<string, unknown> | undefined) ?? {};
          const sourceMessages = Array.isArray(newResult.messages)
            ? (newResult.messages as Array<Record<string, unknown>>)
            : [];
          const condMessages = sourceMessages.filter(
            (m) => m.role !== 'system',
          );
          const responseText = (newResult.response as string | undefined) ?? '';
          const turnCount = newResult.turnCount as number | undefined;
          const metaSource =
            (resultObj.meta as Record<string, unknown> | undefined) ?? {};

          // Shared shape with the waiting_for_input emit above — the helper
          // reads `turnDebugHistory`; the terminal path stores the same array
          // under `meta.turnDebug`, so we adapt the key in-line.
          this.websocketService.emitExecutionEvent(
            executionId,
            ExecutionEventType.AI_MESSAGE,
            {
              nodeId: node.id,
              message: responseText,
              turnCount,
              messages: condMessages,
              metadata: {
                model: metaSource.model,
                inputTokens: metaSource.inputTokens as number | undefined,
                outputTokens: metaSource.outputTokens as number | undefined,
              },
              ...buildAiMessageDebugFromResumeState({
                turnDebugHistory: metaSource.turnDebug,
              }),
            },
          );

          const adaptedConv = adaptHandlerReturn(resultObj);
          this.contextService.setStructuredOutput(
            executionId,
            node.id,
            adaptedConv,
          );
          const portRouted = this.applyPortSelection(
            toEngineFlatShape(adaptedConv),
          );
          this.contextService.setNodeOutput(executionId, node.id, portRouted);
          conversationEnded = true;
        }
      }
    }

    // Update node execution to completed
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      // Persist the canonical structured cache. Terminal handler returns
      // (buildMultiTurnFinalOutput / buildConditionOutput / buildErrorOutput)
      // do not carry _resumeState, but defensively strip it in case a future
      // handler bug leaks it.
      const finalAdapted = context.structuredOutputCache?.[node.id];
      const finalOutput = {
        ...((finalAdapted ?? context.nodeOutputCache[node.id]) as Record<
          string,
          unknown
        >),
      };
      delete finalOutput._resumeState;
      nodeExec.outputData = finalOutput;
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
      await this.nodeExecutionRepository.save(nodeExec);
      this.websocketService.emitNodeEvent(
        executionId,
        node.id,
        NodeEventType.NODE_COMPLETED,
        {
          nodeExecutionId: nodeExec.id,
          parentNodeExecutionId: context.parentNodeExecutionId,
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExec.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExec.outputData,
          input: nodeExec.inputData,
          interactionData: nodeExec.interactionData,
          finishedAt: nodeExec.finishedAt?.toISOString?.(),
        },
      );
    }

    // Transition back to RUNNING
    await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  /**
   * Pause execution at a Presentation node with buttons and wait for user interaction.
   * Transitions Execution → WAITING_FOR_INPUT, emits WS event, awaits Promise.
   * On resume: sets _selectedPort for port routing, transitions back to RUNNING.
   */
  private async waitForButtonInteraction(
    savedExecution: Execution,
    executionId: string,
    node: Node,
    context: ExecutionContext,

    _graphEdges: GraphEdge[],
  ): Promise<void> {
    // Update execution status to waiting
    await this.updateExecutionStatus(
      savedExecution,
      ExecutionStatus.WAITING_FOR_INPUT,
    );

    // Resolve buttonConfig up front so we can persist it on the node execution
    // before releasing control to the user. This means the REST polling
    // reconciler (which reads `nodeExecution.outputData` every 2s) sees the
    // same structured shape the WebSocket delivers — otherwise polling would
    // overwrite the WS-delivered outputData with `null`, making buttons
    // disappear until NODE_COMPLETED fires on the next event.
    const flatNodeOutput = context.nodeOutputCache[node.id] as Record<
      string,
      unknown
    >;
    const structured = context.structuredOutputCache?.[node.id];
    const structuredConfig = structured?.config;
    const buttonConfig = (structuredConfig?.buttonConfig ??
      flatNodeOutput.buttonConfig) as ButtonConfig | undefined;
    if (!buttonConfig || !Array.isArray(buttonConfig.buttons)) {
      throw new Error(
        `MISSING_BUTTON_CONFIG: Node ${node.id} entered waitForButtonInteraction without a buttonConfig`,
      );
    }
    const buttons = buttonConfig.buttons;
    // Prefer the structured NodeHandlerOutput so the frontend receives
    // `config.buttonConfig` (required by presentation renderers) in the first
    // render pass. Legacy (non-migrated) handlers still fall back to the flat
    // cache.
    const nodeOutputForEvent: unknown = structured ?? flatNodeOutput;

    // Update the node execution to waiting_for_input AND persist the output
    // shape so REST polling reconciliation stays consistent with WS.
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      nodeExec.outputData = nodeOutputForEvent as Record<string, unknown>;
      await this.nodeExecutionRepository.save(nodeExec);
    }

    // Emit waiting event so frontend can render buttons
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        waitingNodeLabel: node.label ?? node.type,
        // Surface the DB row id so the frontend's addNodeResult can match
        // the same timeline entry created by NODE_STARTED, preventing a
        // phantom duplicate row when execution resumes.
        nodeExecutionId: nodeExec?.id,
        interactionType: 'buttons',
        buttonConfig: {
          buttons,
          nodeOutput: nodeOutputForEvent,
        },
      },
    );

    // Await user button click indefinitely; external cancel is the only exit.
    const clickData = await new Promise<unknown>((resolve, reject) => {
      this.pendingContinuations.set(executionId, {
        nodeId: node.id,
        resolve,
        reject,
      });
    });

    // Process the interaction result
    const click = clickData as {
      type: string;
      buttonId?: string;
      action?: string;
    };
    const now = new Date().toISOString();

    let selectedPort: string;
    let interactionData: Record<string, unknown>;
    let updatedOutput: Record<string, unknown>;

    // Strip internal fields from nodeOutput for downstream consumption
    // Keep buttonConfig so the execution detail page can render all buttons
    const cleanNodeOutput = { ...flatNodeOutput };
    delete cleanNodeOutput.status;
    delete cleanNodeOutput.interactionType;

    // Resolve selected item for item-level buttons (e.g. carousel per-item buttons)
    const buttonItemMap = buttonConfig.buttonItemMap;
    const structuredOutputObj = structured?.output as
      | Record<string, unknown>
      | undefined;
    const outputItems = (structuredOutputObj?.items ??
      flatNodeOutput.items ??
      cleanNodeOutput.items) as unknown[] | undefined;

    // `interactionData` carries the legacy wire-shape (interactionType +
    // flat fields) used by the WS button event. `structuredInteraction`
    // carries the unified `{type, data, receivedAt}` shape exposed through
    // `$node["X"].output.interaction.*` (CONVENTIONS §4.5).
    let structuredInteraction: {
      type:
        | 'form_submitted'
        | 'button_click'
        | 'button_continue'
        | 'message_received';
      data: Record<string, unknown>;
      receivedAt: string;
    };

    if (click.type === 'button_click') {
      const buttonId = click.buttonId!;
      const clickedButton = buttons.find((b) => b.id === buttonId);

      if (!clickedButton) {
        throw new Error(`INVALID_BUTTON_ID: Button ${buttonId} not found`);
      }

      // Determine selected item for item-level buttons
      const itemIndex =
        buttonItemMap != null ? buttonItemMap[buttonId] : undefined;
      const selectedItem =
        itemIndex != null && outputItems ? outputItems[itemIndex] : undefined;

      if (clickedButton.type === 'port') {
        // Dynamic item buttons have IDs like "{defId}__item_{idx}".
        // Route to the base definition port so editor edges match.
        selectedPort = buttonId.includes('__item_')
          ? buttonId.split('__item_')[0]
          : buttonId;
        interactionData = {
          interactionType: 'button_click',
          buttonId,
          buttonLabel: clickedButton.label,
          clickedAt: now,
        };
        structuredInteraction = {
          type: 'button_click',
          data: {
            buttonId,
            buttonLabel: clickedButton.label,
            ...(selectedItem !== undefined && { selectedItem }),
          },
          receivedAt: now,
        };
        updatedOutput = {
          type: 'button_click',
          buttonId,
          buttonLabel: clickedButton.label,
          clickedAt: now,
          ...(selectedItem !== undefined && { selectedItem }),
          nodeOutput: cleanNodeOutput,
          _selectedPort: selectedPort,
        };
      } else {
        // __continue__ for link-only "Continue" click
        selectedPort = 'continue';
        interactionData = {
          interactionType: 'button_continue',
          clickedAt: now,
        };
        structuredInteraction = {
          type: 'button_continue',
          data: {
            buttonId,
            buttonLabel: clickedButton.label,
            ...(clickedButton.url ? { url: clickedButton.url } : {}),
            ...(selectedItem !== undefined && { selectedItem }),
          },
          receivedAt: now,
        };
        updatedOutput = {
          type: 'button_continue',
          clickedAt: now,
          ...(selectedItem !== undefined && { selectedItem }),
          nodeOutput: cleanNodeOutput,
          _selectedPort: selectedPort,
        };
      }
    } else {
      // Fallback: treat as continue
      selectedPort = 'continue';
      interactionData = {
        interactionType: 'button_continue',
        clickedAt: now,
      };
      structuredInteraction = {
        type: 'button_continue',
        data: {},
        receivedAt: now,
      };
      updatedOutput = {
        type: 'button_continue',
        clickedAt: now,
        nodeOutput: cleanNodeOutput,
        _selectedPort: selectedPort,
      };
    }

    // Update node output cache with port selection. The flat-shape
    // `updatedOutput` carries `_selectedPort` so existing routing logic
    // (applyPortSelection / hasPortMismatch / stripControlFields) keeps
    // operating without changes.
    this.contextService.setNodeOutput(executionId, node.id, updatedOutput);

    // Mirror the interaction result into the structured NodeHandlerOutput
    // cache so `$node["<label>"].output.interaction.buttonId` and
    // `.output.selectedItem` resolve predictably. `setNodeOutput` above
    // already derived a legacy structured view; we overwrite it with a
    // richer shape that preserves the handler's original `config`/`meta`.
    const prevStructured = context.structuredOutputCache?.[node.id];
    const prevConfig = prevStructured?.config ?? {};
    const prevMeta = prevStructured?.meta;
    const rawPrevOutput = prevStructured?.output ?? cleanNodeOutput;
    // Strip any nested `previousOutput` so repeated resume cycles (loops,
    // retries) don't produce `previousOutput.previousOutput.…` chains that
    // grow unbounded in memory and DB rows.
    const prevOutput =
      rawPrevOutput &&
      typeof rawPrevOutput === 'object' &&
      !Array.isArray(rawPrevOutput)
        ? Object.fromEntries(
            Object.entries(rawPrevOutput as Record<string, unknown>).filter(
              ([key]) => key !== 'previousOutput',
            ),
          )
        : rawPrevOutput;
    // Structured output at the resumed tick: previous runtime fields are
    // retained (per CONVENTIONS §4.4 — "immutable snapshot") and
    // `output.interaction` is appended with the unified `{type, data,
    // receivedAt}` shape.
    //
    // `previousOutput` is a legacy transitional field (CONVENTIONS §4.2
    // explicitly marks it for retirement). Do NOT add new consumers — use
    // the top-level runtime fields directly. Removal is tracked as a
    // Phase 3 precondition in `memory/node-specs-improvement-progress.md`.
    const structuredOutputPayload: Record<string, unknown> = {
      ...(prevOutput as Record<string, unknown>),
      interaction: structuredInteraction,
      previousOutput: prevOutput,
    };
    const updatedStructured: NodeHandlerOutput = {
      config: prevConfig,
      output: structuredOutputPayload,
      port: selectedPort,
      status: 'resumed',
      ...(prevMeta !== undefined ? { meta: prevMeta } : {}),
    };
    this.contextService.setStructuredOutput(
      executionId,
      node.id,
      updatedStructured,
    );

    // Update node execution to completed with interaction data
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.COMPLETED;
      nodeExec.outputData = updatedStructured as unknown as Record<
        string,
        unknown
      >;
      nodeExec.interactionData = interactionData;
      nodeExec.finishedAt = new Date();
      nodeExec.durationMs =
        nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
      await this.nodeExecutionRepository.save(nodeExec);
      this.websocketService.emitNodeEvent(
        executionId,
        node.id,
        NodeEventType.NODE_COMPLETED,
        {
          nodeExecutionId: nodeExec.id,
          parentNodeExecutionId: context.parentNodeExecutionId,
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExec.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExec.outputData,
          input: nodeExec.inputData,
          interactionData: nodeExec.interactionData,
          finishedAt: nodeExec.finishedAt?.toISOString?.(),
        },
      );
    }

    // Transition back to RUNNING
    await this.updateExecutionStatus(savedExecution, ExecutionStatus.RUNNING);
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_RESUMED,
      { status: ExecutionStatus.RUNNING },
    );
  }

  private async executeNode(
    executionId: string,
    node: Node,
    nodeInput: unknown,
    context: ExecutionContext,
    executedNodes: Set<string>,
    nodeMap?: Map<string, Node>,
    executionMeta?: { startedAt?: string; mode?: string },
  ): Promise<void> {
    const nodeExecution = await this.createNodeExecution(
      executionId,
      node.id,
      NodeExecutionStatus.RUNNING,
      context.parentNodeExecutionId,
      nodeInput,
    );
    this.websocketService.emitNodeEvent(
      executionId,
      node.id,
      NodeEventType.NODE_STARTED,
      {
        // Surface the DB row id so the frontend can distinguish iterations of
        // the same body node — without this, multiple runs of the same nodeId
        // collapse into one entry in the run-results timeline.
        nodeExecutionId: nodeExecution.id,
        // Sub-Workflow grouping: when the node runs inside an inline
        // Sub-Workflow, the frontend uses this to nest it under the
        // invoking Sub-Workflow row as a card child.
        parentNodeExecutionId: context.parentNodeExecutionId,
        status: NodeExecutionStatus.RUNNING,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
        // Resolved predecessor input — included so the frontend can show
        // input data on the detail panel without a separate REST refetch.
        input: nodeInput,
        startedAt: nodeExecution.startedAt?.toISOString?.(),
      },
    );

    try {
      // Get handler
      const handler = this.handlerRegistry.get(node.type);

      // Validate config
      const validationResult = handler.validate(node.config);
      if (!validationResult.valid) {
        // AI 노드의 'no-llm-provider' 규칙은 schema-level 에서 워크스페이스
        // 컨텍스트를 알 수 없어 항상 발사된다. 프론트엔드 캔버스가
        // hasDefaultLlmConfig 으로 경고를 억제하는 것과 동일한 의미를
        // 실행 시점에 부여하기 위해 워크스페이스에 기본 LLM 이 등록돼 있다면
        // 이 메시지만 필터링한다. 다른 종류의 에러가 함께 있으면 그대로 throw.
        const filteredErrors = await this.filterAiNoLlmProviderError(
          node.type,
          validationResult.errors,
          context,
        );
        if (filteredErrors.length > 0) {
          // noinspection ExceptionCaughtLocallyJS — intentional: delegates to the catch block's error policy handler
          throw new Error(`INVALID_NODE_CONFIG: ${filteredErrors.join(', ')}`);
        }
      }

      // Resolve expressions in config
      let resolvedConfig: Record<string, unknown>;
      let nodeContext = context;
      if (nodeMap) {
        const exprContext = this.expressionResolver.buildExpressionContext(
          nodeInput,
          context,
          nodeMap,
          executionMeta,
        );

        // For template nodes, spread input data as root-level variables
        // so that {{ name }} works in addition to {{ $input.name }}.
        // This must run after buildExpressionContext() which populates
        // the built-in $-prefixed variables that take precedence.
        if (
          node.type === 'template' &&
          typeof nodeInput === 'object' &&
          nodeInput !== null &&
          !Array.isArray(nodeInput)
        ) {
          for (const [key, value] of Object.entries(
            nodeInput as Record<string, unknown>,
          )) {
            if (!Object.hasOwn(exprContext, key)) {
              exprContext[key] = value;
            }
          }
        }

        resolvedConfig = this.expressionResolver.resolveConfig(
          node.config,
          exprContext,
          node.type,
        );

        // Store expression context for handlers that need per-item evaluation (e.g. Table)
        // Use a shallow copy to avoid mutating the shared context object
        nodeContext = { ...context, expressionContext: exprContext };
      } else {
        resolvedConfig = node.config;
      }

      // Thread the current NodeExecution id + logical node id into the
      // context so handlers can attribute side-effects (e.g.
      // IntegrationUsageLog) to the row and emit WS events keyed by the
      // graph node (AI Agent's tool_call_*).
      nodeContext = {
        ...nodeContext,
        nodeId: node.id,
        nodeExecutionId: nodeExecution.id,
      };

      // Execute with potential retry
      const output = await this.executeWithRetry(
        handler,
        nodeInput,
        resolvedConfig,
        nodeContext,
        node,
        nodeExecution,
      );

      // Normalize handler return into the unified NodeHandlerOutput shape.
      // Structured cache powers `$node[X].config/.output/.meta/.port/.status`
      // expressions; the flat cache preserves pre-migration engine internals.
      const adapted = adaptHandlerReturn(output);
      this.contextService.setStructuredOutput(executionId, node.id, adapted);
      const flatForCache = toEngineFlatShape(adapted);

      // If handler returned port-based output ({ port, data }), set _selectedPort
      // so that downstream routing filters edges correctly.
      const finalOutput = this.applyPortSelection(flatForCache);
      this.contextService.setNodeOutput(executionId, node.id, finalOutput);
      executedNodes.add(node.id);

      // Check if this is a blocking node (waiting_for_input).
      // If so, defer NODE_COMPLETED — it will be emitted after user interaction.
      // Emitting it now would cause the frontend to mark the node as done
      // before the WAITING_FOR_INPUT event arrives.
      const isBlocking =
        output &&
        typeof output === 'object' &&
        (output as Record<string, unknown>).status === 'waiting_for_input';

      if (!isBlocking) {
        // Update node execution record
        nodeExecution.status = NodeExecutionStatus.COMPLETED;
        nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
        nodeExecution.finishedAt = new Date();
        nodeExecution.durationMs =
          nodeExecution.finishedAt.getTime() -
          nodeExecution.startedAt.getTime();
        await this.nodeExecutionRepository.save(nodeExecution);
        this.websocketService.emitNodeEvent(
          executionId,
          node.id,
          NodeEventType.NODE_COMPLETED,
          {
            nodeExecutionId: nodeExecution.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.COMPLETED,
            duration: nodeExecution.durationMs,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
            output: nodeExecution.outputData,
            input: nodeExecution.inputData,
            finishedAt: nodeExecution.finishedAt?.toISOString?.(),
          },
        );
      } else {
        // Save output for blocking nodes (waitForButtonInteraction will update status)
        nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
        await this.nodeExecutionRepository.save(nodeExecution);
      }

      // Update execution path — serialized per execution to tolerate
      // ParallelExecutor branches finishing concurrently.
      await this.appendExecutionPath(executionId, node.id);
    } catch (error: unknown) {
      // Apply error policy
      const errorPolicyConfig = this.getErrorPolicyConfig(node);
      const result = this.errorPolicyHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorPolicyConfig,
        nodeExecution.retryCount,
      );

      switch (result.action) {
        case 'skip':
          nodeExecution.status = NodeExecutionStatus.SKIPPED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          this.websocketService.emitNodeEvent(
            executionId,
            node.id,
            NodeEventType.NODE_SKIPPED,
            {
              nodeExecutionId: nodeExecution.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.SKIPPED,
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
              error: nodeExecution.error.message,
              input: nodeExecution.inputData,
              finishedAt: nodeExecution.finishedAt?.toISOString?.(),
            },
          );
          executedNodes.add(node.id);
          break;

        case 'use_default':
          this.contextService.setNodeOutput(
            executionId,
            node.id,
            result.output,
          );
          nodeExecution.status = NodeExecutionStatus.COMPLETED;
          nodeExecution.outputData =
            (result.output as Record<string, unknown>) ?? {};
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          executedNodes.add(node.id);
          break;

        case 'route_error':
          this.contextService.setNodeOutput(
            executionId,
            node.id,
            result.output,
          );
          nodeExecution.status = NodeExecutionStatus.FAILED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          executedNodes.add(node.id);
          break;

        case 'stop':
        default:
          nodeExecution.status = NodeExecutionStatus.FAILED;
          nodeExecution.error = {
            message: error instanceof Error ? error.message : String(error),
          };
          nodeExecution.finishedAt = new Date();
          nodeExecution.durationMs =
            nodeExecution.finishedAt.getTime() -
            nodeExecution.startedAt.getTime();
          await this.nodeExecutionRepository.save(nodeExecution);
          this.websocketService.emitNodeEvent(
            executionId,
            node.id,
            NodeEventType.NODE_FAILED,
            {
              nodeExecutionId: nodeExecution.id,
              parentNodeExecutionId: context.parentNodeExecutionId,
              status: NodeExecutionStatus.FAILED,
              error: error instanceof Error ? error.message : String(error),
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
              input: nodeExecution.inputData,
              finishedAt: nodeExecution.finishedAt?.toISOString?.(),
            },
          );
          throw error;
      }
    }
  }

  /**
   * AI 노드(ai_agent / text_classifier / information_extractor) 의 schema 가
   * declarative 로 fire 시키는 `no-llm-provider` 메시지를, 워크스페이스에 기본
   * LLM 이 등록돼 있을 때 한정해 필터링한다.
   *
   * 캔버스에서 hasDefaultLlmConfig === true 일 때 동일 경고를 억제하는 것과
   * 의미를 일치시키기 위함이다. 다른 에러 메시지가 함께 있으면 그대로 두고,
   * 후처리 후에도 남은 에러가 있으면 호출부에서 INVALID_NODE_CONFIG 로 throw 한다.
   *
   * @param nodeType 노드 타입 (AI 노드 3종이 아니면 즉시 통과)
   * @param errors handler.validate 가 반환한 blocking error 배열
   * @param context 실행 컨텍스트. `variables.__workspaceId` 에서 워크스페이스
   *   ID 를 읽는다. 이 필드는 `runExecution` 이 DB 의 `workflow.workspaceId`
   *   로부터 직접 채우며 (server-trusted), 사용자 입력으로 덮어쓰지 않는다 —
   *   AI 핸들러들도 동일 출처를 쓴다.
   *
   * Fail-safe: hasDefaultLlmConfig 호출이 throw 하면 원본 errors 를 그대로
   * 반환해 INVALID_NODE_CONFIG 가 정상 발사되도록 한다 (DB 장애가 노드 실행
   * 오류로 "변형" 되는 것을 막는다 — 명시적 검증 실패가 더 안전).
   *
   * 캐싱: 동일 실행 안에서 N 개 AI 노드가 들어있어도 DB findDefault 는 1 회만
   * 일어나도록 `context.variables[__hasDefaultLlmConfig:<wsId>]` 에 결과를
   * 메모이즈한다 (N+1 회피).
   */
  private async filterAiNoLlmProviderError(
    nodeType: string,
    errors: string[],
    context: ExecutionContext,
  ): Promise<string[]> {
    if (!AI_LLM_PROVIDER_NODE_TYPES.has(nodeType)) return errors;
    if (!errors.includes(AI_NO_LLM_PROVIDER_MESSAGE)) return errors;
    const workspaceId =
      (context.variables?.__workspaceId as string | undefined) || '';
    if (!workspaceId) return errors;
    let hasDefault: boolean;
    try {
      hasDefault = await this.resolveHasDefaultLlmConfigCached(
        workspaceId,
        context,
      );
    } catch (e) {
      this.logger.warn(
        `filterAiNoLlmProviderError: hasDefaultLlmConfig lookup failed (workspaceId=${workspaceId}); keeping original validation errors. ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return errors;
    }
    if (!hasDefault) return errors;
    return errors.filter((err) => err !== AI_NO_LLM_PROVIDER_MESSAGE);
  }

  private async resolveHasDefaultLlmConfigCached(
    workspaceId: string,
    context: ExecutionContext,
  ): Promise<boolean> {
    const cacheKey = `__hasDefaultLlmConfig:${workspaceId}`;
    const cached = context.variables?.[cacheKey];
    if (typeof cached === 'boolean') return cached;
    const hasDefault = await this.llmService.hasDefaultLlmConfig(workspaceId);
    if (context.variables) {
      context.variables[cacheKey] = hasDefault;
    }
    return hasDefault;
  }

  private async executeWithRetry(
    handler: NodeHandler,
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
    node: Node,
    nodeExecution: NodeExecution,
  ): Promise<unknown> {
    const errorPolicyConfig = this.getErrorPolicyConfig(node);

    if (errorPolicyConfig.policy !== 'retry') {
      return handler.execute(input, config, context);
    }

    const retryConfig = errorPolicyConfig.retryConfig ?? {
      maxRetries: 3,
      retryInterval: 1000,
      backoffMultiplier: 2,
    };

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await handler.execute(input, config, context);
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        nodeExecution.retryCount = attempt + 1;

        if (attempt < retryConfig.maxRetries) {
          const delay =
            retryConfig.retryInterval *
            Math.pow(retryConfig.backoffMultiplier, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('All retry attempts exhausted');
  }

  private getErrorPolicyConfig(node: Node): ErrorPolicyConfig {
    const config = node.config ?? {};
    const errorHandling = config['errorHandling'] as
      | Record<string, unknown>
      | undefined;

    if (!errorHandling) {
      return { policy: 'stop_workflow' };
    }

    return {
      policy:
        (errorHandling['policy'] as ErrorPolicyConfig['policy']) ??
        'stop_workflow',
      defaultOutput: errorHandling['defaultOutput'],
      retryConfig: errorHandling['retryConfig'] as
        | ErrorPolicyConfig['retryConfig']
        | undefined,
    };
  }

  private gatherNodeInput(
    nodeId: string,
    edges: GraphEdge[],
    executedNodes: Set<string>,
    nodeOutputCache: Record<string, unknown>,
    workflowInput: unknown,
  ): unknown {
    // Find all incoming edges
    const incomingEdges = edges.filter((e) => e.targetNodeId === nodeId);

    if (incomingEdges.length === 0) {
      // Start node - use workflow input
      return workflowInput;
    }

    if (incomingEdges.length === 1) {
      const sourceId = incomingEdges[0].sourceNodeId;
      if (executedNodes.has(sourceId)) {
        const sourceOutput = nodeOutputCache[sourceId];
        // Port-aware filtering: if source has _selectedPort, only pass data
        // if the edge's sourcePort matches the selected port
        if (this.isPortFiltered(sourceOutput, incomingEdges[0].sourcePort)) {
          return undefined;
        }
        return this.stripControlFields(sourceOutput);
      }
      // No executed predecessor (e.g., back-edge target on first run) → use workflow input
      return workflowInput;
    }

    // Multiple inputs - merge into object keyed by source node ID
    const merged: Record<string, unknown> = {};
    let hasAnyInput = false;
    for (const edge of incomingEdges) {
      if (executedNodes.has(edge.sourceNodeId)) {
        const sourceOutput = nodeOutputCache[edge.sourceNodeId];
        // Port-aware filtering for multi-input nodes
        if (this.isPortFiltered(sourceOutput, edge.sourcePort)) {
          continue;
        }
        merged[edge.sourceNodeId] = this.stripControlFields(sourceOutput);
        hasAnyInput = true;
      }
    }
    // If no predecessor has produced output yet (e.g., all incoming are back-edges
    // and none have executed), fall back to workflow input
    return hasAnyInput ? merged : workflowInput;
  }

  /**
   * If a handler returned { port, data, ... }, convert to { ...data, _selectedPort }
   * so downstream routing can filter edges by port.
   * Extra root-level fields (e.g. expression, value) are preserved for the execution record.
   */
  private applyPortSelection(output: unknown): unknown {
    if (
      output &&
      typeof output === 'object' &&
      'port' in output &&
      'data' in output
    ) {
      const { port, data, ...extra } = output as Record<string, unknown>;
      const base =
        data && typeof data === 'object'
          ? (data as Record<string, unknown>)
          : {};
      return { ...base, ...extra, _selectedPort: port };
    }
    return output;
  }

  /**
   * Check if a source output should be filtered based on port selection.
   * Returns true if the output has _selectedPort and it doesn't match the edge's sourcePort.
   * Supports both single port (string) and multi-port (string[]) selection.
   */
  private isPortFiltered(
    sourceOutput: unknown,
    edgeSourcePort: string,
  ): boolean {
    if (
      sourceOutput &&
      typeof sourceOutput === 'object' &&
      '_selectedPort' in (sourceOutput as Record<string, unknown>)
    ) {
      const selectedPort = (sourceOutput as Record<string, unknown>)
        ._selectedPort;
      if (Array.isArray(selectedPort)) {
        return (
          selectedPort.length > 0 && !selectedPort.includes(edgeSourcePort)
        );
      }
      return edgeSourcePort !== selectedPort;
    }
    return false;
  }

  /**
   * Strip routing / lifecycle control fields from output before passing it
   * as input to the next node.
   *
   * These fields are metadata for the current node's engine-level bookkeeping
   * and must not leak into downstream `$input`:
   *  - `_selectedPort`: routing marker for the current node's outgoing edges.
   *    Leaking it causes pass-through successors (e.g. Variable) to have
   *    their own successors incorrectly skipped.
   *  - `port`: handler's declared output port. Leaking it into downstream
   *    `output: input` pass-throughs makes the adapter think a stale port
   *    is the new node's routing decision.
   *  - `status`: lifecycle marker (`waiting_for_input` / `resumed` / `ended`).
   *    Leaking `"resumed"` confuses blocking detection on successors.
   *  - `_resumeState`: per-node interaction state. Strictly owned by the
   *    node that emitted it.
   *
   * The `structuredOutputCache` (what `$node["X"].port` resolves against)
   * is not touched — downstream expressions can still read the predecessor's
   * control fields explicitly by node reference.
   */
  private stripControlFields(output: unknown): unknown {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
      return output;
    }
    const o = output as Record<string, unknown>;
    if (
      !('_selectedPort' in o) &&
      !('port' in o) &&
      !('status' in o) &&
      !('_resumeState' in o)
    ) {
      return output;
    }
    const {
      _selectedPort: _sp,
      port: _p,
      status: _st,
      _resumeState: _rs,
      ...rest
    } = o;
    void _sp;
    void _p;
    void _st;
    void _rs;
    return rest;
  }

  /**
   * Check if any back-edge from the given source node should be activated.
   * A back-edge is activated when its sourcePort matches the selected port
   * (or the source has no port selection at all).
   */
  private findActivatedBackEdge(
    sourceNodeId: string,
    backEdges: Array<{ edge: GraphEdge; targetIndex: number }>,
    nodeOutputCache: Record<string, unknown>,
  ): { edge: GraphEdge; targetIndex: number } | null {
    const sourceOutput = nodeOutputCache[sourceNodeId];
    for (const backEdge of backEdges) {
      if (!this.isPortFiltered(sourceOutput, backEdge.edge.sourcePort)) {
        return backEdge;
      }
    }
    return null;
  }

  /**
   * After a node executes, propagate reachability to downstream nodes
   * through edges whose sourcePort matches the node's _selectedPort.
   * If the node has no _selectedPort, all outgoing edges are activated.
   * Note: disabled nodes must NOT call this method — caller responsibility.
   */
  private propagateReachability(
    nodeId: string,
    outgoingEdgeMap: Map<string, GraphEdge[]>,
    nodeOutputCache: Record<string, unknown>,
    reachable: Set<string>,
  ): void {
    const sourceOutput = nodeOutputCache[nodeId];
    const outgoingEdges = outgoingEdgeMap.get(nodeId) ?? [];
    for (const edge of outgoingEdges) {
      if (this.isPortFiltered(sourceOutput, edge.sourcePort)) {
        continue;
      }
      reachable.add(edge.targetNodeId);
    }
  }

  /**
   * Execute the body subgraph of a container node for a single iteration.
   *
   * Phase 1 behavior:
   * - Runs the body children in topological order.
   * - Supports port-based routing and unreachable branch skipping.
   * - Does NOT support back-edges inside the body or blocking nodes
   *   (form/buttons/ai_conversation) — both raise an error if encountered.
   * - Collects leaf-node outputs per spec §3.1.2: single leaf → value as-is,
   *   multiple leaves → merged object keyed by nodeId. Phase 2 replaces this
   *   with explicit emit-port collection.
   */
  private async executeContainerBody(
    containerNode: Node,
    plan: ContainerBodyPlan,
    allNodes: Node[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    iterInput: unknown,
  ): Promise<unknown> {
    const {
      childIds,
      bodyEntryNodeIds,
      emitSourceNodeId,
      internalEdges,
      sortedNodeIds,
      outgoingEdgeMap,
    } = plan;
    if (sortedNodeIds.length === 0) {
      return undefined;
    }
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Seed reachability: body entry nodes OR (if none via port) children
    // with no incoming internal edge.
    const reachable = new Set<string>();
    if (bodyEntryNodeIds.size > 0) {
      for (const id of bodyEntryNodeIds) {
        if (childIds.has(id)) reachable.add(id);
      }
    } else {
      const childrenWithIncoming = new Set(
        internalEdges.map((e) => e.targetNodeId),
      );
      for (const id of sortedNodeIds) {
        if (!childrenWithIncoming.has(id)) reachable.add(id);
      }
    }

    for (const nodeId of sortedNodeIds) {
      if (!reachable.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      if (node.isDisabled) {
        const skipped = await this.createNodeExecution(
          executionId,
          nodeId,
          NodeExecutionStatus.SKIPPED,
          context.parentNodeExecutionId,
        );
        this.websocketService.emitNodeEvent(
          executionId,
          nodeId,
          NodeEventType.NODE_SKIPPED,
          {
            nodeExecutionId: skipped.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.SKIPPED,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
          },
        );
        executedNodes.add(nodeId);
        continue;
      }

      const nodeInput = this.gatherNodeInput(
        nodeId,
        internalEdges,
        executedNodes,
        context.nodeOutputCache,
        iterInput,
      );

      await this.executeNode(
        executionId,
        node,
        nodeInput,
        context,
        executedNodes,
        nodeMap,
        executionMeta,
      );

      const nodeOutput = context.nodeOutputCache[node.id] as
        | Record<string, unknown>
        | undefined;
      if (nodeOutput?.status === 'waiting_for_input') {
        throw new Error(
          `Blocking node "${node.label ?? node.type}" inside container "${containerNode.label ?? containerNode.type}" is not supported.`,
        );
      }

      this.propagateReachability(
        nodeId,
        outgoingEdgeMap,
        context.nodeOutputCache,
        reachable,
      );
    }

    // If the emit source didn't run this iteration (e.g. port routing
    // short-circuited before reaching it), there is no collectable value.
    // Returning undefined avoids leaking stale output from a previous iter.
    if (!reachable.has(emitSourceNodeId)) {
      return undefined;
    }
    return context.nodeOutputCache[emitSourceNodeId];
  }

  /**
   * Resolve the container body plan: child nodes, internal edges, body entry
   * points, emit source. Validated once at the start of {@link runContainer}
   * so every iteration shares the same wiring and errors surface upfront.
   */
  /**
   * Walk the containerId chain from each container's children upward to make
   * sure no container is its own (transitive) ancestor. Throws when a cycle
   * is found so the engine surfaces a stable, named error instead of looping.
   */
  private assertNoContainerCycle(containerNode: Node, allNodes: Node[]): void {
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    for (const node of allNodes) {
      if (node.containerId !== containerNode.id) continue;
      const visited = new Set<string>();
      let cursor: Node | undefined = node;
      while (cursor?.containerId) {
        if (visited.has(cursor.id)) {
          throw new Error(
            `CONTAINER_CYCLE: Container "${containerNode.label ?? containerNode.type}" is part of a containerId cycle involving node "${cursor.label ?? cursor.type}".`,
          );
        }
        visited.add(cursor.id);
        cursor = byId.get(cursor.containerId);
      }
    }
  }

  private planContainerBody(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
  ): ContainerBodyPlan {
    // Detect a containerId cycle (e.g. A.containerId=B && B.containerId=A)
    // before doing any work so the user gets a clear error instead of an
    // infinite loop or stack overflow.
    this.assertNoContainerCycle(containerNode, allNodes);

    const children = allNodes.filter((n) => n.containerId === containerNode.id);
    const childIds = new Set(children.map((c) => c.id));

    // Trigger nodes can never live inside a container body — their semantics
    // (workflow entry point) conflict with iterative re-execution.
    const triggerChild = children.find(
      (n) => n.category === NodeCategory.TRIGGER,
    );
    if (triggerChild) {
      throw new Error(
        `CONTAINER_INVALID_CHILD: Trigger node "${triggerChild.label ?? triggerChild.type}" cannot be placed inside container "${containerNode.label ?? containerNode.type}".`,
      );
    }

    const bodyEntryNodeIds = new Set(
      allEdges
        .filter(
          (e) => e.sourceNodeId === containerNode.id && e.sourcePort === 'body',
        )
        .map((e) => e.targetNodeId),
    );

    // Emit edges: source is a child, target is the container itself with
    // targetPort='emit'. Exactly one is required — multiple or zero would
    // be ambiguous and are rejected upfront.
    const emitEdges = allEdges.filter(
      (e) =>
        e.targetNodeId === containerNode.id &&
        e.targetPort === 'emit' &&
        childIds.has(e.sourceNodeId),
    );
    if (emitEdges.length === 0) {
      // Distinguish "wire missing" from "wire present but the source isn't
      // tagged as a body child" — the latter is the more common gotcha and
      // pointing the user at the offending node + container assignment helps
      // them recover quickly.
      const orphanEmitEdges = allEdges.filter(
        (e) => e.targetNodeId === containerNode.id && e.targetPort === 'emit',
      );
      if (orphanEmitEdges.length > 0) {
        const sourceLabels = orphanEmitEdges
          .map((e) => {
            const sourceNode = allNodes.find((n) => n.id === e.sourceNodeId);
            return sourceNode?.label ?? sourceNode?.type ?? e.sourceNodeId;
          })
          .join(', ');
        throw new Error(
          `CONTAINER_MISSING_EMIT: Container "${containerNode.label ?? containerNode.type}" has an "emit" wire from "${sourceLabels}" but that node isn't a body child of this container. Open its settings panel and set its "Container" to "${containerNode.label ?? containerNode.type}".`,
        );
      }
      throw new Error(
        `CONTAINER_MISSING_EMIT: Container "${containerNode.label ?? containerNode.type}" has no body node wired to its "emit" port. Connect the node whose output should be collected.`,
      );
    }
    if (emitEdges.length > 1) {
      throw new Error(
        `CONTAINER_MULTIPLE_EMIT: Container "${containerNode.label ?? containerNode.type}" has ${emitEdges.length} nodes wired to its "emit" port. Only one emit source is allowed.`,
      );
    }
    const emitSourceNodeId = emitEdges[0].sourceNodeId;

    const internalEdges: GraphEdge[] = allEdges
      .filter(
        (e) => childIds.has(e.sourceNodeId) && childIds.has(e.targetNodeId),
      )
      .map((e) => ({
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort,
        targetNodeId: e.targetNodeId,
        targetPort: e.targetPort,
      }));

    const graphNodes = children.map((n) => ({ id: n.id }));
    const { forwardEdges, backEdges } = identifyBackEdges(
      graphNodes,
      internalEdges,
    );
    if (backEdges.length > 0) {
      throw new Error(
        `Container "${containerNode.label ?? containerNode.type}" body contains back-edges, which are not yet supported inside containers.`,
      );
    }
    const sortedNodeIds = topologicalSort(graphNodes, forwardEdges);

    const outgoingEdgeMap = new Map<string, GraphEdge[]>();
    for (const edge of internalEdges) {
      const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      outgoingEdgeMap.set(edge.sourceNodeId, list);
    }

    return {
      childIds,
      bodyEntryNodeIds,
      emitSourceNodeId,
      internalEdges,
      sortedNodeIds,
      outgoingEdgeMap,
    };
  }

  /**
   * After a Background node executes (handler returned `port: 'main'`),
   * snapshot the current execution context and enqueue the `background`-port
   * body subgraph for asynchronous execution. The main flow continues without
   * waiting. Failures inside the body never affect the main execution.
   */
  private async scheduleBackgroundBody(
    node: Node,
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    mainInput: unknown,
  ): Promise<void> {
    const bodyEntryNodeIds = allEdges
      .filter(
        (e) => e.sourceNodeId === node.id && e.sourcePort === 'background',
      )
      .map((e) => e.targetNodeId);
    if (bodyEntryNodeIds.length === 0) return;

    const config = (node.config ?? {}) as {
      notifyOnFailure?: boolean;
      maxDurationMs?: number;
    };

    // Resolve the Background node's NodeExecution id so children can be
    // grouped under it in the timeline.
    const parentNodeExecution = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    const parentNodeExecutionId = parentNodeExecution?.id ?? '';

    const workspaceId =
      typeof context.expressionContext?.workspaceId === 'string'
        ? context.expressionContext.workspaceId
        : '';

    // Snapshot relevant context. Shallow-clone is enough — the body
    // executes against these values, and any mutations the main flow makes
    // afterwards stay isolated to the main flow.
    const job: BackgroundExecutionJob = {
      executionId,
      parentNodeExecutionId,
      workspaceId,
      workflowId: context.workflowId,
      bodyEntryNodeIds,
      input: mainInput,
      variables: { ...context.variables },
      nodeOutputCache: { ...context.nodeOutputCache },
      expressionContext: { ...(context.expressionContext ?? {}) },
      config: {
        notifyOnFailure: config.notifyOnFailure === true,
        maxDurationMs:
          typeof config.maxDurationMs === 'number' && config.maxDurationMs >= 0
            ? config.maxDurationMs
            : 300000,
      },
    };

    await this.backgroundQueue.add('background-run', job, {
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  /**
   * Run a Background node's body subgraph. Called by the BullMQ processor
   * with the snapshot captured at enqueue time. Reuses {@link executeInline}
   * with `entryNodeIds` so the existing scheduler/topo-sort handles
   * traversal — we just rebuild the context and apply the timeout.
   */
  async executeBackgroundSubgraph(job: BackgroundExecutionJob): Promise<void> {
    const context = this.contextService.createContext(
      job.executionId,
      job.workflowId,
    );
    context.variables = { ...job.variables };
    context.nodeOutputCache = { ...job.nodeOutputCache };
    context.expressionContext = { ...job.expressionContext };

    const run = this.executeInline(job.workflowId, job.input, {
      executionId: job.executionId,
      context,
      executedNodes: new Set<string>(),
      recursionDepth: 0,
      parentNodeExecutionId: job.parentNodeExecutionId || undefined,
      entryNodeIds: job.bodyEntryNodeIds,
    });

    if (job.config.maxDurationMs > 0) {
      await Promise.race([
        run,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Background body exceeded maxDurationMs (${job.config.maxDurationMs}ms)`,
                ),
              ),
            job.config.maxDurationMs,
          ),
        ),
      ]);
    } else {
      await run;
    }
  }

  /**
   * Compute per-branch subgraph plans for a Parallel node.
   *
   * Strategy: for each `branch_N` port of the Parallel node, BFS forward
   * across `forwardEdges` to collect reachable nodes. A node reached from
   * multiple branches is a join (Merge) and excluded from every branch
   * body; a node reached from exactly one branch is in that branch's body.
   *
   * Fails fast with `PARALLEL_INVALID_CHILD` / `PARALLEL_BACK_EDGE` /
   * `PARALLEL_NESTED_NOT_SUPPORTED` so the user sees a named error at
   * dispatch time instead of a mid-flight surprise.
   */
  private planParallelBody(
    parallelNode: Node,
    allNodes: Node[],
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    branchCount: number,
  ): ParallelPlan {
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const forwardAdj = new Map<string, GraphEdge[]>();
    for (const edge of forwardEdges) {
      const list = forwardAdj.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      forwardAdj.set(edge.sourceNodeId, list);
    }

    // Direct `branch_N` targets — branch entry points.
    const branchEntries: Set<string>[] = Array.from(
      { length: branchCount },
      () => new Set<string>(),
    );
    const parallelOutgoing = forwardAdj.get(parallelNode.id) ?? [];
    for (const edge of parallelOutgoing) {
      const match = /^branch_(\d+)$/.exec(edge.sourcePort);
      if (!match) continue;
      const idx = Number(match[1]);
      if (idx >= 0 && idx < branchCount) {
        branchEntries[idx].add(edge.targetNodeId);
      }
    }

    // Forward-BFS reach set from each branch's entries, staying strictly
    // within the DAG (back-edges are excluded so we never loop).
    const reachPerBranch: Set<string>[] = branchEntries.map(() => new Set());
    for (let i = 0; i < branchCount; i++) {
      const queue = [...branchEntries[i]];
      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (nodeId === undefined) break;
        if (reachPerBranch[i].has(nodeId)) continue;
        reachPerBranch[i].add(nodeId);
        for (const edge of forwardAdj.get(nodeId) ?? []) {
          if (!reachPerBranch[i].has(edge.targetNodeId)) {
            queue.push(edge.targetNodeId);
          }
        }
      }
    }

    // Ownership: which branches reach each node.
    const owners = new Map<string, Set<number>>();
    for (let i = 0; i < branchCount; i++) {
      for (const id of reachPerBranch[i]) {
        const set = owners.get(id) ?? new Set<number>();
        set.add(i);
        owners.set(id, set);
      }
    }

    const joinNodeIds = new Set<string>();
    const allBodyNodeIds = new Set<string>();
    for (const [id, set] of owners) {
      if (set.size > 1) joinNodeIds.add(id);
      else allBodyNodeIds.add(id);
    }

    // Back-edges inside any branch body are rejected to keep semantics
    // consistent with the Container pattern (which also forbids cyclic bodies).
    for (const edge of backEdges) {
      if (
        allBodyNodeIds.has(edge.sourceNodeId) ||
        allBodyNodeIds.has(edge.targetNodeId)
      ) {
        throw new Error(
          `PARALLEL_BACK_EDGE: Parallel node "${parallelNode.label ?? parallelNode.type}" body contains back-edges, which are not supported.`,
        );
      }
    }

    const branches: ParallelBranchPlan[] = [];
    for (let i = 0; i < branchCount; i++) {
      const bodyNodeIds = new Set<string>();
      for (const id of reachPerBranch[i]) {
        if (allBodyNodeIds.has(id)) bodyNodeIds.add(id);
      }

      // Reject disallowed child types inside this branch body.
      for (const id of bodyNodeIds) {
        const node = nodeMap.get(id);
        if (!node) continue;
        if (node.type === 'parallel') {
          throw new Error(
            `PARALLEL_NESTED_NOT_SUPPORTED: Parallel node "${parallelNode.label ?? parallelNode.type}" body contains nested Parallel node "${node.label ?? node.type}". Nested Parallel is reserved for a later phase.`,
          );
        }
        if (
          node.type === 'form' ||
          node.type === 'buttons' ||
          node.type === 'ai_conversation'
        ) {
          throw new Error(
            `PARALLEL_INVALID_CHILD: Blocking node "${node.label ?? node.type}" inside Parallel node "${parallelNode.label ?? parallelNode.type}" is not supported.`,
          );
        }
      }

      const internalEdges = forwardEdges.filter(
        (e) =>
          bodyNodeIds.has(e.sourceNodeId) && bodyNodeIds.has(e.targetNodeId),
      );
      const graphNodes = Array.from(bodyNodeIds).map((id) => ({ id }));
      const sortedNodeIds = topologicalSort(graphNodes, internalEdges);

      const outgoingEdgeMap = new Map<string, GraphEdge[]>();
      for (const edge of internalEdges) {
        const list = outgoingEdgeMap.get(edge.sourceNodeId) ?? [];
        list.push(edge);
        outgoingEdgeMap.set(edge.sourceNodeId, list);
      }

      // Exit nodes: body nodes whose outgoing edges leave the body (typically
      // into a join node such as a Merge). Used after dispatch to propagate
      // reachability into the main loop's `reachable` set.
      const exitNodeIds = new Set<string>();
      for (const id of bodyNodeIds) {
        const out = forwardAdj.get(id) ?? [];
        for (const edge of out) {
          if (!bodyNodeIds.has(edge.targetNodeId)) {
            exitNodeIds.add(id);
            break;
          }
        }
        // A body node with no outgoing edges at all is still a terminal leaf;
        // no propagation needed, so we don't add it to exitNodeIds.
      }

      branches.push({
        branchIndex: i,
        branchPort: `branch_${i}`,
        bodyNodeIds,
        sortedNodeIds,
        entryNodeIds: branchEntries[i],
        exitNodeIds,
        internalEdges,
        outgoingEdgeMap,
      });
    }

    return { branches, joinNodeIds, allBodyNodeIds };
  }

  /**
   * Execute a single branch's body subgraph sequentially — the engine runs
   * branches *between* each other in parallel (via ParallelExecutor), but
   * each branch's own nodes remain in topological order inside the branch.
   *
   * Mirrors {@link executeContainerBody}: seeds reachability with the branch
   * entry nodes, routes by port, and rejects any blocking node encountered
   * mid-flight (validation in {@link planParallelBody} covers statically-
   * declared blocking nodes; this guards against ones emitted via
   * `waiting_for_input` at runtime).
   */
  private async executeParallelBranchBody(
    parallelNode: Node,
    plan: ParallelBranchPlan,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    branchInput: unknown,
  ): Promise<void> {
    if (plan.sortedNodeIds.length === 0) return;
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    const reachable = new Set<string>();
    for (const id of plan.entryNodeIds) {
      if (plan.bodyNodeIds.has(id)) reachable.add(id);
    }

    for (const nodeId of plan.sortedNodeIds) {
      if (!reachable.has(nodeId)) continue;
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      if (node.isDisabled) {
        const skipped = await this.createNodeExecution(
          executionId,
          nodeId,
          NodeExecutionStatus.SKIPPED,
          context.parentNodeExecutionId,
        );
        this.websocketService.emitNodeEvent(
          executionId,
          nodeId,
          NodeEventType.NODE_SKIPPED,
          {
            nodeExecutionId: skipped.id,
            parentNodeExecutionId: context.parentNodeExecutionId,
            status: NodeExecutionStatus.SKIPPED,
            nodeType: node.type,
            nodeLabel: node.label ?? node.type,
          },
        );
        executedNodes.add(nodeId);
        continue;
      }

      const nodeInput = this.gatherNodeInput(
        nodeId,
        plan.internalEdges,
        executedNodes,
        context.nodeOutputCache,
        branchInput,
      );

      await this.executeNode(
        executionId,
        node,
        nodeInput,
        context,
        executedNodes,
        nodeMap,
        executionMeta,
      );

      // Container dispatch inside a branch body — mirrors the main loop so
      // ForEach/Loop/Map inside a Parallel branch still iterates its body.
      if (
        node.type === 'foreach' ||
        node.type === 'loop' ||
        node.type === 'map'
      ) {
        await this.runContainer(
          node,
          allNodes,
          allEdges,
          context,
          executionId,
          executedNodes,
          executionMeta,
        );
      }

      // Background inside a branch just enqueues its body; the main flow
      // (this branch) continues without waiting, which matches the top-level
      // Background contract.
      if (node.type === 'background') {
        await this.scheduleBackgroundBody(
          node,
          allEdges,
          context,
          executionId,
          branchInput,
        );
      }

      const nodeOutput = context.nodeOutputCache[node.id] as
        | Record<string, unknown>
        | undefined;
      if (nodeOutput?.status === 'waiting_for_input') {
        throw new Error(
          `PARALLEL_INVALID_CHILD: Blocking node "${node.label ?? node.type}" inside Parallel node "${parallelNode.label ?? parallelNode.type}" is not supported.`,
        );
      }

      this.propagateReachability(
        nodeId,
        plan.outgoingEdgeMap,
        context.nodeOutputCache,
        reachable,
      );
    }
  }

  /**
   * Run a Parallel node when `PARALLEL_ENGINE=v1` is active.
   *
   * 1. Plan each branch's exclusive body subgraph.
   * 2. Hand the branches to {@link ParallelExecutor} which enforces
   *    `maxConcurrency` via p-limit and aggregates failures per
   *    `errorPolicy`.
   * 3. After all branches settle, replace the Parallel node's output with
   *    `_selectedPort: ['done']` so the main loop's propagateReachability
   *    activates only the `done` port edges while suppressing `branch_N`
   *    edges (preventing re-execution of branch body nodes).
   * 4. Re-propagate reachability from each branch's exit nodes into the
   *    caller-provided `reachable` set so join nodes (typical Merge) become
   *    executable in the main loop.
   *
   * Called only when the feature flag is `v1`; otherwise the legacy
   * sequential behavior applies (branch edges activate via `propagateReachability`
   * and run one-by-one through the main pointer loop).
   */
  private async runParallel(
    parallelNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    forwardEdges: GraphEdge[],
    backEdges: GraphEdge[],
    outgoingEdgeMap: Map<string, GraphEdge[]>,
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
    reachable: Set<string>,
    input: unknown,
  ): Promise<void> {
    const structured = context.structuredOutputCache?.[parallelNode.id];
    const resolvedConfig = structured?.config ?? parallelNode.config ?? {};

    const branchCount =
      typeof resolvedConfig.branchCount === 'number' &&
      Number.isFinite(resolvedConfig.branchCount)
        ? Math.max(2, Math.min(16, Math.floor(resolvedConfig.branchCount)))
        : 2;
    const maxConcurrency =
      typeof resolvedConfig.maxConcurrency === 'number' &&
      Number.isFinite(resolvedConfig.maxConcurrency)
        ? Math.max(0, Math.min(16, Math.floor(resolvedConfig.maxConcurrency)))
        : 0;
    const waitAll =
      typeof resolvedConfig.waitAll === 'boolean'
        ? resolvedConfig.waitAll
        : true;
    if (!waitAll) {
      this.logger.warn(
        `Parallel node "${parallelNode.label ?? parallelNode.type}" has waitAll=false, but Phase P1 always waits for all branches. ` +
          `Use the Background node for fire-and-forget semantics.`,
      );
    }

    const errorPolicyConfig = this.getErrorPolicyConfig(parallelNode);
    const errorPolicy: ParallelErrorPolicy =
      errorPolicyConfig.policy === 'skip_node' ||
      errorPolicyConfig.policy === 'use_default_output' ||
      errorPolicyConfig.policy === 'route_to_error_port'
        ? 'continue'
        : 'stop';

    const plan = this.planParallelBody(
      parallelNode,
      allNodes,
      forwardEdges,
      backEdges,
      branchCount,
    );

    // Resolve the Parallel node's current NodeExecution row so branch
    // children can be grouped under it in the run-results timeline
    // (mirrors the Background node's parentNodeExecutionId stamping).
    const parentNodeExecution = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: parallelNode.id },
      order: { startedAt: 'DESC' },
    });
    const parentNodeExecutionId = parentNodeExecution?.id;
    const branchParentContext: ExecutionContext = parentNodeExecutionId
      ? { ...context, parentNodeExecutionId }
      : context;

    await this.parallelExecutor.execute(
      { branchCount, maxConcurrency, waitAll, errorPolicy },
      branchParentContext,
      async (branchIndex, branchContext) => {
        const branchPlan = plan.branches[branchIndex];
        await this.executeParallelBranchBody(
          parallelNode,
          branchPlan,
          allNodes,
          allEdges,
          branchContext,
          executionId,
          executedNodes,
          executionMeta,
          input,
        );
      },
    );

    // Collect each branch's terminal output for the `done` port.
    // The last node in each branch's topological order is the terminal.
    const branchResults: unknown[] = [];
    for (const branch of plan.branches) {
      if (branch.sortedNodeIds.length === 0) {
        branchResults.push(undefined);
        continue;
      }
      const lastNodeId = branch.sortedNodeIds[branch.sortedNodeIds.length - 1];
      const rawOutput = context.nodeOutputCache[lastNodeId];
      branchResults.push(this.stripControlFields(rawOutput));
    }

    // Replace Parallel's output: `_selectedPort: ['done']` ensures only the
    // `done` port fires while branch_N edges stay suppressed. The `done`
    // downstream node receives `{ branches, count }` (CONVENTIONS §9.2).
    context.nodeOutputCache[parallelNode.id] = {
      _selectedPort: ['done'],
      branches: branchResults,
      count: branchResults.length,
    };
    this.contextService.setStructuredOutput(executionId, parallelNode.id, {
      config: resolvedConfig,
      output: { branches: branchResults, count: branchResults.length },
      port: ['done'],
    });

    // Activate `done` downstream via the main outgoingEdgeMap (Parallel →
    // done-port edges). Branch exit → join (Merge) edges are also activated.
    this.propagateReachability(
      parallelNode.id,
      outgoingEdgeMap,
      context.nodeOutputCache,
      reachable,
    );
    for (const branch of plan.branches) {
      for (const exitId of branch.exitNodeIds) {
        this.propagateReachability(
          exitId,
          outgoingEdgeMap,
          context.nodeOutputCache,
          reachable,
        );
      }
    }
  }

  /**
   * Run the container executor (ForEach/Loop) for a container node, wiring
   * the per-iteration callback to {@link executeContainerBody}. Reads the
   * resolved input array / count from the container handler's output, which
   * was just stored in the structured cache by executeNode. The resulting
   * collected array overwrites the container's output so downstream
   * `done`-port edges carry the body results.
   */
  private async runContainer(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
  ): Promise<void> {
    try {
      await this.runContainerInner(
        containerNode,
        allNodes,
        allEdges,
        context,
        executionId,
        executedNodes,
        executionMeta,
      );
    } catch (error) {
      // Container-level failure happens AFTER executeNode has already marked
      // the container as COMPLETED (handler's initial return succeeded). We
      // overwrite that to FAILED with the real error so the UI surfaces the
      // reason (e.g. CONTAINER_MISSING_EMIT) on the container node itself
      // instead of leaving it looking "completed with null output".
      const message = error instanceof Error ? error.message : String(error);
      const nodeExec = await this.nodeExecutionRepository.findOne({
        where: { executionId, nodeId: containerNode.id },
        order: { startedAt: 'DESC' },
      });
      if (nodeExec) {
        nodeExec.status = NodeExecutionStatus.FAILED;
        nodeExec.error = { message };
        nodeExec.finishedAt = new Date();
        if (nodeExec.startedAt) {
          nodeExec.durationMs =
            nodeExec.finishedAt.getTime() - nodeExec.startedAt.getTime();
        }
        await this.nodeExecutionRepository.save(nodeExec);
      }
      this.websocketService.emitNodeEvent(
        executionId,
        containerNode.id,
        NodeEventType.NODE_FAILED,
        {
          nodeExecutionId: nodeExec?.id,
          parentNodeExecutionId: nodeExec?.parentNodeExecutionId ?? undefined,
          status: NodeExecutionStatus.FAILED,
          error: message,
          nodeType: containerNode.type,
          nodeLabel: containerNode.label ?? containerNode.type,
          input: nodeExec?.inputData,
          finishedAt: nodeExec?.finishedAt?.toISOString?.(),
        },
      );
      throw error;
    }
  }

  private async runContainerInner(
    containerNode: Node,
    allNodes: Node[],
    allEdges: Edge[],
    context: ExecutionContext,
    executionId: string,
    executedNodes: Set<string>,
    executionMeta: { startedAt?: string; mode?: string },
  ): Promise<void> {
    // Resolve and validate the container wiring once upfront. planContainerBody
    // throws on missing/duplicate emit edges or back-edges so the user sees
    // the error immediately rather than mid-iteration.
    const plan = this.planContainerBody(containerNode, allNodes, allEdges);

    const runIter = async (iterInput: unknown) => {
      return this.executeContainerBody(
        containerNode,
        plan,
        allNodes,
        context,
        executionId,
        executedNodes,
        executionMeta,
        iterInput,
      );
    };

    const structured = context.structuredOutputCache?.[containerNode.id];
    const resolvedConfig = structured?.config ?? containerNode.config ?? {};
    let structuredOutput: Record<string, unknown>;

    if (containerNode.type === 'foreach') {
      const handlerOutput = structured?.output;
      const array = Array.isArray(handlerOutput) ? handlerOutput : [];
      const collected = await this.foreachExecutor.execute(
        {
          array,
          errorPolicy:
            (resolvedConfig.errorPolicy as 'stop' | 'skip' | 'continue') ??
            'stop',
          collectResults: true,
        },
        context,
        runIter,
      );
      // CONVENTIONS §9.2 — `foreach` finalises as `{ items, count }` so
      // downstream expressions can uniformly read `output.items[i]` / .count
      // across container kinds.
      structuredOutput = {
        items: collected,
        count: Array.isArray(collected) ? collected.length : 0,
      };
    } else if (containerNode.type === 'map') {
      const handlerOutput = structured?.output;
      const array = Array.isArray(handlerOutput) ? handlerOutput : [];
      const collected = await this.foreachExecutor.execute(
        {
          array,
          errorPolicy:
            (resolvedConfig.errorPolicy as 'stop' | 'skip' | 'continue') ??
            'stop',
          collectResults: true,
        },
        context,
        runIter,
      );
      // CONVENTIONS §9.2 — `map` finalises as `{ mapped, count }`.
      structuredOutput = {
        mapped: collected,
        count: Array.isArray(collected) ? collected.length : 0,
      };
    } else if (containerNode.type === 'loop') {
      const count = Number(resolvedConfig.count ?? 0);
      const maxIterations = resolvedConfig.maxIterations as number | undefined;
      const collected = await this.loopExecutor.execute(
        { count, maxIterations },
        context,
        runIter,
      );
      const iterations = collected.map((r) => r.output);
      // CONVENTIONS §9.2 — `loop` finalises as `{ iterations, count }`.
      structuredOutput = { iterations, count: iterations.length };
    } else {
      return;
    }

    this.contextService.setStructuredOutput(executionId, containerNode.id, {
      config: resolvedConfig,
      output: structuredOutput,
    });
    this.contextService.setNodeOutput(
      executionId,
      containerNode.id,
      structuredOutput,
    );
  }

  private async updateExecutionStatus(
    execution: Execution,
    newStatus: ExecutionStatus,
  ): Promise<void> {
    assertTransition(execution.status, newStatus);
    execution.status = newStatus;
    await this.executionRepository.save(execution);
  }

  private async createNodeExecution(
    executionId: string,
    nodeId: string,
    status: NodeExecutionStatus,
    parentNodeExecutionId?: string | null,
    inputData?: unknown,
  ): Promise<NodeExecution> {
    const nodeExecution = this.nodeExecutionRepository.create({
      executionId,
      nodeId,
      status,
      inputData: (inputData ?? {}) as Record<string, unknown>,
      parentNodeExecutionId: parentNodeExecutionId ?? null,
    });
    return this.nodeExecutionRepository.save(nodeExecution);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
