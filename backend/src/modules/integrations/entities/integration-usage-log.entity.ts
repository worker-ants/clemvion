import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

export type IntegrationUsageStatus = 'success' | 'failed';

/**
 * Index `idx_integration_usage_log_integration_at (integration_id, at DESC)`
 * is defined by migration V008. TypeORM `@Index` declaration is intentionally
 * omitted to avoid direction drift (TypeORM decorators don't express DESC).
 */
@Entity('integration_usage_log')
export class IntegrationUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id' })
  integrationId: string;

  @ManyToOne(() => Integration, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'node_execution_id' })
  nodeExecutionId: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @Column({ length: 16 })
  status: IntegrationUsageStatus;

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null;

  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs: number;

  @CreateDateColumn({ name: 'at', type: 'timestamptz' })
  at: Date;
}
