import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsInt,
  Min,
  IsBoolean,
  IsObject,
  IsIn,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ALL_NODE_TYPES } from '../../../nodes';
import { NodeCategory } from '../../nodes/entities/node.entity';

const ALLOWED_NODE_TYPES = [...ALL_NODE_TYPES];
const ALLOWED_CATEGORIES = Object.values(NodeCategory);

class ImportNodeDto {
  @ApiProperty({
    description: '노드 타입 식별자',
    enum: ALLOWED_NODE_TYPES,
    example: 'http_request',
  })
  @IsString()
  @IsIn(ALLOWED_NODE_TYPES)
  type: string;

  @ApiProperty({
    description: '노드 카테고리',
    enum: ALLOWED_CATEGORIES,
    example: 'integration',
  })
  @IsEnum(NodeCategory)
  category: NodeCategory;

  @ApiProperty({
    description: '노드 라벨. 워크플로우 내에서 유일해야 합니다.',
    example: 'Fetch Lead API',
  })
  @IsString()
  label: string;

  @ApiProperty({ description: '캔버스 X 좌표', example: 250 })
  @IsNumber()
  positionX: number;

  @ApiProperty({ description: '캔버스 Y 좌표', example: 300 })
  @IsNumber()
  positionY: number;

  @ApiPropertyOptional({
    description: '노드별 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '노드 비활성화 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @ApiPropertyOptional({ description: '노드 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: '컨테이너 노드의 인덱스 (nodes 배열 내 index). 루트면 null',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  containerIndex?: number | null;

  @ApiPropertyOptional({
    description: 'Tool 소유 노드의 인덱스 (nodes 배열 내 index). 없으면 null',
    nullable: true,
    example: null,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  toolOwnerIndex?: number | null;
}

class ImportEdgeDto {
  @ApiProperty({
    description: 'source 노드 인덱스 (nodes 배열 내 index)',
    example: 0,
  })
  @IsInt()
  @Min(0)
  sourceNodeIndex: number;

  @ApiPropertyOptional({ description: 'source 포트 이름', example: 'out' })
  @IsOptional()
  @IsString()
  sourcePort?: string;

  @ApiProperty({
    description: 'target 노드 인덱스 (nodes 배열 내 index)',
    example: 1,
  })
  @IsInt()
  @Min(0)
  targetNodeIndex: number;

  @ApiPropertyOptional({ description: 'target 포트 이름', example: 'in' })
  @IsOptional()
  @IsString()
  targetPort?: string;

  @ApiPropertyOptional({
    description: '엣지 타입',
    enum: ['data', 'error'],
    example: 'data',
  })
  @IsOptional()
  @IsIn(['data', 'error'])
  type?: string;

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
  @ApiProperty({
    description: '가져올 워크플로우 이름',
    example: '가져온 워크플로우',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '워크플로우 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '태그 목록', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: '워크플로우 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiProperty({
    description:
      '노드 정의 배열. 배열 순서가 edges/containerIndex/toolOwnerIndex의 index와 매핑됩니다.',
    type: () => [ImportNodeDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNodeDto)
  nodes: ImportNodeDto[];

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
