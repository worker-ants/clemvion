import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `customer` resource metadata.
 *
 * G-1 (field-set 전량 미러, 2026-07-05): field-set 을 공식 docs 카탈로그
 * (`spec/conventions/cafe24-api-catalog/customer/*.md` 의 각 operation
 * `요청 파라미터` 표)와 전량 미러했다. 필드명은 docs Parameter 를 그대로 사용한다 —
 * 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `requiredFields` 는 기존 계약(기존 ∩ 신규 fields)만 보존한다 (metadata.spec subset 불변식).
 * - date/time 필드 description 은 §5.2 (KST / YYYY-MM-DD 명시).
 *
 * op 목록(id/method/path/scope/description/responseShape/paginated)은 절대 바꾸지 않았다 —
 * fields / requiredFields / constraints 만 재작성했다.
 */
export const customerOperations: Cafe24OperationMetadata[] = [
  {
    id: 'customer_list',
    description: 'Search customers by member id or cellphone.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers',
    requiredFields: ['shop_no'],
    // cafe24 docs (Retrieve a list of customers): query params 는
    // shop_no / cellphone / member_id 3종만 노출. 본문 박스:
    // "cellphone 또는 member_id 중 하나는 반드시 검색 조건으로 지정되어야 한다."
    // → `requiredFields` (AND) 로는 표현 불가한 OR 제약을 `constraints` 로 등재.
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      cellphone: {
        type: 'string',
        location: 'query',
        description: 'Cellphone number(s), full number, comma-separated multi',
      },
      member_id: {
        type: 'string',
        location: 'query',
        description:
          'Member id(s), full id, comma-separated multi (max 20 chars)',
      },
    },
    constraints: [{ kind: 'oneOf', fields: ['cellphone', 'member_id'] }],
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customer_group_update',
    description: 'Move a customer to a different customer tier.',
    scopeType: 'write',
    method: 'POST',
    path: 'customergroups/{group_no}/customers',
    requiredFields: ['group_no', 'member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      group_no: {
        type: 'number',
        location: 'path',
        description: 'Customer tier number',
      },
      member_id: {
        type: 'string',
        location: 'body',
        description: 'Member id (max 20 chars)',
      },
      fixed_group: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Lock tier from auto-update (T=fixed, F=allow). Default F',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_create',
    description: 'Add a memo to a customer.',
    scopeType: 'write',
    method: 'POST',
    path: 'customers/{member_id}/memos',
    requiredFields: ['member_id', 'author_id', 'memo'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
      author_id: {
        type: 'string',
        location: 'body',
        description: 'Admin id of the memo author (max 20 chars)',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Memo body. HTML allowed',
      },
      important_flag: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Important memo (T=important, F=normal). Default F',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_count',
    description:
      'Retrieve the count of memos attached to a customer. Sibling of `customer_memos_list`.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos/count',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_list',
    description:
      'List memos attached to a customer, filterable by date/importance/text.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: 'Search range start date (YYYY-MM-DD, KST)',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: 'Search range end date (YYYY-MM-DD, KST)',
      },
      important_flag: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by important flag (T=important, F=normal)',
      },
      memo: {
        type: 'string',
        location: 'query',
        description: 'Filter by memo text',
      },
    },
    // cafe24 docs: start_date / end_date form a search range pair.
    constraints: [{ kind: 'allOrNone', fields: ['start_date', 'end_date'] }],
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customer_memos_get',
    description: 'Get a single customer memo by `memo_no`.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos/{memo_no}',
    requiredFields: ['member_id', 'memo_no'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      memo_no: {
        type: 'number',
        location: 'path',
        description: 'Memo number',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_update',
    description: 'Update an existing customer memo.',
    scopeType: 'write',
    method: 'PUT',
    path: 'customers/{member_id}/memos/{memo_no}',
    requiredFields: ['member_id', 'memo_no', 'author_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      memo_no: {
        type: 'number',
        location: 'path',
        description: 'Memo number',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
      author_id: {
        type: 'string',
        location: 'body',
        description: 'Admin id of the memo author (max 20 chars)',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Memo body. HTML allowed',
      },
      important_flag: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Important memo (T=important, F=normal)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_delete',
    description: 'Delete a customer memo by `memo_no`.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/memos/{memo_no}',
    requiredFields: ['member_id', 'memo_no'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      memo_no: {
        type: 'number',
        location: 'path',
        description: 'Memo number',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
    },
    responseShape: 'single',
  },
  // Phase 7b — Customer deep (paymentinfo / properties / groups / social)
  {
    id: 'customer_delete',
    description: 'Delete a customer account by member_id.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id (max 20 chars)',
      },
      is_point_check: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description:
          'Withdraw customers holding reward points (T=delete anyway, F=skip)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_autoupdate_get',
    description:
      'Retrieve the auto-tier-update setting for a specific customer.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/autoupdate',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id (max 20 chars)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_paymentinfo_list',
    description: "List a customer's saved payment methods.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/paymentinformation',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id (max 20 chars)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'customer_paymentinfo_delete',
    description: 'Remove all saved payment information for a customer.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/paymentinformation',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id (max 20 chars)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_paymentinfo_delete_by_id',
    description: 'Remove a specific payment method from a customer.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/paymentinformation/{payment_method_id}',
    requiredFields: ['member_id', 'payment_method_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id (max 20 chars)',
      },
      payment_method_id: {
        type: 'string',
        location: 'path',
        description: 'Subscription payment method id',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_plusapp_get',
    description: 'Retrieve Plus-app installation info for a customer.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/plusapp',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_social_get',
    description: "Retrieve a customer's linked social account.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/social',
    requiredFields: ['member_id'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'path',
        description: 'Member id',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customers_properties_view',
    description:
      'View configured signup/edit form fields for the mall (join or edit type).',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/properties',
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
        enum: ['join', 'edit'],
        default: 'join',
        description: 'Form variant (join=signup, edit=profile-edit)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customers_properties_edit',
    description: 'Edit the configured signup/edit form fields (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'customers/properties',
    requiredFields: ['type'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      type: {
        type: 'enum',
        location: 'body',
        enum: ['join', 'edit'],
        description: 'Form variant (join=signup, edit=profile-edit)',
      },
      properties: {
        type: 'array',
        location: 'body',
        description: 'Form field items (key + use + required)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'social_list',
    description: 'List social-login integrations configured on the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'social',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      social_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by linked SNS name',
      },
      linked_start_date: {
        type: 'string',
        location: 'query',
        description: 'Linked-date range start (YYYY-MM-DD, KST)',
      },
      linked_end_date: {
        type: 'string',
        location: 'query',
        description: 'Linked-date range end (YYYY-MM-DD, KST)',
      },
    },
    // cafe24 docs: linked_start_date / linked_end_date form a search range pair.
    constraints: [
      { kind: 'allOrNone', fields: ['linked_start_date', 'linked_end_date'] },
    ],
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customergroups_list',
    description:
      'List customer tiers configured on the mall, filterable by tier id/name.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier number(s), comma-separated multi',
      },
      group_name: {
        type: 'string',
        location: 'query',
        description:
          'Filter by tier name(s), comma-separated multi (max 20 chars)',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customergroups_count',
    description: 'Retrieve the count of configured customer tiers.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier number(s), comma-separated multi',
      },
      group_name: {
        type: 'string',
        location: 'query',
        description:
          'Filter by tier name(s), comma-separated multi (max 20 chars)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customergroups_get',
    description: 'Retrieve a customer tier by group_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/{group_no}',
    requiredFields: ['group_no'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      group_no: {
        type: 'number',
        location: 'path',
        description: 'Customer tier number',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customergroups_settings_get',
    description: 'Retrieve mall-level customer tier settings.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/setting',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
  },
];
