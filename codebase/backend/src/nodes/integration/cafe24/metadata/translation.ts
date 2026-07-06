import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `translation` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md` §G-1-remaining): field-set 을
 * 공식 docs 카탈로그(`spec/conventions/cafe24-api-catalog/translation/*.md` 의 각
 * operation `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를
 * 그대로 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - update 의 nested `translations` / `skin_translation` wrapper 하위 leaf 필드는
 *   body field 로 평탄화한다 (기존 translation.ts 와 동일 관례).
 * - `requiredFields` 는 기존 계약을 보존하되 신규 fields 에 실재하는 것만 남긴다
 *   (metadata.spec 의 subset 불변식). 새 body-required (예: theme source) 는
 *   requiredFields 에 추가하지 않는다.
 */
export const translationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'translation_products_list',
    description: 'List product translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/products',
    requiredFields: ['shop_no', 'language_code'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      product_no: {
        type: 'string',
        location: 'query',
        description: 'Product number(s), comma-separated multi-search',
      },
      product_name: {
        type: 'string',
        location: 'query',
        description: 'Search by product name',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code(s), comma-separated multi-search',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code',
      },
      product_name: {
        type: 'string',
        location: 'body',
        description: 'Product name',
      },
      product_tag: {
        type: 'string',
        location: 'body',
        description: 'Product search keyword',
      },
      payment_info: {
        type: 'string',
        location: 'body',
        description: 'Payment guide',
      },
      shipping_info: {
        type: 'string',
        location: 'body',
        description: 'Shipping guide',
      },
      exchange_info: {
        type: 'string',
        location: 'body',
        description: 'Exchange/return guide',
      },
      service_info: {
        type: 'string',
        location: 'body',
        description: 'Service inquiry guide',
      },
      summary_description: {
        type: 'string',
        location: 'body',
        description: 'Product summary description',
      },
      simple_description: {
        type: 'string',
        location: 'body',
        description: 'Product simple description',
      },
      description: {
        type: 'string',
        location: 'body',
        description: 'Product detail description',
      },
      mobile_description: {
        type: 'string',
        location: 'body',
        description: 'Mobile product detail description',
      },
      product_material: {
        type: 'string',
        location: 'body',
        description: 'Product material',
      },
      seo: {
        type: 'object',
        location: 'body',
        description: 'Product SEO resource (meta title/author/description/...)',
      },
      options: {
        type: 'array',
        location: 'body',
        description: 'Option name/value list',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      category_no: {
        type: 'string',
        location: 'query',
        description: 'Category number(s), comma-separated multi-search',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code(s), comma-separated multi-search',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code',
      },
      category_name: {
        type: 'string',
        location: 'body',
        description: 'Category name',
      },
      seo: {
        type: 'object',
        location: 'body',
        description: 'Product SEO resource (meta title/author/description/...)',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code(s), comma-separated multi-search',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code',
      },
      shop_name: {
        type: 'string',
        location: 'body',
        description: 'Shopping mall name',
      },
      company_name: {
        type: 'string',
        location: 'body',
        description: 'Company name',
      },
      company_registration_no: {
        type: 'string',
        location: 'body',
        description: 'Business registration number',
      },
      president_name: {
        type: 'string',
        location: 'body',
        description: 'Representative name',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Phone number',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Email',
      },
      fax: {
        type: 'string',
        location: 'body',
        description: 'Fax number',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Zip code',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Base address',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detail address',
      },
      customer_service_phone: {
        type: 'string',
        location: 'body',
        description: 'Customer service phone',
      },
      customer_service_hours: {
        type: 'string',
        location: 'body',
        description: 'Customer service hours',
      },
      privacy_officer_name: {
        type: 'string',
        location: 'body',
        description: 'Privacy officer name',
      },
      privacy_officer_email: {
        type: 'string',
        location: 'body',
        description: 'Privacy officer email',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'translation_themes_list',
    description: 'List theme-level translations for a given language.',
    scopeType: 'read',
    method: 'GET',
    path: 'translations/themes',
    requiredFields: [],
    fields: {},
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
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code',
      },
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
      language_code: {
        type: 'string',
        location: 'query',
        description: 'Language code',
      },
      source: {
        type: 'string',
        location: 'body',
        description: 'Source code (translation JSON source)',
      },
    },
    responseShape: 'single',
  },
];
