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
  CAFE24_DATE_FIELD_SINCE,
  CAFE24_DATE_FIELD_UNTIL,
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
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
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
      shop_no: { type: 'number', location: 'body', default: 1 },
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
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
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
      script_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
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
      shop_no: { type: 'number', location: 'body', default: 1 },
      src: { type: 'string', location: 'body', description: 'Script URL' },
      display_location: {
        type: 'string',
        location: 'body',
        description: 'Comma-separated list of pages (e.g. all, product, order)',
      },
      exclude_path: { type: 'string', location: 'body' },
      skin_no: { type: 'array', location: 'body' },
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
      script_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      src: { type: 'string', location: 'body' },
      display_location: { type: 'string', location: 'body' },
      exclude_path: { type: 'string', location: 'body' },
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
      script_no: { type: 'number', location: 'path' },
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
      shop_no: { type: 'number', location: 'body', default: 1 },
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
  // Phase 8g — Application 완성 (appstore orders + payments + databridge + recipes)
  {
    id: 'appstore_orders_get',
    description: 'Retrieve a Cafe24 appstore order.',
    scopeType: 'read',
    method: 'GET',
    path: 'appstore/orders/{order_id}',
    requiredFields: ['order_id'],
    fields: {
      order_id: { type: 'string', location: 'path' },
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
      shop_no: { type: 'number', location: 'body', default: 1 },
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
    id: 'appstore_payments_count',
    description: 'Retrieve the count of Cafe24 appstore payments.',
    scopeType: 'read',
    method: 'GET',
    path: 'appstore/payments/count',
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
    id: 'recipes_list',
    description: 'List recipes (DataBridge automation recipes).',
    scopeType: 'read',
    method: 'GET',
    path: 'recipes',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'recipes_create',
    description: 'Create a recipe. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'recipes',
    requiredFields: ['recipe_name'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      recipe_name: { type: 'string', location: 'body' },
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
      recipe_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
];
