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
 * `{ data: { oneOf: [<ref(A)>, <ref(B)>, ...] } }` 스키마 객체를 생성합니다.
 * 응답이 분기에 따라 서로 다른 DTO shape 을 반환하는 경우 사용합니다 (예:
 * `OAuthBeginPopupResultDto` vs `OAuthBeginCafe24PendingResultDto`).
 * 각 DTO 가 `discriminator` 역할의 필드(예: `mode`)를 자체적으로 강제하므로
 * Swagger 콘솔에서 분기별 example 이 따로 노출됩니다.
 *
 * `discriminator` 인자를 넘기면 OpenAPI `discriminator.propertyName` 도
 * 함께 출력합니다 — openapi-generator 등 일부 SDK 도구가 union narrowing 을
 * 자동 생성할 때 사용. 호출자는 모든 DTO 가 동일 propertyName 필드를 보유함을
 * 보장해야 합니다 (없으면 SDK 가 잘못된 분기로 매핑).
 *
 * 빈 배열은 OpenAPI 가 거부하는 invalid schema 이므로 호출 시점에 즉시
 * fail-fast — silent 스키마 손상을 방지.
 */
export function wrapOneOfDataSchema(
  dtos: ReadonlyArray<ClassRef<unknown>>,
  discriminator?: { propertyName: string },
): SchemaObject {
  if (dtos.length === 0) {
    throw new Error(
      'wrapOneOfDataSchema requires at least one DTO (got empty array).',
    );
  }
  const dataSchema: SchemaObject = {
    oneOf: dtos.map((d) => ({ $ref: getSchemaPath(d) })),
  };
  if (discriminator) {
    dataSchema.discriminator = {
      propertyName: discriminator.propertyName,
    };
  }
  return {
    type: 'object',
    required: ['data'],
    properties: {
      data: dataSchema,
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
 * `@ApiOkResponse` + `@ApiExtraModels(...dtos)` + `{ data: { oneOf } }` 래퍼.
 * 분기 응답(예: OAuth begin 의 popup vs cafe24_private_pending) 문서화용.
 * `discriminator` 인자를 넘기면 OpenAPI `discriminator.propertyName` 까지
 * 노출 — SDK 자동 생성 도구가 union narrowing 을 정확히 매핑.
 */
export function ApiOkWrappedOneOfResponse(
  dtos: ReadonlyArray<ClassRef<unknown>>,
  options: ExtraOptions & { discriminator?: { propertyName: string } } = {},
) {
  const { discriminator, ...rest } = options;
  return applyDecorators(
    ApiExtraModels(...dtos),
    ApiOkResponse({
      ...rest,
      schema: wrapOneOfDataSchema(dtos, discriminator),
    }),
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
