import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFolderDto {
  /** 변경할 폴더 이름 (1~100자) */
  @ApiPropertyOptional({
    description: '변경할 폴더 이름',
    minLength: 1,
    maxLength: 100,
    example: '세일즈',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  /** 이동할 부모 폴더 UUID (루트로 이동 시 null 또는 빈 문자열) */
  @ApiPropertyOptional({
    description: '이동할 부모 폴더 UUID. 루트로 이동 시 null',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  parentId?: string | null;

  /** 정렬 순서 */
  @ApiPropertyOptional({ description: '정렬 순서', example: 1 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
