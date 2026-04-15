import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const ALLOWED_NODE_TYPES = [
  'manual_trigger',
  'if_else',
  'switch',
  'loop',
  'variable_declaration',
  'variable_modification',
  'split',
  'map',
  'foreach',
  'merge',
  'workflow',
  'http_request',
  'database_query',
  'send_email',
  'transform',
  'code',
  'carousel',
  'table',
  'chart',
  'form',
  'template',
];

const ALLOWED_CATEGORIES = [
  'trigger',
  'logic',
  'flow',
  'ai',
  'integration',
  'data',
  'presentation',
];

class ImportNodeDto {
  /** 노드 타입 (허용 목록 내의 값) */
  @ApiProperty({
    description: '노드 타입 식별자',
    enum: ALLOWED_NODE_TYPES,
    example: 'http_request',
  })
  @IsString()
  @IsIn(ALLOWED_NODE_TYPES)
  type: string;

  /** 노드 카테고리 */
  @ApiProperty({
    description: '노드 카테고리',
    enum: ALLOWED_CATEGORIES,
    example: 'integration',
  })
  @IsString()
  @IsIn(ALLOWED_CATEGORIES)
  category: string;

  /** 노드 라벨 (워크플로우 내 유일) */
  @ApiProperty({
    description: '노드 라벨. 워크플로우 내에서 유일해야 합니다.',
    example: 'Fetch Lead API',
  })
  @IsString()
  label: string;

  /** 캔버스 X 좌표 */
  @ApiProperty({ description: '캔버스 X 좌표', example: 250 })
  @IsNumber()
  positionX: number;

  /** 캔버스 Y 좌표 */
  @ApiProperty({ description: '캔버스 Y 좌표', example: 300 })
  @IsNumber()
  positionY: number;

  /** 노드 설정 객체 */
  @ApiPropertyOptional({
    description: '노드별 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 비활성화 여부 */
  @ApiPropertyOptional({ description: '노드 비활성화 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  /** 노드 설명 */
  @ApiPropertyOptional({ description: '노드 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  /** 컨테이너 노드의 인덱스 (nodes 배열 내 index) */
  @ApiPropertyOptional({
    description: '컨테이너 노드 인덱스 (nodes 배열 내 index). null이면 루트',
    nullable: true,
    example: null,
  })
  @IsOptional()
  containerId?: number | null;

  /** 도구 소유 노드 ID (tool ownership; import 시 임의 식별자 허용) */
  @ApiPropertyOptional({
    description: '도구 소유자 노드 식별자',
    nullable: true,
  })
  @IsOptional()
  toolOwnerId?: string | null;
}

class ImportEdgeDto {
  /** source 노드 인덱스 (nodes 배열 내 index) */
  @ApiProperty({
    description: 'source 노드 인덱스 (nodes 배열 내 index)',
    example: 0,
  })
  @IsNumber()
  sourceNodeIndex: number;

  /** source 포트 이름 (기본 out) */
  @ApiPropertyOptional({ description: 'source 포트 이름', example: 'out' })
  @IsOptional()
  @IsString()
  sourcePort?: string;

  /** target 노드 인덱스 (nodes 배열 내 index) */
  @ApiProperty({
    description: 'target 노드 인덱스 (nodes 배열 내 index)',
    example: 1,
  })
  @IsNumber()
  targetNodeIndex: number;

  /** target 포트 이름 (기본 in) */
  @ApiPropertyOptional({ description: 'target 포트 이름', example: 'in' })
  @IsOptional()
  @IsString()
  targetPort?: string;

  /** 엣지 타입 (data: 일반 흐름, error: 에러 포트 흐름) */
  @ApiPropertyOptional({
    description: '엣지 타입',
    enum: ['data', 'error'],
    example: 'data',
  })
  @IsOptional()
  @IsIn(['data', 'error'])
  type?: string;

  /** 조건부 엣지에 사용할 조건식 객체 */
  @ApiPropertyOptional({
    description: '조건부 엣지의 조건 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}

export class ImportWorkflowDto {
  /** 가져올 워크플로우 이름 */
  @ApiProperty({
    description: '가져올 워크플로우 이름',
    example: '가져온 워크플로우',
  })
  @IsString()
  name: string;

  /** 설명 */
  @ApiPropertyOptional({ description: '워크플로우 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  /** 태그 목록 */
  @ApiPropertyOptional({ description: '태그 목록', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  /** 워크플로우 설정 객체 */
  @ApiPropertyOptional({
    description: '워크플로우 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  /** 노드 정의 배열 (순서가 인덱스 역할을 합니다) */
  @ApiProperty({
    description: '노드 정의 배열. 배열 순서가 edges의 index와 매핑됩니다.',
    type: () => [ImportNodeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNodeDto)
  nodes: ImportNodeDto[];

  /** 엣지 정의 배열 */
  @ApiPropertyOptional({
    description: '엣지 정의 배열',
    type: () => [ImportEdgeDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEdgeDto)
  edges?: ImportEdgeDto[];
}
