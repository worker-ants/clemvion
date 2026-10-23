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

import { isDryRunMockedOperation } from '../../../core/dry-run.util.js';

import type { Cafe24OperationMetadata, Cafe24Resource } from './types.js';

export * from './types.js';
export {
  CAFE24_MISSING_FIELDS_CODE,
  validateCafe24Constraints,
} from './constraint-validator.js';

/**
 * Cafe24 Admin API 의 모든 date/time 필드가 KST(UTC+9) 기준임을 LLM 에 알리는
 * 도구 description suffix. `Cafe24McpToolProvider.buildTools()` 가 모든 tool 의
 * description 끝에 자동 append.
 *
 * Spec: spec/conventions/cafe24-api-metadata.md §5.3 (single source of truth).
 */
export const CAFE24_TIMEZONE_SUFFIX =
  'All date/time parameters and response fields use KST (Asia/Seoul, UTC+9) unless the field description states otherwise.';

/**
 * 메서드는 GET 인데 상점 상태를 바꾸는 operation. dry-run 재실행은 GET 을 실제로
 * 호출하므로 이 목록의 operation 은 따로 모의 응답으로 대신한다
 * (`isCafe24DryRunMocked`, CLE-EXEC-RERUN 「부수효과 판정」).
 *
 * 지금은 그런 operation 이 없어 비어 있다. 새로 생기면 여기에 올린다. 메타데이터를
 * 다시 생성할 때 후보는 `dry-run-state-changing-get.spec.ts` 가 잡는다.
 */
export const CAFE24_STATE_CHANGING_GET_OPERATION_IDS: ReadonlySet<string> =
  new Set<string>();

/**
 * dry-run 에서 이 Cafe24 operation 을 모의 응답으로 대신할지 판정한다. Cafe24
 * 통합 노드 핸들러와 `Cafe24McpToolProvider` 가 이 함수 하나를 부른다. 예외 목록을
 * 이 함수가 묶어 두므로 호출 지점은 목록을 따로 넘기지 않는다.
 */
export function isCafe24DryRunMocked(operation: {
  id: string;
  method: string;
}): boolean {
  return isDryRunMockedOperation(
    operation,
    CAFE24_STATE_CHANGING_GET_OPERATION_IDS,
  );
}

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
