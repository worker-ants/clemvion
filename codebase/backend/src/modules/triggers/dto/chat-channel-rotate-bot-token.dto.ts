import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { TriggerChatChannelHealth } from '../entities/trigger.entity';

// **왜 `dto/responses/` 가 아니라 여기인가** — `15-chat-channel.md` 의 `code:` glob 이
// `.../triggers/dto/chat-channel-*.dto.ts` 이고 glob 의 `*` 는 `/` 를 넘지 않는다. 실측:
// `dto/responses/chat-channel-rotate-bot-token.dto.ts` 는 `2-trigger-list.md`(`dto/**`)에만
// 잡히고 **정작 이 파일을 소유한 `15-chat-channel.md` 에는 안 잡힌다**. 그 형태가 `R-CC-22`
// 가 세 번(#1317·#1319·#1320)의 누락 끝에 막으려던 바로 그 결함이라 평평한 자리를 택했다.
// (`responses/` 관례와의 충돌을 glob 확장으로 풀지는 planner 판단 — 트래커에 등재.)
//
// 내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다
// (`spec/conventions/swagger.md §3`).

// **`chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와 이름이 달라야 한다.**
// `@nestjs/swagger` 는 스키마를 **클래스 `.name` 으로** 등록하므로 동명 클래스 둘은
// `components.schemas` 에서 서로를 덮어쓴다 — 첫 판본이 그 이름을 그대로 썼고
// `/ai-review` `16_17_57` documentation CRITICAL 이 잡았다.
//
// **왜 합치지 않고 둘로 두나**: 두 자리는 같은 값을 다른 계약으로 본다.
//   - config 쪽 — **입력 검증** DTO(`@IsOptional`·`@IsInt`). 클라이언트가 보낼 수도 있고
//     어댑터가 덮어쓴다. 그래서 전 필드가 optional 이다.
//   - 이쪽 — **응답** DTO. `rotateBotToken` 이 실제로 돌려주는 형태라 `botId`·`username` 이
//     필수이고 Slack 의 `teamId` 가 더 있다.
// 합치면 한쪽이 반드시 거짓말을 한다. 같은 판단의 선례가 이 저장소에 있다 —
// `TriggerWorkflowRefDto` vs `ScheduleTriggerWorkflowRefDto` (*"의도적으로 다르다 …
// 한쪽을 다른 쪽으로 갈아 끼우지 말 것"*).

/** `rotateBotToken` 응답의 bot identity — `setupChannel` 의 `configUpdates.botIdentity`. */
export class ChatChannelRotateBotIdentityDto {
  /**
   * provider 가 부여한 봇 식별자.
   *
   * **Telegram 만 네이티브 정수**다 — Slack(`slack.adapter.ts`)과
   * Discord(`discord.adapter.ts`)는 문자열 id 를 `hashStringToInt` 로 정수 슬롯에 맞춘다.
   */
  @ApiProperty({ example: 123456789 })
  botId: number;

  /** 봇 표시 이름 */
  @ApiProperty({ example: 'mybot' })
  username: string;

  /** Slack 전용 — workspace(team) 식별자. 다른 provider 는 미반환. */
  @ApiPropertyOptional({ example: 'T0123ABC' })
  teamId?: string;

  /**
   * Discord 전용 — `GET /applications/@me` 의 `verify_key`(ed25519 public key, **비민감**).
   *
   * 첫 판본은 이 필드를 빠뜨려 **문서가 실제 응답보다 좁았다** — `TransformInterceptor` 는
   * 클래스 기반으로 필드를 지우지 않으므로 Discord 트리거의 wire 응답에는 실려 나간다
   * (`/ai-review` `16_17_57` api_contract WARNING).
   */
  @ApiPropertyOptional({ example: 'a1b2…' })
  publicKey?: string;
}

/**
 * `POST /api/triggers/:id/chat-channel/rotate-bot-token` 200 응답 본문.
 *
 * SoT: [spec/5-system/15-chat-channel.md §5.4] 성공 응답 — `TransformInterceptor` 가
 * `{ data }` 로 감싼다.
 */
export class ChatChannelRotateBotTokenDto {
  /** 회전 시각 (ISO8601) */
  @ApiProperty({ format: 'date-time', example: '2026-09-12T06:17:50.000Z' })
  rotatedAt: string;

  /** 회전한 트리거 UUID */
  @ApiProperty({ format: 'uuid' })
  triggerId: string;

  /** `setupChannel` 재호출 결과. 성공 시 `healthy`. */
  @ApiProperty({
    enum: ['unknown', 'healthy', 'degraded'],
    example: 'healthy',
  })
  chatChannelHealth: TriggerChatChannelHealth;

  /** `getMe` 캐시 갱신 결과. identity 를 반환하지 않는 provider 는 `null`. */
  @ApiProperty({ type: ChatChannelRotateBotIdentityDto, nullable: true })
  botIdentity: ChatChannelRotateBotIdentityDto | null;
}
