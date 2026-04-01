import { IsString, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
