/**
 * ⚠ Cafe24 "Application" API category — manages installed Cafe24 apps
 * (script tags, webhooks, databridge, etc.). **Unrelated to OAuth client
 * registration** (`credentials.app_type` in cafe24 Integration credentials)
 * and unrelated to the project-wide concept of "Application". Naming is
 * fixed by Cafe24 API and cannot be changed; refer to `spec/conventions/
 * cafe24-api-metadata.md §1` for the rationale.
 */
import type { Cafe24OperationMetadata } from './types.js';

export const applicationOperations: Cafe24OperationMetadata[] = [
  {
    id: 'applications_list',
    label: '설치된 앱 목록 조회',
    description: 'List apps installed in the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'applications',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'scripttags_list',
    label: '스크립트태그 목록 조회',
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
  {
    id: 'webhooks_list',
    label: 'Webhook 설정 조회',
    description: 'List webhook subscriptions configured for the app.',
    scopeType: 'read',
    method: 'GET',
    path: 'webhooks',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  // Phase 7d — Application (apps_update + scripttags CRUD + webhooks_update + logs)
  {
    id: 'apps_update',
    label: '앱 정보 수정',
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
    label: '스크립트태그 개수 조회',
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
    label: '스크립트태그 단건 조회',
    description: 'Retrieve a script tag by tag_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'scripttags/{tag_no}',
    requiredFields: ['tag_no'],
    fields: {
      tag_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_create',
    label: '스크립트태그 생성',
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
    label: '스크립트태그 수정',
    description: 'Update a script tag by tag_no (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'scripttags/{tag_no}',
    requiredFields: ['tag_no'],
    fields: {
      tag_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      src: { type: 'string', location: 'body' },
      display_location: { type: 'string', location: 'body' },
      exclude_path: { type: 'string', location: 'body' },
    },
    responseShape: 'single',
  },
  {
    id: 'scripttags_delete',
    label: '스크립트태그 삭제',
    description: 'Delete a script tag by tag_no.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'scripttags/{tag_no}',
    requiredFields: ['tag_no'],
    fields: {
      tag_no: { type: 'number', location: 'path' },
    },
    responseShape: 'single',
  },
  {
    id: 'webhooks_update',
    label: 'Webhook 설정 수정',
    description: 'Update webhook subscriptions (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'webhooks',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'webhooks_logs_list',
    label: 'Webhook 로그 목록',
    description: 'List webhook delivery logs (delivered/failed history).',
    scopeType: 'read',
    method: 'GET',
    path: 'webhooks/logs',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: { type: 'string', location: 'query' },
      end_date: { type: 'string', location: 'query' },
    },
    responseShape: 'list',
    paginated: true,
  },
];
