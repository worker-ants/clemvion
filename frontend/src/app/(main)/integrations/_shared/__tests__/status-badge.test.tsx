import { describe, it, expect } from "vitest";
import { computeStatus } from "../status-badge";
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
    tokenExpiresAt: null,
    lastCheckedAt: null,
    expiresAt: null,
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

  it("surfaces the diagnostic detail when pending_install has a statusReason (변경 0)", () => {
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
});
