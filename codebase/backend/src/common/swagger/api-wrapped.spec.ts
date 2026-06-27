import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  wrapDataSchema,
  wrapItemsSchema,
  wrapOneOfDataSchema,
  wrapPaginatedSchema,
} from './api-wrapped';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

class SampleDto {
  @ApiProperty({ example: 'a' })
  id: string;
}

class BranchADto {
  @ApiProperty({ enum: ['a'] })
  kind!: 'a';
}

class BranchBDto {
  @ApiProperty({ enum: ['b'] })
  kind!: 'b';
}

describe('api-wrapped schema builders', () => {
  it('wrapDataSchema builds { data: $ref(Dto) }', () => {
    const schema = wrapDataSchema(SampleDto);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['data']);
    expect(schema.properties?.data).toEqual({
      $ref: getSchemaPath(SampleDto),
    });
  });

  it('wrapItemsSchema builds { data: array($ref) }', () => {
    const schema = wrapItemsSchema(SampleDto);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['data']);
    expect(schema.properties?.data).toEqual({
      type: 'array',
      items: { $ref: getSchemaPath(SampleDto) },
    });
  });

  it('wrapOneOfDataSchema builds { data: { oneOf: [refs] } }', () => {
    const schema = wrapOneOfDataSchema([BranchADto, BranchBDto]);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['data']);
    const dataSchema = schema.properties?.data as { oneOf: unknown[] };
    expect(dataSchema.oneOf).toEqual([
      { $ref: getSchemaPath(BranchADto) },
      { $ref: getSchemaPath(BranchBDto) },
    ]);
  });

  it('wrapOneOfDataSchema accepts a single DTO (degenerate oneOf still valid)', () => {
    const schema = wrapOneOfDataSchema([SampleDto]);
    const dataSchema = schema.properties?.data as { oneOf: unknown[] };
    expect(dataSchema.oneOf).toHaveLength(1);
    expect(dataSchema.oneOf[0]).toEqual({ $ref: getSchemaPath(SampleDto) });
  });

  it('wrapOneOfDataSchema throws on empty array (OpenAPI rejects empty oneOf)', () => {
    expect(() => wrapOneOfDataSchema([])).toThrow(/requires at least one DTO/);
  });

  it('wrapOneOfDataSchema attaches discriminator when provided', () => {
    const schema = wrapOneOfDataSchema([BranchADto, BranchBDto], {
      propertyName: 'kind',
    });
    const dataSchema = schema.properties?.data as {
      oneOf: unknown[];
      discriminator?: { propertyName: string };
    };
    expect(dataSchema.discriminator).toEqual({ propertyName: 'kind' });
    expect(dataSchema.oneOf).toHaveLength(2);
  });

  it('wrapOneOfDataSchema omits discriminator by default', () => {
    const schema = wrapOneOfDataSchema([BranchADto, BranchBDto]);
    const dataSchema = schema.properties?.data as {
      oneOf: unknown[];
      discriminator?: unknown;
    };
    expect(dataSchema.discriminator).toBeUndefined();
  });

  it('wrapPaginatedSchema matches PaginatedResponseDto shape (single-wrap)', () => {
    const schema = wrapPaginatedSchema(SampleDto);
    // single-wrap: data(array) + pagination 이 top-level — PaginatedResponseDto 가 `data` 키를
    // 가져 TransformInterceptor 가 pass-through 하므로 외곽 data 래퍼가 없다(실제 wire shape).
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['data', 'pagination']);
    const properties = schema.properties as Record<string, unknown>;
    expect(properties.data).toEqual({
      type: 'array',
      items: { $ref: getSchemaPath(SampleDto) },
    });
    expect(properties.pagination).toEqual({
      type: 'object',
      required: ['page', 'limit', 'totalItems', 'totalPages'],
      properties: {
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
        totalItems: { type: 'integer', example: 123 },
        totalPages: { type: 'integer', example: 7 },
      },
    });
  });

  it('wrapPaginatedSchema pagination keys stay in sync with PaginatedResponseDto runtime shape', () => {
    // drift guard: 스키마 리터럴의 pagination 필드 ↔ 실제 `PaginatedResponseDto.create()` 가
    // 만드는 pagination 객체 키 대조. PaginationMeta 필드를 추가/변경하고 둘 중 한쪽(리터럴 또는
    // create())만 고치면 이 테스트가 깨져 수동 동기화 drift 를 컴파일/테스트 시점에 잡는다.
    const runtimeKeys = Object.keys(
      PaginatedResponseDto.create([], 0, 1, 1).pagination,
    ).sort();
    const pagination = wrapPaginatedSchema(SampleDto).properties
      ?.pagination as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(pagination.properties).sort()).toEqual(runtimeKeys);
    expect([...pagination.required].sort()).toEqual(runtimeKeys);
  });
});
