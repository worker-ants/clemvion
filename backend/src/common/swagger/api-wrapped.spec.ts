import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  wrapDataSchema,
  wrapItemsSchema,
  wrapPaginatedSchema,
} from './api-wrapped';

class SampleDto {
  @ApiProperty({ example: 'a' })
  id: string;
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
