/**
 * 워크플로 에디터 키보드 단축키의 **순수 매핑** (§10). KeyboardEvent → 액션 이름.
 * DOM 부작용(preventDefault·store dispatch·포커스 이동)은 호출부가 담당하고, 여기서는
 * "어떤 키 조합이 어떤 액션인가" 분기만 다뤄 단위 테스트가 용이하다.
 *
 * `typing`(입력 필드 포커스 여부)이 true 면 텍스트 편집을 방해하지 않도록 복사/붙여넣기/
 * 복제/전체선택을 매핑하지 않는다. 저장·Undo·Redo·Assistant 토글·드로어 토글은 기존
 * 동작대로 전역 유지한다.
 */
export type EditorShortcutAction =
  | "undo"
  | "redo"
  | "save"
  | "toggle-assistant"
  | "copy"
  | "paste"
  | "duplicate"
  | "select-all"
  | "toggle-drawer"
  | "escape";

interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function resolveEditorShortcut(
  e: KeyLike,
  typing: boolean,
): EditorShortcutAction | null {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.key === "z" && !e.shiftKey) return "undo";
  if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) return "redo";
  if (isMod && e.key === "s") return "save";
  if (isMod && e.key === "/") return "toggle-assistant";
  // Ctrl/Cmd+C/V/D/A — 편집 필드 포커스 중에는 양보(§3.2/§3.3).
  if (isMod && !typing && e.key === "c") return "copy";
  if (isMod && !typing && e.key === "v") return "paste";
  if (isMod && !typing && e.key === "d") return "duplicate";
  if (isMod && !typing && e.key === "a") return "select-all";
  if (isMod && e.shiftKey && (e.key === "r" || e.key === "R")) return "toggle-drawer";
  // Escape 의 세부 분기(드로어 복귀 vs 선택 해제)는 DOM 컨텍스트가 필요해 호출부가 결정.
  if (e.key === "Escape") return "escape";
  return null;
}

/**
 * 캔버스 줌 단축키의 순수 매핑 (§10). Ctrl/Cmd + +/-/0/1. ReactFlow 인스턴스가 필요해
 * 실행은 캔버스 컴포넌트가 하지만, 매핑·`typing` 가드는 여기서 테스트한다.
 */
export type ZoomShortcutAction = "zoom-in" | "zoom-out" | "zoom-reset" | "fit-view";

export function resolveZoomShortcut(
  e: KeyLike,
  typing: boolean,
): ZoomShortcutAction | null {
  const isMod = e.ctrlKey || e.metaKey;
  if (!isMod || typing) return null;
  if (e.key === "=" || e.key === "+") return "zoom-in";
  if (e.key === "-") return "zoom-out";
  if (e.key === "0") return "zoom-reset";
  if (e.key === "1") return "fit-view";
  return null;
}

/** §3.3 붙여넣기/복제 시 원본 대비 오프셋 (px). copy-paste·duplicate 공용. */
export const PASTE_DUPLICATE_OFFSET = { x: 40, y: 40 } as const;
