import type { Cafe24OperationMetadata } from './types.js';

/**
 * Cafe24 `shipping` resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md`, 2026-07-05):
 * field-set 을 공식 docs 카탈로그(`spec/conventions/cafe24-api-catalog/shipping/*.md`
 * 의 각 operation `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를
 * 그대로 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로 전송하므로
 * (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `path`/`method`/`scopeType`/`responseShape`/`paginated`/`id`/`description` 은 기존 계약을
 *   그대로 보존한다 (path param key `carrier_no`·`origin_code` 유지).
 * - `requiredFields` 는 기존 계약 ∩ 신규 fields keys. 신규 body-required 는 constraints 로.
 */
export const shippingOperations: Cafe24OperationMetadata[] = [
  {
    id: 'carriers_list',
    description: 'Retrieve a list of shipping carriers.',
    scopeType: 'read',
    method: 'GET',
    path: 'carriers',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'list',
  },
  // Phase 6d — shipping baseline
  {
    id: 'carriers_get',
    description: 'Retrieve a single shipping carrier by carrier_no.',
    scopeType: 'read',
    method: 'GET',
    path: 'carriers/{carrier_no}',
    requiredFields: ['carrier_no'],
    fields: {
      carrier_no: {
        type: 'number',
        location: 'path',
        description: 'Shipping carrier ID',
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
  // Phase 7e — Shipping 완성 (carriers CRUD + regionalsurcharges + settings + shippingorigins)
  {
    id: 'carriers_create',
    description: 'Register a new shipping carrier.',
    scopeType: 'write',
    method: 'POST',
    path: 'carriers',
    requiredFields: ['shipping_carrier_code', 'contact', 'email'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      shipping_carrier_code: {
        type: 'string',
        location: 'body',
        description: 'Shipping carrier code (shipping_company_code)',
      },
      contact: {
        type: 'string',
        location: 'body',
        description: 'Primary contact number (max 16)',
      },
      email: {
        type: 'string',
        location: 'body',
        description: 'Email address (max 255)',
      },
      shipping_carrier: {
        type: 'string',
        location: 'body',
        description: 'Shipping carrier name (max 80)',
      },
      track_shipment_url: {
        type: 'string',
        location: 'body',
        description: 'Shipment tracking URL (max 255)',
      },
      secondary_contact: {
        type: 'string',
        location: 'body',
        description: 'Secondary contact number (max 16)',
      },
      default_shipping_fee: {
        type: 'string',
        location: 'body',
        description: 'Default shipping fee (decimal string, KRW)',
      },
      homepage_url: {
        type: 'string',
        location: 'body',
        description: 'Homepage URL (max 255)',
      },
      shipping_fee_setting: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Shipping fee setting flag (T=on, F=off)',
      },
      shipping_fee_setting_detail: {
        type: 'object',
        location: 'body',
        description: 'Shipping fee setting detail object',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'carriers_update',
    description: 'Update a shipping carrier by carrier_no.',
    scopeType: 'write',
    method: 'PUT',
    path: 'carriers/{carrier_no}',
    requiredFields: ['carrier_no'],
    fields: {
      carrier_no: {
        type: 'number',
        location: 'path',
        description: 'Shipping carrier ID',
      },
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      default_shipping_carrier: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'T',
        description: 'Default carrier flag (T=on, F=off)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'carriers_delete',
    description: 'Delete a shipping carrier by carrier_no.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'carriers/{carrier_no}',
    requiredFields: ['carrier_no'],
    fields: {
      carrier_no: {
        type: 'number',
        location: 'path',
        description: 'Shipping carrier ID',
      },
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      delete_default_carrier: {
        type: 'enum',
        location: 'query',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Delete default carrier flag (T=delete, F=keep)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'regionalsurcharges_get',
    description: 'Retrieve the regional shipping zone surcharges.',
    scopeType: 'read',
    method: 'GET',
    path: 'regionalsurcharges',
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
  {
    id: 'regionalsurcharges_update',
    description: 'Update the regional shipping zone surcharges (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'regionalsurcharges',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      use_regional_surcharge: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Use regional surcharge flag (T=on, F=off)',
      },
      region_setting_type: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'N', 'Z'],
        description: 'Region setting type (A=simple, N=name, Z=zipcode)',
      },
      jeju_surcharge_amount: {
        type: 'string',
        location: 'body',
        description: 'Jeju extra shipping fee (decimal string, KRW)',
      },
      remote_area_surcharge_amount: {
        type: 'string',
        location: 'body',
        description: 'Remote-area extra shipping fee (decimal string, KRW)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'shipping_settings_get',
    description: 'Retrieve the store-level shipping & return settings.',
    scopeType: 'read',
    method: 'GET',
    path: 'shipping',
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
  {
    id: 'shipping_settings_update',
    description: 'Update the store-level shipping & return settings (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'shipping',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
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
          'shipping_10',
        ],
        description:
          'Shipping method (01=parcel, 02=express, 04=direct, 05=quick, 06=etc, 07=freight, 08=pickup, 09=none, 10=customer)',
      },
      shipping_etc: {
        type: 'string',
        location: 'body',
        description: 'Other shipping description (max 25)',
      },
      shipping_type: {
        type: 'enum',
        location: 'body',
        enum: ['A', 'C', 'B'],
        description: 'Shipping scope (A=domestic, C=overseas, B=both)',
      },
      international_shipping_fee_criteria: {
        type: 'enum',
        location: 'body',
        enum: ['B', 'E'],
        description: 'International fee basis (B=own, E=auto EMS)',
      },
      shipping_place: {
        type: 'string',
        location: 'body',
        description: 'Shipping place',
      },
      shipping_period: {
        type: 'object',
        location: 'body',
        description: 'Shipping period (minimum/maximum days)',
      },
      shipping_fee_type: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'R', 'M', 'D', 'W', 'C', 'N'],
        description:
          'Shipping fee type (T=free, R=fixed, M=by amount, D=tiered amount, W=by weight, C=by quantity, N=per quantity)',
      },
      shipping_fee: {
        type: 'string',
        location: 'body',
        description: 'Shipping fee (decimal string, KRW)',
      },
      free_shipping_price: {
        type: 'string',
        location: 'body',
        description: 'Free-shipping minimum amount (decimal string, KRW)',
      },
      shipping_fee_by_quantity: {
        type: 'string',
        location: 'body',
        description: 'Shipping fee per quantity (decimal string, KRW)',
      },
      shipping_rates: {
        type: 'array',
        location: 'body',
        description: 'Shipping fee detail rates',
      },
      shipping_fee_criteria: {
        type: 'enum',
        location: 'body',
        enum: ['D', 'A'],
        description: 'Fee charge basis (D=before discount, A=after discount)',
      },
      prepaid_shipping_fee: {
        type: 'enum',
        location: 'body',
        enum: ['C', 'P', 'B'],
        description: 'Prepaid fee setting (C=on delivery, P=prepaid, B=both)',
      },
      product_weight: {
        type: 'string',
        location: 'body',
        description: 'Product weight (0-30)',
      },
      oversea_shipping_country: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Restrict overseas countries flag (T=on, F=off)',
      },
      oversea_shipping_country_list: {
        type: 'array',
        location: 'body',
        description: 'Overseas shipping countries',
      },
      country_shipping_fee: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Per-country fee flag (T=on, F=off)',
      },
      country_shipping_fee_list: {
        type: 'array',
        location: 'body',
        description: 'Per-country shipping fees',
      },
      international_shipping_insurance: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'International shipping insurance (T=on, F=off)',
      },
      return_address: {
        type: 'object',
        location: 'body',
        description: 'Return address object',
      },
      package_volume: {
        type: 'object',
        location: 'body',
        description: 'Package volume (width/length/height)',
      },
      individual_shipping_fee: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Per-product individual fee flag (T=on, F=off)',
      },
      individual_fee_calculation_type: {
        type: 'enum',
        location: 'body',
        enum: ['P', 'I'],
        description: 'Individual fee basis (P=per product, I=per item)',
      },
      additional_shipping_fee: {
        type: 'string',
        location: 'body',
        description: 'Additional shipping fee (decimal string, KRW)',
      },
      shipping_company_type: {
        type: 'array',
        location: 'body',
        description: 'Selected shipping carriers',
      },
      hs_code: {
        type: 'string',
        location: 'body',
        description: 'HS code (max 20)',
      },
      country_hs_code: {
        type: 'array',
        location: 'body',
        description: 'Per-country HS codes (max 29)',
      },
      oversea_additional_fee: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Overseas additional fee flag (T=on, F=off)',
      },
      oversea_additional_fee_list: {
        type: 'array',
        location: 'body',
        description: 'Overseas additional fee applicable countries (max 500)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'shipping_additionalfees_countries',
    description:
      'List countries with applicable additional handling fees for international shipping.',
    scopeType: 'read',
    method: 'GET',
    // cafe24 docs path: `shipping/additionalfees` (no `/countries` suffix).
    path: 'shipping/additionalfees',
    requiredFields: [],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
    },
    responseShape: 'list',
  },
  {
    id: 'shippingorigins_list',
    description: 'List configured shipping origins.',
    scopeType: 'read',
    method: 'GET',
    path: 'shippingorigins',
    requiredFields: [],
    fields: {},
    responseShape: 'list',
    paginated: true,
  },
  {
    id: 'shippingorigins_get',
    description: 'Retrieve a shipping origin by origin_code.',
    scopeType: 'read',
    method: 'GET',
    path: 'shippingorigins/{origin_code}',
    requiredFields: ['origin_code'],
    fields: {
      origin_code: {
        type: 'string',
        location: 'path',
        description: 'Shipping origin code ([A-Z0-9], 8 chars)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'shippingorigins_create',
    description: 'Register a new shipping origin.',
    scopeType: 'write',
    method: 'POST',
    path: 'shippingorigins',
    requiredFields: ['origin_name', 'address1', 'address2', 'country_code'],
    fields: {
      origin_name: {
        type: 'string',
        location: 'body',
        description: 'Shipping origin name (max 50)',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Base address (max 255)',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detail address (max 255)',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Country code (max 2)',
      },
      default: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Default origin flag (T=on, F=off)',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Zip code (2-14 chars)',
      },
      contact: {
        type: 'string',
        location: 'body',
        description: 'Primary contact number (max 20)',
      },
      secondary_contact: {
        type: 'string',
        location: 'body',
        description: 'Secondary contact number (max 20)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'shippingorigins_update',
    description: 'Update a shipping origin by origin_code (partial).',
    scopeType: 'write',
    method: 'PUT',
    path: 'shippingorigins/{origin_code}',
    requiredFields: ['origin_code'],
    fields: {
      origin_code: {
        type: 'string',
        location: 'path',
        description: 'Shipping origin code ([A-Z0-9], 8 chars)',
      },
      origin_name: {
        type: 'string',
        location: 'body',
        description: 'Shipping origin name (max 50)',
      },
      country_code: {
        type: 'string',
        location: 'body',
        description: 'Country code (max 2)',
      },
      default: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        description: 'Default origin flag (T=on, F=off)',
      },
      contact: {
        type: 'string',
        location: 'body',
        description: 'Primary contact number (max 20)',
      },
      secondary_contact: {
        type: 'string',
        location: 'body',
        description: 'Secondary contact number (max 20)',
      },
      zipcode: {
        type: 'string',
        location: 'body',
        description: 'Zip code (2-14 chars)',
      },
      address1: {
        type: 'string',
        location: 'body',
        description: 'Base address (max 255)',
      },
      address2: {
        type: 'string',
        location: 'body',
        description: 'Detail address (max 255)',
      },
    },
    responseShape: 'single',
  },
  {
    id: 'shippingorigins_delete',
    description: 'Delete a shipping origin by origin_code.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'shippingorigins/{origin_code}',
    requiredFields: ['origin_code'],
    fields: {
      origin_code: {
        type: 'string',
        location: 'path',
        description: 'Shipping origin code ([A-Z0-9], 8 chars)',
      },
    },
    responseShape: 'single',
  },
];
