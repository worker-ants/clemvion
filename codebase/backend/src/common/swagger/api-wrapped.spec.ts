import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  wrapDataSchema,
  wrapItemsSchema,
  wrapOneOfDataSchema,
  wrapPaginatedSchema,
} from './api-wrapped';

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

  it('wrapPaginatedSchema matches PaginatedResponseDto shape', () => {
    const schema = wrapPaginatedSchema(SampleDto);
    const data = schema.properties?.data as Record<string, unknown>;
    expect(data.required).toEqual(['data', 'pagination']);
    const properties = data.properties as Record<string, unknown>;
    expect(properties.data).toEqual({
      type: 'array',
      items: { $ref: getSchemaPath(SampleDto) },
    });
    const pagination = properties.pagination as Record<string, unknown>;
    expect(pagination.required).toEqual([
      'page',
      'limit',
      'totalItems',
      'totalPages',
    ]);
  });
});
