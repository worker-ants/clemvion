import { ApiProperty } from '@nestjs/swagger';

/**
 * WebAuthn register/options 응답.
 *
 * 서버 → 클라이언트 방향 payload. 클라이언트는 `publicKey` 를
 * `navigator.credentials.create()` 의 `options` 로 그대로 전달한다.
 */
export class WebAuthnRegisterOptionsDto {
  @ApiProperty({
    description:
      'PublicKeyCredentialCreationOptionsJSON. @simplewebauthn/server 가 생성',
    type: 'object',
    additionalProperties: true,
  })
  publicKey: Record<string, unknown>;

  @ApiProperty({
    description:
      '서버 단명 JWT (`kind=webauthn_register`, exp 5분). verify 단계에서 동봉 필요',
  })
  optionsToken: string;
}

/** 등록 verify 결과. 첫 credential 등록 시 복구 코드 10개 동봉. */
export class WebAuthnRegisterVerifyResultDto {
  @ApiProperty({ description: '등록 성공 여부' })
  verified: boolean;

  @ApiProperty({ description: '등록된 credential 의 UUID' })
  credentialUuid: string;

  @ApiProperty({
    type: [String],
    description:
      '첫 credential 등록인 경우에만 동봉되는 WebAuthn 전용 복구 코드 10개 (평문, 일회성 표시). 두 번째 이후 등록은 빈 배열',
  })
  webauthnRecoveryCodes: string[];
}

/**
 * WebAuthn authenticate/options 응답.
 *
 * 서버 → 클라이언트 방향 payload. 클라이언트는 `publicKey` 를
 * `navigator.credentials.get()` 의 `options` 로 그대로 전달한다.
 */
export class WebAuthnAuthOptionsResultDto {
  @ApiProperty({
    description: 'PublicKeyCredentialRequestOptionsJSON',
    type: 'object',
    additionalProperties: true,
  })
  publicKey: Record<string, unknown>;

  @ApiProperty({ description: '서버 단명 JWT (`kind=webauthn_auth`, exp 5분)' })
  optionsToken: string;
}

/** 단일 credential 표시 정보 (목록·이름 변경 응답에 공통). */
export class WebAuthnCredentialDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  deviceName: string | null;

  @ApiProperty({ type: [String] })
  transports: string[];

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastUsedAt: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

// 근거:
//   - [HTTP API 규약 「5.3 고정 목록 응답」](CLE-API-CONV#53-고정-목록-응답)
//   - [HTTP API 규약 「고정 목록 응답을 { data: { items } } 로 유지」](CLE-API-CONV#고정-목록-응답을--data--items---로-유지)
//   - [가입과 로그인 「2단계 인증」](CLE-ACCT-SIGNIN#2단계-인증-1) API 표의 credential 목록
/**
 * credential 목록 응답. `SessionListDto` 와 **동일한** `{ items: [] }` shape 이며,
 * 응답 인터셉터를 거쳐 `{ data: { items: [] } }` 로 나간다 — sessions·webauthn 양쪽의
 * 백엔드·프런트가 의존하는 load-bearing 계약이라 bare array 로 낮추지 않는다.
 */
export class WebAuthnCredentialListDto {
  @ApiProperty({ type: [WebAuthnCredentialDto] })
  items: WebAuthnCredentialDto[];
}

/** 복구 코드 재발급 결과. */
export class WebAuthnRecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: '새로 발급된 복구 코드 10개 (평문, 일회성 표시)',
  })
  webauthnRecoveryCodes: string[];
}

/** WebAuthn 기능 활성 여부 — 프런트가 Passkey UI 노출을 정할 때 쓴다. */
export class WebAuthnAvailabilityDto {
  @ApiProperty({
    description:
      '서버에 WEBAUTHN_RP_ID · WEBAUTHN_ORIGIN 이 설정돼 WebAuthn 을 쓸 수 있는가',
  })
  enabled: boolean;
}
