import { describe, it, expect, vi, afterEach } from "vitest";
import {
  registerPaletteCanvasBridge,
  addNodeFromPalette,
} from "../palette-canvas-bridge";

afterEach(() => registerPaletteCanvasBridge(null));

describe("palette-canvas-bridge (§4.2)", () => {
  it("등록된 핸들러로 노드 타입을 dispatch", () => {
    const handler = vi.fn();
    registerPaletteCanvasBridge(handler);
    addNodeFromPalette("http_request");
    expect(handler).toHaveBeenCalledWith("http_request");
  });

  it("미등록(null) 이면 no-op (크래시 없음)", () => {
    registerPaletteCanvasBridge(null);
    expect(() => addNodeFromPalette("http_request")).not.toThrow();
  });
});
