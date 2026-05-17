import { describe, it, expect } from "vitest";
import type { AxiosResponse } from "axios";
import { unwrap } from "../unwrap";

function fake<T>(data: T): AxiosResponse<unknown> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as unknown as AxiosResponse<unknown>;
}

describe("unwrap", () => {
  it("peels a { data: T } envelope from the TransformInterceptor", () => {
    const r = fake({ data: { id: "1", name: "x" } });
    expect(unwrap(r)).toEqual({ id: "1", name: "x" });
  });

  it("returns the body unchanged when it is already a raw array", () => {
    const r = fake([{ id: "1" }, { id: "2" }]);
    expect(unwrap(r)).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("returns the body unchanged when it is a primitive (e.g. boolean)", () => {
    expect(unwrap(fake(true))).toBe(true);
    expect(unwrap(fake("ok"))).toBe("ok");
    expect(unwrap(fake(42))).toBe(42);
  });

  it("handles a plain object without the `data` key as-is (no drilling)", () => {
    const r = fake({ name: "x" });
    expect(unwrap(r)).toEqual({ name: "x" });
  });

  it("returns null/undefined as-is", () => {
    expect(unwrap(fake(null))).toBeNull();
    expect(unwrap(fake(undefined))).toBeUndefined();
  });

  it("only peels one level — nested envelopes stay", () => {
    const r = fake({ data: { data: { deep: true } } });
    expect(unwrap(r)).toEqual({ data: { deep: true } });
  });
});
