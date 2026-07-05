import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `collection` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md` §G-1-remaining, 2026-07-05):
 * field-set 을 공식 docs 카탈로그(`spec/conventions/cafe24-api-catalog/collection/*.md`
 * 의 각 operation `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를
 * 그대로 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `requiredFields` 는 기존 계약을 보존하되 신규 fields 에 실재하는 것만 남긴다
 *   (metadata.spec 의 subset 불변식). 새 body-required 는 constraints 로 표현하지 않고
 *   docs 표의 조건부만 constraints 로 옮긴다.
 * - collection 요청 표에는 date/time 필드가 없어 date-descriptions import 는 불필요.
 */
export const collectionOperations: Cafe24OperationMetadata[] = [
  {
    id: 'brands_list',
    description: 'List brands in the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'brands',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      brand_code: {
        type: 'string',
        location: 'query',
        description: 'Brand code(s), comma-separated multi-search',
      },
      brand_name: {
        type: 'string',
        location: 'query',
        description: 'Brand name(s), comma-separated multi-search',
      },
      use_brand: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Brand in-use (T=on, F=off)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'manufacturers_list',
    description: 'List manufacturers.',
    scopeType: 'read',
    method: 'GET',
    path: 'manufacturers',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      manufacturer_code: {
        type: 'string',
        location: 'query',
        description: 'Manufacturer code(s), comma-separated multi-search',
      },
      manufacturer_name: {
        type: 'string',
        location: 'query',
        description: 'Manufacturer name(s), comma-separated multi-search',
      },
      use_manufacturer: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Manufacturer in-use (T=on, F=off)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'trends_list',
    description: 'List trends.',
    scopeType: 'read',
    method: 'GET',
    path: 'trends',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      trend_code: {
        type: 'string',
        location: 'query',
        description: 'Trend code(s), comma-separated multi-search',
      },
      trend_name: {
        type: 'string',
        location: 'query',
        description: 'Trend name(s), comma-separated multi-search',
      },
      use_trend: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Trend in-use (T=on, F=off)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 6d — collection (brands CRUD baseline)
  {
    id: 'brands_count',
    description: 'Retrieve the count of brands.',
    scopeType: 'read',
    method: 'GET',
    path: 'brands/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      brand_code: {
        type: 'string',
        location: 'query',
        description: 'Brand code(s), comma-separated multi-search',
      },
      brand_name: {
        type: 'string',
        location: 'query',
        description: 'Brand name(s), comma-separated multi-search',
      },
      use_brand: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Brand in-use (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_create',
    description: 'Create a brand. brand_name required.',
    scopeType: 'write',
    method: 'POST',
    path: 'brands',
    requiredFields: ['brand_name'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      brand_name: {
        type: 'string',
        location: 'body',
        description: 'Brand name',
      },
      use_brand: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Brand in-use (T=on, F=off)',
      },
      search_keyword: {
        type: 'string',
        location: 'body',
        description: 'Search keyword(s)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_update',
    description: 'Update a brand by brand_code.',
    scopeType: 'write',
    method: 'PUT',
    path: 'brands/{brand_code}',
    requiredFields: ['brand_code'],
    fields: {
      brand_code: {
        type: 'string',
        location: 'path',
        description: 'Brand code',
      },
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      brand_name: {
        type: 'string',
        location: 'body',
        description: 'Brand name',
      },
      use_brand: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Brand in-use (T=on, F=off)',
      },
      search_keyword: {
        type: 'string',
        location: 'body',
        description: 'Search keyword(s)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'brands_delete',
    description: 'Delete a brand by brand_code.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'brands/{brand_code}',
    requiredFields: ['brand_code'],
    fields: {
      brand_code: {
        type: 'string',
        location: 'path',
        description: 'Brand code',
      },
    },
    responseShape: 'single',
  },
  // Phase 8h — Collection 완성 (manufacturers + trends + classifications + origin)
  {
    id: 'manufacturers_count',
    description: 'Retrieve the count of manufacturers.',
    scopeType: 'read',
    method: 'GET',
    path: 'manufacturers/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      manufacturer_code: {
        type: 'string',
        location: 'query',
        description: 'Manufacturer code(s), comma-separated multi-search',
      },
      manufacturer_name: {
        type: 'string',
        location: 'query',
        description: 'Manufacturer name(s), comma-separated multi-search',
      },
      use_manufacturer: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Manufacturer in-use (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'manufacturers_get',
    description: 'Retrieve a manufacturer by manufacturer_code.',
    scopeType: 'read',
    method: 'GET',
    path: 'manufacturers/{manufacturer_code}',
    requiredFields: ['manufacturer_code'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      manufacturer_code: {
        type: 'string',
        location: 'path',
        description: 'Manufacturer code',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'manufacturers_create',
    description:
      'Create a manufacturer. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'manufacturers',
    requiredFields: ['manufacturer_name'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      manufacturer_name: {
        type: 'string',
        location: 'body',
        description: 'Manufacturer name',
      },
      president_name: {
        type: 'string',
        location: 'body',
        description: 'Representative name',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Contact email',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Phone number',
      },
      homepage: {
        type: 'string',
        location: 'body',
        description: 'Homepage URL',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Postal code',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Basic address',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detailed address',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Country code',
      },
      use_manufacturer: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Manufacturer in-use (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'manufacturers_update',
    description: 'Update a manufacturer (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'manufacturers/{manufacturer_code}',
    requiredFields: ['manufacturer_code'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      manufacturer_code: {
        type: 'string',
        location: 'path',
        description: 'Manufacturer code',
      },
      manufacturer_name: {
        type: 'string',
        location: 'body',
        description: 'Manufacturer name',
      },
      president_name: {
        type: 'string',
        location: 'body',
        description: 'Representative name',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Contact email',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Phone number',
      },
      homepage: {
        type: 'string',
        location: 'body',
        description: 'Homepage URL',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Postal code',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Basic address',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detailed address',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Country code',
      },
      use_manufacturer: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Manufacturer in-use (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'trends_count',
    description: 'Retrieve the count of trend tags.',
    scopeType: 'read',
    method: 'GET',
    path: 'trends/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      trend_code: {
        type: 'string',
        location: 'query',
        description: 'Trend code(s), comma-separated multi-search',
      },
      trend_name: {
        type: 'string',
        location: 'query',
        description: 'Trend name(s), comma-separated multi-search',
      },
      use_trend: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Trend in-use (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'classifications_list',
    description: 'List custom (user-defined) classifications.',
    scopeType: 'read',
    method: 'GET',
    path: 'classifications',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      classification_code: {
        type: 'string',
        location: 'query',
        description: 'Classification code(s), comma-separated multi-search',
      },
      classification_name: {
        type: 'string',
        location: 'query',
        description: 'Classification name(s), comma-separated multi-search',
      },
      use_classification: {
        type: 'string',
        location: 'query',
        description: 'Classification in-use',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'classifications_count',
    description: 'Retrieve the count of custom classifications.',
    scopeType: 'read',
    method: 'GET',
    path: 'classifications/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      classification_code: {
        type: 'string',
        location: 'query',
        description: 'Classification code(s), comma-separated multi-search',
      },
      classification_name: {
        type: 'string',
        location: 'query',
        description: 'Classification name(s), comma-separated multi-search',
      },
      use_classification: {
        type: 'string',
        location: 'query',
        description: 'Classification in-use',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'origin_list',
    description: 'List country-of-origin entries.',
    scopeType: 'read',
    method: 'GET',
    path: 'origin',
    requiredFields: [],
    fields: {
      origin_place_no: {
        type: 'number',
        location: 'query',
        description: 'Origin place number',
      },
      origin_place_name: {
        type: 'string',
        location: 'query',
        description: 'Origin place name',
      },
      foreign: {
        type: 'string',
        location: 'query',
        description: 'Foreign origin flag',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
];
