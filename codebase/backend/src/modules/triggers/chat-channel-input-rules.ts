import { BadRequestException } from '@nestjs/common';

import { ErrorCode } from '../../nodes/core/error-codes';
import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
} from '@workflow/chat-channel-validation';
import { CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES } from './chat-channel-rejection-messages.const';
import type {
  ChatChannelConfigDto,
  ChatChannelUpdateConfigDto,
} from './dto/chat-channel-config.dto';
import type { Trigger } from './entities/trigger.entity';

// chat-channel **입력 규칙** — `TriggersService` 에서 떼어낸 도메인 검증·정화 계층.
//
// **왜 클래스가 아니라 함수인가**: 이 규칙들은 외부 협력자를 **하나도** 쓰지 않는다 — 추출 전
// `this.*` 참조를 전수로 재니 **0개**였다(repo·registry·secret store 를 안 보고 입력만 본다).
// Nest provider 로 감싸면 DI 그래프와 테스트 모듈 등록만 늘고 얻는 것이 없다. 그래서 이 이동은
// **테스트 파일을 한 줄도 고치지 않는다** — 그것이 순수 이동의 증거다.
//
// **`@workflow/chat-channel-validation` 과 혼동하지 말 것**: 그 공유 패키지는 **정규식 SoT**
// (hex32 / hex64 같은 형식 문자열)를 갖고 backend·frontend 가 함께 쓴다. 이 파일은 그 형식을
// **언제 요구하고 언제 금지하는가** 라는 **도메인 규칙**이며, 위반 시 던지는 **에러 봉투 형태**
// (`details.field` · `details.code`)까지 정한다.
//
// **SoT**: `spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 · §5.4.1.2 · R-CC-21 ·
// `spec/4-nodes/7-trigger/providers/{slack,discord}.md` §6.

/**
 * 두 진입점이 보내는 `chatChannel` 을 함께 받는 자리의 타입.
 *
 * `ChatChannelUpdateConfigDto` 는 `botToken` 이 **필수가 아니므로**
 * `ChatChannelConfigDto` 에 대입되지 않는다 — 그게 D-1 의 요점이다. 두 형태를 다 지나가는
 * 헬퍼(`assertChatChannelInputSafe` · `stripChatChannelPlaintext` · `mergeExternalConfig` ·
 * `setupChatChannel`)는 이 합집합을 받는다. **생성 전용 검증**
 * (`assertInboundSigningPlaintextByProvider`)은 좁은 타입 그대로 둔다 — 그 좁음이
 * "PATCH 에서 부르면 안 된다" 를 타입으로 말한다.
 */
export type ChatChannelInput =
  ChatChannelConfigDto | ChatChannelUpdateConfigDto;

/**
 * `chatChannel` 입력 검증이 **어느 진입점**에서 왔는가.
 *
 * 두 경로의 요구가 정반대라 하나의 검증 함수로 묶을 수 없다
 * ([R-CC-21 「구현 시」](../../../../../spec/5-system/15-chat-channel.md)):
 *   - `create` — slack/discord 는 `inboundSigningPlaintext` 가 **필수**
 *   - `update` — 그 필드도 `botToken` 도 **금지**
 *
 * 종전에는 한 함수를 둘이 공유했고, 그래서 *"PATCH 에서 값 필드를 막는다"* 를 그 공유
 * 함수에 넣으면 **slack/discord 생성이 깨졌다.**
 */
export type ChatChannelInputMode = 'create' | 'update';

