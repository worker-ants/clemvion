import type { Cafe24OperationMetadata } from './types.js';
import { RESTRICTED_APPROVAL } from './restricted-approval.js';
import {
  CAFE24_DATE_FIELD_SINCE,
  CAFE24_DATE_FIELD_UNTIL,
} from './date-descriptions.js';

/**
 * Cafe24 `mileage` (points / credits) resource metadata.
 *
 * G-1-remaining (plan `cafe24-backlog-residual.md`, 2026-07-05): field-set 을
 * 공식 docs 카탈로그(`spec/conventions/cafe24-api-catalog/mileage/*.md` 의 각
 * operation `요청 파라미터` 표)와 **전량 미러**했다. 필드명은 docs Parameter 를
 * 그대로 사용한다 — 핸들러가 field key 를 query/body 파라미터명으로 그대로
 * 전송하므로 (`cafe24.handler.ts` buildRequest), docs 명이 아닌 alias 는 Cafe24 가
 * 인식하지 못한다.
 *
 * 규칙:
 * - `offset`/`limit` 은 field 로 넣지 않는다 — paginated op 는 핸들러 pagination 층이 주입.
 * - `requiredFields` 는 기존 계약을 보존하되 docs 로 schema 가 바뀐 필드는 신규
 *   fields 에 실재하는 것만 남긴다 (metadata.spec 의 subset 불변식).
 * - date/time 필드 description 은 §5.2 (KST / YYYY-MM-DD 명시).
 * - point/credit 금액은 Cafe24 decimal 규약에 따라 'string'.
 */
