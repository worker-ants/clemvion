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
  // All 18 resources are fully implemented as supported (2026-05-21).
  // Final 6 store rows — `privacy_{boards,join,orders}_{get,update}` —
  // shipped here; catalog row 의 `planned → supported` 승격은
  // `spec/conventions/cafe24-api-catalog/store.md` 참조.
  store: [],
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
