import { describe, it, expect } from "vitest";
import { sanitizeLoaderError } from "../sanitize-loader-error";
import { buildLoaderErrorMessages } from "../loader-error-messages";

// Helper to build a minimal Axios-like error matching the backend envelope
// `{ error: { code, message } }` (http-exception.filter).
function axiosError(error: { code?: string; message?: string } | undefined): unknown {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    response: { data: { error } },
  });
}

const MESSAGES: Record<string, string> = {
  LLM_CREDENTIALS_REQUIRED: "Enter an API key",
  LLM_CONFIG_INVALID: "Invalid config",
};

describe("sanitizeLoaderError", () => {
  it("maps a known error code to its localized message", () => {
    const err = axiosError({ code: "LLM_CREDENTIALS_REQUIRED", message: "raw server text" });
    expect(sanitizeLoaderError(err, "fallback", MESSAGES)).toBe("Enter an API key");
  });

  it("never surfaces the raw server message for an unmapped code", () => {
    const err = axiosError({
      code: "LLM_MODEL_LIST_FAILED",
      message: "https://internal.endpoint/v1 returned 500",
    });
    expect(sanitizeLoaderError(err, "fallback", MESSAGES)).toBe("fallback");
  });

  it("returns the fallback when no messagesByCode map is provided", () => {
    const err = axiosError({ code: "LLM_CREDENTIALS_REQUIRED" });
    expect(sanitizeLoaderError(err, "fallback")).toBe("fallback");
  });

  it("returns the fallback when the error code is absent", () => {
    const err = axiosError({ message: "something" });
    expect(sanitizeLoaderError(err, "fallback", MESSAGES)).toBe("fallback");
  });

  it("returns the fallback for non-axios errors", () => {
    const err = new Error("plain network error");
    expect(sanitizeLoaderError(err, "generic error", MESSAGES)).toBe("generic error");
  });

  it("returns the fallback when response has no data", () => {
    const err = Object.assign(new Error("timeout"), {
      isAxiosError: true,
      response: undefined,
    });
    expect(sanitizeLoaderError(err, "timeout fallback", MESSAGES)).toBe("timeout fallback");
  });

  // The backend wraps every error as `{ error: { code, message } }`. A legacy
  // flat `{ message }` body (no `error.code`) must resolve to the fallback —
  // never the raw string.
  it("returns the fallback for a legacy flat-message body (no error.code)", () => {
    const err = Object.assign(new Error("legacy"), {
      isAxiosError: true,
      response: { data: { message: "raw flat message" } },
    });
    expect(sanitizeLoaderError(err, "fallback", MESSAGES)).toBe("fallback");
  });
});

describe("buildLoaderErrorMessages", () => {
  it("maps the known user-actionable backend codes", () => {
    const t = ((key: string) => key) as Parameters<typeof buildLoaderErrorMessages>[0];
    const map = buildLoaderErrorMessages(t);
    expect(Object.keys(map).sort()).toEqual(
      ["LLM_CONFIG_INVALID", "LLM_CREDENTIALS_REQUIRED"].sort(),
    );
    expect(map.LLM_CREDENTIALS_REQUIRED).toBe("llmConfigs.errorCredentialsRequired");
    expect(map.LLM_CONFIG_INVALID).toBe("llmConfigs.errorConfigInvalid");
  });
});
