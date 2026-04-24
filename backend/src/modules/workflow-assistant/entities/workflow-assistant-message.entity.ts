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

/**
 * Plan step 의 action enum. 문자열 유니온 대신 tuple 로 선언해 런타임에서도
 * 값 목록을 공유할 수 있게 한다 (예: leak 복구 validator 가 `Set(PLAN_STEP_ACTIONS)`
 * 로 파생). 새 action 추가 시 tuple 만 업데이트하면 타입·validator 가 동시에
 * 커버된다.
 */
export const PLAN_STEP_ACTIONS = [
  'add_node',
  'update_node',
  'remove_node',
  'add_edge',
  'remove_edge',
  'note',
] as const;

export type AssistantStepAction = (typeof PLAN_STEP_ACTIONS)[number];

export interface AssistantPlanStep {
  id: string;
  action: AssistantStepAction;
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

  /**
   * 이 assistant row 가 서버의 **stall 자동 복구**(spec §10) 로 인해 새로
   * 시작된 row 인지 여부. 기본값 false. 같은 턴이 stall 복구로 여러 row 로
   * 쪼개진 경우, 복구 직전까지의 "중간 row" 는 false, 복구 이후 새로 시작된
   * row 는 true. 프론트는 이 플래그가 true 인 row 앞에 divider("자동으로
   * 이어서 진행했어요") 를 렌더링한다. 기존 row (마이그레이션 전) 는 false
   * 로 해석되어 호환성 유지.
   */
  @Column({ name: 'auto_resumed', type: 'boolean', default: false })
  autoResumed: boolean;

  /**
   * `autoResumed=true` row 에서만 세팅되는 복구 사유. 현재는
   * `'stall_pending_steps'` 한 종류. 향후 다른 복구 경로가 생기면 여기에
   * 추가.
   */
  @Column({
    name: 'auto_resume_reason',
    length: 40,
    nullable: true,
    type: 'varchar',
  })
  autoResumeReason: string | null;

  /**
   * 같은 턴 내 자동 복구 시도 순번 (1부터 시작). `MAX_STALL_ROUNDS` 까지.
   * `autoResumed=false` row 에서는 null.
   */
  @Column({
    name: 'auto_resume_attempt',
    type: 'smallint',
    nullable: true,
  })
  autoResumeAttempt: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