export const mileageOperations: Cafe24OperationMetadata[] = [
  {
    id: 'mileage_list',
    description: 'List mileage (loyalty point) transactions.',
    scopeType: 'read',
    method: 'GET',
    path: 'points',
    requiredFields: ['shop_no', 'start_date', 'end_date'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Member ID (max 20 chars)',
      },
      email: {
        type: 'string',
        location: 'query',
        description: 'Member email',
      },
      order_id: {
        type: 'string',
        location: 'query',
        description: 'Order ID (max 100 chars)',
      },
      group_no: {
        type: 'number',
        location: 'query',
        description: 'Member group number',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
      case: {
        type: 'string',
        location: 'query',
        description: 'Points type code (A–AS / 1–9, see Cafe24 docs)',
      },
      points_category: {
        type: 'enum',
        location: 'query',
        enum: ['available', 'unavailable', 'unavailable_coupon'],
        default: 'available',
        description:
          'Points bucket (available, unavailable, unavailable_coupon)',
      },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'mileage_grant',
    description: 'Grant mileage to a member.',
    scopeType: 'write',
    method: 'POST',
    path: 'points',
    requiredFields: ['member_id', 'amount', 'reason', 'type'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'body',
        description: 'Member ID (max 20 chars)',
      },
      order_id: {
        type: 'string',
        location: 'body',
        description: 'Order number',
      },
      amount: {
        type: 'string',
        location: 'body',
        description: 'Points change amount (decimal string, KRW; min 0)',
      },
      type: {
        type: 'enum',
        location: 'body',
        enum: ['increase', 'decrease'],
        description: 'Increase or decrease points',
      },
      reason: {
        type: 'string',
        location: 'body',
        description: 'Reason for the points change',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  // Phase 6e — Mileage 보완
  {
    // docs: GET/DELETE points/autoexpiration 는 store-level collection op (식별자·파라미터 없음).
    id: 'points_autoexpiration_get',
    description: 'Retrieve the automatic points-expiration rule.',
    scopeType: 'read',
    method: 'GET',
    path: 'points/autoexpiration',
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
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'points_autoexpiration_create',
    description:
      'Register an automatic points-expiration rule. Body should include customer reference + expiration_date + points_amount.',
    scopeType: 'write',
    method: 'POST',
    path: 'points/autoexpiration',
    requiredFields: [
      'expiration_date',
      'interval_month',
      'target_period_month',
      'standard_point',
    ],
    fields: {
      shop_no: {
        type: 'number',
        location: 'body',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      expiration_date: {
        type: 'string',
        location: 'body',
        description: 'First expiration run date (YYYY-MM-DD, KST)',
      },
      interval_month: {
        type: 'enum',
        location: 'body',
        enum: ['1', '3', '6', '12'],
        description: 'Expiration run interval in months (1, 3, 6, 12)',
      },
      target_period_month: {
        type: 'enum',
        location: 'body',
        enum: ['6', '12', '18', '24', '30', '36'],
        description: 'Target points age in months (6, 12, 18, 24, 30, 36)',
      },
      group_no: {
        type: 'number',
        location: 'body',
        default: 0,
        description: 'Target member group (0=all members)',
      },
      standard_point: {
        type: 'string',
        location: 'body',
        description: 'Minimum points threshold (decimal string, KRW; min 1)',
      },
      send_email: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Send email notification (T=on, F=off)',
      },
      send_sms: {
        type: 'enum',
        location: 'body',
        enum: ['T', 'F'],
        default: 'F',
        description: 'Send SMS notification (T=on, F=off)',
      },
      notification_time_day: {
        type: 'array',
        location: 'body',
        description: 'Notice timing in days before (3, 7, 15, 30)',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'points_autoexpiration_delete',
    description: 'Remove the automatic points-expiration rule.',
    scopeType: 'write',
    method: 'DELETE',
    path: 'points/autoexpiration',
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
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'credits_list',
    description: 'Retrieve the credit (예치금) ledger for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'credits',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
      type: {
        type: 'enum',
        location: 'query',
        enum: ['I', 'D'],
        description: 'Credit direction (I=issued, D=deducted)',
      },
      case: {
        type: 'enum',
        location: 'query',
        enum: ['A', 'B', 'C', 'D', 'E', 'G'],
        description:
          'Credit type (A=order cancel, B=credit refund, C=purchase, D=manual, E=cash refund, G=charge)',
      },
      admin_id: {
        type: 'string',
        location: 'query',
        description: 'Admin ID',
      },
      order_id: {
        type: 'string',
        location: 'query',
        description: 'Order number',
      },
      search_field: {
        type: 'enum',
        location: 'query',
        enum: ['id', 'reason'],
        description: 'Search field (id, reason)',
      },
      keyword: {
        type: 'string',
        location: 'query',
        description: 'Search keyword',
      },
    },
    responseShape: 'list',
    paginated: true,
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  {
    id: 'credits_report',
    description:
      'Retrieve the credit (예치금) summary report for a date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'credits/report',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
      type: {
        type: 'enum',
        location: 'query',
        enum: ['I', 'D'],
        description: 'Credit direction (I=issued, D=deducted)',
      },
      case: {
        type: 'enum',
        location: 'query',
        enum: ['A', 'B', 'C', 'D', 'E', 'G'],
        description:
          'Credit type (A=order cancel, B=credit refund, C=purchase, D=manual, E=cash refund, G=charge)',
      },
      admin_id: {
        type: 'string',
        location: 'query',
        description: 'Admin ID',
      },
      search_field: {
        type: 'enum',
        location: 'query',
        enum: ['id', 'reason'],
        description: 'Search field (id, reason)',
      },
      keyword: {
        type: 'string',
        location: 'query',
        description: 'Search keyword',
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
  // Phase 8a — Mileage 완성
  {
    id: 'points_report',
    description: 'Retrieve a points (mileage) report by date range.',
    scopeType: 'read',
    method: 'GET',
    path: 'points/report',
    requiredFields: ['start_date', 'end_date'],
    fields: {
      shop_no: {
        type: 'number',
        location: 'query',
        default: 1,
        description: 'Multi-shop number (default 1)',
      },
      member_id: {
        type: 'string',
        location: 'query',
        description: 'Member ID (max 20 chars)',
      },
      email: {
        type: 'string',
        location: 'query',
        description: 'Member email',
      },
      group_no: {
        type: 'number',
        location: 'query',
        description: 'Member group number',
      },
      start_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_SINCE,
      },
      end_date: {
        type: 'string',
        location: 'query',
        description: CAFE24_DATE_FIELD_UNTIL,
      },
    },
    responseShape: 'single',
    restrictedApproval: RESTRICTED_APPROVAL.mileage,
  },
];
