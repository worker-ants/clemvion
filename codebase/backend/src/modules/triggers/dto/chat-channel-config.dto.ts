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
  MinLength,
  IsEmpty,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Trigger.config.chatChannel — webhook 트리거에 외부 chat 플랫폼 어댑터를 부착하는 옵션.
 *
 * SoT:
 *   - spec/5-system/15-chat-channel.md §4.1 (Trigger.config.chatChannel)
 *   - spec/conventions/chat-channel-adapter.md §2.3 (ChatChannelConfig)
 *   - spec/4-nodes/7-trigger/providers/_overview.md §1 (supported providers v1: telegram / slack / discord)
 *   - spec/4-nodes/7-trigger/providers/telegram.md
 *   - spec/4-nodes/7-trigger/providers/slack.md
 *   - spec/4-nodes/7-trigger/providers/discord.md
 *   - spec/conventions/secret-store.md §5.5 (inboundSigningPlaintext 입력 분기)
 *
 * 본 DTO 는 입력 형식만 검증. provider 별 추가 검증 (Telegram bot token 형식, Slack signing
 * secret hex32, Discord ed25519 public key hex64) 과 inboundSigningPlaintext 의 provider별
 * 요구/금지 분기는 TriggersService 가 수행.
 */
export const CHAT_CHANNEL_PROVIDERS = ['telegram', 'slack', 'discord'] as const;
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

// ---------------------------------------------------------------------------
// CCH-ERR-03 placeholder whitelist validator
// (선언 순서 — Validator class 는 @Validate decorator 사용 전에 정의되어야 함, TDZ 회피)
// ---------------------------------------------------------------------------

/**
 * CCH-ERR-* 6 키 — Spec Chat Channel §4.1.1.
 * 본 validator 의 scope (다른 키들은 검증 면제 — 기존 키 영향 회피).
 */
const FAILURE_HINT_KEYS = [
  'executionFailedThirdParty4xx',
  'executionFailedThirdParty5xx',
  'executionFailedThirdParty',
  'executionFailedTimeout',
  'executionFailedRateLimit',
  'executionFailedInternal',
] as const;

const ALLOWED_PLACEHOLDER = '{statusCode}';
// 모든 {...} 토큰을 추출 — 허용 외 placeholder 검출용.
const PLACEHOLDER_REGEX = /\{[^}]+\}/g;

function findFirstUnknownPlaceholder(
  value: unknown,
): { field: string; placeholder: string } | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  for (const key of FAILURE_HINT_KEYS) {
    const template = (value as Record<string, unknown>)[key];
    if (typeof template !== 'string') continue;
    const matches = template.match(PLACEHOLDER_REGEX) ?? [];
    for (const ph of matches) {
      if (ph !== ALLOWED_PLACEHOLDER) {
        return { field: `languageHints.${key}`, placeholder: ph };
      }
    }
  }
  return null;
}

/**
 * Spec Chat Channel R-CC-15 (c) / CCH-ERR-03 — `languageHints[CCH-ERR-* 6 키]` 의 template 안에서
 * 허용되는 placeholder 는 `{statusCode}` 1종. 다른 `{...}` 토큰 발견 시 reject.
 *
 * 기존 키 (`groupChatRefusal`, `executionStarted`, `executionCompleted`, `executionStillRunning`,
 * `help`, `executionCancelled` 등) 는 본 validator scope 밖 — 기존 운영 데이터 영향 회피.
 */
