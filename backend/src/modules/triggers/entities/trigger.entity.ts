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
import { Workflow } from '../../workflows/entities/workflow.entity';

@Entity('trigger')
export class Trigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ length: 20 })
  type: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ name: 'endpoint_path', nullable: true, length: 255 })
  endpointPath: string;

  @Column({ name: 'auth_config_id', nullable: true })
  authConfigId: string;

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
