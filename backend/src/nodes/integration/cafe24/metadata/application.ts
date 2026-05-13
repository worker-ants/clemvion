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
];
