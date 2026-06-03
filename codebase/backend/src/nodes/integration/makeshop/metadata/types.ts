/**
 * MakeShop Shop API metadata model.
 *
 * Source-of-truth shape per `spec/conventions/makeshop-api-metadata.md`.
 * Both the `makeshop` node handler and the `MakeshopMcpBridge` consume the
 * same `MakeshopOperationMetadata` table — adding a new endpoint means
 * adding one row, no code change in either consumer.
 *
 * Form is isomorphic to the Cafe24 metadata model (`../../cafe24/metadata/types.ts`)
 * with MakeShop-specific divergences:
 *   - `method` is GET/POST only (no PUT/DELETE — MakeShop Shop API encodes
 *     delete/update as path segments + POST).
 *   - No `restrictedApproval` field / `ApprovalGroup` type — MakeShop has no
 *     per-scope/operation partner-approval tier (spec makeshop-api-metadata §2).
 */

export type MakeshopFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum';

export type MakeshopFieldLocation = 'path' | 'query' | 'body';

export interface MakeshopFieldSpec {
  type: MakeshopFieldType;
  location: MakeshopFieldLocation;
  enum?: string[];
  description?: string;
  default?: unknown;
}

export type MakeshopResponseShape = 'list' | 'single' | 'empty';

/**
 * Conditional input constraint — captures docs natural-language notes that
 * the `requiredFields: string[]` AND-semantic cannot express. Copied verbatim
 * from the Cafe24 model (`../../cafe24/metadata/types.ts`).
 *
 * Spec: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미"
 * (referenced from `spec/conventions/makeshop-api-metadata.md` §2).
 *
 * Four kinds:
 * - `oneOf`        — at-least-one-of (NOT JSON Schema's exactly-one).
 * - `allOrNone`    — listed fields must all be present together or all absent.
 * - `implies`      — when `if` is present, every field in `then` is required.
 * - `impliesValue` — value-aware implication (strict-equal on the `if` field).
 *
 * Invariants enforced by `metadata.spec.ts`:
 * 1. All field names referenced (in `fields`, `if`, `then`) must be keys of
 *    the operation's `fields` map.
 * 2. `oneOf.fields` and `allOrNone.fields` have length >= 2.
 * 3. `implies.then` has length >= 1 (tuple-encoded).
 */
export type MakeshopFieldConstraint =
  | { kind: 'oneOf'; fields: string[] }
  | { kind: 'allOrNone'; fields: string[] }
  | { kind: 'implies'; if: string; then: [string, ...string[]] }
  | {
      kind: 'impliesValue';
      if: string;
      value: string | number | boolean;
      then: [string, ...string[]];
    };

/**
 * `scopeType` (not `category`) intentionally — avoids collision with
 * `Node.category` enum (`integration` / `logic` / `ai` / ...). Maps to MakeShop
 * OAuth scope strings via `scopeForOperation`: `<scope-group>.read` /
 * `<scope-group>.write`.
 *
 * Note: `scopeType` is decoupled from HTTP `method`. MakeShop encodes mutating
 * actions (create/update/delete) as POST + path segment, so most POST rows are
 * `scopeType: 'write'`. The CPIK member check/login POSTs are also `scopeType:
 * 'write'` — POST is write-style per the Phase 0 rule regardless of semantic
 * read intent. The exact scope classification is confirmed at OAuth (Phase 3).
 */
export interface MakeshopOperationMetadata {
  id: string;
  // 사람 친화 라벨은 frontend i18n dict (`makeshop.<resource>.<id>`) 로 lookup.
  // SoT: spec/conventions/makeshop-api-metadata.md §2.
  description: string;
  scopeType: 'read' | 'write';
  method: 'GET' | 'POST';
  path: string;
  requiredFields: string[];
  fields: Record<string, MakeshopFieldSpec>;
  responseShape?: MakeshopResponseShape;
  paginated?: boolean;

  /**
   * Conditional input constraints — docs natural-language requirements the
   * AND-only `requiredFields` cannot express. See `MakeshopFieldConstraint`.
   * Empty for all rows today (no MakeShop op declares constraints yet) but the
   * field exists for parity with Cafe24 and future use.
   */
  constraints?: MakeshopFieldConstraint[];
}

export type MakeshopResource =
  | 'shop'
  | 'product'
  | 'order'
  | 'member'
  | 'benefit'
  | 'board'
  | 'cpik';

export const MAKESHOP_RESOURCES: readonly MakeshopResource[] = [
  'shop',
  'product',
  'order',
  'member',
  'benefit',
  'board',
  'cpik',
] as const;
