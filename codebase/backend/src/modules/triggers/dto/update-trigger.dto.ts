import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationConfigDto } from './notification-config.dto';
import { InteractionConfigDto } from './interaction-config.dto';
import { ChatChannelConfigDto } from './chat-channel-config.dto';

export class UpdateTriggerDto {
  /** 트리거 이름 */
  @ApiPropertyOptional({
    description: '트리거 이름',
    maxLength: 255,
    example: 'Webhook 수신 훅',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  /** 활성화 여부 */
  @ApiPropertyOptional({
    description: '활성화 여부. false일 경우 이벤트를 받아도 실행되지 않음',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** 타입별 설정값 */
  @ApiPropertyOptional({
    description: '타입별 부가 설정값',
    type: 'object',
    additionalProperties: true,
    example: { method: 'POST' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Webhook 엔드포인트 경로 */
  @ApiPropertyOptional({
    description: 'Webhook 트리거 전용. 수신 엔드포인트 경로',
    maxLength: 255,
    example: '/hooks/my-integration',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  endpointPath?: string;

  /** 인증 설정 UUID */
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

  /**
   * Outbound notification webhook 설정. [Spec EIA §4]. 부분 갱신 — 전체 객체를 다시 보내야 한다.
   */
  @ApiPropertyOptional({ type: () => NotificationConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationConfigDto)
  notification?: NotificationConfigDto;

  /** Inbound interaction 채널 설정. [Spec EIA §4]. */
  @ApiPropertyOptional({ type: () => InteractionConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InteractionConfigDto)
  interaction?: InteractionConfigDto;

  /** Chat Channel 어댑터 설정. [Spec Chat Channel §4.1]. 부분 갱신 — 전체 객체 다시 send. */
  @ApiPropertyOptional({ type: () => ChatChannelConfigDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChatChannelConfigDto)
  chatChannel?: ChatChannelConfigDto;
}
