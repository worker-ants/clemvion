import { describe, it, expect } from "vitest";
import {
  INSTALL_TIMEOUT_REASON,
  isReauthorizeDisabled,
  isRequestScopesDisabled,
  pickErrorMessage,
  reauthorizeDisabledReason,
  requestScopesDisabledReason,
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

  // CLE-T-NNENG8 — Cafe24 Private 재인증은 재설치 요청을 남기고 App URL 로 끝낸다. App URL 이 있어야 한다.
  it.each(["connected", "error", "expired"] as const)(
    "enables Cafe24 Private (%s) when the App URL exists — reinstall request",
    (status) => {
      expect(
        isReauthorizeDisabled(
          row({
            status,
            serviceType: "cafe24",
            meta: { appType: "private" },
            appUrl: "https://app.example.com/api/3rd-party/cafe24/install/tok",
          }),
        ),
      ).toBe(false);
    },
  );

  it("disables Cafe24 Private without an App URL (install_token gone)", () => {
    expect(
      isReauthorizeDisabled(
        row({
          status: "connected",
          serviceType: "cafe24",
          meta: { appType: "private" },
          appUrl: null,
        }),
      ),
    ).toBe(true);
  });

  // CLE-T-NNENG8 — MakeShop 은 재인증 · 권한 추가를 받지 않는다. 복구는 삭제 후 재등록이다.
  it.each(["connected", "error", "expired"] as const)(
    "disables MakeShop (%s) — delete and re-register only",
    (status) => {
      expect(
        isReauthorizeDisabled(
          row({
            status,
            serviceType: "makeshop",
            appUrl: "https://app.example.com/api/3rd-party/makeshop/install/tok",
          }),
        ),
      ).toBe(true);
    },
  );

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

describe("reauthorizeDisabledReason", () => {
  it("returns null when reauthorize is available", () => {
    expect(reauthorizeDisabledReason(row({}))).toBeNull();
  });

  it.each([
    [row({ status: "pending_install" }), "pending_install"],
    [
      row({ status: "pending_install", serviceType: "makeshop" }),
      "pending_install",
    ],
    [
      row({ status: "expired", statusReason: INSTALL_TIMEOUT_REASON }),
      "install_timeout",
    ],
    [row({ serviceType: "makeshop" }), "makeshop"],
    // App URL 이 없는 Cafe24 Private 은 `connected` 여도 있다(옛 행) — 설치 시간 초과와 사유가 다르다.
    [
      row({
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: null,
      }),
      "no_app_url",
    ],
    [
      row({
        status: "error",
        statusReason: "auth_failed",
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: null,
      }),
      "no_app_url",
    ],
    // 설치 시간 초과가 먼저다 — 그 행도 App URL 이 없지만 사용자에게는 만료 사유를 말한다.
    [
      row({
        status: "expired",
        statusReason: INSTALL_TIMEOUT_REASON,
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: null,
      }),
      "install_timeout",
    ],
  ] as const)("%# → %s", (integration, reason) => {
    expect(reauthorizeDisabledReason(integration)).toBe(reason);
  });

  it("install_timeout 은 expired + install_timeout 사유에만 쓴다", () => {
    const reasons = [
      row({ status: "connected" }),
      row({ status: "expired", statusReason: "token_expired" }),
      row({ status: "error", statusReason: INSTALL_TIMEOUT_REASON }),
      row({
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: null,
      }),
    ].map((r) => reauthorizeDisabledReason(r));
    expect(reasons).not.toContain("install_timeout");
  });

  it("agrees with isReauthorizeDisabled", () => {
    const rows = [
      row({}),
      row({ status: "pending_install" }),
      row({ serviceType: "makeshop" }),
      row({ serviceType: "cafe24", meta: { appType: "private" }, appUrl: null }),
      row({
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: "https://x/install/t",
      }),
    ];
    for (const r of rows) {
      expect(isReauthorizeDisabled(r)).toBe(reauthorizeDisabledReason(r) !== null);
    }
  });
});

describe("isRequestScopesDisabled", () => {
  it("disables MakeShop — no scope request path", () => {
    expect(isRequestScopesDisabled(row({ serviceType: "makeshop" }))).toBe(true);
  });

  it("disables Cafe24 Private without an App URL", () => {
    expect(
      isRequestScopesDisabled(
        row({
          serviceType: "cafe24",
          meta: { appType: "private" },
          appUrl: null,
        }),
      ),
    ).toBe(true);
  });

  it.each([
    row({ serviceType: "google" }),
    row({ serviceType: "cafe24", meta: { appType: "public" } }),
    row({
      serviceType: "cafe24",
      meta: { appType: "private" },
      appUrl: "https://x/install/t",
    }),
  ])("keeps request-scopes available (%#)", (integration) => {
    expect(isRequestScopesDisabled(integration)).toBe(false);
  });
});

describe("requestScopesDisabledReason", () => {
  it("returns null when request-scopes is available", () => {
    expect(requestScopesDisabledReason(row({}))).toBeNull();
    expect(
      requestScopesDisabledReason(
        row({
          serviceType: "cafe24",
          meta: { appType: "private" },
          appUrl: "https://x/install/t",
        }),
      ),
    ).toBeNull();
  });

  it("makeshop — no scope request path", () => {
    expect(requestScopesDisabledReason(row({ serviceType: "makeshop" }))).toBe(
      "makeshop",
    );
  });

  it.each(["connected", "error", "expired"] as const)(
    "Cafe24 Private (%s) without an App URL → no_app_url",
    (status) => {
      expect(
        requestScopesDisabledReason(
          row({
            status,
            serviceType: "cafe24",
            meta: { appType: "private" },
            appUrl: null,
          }),
        ),
      ).toBe("no_app_url");
    },
  );

  it("agrees with isRequestScopesDisabled", () => {
    const rows = [
      row({}),
      row({ serviceType: "makeshop" }),
      row({ serviceType: "cafe24", meta: { appType: "private" }, appUrl: null }),
      row({
        serviceType: "cafe24",
        meta: { appType: "private" },
        appUrl: "https://x/install/t",
      }),
    ];
    for (const r of rows) {
      expect(isRequestScopesDisabled(r)).toBe(requestScopesDisabledReason(r) !== null);
    }
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
