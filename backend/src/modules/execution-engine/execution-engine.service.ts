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
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { buildGraph, GraphEdge } from './graph/graph-builder';
import { topologicalSort } from './graph/topological-sort';
import { detectCycle } from './graph/cycle-detector';
import { assertTransition } from './state/state-machine';
import { NodeHandlerRegistry } from './handlers/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import {
  ErrorPolicyHandler,
  ErrorPolicyConfig,
} from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import {
  ExecutionContext,
  NodeHandler,
} from './handlers/node-handler.interface';
import {
  WebsocketService,
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';

// Node handler imports
import { IfElseHandler } from './handlers/logic/if-else.handler';
import { SwitchHandler } from './handlers/logic/switch.handler';
import { LoopHandler } from './handlers/logic/loop.handler';
import { VariableDeclarationHandler } from './handlers/logic/variable-declaration.handler';
import { VariableModificationHandler } from './handlers/logic/variable-modification.handler';
import { SplitHandler } from './handlers/logic/split.handler';
import { MapHandler } from './handlers/logic/map.handler';
import { ForEachHandler } from './handlers/logic/foreach.handler';
import { MergeHandler } from './handlers/logic/merge.handler';
import { WorkflowHandler } from './handlers/flow/workflow.handler';
import { HttpRequestHandler } from './handlers/integration/http-request.handler';
import { DatabaseQueryHandler } from './handlers/integration/database-query.handler';
import { SlackHandler } from './handlers/integration/slack.handler';
import { SendEmailHandler } from './handlers/integration/send-email.handler';
import { TransformHandler } from './handlers/data/transform.handler';
import { CodeHandler } from './handlers/data/code.handler';
import { CarouselHandler } from './handlers/presentation/carousel.handler';
import { TableHandler } from './handlers/presentation/table.handler';
import { ChartHandler } from './handlers/presentation/chart.handler';
import { FormHandler } from './handlers/presentation/form.handler';
import { TemplateHandler } from './handlers/presentation/template.handler';
import { PdfHandler } from './handlers/presentation/pdf.handler';
import { ManualTriggerHandler } from './handlers/trigger/manual-trigger.handler';

class ExecutionCancelledError extends Error {
  constructor() {
    super('Execution cancelled while waiting for input');
    this.name = 'ExecutionCancelledError';
  }
}

@Injectable()
export class ExecutionEngineService implements OnModuleInit {
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
    private readonly contextService: ExecutionContextService,
    private readonly errorPolicyHandler: ErrorPolicyHandler,
    private readonly expressionResolver: ExpressionResolverService,
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
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
          'Execution failed: server restarted while waiting for form input',
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
    const handlers: [string, NodeHandler][] = [
      ['if_else', new IfElseHandler()],
      ['switch', new SwitchHandler()],
      ['loop', new LoopHandler()],
      ['variable_declaration', new VariableDeclarationHandler()],
      ['variable_modification', new VariableModificationHandler()],
      ['split', new SplitHandler()],
      ['map', new MapHandler()],
      ['foreach', new ForEachHandler()],
      ['merge', new MergeHandler()],
      ['workflow', new WorkflowHandler()],
      ['http_request', new HttpRequestHandler()],
      ['database_query', new DatabaseQueryHandler()],
      ['slack', new SlackHandler()],
      ['send_email', new SendEmailHandler()],
      ['transform', new TransformHandler()],
      ['code', new CodeHandler()],
      ['carousel', new CarouselHandler()],
      ['table', new TableHandler()],
      ['chart', new ChartHandler()],
      ['form', new FormHandler()],
      ['template', new TemplateHandler()],
      ['pdf', new PdfHandler()],
      ['manual_trigger', new ManualTriggerHandler()],
    ];

    for (const [type, handler] of handlers) {
      this.handlerRegistry.register(type, handler);
    }

    this.logger.log(`Registered ${handlers.length} node handlers`);
  }

  /**
   * Execute a workflow. Creates the execution record and starts execution
   * in the background so the caller gets the execution ID immediately.
   */
  async execute(
    workflowId: string,
    input?: unknown,
    executedBy?: string,
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
      executedBy: executedBy ?? undefined,
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

      // 6. Check for cycles
      const cycleResult = detectCycle(graphNodes, graphEdges);
      if (cycleResult.hasCycle) {
        throw new Error(
          `Workflow graph contains a cycle: ${cycleResult.cyclePath?.join(' -> ')}`,
        );
      }

      // 7. Topological sort
      const sortedNodeIds = topologicalSort(graphNodes, graphEdges);

      // 8. Create execution context
      const context = this.contextService.createContext(
        executionId,
        workflowId,
      );

      // 9. Build lookup maps
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const outgoingEdges = this.buildOutgoingEdgeMap(graphEdges);

      // 10. Execute nodes in topological order
      const executedNodes = new Set<string>();

      for (const nodeId of sortedNodeIds) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        // Skip disabled nodes
        if (node.isDisabled) {
          await this.createNodeExecution(
            executionId,
            nodeId,
            NodeExecutionStatus.SKIPPED,
          );
          executedNodes.add(nodeId);
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
          outgoingEdges,
          executedNodes,
          nodeMap,
          {
            startedAt: savedExecution.startedAt?.toISOString(),
            mode: 'manual',
          },
        );

        // Form nodes are blocking: pause execution until user submits the form
        if (node.type === 'form') {
          await this.waitForFormSubmission(
            savedExecution,
            executionId,
            node,
            context,
          );
        }
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
      // Cancelled while waiting for form input — mark as cancelled, not failed
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
      this.pendingContinuations.delete(executionId);
      this.contextService.deleteContext(executionId);
    }
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

    // Update the node execution to waiting_for_input
    const nodeExec = await this.nodeExecutionRepository.findOne({
      where: { executionId, nodeId: node.id },
      order: { startedAt: 'DESC' },
    });
    if (nodeExec) {
      nodeExec.status = NodeExecutionStatus.WAITING_FOR_INPUT;
      await this.nodeExecutionRepository.save(nodeExec);
    }

    // Emit waiting event so frontend can render the form
    const nodeOutput = context.nodeOutputCache[node.id];
    this.websocketService.emitExecutionEvent(
      executionId,
      ExecutionEventType.EXECUTION_WAITING_FOR_INPUT,
      {
        status: ExecutionStatus.WAITING_FOR_INPUT,
        waitingNodeId: node.id,
        waitingNodeType: node.type,
        nodeOutput,
      },
    );

    // Await user submission with timeout (30 minutes default)
    const timeoutMs = ((node.config?.timeout as number) ?? 1800) * 1000;
    const formData = await new Promise<unknown>((resolve, reject) => {
      // Store resolve before emit so a fast client can't race
      this.pendingContinuations.set(executionId, {
        nodeId: node.id,
        resolve,
        reject,
      });

      setTimeout(() => {
        if (this.pendingContinuations.has(executionId)) {
          this.pendingContinuations.delete(executionId);
          reject(new ExecutionCancelledError());
        }
      }, timeoutMs);
    });

    // Merge submitted form data into the node output
    const updatedOutput = {
      ...(nodeOutput as Record<string, unknown>),
      status: 'submitted',
      submittedData: formData,
    };
    this.contextService.setNodeOutput(executionId, node.id, updatedOutput);

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
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExec.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExec.outputData,
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

  private async executeNode(
    executionId: string,
    node: Node,
    nodeInput: unknown,
    context: ExecutionContext,
    outgoingEdges: Map<string, GraphEdge[]>,
    executedNodes: Set<string>,
    nodeMap?: Map<string, Node>,
    executionMeta?: { startedAt?: string; mode?: string },
  ): Promise<void> {
    const nodeExecution = await this.createNodeExecution(
      executionId,
      node.id,
      NodeExecutionStatus.RUNNING,
    );
    this.websocketService.emitNodeEvent(
      executionId,
      node.id,
      NodeEventType.NODE_STARTED,
      {
        status: NodeExecutionStatus.RUNNING,
        nodeType: node.type,
        nodeLabel: node.label ?? node.type,
      },
    );

    try {
      // Get handler
      const handler = this.handlerRegistry.get(node.type);

      // Validate config
      const validationResult = handler.validate(node.config);
      if (!validationResult.valid) {
        throw new Error(
          `INVALID_NODE_CONFIG: ${validationResult.errors.join(', ')}`,
        );
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

      // Execute with potential retry
      const output = await this.executeWithRetry(
        handler,
        nodeInput,
        resolvedConfig,
        nodeContext,
        node,
        nodeExecution,
      );

      // Store output
      this.contextService.setNodeOutput(executionId, node.id, output);
      executedNodes.add(node.id);

      // Update node execution record
      nodeExecution.status = NodeExecutionStatus.COMPLETED;
      nodeExecution.outputData = (output as Record<string, unknown>) ?? {};
      nodeExecution.finishedAt = new Date();
      nodeExecution.durationMs =
        nodeExecution.finishedAt.getTime() - nodeExecution.startedAt.getTime();
      await this.nodeExecutionRepository.save(nodeExecution);
      this.websocketService.emitNodeEvent(
        executionId,
        node.id,
        NodeEventType.NODE_COMPLETED,
        {
          status: NodeExecutionStatus.COMPLETED,
          duration: nodeExecution.durationMs,
          nodeType: node.type,
          nodeLabel: node.label ?? node.type,
          output: nodeExecution.outputData,
        },
      );

      // Update execution path
      const execution = await this.executionRepository.findOneBy({
        id: executionId,
      });
      if (execution) {
        execution.executionPath = [...execution.executionPath, node.id];
        await this.executionRepository.save(execution);
      }
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
              status: NodeExecutionStatus.SKIPPED,
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
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
              status: NodeExecutionStatus.FAILED,
              error: error instanceof Error ? error.message : String(error),
              nodeType: node.type,
              nodeLabel: node.label ?? node.type,
            },
          );
          throw error;
      }
    }
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
        return nodeOutputCache[sourceId];
      }
      return undefined;
    }

    // Multiple inputs - merge into object keyed by source node ID
    const merged: Record<string, unknown> = {};
    for (const edge of incomingEdges) {
      if (executedNodes.has(edge.sourceNodeId)) {
        merged[edge.sourceNodeId] = nodeOutputCache[edge.sourceNodeId];
      }
    }
    return merged;
  }

  private buildOutgoingEdgeMap(edges: GraphEdge[]): Map<string, GraphEdge[]> {
    const map = new Map<string, GraphEdge[]>();
    for (const edge of edges) {
      const list = map.get(edge.sourceNodeId) ?? [];
      list.push(edge);
      map.set(edge.sourceNodeId, list);
    }
    return map;
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
  ): Promise<NodeExecution> {
    const nodeExecution = this.nodeExecutionRepository.create({
      executionId,
      nodeId,
      status,
      inputData: {},
    });
    return this.nodeExecutionRepository.save(nodeExecution);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
