import { ApiProperty } from '@nestjs/swagger';

/**
 * 공개 위젯 임베드 soft 검증용 설정 — 위젯이 부팅 시 GET 으로 조회(캐시 가능).
 * spec [7-channel-web-chat/4-security.md §3-①].
 */
export class EmbedConfigDto {
  @ApiProperty({
    description:
      '워크스페이스 임베드 allowlist(호스트 origin 목록). 비어 있으면 제한 없음(allow-all).',
    type: 'array',
    items: { type: 'string' },
    example: ['https://shop.example.com', 'https://app.example.com'],
  })
  allowlist: string[];

  @ApiProperty({
    description:
      'soft 차단 활성 여부 — allowlist 가 1개 이상일 때 true. 위젯은 enforce=true 이고 호스트 origin 이 allowlist 에 없으면 렌더/시작을 거부한다.',
    example: true,
  })
  enforce: boolean;
}
