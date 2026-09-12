import { BadGatewayException, BadRequestException } from '@nestjs/common';

import { ErrorCode } from '../../nodes/core/error-codes';
import {
  SLACK_SIGNING_SECRET_REGEX,
  DISCORD_PUBLIC_KEY_REGEX,
} from '@workflow/chat-channel-validation';
import {
  CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES,
  type ChatChannelBlockedField,
} from './chat-channel-rejection-messages.const';
import type {
  ChatChannelConfigDto,
  ChatChannelUpdateConfigDto,
} from './dto/chat-channel-config.dto';
import {
  CREDENTIAL_REJECTED_CODE,
  isCredentialRejectedError,
} from '../chat-channel/types';
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
// **입력만 있는 파일이 아니다** — `translateSetupChannelError` 는 adapter 실패를 §5.4 의
// **응답 계약**으로 옮기는 출력측 함수다. 여기 같이 사는 이유는 셋이 한 몸이기 때문이다:
// 같은 기능(chat-channel 트리거)의 도메인 규칙이고, 둘 다 **에러 봉투 형태를 정하며**,
// 둘 다 외부 협력자가 0이라 `TriggersService` 밖에서 순수하게 검증된다. 파일을 쪼개는 선택지는
// 살아 있지만 그 결정은 `15-chat-channel.md §7` 파일 트리(planner 축)와 **함께** 내려야 한다 —
// 트래커 「§7 파일 트리가 … 입력으로만 적는다」 항목이 그 쌍을 추적한다.
//
// **SoT**: `spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 · §5.4.1.2 · §5.4 · R-CC-21 ·
// `spec/4-nodes/7-trigger/providers/{slack,discord}.md` §6.

/**
 * `VALIDATION_ERROR` 봉투를 한 곳에서 만든다 — 이 파일 안에서 **11곳**이 글자 하나까지 같은
 * 형태였다(2026-09-12 실측).
 *
 * **왜 세 번째 인자(`code`)를 두지 않나**: 11곳이 전부 `ErrorCode.INVALID_FIELD` 다. 선택
 * 인자를 두면 한 번도 안 쓰이는 채로 계약이 되고, 다음 사람은 *"여기 다른 코드도 오나"* 를
 * 묻게 된다. 필요해지는 날 넓히는 쪽이 싸다.
 *
 * **왜 `never` 인가**: 호출부가 `throw` 없이 한 줄로 끝나야 실제로 짧아진다. 봉투를 손으로
 * 복붙하다 `details.code` 를 빠뜨리면 **컴파일 타임에 안 잡히고** 계약이 조용히 깨지는데,
 * 그 자리를 하나로 모으는 것이 이 헬퍼의 목적이다.
 */
function throwInvalidField(field: string, message: string): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message,
    details: { field, code: ErrorCode.INVALID_FIELD },
  });
}

/**
 * `chatChannel` 에 **선언에 없는 필드**가 실려 왔는지.
 *
 * 두 갈래 DTO 어디에도 없는 필드를 보려면 인덱스 시그니처가 필요한데, 그 캐스팅을 호출부마다
 * 쓰면 `as unknown as Record<string, unknown>` 이 복제된다(종전 2곳). 한 곳에 가둔다.
 */
function hasField(chatChannel: ChatChannelInput, field: string): boolean {
  return (
    typeof (chatChannel as unknown as Record<string, unknown>)[field] !==
    'undefined'
  );
}

/**
 * 차단 5필드 중 하나가 실려 있으면 거부한다.
 *
 * 필드 이름을 **한 번만** 쓰게 하는 것이 요점이다 — 종전에는 존재 검사(`blocked.botTokenRef`)와
 * 봉투(`field: 'botTokenRef'`)가 따로 적혀 있었고, `Record<string, unknown>` 위의 오타는
 * `undefined` 로 조용히 통과한다(가드가 사라져도 아무도 모른다). 인자를
 * `ChatChannelBlockedField` 로 받으면 오타가 **컴파일 에러**이고 메시지도 같은 키로 따라온다.
 */
