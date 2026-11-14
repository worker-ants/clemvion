import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatus } from '../../entities/execution.entity';
import {
  EXECUTION_TRIGGER_SOURCES,
  type ExecutionTriggerSource,
} from '../../utils/execution-trigger';

// 근거: [실행 내역 「API」](CLE-EXEC-HISTORY#api)
/**
 * 실행(Execution) 응답 DTO.
 *
 * 목록 · 상세 · 중지 · 체인 · 재실행 응답의 실행 객체가 모두 이 필드 집합을 싣는다. 서비스가
 * 키를 하나씩 채워 조립하고 엔티티를 펼쳐 내보내지 않는다(`ExecutionsService.toResponseExecution`).
 * 그래서 값이 없는 필드도 키는 늘 있고 값이 `null` 이다.
 */
export class ExecutionDto {
  /** 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 트리거 UUID (수동/서브워크플로우 실행은 null) */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  triggerId: string | null;

  // 근거: [실행 내역 「실행 출처 분류」](CLE-EXEC-HISTORY#실행-출처-분류)
  /**
   * 실행 출처 분류 — 우선순위: subworkflow > manual > schedule > webhook > unknown.
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

  /** 종료 시각. 끝나지 않은 실행은 null */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt: string | null;

  /** 전체 경과(ms). 시작부터 종료까지라 입력 대기 시간이 들어간다. 끝나지 않은 실행은 null */
  @ApiProperty({ type: Number, nullable: true, example: 1820 })
  durationMs: number | null;

  // 근거: [응답 자격 증명 마스킹 「inputData 는 두 수준 모두 가린다」](CLE-API-EGRESS-PIPELINE#41-inputdata-는-두-수준-모두-가린다-2026-08-20)
  /**
   * 입력 데이터 — 트리거가 워크플로우에 주입한 input (manual parameters / webhook body / schedule context).
   *
   * 자격증명으로 판별된 값은 마스킹되어 반환된다(2026-08-20~, DB 원문과 다를 수 있음) —
   * 형제 `outputData`/`error`, 자매 `nodeExecutions[].inputData` 와 같은 정책이고, webhook
   * ingestion 이 남긴 `[REDACTED]` 마커는 보존된다. 근거 정본: `toResponseExecution`.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  inputData: Record<string, unknown> | null;

  // 근거: [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16)
  /**
   * 출력 데이터 — 워크플로우 최종 결과. 노드별 envelope 는 nodeExecutions[i].outputData 참조.
   *
   * **자격증명으로 판별된 값은 마스킹되어 반환된다** (`error` 와 동일 정책, 2026-08-16) —
   * `Bearer …`·자격증명 포함 URI 등이 `***` 로 치환되므로 **DB 원문과 다를 수 있다**.
   * ingestion 이 이미 남긴 `[REDACTED]` 마커는 **보존**된다. 구현은
   * `shared/utils/redact-stored-error.ts` 의 `redactStoredDataForResponse`.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  outputData: Record<string, unknown> | null;

  // 근거: [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16)
  /**
   * 에러 객체.
   *
   * **자격증명으로 판별된 값은 마스킹되어 반환된다** — `Bearer …`·자격증명 포함 URI 등이
   * `***` 로 치환되므로 **DB 원문과 다를 수 있다**. `code`·`nodeId` 는 값 공간이 닫혀 있어
   * 원문 그대로다. 구현은 `shared/utils/redact-stored-error.ts`.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  error: Record<string, unknown> | null;

  /** 실행 시작자 UUID (수동 실행 시) */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  executedBy: string | null;

  /** 부모 실행 UUID (서브 워크플로우) */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentExecutionId: string | null;

  /** 재귀 깊이 */
  @ApiProperty({ example: 0 })
  recursionDepth: number;

  /**
   * 실행 경로(노드 id 를 지나간 순서대로). 상세 · 재실행 응답만 채운다. 목록 · 중지 ·
   * 체인 응답은 경로를 읽지 않아 빈 배열이다.
   */
  @ApiProperty({ type: [String], example: [] })
  executionPath: string[];

  // 근거: [재실행 「체인 컬럼」](CLE-EXEC-RERUN-API#체인-컬럼)
  /** 직계 부모 실행 UUID — Re-run 으로 생성된 실행만 세팅, 일반 실행은 null */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reRunOf: string | null;

  /** Re-run chain root 실행 UUID — Re-run 으로 생성된 실행만 세팅, 일반 실행은 null */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  chainId: string | null;

  // 근거: [재실행 「dry-run」](CLE-EXEC-RERUN#dry-run)
  /** dry-run 모드로 생성된 실행 여부 (외부 부수효과 노드가 mock 출력) */
  @ApiProperty({ example: false })
  dryRun: boolean;

  // 근거: [실행 내역 「테이블」](CLE-EXEC-HISTORY-UI#테이블)
  /** 노드 실행 총 건수 (실행 목록 Nodes 열) */
  @ApiProperty({ example: 0 })
  totalNodeCount: number;

  /** 완료(completed) 상태 노드 실행 건수 */
  @ApiProperty({ example: 0 })
  completedNodeCount: number;

