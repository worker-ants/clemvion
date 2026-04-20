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
