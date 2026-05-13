import type { Cafe24OperationMetadata } from './types.js';

export const storeOperations: Cafe24OperationMetadata[] = [
  {
    id: 'store_get',
    label: '상점 정보 조회',
    description: 'Get the mall (store) information.',
    scopeType: 'read',
    method: 'GET',
    path: 'store',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'shops_list',
    label: '멀티쇼핑몰 목록 조회',
    description: 'List shops in a multi-shop mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'shops',
    requiredFields: [],
    fields: {},
    responseShape: 'list',
  },
];