@ValidatorConstraint({ name: 'languageHintsPlaceholder', async: false })
export class LanguageHintsPlaceholderValidator
  implements ValidatorConstraintInterface
{
  // Stateless — instance fields 회피 (class-validator singleton 패턴에서의 race 회피).
  validate(value: unknown, _args: ValidationArguments): boolean {
    return findFirstUnknownPlaceholder(value) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    // ValidationPipe exceptionFactory 가 message 를 파싱해 details.code='UNKNOWN_PLACEHOLDER' +
    // details.field 합성. message 포맷: `UNKNOWN_PLACEHOLDER:<field>:<placeholder>`.
    const found = findFirstUnknownPlaceholder(args.value);
    if (found) {
      return `UNKNOWN_PLACEHOLDER:${found.field}:${found.placeholder}`;
    }
    return 'UNKNOWN_PLACEHOLDER';
  }
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
    description:
      '어댑터 식별자. v1 supported: telegram / slack / discord ' +
      '(spec/4-nodes/7-trigger/providers/_overview.md §1 단일 진실).',
    enum: CHAT_CHANNEL_PROVIDERS,
    example: 'telegram',
  })
  @IsString()
  @IsIn(CHAT_CHANNEL_PROVIDERS as unknown as string[])
  provider: ChatChannelProvider;

  @ApiProperty({
    description:
      'Active bot token (provider 발급). telegram = BotFather 발급 `\\d+:[A-Za-z0-9_-]+` / ' +
      'slack = OAuth Install 시 발급 `xoxb-...` / discord = Developer Portal Bot 탭 발급. ' +
      '입력 전용 — 서버가 secret store 에 저장 후 응답에는 포함하지 않음 ' +
      '(spec/conventions/secret-store.md §4 SS-SE-01).',
    minLength: 1,
    maxLength: 256,
    example: '123456789:AAFakeTokenForExample',
    writeOnly: true,
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
   * 외부 입력 금지 — Telegram (server-issued) 의 issuedInboundSigning 만 저장하는 내부 필드.
   * 본 필드는 외부 입력 시 400. provider-issued (Slack signing secret / Discord public key) 입력은
   * 별 신규 필드 `inboundSigningPlaintext` 사용.
   */
  @ApiPropertyOptional({
    description:
      '(내부 발급 — 외부 입력 금지) Webhook 인증용 server-issued secret. ' +
      'provider-issued 입력은 inboundSigningPlaintext 사용.',
    maxLength: 128,
    readOnly: true,
  })
  @IsOptional()
  @IsEmpty({
    message:
      'inboundSigning 은 setupChannel 시 자동 발급되는 내부 필드입니다. provider-issued (Slack signing secret / Discord public key) 입력은 inboundSigningPlaintext 를 사용하세요.',
  })
  inboundSigning?: string;

  /**
   * Provider-issued inbound webhook 인증 자료의 plaintext 입력 — Slack signing secret /
   * Discord ed25519 application public key. 사용자가 외부 portal 에서 발급된 값을 그대로 입력.
   *
   * 입력 후 service 가 `SecretResolver.store(inboundSigningRef, plaintext)` 로 옮긴 뒤
   * trigger.config 에는 절대 흘러가지 않음 (SS-SE-01) — `inboundSigningRef` 만 보관.
   *
   * provider 별 분기:
   *   - telegram → 본 필드 입력 시 400 (server-issued 만, randomBytes 자동 발급).
   *   - slack → 필수. hex 32 chars (^[a-f0-9]{32}$).
   *   - discord → 필수. hex 64 chars (^[a-f0-9]{64}$, ed25519 public key 32 bytes).
   *
   * 형식 검증은 service 단에서 수행 (provider 정보가 있어야 분기 가능). DTO 는 String 타입과
   * 길이 상한만 검증.
   *
   * @see spec/conventions/secret-store.md §5.5 (b) provider-issued plaintext 흐름
   * @see spec/conventions/chat-channel-adapter.md §2.3 (inboundSigningRef 단일 슬롯 단일 진실)
   * @see spec/5-system/15-chat-channel.md §4.1 (chatChannel 스키마)
   * @see spec/4-nodes/7-trigger/providers/slack.md §6 R-S-1
   * @see spec/4-nodes/7-trigger/providers/discord.md §6
   * @see `@workflow/chat-channel-validation` — backend / frontend 가 공유하는 정규식 SoT (lowercase hex)
   */
  @ApiPropertyOptional({
    description:
      'Provider-issued inbound webhook 인증 자료 plaintext. ' +
      'slack = signing secret lowercase hex 32 / discord = ed25519 public key lowercase hex 64. ' +
      'telegram = 본 필드 미사용 (server-issued, randomBytes 자동 발급). ' +
      '응답에서 strip — config 에는 inboundSigningRef 만 보관 ' +
      '(spec/conventions/secret-store.md §4 SS-SE-01). ' +
      'minLength 는 Slack 최소 (32). Discord (64) 와 형식 (lowercase hex) 는 ' +
      'TriggersService 의 provider 별 분기 검증.',
    minLength: 32,
    maxLength: 128,
    example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
    writeOnly: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  inboundSigningPlaintext?: string;

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
      "languageHints 미설정 키의 default 문구 locale. 'ko' (default) | 'en'. " +
      'spec/5-system/15-chat-channel.md §4.1 / §4.1.1.',
    enum: ['ko', 'en'],
    default: 'ko',
  })
  @IsOptional()
  @IsIn(['ko', 'en'])
  languageLocale?: 'ko' | 'en';

  @ApiPropertyOptional({
    description:
      '봇이 보내는 자체 안내 메시지 i18n (groupChatRefusal / executionStarted / executionCompleted / ' +
      'CCH-ERR-* 6 키 [executionFailedThirdParty4xx / *5xx / ThirdParty / Timeout / RateLimit / Internal] 등). ' +
      'CCH-ERR-* 키의 template 안에서 허용되는 placeholder 는 {statusCode} 1종 (CCH-ERR-03). ' +
      '다른 {...} placeholder 발견 시 400 VALIDATION_ERROR (code=UNKNOWN_PLACEHOLDER).',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  @Validate(LanguageHintsPlaceholderValidator)
  languageHints?: Record<string, string>;
}

