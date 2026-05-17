import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EdgeType } from '../entities/edge.entity';

export class CreateEdgeDto {
  /** source 노드 UUID (자기 자신으로의 연결은 불가) */
  @ApiProperty({
    description: 'source 노드 UUID',
    format: 'uuid',
    example: '3f5a9b0c-2b8d-4e9a-8f1b-7c9e2d4a5b6c',
  })
  @IsUUID()
  sourceNodeId: string;

  /** source 포트 이름 (기본 out) */
  @ApiPropertyOptional({
    description: 'source 포트 이름',
    maxLength: 100,
    default: 'out',
    example: 'out',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourcePort?: string;

  /** target 노드 UUID (source와 동일할 수 없음) */
  @ApiProperty({
    description: 'target 노드 UUID',
    format: 'uuid',
    example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID()
  targetNodeId: string;

  /** target 포트 이름 (기본 in) */
  @ApiPropertyOptional({
    description: 'target 포트 이름',
    maxLength: 100,
    default: 'in',
    example: 'in',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetPort?: string;

  /** 엣지 타입 (data: 일반 흐름, error: 에러 포트) */
  @ApiPropertyOptional({
    description: '엣지 타입',
    enum: EdgeType,
    enumName: 'EdgeType',
    default: EdgeType.DATA,
  })
  @IsOptional()
  @IsEnum(EdgeType)
  type?: EdgeType;

  /** 조건부 엣지에 적용되는 조건식 */
  @ApiPropertyOptional({
    description: '조건부 엣지에 적용되는 조건 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;
}
