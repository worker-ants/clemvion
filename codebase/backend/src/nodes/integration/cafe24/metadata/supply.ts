import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `supply` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md`, 2026-07-05): field-set 을 공식
 * docs 카탈로그(`spec/conventions/cafe24-api-catalog/supply/*.md` 요청 파라미터 표)와
 * 전량 미러. 필드명 docs-verbatim(비동작 alias 교체), offset/limit 제외(pagination 층
 * 주입), requiredFields = 기존 ∪ (docs-필수(✓) ∩ fields) — catalog-required-fields.spec
 * 가드. op id/method/path/scope/restrictedApproval 는 무변경.
 */
export const supplyOperations: Cafe24OperationMetadata[] = [
  {
    id: 'suppliers_list',
    description: 'List suppliers.',
    scopeType: 'read',
    method: 'GET',
    path: 'suppliers',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_code: {
        type: 'string',
        location: 'query',
        description: 'Supplier code(s), comma-separated multi-search',
      },
      supplier_name: {
        type: 'string',
        location: 'query',
        description: 'Supplier name, comma-separated multi-search',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_code: {
        type: 'string',
        location: 'query',
        description: 'Supplier code(s), comma-separated multi-search',
      },
      supplier_name: {
        type: 'string',
        location: 'query',
        description: 'Supplier name, comma-separated multi-search',
      },
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
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier code',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
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
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_name: {
        type: 'string',
        location: 'body',
        description: 'Supplier name',
      },
      manager_information: {
        type: 'array',
        location: 'body',
        description: 'Manager contacts (max 3)',
      },
      use_supplier: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Use supplier (T=on, F=off)',
      },
      trading_type: {
        type: 'enum',
        location: 'body',
        enum: ['D', 'C'],
        default: 'D',
        description: 'Supply type (D=purchase, C=direct-ship)',
      },
      supplier_type: {
        type: 'enum',
        location: 'body',
        enum: ['WS', 'SF', 'BS', 'ET'],
        default: 'WS',
        description:
          'Supplier structure (WS=wholesale, SF=buy-in, BS=tenant, ET=etc)',
      },
      status: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'P', 'N'],
        default: 'A',
        description: 'Status (A=trading, P=suspended, N=terminated)',
      },
      business_item: {
        type: 'string',
        location: 'body',
        description: 'Trading item type',
      },
      payment_type: {
        type: 'enum',
        location: 'body',
        enum: ['P', 'D'],
        default: 'P',
        description: 'Settlement type (P=commission, D=purchase)',
      },
      payment_period: {
        type: 'enum',
        location: 'body',
        enum: ['0', 'C', 'B', 'A'],
        default: '0',
        description: 'Settlement cycle (0=none, C=daily, B=weekly, A=monthly)',
      },
      payment_method: {
        type: 'enum',
        location: 'body',
        enum: ['10', '30', '40'],
        description: 'Settlement timing (10=paid, 30=ship-start, 40=ship-done)',
      },
      payment_start_day: {
        type: 'number',
        location: 'body',
        description: 'Settlement start weekday (0=Sun..6=Sat)',
      },
      payment_end_day: {
        type: 'number',
        location: 'body',
        description: 'Settlement end weekday (0=Sun..6=Sat)',
      },
      payment_start_date: {
        type: 'number',
        location: 'body',
        description: 'Settlement start day of month (1-31)',
      },
      payment_end_date: {
        type: 'number',
        location: 'body',
        description: 'Settlement end day of month (1-31)',
      },
      commission: {
        type: 'string',
        location: 'body',
        default: 10,
        description: 'Commission rate (decimal string, KRW)',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Business phone number',
      },
      fax: {
        type: 'string',
        location: 'body',
        description: 'Business fax number',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Business address country code',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Business address zipcode',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Business base address',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Business detail address',
      },
      market_country_code: {
        type: 'string',
        location: 'body',
        description: 'Market address country code',
      },
      market_zipcode: {
        type: 'string',
        location: 'body',
        description: 'Market address zipcode',
      },
      market_address1: {
        type: 'string',
        location: 'body',
        description: 'Market base address',
      },
      market_address2: {
        type: 'string',
        location: 'body',
        description: 'Market detail address',
      },
      exchange_country_code: {
        type: 'string',
        location: 'body',
        description: 'Return address country code',
      },
      exchange_zipcode: {
        type: 'string',
        location: 'body',
        description: 'Return address zipcode',
      },
      exchange_address1: {
        type: 'string',
        location: 'body',
        description: 'Return base address',
      },
      exchange_address2: {
        type: 'string',
        location: 'body',
        description: 'Return detail address',
      },
      homepage_url: {
        type: 'string',
        location: 'body',
        description: 'Homepage URL',
      },
      mall_url: {
        type: 'string',
        location: 'body',
        description: 'Mall URL',
      },
      account_start_date: {
        type: 'string',
        location: 'body',
        description: 'Trade start date (YYYY-MM-DD, KST)',
      },
      account_stop_date: {
        type: 'string',
        location: 'body',
        description: 'Trade stop date (YYYY-MM-DD, KST)',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Admin memo',
      },
      company_registration_no: {
        type: 'string',
        location: 'body',
        description: 'Business registration number',
      },
      company_name: {
        type: 'string',
        location: 'body',
        description: 'Company name',
      },
      president_name: {
        type: 'string',
        location: 'body',
        description: 'Representative name',
      },
      company_condition: {
        type: 'string',
        location: 'body',
        description: 'Business category (업태)',
      },
      company_line: {
        type: 'string',
        location: 'body',
        description: 'Business item (종목)',
      },
      company_introduction: {
        type: 'string',
        location: 'body',
        description: 'Company introduction',
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
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier code',
      },
      supplier_name: {
        type: 'string',
        location: 'body',
        description: 'Supplier name',
      },
      use_supplier: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Use supplier (T=on, F=off)',
      },
      trading_type: {
        type: 'enum',
        location: 'body',
        enum: ['D', 'C'],
        description: 'Supply type (D=purchase, C=direct-ship)',
      },
      supplier_type: {
        type: 'enum',
        location: 'body',
        enum: ['WS', 'SF', 'BS', 'ET'],
        description:
          'Supplier structure (WS=wholesale, SF=buy-in, BS=tenant, ET=etc)',
      },
      status: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'P', 'N'],
        description: 'Status (A=trading, P=suspended, N=terminated)',
      },
      payment_type: {
        type: 'enum',
        location: 'body',
        enum: ['P', 'D'],
        description: 'Settlement type (P=commission, D=purchase)',
      },
      payment_period: {
        type: 'enum',
        location: 'body',
        enum: ['0', 'C', 'B', 'A'],
        description: 'Settlement cycle (0=none, C=daily, B=weekly, A=monthly)',
      },
      commission: {
        type: 'string',
        location: 'body',
        description: 'Commission rate (decimal string, KRW)',
      },
      manager_information: {
        type: 'array',
        location: 'body',
        description: 'Manager contacts (max 3)',
      },
      business_item: {
        type: 'string',
        location: 'body',
        description: 'Trading item type',
      },
      payment_method: {
        type: 'enum',
        location: 'body',
        enum: ['10', '30', '40'],
        description: 'Settlement timing (10=paid, 30=ship-start, 40=ship-done)',
      },
      payment_start_day: {
        type: 'number',
        location: 'body',
        description: 'Settlement start weekday (0=Sun..6=Sat)',
      },
      payment_end_day: {
        type: 'number',
        location: 'body',
        description: 'Settlement end weekday (0=Sun..6=Sat)',
      },
      payment_start_date: {
        type: 'number',
        location: 'body',
        description: 'Settlement start day of month (1-31)',
      },
      payment_end_date: {
        type: 'number',
        location: 'body',
        description: 'Settlement end day of month (1-31)',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Business phone number',
      },
      fax: {
        type: 'string',
        location: 'body',
        description: 'Business fax number',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Business address country code',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Business address zipcode',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Business base address',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Business detail address',
      },
      market_country_code: {
        type: 'string',
        location: 'body',
        description: 'Market address country code',
      },
      market_zipcode: {
        type: 'string',
        location: 'body',
        description: 'Market address zipcode',
      },
      market_address1: {
        type: 'string',
        location: 'body',
        description: 'Market base address',
      },
      market_address2: {
        type: 'string',
        location: 'body',
        description: 'Market detail address',
      },
      exchange_country_code: {
        type: 'string',
        location: 'body',
        description: 'Return address country code',
      },
      exchange_zipcode: {
        type: 'string',
        location: 'body',
        description: 'Return address zipcode',
      },
      exchange_address1: {
        type: 'string',
        location: 'body',
        description: 'Return base address',
      },
      exchange_address2: {
        type: 'string',
        location: 'body',
        description: 'Return detail address',
      },
      homepage_url: {
        type: 'string',
        location: 'body',
        description: 'Homepage URL',
      },
      mall_url: {
        type: 'string',
        location: 'body',
        description: 'Mall URL',
      },
      account_start_date: {
        type: 'string',
        location: 'body',
        description: 'Trade start date (YYYY-MM-DD, KST)',
      },
      account_stop_date: {
        type: 'string',
        location: 'body',
        description: 'Trade stop date (YYYY-MM-DD, KST)',
      },
      memo: {
        type: 'string',
        location: 'body',
        description: 'Admin memo',
      },
      company_registration_no: {
        type: 'string',
        location: 'body',
        description: 'Business registration number',
      },
      company_name: {
        type: 'string',
        location: 'body',
        description: 'Company name',
      },
      president_name: {
        type: 'string',
        location: 'body',
        description: 'Representative name',
      },
      company_condition: {
        type: 'string',
        location: 'body',
        description: 'Business category (업태)',
      },
      company_line: {
        type: 'string',
        location: 'body',
        description: 'Business item (종목)',
      },
      company_introduction: {
        type: 'string',
        location: 'body',
        description: 'Company introduction',
      },
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
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier code',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      user_id: {
        type: 'string',
        location: 'query',
        description: 'Supplier user login ID',
      },
      supplier_code: {
        type: 'string',
        location: 'query',
        description: 'Supplier code',
      },
      supplier_name: {
        type: 'string',
        location: 'query',
        description: 'Supplier name',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      user_id: {
        type: 'string',
        location: 'query',
        description: 'Supplier user login ID',
      },
      supplier_code: {
        type: 'string',
        location: 'query',
        description: 'Supplier code',
      },
      supplier_name: {
        type: 'string',
        location: 'query',
        description: 'Supplier name',
      },
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
      user_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user login ID',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
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
    requiredFields: [
      'supplier_code',
      'user_id',
      'password',
      'permission_shop_no',
    ],
    fields: {
      user_id: {
        type: 'string',
        location: 'body',
        description: 'Supplier user login ID',
      },
      supplier_code: {
        type: 'string',
        location: 'body',
        description: 'Supplier code',
      },
      user_name: {
        type: 'array',
        location: 'body',
        description: 'Supplier user name per shop',
      },
      nick_name: {
        type: 'array',
        location: 'body',
        description: 'Nickname per shop',
      },
      password: {
        type: 'string',
        location: 'body',
        description: 'Login password',
      },
      use_nick_name_icon: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Show board nickname icon (T=on, F=off)',
      },
      use_writer_name_icon: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Show board writer name (T=on, F=off)',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Email address',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Phone number',
      },
      permission_shop_no: {
        type: 'array',
        location: 'body',
        description: 'Accessible shop numbers',
      },
      permission_category_select: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Category-select permission on product create (T/F)',
      },
      permitted_category_list: {
        type: 'array',
        location: 'body',
        description: 'Allowed product categories on create',
      },
      permission_product_modify: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Product modify permission (T/F)',
      },
      permission_product_display: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Product display permission (T/F)',
      },
      permission_product_selling: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Product selling permission (T/F)',
      },
      permission_product_delete: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Registered product delete permission (T/F)',
      },
      permission_order_menu: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Order menu access permission (T/F)',
      },
      permission_amount_inquiry: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Order amount inquiry permission (T/F)',
      },
      permission_order_cs: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Cancel/exchange/return/refund permission (T/F)',
      },
      permission_order_refund: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Refund completion permission (T/F)',
      },
      permission_delivery_fee_inquiry: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Delivery fee inquiry permission (T/F)',
      },
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
      user_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user login ID',
      },
      user_name: {
        type: 'array',
        location: 'body',
        description: 'Supplier user name per shop',
      },
      nick_name: {
        type: 'array',
        location: 'body',
        description: 'Nickname per shop',
      },
      password: {
        type: 'string',
        location: 'body',
        description: 'Login password',
      },
      use_nick_name_icon: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Show board nickname icon (T=on, F=off)',
      },
      use_writer_name_icon: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Show board writer name (T=on, F=off)',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Email address',
      },
      phone: {
        type: 'string',
        location: 'body',
        description: 'Phone number',
      },
      permission_shop_no: {
        type: 'array',
        location: 'body',
        description: 'Accessible shop numbers',
      },
      permission_category_select: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Category-select permission on product create (T/F)',
      },
      permitted_category_list: {
        type: 'array',
        location: 'body',
        description: 'Allowed product categories on create',
      },
      permission_product_modify: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Product modify permission (T/F)',
      },
      permission_product_display: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Product display permission (T/F)',
      },
      permission_product_selling: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Product selling permission (T/F)',
      },
      permission_product_delete: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Registered product delete permission (T/F)',
      },
      permission_order_menu: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Order menu access permission (T/F)',
      },
      permission_amount_inquiry: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Order amount inquiry permission (T/F)',
      },
      permission_order_cs: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Cancel/exchange/return/refund permission (T/F)',
      },
      permission_order_refund: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Refund completion permission (T/F)',
      },
      permission_delivery_fee_inquiry: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Delivery fee inquiry permission (T/F)',
      },
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
      user_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user login ID',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user ID',
      },
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
    requiredFields: [
      'supplier_id',
      'region_name',
      'use_regional_surcharge',
      'regional_surcharge_amount',
    ],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user ID',
      },
      country_code: {
        type: 'enum',
        location: 'body',
        enum: ['KR', 'JP', 'VN'],
        description: 'Country code (KR/JP/VN)',
      },
      region_name: {
        type: 'string',
        location: 'body',
        description: 'Special region name',
      },
      use_regional_surcharge: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Use regional surcharge (T=on, F=off)',
      },
      surcharge_region_name: {
        type: 'string',
        location: 'body',
        description: 'Surcharge region name',
      },
      start_zipcode: {
        type: 'string',
        location: 'body',
        description: 'Start zipcode',
      },
      end_zipcode: {
        type: 'string',
        location: 'body',
        description: 'End zipcode',
      },
      regional_surcharge_amount: {
        type: 'string',
        location: 'body',
        description: 'Regional surcharge amount (decimal string, KRW)',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user ID',
      },
      regional_surcharge_no: {
        type: 'number',
        location: 'path',
        description: 'Regional surcharge registration number',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user ID',
      },
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
    requiredFields: [
      'supplier_id',
      'use_regional_surcharge',
      'region_setting_type',
    ],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_id: {
        type: 'string',
        location: 'path',
        description: 'Supplier user ID',
      },
      use_regional_surcharge: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Use regional surcharge (T=on, F=off)',
      },
      region_setting_type: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'N', 'Z'],
        description: 'Region setting mode (A=simple, N=name, Z=zipcode)',
      },
      jeju_surcharge_amount: {
        type: 'string',
        location: 'body',
        description: 'Jeju surcharge amount (decimal string, KRW)',
      },
      remote_area_surcharge_amount: {
        type: 'string',
        location: 'body',
        description: 'Remote-area surcharge amount (decimal string, KRW)',
      },
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
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier identifier (path)',
      },
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
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier identifier (path)',
      },
      shipping_method: {
        type: 'enum',
        location: 'body',
        enum: [
          'shipping_01',
          'shipping_02',
          'shipping_04',
          'shipping_05',
          'shipping_06',
          'shipping_07',
          'shipping_08',
          'shipping_09',
        ],
        description: 'Shipping method code',
      },
      shipping_etc: {
        type: 'string',
        location: 'body',
        description: 'Other shipping info (when shipping_method=shipping_06)',
      },
      shipping_type: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'C', 'B'],
        description:
          'Domestic/overseas shipping (A=domestic, C=overseas, B=both)',
      },
      shipping_place: {
        type: 'string',
        location: 'body',
        description: 'Shipping region',
      },
      shipping_start_date: {
        type: 'number',
        location: 'body',
        description: 'Shipping period start (days, 1-100)',
      },
      shipping_end_date: {
        type: 'number',
        location: 'body',
        description: 'Shipping period end (days, 1-100)',
      },
      shipping_fee_type: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'R', 'M', 'D', 'W', 'C', 'N'],
        description:
          'Shipping fee type (T=free, R=fixed, M=by-amount, D=tiered-amount, W=by-weight, C=by-quantity-tier, N=per-quantity)',
      },
      free_shipping_price: {
        type: 'string',
        location: 'body',
        description: 'Free-shipping minimum amount (decimal string, KRW)',
      },
      shipping_fee: {
        type: 'string',
        location: 'body',
        description: 'Shipping fee (decimal string, KRW)',
      },
      shipping_fee_by_quantity: {
        type: 'string',
        location: 'body',
        description: 'Per-quantity shipping fee (decimal string, KRW)',
      },
      shipping_rates: {
        type: 'array',
        location: 'body',
        description: 'Shipping fee detail settings (max 50)',
      },
      prepaid_shipping_fee: {
        type: 'enum',
        location: 'body',
        enum: ['C', 'P', 'B'],
        description: 'Prepaid shipping (C=on-delivery, P=prepaid, B=both)',
      },
      shipping_fee_by_product: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Per-product shipping fee (T=on, F=off)',
      },
      product_weight: {
        type: 'number',
        location: 'body',
        description: 'Product weight (0-30)',
      },
      hscode: {
        type: 'string',
        location: 'body',
        description: 'HS code',
      },
      country_hscode: {
        type: 'array',
        location: 'body',
        description: 'HS codes per country (max 24)',
      },
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
      supplier_code: {
        type: 'string',
        location: 'path',
        description: 'Supplier identifier (path)',
      },
    },
    responseShape: 'single',
  },
];
