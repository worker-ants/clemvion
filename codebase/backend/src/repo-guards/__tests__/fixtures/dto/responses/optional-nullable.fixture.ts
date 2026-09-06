import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * §5.4 금지-조합 래칫의 **양성 대조군**.
 *
 * 이 파일은 일부러 규약을 어긴다 — 술어가 그 조합을 실제로 집는지 확인하는 것이 존재
 * 이유다. 경로에 `/dto/responses/` 가 들어 있어 `isResponseDtoFile` 을 통과하지만,
 * 래칫의 실제 스캔 범위는 `src/modules` 라 **프로덕션 베이스라인을 오염시키지 않는다**.
 *
 * > 종전 이 자리의 테스트는 **존재하지 않는 fixture 경로**를 참조했고, 경로 필터가 파일을
 * > 열기 전에 걸러서 항상 `[]` 를 돌려받아 **그린이었다** — 이름은 "술어가 그 조합을
 * > 집는다" 인데 실제로는 아무것도 집지 않는 것을 확인하고 있었다
 * > (`review/code/2026/09/05/19_08_18` Critical 1).
 */
export class OptionalNullableOffenderFixtureDto {
  /** 위반 — `required:false` + `nullable:true` (응답 바디 금지 조합). */
  @ApiPropertyOptional({ nullable: true, type: String })
  offending?: string | null;

  /** 위반 — 데코레이터 이름 대신 `required: false` 인자로 같은 조합을 만든 형태. */
  @ApiProperty({ required: false, nullable: true, type: String })
  offendingViaRequiredOption?: string | null;

  /** 준수 — 상시 존재 + nullable (§5.4 기본형). 집히면 안 된다. */
  @ApiProperty({ nullable: true, type: String })
  compliantNullable: string | null;

  /** 준수 — 키 생략형(`| null` 없음). 집히면 안 된다. */
  @ApiPropertyOptional()
  compliantOmitted?: string;
}
