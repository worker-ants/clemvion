import type { Cafe24OperationMetadata } from './types.js';

export const translationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'translation_products_list',
    description: 'List product translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translation/products',
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
  // Translation endpoint path 는 단수 `translation/...` 이 정답 —
  // spec/conventions/cafe24-api-catalog/translation.md (SoT) 와 일치한다.
  // (Cafe24 docs 의 anchor slug 가 `...-translations` 복수로 보이는 것은
  // 리소스 개념 표기일 뿐 URL path 가 아니다.)
  {
    id: 'translation_products_update',
    description:
      'Update product translation for a given language. Body fields are partial — provide only the ones to change.',
    scopeType: 'write',
    method: 'PUT',
    path: 'translation/products/{product_no}',
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
    path: 'translation/categories',
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
    path: 'translation/categories/{category_no}',
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
    path: 'translation/store',
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
    path: 'translation/store',
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
    path: 'translation/themes',
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
    description: 'Retrieve a single theme translation entry by theme_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'translation/themes/{theme_no}',
    requiredFields: ['theme_no', 'language_code'],
    fields: {
      theme_no: { type: 'number', location: 'path' },
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
    path: 'translation/themes/{theme_no}',
    requiredFields: ['theme_no', 'language_code'],
    fields: {
      theme_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      language_code: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
];
