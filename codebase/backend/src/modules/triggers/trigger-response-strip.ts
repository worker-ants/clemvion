import type { ChatChannelConfig } from '../chat-channel/types';
import type {
  ChatChannelConfigDto,
  ChatChannelUpdateConfigDto,
} from './dto/chat-channel-config.dto';
import type { InteractionConfigDto } from './dto/interaction-config.dto';
import type { NotificationSigningDto } from './dto/notification-config.dto';
import type { Trigger } from './entities/trigger.entity';

// 근거: [시크릿 저장소 「응답 비노출」](CLE-INT-SECRET-EXPOSE), [응답 자격 증명 마스킹 「규칙」](CLE-API-EGRESS#규칙)
//
// 트리거 응답에 무엇을 싣는지 필드마다 선언한다. 비밀은 엔티티 컬럼과 `config` JSONB 안의 키, 두 종류 자리에 산다.
// 예전에는 지울 이름만 손으로 적은 목록 네 벌이 있었고, 새 비밀 자리를 목록에 넣지 않은 일이 세 번 났다.
// 이 파일은 지울 것만 적지 않고 모든 필드를 분류한다. 표의 키 타입이 필드 전체라서 필드를 하나 더하고 분류하지
// 않으면 `satisfies` 가 컴파일 오류를 낸다(빠진 키 · 없는 키 양쪽). `TriggersService.sanitizeForResponse` 가
// 아래에서 뽑은 목록을 쓴다.
//
// 이 판정이 닿지 않는 자리: JSONB 표의 키 타입은 요청 DTO 의 키와 서버가 쓰는 키를 합친 것이다. 서버가 DTO 밖의
// 새 키를 JSONB 에 쓰면 타입에 나타나지 않는다. 그런 키는 원시 `config` 로 받지 않도록
// `CONFIG_INTERNAL_FIELDS`(`trigger-config-internal-fields.ts`)에도 넣어야 하고, 그 목록의 경로가 여기서
// `strip` 인지는 단위 테스트(`trigger-response-strip.spec.ts`)가 대조한다. 표에 없는 키는 응답에 그대로 나간다
// (응답 모양을 바꾸지 않으려고 기본값을 노출로 둔다).

/**
 * 엔티티 컬럼 · 관계의 응답 처리.
 * - `expose`: 그대로 싣는다.
 * - `strip`: 키를 지운다(비밀 · 시크릿 저장소 참조).
 * - `redact`: 값은 싣고 그 안의 자격 증명 모양만 `***` 로 가린다(진단 원문).
 * - `narrow`: 조인된 관계를 참조 필드로 좁힌다.
 * - `keys`: JSONB 다. 안의 키를 아래 JSONB 표로 정화한다.
 */
export type TriggerColumnResponse =
  'expose' | 'strip' | 'redact' | 'narrow' | 'keys';

/**
 * 트리거 엔티티의 모든 필드. 컬럼을 더하면 여기서 분류해야 컴파일된다.
 *
 * `notificationSecretV2` 는 교체 유예 동안의 평문 서명 시크릿이고 `chatChannelTokenV2` 는 시크릿 저장소 참조다.
 * `select: false` 로 끄지 않는 이유는 교체 스윕이 이 컬럼을 읽기 때문이다(꺼지면 스윕이 `undefined` 를 받고 오류 없이
 * 오작동한다). 그래서 응답 경계에서 지운다.
 */
export const TRIGGER_COLUMN_RESPONSE = {
  id: 'expose',
  workspaceId: 'expose',
  workspace: 'expose',
  workflowId: 'expose',
  workflow: 'narrow',
  type: 'expose',
  name: 'expose',
  isActive: 'expose',
  config: 'keys',
  endpointPath: 'expose',
  authConfigId: 'expose',
  lastTriggeredAt: 'expose',
  notificationHealth: 'expose',
  notificationLastError: 'redact',
  notificationSecretV2: 'strip',
  notificationRotatedAt: 'expose',
  chatChannelHealth: 'expose',
  chatChannelLastError: 'redact',
  chatChannelSetupAt: 'expose',
  chatChannelTokenV2: 'strip',
  chatChannelRotatedAt: 'expose',
  createdAt: 'expose',
  updatedAt: 'expose',
} as const satisfies Record<keyof Trigger, TriggerColumnResponse>;

/** JSONB 안 키의 응답 처리. `expose` 는 그대로 싣고 `strip` 은 지운다. */
export type ConfigKeyResponse = 'expose' | 'strip';

