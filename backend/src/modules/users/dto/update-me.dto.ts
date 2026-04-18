import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const USER_LOCALES = ['ko', 'en'] as const;
export type UserLocale = (typeof USER_LOCALES)[number];

export const USER_THEMES = ['light', 'dark'] as const;
export type UserTheme = (typeof USER_THEMES)[number];

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: '사용자 표시 이름 (2~50자)',
    minLength: 2,
    maxLength: 50,
    example: '홍길동',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: 'UI 언어',
    enum: USER_LOCALES,
    example: 'ko',
  })
  @IsOptional()
  @IsIn(USER_LOCALES as unknown as string[])
  locale?: UserLocale;

  @ApiPropertyOptional({
    description: 'UI 테마',
    enum: USER_THEMES,
    example: 'light',
  })
  @IsOptional()
  @IsIn(USER_THEMES as unknown as string[])
  theme?: UserTheme;

  @ApiPropertyOptional({
    description: '아바타 이미지 URL',
    format: 'uri',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  avatarUrl?: string;
}
