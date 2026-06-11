import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/**
 * `GET /model-configs` 쿼리 DTO. 페이지네이션 필드에 더해 `kind` 를 화이트리스트에
 * 포함시킨다.
 *
 * NestJS 전역 ValidationPipe 는 `whitelist + forbidNonWhitelisted` 이므로
 * `@Query()` 로 바인딩되는 쿼리 객체에 DTO 에 선언되지 않은 프로퍼티(`kind`)가
 * 있으면 "property kind should not exist" 로 400 을 던진다. 따라서 `kind` 를 여기
 * 선언해 통과시키되, 값 자체의 유효성(허용 kind 여부)은 컨트롤러의 `parseKind` 가
 * `MODEL_CONFIG_INVALID` 계약(spec/5-system/9-rag-search.md)으로 검증한다 —
 * `@IsIn` 을 쓰지 않는 이유는 그 의미 검증 에러 코드를 보존하기 위해서다.
 *
 * Swagger 문서화는 컨트롤러 메서드의 `@ApiQuery({ name: 'kind', required: true })`
 * 가 단일 소스이므로 여기서는 `@ApiProperty` 를 중복 선언하지 않는다.
 */
export class ListModelConfigsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  kind?: string;
}
