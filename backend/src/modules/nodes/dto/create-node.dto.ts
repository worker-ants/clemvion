import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsObject,
  IsBoolean,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeCategory } from '../entities/node.entity';

export class CreateNodeDto {
  /** 노드 타입 식별자 (최대 50자) */
  @ApiProperty({
    description: '노드 타입 식별자',
    maxLength: 50,
    example: 'http_request',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  /** 노드 카테고리 */
  @ApiProperty({
    description: '노드 카테고리',
    enum: NodeCategory,
    enumName: 'NodeCategory',
  })
  @IsEnum(NodeCategory)
  category: NodeCategory;

  /** 노드 라벨 (워크플로우 내 유일, "#" 포함 불가) */
  @ApiProperty({
    description:
      '노드 라벨. 워크플로우 내 유일해야 하며 "#"을 포함할 수 없습니다.',
    maxLength: 255,
    example: 'Fetch Lead API',
  })
  @IsString()
  @MaxLength(255)
  @Matches(/^[^#]*$/, { message: 'Node label must not contain "#" character' })
  label: string;

  /** 캔버스 X 좌표 (기본 0) */
  @ApiPropertyOptional({ description: '캔버스 X 좌표', example: 250 })
  @IsOptional()
  @IsNumber()
  positionX?: number;

  /** 캔버스 Y 좌표 (기본 0) */
  @ApiPropertyOptional({ description: '캔버스 Y 좌표', example: 300 })
  @IsOptional()
  @IsNumber()
  positionY?: number;

  /** 노드 설정 객체 (타입별 자유 스키마) */
  @ApiPropertyOptional({
    description: '노드 설정 객체',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 비활성화 여부 (기본 false) */
  @ApiPropertyOptional({ description: '비활성화 여부', example: false })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  /** 노드 설명 */
  @ApiPropertyOptional({ description: '노드 설명' })
  @IsOptional()
  @IsString()
  description?: string;

  /** 소속 컨테이너 노드 UUID (없으면 null) */
  @ApiPropertyOptional({
    description: '소속 컨테이너 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  containerId?: string | null;

  /** 도구 소유자 노드 UUID (없으면 null) */
  @ApiPropertyOptional({
    description: '도구 소유자 노드 UUID',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  toolOwnerId?: string | null;
}
