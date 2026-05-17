import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  /** 폴더 이름 (1~100자, 동일 부모 아래에서 유일) */
  @ApiProperty({
    description: '폴더 이름. 동일 부모 아래에서 유일해야 합니다.',
    minLength: 1,
    maxLength: 100,
    example: '마케팅',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** 부모 폴더 UUID (루트에 생성할 경우 생략) */
  @ApiPropertyOptional({
    description: '부모 폴더 UUID. 루트 폴더는 생략',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** 정렬 순서 (기본 0) */
  @ApiPropertyOptional({
    description: '정렬 순서',
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
