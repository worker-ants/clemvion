import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  /** 연결할 워크플로우 UUID */
  @ApiProperty({
    description: '스케줄이 실행할 워크플로우 UUID',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  workflowId: string;

  /** 스케줄 이름 (최대 255자) */
  @ApiProperty({
    description: '스케줄(및 자동 생성되는 트리거)의 이름',
    maxLength: 255,
    example: '매일 오전 9시 리포트',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** Cron 식 (5 또는 6 필드 표준 cron) */
  @ApiProperty({
    description: '실행 주기를 나타내는 cron 식',
    maxLength: 100,
    example: '0 9 * * *',
  })
  @IsString()
  @MaxLength(100)
  cronExpression: string;

  /** IANA 타임존 (기본: Asia/Seoul) */
  @ApiPropertyOptional({
    description: '스케줄 기준 타임존 (IANA). 미지정 시 Asia/Seoul',
    maxLength: 100,
    default: 'Asia/Seoul',
    example: 'Asia/Seoul',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  /** 활성화 여부 (기본: true) */
  @ApiPropertyOptional({
    description: '생성 직후 활성화할지 여부',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 실행 시 전달할 워크플로우 파라미터 값 */
  @ApiPropertyOptional({
    description: '실행 시 워크플로우에 전달할 파라미터 값 (key-value)',
    type: 'object',
    additionalProperties: true,
    example: { region: 'kr', limit: 100 },
  })
  @IsOptional()
  @IsObject()
  parameterValues?: Record<string, unknown>;
}
