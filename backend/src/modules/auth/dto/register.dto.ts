import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  /** 사용자 표시 이름 (2~50자) */
  @ApiProperty({
    description: '사용자 표시 이름',
    minLength: 2,
    maxLength: 50,
    example: '홍길동',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  /** 가입 이메일 (로그인 아이디로 사용) */
  @ApiProperty({
    description: '가입 이메일 (로그인 ID 역할). 중복 가입 불가',
    format: 'email',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  /** 비밀번호 (8~100자, 영문 대/소문자·숫자·특수문자 중 3종 이상) */
  @ApiProperty({
    description:
      '비밀번호. 최소 8자, 영문 대/소문자·숫자·특수문자 중 3종 이상을 포함해야 합니다.',
    format: 'password',
    minLength: 8,
    maxLength: 100,
    example: 'P@ssw0rd!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  /** 서비스 이용약관 동의 여부 (true 필수) */
  @ApiProperty({
    description: '서비스 이용약관 동의 여부 (필수: true)',
    example: true,
  })
  @IsBoolean()
  termsAccepted: boolean;

  /**
   * 미가입자 초대 토큰. 동봉 시 가입 흐름이 분기됩니다 — 토큰의 이메일과
   * `email` 이 일치해야 하고, 이메일 인증 단계를 생략하며 (토큰이 소유 증명),
   * 가입 트랜잭션 내에서 초대된 워크스페이스의 멤버로 자동 등록됩니다.
   * 개인 워크스페이스는 자동 생성되지 않습니다.
   */
  @ApiPropertyOptional({
    description:
      '미가입자 초대 토큰. 동봉 시 토큰 이메일과 가입 이메일이 일치해야 하며, 이메일 인증 없이 즉시 가입·자동 로그인됩니다.',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  invitationToken?: string;
}
