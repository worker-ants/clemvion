import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Trigger } from '../../triggers/entities/trigger.entity';

@Entity('schedule')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'trigger_id' })
  triggerId: string;

  @ManyToOne(() => Trigger, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trigger_id' })
  trigger: Trigger;

  @Column({ name: 'cron_expression', length: 100 })
  cronExpression: string;

  @Column({ length: 100, default: 'Asia/Seoul' })
  timezone: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'next_run_at', type: 'timestamptz', nullable: true })
  nextRunAt: Date;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt: Date;

  @Column({ name: 'parameter_values', type: 'jsonb', default: {} })
  parameterValues: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
