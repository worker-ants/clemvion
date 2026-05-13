/**
 * Cafe24 Admin API metadata — aggregate export of all 18 resource files.
 *
 * Both `cafe24` node handler and `Cafe24McpBridge` import from this module
 * to drive their dispatch — keeping a single source of truth.
 *
 * Adding a new endpoint: refer to `spec/conventions/cafe24-api-metadata.md`
 * §4 for the procedure (1 row in the matching resource file).
 */

import { applicationOperations } from './application.js';
import { categoryOperations } from './category.js';
import { collectionOperations } from './collection.js';
import { communityOperations } from './community.js';
import { customerOperations } from './customer.js';
import { designOperations } from './design.js';
import { mileageOperations } from './mileage.js';
import { notificationOperations } from './notification.js';
import { orderOperations } from './order.js';
import { personalOperations } from './personal.js';
import { privacyOperations } from './privacy.js';
import { productOperations } from './product.js';
import { promotionOperations } from './promotion.js';
import { salesreportOperations } from './salesreport.js';
import { shippingOperations } from './shipping.js';
import { storeOperations } from './store.js';
import { supplyOperations } from './supply.js';
import { translationOperations } from './translation.js';

import type { Cafe24OperationMetadata, Cafe24Resource } from './types.js';

export * from './types.js';

export const CAFE24_OPERATIONS_BY_RESOURCE: Record<
  Cafe24Resource,
  readonly Cafe24OperationMetadata[]
> = {
  store: storeOperations,
  product: productOperations,
  order: orderOperations,
  customer: customerOperations,
  community: communityOperations,
  design: designOperations,
  promotion: promotionOperations,
  application: applicationOperations,
  category: categoryOperations,
  collection: collectionOperations,
  supply: supplyOperations,
  shipping: shippingOperations,
  salesreport: salesreportOperations,
  personal: personalOperations,
  privacy: privacyOperations,
  mileage: mileageOperations,
  notification: notificationOperations,
  translation: translationOperations,
};

/**
 * Lookup an operation by (resource, operationId). Returns undefined if not
 * defined — caller (handler / MCP bridge) must throw `CAFE24_UNKNOWN_OPERATION`.
 */
export function findCafe24Operation(
  resource: string,
  operationId: string,
): Cafe24OperationMetadata | undefined {
  const ops = (
    CAFE24_OPERATIONS_BY_RESOURCE as Record<
      string,
      readonly Cafe24OperationMetadata[] | undefined
    >
  )[resource];
  if (!ops) return undefined;
  return ops.find((op) => op.id === operationId);
}

/**
 * Iterate all operations across all resources — `Cafe24McpBridge.listTools`
 * uses this to enumerate the full tool set.
 */
export function listAllCafe24Operations(): Array<{
  resource: Cafe24Resource;
  operation: Cafe24OperationMetadata;
}> {
  const out: Array<{
    resource: Cafe24Resource;
    operation: Cafe24OperationMetadata;
  }> = [];
  for (const [resource, ops] of Object.entries(
    CAFE24_OPERATIONS_BY_RESOURCE,
  ) as Array<[Cafe24Resource, readonly Cafe24OperationMetadata[]]>) {
    for (const operation of ops) {
      out.push({ resource, operation });
    }
  }
  return out;
}

/**
 * Scope inferred from an operation: `mall.read_<resource>` or
 * `mall.write_<resource>`. Used by frontend Step 2 form preset matching
 * and by tests that validate scope coverage.
 */
export function scopeForOperation(
  resource: Cafe24Resource,
  operation: Cafe24OperationMetadata,
): string {
  return `mall.${operation.scopeType}_${resource}`;
}
