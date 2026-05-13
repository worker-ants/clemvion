import type { Cafe24OperationMetadata } from './types.js';

export const notificationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'sms_send',
    label: 'SMS 발송',
    description: 'Send an SMS via the Cafe24 SMS service.',
    scopeType: 'write',
    method: 'POST',
    path: 'sms',
    requiredFields: ['sender', 'receiver', 'content'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      sender: { type: 'string', location: 'body' },
      receiver: { type: 'string', location: 'body' },
      content: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'sms_balance_get',
    label: 'SMS 잔액 조회',
    description: 'Get the remaining SMS credit balance.',
    scopeType: 'read',
    method: 'GET',
    path: 'sms/balance',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
