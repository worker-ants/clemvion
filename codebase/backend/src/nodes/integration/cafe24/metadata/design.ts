import type { Cafe24OperationMetadata } from './types.js';

export const designOperations: Cafe24OperationMetadata[] = [
  {
    id: 'themes_list',
    description: 'List installed themes.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  // Phase 8i — Design 완성 (themes count/get + theme_pages CRUD + icons)
  {
    id: 'themes_count',
    description: 'Retrieve the count of installed themes.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'themes_get',
    description: 'Retrieve a single theme by skin_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes/{skin_no}',
    requiredFields: ['skin_no'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_get',
    description: 'Retrieve theme page contents (HTML/CSS).',
    scopeType: 'read',
    method: 'GET',
    path: 'themes/{skin_no}/pages/{page_path}',
    requiredFields: ['skin_no', 'page_path'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      page_path: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_create',
    description:
      'Create a theme page. Body schema partial — refer to Cafe24 docs.',
    scopeType: 'write',
    method: 'POST',
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no', 'page_path'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      page_path: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_update',
    description:
      'Update theme page contents (partial). Page identifier goes in body.',
    scopeType: 'write',
    method: 'PUT',
    // cafe24 docs path: `themes/{skin_no}/pages` (page identifier travels
    // in body, not path).
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no', 'page_path'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      page_path: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_delete',
    description: 'Delete a theme page. Page identifier goes in query.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no', 'page_path'],
    fields: {
      skin_no: { type: 'number', location: 'path' },
      page_path: { type: 'string', location: 'query' },
    },
    responseShape: 'single',
  },
  {
    id: 'icons_list',
    description: 'List storefront design icons (new/best/sale badges, etc.).',
    scopeType: 'read',
    method: 'GET',
    path: 'icons',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  {
    id: 'icons_update_settings',
    description:
      'Update storefront icon settings (partial). Refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'icons',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
];
