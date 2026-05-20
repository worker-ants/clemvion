/**
 * Cafe24 Admin API — planned (yet-to-be-implemented) operations.
 *
 * SoT for these rows lives in `spec/conventions/cafe24-api-catalog/<resource>.md`
 * as `status: planned`. This file is the backend mirror that ships through
 * `GET /nodes/definitions` so the frontend Operation select can show
 * 'planned' items as disabled + '지원 예정' badge.
 *
 * Drift is caught by `catalog-sync.spec.ts` — adding/removing a planned row
 * in the catalog MD requires the same change here.
 */

import type { Cafe24Resource } from './types.js';

export interface Cafe24PlannedOperationEntry {
  id: string;
  label: string;
  paginated?: boolean;
}

export const CAFE24_PLANNED_BY_RESOURCE: Record<
  Cafe24Resource,
  readonly Cafe24PlannedOperationEntry[]
> = {
  store: [
    { id: 'privacy_boards_get', label: '게시판 개인정보 정책 조회' },
    { id: 'privacy_boards_update', label: '게시판 개인정보 정책 수정' },
    { id: 'privacy_join_get', label: '회원가입 개인정보 정책 조회' },
    { id: 'privacy_join_update', label: '회원가입 개인정보 정책 수정' },
    { id: 'privacy_orders_get', label: '주문 개인정보 정책 조회' },
    { id: 'privacy_orders_update', label: '주문 개인정보 정책 수정' },
  ],
  product: [],
  order: [
    { id: 'collectrequests_update', label: '수거 요청 수정' },
    { id: 'control', label: '주문 컨트롤' },
    { id: 'exchange_update_multiple', label: '교환 일괄 수정' },
    { id: 'exchangerequests_create_bulk', label: '교환 요청 일괄 생성' },
    { id: 'exchangerequests_reject_multiple', label: '교환 요청 일괄 거부' },
    { id: 'fulfillments_create', label: '풀필먼트 배송 생성' },
    { id: 'labels_list', label: '주문 라벨 목록' },
    { id: 'labels_create_multiple', label: '주문 라벨 일괄 생성' },
    { id: 'orderform_properties_get', label: '주문서 추가 필드 조회' },
    { id: 'orderform_properties_create', label: '주문서 추가 필드 생성' },
    { id: 'orderform_properties_update', label: '주문서 추가 필드 수정' },
    { id: 'orderform_properties_delete', label: '주문서 추가 필드 삭제' },
    { id: 'shipments_create_multiple', label: '배송 일괄 생성' },
    { id: 'shipments_update_multiple', label: '배송 일괄 수정' },
    { id: 'subscription_shipments_get', label: '정기배송 조회' },
    { id: 'subscription_shipments_create', label: '정기배송 생성' },
    { id: 'subscription_shipments_update', label: '정기배송 수정' },
    {
      id: 'subscription_shipments_items_update',
      label: '정기배송 상품 옵션 수정',
    },
    { id: 'unpaidorders_list', label: '미결제 주문 목록', paginated: true },
  ],
  customer: [],
  community: [],
  design: [],
  promotion: [],
  application: [],
  category: [],
  collection: [],
  supply: [],
  shipping: [],
  salesreport: [],
  personal: [],
  privacy: [],
  mileage: [],
  notification: [],
  translation: [],
};
