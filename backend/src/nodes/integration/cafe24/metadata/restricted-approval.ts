import type { Cafe24RestrictedApproval } from './types.js';

/**
 * Shared partner-approval flags for the Cafe24 Admin API operations that
 * Cafe24 only authorizes to specific clients. The canonical list lives in
 * `spec/conventions/cafe24-restricted-scopes.md`; this module is the
 * single place where backend metadata builders import the marker.
 *
 * Keep the `inquiryUrl` identical across groups so the UI message bucket
 * stays consistent. Per-group `docsUrl` anchors the tooltip's deep link.
 */
const INQUIRY_URL = 'https://developers.cafe24.com';
const SCOPE_GUIDE_URL =
  'https://developers.cafe24.com/app/front/app/develop/api/scope';

/**
 * Cafe24 scope tokens whose OAuth consent itself requires partner approval.
 * Used at runtime to decide whether to attach `requiresCafe24Approval` to
 * an error response body (`INSUFFICIENT_SCOPE` / `oauth_invalid_scope`).
 *
 * Mirrors `spec/conventions/cafe24-restricted-scopes.md` §1 — keep these
 * two lists in sync when the spec changes.
 */
export const SCOPE_LEVEL_RESTRICTED_SCOPES: ReadonlySet<string> = new Set([
  'mall.read_mileage',
  'mall.write_mileage',
  'mall.read_notification',
  'mall.write_notification',
  'mall.read_privacy',
  'mall.write_privacy',
]);

/**
 * Filter an arbitrary list of scope tokens down to those that need Cafe24
 * partner approval. Stable order, deduplicated. Returns `undefined` when
 * no candidate scopes match — caller should omit the field entirely in
 * that case so other-provider integrations stay clean.
 */
export function pickRestrictedApprovalScopes(
  scopes: readonly string[] | undefined,
): string[] | undefined {
  if (!scopes || scopes.length === 0) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of scopes) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    if (SCOPE_LEVEL_RESTRICTED_SCOPES.has(s)) out.push(s);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Extract `mall.read_<r>` / `mall.write_<r>` tokens from a free-form Cafe24
 * error body (string or shallow object). Returns all tokens found, even
 * those that do not match the restricted list — `pickRestrictedApprovalScopes`
 * is the filter step.
 */
export function extractCafe24ScopeTokens(body: unknown): string[] {
  const sources: string[] = [];
  if (typeof body === 'string') {
    sources.push(body);
  } else if (body && typeof body === 'object') {
    for (const v of Object.values(body as Record<string, unknown>)) {
      if (typeof v === 'string') sources.push(v);
      else if (v && typeof v === 'object') {
        for (const inner of Object.values(v as Record<string, unknown>)) {
          if (typeof inner === 'string') sources.push(inner);
        }
      }
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  const TOKEN_RE = /mall\.(?:read|write)_[a-z_]+/g;
  for (const text of sources) {
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      const tok = m[0];
      if (seen.has(tok)) continue;
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

export const RESTRICTED_APPROVAL: Record<string, Cafe24RestrictedApproval> = {
  // Scope-level — `mall.read_<r>` / `mall.write_<r>` itself needs approval
  mileage: {
    level: 'scope',
    approvalGroup: 'mileage',
    docsUrl: SCOPE_GUIDE_URL,
    inquiryUrl: INQUIRY_URL,
  },
  notification: {
    level: 'scope',
    approvalGroup: 'notification',
    docsUrl: SCOPE_GUIDE_URL,
    inquiryUrl: INQUIRY_URL,
  },
  privacy: {
    level: 'scope',
    approvalGroup: 'privacy',
    docsUrl: SCOPE_GUIDE_URL,
    inquiryUrl: INQUIRY_URL,
  },
  // Operation-level — inside the general `mall.read_store`/`mall.write_store`
  store_activitylogs: {
    level: 'operation',
    approvalGroup: 'activitylogs',
    inquiryUrl: INQUIRY_URL,
  },
  store_menus: {
    level: 'operation',
    approvalGroup: 'menus',
    inquiryUrl: INQUIRY_URL,
  },
  store_naverpay_setting: {
    level: 'operation',
    approvalGroup: 'naverpay_setting',
    inquiryUrl: INQUIRY_URL,
  },
  store_kakaopay_setting: {
    level: 'operation',
    approvalGroup: 'kakaopay_setting',
    inquiryUrl: INQUIRY_URL,
  },
  store_pg_settings: {
    level: 'operation',
    approvalGroup: 'pg_settings',
    inquiryUrl: INQUIRY_URL,
  },
} as const;
