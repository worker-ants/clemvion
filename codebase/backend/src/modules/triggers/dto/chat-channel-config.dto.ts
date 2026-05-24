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
  IsEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
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
    description:
      '시각형 노드 (Carousel/Chart/Table) 의 채널 표현 방식. ' +
      'text=텍스트 전용 (carousel imageUrl 무시), ' +
      'photo=v2 SSR PNG (v1 단계에서는 fallback to text + warning 로그), ' +
      'auto=노드별 자동 (chart/table→text, carousel imageUrl 있으면 sendPhoto). ' +
      'legacy "text_only" 입력은 read-time 에 "text" 로 normalize. ' +
      '상세 spec/conventions/chat-channel-adapter.md §2.3.',
    enum: ['text', 'photo', 'auto'],
    default: 'auto',
  })
  @IsOptional()
  @Transform(({ value }) => (value === 'text_only' ? 'text' : value))
  @IsIn(['text', 'photo', 'auto'])
  visualNode?: 'text' | 'photo' | 'auto';

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

  @ApiPropertyOptional({
    description: '봇의 사용자 이름 (텔레그램: username).',
  })
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
      'Active bot token (텔레그램 BotFather 발급). 입력 전용 — 서버가 secret store 에 저장 후 응답에는 포함하지 않음.',
    minLength: 1,
    maxLength: 256,
    example: '123456789:AAFakeTokenForExample',
  })
  @IsString()
  @MaxLength(256)
  botToken: string;

  /**
   * 외부 입력 금지 — [Spec Chat Channel §5.4.1 single-path](../../../spec/5-system/15-chat-channel.md#541-bot-token-변경-single-path-정책).
   * 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 로만 가능.
   * PATCH body 또는 POST body 에 본 필드가 포함되면 400 VALIDATION_ERROR (details.field='botTokenRef').
   * 응답에는 strip — 사용자에게 노출되지 않고 `hasBotToken: boolean` derived 필드로만 존재 여부 알림.
   */
  @ApiPropertyOptional({
    description:
      '(내부 식별자 — 외부 입력 금지) Secret store reference. ' +
      '응답에서 strip 되며 hasBotToken derived 필드로 존재 여부만 노출. ' +
      'Spec Chat Channel §5.4.1 single-path 정책.',
    maxLength: 256,
    readOnly: true,
  })
  @IsOptional()
  @IsEmpty({
    message:
      'botTokenRef 는 외부 입력이 금지된 내부 필드입니다. 토큰 변경은 POST /api/triggers/:id/chat-channel/rotate-bot-token 을 사용하세요.',
  })
  botTokenRef?: string;

  /**
   * 외부 입력 금지 — setupChannel 결과 issuedInboundSigning 이 저장되면 채워진다.
   * 응답에서 strip — 사용자에게 노출 금지.
   */
  @ApiPropertyOptional({
    description:
      '(내부 식별자 — 외부 입력 금지) Webhook secret store reference. ' +
      '응답에서 strip.',
    maxLength: 256,
    readOnly: true,
  })
  @IsOptional()
  @IsEmpty({
    message: 'inboundSigningRef 는 외부 입력이 금지된 내부 필드입니다.',
  })
  inboundSigningRef?: string;

  /**
   * 외부 입력 금지 — setupChannel 시 어댑터가 발급. 본 필드가 입력으로 들어오면 무시되지 않고
   * 400 VALIDATION_ERROR 반환 (silent 무시 시 사용자가 secret 을 직접 제어한다고 오해).
   */
  @ApiPropertyOptional({
    description:
      '(내부 발급 — 외부 입력 금지) Webhook 인증용 server-issued secret.',
    maxLength: 128,
    readOnly: true,
  })
  @IsOptional()
  @IsEmpty({
    message:
      'inboundSigning 은 setupChannel 시 자동 발급되는 내부 필드입니다. 외부 입력은 허용되지 않습니다.',
  })
  inboundSigning?: string;

  @ApiPropertyOptional({
    description:
      'setupChannel 결과 캐시 (read-only). 입력으로 보내도 어댑터가 덮어쓴다.',
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
    description:
      '채널당 분당 최대 inbound update (default 60). 0 또는 음수 금지.',
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