/**
 * [Spec Chat Channel §5.4.1 single-path + 2-trigger-list §3] — 외부 입력 가드 + provider 분기.
 *
 * 내부 필드 (외부 입력 금지):
 * - `botTokenRef` — 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`
 *   (24h grace 적용).
 * - `inboundSigningRef` — service 가 secret store ref 를 set. 외부 입력 무시.
 * - `inboundSigning` — server-issued 자료 (Telegram). provider-issued 입력은 신규
 *   `inboundSigningPlaintext` 필드 사용.
 *
 * Provider-issued plaintext 분기 (`inboundSigningPlaintext`):
 * - telegram: 본 필드 입력 시 400 (server-issued randomBytes 만, 사용자 secret 보호).
 * - slack: 필수. hex 32 chars.
 * - discord: 필수. hex 64 chars (ed25519 public key 32 bytes).
 *
 * DTO 단에서도 @IsEmpty / @IsString / @MaxLength 로 1차 검증되지만, error envelope 형식을
 * spec 의 VALIDATION_ERROR 와 정합시키기 위해 service 단 추가 검증 + provider 분기.
 *
 * **`mode === 'update'` 에서는 위 provider 분기가 적용되지 않는다.** PATCH 에서는
 * `inboundSigningPlaintext` 가 *필수*가 아니라 **금지**로 뒤집히고(`botToken` 도 함께),
 * 그 축은 `assertPatchCarriesNoSecrets` 가 본다 — R-CC-21 / D-1. 즉 위 "slack: 필수 /
 * discord: 필수" 서술의 주어는 **생성(POST) 한정**이다.
 */
// 오버로드로 `mode` 와 DTO 타입을 **컴파일 타임에 묶는다.** 문자열 판별자만 두면
// `('update' 인데 생성용 DTO)` 같은 짝 깨짐을 컴파일러가 못 잡고, 아래 좁히기 캐스팅이
// 조용히 통과한다 — 이 함수가 지키는 것이 바로 이 PR 이 닫은 보안 결함 클래스라
// 그 재발은 검출 없이 되살아난다 (`/ai-review` `review/code/2026/09/10/23_55_23` W4).
export function assertChatChannelInputSafe(
  chatChannel: ChatChannelConfigDto | undefined,
  mode: 'create',
): void;
export function assertChatChannelInputSafe(
  chatChannel: ChatChannelUpdateConfigDto | undefined,
  mode: 'update',
): void;
export function assertChatChannelInputSafe(
  chatChannel: ChatChannelInput | undefined,
  mode: ChatChannelInputMode,
): void {
  if (!chatChannel) return;
  const blocked = chatChannel as unknown as Record<string, unknown>;
  if (typeof blocked.botTokenRef !== 'undefined') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botTokenRef,
      details: { field: 'botTokenRef', code: ErrorCode.INVALID_FIELD },
    });
  }
  if (typeof blocked.inboundSigningRef !== 'undefined') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigningRef,
      details: { field: 'inboundSigningRef', code: ErrorCode.INVALID_FIELD },
    });
  }
  if (typeof blocked.inboundSigning !== 'undefined') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigning,
      details: { field: 'inboundSigning', code: ErrorCode.INVALID_FIELD },
    });
  }
  if (mode === 'update') {
    // [R-CC-21 / D-1] PATCH 는 **값 필드**도 받지 않는다. 전역 `CustomValidationPipe` +
    // `ChatChannelUpdateConfigDto` 의 `@IsEmpty()` 가 1차로 막지만, 여기서 한 번 더 막는
    // 것은 위 세 내부 필드와 같은 이유다 — 서비스는 컨트롤러 밖에서도 호출될 수 있고,
    // spec 의 `VALIDATION_ERROR` 봉투 형식을 서비스 층에서도 보장한다.
    assertPatchCarriesNoSecrets(chatChannel);
    return;
  }
  // 생성 경로 전용 — slack/discord 는 `inboundSigningPlaintext` 가 **필수**다.
  // 이 검사를 PATCH 에도 걸면 두 provider 의 카드 편집이 전부 400 이 된다(그것이 원 결함).
  // `mode === 'create'` 인 자리에서만 도달하므로 좁은 타입으로 좁혀 부른다.
  assertInboundSigningPlaintextByProvider(chatChannel as ChatChannelConfigDto);
}

/**
 * [Spec Chat Channel R-CC-21 / D-1] `chatChannel` 이 실린 PATCH 에 **사용자 비밀이 실렸는지**.
 *
 * 두 축만 본다 — `botToken`(rotate 대상) · `inboundSigningPlaintext`(slack/discord 사용자 입력).
 * telegram 의 server-issued 서명은 body 로 오지 않으므로 여기 없다.
 */
