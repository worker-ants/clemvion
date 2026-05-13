import type { Cafe24OperationMetadata } from './types.js';

export const privacyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'customers_privacy_get',
    label: '회원 개인정보 조회',
    description:
      'Read sensitive personal data fields for a customer (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'privacy/customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
