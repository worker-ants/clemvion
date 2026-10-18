import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
// `TriggerIssuedSecretsDto` 의 두 필드는 모두 키 생략형이다([HTTP API 규약 §5.5](CLE-API-CONV#55-부재-표현-null-과-키-생략)
// 기준 (b)). 그 응답이 실제로 발급한 비밀의 키만 있다. 서비스(`TriggersService`)도 이 클래스를 일회성 평문의 모양으로
// 쓴다. 모양을 두 곳에 적으면 필드를 더할 때 한쪽만 고친다(NERV Task `CLE-T-EQDYC1`).
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

/** 생성 · 수정 응답의 일회성 평문 묶음. 서버가 새 비밀을 만든 응답에만 있고, 그 응답이 발급한 비밀의 키만 있다. */
export class TriggerIssuedSecretsDto {
  /** 서버가 처음 발급한 알림 서명 시크릿(`wsk_*`) 평문 — 이 응답에서만 보인다. 외부 검증자에 즉시 배포한다. */
  @ApiPropertyOptional({ example: 'wsk_...', readOnly: true })
  notificationSigningSecret?: string;

  /**
   * 서버가 처음 발급한 트리거 단위 인터랙션 토큰(`itk_*`) 평문 — 이 응답에서만 보인다.
   * 인터랙션이 켜져 있고 토큰 전략이 `per_trigger` 인데 토큰이 없을 때 발급한다. 외부 시스템에 즉시 배포한다.
   */
  @ApiPropertyOptional({ example: 'itk_...', readOnly: true })
  interactionToken?: string;
}
