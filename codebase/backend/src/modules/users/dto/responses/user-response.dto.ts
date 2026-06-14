import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_THEMES } from '../update-me.dto';

/** 사용자 프로필 응답 DTO */
export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ example: 'ko' })
  locale: string;

  @ApiProperty({ enum: USER_THEMES, example: 'light' })
  theme: string;
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
