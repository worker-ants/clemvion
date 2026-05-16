import type { Cafe24OperationMetadata } from './types.js';

export const shippingOperations: Cafe24OperationMetadata[] = [
  {
    id: 'shipping_companies_list',
    label: '배송사 목록 조회',
    description: 'List shipping companies (carriers).',
    scopeType: 'read',
    method: 'GET',
    path: 'shippingcompanies',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  // Phase 6d — shipping baseline
  {
    id: 'carriers_get',
    label: '배송사 단건 조회',
    description: 'Retrieve a single shipping carrier by carrier_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'carriers/{carrier_no}',
    requiredFields: ['carrier_no'],
    fields: {
      carrier_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
