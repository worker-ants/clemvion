import { ApiProperty } from '@nestjs/swagger';

// `POST /api/triggers/:id/notification/rotate-secret` · `:id/interaction/revoke-token` 의 응답과 생성 · 수정 응답의 `secrets`
// 블록. 모두 서버가 그 응답에서 만든 비밀을 **평문으로 한 번만** 돌려준다 — 서버는 다시 보여 주지 않는다
// (`triggers.controller.ts` 의 네 엔드포인트 `@ApiOperation` 설명이 각각 같은 말을 한다).
// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙) 규칙 4 · 5,
// [트리거 관리 「API」](CLE-TRIG-MANAGE#api).
//
// 키가 갈린다 — 생성 · 수정 응답의 `data` 는 트리거 리소스라 일회성 값을 `data.secrets` 아래에 두고, 교체 ·
// 재발급 응답은 그 동작만의 응답이라 `data.secret` · `data.token` 에 바로 둔다. 교체 응답 DTO
// (`NotificationRotateSecretDto`)와 이름이 겹치지 않게 `TriggerIssuedSecretsDto` 로 갈랐다.
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

/** 생성 · 수정 응답의 일회성 평문 묶음. 서버가 새 비밀을 만든 응답에만 있다. */
export class TriggerIssuedSecretsDto {
  /** 서버가 처음 발급한 알림 서명 시크릿(`wsk_*`) 평문 — 이 응답에서만 보인다. 외부 검증자에 즉시 배포한다. */
  @ApiProperty({ example: 'wsk_...', readOnly: true })
  notificationSigningSecret: string;
}
