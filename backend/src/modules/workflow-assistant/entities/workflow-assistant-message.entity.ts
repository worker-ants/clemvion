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

export type AssistantToolCallKind = 'explore' | 'plan' | 'edit' | 'finish';

export interface AssistantToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  kind: AssistantToolCallKind;
  result?: unknown;
  /**
   * 이 tool call 이 완료시키는 plan step id. 단일 값은 legacy 단축형이며
   * 한 번의 edit 이 여러 step 을 cover 하는 경우엔 `planStepIds` 를 병행
   * 사용한다 (둘 다 지정되면 합쳐서 집계).
   */
  planStepId?: string;
  /**
   * 같은 tool call 이 cover 하는 plan step id 목록. 예: `add_node` 가
   * config 안에 버튼을 함께 주입해 `update_node` 로 설정하려던 step 까지
   * 동시에 처리한 경우 `['s1', 's3']` 로 기록한다.
   */
  planStepIds?: string[];
  /**
   * Provider-opaque signature that must round-trip with the tool call across
   * LLM invocations. Currently used by Gemini 2.5+/3.x (thought_signature).
   * See `ToolCall.signature` in llm-client.interface.ts.
   */
  signature?: string;
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

  @Column({
    name: 'tool_call_id',
    length: 255,
    nullable: true,
    type: 'varchar',
  })
  toolCallId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  plan: AssistantPlanRecord | null;

  @Column({ type: 'jsonb', nullable: true })
  usage: AssistantUsageRecord | null;

  @Column({
    name: 'finish_reason',
    length: 30,
    nullable: true,
    type: 'varchar',
  })
  finishReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
