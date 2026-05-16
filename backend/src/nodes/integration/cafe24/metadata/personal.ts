import type { Cafe24OperationMetadata } from './types.js';

export const personalOperations: Cafe24OperationMetadata[] = [
  {
    id: 'carts_list',
    label: '장바구니 목록 조회',
    description: 'List shopping carts for members.',
    scopeType: 'read',
    method: 'GET',
    path: 'carts',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'wishlists_list',
    label: '위시리스트 조회',
    description: 'List wishlists for members.',
    scopeType: 'read',
    method: 'GET',
    path: 'wishlists',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 8d — Personal 완성
  {
    id: 'customers_wishlist_count',
    label: '위시리스트 상품 개수',
    description: "Retrieve the count of products in a customer's wishlist.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/wishlist/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'products_carts_count',
    label: '상품 담은 장바구니 수',
    description: 'Retrieve the count of carts containing a given product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/carts/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'products_carts_list',
    label: '상품 담은 장바구니 목록',
    description: 'List carts that contain a given product.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/carts',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];
