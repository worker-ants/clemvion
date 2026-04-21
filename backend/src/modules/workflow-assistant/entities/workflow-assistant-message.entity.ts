import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WorkflowAssistantSession } from './workflow-assistant-session.entity';

export type AssistantMessageRole = 'user' | 'assistant' | 'tool';

export type AssistantToolCallKind = 'explore' | 'plan' | 'edit';

export interface AssistantToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  kind: AssistantToolCallKind;
  result?: unknown;
  planStepId?: string;
}

export interface AssistantPlanStep {
  id: string;
  action:
    | 'add_node'
    | 'update_node'
    | 'remove_node'
    | 'add_edge'
    | 'remove_edge'
    | 'note';
  description: string;
  rationale?: string;
}

export interface AssistantPlanRecord {
  title: string;
  summary: string;
  steps: AssistantPlanStep[];
  openQuestions?: string[];
  approvedAt?: string;
}

export interface AssistantUsageRecord {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  model: string;
}

@Entity('workflow_assistant_message')
@Index(['sessionId', 'createdAt'])
export class WorkflowAssistantMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => WorkflowAssistantSession, (s) => s.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session: WorkflowAssistantSession;

  @Column({ length: 20 })
  role: AssistantMessageRole;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'tool_calls', type: 'jsonb', nullable: true })
  toolCalls: AssistantToolCallRecord[] | null;

  @Column({ name: 'tool_call_id', length: 255, nullable: true, type: 'varchar' })
  toolCallId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: AssistantPlanRecord | null;

  @Column({ type: 'jsonb', nullable: true })
  usage: AssistantUsageRecord | null;

  @Column({ name: 'finish_reason', length: 30, nullable: true, type: 'varchar' })
  finishReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
