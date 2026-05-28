/**
 * Cafe24 Admin API — frontend-facing operation metadata.
 *
 * Internal `Cafe24OperationMetadata` (`./types.ts`) carries `method` / `path`
 * for the runtime HTTP dispatcher. Frontend does NOT need those — the dynamic
 * form only renders labels + typed fields. We expose a strict subset to:
 *
 *   1. avoid leaking URL structure into client bundles, and
 *   2. force a deliberate decision when a new metadata field appears
 *      (Public type controls what reaches frontend).
 *
 * Ships through `GET /nodes/definitions` as
 * `cafe24NodeDefinition.extras.operationsByResource[<resource>][i]`. See
 * `spec/4-nodes/4-integration/4-cafe24.md` §9.3 + `cafe24.component.ts`.
 */

import {
  CAFE24_OPERATIONS_BY_RESOURCE,
  type Cafe24FieldSpec,
  type Cafe24OperationMetadata,
  type Cafe24Resource,
  type Cafe24RestrictedApproval,
} from './index.js';
import {
  CAFE24_PLANNED_BY_RESOURCE,
  type Cafe24PlannedOperationEntry,
} from './planned.js';

export interface PublicCafe24Field {
  name: string;
  type: Cafe24FieldSpec['type'];
  /** Position in the HTTP request — kept so the dynamic form can label
   *  fields by their semantic role (path / query / body). Not used for
   *  dispatch by the frontend; backend is the only HTTP caller. */
  location: Cafe24FieldSpec['location'];
  required: boolean;
  description?: string;
  enum?: readonly string[];
  default?: unknown;
}

export interface PublicCafe24OperationSupported {
  status: 'supported';
  id: string;
  /**
   * Frontend i18n dict (`cafe24Catalog.<key>`) lookup key. 형식:
   * `cafe24.<resource>.<id>`. SoT: spec/conventions/cafe24-api-metadata.md §7.5.
   * dict lookup miss 시 frontend 는 본 키를 그대로 노출 (fallback) — drift 즉시 감지.
   */
  labelKey: string;
  description: string;
  scope: 'read' | 'write';
  paginated: boolean;
  requiredFields: readonly string[];
  fields: readonly PublicCafe24Field[];
  /**
   * Cafe24 partner-approval marker. Present iff backend metadata declares
   * `restrictedApproval` for this operation. Frontend renders a ⚠ badge
   * + tooltip when set. SoT: `spec/conventions/cafe24-restricted-scopes.md`.
   */
  restrictedApproval?: Cafe24RestrictedApproval;
}

export interface PublicCafe24OperationPlanned {
  status: 'planned';
  id: string;
  /** `cafe24.<resource>.<id>` — same shape as supported. */
  labelKey: string;
  paginated: boolean;
}

export type PublicCafe24Operation =
  | PublicCafe24OperationSupported
  | PublicCafe24OperationPlanned;

export interface PublicCafe24Extras {
  operationsByResource: Record<
    Cafe24Resource,
    readonly PublicCafe24OperationSupported[]
  >;
  plannedByResource: Record<
    Cafe24Resource,
    readonly PublicCafe24OperationPlanned[]
  >;
}

/**
 * Project an internal `Cafe24OperationMetadata` into its public shape.
 * `method` and `path` are intentionally dropped — frontend renders the
 * form from labels + field types only.
 *
 * @param op - Internal operation metadata row from `CAFE24_OPERATIONS_BY_RESOURCE`.
 * @param resource - Cafe24 resource key (e.g. `"product"`). Used to build `labelKey`.
 */
export function toPublicSupportedOperation(
  op: Cafe24OperationMetadata,
  resource: Cafe24Resource,
): PublicCafe24OperationSupported {
  const required = new Set(op.requiredFields);
  const fields: PublicCafe24Field[] = Object.entries(op.fields).map(
    ([name, spec]) => ({
      name,
      type: spec.type,
      location: spec.location,
      required: required.has(name),
      description: spec.description,
      enum: spec.enum,
      default: spec.default,
    }),
  );
  return {
    status: 'supported',
    id: op.id,
    labelKey: `cafe24.${resource}.${op.id}`,
    description: op.description,
    scope: op.scopeType,
    paginated: op.paginated === true,
    requiredFields: op.requiredFields,
    fields,
    ...(op.restrictedApproval
      ? { restrictedApproval: op.restrictedApproval }
      : {}),
  };
}

/**
 * @param op - Planned operation entry from `CAFE24_PLANNED_BY_RESOURCE`.
 * @param resource - Cafe24 resource key. Used to build `labelKey`.
 */
function toPublicPlannedOperation(
  op: Cafe24PlannedOperationEntry,
  resource: Cafe24Resource,
): PublicCafe24OperationPlanned {
  return {
    status: 'planned',
    id: op.id,
    labelKey: `cafe24.${resource}.${op.id}`,
    paginated: op.paginated === true,
  };
}

/**
 * Build the full `extras` payload for the cafe24 node — called once per
 * `GET /nodes/definitions` request. Cheap (pure map over compile-time data).
 */
export function buildCafe24Extras(): PublicCafe24Extras {
  const operationsByResource = {} as Record<
    Cafe24Resource,
    readonly PublicCafe24OperationSupported[]
  >;
  const plannedByResource = {} as Record<
    Cafe24Resource,
    readonly PublicCafe24OperationPlanned[]
  >;

  for (const [resource, ops] of Object.entries(
    CAFE24_OPERATIONS_BY_RESOURCE,
  ) as Array<[Cafe24Resource, readonly Cafe24OperationMetadata[]]>) {
    operationsByResource[resource] = ops.map((op) =>
      toPublicSupportedOperation(op, resource),
    );
  }
  for (const [resource, ops] of Object.entries(
    CAFE24_PLANNED_BY_RESOURCE,
  ) as Array<[Cafe24Resource, readonly Cafe24PlannedOperationEntry[]]>) {
    plannedByResource[resource] = ops.map((op) =>
      toPublicPlannedOperation(op, resource),
    );
  }

  return { operationsByResource, plannedByResource };
}
