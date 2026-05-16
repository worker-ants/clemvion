import { describe, it, expect } from "vitest";
import {
  computeStatus,
  isReauthorizeDisabled,
  computeAttentionBreakdown,
  needsAttention,
} from "../status-badge";
import type { IntegrationDto } from "@/lib/api/integrations";

function row(overrides: Partial<IntegrationDto>): IntegrationDto {
  return {
    id: "i",
    workspaceId: "ws",
    serviceType: "cafe24",
    name: "",
    authType: "oauth2",
    credentials: {},
    scope: "personal",
    status: "connected",
    statusReason: null,
    credentialsStatus: "ok",
    lastError: null,
    meta: { appType: null },
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    createdBy: "u",
    createdAt: "2026-05-14T00:00:00Z",
    updatedAt: "2026-05-14T00:00:00Z",
    ...overrides,
  } as IntegrationDto;
}

describe("computeStatus", () => {
  it("returns connected for connected status", () => {
    expect(computeStatus(row({ status: "connected" })).label).toBe("Connected");
  });

  it("returns Pending install with default hint when no statusReason", () => {
    const view = computeStatus(
      row({ status: "pending_install", statusReason: null }),
    );
    expect(view.label).toBe("Pending install");
    expect(view.tone).toBe("warn");
    expect(view.detail).toBe("Complete Cafe24 Test Run to activate");
  });

  it("surfaces the diagnostic detail when pending_install has a statusReason", () => {
    // Callback failure populated last_error/status_reason — UI must show the
    // diagnostic so the user can fix the underlying cause (e.g. wrong
    // client_id) and re-run "테스트 실행".
    const view = computeStatus(
      row({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
      }),
    );
    expect(view.label).toBe("Pending install");
    expect(view.detail).toContain("oauth_token_exchange_failed");
    expect(view.tone).toBe("err");
  });

  it("returns Error with statusReason as detail for error status", () => {
    const view = computeStatus(
      row({ status: "error", statusReason: "auth_failed" }),
    );
    expect(view.label).toBe("Error");
    expect(view.tone).toBe("err");
    expect(view.detail).toBe("auth_failed");
  });

  it("prefers needs_reauth banner over status", () => {
    expect(
      computeStatus(
        row({ status: "connected", credentialsStatus: "needs_reauth" }),
      ).label,
    ).toBe("Reconnection required");
  });

  it("returns Expired without bespoke detail", () => {
    expect(computeStatus(row({ status: "expired" })).label).toBe("Expired");
    expect(computeStatus(row({ status: "expired" })).detail).toBeUndefined();
  });

  it("surfaces install_timeout hint on expired Cafe24 Private rows", () => {
    const view = computeStatus(
      row({ status: "expired", statusReason: "install_timeout" }),
    );
    expect(view.label).toBe("Expired");
    expect(view.detail).toContain("delete and re-register");
  });

  it("prefers lastError.message over status_reason for pending_install diagnostic", () => {
    const view = computeStatus(
      row({
        status: "pending_install",
        statusReason: "oauth_token_exchange_failed",
        lastError: { message: "Failed to exchange code: invalid_grant" },
      }),
    );
    expect(view.detail).toContain("invalid_grant");
  });
});

describe("isReauthorizeDisabled", () => {
  it("disables for pending_install rows", () => {
    expect(isReauthorizeDisabled(row({ status: "pending_install" }))).toBe(true);
  });

  it("disables for expired + install_timeout", () => {
    expect(
      isReauthorizeDisabled(
        row({ status: "expired", statusReason: "install_timeout" }),
      ),
    ).toBe(true);
  });

  it("disables for any Cafe24 Private integration regardless of status", () => {
    expect(
      isReauthorizeDisabled(
        row({
          status: "connected",
          serviceType: "cafe24",
          meta: { appType: "private" },
        }),
      ),
    ).toBe(true);
  });

  it("does NOT disable for connected Cafe24 Public integrations", () => {
    expect(
      isReauthorizeDisabled(
        row({
          status: "connected",
          serviceType: "cafe24",
          meta: { appType: "public" },
        }),
      ),
    ).toBe(false);
  });

  it("does NOT disable for a regular connected integration", () => {
    expect(
      isReauthorizeDisabled(
        row({ status: "connected", serviceType: "google" }),
      ),
    ).toBe(false);
  });
});

