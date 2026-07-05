import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `design` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md`): field-set 을 공식 docs
 * 카탈로그(`spec/conventions/cafe24-api-catalog/design/*.md` 의 각 operation
 * `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를 그대로
 * 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지
 * 못한다. 이 과정에서 과거 비동작 alias(`page_path` → docs `path`)를 docs 명으로
 * 교체했다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `requiredFields` 는 기존 계약 ∩ 신규 fields keys 로 좁힌다 (metadata.spec subset 불변식).
 */
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
      type: {
        type: 'enum',
        location: 'query',
        default: 'pc',
        enum: ['pc', 'mobile'],
        description: 'Design type (pc: PC, mobile: mobile)',
      },
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
      type: {
        type: 'enum',
        location: 'query',
        default: 'pc',
        enum: ['pc', 'mobile'],
        description: 'Design type (pc: PC, mobile: mobile)',
      },
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
      skin_no: {
        type: 'number',
        location: 'path',
        description: 'Design number',
      },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_get',
    // docs: GET themes/{skin_no}/pages 는 `path` (query, 필수) 로 단건 페이지를 식별한다
    // (컬렉션 경로지만 path 쿼리로 single 반환). 과거 `{page_path}` path-param 은 오기였음.
    description: 'Retrieve theme page contents (HTML/CSS) by file path.',
    scopeType: 'read',
    method: 'GET',
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no', 'path'],
    fields: {
      skin_no: {
        type: 'number',
        location: 'path',
        description: 'Design number',
      },
      path: { type: 'string', location: 'query', description: 'File path' },
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
    requiredFields: ['skin_no'],
    fields: {
      skin_no: {
        type: 'number',
        location: 'path',
        description: 'Design number',
      },
      path: {
        type: 'string',
        location: 'body',
        description: 'File/directory path',
      },
      source: { type: 'string', location: 'body', description: 'Source code' },
      display_location: {
        type: 'string',
        location: 'body',
        description: 'Screen classification',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_update',
    description:
      'Update theme page contents (partial). Page identifier goes in body.',
    scopeType: 'write',
    // cafe24 docs path: `themes/{skin_no}/pages` (page identifier travels
    // in body, not path).
    method: 'PUT',
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no'],
    fields: {
      skin_no: {
        type: 'number',
        location: 'path',
        description: 'Design number',
      },
      path: { type: 'string', location: 'body', description: 'File path' },
      source: { type: 'string', location: 'body', description: 'Source code' },
    },
    responseShape: 'single',
  },
  {
    id: 'theme_pages_delete',
    description: 'Delete a theme page. Page identifier goes in query.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'themes/{skin_no}/pages',
    requiredFields: ['skin_no'],
    fields: {
      skin_no: {
        type: 'number',
        location: 'path',
        description: 'Design number',
      },
      path: { type: 'string', location: 'query', description: 'File path' },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      type: {
        type: 'enum',
        location: 'query',
        default: 'pc',
        enum: ['pc', 'mobile'],
        description: 'Design type (pc: PC, mobile: mobile)',
      },
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
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      id: {
        type: 'number',
        location: 'body',
        description: 'Icon id',
      },
      group_code: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'B', 'C', 'E'],
        description: 'Group code (A: product, B: board, C: card, E: event)',
      },
      type: {
        type: 'enum',
        location: 'body',
        default: 'pc',
        enum: ['pc', 'mobile'],
        description: 'Design type (pc: PC, mobile: mobile)',
      },
      path: { type: 'string', location: 'body', description: 'Icon URL' },
      display: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Icon exposure (T: shown, F: hidden)',
      },
    },
    responseShape: 'single',
  },
];
