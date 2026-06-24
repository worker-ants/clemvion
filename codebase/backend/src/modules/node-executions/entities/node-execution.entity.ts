import {
  Entity,
  Index,
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
  // 외부 abortSignal (cancel-others-on-fail / 사용자 cancel / timeout) 로 노드의
  // 외부 I/O 가 중단됨 — 핸들러가 throw 한 AbortError 를 엔진이 failed 가 아닌
  // cancelled 로 분류 (spec/conventions/node-cancellation.md §5.1).
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
  WAITING_FOR_INPUT = 'waiting_for_input',
}

/**
 * 활성 상태 복합 인덱스 (execution_id, status) — 핫 경로 가속.
 *
 * `getStatus()` / `resolveWaitingNodeExecutionId()` 등 `WHERE execution_id=$1 AND
 * status='waiting_for_input'` 쿼리를 커버한다. 실제 인덱스는 Flyway V095 마이그레이션
 * (V095__node_execution_exec_status_active_index.sql) 의 partial index
 * `WHERE status IN ('waiting_for_input','running')` 로 DB 에 적용되어 있다 —
 * 중복 DDL 방지를 위해 새 마이그레이션 없이 이 데코레이터로 TypeORM 스키마 인식만 선언.
 *
 * 참고: `outputData` 는 공개 EIA 표면(SSE·status)으로 흘러가므로 민감 중간 결과를
 * 이 컬럼에 기록 금지 (EIA §5.3 / interaction.service.ts `getStatus()` JSDoc 참조).
 */
@Index(['executionId', 'status'])
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
