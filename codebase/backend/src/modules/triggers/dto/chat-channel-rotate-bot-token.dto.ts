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

/** Bot identity 캐시 — `setupChannel` 의 `configUpdates.botIdentity`. */
export class ChatChannelBotIdentityDto {
  /** provider 가 부여한 봇 식별자. Slack 은 문자열 id 를 해시한 정수다. */
  @ApiProperty({ example: 123456789 })
  botId: number;

  /** 봇 표시 이름 */
  @ApiProperty({ example: 'mybot' })
  username: string;

  /** Slack 전용 — workspace(team) 식별자. 다른 provider 는 미반환. */
  @ApiPropertyOptional({ example: 'T0123ABC' })
  teamId?: string;
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
  @ApiProperty({ type: ChatChannelBotIdentityDto, nullable: true })
  botIdentity: ChatChannelBotIdentityDto | null;
}
