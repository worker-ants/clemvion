import type { Cafe24OperationMetadata } from './types.js';
import {
  CAFE24_DATE_FIELD_SINCE,
  CAFE24_DATE_FIELD_UNTIL,
} from './date-descriptions.js';

export const salesreportOperations: Cafe24OperationMetadata[] = [
  {
    id: 'salesreport_daily',
    description: 'Daily sales statistics for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'salesreport/sales',
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
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_products',
    description: 'Sales statistics grouped by product.',
    scopeType: 'read',
    method: 'GET',
    path: 'salesreport/products',
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
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_monthly',
    description:
      'Retrieve the monthly sales aggregate (financials/monthlysales).',
    scopeType: 'read',
    method: 'GET',
    path: 'financials/monthlysales',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_hourly',
    description: 'Retrieve hourly sales statistics across a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'reports/hourlysales',
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
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_volume',
    description: 'Retrieve a sales volume report for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'reports/salesvolume',
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
    responseShape: 'list',
    paginated: true,
  },
];
