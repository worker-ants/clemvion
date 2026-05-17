import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Workspace } from '../../workspaces/entities/workspace.entity';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { User } from '../../users/entities/user.entity';
import { LlmConfig } from '../../llm-config/entities/llm-config.entity';
import { WorkflowAssistantMessage } from './workflow-assistant-message.entity';

export type AssistantSessionStatus = 'active' | 'archived';

@Entity('workflow_assistant_session')
@Index(['workflowId', 'status', 'lastInteractionAt'])
@Index(['workspaceId', 'userId', 'updatedAt'])
export class WorkflowAssistantSession {
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

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  title: string | null;

  @Column({ name: 'llm_config_id', nullable: true, type: 'uuid' })
  llmConfigId: string | null;

  @ManyToOne(() => LlmConfig, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'llm_config_id' })
  llmConfig: LlmConfig | null;

  @Column({ length: 20, default: 'active' })
  status: AssistantSessionStatus;

  @Column({ name: 'message_count', type: 'int', default: 0 })
  messageCount: number;

  @Column({ name: 'last_interaction_at', type: 'timestamptz' })
  lastInteractionAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => WorkflowAssistantMessage, (m) => m.session)
  messages: WorkflowAssistantMessage[];
}
