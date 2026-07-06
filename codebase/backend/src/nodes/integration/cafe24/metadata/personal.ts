import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `personal` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md` §G-1-remaining, 2026-07-05):
 * field-set 을 공식 docs 카탈로그(`spec/conventions/cafe24-api-catalog/personal/*.md`
 * 의 각 operation `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를
 * 그대로 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `requiredFields` 는 기존 계약을 보존하되 신규 fields 에 실재하는 것만 남긴다
 *   (metadata.spec 의 subset 불변식). 새 조건부 required 는 constraints 로 표현하며,
 *   personal 카탈로그의 요청 표에는 조건부/date-pair 제약이 없어 constraints 는 없다.
 *
 * personal 카탈로그의 모든 operation 은 read-only GET 이며 요청 파라미터는
 * `shop_no` + path param (`member_id` / `product_no`) 만으로 구성된다. 날짜/통화/
 * 조건부 필드가 없어 date-descriptions 상수는 사용하지 않는다.
 */
export const personalOperations: Cafe24OperationMetadata[] = [
  {
    id: 'carts_list',
    description: 'List shopping carts for members.',
    scopeType: 'read',
    method: 'GET',
    path: 'carts',
    requiredFields: ['shop_no', 'member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Member ID(s); comma-separated for multiple',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customers_wishlist_list',
    description: "List the products in a customer's wishlist.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/wishlist',
    requiredFields: ['member_id'],
    fields: {
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member ID',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 8d — Personal 완성
  {
    id: 'customers_wishlist_count',
    description:
      "Retrieve the count of products in a customer's wishlist. Requires member_id as a path parameter.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/wishlist/count',
    requiredFields: ['member_id'],
    fields: {
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member ID',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'products_carts_count',
    description: 'Retrieve the count of carts containing a given product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/carts/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: {
        type: 'number',
        location: 'path',
        description: 'Product number',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'products_carts_list',
    description: 'List carts that contain a given product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/carts',
    requiredFields: ['product_no'],
    fields: {
      product_no: {
        type: 'number',
        location: 'path',
        description: 'Product number',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
];