export function assertPatchCarriesNoSecrets(
  chatChannel: ChatChannelInput,
): void {
  const carried = chatChannel as unknown as Record<string, unknown>;
  if (typeof carried.botToken !== 'undefined') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botToken,
      details: { field: 'botToken', code: ErrorCode.INVALID_FIELD },
    });
  }
  if (typeof carried.inboundSigningPlaintext !== 'undefined') {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.inboundSigningPlaintext,
      details: {
        field: 'inboundSigningPlaintext',
        code: ErrorCode.INVALID_FIELD,
      },
    });
  }
}

/**
 * [Spec Chat Channel §5.4.1 표 1행] 최초 setup 은 **생성 POST 한정**이다.
 *
 * PATCH 로 `chatChannel` 을 처음 붙이려는 요청은 비밀을 실을 방법이 없어 반드시 실패하는데,
 * 그 실패가 `setupChatChannel` 의 best-effort catch 에 삼켜지면 `degraded` 로 조용히 앉는다.
 * 사용자에게는 "저장됐다" 로 보이고 봇은 죽어 있다 — 그래서 여기서 먼저 거부한다.
 */
export function assertChatChannelAlreadySetUp(
  trigger: Trigger,
  incoming: ChatChannelInput,
): void {
  const current = (trigger.config as { chatChannel?: { provider?: string } })
    ?.chatChannel;
  if (!current?.provider) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        'chatChannel 최초 설정은 트리거 생성(POST /api/triggers)에서만 할 수 있어요. PATCH 는 bot token 을 받지 않으므로 채널을 새로 붙일 수 없어요.',
      details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD },
    });
  }
  // provider 전환도 막는다. 허용하면 **다른 provider 의 토큰을 넘기게 된다** —
  // `botTokenRef` 는 trigger id 로만 재유도되므로 그 ref 뒤의 평문은 여전히 옛 provider 의
  // 토큰이고, 새 adapter 가 그것으로 외부 API 를 때린다. `2-trigger-list.md` `R-12` 도
  // *"변경하려면 트리거 삭제·재생성"* 이라 적는다.
  if (incoming.provider && incoming.provider !== current.provider) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `provider 는 PATCH 로 바꿀 수 없어요 (현재 ${current.provider}). 다른 provider 로 옮기려면 트리거를 삭제 후 다시 만들어 주세요.`,
      details: { field: 'provider', code: ErrorCode.INVALID_FIELD },
    });
  }
}

/**
 * [SS-SE-01 — spec/conventions/secret-store.md §5.5] plaintext (botToken /
 * inboundSigningPlaintext) 를 chatChannel 객체에서 제거. setupChatChannel 호출 전 config 에
 * 흘러가는 것을 차단해 첫 triggerRepository.save 시 DB JSONB 에 일시 기록되는 시간 창을
 * 제거한다. adapter 미등록 early-return 경로에서도 plaintext 가 영구 잔류하지 않음을 보장.
 *
 * 원본 plaintext 는 호출자가 별도 변수로 보관해 setupChatChannel 에 전달 — SecretResolver.rotate
 * (UPSERT) 로 옮긴 뒤 ref 만 config 에 반영.
 */
export function stripChatChannelPlaintext(
  chatChannel: ChatChannelInput,
): ChatChannelInput {
  // 캐스팅이 필요 없다 — `ChatChannelInput` 의 두 갈래가 이미 두 필드를 갖는다
  // (생성용은 `botToken: string` 필수 · PATCH 용은 둘 다 optional). 종전 `as` 는 좁은
  // 타입 하나만 받던 시절의 잔재라 지금은 lint 가 불필요 단언으로 잡는다.
  const { botToken: _bt, inboundSigningPlaintext: _isp, ...rest } = chatChannel;
  return rest;
}

