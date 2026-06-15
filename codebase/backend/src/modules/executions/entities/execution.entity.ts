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
import type { ConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import type { ResumeCallStack } from '../../../shared/execution-resume/resume-call-stack.types';

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

  // source_ip / response_code: webhook(또는 chat-channel) 트리거 발화 시점의 호출
  //   메타데이터 (V096). 인증 설정 사용 내역(GET /api/auth-configs/:id/usage)의 호출
  //   이력 테이블이 "소스 IP"·"응답 코드" 컬럼을 노출하는 데 쓰인다 (§A.3, WH-MG-05).
  //   - source_ip: hooks.service 의 extractClientIp 결과. IPv4/IPv6(최대 45자).
  //   - response_code: webhook 호출이 받은 실제 HTTP 응답 코드 문자열(성공 = '202').
  //   비-HTTP 트리거(schedule)·수동 실행·배포 이전 row 는 둘 다 NULL —
  //   getUsage 는 response_code 가 NULL 이면 status enum 으로 폴백 표시한다.
  //   spec: 2-navigation/6-config.md §A.3, 1-data-model.md §2.13.
  @Column({ name: 'source_ip', type: 'varchar', length: 45, nullable: true })
  sourceIp: string | null;

  @Column({
    name: 'response_code',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  responseCode: string | null;

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

  // single_node_id / previous_execution_id: 단일 노드 실행(§1.3, V098).
  // single_node_id: `POST /api/workflows/:id/nodes/:nodeId/execute` 로 진입한
  //   단일 노드 실행의 대상 노드 id. 엔진(runExecution)은 이 노드만 실행하고
  //   downstream 으로 진행하지 않는다(§1.2 Run-from-Selected 와 구분). NULL =
  //   일반/부분 실행. `_node_id` 접미사가 Node FK 도메인을 표기하며 `single_`
  //   한정자는 §1.2 부분실행 fromNodeId(컬럼 아님, input_data 경유)와 구분한다 —
  //   dry_run/re_run_of 와 동일한 mode-encoding 컬럼.
  // previous_execution_id: 단일 노드 실행 시 입력 seed 출처가 되는 직전 실행 id.
  //   해당 실행의 predecessor NodeExecution.output_data 를 nodeOutputCache 에
  //   pre-seed 해 상류 출력을 자동 주입한다. NULL = seed 없음(수동 입력만).
  //   re_run_of(re-run 파생 부모)와 의미가 다르다 — 입력 주입 참조일 뿐 chain 관계 아님.
  //   API 응답 DTO 미포함(whitelist 매핑이라 자동 배제). spec: 3-execution §1.3/§9,
  //   13-replay-rerun §15(C3), 1-data-model §2.13.
  @Column({ name: 'single_node_id', type: 'uuid', nullable: true })
  singleNodeId: string | null;

  @Column({ name: 'previous_execution_id', type: 'uuid', nullable: true })
  previousExecutionId: string | null;

  // conversation_thread: waiting_for_input park 진입 시 ExecutionContext의
  //   conversationThread 전체 스냅샷을 commit 하는 durable resume 매체 (V084).
  //   rehydration(§7.5)이 여기서 thread를 무손실 복원(runningSummary 포함).
  //   NULL = park 한 적 없는 실행 / 배포 이전 row → rehydration 은 빈 thread 시작.
  //   실행 이력 SoT(NodeExecution.output_data)와 목적·소비처 분리.
  //   API 응답 DTO 미포함 — 내부 rehydration 전용 (execution-response.dto.ts 에 노출 없음).
  //   spec: conversation-thread §4·§8.4, 4-execution-engine §6.2/§7.5, 1-data-model §2.13.
  @Column({ name: 'conversation_thread', type: 'jsonb', nullable: true })
  conversationThread: ConversationThread | null;

  // user_variables: waiting_for_input park 진입 시 ExecutionContext.variables 중
  //   시스템 __* 제외 사용자 정의분(Variable Declaration/Modification 값)을 commit
  //   하는 durable resume 매체 (V085). rehydration(§7.5)이 복원해 park 이전 변수를
  //   park 이후 노드가 $var.X 로 무손실 참조. 시스템 __* 는 rehydration 이 별도
  //   재주입하므로 미포함. NULL = park 한 적 없는 실행 / 배포 이전 row.
  //   API 응답 DTO 미포함(확정) — ExecutionDto/ExecutionDetailDto 가 명시적 whitelist
  //   필드 매핑 방식(직접 선언된 속성만 직렬화)이므로 userVariables 는 자동 배제됨.
  //   conversation_thread 동일 패턴(A1 선례). execution-response.dto.ts 에 노출 없음.
  //   spec: 4-execution-engine §6.1/§6.2/§7.5, 1-data-model §2.13.
  @Column({ name: 'user_variables', type: 'jsonb', nullable: true })
  userVariables: Record<string, unknown> | null;

  // resume_call_stack: 중첩 sub-workflow(executeInline) 안의 blocking 노드가
  //   waiting_for_input 으로 park 할 때, 재개에 필요한 executeInline 호출 체인
  //   (outermost→waiting inner 직전)을 commit 하는 durable resume 매체 (V087, D6).
  //   rehydration(§7.5)이 이 스택으로 top-level→sub-workflow 프레임을 재귀적으로
  //   재진입(executeInline 재호출)해 최내층 waiting 노드까지 도달한다. 컨테이너 body
  //   blocking 은 §3.2 금지라 선형 스택만(iteration/branch 상태 없음). NULL = top-level
  //   park(중첩 깊이 0) / park 한 적 없는 실행 / 배포 이전 row → rehydration 은 단일
  //   레벨로 재개. conversation_thread(V084)·user_variables(V085) 동일 패턴 — API DTO
  //   미포함(whitelist 매핑이라 자동 배제).
  //   spec: 4-execution-engine §6.2/§7.5/§Rationale(D6), 1-data-model §2.13.
  @Column({ name: 'resume_call_stack', type: 'jsonb', nullable: true })
  resumeCallStack: ResumeCallStack | null;

  // 노드 실행 순서는 V035 부터 별도 `execution_node_log` 테이블에 append-only
  // 로 기록된다. ExecutionsService.findById 가 (execution_id, id) 정렬 쿼리로
  // executionPath: string[] 응답 필드를 채운다. 본 entity 에 컬럼은 없다.
}
