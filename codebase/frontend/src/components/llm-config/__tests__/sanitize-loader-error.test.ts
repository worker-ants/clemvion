import { describe, it, expect } from "vitest";
import { sanitizeLoaderError } from "../sanitize-loader-error";

// Helper to build a minimal Axios-like error object.
function axiosError(
  message: string | string[] | undefined,
): unknown {
  return Object.assign(new Error("request failed"), {
    isAxiosError: true,
    response: { data: { message } },
  });
}

describe("sanitizeLoaderError", () => {
  it("returns the server message when it is a non-empty string", () => {
    const err = axiosError("Rate limit exceeded");
    expect(sanitizeLoaderError(err, "fallback")).toBe("Rate limit exceeded");
  });

  it("joins an array-shaped message with commas", () => {
    const err = axiosError(["field must not be empty", "invalid format"]);
    expect(sanitizeLoaderError(err, "fallback")).toBe(
      "field must not be empty, invalid format",
    );
  });

  it("truncates a message longer than 200 characters to exactly 200", () => {
    const long = "x".repeat(201);
    const err = axiosError(long);
    const result = sanitizeLoaderError(err, "fallback");
    expect(result).toHaveLength(200);
    expect(result).toBe("x".repeat(200));
  });

  it("returns the fallback when the server message is undefined", () => {
    const err = axiosError(undefined);
    expect(sanitizeLoaderError(err, "fallback msg")).toBe("fallback msg");
  });

  it("returns the fallback when the server message is an empty string", () => {
    const err = axiosError("");
    expect(sanitizeLoaderError(err, "fallback msg")).toBe("fallback msg");
  });

  it("returns the fallback for non-axios errors", () => {
    const err = new Error("plain network error");
    expect(sanitizeLoaderError(err, "generic error")).toBe("generic error");
  });

  it("returns the fallback when response has no data", () => {
    const err = Object.assign(new Error("timeout"), {
      isAxiosError: true,
      response: undefined,
    });
    expect(sanitizeLoaderError(err, "timeout fallback")).toBe("timeout fallback");
  });
});
