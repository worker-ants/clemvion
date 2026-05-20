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
  order: [],
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
