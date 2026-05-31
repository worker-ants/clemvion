import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExecutionStatus } from '../../entities/execution.entity';
import {
  EXECUTION_TRIGGER_SOURCES,
  type ExecutionTriggerSource,
} from '../../utils/execution-trigger';

/** 실행(Execution) 요약 DTO */
export class ExecutionDto {
  /** 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 트리거 UUID (수동/서브워크플로우 실행은 null) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  triggerId?: string | null;

  /**
   * 실행 출처 분류 — 우선순위: subworkflow > manual > schedule > webhook > unknown.
   * 자세한 판정 규칙은 spec/2-navigation/14-execution-history.md 의 "Trigger 출처 분류" 표 참조.
   */
  @ApiProperty({ enum: EXECUTION_TRIGGER_SOURCES, example: 'manual' })
  triggerSource: ExecutionTriggerSource;

  /** 출처 보조 라벨 (트리거명/실행자명/부모 워크플로명). 정보가 없으면 null */
  @ApiProperty({ nullable: true, type: String, example: 'Alice' })
  triggerLabel: string | null;

  /** 실행 상태 */
  @ApiProperty({ enum: ExecutionStatus, enumName: 'ExecutionStatus' })
  status: ExecutionStatus;

  /** 시작 시각 */
  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /** 종료 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finishedAt?: string | null;

  /** 소요 시간(ms) */
  @ApiPropertyOptional({ nullable: true, example: 1820 })
  durationMs?: number | null;

  /** 입력 데이터 — 트리거가 워크플로우에 주입한 input (manual parameters / webhook body / schedule context) */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  inputData?: Record<string, unknown> | null;

  /** 출력 데이터 — 워크플로우 최종 결과. 노드별 envelope 는 nodeExecutions[i].outputData 참조 */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  outputData?: Record<string, unknown> | null;

  /** 에러 객체 */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  error?: Record<string, unknown> | null;

  /** 실행 시작자 UUID (수동 실행 시) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  executedBy?: string | null;

  /** 부모 실행 UUID (서브 워크플로우) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentExecutionId?: string | null;

  /** 재귀 깊이 */
  @ApiProperty({ example: 0 })
  recursionDepth: number;

  /** 실행 경로 (중첩 실행 추적) */
  @ApiProperty({ type: [String], example: [] })
  executionPath: string[];

  /** 직계 부모 실행 UUID — Re-run 으로 생성된 실행만 세팅, 일반 실행은 null (spec §9.1) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  reRunOf?: string | null;

  /** Re-run chain root 실행 UUID — Re-run 으로 생성된 실행만 세팅, 일반 실행은 null */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  chainId?: string | null;

  /** dry-run 모드로 생성된 실행 여부 (외부 부수효과 노드가 mock 출력, spec §7) */
  @ApiProperty({ example: false })
  dryRun: boolean;
}

/** 노드 실행 이력 요약 */
export class NodeExecutionSummaryDto {
  /** 노드 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  nodeId: string;

  /** 노드 라벨 */
  @ApiPropertyOptional()
  nodeLabel?: string;

  /** 상태 */
  @ApiProperty({ example: 'completed' })
  status: string;

  /** 시작 시각 */
  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /** 종료 시각 */
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  finishedAt?: string | null;

  /** 소요 시간(ms) */
  @ApiPropertyOptional({ nullable: true })
  durationMs?: number | null;

  /**
   * 노드 실행 출력 — `NodeHandlerOutput` envelope 직렬화.
   * - `config`: 노드 정의의 **원본 template** (CONVENTIONS Principle 7 — `{{ ... }}` 보존된 raw)
   * - `output`: expression 평가가 끝난 결과값 (subject / body / requestBody 등 실제 동작 입력)
   * - `meta`: 부수 정보 (durationMs, statusCode 등)
   * - `port`: 어느 출력 포트로 라우팅됐는지 (`out` / `error` / `success` 등)
   *
   * `_resumeState` 등 engine-internal 필드는 저장 시 제거된다.
   * 본 라이브 릴리즈 이전 실행 row 는 `config` 가 evaluated 형태로 남아있을 수 있다 (백필 X, historical record).
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  outputData?: Record<string, unknown> | null;

  /** 에러 */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  error?: Record<string, unknown> | null;
}

/** 실행 상세 (노드 실행 이력 포함) */
export class ExecutionDetailDto extends ExecutionDto {
  /** 노드별 실행 이력 */
  @ApiProperty({ type: [NodeExecutionSummaryDto] })
  nodeExecutions: NodeExecutionSummaryDto[];
}

/** 이어실행 결과 */
export class ExecutionContinueResultDto {
  /** 접수 성공 여부 */
  @ApiProperty({ example: true })
  success: boolean;
}
