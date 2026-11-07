import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MODEL_CONFIG_KINDS } from '../../entities/model-config.entity';
import { MODEL_TYPE_ENUM, type ModelTypeFilter } from '../model-type';

/** ModelConfig 응답 DTO. apiKey 는 마스킹(또는 null)된 상태로 반환됩니다. */
export class ModelConfigDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  workspaceId: string;

  @ApiProperty({ enum: MODEL_CONFIG_KINDS, example: 'chat' })
  kind: string;

  @ApiProperty({ example: 'openai' })
  provider: string;

  @ApiProperty({ example: 'GPT-4o Production' })
  name: string;

  /** 마스킹된 API Key (예: sk-****abcd). 자가호스팅 키 미설정 시 null. */
  @ApiProperty({ nullable: true, type: String, example: 'sk-****abcd' })
  apiKey: string | null;

  /** Provider 엔드포인트 URL. 설정하지 않으면 null. */
  @ApiProperty({ nullable: true, type: String })
  baseUrl: string | null;

  @ApiProperty({ example: 'gpt-4o-mini' })
  defaultModel: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  defaultParams?: Record<string, unknown>;

  /** 임베딩 차원. 임베딩 설정에서 지정하지 않았거나 채팅 설정이면 null. */
  @ApiProperty({ nullable: true, type: Number, example: 1536 })
  dimension: number | null;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

/** 연결 테스트 결과 */
export class ModelTestConnectionResultDto {
  @ApiProperty()
  success: boolean;

  // `latencyMs` 는 **한 번도 발행되지 않았다** — 선언만 있고 생산자가 0건이라(실측)
  // OpenAPI 가 없는 필드를 광고했다. 형제 `TestConnectionResultDto` 에도 같은 유령이 있었고
  // 함께 걷어냈다. `assertMatchesContract` 는 **선언되지 않은 키**를 잡으므로 이 방향
  // (선언됐지만 안 나가는 키)은 원리적으로 못 본다 — grep 이 유일한 검사다.
  //
  // `message` 는 서비스가 실패할 때만 싣는 키 생략형이다(`LlmService.testConnection`). 성공 응답은 키가 없고
  // `null` 을 내는 경로는 없다.
  /** 실패 사유. 성공 응답에는 실리지 않습니다. */
  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional({
    description:
      'Detected embedding dimension via probe embed when kind=embedding. Omitted if detection fails.',
    example: 1536,
  })
  dimension?: number;
}

/**
 * 모델 목록 항목 — provider `listModels` 가 반환하는 `ModelInfo`
 * (`llm/interfaces/llm-client.interface.ts`)를 충실히 미러한다.
 *
 * `GET /api/model-configs/:id/models`·`POST .../preview-models` 응답은 이 DTO 의
 * **배열** 이다 (`@ApiOkWrappedArrayResponse` → `{ data: ModelInfoDto[] }`). 종전
 * `ModelListDto`(`{ models: [...] }` 객체)는 실제 wire shape(bare array)와 불일치해
 * 폐기했다.
 */
export class ModelInfoDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  id: string;

  @ApiProperty({ example: 'GPT-4o mini' })
  name: string;

  @ApiProperty({ enum: Object.values(MODEL_TYPE_ENUM), example: 'chat' })
  type: ModelTypeFilter;
}
