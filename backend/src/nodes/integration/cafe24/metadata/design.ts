import type { Cafe24OperationMetadata } from './types.js';

export const designOperations: Cafe24OperationMetadata[] = [
  {
    id: 'themes_list',
    label: '테마 목록 조회',
    description: 'List installed themes.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
];
