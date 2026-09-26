import { ApiProperty } from '@nestjs/swagger';

// `POST /api/triggers/:id/chat-channel/rotate-bot-token` 요청 본문 — **OpenAPI 스키마 전용**.
//
// `rotateBotToken` 의 `@Body()` 파라미터는 인라인 객체 타입을 유지하고 이 클래스는 `@ApiBody({ type })` 로만 쓴다 — 선례
// `workflows/dto/execute-workflow.dto.ts`. 파라미터 타입을 이 클래스로 바꾸면 전역 `CustomValidationPipe` 가 진입해 계약이
// 바뀐다: 데코레이터가 없으면 **모든 요청**이 `VALIDATION_ERROR`, 달면 비-string `newBotToken` 이 `INVALID_BOT_TOKEN`
// (`spec/5-system/15-chat-channel.md` §5.4) 대신 `VALIDATION_ERROR` 가 되고 여분 키가 400 이 된다. 그래서 class-validator
// 데코레이터를 **일부러 달지 않았다** — 검사는 핸들러가 한다. 캐너리: `triggers-rotate-bot-token-body.spec.ts`.
//
// 내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다(`spec/conventions/swagger.md` §3).

/** Chat Channel bot token 회전 요청. */
export class ChatChannelRotateBotTokenRequestDto {
  /** 새 bot token 평문. 없거나 문자열이 아니면 400 `INVALID_BOT_TOKEN`. */
  // secret store 에 들어가는 plaintext 라 `writeOnly` 가 의무다(`spec/conventions/swagger.md` §1-5).
  @ApiProperty({ writeOnly: true })
  newBotToken: string;
}
