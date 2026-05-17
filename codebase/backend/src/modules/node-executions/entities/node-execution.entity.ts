import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Execution } from '../../executions/entities/execution.entity';
import { Node } from '../../nodes/entities/node.entity';

export enum NodeExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  WAITING_FOR_INPUT = 'waiting_for_input',
}

@Entity('node_execution')
export class NodeExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'execution_id' })
  executionId: string;

  @ManyToOne(() => Execution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;

  @Column({ name: 'node_id' })
  nodeId: string;

  @ManyToOne(() => Node, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'node_id' })
  node: Node;

  @Column({ length: 30, default: NodeExecutionStatus.PENDING })
  status: NodeExecutionStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @Column({ name: 'input_data', type: 'jsonb', default: {} })
  inputData: Record<string, unknown>;

  @Column({ name: 'output_data', type: 'jsonb', nullable: true })
  outputData: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown>;

  @Column({ name: 'interaction_data', type: 'jsonb', nullable: true })
  interactionData: Record<string, unknown>;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  /**
   * When this NodeExecution was produced inside an inline Sub-Workflow
   * invocation, points to the `workflow` node's NodeExecution row that
   * triggered the inline run. Lets the run-results timeline group children
   * under their parent Sub-Workflow card. NULL for nodes that ran directly
   * in the main workflow (or at any depth where no Sub-Workflow wrapper
   * applies).
   */
  @Column({ name: 'parent_node_execution_id', nullable: true })
  parentNodeExecutionId: string | null;

  @ManyToOne(() => NodeExecution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_node_execution_id' })
  parentNodeExecution: NodeExecution | null;
}
