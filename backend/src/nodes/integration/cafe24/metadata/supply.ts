import type { Cafe24OperationMetadata } from './types.js';

export const supplyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'suppliers_list',
    label: '공급사 목록 조회',
    description: 'List suppliers.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];
