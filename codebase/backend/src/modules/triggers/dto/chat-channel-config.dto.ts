import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Trigger.config.chatChannel — webhook 트리거에 외부 chat 플랫폼 어댑터를 부착하는 옵션.
 *
 * SoT:
 *   - spec/5-system/15-chat-channel.md §4.1 (Trigger.config.chatChannel)
 *   - spec/conventions/chat-channel-adapter.md §2.3 (ChatChannelConfig)
 *   - spec/4-nodes/7-trigger/providers/telegram.md
 *
 * 본 DTO 는 입력 형식만 검증. provider 별 추가 검증 (Telegram bot token 형식 등) 은 어댑터의
 * setupChannel 단계에서 수행 (getMe 호출이 실 검증).
 */
export const CHAT_CHANNEL_PROVIDERS = ['telegram'] as const;
export type ChatChannelProvider = (typeof CHAT_CHANNEL_PROVIDERS)[number];

export class ChatChannelUiMappingDto {
  @ApiPropertyOptional({
    description: 'Form 노드의 채널 UI 매핑 모드. v1 은 multi_step 만.',
    enum: ['multi_step'],
    default: 'multi_step',
  })
  @IsOptional()
  @IsIn(['multi_step'])
  formMode?: 'multi_step';

  @ApiPropertyOptional({
    description: '시각형 노드 (Carousel/Chart/Table) 의 채널 표현 방식.',
    enum: ['photo', 'text_only'],
    default: 'photo',
  })
  @IsOptional()
  @IsIn(['photo', 'text_only'])
  visualNode?: 'photo' | 'text_only';

  @ApiPropertyOptional({
    description: 'Button 노드의 inline keyboard layout.',
    enum: ['auto', 'vertical', 'horizontal'],
    default: 'auto',
  })
  @IsOptional()
  @IsIn(['auto', 'vertical', 'horizontal'])
  buttonLayout?: 'auto' | 'vertical' | 'horizontal';
}

export class ChatChannelBotIdentityDto {
  @ApiPropertyOptional({ description: '봇의 외부 식별자 (텔레그램: bot_id).' })
  @IsOptional()
  @IsInt()
  botId?: number;

  @ApiPropertyOptional({ description: '봇의 사용자 이름 (텔레그램: username).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;
}

export class ChatChannelConfigDto {
  @ApiProperty({
    description: '어댑터 식별자. v1 은 telegram 만 지원.',
    enum: CHAT_CHANNEL_PROVIDERS,
    example: 'telegram',
  })
  @IsString()
  @IsIn(CHAT_CHANNEL_PROVIDERS as unknown as string[])
  provider: ChatChannelProvider;

  @ApiProperty({
    description:
      'Active bot token (텔레그램 BotFather 발급). v1 stub — config JSONB 평문 보관 (notification.signing.secret 와 동일 정책). 향후 암호화 컬럼 분리.',
    minLength: 1,
    maxLength: 256,
    example: '123456789:AAFakeTokenForExample',
  })
  @IsString()
  @MaxLength(256)
  botToken: string;

  @ApiPropertyOptional({
    description:
      '미래 형태 — secret store reference (예: secret://triggers/{id}/bot-token). v1 미사용.',
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  botTokenRef?: string;

  @ApiPropertyOptional({
    description:
      'Webhook 인증용 server-issued secret. setupChannel 시 어댑터가 발급. 외부 입력 금지 — 본 필드가 입력으로 들어와도 어댑터가 setupChannel 결과로 덮어쓴다.',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  secretToken?: string;

  @ApiPropertyOptional({
    description: 'setupChannel 결과 캐시 (read-only). 입력으로 보내도 어댑터가 덮어쓴다.',
    type: () => ChatChannelBotIdentityDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChatChannelBotIdentityDto)
  botIdentity?: ChatChannelBotIdentityDto;

  @ApiPropertyOptional({ type: () => ChatChannelUiMappingDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChatChannelUiMappingDto)
  uiMapping?: ChatChannelUiMappingDto;

  @ApiPropertyOptional({
    description: '채널당 분당 최대 inbound update (default 60). 0 또는 음수 금지.',
    minimum: 1,
    maximum: 600,
    default: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({
    description:
      '봇이 보내는 자체 안내 메시지 i18n (groupChatRefusal / executionStarted / executionCompleted 등).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  languageHints?: Record<string, string>;
}
