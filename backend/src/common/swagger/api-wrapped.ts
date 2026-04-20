import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiResponseOptions,
  ApiCreatedResponse,
  ApiAcceptedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type ClassRef<T> = Type<T>;

/**
 * `{ data: <ref> }` 스키마 객체를 생성합니다.
 * `@ApiOkResponse({ schema: wrapDataSchema(Dto) })` 형태로 사용합니다.
 */
export function wrapDataSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: { $ref: getSchemaPath(dto) },
    },
  };
}

/**
 * `{ data: <ref>[] }` 스키마 객체를 생성합니다. 단순 배열 응답용.
 */
export function wrapItemsSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        items: { $ref: getSchemaPath(dto) },
      },
    },
  };
}

/**
 * `{ data: { data: <ref>[], pagination: { page, limit, totalItems, totalPages } } }`
 * 본 프로젝트의 모든 페이지네이션 응답은 공용 `PaginatedResponseDto.create()` 를 거치므로
 * 이 형태를 따릅니다.
 */
export function wrapPaginatedSchema<T>(dto: ClassRef<T>): SchemaObject {
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(dto) },
          },
          pagination: {
            type: 'object',
            required: ['page', 'limit', 'totalItems', 'totalPages'],
            properties: {
              page: { type: 'integer', example: 1 },
              limit: { type: 'integer', example: 20 },
              totalItems: { type: 'integer', example: 123 },
              totalPages: { type: 'integer', example: 7 },
            },
          },
        },
      },
    },
  };
}

type ExtraOptions = Omit<ApiResponseOptions, 'schema' | 'type'>;

/**
 * `@ApiOkResponse` + `@ApiExtraModels` + `{ data: <ref> }` 래퍼를 일괄 적용합니다.
 */
export function ApiOkWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * 생성 성공 응답 (`201 Created`) + `{ data: <ref> }` 래퍼.
 */
export function ApiCreatedWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiCreatedResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * 비동기 요청 접수 (`202 Accepted`) + `{ data: <ref> }` 래퍼.
 */
export function ApiAcceptedWrappedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiAcceptedResponse({ ...options, schema: wrapDataSchema(dto) }),
  );
}

/**
 * 배열 응답 (`200 OK`) + `{ data: <ref>[] }` 래퍼.
 */
export function ApiOkWrappedArrayResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapItemsSchema(dto) }),
  );
}

/**
 * 공용 `PaginatedResponseDto` 형태의 페이지네이션 응답 래퍼.
 * `{ data: { data: <ref>[], pagination: { page, limit, totalItems, totalPages } } }` 구조를 문서화합니다.
 */
export function ApiOkPaginatedResponse<T>(
  dto: ClassRef<T>,
  options: ExtraOptions = {},
) {
  return applyDecorators(
    ApiExtraModels(dto),
    ApiOkResponse({ ...options, schema: wrapPaginatedSchema(dto) }),
  );
}
