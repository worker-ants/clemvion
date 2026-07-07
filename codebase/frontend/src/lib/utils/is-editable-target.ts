/**
 * 전역 keydown 단축키 핸들러가 입력류 요소에 포커스가 있을 때 단축키를 가로채지
 * 않도록 판정하는 순수 헬퍼. INPUT/TEXTAREA/SELECT/contentEditable 이면 true.
 *
 * `isContentEditable` 은 jsdom 에 미구현이라 attribute 로도 한 번 더 확인한다.
 * (§10.12 Escape 가드 + §10 Ctrl+C/V/D/A 가드 공용.)
 */
export function isEditableTarget(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  const attr = el.getAttribute("contenteditable");
  return attr === "" || attr === "true";
}
