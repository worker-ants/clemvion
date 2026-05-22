import type { Cafe24OperationMetadata } from './types.js';
import { RESTRICTED_APPROVAL } from './restricted-approval.js';

export const privacyOperations: Cafe24OperationMetadata[] = [
  // cafe24 docs path: `customersprivacy` (concatenated, not `privacy/customers`).
  // Pre-2026-05-22 seed had `privacy/customers/*` which 404s — fixed to
  // match docs wire (`customersprivacy/*`).
  {
    id: 'customers_privacy_get',
    label: '회원 개인정보 조회',
    description:
      'Read sensitive personal data fields for a customer (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  // Phase 8f — Privacy 완성
  {
    id: 'customers_privacy_list',
    label: '회원 개인정보 목록 조회',
    description:
      'Retrieve a list of customers with full PII filters (signup date, demographics, contact methods). Requires elevated privacy scope.',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy',
    requiredFields: [],
    // cafe24 docs `retrieve-a-list-of-customer-information` 본문:
    // - search_type=created_date 시 created_start_date 외 모든 검색조건 사용 불가 (complex implies — runtime guard 만)
    // - start_date / end_date 는 짝으로 사용 (allOrNone)
    // - search_field 와 keyword 는 짝 (search_field 가 검색 대상 컬럼, keyword 가 값)
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
      search_type: {
        type: 'enum',
        location: 'query',
        enum: ['customer_info', 'created_date'],
        default: 'customer_info',
        description:
          'customer_info=profile-based filter, created_date=signup-date-based bulk scan.',
      },
      created_start_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — when search_type=created_date, the signup-date floor. Naive ISO interpreted as KST.',
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Filter by member id (substring).',
      },
      news_mail: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by newsletter opt-in (T=subscribed).',
      },
      sms: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by SMS opt-in (T=subscribed).',
      },
      thirdparty_agree: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by third-party data-sharing consent (T=agreed).',
      },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Filter by customer tier number(s). Comma-separated.',
      },
      search_field: {
        type: 'enum',
        location: 'query',
        enum: ['id', 'name', 'hp', 'tel', 'mail', 'shop_name'],
        description:
          'Profile field to search by keyword (id, name, mobile, phone, mail, shop_name). Must be paired with `keyword`.',
      },
      keyword: {
        type: 'string',
        location: 'query',
        description:
          'Search value for `search_field`. Comma-separated for multiple values.',
      },
      date_type: {
        type: 'enum',
        location: 'query',
        enum: ['join', 'login', 'age', 'account_reactivation', 'wedding'],
        description:
          'Date column anchoring start_date/end_date: join=signup, login=last login, age=DOB, account_reactivation=dormant-clear, wedding=anniversary.',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — date_type-anchored search floor. Naive ISO interpreted as KST. Must be paired with end_date.',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'ISO8601 date (KST, UTC+9) — date_type-anchored search ceiling. Must be paired with start_date.',
      },
      member_type: {
        type: 'enum',
        location: 'query',
        enum: ['vip', 'poor', 'pointfy'],
        description:
          'Member classification: vip=special-care, poor=blacklist, pointfy=integrated-membership.',
      },
      member_class: {
        type: 'string',
        location: 'query',
        description: 'Member class filter (Cafe24-defined enum).',
      },
      residence: {
        type: 'string',
        location: 'query',
        description: 'Residence area filter.',
      },
      gender: {
        type: 'enum',
        location: 'query',
        enum: ['M', 'F'],
        description: 'Filter by gender.',
      },
      member_authority: {
        type: 'string',
        location: 'query',
        description: 'Filter by member authority (Cafe24-defined enum).',
      },
      join_path: {
        type: 'string',
        location: 'query',
        description: 'Filter by signup path (Cafe24-defined enum).',
      },
      use_mobile_app: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by mobile app usage.',
      },
      fixed_group: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Filter by auto-tier-update lock (T=locked).',
      },
      is_simple_join: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description:
          'Filter by simple-checkout-only signups (T=include simple-join).',
      },
    },
    constraints: [
      { kind: 'allOrNone', fields: ['start_date', 'end_date'] },
      { kind: 'allOrNone', fields: ['search_field', 'keyword'] },
    ],
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'customers_privacy_count',
    label: '회원 개인정보 개수 조회',
    description:
      'Retrieve the count of customer privacy records (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy/count',
    requiredFields: [],
    fields: {
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'customers_privacy_update',
    label: '회원 개인정보 수정',
    description:
      'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'customersprivacy/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: { type: 'number', location: 'body', default: 1 },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'products_wishlist_customers_list',
    label: '위시리스트 보유 회원 목록',
    description: 'List customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'products_wishlist_customers_count',
    label: '위시리스트 보유 회원 수',
    description:
      'Retrieve the count of customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: { type: 'number', location: 'query', default: 1 },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
];
