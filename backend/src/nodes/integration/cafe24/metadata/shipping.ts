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
];
