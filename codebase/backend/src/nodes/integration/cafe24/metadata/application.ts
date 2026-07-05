/**
 * ⚠ Cafe24 "Application" API category — manages installed Cafe24 apps
 * (script tags, webhooks, databridge, etc.). **Unrelated to OAuth client
 * registration** (`credentials.app_type` in cafe24 Integration credentials)
 * and unrelated to the project-wide concept of "Application". Naming is
 * fixed by Cafe24 API and cannot be changed; refer to `spec/conventions/
 * cafe24-api-metadata.md §1` for the rationale.
 */
import type { Cafe24OperationMetadata } from './types.js';
import {
  CAFE24_DATE_FIELD_CREATED_START,
  CAFE24_DATE_FIELD_CREATED_END,
  CAFE24_DATE_FIELD_UPDATED_START,
  CAFE24_DATE_FIELD_UPDATED_END,
} from './date-descriptions.js';

export const applicationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'scripttags_list',
    description: 'List script tags injected by apps.',
    scopeType: 'read',
    method: 'GET',
    path: 'scripttags',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      script_no: {
        type: 'string',
        location: 'query',
        description: 'Script unique number(s) to search',
      },
      src: {
        type: 'string',
        location: 'query',
        description: 'Original script URL to search',
      },
      display_location: {
        type: 'string',
        location: 'query',
        description: 'Display location code(s), comma-separated multi-search',
      },
      exclude_path: {
        type: 'string',
        location: 'query',
        description: 'Excluded path(s), comma-separated multi-search',
      },
      skin_no: {
        type: 'string',
        location: 'query',
        description: 'Skin number(s), comma-separated multi-search',
      },
      integrity: {
        type: 'string',
        location: 'query',
        description: 'Sub-resource integrity hash',
      },
      created_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_START,
      },
      created_end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_END,
      },
      updated_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UPDATED_START,
      },
      updated_end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UPDATED_END,
      },
    },
    constraints: [
      {
        kind: 'allOrNone',
        fields: ['created_start_date', 'created_end_date'],
      },
      {
        kind: 'allOrNone',
        fields: ['updated_start_date', 'updated_end_date'],
      },
    ],
    responseShape: 'list',
  },
  // Phase 7d — Application (apps_update + scripttags CRUD + webhooks_update + logs)
  {
    id: 'apps_update',
    description: 'Update installed-app information (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'apps',
    requiredFields: [],
    fields: {
      version: {
        type: 'string',
        location: 'body',
        description: 'App version',
      },
      extension_type: {
        type: 'enum',
        location: 'body',
        enum: ['section', 'embedded'],
        description: 'Extension type (section=front HTML, embedded=auto-run)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_count',
    description: 'Retrieve the count of registered script tags.',
    scopeType: 'read',
    method: 'GET',
    path: 'scripttags/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      script_no: {
        type: 'string',
        location: 'query',
        description: 'Script unique number(s) to search',
      },
      src: {
        type: 'string',
        location: 'query',
        description: 'Original script URL to search',
      },
      display_location: {
        type: 'string',
        location: 'query',
        description: 'Display location code(s) to search',
      },
      skin_no: {
        type: 'string',
        location: 'query',
        description: 'Skin number(s), comma-separated multi-search',
      },
      created_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_START,
      },
      created_end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_END,
      },
      updated_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UPDATED_START,
      },
      updated_end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UPDATED_END,
      },
    },
    constraints: [
      {
        kind: 'allOrNone',
        fields: ['created_start_date', 'created_end_date'],
      },
      {
        kind: 'allOrNone',
        fields: ['updated_start_date', 'updated_end_date'],
      },
    ],
    responseShape: 'single',
  },
  {
    id: 'scripttags_get',
    description: 'Retrieve a script tag by script_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'scripttags/{script_no}',
    requiredFields: ['script_no'],
    fields: {
      script_no: {
        type: 'string',
        location: 'path',
        description: 'Script unique number',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_create',
    description: 'Register a new script tag.',
    scopeType: 'write',
    method: 'POST',
    path: 'scripttags',
    requiredFields: ['src', 'display_location'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      src: {
        type: 'string',
        location: 'body',
        description: 'Original absolute script URL',
      },
      display_location: {
        type: 'string',
        location: 'body',
        description: 'Display location code(s) (e.g. all, PRODUCT_LIST)',
      },
      exclude_path: {
        type: 'string',
        location: 'body',
        description: 'Excluded path(s)',
      },
      skin_no: {
        type: 'string',
        location: 'body',
        description: 'Skin number(s) to apply the script to',
      },
      integrity: {
        type: 'string',
        location: 'body',
        description: 'Sub-resource integrity hash (sha384/sha512)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_update',
    description: 'Update a script tag by script_no (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'scripttags/{script_no}',
    requiredFields: ['script_no'],
    fields: {
      script_no: {
        type: 'string',
        location: 'path',
        description: 'Script unique number',
      },
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      src: {
        type: 'string',
        location: 'body',
        description: 'Original absolute script URL',
      },
      display_location: {
        type: 'string',
        location: 'body',
        description: 'Display location code(s) (e.g. all, PRODUCT_LIST)',
      },
      exclude_path: {
        type: 'string',
        location: 'body',
        description: 'Excluded path(s)',
      },
      skin_no: {
        type: 'string',
        location: 'body',
        description: 'Skin number(s) to apply the script to',
      },
      integrity: {
        type: 'string',
        location: 'body',
        description: 'Sub-resource integrity hash (sha384/sha512)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_delete',
    description: 'Delete a script tag by script_no.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'scripttags/{script_no}',
    requiredFields: ['script_no'],
    fields: {
      script_no: {
        type: 'string',
        location: 'path',
        description: 'Script unique number',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'webhooks_update',
    description: 'Edit webhook settings (partial).',
    scopeType: 'write',
    method: 'PUT',
    // cafe24 docs path: `webhooks/setting` (settings endpoint — not bare
    // `webhooks` which docs does not define).
    path: 'webhooks/setting',
    requiredFields: [],
    fields: {
      reception_status: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Webhook reception status (T=enabled, F=disabled)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'webhooks_logs_list',
    description: 'List webhook delivery logs (delivered/failed history).',
    scopeType: 'read',
    method: 'GET',
    path: 'webhooks/logs',
    requiredFields: [],
    fields: {
      event_no: {
        type: 'number',
        location: 'query',
        description: 'Event number',
      },
      requested_start_date: {
        type: 'string',
        location: 'query',
        description:
          'Delivery range start (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-18".',
      },
      requested_end_date: {
        type: 'string',
        location: 'query',
        description:
          'Delivery range end (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-31".',
      },
      success: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Delivery success (T=success, F=fail)',
      },
      log_type: {
        type: 'enum',
        location: 'query',
        enum: ['G', 'R', 'T'],
        description: 'Log type (G=normal, R=resend, T=test)',
      },
      since_log_id: {
        type: 'string',
        location: 'query',
        description: 'Search after this log ID',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 8g — Application 완성 (appstore orders + payments + databridge + recipes)
  {
    id: 'appstore_orders_get',
    description: 'Retrieve a Cafe24 appstore order.',
    scopeType: 'read',
    method: 'GET',
    path: 'appstore/orders/{order_id}',
    requiredFields: ['order_id'],
    fields: {
      order_id: {
        type: 'string',
        location: 'path',
        description: 'Appstore order ID to retrieve',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'appstore_orders_create',
    description:
      'Create a Cafe24 appstore order. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'appstore/orders',
    requiredFields: [],
    fields: {
      order_name: {
        type: 'string',
        location: 'body',
        description: 'Order name shown to the payer',
      },
      order_amount: {
        type: 'string',
        location: 'body',
        description: 'Order amount to charge (decimal string, KRW)',
      },
      return_url: {
        type: 'string',
        location: 'body',
        description: 'Return URL after payment completion',
      },
      automatic_payment: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Recurring billing (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'appstore_payments_list',
    description: 'List Cafe24 appstore payments.',
    scopeType: 'read',
    method: 'GET',
    path: 'appstore/payments',
    requiredFields: [],
    fields: {
      order_id: {
        type: 'string',
        location: 'query',
        description: 'Appstore order number(s), comma-separated multi-search',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range start (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-18".',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range end (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-31".',
      },
      currency: {
        type: 'enum',
        location: 'query',
        enum: ['KRW', 'USD', 'JPY', 'PHP'],
        description: 'Currency (KRW/USD/JPY/PHP)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'appstore_payments_count',
    description: 'Retrieve the count of Cafe24 appstore payments.',
    scopeType: 'read',
    method: 'GET',
    path: 'appstore/payments/count',
    requiredFields: [],
    fields: {
      order_id: {
        type: 'string',
        location: 'query',
        description: 'Appstore order number(s), comma-separated multi-search',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range start (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-18".',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range end (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-31".',
      },
      currency: {
        type: 'enum',
        location: 'query',
        enum: ['KRW', 'USD', 'JPY', 'PHP'],
        description: 'Currency (KRW/USD/JPY/PHP)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'databridge_logs_list',
    description: 'List DataBridge webhook logs.',
    scopeType: 'read',
    method: 'GET',
    path: 'databridge/logs',
    requiredFields: [],
    fields: {
      requested_start_date: {
        type: 'string',
        location: 'query',
        description:
          'Delivery range start (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-18".',
      },
      requested_end_date: {
        type: 'string',
        location: 'query',
        description:
          'Delivery range end (YYYY-MM-DD, KST, UTC+9). e.g. "2026-05-31".',
      },
      success: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Delivery success (T=success, F=fail)',
      },
      since_log_id: {
        type: 'string',
        location: 'query',
        description: 'Search after this log ID',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'recipes_list',
    description: 'List recipes (DataBridge automation recipes).',
    scopeType: 'read',
    method: 'GET',
    path: 'recipes',
    requiredFields: [],
    fields: {},
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'recipes_create',
    description: 'Create a recipe. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'recipes',
    requiredFields: [],
    fields: {
      recipe_code: {
        type: 'string',
        location: 'body',
        description: 'Recipe code',
      },
      trigger_settings: {
        type: 'object',
        location: 'body',
        description: 'Trigger settings (required/optional filters)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'recipes_delete',
    description: 'Delete a recipe by recipe_code.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'recipes/{recipe_code}',
    requiredFields: ['recipe_code'],
    fields: {
      recipe_code: {
        type: 'string',
        location: 'path',
        description: 'Recipe code',
      },
    },
    responseShape: 'single',
  },
];
