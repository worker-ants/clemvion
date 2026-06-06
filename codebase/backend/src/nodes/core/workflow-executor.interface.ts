import { ExecutionStatus } from '../../modules/executions/entities/execution.entity.js';
import { ExecutionContext } from './node-handler.interface.js';

export interface SubWorkflowOptions {
  parentExecutionId?: string;
  recursionDepth?: number;
  timeoutMs?: number;
  /**
   * 호출자 workspace 의 ID. 엔진은 target workflow 의 workspaceId 와 비교해
   * 일치하지 않으면 `WORKFLOW_FORBIDDEN_WORKSPACE` 로 차단한다.
   * 옛 동작과의 호환을 위해 optional 이지만, 모든 신규 호출자는 반드시 전달해야 한다.
   */
  parentWorkspaceId?: string;
}

export interface SubWorkflowResult {
  executionId: string;
  output: unknown;
  status: ExecutionStatus;
}

export interface InlineExecutionOptions {
  executionId: string;
  context: ExecutionContext;
  executedNodes: Set<string>;
  recursionDepth: number;
  /**
   * Stamp every NodeExecution produced by this inline run with this parent
   * id so the timeline can group children under the invoking Sub-Workflow
   * row. Normally the id of the `workflow` node's own NodeExecution.
   */
  parentNodeExecutionId?: string;
  /**
   * 부모 그래프에서 이 sub-workflow 를 호출한 Workflow 노드의 `Node.id`.
   * `executeInline` 가 `context._callStack` frame 의 `invokerNodeId` 로 push 해
   * 중첩 blocking park 시 `resume_call_stack`(V087) 에 영속한다 — §7.5 rehydration
   * 이 부모 그래프에서 이 노드까지 전진한 뒤 sub-workflow 를 frame-by-frame
   * 재진입하는 키. `WorkflowHandler` 가 sync inline 호출 시 `context.nodeId`
   * (= 현 Workflow 노드)를 전달한다. 미전달(background body 등 비-Workflow-노드
   * 진입)이면 call-stack frame 을 push 하지 않는다.
   */
  invokerNodeId?: string;
  /**
   * If provided, override the default reachability seeding (which uses
   * trigger nodes, falling back to nodes with no incoming edges) and instead
   * start traversal from exactly these node ids. Used by the Background node
   * to run a body subgraph rooted at the `background`-port edge targets.
   */
  entryNodeIds?: string[];
}

export interface WorkflowExecutor {
  /**
   * Execute a sub-workflow inline within the parent execution.
   * Nodes are executed under the same executionId and share the parent's
   * nodeOutputCache, so $node references and history timeline are seamless.
   */
  executeInline(
    workflowId: string,
    input: unknown,
    options: InlineExecutionOptions,
  ): Promise<unknown>;

  /**
   * Execute a sub-workflow asynchronously (fire-and-forget).
   * Creates a separate Execution record and returns its ID immediately.
   */
  executeAsync(
    workflowId: string,
    input: unknown,
    options?: Omit<SubWorkflowOptions, 'timeoutMs'>,
  ): Promise<string>;
}
