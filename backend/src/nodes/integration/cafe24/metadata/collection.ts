import type { Cafe24OperationMetadata } from './types.js';

export const collectionOperations: Cafe24OperationMetadata[] = [
  {
    id: 'brands_list',
    label: '브랜드 목록 조회',
    description: 'List brands in the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'brands',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'manufacturers_list',
    label: '제조사 목록 조회',
    description: 'List manufacturers.',
    scopeType: 'read',
    method: 'GET',
    path: 'manufacturers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'trends_list',
    label: '트렌드 목록 조회',
    description: 'List trends.',
    scopeType: 'read',
    method: 'GET',
    path: 'trends',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];
