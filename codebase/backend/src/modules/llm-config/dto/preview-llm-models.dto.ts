import {
  IsIn,
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLM_PROVIDERS, type LlmProvider } from './create-llm-config.dto';

const PROVIDERS_REQUIRING_BASE_URL: ReadonlyArray<LlmProvider> = [
  'azure',
  'local',
];

/**
 * 저장 전 폼 자격증명으로 프로바이더 모델 목록을 미리 조회한다.
 *
 * **보안 계약** — 본 DTO 의 `apiKey` 는 request body 에 평문으로 실려 오지만,
 *   - 서비스는 this 값을 저장/캐시하지 않고 단일 요청 내에서만 사용한다.
 *   - HTTP 로거·APM·에러 트래커는 **request body 를 캡처해서는 안 된다**.
 *     body logging 도입 시 `common/utils/mask-sensitive-fields.util.ts` 를
 *     적용해 `apiKey`·`password`·`token` 을 자동 마스킹.
 *   - 키를 헤더 기반으로 완전히 분리하는 설계 변경은 별도 PR 로 이관.
 */
export class PreviewLlmModelsDto {
  @ApiProperty({
    description:
      'LLM Provider 식별자. openai/anthropic/google/azure/local 중 선택.',
    enum: LLM_PROVIDERS,
    example: 'openai',
  })
  @IsIn(LLM_PROVIDERS)
  provider: LlmProvider;

  @ApiProperty({
    description:
      '폼 상태의 평문 API Key. 저장되지 않으며 모델 목록 조회에 1회 사용됩니다. local 프로바이더는 빈 문자열 허용.',
    example: 'sk-xxxxxxxxxxxxxxxx',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  apiKey: string;

  @ApiPropertyOptional({
    description:
      'Custom Base URL. Azure/Local 프로바이더에 필수이며 그 외에는 선택. http/https 만 허용.',
    example: 'http://localhost:11434/v1',
    maxLength: 500,
  })
  // Azure/Local 에서는 baseUrl 이 필수, 그 외에는 선택. ValidateIf 가 false 를
  // 돌려주면 하위 validator 가 모두 skip 되므로 "전달되지 않은 선택값" 과
  // "필수 누락" 케이스를 한 필드 선언으로 처리할 수 있다.
  @ValidateIf(
    (dto: PreviewLlmModelsDto) =>
      PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) ||
      dto.baseUrl !== undefined,
  )
  @IsString()
  @IsNotEmpty({ message: 'baseUrl is required for azure and local providers' })
  @MaxLength(500)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  baseUrl?: string;
}