// spec/2-navigation/4-integration.md §2.4 + Rationale "Attention 가상 필터값"
describe("computeAttentionBreakdown", () => {
  // 7d ahead → expiring; 1d ahead → expiring; past → not expiring on its own.
  const inDays = (days: number) =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  it("counts expired/expiring/error separately and totals them", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "expired" }),
      row({ id: "b", status: "error", statusReason: "auth_failed" }),
      row({
        id: "c",
        status: "connected",
        tokenExpiresAt: inDays(2), // expiring (within 7d)
      }),
      row({
        id: "d",
        status: "connected",
        tokenExpiresAt: inDays(30), // not expiring
      }),
      row({ id: "e", status: "pending_install" }), // explicitly excluded
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.expired).toBe(1);
    expect(br.error).toBe(1);
    expect(br.expiring).toBe(1);
    expect(br.total).toBe(3);
  });

  it("returns 0 totals for a list with no attention rows", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "connected" }),
      row({ id: "b", status: "pending_install" }),
    ];
    expect(computeAttentionBreakdown(items).total).toBe(0);
  });

  // The single-row UX (banner → detail jump) needs a deterministic target.
  it("exposes mostUrgentId when exactly one row needs attention", () => {
    const items: IntegrationDto[] = [
      row({ id: "only-one", status: "error" }),
      row({ id: "ok", status: "connected" }),
    ];
    const br = computeAttentionBreakdown(items);
    expect(br.total).toBe(1);
    expect(br.mostUrgentId).toBe("only-one");
  });

  // When multiple categories are present, error > expired > expiring is the
  // priority order so the most actionable case wins. mostUrgentId is only
  // meaningful when total === 1, but we still expose a deterministic value.
  it("agrees with needsAttention's single-row predicate", () => {
    const items: IntegrationDto[] = [
      row({ id: "a", status: "expired" }),
      row({ id: "b", status: "connected" }),
    ];
    const br = computeAttentionBreakdown(items);
    const filtered = items.filter(needsAttention);
    expect(br.total).toBe(filtered.length);
  });

  it("picks error > expired > expiring for mostUrgentId when categories coexist", () => {
    const items: IntegrationDto[] = [
      row({ id: "exp-1", status: "expired" }),
      row({
        id: "soon-1",
        status: "connected",
        tokenExpiresAt: inDays(2),
      }),
      row({ id: "err-1", status: "error" }),
    ];
    expect(computeAttentionBreakdown(items).mostUrgentId).toBe("err-1");
  });

  it("falls back to expired when no error rows are present", () => {
    const items: IntegrationDto[] = [
      row({
        id: "soon-1",
        status: "connected",
        tokenExpiresAt: inDays(2),
      }),
      row({ id: "exp-1", status: "expired" }),
    ];
    expect(computeAttentionBreakdown(items).mostUrgentId).toBe("exp-1");
  });

  it("returns null mostUrgentId on an empty list", () => {
    expect(computeAttentionBreakdown([])).toEqual({
      expired: 0,
      expiring: 0,
      error: 0,
      total: 0,
      mostUrgentId: null,
    });
  });

  // EXPIRING_SOON_DAYS = 7 — locked-in boundary. Tokens expiring within 7
  // days are attention-worthy; anything beyond is not.
  it("counts a token expiring in just under 7 days as expiring", () => {
    const justUnder = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000,
    ).toISOString();
    const items: IntegrationDto[] = [
      row({ id: "edge", status: "connected", tokenExpiresAt: justUnder }),
    ];
    expect(computeAttentionBreakdown(items).expiring).toBe(1);
  });

  it("does NOT count a token expiring well past 7 days as expiring", () => {
    const items: IntegrationDto[] = [
      row({
        id: "far",
        status: "connected",
        tokenExpiresAt: inDays(30),
      }),
    ];
    expect(computeAttentionBreakdown(items).total).toBe(0);
  });
});
