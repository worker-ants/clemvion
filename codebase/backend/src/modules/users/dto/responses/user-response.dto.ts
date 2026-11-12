import { ApiProperty } from '@nestjs/swagger';
import { USER_THEMES } from '../update-me.dto';

/** 사용자 프로필 응답 DTO */
export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 'ko' })
  locale: string;

  @ApiProperty({ enum: USER_THEMES, example: 'light' })
  theme: string;

  // 근거: [내 프로필 REQ-PROFILE-027](CLE-ACCT-PROFILE)
  @ApiProperty({
    example: false,
    description:
      'TOTP 2단계 인증이 켜져 있는지. Passkey 등록 여부는 담지 않는다.',
  })
  twoFactorEnabled: boolean;
}

// 근거: [내 프로필 API 표 `GET /api/users/me`](CLE-ACCT-PROFILE#api)
/**
 * 내 프로필 조회(`GET /api/users/me`) 응답. 수정 · 아바타 업로드 응답(`UserProfileDto`)에 `pendingEmail` 을 더한다.
 *
 * `pendingEmail` 은 조회 응답에만 있고 늘 실린다(없으면 `null`). 수정 · 업로드 응답은 키를 뺀다. 한 DTO 로는 두 모양을
 * §5.5 선언 형태 하나로 표현할 수 없어 조회용을 나눴다.
 */
export class CurrentUserProfileDto extends UserProfileDto {
  // 근거: [가입과 로그인 「이메일 변경」](CLE-ACCT-SIGNIN#이메일-변경)
  @ApiProperty({
    type: String,
    nullable: true,
    description: '진행 중인 이메일 변경의 확인 대기 신규 이메일. 없으면 null.',
  })
  pendingEmail: string | null;
}

/** 단순 메시지 응답 (이메일 변경 request/resend/cancel). */
export class MessageResponseDto {
  @ApiProperty({ description: '결과 메시지' })
  message: string;
}

/**
 * 비밀번호 변경 결과 (refactor 04 A-1 / 인증 Rationale 2.3.C).
 *
 * 변경 성공 시 전 세션을 revoke 하고 현재 디바이스에 새 세션을 재발급한다 — 새 access token 을
 * 본문으로 반환하고 refresh 쿠키를 회전(`Set-Cookie`)한다. 클라이언트는 이 `accessToken` 으로
 * in-memory access token 을 교체한다.
 */
export class PasswordChangeResultDto {
  @ApiProperty({
    description:
      '재발급된 access token (15분). 클라이언트는 이 값으로 교체한다.',
  })
  accessToken: string;
}
