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
  label: string;
  description: string;
  scope: 'read' | 'write';
  paginated: boolean;
  requiredFields: readonly string[];
  fields: readonly PublicCafe24Field[];
}

export interface PublicCafe24OperationPlanned {
  status: 'planned';
  id: string;
  label: string;
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
 */
export function toPublicSupportedOperation(
  op: Cafe24OperationMetadata,
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
    label: op.label,
    description: op.description,
    scope: op.scopeType,
    paginated: op.paginated === true,
    requiredFields: op.requiredFields,
    fields,
  };
}

function toPublicPlannedOperation(
  op: Cafe24PlannedOperationEntry,
): PublicCafe24OperationPlanned {
  return {
    status: 'planned',
    id: op.id,
    label: op.label,
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
    operationsByResource[resource] = ops.map(toPublicSupportedOperation);
  }
  for (const [resource, ops] of Object.entries(
    CAFE24_PLANNED_BY_RESOURCE,
  ) as Array<[Cafe24Resource, readonly Cafe24PlannedOperationEntry[]]>) {
    plannedByResource[resource] = ops.map(toPublicPlannedOperation);
  }

  return { operationsByResource, plannedByResource };
}