function rejectBlockedField(
  chatChannel: ChatChannelInput,
  field: ChatChannelBlockedField,
): void {
  if (hasField(chatChannel, field)) {
    throwInvalidField(field, CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES[field]);
  }
}

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
  // 내부 필드 3종 — 생성·PATCH 양쪽에서 금지.
  rejectBlockedField(chatChannel, 'botTokenRef');
  rejectBlockedField(chatChannel, 'inboundSigningRef');
  rejectBlockedField(chatChannel, 'inboundSigning');
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
  rejectBlockedField(chatChannel, 'botToken');
  rejectBlockedField(chatChannel, 'inboundSigningPlaintext');
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
    throwInvalidField(
      'chatChannel',
      'chatChannel 최초 설정은 트리거 생성(POST /api/triggers)에서만 할 수 있어요. PATCH 는 bot token 을 받지 않으므로 채널을 새로 붙일 수 없어요.',
    );
  }
  // provider 전환도 막는다. 허용하면 **다른 provider 의 토큰을 넘기게 된다** —
  // `botTokenRef` 는 trigger id 로만 재유도되므로 그 ref 뒤의 평문은 여전히 옛 provider 의
  // 토큰이고, 새 adapter 가 그것으로 외부 API 를 때린다. `2-trigger-list.md` `R-12` 도
  // *"변경하려면 트리거 삭제·재생성"* 이라 적는다.
  //
  // **`incoming.provider &&` 는 HTTP 경로에서 도달할 수 없다** — `ChatChannelUpdateConfigDto`
  // 가 `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` 이라
  // `provider` 의 `@IsString() @IsIn(...)` 을 **상속**해 PATCH 에서도 필수다(2026-09-12 실측).
  // 그래서 이 falsy 분기를 지우는 뮤턴트는 **살아남는 것이 정상**이다. 그럼에도 남기는 이유:
  // 지우면 DTO 를 우회한 호출자(`provider` 미지정)가 *"provider 는 PATCH 로 바꿀 수 없어요"*
  // 라는 **틀린 메시지**를 받는다. DTO 층이 실제로 막는다는 사실은
  // `dto/trigger-dto-validation.spec.ts` 가 고정한다.
  if (incoming.provider && incoming.provider !== current.provider) {
    throwInvalidField(
      'provider',
      `provider 는 PATCH 로 바꿀 수 없어요 (현재 ${current.provider}). 다른 provider 로 옮기려면 트리거를 삭제 후 다시 만들어 주세요.`,
    );
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
      throwInvalidField(
        'inboundSigningPlaintext',
        'Telegram inboundSigning 은 server-issued 입니다. inboundSigningPlaintext 를 입력하지 마세요 (setupChannel 의 randomBytes 가 자동 발급).',
      );
    }
    return;
  }

  // slack / discord — provider-issued, 사용자 입력 필수 (위 doc 의 신규 provider 의무 참조).
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    const label =
      provider === 'slack'
        ? 'Slack signing secret'
        : 'Discord application public key';
    throwInvalidField(
      'inboundSigningPlaintext',
      `${label} 가 필요합니다. inboundSigningPlaintext 를 입력하세요.`,
    );
  }

  // [provider 발급 표준] Slack signing secret / Discord public key 는 모두 lowercase hex 로
  // 발급된다. uppercase 입력은 외부 provider HMAC / ed25519 검증 실패를 유발하므로 사전 차단.
  // SoT: `@workflow/chat-channel-validation` 패키지 — backend / frontend 가 동일 정규식 사용.
  if (provider === 'slack' && !SLACK_SIGNING_SECRET_REGEX.test(plaintext)) {
    throwInvalidField(
      'inboundSigningPlaintext',
      'Slack signing secret 형식이 올바르지 않습니다 (lowercase hex 32 chars 필요).',
    );
  }

  if (provider === 'discord' && !DISCORD_PUBLIC_KEY_REGEX.test(plaintext)) {
    throwInvalidField(
      'inboundSigningPlaintext',
      'Discord application public key 형식이 올바르지 않습니다 (ed25519 public key lowercase hex 64 chars 필요).',
    );
  }
}

/**
 * setupChannel 실패를 `§5.4` 의 응답 계약으로 옮긴다.
 *
 * - **자격 증명 거부** → `400 BOT_TOKEN_INVALID`
 * - 그 밖 (provider 5xx · 네트워크 · 타임아웃) → `502 CHAT_CHANNEL_SETUP_FAILED`
 *
 * 판별 기준은 transport 가 아니라 **누가 고칠 수 있는가**다. provider 들이 자격 증명 거부를
 * 알리는 방식은 서로 다르므로(Slack 은 `HTTP 200` + `{ok:false,error:'invalid_auth'}`, Discord 는
 * `verify_key` 불일치로 **status 자체가 없다**) 어댑터가 `code` 로 **선언**하고 이 함수는 그
 * `code` 만 본다 — [spec/conventions/chat-channel-adapter.md §1.1.2].
 *
 * **한시적 예외 — message 의 401/403 fallback.** `code` 를 아직 안 붙인 경로(예: discord 의
 * `getApplicationMe` 이외 실패, telegram 의 body 파싱 실패)가 **조용히 502 로 빠지는 것보다**
 * 400 을 주는 편이 낫다는 §1.1.2 의 의도적 예외다. 제거 조건도 그 절에 있다.
 *
 * **응답 본문에 provider 원문을 싣지 않는다** (~~`details.reason`~~ 제거). `message` 는 고정
 * client-safe 문자열이고 원문은 **호출자가 서버 로그에** 남긴다 — 이 함수가 순수하게 남아야
 * 하는 이유(모듈 전체가 의존 0)와 `§7.5.2` 보안 게이트가 같은 방향이다.
 *
 * SoT: [spec/5-system/15-chat-channel.md §5.4] 실패 응답 표 · 근거 `R-CC-23`.
 */
export function translateSetupChannelError(
  err: unknown,
): BadRequestException | BadGatewayException {
  const message = err instanceof Error ? err.message : String(err);
  const credentialRejected =
    // 어댑터의 선언 — 정확 일치. `code` 는 Node 시스템 에러도 갖는 이름이다 (헬퍼 주석).
    isCredentialRejectedError(err) ||
    // 한시적 fallback — 아직 `code` 를 안 붙인 경로.
    /\b(401|403)\b/.test(message);
  if (credentialRejected) {
    return new BadRequestException({
      code: CREDENTIAL_REJECTED_CODE,
      message: 'Bot token was rejected by the provider.',
    });
  }
  return new BadGatewayException({
    code: 'CHAT_CHANNEL_SETUP_FAILED',
    message: 'Chat channel setup failed after rotation.',
  });
}
