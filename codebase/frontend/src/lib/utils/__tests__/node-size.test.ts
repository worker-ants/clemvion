import { describe, it, expect } from "vitest";
import { getNodeMeasuredSize } from "../node-size";

describe("getNodeMeasuredSize", () => {
  it("prefers measured values over initial width/height hints", () => {
    expect(
      getNodeMeasuredSize({
        measured: { width: 320, height: 100 },
        width: 250,
        height: 80,
      }),
    ).toEqual({ width: 320, height: 100 });
  });

  it("falls back to initial width/height when measured is absent", () => {
    expect(getNodeMeasuredSize({ width: 250, height: 80 })).toEqual({
      width: 250,
      height: 80,
    });
  });

  it("omits a dimension entirely when both sources are absent", () => {
    expect(getNodeMeasuredSize({})).toEqual({});
  });

  it("rejects zero/negative/NaN as if they were absent", () => {
    expect(
      getNodeMeasuredSize({ measured: { width: 0, height: -5 } }),
    ).toEqual({});
    expect(
      getNodeMeasuredSize({
        measured: { width: Number.NaN, height: Number.POSITIVE_INFINITY },
      }),
    ).toEqual({});
  });

  it("can return only one dimension if the other is invalid", () => {
    expect(
      getNodeMeasuredSize({ measured: { width: 200, height: 0 } }),
    ).toEqual({ width: 200 });
  });
});
