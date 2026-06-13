import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateWorkspaceSettingsDto {
  @ApiProperty({
    type: [String],
    example: ['https://example.com', 'https://shop.example.com'],
    description:
      '외부 상호작용을 허용할 origin 목록 (scheme://host[:port] 형식, path/query/fragment 불가, 후행 슬래시는 정규화). 빈 배열 = 추가 origin 없음(공식 위젯 CDN origin 은 항상 허용되므로 "전체 차단"이 아님).',
  })
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  @Matches(/^https?:\/\/[^/\s?#]+\/?$/i, {
    each: true,
    message: 'origin must be scheme://host[:port] with no path/query',
  })
  interactionAllowedOrigins: string[];

  /**
   * 워크스페이스 기본 타임존 (IANA 식별자, 예: `Asia/Seoul`). 스케줄 생성 시 타임존 미지정이면
   * 이 값을 fallback 으로 사용한다. IANA 유효성은 서비스 계층이 `Intl.DateTimeFormat` 으로 검증.
   */
  @ApiPropertyOptional({
    type: String,
    example: 'Asia/Seoul',
    description:
      'IANA 타임존 식별자. 스케줄 타임존 미지정 시 기본값으로 사용 (미설정 시 Asia/Seoul). 빈 문자열("")을 전송하면 타임존 설정이 해제된다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
