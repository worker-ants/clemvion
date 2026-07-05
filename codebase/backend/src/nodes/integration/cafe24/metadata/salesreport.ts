import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `salesreport` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md`, 2026-07-05): field-set 을 공식
 * docs 카탈로그(`spec/conventions/cafe24-api-catalog/salesreport/*.md` 요청 파라미터 표)와
 * 전량 미러. 필드명 docs-verbatim(비동작 alias 교체), offset/limit 제외(pagination 층
 * 주입), requiredFields = 기존 ∪ (docs-필수(✓) ∩ fields) — catalog-required-fields.spec
 * 가드. op id/method/path/scope/restrictedApproval 는 무변경.
 */
export const salesreportOperations: Cafe24OperationMetadata[] = [
  {
    id: 'salesreport_daily',
    description: 'Daily sales statistics for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'financials/dailysales',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      start_date: {
        type: 'string',
        location: 'query',
        description: 'Search start date (YYYY-MM-DD, KST)',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'Search end date (YYYY-MM-DD, KST)',
      },
      payment_gateway_name: {
        type: 'string',
        location: 'query',
        description: 'Payment gateway (PG) name',
      },
      partner_id: {
        type: 'string',
        location: 'query',
        description: 'PG-issued merchant ID',
      },
      payment_method: {
        type: 'enum',
        location: 'query',
        enum: ['card', 'tcash', 'icash', 'point', 'cell'],
        description: 'Payment method (card/tcash/icash/point/cell)',
      },
    },
    constraints: [{ kind: 'allOrNone', fields: ['start_date', 'end_date'] }],
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'salesreport_products',
    description: 'Sales statistics grouped by product.',
    scopeType: 'read',
    method: 'GET',
    path: 'reports/productsales',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: 'Search start date (YYYY-MM-DD, KST)',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'Search end date (YYYY-MM-DD, KST)',
      },
      collection_hour: {
        type: 'string',
        location: 'query',
        description: 'Settlement collection hour (00-23)',
      },
    },
    constraints: [{ kind: 'allOrNone', fields: ['start_date', 'end_date'] }],
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
    requiredFields: ['start_month', 'end_month'],
    fields: {
      start_month: {
        type: 'string',
        location: 'query',
        description: 'Search start month (YYYY-MM, KST)',
      },
      end_month: {
        type: 'string',
        location: 'query',
        description: 'Search end month (YYYY-MM, KST)',
      },
      payment_gateway_name: {
        type: 'string',
        location: 'query',
        description: 'Payment gateway (PG) name',
      },
      partner_id: {
        type: 'string',
        location: 'query',
        description: 'PG-issued merchant ID',
      },
      payment_method: {
        type: 'enum',
        location: 'query',
        enum: ['card', 'tcash', 'icash', 'point', 'cell'],
        description: 'Payment method (card/tcash/icash/point/cell)',
      },
    },
    constraints: [{ kind: 'allOrNone', fields: ['start_month', 'end_month'] }],
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: 'Search start date (YYYY-MM-DD, KST)',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'Search end date (YYYY-MM-DD, KST)',
      },
      collection_hour: {
        type: 'string',
        location: 'query',
        description: 'Settlement collection hour (00-23)',
      },
    },
    constraints: [{ kind: 'allOrNone', fields: ['start_date', 'end_date'] }],
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      product_no: {
        type: 'string',
        location: 'query',
        description: 'Product number(s), comma-separated multi-search',
      },
      variants_code: {
        type: 'string',
        location: 'query',
        description: 'Variant code to query',
      },
      category_no: {
        type: 'number',
        location: 'query',
        description: 'Category number',
      },
      mobile: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Mobile-only sales (T: mobile, F: other)',
      },
      delivery_type: {
        type: 'enum',
        location: 'query',
        enum: ['A', 'B'],
        description: 'Delivery type (A: domestic, B: overseas)',
      },
      group_no: {
        type: 'number',
        location: 'query',
        description: 'Member group number',
      },
      supplier_id: {
        type: 'string',
        location: 'query',
        description: 'Supplier ID (max 20 chars)',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: 'Search start date (YYYY-MM-DD, KST)',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'Search end date (YYYY-MM-DD, KST)',
      },
    },
    constraints: [
      { kind: 'oneOf', fields: ['product_no', 'variants_code'] },
      { kind: 'allOrNone', fields: ['start_date', 'end_date'] },
    ],
    responseShape: 'list',
    paginated: true,
  },
];
