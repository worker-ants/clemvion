import type { Cafe24OperationMetadata } from './types.js';
import {
  CAFE24_DATE_FIELD_SINCE,
  CAFE24_DATE_FIELD_UNTIL,
} from './date-descriptions.js';

export const orderOperations: Cafe24OperationMetadata[] = [
  {
    id: 'order_list',
    label: '주문 목록 조회',
    description:
      'List orders with filters by date range, status, payment method, etc.',
    scopeType: 'read',
    method: 'GET',
    path: 'orders',
    requiredFields: ['shop_no', 'start_date', 'end_date'],
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
      date_type: {
        type: 'enum',
        location: 'query',
        enum: ['order_date', 'pay_date', 'ship_date'],
        default: 'order_date',
      },
      order_status: {
        type: 'string',
        location: 'query',
        description: 'Comma-separated order status codes (e.g. "N00,N10")',
      },
      payment_method: { type: 'string', location: 'query' },
      member_id: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'order_get',
    label: '주문 단건 조회',
    description: 'Get a single order by order_id.',
    scopeType: 'read',
    method: 'GET',
    path: 'orders/{order_id}',
    requiredFields: ['order_id'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'order_items_list',
    label: '주문 상품 목록 조회',
    description: 'List items in an order.',
    scopeType: 'read',
    method: 'GET',
    path: 'orders/{order_id}/items',
    requiredFields: ['order_id'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  {
    id: 'order_shipments_create',
    label: '주문 배송 정보 등록',
    description:
      'Register shipping info (carrier, tracking number) for order items.',
    scopeType: 'write',
    method: 'POST',
    path: 'orders/{order_id}/shipments',
    requiredFields: ['order_id', 'shipping_company_code', 'tracking_no'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      shipping_company_code: { type: 'string', location: 'body' },
      tracking_no: { type: 'string', location: 'body' },
      status: {
        type: 'enum',
        location: 'body',
        enum: ['standby', 'shipping', 'shipped'],
        default: 'shipped',
      },
      items: {
        type: 'array',
        location: 'body',
        description: 'Array of `{ order_item_code, ... }`',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'order_buyer_update',
    label: '주문자 정보 수정',
    description: 'Update buyer information on an order.',
    scopeType: 'write',
    method: 'PUT',
    path: 'orders/{order_id}/buyer',
    requiredFields: ['order_id'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      name: { type: 'string', location: 'body' },
      phone: { type: 'string', location: 'body' },
      email: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'order_memos_create',
    label: '주문 메모 작성',
    description: 'Add a memo to an order.',
    scopeType: 'write',
    method: 'POST',
    path: 'orders/{order_id}/memos',
    requiredFields: ['order_id', 'author', 'content'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      author: { type: 'string', location: 'body' },
      content: { type: 'string', location: 'body' },
      fixed: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'order_count',
    label: '주문 개수 조회',
    description:
      'Retrieve a count of orders matching the supplied filter (status, payment status, date range).',
    scopeType: 'read',
    method: 'GET',
    path: 'orders/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      status: {
        type: 'string',
        location: 'query',
        description:
          'Order status filter (Cafe24 status codes, comma-separated)',
      },
      payment_status: {
        type: 'string',
        location: 'query',
        description: 'Payment status filter',
      },
      order_date_from: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      order_date_to: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'single',
  },
  {
    id: 'order_status_update',
    label: '주문 상태 변경',
    description:
      'Update the status of a single order. Path placeholder reuses the codebase-wide `order_id` naming (Cafe24 docs call this `order_no`).',
    scopeType: 'write',
    method: 'PUT',
    path: 'orders/{order_id}',
    requiredFields: ['order_id', 'status'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      status: {
        type: 'string',
        location: 'body',
        description:
          'New order status code. Allowed values depend on the mall workflow (e.g. N00, N10, N20, ...). See Cafe24 docs for the current status table.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'order_status_update_multiple',
    label: '주문 상태 일괄 변경',
    description:
      'Update the status of multiple orders at once. Returns HTTP 207 (Multi-Status) when individual orders have differing outcomes.',
    scopeType: 'write',
    method: 'PUT',
    path: 'orders/status',
    requiredFields: ['order_id', 'status'],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      order_id: {
        type: 'array',
        location: 'body',
        description:
          'Array of order ids to update (Cafe24 docs label this `order_no`). Each entry receives the same `status` change.',
      },
      status: {
        type: 'string',
        location: 'body',
        description:
          'New status applied to every order in the batch. See Cafe24 docs for valid status codes.',
      },
    },
    responseShape: 'list',
  },
  // Phase 6a — A/S 자동화 (cancellation / exchange / return / refund)
  {
    id: 'refunds_list',
    label: '환불 목록 조회',
    description: 'List refunds for the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'refunds',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: { type: 'string', location: 'query' },
      end_date: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'refunds_get',
    label: '환불 단건 조회',
    description: 'Retrieve a single refund by refund_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'refunds/{refund_no}',
    requiredFields: ['refund_no'],
    fields: {
      refund_no: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'cancellation_get',
    label: '취소 조회',
    description: 'Retrieve an order cancellation by cancellation_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'cancellation/{cancellation_no}',
    requiredFields: ['cancellation_no'],
    fields: {
      cancellation_no: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'cancellation_create_multiple',
    label: '취소 일괄 생성',
    description:
      'Bulk-create order cancellations. Pass `requests` as an array of cancellation request objects; see Cafe24 docs for the per-item schema. HTTP 207 when statuses vary by object.',
    scopeType: 'write',
    method: 'POST',
    path: 'cancellation',
    requiredFields: ['requests'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      requests: {
        type: 'array',
        location: 'body',
        description:
          'Array of cancellation request objects (order_id, items, reason, ...).',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'exchange_get',
    label: '교환 조회',
    description:
      'Retrieve exchange details for an order. Path placeholder reuses the codebase-wide `order_id` (Cafe24 docs label this `order_no`).',
    scopeType: 'read',
    method: 'GET',
    path: 'orders/exchange/{order_id}',
    requiredFields: ['order_id'],
    fields: {
      order_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'exchange_create_multiple',
    label: '교환 일괄 생성',
    description:
      'Bulk-create exchanges. Pass `requests` as an array — each entry typically carries order_id, exchange_item_no, product_no, variant_code, exchange_reason, exchange_quantity, shipping fees.',
    scopeType: 'write',
    method: 'POST',
    path: 'orders/exchanges',
    requiredFields: ['requests'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      requests: {
        type: 'array',
        location: 'body',
        description:
          'Array of exchange request objects. HTTP 207 when statuses vary by object.',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'return_get',
    label: '반품 조회',
    description: 'Retrieve a return by return_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'return/{return_no}',
    requiredFields: ['return_no'],
    fields: {
      return_no: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'return_create_multiple',
    label: '반품 일괄 생성',
    description:
      'Bulk-create order returns. Pass `requests` as an array of return-item objects (order_id, items, return reason, refund method).',
    scopeType: 'write',
    method: 'POST',
    path: 'return',
    requiredFields: ['requests'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      requests: {
        type: 'array',
        location: 'body',
        description:
          'Array of return request objects. HTTP 207 when individual items have differing outcomes.',
      },
    },
    responseShape: 'list',
  },
];
