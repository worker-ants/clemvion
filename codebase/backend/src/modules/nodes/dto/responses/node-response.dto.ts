import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeCategory } from '../../entities/node.entity';

/** 워크플로우 노드 응답 DTO */
export class NodeDto {
  /** 노드 UUID */
  @ApiProperty({ format: 'uuid' })
  id: string;

  /** 소속 워크플로우 UUID */
  @ApiProperty({ format: 'uuid' })
  workflowId: string;

  /** 노드 타입 식별자 */
  @ApiProperty({ example: 'http_request' })
  type: string;

  /** 노드 카테고리 */
  @ApiProperty({ enum: NodeCategory, enumName: 'NodeCategory' })
  category: NodeCategory;

  /** 노드 라벨 (워크플로우 내 유일) */
  @ApiProperty({ example: 'Fetch API' })
  label: string;

  /** 캔버스 X 좌표 */
  @ApiProperty({ example: 250 })
  positionX: number;

  /** 캔버스 Y 좌표 */
  @ApiProperty({ example: 300 })
  positionY: number;

  /** 노드 설정 객체 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  config: Record<string, unknown>;

  /** 비활성화 여부 */
  @ApiProperty()
  isDisabled: boolean;

  /** 노드 설명 */
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  /** 소속 컨테이너 노드 UUID */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  containerId?: string | null;

  /** 도구 소유자 노드 UUID */
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  toolOwnerId?: string | null;

  /** 생성 시각 */
  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  /** 수정 시각 */
  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 노드 컴포넌트 포트 정보 */
export class NodePortDto {
  /** 포트 이름 */
  @ApiProperty({ example: 'in' })
  name: string;

  /** 포트 타입 */
  @ApiPropertyOptional({ example: 'data' })
  type?: string;

  /** 포트 라벨 */
  @ApiPropertyOptional()
  label?: string;
}

/** 노드 컴포넌트 정의 (팔레트 메타) */
export class NodeDefinitionDto {
  /** 노드 타입 식별자 */
  @ApiProperty({ example: 'http_request' })
  type: string;

  /** 카테고리 */
  @ApiProperty({ enum: NodeCategory, enumName: 'NodeCategory' })
  category: NodeCategory;

  /** 노드 메타데이터 (label, icon, color, description 등) */
  @ApiProperty({ type: 'object', additionalProperties: true })
  metadata: Record<string, unknown>;

  /** 입력 포트 목록 */
  @ApiProperty({ type: [NodePortDto] })
  inputs: NodePortDto[];

  /** 출력 포트 목록 */
  @ApiProperty({ type: [NodePortDto] })
  outputs: NodePortDto[];

  /** 설정 JSON Schema (Zod → JSON Schema) */
  @ApiProperty({ type: 'object', additionalProperties: true })
  configSchema: Record<string, unknown>;

  /** 기본 설정 값 */
  @ApiProperty({ type: 'object', additionalProperties: true })
  defaultConfig: Record<string, unknown>;

  /** 입력 스키마 (선택) */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  inputSchema?: Record<string, unknown>;

  /** 출력 스키마 (선택) */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  outputSchema?: Record<string, unknown>;

  /**
   * 노드 컴포넌트별 추가 페이로드. 대부분의 노드는 비어 있다 — cafe24
   * 노드만 operationsByResource / plannedByResource 카탈로그를 동봉해
   * frontend 동적 폼 (Resource → Operation → 동적 fields) 을 구성하는데
   * 사용한다. shape 는 노드 타입별로 다르므로 unknown.
   */
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  extras?: Record<string, unknown>;
}

/** 노드 카테고리 메타 */
export class NodeCategoryDto {
  /** 카테고리 식별자 */
  @ApiProperty({ enum: NodeCategory, enumName: 'NodeCategory' })
  category: NodeCategory;

  /** 표시 이름 */
  @ApiProperty()
  label: string;

  /** 설명 */
  @ApiPropertyOptional()
  description?: string;

  /** 정렬 순서 */
  @ApiPropertyOptional({ example: 1 })
  order?: number;
}

/** `/nodes/definitions` 응답 */
export class NodeDefinitionsResponseDto {
  /** 노드 컴포넌트 정의 목록 */
  @ApiProperty({ type: [NodeDefinitionDto] })
  definitions: NodeDefinitionDto[];

  /** 카테고리 메타 목록 */
  @ApiProperty({ type: [NodeCategoryDto] })
  categories: NodeCategoryDto[];
}
