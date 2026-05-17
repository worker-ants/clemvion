import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewExpressionDto {
  /** 미리보기할 cron 식 */
  @ApiProperty({
    description: '다음 실행 시각을 미리보기할 cron 식',
    maxLength: 100,
    example: '0 9 * * *',
  })
  @IsString()
  @MaxLength(100)
  cronExpression: string;

  /** 타임존 (IANA, 기본: Asia/Seoul) */
  @ApiPropertyOptional({
    description: '미리보기 기준 타임존 (IANA)',
    maxLength: 50,
    default: 'Asia/Seoul',
    example: 'Asia/Seoul',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  /** 반환할 실행 시각 개수 (1~20, 기본 5) */
  @ApiPropertyOptional({
    description: '반환할 다음 실행 시각의 개수',
    minimum: 1,
    maximum: 20,
    default: 5,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;
}
