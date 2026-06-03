import type { Cafe24OperationMetadata } from './types.js';

export const translationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'translation_products_list',
    description: 'List product translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/products',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'ISO 639-1 (en, ja, zh, ...)',
      },
      product_no: { type: 'number', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Translation endpoint path 는 복수 `translations/...` 이 정답.
  // 근거: Cafe24 공식 Admin API Documentation 전체 페이지 HTML 의 실제 표시 URL 이
  // `/api/v2/admin/translations/...` (복수) 로 18/18 일치, 단수는 0건이다
  // (field-level 카탈로그 spec/conventions/cafe24-api-catalog/translation/*.md = docs SoT).
  // 과거 단수 표기는 anchor slug 와 URL 을 혼동한 오기였다 — 정정함
  // (plan G-3a, 사용자 결정 2026-06-03: docs HTML 이 API 최종 상태).
  {
    id: 'translation_products_update',
    description:
      'Update product translation for a given language. Body fields are partial — provide only the ones to change.',
    scopeType: 'write',
    method: 'PUT',
    path: 'translations/products/{product_no}',
    requiredFields: ['product_no', 'shop_no', 'language_code'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'ISO 639-1 (en, ja, zh, ...)',
      },
      product_name: { type: 'string', location: 'body' },
      summary_description: { type: 'string', location: 'body' },
      description: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'translation_categories_list',
    description: 'List category translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/categories',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
      category_no: { type: 'number', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'translation_categories_update',
    description: 'Update category translation for a language.',
    scopeType: 'write',
    method: 'PUT',
    path: 'translations/categories/{category_no}',
    requiredFields: ['category_no', 'shop_no', 'language_code'],
    fields: {
      category_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
      category_name: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'translation_store_list',
    description: 'List store-level translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/store',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'translation_store_update',
    description:
      'Update the store-level translations (mall name, policies, ...) for a given language.',
    scopeType: 'write',
    method: 'PUT',
    path: 'translations/store',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
      mall_name: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'translation_themes_list',
    description: 'List theme-level translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/themes',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 8c — Translation 완성 (테마 번역 단건 조회/수정)
  {
    id: 'translation_themes_get',
    description: 'Retrieve a single theme translation entry by skin_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/themes/{skin_no}',
    requiredFields: ['skin_no', 'language_code'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'translation_themes_update',
    description:
      'Update a single theme translation entry (partial). Refer to Cafe24 docs for full body schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'translations/themes/{skin_no}',
    requiredFields: ['skin_no', 'language_code'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
];
