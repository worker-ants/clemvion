import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AlertRuleType = 'failure_rate' | 'duration' | 'llm_cost';
export type AlertChannel = 'in_app' | 'email';

@Entity('alert_rule')
@Index('idx_alert_rule_workspace', ['workspaceId'])
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  /** null이면 워크스페이스 전체에 적용 */
  @Column({ name: 'workflow_id', type: 'uuid', nullable: true })
  workflowId: string | null;

  @Column({ length: 32 })
  type: AlertRuleType;

  /**
   * - failure_rate: 0~100 (%)
   * - duration: ms
   * - llm_cost: USD
   */
  @Column({ type: 'numeric', precision: 12, scale: 4 })
  threshold: string;

  /**
   * ISO 8601 duration (예: PT1H, PT24H, P1D).
   * DB 컬럼은 `window_iso` — `window`가 PostgreSQL 예약어라 충돌해서 우회.
   */
  @Column({ name: 'window_iso', length: 32, default: 'PT1H' })
  window: string;

  @Column({ length: 16, default: 'in_app' })
  channel: AlertChannel;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
