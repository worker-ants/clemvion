import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('llm_usage_log')
@Index('idx_llm_usage_log_workspace_created_at', ['workspaceId', 'createdAt'])
@Index('idx_llm_usage_log_provider_model_created_at', [
  'provider',
  'model',
  'createdAt',
])
export class LlmUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id' })
  workspaceId: string;

  @Column({ name: 'workflow_id', type: 'uuid', nullable: true })
  workflowId: string | null;

  @Column({ name: 'execution_id', type: 'uuid', nullable: true })
  executionId: string | null;

  @Column({ name: 'node_execution_id', type: 'uuid', nullable: true })
  nodeExecutionId: string | null;

  @Column({ name: 'llm_config_id', type: 'uuid', nullable: true })
  llmConfigId: string | null;

  @Column({ length: 50 })
  provider: string;

  @Column({ length: 100 })
  model: string;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({ name: 'total_tokens', type: 'int', default: 0 })
  totalTokens: number;

  @Column({
    name: 'cost_usd',
    type: 'numeric',
    precision: 12,
    scale: 6,
    nullable: true,
  })
  costUsd: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
