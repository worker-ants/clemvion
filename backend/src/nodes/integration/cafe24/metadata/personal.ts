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
];
