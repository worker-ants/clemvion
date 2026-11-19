import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import {
  MAX_PASSWORD_RECHECK_INPUT_LENGTH,
  MIN_ACCOUNT_PASSWORD_LENGTH,
} from '../../../common/utils/password.util';

// 근거: NERV Task CLE-T-CJ7HB1. DTO 파일의 `/** */` 는 공개 설명과 같은 채널이라 내부 서사는 이 줄 주석에만 둔다.
// 재확인 라우트의 본문 DTO 는 모두 이 클래스를 상속한다. 비밀번호 검증 규칙을 한 곳에 두고 테스트가 이 상속으로 재확인 라우트를 찾는다.
/**
 * 계정 비밀번호 재확인 요청 본문의 공통 부분.
 */
export class PasswordRecheckDto {
  @ApiProperty({
    description: '계정 비밀번호 (재확인용)',
    format: 'password',
    minLength: MIN_ACCOUNT_PASSWORD_LENGTH,
    maxLength: MAX_PASSWORD_RECHECK_INPUT_LENGTH,
  })
  @IsString()
  @MinLength(MIN_ACCOUNT_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_RECHECK_INPUT_LENGTH)
  password: string;
}
