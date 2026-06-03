import type { Cafe24OperationMetadata } from './types.js';

export const personalOperations: Cafe24OperationMetadata[] = [
  {
    id: 'carts_list',
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
    description: "Retrieve the count of products in a customer's wishlist.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/wishlist/count',
    requiredFields: ['member_id'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'path' },
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
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
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
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];
