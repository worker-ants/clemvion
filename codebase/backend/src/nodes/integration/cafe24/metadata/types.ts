/**
 * Cafe24 Admin API metadata model.
 *
 * Source-of-truth shape per `spec/conventions/cafe24-api-metadata.md`.
 * Both the `cafe24` node handler and the `Cafe24McpBridge` consume the
 * same `Cafe24OperationMetadata` table — adding a new endpoint means
 * adding one row, no code change in either consumer.
 */

export type Cafe24FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum';

export type Cafe24FieldLocation = 'path' | 'query' | 'body';

export interface Cafe24FieldSpec {
  type: Cafe24FieldType;
  location: Cafe24FieldLocation;
  enum?: string[];
  description?: string;
  default?: unknown;
}

export type Cafe24ResponseShape = 'list' | 'single' | 'empty';

/**
 * `approvalGroup` (not `category`) intentionally — avoids collision with
 * `Cafe24Resource` (the catalog category) and `Node.category` enum
 * (`integration` / `logic` / `ai` / ...). Same anti-collision pattern as
 * `scopeType` on `Cafe24OperationMetadata`.
 *
 * SoT for the actual list: `spec/conventions/cafe24-restricted-scopes.md`.
 */
export type Cafe24ApprovalGroup =
  | 'mileage'
  | 'notification'
  | 'privacy'
  | 'activitylogs'
  | 'menus'
  | 'naverpay_setting'
  | 'kakaopay_setting'
  | 'pg_settings'
  // Reserved placeholder for the Cafe24 Analytics API track (separate
  // approval program). No corresponding `RESTRICTED_APPROVAL` entry today —
  // the Admin API catalog has no row that points at this group. Will be
  // populated when Analytics support ships. See cafe24-restricted-scopes.md §3.
  | 'analytics';

/**
 * Conditional input constraint — captures the Cafe24 docs natural-language
 * notes like "회원 ID · 가입 시작/종료일 · 회원 등급 번호 중 한 가지는 반드시
 * 입력" that the `requiredFields: string[]` AND-semantic cannot express.
 *
 * Spec: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미".
 *
 * Three kinds:
 * - `oneOf`     — at-least-one-of (NOT JSON Schema's exactly-one). MCP schema
 *                 converts to `anyOf: [{required:[a]}, …]`.
 * - `allOrNone` — listed fields must all be present together or all absent.
 *                 Description suffix + runtime guard only (no JSON Schema —
 *                 LLM tool-call validators do not handle `not` consistently).
 * - `implies`   — when `if` is present, every field in `then` is required.
 *                 Description suffix + runtime guard only.
 *
 * Invariants enforced by `metadata.spec.ts`:
 * 1. All field names referenced (in `fields`, `if`, `then`) must be keys of
 *    the operation's `fields` map.
 * 2. `oneOf.fields` and `allOrNone.fields` have length >= 2.
 * 3. `implies.then` has length >= 1 (tuple-encoded).
 */
export type Cafe24FieldConstraint =
  | { kind: 'oneOf'; fields: string[] }
  | { kind: 'allOrNone'; fields: string[] }
  | { kind: 'implies'; if: string; then: [string, ...string[]] };

export interface Cafe24RestrictedApproval {
  /**
   * `scope`: the entire OAuth scope requires Cafe24 partner approval — all
   * sibling operations in the same resource share the label.
   * `operation`: only this single row needs approval (used inside the
   * general `mall.read_store` / `mall.write_store` scope).
   * `program`: a different track (e.g. Cafe24 Analytics) that is not part
   * of the Admin API catalog — these rows are skipped by catalog-sync.
   */
  level: 'scope' | 'operation' | 'program';
  /** UI message bucket. See `spec/conventions/cafe24-api-metadata.md` §2. */
  approvalGroup: Cafe24ApprovalGroup;
  /** Optional anchor in Cafe24 developer docs. */
  docsUrl?: string;
  /** Required link to the Cafe24 developer center inquiry form. */
  inquiryUrl: string;
}

/**
 * `scopeType` (not `category`) intentionally — avoids collision with
 * `Node.category` enum (`integration` / `logic` / `ai` / ...).
 * Maps directly to Cafe24 scope strings: `mall.read_<resource>` /
 * `mall.write_<resource>`.
 *
 * Note: `scopeType` is decoupled from HTTP `method`. A POST/PUT can be
 * `scopeType: 'read'` when Cafe24 requires only the read OAuth scope to
 * call it (e.g. `orders_calculation_total` uses POST for body-based
 * calculation but never mutates server state).
 */
export interface Cafe24OperationMetadata {
  id: string;
  label: string;
  description: string;
  scopeType: 'read' | 'write';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  requiredFields: string[];
  fields: Record<string, Cafe24FieldSpec>;
  responseShape?: Cafe24ResponseShape;
  paginated?: boolean;
  /**
   * Cafe24 partner-approval requirement marker. When set, frontend renders
   * a ⚠ badge + tooltip on the Operation dropdown / AI agent allowlist /
   * scope checkboxes. SoT: `spec/conventions/cafe24-restricted-scopes.md`.
   */
  restrictedApproval?: Cafe24RestrictedApproval;

  /**
   * Conditional input constraints — Cafe24 docs natural-language requirements
   * the AND-only `requiredFields` cannot express. See `Cafe24FieldConstraint`
   * for the three kinds (`oneOf` / `allOrNone` / `implies`).
   *
   * Surfaced on three channels by `Cafe24McpBridge` / `cafe24.handler.ts`:
   * 1. MCP tool description auto-suffix (LLM-readable, all kinds).
   * 2. Handler + MCP `execute()` runtime validation throwing
   *    `IntegrationError('CAFE24_MISSING_FIELDS', …)` (all kinds).
   * 3. JSON Schema `anyOf` (only for `oneOf` kind).
   *
   * Spec: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미".
   */
  constraints?: Cafe24FieldConstraint[];
}

export type Cafe24Resource =
  | 'store'
  | 'product'
  | 'order'
  | 'customer'
  | 'community'
  | 'design'
  | 'promotion'
  | 'application'
  | 'category'
  | 'collection'
  | 'supply'
  | 'shipping'
  | 'salesreport'
  | 'personal'
  | 'privacy'
  | 'mileage'
  | 'notification'
  | 'translation';

export const CAFE24_RESOURCES: readonly Cafe24Resource[] = [
  'store',
  'product',
  'order',
  'customer',
  'community',
  'design',
  'promotion',
  'application',
  'category',
  'collection',
  'supply',
  'shipping',
  'salesreport',
  'personal',
  'privacy',
  'mileage',
  'notification',
  'translation',
] as const;

export const CAFE24_RESOURCE_LABELS: Record<Cafe24Resource, string> = {
  store: 'Store (상점)',
  product: 'Product (상품)',
  order: 'Order (주문)',
  customer: 'Customer (회원)',
  community: 'Community (게시판)',
  design: 'Design (디자인)',
  promotion: 'Promotion (프로모션)',
  application: 'Application (앱 관리)',
  category: 'Category (상품분류)',
  collection: 'Collection (판매분류)',
  supply: 'Supply (공급사)',
  shipping: 'Shipping (배송)',
  salesreport: 'Salesreport (매출통계)',
  personal: 'Personal (개인화)',
  privacy: 'Privacy (개인정보)',
  mileage: 'Mileage (적립금)',
  notification: 'Notification (알림)',
  translation: 'Translation (번역)',
};
