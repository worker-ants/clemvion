import type { Cafe24OperationMetadata } from './types.js';
import { RESTRICTED_APPROVAL } from './restricted-approval.js';
import { CAFE24_DATE_FIELD_CREATED_START } from './date-descriptions.js';

export const privacyOperations: Cafe24OperationMetadata[] = [
  // cafe24 docs path: `customersprivacy` (concatenated, not `privacy/customers`).
  // Pre-2026-05-22 seed had `privacy/customers/*` which 404s — fixed to
  // match docs wire (`customersprivacy/*`).
  {
    id: 'customers_privacy_get',
    description:
      'Read sensitive personal data fields for a customer (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  // Phase 8f — Privacy 완성
  {
    id: 'customers_privacy_list',
    description:
      'Retrieve a list of customers with full PII filters (signup date, demographics, contact methods). Requires elevated privacy scope.',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      search_type: {
        type: 'enum',
        location: 'query',
        enum: ['customer_info', 'created_date'],
        default: 'customer_info',
        description:
          'Search mode. customer_info=profile-based, created_date=signup-date scan.',
      },
      created_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_START,
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Member id filter (max 20 chars)',
      },
      news_mail: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Newsletter opt-in (T=subscribed, F=not)',
      },
      sms: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'SMS opt-in (T=subscribed, F=not)',
      },
      thirdparty_agree: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Third-party sharing consent (T=agreed, F=not)',
      },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Member tier number filter',
      },
      search_field: {
        type: 'enum',
        location: 'query',
        enum: ['id', 'name', 'hp', 'tel', 'mail', 'shop_name'],
        description:
          'Search column. id, name, hp=mobile, tel=phone, mail, shop_name.',
      },
      keyword: {
        type: 'string',
        location: 'query',
        description: 'Search value for search_field (comma-separated)',
      },
      date_type: {
        type: 'enum',
        location: 'query',
        enum: ['join', 'login', 'age', 'account_reactivation', 'wedding'],
        description:
          'Date column anchoring start/end. join=signup, login, age=DOB, account_reactivation, wedding.',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range start (YYYY-MM-DD, KST). Pair with end_date.',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range end (YYYY-MM-DD, KST). Pair with start_date.',
      },
      member_type: {
        type: 'enum',
        location: 'query',
        enum: ['vip', 'poor', 'pointfy'],
        description:
          'Member type. vip=special-care, poor=blacklist, pointfy=integrated-membership.',
      },
      member_class: {
        type: 'enum',
        location: 'query',
        enum: ['p', 'c', 'f'],
        description: 'Member class. p=individual, c=business, f=foreigner.',
      },
      residence: {
        type: 'string',
        location: 'query',
        description: 'Residence area code (comma-separated)',
      },
      gender: {
        type: 'enum',
        location: 'query',
        enum: ['M', 'F'],
        description: 'Gender. M=male, F=female.',
      },
      member_authority: {
        type: 'enum',
        location: 'query',
        enum: ['C', 'P', 'A', 'S'],
        default: 'C',
        description:
          'Member authority. C=general, P=owner, A=sub-operator, S=supplier.',
      },
      join_path: {
        type: 'enum',
        location: 'query',
        enum: ['P', 'M'],
        description: 'Signup path. P=PC, M=mobile.',
      },
      use_mobile_app: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Mobile app usage (T=used, F=not)',
      },
      fixed_group: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Auto-tier-update lock (T=locked, F=not)',
      },
      is_simple_join: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Simple-checkout signup filter (T=include, F=not)',
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
    description:
      'Retrieve the count of customer privacy records (requires elevated scope).',
    scopeType: 'read',
    method: 'GET',
    path: 'customersprivacy/count',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      search_type: {
        type: 'enum',
        location: 'query',
        enum: ['customer_info', 'created_date'],
        default: 'customer_info',
        description:
          'Search mode. customer_info=profile-based, created_date=signup-date scan.',
      },
      created_start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_CREATED_START,
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Member id filter (max 20 chars)',
      },
      news_mail: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Newsletter opt-in (T=subscribed, F=not)',
      },
      sms: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'SMS opt-in (T=subscribed, F=not)',
      },
      thirdparty_agree: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Third-party sharing consent (T=agreed, F=not)',
      },
      group_no: {
        type: 'string',
        location: 'query',
        description: 'Member tier number filter',
      },
      search_field: {
        type: 'enum',
        location: 'query',
        enum: ['id', 'name', 'hp', 'tel', 'mail', 'shop_name'],
        description:
          'Search column. id, name, hp=mobile, tel=phone, mail, shop_name.',
      },
      keyword: {
        type: 'string',
        location: 'query',
        description: 'Search value for search_field (comma-separated)',
      },
      date_type: {
        type: 'enum',
        location: 'query',
        enum: ['join', 'login', 'age', 'account_reactivation', 'wedding'],
        description:
          'Date column anchoring start/end. join=signup, login, age=DOB, account_reactivation, wedding.',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range start (YYYY-MM-DD, KST). Pair with end_date.',
      },
      end_date: {
        type: 'string',
        location: 'query',
        description:
          'Search range end (YYYY-MM-DD, KST). Pair with start_date.',
      },
      member_type: {
        type: 'enum',
        location: 'query',
        enum: ['vip', 'poor', 'pointfy'],
        description:
          'Member type. vip=special-care, poor=blacklist, pointfy=integrated-membership.',
      },
      member_class: {
        type: 'enum',
        location: 'query',
        enum: ['p', 'c', 'f'],
        description: 'Member class. p=individual, c=business, f=foreigner.',
      },
      residence: {
        type: 'string',
        location: 'query',
        description: 'Residence area code (comma-separated)',
      },
      gender: {
        type: 'enum',
        location: 'query',
        enum: ['M', 'F'],
        description: 'Gender. M=male, F=female.',
      },
      member_authority: {
        type: 'enum',
        location: 'query',
        enum: ['C', 'P', 'A', 'S'],
        default: 'C',
        description:
          'Member authority. C=general, P=owner, A=sub-operator, S=supplier.',
      },
      join_path: {
        type: 'enum',
        location: 'query',
        enum: ['P', 'M'],
        description: 'Signup path. P=PC, M=mobile.',
      },
      use_mobile_app: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Mobile app usage (T=used, F=not)',
      },
      fixed_group: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Auto-tier-update lock (T=locked, F=not)',
      },
      is_simple_join: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        description: 'Simple-checkout signup filter (T=include, F=not)',
      },
    },
    constraints: [
      { kind: 'allOrNone', fields: ['start_date', 'end_date'] },
      { kind: 'allOrNone', fields: ['search_field', 'keyword'] },
    ],
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'customers_privacy_update',
    description:
      'Update a customer privacy record (partial). Refer to Cafe24 docs for full schema.',
    scopeType: 'write',
    method: 'PUT',
    path: 'customersprivacy/{member_id}',
    requiredFields: ['member_id'],
    fields: {
      member_id: { type: 'string', location: 'path' },
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      cellphone: {
        type: 'string',
        location: 'body',
        description: 'Mobile phone number',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Email address',
      },
      sms: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'SMS opt-in (T=subscribed, F=not)',
      },
      news_mail: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Newsletter opt-in (T=subscribed, F=not)',
      },
      thirdparty_agree: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Third-party sharing consent (T=agreed, F=not)',
      },
      birthday: {
        type: 'string',
        location: 'body',
        description: 'Birthday date (YYYY-MM-DD, KST)',
      },
      solar_calendar: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Calendar type (T=solar, F=lunar)',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Base address (max 255 chars)',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detail address (max 255 chars)',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Postal code (max 14 chars)',
      },
      recommend_id: {
        type: 'string',
        location: 'body',
        description: 'Referrer member id (max 20 chars)',
      },
      gender: {
        type: 'enum',
        location: 'body',
        enum: ['M', 'F'],
        description: 'Gender. M=male, F=female.',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Country code',
      },
      additional_information: {
        type: 'array',
        location: 'body',
        description: 'Additional key/value items',
      },
      city: {
        type: 'string',
        location: 'body',
        description: 'City (max 255 chars)',
      },
      state: {
        type: 'string',
        location: 'body',
        description: 'State/province (max 255 chars)',
      },
      refund_bank_code: {
        type: 'string',
        location: 'body',
        description: 'Refund bank code (max 20 chars)',
      },
      refund_bank_account_no: {
        type: 'string',
        location: 'body',
        description: 'Refund account number (max 40 chars)',
      },
      refund_bank_account_holder: {
        type: 'string',
        location: 'body',
        description: 'Refund account holder name',
      },
      fixed_group: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Auto-tier-update lock (T=locked, F=not)',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'products_wishlist_customers_list',
    description: 'List customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
  {
    id: 'products_wishlist_customers_count',
    description:
      'Retrieve the count of customers who have a given product in their wishlist.',
    scopeType: 'read',
    method: 'GET',
    path: 'products/{product_no}/wishlist/customers/count',
    requiredFields: ['product_no'],
    fields: {
      product_no: { type: 'number', location: 'path' },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.privacy,
  },
];
