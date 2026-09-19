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
import { ModelConfig } from '../../model-config/entities/model-config.entity';
import { WorkflowAssistantMessage } from './workflow-assistant-message.entity';

export type AssistantSessionStatus = 'active' | 'archived';

@Entity('workflow_assistant_session')
// 두 인덱스 모두 V019 가 만든다. 마지막 컬럼은 둘 다 DESC 지만 TypeORM @Index 는
// 방향을 표현하지 못해 컬럼 목록만 적는다(`entity.entity.ts` 와 같은 관례).
@Index('idx_workflow_assistant_session_wf_user_active', [
  'workflowId',
  'userId',
  'status',
  'lastInteractionAt',
])
@Index('idx_workflow_assistant_session_user_recent', [
  'workspaceId',
  'userId',
  'updatedAt',
])
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

  @ManyToOne(() => ModelConfig, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'llm_config_id' })
  llmConfig: ModelConfig | null;

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
