import { describe, it, expect } from "vitest";
import {
  parseIpWhitelist,
  isValidIpOrCidr,
  isValidHeaderName,
  buildAuthConfigPayload,
  validateAuthConfigForm,
  AUTH_CONFIG_DEFAULTS,
  type AuthConfigFormState,
} from "../auth-config-form";

function state(
  overrides: Partial<AuthConfigFormState> = {},
): AuthConfigFormState {
  return {
    name: "Cfg",
    type: "api_key",
    apiKeyHeader: AUTH_CONFIG_DEFAULTS.apiKeyHeader,
    hmacHeader: AUTH_CONFIG_DEFAULTS.hmacHeader,
    hmacAlgorithm: AUTH_CONFIG_DEFAULTS.hmacAlgorithm,
    username: "",
    password: "",
    ipWhitelistRaw: "",
    ...overrides,
  };
}

describe("parseIpWhitelist", () => {
  it("splits lines, trims, and drops blank/whitespace lines", () => {
    expect(parseIpWhitelist("10.0.0.0/8\n  \n  203.0.113.42 \n")).toEqual([
      "10.0.0.0/8",
      "203.0.113.42",
    ]);
  });
  it("returns an empty array for blank input", () => {
    expect(parseIpWhitelist("   \n\n")).toEqual([]);
  });
  it("handles Windows CRLF line endings (no trailing \\r)", () => {
    expect(parseIpWhitelist("10.0.0.0/8\r\n203.0.113.42\r\n")).toEqual([
      "10.0.0.0/8",
      "203.0.113.42",
    ]);
  });
});

describe("isValidIpOrCidr", () => {
  it("accepts IPv4 and IPv4 CIDR", () => {
    expect(isValidIpOrCidr("203.0.113.42")).toBe(true);
    expect(isValidIpOrCidr("10.0.0.0/8")).toBe(true);
    expect(isValidIpOrCidr("0.0.0.0/0")).toBe(true);
  });
  it("accepts IPv6 and IPv6 CIDR", () => {
    expect(isValidIpOrCidr("::1")).toBe(true);
    expect(isValidIpOrCidr("2001:db8::/32")).toBe(true);
  });
  it("rejects out-of-range octets and non-IP strings", () => {
    expect(isValidIpOrCidr("999.0.0.1")).toBe(false);
    expect(isValidIpOrCidr("10.0.0.0/33")).toBe(false);
    expect(isValidIpOrCidr("javascript:alert(1)")).toBe(false);
    expect(isValidIpOrCidr("; rm -rf /")).toBe(false);
    expect(isValidIpOrCidr("not-an-ip")).toBe(false);
  });
  it("rejects malformed IPv6 (triple colons, double ::, bad prefix, oversized group)", () => {
    expect(isValidIpOrCidr(":::")).toBe(false);
    expect(isValidIpOrCidr("ffff::::")).toBe(false);
    expect(isValidIpOrCidr("2001::db8::1")).toBe(false); // 두 번의 '::'
    expect(isValidIpOrCidr("2001:db8::/129")).toBe(false); // prefix > 128
    expect(isValidIpOrCidr("12345::1")).toBe(false); // 그룹 4 hex 초과
  });
});

describe("isValidHeaderName", () => {
  it("accepts RFC 7230 token header names", () => {
    expect(isValidHeaderName("X-API-Key")).toBe(true);
    expect(isValidHeaderName("X-Custom_Header.v2")).toBe(true);
  });
  it("rejects names with spaces, colons, or newlines (injection chars)", () => {
    expect(isValidHeaderName("X Api Key")).toBe(false);
    expect(isValidHeaderName("X-Api:Key")).toBe(false);
    expect(isValidHeaderName("X-Api\nKey")).toBe(false);
    expect(isValidHeaderName("")).toBe(false);
  });
});

describe("buildAuthConfigPayload", () => {
  it("api_key: sends config.headerName and omits it when blank (backend default)", () => {
    expect(
      buildAuthConfigPayload(state({ apiKeyHeader: "X-Custom" })),
    ).toEqual({ name: "Cfg", type: "api_key", config: { headerName: "X-Custom" } });
    // Whitespace-only header → omitted so the backend applies X-API-Key.
    expect(
      buildAuthConfigPayload(state({ apiKeyHeader: "   " })).config,
    ).toEqual({});
  });

  it("includes ipWhitelist (parsed) only when non-empty — for any type", () => {
    const bearer = buildAuthConfigPayload(
      state({ type: "bearer_token", ipWhitelistRaw: "10.0.0.0/8\n203.0.113.42" }),
    );
    expect(bearer.ipWhitelist).toEqual(["10.0.0.0/8", "203.0.113.42"]);
    expect(bearer.config).toEqual({});
    // empty whitelist → property absent
    expect(
      buildAuthConfigPayload(state({ type: "bearer_token" })),
    ).not.toHaveProperty("ipWhitelist");
  });

  it("hmac/basic_auth assemble their type-specific config", () => {
    expect(
      buildAuthConfigPayload(state({ type: "hmac", hmacHeader: "", hmacAlgorithm: "sha512" })).config,
    ).toEqual({ header: AUTH_CONFIG_DEFAULTS.hmacHeader, algorithm: "sha512" });
    expect(
      buildAuthConfigPayload(state({ type: "basic_auth", username: " u ", password: "p" })).config,
    ).toEqual({ username: "u", password: "p" });
  });
});

describe("validateAuthConfigForm", () => {
  it("returns null for valid input", () => {
    expect(
      validateAuthConfigForm(state({ apiKeyHeader: "X-API-Key", ipWhitelistRaw: "10.0.0.0/8" })),
    ).toBeNull();
  });
  it("flags an invalid api_key header name", () => {
    expect(validateAuthConfigForm(state({ apiKeyHeader: "Bad Header" }))).toEqual({
      key: "invalidHeaderName",
    });
  });
  it("skips header validation when the api_key header is blank (backend default applies)", () => {
    expect(
      validateAuthConfigForm(state({ apiKeyHeader: "   " })),
    ).toBeNull();
  });
  it("also validates the hmac signature header name", () => {
    expect(
      validateAuthConfigForm(state({ type: "hmac", hmacHeader: "Bad:Header" })),
    ).toEqual({ key: "invalidHeaderName" });
    expect(
      validateAuthConfigForm(
        state({ type: "hmac", hmacHeader: "X-Hub-Signature-256" }),
      ),
    ).toBeNull();
  });
  it("flags invalid IP/CIDR entries (any type) and lists them", () => {
    expect(
      validateAuthConfigForm(
        state({ type: "hmac", ipWhitelistRaw: "10.0.0.0/8\nnope\n999.1.1.1" }),
      ),
    ).toEqual({ key: "invalidIpWhitelist", invalid: ["nope", "999.1.1.1"] });
  });
  it("does not flag the header for non-api_key types", () => {
    expect(
      validateAuthConfigForm(state({ type: "bearer_token", apiKeyHeader: "Bad Header" })),
    ).toBeNull();
  });
});
