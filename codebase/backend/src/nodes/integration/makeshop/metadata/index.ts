/**
 * MakeShop Shop API metadata — aggregate export of all 7 section files.
 *
 * Both the `makeshop` node handler and `MakeshopMcpBridge` import from this
 * module to drive their dispatch — keeping a single source of truth.
 *
 * Adding a new endpoint: refer to `spec/conventions/makeshop-api-metadata.md`
 * §6 for the procedure (1 row in the matching section file + catalog row).
 *
 * Generated from `spec/conventions/makeshop-api-catalog/openapi/<section>.openapi.json`.
 */

import { benefitOperations } from './benefit.js';
import { boardOperations } from './board.js';
import { cpikOperations } from './cpik.js';
import { memberOperations } from './member.js';
import { orderOperations } from './order.js';
import { productOperations } from './product.js';
import { shopOperations } from './shop.js';

import type { MakeshopOperationMetadata, MakeshopResource } from './types.js';

export * from './types.js';
export {
  MAKESHOP_MISSING_FIELDS_CODE,
  validateMakeshopConstraints,
} from './constraint-validator.js';

// TODO(Phase 3 / makeshop-api-metadata §4): MakeShop timezone is unconfirmed
// (spec 5-makeshop.md §4.1). Cafe24 declares a `CAFE24_TIMEZONE_SUFFIX` (KST)
// appended to every MCP tool description; MakeShop must NOT invent a KST suffix
// until the timezone semantics are verified during the client/handler phase.

export const MAKESHOP_OPERATIONS_BY_RESOURCE: Record<
  MakeshopResource,
  readonly MakeshopOperationMetadata[]
> = {
  shop: shopOperations,
  product: productOperations,
  order: orderOperations,
  member: memberOperations,
  benefit: benefitOperations,
  board: boardOperations,
  cpik: cpikOperations,
};

/**
 * Per-section OAuth scope group. MakeShop's x-scope grouping is not 1:1 with
 * the section/resource (e.g. the `shop` section spans 상점설정 + 주문 scopes,
 * `cpik` spans 주문 + 회원). For Phase 0 we map each resource to its dominant
 * scope group; the exact per-operation scope grouping is refined when OAuth is
 * implemented (Phase 3). SoT for the wire scope format:
 * `spec/conventions/makeshop-api-metadata.md` §4.
 */
const SECTION_SCOPE: Record<MakeshopResource, string> = {
  shop: 'store',
  product: 'product',
  order: 'order',
  member: 'member',
  benefit: 'benefit',
  board: 'board',
  cpik: 'order',
};

/**
 * Lookup an operation by (resource, operationId). Returns undefined if not
 * defined — caller (handler / MCP bridge) must throw `MAKESHOP_UNKNOWN_OPERATION`.
 */
export function findMakeshopOperation(
  resource: string,
  operationId: string,
): MakeshopOperationMetadata | undefined {
  const ops = (
    MAKESHOP_OPERATIONS_BY_RESOURCE as Record<
      string,
      readonly MakeshopOperationMetadata[] | undefined
    >
  )[resource];
  if (!ops) return undefined;
  return ops.find((op) => op.id === operationId);
}

/**
 * Iterate all operations across all resources — `MakeshopMcpBridge.listTools`
 * uses this to enumerate the full tool set.
 */
export function listAllMakeshopOperations(): Array<{
  resource: MakeshopResource;
  operation: MakeshopOperationMetadata;
}> {
  const out: Array<{
    resource: MakeshopResource;
    operation: MakeshopOperationMetadata;
  }> = [];
  for (const [resource, ops] of Object.entries(
    MAKESHOP_OPERATIONS_BY_RESOURCE,
  ) as Array<[MakeshopResource, readonly MakeshopOperationMetadata[]]>) {
    for (const operation of ops) {
      out.push({ resource, operation });
    }
  }
  return out;
}

/**
 * Scope inferred from an operation: `<scope-group>.read` or
 * `<scope-group>.write`, where the scope group comes from `SECTION_SCOPE`.
 * Used by frontend Step 2 form preset matching and by tests that validate
 * scope coverage. The exact x-scope grouping is refined at OAuth (Phase 3).
 */
export function scopeForOperation(
  resource: MakeshopResource,
  operation: MakeshopOperationMetadata,
): string {
  return `${SECTION_SCOPE[resource]}.${operation.scopeType}`;
}
