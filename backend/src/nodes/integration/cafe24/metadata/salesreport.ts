import type { Cafe24OperationMetadata } from './types.js';

export const salesreportOperations: Cafe24OperationMetadata[] = [
  {
    id: 'salesreport_daily',
    label: '일일 매출 통계',
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
        description: 'YYYY-MM-DD',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'YYYY-MM-DD',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_products',
    label: '상품별 매출 통계',
    description: 'Sales statistics grouped by product.',
    scopeType: 'read',
    method: 'GET',
    path: 'salesreport/products',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: { type: 'string', location: 'query' },
      end_date: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
];
