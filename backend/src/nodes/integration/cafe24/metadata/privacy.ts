import type { Cafe24OperationMetadata } from './types.js';

export const privacyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'customers_privacy_get',
    label: '회원 개인정보 조회',
    description:
      'Read sensitive personal data fields for a customer (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'privacy/customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  // Phase 8f — Privacy 완성
  {
    id: 'customers_privacy_list',
    label: '회원 개인정보 목록 조회',
    description: 'Retrieve a list of customer privacy records (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'privacy/customers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customers_privacy_count',
    label: '회원 개인정보 개수 조회',
    description: 'Retrieve the count of customer privacy records (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'privacy/customers/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customers_privacy_update',
    label: '회원 개인정보 수정',
    description: 'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'privacy/customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'products_wishlist_customers_list',
    label: '위시리스트 보유 회원 목록',
    description: 'List customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'products_wishlist_customers_count',
    label: '위시리스트 보유 회원 수',
    description: 'Retrieve the count of customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
