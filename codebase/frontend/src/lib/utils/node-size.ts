/**
 * React Flow 노드에서 **측정된** width/height 를 꺼낸다.
 *
 * @xyflow/react v12 에서는 노드가 DOM 에 렌더링된 후 `measured.width` /
 * `measured.height` 필드가 채워진다. 동시에 `node.width` / `node.height` 는
 * 사용자가 노드를 만들 때 힌트로 직접 지정할 수 있는 이니셜 값으로 남아
 * 있다. 어시스턴트가 layout 계산에 쓸 때는:
 *   1) 측정된 값을 가장 신뢰 (`measured`)
 *   2) 없으면 이니셜 값 fallback (`width/height`)
 *   3) 그것도 없으면 undefined 반환 → 서버에서 250×80 폴백 처리
 *
 * 양의 유한 숫자만 반환한다 — 0/NaN/음수는 필드를 누락시킨다.
 */
interface NodeSizeSource {
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
}

function pickFinitePositive(...candidates: (number | undefined)[]):
  | number
  | undefined {
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  }
  return undefined;
}

export function getNodeMeasuredSize(node: NodeSizeSource): {
  width?: number;
  height?: number;
} {
  const width = pickFinitePositive(node.measured?.width, node.width);
  const height = pickFinitePositive(node.measured?.height, node.height);
  return {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}
