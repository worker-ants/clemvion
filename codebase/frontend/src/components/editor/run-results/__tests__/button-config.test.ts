import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseButtonConfig, openExternalLink } from "../button-config";

describe("parseButtonConfig", () => {
  it("returns null for non-object payloads", () => {
    expect(parseButtonConfig(null)).toBeNull();
    expect(parseButtonConfig("nope")).toBeNull();
    expect(parseButtonConfig(42)).toBeNull();
  });

  it("returns null when no valid buttons parse", () => {
    expect(parseButtonConfig({ buttons: [] })).toBeNull();
    expect(parseButtonConfig({ buttons: [{ id: 1 }] })).toBeNull();
  });

  it("parses a valid port button", () => {
    const cfg = parseButtonConfig({
      buttons: [{ id: "a", label: "A", type: "port" }],
    });
    expect(cfg).toEqual({
      buttons: [{ id: "a", label: "A", type: "port", url: undefined, style: undefined }],
    });
  });

  it("drops link buttons with unsafe protocols", () => {
    const cfg = parseButtonConfig({
      buttons: [
        { id: "evil", label: "X", type: "link", url: "javascript:alert(1)" },
        { id: "ok", label: "Y", type: "link", url: "https://example.com" },
      ],
    });
    expect(cfg?.buttons.map((b) => b.id)).toEqual(["ok"]);
  });

  it("strips invalid styles", () => {
    const cfg = parseButtonConfig({
      buttons: [{ id: "a", label: "A", type: "port", style: "rainbow" }],
    });
    expect(cfg?.buttons[0].style).toBeUndefined();
  });
});

describe("openExternalLink", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("opens http(s) URLs", () => {
    openExternalLink("https://example.com");
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("blocks javascript: URLs", () => {
    openExternalLink("javascript:alert(1)");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("blocks data: URLs", () => {
    openExternalLink("data:text/html,<script>alert(1)</script>");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("blocks malformed URLs", () => {
    openExternalLink("not a url");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
