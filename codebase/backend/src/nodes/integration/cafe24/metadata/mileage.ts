import type { Cafe24OperationMetadata } from './types.js';
import { RESTRICTED_APPROVAL } from './restricted-approval.js';
import {
  CAFE24_DATE_FIELD_SINCE,
  CAFE24_DATE_FIELD_UNTIL,
} from './date-descriptions.js';

export const mileageOperations: Cafe24OperationMetadata[] = [
  {
    id: 'mileage_list',
    description: 'List mileage (loyalty point) transactions.',
    scopeType: 'read',
    method: 'GET',
    path: 'points',
    requiredFields: ['shop_no'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'mileage_grant',
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
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  // Phase 6e — Mileage 보완
  {
    id: 'points_autoexpiration_get',
    description: 'Retrieve the automatic points-expiration rule.',
    scopeType: 'read',
    method: 'GET',
    path: 'points/autoexpiration',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'points_autoexpiration_create',
    description:
      'Register an automatic points-expiration rule. Body should include customer reference + expiration_date + points_amount.',
    scopeType: 'write',
    method: 'POST',
    path: 'points/autoexpiration',
    requiredFields: ['member_id', 'expiration_date', 'points_amount'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      member_id: { type: 'string', location: 'body' },
      expiration_date: { type: 'string', location: 'body' },
      points_amount: {
        type: 'string',
        location: 'body',
        description: 'Decimal string — amount of points to expire',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'points_autoexpiration_delete',
    description: 'Remove the automatic points-expiration rule.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'points/autoexpiration',
    requiredFields: [],
    fields: {},
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'credits_list',
    description: 'Retrieve the credit (예치금) ledger for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'credits',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'credits_report',
    description:
      'Retrieve the credit (예치금) summary report for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'credits/report',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  // Phase 8a — Mileage 완성
  {
    id: 'points_report',
    description: 'Retrieve a points (mileage) report by date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'points/report',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
];
