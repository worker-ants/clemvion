import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNodeDto {
  /** 변경할 노드 라벨 ("#" 포함 불가, 워크플로우 내 유일) */
  @ApiPropertyOptional({
    description: '변경할 노드 라벨. "#" 포함 불가, 워크플로우 내 유일',
    maxLength: 255,
    example: 'Fetch API v2',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[^#]*$/, { message: 'Node label must not contain "#" character' })
  label?: string;

  /** 캔버스 X 좌표 */
  @ApiPropertyOptional({ description: '캔버스 X 좌표', example: 260 })
  @IsOptional()
  @IsNumber()
  positionX?: number;

  /** 캔버스 Y 좌표 */
  @ApiPropertyOptional({ description: '캔버스 Y 좌표', example: 320 })
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

  /** 비활성화 여부 */
  @ApiPropertyOptional({ description: '비활성화 여부' })
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
