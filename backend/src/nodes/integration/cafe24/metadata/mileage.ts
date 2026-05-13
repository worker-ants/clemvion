import type { Cafe24OperationMetadata } from './types.js';

export const mileageOperations: Cafe24OperationMetadata[] = [
  {
    id: 'mileage_list',
    label: '적립금 내역 조회',
    description: 'List mileage (loyalty point) transactions.',
    scopeType: 'read',
    method: 'GET',
    path: 'points',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
      start_date: { type: 'string', location: 'query' },
      end_date: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'mileage_grant',
    label: '적립금 지급',
    description: 'Grant mileage to a member.',
    scopeType: 'write',
    method: 'POST',
    path: 'points',
    requiredFields: ['member_id', 'amount', 'reason'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      member_id: { type: 'string', location: 'body' },
      amount: {
        type: 'string',
        location: 'body',
        description: 'Positive decimal — grant amount',
      },
      reason: { type: 'string', location: 'body' },
      type: {
        type: 'enum',
        location: 'body',
        enum: ['increase', 'decrease'],
        default: 'increase',
      },
    },
    responseShape: 'single',
  },
];
