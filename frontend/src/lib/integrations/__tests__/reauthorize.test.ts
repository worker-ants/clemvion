import { describe, it, expect } from "vitest";
import {
  INSTALL_TIMEOUT_REASON,
  isReauthorizeDisabled,
  pickErrorMessage,
} from "../reauthorize";
import type { IntegrationDto } from "@/lib/api/integrations";

function row(overrides: Partial<IntegrationDto>): IntegrationDto {
  return {
    id: "i",
    workspaceId: "ws",
    serviceType: "google",
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

describe("isReauthorizeDisabled", () => {
  it("disables pending_install regardless of provider", () => {
    expect(
      isReauthorizeDisabled(row({ status: "pending_install" })),
    ).toBe(true);
  });

  it("disables expired + install_timeout (TTL exhausted)", () => {
    expect(
      isReauthorizeDisabled(
        row({ status: "expired", statusReason: INSTALL_TIMEOUT_REASON }),
      ),
    ).toBe(true);
  });

  it("disables every Cafe24 Private integration even when connected", () => {
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

  it("does NOT disable connected Cafe24 Public (env-based OAuth)", () => {
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

  it("does NOT disable expired without install_timeout reason", () => {
    expect(
      isReauthorizeDisabled(
        row({ status: "expired", statusReason: "token_expired" }),
      ),
    ).toBe(false);
  });

  it("does NOT disable regular providers", () => {
    expect(
      isReauthorizeDisabled(
        row({ status: "connected", serviceType: "google" }),
      ),
    ).toBe(false);
  });
});

describe("pickErrorMessage", () => {
  it("prefers lastError.message when present", () => {
    expect(
      pickErrorMessage(
        row({
          statusReason: "oauth_token_exchange_failed",
          lastError: { message: "Failed: invalid_grant" },
        }),
      ),
    ).toBe("Failed: invalid_grant");
  });

  it("falls back to statusReason when lastError.message missing", () => {
    expect(
      pickErrorMessage(
        row({
          statusReason: "oauth_token_exchange_failed",
          lastError: null,
        }),
      ),
    ).toBe("oauth_token_exchange_failed");
  });

  it("returns undefined when neither present", () => {
    expect(pickErrorMessage(row({}))).toBeUndefined();
  });

  it("ignores empty lastError.message", () => {
    expect(
      pickErrorMessage(
        row({
          statusReason: "fallback",
          lastError: { message: "" },
        }),
      ),
    ).toBe("fallback");
  });
});