/**
 * `config.chatChannel` 의 키. 저장 모양(`ChatChannelConfig`)과 생성 · 수정 DTO 의 키를 모두 분류한다.
 * 시크릿 저장소 참조와 입력 전용 평문은 지운다. 응답에는 대신 파생 필드 `hasBotToken` 이 붙는다.
 */
export const CHAT_CHANNEL_CONFIG_KEY_RESPONSE = {
  provider: 'expose',
  botTokenRef: 'strip',
  inboundSigningRef: 'strip',
  botToken: 'strip',
  inboundSigning: 'strip',
  inboundSigningPlaintext: 'strip',
  botIdentity: 'expose',
  uiMapping: 'expose',
  rateLimitPerMinute: 'expose',
  languageLocale: 'expose',
  languageHints: 'expose',
} as const satisfies Record<
  | keyof ChatChannelConfig
  | keyof ChatChannelConfigDto
  | keyof ChatChannelUpdateConfigDto,
  ConfigKeyResponse
>;

/**
 * 서버가 `config.notification.signing` 에 쓰는 키. DTO 에는 없다. `secretRef` 는 시크릿 저장소 참조이고 `secret` 은
 * 정규화 전 옛 평문이 남는 자리다(`notification-signing-secret.ts`).
 */
type ServerNotificationSigningKey = 'secretRef' | 'secret';

/** `config.notification.signing` 의 키. */
export const NOTIFICATION_SIGNING_KEY_RESPONSE = {
  algorithm: 'expose',
  secretRef: 'strip',
  secret: 'strip',
} as const satisfies Record<
  keyof NotificationSigningDto | ServerNotificationSigningKey,
  ConfigKeyResponse
>;

/**
 * 서버가 `config.interaction` 에 쓰는 키. DTO 에는 없다. `triggerToken`(`itk_*`)은 JSONB 에 평문으로 남는 트리거
 * 단위 bearer 토큰이고 발급 응답에만 한 번 싣는다.
 */
type ServerInteractionKey = 'triggerToken';

/** `config.interaction` 의 키. */
export const INTERACTION_CONFIG_KEY_RESPONSE = {
  enabled: 'expose',
  tokenStrategy: 'expose',
  appearance: 'expose',
  triggerToken: 'strip',
} as const satisfies Record<
  keyof InteractionConfigDto | ServerInteractionKey,
  ConfigKeyResponse
>;

/** 표에서 값이 `label` 인 키를 선언 순서대로 고른다. 라벨이 유니온이라 오타는 컴파일 오류다. */
function keysLabelled<
  K extends string,
  L extends TriggerColumnResponse | ConfigKeyResponse,
>(table: Readonly<Record<K, L>>, label: L): K[] {
  return (Object.keys(table) as K[]).filter((key) => table[key] === label);
}

/** 응답에서 지울 엔티티 컬럼. */
export const TRIGGER_RESPONSE_STRIP_COLUMNS: readonly (keyof Trigger)[] =
  keysLabelled(TRIGGER_COLUMN_RESPONSE, 'strip');

/** 응답에서 값 안의 자격 증명 모양을 가릴 진단 원문 컬럼. */
export const TRIGGER_RESPONSE_REDACT_COLUMNS: readonly (keyof Trigger)[] =
  keysLabelled(TRIGGER_COLUMN_RESPONSE, 'redact');

/** `config` JSONB 안의 한 축. `prefix` 는 `config` 아래 경로, `stripKeys` 는 그 표에서 `strip` 인 키다. */
export interface ConfigKeyAxis {
  readonly prefix: readonly string[];
  readonly table: Readonly<Record<string, ConfigKeyResponse>>;
  readonly stripKeys: ReadonlySet<string>;
}

function configKeyAxis(
  prefix: readonly string[],
  table: Readonly<Record<string, ConfigKeyResponse>>,
): ConfigKeyAxis {
  return { prefix, table, stripKeys: new Set(keysLabelled(table, 'strip')) };
}

/**
 * JSONB 축 레지스트리. 접두사 · 표 · 지울 키가 한 곳에 있고 `TriggersService.sanitizeForResponse` 와
 * 단위 테스트가 이것을 함께 쓴다. 축을 더하거나 접두사를 바꾸면 서비스와 테스트가 같이 따라온다.
 */
export const CONFIG_KEY_AXES = {
  chatChannel: configKeyAxis(['chatChannel'], CHAT_CHANNEL_CONFIG_KEY_RESPONSE),
  notificationSigning: configKeyAxis(
    ['notification', 'signing'],
    NOTIFICATION_SIGNING_KEY_RESPONSE,
  ),
  interaction: configKeyAxis(['interaction'], INTERACTION_CONFIG_KEY_RESPONSE),
} as const satisfies Record<string, ConfigKeyAxis>;
