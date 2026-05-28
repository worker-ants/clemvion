import type { Cafe24OperationMetadata } from './types.js';

export const supplyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'suppliers_list',
    description: 'List suppliers.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 6d — supply baselines
  {
    id: 'suppliers_count',
    description: 'Retrieve the count of suppliers.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_get',
    description: 'Retrieve a single supplier by supplier_code.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  // Phase 7g — Supply 완성 (suppliers CUD + suppliers_users CRUD + regional shipping + shipping_suppliers)
  {
    id: 'suppliers_create',
    description:
      'Register a new supplier. Body schema partial — refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'POST',
    path: 'suppliers',
    requiredFields: ['supplier_name'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      supplier_name: { type: 'string', location: 'body' },
      use_supplier: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_update',
    description:
      'Update an existing supplier (partial). Refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      supplier_name: { type: 'string', location: 'body' },
      use_supplier: { type: 'enum', location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_delete',
    description: 'Delete a supplier by supplier_code.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_list',
    description: 'List supplier user accounts.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/users',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      supplier_code: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'suppliers_users_count',
    description: 'Retrieve the count of supplier user accounts.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/users/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      supplier_code: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_get',
    description: 'Retrieve supplier user details by user_id.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/users/{user_id}',
    requiredFields: ['user_id'],
    fields: {
      user_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_create',
    description:
      'Create a supplier user account. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'suppliers/users',
    requiredFields: ['supplier_code', 'user_id'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      supplier_code: { type: 'string', location: 'body' },
      user_id: { type: 'string', location: 'body' },
      user_name: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_update',
    description: 'Update supplier user details (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'suppliers/users/{user_id}',
    requiredFields: ['user_id'],
    fields: {
      user_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      user_name: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_delete',
    description: 'Delete a supplier user by user_id.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'suppliers/users/{user_id}',
    requiredFields: ['user_id'],
    fields: {
      user_id: { type: 'string', location: 'path' },
    },
    responseShape: 'single',
  },
  // cafe24 docs path 의 regionalsurcharges 영역은 `{supplier_id}` placeholder
  // 를 사용 (supplier_users 단일 ops 와 다름 — same entity 지만 다른 placeholder
  // 이름. cafe24 API 의 inconsistency).
  {
    id: 'suppliers_users_regional_list',
    description: "Retrieve a supplier user's list of regional shipping fees.",
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers/users/{supplier_id}/regionalsurcharges',
    requiredFields: ['supplier_id'],
    fields: {
      supplier_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  {
    id: 'suppliers_users_regional_create',
    description:
      'Create regional shipping fee for a supplier user. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'suppliers/users/{supplier_id}/regionalsurcharges',
    requiredFields: ['supplier_id'],
    fields: {
      supplier_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_regional_delete',
    description:
      'Delete a specific regional shipping fee setting by regional_surcharge_no.',
    scopeType: 'write',
    method: 'DELETE',
    // cafe24 docs path: `suppliers/users/{supplier_id}/regionalsurcharges/
    // {regional_surcharge_no}` (per-row scope).
    path: 'suppliers/users/{supplier_id}/regionalsurcharges/{regional_surcharge_no}',
    requiredFields: ['supplier_id', 'regional_surcharge_no'],
    fields: {
      supplier_id: { type: 'string', location: 'path' },
      regional_surcharge_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_regional_settings_get',
    description: "Retrieve a supplier user's regional shipping fee settings.",
    scopeType: 'read',
    method: 'GET',
    // cafe24 docs path: `setting` (singular, not `settings`).
    path: 'suppliers/users/{supplier_id}/regionalsurcharges/setting',
    requiredFields: ['supplier_id'],
    fields: {
      supplier_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'suppliers_users_regional_settings_update',
    description:
      "Update a supplier user's regional shipping fee settings (partial).",
    scopeType: 'write',
    method: 'PUT',
    path: 'suppliers/users/{supplier_id}/regionalsurcharges/setting',
    requiredFields: ['supplier_id'],
    fields: {
      supplier_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'shipping_suppliers_get',
    description: "Retrieve a supplier's shipping settings.",
    scopeType: 'read',
    method: 'GET',
    path: 'shipping/suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'shipping_suppliers_update',
    description: "Update a supplier's shipping settings (partial).",
    scopeType: 'write',
    method: 'PUT',
    path: 'shipping/suppliers/{supplier_code}',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'shipping_suppliers_additionalfees_get',
    description:
      'Retrieve additional handling fees for supplier international shipping.',
    scopeType: 'read',
    method: 'GET',
    path: 'shipping/suppliers/{supplier_code}/additionalfees',
    requiredFields: ['supplier_code'],
    fields: {
      supplier_code: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
