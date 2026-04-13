import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  /** Refresh Token (일반적으로 httpOnly 쿠키로 전달되며 본문 사용은 예외적) */
  @ApiPropertyOptional({
    description:
      'Refresh Token. 통상적으로는 httpOnly 쿠키로 전송되며, 쿠키를 사용할 수 없는 환경에서만 본 필드를 사용합니다.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
