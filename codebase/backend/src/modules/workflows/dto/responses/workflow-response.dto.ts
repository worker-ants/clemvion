import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 워크플로우 기본 속성 응답 DTO.
 */
export class WorkflowDto {
  /** 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크스페이스 UUID */
  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  /** 워크플로우 이름 */
  @ApiProperty({ example: '신규 리드 처리 자동화' })
  name: string;

  /** 설명 */
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  /** 활성화 여부 */
  @ApiProperty()
  isActive: boolean;

  /** 태그 목록 */
  @ApiProperty({ type: [String], example: ['sales', 'automation'] })
  tags: string[];

  /** 폴더 UUID (루트이면 null) */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  folderId?: string | null;

  /** 워크플로우 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;

  /** 현재 버전 번호 */
  @ApiProperty({ example: 3 })
  currentVersion: number;

  /** 생성자 UUID */
  @ApiProperty({ format: 'uuid' })
  createdBy: string;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/**
 * 수동 실행 요청 접수 응답.
 */
export class ExecuteAcceptedDto {
  /** 생성된 실행 UUID */
  @ApiProperty({ format: 'uuid' })
  executionId: string;
}

/**
 * 캔버스 저장 결과. 이 응답은 TransformInterceptor 에 의해 한번 더 감싸지지 않고
 * 서비스 반환값이 그대로 `{ data: <이 객체> }` 로 래핑됩니다.
 */
export class CanvasSaveResultDto {
  /** 저장 후 워크플로우 */
  @ApiProperty({ type: () => WorkflowDto })
  workflow: WorkflowDto;

  /** 저장 후 노드 배열 */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  nodes: Record<string, unknown>[];

  /** 저장 후 엣지 배열 */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  edges: Record<string, unknown>[];
}

/**
 * 개별 graph warning rule 평가 결과.
 */
export class GraphWarningResultDto {
  /** 규칙 ID (예: `parallel:nested-depth-exceeded`) */
  @ApiProperty({ example: 'parallel:nested-depth-exceeded' })
  ruleId: string;

  /** 심각도 */
  @ApiProperty({ enum: ['error', 'warning'] })
  severity: 'error' | 'warning';

  /** 위반한 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  nodeId: string;

  /** 영문 SoT / fallback 메시지. ko 표시는 frontend 가 ruleId 로 localize */
  @ApiProperty({ example: 'Nested parallel depth exceeds limit' })
  message: string;

  /**
   * 동적 메시지의 보간 값(노드 라벨·수치). frontend 가 `GRAPH_WARNING_KO[ruleId]`
   * 한국어 템플릿의 `{{name}}` 에 보간 (i18n Principle 3-C). 정적 메시지 rule 은 생략.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { node: 'Outer', child: 'Inner', product: 64, cap: 32 },
  })
  params?: Record<string, string | number>;
}

/**
 * GET /workflows/:id/graph-warnings 응답 DTO.
 */
export class GraphWarningsResponseDto {
  /** 규칙 평가 결과 목록 */
  @ApiProperty({ type: [GraphWarningResultDto] })
  results: GraphWarningResultDto[];

  /** severity=error 가 1건 이상 있으면 true — 저장 버튼 disable 기준 */
  @ApiProperty()
  hasError: boolean;

  /** severity=warning 가 1건 이상 있으면 true — 노란 배지 표시 기준 */
  @ApiProperty()
  hasWarning: boolean;
}

/**
 * 워크플로우 내보내기 결과 (JSON 포맷).
 */
export class ExportWorkflowDto {
  /** 내보내기 포맷 버전 */
  @ApiProperty({ example: 1 })
  formatVersion: number;

  /** 이름 */
  @ApiProperty()
  name: string;

  /** 설명 */
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  /** 태그 */
  @ApiProperty({ type: [String] })
  tags: string[];

  /** 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  settings: Record<string, unknown>;

  /** 노드 배열 */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  nodes: Record<string, unknown>[];

  /** 엣지 배열 */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  edges: Record<string, unknown>[];
}
