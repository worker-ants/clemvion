import { describe, it, expect } from "vitest";
import {
  resolveEditorShortcut,
  resolveZoomShortcut,
  PASTE_DUPLICATE_OFFSET,
} from "../editor-keyboard";

// §10 단축키 순수 매퍼. KeyboardEvent → 액션. DOM 부작용 없이 분기만 검증한다.
const key = (
  k: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {},
) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
});

describe("resolveEditorShortcut (§10)", () => {
  it("Ctrl 조합을 액션으로 매핑", () => {
    expect(resolveEditorShortcut(key("z", { ctrl: true }), false)).toBe("undo");
    expect(resolveEditorShortcut(key("y", { ctrl: true }), false)).toBe("redo");
    expect(
      resolveEditorShortcut(key("z", { ctrl: true, shift: true }), false),
    ).toBe("redo");
    expect(resolveEditorShortcut(key("s", { ctrl: true }), false)).toBe("save");
    expect(resolveEditorShortcut(key("/", { ctrl: true }), false)).toBe(
      "toggle-assistant",
    );
    expect(resolveEditorShortcut(key("c", { ctrl: true }), false)).toBe("copy");
    expect(resolveEditorShortcut(key("v", { ctrl: true }), false)).toBe("paste");
    expect(resolveEditorShortcut(key("d", { ctrl: true }), false)).toBe(
      "duplicate",
    );
    expect(resolveEditorShortcut(key("a", { ctrl: true }), false)).toBe(
      "select-all",
    );
    expect(
      resolveEditorShortcut(key("r", { ctrl: true, shift: true }), false),
    ).toBe("toggle-drawer");
    expect(resolveEditorShortcut(key("Escape"), false)).toBe("escape");
  });

  it("Cmd(meta) 조합도 동일하게 매핑", () => {
    expect(resolveEditorShortcut(key("c", { meta: true }), false)).toBe("copy");
    expect(resolveEditorShortcut(key("a", { meta: true }), false)).toBe(
      "select-all",
    );
  });

  it("입력 필드 포커스(typing) 중에는 C/V/D/A 를 매핑하지 않는다 (텍스트 편집 양보)", () => {
    expect(resolveEditorShortcut(key("c", { ctrl: true }), true)).toBeNull();
    expect(resolveEditorShortcut(key("v", { ctrl: true }), true)).toBeNull();
    expect(resolveEditorShortcut(key("d", { ctrl: true }), true)).toBeNull();
    expect(resolveEditorShortcut(key("a", { ctrl: true }), true)).toBeNull();
    // 저장·Undo·Redo·드로어·Escape 는 typing 중에도 전역 유지.
    expect(resolveEditorShortcut(key("s", { ctrl: true }), true)).toBe("save");
    expect(resolveEditorShortcut(key("z", { ctrl: true }), true)).toBe("undo");
    expect(resolveEditorShortcut(key("Escape"), true)).toBe("escape");
  });

  it("mod 없는 일반 키는 null (Escape 제외)", () => {
    expect(resolveEditorShortcut(key("c"), false)).toBeNull();
    expect(resolveEditorShortcut(key("a"), false)).toBeNull();
    expect(resolveEditorShortcut(key("x", { ctrl: true }), false)).toBeNull();
  });
});

describe("resolveZoomShortcut (§10)", () => {
  it("Ctrl + +/-/0/1 을 줌 액션으로 매핑", () => {
    expect(resolveZoomShortcut(key("=", { ctrl: true }), false)).toBe("zoom-in");
    expect(resolveZoomShortcut(key("+", { ctrl: true }), false)).toBe("zoom-in");
    expect(resolveZoomShortcut(key("-", { ctrl: true }), false)).toBe(
      "zoom-out",
    );
    expect(resolveZoomShortcut(key("0", { ctrl: true }), false)).toBe(
      "zoom-reset",
    );
    expect(resolveZoomShortcut(key("1", { ctrl: true }), false)).toBe(
      "fit-view",
    );
  });

  it("mod 없으면 null", () => {
    expect(resolveZoomShortcut(key("="), false)).toBeNull();
    expect(resolveZoomShortcut(key("0"), false)).toBeNull();
  });

  it("입력 필드 포커스 중에는 null (브라우저 기본 줌 양보)", () => {
    expect(resolveZoomShortcut(key("=", { ctrl: true }), true)).toBeNull();
    expect(resolveZoomShortcut(key("0", { ctrl: true }), true)).toBeNull();
  });
});

describe("PASTE_DUPLICATE_OFFSET", () => {
  it("복붙/복제 오프셋 상수", () => {
    expect(PASTE_DUPLICATE_OFFSET).toEqual({ x: 40, y: 40 });
  });
});