/**
 * Provider 별 `inboundSigningPlaintext` 요구/금지 + 형식 분기.
 * SoT: spec/4-nodes/7-trigger/providers/{slack,discord}.md §6 + spec/conventions/secret-store.md §5.5.
 *
 * 분기:
 *   - telegram → server-issued (randomBytes 자동 발급). 외부 입력 시 400.
 *   - slack / discord → provider-issued (사용자 manual 입력). 필수 + hex 형식 검증.
 *
 * **신규 provider 추가 시**: 본 함수에 명시적 분기 추가 의무. CHAT_CHANNEL_PROVIDERS 가
 * 4번째 값을 가지면 아래 "provider-issued 필수" 가정이 무음 적용되어 잘못된 검증을 통과시킬
 * 위험. 신규 provider 의 inbound-signing 발급 모델 (server-issued vs provider-issued) 을
 * 결정 후 본 함수에 case 추가 필요.
 */
export function assertInboundSigningPlaintextByProvider(
  chatChannel: ChatChannelConfigDto,
): void {
  const plaintext = chatChannel.inboundSigningPlaintext;
  const provider = chatChannel.provider;

  if (provider === 'telegram') {
    if (typeof plaintext === 'string' && plaintext.length > 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Telegram inboundSigning 은 server-issued 입니다. inboundSigningPlaintext 를 입력하지 마세요 (setupChannel 의 randomBytes 가 자동 발급).',
        details: {
          field: 'inboundSigningPlaintext',
          code: ErrorCode.INVALID_FIELD,
        },
      });
    }
    return;
  }

  // slack / discord — provider-issued, 사용자 입력 필수 (위 doc 의 신규 provider 의무 참조).
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    const label =
      provider === 'slack'
        ? 'Slack signing secret'
        : 'Discord application public key';
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${label} 가 필요합니다. inboundSigningPlaintext 를 입력하세요.`,
      details: {
        field: 'inboundSigningPlaintext',
        code: ErrorCode.INVALID_FIELD,
      },
    });
  }

  // [provider 발급 표준] Slack signing secret / Discord public key 는 모두 lowercase hex 로
  // 발급된다. uppercase 입력은 외부 provider HMAC / ed25519 검증 실패를 유발하므로 사전 차단.
  // SoT: `@workflow/chat-channel-validation` 패키지 — backend / frontend 가 동일 정규식 사용.
  if (provider === 'slack' && !SLACK_SIGNING_SECRET_REGEX.test(plaintext)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        'Slack signing secret 형식이 올바르지 않습니다 (lowercase hex 32 chars 필요).',
      details: {
        field: 'inboundSigningPlaintext',
        code: ErrorCode.INVALID_FIELD,
      },
    });
  }

  if (provider === 'discord' && !DISCORD_PUBLIC_KEY_REGEX.test(plaintext)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message:
        'Discord application public key 형식이 올바르지 않습니다 (ed25519 public key lowercase hex 64 chars 필요).',
      details: {
        field: 'inboundSigningPlaintext',
        code: ErrorCode.INVALID_FIELD,
      },
    });
  }
}

/**
 * [Spec Chat Channel §5.4 에러 표] adapter.setupChannel 의 외부 API 에러를 spec 에 정의된
 * BadRequestException 으로 변환.
 *
 * - 401 / 403 (외부 provider 인증 실패) → `BOT_TOKEN_INVALID` 400
 * - 기타 (5xx / 네트워크 등) → `CHAT_CHANNEL_SETUP_FAILED` 502
 *
 * adapter 가 throw 하는 Error 의 message 에 status code 가 포함됨을 가정 (provider client 들의
 * 표준 error message 패턴: "Slack auth.test failed: 401", "Discord getApplicationMe failed:
 * 403", "Telegram setWebhook failed: ..." 등). 정확도가 낮을 경우 default 가 SETUP_FAILED 라
 * fail-safe.
 */
export function translateSetupChannelError(err: unknown): BadRequestException {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b(401|403)\b/.test(message)) {
    return new BadRequestException({
      code: 'BOT_TOKEN_INVALID',
      message: 'Bot token is invalid (401/403 from provider).',
      details: { reason: message.slice(0, 256) },
    });
  }
  return new BadRequestException({
    code: 'CHAT_CHANNEL_SETUP_FAILED',
    message: 'Chat channel setup failed after rotation.',
    details: { reason: message.slice(0, 256) },
  });
}
