import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTriggerDto {
  /** 트리거가 실행할 워크플로우 UUID */
  @ApiProperty({
    description: '트리거가 실행할 워크플로우 UUID',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  workflowId: string;

  /** 트리거 타입 (webhook | manual) */
  @ApiProperty({
    description: '트리거 타입. schedule 트리거는 Schedules API로 생성합니다.',
    enum: ['webhook', 'manual'],
    example: 'webhook',
  })
  @IsIn(['webhook', 'manual'])
  type: string;

  /** 트리거 이름 */
  @ApiProperty({
    description: '트리거 이름 (워크스페이스 내에서 식별용)',
    maxLength: 255,
    example: 'Slack 수신 훅',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  /** 활성화 여부 (기본 true) */
  @ApiPropertyOptional({
    description: '생성 시 활성화 여부',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 타입별 설정값 */
  @ApiPropertyOptional({
    description: '타입별 부가 설정값 (key-value)',
    type: 'object',
    additionalProperties: true,
    example: { method: 'POST' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Webhook 트리거의 엔드포인트 경로 */
  @ApiPropertyOptional({
    description:
      'Webhook 트리거 전용. 수신 엔드포인트 경로 (워크스페이스 내 유일)',
    maxLength: 255,
    example: '/hooks/my-integration',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  endpointPath?: string;

  /** 연결할 인증 설정 UUID */
  @ApiPropertyOptional({
    description: '연결할 인증 설정(auth-config) UUID',
    format: 'uuid',
    nullable: true,
    example: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  })
  @IsOptional()
  @IsUUID()
  @Transform(({ value }: { value: unknown }) => (value === '' ? null : value))
  authConfigId?: string | null;
}
