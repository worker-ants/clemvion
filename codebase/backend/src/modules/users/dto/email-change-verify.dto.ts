import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 근거:
//   - [가입과 로그인 「이메일 변경」](CLE-ACCT-SIGNIN#이메일-변경)
//   - [가입과 로그인 「이메일 변경 확인은 인증이 필요하다」](CLE-ACCT-SIGNIN#이메일-변경-확인은-인증이-필요하다)
/**
 * 이메일 변경 확인 요청.
 * 신규 이메일로 발송된 링크의 raw 토큰. 인증된 본인 세션에서만 소비된다(토큰이 사용자에 바인딩).
 */
export class EmailChangeVerifyDto {
  @ApiProperty({ description: '신규 이메일로 발송된 변경 확인 토큰' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  token: string;
}
