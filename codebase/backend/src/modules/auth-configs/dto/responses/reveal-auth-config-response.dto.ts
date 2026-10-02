import { ApiProperty } from '@nestjs/swagger';

// 근거: [외부 호출 인증 설정 「마스킹 규칙」](CLE-TRIG-AUTHCFG#마스킹-규칙) 평문 노출 3 경로 중 하나
/**
 * 인증 설정 평문 노출(reveal) 응답. config 의 모든 secret 류 필드가 평문으로
 * 1회 반환된다 (마스킹 없음). 호출자는 즉시 사용/복사 후 폐기해야 한다.
 */
export class RevealAuthConfigResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      '평문 config (key/token/secret/password 마스킹 없음, 1회 노출)',
  })
  config: Record<string, unknown>;
}
