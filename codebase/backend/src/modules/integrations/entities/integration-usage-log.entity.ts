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

  /**
   * Catalog key 형식 (Cafe24: `cafe24.<resource>.<operation>`). 다른 통합은 NULL.
   * SoT: `spec/conventions/cafe24-api-metadata.md §7.5`.
   */
  @Column({ name: 'api_label', type: 'varchar', length: 128, nullable: true })
  apiLabel: string | null;

  /** HTTP method / SQL 동사 / `SEND` 등 — 통합별 의미 다름. */
  @Column({ name: 'api_method', type: 'varchar', length: 8, nullable: true })
  apiMethod: string | null;

  /** host+path / driver / SMTP host 등 — 통합별 의미 다름. */
  @Column({ name: 'api_path', type: 'varchar', length: 256, nullable: true })
  apiPath: string | null;

  @CreateDateColumn({ name: 'at', type: 'timestamptz' })
  at: Date;
}
