import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Execution } from '../../executions/entities/execution.entity';

/**
 * Append-only log of node execution order. Replaces the legacy
 * `execution.execution_path` UUID array which required serialized
 * read-modify-write across instances. Each row's BIGSERIAL `id` is
 * monotonically increasing across all instances (PostgreSQL sequence
 * is concurrency-safe), so reading rows ordered by `(execution_id, id)`
 * yields a deterministic execution order.
 */
@Entity('execution_node_log')
@Index('execution_node_log_execution_id_id_idx', ['executionId', 'id'])
export class ExecutionNodeLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string;

  @ManyToOne(() => Execution, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;

  @Column({ name: 'node_id', type: 'uuid' })
  nodeId: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
