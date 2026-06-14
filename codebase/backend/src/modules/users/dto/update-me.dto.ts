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

// §2.0/§2.1 — 'system' = OS 색상 모드 자동 추종(frontend 가 prefers-color-scheme 로 적용).
// backend 는 저장·반환만; light/dark/system 세 값을 수용한다.
export const USER_THEMES = ['light', 'dark', 'system'] as const;
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
  @IsIn(USER_LOCALES)
  locale?: UserLocale;

  @ApiPropertyOptional({
    description: 'UI 테마',
    enum: USER_THEMES,
    example: 'light',
  })
  @IsOptional()
  @IsIn(USER_THEMES)
  theme?: UserTheme;

  @ApiPropertyOptional({
    description: '아바타 이미지 URL',
    format: 'uri',
    maxLength: 500,
  })
  @IsOptional()
  // require_tld:false 는 내부 호스트 URL 도 허용하지만, 서버는 이 URL 을 fetch 하지 않고
  // 클라이언트가 직접 <img src> 로 로드하므로 SSRF 진입점이 아니다. 향후 서버측 fetch(예: 썸네일
  // 생성) 추가 시 require_tld:true + 내부 IP 차단 가드를 병행해야 한다.
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  avatarUrl?: string;
}
