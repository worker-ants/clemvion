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
  // Phase 6d — supply baselines
  {
    id: 'suppliers_count',
    label: '공급사 개수 조회',
    description: 'Retrieve the count of suppliers.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_get',
    label: '공급사 단건 조회',
    description: 'Retrieve a single supplier by supplier_code.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
