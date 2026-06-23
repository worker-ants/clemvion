import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 웹채팅 운영 콘솔이 서버에 저장하는 위젯 외형/콘텐츠 설정.
 * Trigger `config.interaction.appearance` 서브 필드에 보관된다(신규 엔티티 없음).
 *
 * 운영자가 콘솔에서 편집한 값을 워크스페이스 차원에서 보존해, 브라우저/운영자가 바뀌어도
 * 동일한 미리보기·설치 스니펫이 재현되도록 한다(localStorage draft 의 서버 영속화).
 * SoT: spec/7-channel-web-chat/5-admin-console.md §4. 부트 시 위젯에 전달되는 BootConfig 형태는
 * spec/7-channel-web-chat/2-sdk.md §4.
 *
 * 모든 필드는 운영자 표시용이며 결국 공개 설치 스니펫 JSON 으로 흘러간다 — 프런트(use-appearance-draft
 * `sanitizeDraft`)가 1차 화이트리스트하지만, 서버단에서도 enum/패턴/길이를 강제해 다층 방어한다.
 */
export class WebChatAppearanceDto {
  /** 위젯 기본 로케일. */
  @ApiPropertyOptional({ enum: ['ko', 'en'], example: 'ko' })
  @IsOptional()
  @IsIn(['ko', 'en'])
  locale?: 'ko' | 'en';

  /** 위젯 primary 색상(#RRGGBB). */
  @ApiPropertyOptional({ example: '#5B4FE9', pattern: '^#[0-9a-fA-F]{6}$' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'primaryColor must be a #RRGGBB hex color',
  })
  primaryColor?: string;

  /** 런처 위치. */
  @ApiPropertyOptional({ enum: ['bottom-right', 'bottom-left'] })
  @IsOptional()
  @IsIn(['bottom-right', 'bottom-left'])
  position?: 'bottom-right' | 'bottom-left';

  /** 헤더(봇 표시명). */
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  headerTitle?: string;

  /** 첫 환영 메시지. */
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeText?: string;

  /** 추천 질문(줄바꿈 구분, 콘솔 textarea 원문 그대로 보존). */
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  suggestions?: string;

  /** 면책 고지. */
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  disclaimer?: string;
}
