/**
 * 팔레트 → 캔버스 노드 추가 브리지 (§4.2 클릭으로 노드 추가).
 *
 * `NodePalette` 는 좌측 패널이라 `ReactFlow` 인스턴스(뷰포트 중앙 좌표 계산)·locale·
 * 기본 LLM config 에 접근할 수 없다. 그 로직은 이미 `WorkflowCanvas` 에 있으므로,
 * canvas 가 노드 추가 핸들러를 여기 등록하고 palette 가 이 얇은 registry 를 통해
 * 호출한다 — 양쪽이 서로 import 하지 않아 모듈 순환을 피한다
 * ([[assistant-editor-bridge]] 와 동일 패턴).
 */

export type PaletteAddNodeHandler = (nodeType: string) => void;

let registered: PaletteAddNodeHandler | null = null;

export function registerPaletteCanvasBridge(
  fn: PaletteAddNodeHandler | null,
): void {
  registered = fn;
}

/** 팔레트 아이템 클릭 → 캔버스가 등록한 핸들러로 노드 추가. 미등록 시 no-op. */
export function addNodeFromPalette(nodeType: string): void {
  registered?.(nodeType);
}
