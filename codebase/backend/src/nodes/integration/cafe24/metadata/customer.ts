import type { Cafe24OperationMetadata } from './types.js';

export const customerOperations: Cafe24OperationMetadata[] = [
  {
    id: 'customer_list',
    label: '회원 목록 조회',
    description: 'Search customers by member id or cellphone.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers',
    requiredFields: ['shop_no'],
    // cafe24 docs (Retrieve a list of customers, Latest 2026-03-01) 의 query
    // params 는 shop_no / cellphone / member_id 3종만 노출. 본문 박스:
    // "cellphone 또는 member_id 중 하나는 반드시 검색 조건으로 지정되어야 한다."
    // → `requiredFields` (AND) 로는 표현 불가한 OR 제약을 `constraints` 로 등재.
    // 회원의 광범위 검색 (이름·이메일·가입일 등) 은 별 endpoint
    // `customersprivacy_list` (privacy scope) 가 담당.
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      member_id: { type: 'string', location: 'query' },
      cellphone: { type: 'string', location: 'query' },
    },
    constraints: [{ kind: 'oneOf', fields: ['cellphone', 'member_id'] }],
    responseShape: 'list',
    paginated: true,
  },
  // ⚠ customer_get / customer_update — cafe24 admin docs (Latest 2026-03-01)
  // 는 `GET/PUT customers/{member_id}` 를 노출하지 않는다 (`DELETE` 만 문서화).
  // 본 row 들은 Phase 2 (2026-05-14) 시점에 seed 로 추가됐고 cafe24 wire 상
  // 실제 동작 여부 미확인. 운영 검증 / 제거 / 대체 (customer_list + filter)
  // 결정은 `plan/in-progress/cafe24-backlog-residual.md §G-2` 트랙에서 진행.
  {
    id: 'customer_get',
    label: '회원 단건 조회',
    description:
      'Get a single customer by member_id. ⚠ Not documented in cafe24 admin docs (Latest 2026-03-01); kept for backwards compatibility pending production verification.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_update',
    label: '회원 정보 수정',
    description:
      'Update customer profile fields. ⚠ Not documented in cafe24 admin docs (Latest 2026-03-01); kept for backwards compatibility pending production verification.',
    scopeType: 'write',
    method: 'PUT',
    path: 'customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      email: { type: 'string', location: 'body' },
      phone: { type: 'string', location: 'body' },
      sms: { type: 'enum', location: 'body', enum: ['T', 'F'] },
      news_mail: { type: 'enum', location: 'body', enum: ['T', 'F'] },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_group_update',
    label: '회원 등급 변경',
    description: 'Move a customer to a different customer tier.',
    scopeType: 'write',
    // cafe24 docs anchor `update-a-customer-s-customer-tier`: POST
    // customergroups/{group_no}/customers (NOT PUT customergroups/customers
    // — pre-2026-05-22 seed had legacy guess).
    method: 'POST',
    path: 'customergroups/{group_no}/customers',
    requiredFields: ['group_no', 'member_id'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      group_no: { type: 'number', location: 'path' },
      member_id: { type: 'string', location: 'body' },
      fixed_group: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description:
          'Lock this tier (T) so auto-tier-update does not change it. F=allow auto-update. Default F.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_create',
    label: '회원 메모 작성',
    description: 'Add a memo to a customer.',
    scopeType: 'write',
    method: 'POST',
    path: 'customers/{member_id}/memos',
    // cafe24 docs `create-a-customer-memo`: required = author_id + memo +
    // member_id. (Earlier seed mis-named `author` → `author_id`, `content` →
    // `memo` to match docs wire.)
    requiredFields: ['member_id', 'author_id', 'memo'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      author_id: {
        type: 'string',
        location: 'body',
        description: 'Admin id of the memo author.',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Memo body. HTML allowed.',
      },
      important_flag: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Mark as important (T) or normal (F). Default F.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_count',
    label: '회원 메모 개수 조회',
    description:
      'Retrieve the count of memos attached to a customer. Sibling of `customer_memos_list`.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos/count',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_list',
    label: '회원 메모 목록 조회',
    description:
      'List memos attached to a customer, filterable by date/importance/text.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — created_after filter. Naive ISO interpreted as KST.',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — created_before filter. Naive ISO interpreted as KST.',
      },
      important_flag: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by important flag (T=important, F=normal).',
      },
      memo: {
        type: 'string',
        location: 'query',
        description: 'Substring filter on memo body.',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customer_memos_get',
    label: '회원 메모 단건 조회',
    description: 'Get a single customer memo by `memo_no`.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/memos/{memo_no}',
    requiredFields: ['member_id', 'memo_no'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_update',
    label: '회원 메모 수정',
    description: 'Update an existing customer memo.',
    scopeType: 'write',
    method: 'PUT',
    path: 'customers/{member_id}/memos/{memo_no}',
    // cafe24 docs `update-a-customer-memo`: required = memo_no + member_id +
    // author_id. (Pre-2026-05-22 seed had memo_type / is_display / content
    // which cafe24 docs do not list — replaced with author_id / memo /
    // important_flag per docs wire.)
    requiredFields: ['member_id', 'memo_no', 'author_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
      author_id: {
        type: 'string',
        location: 'body',
        description: 'Admin id of the memo author (required for audit).',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Memo body. HTML allowed.',
      },
      important_flag: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Mark as important (T) or normal (F).',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_memos_delete',
    label: '회원 메모 삭제',
    description: 'Delete a customer memo by `memo_no`.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/memos/{memo_no}',
    requiredFields: ['member_id', 'memo_no'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      memo_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  // Phase 7b — Customer deep (paymentinfo / properties / groups / social)
  {
    id: 'customer_delete',
    label: '회원 탈퇴 처리',
    description: 'Delete a customer account by member_id.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
      is_point_check: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description:
          'Whether to delete customers who still have reward points. T=delete anyway, F=skip if points remain.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_autoupdate_get',
    label: '회원 등급 자동 갱신 조회',
    description:
      'Retrieve the auto-tier-update setting for a specific customer.',
    scopeType: 'read',
    method: 'GET',
    // cafe24 docs `retrieve-customer-tier-auto-update-details`: GET
    // customers/{member_id}/autoupdate (member-scoped — earlier seed path
    // `customers/autoupdate` was a guess).
    path: 'customers/{member_id}/autoupdate',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_paymentinfo_list',
    label: '회원 결제수단 목록',
    description: "List a customer's saved payment methods.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/paymentinformation',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
  },
  {
    id: 'customer_paymentinfo_delete',
    label: '회원 결제수단 삭제',
    description: 'Remove all saved payment information for a customer.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/paymentinformation',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_paymentinfo_delete_by_id',
    label: '회원 결제수단 ID 삭제',
    description: 'Remove a specific payment method from a customer.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'customers/{member_id}/paymentinformation/{payment_method_id}',
    requiredFields: ['member_id', 'payment_method_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      payment_method_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_plusapp_get',
    label: 'Plus 앱 설치 정보 조회',
    description: 'Retrieve Plus-app installation info for a customer.',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/plusapp',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customer_social_get',
    label: '소셜 계정 조회',
    description: "Retrieve a customer's linked social account.",
    scopeType: 'read',
    method: 'GET',
    path: 'customers/{member_id}/social',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customers_properties_view',
    label: '회원가입 필드 조회',
    description:
      'View configured signup/edit form fields for the mall (join or edit type).',
    scopeType: 'read',
    method: 'GET',
    path: 'customers/properties',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      type: {
        type: 'enum',
        location: 'query',
        enum: ['join', 'edit'],
        default: 'join',
        description:
          'Form variant — join=signup form fields, edit=profile-edit form fields.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customers_properties_edit',
    label: '회원가입 필드 수정',
    description: 'Edit the configured signup/edit form fields (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'customers/properties',
    requiredFields: ['type'],
    fields: {
      shop_no: { type: 'number', location: 'body', default: 1 },
      type: {
        type: 'enum',
        location: 'body',
        enum: ['join', 'edit'],
        description: 'Form variant — join=signup, edit=profile-edit.',
      },
      properties: {
        type: 'array',
        location: 'body',
        description:
          'Array of property objects to update. Shape determined by Cafe24 form schema.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'social_list',
    label: '소셜 연동 목록',
    description: 'List social-login integrations configured on the mall.',
    scopeType: 'read',
    method: 'GET',
    path: 'social',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      social_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by social provider name (e.g. naver, kakao).',
      },
      linked_start_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — linked_after filter. Naive ISO interpreted as KST.',
      },
      linked_end_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — linked_before filter. Naive ISO interpreted as KST.',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customergroups_list',
    label: '회원 등급 목록',
    description:
      'List customer tiers configured on the mall, filterable by tier id/name.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier number(s). Comma-separated for multi-id.',
      },
      group_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier name(s). Comma-separated.',
      },
    },
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'customergroups_count',
    label: '회원 등급 개수',
    description: 'Retrieve the count of configured customer tiers.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier number(s). Comma-separated.',
      },
      group_name: {
        type: 'string',
        location: 'query',
        description: 'Filter by tier name(s). Comma-separated.',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'customergroups_get',
    label: '회원 등급 단건 조회',
    description: 'Retrieve a customer tier by group_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/{group_no}',
    requiredFields: ['group_no'],
    fields: {
      group_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
  {
    id: 'customergroups_settings_get',
    label: '회원 등급 설정 조회',
    description: 'Retrieve mall-level customer tier settings.',
    scopeType: 'read',
    method: 'GET',
    path: 'customergroups/setting',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
  },
];
