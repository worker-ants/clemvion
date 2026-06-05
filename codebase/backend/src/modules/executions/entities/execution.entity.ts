import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workflow } from '../../workflows/entities/workflow.entity';
import { Trigger } from '../../triggers/entities/trigger.entity';
import { User } from '../../users/entities/user.entity';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  WAITING_FOR_INPUT = 'waiting_for_input',
}

@Entity('execution')
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => Workflow, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({ name: 'trigger_id', nullable: true })
  triggerId: string;

  @ManyToOne(() => Trigger, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trigger_id' })
  trigger: Trigger;

  @Column({ length: 30, default: ExecutionStatus.PENDING })
  status: ExecutionStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  /**
   * 누적 active-running 시간(ms) — active 세그먼트(worker 가 노드를 전진시킨 구간)의
   * 합. `waiting_for_input` park 시간은 제외(§8 active-running 타임아웃 기준).
   * 엔진이 RUNNING 진입/이탈마다 누적하며, 세그먼트 시작 시 한도(기본 30분) 초과면
   * `EXECUTION_TIME_LIMIT_EXCEEDED` 로 failed. wall-clock 총 소요는 `durationMs` 별도.
   */
  @Column({ name: 'active_running_ms', type: 'int', default: 0 })
  activeRunningMs: number;

  @Column({ name: 'input_data', type: 'jsonb', nullable: true })
  inputData: Record<string, unknown>;

  @Column({ name: 'output_data', type: 'jsonb', nullable: true })
  outputData: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown>;

  @Column({ name: 'executed_by', nullable: true })
  executedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'executed_by' })
  executor: User;

  @Column({ name: 'parent_execution_id', nullable: true })
  parentExecutionId: string;

  @ManyToOne(() => Execution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_execution_id' })
  parentExecution: Execution;

  @Column({ name: 'recursion_depth', default: 0 })
  recursionDepth: number;

  // Replay/Re-run (decision F2, spec/5-system/13-replay-rerun.md §9.1).
  // re_run_of: 직계 부모 Execution (NULL = chain 의 원본/시작).
  // chain_id: chain root Execution id (re-run 으로 생성된 행에만 세팅 — 일반
  //   실행은 NULL). chain 전체는 `id = rootId OR chain_id = rootId` 로 조회.
  @Column({ name: 're_run_of', type: 'uuid', nullable: true })
  reRunOf: string | null;

  @Column({ name: 'chain_id', type: 'uuid', nullable: true })
  chainId: string | null;

  // dry_run: dry-run re-run (RR-PL-01) 으로 생성된 실행만 true. 외부 부수효과
  //   노드(HTTP/Email/DB-write)가 실제 호출 대신 mock 출력을 반환하도록 엔진이
  //   createContext 시점에 `variables.__dryRun` 으로 주입한다 (spec §7.2).
  //   실행 전 수명 동안 고정 — rehydration 에서도 동일 값 복원. (V068)
  @Column({ name: 'dry_run', type: 'boolean', default: false })
  dryRun: boolean;

  // 노드 실행 순서는 V035 부터 별도 `execution_node_log` 테이블에 append-only
  // 로 기록된다. ExecutionsService.findById 가 (execution_id, id) 정렬 쿼리로
  // executionPath: string[] 응답 필드를 채운다. 본 entity 에 컬럼은 없다.
}
