/**
 * MakeShop Shop API — frontend-facing operation metadata.
 *
 * Internal `MakeshopOperationMetadata` (`./types.ts`) carries `method` / `path`
 * for the runtime HTTP dispatcher. Frontend does NOT need those — the dynamic
 * form only renders labels + typed fields. We expose a strict subset to:
 *
 *   1. avoid leaking URL structure into client bundles, and
 *   2. force a deliberate decision when a new metadata field appears
 *      (Public type controls what reaches frontend).
 *
 * Mirrors the Cafe24 public-meta shape (`../../cafe24/metadata/public-meta.ts`)
 * minus the `restrictedApproval` / planned channels — every MakeShop operation
 * is supported (no planned tier yet).
 */

import {
  MAKESHOP_OPERATIONS_BY_RESOURCE,
  type MakeshopFieldSpec,
  type MakeshopOperationMetadata,
  type MakeshopResource,
} from './index.js';

export interface PublicMakeshopField {
  name: string;
  type: MakeshopFieldSpec['type'];
  /** Position in the HTTP request — kept so the dynamic form can label
   *  fields by their semantic role (path / query / body). Not used for
   *  dispatch by the frontend; backend is the only HTTP caller. */
  location: MakeshopFieldSpec['location'];
  required: boolean;
  description?: string;
  enum?: readonly string[];
  default?: unknown;
}

export interface PublicMakeshopOperation {
  status: 'supported';
  id: string;
  /**
   * Frontend i18n dict (`makeshopCatalog.<key>`) lookup key. 형식:
   * `makeshop.<resource>.<id>`. SoT: spec/conventions/makeshop-api-metadata.md §2.
   * dict lookup miss 시 frontend 는 본 키를 그대로 노출 (fallback) — drift 즉시 감지.
   */
  labelKey: string;
  description: string;
  scope: 'read' | 'write';
  paginated: boolean;
  requiredFields: readonly string[];
  fields: readonly PublicMakeshopField[];
}

export interface PublicMakeshopExtras {
  operationsByResource: Record<
    MakeshopResource,
    readonly PublicMakeshopOperation[]
  >;
}

/**
 * Project an internal `MakeshopOperationMetadata` into its public shape.
 * `method` and `path` are intentionally dropped — frontend renders the
 * form from labels + field types only.
 *
 * @param op - Internal operation metadata row from `MAKESHOP_OPERATIONS_BY_RESOURCE`.
 * @param resource - MakeShop resource key (e.g. `"product"`). Used to build `labelKey`.
 */
export function toPublicMakeshopOperation(
  op: MakeshopOperationMetadata,
  resource: MakeshopResource,
): PublicMakeshopOperation {
  const required = new Set(op.requiredFields);
  const fields: PublicMakeshopField[] = Object.entries(op.fields).map(
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
    labelKey: `makeshop.${resource}.${op.id}`,
    description: op.description,
    scope: op.scopeType,
    paginated: op.paginated === true,
    requiredFields: op.requiredFields,
    fields,
  };
}

/**
 * Build the full `extras` payload for the makeshop node — called once per
 * `GET /nodes/definitions` request. Cheap (pure map over compile-time data).
 */
export function buildMakeshopExtras(): PublicMakeshopExtras {
  const operationsByResource = {} as Record<
    MakeshopResource,
    readonly PublicMakeshopOperation[]
  >;

  for (const [resource, ops] of Object.entries(
    MAKESHOP_OPERATIONS_BY_RESOURCE,
  ) as Array<[MakeshopResource, readonly MakeshopOperationMetadata[]]>) {
    operationsByResource[resource] = ops.map((op) =>
      toPublicMakeshopOperation(op, resource),
    );
  }

  return { operationsByResource };
}
