import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// 근거: [외부 호출 인증 설정 「평문 보기 흐름」](CLE-TRIG-AUTHCFG#평문-보기-흐름)
/**
 * 인증 설정 평문 노출(reveal) 요청. 평문 자격증명을 보는 민감 동작이므로
 * 현재 로그인 사용자의 비밀번호 재확인을 요구한다.
 */
export class RevealAuthConfigDto {
  @ApiProperty({
    description: '현재 로그인 사용자의 비밀번호 (재확인용)',
    example: 'current-password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