  /** 실패(failed) 상태 노드 실행 건수 */
  @ApiProperty({ example: 0 })
  failedNodeCount: number;
}

// 근거: [실행 내역 「API」](CLE-EXEC-HISTORY#api)
/**
 * 노드 실행이 가리키는 노드의 참조. 노드 설정(`config`) · 좌표 같은 다른 노드 컬럼은 싣지 않는다.
 */
export class ExecutionNodeRefDto {
  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 노드 타입 */
  @ApiProperty({ example: 'transform' })
  type: string;

  /** 노드 라벨 */
  @ApiProperty({ example: 'Data Transform' })
  label: string;
}

/** 노드 실행 이력 요약 */
export class NodeExecutionSummaryDto {
  /** 노드 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;

  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  nodeId: string;

  /**
   * 노드 참조. `node_execution.node_id` 는 NOT NULL 외래 키이고 노드를 지우면 노드 실행도
   * 함께 지워지므로 늘 있다.
   */
  @ApiProperty({ type: () => ExecutionNodeRefDto })
  node: ExecutionNodeRefDto;

  /** 상태 */
  @ApiProperty({ example: 'completed' })
  status: string;

  /** 시작 시각 */
  @ApiProperty({ format: 'date-time' })
  startedAt: string;

  /** 종료 시각. 끝나지 않은 노드 실행은 null */
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt: string | null;

  /** 소요 시간(ms). 끝나지 않은 노드 실행은 null */
  @ApiProperty({ type: Number, nullable: true })
  durationMs: number | null;

  // 근거: [응답 자격 증명 마스킹 「inputData 는 두 수준 모두 가린다」](CLE-API-EGRESS-PIPELINE#41-inputdata-는-두-수준-모두-가린다-2026-08-20)
  /**
   * 노드 입력 데이터.
   *
   * 자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음) — 상위
   * `ExecutionDto.inputData` 와 같은 정책이라 두 레벨이 갈리지 않는다.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  inputData: Record<string, unknown> | null;

  // 근거:
  //   - [노드 출력 규약 「Principle 7. 설정 에코 원칙」](CLE-NODE-OUTPUT#principle-7-설정-에코-원칙)
  //   - [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16)
  /**
   * 노드 실행 출력 — `NodeHandlerOutput` envelope 직렬화.
   * - `config`: 노드 정의의 **원본 template** (`{{ ... }}` 를 보존한 raw)
   * - `output`: expression 평가가 끝난 결과값 (subject / body / requestBody 등 실제 동작 입력)
   * - `meta`: 부수 정보 (durationMs, statusCode 등)
   * - `port`: 어느 출력 포트로 라우팅됐는지 (`out` / `error` / `success` 등)
   *
   * `_resumeState` 등 engine-internal 필드는 저장 시 제거된다.
   * 본 라이브 릴리즈 이전 실행 row 는 `config` 가 evaluated 형태로 남아있을 수 있다 (백필 X, historical record).
   *
   * **자격증명으로 판별된 값은 마스킹되어 반환된다** (2026-08-16) — 형제 필드 `error` 와
   * 같은 정책이다.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  outputData: Record<string, unknown> | null;

  // 근거: [응답 자격 증명 마스킹 「내부 읽기 경로」](CLE-API-EGRESS-SURFACE#35-내부-읽기-경로-2026-08-16)
  /**
   * 에러.
   *
   * **자격증명으로 판별된 값은 마스킹되어 반환된다** (DB 원문과 다를 수 있다) — 상위
   * `Execution.error` 와 **같은 관문**을 지난다. 둘은 원본/복사 관계라 한쪽만 가리면
   * 방어가 우회된다.
   */
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  error: Record<string, unknown> | null;

  /** 재시도 횟수 */
  @ApiProperty({ example: 0 })
  retryCount: number;

  /**
   * 인라인 서브 워크플로우 안에서 실행된 노드면 그 서브 워크플로우 노드 실행의 UUID, 아니면 null.
   * 실행 결과 타임라인이 자식 노드를 묶는 데 쓴다.
   */
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parentNodeExecutionId: string | null;
}

// 근거: [실행 내역 「API」](CLE-EXEC-HISTORY#api)
/**
 * 실행 상세 (노드 실행 이력 포함). 상세 · 재실행 응답과 WebSocket `execution.snapshot` 의
 * `execution` 이 이 모양이다.
 */
export class ExecutionDetailDto extends ExecutionDto {
  /** 노드별 실행 이력 (시작 시각 오름차순) */
  @ApiProperty({ type: [NodeExecutionSummaryDto] })
  nodeExecutions: NodeExecutionSummaryDto[];

  /**
   * `executionPath` 가 상한(`MAX_EXECUTION_PATH_ROWS`)에서 잘렸을 수 있으면 true.
   * 상한과 같은 수의 행이 돌아오면 true 로 본다.
   */
  @ApiProperty({ example: false })
  executionPathTruncated: boolean;
}

/** 이어실행 결과 */
export class ExecutionContinueResultDto {
  /** 접수 성공 여부 */
  @ApiProperty({ example: true })
  success: boolean;
}
