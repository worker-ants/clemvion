import { ApiProperty } from '@nestjs/swagger';

// `POST /api/triggers/:id/notification/rotate-secret` · `:id/interaction/revoke-token` 의 응답. 둘 다 새 비밀을 **평문으로 한 번만**
// 돌려준다 — 서버는 다시 보여 주지 않는다(`triggers.controller.ts` 의 `@ApiOperation` 설명).
//
// 내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다(`spec/conventions/swagger.md` §3).

/** Outbound notification secret 회전 결과. */
export class NotificationRotateSecretDto {
  /** 새 HMAC secret 평문 — 이 응답에서만 보인다. 외부 검증자에 즉시 배포한다. */
  @ApiProperty()
  secret: string;

  /** 회전 시각 — 이 시각부터 24시간 동안 이전 secret 과 새 secret 으로 함께 서명한다. */
  @ApiProperty({ format: 'date-time', example: '2026-09-26T03:14:00.000Z' })
  rotatedAt: string;
}

/** Per-trigger interaction token 재발급 결과. */
export class InteractionRevokeTokenDto {
  /** 새 interaction token(`itk_*`) 평문 — 이 응답에서만 보인다. 기존 token 은 즉시 무효다. */
  @ApiProperty({ example: 'itk_...' })
  token: string;
}
